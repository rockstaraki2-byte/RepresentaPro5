import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeOrderTextDraft } from '../src/orderTextDraft';

describe('normalizeOrderTextDraft', () => {
  it('keeps a valid draft while trimming text and rejecting extra fields', () => {
    const draft = normalizeOrderTextDraft({
      numeroPedido: '  457  ',
      dataPedido: '2026-10-28',
      cliente: ' Loja Exemplo ',
      clienteDocumento: null,
      representada: ' Marca X ',
      condicoesPagamento: '30/60',
      observacoes: ' urgência ',
      tenantId: 'should-not-survive',
      itens: [{ produto: ' Mesa ', codigo: 'M1', cor: 'Preta', variacao: null, quantidade: 2, precoUnitario: null, malicious: true }],
    });

    assert.deepEqual(draft, {
      numeroPedido: '457',
      dataPedido: '2026-10-28',
      cliente: 'Loja Exemplo',
      clienteDocumento: null,
      representada: 'Marca X',
      condicoesPagamento: '30/60',
      observacoes: 'urgência',
      itens: [{ produto: 'Mesa', codigo: 'M1', cor: 'Preta', variacao: null, quantidade: 2, precoUnitario: null }],
    });
  });

  it('rejects missing items, invalid dates, and unsafe quantities or prices', () => {
    assert.equal(normalizeOrderTextDraft({ itens: [] }), null);
    assert.equal(normalizeOrderTextDraft({ itens: [{ produto: 'Mesa', quantidade: 1, precoUnitario: 10 }], dataPedido: '2026-02-30' })?.dataPedido, null);
    assert.equal(normalizeOrderTextDraft({ itens: [{ produto: 'Mesa', quantidade: 0, precoUnitario: 10 }] }), null);
    assert.equal(normalizeOrderTextDraft({ itens: [{ produto: 'Mesa', quantidade: 1, precoUnitario: Infinity }] }), null);
  });
});
