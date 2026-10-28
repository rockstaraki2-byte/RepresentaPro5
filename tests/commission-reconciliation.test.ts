import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CommissionRule, Pedido } from '../src/types';
import { calculateExpectedCommission, calculateExpectedCommissionFromInvoice, parseCommissionCsv, parseCommissionInvoiceXml, resolveCommissionRate, serializeCommissionCsv } from '../src/commissionReconciliation';

const order: Pedido = {
  id: 'o-1', numeroPedido: 'PED-10', clienteId: 'c-1', representadaId: 'r-1', dataPedido: '2026-10-28',
  itens: [
    { id: 'i-1', produtoId: 'p-1', codigo: 'A1', descricao: 'Produto A', quantidade: 2, precoUnitario: 100, totalItem: 200 },
    { id: 'i-2', codigo: 'B1', descricao: 'Produto B', quantidade: 1, precoUnitario: 100, totalItem: 100 },
  ],
  valorTotal: 300, comissaoPercentual: 5, valorComissao: 15, status: 'Pendente', condicoesPagamento: '30/60', empresaRepresentacaoId: 'tenant-1',
};

const rule = (patch: Partial<CommissionRule>): CommissionRule => ({
  id: 'rule-1', empresaRepresentacaoId: 'tenant-1', representadaId: 'r-1', percentual: 8, ativa: true,
  criadoPorUserId: 'admin-1', criadoEm: '2026-10-28T10:00:00.000Z', atualizadoEm: '2026-10-28T10:00:00.000Z',
  ...patch,
});

describe('commission reconciliation', () => {
  it('uses the most specific matching rule and falls back to the order percentage', () => {
    const rules = [
      rule({ id: 'base', percentual: 8 }),
      rule({ id: 'client', clienteId: 'c-1', percentual: 7 }),
      rule({ id: 'product-condition', produtoId: 'p-1', condicaoPagamento: '30/60', percentual: 10 }),
    ];
    assert.deepEqual(resolveCommissionRate(order, order.itens[0], rules), {
      percentual: 10, regraAmbigua: false, origem: 'regra',
    });
    const calculation = calculateExpectedCommission(order, rules);
    assert.equal(calculation.esperado, 27); // (200 × 10%) + (100 × 7%)
  });

  it('marks same-specificity conflicting rules as ambiguous instead of choosing one', () => {
    const rules = [
      rule({ id: 'specific-a', clienteId: 'c-1', produtoId: 'p-1', percentual: 8 }),
      rule({ id: 'specific-b', clienteId: 'c-1', condicaoPagamento: '30/60', percentual: 12 }),
    ];
    assert.equal(calculateExpectedCommission(order, rules).esperado, null);
    assert.equal(resolveCommissionRate(order, order.itens[0], rules).regraAmbigua, true);
  });

  it('uses NF-e product values as the base when all lines match the order', () => {
    const invoice = {
      numeroPedido: 'PED-10', numeroNota: '923', valorNota: 450,
      itens: [{ codigo: 'A1', descricao: 'Produto A', valorProduto: 400 }, { codigo: 'B1', descricao: 'Produto B', valorProduto: 50 }],
    };
    const rules = [rule({ id: 'product-a', produtoId: 'p-1', percentual: 10 })];
    assert.equal(calculateExpectedCommissionFromInvoice(order, rules, invoice)?.esperado, 42.5);
    assert.equal(calculateExpectedCommissionFromInvoice(order, rules, { ...invoice, itens: [{ codigo: 'unknown', valorProduto: 50 }] }), null);
  });

  it('parses quoted CSV rows and Brazilian currency values', () => {
    const result = parseCommissionCsv('\uFEFFnumeroPedido;comissaoRecebida;dataPagamento\r\n"PED-10";"R$ 1.234,56";2026-10-20\r\nPED-11;20,50;');
    assert.deepEqual(result, {
      recebimentos: [
        { numeroPedido: 'PED-10', comissaoRecebida: 1234.56, dataPagamento: '2026-10-20' },
        { numeroPedido: 'PED-11', comissaoRecebida: 20.5, dataPagamento: undefined },
      ],
      erros: [],
    });
  });

  it('escapes formula-leading text in exported CSV but keeps numeric values numeric', () => {
    const csv = serializeCommissionCsv([['=1+1', '+SUM(1,1)', '-texto', '@SUM(A1)', ' seguro'], [-12, 10]]);
    assert.equal(csv, '\uFEFF"\'=1+1";"\'+SUM(1,1)";"\'-texto";"\'@SUM(A1)";" seguro"\r\n"-12";"10"');
  });

  it('extracts invoice number, order reference, CNPJs, and product bases from NF-e XML nodes', () => {
    const element = (localName: string, text = '', children: any[] = []): any => ({
      localName,
      textContent: text || children.map((child) => child.textContent).join(''),
      getElementsByTagName: (tag: string) => {
        const descendants = children.flatMap((child) => [child, ...child.getElementsByTagName('*')]);
        return tag === '*' ? descendants : descendants.filter((child) => child.localName === tag);
      },
    });
    const invoiceNode = element('infNFe', '', [
      element('ide', '', [element('nNF', '923')]),
      element('emit', '', [element('CNPJ', '12345678000199')]),
      element('dest', '', [element('CNPJ', '98765432000199')]),
      element('total', '', [element('vNF', '450.00')]),
      element('infAdic', '', [element('infCpl', 'Pedido PED-10')]),
      element('det', '', [element('prod', '', [element('cProd', 'A1'), element('xProd', 'Produto A'), element('vProd', '400.00')])]),
    ]);
    const parserDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
    Object.defineProperty(globalThis, 'DOMParser', {
      configurable: true,
      value: class { parseFromString() { return { getElementsByTagName: (tag: string) => tag === '*' ? [invoiceNode, ...invoiceNode.getElementsByTagName('*')] : [] }; } },
    });
    try {
      assert.deepEqual(parseCommissionInvoiceXml('<NFe/>', [{ ...order, numeroPedido: 'PED-1' }, order]), [{
        numeroPedido: 'PED-10', numeroNota: '923', cnpjEmitente: '12345678000199',
        cnpjCliente: '98765432000199', valorNota: 450,
        itens: [{ codigo: 'A1', descricao: 'Produto A', valorProduto: 400 }],
      }]);
    } finally {
      if (parserDescriptor) Object.defineProperty(globalThis, 'DOMParser', parserDescriptor);
      else Reflect.deleteProperty(globalThis, 'DOMParser');
    }
  });

  it('rejects unsafe XML declarations before parsing and reports missing CSV columns', () => {
    assert.match(parseCommissionCsv('pedido;valor\nPED-10;10').erros[0], /Inclua/);
    assert.throws(() => parseCommissionInvoiceXml('<!DOCTYPE x [<!ENTITY e "bad">]><x/>', []), /não permitidas/);
  });
});
