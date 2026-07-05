import React, { useState, useEffect } from 'react';
import { Pedido, Cliente, Representada, OrderItem, PedidoStatus, Produto } from '../types';
import { formatarMoeda, formatarData } from '../utils';
import { Plus, Trash2, Edit3, Eye, FileText, Check, Percent, AlertCircle, ShoppingCart, Mail, Send, Printer, Loader2, Download, MessageCircle, ChevronDown, SlidersHorizontal, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gerarPedidoPDF, gerarResumoMensalPDF } from '../lib/pdfGenerator';

interface SearchableSelectProps {
  options: { id: string; label: string; sublabel?: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selectedOption = options.find(o => o.id === value);
  
  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedOption ? selectedOption.label : '');
    }
  }, [isOpen, selectedOption]);

  const filtered = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          disabled={disabled}
          className={`w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'
          }`}
        />
        <div className="absolute right-2.5 pointer-events-none text-slate-400">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <ul className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50 divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <li className="p-3 text-xs text-slate-400 italic text-center">Nenhum resultado encontrado</li>
            ) : (
              filtered.map(opt => (
                <li
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 text-xs text-left cursor-pointer hover:bg-slate-50 transition-colors ${
                    opt.id === value ? 'bg-slate-50 text-emerald-700 font-extrabold' : 'text-slate-700'
                  }`}
                >
                  <div className="font-bold">{opt.label}</div>
                  {opt.sublabel && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.sublabel}</div>}
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}

interface PedidosTabProps {
  pedidos: Pedido[];
  clientes: Cliente[];
  representadas: Representada[];
  produtos: Produto[];
  activePedidoToEdit: Pedido | null;
  onClearActiveEdit: () => void;
  onAdd: (pedido: Pedido) => void;
  onEdit: (pedido: Pedido) => void;
  onDelete: (id: string) => void;
  empresaRepresentacao?: any;
  currentUser?: any;
}

export default function PedidosTab({
  pedidos,
  clientes,
  representadas,
  produtos,
  activePedidoToEdit,
  onClearActiveEdit,
  onAdd,
  onEdit,
  onDelete,
  empresaRepresentacao,
  currentUser,
}: PedidosTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Collapsible Filters
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  // Form states
  const [numeroPedido, setNumeroPedido] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [representadaId, setRepresentadaId] = useState('');
  const [dataPedido, setDataPedido] = useState(new Date().toISOString().split('T')[0]);
  const [itens, setItens] = useState<OrderItem[]>([]);
  const [comissaoPercentual, setComissaoPercentual] = useState<number>(5);
  const [status, setStatus] = useState<PedidoStatus>('Pendente');
  const [observacoes, setObservacoes] = useState('');
  const [condicoesPagamento, setCondicoesPagamento] = useState('');

  // Item form states
  const [selectedProdutoId, setSelectedProdutoId] = useState('');
  const [itemDescricao, setItemDescricao] = useState('');
  const [itemCor, setItemCor] = useState('');
  const [itemVariacao, setItemVariacao] = useState('');
  const [itemQuantidade, setItemQuantidade] = useState<number>(1);
  const [itemPreco, setItemPreco] = useState<number>(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);

  // Modal and Email states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [emailPedido, setEmailPedido] = useState<Pedido | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Load order for editing if triggered from props
  useEffect(() => {
    if (activePedidoToEdit) {
      handleLoadForEdit(activePedidoToEdit);
      onClearActiveEdit(); // Clear parent trigger
    }
  }, [activePedidoToEdit]);

  // Helper to auto generate sequential order numbers in format: PED-CLIENTE-0001-YEAR
  const handleAutoGenerateOrderNumber = () => {
    const selectedCliente = clientes.find(c => c.id === clienteId);
    const clientName = selectedCliente?.nomeFantasia || selectedCliente?.razaoSocial || '';
    
    const suffixes = ['ltda', 'me', 'epp', 'sa', 's/a', 'eireli', 'comercial', 'representacoes', 'industria', 'e', 'de', 'para', 'do', 'da'];
    const words = clientName
      .toLowerCase()
      .split(/[^a-zA-Z0-9]+/)
      .filter(w => w && !suffixes.includes(w));
    
    let abr = words.slice(0, 2).join('-').toUpperCase();
    if (!abr && clientName) {
      abr = clientName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
    }
    if (!abr) abr = 'CLIENTE';
    
    const year = dataPedido ? dataPedido.split('-')[0] : new Date().getFullYear().toString();
    
    // Find highest sequence among ALL orders for this client & year
    let maxSeq = 0;
    pedidos.forEach(p => {
      const match = p.numeroPedido.match(/^PED-(.+)-(\d+)-(\d{4})$/i);
      if (match) {
        const pAbr = match[1].toUpperCase();
        const pSeq = parseInt(match[2], 10);
        const pYear = match[3];
        
        if (pAbr === abr && pYear === year) {
          if (pSeq > maxSeq) {
            maxSeq = pSeq;
          }
        }
      } else if (p.clienteId === clienteId) {
        // Fallback: if it's the same client, try to parse any digits
        const digits = p.numeroPedido.match(/(\d+)/g);
        if (digits) {
          digits.forEach(dStr => {
            const val = parseInt(dStr, 10);
            if (val > maxSeq && val < 9000 && dStr !== year) {
              maxSeq = val;
            }
          });
        }
      }
    });
    
    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(4, '0');
    
    setNumeroPedido(`PED-${abr}-${seqStr}-${year}`);
  };

  // Automatically trigger code generation for new orders if client is selected and number is empty or formatted
  useEffect(() => {
    if (!editingId && clienteId && (numeroPedido === '' || numeroPedido.startsWith('PEDIDO-') || numeroPedido.startsWith('PED-'))) {
      handleAutoGenerateOrderNumber();
    }
  }, [clienteId, dataPedido, editingId]);

  // Sync default commission % when represented company is selected (only when creating)
  const handleRepresentadaChange = (id: string) => {
    setRepresentadaId(id);
    if (!editingId) {
      const repSelected = representadas.find(r => r.id === id);
      if (repSelected) {
        setComissaoPercentual(repSelected.comissaoPadrao);
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDescricao.trim()) {
      alert('Preencha a descrição do produto.');
      return;
    }
    if (itemQuantidade <= 0) {
      alert('A quantidade do item deve ser maior que zero.');
      return;
    }
    if (itemPreco < 0) {
      alert('O preço unitário não pode ser negativo.');
      return;
    }

    if (editingItemId) {
      setItens(itens.map(it => it.id === editingItemId ? {
        ...it,
        descricao: itemDescricao.trim(),
        cor: itemCor.trim() || undefined,
        variacao: itemVariacao.trim() || undefined,
        quantidade: itemQuantidade,
        precoUnitario: itemPreco,
        totalItem: itemQuantidade * itemPreco
      } : it));
    } else {
      const novoItem: OrderItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(5)}`,
        descricao: itemDescricao.trim(),
        cor: itemCor.trim() || undefined,
        variacao: itemVariacao.trim() || undefined,
        quantidade: itemQuantidade,
        precoUnitario: itemPreco,
        totalItem: itemQuantidade * itemPreco
      };
      setItens([...itens, novoItem]);
    }

    setSelectedProdutoId('');
    setItemDescricao('');
    setItemCor('');
    setItemVariacao('');
    setItemQuantidade(1);
    setItemPreco(0);
    setEditingItemId(null);
  };

  const handleEditItemInit = (item: OrderItem) => {
    setEditingItemId(item.id);
    setItemDescricao(item.descricao);
    setItemCor(item.cor || '');
    setItemVariacao(item.variacao || '');
    setItemQuantidade(item.quantidade);
    setItemPreco(item.precoUnitario);
  };

  const handleRemoveItem = (id: string) => {
    setItens(itens.filter(it => it.id !== id));
  };

  const resetForm = () => {
    setEditingId(null);
    setNumeroPedido('');
    setClienteId('');
    setRepresentadaId('');
    setDataPedido(new Date().toISOString().split('T')[0]);
    setItens([]);
    setComissaoPercentual(5);
    setStatus('Pendente');
    setObservacoes('');
    setCondicoesPagamento('');
    setSelectedProdutoId('');
    setValidationError(null);
    setIsFormOpen(false);
  };

  const handleLoadForEdit = (p: Pedido) => {
    setEditingId(p.id);
    setNumeroPedido(p.numeroPedido);
    setClienteId(p.clienteId);
    setRepresentadaId(p.representadaId);
    setDataPedido(p.dataPedido);
    setItens(p.itens || []);
    setComissaoPercentual(p.comissaoPercentual);
    setStatus(p.status);
    setObservacoes(p.observacoes || '');
    setCondicoesPagamento(p.condicoesPagamento || '');
    setValidationError(null);
    setIsFormOpen(true);
  };

  const handleOpenEmailModal = (p: Pedido) => {
    const cli = clientes.find(c => c.id === p.clienteId);
    const rep = representadas.find(r => r.id === p.representadaId);
    
    const itemsList = p.itens.map(it => {
      let desc = `- ${it.descricao}: ${it.quantidade}x ${formatarMoeda(it.precoUnitario)}`;
      if (it.cor) desc += ` | Cor: ${it.cor}`;
      if (it.variacao) desc += ` | Var: ${it.variacao}`;
      return desc;
    }).join('\n');
    
    setEmailPedido(p);
    setEmailRecipient(cli?.email || '');
    setEmailSubject(`Pedido de Venda #${p.numeroPedido} - ${rep?.nomeFantasia || 'Representada'}`);
    setEmailBody(`Prezado(a) ${cli?.contato || 'Cliente'},\n\nSegue em anexo a cópia digital do Pedido de Venda #${p.numeroPedido}.\n\n*Itens do Pedido:*\n${itemsList}\n\nResumo Financeiro:\nValor Total: ${formatarMoeda(p.valorTotal)}\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nRepresentação Comercial`);
    setEmailSuccess(false);
  };

  const handleSendWhatsApp = (p: Pedido) => {
    const cli = clientes.find(c => c.id === p.clienteId);
    const rep = representadas.find(r => r.id === p.representadaId);
    
    const formattedDate = formatarData(p.dataPedido);
    const totalVal = formatarMoeda(p.valorTotal);
    
    const itemsList = p.itens.map(it => {
      let desc = `- ${it.descricao}: ${it.quantidade}x ${formatarMoeda(it.precoUnitario)}`;
      if (it.cor) desc += ` | Cor: ${it.cor}`;
      if (it.variacao) desc += ` | Var: ${it.variacao}`;
      return desc;
    }).join('\n');
    
    const text = `Olá, *${cli?.contato || 'Cliente'}*!\n\nSegue o resumo do seu *Pedido #${p.numeroPedido}* em parceria com a fábrica *${rep?.nomeFantasia || 'Representada'}*:\n\n*Data do Pedido:* ${formattedDate}\n*Status:* ${p.status}\n\n*Itens do Pedido:*\n${itemsList}\n\n*Valor Total do Pedido:* *${totalVal}*\n\nSe tiver qualquer dúvida, estou à disposição.\nAtenciosamente,\nRepresentação Comercial`;
    
    const firstPhone = cli?.telefone ? cli.telefone.split('/')[0].split('|')[0] : '';
    const phone = firstPhone.replace(/\D/g, '');
    let formattedPhone = phone;
    if (phone && phone.length <= 11) {
      formattedPhone = `55${phone}`;
    }
    
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPedido) return;
    setIsSendingEmail(true);
    try {
      const cli = clientes.find(c => c.id === emailPedido.clienteId);
      const rep = representadas.find(r => r.id === emailPedido.representadaId);
      
      // Generate the PDF without saving/downloading in browser
      const doc = gerarPedidoPDF(emailPedido, cli, rep, empresaRepresentacao, true);
      
      let dataUri = '';
      try {
        dataUri = doc.output('datauristring');
      } catch (errOutput) {
        dataUri = doc.output('dataurlstring');
      }
      
      // Decode percent-encoded characters like %2B, %2F, %3D back to actual Base64 chars
      const decodedUri = decodeURIComponent(dataUri);
      const parts = decodedUri.split(',');
      const pdfBase64 = parts[1] || parts[0];
      const pdfFilename = `Pedido_${emailPedido.numeroPedido}_${rep?.nomeFantasia || 'Venda'}.pdf`;

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailRecipient,
          subject: emailSubject,
          body: emailBody,
          attachment: pdfBase64,
          attachmentName: pdfFilename,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao enviar e-mail através do servidor.');
      }

      setEmailSuccess(true);
      setTimeout(() => {
        setEmailPedido(null);
      }, 1800);
    } catch (err: any) {
      console.error('Erro ao enviar e-mail pelo servidor, usando fallback local:', err);
      
      // Fallback para link mailto: local caso esteja rodando sem backend ou credenciais não estejam configuradas
      const mailtoUrl = `mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      const confirmMailto = confirm(
        `${err.message || 'O servidor de e-mail do sistema não pôde ser alcançado.'}\n\n` +
        'Deseja abrir o seu aplicativo de e-mail local (Outlook, Gmail, Apple Mail, etc.) para enviar o pedido diretamente?'
      );
      if (confirmMailto) {
        window.open(mailtoUrl, '_blank');
        setEmailPedido(null);
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSubmitPedido = (e: React.FormEvent) => {
    e.preventDefault();

    if (!numeroPedido.trim() || !clienteId || !representadaId) {
      setValidationError('Por favor, preencha o número do pedido, selecione o cliente e selecione a representada.');
      return;
    }

    if (itens.length === 0) {
      setValidationError('Adicione pelo menos um produto/item ao pedido.');
      return;
    }

    const totalPedido = itens.reduce((sum, item) => sum + item.totalItem, 0);
    
    // For non-admins, ensure the commission is exactly the default of the represented company
    let percComissao = parseFloat(String(comissaoPercentual));
    if (currentUser?.role !== 'Administrador') {
      const repSelected = representadas.find(r => r.id === representadaId);
      if (repSelected) {
        percComissao = repSelected.comissaoPadrao;
      }
    }

    if (isNaN(percComissao) || percComissao < 0 || percComissao > 100) {
      setValidationError('A porcentagem de comissão deve estar entre 0 e 100.');
      return;
    }

    const valorComissaoCalculado = totalPedido * (percComissao / 100);

    const finalPedido: Pedido = {
      id: editingId || `ped-${Date.now()}`,
      numeroPedido: numeroPedido.trim(),
      clienteId,
      representadaId,
      dataPedido,
      itens,
      valorTotal: totalPedido,
      comissaoPercentual: percComissao,
      valorComissao: valorComissaoCalculado,
      status,
      observacoes: observacoes.trim() || undefined,
      condicoesPagamento: condicoesPagamento.trim() || undefined,
    };

    if (editingId) {
      onEdit(finalPedido);
    } else {
      onAdd(finalPedido);
    }

    resetForm();
  };

  // Filter orders based on queries
  const pedidosFiltrados = pedidos.filter(p => {
    const cli = clientes.find(c => c.id === p.clienteId);
    const rep = representadas.find(r => r.id === p.representadaId);
    
    const matchesSearch = 
      p.numeroPedido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cli && cli.nomeFantasia.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rep && rep.nomeFantasia.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalCalculadoForm = itens.reduce((sum, item) => sum + item.totalItem, 0);
  const valorComissaoForm = totalCalculadoForm * (comissaoPercentual / 100);
  const produtosFiltradosRepresentada = produtos ? produtos.filter(p => p.representadaId === representadaId && p.ativo) : [];

  return (
    <div className="space-y-6">
      
      {/* Top action bar to trigger new order modal */}
      <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-slate-800">Emissão de Pedidos de Venda</h3>
            <p className="text-[11px] text-slate-400">Gere novos pedidos de faturamento e envie comissões automáticas para sua carteira.</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Pedido</span>
        </button>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2 text-emerald-800">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-serif font-bold text-base text-slate-800">
                    {editingId ? `Editar Pedido #${numeroPedido}` : 'Gerar e Emitir Novo Pedido'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  <span className="font-bold text-lg">&times;</span>
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-6 overflow-y-auto space-y-4">
                {validationError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-100">
                    {validationError}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Dados Gerais do Pedido */}
                  <form onSubmit={handleSubmitPedido} id="ped-form-elem" className="lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Código/Nº do Pedido */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-mono uppercase text-slate-500">Número do Pedido <span className="text-red-500">*</span></label>
                          <button
                            type="button"
                            onClick={handleAutoGenerateOrderNumber}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline font-bold cursor-pointer"
                            title="Gerar código automaticamente com base no cliente e ano"
                          >
                            ⚡ Gerar Automático
                          </button>
                        </div>
                        <input 
                          type="text"
                          placeholder="PEDIDO-XXXXX - CLIENTE - ANO"
                          value={numeroPedido}
                          onChange={(e) => setNumeroPedido(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold font-mono"
                        />
                      </div>

                      {/* Data do Pedido */}
                      <div className="space-y-1">
                        <label className="block text-xs font-mono uppercase text-slate-500">Data de Emissão <span className="text-red-500">*</span></label>
                        <input 
                          type="date"
                          value={dataPedido}
                          onChange={(e) => setDataPedido(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono"
                        />
                      </div>

                      {/* Cliente */}
                      <div className="space-y-1">
                        <label className="block text-xs font-mono uppercase text-slate-500">Cliente (Comprador) <span className="text-red-500">*</span></label>
                        <SearchableSelect
                          options={clientes.map(c => ({
                            id: c.id,
                            label: c.nomeFantasia,
                            sublabel: `CNPJ: ${c.cnpj} | ${c.cidade}-${c.uf}`
                          }))}
                          value={clienteId}
                          onChange={(id) => setClienteId(id)}
                          placeholder="Buscar cliente por nome ou CNPJ..."
                        />
                      </div>

                      {/* Representada */}
                      <div className="space-y-1">
                        <label className="block text-xs font-mono uppercase text-slate-500">Representada (Fábrica) <span className="text-red-500">*</span></label>
                        <SearchableSelect
                          options={representadas.map(r => ({
                            id: r.id,
                            label: r.nomeFantasia,
                            sublabel: currentUser?.role === 'Administrador' ? `CNPJ: ${r.cnpj} | ${r.comissaoPadrao}% comissão padrão` : `CNPJ: ${r.cnpj}`
                          }))}
                          value={representadaId}
                          onChange={(id) => handleRepresentadaChange(id)}
                          placeholder="Buscar representada por nome ou CNPJ..."
                        />
                      </div>

                      {/* Porcentagem Comissão */}
                      <div className="space-y-1">
                        <label className="block text-xs font-mono uppercase text-slate-500">Comissão Ajustada (%)</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            placeholder="5.0"
                            value={comissaoPercentual}
                            onChange={(e) => setComissaoPercentual(parseFloat(e.target.value) || 0)}
                            disabled={currentUser?.role !== 'Administrador'}
                            className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono font-bold ${
                              currentUser?.role !== 'Administrador' ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
                            }`}
                          />
                          <span className="text-xs font-mono text-slate-400 font-semibold shrink-0">Comissão</span>
                        </div>
                      </div>

                      {/* Status do Pedido */}
                      <div className="space-y-1">
                        <label className="block text-xs font-mono uppercase text-slate-500">Status do Pedido <span className="text-red-500">*</span></label>
                        <select 
                          value={status}
                          onChange={(e) => setStatus(e.target.value as PedidoStatus)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 cursor-pointer font-bold"
                        >
                          <option value="Rascunho">Rascunho</option>
                          <option value="Pendente">Pendente (Liberação Fábrica)</option>
                          <option value="Faturado">Faturado (Fábrica enviou)</option>
                          <option value="Pago">Comissão Recebida (Pago)</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </div>

                    </div>

                    {/* Condições de Pagamento */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Condições de Pagamento</label>
                      <input 
                        type="text"
                        placeholder="Ex: 30/60/90 dias, Boleto Bancário, À Vista"
                        value={condicoesPagamento}
                        onChange={(e) => setCondicoesPagamento(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-medium"
                      />
                    </div>

                    {/* Observações */}
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-slate-500">Observações de Faturamento</label>
                      <textarea 
                        rows={2}
                        placeholder="Ex: Enviar via transportadora indicada pelo cliente."
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 resize-none leading-relaxed"
                      />
                    </div>

                    {/* Tabela de Itens Adicionados */}
                    <div className="space-y-1.5 pt-2">
                      <span className="block text-xs font-mono uppercase text-slate-500">Produtos no Pedido ({itens.length})</span>
                      <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50/30">
                        {itens.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 italic">
                            Nenhum produto adicionado. Use o painel lateral direito para cadastrar itens!
                          </div>
                        ) : (
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-mono text-[9px] border-b border-slate-100">
                                <th className="p-2.5 pl-3">Descrição do Produto</th>
                                <th className="p-2.5 text-center">Qtd</th>
                                <th className="p-2.5 text-right">Preço Unitário</th>
                                <th className="p-2.5 text-right">Subtotal</th>
                                <th className="p-2.5 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {itens.map(it => (
                                  <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="p-2.5 pl-3">
                                      <div className="font-serif text-slate-700 font-bold">{it.descricao}</div>
                                      {(it.cor || it.variacao) && (
                                        <div className="flex gap-1.5 mt-0.5 text-[9px] font-mono text-slate-500">
                                          {it.cor && <span>Cor: {it.cor}</span>}
                                          {it.variacao && <span>Var: {it.variacao}</span>}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center font-mono font-bold text-slate-600">{it.quantidade}</td>
                                    <td className="p-2.5 text-right font-mono text-slate-600">{formatarMoeda(it.precoUnitario)}</td>
                                    <td className="p-2.5 text-right font-mono text-slate-700 font-bold">{formatarMoeda(it.totalItem)}</td>
                                    <td className="p-2.5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button 
                                          type="button"
                                          onClick={() => handleEditItemInit(it)}
                                          className="text-emerald-600 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50 cursor-pointer"
                                          title="Editar Item"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleRemoveItem(it.id)}
                                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 cursor-pointer"
                                          title="Remover Item"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </form>

                  {/* Adicionador de Itens lateral */}
                  <div className="lg:col-span-4 bg-slate-50 border border-slate-200/80 p-5 rounded-xl flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-slate-800 flex items-center gap-1.5 mb-3 border-b border-slate-200 pb-2">
                        <ShoppingCart className="w-4 h-4 text-emerald-600" />
                        <span>Inserir Item / Produto</span>
                      </h4>
                      
                      <form onSubmit={handleAddItem} className="space-y-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono uppercase text-slate-500">Selecionar Produto Cadastrado <span className="text-red-500">*</span></label>
                          <SearchableSelect
                            options={produtosFiltradosRepresentada.map(p => ({
                              id: p.id,
                              label: p.nome,
                              sublabel: `Cód: ${p.codigo} | Sugerido: ${formatarMoeda(p.precoVenda)} / ${p.unidade}`
                            }))}
                            value={selectedProdutoId}
                            onChange={(id) => {
                              setSelectedProdutoId(id);
                              const prod = produtos.find(p => p.id === id);
                              if (prod) {
                                setItemDescricao(prod.nome);
                                setItemPreco(prod.precoVenda);
                                setItemCor(prod.cor || '');
                                setItemVariacao(prod.variacao || '');
                              }
                            }}
                            placeholder={representadaId ? "Buscar produto..." : "Selecione representada primeiro"}
                            disabled={!representadaId}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1 sm:col-span-1">
                            <label className="block text-[10px] font-mono uppercase text-slate-500">Cor</label>
                            <input 
                              type="text"
                              placeholder="Opcional"
                              value={itemCor}
                              onChange={(e) => setItemCor(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                            />
                          </div>
                          
                          <div className="space-y-1 sm:col-span-2">
                            <label className="block text-[10px] font-mono uppercase text-slate-500">Variação / Tamanho</label>
                            <input 
                              type="text"
                              placeholder="Opcional"
                              value={itemVariacao}
                              onChange={(e) => setItemVariacao(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono uppercase text-slate-500">Descrição no Pedido</label>
                          <input 
                            type="text"
                            placeholder="Descrição final do item"
                            value={itemDescricao}
                            onChange={(e) => setItemDescricao(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 text-slate-850"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono uppercase text-slate-500">Quantidade</label>
                            <input 
                              type="number"
                              min="1"
                              value={itemQuantidade}
                              onChange={(e) => setItemQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 text-slate-850 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono uppercase text-slate-500">P. Unitário (R$)</label>
                            <input 
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0.00"
                              value={itemPreco === 0 ? '' : itemPreco}
                              onChange={(e) => setItemPreco(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 text-slate-850 font-mono font-bold"
                            />
                          </div>
                        </div>

                        <button 
                          type="submit"
                          className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{editingItemId ? 'Atualizar Item' : 'Adicionar ao Carrinho'}</span>
                        </button>
                      </form>
                    </div>

                    {/* Painel Financeiro Dinâmico */}
                    <div className="mt-5 pt-4 border-t border-slate-200 space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal Produtos:</span>
                        <span className="text-slate-800 font-bold">{formatarMoeda(totalCalculadoForm)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 border-b border-dashed border-slate-200 pb-2">
                        <span>Comissão ({comissaoPercentual}%):</span>
                        <span className="text-emerald-700 font-bold">{formatarMoeda(valorComissaoForm)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span className="font-bold">Total Faturado:</span>
                        <span className="text-slate-900 font-extrabold text-sm">{formatarMoeda(totalCalculadoForm)}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <div className="text-left font-mono">
                  <span className="text-[9px] text-slate-400 block uppercase">Resumo Financeiro</span>
                  <span className="text-xs text-slate-600 font-bold">Total: <strong className="text-emerald-700 text-sm">{formatarMoeda(totalCalculadoForm)}</strong></span>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Fechar / Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const formElem = document.getElementById('ped-form-elem') as HTMLFormElement;
                      if (formElem) formElem.requestSubmit();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    {editingId ? 'Salvar Alterações' : 'Emitir Pedido'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Caixa de Busca, Filtros e Listagem */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="font-serif font-bold text-base text-slate-700">Relatório Geral de Vendas ({pedidosFiltrados.length})</h4>
          
          <div className="flex items-center gap-2">
            {/* Botão de Exportar Relatório PDF Mensal */}
            <button
              onClick={() => {
                const currentAnoMes = new Date().toISOString().slice(0, 7);
                gerarResumoMensalPDF(pedidos, clientes, representadas, currentAnoMes, empresaRepresentacao);
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Exportar Resumo de Pedidos do Mês em PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Resumo do Mês (PDF)</span>
            </button>

            {/* Toggle de Filtros */}
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
                {/* Filtro de Status */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Filtrar por Status</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold cursor-pointer focus:outline-none focus:border-emerald-600 focus:bg-white"
                  >
                    <option value="Todos">Todos os Status</option>
                    <option value="Rascunho">Rascunho</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Faturado">Faturado</option>
                    <option value="Pago">Comissão Recebida</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>

                {/* Caixa de Busca */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pesquisar Pedido / Cliente</label>
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Buscar por Nº, cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {pedidosFiltrados.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-xs text-slate-400 italic">
            Nenhum pedido de venda encontrado para os filtros ativos.
          </div>
        ) : (
          <div className="space-y-3">
            {pedidosFiltrados.map(p => {
              const cli = clientes.find(c => c.id === p.clienteId);
              const rep = representadas.find(r => r.id === p.representadaId);

              const badgeColor = 
                p.status === 'Pago' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                p.status === 'Faturado' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                p.status === 'Pendente' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                p.status === 'Rascunho' ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-red-700 bg-red-50 border-red-200';

              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3 hover:shadow-md transition-all relative">
                  
                  {/* Linha de Cabeçalho */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-slate-400">PEDIDO</span>
                      <h5 className="font-mono font-extrabold text-base text-slate-800">#{p.numeroPedido}</h5>
                      <span className="text-slate-300">|</span>
                      <span className="font-mono text-[11px] text-slate-500">{formatarData(p.dataPedido)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeColor}`}>
                        {p.status}
                      </span>
                      
                      <div className="flex items-center gap-1 ml-2">
                        <button 
                          onClick={() => {
                            const cli = clientes.find(c => c.id === p.clienteId);
                            const rep = representadas.find(r => r.id === p.representadaId);
                            gerarPedidoPDF(p, cli, rep, empresaRepresentacao);
                          }}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          title="Imprimir Pedido (PDF)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleOpenEmailModal(p)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          title="Enviar por E-mail"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleSendWhatsApp(p)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          title="Enviar via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                        <button 
                          onClick={() => handleLoadForEdit(p)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Excluir permanentemente o pedido #${p.numeroPedido}?`)) {
                              onDelete(p.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Informações de Vendas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Cliente (Comprador)</span>
                      <strong className="text-slate-800 text-[13px] font-serif block mt-0.5">{cli ? cli.nomeFantasia : 'Não Encontrado'}</strong>
                      <span className="text-slate-400 block mt-0.5 text-[10px]">{cli ? cli.razaoSocial : ''}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Representada (Fábrica)</span>
                      <strong className="text-slate-800 text-[13px] font-serif block mt-0.5">{rep ? rep.nomeFantasia : 'Não Encontrado'}</strong>
                      <span className="text-slate-400 block mt-0.5 text-[10px]">{rep ? rep.razaoSocial : ''}</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                      <div className="font-mono text-[10px]">
                        <span className="text-slate-400 block uppercase tracking-wider">Valor do Pedido</span>
                        <strong className="text-slate-800 text-xs font-bold">{formatarMoeda(p.valorTotal)}</strong>
                      </div>
                      <div className="text-right font-mono text-[10px]">
                        <span className="text-slate-400 block uppercase tracking-wider">Sua Comissão ({p.comissaoPercentual}%)</span>
                        <strong className="text-emerald-700 text-xs font-extrabold">{formatarMoeda(p.valorComissao)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Produtos Acoplada do Pedido */}
                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1.5">Itens do Pedido ({p.itens.length})</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {p.itens.map(it => (
                        <div key={it.id} className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex justify-between items-center text-[11px]">
                          <div className="flex flex-col min-w-0">
                            <span className="font-serif text-slate-700 font-bold overflow-hidden text-ellipsis whitespace-nowrap">{it.descricao}</span>
                            {(it.cor || it.variacao) && (
                              <div className="flex gap-1 mt-0.5 text-[9px] font-mono text-slate-500">
                                {it.cor && <span>Cor: {it.cor}</span>}
                                {it.variacao && <span>Var: {it.variacao}</span>}
                              </div>
                            )}
                          </div>
                          <span className="font-mono text-slate-500 font-bold shrink-0 text-right">{it.quantidade}x {formatarMoeda(it.precoUnitario)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Observações Adicionadas */}
                  {p.observacoes && (
                    <div className="pt-2 text-[11px] text-slate-500 italic border-t border-dashed border-slate-100">
                      Observações: {p.observacoes}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal para envio de Pedido via E-mail */}
      <AnimatePresence>
        {emailPedido && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800">
                  <Mail className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-serif font-bold text-sm text-slate-800">
                    Enviar Pedido #{emailPedido.numeroPedido} por E-mail
                  </h3>
                </div>
                <button
                  onClick={() => setEmailPedido(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                  disabled={isSendingEmail}
                >
                  &times;
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSendEmail} className="p-5 space-y-4">
                {emailSuccess ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                      <Check className="w-6 h-6" />
                    </div>
                    <h4 className="font-serif font-bold text-slate-800 text-sm">E-mail Enviado com Sucesso!</h4>
                    <p className="text-[11px] text-slate-400">O pedido foi processado e enviado para <strong>{emailRecipient}</strong>.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 text-xs">
                      <label className="block text-slate-500 font-mono uppercase text-[9px]">E-mail do Destinatário <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        required
                        placeholder="cliente@email.com"
                        value={emailRecipient}
                        onChange={(e) => setEmailRecipient(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                        disabled={isSendingEmail}
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="block text-slate-500 font-mono uppercase text-[9px]">Assunto do E-mail</label>
                      <input
                        type="text"
                        required
                        placeholder="Assunto"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                        disabled={isSendingEmail}
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="block text-slate-500 font-mono uppercase text-[9px]">Mensagem</label>
                      <textarea
                        rows={5}
                        required
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 leading-relaxed resize-none"
                        disabled={isSendingEmail}
                      />
                    </div>

                    <div className="bg-emerald-50/50 border border-dashed border-emerald-200 p-3 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        <div className="text-left">
                          <p className="text-[11px] font-mono font-bold text-slate-700">Pedido_{emailPedido.numeroPedido}.pdf</p>
                          <p className="text-[9px] text-slate-400">Documento PDF gerado automaticamente</p>
                        </div>
                      </div>
                      <span className="text-[9px] uppercase font-mono font-bold text-emerald-600 bg-white border border-emerald-100 px-1.5 py-0.5 rounded">
                        Anexo
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="pt-2 border-t border-slate-100 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEmailPedido(null)}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
                        disabled={isSendingEmail}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                        disabled={isSendingEmail}
                      >
                        {isSendingEmail ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar por E-mail</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
