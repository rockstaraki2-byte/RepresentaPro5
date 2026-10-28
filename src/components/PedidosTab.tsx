Warning: truncated output (original token count: 38654)
Total output lines: 2879

import React, { useState, useEffect, useMemo } from 'react';
import { Pedido, Cliente, Representada, OrderItem, PedidoStatus, Produto } from '../types';
import { formatarMoeda, formatarData, calcularParcelas, formatarTipoFaturamento, formatUserNameClean } from '../utils';
import { Plus, Trash2, Edit3, Eye, FileText, Check, Percent, AlertCircle, ShoppingCart, Mail, Send, Printer, Loader2, Download, MessageCircle, ChevronDown, SlidersHorizontal, ChevronUp, Sparkles, Calendar, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CatalogViewerModal from './CatalogViewerModal';
import { getPdfFromIndexedDB } from '../lib/pdfStorage';
import { auth } from '../firebase';
import type { OrderTextDraft } from '../orderTextDraft';

const normalizeSearchText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

interface SearchableSelectProps {
  options: { id: string; label: string; sublabel?: string; obs?: string; searchKeys?: string[] }[];
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

  const filtered = options.filter(o => {
    const s = normalizeSearchText(search);
    const matchesLabel = normalizeSearchText(o.label).includes(s);
    const matchesSublabel = o.sublabel ? normalizeSearchText(o.sublabel).includes(s) : false;
    const matchesObs = o.obs ? normalizeSearchText(o.obs).includes(s) : false;
    const matchesKeys = o.searchKeys ? o.searchKeys.some(k => normalizeSearchText(k).includes(s)) : false;
    return matchesLabel || matchesSublabel || matchesObs || matchesKeys;
  });

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
                  {opt.obs && <div className="text-[10px] text-emerald-600 font-medium font-mono mt-0.5">💡 {opt.obs}</div>}
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
  onEdit: (pedido: Pedido) => void | Promise<void>;
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
  const [isOrderTextDraftOpen, setIsOrderTextDraftOpen] = useState(false);
  const [orderText, setOrderText] = useState('');
  const [parsedOrderTextDraft, setParsedOrderTextDraft] = useState<OrderTextDraft | null>(null);
  const [isParsingOrderText, setIsParsingOrderText] = useState(false);
  const [orderTextDraftError, setOrderTextDraftError] = useState('');

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

  // Billing & Freight form states
  const [tipoFaturamento, setTipoFaturamento] = useState<string>('Nf 100%');
  const [percentualNfPauta, setPercentualNfPauta] = useState<number | ''>('');
  const [opcaoFrete, setOpcaoFrete] = useState<'percentual' | 'fixo' | 'manual' | 'nenhum'>('nenhum');
  const [tipoFrete, setTipoFrete] = useState<'FOB' | 'CIF' | 'Sem Frete'>('FOB');
  const [percentualFrete, setPercentualFrete] = useState<number | ''>('');
  const [valorFreteInput, setValorFreteInput] = useState<number | ''>('');
  const [freteSomarNoTotal, setFreteSomarNoTotal] = useState<boolean>(true);

  // Item form states
  const [selectedProdutoId, setSelectedProdutoId] = useState('');
  const [itemCodigo, setItemCodigo] = useState('');
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
  const [emailFallbackOpened, setEmailFallbackOpened] = useState(false);
  const [emailMarkWarning, setEmailMarkWarning] = useState('');
  const [recipientType, setRecipientType] = useState<'cliente' | 'fornecedor' | 'ambos'>('cliente');
  const [whatsappModalPedido, setWhatsappModalPedido] = useState<Pedido | null>(null);
  const [whatsappOpened, setWhatsappOpened] = useState(false);

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
    
    // Find highest sequence among ALL orders in the system across ALL clients
    let maxSeq = 0;
    pedidos.forEach(p => {
      if (!p.numeroPedido) return;
      // Match pattern like PED-CLIENTE-001 or PED-CLIENTE-0001-2026 or PED-001
      const match = p.numeroPedido.match(/PED-(?:.+?-)?(\d+)(?:-\d{4})?$/i);
      if (match) {
        const pSeq = parseInt(match[1], 10);
        if (!isNaN(pSeq) && pSeq > maxSeq && pSeq < 100000) {
          maxSeq = pSeq;
        }
      } else {
        // Fallback for custom or legacy order numbers
        const digits = p.numeroPedido.match(/(\d+)/g);
        if (digits) {
          digits.forEach(dStr => {
            const val = parseInt(dStr, 10);
            if (!isNaN(val) && val > maxSeq && val < 90000 && dStr !== year) {
              maxSeq = val;
            }
          });
        }
      }
    });
    
    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(3, '0');
    
    setNumeroPedido(`PED-${abr}-${seqStr}`);
  };

  // Automatically trigger code generation for new orders if client is selected and number is empty or formatted
  useEffect(() => {
    if (!editingId && clienteId && (numeroPedido === '' || numeroPedido.startsWith('PEDIDO-') || numeroPedido.startsWith('PED-'))) {
      handleAutoGenerateOrderNumber();
    }
  }, [clienteId, dataPedido, editingId]);

  // Auto sync default client billing option (Nota Fiscal vs Notinha) when customer is selected
  const handleClienteChange = (id: string) => {
    setClienteId(id);
    if (!editingId) {
      const cliSelected = clientes.find(c => c.id === id);
      if (cliSelected?.tipoFaturamento) {
        setTipoFaturamento(cliSelected.tipoFaturamento);
      } else {
        setTipoFaturamento('Nf 100%');
      }
    }
  };

  const handleParseOrderText = async () => {
    setOrderTextDraftError('');
    setParsedOrderTextDraft(null);
    if (!orderText.trim()) {
      setOrderTextDraftError('Cole o texto do pedido recebido por WhatsApp.');
      return;
    }
    if (orderText.trim().length > 8000) {
      setOrderTextDraftError('O texto deve ter até 8.000 caracteres.');
      return;
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setOrderTextDraftError('Sua sessão expirou. Entre novamente para continuar.');
      return;
    }

    setIsParsingOrderText(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/orders/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: orderText.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível interpretar o texto.');
      setParsedOrderTextDraft(result.draft as OrderTextDraft);
    } catch (error) {
      setOrderTextDraftError(error instanceof Error ? error.message : 'Falha ao gerar rascunho.');
    } finally {
      setIsParsingOrderText(false);
    }
  };

  const handleApplyOrderTextDraft = () => {
    if (!parsedOrderTextDraft) return;
    const clean = (value: string) => normalizeSearchText(value);
    const digits = (value: string) => value.replace(/\D/g, '');
    const requestedDocument = digits(parsedOrderTextDraft.clienteDocumento || '');
    const clientCandidates = clientes.filter((client) => {
      if (requestedDocument) {
        return digits(client.cnpj) === requestedDocument;
      }
      const requestedName = clean(parsedOrderTextDraft.cliente || '');
      return requestedName && [client.nomeFantasia, client.razaoSocial].some((name) => clean(name) === requestedName);
    });
    const representedCandidates = representadas.filter((represented) => {
      const requestedName = clean(parsedOrderTextDraft.representada || '');
      return requestedName && [represented.nomeFantasia, represented.razaoSocial].some((name) => clean(name) === requestedName);
    });
    const matchedClient = clientCandidates.length === 1 ? clientCandidates[0] : undefined;
    const matchedRepresented = representedCandidates.length === 1 ? representedCandidates[0] : undefined;
    const matchedProducts = parsedOrderTextDraft.itens.map((draftItem) => {
      if (!matchedRepresented) return undefined;
      const requestedCode = clean(draftItem.codigo || '');
      const requestedName = clean(draftItem.produto);
      const candidates = produtos.filter((product) => product.ativo
        && (!matchedRepresented || product.representadaId === matchedRepresented.id)
        && (requestedCode
          ? clean(product.codigo) === requestedCode
          : [product.nome, ...(product.apelidos || [])].some((name) => clean(name) === requestedName)));
      return candidates.length === 1 ? candidates[0] : undefined;
    });

    resetForm();
    setEditingId(null);
    setNumeroPedido(parsedOrderTextDraft.numeroPedido || '');
    setClienteId(matchedClient?.id || '');
    setRepresentadaId(matchedRepresented?.id || '');
    setDataPedido(parsedOrderTextDraft.dataPedido || new Date().toISOString().slice(0, 10));
    setCondicoesPagamento(parsedOrderTextDraft.condicoesPagamento || '');
    setObservacoes(parsedOrderTextDraft.observacoes || '');
    setTipoFaturamento(matchedClient?.tipoFaturamento || 'Nf 100%');
    setComissaoPercentual(matchedRepresented?.comissaoPadrao ?? 5);
    setStatus('Rascunho');
    setItens(parsedOrderTextDraft.itens.map((item, index) => {
      const product = matchedProducts[index];
      const price = item.precoUnitario ?? product?.precoVenda ?? 0;
      return {
        id: `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        produtoId: product?.id,
        codigo: item.codigo || product?.codigo || undefined,
        descricao: item.produto,
        cor: item.cor || product?.cor || undefined,
        variacao: item.variacao || product?.variacao || undefined,
        quantidade: item.quantidade,
        precoUnitario: price,
        totalItem: item.quantidade * price,
        fotoUrl: product?.fotoUrl,
      };
    }));
    setValidationError(null);
    setIsFormOpen(true);
    setIsOrderTextDraftOpen(false);
  };

  // Sync default commission % and default freight rule when represented company is selected (only when creating)
  const handleRepresentadaChange = (id: string) => {
    setRepresentadaId(id);
    if (!editingId) {
      const repSelected = representadas.find(r => r.id === id);
      if (repSelected) {
        setComissaoPercentual(repSelected.comissaoPadrao);
        if (repSelected.fretePadraoTipo) {
          setOpcaoFrete(repSelected.fretePadraoTipo);
          if (repSelected.fretePadraoTipo === 'percentual') {
            setPercentualFrete(repSelected.fretePadraoValor || '');
            setValorFreteInput('');
          } else if (repSelected.fretePadraoTipo === 'fixo' || repSelected.fretePadraoTipo === 'manual') {
            setValorFreteInput(repSelected.fretePadraoValor || '');
            setPercentualFrete('');
          } else {
            setPercentualFrete('');
            setValorFreteInput('');
          }
          if (repSelected.freteModalidadePadrao) {
            setTipoFrete(repSelected.freteModalidadePadrao);
          }
        }
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
        produtoId: selectedProdutoId || it.produtoId,
        codigo: itemCodigo.trim() || undefined,
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
        produtoId: selectedProdutoId || undefined,
        codigo: itemCodigo.trim() || undefined,
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
    setItemCodigo('');
    setItemDescricao('');
    setItemCor('');
    setItemVariacao('');
    setItemQuantidade('');
    setItemPreco(0);
    setEditingItemId(null);
  };

  const handleEditItemInit = (item: OrderItem) => {
    setEditingItemId(item.id);
    setSelectedProdutoId(item.produtoId || '');
    setItemCodigo(item.codigo || '');
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
    setItemCodigo('');
    setItemDescricao('');
    setItemCor('');
    setItemVariacao('');
    setItemQuantidade('');
    setItemPreco(0);
    setTipoFaturamento('Nf 100%');
    setPercentualNfPauta('');
    setOpcaoFrete('nenhum');
    setTipoFrete('FOB');
    setPercentualFrete('');
    setValorFreteInput('');
    setFreteSomarNoTotal(true);
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
    const cliOfOrder = clientes.find(c => c.id === p.clienteId);
    setTipoFaturamento(p.tipoFaturamento || cliOfOrder?.tipoFaturamento || 'Nf 100%');
    setPercentualNfPauta(p.percentualNfPauta !== undefined && p.percentualNfPauta !== null ? p.percentualNfPauta : '');
    setOpcaoFrete(p.opcaoFrete || 'nenhum');
    setTipoFrete(p.tipoFrete || 'FOB');
    setPercentualFrete(p.percentualFrete !== undefined ? p.percentualFrete : '');
    setValorFreteInput(p.valorFrete !== undefined ? p.valorFrete : '');
    setFreteSomarNoTotal(p.freteSomarNoTotal !== undefined ? p.freteSomarNoTotal : true);
    setValidationError(null);
    setIsFormOpen(true);
  };

  const buildOrderCopyItemsText = (items: OrderItem[]) => {
    return items.map(it => {
      let line = '- ';
      if (it.codigo) {
        line += `[${it.codigo}] `;
      }
      line += `${it.descricao}`;
      if (it.cor) {
        line += ` | Cor: ${it.cor}`;
      }
      if (it.variacao) {
        line += ` | Var: ${it.variacao}`;
      }
      line += `: ${it.quantidade}x ${formatarMoeda(it.precoUnitario)} = ${formatarMoeda(it.totalItem)}`;
      return line;
    }).join('\n');
  };

  const getOrderItemPhoto = (item: OrderItem) => {
    const productById = item.produtoId ? produtos.find(product => product.id === item.produtoId) : undefined;
    const normalizedCode = item.codigo ? normalizeSearchText(item.codigo) : '';
    const productByCode = normalizedCode
      ? produtos.find(product => normalizeSearchText(product.codigo) === normalizedCode)
      : undefined;
    const normalizedName = normalizeSearchText(item.descricao);
    const productByName = produtos.find(product => normalizeSearchText(product.nome) === normalizedName);
    return item.fotoUrl || productById?.fotoUrl || productByCode?.fotoUrl || productByName?.fotoUrl || '';
  };

  const getPedidoWithPhotos = (pedido: Pedido): Pedido => ({
    ...pedido,
    itens: pedido.itens.map(item => ({ ...item, fotoUrl: getOrderItemPhoto(item) || undefined }))
  });

  const markPedidoAsSent = async (pedido: Pedido, channel: 'E-mail' | 'WhatsApp') => {
    const currentPedido = pedidos.find(existing => existing.id === pedido.id) || pedido;
    await onEdit({
      ...currentPedido,
      foiEnviado: true,
      enviadoVia: channel,
      dataEnvio: new Date().toISOString()
    });
  };

  const getOrderFreightText = (p: Pedido) => {
    if (p.opcaoFrete && p.opcaoFrete !== 'nenhum') {
      const val = p.valorFrete ? formatarMoeda(p.valorFrete) : 'R$ 0,00';
      const mod = p.tipoFrete || 'FOB';
      return `${mod} (${val})`;
    }
    return 'Sem Frete / Retirada';
  };

  const handleOpenEmailModal = (p: Pedido) => {
    const cli = clientes.find(c => c.id === p.clienteId);
    const rep = representadas.find(r => r.id === p.representadaId);
    
    const itemsList = buildOrderCopyItemsText(p.itens);
    const fatType = p.tipoFaturamento || cli?.tipoFaturamento || 'Nota Fiscal';
    const freteTxt = getOrderFreightText(p);
    
    setEmailPedido(p);
    setRecipientType('cliente');
    setEmailRecipient(cli?.email || '');
    setEmailSubject(`Pedido de Venda #${p.numeroPedido} - ${rep?.nomeFantasia || 'Representada'}`);
    setEmailBody(`Prezado(a) ${cli?.contato || 'Cliente'},\n\nSegue a cópia digital do Pedido de Venda #${p.numeroPedido}.\n\nTipo de Faturamento: ${fatType === 'Notinha' ? 'Notinha (Sem NF)' : 'Nota Fiscal'}\nFrete: ${freteTxt}\nStatus: ${p.status}\n\n*Itens do Pedido:*\n${itemsList}\n\nResumo Financeiro:\nSubtotal Produtos: ${formatarMoeda(p.valorSubtotal || p.valorTotal)}\nValor Total: ${formatarMoeda(p.valorTotal)}\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nRepresentação Comercial`);
    setEmailSuccess(false);
    setEmailFallbackOpened(false);
    setEmailMarkWarning('');
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

    const itemsList = buildOrderCopyItemsText(emailPedido.itens);
    const fatType = emailPedido.tipoFaturamento || cli?.tipoFaturamento || 'Nota Fiscal';
    const freteTxt = getOrderFreightText(emailPedido);

    let greeting = 'Prezado(a) Cliente';
    if (type === 'fornecedor') {
      greeting = `Prezado(a) ${rep?.contato || 'Fornecedor'}`;
    } else if (type === 'ambos') {
      greeting = `Prezados,`;
    } else {
      greeting = `Prezado(a) ${cli?.contato || 'Cliente'}`;
    }

    setEmailBody(`${greeting},\n\nSegue a cópia digital do Pedido de Venda #${emailPedido.numeroPedido}.\n\nTipo de Faturamento: ${fatType === 'Notinha' ? 'Notinha (Sem NF)' : 'Nota Fiscal'}\nFrete: ${freteTxt}\nStatus: ${emailPedido.status}\n\n*Itens do Pedido:*\n${itemsList}\n\nResumo Financeiro:\nSubtotal Produtos: ${formatarMoeda(emailPedido.valorSubtotal || emailPedido.valorTotal)}\nValor Total: ${formatarMoeda(emailPedido.valorTotal)}\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nRepresentação Comercial`);
  };

  const buildWhatsAppMessageText = (p: Pedido) => {
    const itemsList = buildOrderCopyItemsText(p.itens);

    let freteValText = 'R$ 0,00';
    if (p.opcaoFrete && p.opcaoFrete !==…23654 tokens truncated… text-xs font-medium hover:bg-slate-50 cursor-pointer"
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
                            <span>{emailFallbackOpened ? 'Marcar como enviado' : 'Enviar por E-mail'}</span>
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
                    <div className="text-left sm:text-right font-mono text-xs space-y-0.5">
                      <p className="text-slate-500">Emissão: <strong className="text-slate-800">{formatarData(printPedido.dataPedido)}</strong></p>
                      <p className="text-slate-500">Faturamento: <strong className="text-slate-800">📄 {formatarTipoFaturamento(printPedido.tipoFaturamento || cli?.tipoFaturamento, printPedido.percentualNfPauta)}</strong></p>
                      <p className="text-slate-500">
                        Frete: <strong className="text-slate-800">
                          {printPedido.opcaoFrete && printPedido.opcaoFrete !== 'nenhum' 
                            ? `${printPedido.tipoFrete || 'FOB'} (${printPedido.valorFrete ? formatarMoeda(printPedido.valorFrete) : 'R$ 0,00'})`
                            : 'Sem Frete'}
                        </strong>
                      </p>
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
                            <th className="py-2.5 px-3 font-bold text-center">Foto</th>
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
                              <td className="py-2 px-3 text-center align-middle">
                                {getOrderItemPhoto(it) && (
                                  <img
                                    src={getOrderItemPhoto(it)}
                                    alt={`Foto de ${it.descricao}`}
                                    className="mx-auto h-14 w-14 rounded border border-slate-200 bg-white object-contain"
                                  />
                                )}
                              </td>
                              <td className="py-3 px-4 font-serif font-bold text-slate-800">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {it.codigo && (
                                    <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                      [{it.codigo}]
                                    </span>
                                  )}
                                  <span>{it.descricao}</span>
                                  {it.cor && (
                                    <span className="font-mono text-[11px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                      Cor: {it.cor}
                                    </span>
                                  )}
                                </div>
                              </td>
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
                        <span>SUBTOTAL PRODUTOS:</span>
                        <span className="font-bold text-white">{formatarMoeda(printPedido.valorSubtotal || (printPedido.valorFrete ? printPedido.valorTotal - printPedido.valorFrete : printPedido.valorTotal))}</span>
                      </div>
                      {Boolean(printPedido.valorFrete && printPedido.valorFrete > 0) && (
                        <div className="flex justify-between text-slate-300 border-b border-dashed border-slate-700 pb-1.5">
                          <span>FRETE ({printPedido.tipoFrete || 'FOB'}):</span>
                          <span className="font-bold text-emerald-400">{formatarMoeda(printPedido.valorFrete || 0)}</span>
                        </div>
                      )}
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

      {/* Modal Enviar WhatsApp */}
      <AnimatePresence>
        {whatsappModalPedido && (() => {
          const p = whatsappModalPedido;
          const cli = clientes.find(c => c.id === p.clienteId);
          const rep = representadas.find(r => r.id === p.representadaId);

          const messageText = buildWhatsAppMessageText(p);

          const getCleanPhone = (tel?: string) => {
            if (!tel) return '';
            const first = tel.split('/')[0].split('|')[0];
            const digits = first.replace(/\D/g, '');
            if (digits && digits.length <= 11) {
              return `55${digits}`;
            }
            return digits;
          };

          const phoneCliente = getCleanPhone(cli?.telefone);
          const phoneFornecedor = getCleanPhone(rep?.telefone);

          const handleOpenWhatsApp = (phone: string) => {
            if (!phone) {
              alert('Telefone não cadastrado ou em formato inválido.');
              return;
            }
            const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(messageText)}`;
            const openedWindow = window.open(url, '_blank');
            if (openedWindow) setWhatsappOpened(true);
            else alert('O navegador bloqueou a janela do WhatsApp. Permita pop-ups para este site e tente novamente.');
          };

          return (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 bg-emerald-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-mono font-bold text-xs text-white">Enviar Pedido via WhatsApp</h4>
                      <p className="text-emerald-100 text-[10px] font-mono">Pedido #{p.numeroPedido}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setWhatsappModalPedido(null); setWhatsappOpened(false); }}
                    className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 overflow-y-auto">
                  {/* Direct Send Buttons */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono uppercase text-slate-500 font-bold">
                      Selecione o Destinatário para Envio:
                    </label>

                    {/* Send to Client */}
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(phoneCliente)}
                      disabled={!phoneCliente}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                        phoneCliente
                          ? 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100/80 text-emerald-950 cursor-pointer shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                          👤
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-800">
                            Enviar para o Cliente
                          </span>
                          <span className="block text-[11px] font-mono text-slate-500">
                            {cli?.nomeFantasia || 'Cliente'} {cli?.telefone ? `(${cli.telefone})` : '• (Sem telefone)'}
                          </span>
                        </div>
                      </div>
                      <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                    </button>

                    {/* Send to Supplier */}
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(phoneFornecedor)}
                      disabled={!phoneFornecedor}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                        phoneFornecedor
                          ? 'bg-blue-50/80 border-blue-200 hover:bg-blue-100/80 text-blue-950 cursor-pointer shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                          🏢
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-800">
                            Enviar para o Fornecedor (Fábrica)
                          </span>
                          <span className="block text-[11px] font-mono text-slate-500">
                            {rep?.nomeFantasia || 'Representada'} {rep?.telefone ? `(${rep.telefone})` : '• (Sem telefone)'}
                          </span>
                        </div>
                      </div>
                      <Send className="w-4 h-4 text-blue-600 shrink-0" />
                    </button>
                  </div>

                  {/* Preview Text */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase text-slate-500 font-bold">
                        Prévia da Mensagem Formada
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(messageText);
                          alert('Texto da mensagem copiado para a área de transferência!');
                        }}
                        className="text-[11px] font-mono font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        📋 Copiar Texto
                      </button>
                    </div>
                    <textarea
                      rows={9}
                      readOnly
                      value={messageText}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 leading-relaxed resize-none focus:outline-none"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  {whatsappOpened ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await markPedidoAsSent(p, 'WhatsApp');
                          setWhatsappModalPedido(null);
                          setWhatsappOpened(false);
                        } catch (error) {
                          console.error('Não foi possível registrar o envio pelo WhatsApp:', error);
                          alert('Não foi possível registrar o envio. Confira sua conexão e tente novamente.');
                        }
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Marcar como enviado
                    </button>
                  ) : <span className="text-[10px] text-slate-400">A etiqueta será aplicada após a confirmação do envio.</span>}
                  <button
                    type="button"
                    onClick={() => { setWhatsappModalPedido(null); setWhatsappOpened(false); }}
                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >Fechar</button>
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
