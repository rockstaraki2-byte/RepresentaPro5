export interface OrderTextDraftItem {
  codigo: string | null;
  produto: string;
  cor: string | null;
  variacao: string | null;
  quantidade: number;
  precoUnitario: number | null;
}

export interface OrderTextDraft {
  numeroPedido: string | null;
  dataPedido: string | null;
  cliente: string | null;
  clienteDocumento: string | null;
  representada: string | null;
  condicoesPagamento: string | null;
  observacoes: string | null;
  itens: OrderTextDraftItem[];
}

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
};

const validDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
};

/** Strictly keeps only bounded, expected fields from a model response. */
export function normalizeOrderTextDraft(value: unknown): OrderTextDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.itens) || raw.itens.length === 0 || raw.itens.length > 100) return null;

  const itens: OrderTextDraftItem[] = [];
  for (const rawItem of raw.itens) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return null;
    const item = rawItem as Record<string, unknown>;
    const produto = cleanText(item.produto, 200);
    const quantidade = item.quantidade;
    const precoUnitario = item.precoUnitario;
    if (!produto || typeof quantidade !== 'number' || !Number.isFinite(quantidade)
      || quantidade <= 0 || quantidade > 1_000_000
      || (precoUnitario !== null && precoUnitario !== undefined && (typeof precoUnitario !== 'number'
        || !Number.isFinite(precoUnitario) || precoUnitario < 0 || precoUnitario > 1_000_000_000))) {
      return null;
    }
    itens.push({
      codigo: cleanText(item.codigo, 80),
      produto,
      cor: cleanText(item.cor, 100),
      variacao: cleanText(item.variacao, 100),
      quantidade,
      precoUnitario: (precoUnitario ?? null) as number | null,
    });
  }

  return {
    numeroPedido: cleanText(raw.numeroPedido, 100),
    dataPedido: validDate(raw.dataPedido),
    cliente: cleanText(raw.cliente, 200),
    clienteDocumento: cleanText(raw.clienteDocumento, 30),
    representada: cleanText(raw.representada, 200),
    condicoesPagamento: cleanText(raw.condicoesPagamento, 250),
    observacoes: cleanText(raw.observacoes, 1500),
    itens,
  };
}
