import React, { useState } from 'react';
import { Cliente, Pedido, Representada } from '../types';
import { formatarCNPJ, formatarMoeda, formatarTelefone, consultarCNPJ } from '../utils';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Landmark, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  X,
  TrendingUp,
  SlidersHorizontal,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClientesTabProps {
  clientes: Cliente[];
  pedidos: Pedido[];
  representadas: Representada[];
  onAdd: (cli: Cliente) => void;
  onEdit: (cli: Cliente) => void;
  onDelete: (id: string) => void;
}

export default function ClientesTab({
  clientes,
  pedidos,
  representadas,
  onAdd,
  onEdit,
  onDelete,
}: ClientesTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [selectedClientHistory, setSelectedClientHistory] = useState<Cliente | null>(null);

  const [form, setForm] = useState<Partial<Cliente>>({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    uf: '',
    telefone: '',
    email: '',
    contato: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({
      nomeFantasia: '',
      razaoSocial: '',
      cnpj: '',
      endereco: '',
      cidade: '',
      uf: '',
      telefone: '',
      email: '',
      contato: '',
    });
    setEditingId(null);
    setValidationError(null);
  };

  const handleEditClick = (cli: Cliente) => {
    setForm(cli);
    setEditingId(cli.id);
    setValidationError(null);
    setIsFormExpanded(true); // Auto-expand when editing
  };

  const handleCnpjLookup = async () => {
    const rawCnpj = (form.cnpj || '').replace(/\D/g, '');
    if (rawCnpj.length !== 14) {
      setValidationError('Insira um CNPJ com 14 dígitos numéricos para efetuar a busca automatizada.');
      return;
    }

    setIsSearchingCnpj(true);
    setValidationError(null);
    try {
      const data = await consultarCNPJ(rawCnpj);
      
      // Map retrieved values to Form
      setForm(prev => ({
        ...prev,
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || data.razao_social || '',
        telefone: [data.telefone1, data.telefone2].filter(Boolean).join(' / '),
        email: data.email || '',
        endereco: (data.logradouro ? `${data.logradouro}, ${data.numero || 'S/N'}${data.bairro ? ` - ${data.bairro}` : ''}` : '') || prev.endereco || '',
        cidade: data.municipio || '',
        uf: data.uf || '',
      }));

      // Set success message
      setValidationError('✓ CNPJ localizado com sucesso! Dados do cliente preenchidos automaticamente.');
      setTimeout(() => setValidationError(null), 5000);
    } catch (err: any) {
      console.error('Erro na consulta CNPJ:', err);
      setValidationError(err.message || 'Erro ao conectar no banco da Receita Federal. Tente preencher manualmente.');
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nomeFantasia?.trim() || !form.razaoSocial?.trim() || !form.cnpj?.trim()) {
      setValidationError('Por favor, preencha os campos obrigatórios (Nome Fantasia, Razão Social e CNPJ).');
      return;
    }

    const cleanedCnpj = form.cnpj.replace(/\D/g, '');
    if (cleanedCnpj.length !== 14) {
      setValidationError('O CNPJ deve conter exatamente 14 dígitos numéricos.');
      return;
    }

    if (form.uf && form.uf.trim().length !== 2) {
      setValidationError('A sigla do Estado (UF) deve ter exatamente 2 caracteres.');
      return;
    }

    const finalForm: Cliente = {
      id: editingId || `cli-${Date.now()}`,
      nomeFantasia: form.nomeFantasia.trim(),
      razaoSocial: form.razaoSocial.trim(),
      cnpj: formatarCNPJ(cleanedCnpj),
      endereco: form.endereco?.trim() || '',
      cidade: form.cidade?.trim() || '',
      uf: (form.uf?.trim() || '').toUpperCase(),
      telefone: form.telefone?.trim() || '',
      email: form.email?.trim() || '',
      contato: form.contato?.trim() || '',
    };

    if (editingId) {
      onEdit(finalForm);
    } else {
      onAdd(finalForm);
    }

    resetForm();
    setIsFormExpanded(false); // Collapsed on success
  };

  const handleDeleteClick = (id: string, name: string) => {
    const vinculados = pedidos.filter(p => p.clienteId === id);
    if (vinculados.length > 0) {
      alert(`Não é possível excluir o cliente "${name}" porque ele possui ${vinculados.length} pedido(s) associado(s). Remova ou altere os pedidos primeiro.`);
      return;
    }

    if (confirm(`Tem certeza que deseja remover o cliente "${name}" da carteira?`)) {
      onDelete(id);
    }
  };

  // Filter clients based on search query
  const clientesFiltrados = clientes.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.nomeFantasia.toLowerCase().includes(query) ||
      c.razaoSocial.toLowerCase().includes(query) ||
      c.cnpj.includes(query) ||
      c.cidade.toLowerCase().includes(query) ||
      c.uf.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Top action bar to trigger new client modal */}
      <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-slate-800">Carteira de Clientes</h3>
            <p className="text-[11px] text-slate-400">Gerencie os compradores parceiros e suas informações de faturamento.</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormExpanded(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </button>
      </div>

      <AnimatePresence>
        {isFormExpanded && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2 text-emerald-800">
                  <User className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-serif font-bold text-base text-slate-800">
                    {editingId ? 'Editar Dados do Cliente' : 'Adicionar Novo Cliente à Carteira'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsFormExpanded(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  <span className="font-bold text-lg">&times;</span>
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {validationError && (
                  <div className={`p-3 rounded-lg text-xs font-medium border ${
                    validationError.startsWith('✓') 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : 'bg-red-50 text-red-700 border-red-100'
                  }`}>
                    {validationError}
                  </div>
                )}

                <form onSubmit={handleSubmit} id="cli-form-elem" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* CNPJ com Busca */}
                    <div className="space-y-1 md:col-span-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">
                        CNPJ do Cliente <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="00.000.000/0000-00"
                          value={form.cnpj || ''}
                          onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-850 font-mono"
                        />
                        <button
                          type="button"
                          disabled={isSearchingCnpj}
                          onClick={handleCnpjLookup}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer disabled:bg-slate-300"
                          title="Buscar dados do CNPJ na Receita Federal"
                        >
                          {isSearchingCnpj ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Search className="w-3.5 h-3.5" />
                          )}
                          <span>Buscar</span>
                        </button>
                      </div>
                    </div>

                    {/* Nome Fantasia */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Nome Fantasia / Comercial <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        placeholder="Ex: Comercial Silva"
                        value={form.nomeFantasia || ''}
                        onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                      />
                    </div>

                    {/* Razão Social */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Razão Social / Nome de Registro <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        placeholder="Ex: Silva Supermercados Eireli"
                        value={form.razaoSocial || ''}
                        onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-805"
                      />
                    </div>

                    {/* Contato Responsável */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Contato (Comprador/Responsável)</label>
                      <input 
                        type="text"
                        placeholder="Ex: Roberto (Gerente Geral)"
                        value={form.contato || ''}
                        onChange={(e) => setForm({ ...form, contato: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Telefone */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Telefone para Contato</label>
                      <input 
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={form.telefone || ''}
                        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono"
                      />
                    </div>

                    {/* E-mail */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">E-mail para Faturamento</label>
                      <input 
                        type="email"
                        placeholder="compras@comercialsilva.com"
                        value={form.email || ''}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Endereço */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-mono uppercase text-slate-500">Endereço Completo (Rua, Número, Bairro)</label>
                      <input 
                        type="text"
                        placeholder="Ex: Av. das Palmeiras, 400 - Bairro Novo"
                        value={form.endereco || ''}
                        onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Cidade / UF */}
                    <div className="space-y-1 grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-xs font-mono uppercase text-slate-500">Cidade</label>
                        <input 
                          type="text"
                          placeholder="Ex: São Paulo"
                          value={form.cidade || ''}
                          onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase text-slate-500">UF</label>
                        <input 
                          type="text"
                          maxLength={2}
                          placeholder="SP"
                          value={form.uf || ''}
                          onChange={(e) => setForm({ ...form, uf: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold text-center uppercase"
                        />
                      </div>
                    </div>

                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => { resetForm(); setIsFormExpanded(false); }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    const formElem = document.getElementById('cli-form-elem') as HTMLFormElement;
                    if (formElem) formElem.requestSubmit();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {editingId ? 'Salvar Alterações' : 'Adicionar Cliente'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Busca e Lista de Clientes */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="font-serif font-bold text-base text-slate-700">Sua Carteira de Clientes ({clientesFiltrados.length})</h4>
          
          <div className="flex items-center gap-2">
            {/* Toggle de Filtros */}
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`bg-white border text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                isFiltersExpanded ? 'border-emerald-500 text-emerald-700 bg-emerald-50/20' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros e Busca</span>
              {isFiltersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Filtros Colapsáveis */}
        <AnimatePresence>
          {isFiltersExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                {/* Caixa de Busca */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pesquisar por Cliente, CNPJ ou UF</label>
                  <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar cliente, CNPJ ou UF..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {clientesFiltrados.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-xs text-slate-400 italic">
            Nenhum cliente correspondente encontrado. Adicione novos acima ou ajuste sua busca!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesFiltrados.map(cli => {
              // Calculate specific client metrics
              const clientPedidos = pedidos.filter(p => p.clienteId === cli.id && p.status !== 'Cancelado');
              const totalComprado = clientPedidos.reduce((sum, p) => sum + p.valorTotal, 0);
              const totalComissao = clientPedidos.reduce((sum, p) => sum + p.valorComissao, 0);

              const sortedOrders = [...clientPedidos].sort((a, b) => a.dataPedido.localeCompare(b.dataPedido));
              let mediaDiasEntreCompras = 0;
              if (sortedOrders.length >= 2) {
                let totalDiffDays = 0;
                for (let i = 1; i < sortedOrders.length; i++) {
                  const datePrev = new Date(sortedOrders[i - 1].dataPedido).getTime();
                  const dateCurr = new Date(sortedOrders[i].dataPedido).getTime();
                  const diffTime = Math.abs(dateCurr - datePrev);
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  totalDiffDays += diffDays;
                }
                mediaDiasEntreCompras = Math.round(totalDiffDays / (sortedOrders.length - 1));
              } else if (sortedOrders.length === 1) {
                mediaDiasEntreCompras = 90; // Default threshold of 90 days if only 1 purchase
              }

              let daysSinceLast = 0;
              let isOverdue = false;
              if (sortedOrders.length > 0) {
                const lastOrderDateStr = sortedOrders[sortedOrders.length - 1].dataPedido;
                const lastPurchaseTime = new Date(lastOrderDateStr).getTime();
                const todayTime = new Date().getTime();
                daysSinceLast = Math.max(0, Math.ceil((todayTime - lastPurchaseTime) / (1000 * 60 * 60 * 24)));
                isOverdue = mediaDiasEntreCompras > 0 && daysSinceLast > mediaDiasEntreCompras;
              }

              return (
                <div 
                  key={cli.id} 
                  onClick={() => setSelectedClientHistory(cli)}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-emerald-500/50 transition-all relative cursor-pointer"
                >
                  
                  <div className="space-y-3">
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Cliente Carteira</span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-bold">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{cli.cidade || 'Sem Cidade'}-{cli.uf || 'UF'}</span>
                        </div>
                      </div>
                      <h5 className="font-serif font-bold text-base text-slate-800 leading-tight mt-1">{cli.nomeFantasia}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{cli.cnpj}</p>
                      
                      {isOverdue && (
                        <div className="mt-2.5 bg-red-50 text-red-700 border border-red-100 rounded-lg p-2.5 flex items-start gap-1.5 font-mono text-[10px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-red-800">ALERTA DE INATIVIDADE</span>
                            <span className="block font-normal mt-0.5">
                              Sem comprar há <strong className="text-red-700">{daysSinceLast} dias</strong>. (Média: <strong>{mediaDiasEntreCompras} dias</strong>)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-100 pt-2.5 space-y-1.5 text-xs text-slate-600">
                      <p className="font-semibold text-[10px] text-slate-400 uppercase tracking-wide">Razão Social</p>
                      <p className="text-slate-700 font-serif font-bold text-[11px] leading-tight">{cli.razaoSocial}</p>
                      
                      {cli.endereco && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">{cli.endereco}</p>
                      )}

                      {cli.contato && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mt-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Comprador: <strong>{cli.contato}</strong></span>
                        </div>
                      )}

                      {cli.telefone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{formatarTelefone(cli.telefone)}</span>
                        </div>
                      )}

                      {cli.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{cli.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Finance Stats */}
                  <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 px-5 py-4 rounded-b-xl flex items-center justify-between">
                    <div className="font-mono text-[10px]">
                      <span className="text-slate-400 block uppercase tracking-wider">Histórico de Compras</span>
                      <strong className="text-slate-700 text-xs">{formatarMoeda(totalComprado)}</strong>
                    </div>
                    <div className="text-right font-mono text-[10px]">
                      <span className="text-slate-400 block uppercase tracking-wider">Comissão Acumulada</span>
                      <strong className="text-emerald-700 text-xs">{formatarMoeda(totalComissao)}</strong>
                    </div>
                  </div>

                  {/* Actions overlay panel */}
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="absolute right-3 bottom-14 flex items-center gap-1.5 bg-white border border-slate-100 p-1 rounded-lg shadow-sm"
                  >
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditClick(cli); }}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(cli.id, cli.nomeFantasia); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Histórico e Recorrência do Cliente */}
      <AnimatePresence>
        {selectedClientHistory && (() => {
          const cli = selectedClientHistory;
          const clientPedidos = pedidos.filter(p => p.clienteId === cli.id);
          const activePedidos = clientPedidos.filter(p => p.status !== 'Cancelado');
          const totalComprado = activePedidos.reduce((sum, p) => sum + p.valorTotal, 0);
          const totalComissao = activePedidos.reduce((sum, p) => sum + p.valorComissao, 0);
          
          const sortedOrders = [...activePedidos].sort((a, b) => a.dataPedido.localeCompare(b.dataPedido));
          let mediaDiasEntreCompras = 0;
          if (sortedOrders.length >= 2) {
            let totalDiffDays = 0;
            for (let i = 1; i < sortedOrders.length; i++) {
              const datePrev = new Date(sortedOrders[i - 1].dataPedido).getTime();
              const dateCurr = new Date(sortedOrders[i].dataPedido).getTime();
              const diffTime = Math.abs(dateCurr - datePrev);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              totalDiffDays += diffDays;
            }
            mediaDiasEntreCompras = Math.round(totalDiffDays / (sortedOrders.length - 1));
          }

          const ticketMedio = activePedidos.length > 0 ? totalComprado / activePedidos.length : 0;

          // Recurrence labels
          let recorrenciaLabel = "Iniciando";
          let recorrenciaBadge = "text-slate-600 bg-slate-100 border-slate-200";
          let recorrenciaDesc = "Apenas 1 pedido registrado. Recorrência em desenvolvimento conforme novas compras forem registradas.";

          if (activePedidos.length === 0) {
            recorrenciaLabel = "Sem Histórico";
            recorrenciaBadge = "text-slate-400 bg-slate-50 border-slate-150";
            recorrenciaDesc = "Este cliente ainda não realizou compras registradas no sistema.";
          } else if (activePedidos.length >= 2) {
            if (mediaDiasEntreCompras <= 30) {
              recorrenciaLabel = "Excelente Recorrência";
              recorrenciaBadge = "text-emerald-700 bg-emerald-50 border-emerald-200";
              recorrenciaDesc = `Compra a cada ${mediaDiasEntreCompras} dias em média. Excelente frequência de abastecimento!`;
            } else if (mediaDiasEntreCompras <= 60) {
              recorrenciaLabel = "Boa Recorrência";
              recorrenciaBadge = "text-blue-700 bg-blue-50 border-blue-200";
              recorrenciaDesc = `Compra a cada ${mediaDiasEntreCompras} dias em média. Abastecimento bimestral saudável.`;
            } else if (mediaDiasEntreCompras <= 90) {
              recorrenciaLabel = "Recorrência Regular";
              recorrenciaBadge = "text-amber-700 bg-amber-50 border-amber-200";
              recorrenciaDesc = `Compra a cada ${mediaDiasEntreCompras} dias em média. Abastecimento trimestral regular.`;
            } else {
              recorrenciaLabel = "Recorrência Baixa / Sazonal";
              recorrenciaBadge = "text-slate-700 bg-slate-100 border-slate-200";
              recorrenciaDesc = `Compra a cada ${mediaDiasEntreCompras} dias em média. Compras espaçadas ou sazonais.`;
            }
          }

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-5 border-b border-slate-150 flex items-start justify-between bg-slate-50">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Histórico de Compras & Recorrência</span>
                    <h3 className="font-serif font-bold text-lg text-slate-800 leading-tight mt-1">{cli.nomeFantasia}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{cli.razaoSocial} | CNPJ: {cli.cnpj}</p>
                  </div>
                  <button
                    onClick={() => setSelectedClientHistory(null)}
                    className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                  {/* Resumo cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono text-center">
                      <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-bold">Total Comprado</span>
                      <strong className="text-slate-800 text-sm block mt-1">{formatarMoeda(totalComprado)}</strong>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono text-center">
                      <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-bold">Nº de Pedidos</span>
                      <strong className="text-slate-800 text-sm block mt-1">{activePedidos.length}</strong>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono text-center">
                      <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-bold">Ticket Médio</span>
                      <strong className="text-emerald-700 text-sm block mt-1">{formatarMoeda(ticketMedio)}</strong>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono text-center">
                      <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-bold">Comissão Total</span>
                      <strong className="text-emerald-700 text-sm block mt-1">{formatarMoeda(totalComissao)}</strong>
                    </div>
                  </div>

                  {/* Recorrência Metria */}
                  <div className="bg-emerald-50/30 rounded-xl border border-emerald-100 p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="font-serif font-bold text-xs text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        Análise de Recorrência do Comprador
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${recorrenciaBadge}`}>
                        {recorrenciaLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {recorrenciaDesc}
                    </p>
                  </div>

                  {/* Histórico de Pedidos Table */}
                  <div className="space-y-3">
                    <h4 className="font-serif font-bold text-xs text-slate-700 uppercase tracking-wider">Histórico de Pedidos</h4>
                    {clientPedidos.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-slate-150">
                        Nenhum pedido registrado para este cliente.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-250 text-slate-400 uppercase font-mono tracking-wider text-[9px] font-bold">
                              <th className="px-4 py-2.5">Código</th>
                              <th className="px-4 py-2.5">Emissão</th>
                              <th className="px-4 py-2.5">Representada / Fábrica</th>
                              <th className="px-4 py-2.5 text-right">Valor Total</th>
                              <th className="px-4 py-2.5 text-right">Comissão</th>
                              <th className="px-4 py-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {[...clientPedidos]
                              .sort((a, b) => b.dataPedido.localeCompare(a.dataPedido))
                              .map(p => {
                                const rep = representadas.find(r => r.id === p.representadaId);
                                const badgeColor = 
                                  p.status === 'Pago' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
                                  p.status === 'Faturado' ? 'text-blue-700 bg-blue-50 border-blue-100' :
                                  p.status === 'Pendente' ? 'text-amber-700 bg-amber-50 border-amber-100' :
                                  p.status === 'Rascunho' ? 'text-slate-600 bg-slate-50 border-slate-150' : 'text-red-700 bg-red-50 border-red-100';

                                return (
                                  <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="px-4 py-2.5 font-bold text-slate-800">#{p.numeroPedido}</td>
                                    <td className="px-4 py-2.5 text-slate-500">{p.dataPedido.split('-').reverse().join('/')}</td>
                                    <td className="px-4 py-2.5 text-slate-700 font-serif font-bold">
                                      {rep ? rep.nomeFantasia : 'Fábrica'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-800 font-bold">{formatarMoeda(p.valorTotal)}</td>
                                    <td className="px-4 py-2.5 text-right text-emerald-700 font-bold">
                                      {formatarMoeda(p.valorComissao)}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badgeColor}`}>
                                        {p.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-150 bg-slate-50 text-right">
                  <button
                    onClick={() => setSelectedClientHistory(null)}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  >
                    Fechar Histórico
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
