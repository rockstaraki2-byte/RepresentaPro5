import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileDown, FileUp, Save, Trash2, UploadCloud, X } from 'lucide-react';
import type { Cliente, CommissionRule, Pedido, Produto, Representada } from '../types';
import { formatarMoeda } from '../utils';
import {
  calculateExpectedCommission,
  calculateExpectedCommissionFromInvoice,
  parseCommissionCsv,
  parseCommissionInvoiceXml,
  serializeCommissionCsv,
  type CommissionReceipt,
  type ImportedInvoice,
} from '../commissionReconciliation';

interface CommissionReconciliationTabProps {
  pedidos: Pedido[];
  clientes: Cliente[];
  representadas: Representada[];
  produtos: Produto[];
  rules: CommissionRule[];
  tenantId: string;
  currentUser?: { id?: string; role?: string };
  onSaveRule: (rule: CommissionRule) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
}

const emptyForm = { id: '', representadaId: '', clienteId: '', produtoId: '', condicaoPagamento: '', percentual: '', ativa: true };

export default function CommissionReconciliationTab({
  pedidos, clientes, representadas, produtos, rules, tenantId, currentUser, onSaveRule, onDeleteRule,
}: CommissionReconciliationTabProps) {
  const isAdmin = currentUser?.role === 'Administrador';
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [receipts, setReceipts] = useState<CommissionReceipt[]>([]);
  const [invoices, setInvoices] = useState<ImportedInvoice[]>([]);
  const [manualReceipts, setManualReceipts] = useState<Record<string, string>>({});
  const [importMessage, setImportMessage] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    setReceipts([]);
    setInvoices([]);
    setManualReceipts({});
    setImportMessage('');
    setImportErrors([]);
  }, [tenantId]);

  const visibleRules = useMemo(() => rules.filter((rule) => tenantId === 'all' || rule.empresaRepresentacaoId === tenantId), [rules, tenantId]);
  const filteredProducts = useMemo(() => form.representadaId
    ? produtos.filter((product) => product.representadaId === form.representadaId && product.ativo)
    : produtos.filter((product) => product.ativo), [produtos, form.representadaId]);

  const reconciliationRows = useMemo(() => {
    const receiptByOrder = new Map<string, { amount: number; dates: string[] }>();
    receipts.forEach((receipt) => {
      const current = receiptByOrder.get(receipt.numeroPedido) || { amount: 0, dates: [] };
      current.amount += receipt.comissaoRecebida;
      if (receipt.dataPagamento) current.dates.push(receipt.dataPagamento);
      receiptByOrder.set(receipt.numeroPedido, current);
    });
    const invoicesByOrder = new Map<string, ImportedInvoice[]>();
    invoices.forEach((invoice) => {
      if (invoice.numeroPedido) invoicesByOrder.set(invoice.numeroPedido, [...(invoicesByOrder.get(invoice.numeroPedido) || []), invoice]);
    });
    const query = filterText.trim().toLocaleLowerCase('pt-BR');
    const activeOrders = pedidos.filter((pedido) => pedido.status !== 'Cancelado');
    const orderNumberCounts = new Map<string, number>();
    activeOrders.forEach((pedido) => orderNumberCounts.set(pedido.numeroPedido, (orderNumberCounts.get(pedido.numeroPedido) || 0) + 1));
    return activeOrders.map((pedido) => {
      const csvReceipt = receiptByOrder.get(pedido.numeroPedido);
      const orderNumberIsAmbiguous = orderNumberCounts.get(pedido.numeroPedido) > 1;
      const matchingInvoices = invoicesByOrder.get(pedido.numeroPedido) || [];
      const invoiceIsAmbiguous = matchingInvoices.length > 1;
      const invoice = matchingInvoices.length === 1 ? matchingInvoices[0] : undefined;
      const rawManualReceipt = manualReceipts[pedido.id];
      const manualAmount = rawManualReceipt?.trim() ? Number(rawManualReceipt.replace(',', '.')) : null;
      const received = csvReceipt
        ? { ...csvReceipt, source: 'CSV' as const }
        : manualAmount !== null && Number.isFinite(manualAmount) && manualAmount >= 0
          ? { amount: manualAmount, dates: [], source: 'manual' as const }
          : undefined;
      const invoiceExpected = invoice ? calculateExpectedCommissionFromInvoice(pedido, visibleRules, invoice) : null;
      const expected = invoiceExpected || calculateExpectedCommission(pedido, visibleRules);
      const delta = !orderNumberIsAmbiguous && !invoiceIsAmbiguous && received && expected.esperado !== null ? received.amount - expected.esperado : null;
      const situation = orderNumberIsAmbiguous
        ? 'Revisar número'
        : invoiceIsAmbiguous
        ? 'Revisar NF-e'
        : expected.regraAmbigua
        ? 'Revisar regra'
        : !received ? 'Aguardando comissão recebida'
          : Math.abs(delta || 0) <= 0.01 ? 'Conciliada' : 'Divergência';
      const client = clientes.find((item) => item.id === pedido.clienteId);
      const represented = representadas.find((item) => item.id === pedido.representadaId);
      return { pedido, expected, expectedFromInvoice: Boolean(invoiceExpected), received, delta, situation, client, represented, invoice, invoiceCount: matchingInvoices.length };
    }).filter((row) => !query || [row.pedido.numeroPedido, row.client?.nomeFantasia || '', row.represented?.nomeFantasia || '']
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(query)));
  }, [pedidos, visibleRules, receipts, invoices, manualReceipts, filterText, clientes, representadas]);

  const handleSaveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const percent = Number(form.percentual.replace(',', '.'));
    if (tenantId === 'all') {
      setFormError('Selecione uma empresa específica antes de cadastrar regras.');
      return;
    }
    if (!form.representadaId || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      setFormError('Selecione uma representada e informe um percentual entre 0 e 100.');
      return;
    }
    if (form.condicaoPagamento.trim().length > 200) {
      setFormError('A condição de pagamento pode ter até 200 caracteres.');
      return;
    }
    const previous = visibleRules.find((rule) => rule.id === form.id);
    const now = new Date().toISOString();
    const rule: CommissionRule = {
      id: form.id || `regra-comissao-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`,
      empresaRepresentacaoId: tenantId,
      representadaId: form.representadaId,
      clienteId: form.clienteId || undefined,
      produtoId: form.produtoId || undefined,
      condicaoPagamento: form.condicaoPagamento.trim() || undefined,
      percentual: percent,
      ativa: form.ativa,
      criadoPorUserId: previous?.criadoPorUserId || currentUser?.id || '',
      criadoEm: previous?.criadoEm || now,
      atualizadoEm: now,
    };
    if (!rule.criadoPorUserId) {
      setFormError('Não consegui identificar o usuário atual. Atualize a sessão e tente novamente.');
      return;
    }
    setIsSavingRule(true);
    try {
      await onSaveRule(rule);
      setForm(emptyForm);
    } catch {
      setFormError('Não foi possível salvar a regra. Confira suas permissões e tente novamente.');
    } finally {
      setIsSavingRule(false);
    }
  };

  const startRuleEdit = (rule: CommissionRule) => setForm({
    id: rule.id,
    representadaId: rule.representadaId,
    clienteId: rule.clienteId || '',
    produtoId: rule.produtoId || '',
    condicaoPagamento: rule.condicaoPagamento || '',
    percentual: String(rule.percentual),
    ativa: rule.ativa,
  });

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportErrors([]);
    try {
      const parsed = parseCommissionCsv(await file.text());
      setReceipts(parsed.recebimentos);
      setImportErrors(parsed.erros);
      setImportMessage(`${parsed.recebimentos.length} lançamento(s) de comissão carregado(s) de ${file.name}.`);
    } catch (error) {
      setReceipts([]);
      setImportMessage('');
      setImportErrors([error instanceof Error ? error.message : 'Não foi possível ler o CSV.']);
    }
  };

  const handleXmlImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportErrors([]);
    try {
      const imported = parseCommissionInvoiceXml(await file.text(), pedidos);
      setInvoices(imported);
      const matched = imported.filter((invoice) => invoice.numeroPedido).length;
      setImportMessage(`${imported.length} NF-e(s) processada(s); ${matched} associada(s) ao número de pedido. O XML não contém o valor de comissão recebida.`);
    } catch (error) {
      setInvoices([]);
      setImportMessage('');
      setImportErrors([error instanceof Error ? error.message : 'Não foi possível ler o XML.']);
    }
  };

  const downloadTemplate = () => {
    const content = '\uFEFFnumeroPedido;comissaoRecebida;dataPagamento\r\nPED-001;1250,00;2026-10-28\r\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-conciliacao-comissoes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportReport = () => {
    const rows = [
      ['numeroPedido', 'cliente', 'representada', 'comissaoEsperada', 'comissaoRecebida', 'diferenca', 'situacao'],
      ...reconciliationRows.map((row) => [
        row.pedido.numeroPedido,
        row.client?.nomeFantasia || '',
        row.represented?.nomeFantasia || '',
        row.expected.esperado?.toFixed(2) ?? '',
        row.received?.amount.toFixed(2) ?? '',
        row.delta?.toFixed(2) ?? '',
        row.situation,
      ]),
    ];
    const csv = serializeCommissionCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio-conciliacao-comissoes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="font-serif text-lg font-extrabold text-slate-900">Regras e conciliação de comissões</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              Simule a comissão esperada por representada, cliente, produto e condição de pagamento. Importe os valores recebidos para localizar diferenças sem alterar os pedidos existentes.
            </p>
          </div>
          <button onClick={downloadTemplate} className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <FileDown className="h-4 w-4" /> Baixar modelo CSV
          </button>
        </div>
        {tenantId === 'all' && <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">Selecione uma empresa específica para importar arquivos ou digitar recebimentos. Isso evita associar o mesmo número de pedido entre tenants diferentes.</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-emerald-300 hover:bg-emerald-50/40">
            <span className="rounded-lg bg-white p-2 text-emerald-700 shadow-sm"><FileUp className="h-4 w-4" /></span>
            <span><strong className="block text-xs text-slate-800">Importar comissões recebidas (CSV)</strong><span className="mt-1 block text-[10px] text-slate-500">Cruza número do pedido e valor efetivamente recebido.</span></span>
            <input type="file" accept=".csv,text/csv" className="sr-only" disabled={tenantId === 'all'} onChange={handleCsvImport} />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-emerald-300 hover:bg-emerald-50/40">
            <span className="rounded-lg bg-white p-2 text-blue-700 shadow-sm"><UploadCloud className="h-4 w-4" /></span>
            <span><strong className="block text-xs text-slate-800">Importar NF-e (XML)</strong><span className="mt-1 block text-[10px] text-slate-500">Associa nota e valor faturado ao pedido quando o número está em informações adicionais.</span></span>
            <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" disabled={tenantId === 'all'} onChange={handleXmlImport} />
          </label>
        </div>
        <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900">
          Os arquivos são processados neste navegador e não são salvos no sistema. O XML de NF-e não informa, por si só, a comissão paga; para comparar recebido com esperado, importe também o CSV de comissões ou digite o valor recebido diretamente na tabela.
        </p>
        {importMessage && <p role="status" className="mt-3 text-xs font-bold text-emerald-800">{importMessage}</p>}
        {importErrors.length > 0 && <div role="alert" className="mt-3 space-y-1 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">{importErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
      </section>

      {isAdmin && tenantId !== 'all' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h3 className="text-sm font-extrabold text-slate-900">{form.id ? 'Editar regra' : 'Nova regra de comissão'}</h3><p className="mt-1 text-[11px] text-slate-500">Regras são aplicadas à conciliação; não reescrevem os pedidos nem os valores financeiros atuais.</p></div>
            {form.id && <button type="button" onClick={() => { setForm(emptyForm); setFormError(''); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Cancelar edição"><X className="h-4 w-4" /></button>}
          </div>
          <form onSubmit={handleSaveRule} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="space-y-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase text-slate-500">Representada *</span><select value={form.representadaId} onChange={(event) => setForm((current) => ({ ...current, representadaId: event.target.value, produtoId: '' }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><option value="">Selecione</option>{representadas.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia}</option>)}</select></label>
            <label className="space-y-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase text-slate-500">Cliente (opcional)</span><select value={form.clienteId} onChange={(event) => setForm((current) => ({ ...current, clienteId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><option value="">Todos os clientes</option>{clientes.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia}</option>)}</select></label>
            <label className="space-y-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase text-slate-500">Produto (opcional)</span><select value={form.produtoId} onChange={(event) => setForm((current) => ({ ...current, produtoId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><option value="">Todos os produtos</option>{filteredProducts.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>)}</select></label>
            <label className="space-y-1 sm:col-span-1 lg:col-span-2"><span className="text-[10px] font-bold uppercase text-slate-500">Condição de pagamento (opcional)</span><input maxLength={200} value={form.condicaoPagamento} onChange={(event) => setForm((current) => ({ ...current, condicaoPagamento: event.target.value }))} placeholder="Ex.: 30/60 ou à vista" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" /></label>
            <label className="space-y-1"><span className="text-[10px] font-bold uppercase text-slate-500">Comissão (%) *</span><input type="number" min="0" max="100" step="0.01" value={form.percentual} onChange={(event) => setForm((current) => ({ ...current, percentual: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" /></label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={form.ativa} onChange={(event) => setForm((current) => ({ ...current, ativa: event.target.checked }))} /> Regra ativa</label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2"><button disabled={isSavingRule} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"><Save className="h-3.5 w-3.5" />{isSavingRule ? 'Salvando…' : form.id ? 'Salvar alterações' : 'Adicionar regra'}</button></div>
          </form>
          {formError && <p role="alert" className="mt-3 text-xs font-bold text-red-700">{formError}</p>}
          {visibleRules.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-2">Representada e dimensões</th><th className="px-3 py-2">Comissão</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRules.map((rule) => {
            const represented = representadas.find((item) => item.id === rule.representadaId);
            const client = clientes.find((item) => item.id === rule.clienteId);
            const product = produtos.find((item) => item.id === rule.produtoId);
            return <tr key={rule.id}><td className="px-3 py-2"><strong>{represented?.nomeFantasia || 'Representada indisponível'}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{[client?.nomeFantasia, product?.nome, rule.condicaoPagamento].filter(Boolean).join(' · ') || 'Regra geral'}</span></td><td className="px-3 py-2 font-mono font-bold">{rule.percentual}%</td><td className="px-3 py-2">{rule.ativa ? 'Ativa' : 'Inativa'}</td><td className="px-3 py-2"><div className="flex justify-end gap-1"><button type="button" onClick={() => startRuleEdit(rule)} className="rounded-md px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-50">Editar</button><button type="button" onClick={async () => { if (!window.confirm('Excluir esta regra de comissão?')) return; try { await onDeleteRule(rule.id); } catch { setFormError('Não foi possível excluir a regra. Confira suas permissões e tente novamente.'); } }} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" aria-label="Excluir regra"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>;
          })}</tbody></table></div>}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h3 className="text-sm font-extrabold text-slate-900">Conferência por pedido</h3><p className="mt-1 text-[11px] text-slate-500">A comissão esperada usa a regra mais específica; sem regra aplicável, usa o percentual já registrado no pedido.</p></div>
          <div className="flex gap-2"><input value={filterText} onChange={(event) => setFilterText(event.target.value)} placeholder="Buscar pedido ou cliente" className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" /><button onClick={exportReport} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><FileDown className="h-3.5 w-3.5" />Exportar</button></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-2">Pedido / cliente</th><th className="px-3 py-2">Representada</th><th className="px-3 py-2 text-right">Esperada</th><th className="px-3 py-2 text-right">Recebida</th><th className="px-3 py-2 text-right">Diferença</th><th className="px-3 py-2">NF-e</th><th className="px-3 py-2">Situação</th></tr></thead><tbody className="divide-y divide-slate-100">{reconciliationRows.map((row) => {
          const isMatch = row.situation === 'Conciliada';
          const isError = row.situation === 'Divergência' || row.situation.startsWith('Revisar');
          return (
            <tr key={row.pedido.id} className="hover:bg-slate-50/70">
              <td className="px-3 py-2"><strong>{row.pedido.numeroPedido}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{row.client?.nomeFantasia || 'Cliente indisponível'}</span></td>
              <td className="px-3 py-2">{row.represented?.nomeFantasia || '—'}</td>
              <td className="px-3 py-2 text-right font-mono"><span>{row.expected.esperado === null ? '—' : formatarMoeda(row.expected.esperado)}</span><span className="block text-[9px] text-slate-400">{row.expectedFromInvoice ? 'base NF-e' : 'base pedido'}</span></td>
              <td className="px-3 py-2 text-right font-mono">
                {row.received?.source === 'CSV' ? <span title="Valor importado do CSV">{formatarMoeda(row.received.amount)}<span className="ml-1 text-[9px] text-slate-400">CSV</span></span> : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={tenantId === 'all'}
                    value={manualReceipts[row.pedido.id] || ''}
                    onChange={(event) => setManualReceipts((current) => ({ ...current, [row.pedido.id]: event.target.value }))}
                    placeholder="Digitar"
                    aria-label={`Comissão recebida do pedido ${row.pedido.numeroPedido}`}
                    className="w-28 rounded-md border border-slate-200 px-2 py-1 text-right text-xs disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                )}
              </td>
              <td className={`px-3 py-2 text-right font-mono ${row.delta !== null && Math.abs(row.delta) > 0.01 ? 'font-bold text-red-700' : 'text-slate-600'}`}>{row.delta === null ? '—' : formatarMoeda(row.delta)}</td>
              <td className="px-3 py-2">{row.invoiceCount > 1 ? `${row.invoiceCount} notas associadas` : row.invoice ? <span title={`NF-e no valor de ${formatarMoeda(row.invoice.valorNota || 0)}`}>{row.invoice.numeroNota || 'Importada'} · {formatarMoeda(row.invoice.valorNota || 0)}</span> : '—'}</td>
              <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${isMatch ? 'bg-emerald-50 text-emerald-700' : isError ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{isMatch ? <CheckCircle2 className="h-3 w-3" /> : isError ? <AlertCircle className="h-3 w-3" /> : null}{row.situation}</span></td>
            </tr>
          );
        })}{reconciliationRows.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-400">Nenhum pedido encontrado para conciliar.</td></tr>}</tbody></table></div>
        {invoices.some((invoice) => !invoice.numeroPedido) && <p className="mt-3 text-[10px] text-amber-800">{invoices.filter((invoice) => !invoice.numeroPedido).length} NF-e(s) não foram associadas. Inclua o número do pedido em “Informações adicionais” da nota para associação automática.</p>}
      </section>
    </div>
  );
}
