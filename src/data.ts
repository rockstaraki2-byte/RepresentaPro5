import { Representada, Cliente, Pedido, MetaVendas, Produto, EmpresaRepresentacao, Usuario } from './types';

export const SEED_REPRESENTADAS: Representada[] = [
  {
    id: 'rep-1',
    nomeFantasia: 'Metalúrgica Alfa',
    razaoSocial: 'Alfa Componentes Metalúrgicos S/A',
    cnpj: '12.345.678/0001-90',
    comissaoPadrao: 5.0,
    telefone: '(11) 3456-7890',
    email: 'comercial@metalurgicaalfa.com.br',
    segmento: 'Ferragens e Construção',
    contato: 'Carlos Eduardo (Gerente de Vendas)'
  },
  {
    id: 'rep-2',
    nomeFantasia: 'Alimentos Sul',
    razaoSocial: 'Distribuidora de Alimentos Sul Ltda',
    cnpj: '98.765.432/0001-10',
    comissaoPadrao: 8.0,
    telefone: '(51) 3211-5500',
    email: 'pedidos@alimentossul.com.br',
    segmento: 'Alimentos e Bebidas',
    contato: 'Mariana Costa (Diretora Comercial)'
  },
  {
    id: 'rep-3',
    nomeFantasia: 'Fio de Ouro Têxtil',
    razaoSocial: 'Indústria Têxtil Fio de Ouro EIRELI',
    cnpj: '45.678.901/0001-23',
    comissaoPadrao: 6.5,
    telefone: '(47) 3344-1234',
    email: 'vendas@fiodeouro.ind.br',
    segmento: 'Confecção e Moda',
    contato: 'Renato Borges (Supervisor)'
  }
];

export const SEED_CLIENTES: Cliente[] = [
  {
    id: 'cli-1',
    nomeFantasia: 'Supermercado Silva',
    razaoSocial: 'Silva & Filhos Supermercados Ltda',
    cnpj: '23.456.789/0001-44',
    endereco: 'Av. das Américas, 1500 - Centro',
    cidade: 'Campinas',
    uf: 'SP',
    telefone: '(19) 3876-1122',
    email: 'compras@supermercadosilva.com.br',
    contato: 'Roberto Silva (Comprador)'
  },
  {
    id: 'cli-2',
    nomeFantasia: 'Ferragens Central',
    razaoSocial: 'Ferragens e Ferramentas Central Belo Horizonte S/A',
    cnpj: '87.654.321/0002-88',
    endereco: 'Rua Paraná, 450 - Barro Preto',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    telefone: '(31) 3412-9080',
    email: 'contato@ferragenscentral.com.br',
    contato: 'Juliana Vieira (Suprimentos)'
  },
  {
    id: 'cli-3',
    nomeFantasia: 'Boutique Elegance',
    razaoSocial: 'Elegance Vestuário e Acessórios de Moda Ltda',
    cnpj: '34.567.890/0001-11',
    endereco: 'Alameda Lorena, 88 - Batel',
    cidade: 'Curitiba',
    uf: 'PR',
    telefone: '(41) 3022-8877',
    email: 'elegance@boutiqueelegance.com.br',
    contato: 'Camila Peixoto (Proprietária)'
  }
];

export const SEED_PEDIDOS: Pedido[] = [
  {
    id: 'ped-1',
    numeroPedido: '1001-A',
    clienteId: 'cli-1',
    representadaId: 'rep-2',
    dataPedido: '2026-06-15',
    itens: [
      { id: 'item-1-1', descricao: 'Caixa Óleo de Soja 20x900ml', quantidade: 50, precoUnitario: 120.00, totalItem: 6000.00 },
      { id: 'item-1-2', descricao: 'Fardo de Arroz Tipo 1 5kg (c/10)', quantidade: 40, precoUnitario: 170.00, totalItem: 6800.00 }
    ],
    valorTotal: 12800.00,
    comissaoPercentual: 8.0,
    valorComissao: 1024.00,
    status: 'Pago',
    observacoes: 'Entrega urgente programada para o galpão B.'
  },
  {
    id: 'ped-2',
    numeroPedido: '20455',
    clienteId: 'cli-2',
    representadaId: 'rep-1',
    dataPedido: '2026-06-20',
    itens: [
      { id: 'item-2-1', descricao: 'Parafuso Sextavado de Aço (Milheiro)', quantidade: 10, precoUnitario: 350.00, totalItem: 3500.00 },
      { id: 'item-2-2', descricao: 'Broca de Metal Duro 8mm (Haste Cilíndrica)', quantidade: 100, precoUnitario: 45.00, totalItem: 4500.00 },
      { id: 'item-2-3', descricao: 'Jogo de Chaves Combinadas 6-32mm', quantidade: 15, precoUnitario: 290.00, totalItem: 4350.00 }
    ],
    valorTotal: 12350.00,
    comissaoPercentual: 5.0,
    valorComissao: 617.50,
    status: 'Faturado',
    observacoes: 'Faturamento direto faturado em 28/56 dias.'
  },
  {
    id: 'ped-3',
    numeroPedido: 'TX-902',
    clienteId: 'cli-3',
    representadaId: 'rep-3',
    dataPedido: '2026-06-28',
    itens: [
      { id: 'item-3-1', descricao: 'Rolo de Tecido Viscose Estampada (50m)', quantidade: 8, precoUnitario: 850.00, totalItem: 6800.00 },
      { id: 'item-3-2', descricao: 'Rolo de Tecido Linho Misto Cru (50m)', quantidade: 5, precoUnitario: 1200.00, totalItem: 6000.00 }
    ],
    valorTotal: 12800.00,
    comissaoPercentual: 6.5,
    valorComissao: 832.00,
    status: 'Pendente',
    observacoes: 'Aguardando liberação de limite cadastral na fábrica.'
  },
  {
    id: 'ped-4',
    numeroPedido: '20499',
    clienteId: 'cli-2',
    representadaId: 'rep-1',
    dataPedido: '2026-07-01',
    itens: [
      { id: 'item-4-1', descricao: 'Alicate Universal Isolado de 8 Polegadas', quantidade: 200, precoUnitario: 38.00, totalItem: 7600.00 },
      { id: 'item-4-2', descricao: 'Arco de Serra Regulável de 12 Polegadas', quantidade: 100, precoUnitario: 24.50, totalItem: 2450.00 }
    ],
    valorTotal: 10050.00,
    comissaoPercentual: 5.0,
    valorComissao: 502.50,
    status: 'Pendente'
  }
];

export const SEED_METAS: MetaVendas = {
  metaMensal: 60000.00,
  anoMes: '2026-07'
};

export const SEED_PRODUTOS: Produto[] = [
  {
    id: 'prod-1',
    codigo: 'ALF-001',
    nome: 'Parafuso Sextavado de Aço (Milheiro)',
    representadaId: 'rep-1',
    precoVenda: 350.00,
    unidade: 'Milheiro',
    descricao: 'Parafuso sextavado zincado de alta resistência.',
    ativo: true
  },
  {
    id: 'prod-2',
    codigo: 'ALF-002',
    nome: 'Broca de Metal Duro 8mm (Haste Cilíndrica)',
    representadaId: 'rep-1',
    precoVenda: 45.00,
    unidade: 'Un',
    descricao: 'Broca profissional para furação de alta velocidade em metais ferrosos.',
    ativo: true
  },
  {
    id: 'prod-3',
    codigo: 'ALF-003',
    nome: 'Jogo de Chaves Combinadas 6-32mm',
    representadaId: 'rep-1',
    precoVenda: 290.00,
    unidade: 'Jogo',
    descricao: 'Estojo com 15 chaves combinadas em aço cromo vanádio.',
    ativo: true
  },
  {
    id: 'prod-4',
    codigo: 'ALF-004',
    nome: 'Alicate Universal Isolado de 8 Polegadas',
    representadaId: 'rep-1',
    precoVenda: 38.00,
    unidade: 'Un',
    descricao: 'Alicate isolado 1000V de alta qualidade.',
    ativo: true
  },
  {
    id: 'prod-5',
    codigo: 'ALF-005',
    nome: 'Arco de Serra Regulável de 12 Polegadas',
    representadaId: 'rep-1',
    precoVenda: 24.50,
    unidade: 'Un',
    descricao: 'Arco de serra profissional com regulagem e cabo anatômico.',
    ativo: true
  },
  {
    id: 'prod-6',
    codigo: 'SUL-101',
    nome: 'Caixa Óleo de Soja 20x900ml',
    representadaId: 'rep-2',
    precoVenda: 120.00,
    unidade: 'Cx',
    descricao: 'Óleo de soja refinado tradicional, caixa com 20 unidades de 900ml.',
    ativo: true
  },
  {
    id: 'prod-7',
    codigo: 'SUL-102',
    nome: 'Fardo de Arroz Tipo 1 5kg (c/10)',
    representadaId: 'rep-2',
    precoVenda: 170.00,
    unidade: 'FD',
    descricao: 'Fardo de arroz agulhinha tipo 1, contendo 10 pacotes de 5kg.',
    ativo: true
  },
  {
    id: 'prod-8',
    codigo: 'SUL-103',
    nome: 'Fardo de Feijão Carioca 1kg (c/30)',
    representadaId: 'rep-2',
    precoVenda: 195.00,
    unidade: 'FD',
    descricao: 'Fardo de feijão carioca novo classe comercial, contendo 30 pacotes de 1kg.',
    ativo: true
  },
  {
    id: 'prod-9',
    codigo: 'TXT-201',
    nome: 'Rolo de Tecido Viscose Estampada (50m)',
    representadaId: 'rep-3',
    precoVenda: 850.00,
    unidade: 'Rolo',
    descricao: 'Tecido viscose 100% com estampas florais de coleção.',
    ativo: true
  },
  {
    id: 'prod-10',
    codigo: 'TXT-202',
    nome: 'Rolo de Tecido Linho Misto Cru (50m)',
    representadaId: 'rep-3',
    precoVenda: 1200.00,
    unidade: 'Rolo',
    descricao: 'Tecido linho misto de alto padrão para camisaria e decoração.',
    ativo: true
  }
];

export const SEED_EMPRESAS = [
  {
    id: 'emp-1',
    nomeFantasia: 'Planalto Representações',
    razaoSocial: 'Planalto Representações e Negócios Comerciais Ltda',
    cnpj: '45.123.890/0001-44',
    telefone: '(11) 98765-4321',
    email: 'comercial@planalto.rep.br',
    endereco: 'Av. Paulista, 1000 - Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    isDefault: true
  },
  {
    id: 'emp-2',
    nomeFantasia: 'Vanguard Vendas',
    razaoSocial: 'Vanguard Intermediação de Negócios S/A',
    cnpj: '12.098.765/0001-09',
    telefone: '(47) 3222-1111',
    email: 'contato@vanguardvendas.com.br',
    endereco: 'Rua XV de Novembro, 250 - Centro',
    cidade: 'Blumenau',
    uf: 'SC',
    isDefault: false
  }
];

export const SEED_USUARIOS = [
  {
    id: 'usr-raul',
    nome: 'Raul',
    email: 'raul',
    role: 'Administrador' as const,
    ativo: true,
    senha: '230213'
  },
  {
    id: 'usr-1',
    nome: 'André Gestor (Planalto)',
    email: 'andre@planalto.rep.br',
    role: 'Administrador' as const,
    ativo: true,
    empresaRepresentacaoId: 'emp-1'
  },
  {
    id: 'usr-2',
    nome: 'Bruno Vendedor (Planalto)',
    email: 'bruno@planalto.rep.br',
    role: 'Vendedor' as const,
    ativo: true,
    empresaRepresentacaoId: 'emp-1',
    senha: '123456'
  },
  {
    id: 'usr-3',
    nome: 'Carla Representante (Planalto)',
    email: 'carla@planalto.rep.br',
    role: 'Representante' as const,
    ativo: true,
    empresaRepresentacaoId: 'emp-1',
    senha: '123456'
  },
  {
    id: 'usr-4',
    nome: 'Daniel Gestor (Vanguard)',
    email: 'daniel@vanguardvendas.com.br',
    role: 'Administrador' as const,
    ativo: true,
    empresaRepresentacaoId: 'emp-2'
  },
  {
    id: 'usr-5',
    nome: 'Eduardo Vendedor (Vanguard)',
    email: 'eduardo@vanguardvendas.com.br',
    role: 'Vendedor' as const,
    ativo: true,
    empresaRepresentacaoId: 'emp-2',
    senha: '123456'
  }
];




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
].map(item => ({ ...item, empresaRepresentacaoId: DEMO_EMPRESA_ID, createdByUserId: 'demo-admin' }));

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
    empresaRepresentacaoId: DEMO_EMPRESA_ID,
    senha: 'demo'
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
