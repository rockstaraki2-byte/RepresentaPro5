import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  memoryLocalCache,
  query,
  setDoc,
  updateDoc,
  where,
  addDoc,
  connectFirestoreEmulator,
  type Query,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type {
  Representada,
  Cliente,
  Pedido,
  Produto,
  EmpresaRepresentacao,
  Usuario,
  MetaVendas,
} from './types';

// Firebase web configuration is public by design. Restrict this key to the
// production domains in Google Cloud; it is not an authorization mechanism.
const firebaseConfig = {
  apiKey: 'AIzaSyBF2sweJQHuc_I3S71dPjw0_5pEUQOzuu8',
  authDomain: 'representapro-b84c3.firebaseapp.com',
  projectId: 'representapro-b84c3',
  storageBucket: 'representapro-b84c3.firebasestorage.app',
  messagingSenderId: '948207221757',
  appId: '1:948207221757:web:be1da69bbe4490076af794',
  measurementId: 'G-K4P1RYCKW5',
};

export const SYSTEM_ADMIN_EMAIL = 'rockstaraki2@gmail.com';
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Memory-only caching avoids leaving tenant data in a shared browser profile.
// Users must be online to load current data; Firestore rules remain the actual
// security boundary and are checked on every server request.
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (typeof window !== 'undefined' && appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
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
  // Never include document contents, credentials, or email addresses in logs.
  console.error('Firestore operation failed', { operationType, path, message });
  throw new Error(message);
}

export function isSystemAdminAccount(user: FirebaseUser | null | undefined): boolean {
  return Boolean(user?.emailVerified && user.email?.toLowerCase() === SYSTEM_ADMIN_EMAIL);
}

function requireTenant(scope: TenantScope): void {
  if (!scope.systemAdmin && !scope.tenantId) {
    throw new Error('A empresa do usuário autenticado não foi encontrada.');
  }
}

function canSeeAllOrders(user?: Usuario): boolean {
  return Boolean(user && (user.role === 'Administrador' || (user.permissoes?.verTodasVendas ?? user.role === 'Representante')));
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
    const uidSnapshot = await getDoc(uidRef);
    if (uidSnapshot.exists()) {
      const profile = toUserProfile(uidSnapshot.data(), user.uid);
      if (!profile.ativo || profile.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new Error('Este acesso está inativo ou não corresponde ao e-mail autenticado.');
      }
      return profile;
    }

    const matchingProfiles = await getDocs(
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

async function getTenantRecords<T>(name: string, scope: TenantScope): Promise<T[]> {
  requireTenant(scope);
  try {
    const snapshot = await getDocs(tenantQuery(name, scope));
    return snapshot.docs.map((item) => item.data() as T);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, name);
  }
}

export async function getRepresentadas(scope: TenantScope): Promise<Representada[]> {
  return getTenantRecords<Representada>('representadas', scope);
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

export async function getClientes(scope: TenantScope): Promise<Cliente[]> {
  return getTenantRecords<Cliente>('clientes', scope);
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

export async function getPedidos(scope: TenantScope, user?: Usuario): Promise<Pedido[]> {
  const scoped = scopedCollection('pedidos', scope, user);
  try {
    const snapshot = await getDocs(scoped);
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

export async function getProdutos(scope: TenantScope): Promise<Produto[]> {
  return getTenantRecords<Produto>('produtos', scope);
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

export async function getEmpresas(scope: TenantScope): Promise<EmpresaRepresentacao[]> {
  try {
    if (scope.systemAdmin && scope.tenantId === 'all') {
      const snapshot = await getDocs(collection(db, 'empresas'));
      return snapshot.docs.map((item) => item.data() as EmpresaRepresentacao);
    }
    requireTenant(scope);
    const snapshot = await getDoc(doc(db, 'empresas', scope.tenantId));
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

export async function getUsuarios(scope: TenantScope, currentUser: Usuario, canManageUsers: boolean): Promise<Usuario[]> {
  const result = new Map<string, Usuario>([[currentUser.id, currentUser]]);
  if (!canManageUsers) return Array.from(result.values());
  try {
    const snapshot = await getDocs(tenantQuery('usuarios', scope));
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
    const target = await getDoc(doc(db, 'usuarios', id));
    const legacyId = target.exists() ? target.data().legacyId : undefined;
    if (typeof legacyId === 'string' && legacyId !== id) {
      await deleteDoc(doc(db, 'usuarios', legacyId));
    }
    await deleteDoc(doc(db, 'usuarios', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'usuarios');
  }
}

export async function getMeta(scope: TenantScope): Promise<MetaVendas> {
  if (!scope.systemAdmin) requireTenant(scope);
  try {
    const snapshot = await getDocs(scope.systemAdmin && scope.tenantId === 'all'
      ? collection(db, 'meta')
      : tenantQuery('meta', scope));
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
