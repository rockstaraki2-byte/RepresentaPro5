import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.argv.find((arg) => arg.startsWith('--project='))?.slice('--project='.length);
if (!projectId) {
  console.error('Informe explicitamente o projeto: npm run audit:firestore-tenants -- --project=representapro-b84c3');
  process.exit(2);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const companySnapshot = await db.collection('empresas').get();
const companyIds = new Set(companySnapshot.docs.map((document) => document.id));
const collections = ['representadas', 'clientes', 'pedidos', 'produtos', 'meta', 'usuarios'];
const report = {
  projectId,
  companies: companySnapshot.size,
  companyIdMismatches: 0,
  invalidCompanyRecords: 0,
  invalidBusinessRecords: 0,
  invalidMetaIds: 0,
  missingTenantLinks: 0,
  unknownTenantLinks: 0,
  missingOrderOwners: 0,
  unrecognizedOrderOwners: 0,
  invalidUsers: 0,
  nonNormalizedEmails: 0,
  duplicateNormalizedEmails: 0,
  documentsWithLegacySecrets: 0,
};
const permissionFields = [
  'verDashboard', 'verTodasVendas', 'verComissoes', 'verClientes', 'editarClientes',
  'verProdutos', 'editarProdutos', 'verRepresentadas', 'verFinanceiro', 'criarPedidos',
  'editarPedidos', 'excluirPedidos', 'gerenciarUsuarios',
];

for (const document of companySnapshot.docs) {
  const data = document.data();
  if (data.id !== document.id) report.companyIdMismatches += 1;
  if (typeof data.nomeFantasia !== 'string' || typeof data.razaoSocial !== 'string'
    || typeof data.cnpj !== 'string' || typeof data.isDefault !== 'boolean') report.invalidCompanyRecords += 1;
  if (['gmailUser', 'gmailAppPass', 'senha'].some((field) => Object.hasOwn(data, field))) {
    report.documentsWithLegacySecrets += 1;
  }
}

const userRecords = [];
const orderOwners = [];
for (const collectionName of collections) {
  const snapshot = await db.collection(collectionName).get();
  for (const document of snapshot.docs) {
    const data = document.data();
    if (collectionName !== 'empresas' && typeof data.empresaRepresentacaoId !== 'string') {
      report.missingTenantLinks += 1;
    } else if (collectionName !== 'empresas' && !companyIds.has(data.empresaRepresentacaoId)) {
      report.unknownTenantLinks += 1;
    }

    if (collectionName === 'pedidos') {
      if (typeof data.createdByUserId !== 'string') report.missingOrderOwners += 1;
      else orderOwners.push(data.createdByUserId);
    }
    if (collectionName === 'usuarios') {
      const originalEmail = typeof data.email === 'string' ? data.email.trim() : '';
      const normalizedEmail = originalEmail.toLowerCase();
      const validRole = ['Administrador', 'Representante', 'Vendedor'].includes(data.role);
      const permissionsValid = data.permissoes === undefined || (
        data.permissoes && typeof data.permissoes === 'object' && !Array.isArray(data.permissoes)
        && Object.keys(data.permissoes).every((key) => permissionFields.includes(key)
          && typeof data.permissoes[key] === 'boolean')
      );
      if (!normalizedEmail || !validRole || typeof data.ativo !== 'boolean'
        || !/^[^ @]+@[^ @]+\.[^ @]+$/.test(normalizedEmail)
        || !data.empresaRepresentacaoId || data.id !== document.id || !permissionsValid
        || (data.legacyId !== undefined && typeof data.legacyId !== 'string')) {
        report.invalidUsers += 1;
      }
      if (originalEmail && originalEmail !== normalizedEmail) report.nonNormalizedEmails += 1;
      if (normalizedEmail) userRecords.push({ id: document.id, email: normalizedEmail, legacyId: data.legacyId });
      if (['senha', 'gmailUser', 'gmailAppPass'].some((field) => Object.hasOwn(data, field))) {
        report.documentsWithLegacySecrets += 1;
      }
    }
    if (collectionName === 'representadas') {
      if (typeof data.nomeFantasia !== 'string' || typeof data.razaoSocial !== 'string'
        || typeof data.cnpj !== 'string' || typeof data.comissaoPadrao !== 'number'
        || typeof data.telefone !== 'string' || typeof data.email !== 'string'
        || typeof data.segmento !== 'string' || typeof data.contato !== 'string') report.invalidBusinessRecords += 1;
    }
    if (collectionName === 'clientes') {
      if (typeof data.nomeFantasia !== 'string' || typeof data.cnpj !== 'string') report.invalidBusinessRecords += 1;
    }
    if (collectionName === 'produtos') {
      if (typeof data.codigo !== 'string' || typeof data.nome !== 'string'
        || typeof data.precoVenda !== 'number' || typeof data.unidade !== 'string'
        || typeof data.ativo !== 'boolean') report.invalidBusinessRecords += 1;
    }
    if (collectionName === 'pedidos') {
      if (typeof data.numeroPedido !== 'string' || typeof data.clienteId !== 'string'
        || typeof data.representadaId !== 'string' || typeof data.dataPedido !== 'string'
        || !Array.isArray(data.itens) || data.itens.length > 150
        || typeof data.valorTotal !== 'number' || typeof data.comissaoPercentual !== 'number'
        || typeof data.valorComissao !== 'number'
        || typeof data.createdByUserId !== 'string'
        || !['Rascunho', 'Pendente', 'Faturado', 'Pago', 'Cancelado'].includes(data.status)) report.invalidBusinessRecords += 1;
      if ((data.statusComissao !== undefined && !['Pendente', 'Liberada', 'Paga', 'Excluida'].includes(data.statusComissao))
        || (data.foiEnviado !== undefined && typeof data.foiEnviado !== 'boolean')
        || (data.enviadoVia !== undefined && !['E-mail', 'WhatsApp'].includes(data.enviadoVia))) report.invalidBusinessRecords += 1;
    }
    if (collectionName === 'meta') {
      if (typeof data.metaMensal !== 'number' || data.metaMensal < 0 || typeof data.anoMes !== 'string'
        || data.id !== document.id || document.id !== `meta-${data.empresaRepresentacaoId}`) report.invalidMetaIds += 1;
    }
  }
}

const linkedInvitationIds = new Set(userRecords.map((user) => user.legacyId).filter((id) => typeof id === 'string'));
const knownOwnerIds = new Set(userRecords.flatMap((user) => [user.id, user.legacyId].filter((id) => typeof id === 'string')));
const profilesByEmail = new Map();
userRecords.filter((user) => !linkedInvitationIds.has(user.id)).forEach((user) => {
  profilesByEmail.set(user.email, (profilesByEmail.get(user.email) || 0) + 1);
});
report.duplicateNormalizedEmails = [...profilesByEmail.values()].filter((count) => count > 1).length;
report.unrecognizedOrderOwners = orderOwners.filter((id) => !knownOwnerIds.has(id)).length;
console.log(JSON.stringify(report, null, 2));
console.log('Leitura somente. Nenhum documento foi alterado.');
