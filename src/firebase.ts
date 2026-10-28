import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  clearIndexedDbPersistence,
  terminate,
  updateDoc,
  where,
  addDoc,
  connectFirestoreEmulator,
  waitForPendingWrites,
  type Query,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type {
  Representada,
  Cliente,
  Lead,
  Pedido,
  Produto,
  EmpresaRepresentacao,
  Usuario,
  MetaVendas,
  CommissionRule,
} from './types';
import { prepareLeadForCreate } from './leadFirestorePayload';
import { app, auth, isSystemAdminAccount } from './firebase-app';

export { app, auth, SYSTEM_ADMIN_EMAIL, isSystemAdminAccount } from './firebase-app';

// Persistent cache supports offline visits on a representative's trusted device.
// Server requests remain protected by Firestore rules; cached data is cleared
// when the user explicitly signs out after pending writes have synchronized.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export async function waitForOfflineWritesToSync(): Promise<void> {
  await waitForPendingWrites(db);
}

export async function clearOfflineFirestoreCache(): Promise<void> {
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function waitForServerRead<T>(request: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Network timeout while refreshing cached data.')), 3000);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function readDocument(ref: ReturnType<typeof doc>, forceServer = false) {
  if (!forceServer) {
    try {
      const cached = await getDocFromCache(ref);
      if (cached.exists() || isBrowserOffline()) return cached;
    } catch (error) {
      if (isBrowserOffline()) throw error;
    }
  }
  try {
    return forceServer ? await getDoc(ref) : await waitForServerRead(getDoc(ref));
  } catch (error) {
    if (forceServer) throw error;
    try {
      return await getDocFromCache(ref);
    } catch {
      throw error;
    }
  }
}

async function readQuery(target: Query, forceServer = false) {
  if (forceServer) return getDocs(target);
  let cachedSnapshot;
  try {
    cachedSnapshot = await getDocsFromCache(target);
    if (cachedSnapshot.size > 0 || isBrowserOffline()) return cachedSnapshot;
  } catch (error) {
    if (isBrowserOffline()) throw error;
  }

  try {
    return forceServer ? await getDocs(target) : await waitForServerRead(getDocs(target));
  } catch (error) {
    if (cachedSnapshot) return cachedSnapshot;
    try {
      return await getDocsFromCache(target);
    } catch {
      throw error;
    }
  }
}

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (typeof window !== 'undefined' && appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export interface TenantScope {
  tenantId: string;
  systemAdmin: boolean;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function removeUndefinedFields(value: any): any {
  if (Array.isArray(value)) return value.map(removeUndefinedFields);
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    Object.keys(value).forEach((key) => {
      if (value[key] !== undefined) clean[key] = removeUndefinedFields(value[key]);
    });
    return clean;
  }
  return value;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  // Never include document contents, credentials, or email addresses in logs.
  console.error('Firestore operation failed', { operationType, path, code: code || undefined, message });
  if (error instanceof Error) throw error;
  const wrappedError = new Error(message) as Error & { code?: string };
  if (code) wrappedError.code = code;
  throw wrappedError;
}

function requireTenant(scope: TenantScope): void {
  if (!scope.systemAdmin && !scope.tenantId) {
    throw new Error('A empresa do usuário autenticado não foi encontrada.');
  }
}

function canSeeAllOrders(user?: Usuario): boolean {
  return Boolean(user && (user.role === 'Administrador' || (user.permissoes?.verTodasVendas ?? user.role === 'Representante')));
}

function canSeeAllLeads(user?: Usuario): boolean {
  return Boolean(user && (user.role === 'Administrador' || (user.permissoes?.verTodosLeads ?? user.role === 'Representante')));
}

export function scopedCollection(name: string, scope: TenantScope, owner?: Usuario): Query {
  requireTenant(scope);
  const base = collection(db, name);
  let scoped: Query;
  if (scope.systemAdmin && scope.tenantId === 'all') scoped = base;
  else if (name === 'empresas') scoped = query(base, where('id', '==', scope.tenantId));
  else scoped = query(base, where('empresaRepresentacaoId', '==', scope.tenantId));
  if (name === 'pedidos' && !scope.systemAdmin && owner?.id && !canSeeAllOrders(owner)) {
    const userIds = Array.from(new Set([owner.id, owner.legacyId].filter((id): id is string => Boolean(id))));
    return query(scoped, where('createdByUserId', 'in', userIds));
  }
  if (name === 'leads' && !scope.systemAdmin && owner?.id && !canSeeAllLeads(owner)) {
    const userIds = Array.from(new Set([owner.id, owner.legacyId].filter((id): id is string => Boolean(id))));
    return query(scoped, where('responsavelUserId', 'in', userIds));
  }
  return scoped;
}

function toUserProfile(data: Record<string, any>, id: string): Usuario {
  const { senha: _password, gmailUser: _gmailUser, gmailAppPass: _gmailPass, ...safeData } = data;
  return { ...safeData, id } as Usuario;
}

/**
 * Resolves an authenticated Firebase identity to a protected tenant profile.
 * Existing users whose old profile is keyed by a legacy ID are copied to the
 * Auth UID only after they verify ownership of that email address. The
 * Firestore rules enforce that the copied role and tenant match that source.
 */
export async function resolveUserProfile(user: FirebaseUser): Promise<Usuario> {
  if (!user.emailVerified || !user.email) {
    throw new Error('Confirme seu e-mail antes de acessar o sistema.');
  }

  if (isSystemAdminAccount(user)) {
    return {
      id: user.uid,
      nome: user.displayName || 'Raul Soares',
      email: user.email,
      role: 'Administrador',
      ativo: true,
    };
  }

  const uidRef = doc(db, 'usuarios', user.uid);
  try {
    const uidSnapshot = await readDocument(uidRef);
    if (uidSnapshot.exists()) {
      const profile = toUserProfile(uidSnapshot.data(), user.uid);
      if (!profile.ativo || profile.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new Error('Este acesso está inativo ou não corresponde ao e-mail autenticado.');
      }
      return profile;
    }

    const matchingProfiles = await readQuery(
      query(collection(db, 'usuarios'), where('email', '==', user.email), where('ativo', '==', true)),
    );
    const sources = matchingProfiles.docs.filter((item) => item.id !== user.uid && item.data().ativo === true);
    if (sources.length > 1) {
      throw new Error('Há mais de um convite ativo para este e-mail. Peça ao administrador para revisar os cadastros duplicados.');
    }
    const source = sources[0];
    if (!source) {
      throw new Error('Não encontrei um convite ativo para este e-mail. Peça ao administrador da empresa para cadastrá-lo.');
    }

    const sourceData = source.data();
    if (!sourceData.empresaRepresentacaoId) {
      throw new Error('O cadastro ainda não está vinculado a uma empresa. Peça ao administrador para corrigir o convite.');
    }

    const profileData = removeUndefinedFields({
      ...toUserProfile(sourceData, user.uid),
      id: user.uid,
      email: user.email,
      legacyId: source.id,
    });
    await setDoc(uidRef, profileData);

    // The legacy password was plaintext. Remove it as soon as the verified
    // account has a UID-bound profile. The bulk cleanup script handles users
    // who have not signed in yet.
    const secretFields = ['senha', 'gmailUser', 'gmailAppPass'] as const;
    const cleanup = Object.fromEntries(secretFields
      .filter((field) => Object.prototype.hasOwnProperty.call(sourceData, field))
      .map((field) => [field, deleteField()]));
    if (Object.keys(cleanup).length > 0) {
      await updateDoc(source.ref, cleanup);
    }

    return profileData as Usuario;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'usuarios');
  }
}

function tenantQuery(name: string, scope: TenantScope): Query {
  return scopedCollection(name, scope);
}

async function getTenantRecords<T>(name: string, scope: TenantScope, forceServer = false): Promise<T[]> {
  requireTenant(scope);
  try {
    const snapshot = await readQuery(tenantQuery(name, scope), forceServer);
    return snapshot.docs.map((item) => item.data() as T);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, name);
  }
}

export async function getRepresentadas(scope: TenantScope, forceServer = false): Promise<Representada[]> {
  return getTenantRecords<Representada>('representadas', scope, forceServer);
}

export async function saveRepresentada(rep: Representada): Promise<void> {
  try {
    await setDoc(doc(db, 'representadas', rep.id), removeUndefinedFields(rep));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'representadas');
  }
}

export async function deleteRepresentada(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'representadas', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'representadas');
  }
}

export async function getClientes(scope: TenantScope, forceServer = false): Promise<Cliente[]> {
  return getTenantRecords<Cliente>('clientes', scope, forceServer);
}

export async function saveCliente(cli: Cliente): Promise<void> {
  try {
    await setDoc(doc(db, 'clientes', cli.id), removeUndefinedFields(cli));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'clientes');
  }
}

export async function deleteCliente(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'clientes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'clientes');
  }
}

export async function getLeads(scope: TenantScope, user?: Usuario, forceServer = false): Promise<Lead[]> {
  const scoped = scopedCollection('leads', scope, user);
  try {
    const snapshot = await readQuery(scoped, forceServer);
    return snapshot.docs.map((item) => item.data() as Lead);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'leads');
  }
}

export async function saveLead(lead: Lead): Promise<void> {
  try {
    await setDoc(doc(db, 'leads', lead.id), removeUndefinedFields(lead));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'leads');
  }
}

/** Create ownership fields from the verified Firebase identity, never from UI-supplied IDs. */
export async function createLead(lead: Lead): Promise<void> {
  const user = auth.currentUser;
  if (!user?.emailVerified) {
    const error = new Error('É necessário autenticar novamente para cadastrar um lead.') as Error & { code: string };
    error.code = 'unauthenticated';
    throw error;
  }

  const authenticatedLead = prepareLeadForCreate({
    ...lead,
    responsavelUserId: user.uid,
    criadoPorUserId: user.uid,
  });
  try {
    await setDoc(doc(db, 'leads', authenticatedLead.id), removeUndefinedFields(authenticatedLead));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'leads');
  }
}

export class LeadConversionError extends Error {
  clientSaved: boolean;

  constructor(message: string, clientSaved: boolean) {
    super(message);
    this.name = 'LeadConversionError';
    this.clientSaved = clientSaved;
  }
}

/** Creates a linked customer first, then finalizes the lead conversion. */
export async function convertLeadToCliente(lead: Lead, cliente: Cliente): Promise<void> {
  const linkedCliente = { ...cliente, leadOrigemId: lead.id };
  try {
    await setDoc(doc(db, 'clientes', linkedCliente.id), removeUndefinedFields(linkedCliente));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'clientes');
  }

  try {
    await updateDoc(doc(db, 'leads', lead.id), removeUndefinedFields(lead));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Lead conversion finalization failed', { operationType: OperationType.UPDATE, path: 'leads', message });
    throw new LeadConversionError('O cliente foi salvo, mas o lead ainda não foi finalizado.', true);
  }
}

export async function getPedidos(scope: TenantScope, user?: Usuario, forceServer = false): Promise<Pedido[]> {
  const scoped = scopedCollection('pedidos', scope, user);
  try {
    const snapshot = await readQuery(scoped, forceServer);
    return snapshot.docs.map((item) => item.data() as Pedido);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'pedidos');
  }
}

export async function savePedido(ped: Pedido): Promise<void> {
  try {
    await setDoc(doc(db, 'pedidos', ped.id), removeUndefinedFields(ped));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'pedidos');
  }
}

export async function deletePedido(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'pedidos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'pedidos');
  }
}

export async function getProdutos(scope: TenantScope, forceServer = false): Promise<Produto[]> {
  return getTenantRecords<Produto>('produtos', scope, forceServer);
}

export async function saveProduto(prod: Produto): Promise<void> {
  try {
    await setDoc(doc(db, 'produtos', prod.id), removeUndefinedFields(prod));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'produtos');
  }
}

export async function deleteProduto(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'produtos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'produtos');
  }
}

export async function getEmpresas(scope: TenantScope, forceServer = false): Promise<EmpresaRepresentacao[]> {
  try {
    if (scope.systemAdmin && scope.tenantId === 'all') {
      const snapshot = await readQuery(collection(db, 'empresas'), forceServer);
      return snapshot.docs.map((item) => item.data() as EmpresaRepresentacao);
    }
    requireTenant(scope);
    const snapshot = await readDocument(doc(db, 'empresas', scope.tenantId), forceServer);
    return snapshot.exists() ? [snapshot.data() as EmpresaRepresentacao] : [];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'empresas');
  }
}

function safeEmpresa(emp: EmpresaRepresentacao): Record<string, unknown> {
  const clean = { ...emp } as Record<string, unknown>;
  delete clean.gmailUser;
  delete clean.gmailAppPass;
  return removeUndefinedFields(clean);
}

export async function saveEmpresa(emp: EmpresaRepresentacao): Promise<void> {
  try {
    await setDoc(doc(db, 'empresas', emp.id), safeEmpresa(emp));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'empresas');
  }
}

export async function deleteEmpresa(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'empresas', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'empresas');
  }
}

export async function getUsuarios(scope: TenantScope, currentUser: Usuario, canManageUsers: boolean, forceServer = false): Promise<Usuario[]> {
  const result = new Map<string, Usuario>([[currentUser.id, currentUser]]);
  if (!canManageUsers) return Array.from(result.values());
  try {
    const snapshot = await readQuery(tenantQuery('usuarios', scope), forceServer);
    const documents = snapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
    const linkedLegacyIds = new Set<string>(documents.map(({ data }) => data.legacyId).filter((id): id is string => typeof id === 'string'));
    documents.forEach(({ id, data }) => {
      const user = toUserProfile(data, id);
      // Hide only an invitation that has already been linked to its Auth UID.
      if (id !== currentUser.id && !linkedLegacyIds.has(id)) result.set(user.id, user);
    });
    return Array.from(result.values());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'usuarios');
  }
}

export async function saveUsuario(user: Usuario): Promise<void> {
  try {
    const clean = { ...user } as Record<string, unknown>;
    delete clean.senha;
    delete clean.gmailUser;
    delete clean.gmailAppPass;
    await setDoc(doc(db, 'usuarios', user.id), removeUndefinedFields(clean));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'usuarios');
  }
}

export async function deleteUsuario(id: string): Promise<void> {
  try {
    const target = await readDocument(doc(db, 'usuarios', id));
    const legacyId = target.exists() ? target.data().legacyId : undefined;
    if (typeof legacyId === 'string' && legacyId !== id) {
      await deleteDoc(doc(db, 'usuarios', legacyId));
    }
    await deleteDoc(doc(db, 'usuarios', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'usuarios');
  }
}

export async function getMeta(scope: TenantScope, forceServer = false): Promise<MetaVendas> {
  if (!scope.systemAdmin) requireTenant(scope);
  try {
    const snapshot = await readQuery(scope.systemAdmin && scope.tenantId === 'all'
      ? collection(db, 'meta')
      : tenantQuery('meta', scope), forceServer);
    if (!snapshot.empty) return snapshot.docs[0].data() as MetaVendas;
    return { metaMensal: 0, anoMes: new Date().toISOString().slice(0, 7), empresaRepresentacaoId: scope.tenantId };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'meta');
  }
}

export async function saveMeta(meta: MetaVendas): Promise<void> {
  if (!meta.empresaRepresentacaoId) throw new Error('A meta precisa estar vinculada a uma empresa.');
  try {
    const id = `meta-${meta.empresaRepresentacaoId}`;
    await setDoc(doc(db, 'meta', id), removeUndefinedFields({ ...meta, id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'meta');
  }
}

export async function getCommissionRules(scope: TenantScope, forceServer = false): Promise<CommissionRule[]> {
  return getTenantRecords<CommissionRule>('regras_comissao', scope, forceServer);
}

export async function saveCommissionRule(rule: CommissionRule): Promise<void> {
  if (!rule.id || !rule.empresaRepresentacaoId) throw new Error('A regra de comissão precisa estar vinculada à empresa.');
  try {
    await setDoc(doc(db, 'regras_comissao', rule.id), removeUndefinedFields(rule));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'regras_comissao');
  }
}

export async function deleteCommissionRule(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'regras_comissao', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'regras_comissao');
  }
}

export async function testarConexaoFirebase(usuarioEmail?: string): Promise<string> {
  try {
    const result = await addDoc(collection(db, 'teste_conexao'), {
      data: new Date().toISOString(),
      mensagem: 'Conexão efetuada com sucesso a partir do RepresentaPRO',
      usuario: usuarioEmail || auth.currentUser?.email || 'Autenticado',
      uid: auth.currentUser?.uid || '',
    });
    return result.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'teste_conexao');
  }
}
