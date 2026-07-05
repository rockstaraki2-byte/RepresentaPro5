import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  addDoc
} from 'firebase/firestore';
import { 
  Representada, 
  Cliente, 
  Pedido, 
  Produto, 
  EmpresaRepresentacao, 
  Usuario, 
  MetaVendas 
} from './types';
import { 
  SEED_REPRESENTADAS, 
  SEED_CLIENTES, 
  SEED_PEDIDOS, 
  SEED_PRODUTOS, 
  SEED_EMPRESAS, 
  SEED_USUARIOS, 
  SEED_METAS 
} from './data';
import firebaseConfig from '../firebase-applet-config.json';

const finalFirebaseConfig = {
  apiKey: "AIzaSyBF2sweJQHuc_I3S71dPjw0_5pEUQOzuu8",
  authDomain: "representapro-b84c3.firebaseapp.com",
  projectId: "representapro-b84c3",
  storageBucket: "representapro-b84c3.firebasestorage.app",
  messagingSenderId: "948207221757",
  appId: "1:948207221757:web:be1da69bbe4490076af794",
  measurementId: "G-K4P1RYCKW5"
};

// Initialize Firebase with robust offline persistent local caching
const app = initializeApp(finalFirebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const newObj = { ...obj };
  Object.keys(newObj).forEach((key) => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Data Seeding Function ---
export async function seedDatabaseIfNeeded() {
  try {
    // Check if companies exist
    const empresasSnap = await getDocs(collection(db, 'empresas'));
    if (empresasSnap.empty) {
      console.log('Seeding initial data to Firestore...');
      
      const batch = writeBatch(db);

      // Seed Empresas
      SEED_EMPRESAS.forEach(emp => {
        batch.set(doc(db, 'empresas', emp.id), emp);
      });

      // Seed Usuarios
      SEED_USUARIOS.forEach(usr => {
        batch.set(doc(db, 'usuarios', usr.id), usr);
      });

      // Seed Representadas
      SEED_REPRESENTADAS.forEach(rep => {
        batch.set(doc(db, 'representadas', rep.id), rep);
      });

      // Seed Clientes
      SEED_CLIENTES.forEach(cli => {
        batch.set(doc(db, 'clientes', cli.id), cli);
      });

      // Seed Produtos
      SEED_PRODUTOS.forEach(prod => {
        batch.set(doc(db, 'produtos', prod.id), prod);
      });

      // Seed Pedidos
      SEED_PEDIDOS.forEach(ped => {
        batch.set(doc(db, 'pedidos', ped.id), ped);
      });

      // Seed Meta
      // Meta is a special single-document or collection. Let's seed a default document.
      batch.set(doc(db, 'meta', 'meta-global'), SEED_METAS);

      await batch.commit();
      console.log('Database seeded successfully!');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'all-seeding');
  }
}

// --- Representadas API ---
export async function getRepresentadas(): Promise<Representada[]> {
  try {
    const snap = await getDocs(collection(db, 'representadas'));
    return snap.docs.map(doc => doc.data() as Representada);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'representadas');
    return [];
  }
}

export async function saveRepresentada(rep: Representada): Promise<void> {
  try {
    await setDoc(doc(db, 'representadas', rep.id), removeUndefinedFields(rep));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `representadas/${rep.id}`);
  }
}

export async function deleteRepresentada(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'representadas', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `representadas/${id}`);
  }
}

// --- Clientes API ---
export async function getClientes(): Promise<Cliente[]> {
  try {
    const snap = await getDocs(collection(db, 'clientes'));
    return snap.docs.map(doc => doc.data() as Cliente);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clientes');
    return [];
  }
}

export async function saveCliente(cli: Cliente): Promise<void> {
  try {
    await setDoc(doc(db, 'clientes', cli.id), removeUndefinedFields(cli));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clientes/${cli.id}`);
  }
}

export async function deleteCliente(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'clientes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `clientes/${id}`);
  }
}

// --- Pedidos API ---
export async function getPedidos(): Promise<Pedido[]> {
  try {
    const snap = await getDocs(collection(db, 'pedidos'));
    return snap.docs.map(doc => doc.data() as Pedido);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'pedidos');
    return [];
  }
}

export async function savePedido(ped: Pedido): Promise<void> {
  try {
    await setDoc(doc(db, 'pedidos', ped.id), removeUndefinedFields(ped));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pedidos/${ped.id}`);
  }
}

export async function deletePedido(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'pedidos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `pedidos/${id}`);
  }
}

// --- Produtos API ---
export async function getProdutos(): Promise<Produto[]> {
  try {
    const snap = await getDocs(collection(db, 'produtos'));
    return snap.docs.map(doc => doc.data() as Produto);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'produtos');
    return [];
  }
}

export async function saveProduto(prod: Produto): Promise<void> {
  try {
    await setDoc(doc(db, 'produtos', prod.id), removeUndefinedFields(prod));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `produtos/${prod.id}`);
  }
}

export async function deleteProduto(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'produtos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `produtos/${id}`);
  }
}

// --- Empresas API ---
export async function getEmpresas(): Promise<EmpresaRepresentacao[]> {
  try {
    const snap = await getDocs(collection(db, 'empresas'));
    return snap.docs.map(doc => doc.data() as EmpresaRepresentacao);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'empresas');
    return [];
  }
}

export async function saveEmpresa(emp: EmpresaRepresentacao): Promise<void> {
  try {
    await setDoc(doc(db, 'empresas', emp.id), removeUndefinedFields(emp));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `empresas/${emp.id}`);
  }
}

export async function deleteEmpresa(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'empresas', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `empresas/${id}`);
  }
}

// --- Usuarios API ---
export async function getUsuarios(): Promise<Usuario[]> {
  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    const list = snap.docs.map(doc => doc.data() as Usuario);

    // Normalize any "Raul" user to have 'usr-raul' id.
    const normalizedList = list.map(u => {
      if (u.id === 'usr-raul' || u.nome?.toLowerCase() === 'raul' || u.email?.toLowerCase() === 'raul') {
        const cleaned: Usuario = {
          ...u,
          id: 'usr-raul',
          nome: 'Raul',
          email: 'raul',
          role: 'Administrador',
          ativo: true,
          senha: '230213'
        };
        // Remove representation ID if present
        delete cleaned.empresaRepresentacaoId;
        return cleaned;
      }
      return u;
    });

    // Deduplicate by ID
    const uniqueMap = new Map<string, Usuario>();
    for (const u of normalizedList) {
      if (!uniqueMap.has(u.id)) {
        uniqueMap.set(u.id, u);
      }
    }
    const deduplicatedList = Array.from(uniqueMap.values());

    const raulIdx = deduplicatedList.findIndex(u => u.id === 'usr-raul');
    if (raulIdx === -1) {
      const raulUser: Usuario = {
        id: 'usr-raul',
        nome: 'Raul',
        email: 'raul',
        role: 'Administrador',
        ativo: true,
        senha: '230213'
      };
      // Use silent background save
      saveUsuario(raulUser).catch(err => console.warn("Erro ao salvar Raul no Firestore:", err));
      deduplicatedList.push(raulUser);
    } else {
      // Correct existing Raul if it was misconfigured
      const correctRaul = deduplicatedList[raulIdx];
      saveUsuario(correctRaul).catch(err => console.warn("Erro ao atualizar Raul no Firestore:", err));
    }
    return deduplicatedList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'usuarios');
    return [];
  }
}

export async function saveUsuario(usr: Usuario): Promise<void> {
  try {
    let cleanUser = { ...usr };
    if (usr.id === 'usr-raul' || usr.nome?.toLowerCase() === 'raul' || usr.email?.toLowerCase() === 'raul') {
      cleanUser = {
        ...usr,
        id: 'usr-raul',
        nome: 'Raul',
        email: 'raul',
        role: 'Administrador',
        ativo: true,
        senha: '230213'
      };
      delete cleanUser.empresaRepresentacaoId;
    }
    await setDoc(doc(db, 'usuarios', cleanUser.id), removeUndefinedFields(cleanUser));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `usuarios/${usr.id}`);
  }
}

export async function deleteUsuario(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'usuarios', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `usuarios/${id}`);
  }
}

// --- Meta API ---
export async function getMeta(): Promise<MetaVendas> {
  try {
    const snap = await getDocs(collection(db, 'meta'));
    if (!snap.empty) {
      return snap.docs[0].data() as MetaVendas;
    }
    return SEED_METAS;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'meta');
    return SEED_METAS;
  }
}

export async function saveMeta(metaVal: MetaVendas): Promise<void> {
  try {
    await setDoc(doc(db, 'meta', 'meta-global'), removeUndefinedFields(metaVal));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'meta/meta-global');
  }
}

export async function testarConexaoFirebase(usuarioEmail?: string): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'teste_conexao'), {
      data: new Date().toISOString(),
      mensagem: 'Conexão efetuada com sucesso a partir do RepresentaPRO',
      usuario: usuarioEmail || 'Anonimo'
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'teste_conexao');
    throw error;
  }
}
