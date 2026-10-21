import { Cliente, EmpresaRepresentacao, MetaVendas, Pedido, Produto, Representada, Usuario } from './types';

/**
 * Synthetic records used only by the ?demo=1 presentation mode.
 * These records never leave the browser and intentionally use .invalid contacts.
 */
export const DEMO_EMPRESA_ID = 'demo-emp';

export const DEMO_REPRESENTADAS: Representada[] = [
  {
    id: 'demo-rep-1',
    nomeFantasia: 'Aurora Ferragens DEMO',
    razaoSocial: 'Aurora Ferragens de Demonstração Ltda',
    cnpj: '00.000.000/0001-01',
    comissaoPadrao: 5.5,
    telefone: '(00) 00000-1001',
    email: 'comercial@aurora-ferragens.example.invalid',
    segmento: 'Ferragens e construção',
    contato: 'Contato comercial DEMO'
  },
  {
    id: 'demo-rep-2',
    nomeFantasia: 'Nexo Casa & Design DEMO',
    razaoSocial: 'Nexo Casa e Design de Demonstração Ltda',
    cnpj: '00.000.000/0001-02',
    comissaoPadrao: 7.0,
    telefone: '(00) 00000-1002',
    email: 'vendas@nexo-design.example.invalid',
    segmento: 'Móveis e decoração',
    contato: 'Equipe de vendas DEMO'
  },
  {
    id: 'demo-rep-3',
    nomeFantasia: 'Lume Utilidades DEMO',
    razaoSocial: 'Lume Utilidades Domésticas de Demonstração Ltda',
    cnpj: '00.000.000/0001-03',
    comissaoPadrao: 8.0,
    telefone: '(00) 00000-1003',
    email: 'pedidos@lume-utilidades.example.invalid',
    segmento: 'Utilidades e organização',
    contato: 'Atendimento DEMO'
  }
].map(item => ({ ...item, empresaRepresentacaoId: DEMO_EMPRESA_ID }));

export const DEMO_CLIENTES: Cliente[] = [
  {
    id: 'demo-cli-1',
    nomeFantasia: 'Casa Horizonte DEMO',
    razaoSocial: 'Casa Horizonte Comércio de Demonstração Ltda',
    cnpj: '00.000.000/0001-11',
    endereco: 'Rua das Acácias, 120 - Centro',
    cidade: 'Cidade Modelo',
    uf: 'MG',
    telefone: '(00) 00000-1101',
    email: 'compras@casa-horizonte.example.invalid',
    contato: 'Compras DEMO'
  },
  {
    id: 'demo-cli-2',
    nomeFantasia: 'Studio Nexo DEMO',
    razaoSocial: 'Studio Nexo Ambientes de Demonstração Ltda',
    cnpj: '00.000.000/0001-12',
    endereco: 'Avenida Central, 450 - Jardins',
    cidade: 'Cidade Modelo',
    uf: 'SP',
    telefone: '(00) 00000-1102',
    email: 'pedidos@studio-nexo.example.invalid',
    contato: 'Operação DEMO'
  },
  {
    id: 'demo-cli-3',
    nomeFantasia: 'Constrular Vértice DEMO',
    razaoSocial: 'Constrular Vértice Materiais de Demonstração Ltda',
    cnpj: '00.000.000/0001-13',
    endereco: 'Rua do Comércio, 880 - Industrial',
    cidade: 'Cidade Modelo',
    uf: 'PR',
    telefone: '(00) 00000-1103',
    email: 'suprimentos@constrular-vertice.example.invalid',
    contato: 'Suprimentos DEMO'
  },
  {
    id: 'demo-cli-4',
    nomeFantasia: 'Showroom Lume DEMO',
    razaoSocial: 'Showroom Lume Ambientes de Demonstração Ltda',
    cnpj: '00.000.000/0001-14',
    endereco: 'Alameda do Design, 32 - Vila Nova',
    cidade: 'Cidade Modelo',
    uf: 'RJ',
    telefone: '(00) 00000-1104',
    email: 'operacao@showroom-lume.example.invalid',
    contato: 'Gestão DEMO'
  },
  {
    id: 'demo-cli-5',
    nomeFantasia: 'Rede Prisma DEMO',
    razaoSocial: 'Rede Prisma Varejo de Demonstração Ltda',
    cnpj: '00.000.000/0001-15',
    endereco: 'Praça das Flores, 210 - Centro',
    cidade: 'Cidade Modelo',
    uf: 'SC',
    telefone: '(00) 00000-1105',
    email: 'compras@rede-prisma.example.invalid',
    contato: 'Compras DEMO'
  }
].map(item => ({ ...item, empresaRepresentacaoId: DEMO_EMPRESA_ID }));

export const DEMO_PEDIDOS: Pedido[] = [
  {
    id: 'demo-ped-1',
    numeroPedido: 'DEMO-1001',
    clienteId: 'demo-cli-1',
    representadaId: 'demo-rep-2',
    dataPedido: '2026-09-02',
    itens: [
      { id: 'demo-item-1a', codigo: 'NEX-101', descricao: 'Mesa Nexo 120', quantidade: 20, precoUnitario: 820, totalItem: 16400 },
      { id: 'demo-item-1b', codigo: 'NEX-102', descricao: 'Painel Prisma 90', quantidade: 10, precoUnitario: 810, totalItem: 8100 }
    ],
    valorTotal: 24500,
    comissaoPercentual: 7,
    valorComissao: 1715,
    status: 'Pago',
    statusComissao: 'Paga',
    observacoes: 'Entrega programada para a semana 38.'
  },
  {
    id: 'demo-ped-2',
    numeroPedido: 'DEMO-1002',
    clienteId: 'demo-cli-2',
    representadaId: 'demo-rep-1',
    dataPedido: '2026-09-04',
    itens: [
      { id: 'demo-item-2a', codigo: 'AUR-201', descricao: 'Kit Trilho Prisma', quantidade: 60, precoUnitario: 210, totalItem: 12600 },
      { id: 'demo-item-2b', codigo: 'AUR-202', descricao: 'Suporte Atlas 40', quantidade: 240, precoUnitario: 80, totalItem: 19200 }
    ],
    valorTotal: 31800,
    comissaoPercentual: 5.5,
    valorComissao: 1749,
    status: 'Faturado',
    statusComissao: 'Liberada',
    observacoes: 'Faturamento em 28 dias.'
  },
  {
    id: 'demo-ped-3',
    numeroPedido: 'DEMO-1003',
    clienteId: 'demo-cli-3',
    representadaId: 'demo-rep-3',
    dataPedido: '2026-09-06',
    itens: [
      { id: 'demo-item-3a', codigo: 'LUM-301', descricao: 'Organizador Modular Lume', quantidade: 45, precoUnitario: 420, totalItem: 18900 }
    ],
    valorTotal: 18900,
    comissaoPercentual: 8,
    valorComissao: 1512,
    status: 'Pendente',
    statusComissao: 'Pendente',
    observacoes: 'Aguardando aprovação do cliente.'
  },
  {
    id: 'demo-ped-4',
    numeroPedido: 'DEMO-1004',
    clienteId: 'demo-cli-4',
    representadaId: 'demo-rep-2',
    dataPedido: '2026-09-08',
    itens: [
      { id: 'demo-item-4a', codigo: 'NEX-120', descricao: 'Balcão Vértice 180', quantidade: 25, precoUnitario: 1120, totalItem: 28000 },
      { id: 'demo-item-4b', codigo: 'NEX-121', descricao: 'Estante Lume 5P', quantidade: 18, precoUnitario: 819.44, totalItem: 14750 }
    ],
    valorTotal: 42750,
    comissaoPercentual: 7,
    valorComissao: 2992.5,
    status: 'Faturado',
    statusComissao: 'Liberada',
    observacoes: 'Pedido com prioridade de exposição.'
  },
  {
    id: 'demo-ped-5',
    numeroPedido: 'DEMO-1005',
    clienteId: 'demo-cli-5',
    representadaId: 'demo-rep-1',
    dataPedido: '2026-09-10',
    itens: [
      { id: 'demo-item-5a', codigo: 'AUR-245', descricao: 'Alicate Atlas Profissional', quantidade: 120, precoUnitario: 184.5, totalItem: 22140 }
    ],
    valorTotal: 22140,
    comissaoPercentual: 5.5,
    valorComissao: 1217.7,
    status: 'Pago',
    statusComissao: 'Paga'
  },
  {
    id: 'demo-ped-6',
    numeroPedido: 'DEMO-1006',
    clienteId: 'demo-cli-1',
    representadaId: 'demo-rep-2',
    dataPedido: '2026-09-12',
    itens: [
      { id: 'demo-item-6a', codigo: 'NEX-150', descricao: 'Estante Lume 5P', quantidade: 44, precoUnitario: 817.27, totalItem: 35960 }
    ],
    valorTotal: 35960,
    comissaoPercentual: 7,
    valorComissao: 2517.2,
    status: 'Faturado',
    statusComissao: 'Liberada'
  },
  {
    id: 'demo-ped-7',
    numeroPedido: 'DEMO-1007',
    clienteId: 'demo-cli-2',
    representadaId: 'demo-rep-3',
    dataPedido: '2026-09-16',
    itens: [
      { id: 'demo-item-7a', codigo: 'LUM-330', descricao: 'Kit Organizadores Lume', quantidade: 60, precoUnitario: 210, totalItem: 12600 }
    ],
    valorTotal: 12600,
    comissaoPercentual: 8,
    valorComissao: 1008,
    status: 'Pendente',
    statusComissao: 'Pendente'
  },
  {
    id: 'demo-ped-8',
    numeroPedido: 'DEMO-1008',
    clienteId: 'demo-cli-3',
    representadaId: 'demo-rep-1',
    dataPedido: '2026-09-18',
    itens: [
      { id: 'demo-item-8a', codigo: 'AUR-280', descricao: 'Suporte Atlas 40', quantidade: 150, precoUnitario: 190, totalItem: 28500 }
    ],
    valorTotal: 28500,
    comissaoPercentual: 5.5,
    valorComissao: 1567.5,
    status: 'Rascunho',
    statusComissao: 'Pendente',
    observacoes: 'Cotação em revisão pelo cliente.'
  }
].map(item => ({ ...item, empresaRepresentacaoId: DEMO_EMPRESA_ID, createdByUserId: 'demo-admin' }) as Pedido);

export const DEMO_METAS: MetaVendas = {
  metaMensal: 180000,
  anoMes: '2026-09',
  empresaRepresentacaoId: DEMO_EMPRESA_ID
};

export const DEMO_PRODUTOS: Produto[] = [
  { id: 'demo-prod-1', codigo: 'AUR-201', nome: 'Kit Trilho Prisma', representadaId: 'demo-rep-1', precoVenda: 210, unidade: 'Kit', descricao: 'Kit de trilhos com acabamento grafite.', ativo: true },
  { id: 'demo-prod-2', codigo: 'AUR-202', nome: 'Suporte Atlas 40', representadaId: 'demo-rep-1', precoVenda: 80, unidade: 'Un', descricao: 'Suporte estrutural para montagem.', ativo: true },
  { id: 'demo-prod-3', codigo: 'NEX-101', nome: 'Mesa Nexo 120', representadaId: 'demo-rep-2', precoVenda: 820, unidade: 'Un', descricao: 'Mesa modular para ambientes comerciais.', ativo: true },
  { id: 'demo-prod-4', codigo: 'NEX-120', nome: 'Balcão Vértice 180', representadaId: 'demo-rep-2', precoVenda: 1120, unidade: 'Un', descricao: 'Balcão expositor com acabamento fosco.', ativo: true },
  { id: 'demo-prod-5', codigo: 'LUM-301', nome: 'Organizador Modular Lume', representadaId: 'demo-rep-3', precoVenda: 420, unidade: 'Un', descricao: 'Organizador modular para varejo.', ativo: true },
  { id: 'demo-prod-6', codigo: 'LUM-330', nome: 'Kit Organizadores Lume', representadaId: 'demo-rep-3', precoVenda: 210, unidade: 'Kit', descricao: 'Kit de organizadores para exposição.', ativo: true }
].map(item => ({ ...item, empresaRepresentacaoId: DEMO_EMPRESA_ID }));

export const DEMO_EMPRESAS: EmpresaRepresentacao[] = [
  {
    id: DEMO_EMPRESA_ID,
    nomeFantasia: 'Planalto Comercial • DEMO',
    razaoSocial: 'Planalto Comercial Ambiente de Demonstração Ltda',
    cnpj: '00.000.000/0001-90',
    telefone: '(00) 00000-1090',
    email: 'demo@planalto-comercial.example.invalid',
    endereco: 'Avenida Fictícia, 100 - Centro',
    cidade: 'Cidade Modelo',
    uf: 'MG',
    isDefault: true
  }
];

export const DEMO_USUARIOS: Usuario[] = [
  {
    id: 'demo-admin',
    nome: 'Raul (DEMO)',
    email: 'raul.demo@example.invalid',
    role: 'Administrador',
    ativo: true,
    empresaRepresentacaoId: DEMO_EMPRESA_ID
  }
];


export const DEMO_NOTIFICACOES = [
  {
    id: 'demo-notif-1',
    title: 'Meta mensal em alta',
    message: 'O ambiente DEMO já alcançou 120% da meta mensal configurada.',
    type: 'order' as const,
    timestamp: '2026-09-21T09:20:00-03:00',
    read: false
  },
  {
    id: 'demo-notif-2',
    title: 'Comissão liberada',
    message: 'A comissão do pedido DEMO-1004 foi liberada para conferência.',
    type: 'commission' as const,
    timestamp: '2026-09-20T16:10:00-03:00',
    read: false
  }
];
