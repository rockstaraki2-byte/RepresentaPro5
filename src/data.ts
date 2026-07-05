import { Representada, Cliente, Pedido, MetaVendas, Produto } from './types';

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


