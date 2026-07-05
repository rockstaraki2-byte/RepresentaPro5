import React, { useState, useMemo } from 'react';
import { Pedido, Cliente, Representada } from '../types';
import { formatarMoeda, formatarData } from '../utils';
import { 
  DollarSign, 
  Search, 
  Calendar, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  AlertCircle, 
  Download, 
  Trash2, 
  Edit3, 
  X,
  TrendingUp,
  TrendingDown,
  Percent,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar 
} from 'recharts';
import { gerarComissoesPDF, gerarProvisionamentoPDF, gerarResumoMensalPDF } from '../lib/pdfGenerator';

interface FinanceiroTabProps {
  pedidos: Pedido[];
  clientes: Cliente[];
  representadas: Representada[];
  onEditPedido: (pedido: Pedido) => Promise<void>;
  onDeletePedido: (id: string) => Promise<void>;
  currentUser?: any;
  empresaRepresentacao?: any;
}

interface ProvisionedInstallment {
  id: string;
  numeroPedido: string;
  clienteNome: string;
  representadaNome: string;
  parcelaIndex: number;
  parcelaTotal: number;
  dataVencimento: string;
  valorTotal: number;
  valorComissao: number;
  valorDespesa: number;
}

export default function FinanceiroTab({
  pedidos,
  clientes,
  representadas,
  onEditPedido,
  onDeletePedido,
  currentUser,
  empresaRepresentacao
}: FinanceiroTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'comissoes' | 'provisionamento'>('comissoes');
  
  // Collapsible Filters State
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // --- Comissões State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [comissaoStatusFilter, setComissaoStatusFilter] = useState<string>('Todos');
  const [representadaFilter, setRepresentadaFilter] = useState<string>('Todos');

  // --- Relatório de Desempenho Mensal State & Memo ---
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  const availableMonthsForReport = useMemo(() => {
    const months = new Set<string>();
    pedidos.forEach(p => {
      if (p.dataPedido) {
        months.add(p.dataPedido.slice(0, 7)); // "YYYY-MM"
      }
    });
    if (months.size === 0) {
      months.add(new Date().toISOString().slice(0, 7));
    }
    return Array.from(months).sort().reverse(); // Show latest months first
  }, [pedidos]);

  // Editing state
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [editComissaoPercent, setEditComissaoPercent] = useState<number>(0);
  const [editComissaoValor, setEditComissaoValor] = useState<number>(0);
  const [editComissaoStatus, setEditComissaoStatus] = useState<'Pendente' | 'Liberada' | 'Paga' | 'Excluida'>('Pendente');

  // --- Provisionamento State ---
  const [repassePercentual, setRepassePercentual] = useState<number>(30); // Default 30% repasse (despesa)
  const [provisaoMonthFilter, setProvisaoMonthFilter] = useState<string>('Todos');
  const [provisaoRepresentadaFilter, setProvisaoRepresentadaFilter] = useState<string>('Todos');

  // Helper to add days to a date string
  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Parser for condicoes de pagamento (e.g. "30/60/90")
  const parseInstallments = (condicao: string | undefined): number[] => {
    if (!condicao || !condicao.trim()) return [0];
    const cleaned = condicao.trim().toLowerCase();
    if (
      cleaned === 'à vista' || 
      cleaned === 'a vista' || 
      cleaned === 'dinheiro' || 
      cleaned === 'pix' || 
      cleaned === 'imediato' || 
      cleaned === '0'
    ) {
      return [0];
    }
    const parts = cleaned.split(/[\/\s,;\-]+/);
    const days: number[] = [];
    for (const part of parts) {
      const num = parseInt(part.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num >= 0) {
        days.push(num);
      }
    }
    if (days.length === 0) return [0];
    return days.sort((a, b) => a - b);
  };

  const isAdmin = currentUser?.role === 'Administrador';

  // --- Filtered Commissions ---
  const filteredComissoesPedidos = useMemo(() => {
    return pedidos.filter(p => {
      if (p.status === 'Cancelado') return false;
      
      const cli = clientes.find(c => c.id === p.clienteId);
      const rep = representadas.find(r => r.id === p.representadaId);
      
      // Search matches order number, client name, or represented brand
      const matchesSearch = 
        p.numeroPedido.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cli?.nomeFantasia || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rep?.nomeFantasia || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = 
        comissaoStatusFilter === 'Todos' || 
        (comissaoStatusFilter === 'Pendente' && (!p.statusComissao || p.statusComissao === 'Pendente')) ||
        p.statusComissao === comissaoStatusFilter;

      const matchesRepresentada = 
        representadaFilter === 'Todos' || 
        p.representadaId === representadaFilter;

      return matchesSearch && matchesStatus && matchesRepresentada;
    });
  }, [pedidos, clientes, representadas, searchQuery, comissaoStatusFilter, representadaFilter]);

  // --- Generated Provisioned Installments ---
  const allProvisionedInstallments = useMemo(() => {
    const list: ProvisionedInstallment[] = [];
    
    pedidos.forEach(p => {
      // Ignore canceled orders or orders where commission was excluded
      if (p.status === 'Cancelado' || p.statusComissao === 'Excluida') return;

      const cli = clientes.find(c => c.id === p.clienteId);
      const rep = representadas.find(r => r.id === p.representadaId);
      const days = parseInstallments(p.condicoesPagamento);
      const partsCount = days.length;

      days.forEach((day, index) => {
        const dueDate = addDays(p.dataPedido, day);
        const valTotalPart = p.valorTotal / partsCount;
        const valComissaoPart = p.valorComissao / partsCount;
        const valDespesaPart = (valComissaoPart * repassePercentual) / 100;

        list.push({
          id: `${p.id}-inst-${index}`,
          numeroPedido: p.numeroPedido,
          clienteNome: cli?.nomeFantasia || 'N/A',
          representadaNome: rep?.nomeFantasia || 'N/A',
          parcelaIndex: index + 1,
          parcelaTotal: partsCount,
          dataVencimento: dueDate,
          valorTotal: valTotalPart,
          valorComissao: valComissaoPart,
          valorDespesa: valDespesaPart
        });
      });
    });

    // Sort by due date ascending
    return list.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
  }, [pedidos, clientes, representadas, repassePercentual]);

  // --- Filtered Provisioned Installments ---
  const filteredProvisionedInstallments = useMemo(() => {
    return allProvisionedInstallments.filter(inst => {
      const matchesRepresentada = 
        provisaoRepresentadaFilter === 'Todos' || 
        pedidos.find(p => p.numeroPedido === inst.numeroPedido)?.representadaId === provisaoRepresentadaFilter;

      const instAnoMes = inst.dataVencimento.slice(0, 7); // "YYYY-MM"
      const matchesMonth = 
        provisaoMonthFilter === 'Todos' || 
        instAnoMes === provisaoMonthFilter;

      return matchesRepresentada && matchesMonth;
    });
  }, [allProvisionedInstallments, provisaoRepresentadaFilter, provisaoMonthFilter, pedidos]);

  // Months available for provisioning filter
  const availableProvisaoMonths = useMemo(() => {
    const months = new Set<string>();
    allProvisionedInstallments.forEach(inst => {
      months.add(inst.dataVencimento.slice(0, 7));
    });
    return Array.from(months).sort();
  }, [allProvisionedInstallments]);

  // Sum calculations for current filtered provisionings
  const provisaoSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalExpense = 0;
    filteredProvisionedInstallments.forEach(inst => {
      totalRevenue += inst.valorComissao;
      totalExpense += inst.valorDespesa;
    });
    return { totalRevenue, totalExpense, totalNet: totalRevenue - totalExpense };
  }, [filteredProvisionedInstallments]);

  // --- Project Monthly Provisões Timeline ---
  const monthlyProvisaoTimeline = useMemo(() => {
    const monthsNomes = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    
    // Group provisioned installments by month
    const grouped: { [key: string]: { receita: number; despesa: number } } = {};
    
    allProvisionedInstallments.forEach(inst => {
      const matchRep = provisaoRepresentadaFilter === 'Todos' || 
        pedidos.find(p => p.numeroPedido === inst.numeroPedido)?.representadaId === provisaoRepresentadaFilter;
        
      if (!matchRep) return;
      
      const ym = inst.dataVencimento.slice(0, 7); // "YYYY-MM"
      if (!grouped[ym]) {
        grouped[ym] = { receita: 0, despesa: 0 };
      }
      grouped[ym].receita += inst.valorComissao;
      grouped[ym].despesa += inst.valorDespesa;
    });
    
    // Sort keys
    const sortedKeys = Object.keys(grouped).sort();
    
    // If empty, generate at least 6 months starting from today
    if (sortedKeys.length === 0) {
      const today = new Date();
      for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        grouped[ym] = { receita: 0, despesa: 0 };
        sortedKeys.push(ym);
      }
      sortedKeys.sort();
    }
    
    return sortedKeys.map(ym => {
      const [year, month] = ym.split('-');
      const mIdx = parseInt(month, 10) - 1;
      const label = `${monthsNomes[mIdx]}/${year.substring(2)}`;
      const rec = grouped[ym].receita;
      const des = grouped[ym].despesa;
      return {
        key: ym,
        name: label,
        "Receita (Comissão)": rec,
        "Despesa (Repasse)": des,
        "Fluxo Líquido": rec - des
      };
    });
  }, [allProvisionedInstallments, provisaoRepresentadaFilter, pedidos]);

  // Save the Commission Edit
  const handleSaveCommissionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPedido) return;
    try {
      const updatedPedido: Pedido = {
        ...editingPedido,
        comissaoPercentual: editComissaoPercent,
        valorComissao: editComissaoValor,
        statusComissao: editComissaoStatus
      };
      await onEditPedido(updatedPedido);
      setEditingPedido(null);
    } catch (err) {
      console.error('Erro ao salvar alteração de comissão:', err);
    }
  };

  // Mark status directly
  const handleQuickStatusUpdate = async (pedido: Pedido, status: 'Pendente' | 'Liberada' | 'Paga' | 'Excluida') => {
    if (!isAdmin) return;
    try {
      const updated: Pedido = {
        ...pedido,
        statusComissao: status
      };
      await onEditPedido(updated);
    } catch (err) {
      console.error('Erro ao atualizar status da comissão:', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveSubTab('comissoes'); setIsFiltersExpanded(false); }}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'comissoes'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Controle de Comissões</span>
        </button>
        <button
          onClick={() => { setActiveSubTab('provisionamento'); setIsFiltersExpanded(false); }}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'provisionamento'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Provisionamento Financeiro</span>
        </button>
      </div>

      {activeSubTab === 'comissoes' ? (
        <div className="space-y-4">
          
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="font-serif font-extrabold text-lg text-slate-900">Gestão e Reconciliação de Comissões</h2>
              <p className="text-xs text-slate-500">Controle de recebíveis de comissão para pedidos faturados de fábricas representadas.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <button
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className={`bg-white border text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  isFiltersExpanded ? 'border-emerald-500 text-emerald-700 bg-emerald-50/20' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filtros</span>
                {isFiltersExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-2xs">
                <select
                  value={selectedReportMonth}
                  onChange={(e) => setSelectedReportMonth(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none px-2 cursor-pointer font-mono"
                  title="Selecionar mês para o relatório de desempenho"
                >
                  {availableMonthsForReport.map(m => (
                    <option key={m} value={m} className="bg-white text-slate-850">
                      {m.split('-')[1]}/{m.split('-')[0]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => gerarResumoMensalPDF(pedidos, clientes, representadas, selectedReportMonth, empresaRepresentacao)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  title="Exportar Relatório de Desempenho Mensal"
                >
                  <Download className="w-3 h-3" />
                  <span>Desempenho Mensal</span>
                </button>
              </div>

              <button
                onClick={() => gerarComissoesPDF(filteredComissoesPedidos, clientes, representadas, empresaRepresentacao)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ml-auto sm:ml-0"
                title="Exportar Espelho de Comissões"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Espelho Comissões</span>
              </button>
            </div>
          </div>

          {/* Minimizable Filters Container */}
          <AnimatePresence>
            {isFiltersExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-xs">
                  
                  {/* Busca */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pesquisar por Cód/Cliente/Fábrica</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: #1020, Lojista..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* Status da Comissão */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Status de Comissão</label>
                    <select
                      value={comissaoStatusFilter}
                      onChange={(e) => setComissaoStatusFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    >
                      <option value="Todos">Todos os Status</option>
                      <option value="Pendente">Pendentes</option>
                      <option value="Liberada">Liberadas (Prontas para Pagar)</option>
                      <option value="Paga">Pagas</option>
                      <option value="Excluida">Excluídas</option>
                    </select>
                  </div>

                  {/* Representada */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Fábrica Representada</label>
                    <select
                      value={representadaFilter}
                      onChange={(e) => setRepresentadaFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    >
                      <option value="Todos">Todas as Fábricas</option>
                      {representadas.map(rep => (
                        <option key={rep.id} value={rep.id}>{rep.nomeFantasia}</option>
                      ))}
                    </select>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Summary Widgets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between shadow-xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Total Filtrado</span>
              <strong className="text-slate-800 text-sm font-extrabold leading-none">
                {formatarMoeda(filteredComissoesPedidos.reduce((sum, p) => sum + (p.statusComissao !== 'Excluida' ? p.valorComissao : 0), 0))}
              </strong>
              <span className="text-[9px] text-slate-400 mt-1">{filteredComissoesPedidos.length} comissões listadas</span>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between shadow-xs border-l-4 border-l-emerald-500">
              <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-600 block mb-1">Pagas</span>
              <strong className="text-emerald-700 text-sm font-extrabold leading-none">
                {formatarMoeda(filteredComissoesPedidos.filter(p => p.statusComissao === 'Paga').reduce((sum, p) => sum + p.valorComissao, 0))}
              </strong>
              <span className="text-[9px] text-slate-400 mt-1">Concluídas e recebidas</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between shadow-xs border-l-4 border-l-blue-500">
              <span className="text-[9px] uppercase font-bold tracking-wider text-blue-600 block mb-1">Liberadas</span>
              <strong className="text-blue-700 text-sm font-extrabold leading-none">
                {formatarMoeda(filteredComissoesPedidos.filter(p => p.statusComissao === 'Liberada').reduce((sum, p) => sum + p.valorComissao, 0))}
              </strong>
              <span className="text-[9px] text-slate-400 mt-1">Prontas para faturamento</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between shadow-xs border-l-4 border-l-amber-500">
              <span className="text-[9px] uppercase font-bold tracking-wider text-amber-600 block mb-1">Pendentes</span>
              <strong className="text-amber-700 text-sm font-extrabold leading-none">
                {formatarMoeda(filteredComissoesPedidos.filter(p => !p.statusComissao || p.statusComissao === 'Pendente').reduce((sum, p) => sum + p.valorComissao, 0))}
              </strong>
              <span className="text-[9px] text-slate-400 mt-1">Aguardando faturamento/período</span>
            </div>
          </div>

          {/* Commissions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[9px] uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-4">Cód. Pedido</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4">Cliente / Fábrica</th>
                    <th className="py-3 px-4 text-right">Valor Venda</th>
                    <th className="py-3 px-4 text-center">%</th>
                    <th className="py-3 px-4 text-right">Comissão</th>
                    <th className="py-3 px-4 text-center">Status Com.</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredComissoesPedidos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                        Nenhuma comissão encontrada para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredComissoesPedidos.map(p => {
                      const cli = clientes.find(c => c.id === p.clienteId);
                      const rep = representadas.find(r => r.id === p.representadaId);
                      const statusCom = p.statusComissao || 'Pendente';

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            #{p.numeroPedido}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {formatarData(p.dataPedido)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{cli?.nomeFantasia || 'N/A'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-bold">🏭 {rep?.nomeFantasia || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                            {formatarMoeda(p.valorTotal)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                            {p.comissaoPercentual}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                            {formatarMoeda(p.valorComissao)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${
                              statusCom === 'Paga' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : statusCom === 'Liberada'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : statusCom === 'Excluida'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {statusCom.toUpperCase()}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {statusCom !== 'Paga' && (
                                  <button
                                    onClick={() => handleQuickStatusUpdate(p, 'Paga')}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                                    title="Marcar como Paga"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingPedido(p);
                                    setEditComissaoPercent(p.comissaoPercentual);
                                    setEditComissaoValor(p.valorComissao);
                                    setEditComissaoStatus(statusCom);
                                  }}
                                  className="p-1 text-slate-500 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                  title="Editar Comissão"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`Tem certeza que deseja excluir as comissões do Pedido #${p.numeroPedido}?`)) {
                                      await handleQuickStatusUpdate(p, 'Excluida');
                                    }
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Excluir da Listagem"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="font-serif font-extrabold text-lg text-slate-900">Provisionamento Financeiro e Fluxo de Provisões</h2>
              <p className="text-xs text-slate-500">Estimativa cronológica de recebíveis (receitas) e repasses operacionais (despesas) com base nas condições de pagamento de cada pedido.</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className={`bg-white border text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  isFiltersExpanded ? 'border-emerald-500 text-emerald-700 bg-emerald-50/20' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filtros</span>
                {isFiltersExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                onClick={() => gerarProvisionamentoPDF(filteredProvisionedInstallments, provisaoMonthFilter, provisaoSummary.totalRevenue, provisaoSummary.totalExpense, empresaRepresentacao)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ml-auto sm:ml-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Provisões (PDF)</span>
              </button>
            </div>
          </div>

          {/* Minimizable Filters Container for Provisão */}
          <AnimatePresence>
            {isFiltersExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-xs">
                  
                  {/* Mês de Referência */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Mês de Vencimento</label>
                    <select
                      value={provisaoMonthFilter}
                      onChange={(e) => setProvisaoMonthFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    >
                      <option value="Todos">Todos os Meses</option>
                      {availableProvisaoMonths.map(m => (
                        <option key={m} value={m}>{m.split('-')[1]}/{m.split('-')[0]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fábrica Representada */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Fábrica Fabricante</label>
                    <select
                      value={provisaoRepresentadaFilter}
                      onChange={(e) => setProvisaoRepresentadaFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    >
                      <option value="Todos">Todas as Fábricas</option>
                      {representadas.map(rep => (
                        <option key={rep.id} value={rep.id}>{rep.nomeFantasia}</option>
                      ))}
                    </select>
                  </div>

                  {/* Slider de Despesas de Vendedor (Repasse) */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Repasse de Despesas (Rep / Vendedor)</label>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-mono">{repassePercentual}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={repassePercentual}
                      onChange={(e) => setRepassePercentual(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <span className="text-[9px] text-slate-400 mt-0.5 block">Define a despesa estimada de repasses aos agentes/vendedores sobre as comissões.</span>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Receitas de Comissão Provisionadas (+)</span>
                <strong className="text-emerald-700 text-lg font-extrabold block mt-0.5">{formatarMoeda(provisaoSummary.totalRevenue)}</strong>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Lançamentos de comissões calculadas</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
              <div className="p-3.5 bg-red-50 text-red-600 rounded-xl">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Despesas de Repasse Provisionadas (-)</span>
                <strong className="text-red-700 text-lg font-extrabold block mt-0.5">{formatarMoeda(provisaoSummary.totalExpense)}</strong>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Estimativa de {repassePercentual}% sobre recebimento</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
              <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fluxo de Caixa Líquido de Comissão (=)</span>
                <strong className={`text-lg font-extrabold block mt-0.5 ${provisaoSummary.totalNet >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                  {formatarMoeda(provisaoSummary.totalNet)}
                </strong>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Margem líquida provisionada de comissão</p>
              </div>
            </div>

          </div>

          {/* Gráficos de Provisionamento */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Gráfico de Evolução (AreaChart) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-serif font-bold text-sm text-slate-800">Evolução do Fluxo de Caixa Provisionado</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Projeção cronológica mensal de comissões e repasses</p>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                  {monthlyProvisaoTimeline.length}M
                </span>
              </div>
              
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyProvisaoTimeline}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [formatarMoeda(Number(value)), name]}
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        borderColor: '#e2e8f0', 
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={28} 
                      iconSize={8} 
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="Receita (Comissão)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceita)" />
                    <Area type="monotone" dataKey="Despesa (Repasse)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesa)" />
                    <Area type="monotone" dataKey="Fluxo Líquido" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLiquido)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico Comparativo Mensal (BarChart) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-serif font-bold text-sm text-slate-800">Proporção Receita vs Despesa</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estrutura de custos operacionais e repasses</p>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyProvisaoTimeline}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [formatarMoeda(Number(value)), name]}
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        borderColor: '#e2e8f0', 
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={28} 
                      iconSize={8} 
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="Receita (Comissão)" fill="#10b981" radius={[3, 3, 0, 0]} name="Receita" barSize={12} />
                    <Bar dataKey="Despesa (Repasse)" fill="#ef4444" radius={[3, 3, 0, 0]} name="Repasse" barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Installments Breakdown List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-serif font-bold text-sm text-slate-800">Cronograma de Vencimentos Detalhado ({filteredProvisionedInstallments.length})</h4>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">Dividido pelas parcelas e datas calculadas</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[9px] uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-4">Previsão Vcto.</th>
                    <th className="py-3 px-4">Pedido Original</th>
                    <th className="py-3 px-4">Cliente Carteira</th>
                    <th className="py-3 px-4">Fábrica Representada</th>
                    <th className="py-3 px-4 text-center">Parcela</th>
                    <th className="py-3 px-4 text-right">Comissão Receita (+)</th>
                    <th className="py-3 px-4 text-right">Repasse Despesa (-)</th>
                    <th className="py-3 px-4 text-right">Líquido Estimado (=)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredProvisionedInstallments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                        Nenhum provisionamento financeiro gerado para os critérios atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredProvisionedInstallments.map(inst => {
                      const liq = inst.valorComissao - inst.valorDespesa;
                      return (
                        <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            {formatarData(inst.dataVencimento)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            #{inst.numeroPedido}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {inst.clienteNome}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-bold">
                            {inst.representadaNome}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {inst.parcelaIndex} de {inst.parcelaTotal}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            {formatarMoeda(inst.valorComissao)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                            {formatarMoeda(inst.valorDespesa)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-blue-700">
                            {formatarMoeda(liq)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Commission Edit Modal */}
      <AnimatePresence>
        {editingPedido && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
                <div>
                  <h3 className="font-serif font-extrabold text-slate-900 text-base">Reconciliação - Pedido #{editingPedido.numeroPedido}</h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">Empresa: {empresaRepresentacao?.nomeFantasia}</p>
                </div>
                <button
                  onClick={() => setEditingPedido(null)}
                  className="p-1 text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCommissionEdit} className="space-y-4">
                
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Status da Comissão</label>
                  <select
                    value={editComissaoStatus}
                    onChange={(e) => setEditComissaoStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                  >
                    <option value="Pendente">PENDENTE</option>
                    <option value="Liberada">LIBERADA</option>
                    <option value="Paga">PAGA</option>
                    <option value="Excluida">EXCLUÍDA</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Comissão (%)</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.01"
                        value={editComissaoPercent}
                        onChange={(e) => {
                          const pct = parseFloat(e.target.value) || 0;
                          setEditComissaoPercent(pct);
                          setEditComissaoValor(editingPedido.valorTotal * (pct / 100));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                      />
                      <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Valor Final (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editComissaoValor}
                      onChange={(e) => setEditComissaoValor(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-500 leading-normal">
                    Valor total de venda do pedido: <strong>{formatarMoeda(editingPedido.valorTotal)}</strong>. 
                    Mudar a comissão atualizará os relatórios gerenciais e provisões em tempo real.
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingPedido(null)}
                    className="border border-slate-200 text-slate-500 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-sm shadow-emerald-200"
                  >
                    Salvar Reconciliação
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
