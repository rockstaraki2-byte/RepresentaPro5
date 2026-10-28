import type { CommissionRule, OrderItem, Pedido } from './types';

export interface CommissionReceipt {
  numeroPedido: string;
  comissaoRecebida: number;
  dataPagamento?: string;
}

export interface ImportedInvoice {
  numeroPedido?: string;
  numeroNota?: string;
  cnpjEmitente?: string;
  cnpjCliente?: string;
  valorNota?: number;
  itens: Array<{ codigo?: string; descricao?: string; valorProduto?: number }>;
}

export interface CommissionCalculation {
  esperado: number | null;
  percentualMedio: number | null;
  regraAmbigua: boolean;
  detalhes: Array<{ descricao: string; percentual: number; origem: 'regra' | 'pedido' }>;
}

export function normalizeRuleValue(value: string | undefined): string {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function resolveCommissionRate(
  pedido: Pedido,
  item: OrderItem,
  rules: CommissionRule[],
): { percentual: number; regraAmbigua: boolean; origem: 'regra' | 'pedido' } {
  const condition = normalizeRuleValue(pedido.condicoesPagamento);
  const matching = rules.filter((rule) => rule.ativa
    && rule.empresaRepresentacaoId === pedido.empresaRepresentacaoId
    && rule.representadaId === pedido.representadaId
    && (!rule.clienteId || rule.clienteId === pedido.clienteId)
    && (!rule.produtoId || rule.produtoId === item.produtoId)
    && (!rule.condicaoPagamento || normalizeRuleValue(rule.condicaoPagamento) === condition));
  if (matching.length === 0) return { percentual: pedido.comissaoPercentual || 0, regraAmbigua: false, origem: 'pedido' };

  const specificity = (rule: CommissionRule) => Number(Boolean(rule.clienteId))
    + Number(Boolean(rule.produtoId)) + Number(Boolean(rule.condicaoPagamento));
  const highestScore = Math.max(...matching.map(specificity));
  const mostSpecific = matching.filter((rule) => specificity(rule) === highestScore);
  const distinctRates = new Set(mostSpecific.map((rule) => rule.percentual));
  if (distinctRates.size > 1) {
    return { percentual: pedido.comissaoPercentual || 0, regraAmbigua: true, origem: 'pedido' };
  }
  return { percentual: mostSpecific[0].percentual, regraAmbigua: false, origem: 'regra' };
}

export function calculateExpectedCommission(pedido: Pedido, rules: CommissionRule[]): CommissionCalculation {
  let esperado = 0;
  let baseComissao = 0;
  let regraAmbigua = false;
  const detalhes: CommissionCalculation['detalhes'] = [];
  for (const item of pedido.itens || []) {
    const value = Number.isFinite(item.totalItem) ? item.totalItem : item.quantidade * item.precoUnitario;
    const rate = resolveCommissionRate(pedido, item, rules);
    if (rate.regraAmbigua) regraAmbigua = true;
    esperado += value * rate.percentual / 100;
    baseComissao += value;
    detalhes.push({ descricao: item.descricao, percentual: rate.percentual, origem: rate.origem });
  }
  return {
    esperado: regraAmbigua ? null : esperado,
    percentualMedio: baseComissao > 0 && !regraAmbigua ? esperado / baseComissao * 100 : null,
    regraAmbigua,
    detalhes,
  };
}

/** Uses NF-e product values as the commission base when every line maps to one order item. */
export function calculateExpectedCommissionFromInvoice(
  pedido: Pedido,
  rules: CommissionRule[],
  invoice: ImportedInvoice,
): CommissionCalculation | null {
  if (!invoice.itens.length) return null;
  let esperado = 0;
  let baseComissao = 0;
  let regraAmbigua = false;
  const detalhes: CommissionCalculation['detalhes'] = [];
  for (const invoiceItem of invoice.itens) {
    const code = normalizeRuleValue(invoiceItem.codigo);
    const name = normalizeRuleValue(invoiceItem.descricao);
    const candidates = pedido.itens.filter((item) => code
      ? normalizeRuleValue(item.codigo) === code
      : name && normalizeRuleValue(item.descricao) === name);
    if (candidates.length !== 1 || !Number.isFinite(invoiceItem.valorProduto) || (invoiceItem.valorProduto as number) < 0) return null;
    const item = candidates[0];
    const rate = resolveCommissionRate(pedido, item, rules);
    if (rate.regraAmbigua) regraAmbigua = true;
    const value = invoiceItem.valorProduto as number;
    esperado += value * rate.percentual / 100;
    baseComissao += value;
    detalhes.push({ descricao: invoiceItem.descricao || item.descricao, percentual: rate.percentual, origem: rate.origem });
  }
  return {
    esperado: regraAmbigua ? null : esperado,
    percentualMedio: baseComissao > 0 && !regraAmbigua ? esperado / baseComissao * 100 : null,
    regraAmbigua,
    detalhes,
  };
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && line[index] === delimiter) count += 1;
  }
  return count;
}

function parseCsvRows(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = content.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell); cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error('O arquivo CSV tem aspas sem fechamento.');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseMoney(value: string): number | null {
  let cleaned = value.replace(/[R$\s]/gi, '').trim();
  if (!cleaned) return null;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) cleaned = cleaned.replace(',', '.');
  const result = Number(cleaned);
  return Number.isFinite(result) && result >= 0 && result <= 1_000_000_000 ? result : null;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseCommissionCsv(content: string): { recebimentos: CommissionReceipt[]; erros: string[] } {
  if (content.length > 2_000_000) throw new Error('O CSV deve ter até 2 MB.');
  const firstLine = content.split(/\r?\n/, 1)[0] || '';
  const delimiter = countDelimiter(firstLine, ';') >= countDelimiter(firstLine, ',') ? ';' : ',';
  const rows = parseCsvRows(content, delimiter);
  if (rows.length < 2) return { recebimentos: [], erros: ['O CSV precisa conter cabeçalho e pelo menos uma linha.'] };
  const header = rows[0].map((value) => normalizeRuleValue(value).replace(/[^a-z0-9]/g, ''));
  const orderColumn = header.findIndex((value) => ['numeropedido', 'pedido', 'ordem', 'order'].includes(value));
  const receivedColumn = header.findIndex((value) => ['comissaorecebida', 'comissao', 'valorrecebido', 'valorcomissao'].includes(value));
  const dateColumn = header.findIndex((value) => ['datapagamento', 'datarecebimento', 'data'].includes(value));
  if (orderColumn < 0 || receivedColumn < 0) {
    return { recebimentos: [], erros: ['Inclua as colunas numeroPedido e comissaoRecebida no cabeçalho.'] };
  }

  const recebimentos: CommissionReceipt[] = [];
  const erros: string[] = [];
  rows.slice(1).forEach((row, index) => {
    const numeroPedido = (row[orderColumn] || '').trim();
    const comissaoRecebida = parseMoney(row[receivedColumn] || '');
    const rawDate = dateColumn >= 0 ? (row[dateColumn] || '').trim() : '';
    const dataPagamento = rawDate && isIsoDate(rawDate) ? rawDate : undefined;
    if (!numeroPedido || numeroPedido.length > 100 || comissaoRecebida === null) {
      erros.push(`Linha ${index + 2}: informe número do pedido e comissão recebida válida.`);
      return;
    }
    if (rawDate && !dataPagamento) {
      erros.push(`Linha ${index + 2}: data ignorada; use o formato AAAA-MM-DD.`);
    }
    recebimentos.push({ numeroPedido, comissaoRecebida, dataPagamento });
  });
  return { recebimentos, erros };
}

function firstElementText(parent: Element, localName: string): string | undefined {
  const found = Array.from(parent.getElementsByTagName('*')).find((element) => element.localName === localName);
  return found?.textContent?.trim() || undefined;
}

function firstChildByLocalName(parent: Element, localName: string): Element | undefined {
  return Array.from(parent.getElementsByTagName('*')).find((element) => element.localName === localName);
}

export function parseCommissionInvoiceXml(content: string, pedidos: Pedido[]): ImportedInvoice[] {
  if (content.length > 5_000_000) throw new Error('O XML deve ter até 5 MB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new Error('O XML contém declarações não permitidas.');
  if (typeof DOMParser === 'undefined') throw new Error('Este navegador não oferece suporte à leitura de XML.');
  const document = new DOMParser().parseFromString(content, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) throw new Error('O arquivo XML está inválido.');
  const invoiceNodes = Array.from(document.getElementsByTagName('*')).filter((element) => element.localName === 'infNFe');
  if (invoiceNodes.length === 0 || invoiceNodes.length > 50) throw new Error('O arquivo não contém de 1 a 50 notas NF-e.');
  return invoiceNodes.map((invoiceNode) => {
    const extra = firstElementText(invoiceNode, 'infCpl') || '';
    const orderMatches = pedidos.filter((pedido) => extra.includes(pedido.numeroPedido));
    const orderNumber = orderMatches.length === 1 ? orderMatches[0].numeroPedido : undefined;
    const totalRaw = firstElementText(invoiceNode, 'vNF');
    const valorNota = totalRaw ? Number(totalRaw) : undefined;
    const productNodes = Array.from(invoiceNode.getElementsByTagName('*')).filter((element) => element.localName === 'det');
    const itens = productNodes.slice(0, 200).map((productNode) => {
      const product = firstChildByLocalName(productNode, 'prod') || productNode;
      const rawValue = firstElementText(product, 'vProd');
      const value = rawValue ? Number(rawValue) : undefined;
      return {
        codigo: firstElementText(product, 'cProd'),
        descricao: firstElementText(product, 'xProd'),
        valorProduto: value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined,
      };
    });
    const emitter = firstChildByLocalName(invoiceNode, 'emit');
    const destination = firstChildByLocalName(invoiceNode, 'dest');
    return {
      numeroPedido: orderNumber,
      numeroNota: firstElementText(invoiceNode, 'nNF'),
      cnpjEmitente: emitter ? firstElementText(emitter, 'CNPJ') : undefined,
      cnpjCliente: destination ? firstElementText(destination, 'CNPJ') : undefined,
      valorNota: valorNota !== undefined && Number.isFinite(valorNota) && valorNota >= 0 ? valorNota : undefined,
      itens,
    };
  });
}
