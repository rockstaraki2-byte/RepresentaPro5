import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const projectId = 'demo-representapro-security';
let environment;

const profile = (id, email, company, role = 'Vendedor', permissions = {}) => ({
  id,
  nome: id,
  email,
  role,
  ativo: true,
  empresaRepresentacaoId: company,
  permissoes: permissions,
});

const client = (id, company) => ({
  id,
  nomeFantasia: `Cliente ${id}`,
  cnpj: '00000000000000',
  empresaRepresentacaoId: company,
});

const order = (id, company, owner) => ({
  id,
  numeroPedido: id,
  clienteId: 'client-a',
  representadaId: 'rep-a',
  dataPedido: '2026-10-21',
  itens: [],
  valorTotal: 100,
  comissaoPercentual: 5,
  valorComissao: 5,
  status: 'Pendente',
  empresaRepresentacaoId: company,
  createdByUserId: owner,
});

const lead = (id, company, owner) => ({
  id,
  empresaRepresentacaoId: company,
  nomeFantasia: `Lead ${id}`,
  cnpj: '00000000000000',
  etapa: 'Novo',
  responsavelUserId: owner,
  criadoPorUserId: owner,
  criadoEm: '2026-10-26T10:00:00.000Z',
  atualizadoEm: '2026-10-26T10:00:00.000Z',
});

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'usuarios', 'admin-a'), profile('admin-a', 'admin-a@example.com', 'tenant-a', 'Administrador'));
    await setDoc(doc(db, 'usuarios', 'seller-a-uid'), profile('seller-a-uid', 'seller-a@example.com', 'tenant-a', 'Vendedor', { verTodasVendas: false }));
    await setDoc(doc(db, 'usuarios', 'manager-a-uid'), profile('manager-a-uid', 'manager-a@example.com', 'tenant-a', 'Vendedor', { gerenciarUsuarios: true }));
    await setDoc(doc(db, 'usuarios', 'admin-b'), profile('admin-b', 'admin-b@example.com', 'tenant-b', 'Administrador'));
    await setDoc(doc(db, 'usuarios', 'rep-a-uid'), profile('rep-a-uid', 'rep-a@example.com', 'tenant-a', 'Representante'));
    await setDoc(doc(db, 'usuarios', 'no-leads-uid'), profile('no-leads-uid', 'no-leads@example.com', 'tenant-a', 'Vendedor', { verLeads: false, editarLeads: false }));
    await setDoc(doc(db, 'clientes', 'client-a'), client('client-a', 'tenant-a'));
    await setDoc(doc(db, 'clientes', 'client-b'), client('client-b', 'tenant-b'));
    await setDoc(doc(db, 'pedidos', 'order-seller-a'), order('order-seller-a', 'tenant-a', 'seller-a-uid'));
    await setDoc(doc(db, 'pedidos', 'order-seller-b'), order('order-seller-b', 'tenant-a', 'someone-else'));
    await setDoc(doc(db, 'pedidos', 'order-tenant-b'), order('order-tenant-b', 'tenant-b', 'other-uid'));
    await setDoc(doc(db, 'leads', 'lead-seller-a'), lead('lead-seller-a', 'tenant-a', 'seller-a-uid'));
    await setDoc(doc(db, 'leads', 'lead-seller-b'), lead('lead-seller-b', 'tenant-a', 'someone-else'));
    await setDoc(doc(db, 'leads', 'lead-tenant-b'), lead('lead-tenant-b', 'tenant-b', 'other-uid'));
  });
});

after(async () => {
  await environment.cleanup();
});

test('denies anonymous reads and writes', async () => {
  const db = environment.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(db, 'clientes')));
  await assertFails(setDoc(doc(db, 'clientes', 'anon-client'), client('anon-client', 'tenant-a')));
});

test('requires a tenant filter and prevents cross-tenant reads', async () => {
  const db = environment.authenticatedContext('admin-a', {
    email: 'admin-a@example.com',
    email_verified: true,
  }).firestore();

  const ownQuery = query(collection(db, 'clientes'), where('empresaRepresentacaoId', '==', 'tenant-a'));
  const ownResults = await assertSucceeds(getDocs(ownQuery));
  assert.equal(ownResults.size, 1);
  await assertFails(getDocs(collection(db, 'clientes')));
  await assertFails(getDoc(doc(db, 'clientes', 'client-b')));
});

test('enforces tenant scope and edit permissions for writes', async () => {
  const db = environment.authenticatedContext('admin-a', {
    email: 'admin-a@example.com',
    email_verified: true,
  }).firestore();

  await assertSucceeds(setDoc(doc(db, 'clientes', 'new-client-a'), client('new-client-a', 'tenant-a')));
  await assertFails(setDoc(doc(db, 'clientes', 'new-client-b'), client('new-client-b', 'tenant-b')));
  await assertFails(updateDoc(doc(db, 'clientes', 'client-a'), { empresaRepresentacaoId: 'tenant-b' }));
});

test('lets a tenant administrator manage only profiles in the same tenant', async () => {
  const db = environment.authenticatedContext('admin-a', {
    email: 'admin-a@example.com',
    email_verified: true,
  }).firestore();

  await assertSucceeds(updateDoc(doc(db, 'usuarios', 'seller-a-uid'), { nome: 'Vendedor Atualizado' }));
  await assertFails(updateDoc(doc(db, 'usuarios', 'admin-b'), { nome: 'Alteração cruzada' }));
});

test('does not let a delegated user manager grant themselves more access', async () => {
  const db = environment.authenticatedContext('manager-a-uid', {
    email: 'manager-a@example.com',
    email_verified: true,
  }).firestore();

  await assertSucceeds(updateDoc(doc(db, 'usuarios', 'seller-a-uid'), { nome: 'Outro Vendedor' }));
  await assertFails(updateDoc(doc(db, 'usuarios', 'manager-a-uid'), {
    permissoes: { gerenciarUsuarios: true, verTodasVendas: true },
  }));
});

test('limits a seller to orders they created', async () => {
  const db = environment.authenticatedContext('seller-a-uid', {
    email: 'seller-a@example.com',
    email_verified: true,
  }).firestore();

  const ownOrders = query(
    collection(db, 'pedidos'),
    where('empresaRepresentacaoId', '==', 'tenant-a'),
    where('createdByUserId', 'in', ['seller-a-uid']),
  );
  const results = await assertSucceeds(getDocs(ownOrders));
  assert.deepEqual(results.docs.map((item) => item.id), ['order-seller-a']);
  await assertFails(getDocs(query(collection(db, 'pedidos'), where('empresaRepresentacaoId', '==', 'tenant-a'))));
  await assertFails(getDoc(doc(db, 'pedidos', 'order-seller-b')));
});

test('permits the verified system administrator to inspect all tenants', async () => {
  const db = environment.authenticatedContext('system-admin-uid', {
    email: 'rockstaraki2@gmail.com',
    email_verified: true,
  }).firestore();

  const results = await assertSucceeds(getDocs(collection(db, 'clientes')));
  assert.equal(results.size, 2);
  await assertSucceeds(getDoc(doc(db, 'clientes', 'client-b')));
});

test('scopes leads by tenant and responsible seller', async () => {
  const sellerDb = environment.authenticatedContext('seller-a-uid', {
    email: 'seller-a@example.com',
    email_verified: true,
  }).firestore();

  const ownLeads = query(
    collection(sellerDb, 'leads'),
    where('empresaRepresentacaoId', '==', 'tenant-a'),
    where('responsavelUserId', 'in', ['seller-a-uid']),
  );
  const ownResults = await assertSucceeds(getDocs(ownLeads));
  assert.deepEqual(ownResults.docs.map((item) => item.id), ['lead-seller-a']);
  await assertFails(getDocsFromServer(query(collection(sellerDb, 'leads'), where('empresaRepresentacaoId', '==', 'tenant-a'))));
  await assertFails(getDoc(doc(sellerDb, 'leads', 'lead-seller-b')));
  await assertFails(getDoc(doc(sellerDb, 'leads', 'lead-tenant-b')));

  const representativeDb = environment.authenticatedContext('rep-a-uid', {
    email: 'rep-a@example.com',
    email_verified: true,
  }).firestore();
  const tenantLeads = await assertSucceeds(getDocs(query(
    collection(representativeDb, 'leads'),
    where('empresaRepresentacaoId', '==', 'tenant-a'),
  )));
  assert.equal(tenantLeads.size, 2);
});

test('validates lead permissions, fields, tenant, owner, and immutable identity', async () => {
  const sellerDb = environment.authenticatedContext('seller-a-uid', {
    email: 'seller-a@example.com',
    email_verified: true,
  }).firestore();
  const newLead = lead('new-lead-a', 'tenant-a', 'seller-a-uid');
  await assertSucceeds(setDoc(doc(sellerDb, 'leads', newLead.id), newLead));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'new-lead-b'), lead('new-lead-b', 'tenant-b', 'seller-a-uid')));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'wrong-owner'), lead('wrong-owner', 'tenant-a', 'someone-else')));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'missing-name'), { ...lead('missing-name', 'tenant-a', 'seller-a-uid'), nomeFantasia: '' }));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'invalid-stage'), { ...lead('invalid-stage', 'tenant-a', 'seller-a-uid'), etapa: 'Concluído' }));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'extra-field'), { ...lead('extra-field', 'tenant-a', 'seller-a-uid'), extraData: 'unexpected' }));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'wrong-type'), { ...lead('wrong-type', 'tenant-a', 'seller-a-uid'), origem: 42 }));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'bad-date'), { ...lead('bad-date', 'tenant-a', 'seller-a-uid'), dataProximaAcao: '26/10/2026' }));
  await assertFails(setDoc(doc(sellerDb, 'leads', 'missing-representada'), {
    ...lead('missing-representada', 'tenant-a', 'seller-a-uid'),
    representadaId: 'not-found',
  }));

  await assertFails(updateDoc(doc(sellerDb, 'leads', 'lead-seller-a'), { empresaRepresentacaoId: 'tenant-b' }));
  await assertFails(updateDoc(doc(sellerDb, 'leads', 'lead-seller-a'), { responsavelUserId: 'someone-else' }));
  await assertFails(updateDoc(doc(sellerDb, 'leads', 'lead-seller-a'), { criadoEm: '2099-01-01T00:00:00.000Z' }));
  await assertFails(updateDoc(doc(sellerDb, 'leads', 'lead-seller-a'), { observacoes: 'x'.repeat(1501) }));
  await assertFails(updateDoc(doc(sellerDb, 'leads', 'lead-seller-a'), { extraData: 'unexpected' }));
  await assertFails(updateDoc(doc(sellerDb, 'leads', 'lead-seller-a'), { origem: 42 }));
  await assertFails(deleteDoc(doc(sellerDb, 'leads', 'lead-seller-a')));

  const noLeadsDb = environment.authenticatedContext('no-leads-uid', {
    email: 'no-leads@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(getDoc(doc(noLeadsDb, 'leads', 'lead-seller-a')));
  await assertFails(setDoc(doc(noLeadsDb, 'leads', 'blocked-lead'), lead('blocked-lead', 'tenant-a', 'no-leads-uid')));
});

test('converts a lead through one linked client and rejects cross-tenant links', async () => {
  const sellerDb = environment.authenticatedContext('seller-a-uid', {
    email: 'seller-a@example.com',
    email_verified: true,
  }).firestore();
  const leadRef = doc(sellerDb, 'leads', 'lead-seller-a');
  const conversion = {
    etapa: 'Convertido',
    clienteConvertidoId: 'lead-seller-a',
    convertidoEm: '2026-10-26T11:00:00.000Z',
    atualizadoEm: '2026-10-26T11:00:00.000Z',
  };

  await assertFails(updateDoc(leadRef, conversion));

  await assertFails(setDoc(doc(sellerDb, 'clientes', 'not-the-lead-id'), {
    ...client('not-the-lead-id', 'tenant-a'),
    nomeFantasia: 'Lead lead-seller-a',
    leadOrigemId: 'lead-seller-a',
  }));
  await assertFails(setDoc(doc(sellerDb, 'clientes', 'lead-seller-a'), {
    ...client('lead-seller-a', 'tenant-a'),
    nomeFantasia: 'Nome diferente',
    leadOrigemId: 'lead-seller-a',
  }));
  await assertFails(setDoc(doc(sellerDb, 'clientes', 'lead-seller-b'), {
    ...client('lead-seller-b', 'tenant-a'),
    nomeFantasia: 'Lead lead-seller-b',
    leadOrigemId: 'lead-seller-b',
  }));

  const linkedClientRef = doc(sellerDb, 'clientes', 'lead-seller-a');
  await assertSucceeds(setDoc(linkedClientRef, {
    ...client('lead-seller-a', 'tenant-a'),
    nomeFantasia: 'Lead lead-seller-a',
    leadOrigemId: 'lead-seller-a',
  }));
  await assertFails(deleteDoc(linkedClientRef));
  await assertFails(updateDoc(linkedClientRef, { cnpj: '11111111111111' }));
  await assertFails(updateDoc(leadRef, { nomeFantasia: 'Nome incompatível' }));
  await assertSucceeds(updateDoc(leadRef, conversion));
  await assertFails(updateDoc(linkedClientRef, { leadOrigemId: 'lead-seller-b' }));
  await assertFails(updateDoc(linkedClientRef, { nomeFantasia: 'Nome incompatível' }));
  await assertFails(updateDoc(leadRef, { nomeFantasia: 'Alteração após converter' }));

  const adminDb = environment.authenticatedContext('system-admin-uid', {
    email: 'rockstaraki2@gmail.com',
    email_verified: true,
  }).firestore();
  await assertFails(setDoc(doc(adminDb, 'clientes', 'lead-seller-b'), {
    ...client('lead-seller-b', 'tenant-b'),
    nomeFantasia: 'Lead lead-seller-b',
    leadOrigemId: 'lead-seller-b',
  }));
  await assertFails(updateDoc(doc(adminDb, 'leads', 'lead-seller-b'), {
    etapa: 'Convertido',
    clienteConvertidoId: 'lead-seller-b',
    convertidoEm: '2026-10-26T11:10:00.000Z',
    atualizadoEm: '2026-10-26T11:10:00.000Z',
  }));
});

test('allows a verified invitee to create only the profile copied from their invitation', async () => {
  const invite = {
    id: 'invite-123',
    nome: 'Nova Pessoa',
    email: 'new-user@example.com',
    role: 'Vendedor',
    ativo: true,
    empresaRepresentacaoId: 'tenant-a',
    permissoes: { verTodasVendas: false },
  };
  const legacyInvite = { ...invite, senha: 'legacy-secret', gmailUser: 'legacy-mail', gmailAppPass: 'legacy-app-password' };
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'usuarios', invite.id), legacyInvite);
  });

  const db = environment.authenticatedContext('new-user-uid', {
    email: invite.email,
    email_verified: true,
  }).firestore();
  const inviteQuery = query(
    collection(db, 'usuarios'),
    where('email', '==', invite.email),
    where('ativo', '==', true),
  );
  await assertSucceeds(getDocs(inviteQuery));

  const copiedProfile = { ...invite, id: 'new-user-uid', legacyId: invite.id };
  await assertFails(setDoc(doc(db, 'usuarios', 'another-uid'), copiedProfile));
  const elevatedProfile = { ...copiedProfile, role: 'Administrador' };
  await assertFails(setDoc(doc(db, 'usuarios', 'new-user-uid'), elevatedProfile));
  await assertSucceeds(setDoc(doc(db, 'usuarios', 'new-user-uid'), copiedProfile));
  await assertSucceeds(updateDoc(doc(db, 'usuarios', invite.id), {
    senha: deleteField(),
    gmailUser: deleteField(),
    gmailAppPass: deleteField(),
  }));
  await assertFails(deleteDoc(doc(db, 'usuarios', invite.id)));
});
