import React, { useState } from 'react';
import { Cliente, Representada, Pedido, MetaVendas } from '../types';
import { formatarMoeda } from '../utils';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Briefcase, 
  CheckCircle, 
  Clock, 
  Award, 
  FileText,
  Percent,
  Calendar,
  X,
  ArrowRight,
  TrendingDown,
  AlertCircle,
  Printer,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gerarDashboardPDF } from '../lib/pdfGenerator';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell,
  Legend
} from 'recharts';

interface DashboardTabProps {
  pedidos: Pedido[];
  clientes: Cliente[];
  representadas: Representada[];
  meta: MetaVendas;
  setMeta: (meta: MetaVendas) => void;
  onNavigateToTab: (tab: 'dashboard' | 'representadas' | 'clientes' | 'pedidos' | 'produtos' | 'admin') => void;
  onEditPedido: (pedido: Pedido) => void;
  empresaRepresentacao?: any;
  currentUser?: any;
}

export default function DashboardTab({
  pedidos,
  clientes,
  representadas,
  meta,
  setMeta,
  onNavigateToTab,
  onEditPedido,
  empresaRepresentacao,
  currentUser,
}: DashboardTabProps) {
  const [editingMeta, setEditingMeta] = useState(false);
  const [tempMetaValor, setTempMetaValor] = useState(meta.metaMensal.toString());
  const [activeModal, setActiveModal] = useState<'vendas' | 'comissoes_totais' | 'comissoes_recebidas' | 'clientes' | null>(null);

  // Filtros do Dashboard
  const [filterRepresentada, setFilterRepresentada] = useState('Todos');
  const [filterCliente, setFilterCliente] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterDataDe, setFilterDataDe] = useState('');
  const [filterDataAte, setFilterDataAte] = useState('');

  // Pedidos Filtrados Dinamicamente
  const pedidosFiltrados = pedidos.filter(p => {
    if (filterRepresentada !== 'Todos' && p.representadaId !== filterRepresentada) return false;
    if (filterCliente !== 'Todos' && p.clienteId !== filterCliente) return false;
    if (filterStatus !== 'Todos' && p.status !== filterStatus) return false;
    if (filterDataDe && p.dataPedido < filterDataDe) return false;
    if (filterDataAte && p.dataPedido > filterDataAte) return false;
    return true;
  });

  // Filtro de pedidos válidos para faturamento (Exclui cancelados a menos que o status Cancelado esteja filtrado)
  const pedidosValidos = pedidosFiltrados.filter(p => p.status !== 'Cancelado' || filterStatus === 'Cancelado');

  const faturamentoTotal = pedidosValidos.reduce((acc, p) => acc + p.valorTotal, 0);
  const comissaoTotal = pedidosValidos.reduce((acc, p) => acc + p.valorComissao, 0);
  
  // Commissions received (Status 'Pago')
  const comissaoRecebida = pedidosFiltrados
    .filter(p => p.status === 'Pago')
    .reduce((acc, p) => acc + p.valorComissao, 0);

  // Commissions pending (Status 'Faturado' or 'Pendente')
  const comissaoPendente = pedidosFiltrados
    .filter(p => p.status === 'Faturado' || p.status === 'Pendente')
    .reduce((acc, p) => acc + p.valorComissao, 0);

  // Active clients count in orders
  const clientesAtivosIds = new Set(pedidosValidos.map(p => p.clienteId));
  const totalClientesAtivos = clientesAtivosIds.size;

  // Meta percent progress
  const percentualMeta = Math.min(
    Math.round((faturamentoTotal / meta.metaMensal) * 100) || 0,
    100
  );

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(tempMetaValor);
    if (!isNaN(valor) && valor > 0) {
      setMeta({ ...meta, metaMensal: valor });
      setEditingMeta(false);
    }
  };

  // Group faturamento by represented brand for chart (recalculated based on active filters!)
  const faturamentoPorRepresentada = representadas.map(rep => {
    const totalVendas = pedidosFiltrados
      .filter(p => p.representadaId === rep.id && (p.status !== 'Cancelado' || filterStatus === 'Cancelado'))
      .reduce((acc, p) => acc + p.valorTotal, 0);
    const totalComissao = pedidosFiltrados
      .filter(p => p.representadaId === rep.id && (p.status !== 'Cancelado' || filterStatus === 'Cancelado'))
      .reduce((acc, p) => acc + p.valorComissao, 0);
    
    return {
      id: rep.id,
      nome: rep.nomeFantasia,
      vendas: totalVendas,
      comissao: totalComissao
    };
  });

  const maxVendas = Math.max(...faturamentoPorRepresentada.map(item => item.vendas), 10000);

  // Generate the last 6 months chronologically up to the current date / latest order date to show comparison
  const monthlyPerformanceData = React.useMemo(() => {
    const monthsNomes = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    
    // Reference date (current month/year)
    let refDate = new Date();
    if (pedidos.length > 0) {
      const dates = pedidos.map(p => new Date(p.dataPedido)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        refDate = new Date(Math.max(...dates.map(d => d.getTime())));
      }
    }
    
    const dataList = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
      
      const totalMonthVendas = pedidos
        .filter(p => p.status !== 'Cancelado' && p.dataPedido.startsWith(monthStr))
        .reduce((sum, p) => sum + p.valorTotal, 0);
        
      dataList.push({
        name: `${monthsNomes[d.getMonth()]}/${String(year).substring(2)}`,
        "Vendas": totalMonthVendas,
        "Meta": meta.metaMensal
      });
    }
    return dataList;
  }, [pedidos, meta.metaMensal]);

  return (
    <div className="space-y-6">
      {/* Filtros Executivos */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
            <h2 className="font-serif font-bold text-base text-slate-800">Filtros do Painel Geral</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Clear filters button if any is active */}
            {(filterRepresentada !== 'Todos' || filterCliente !== 'Todos' || filterStatus !== 'Todos' || filterDataDe || filterDataAte) && (
              <button
                onClick={() => {
                  setFilterRepresentada('Todos');
                  setFilterCliente('Todos');
                  setFilterStatus('Todos');
                  setFilterDataDe('');
                  setFilterDataAte('');
                }}
                className="text-xs text-red-600 hover:text-red-700 hover:underline px-2.5 py-1 rounded-lg cursor-pointer font-bold"
              >
                Limpar Filtros
              </button>
            )}
            {/* Print Dashboard PDF Button */}
            <button
              onClick={() => {
                gerarDashboardPDF(pedidos, clientes, representadas, {
                  representadaId: filterRepresentada,
                  clienteId: filterCliente,
                  status: filterStatus,
                  dataDe: filterDataDe,
                  dataAte: filterDataAte
                }, empresaRepresentacao);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-100"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Relatório (PDF)</span>
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-xs text-slate-500">
          {/* Representada */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider">Representada / Fábrica</label>
            <select
              value={filterRepresentada}
              onChange={(e) => setFilterRepresentada(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="Todos">Todas as Fábricas</option>
              {representadas.map(r => (
                <option key={r.id} value={r.id}>{r.nomeFantasia}</option>
              ))}
            </select>
          </div>

          {/* Cliente */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider">Cliente (Comprador)</label>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="Todos">Todos os Clientes</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nomeFantasia}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider">Status do Pedido</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-emerald-600 cursor-pointer font-bold"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Rascunho">Rascunho</option>
              <option value="Pendente">Pendente</option>
              <option value="Faturado">Faturado</option>
              <option value="Pago">Comissão Recebida</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          {/* Data De */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider">Período (De)</label>
            <input
              type="date"
              value={filterDataDe}
              onChange={(e) => setFilterDataDe(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-emerald-600 font-mono"
            />
          </div>

          {/* Data Ate */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider">Período (Até)</label>
            <input
              type="date"
              value={filterDataAte}
              onChange={(e) => setFilterDataAte(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-emerald-600 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Resumo de Metas */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Lado Esquerdo: Progresso e Controles */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <h2 className="font-serif font-bold text-xl text-slate-800">Acompanhamento de Metas</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Faturamento focado na meta estipulada para o período de {meta.anoMes.split('-')[1]}/{meta.anoMes.split('-')[0]}.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {editingMeta ? (
                    <form onSubmit={handleSaveMeta} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                      <span className="text-xs font-mono text-slate-500 pl-1.5">R$</span>
                      <input 
                        type="number" 
                        className="w-28 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-600"
                        value={tempMetaValor}
                        onChange={(e) => setTempMetaValor(e.target.value)}
                        min="1"
                        step="any"
                        autoFocus
                      />
                      <button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700 px-2.5 py-1 rounded text-xs cursor-pointer">
                        Salvar
                      </button>
                      <button type="button" onClick={() => setEditingMeta(false)} className="text-slate-400 hover:text-slate-600 text-xs px-1.5">
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Meta Mensal</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 text-sm">{formatarMoeda(meta.metaMensal)}</span>
                        {currentUser?.role === 'Administrador' && (
                          <button 
                            onClick={() => {
                              setTempMetaValor(meta.metaMensal.toString());
                              setEditingMeta(true);
                            }} 
                            className="text-xs text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer font-bold"
                          >
                            Ajustar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="space-y-2 mt-4">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-500 font-bold">Progresso Atual: <strong className="text-emerald-700">{percentualMeta}%</strong></span>
                  <span className="text-slate-500 font-bold">{formatarMoeda(faturamentoTotal)} de {formatarMoeda(meta.metaMensal)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200/50">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentualMeta}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      percentualMeta >= 100 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                        : percentualMeta >= 60 
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' 
                        : 'bg-gradient-to-r from-amber-500 to-emerald-600'
                    }`}
                  />
                </div>
                {percentualMeta >= 100 ? (
                  <p className="text-[11px] text-emerald-700 font-serif italic mt-1 font-bold">
                    ✨ Parabéns! Você superou a meta de vendas comercial estabelecida para o período!
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 font-serif italic mt-1">
                    Faltam <strong>{formatarMoeda(Math.max(meta.metaMensal - faturamentoTotal, 0))}</strong> para atingir a meta comercial.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Lado Direito: Gráfico de Barras Recharts comparando Vendas Mensais x Meta Estabelecida */}
          <div className="lg:col-span-6 bg-slate-50/50 rounded-xl border border-slate-150 p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Desempenho Comercial Mensal vs. Meta</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                faturamentoTotal >= meta.metaMensal ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {faturamentoTotal >= meta.metaMensal ? 'META ALCANÇADA' : 'EM ANDAMENTO'}
              </span>
            </div>

            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={monthlyPerformanceData} 
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    formatter={(value: any, name: string) => [formatarMoeda(Number(value)), name]}
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderColor: '#e2e8f0', 
                      borderRadius: '8px', 
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#1e293b',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={24} 
                    iconSize={10} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} name="Vendas Realizadas" />
                  <Bar dataKey="Meta" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Meta Estabelecida" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* Grid de Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento */}
        <button 
          onClick={() => setActiveModal('vendas')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 text-left cursor-pointer hover:shadow-md hover:border-emerald-400 hover:bg-slate-50/50 transition-all active:scale-[0.98] w-full focus:outline-none"
        >
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">Vendas Emitidas</span>
            <span className="text-lg font-mono font-bold text-slate-800 block truncate">{formatarMoeda(faturamentoTotal)}</span>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">🔍 Detalhes ({pedidosValidos.length} pedidos)</span>
          </div>
        </button>

        {/* Card 2: Comissão Estimada */}
        <button 
          onClick={() => setActiveModal('comissoes_totais')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 text-left cursor-pointer hover:shadow-md hover:border-blue-400 hover:bg-slate-50/50 transition-all active:scale-[0.98] w-full focus:outline-none"
        >
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">Comissões Totais</span>
            <span className="text-lg font-mono font-bold text-slate-800 block truncate">{formatarMoeda(comissaoTotal)}</span>
            <span className="text-[10px] text-blue-600 font-bold block mt-0.5">🔍 Margem Média: {(comissaoTotal / (faturamentoTotal || 1) * 100).toFixed(1)}%</span>
          </div>
        </button>

        {/* Card 3: Comissão Recebida */}
        <button 
          onClick={() => setActiveModal('comissoes_recebidas')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 text-left cursor-pointer hover:shadow-md hover:border-teal-400 hover:bg-slate-50/50 transition-all active:scale-[0.98] w-full focus:outline-none"
        >
          <div className="p-3 bg-teal-50 text-teal-700 rounded-lg shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">Comissões Recebidas</span>
            <span className="text-lg font-mono font-bold text-emerald-700 block truncate">{formatarMoeda(comissaoRecebida)}</span>
            <span className="text-[10px] text-teal-600 font-bold block mt-0.5">🔍 {formatarMoeda(comissaoPendente)} a receber</span>
          </div>
        </button>

        {/* Card 4: Clientes Ativos */}
        <button 
          onClick={() => setActiveModal('clientes')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 text-left cursor-pointer hover:shadow-md hover:border-indigo-400 hover:bg-slate-50/50 transition-all active:scale-[0.98] w-full focus:outline-none"
        >
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">Clientes Compradores</span>
            <span className="text-lg font-mono font-bold text-slate-800 block truncate">{totalClientesAtivos} / {clientes.length}</span>
            <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">🔍 Aproveitamento da carteira</span>
          </div>
        </button>
      </div>

      {/* Seção Gráficos e Pedidos Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Gráficos de Faturamento das Representadas */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm lg:col-span-7 space-y-4">
          <div>
            <h3 className="font-serif font-bold text-base text-slate-800">Faturamento por Representada</h3>
            <p className="text-[11px] text-slate-400">Distribuição de vendas e comissões por empresa parceira.</p>
          </div>

          {/* Gráfico SVG customizado */}
          <div className="relative pt-4">
            {faturamentoPorRepresentada.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 italic">
                Nenhuma representada cadastrada para exibir no gráfico.
              </div>
            ) : (
              <div className="space-y-4">
                {faturamentoPorRepresentada.map((item, index) => {
                  const percentVal = (item.vendas / maxVendas) * 100;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">{item.nome}</span>
                        <div className="space-x-2 font-mono">
                          <span className="text-slate-600">Vendas: {formatarMoeda(item.vendas)}</span>
                          <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                            Comissão: {formatarMoeda(item.comissao)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="relative w-full bg-slate-100 h-6 rounded overflow-hidden flex items-center px-2">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentVal}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-600/85 to-emerald-500/90 rounded-r"
                        />
                        <span className="relative z-10 text-[10px] font-mono text-slate-700 font-bold">
                          {percentVal.toFixed(0)}% do volume máximo
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown de Status dos Pedidos */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-serif font-bold text-base text-slate-800">Status da Carteira de Pedidos</h3>
            <p className="text-[11px] text-slate-400">Totalizadores agrupados por status do fluxo de faturamento.</p>
          </div>

          <div className="space-y-3.5 my-auto">
            {['Pago', 'Faturado', 'Pendente', 'Rascunho', 'Cancelado'].map(status => {
              const filtrados = pedidosFiltrados.filter(p => p.status === status);
              const totalMoeda = filtrados.reduce((sum, p) => sum + p.valorTotal, 0);
              const numPedidos = filtrados.length;
              
              const colorBg = 
                status === 'Pago' ? 'bg-emerald-500' :
                status === 'Faturado' ? 'bg-blue-500' :
                status === 'Pendente' ? 'bg-amber-500' :
                status === 'Rascunho' ? 'bg-slate-400' : 'bg-red-400';

              const colorText = 
                status === 'Pago' ? 'text-emerald-700 bg-emerald-50' :
                status === 'Faturado' ? 'text-blue-700 bg-blue-50' :
                status === 'Pendente' ? 'text-amber-700 bg-amber-50' :
                status === 'Rascunho' ? 'text-slate-600 bg-slate-50' : 'text-red-700 bg-red-50';

              return (
                <div key={status} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${colorBg}`} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${colorText}`}>{status}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xs text-slate-700 block font-bold">{formatarMoeda(totalMoeda)}</span>
                    <span className="text-[9px] text-slate-400">{numPedidos} {numPedidos === 1 ? 'pedido' : 'pedidos'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabela de Pedidos Recentes */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="font-serif font-bold text-base text-slate-800">Últimas Transações e Emissões</h3>
            <p className="text-[11px] text-slate-400">Acompanhe os pedidos mais recentes criados na plataforma.</p>
          </div>
          <button 
            onClick={() => onNavigateToTab('pedidos')}
            className="text-xs text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer font-bold"
          >
            Ver Todas as Vendas <Clock className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {pedidosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 italic">
              Nenhum pedido atende aos filtros definidos.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[9px]">
                  <th className="py-2">Código</th>
                  <th className="py-2">Cliente</th>
                  <th className="py-2">Representada</th>
                  <th className="py-2">Data</th>
                  <th className="py-2 text-right">Valor Total</th>
                  <th className="py-2 text-right">Comissão</th>
                  <th className="py-2 text-center">Status</th>
                  <th className="py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidosFiltrados.slice(0, 5).map(p => {
                  const cli = clientes.find(c => c.id === p.clienteId);
                  const rep = representadas.find(r => r.id === p.representadaId);

                  const badgeColor = 
                    p.status === 'Pago' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                    p.status === 'Faturado' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                    p.status === 'Pendente' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                    p.status === 'Rascunho' ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-red-700 bg-red-50 border-red-200';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 font-mono font-bold text-slate-800">{p.numeroPedido}</td>
                      <td className="py-3 font-serif font-bold text-slate-700">
                        {cli ? cli.nomeFantasia : 'Cliente Não Identificado'}
                      </td>
                      <td className="py-3 text-slate-600">{rep ? rep.nomeFantasia : 'Não Encontrada'}</td>
                      <td className="py-3 text-slate-500 font-mono">{p.dataPedido.split('-').reverse().join('/')}</td>
                      <td className="py-3 text-right font-mono text-slate-700 font-bold">{formatarMoeda(p.valorTotal)}</td>
                      <td className="py-3 text-right font-mono text-emerald-700 font-bold">
                        {formatarMoeda(p.valorComissao)} <span className="text-[10px] text-slate-400">({p.comissaoPercentual}%)</span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badgeColor}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button 
                          onClick={() => onEditPedido(p)}
                          className="text-[11px] text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-500 px-2.5 py-1 rounded transition-colors cursor-pointer"
                        >
                          Visualizar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DETAILED STATISTICS POPUPS / MODALS */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  {activeModal === 'vendas' && (
                    <>
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Detalhamento de Vendas Emitidas</h3>
                    </>
                  )}
                  {activeModal === 'comissoes_totais' && (
                    <>
                      <Percent className="w-5 h-5 text-blue-600" />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Detalhamento de Comissões Totais</h3>
                    </>
                  )}
                  {activeModal === 'comissoes_recebidas' && (
                    <>
                      <DollarSign className="w-5 h-5 text-teal-600" />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Detalhamento de Recebimentos</h3>
                    </>
                  )}
                  {activeModal === 'clientes' && (
                    <>
                      <Users className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-serif font-bold text-lg text-slate-800">Detalhamento da Carteira de Clientes</h3>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
                
                {/* 1. Modal Vendas */}
                {activeModal === 'vendas' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Total Faturado</span>
                        <strong className="text-sm font-mono text-slate-800">{formatarMoeda(faturamentoTotal)}</strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Pedidos Ativos</span>
                        <strong className="text-sm font-mono text-slate-800">{pedidosValidos.length}</strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Ticket Médio</span>
                        <strong className="text-sm font-mono text-emerald-700">
                          {formatarMoeda(faturamentoTotal / (pedidosValidos.length || 1))}
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 text-xs block">Vendas por Representada / Fábrica</span>
                      <div className="border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-100">
                        {faturamentoPorRepresentada.map(item => (
                          <div key={item.id} className="flex justify-between p-2.5 items-center bg-slate-50/50">
                            <span className="font-bold text-slate-750">{item.nome}</span>
                            <span className="font-mono text-slate-600">Volume: {formatarMoeda(item.vendas)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 text-xs block">Histórico de Pedidos Ativos</span>
                      <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {pedidosValidos.map(p => {
                          const cli = clientes.find(c => c.id === p.clienteId);
                          return (
                            <div key={p.id} className="flex justify-between p-2.5 items-center hover:bg-slate-50">
                              <div>
                                <span className="font-mono font-bold text-slate-800">#{p.numeroPedido}</span>
                                <span className="text-slate-400 font-mono text-[10px] ml-1">({p.dataPedido.split('-').reverse().join('/')})</span>
                                <p className="font-serif text-slate-600 font-semibold">{cli?.nomeFantasia || 'Cliente Desconhecido'}</p>
                              </div>
                              <span className="font-mono font-bold text-slate-750">{formatarMoeda(p.valorTotal)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Modal Comissões Totais */}
                {activeModal === 'comissoes_totais' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Comissões Acumuladas</span>
                        <strong className="text-base font-mono text-emerald-700">{formatarMoeda(comissaoTotal)}</strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Margem Média Geral</span>
                        <strong className="text-base font-mono text-slate-850">
                          {(comissaoTotal / (faturamentoTotal || 1) * 100).toFixed(2)}%
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 text-xs block">Comissões Estimadas por Representada</span>
                      <div className="border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-100">
                        {faturamentoPorRepresentada.map(item => {
                          const rep = representadas.find(r => r.id === item.id);
                          return (
                            <div key={item.id} className="flex justify-between p-2.5 items-center bg-slate-50/50">
                              <div>
                                <span className="font-bold text-slate-750">{item.nome}</span>
                                <span className="text-[10px] text-slate-400 block">Alíquota padrão: {rep?.comissaoPadrao}%</span>
                              </div>
                              <span className="font-mono font-bold text-emerald-700">{formatarMoeda(item.comissao)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 text-xs block">Status do Fluxo de Comissão</span>
                      <div className="border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-100 bg-slate-50/20">
                        {['Pago', 'Faturado', 'Pendente', 'Rascunho'].map(st => {
                          const filtrados = pedidos.filter(p => p.status === st);
                          const totalCom = filtrados.reduce((sum, p) => sum + p.valorComissao, 0);
                          return (
                            <div key={st} className="flex justify-between p-2.5 items-center">
                              <span className="font-bold text-slate-600">{st}</span>
                              <span className="font-mono font-bold text-slate-700">{formatarMoeda(totalCom)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Modal Comissões Recebidas */}
                {activeModal === 'comissoes_recebidas' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-600 block font-bold">Comissões Recebidas (Pago)</span>
                        <strong className="text-base font-mono text-emerald-700">{formatarMoeda(comissaoRecebida)}</strong>
                      </div>
                      <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-amber-600 block font-bold">A Receber (Faturado/Pendente)</span>
                        <strong className="text-base font-mono text-amber-700">{formatarMoeda(comissaoPendente)}</strong>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 text-xs block">Relação de Comissões Pendentes (A Receber)</span>
                        <span className="text-[10px] text-amber-600 font-bold uppercase font-mono">Controle de Cobrança</span>
                      </div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-150">
                        {pedidos.filter(p => p.status === 'Faturado' || p.status === 'Pendente').length === 0 ? (
                          <div className="p-4 text-center text-slate-400 italic bg-slate-50/50">
                            Nenhuma comissão pendente no momento! Tudo liquidado.
                          </div>
                        ) : (
                          pedidos.filter(p => p.status === 'Faturado' || p.status === 'Pendente').map(p => {
                            const cli = clientes.find(c => c.id === p.clienteId);
                            const rep = representadas.find(r => r.id === p.representadaId);
                            return (
                              <div key={p.id} className="p-2.5 flex items-center justify-between bg-amber-50/10 hover:bg-amber-50/30">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-slate-800">Pedido #{p.numeroPedido}</span>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${p.status === 'Faturado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {p.status}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 block mt-0.5">Fábrica: {rep?.nomeFantasia} | Cliente: {cli?.nomeFantasia}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-emerald-700 block">{formatarMoeda(p.valorComissao)}</span>
                                  <span className="text-[9px] text-slate-400 block">Venda: {formatarMoeda(p.valorTotal)}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 text-xs block">Histórico de Comissões Já Pagas</span>
                      <div className="border border-slate-100 rounded-lg overflow-hidden max-h-40 overflow-y-auto divide-y divide-slate-100 bg-emerald-50/5">
                        {pedidos.filter(p => p.status === 'Pago').length === 0 ? (
                          <div className="p-4 text-center text-slate-400 italic">Nenhuma comissão paga registrada ainda.</div>
                        ) : (
                          pedidos.filter(p => p.status === 'Pago').map(p => {
                            const rep = representadas.find(r => r.id === p.representadaId);
                            return (
                              <div key={p.id} className="p-2 flex justify-between items-center">
                                <div>
                                  <span className="font-mono font-bold text-slate-705">Pedido #{p.numeroPedido}</span>
                                  <span className="text-[10px] text-slate-500 block">Fábrica: {rep?.nomeFantasia}</span>
                                </div>
                                <span className="font-mono font-bold text-emerald-700">{formatarMoeda(p.valorComissao)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Modal Clientes */}
                {activeModal === 'clientes' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Total de Clientes</span>
                        <strong className="text-base font-mono text-slate-800">{clientes.length} lojistas</strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Clientes Compradores</span>
                        <strong className="text-base font-mono text-indigo-700">
                          {totalClientesAtivos} ({Math.round((totalClientesAtivos / (clientes.length || 1)) * 100)}%)
                        </strong>
                      </div>
                    </div>

                    {/* Active Buyers */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 text-xs block">Clientes que Compraram no Período</span>
                      <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {clientes.filter(c => clientesAtivosIds.has(c.id)).length === 0 ? (
                          <div className="p-4 text-center text-slate-400 italic">Nenhum cliente ativo com pedidos no período.</div>
                        ) : (
                          clientes.filter(c => clientesAtivosIds.has(c.id)).map(c => {
                            const cliPedidos = pedidos.filter(p => p.clienteId === c.id && p.status !== 'Cancelado');
                            const totalC = cliPedidos.reduce((acc, p) => acc + p.valorTotal, 0);
                            return (
                              <div key={c.id} className="p-2.5 flex justify-between items-center bg-slate-50/30">
                                <div>
                                  <span className="font-serif font-bold text-slate-850">{c.nomeFantasia}</span>
                                  <span className="text-[10px] text-slate-400 block">{c.cidade} - {c.uf} | {cliPedidos.length} pedidos</span>
                                </div>
                                <span className="font-mono font-bold text-slate-700">{formatarMoeda(totalC)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Inactive Buyers to target */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-red-600 text-xs block">Alerta: Clientes sem Compras Recentes</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">Prospectar/Contatar</span>
                      </div>
                      <div className="border border-red-100 rounded-lg overflow-hidden max-h-40 overflow-y-auto divide-y divide-red-100 bg-red-50/5">
                        {clientes.filter(c => !clientesAtivosIds.has(c.id)).length === 0 ? (
                          <div className="p-4 text-center text-emerald-600 bg-emerald-50/10 font-bold italic">Excelente! 100% dos clientes compraram no período.</div>
                        ) : (
                          clientes.filter(c => !clientesAtivosIds.has(c.id)).map(c => (
                            <div key={c.id} className="p-2 flex justify-between items-center hover:bg-red-50/20">
                              <div>
                                <span className="font-serif font-bold text-slate-700">{c.nomeFantasia}</span>
                                <span className="text-[10px] text-slate-500 block">Contato: {c.contato} | Tel: {c.telefone}</span>
                              </div>
                              <span className="text-[10px] bg-red-50 border border-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold font-mono">Sem pedido</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                <button
                  onClick={() => setActiveModal(null)}
                  className="bg-slate-850 hover:bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
