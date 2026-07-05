import React, { useState } from 'react';
import { Produto, Representada } from '../types';
import { formatarMoeda } from '../utils';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Tag, 
  Package, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Building2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProdutosTabProps {
  produtos: Produto[];
  representadas: Representada[];
  onAdd: (prod: Produto) => void;
  onEdit: (prod: Produto) => void;
  onDelete: (id: string) => void;
}

export default function ProdutosTab({
  produtos,
  representadas,
  onAdd,
  onEdit,
  onDelete,
}: ProdutosTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState('all');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);

  const [form, setForm] = useState<Partial<Produto>>({
    codigo: '',
    nome: '',
    representadaId: '',
    precoVenda: 0,
    unidade: 'Un',
    descricao: '',
    ativo: true,
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({
      codigo: '',
      nome: '',
      representadaId: representadas[0]?.id || '',
      precoVenda: 0,
      unidade: 'Un',
      descricao: '',
      ativo: true,
    });
    setEditingId(null);
    setValidationError(null);
  };

  const handleEditClick = (prod: Produto) => {
    setForm(prod);
    setEditingId(prod.id);
    setValidationError(null);
    setIsFormExpanded(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.codigo?.trim() || !form.nome?.trim() || form.precoVenda === undefined) {
      setValidationError('Por favor, preencha os campos obrigatórios (Código, Nome, e Preço de Venda).');
      return;
    }

    if (form.precoVenda <= 0) {
      setValidationError('O Preço de Venda deve ser maior que zero.');
      return;
    }

    const finalForm: Produto = {
      id: editingId || `prod-${Date.now()}`,
      codigo: form.codigo.trim().toUpperCase(),
      nome: form.nome.trim(),
      representadaId: form.representadaId || undefined,
      precoVenda: Number(form.precoVenda),
      unidade: form.unidade?.trim() || 'Un',
      descricao: form.descricao?.trim() || '',
      ativo: form.ativo !== false,
      cor: form.cor?.trim(),
      variacao: form.variacao?.trim(),
    };

    if (editingId) {
      onEdit(finalForm);
    } else {
      onAdd(finalForm);
    }

    resetForm();
    setIsFormExpanded(false);
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja remover o produto "${name}" do catálogo?`)) {
      onDelete(id);
    }
  };

  // Filter products based on search query and representada filter
  const produtosFiltrados = produtos.filter(p => {
    const query = searchQuery.toLowerCase();
    const repMatch = selectedRepFilter === 'all' || p.representadaId === selectedRepFilter;
    
    // Get represented name to search by it too
    const repName = representadas.find(r => r.id === p.representadaId)?.nomeFantasia.toLowerCase() || '';

    const textMatch = 
      p.nome.toLowerCase().includes(query) ||
      p.codigo.toLowerCase().includes(query) ||
      (p.descricao || '').toLowerCase().includes(query) ||
      repName.includes(query);

    return repMatch && textMatch;
  });

  return (
    <div className="space-y-6">
      
      {/* Top action bar to trigger new product modal */}
      <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-slate-800">Catálogo de Produtos</h3>
            <p className="text-[11px] text-slate-400">Cadastre e gerencie os itens e preços para todas as suas representadas.</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormExpanded(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Produto</span>
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
                  <Package className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-serif font-bold text-base text-slate-800">
                    {editingId ? 'Editar Dados do Produto' : 'Cadastrar Novo Produto Comercial'}
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
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-100">
                    {validationError}
                  </div>
                )}

                <form onSubmit={handleSubmit} id="prod-form-elem" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    {/* Código / SKU */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Código do Produto (SKU) <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        placeholder="Ex: ALF-021"
                        value={form.codigo || ''}
                        onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono font-bold uppercase"
                      />
                    </div>

                    {/* Nome do Produto */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-mono uppercase text-slate-500">Nome Comercial <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        placeholder="Ex: Parafuso Rosca Fina Galvanizado"
                        value={form.nome || ''}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                      />
                    </div>

                    {/* Fábrica / Representada */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Fábrica Representada (Opcional)</label>
                      <select
                        value={form.representadaId || ''}
                        onChange={(e) => setForm({ ...form, representadaId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      >
                        <option value="">Selecione uma Fábrica (Opcional)</option>
                        {representadas.map(rep => (
                          <option key={rep.id} value={rep.id}>{rep.nomeFantasia}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cor */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Cores Disponíveis (Opcional)</label>
                      <input 
                        type="text"
                        placeholder="Ex: Azul, Verde, Preto"
                        value={form.cor || ''}
                        onChange={(e) => setForm({ ...form, cor: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Variação/Tamanho */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Tamanhos/Variações (Opcional)</label>
                      <input 
                        type="text"
                        placeholder="Ex: P, M, G, GG ou 38, 40, 42"
                        value={form.variacao || ''}
                        onChange={(e) => setForm({ ...form, variacao: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Preço de Venda */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Preço de Venda (R$) <span className="text-red-500">*</span></label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.precoVenda || ''}
                        onChange={(e) => setForm({ ...form, precoVenda: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono"
                      />
                    </div>

                    {/* Unidade */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Unidade de Medida</label>
                      <input 
                        type="text"
                        placeholder="Ex: Un, Cx, FD, Rolo, Kg"
                        value={form.unidade || ''}
                        onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Descrição / Observações */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-mono uppercase text-slate-500">Especificações Técnicas / Descrição</label>
                      <input 
                        type="text"
                        placeholder="Ex: Medida 1/2 polegada, embalagem de papelão..."
                        value={form.descricao || ''}
                        onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Ativo */}
                    <div className="flex items-center gap-2 pt-6 pl-2">
                      <input 
                        type="checkbox"
                        id="ativo"
                        checked={form.ativo !== false}
                        onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                      />
                      <label htmlFor="ativo" className="text-xs font-mono uppercase text-slate-600 cursor-pointer select-none">Disponível para venda (Ativo)</label>
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
                    const formElem = document.getElementById('prod-form-elem') as HTMLFormElement;
                    if (formElem) formElem.requestSubmit();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Busca e Lista de Produtos */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="font-serif font-bold text-base text-slate-700">Catálogo de Produtos ({produtosFiltrados.length})</h4>
          
          <div className="flex items-center gap-2">
            {/* Toggle de Filtros */}
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`bg-white border text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                isFiltersExpanded ? 'border-emerald-500 text-emerald-700 bg-emerald-50/20' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
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
              <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-xs">
                {/* Filtro por Representada */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Filtrar por Fábrica</label>
                  <select
                    value={selectedRepFilter}
                    onChange={(e) => setSelectedRepFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-emerald-600 focus:bg-white font-bold"
                  >
                    <option value="all">Todas as Representadas</option>
                    {representadas.map(rep => (
                      <option key={rep.id} value={rep.id}>{rep.nomeFantasia}</option>
                    ))}
                  </select>
                </div>

                {/* Caixa de Busca */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pesquisar por Código/Nome</label>
                  <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input 
                      type="text"
                      placeholder="Buscar por código, nome..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {produtosFiltrados.length === 0 ? (
          <div className="bg-white border border-slate-200/60 rounded-xl p-8 text-center text-slate-500 shadow-xs flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <p className="text-xs">Nenhum produto encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {produtosFiltrados.map((prod) => {
              const rep = representadas.find(r => r.id === prod.representadaId);
              return (
                <div 
                  key={prod.id}
                  className={`bg-white rounded-xl border p-4 shadow-xs transition-all flex flex-col justify-between hover:shadow-md ${
                    prod.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                        {prod.codigo}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded ${
                          prod.ativo 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                            : 'bg-slate-150 text-slate-500 border border-slate-200'
                        }`}>
                          {prod.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-serif font-bold text-sm text-slate-900 leading-snug">{prod.nome}</h5>
                      <div className="flex items-center gap-1 mt-1 text-slate-500 text-xs">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">Fábrica: <strong>{rep ? rep.nomeFantasia : 'N/A'}</strong></span>
                      </div>
                      
                      {(prod.cor || prod.variacao) && (
                        <div className="flex gap-2 mt-1.5 text-[10px] font-mono text-slate-500">
                          {prod.cor && <span className="bg-slate-100 px-1.5 py-0.5 rounded">Cores: {prod.cor}</span>}
                          {prod.variacao && <span className="bg-slate-100 px-1.5 py-0.5 rounded">Vars: {prod.variacao}</span>}
                        </div>
                      )}
                      
                      {prod.descricao && (
                        <p className="text-slate-400 text-[11px] mt-1 line-clamp-2 italic leading-relaxed">
                          "{prod.descricao}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 font-mono block uppercase">Preço / Unid</span>
                      <div className="flex items-baseline gap-1">
                        <strong className="text-slate-900 text-sm font-extrabold">{formatarMoeda(prod.precoVenda)}</strong>
                        <span className="text-slate-400 text-[10px] font-mono">/ {prod.unidade}</span>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEditClick(prod)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar Produto"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(prod.id, prod.nome)}
                        className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Remover Produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
