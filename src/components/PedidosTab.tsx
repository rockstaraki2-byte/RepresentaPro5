import React, { useState, useEffect, useMemo } from 'react';
import { Pedido, Cliente, Representada, OrderItem, PedidoStatus, Produto } from '../types';
import { formatarMoeda, formatarData, calcularParcelas } from '../utils';
import { Plus, Trash2, Edit3, Eye, FileText, Check, Percent, AlertCircle, ShoppingCart, Mail, Send, Printer, Loader2, Download, MessageCircle, ChevronDown, SlidersHorizontal, ChevronUp, Sparkles, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { gerarPedidoPDF, gerarResumoMensalPDF, gerarResumoPeriodoPDF } from '../lib/pdfGenerator';
import CatalogViewerModal from './CatalogViewerModal';
import { getPdfFromIndexedDB } from '../lib/pdfStorage';

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
  const [activeCatalogViewer, setActiveCatalogViewer] = useState<{ url: string; title: string; filename?: string } | null>(null);

  const handleOpenCatalog = async (rep: Representada) => {
    let url = rep.catalogoUrl;
    if (!url || url.startsWith('indexeddb:')) {
      const stored = await getPdfFromIndexedDB(rep.id);
      if (stored) url = stored;
    }
    if (url) {
      setActiveCatalogViewer({
        url,
        title: rep.nomeFantasia,
        filename: rep.catalogoNome || 'Catálogo.pdf'
      });
    } else {
      alert('Catálogo PDF não encontrado para esta fábrica.');
    }
  };
  
  // Collapsible Filters
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [printPedido, setPrintPedido] = useState<Pedido | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [filterDataDe, setFilterDataDe] = useState<string>('');
  const [filterDataAte, setFilterDataAte] = useState<string>('');
  const [filterRepresentadaId, setFilterRepresentadaId] = useState<string>('Todos');

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
  const [itemQuantidade, setItemQuantidade] = useState<number | ''>('');
  const [itemPreco, setItemPreco] = useState<number>(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Recommendations logic based on client + represented purchase history
  const recomendacoes = useMemo(() => {
    if (!clienteId || !representadaId) return [];

    // Filter past orders for this customer and represented supplier
    const pedidosPassados = pedidos.filter(
      p => p.clienteId === clienteId && p.representadaId === representadaId && p.status !== 'Cancelado'
    );

    // Aggregate items bought to find popular ones
    const itemAgregado: { 
      [key: string]: { 
        count: number; 
        totalQty: number; 
        precoUnitario: number; 
        cor?: string; 
        variacao?: string; 
        produtoId?: string; 
        descricao: string;
      } 
    } = {};

    pedidosPassados.forEach(p => {
      p.itens.forEach(it => {
        const key = `${it.descricao.toLowerCase()}::${(it.cor || '').toLowerCase()}::${(it.variacao || '').toLowerCase()}`;
        if (!itemAgregado[key]) {
          // Find matching product in products list by description
          const matchingProd = produtos.find(
            prod => prod.nome.toLowerCase() === it.descricao.toLowerCase() && prod.representadaId === representadaId
          );
          itemAgregado[key] = {
            count: 0,
            totalQty: 0,
            precoUnitario: it.precoUnitario,
            cor: it.cor,
            variacao: it.variacao,
            produtoId: matchingProd?.id,
            descricao: it.descricao
          };
        }
        itemAgregado[key].count += 1;
        itemAgregado[key].totalQty += it.quantidade;
      });
    });

    return Object.values(itemAgregado)
      .sort((a, b) => b.count - a.count || b.totalQty - a.totalQty)
      .slice(0, 4); // Keep top 4 recommendations
  }, [clienteId, representadaId, pedidos, produtos]);

  // Find selected client inactivity info for order form warning
  const selectedClienteInfo = useMemo(() => {
    if (!clienteId) return null;
    const cli = clientes.find(c => c.id === clienteId);
    if (!cli) return null;

    const clientPedidos = pedidos.filter(p => p.clienteId === cli.id && p.status !== 'Cancelado');
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

    return {
      isOverdue,
      daysSinceLast,
      mediaDiasEntreCompras,
      totalPedidos: clientPedidos.length
    };
  }, [clienteId, pedidos, clientes]);

  const [validationError, setValidationError] = useState<string | null>(null);

  // Modal and Email states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [emailPedido, setEmailPedido] = useState<Pedido | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [recipientType, setRecipientType] = useState<'cliente' | 'fornecedor' | 'ambos'>('cliente');

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
    const qty = typeof itemQuantidade === 'number' ? itemQuantidade : parseInt(itemQuantidade) || 0;
    if (qty <= 0) {
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
        quantidade: qty,
        precoUnitario: itemPreco,
        totalItem: qty * itemPreco
      } : it));
    } else {
      const novoItem: OrderItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(5)}`,
        descricao: itemDescricao.trim(),
        cor: itemCor.trim() || undefined,
        variacao: itemVariacao.trim() || undefined,
        quantidade: qty,
        precoUnitario: itemPreco,
        totalItem: qty * itemPreco
      };
      setItens([...itens, novoItem]);
    }

    setSelectedProdutoId('');
    setItemDescricao('');
    setItemCor('');
    setItemVariacao('');
    setItemQuantidade('');
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
    setItemQuantidade('');
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
    setRecipientType('cliente');
    setEmailRecipient(cli?.email || '');
    setEmailSubject(`Pedido de Venda #${p.numeroPedido} - ${rep?.nomeFantasia || 'Representada'}`);
    setEmailBody(`Prezado(a) ${cli?.contato || 'Cliente'},\n\nSegue em anexo a cópia digital do Pedido de Venda #${p.numeroPedido}.\n\n*Itens do Pedido:*\n${itemsList}\n\nResumo Financeiro:\nValor Total: ${formatarMoeda(p.valorTotal)}\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nRepresentação Comercial`);
    setEmailSuccess(false);
  };

  const handleRecipientTypeChange = (type: 'cliente' | 'fornecedor' | 'ambos') => {
    setRecipientType(type);
    if (!emailPedido) return;
    const cli = clientes.find(c => c.id === emailPedido.clienteId);
    const rep = representadas.find(r => r.id === emailPedido.representadaId);
    
    let email = '';
    if (type === 'cliente') {
      email = cli?.email || '';
    } else if (type === 'fornecedor') {
      email = rep?.email || '';
    } else if (type === 'ambos') {
      const emails = [cli?.email, rep?.email].filter(Boolean);
      email = emails.join(', ');
    }
    setEmailRecipient(email);

    const itemsList = emailPedido.itens.map(it => {
      let desc = `- ${it.descricao}: ${it.quantidade}x ${formatarMoeda(it.precoUnitario)}`;
      if (it.cor) desc += ` | Cor: ${it.cor}`;
      if (it.variacao) desc += ` | Var: ${it.variacao}`;
      return desc;
    }).join('\n');

    let greeting = 'Prezado(a) Cliente';
    if (type === 'fornecedor') {
      greeting = `Prezado(a) ${rep?.contato || 'Fornecedor'}`;
    } else if (type === 'ambos') {
      greeting = `Prezados,`;
    } else {
      greeting = `Prezado(a) ${cli?.contato || 'Cliente'}`;
    }

    setEmailBody(`${greeting},\n\nSegue em anexo a cópia digital do Pedido de Venda #${emailPedido.numeroPedido}.\n\n*Itens do Pedido:*\n${itemsList}\n\nResumo Financeiro:\nValor Total: ${formatarMoeda(emailPedido.valorTotal)}\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nRepresentação Comercial`);
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
      const blob = doc.output('blob');
      
      const blobToBase64 = (b: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
      };
      
      const dataUri = await blobToBase64(blob);
      const parts = dataUri.split(',');
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
          gmailUser: empresaRepresentacao?.gmailUser || '',
          gmailAppPass: empresaRepresentacao?.gmailAppPass || '',
          fromName: empresaRepresentacao?.nomeFantasia || 'RepresentaPRO',
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

  const handleExportCSV = () => {
    const headers = [
      'Numero Pedido',
      'Data de Emissao',
      'Cliente',
      'Representada',
      'Status',
      'Valor Total (R$)',
      'Comissao (%)',
      'Valor Comissao (R$)',
      'Itens do Pedido'
    ];

    const rows = pedidosFiltrados.map(p => {
      const cli = clientes.find(c => c.id === p.clienteId);
      const rep = representadas.find(r => r.id === p.representadaId);
      const itemsList = p.itens.map(it => `${it.descricao} (Qtd: ${it.quantidade})`).join(' | ');

      return [
        p.numeroPedido,
        formatarData(p.dataPedido),
        cli ? cli.nomeFantasia : 'N/A',
        rep ? rep.nomeFantasia : 'N/A',
        p.status,
        p.valorTotal.toFixed(2),
        p.comissaoPercentual.toFixed(2),
        p.valorComissao.toFixed(2),
        itemsList
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Resumo_Exportacao_${filterDataDe || 'inicio'}_a_${filterDataAte || 'fim'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    
    const matchesDataDe = !filterDataDe || p.dataPedido >= filterDataDe;
    const matchesDataAte = !filterDataAte || p.dataPedido <= filterDataAte;
    const matchesRepresentada = filterRepresentadaId === 'Todos' || p.representadaId === filterRepresentadaId;

    return matchesSearch && matchesStatus && matchesDataDe && matchesDataAte && matchesRepresentada;
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
                        {selectedClienteInfo?.isOverdue && (
                          <div className="mt-1.5 bg-red-50 text-red-700 border border-red-100 rounded-lg p-2 flex items-start gap-1.5 font-mono text-[10px] font-bold">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="block text-red-850">ALERTA DE INATIVIDADE</span>
                              <span className="block font-normal mt-0.5 text-red-600">
                                Este cliente está há <strong className="text-red-750">{selectedClienteInfo.daysSinceLast} dias</strong> sem comprar (a média dele é de {selectedClienteInfo.mediaDiasEntreCompras} dias).
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Representada */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-mono uppercase text-slate-500">Representada (Fábrica) <span className="text-red-500">*</span></label>
                          {(() => {
                            const rep = representadas.find(r => r.id === representadaId);
                            if (rep?.catalogoUrl || rep?.catalogoNome) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCatalog(rep)}
                                  className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3 h-3 text-emerald-700" />
                                  <span>Ver Catálogo PDF</span>
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <SearchableSelect
                          options={representadas.map(r => ({
                            id: r.id,
                            label: r.nomeFantasia,
                            sublabel: `CNPJ: ${r.cnpj} | ${r.comissaoPadrao}% comissão padrão`
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
                      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                        <h4 className="font-serif font-bold text-sm text-slate-800 flex items-center gap-1.5">
                          <ShoppingCart className="w-4 h-4 text-emerald-600" />
                          <span>Inserir Item / Produto</span>
                        </h4>
                        {(() => {
                          const rep = representadas.find(r => r.id === representadaId);
                          if (rep?.catalogoUrl || rep?.catalogoNome) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleOpenCatalog(rep)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                title="Consultar Catálogo PDF da Fábrica"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Abrir Catálogo PDF</span>
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      
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

                        {/* Interactive Purchase History Recommendations */}
                        {recomendacoes.length > 0 && (
                          <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100/50 space-y-1.5">
                            <span className="block text-[9px] font-mono uppercase text-emerald-800 font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-600 animate-pulse" />
                              Produtos sugeridos do histórico
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {recomendacoes.map((rec, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    if (rec.produtoId) {
                                      setSelectedProdutoId(rec.produtoId);
                                    } else {
                                      const foundProd = produtos.find(
                                        p => p.nome.toLowerCase() === rec.descricao.toLowerCase() && p.representadaId === representadaId
                                      );
                                      if (foundProd) {
                                        setSelectedProdutoId(foundProd.id);
                                      } else {
                                        setSelectedProdutoId('');
                                      }
                                    }
                                    setItemDescricao(rec.descricao);
                                    setItemPreco(rec.precoUnitario);
                                    setItemCor(rec.cor || '');
                                    setItemVariacao(rec.variacao || '');
                                    setItemQuantidade(''); // Leave quantity free for typing as requested!
                                  }}
                                  className="bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded px-2 py-1 text-[10px] transition-all text-left flex flex-col gap-0.5 shadow-2xs shrink-0 max-w-full truncate cursor-pointer"
                                  title={`Frequência: ${rec.count} compras | Qtd total: ${rec.totalQty}`}
                                >
                                  <span className="font-semibold block truncate max-w-[180px]">{rec.descricao}</span>
                                  <span className="text-[9px] text-slate-400 font-mono block">
                                    {rec.cor ? `Cor: ${rec.cor}` : ''} {rec.variacao ? `| Var: ${rec.variacao}` : ''} | {formatarMoeda(rec.precoUnitario)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

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
                              value={itemQuantidade}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemQuantidade(val === '' ? '' : isNaN(parseInt(val)) ? '' : parseInt(val));
                              }}
                              placeholder="Digite a qtd"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 text-slate-850 font-mono font-bold text-slate-900"
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
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm mb-2">
                
                {/* Grid de Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
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
                    <input
                      type="text"
                      placeholder="Buscar por Nº, cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                    />
                  </div>

                  {/* Filtro de Representada */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Representada</label>
                    <select 
                      value={filterRepresentadaId}
                      onChange={(e) => setFilterRepresentadaId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold cursor-pointer focus:outline-none focus:border-emerald-600 focus:bg-white"
                    >
                      <option value="Todos">Todas as Fábricas</option>
                      {representadas.map(rep => (
                        <option key={rep.id} value={rep.id}>{rep.nomeFantasia}</option>
                      ))}
                    </select>
                  </div>

                  {/* Período De */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Período De</label>
                    <input 
                      type="date"
                      value={filterDataDe}
                      onChange={(e) => setFilterDataDe(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono"
                    />
                  </div>

                  {/* Período Até */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Período Até</label>
                    <input 
                      type="date"
                      value={filterDataAte}
                      onChange={(e) => setFilterDataAte(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* Central de Exportação e Relatórios */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-extrabold text-slate-750 uppercase tracking-wide block">Central de Exportação de Relatórios por Período</span>
                    <p className="text-[10px] text-slate-400">
                      Gere relatórios customizados no formato desejado com base nos filtros e período selecionados acima.
                    </p>
                    {pedidosFiltrados.length > 0 && (
                      <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mt-1">
                        {pedidosFiltrados.length} pedido(s) filtrado(s) pronto(s) para exportação
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {/* Botão de Limpar Filtros */}
                    {(statusFilter !== 'Todos' || searchQuery !== '' || filterRepresentadaId !== 'Todos' || filterDataDe !== '' || filterDataAte !== '') && (
                      <button
                        onClick={() => {
                          setStatusFilter('Todos');
                          setSearchQuery('');
                          setFilterRepresentadaId('Todos');
                          setFilterDataDe('');
                          setFilterDataAte('');
                        }}
                        className="bg-white hover:bg-slate-150 border border-slate-200 text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Limpar todos os filtros ativos"
                      >
                        Limpar Filtros
                      </button>
                    )}

                    {/* Botão Exportar CSV */}
                    <button
                      onClick={handleExportCSV}
                      disabled={pedidosFiltrados.length === 0}
                      className="bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      title="Exportar planilha CSV com dados filtrados"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Exportar Planilha (CSV)</span>
                    </button>

                    {/* Botão Exportar PDF */}
                    <button
                      onClick={() => {
                        gerarResumoPeriodoPDF(pedidosFiltrados, clientes, representadas, filterDataDe, filterDataAte, empresaRepresentacao);
                      }}
                      disabled={pedidosFiltrados.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shadow-emerald-100"
                      title="Gerar PDF detalhado com dados filtrados"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Exportar Resumo (PDF)</span>
                    </button>
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
                          onClick={() => setPrintPedido(p)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          title="Visualização para Impressão (Print View)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            const cli = clientes.find(c => c.id === p.clienteId);
                            const rep = representadas.find(r => r.id === p.representadaId);
                            gerarPedidoPDF(p, cli, rep, empresaRepresentacao);
                          }}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          title="Baixar Pedido (PDF)"
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
                    <div className="space-y-1.5 text-xs">
                      <label className="block text-slate-500 font-mono uppercase text-[9px]">Enviar Para</label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleRecipientTypeChange('cliente')}
                          className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                            recipientType === 'cliente'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                          disabled={isSendingEmail}
                        >
                          Cliente
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecipientTypeChange('fornecedor')}
                          className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                            recipientType === 'fornecedor'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                          disabled={isSendingEmail}
                        >
                          Fornecedor
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecipientTypeChange('ambos')}
                          className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                            recipientType === 'ambos'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                          disabled={isSendingEmail}
                        >
                          Ambos
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="block text-slate-500 font-mono uppercase text-[9px]">E-mail do Destinatário <span className="text-red-500">*</span></label>
                      <input
                        type="text"
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

                    <div className="bg-amber-50 border border-amber-150 p-3 rounded-xl text-[11px] text-amber-800 leading-relaxed space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        Aviso de Configuração de E-mail:
                      </p>
                      <p>
                        Para habilitar o envio automático em segundo plano, configure as chaves <strong className="font-mono">GMAIL_USER</strong> (seu e-mail Gmail) e <strong className="font-mono">GMAIL_APP_PASS</strong> (sua Senha de App do Google) na aba de <strong>Configurações (Secrets)</strong> do AI Studio. Caso contrário, o sistema abrirá o seu aplicativo local de e-mail como fallback seguro.
                      </p>
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

      {/* Modal de Visualização para Impressão */}
      <AnimatePresence>
        {printPedido && (() => {
          const cli = clientes.find(c => c.id === printPedido.clienteId);
          const rep = representadas.find(r => r.id === printPedido.representadaId);
          const logoToUse = rep?.logoUrl || empresaRepresentacao?.logoUrl;
          
          return (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
              <style>{`
                @media print {
                  body {
                    background: white !important;
                    color: black !important;
                  }
                  #root > :not(.print-wrapper) {
                    display: none !important;
                  }
                  .print-wrapper {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0;
                    margin: 0;
                    background: white !important;
                    box-shadow: none !important;
                    border: none !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}</style>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[90vh] print-wrapper print:shadow-none print:border-none print:max-h-none print:w-full"
              >
                {/* Control Header Bar */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 no-print">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Printer className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-serif font-bold text-base text-slate-800">
                      Visualização para Impressão - Pedido #{printPedido.numeroPedido}
                    </h3>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-100"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir Documento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintPedido(null)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {/* Printable content container */}
                <div className="p-8 overflow-y-auto space-y-6 print:p-0 bg-white print:overflow-visible" id="print-section">
                  
                  {/* Header Banner */}
                  <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {logoToUse ? (
                        <img 
                          src={logoToUse} 
                          alt="Logo" 
                          referrerPolicy="no-referrer"
                          className="max-h-16 max-w-[150px] object-contain rounded-lg border border-slate-100 p-1" 
                        />
                      ) : (
                        <div className="w-16 h-16 bg-slate-900 text-white font-serif font-extrabold text-2xl flex items-center justify-center rounded-xl">
                          RP
                        </div>
                      )}
                      <div>
                        <h2 className="font-serif font-extrabold text-lg text-slate-900 leading-tight">
                          {empresaRepresentacao?.nomeFantasia || 'REPRESENTAÇÃO COMERCIAL'}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                          {empresaRepresentacao?.razaoSocial || 'Sistema Integrado de Vendas'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {empresaRepresentacao?.cnpj ? `CNPJ: ${empresaRepresentacao.cnpj}` : 'Cópia Informativa de Pedido'}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right text-[11px] text-slate-500 space-y-0.5 font-mono">
                      {empresaRepresentacao?.endereco && <p>{empresaRepresentacao.endereco}</p>}
                      {empresaRepresentacao?.telefone && <p>Telefone: {empresaRepresentacao.telefone}</p>}
                      {empresaRepresentacao?.email && <p>E-mail: {empresaRepresentacao.email}</p>}
                    </div>
                  </div>

                  {/* Title and ID banner */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 print:bg-white print:border-slate-300">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Documento de Venda</span>
                      <h3 className="font-mono font-extrabold text-base text-slate-900">
                        PEDIDO DE VENDA: #{printPedido.numeroPedido}
                      </h3>
                    </div>
                    <div className="text-left sm:text-right font-mono text-xs">
                      <p className="text-slate-500">Emissão: <strong className="text-slate-800">{formatarData(printPedido.dataPedido)}</strong></p>
                      <p className="text-slate-500 mt-0.5">Status: <span className="font-bold text-emerald-700">{printPedido.status.toUpperCase()}</span></p>
                    </div>
                  </div>

                  {/* Two columns: Representada and Cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Representada Column */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2 print:border-slate-300">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 block border-b border-slate-100 pb-1">
                        REPRESENTADA / FÁBRICA
                      </span>
                      <div className="space-y-1 text-xs">
                        <p className="text-slate-800"><span className="text-slate-400 font-mono text-[11px]">Nome:</span> <strong>{rep?.nomeFantasia || 'N/A'}</strong></p>
                        <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">Razão:</span> {rep?.razaoSocial || 'N/A'}</p>
                        <p className="text-slate-600 font-mono text-[11px]"><span className="text-slate-400">CNPJ:</span> {rep?.cnpj || 'N/A'}</p>
                        <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">Contato:</span> {rep?.contato || 'N/A'}</p>
                        {rep?.telefone && <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">Telefone:</span> {rep.telefone}</p>}
                        {rep?.email && <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">E-mail:</span> {rep.email}</p>}
                      </div>
                    </div>

                    {/* Cliente Column */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2 print:border-slate-300">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 block border-b border-slate-100 pb-1">
                        CLIENTE / COMPRADOR
                      </span>
                      <div className="space-y-1 text-xs">
                        <p className="text-slate-800"><span className="text-slate-400 font-mono text-[11px]">Nome:</span> <strong>{cli?.nomeFantasia || 'N/A'}</strong></p>
                        <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">Razão:</span> {cli?.razaoSocial || 'N/A'}</p>
                        <p className="text-slate-600 font-mono text-[11px]"><span className="text-slate-400">CNPJ:</span> {cli?.cnpj || 'N/A'}</p>
                        <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">Local:</span> {cli?.endereco || ''}, {cli?.cidade || 'N/A'}-{cli?.uf || ''}</p>
                        {cli?.telefone && <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">Telefone:</span> {cli.telefone}</p>}
                        {cli?.email && <p className="text-slate-600"><span className="text-slate-400 font-mono text-[11px]">E-mail:</span> {cli.email}</p>}
                      </div>
                    </div>

                  </div>

                  {/* Items List Table */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                      Itens / Produtos Faturados
                    </span>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white font-mono text-[10px] uppercase">
                            <th className="py-2.5 px-4 font-bold">Produto / Descrição</th>
                            <th className="py-2.5 px-4 font-bold">Cor / Var</th>
                            <th className="py-2.5 px-4 font-bold text-center">Quant.</th>
                            <th className="py-2.5 px-4 font-bold text-right">Preço Unit.</th>
                            <th className="py-2.5 px-4 font-bold text-right">Total Item</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {printPedido.itens.map((it, idx) => (
                            <tr key={it.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                              <td className="py-3 px-4 font-serif font-bold text-slate-800">{it.descricao}</td>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                                {[it.cor ? `Cor: ${it.cor}` : '', it.variacao ? `Var: ${it.variacao}` : ''].filter(Boolean).join(' | ') || '-'}
                              </td>
                              <td className="py-3 px-4 text-slate-700 font-mono text-center font-bold">{it.quantidade}</td>
                              <td className="py-3 px-4 text-slate-600 font-mono text-right">{formatarMoeda(it.precoUnitario)}</td>
                              <td className="py-3 px-4 text-slate-800 font-mono text-right font-bold">{formatarMoeda(it.totalItem)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Payment Terms and Observations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-xs space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Condições de Pagamento</span>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 italic text-slate-600 font-serif leading-relaxed">
                        {printPedido.condicoesPagamento || 'Não informadas.'}
                        
                        {printPedido.condicoesPagamento && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {calcularParcelas(printPedido.valorTotal, printPedido.dataPedido, printPedido.condicoesPagamento).map((p) => (
                              <div key={p.numero} className="bg-white border border-slate-200 rounded-md p-2 shadow-sm text-center min-w-[70px]">
                                <div className="text-[9px] font-bold text-slate-500 uppercase flex justify-center items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatarData(p.dataVencimento)}
                                </div>
                                <div className="font-extrabold text-emerald-700 mt-0.5 text-xs">
                                  {formatarMoeda(p.valor)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Observações de Faturamento</span>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 italic text-slate-600 font-serif leading-relaxed">
                        {printPedido.observacoes || 'Nenhuma observação informada.'}
                      </div>
                    </div>
                  </div>

                  {/* Financial Total Summary Panel */}
                  <div className="border-t border-slate-200 pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="text-xs text-slate-500 font-mono">
                      <p>Vendedor: <strong className="text-slate-800">{currentUser?.nome || 'Raul Soares (Representante)'}</strong></p>
                      <p>E-mail: {currentUser?.email || 'raulsoares@representaprosistema.com'}</p>
                    </div>

                    <div className="bg-slate-900 text-white rounded-xl p-4 min-w-[280px] space-y-1.5 font-mono text-xs ml-auto">
                      <div className="flex justify-between text-slate-400 border-b border-dashed border-slate-700 pb-1.5">
                        <span>VALOR TOTAL PRODUTOS:</span>
                        <span className="font-bold text-white">{formatarMoeda(printPedido.valorTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-0.5">
                        <span className="font-bold">TOTAL FATURADO:</span>
                        <span className="font-extrabold text-white text-base">{formatarMoeda(printPedido.valorTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Copyright Footer */}
                  <div className="border-t border-dashed border-slate-200 pt-5 text-center text-[10px] text-slate-400 italic space-y-1">
                    <p>Este documento é uma cópia digital informativa emitida via RepresentaPRO para faturamento comercial.</p>
                    <p className="font-bold">© {new Date().getFullYear()} Desenvolvido por Raul Soares | WhatsApp: (32) 99909-8468</p>
                  </div>

                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal Visualizador do Catálogo PDF da Fábrica */}
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
