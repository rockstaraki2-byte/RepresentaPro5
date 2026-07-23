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
  catalogoUrl?: string; // Base64 PDF data-URI or PDF link
  catalogoNome?: string; // Filename of PDF catalog
  fretePadraoTipo?: 'percentual' | 'fixo' | 'manual' | 'nenhum';
  fretePadraoValor?: number;
  freteModalidadePadrao?: 'FOB' | 'CIF' | 'Sem Frete';
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
  tipoFaturamento?: 'Nota Fiscal' | 'Notinha'; // Opção de Faturamento (Nota Fiscal x Notinha)
  empresaRepresentacaoId?: string; // Multi-tenant link
}

export interface OrderItem {
  id: string;
  codigo?: string;
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
  valorSubtotal?: number; // Soma do valor total dos produtos
  tipoFaturamento?: 'Nota Fiscal' | 'Notinha'; // Faturamento com ou sem Nota Fiscal
  opcaoFrete?: 'percentual' | 'fixo' | 'manual' | 'nenhum'; // Método de cálculo
  tipoFrete?: 'FOB' | 'CIF' | 'Sem Frete'; // Modalidade de frete (Destinatário vs Emitente)
  valorFrete?: number; // Valor calculado em R$
  percentualFrete?: number; // % caso opção seja percentual
  freteSomarNoTotal?: boolean; // Se o valor do frete é somado ao total final do pedido
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

export interface UserPermissions {
  verDashboard?: boolean;
  verTodasVendas?: boolean;
  verComissoes?: boolean;
  verClientes?: boolean;
  editarClientes?: boolean;
  verProdutos?: boolean;
  editarProdutos?: boolean;
  verRepresentadas?: boolean;
  verFinanceiro?: boolean;
  criarPedidos?: boolean;
  editarPedidos?: boolean;
  excluirPedidos?: boolean;
  gerenciarUsuarios?: boolean;
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
  permissoes?: UserPermissions;
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


