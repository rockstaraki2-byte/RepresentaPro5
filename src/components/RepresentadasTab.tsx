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
  Loader2,
  FileText,
  Upload,
  X,
  Eye,
  ExternalLink,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CatalogViewerModal from './CatalogViewerModal';
import { savePdfToIndexedDB, getPdfFromIndexedDB } from '../lib/pdfStorage';

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
  const [activeCatalogViewer, setActiveCatalogViewer] = useState<{ url: string; title: string; filename?: string } | null>(null);
  
  const [form, setForm] = useState<Partial<Representada>>({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    comissaoPadrao: 5,
    telefone: '',
    email: '',
    segmento: '',
    contato: '',
    catalogoUrl: '',
    catalogoNome: '',
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
      catalogoUrl: '',
      catalogoNome: '',
    });
    setEditingId(null);
    setValidationError(null);
  };

  const handleCatalogFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setValidationError('Por favor, selecione um arquivo no formato PDF.');
      return;
    }

    // Limit check set to 35MB
    if (file.size > 35 * 1024 * 1024) {
      setValidationError('O arquivo PDF excede o limite de 35MB. Para arquivos maiores, utilize o campo de link externo (Google Drive/Dropbox).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setForm(prev => ({
        ...prev,
        catalogoUrl: result,
        catalogoNome: file.name
      }));
      setValidationError('✓ Catálogo PDF anexado com sucesso!');
      setTimeout(() => setValidationError(null), 4000);
    };
    reader.onerror = () => {
      setValidationError('Erro ao ler o arquivo PDF. Tente novamente.');
    };
    reader.readAsDataURL(file);
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
      catalogoUrl: form.catalogoUrl || '',
      catalogoNome: form.catalogoNome || '',
    };

    if (finalForm.catalogoUrl && finalForm.catalogoUrl.startsWith('data:')) {
      savePdfToIndexedDB(finalForm.id, finalForm.catalogoUrl);
    }

    if (editingId) {
      onEdit(finalForm);
    } else {
      onAdd(finalForm);
    }

    resetForm();
    setIsFormExpanded(false); // Collapsed on success
  };

  const handleOpenCatalog = async (rep: Partial<Representada>) => {
    let url = rep.catalogoUrl;
    if (!url || url.startsWith('indexeddb:')) {
      if (rep.id) {
        const stored = await getPdfFromIndexedDB(rep.id);
        if (stored) url = stored;
      }
    }
    if (url) {
      setActiveCatalogViewer({
        url,
        title: rep.nomeFantasia || 'Fábrica',
        filename: rep.catalogoNome || 'Catálogo.pdf'
      });
    } else {
      setValidationError('Catálogo PDF não encontrado.');
    }
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

                    {/* Frete Padrão da Fábrica */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Regra de Frete Padrão</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={form.fretePadraoTipo || 'nenhum'}
                          onChange={(e) => setForm({ ...form, fretePadraoTipo: e.target.value as any })}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-medium"
                        >
                          <option value="nenhum">Sem Frete / Retirada</option>
                          <option value="percentual">% do Valor do Pedido</option>
                          <option value="fixo">Frete Fixo (R$)</option>
                          <option value="manual">Valor Manual no Pedido</option>
                        </select>
                        {(form.fretePadraoTipo === 'percentual' || form.fretePadraoTipo === 'fixo') && (
                          <input 
                            type="number"
                            step="any"
                            min="0"
                            placeholder={form.fretePadraoTipo === 'percentual' ? 'Ex: 3.5 (%)' : 'Ex: 150.00 (R$)'}
                            value={form.fretePadraoValor === undefined ? '' : form.fretePadraoValor}
                            onChange={(e) => setForm({ ...form, fretePadraoValor: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono font-bold"
                          />
                        )}
                      </div>
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
                    <div className="space-y-1 md:col-span-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">E-mail Comercial</label>
                      <input 
                        type="text"
                        placeholder="pedidos@empresa.com.br"
                        value={form.email || ''}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                      />
                    </div>

                    {/* Upload do Catálogo PDF */}
                    <div className="space-y-1 md:col-span-4 border-t border-slate-100 pt-3 mt-2">
                      <label className="block text-xs font-mono uppercase text-slate-600 font-bold flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Catálogo de Produtos em PDF (Opção de Upload)</span>
                      </label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                        {/* File Upload Box */}
                        <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-3 text-center bg-slate-50 transition-colors">
                          <input 
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={handleCatalogFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            id="pdf-catalog-input"
                          />
                          <div className="flex flex-col items-center justify-center gap-1 text-slate-500">
                            <Upload className="w-5 h-5 text-emerald-600" />
                            <span className="text-xs font-medium text-slate-700">Clique ou arraste um arquivo PDF aqui</span>
                            <span className="text-[10px] text-slate-400">Até 30MB para envio direto</span>
                          </div>
                        </div>

                        {/* Direct URL input or current file status */}
                        <div className="space-y-2">
                          {form.catalogoUrl ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-2 overflow-hidden pr-2">
                                <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                                <div className="truncate">
                                  <span className="text-xs font-bold text-emerald-900 block truncate">
                                    {form.catalogoNome || 'Catálogo Anexado.pdf'}
                                  </span>
                                  <span className="text-[10px] text-emerald-700 block">PDF pronto para visualização</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCatalog(form)}
                                  className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Testar Visualização"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Ver</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setForm({ ...form, catalogoUrl: '', catalogoNome: '' })}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all cursor-pointer"
                                  title="Remover Catálogo"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-[11px] text-slate-500 block">Ou cole o Link Externo (URL do PDF no Google Drive, Dropbox, etc):</span>
                              <div className="flex gap-1.5">
                                <input 
                                  type="url"
                                  placeholder="https://exemplo.com/catalogo.pdf"
                                  value={form.catalogoUrl || ''}
                                  onChange={(e) => setForm({ 
                                    ...form, 
                                    catalogoUrl: e.target.value,
                                    catalogoNome: e.target.value ? 'Catálogo Externo (Link)' : ''
                                  })}
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                                />
                              </div>
                            </div>
                          )}
                        </div>
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

                      {/* Catálogo PDF Badge / Button */}
                      {(rep.catalogoUrl || rep.catalogoNome) ? (
                        <div className="pt-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCatalog(rep)}
                            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Catálogo PDF</span>
                            </span>
                            <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded font-sans flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Visualizar
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1 text-[10px] text-slate-400 italic flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          Sem catálogo em PDF anexado
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

      {/* Modal Visualizador do Catálogo PDF */}
      <CatalogViewerModal
        isOpen={!!activeCatalogViewer}
        onClose={() => setActiveCatalogViewer(null)}
        title={activeCatalogViewer?.title || 'Fábrica'}
        pdfUrl={activeCatalogViewer?.url}
        pdfName={activeCatalogViewer?.filename}
      />
    </div>
  );
}
