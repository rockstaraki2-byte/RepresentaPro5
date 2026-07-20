export interface Representada {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  comissaoPadrao: number; // Porcentagem, ex: 5% -> 5
  telefone: string;
  email: string;
  segmento: string;
  contato: string;
  logoUrl?: string; // Base64 data-URI or standard image URL
  empresaRepresentacaoId?: string; // Multi-tenant link
}

export interface Cliente {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  contato: string;
  empresaRepresentacaoId?: string; // Multi-tenant link
}

export interface OrderItem {
  id: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  totalItem: number;
  cor?: string;
  variacao?: string;
}

export type PedidoStatus = 'Rascunho' | 'Pendente' | 'Faturado' | 'Pago' | 'Cancelado';

export interface Pedido {
  id: string;
  numeroPedido: string;
  clienteId: string;
  representadaId: string;
  dataPedido: string; // YYYY-MM-DD
  itens: OrderItem[];
  valorTotal: number;
  comissaoPercentual: number; // Porcentagem de comissão deste pedido
  valorComissao: number; // Calculado: valorTotal * (comissaoPercentual / 100)
  status: PedidoStatus;
  statusComissao?: 'Pendente' | 'Liberada' | 'Paga' | 'Excluida';
  observacoes?: string;
  condicoesPagamento?: string;
  empresaRepresentacaoId?: string; // Multi-tenant link
  createdByUserId?: string; // User who created this order
}

export interface MetaVendas {
  metaMensal: number;
  anoMes: string; // Formato YYYY-MM
  empresaRepresentacaoId?: string; // Multi-tenant link
}

export interface Produto {
  id: string;
  codigo: string;         // SKU ou Código interno
  nome: string;           // Nome do produto
  representadaId?: string; // ID da representada fabricante (opcional)
  precoVenda: number;     // Preço sugerido de venda
  unidade: string;        // Unidade (Un, Cx, Kg, FD, etc.)
  descricao?: string;     // Detalhes ou especificações
  ativo: boolean;         // Se o produto está disponível para venda
  empresaRepresentacaoId?: string; // Multi-tenant link
  cor?: string;           // Opções de cor
  variacao?: string;      // Variações/Tamanho
}

// User role access levels
export type UserRole = 'Administrador' | 'Representante' | 'Vendedor';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  empresaRepresentacaoId?: string; // Associated company
  senha?: string; // Password for non-admin users
}

// Representation Company / Entity (Razões Sociais da Representação)
export interface EmpresaRepresentacao {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  uf: string;
  isDefault: boolean;
  logoUrl?: string; // base64 data-URI or standard image URL
  corPrimaria?: string; // Hex color code for the primary palette
  gmailUser?: string;
  gmailAppPass?: string;
}


