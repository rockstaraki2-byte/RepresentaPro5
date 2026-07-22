import React, { useState } from 'react';
import { Representada, Pedido } from '../types';
import { formatarCNPJ, formatarMoeda, formatarTelefone, consultarCNPJ } from '../utils';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Shield, 
  Phone, 
  Mail, 
  Award, 
  Landmark, 
  Briefcase, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RepresentadasTabProps {
  representadas: Representada[];
  pedidos: Pedido[];
  onAdd: (rep: Representada) => void;
  onEdit: (rep: Representada) => void;
  onDelete: (id: string) => void;
  currentUser?: any;
}

export default function RepresentadasTab({
  representadas,
  pedidos,
  onAdd,
  onEdit,
  onDelete,
  currentUser,
}: RepresentadasTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  
  const [form, setForm] = useState<Partial<Representada>>({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    comissaoPadrao: 5,
    telefone: '',
    email: '',
    segmento: '',
    contato: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({
      nomeFantasia: '',
      razaoSocial: '',
      cnpj: '',
      comissaoPadrao: 5,
      telefone: '',
      email: '',
      segmento: '',
      contato: '',
    });
    setEditingId(null);
    setValidationError(null);
  };

  const handleEditClick = (rep: Representada) => {
    setForm(rep);
    setEditingId(rep.id);
    setValidationError(null);
    setIsFormExpanded(true); // Auto expand when editing
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
        segmento: data.cnae_fiscal_descricao || data.atividade_principal?.[0]?.text || prev.segmento || ''
      }));

      // Set success message
      setValidationError('✓ CNPJ localizado com sucesso! Dados preenchidos automaticamente.');
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

    const comissao = parseFloat(String(form.comissaoPadrao));
    if (isNaN(comissao) || comissao < 0 || comissao > 100) {
      setValidationError('A comissão padrão deve ser um número entre 0 e 100.');
      return;
    }

    const finalForm: Representada = {
      id: editingId || `rep-${Date.now()}`,
      nomeFantasia: form.nomeFantasia.trim(),
      razaoSocial: form.razaoSocial.trim(),
      cnpj: formatarCNPJ(cleanedCnpj),
      comissaoPadrao: comissao,
      telefone: form.telefone?.trim() || '',
      email: form.email?.trim() || '',
      segmento: form.segmento?.trim() || 'Geral',
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
    const vinculados = pedidos.filter(p => p.representadaId === id);
    if (vinculados.length > 0) {
      alert(`Não é possível excluir a representada "${name}" porque ela possui ${vinculados.length} pedido(s) associado(s). Remova ou altere os pedidos primeiro.`);
      return;
    }

    if (confirm(`Tem certeza que deseja remover a representada "${name}"?`)) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-6">

      {/* Top action bar to trigger new represented company modal */}
      <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-slate-800">Fábricas Representadas</h3>
            <p className="text-[11px] text-slate-400">Cadastre as indústrias e empresas parceiras que você representa comercialmente.</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormExpanded(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Representada</span>
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
                  <Landmark className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-serif font-bold text-base text-slate-800">
                    {editingId ? 'Editar Representada' : 'Cadastrar Nova Representada / Fábrica'}
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

                <form onSubmit={handleSubmit} id="rep-form-elem" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    {/* CNPJ com Consulta */}
                    <div className="space-y-1 md:col-span-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">
                        CNPJ da Fábrica <span className="text-red-500">*</span>
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
                      <label className="block text-xs font-mono uppercase text-slate-500">Nome Fantasia <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        placeholder="Ex: Alfa Metais"
                        value={form.nomeFantasia || ''}
                        onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                      />
                    </div>

                    {/* Razão Social */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Razão Social <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        placeholder="Ex: Alfa S/A Indústria Metalúrgica"
                        value={form.razaoSocial || ''}
                        onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-805"
                      />
                    </div>

                    {/* Comissão Padrão % */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Comissão Padrão (%) <span className="text-red-500">*</span></label>
                      <input 
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        placeholder="Ex: 5"
                        value={form.comissaoPadrao === undefined ? '' : form.comissaoPadrao}
                        onChange={(e) => setForm({ ...form, comissaoPadrao: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono font-bold"
                      />
                    </div>

                    {/* Segmento */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Segmento de Atuação</label>
                      <input 
                        type="text"
                        placeholder="Ex: Ferragens, Construção, Moda"
                        value={form.segmento || ''}
                        onChange={(e) => setForm({ ...form, segmento: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Contato Responsável */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Contato na Fábrica</label>
                      <input 
                        type="text"
                        placeholder="Ex: João Silva (Supervisor)"
                        value={form.contato || ''}
                        onChange={(e) => setForm({ ...form, contato: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-855"
                      />
                    </div>

                    {/* Telefone */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Telefone</label>
                      <input 
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={form.telefone || ''}
                        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono"
                      />
                    </div>

                    {/* E-mail */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-mono uppercase text-slate-500">E-mail Comercial</label>
                      <input 
                        type="type"
                        placeholder="pedidos@empresa.com.br"
                        value={form.email || ''}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
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
                    const formElem = document.getElementById('rep-form-elem') as HTMLFormElement;
                    if (formElem) formElem.requestSubmit();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Representada'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grid de Representadas */}
      <div className="space-y-3">
        <h4 className="font-serif font-bold text-base text-slate-700">Parceiras Representadas ({representadas.length})</h4>
        
        {representadas.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-xs text-slate-400 italic">
            Nenhuma representada cadastrada no sistema. Cadastre uma acima para começar!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {representadas.map(rep => {
              // Calculate specific represented metrics
              const repPedidos = pedidos.filter(p => p.representadaId === rep.id && p.status !== 'Cancelado');
              const totalVendas = repPedidos.reduce((sum, p) => sum + p.valorTotal, 0);
              const totalComissao = repPedidos.reduce((sum, p) => sum + p.valorComissao, 0);

              return (
                <div key={rep.id} className="relative bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-3">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded flex items-center justify-center shrink-0">
                          <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 block">{rep.segmento}</span>
                          <h5 className="font-serif font-bold text-sm text-slate-800 leading-tight">{rep.nomeFantasia}</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{rep.cnpj}</p>
                        </div>
                      </div>
                      <span className="bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-100 shrink-0">
                        {rep.comissaoPadrao}% comissão
                      </span>
                    </div>

                    <div className="border-t border-dashed border-slate-100 pt-2.5 space-y-1.5 text-xs text-slate-600">
                      <p className="font-semibold text-[10px] text-slate-400 uppercase tracking-wide">Razão Social</p>
                      <p className="text-slate-700 font-serif font-bold text-[11px] leading-tight">{rep.razaoSocial}</p>
                      
                      {rep.contato && (
                        <div className="flex items-center gap-1.5 text-[11px] mt-1 text-slate-500">
                          <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Fábrica: {rep.contato}</span>
                        </div>
                      )}

                      {rep.telefone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{formatarTelefone(rep.telefone)}</span>
                        </div>
                      )}

                      {rep.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{rep.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo Financeiro da Representada */}
                  <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 px-5 py-4 rounded-b-xl flex items-center justify-between">
                    <div className="font-mono text-[10px]">
                      <span className="text-slate-400 block uppercase tracking-wider">Total de Vendas</span>
                      <strong className="text-slate-700 text-xs">{formatarMoeda(totalVendas)}</strong>
                    </div>
                    <div className="text-right font-mono text-[10px]">
                      <span className="text-slate-400 block uppercase tracking-wider">Comissão Ganha</span>
                      <strong className="text-emerald-700 text-xs">{formatarMoeda(totalComissao)}</strong>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="absolute right-3 bottom-14 flex items-center gap-1.5 bg-white border border-slate-100 p-1 rounded-lg shadow-sm">
                    <button 
                      onClick={() => handleEditClick(rep)}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(rep.id, rep.nomeFantasia)}
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
    </div>
  );
}
