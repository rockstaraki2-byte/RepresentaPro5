import React, { useState, useEffect } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  ShoppingCart, 
  Landmark, 
  TrendingUp, 
  AlertCircle,
  Tag,
  ShieldCheck,
  Coins,
  Bell,
  BellOff,
  BellRing,
  Info,
  RefreshCw,
  X as CloseIcon
} from 'lucide-react';
import { formatarMoeda } from './utils';
import { motion, AnimatePresence } from 'motion/react';

// Import Types
import { Representada, Cliente, Pedido, MetaVendas, Produto, Usuario, EmpresaRepresentacao } from './types';

// Import Seeds
import { 
  SEED_REPRESENTADAS, 
  SEED_CLIENTES, 
  SEED_PEDIDOS, 
  SEED_METAS,
  SEED_PRODUTOS,
  SEED_EMPRESAS,
  SEED_USUARIOS
} from './data';

import { 
  seedDatabaseIfNeeded,
  getRepresentadas,
  saveRepresentada,
  deleteRepresentada,
  getClientes,
  saveCliente,
  deleteCliente,
  getPedidos,
  savePedido,
  deletePedido,
  getProdutos,
  saveProduto,
  deleteProduto,
  getEmpresas,
  saveEmpresa,
  deleteEmpresa,
  getUsuarios,
  saveUsuario,
  deleteUsuario,
  getMeta,
  saveMeta,
  db,
  testarConexaoFirebase
} from './firebase';

// Import Subcomponents
import DashboardTab from './components/DashboardTab';
import RepresentadasTab from './components/RepresentadasTab';
import ClientesTab from './components/ClientesTab';
import PedidosTab from './components/PedidosTab';
import ProdutosTab from './components/ProdutosTab';
import FinanceiroTab from './components/FinanceiroTab';
import AdminTab from './components/AdminTab';
import LoginScreen from './components/LoginScreen';

export default function App() {
  // --- Core Persistent States ---
  const [representadas, setRepresentadas] = useState<Representada[]>(() => {
    const saved = localStorage.getItem('rep_representadas');
    const items = saved ? JSON.parse(saved) : SEED_REPRESENTADAS;
    return items.map((i: any) => ({ ...i, empresaRepresentacaoId: i.empresaRepresentacaoId || 'emp-1' }));
  });

  const [clientes, setClientes] = useState<Cliente[]>(() => {
    const saved = localStorage.getItem('rep_clientes');
    const items = saved ? JSON.parse(saved) : SEED_CLIENTES;
    return items.map((i: any) => ({ ...i, empresaRepresentacaoId: i.empresaRepresentacaoId || 'emp-1' }));
  });

  const [pedidos, setPedidos] = useState<Pedido[]>(() => {
    const saved = localStorage.getItem('rep_pedidos');
    const items = saved ? JSON.parse(saved) : SEED_PEDIDOS;
    return items.map((i: any) => ({ ...i, empresaRepresentacaoId: i.empresaRepresentacaoId || 'emp-1' }));
  });

  const [meta, setMeta] = useState<MetaVendas>(() => {
    const saved = localStorage.getItem('rep_meta');
    return saved ? JSON.parse(saved) : SEED_METAS;
  });

  const [produtos, setProdutos] = useState<Produto[]>(() => {
    const saved = localStorage.getItem('rep_produtos');
    const items = saved ? JSON.parse(saved) : SEED_PRODUTOS;
    return items.map((i: any) => ({ ...i, empresaRepresentacaoId: i.empresaRepresentacaoId || 'emp-1' }));
  });

  // --- Multi-Company & User Access Management States ---
  const [empresas, setEmpresas] = useState<EmpresaRepresentacao[]>(() => {
    const saved = localStorage.getItem('rep_empresas');
    return saved ? JSON.parse(saved) : SEED_EMPRESAS;
  });

  const [activeEmpresaId, setActiveEmpresaId] = useState<string>(() => {
    const saved = localStorage.getItem('rep_active_empresa_id');
    if (saved) return saved;
    const defaultEmp = SEED_EMPRESAS.find(e => e.isDefault);
    return defaultEmp?.id || 'emp-1';
  });

  const [usuarios, setUsuarios] = useState<Usuario[]>(() => {
    const saved = localStorage.getItem('rep_usuarios');
    const parsed = saved ? JSON.parse(saved) : SEED_USUARIOS;
    const unique = new Map();
    parsed.forEach((u: Usuario) => {
      if (!unique.has(u.id)) unique.set(u.id, u);
    });
    return Array.from(unique.values());
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem('rep_current_user_id');
    return saved || 'usr-1';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem('rep_is_authenticated');
    return saved === 'true';
  });

  // --- UI Navigation & Active States ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'representadas' | 'clientes' | 'pedidos' | 'produtos' | 'financeiro' | 'admin'>('dashboard');
  const [activePedidoToEdit, setActivePedidoToEdit] = useState<Pedido | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showRulesGuide, setShowRulesGuide] = useState<boolean>(false);
  const [hasPermissionError, setHasPermissionError] = useState<boolean>(false);

  // --- Push & In-App Notification System ---
  interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: 'order' | 'commission';
    timestamp: string;
    read: boolean;
  }

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('rep_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });

  useEffect(() => {
    try { localStorage.setItem('rep_notifications', JSON.stringify(notifications)); } catch(e) { console.error('rep_notifications', e); }
  }, [notifications]);

  const triggerAppNotification = (title: string, message: string, type: 'order' | 'commission') => {
    const newNotif: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    setActiveToast(newNotif);

    // Auto-dismiss toast after 6 seconds
    setTimeout(() => {
      setActiveToast(current => current?.id === newNotif.id ? null : current);
    }, 6000);

    // Trigger Native Browser push if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body: message,
              icon: '/manifest.json',
              tag: newNotif.id,
            });
          });
        } else {
          new Notification(title, { body: message });
        }
      } catch (e) {
        new Notification(title, { body: message });
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      triggerAppNotification(
        'Notificações Ativadas! 🔔',
        'Você agora receberá alertas push em tempo real sobre novos pedidos e comissões.',
        'order'
      );
    }
  };

  // --- LocalStorage Synchronization ---
  useEffect(() => {
    try { localStorage.setItem('rep_representadas', JSON.stringify(representadas)); } catch(e) { console.error('rep_representadas', e); }
  }, [representadas]);

  useEffect(() => {
    try { localStorage.setItem('rep_clientes', JSON.stringify(clientes)); } catch(e) { console.error('rep_clientes', e); }
  }, [clientes]);

  useEffect(() => {
    try { localStorage.setItem('rep_pedidos', JSON.stringify(pedidos)); } catch(e) { console.error('rep_pedidos', e); }
  }, [pedidos]);

  useEffect(() => {
    try { localStorage.setItem('rep_meta', JSON.stringify(meta)); } catch(e) { console.error('rep_meta', e); }
  }, [meta]);

  useEffect(() => {
    try { localStorage.setItem('rep_produtos', JSON.stringify(produtos)); } catch(e) { console.error('rep_produtos', e); }
  }, [produtos]);

  useEffect(() => {
    try { localStorage.setItem('rep_empresas', JSON.stringify(empresas)); } catch(e) { console.error('rep_empresas', e); }
  }, [empresas]);

  useEffect(() => {
    localStorage.setItem('rep_active_empresa_id', activeEmpresaId);
  }, [activeEmpresaId]);

  useEffect(() => {
    try { try { localStorage.setItem('rep_usuarios', JSON.stringify(usuarios)); } catch(e) { console.error('rep_usuarios', e); } } catch(e) { console.error("usuarios", e); }
  }, [usuarios]);

  useEffect(() => {
    localStorage.setItem('rep_current_user_id', currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem('rep_is_authenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  useEffect(() => {
    async function initFirestoreData() {
      try {
        await seedDatabaseIfNeeded();

        const [
          repData,
          cliData,
          pedData,
          prodData,
          empData,
          usrData,
          metaData
        ] = await Promise.all([
          getRepresentadas(),
          getClientes(),
          getPedidos(),
          getProdutos(),
          getEmpresas(),
          getUsuarios(),
          getMeta()
        ]);

        if (repData.length > 0) setRepresentadas(repData);
        if (cliData.length > 0) setClientes(cliData);
        if (pedData.length > 0) setPedidos(pedData);
        if (prodData.length > 0) setProdutos(prodData);
        if (empData.length > 0) setEmpresas(empData);
        if (usrData.length > 0) setUsuarios(usrData);
        if (metaData) setMeta(metaData);
      } catch (err: any) {
        console.error('Error synchronizing with Firestore:', err);
        const errMsg = err?.message || String(err);
        if (errMsg.includes('permissions') || errMsg.includes('insufficient') || errMsg.includes('denied')) {
          setHasPermissionError(true);
          setErrorMessage('Erro de Permissões no Firestore (representapro-b84c3). Clique em "Como Resolver" para configurar as regras.');
        } else {
          setErrorMessage('Falha ao sincronizar dados com o Firestore. Rodando em modo local offline.');
        }
      } finally {
        setLoading(false);
      }
    }
    initFirestoreData();
  }, []);

  // --- Real-time Firestore Subscription with Push Notifications ---
  const isFirstSnapshot = React.useRef(true);

  useEffect(() => {
    if (loading) return;

    isFirstSnapshot.current = true;

    const unsubs: any[] = [];

    unsubs.push(onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      const updatedList: Pedido[] = [];
      snapshot.forEach((doc) => updatedList.push(doc.data() as Pedido));

      // Avoid triggering notifications on the initial load of existing records
      if (!isFirstSnapshot.current) {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as Pedido;
          
          if (data.empresaRepresentacaoId === activeEmpresaId) {
            if (change.type === 'added') {
              const repName = representadas.find(r => r.id === data.representadaId)?.nomeFantasia || 'Fábrica';
              const cliName = clientes.find(c => c.id === data.clienteId)?.nomeFantasia || 'Cliente';
              
              triggerAppNotification(
                'Novo Pedido de Venda 📦',
                `Pedido nº ${data.numeroPedido} (${cliName} ➔ ${repName}) no valor de ${formatarMoeda(data.valorTotal)} foi inserido no sistema.`,
                'order'
              );
            } else if (change.type === 'modified') {
              const oldVer = pedidos.find(p => p.id === data.id);
              if (data.statusComissao === 'Liberada' && (!oldVer || oldVer.statusComissao !== 'Liberada')) {
                const repName = representadas.find(r => r.id === data.representadaId)?.nomeFantasia || 'Fábrica';
                triggerAppNotification(
                  'Comissão Liberada! 💸',
                  `A comissão de ${formatarMoeda(data.valorComissao)} do pedido nº ${data.numeroPedido} (${repName}) foi liberada pelo administrador.`,
                  'commission'
                );
              }
            }
          }
        });
      }

      setPedidos(updatedList);
      isFirstSnapshot.current = false;
    }, (err) => {
      console.warn("Erro no snapshot de pedidos (modo offline):", err);
    }));

    // Sincronização automática de outras coleções
    unsubs.push(onSnapshot(collection(db, 'clientes'), (snapshot) => {
      const list: Cliente[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Cliente));
      setClientes(list);
    }));
    unsubs.push(onSnapshot(collection(db, 'representadas'), (snapshot) => {
      const list: Representada[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Representada));
      setRepresentadas(list);
    }));
    unsubs.push(onSnapshot(collection(db, 'produtos'), (snapshot) => {
      const list: Produto[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Produto));
      setProdutos(list);
    }));
    unsubs.push(onSnapshot(collection(db, 'empresas'), (snapshot) => {
      const list: EmpresaRepresentacao[] = [];
      snapshot.forEach(doc => list.push(doc.data() as EmpresaRepresentacao));
      setEmpresas(list);
    }));
    unsubs.push(onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      const list: Usuario[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Usuario));
      setUsuarios(list);
    }));
    unsubs.push(onSnapshot(collection(db, 'meta'), (snapshot) => {
      snapshot.forEach(doc => {
        if (doc.id === 'meta-global') {
          setMeta(doc.data() as MetaVendas);
        }
      });
    }));

    return () => unsubs.forEach(unsub => unsub());
  }, [loading, activeEmpresaId, representadas, clientes, pedidos]);

  // --- Active Selections and Helpers ---
  const activeEmpresa = empresas.find(e => e.id === activeEmpresaId) || empresas[0];
  const currentUser = usuarios.find(u => u.id === currentUserId) || usuarios[0];

  useEffect(() => {
    if ((activeTab === 'admin' || activeTab === 'financeiro') && currentUser?.role !== 'Administrador') {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUser]);

  const handleSelectEmpresa = (id: string) => {
    setActiveEmpresaId(id);
    // Auto-select corresponding company user when switching to keep consistency (unless current is Raul)
    const isRaul = currentUser?.id === 'usr-raul' || currentUser?.nome?.toLowerCase() === 'raul' || currentUser?.email === 'raul';
    if (!isRaul) {
      const companyUser = usuarios.find(u => u.empresaRepresentacaoId === id && u.ativo);
      if (companyUser) {
        setCurrentUserId(companyUser.id);
      }
    }
  };

  const handleSelectUsuario = (id: string) => {
    setCurrentUserId(id);
    const selectedUsr = usuarios.find(u => u.id === id);
    if (selectedUsr && selectedUsr.empresaRepresentacaoId && selectedUsr.empresaRepresentacaoId !== activeEmpresaId) {
      setActiveEmpresaId(selectedUsr.empresaRepresentacaoId);
    }
  };

  // --- Data Isolation Filter Layers ---
  // We filter all business collections by activeEmpresaId so different companies NEVER see each other's data!
  const isRaul = currentUser?.id === 'usr-raul' || currentUser?.nome?.toLowerCase() === 'raul' || currentUser?.email === 'raul';
  const showAllData = isRaul && activeEmpresaId === 'all';

  const filteredRepresentadas = showAllData ? representadas : representadas.filter(r => r.empresaRepresentacaoId === activeEmpresaId);
  const filteredClientes = showAllData ? clientes : clientes.filter(c => c.empresaRepresentacaoId === activeEmpresaId);
  
  let baseFilteredPedidos = showAllData ? pedidos : pedidos.filter(p => p.empresaRepresentacaoId === activeEmpresaId);
  if (currentUser?.role !== 'Administrador' && !showAllData) {
    baseFilteredPedidos = baseFilteredPedidos.filter(p => p.createdByUserId === currentUser?.id);
  }
  const filteredPedidos = baseFilteredPedidos;

  const filteredProdutos = showAllData ? produtos : produtos.filter(p => p.empresaRepresentacaoId === activeEmpresaId);

  // --- Handlers for CRUD ---
  
  // Representadas
  const handleAddRepresentada = async (rep: Representada) => {
    const targetEmpId = activeEmpresaId === 'all' ? (empresas[0]?.id || '') : activeEmpresaId;
    const withEmp = { ...rep, empresaRepresentacaoId: targetEmpId };
    setRepresentadas([...representadas, withEmp]);
    await saveRepresentada(withEmp);
  };
  const handleEditRepresentada = async (rep: Representada) => {
    setRepresentadas(representadas.map(r => r.id === rep.id ? rep : r));
    await saveRepresentada(rep);
  };
  const handleDeleteRepresentada = async (id: string) => {
    setRepresentadas(representadas.filter(r => r.id !== id));
    await deleteRepresentada(id);
  };

  // Clientes
  const handleAddCliente = async (cli: Cliente) => {
    const targetEmpId = activeEmpresaId === 'all' ? (empresas[0]?.id || '') : activeEmpresaId;
    const withEmp = { ...cli, empresaRepresentacaoId: targetEmpId };
    setClientes([...clientes, withEmp]);
    await saveCliente(withEmp);
  };
  const handleEditCliente = async (cli: Cliente) => {
    setClientes(clientes.map(c => c.id === cli.id ? cli : c));
    await saveCliente(cli);
  };
  const handleDeleteCliente = async (id: string) => {
    setClientes(clientes.filter(c => c.id !== id));
    await deleteCliente(id);
  };

  // Pedidos
  const handleAddPedido = async (pedido: Pedido) => {
    const targetEmpId = activeEmpresaId === 'all' ? (empresas[0]?.id || '') : activeEmpresaId;
    const withEmp = { ...pedido, empresaRepresentacaoId: targetEmpId, createdByUserId: currentUser?.id };
    setPedidos([withEmp, ...pedidos]);
    await savePedido(withEmp);
  };
  const handleEditPedido = async (pedido: Pedido) => {
    setPedidos(pedidos.map(p => p.id === pedido.id ? pedido : p));
    await savePedido(pedido);
  };
  const handleDeletePedido = async (id: string) => {
    setPedidos(pedidos.filter(p => p.id !== id));
    await deletePedido(id);
  };

  // Produtos
  const handleAddProduto = async (prod: Produto) => {
    const targetEmpId = activeEmpresaId === 'all' ? (empresas[0]?.id || '') : activeEmpresaId;
    const withEmp = { ...prod, empresaRepresentacaoId: targetEmpId };
    setProdutos([...produtos, withEmp]);
    await saveProduto(withEmp);
  };
  const handleEditProduto = async (prod: Produto) => {
    setProdutos(produtos.map(p => p.id === prod.id ? prod : p));
    await saveProduto(prod);
  };
  const handleDeleteProduto = async (id: string) => {
    setProdutos(produtos.filter(p => p.id !== id));
    await deleteProduto(id);
  };

  // Empresas de Representação (Razões Sociais)
  const handleAddEmpresa = async (emp: EmpresaRepresentacao) => {
    const isRaulUser = currentUser?.id === 'usr-raul' || currentUser?.nome?.toLowerCase() === 'raul' || currentUser?.email === 'raul';
    if (!isRaulUser) {
      alert('Apenas o administrador geral Raul possui permissão para cadastrar razões sociais.');
      return;
    }
    setEmpresas([...empresas, emp]);
    await saveEmpresa(emp);
  };
  const handleEditEmpresa = async (emp: EmpresaRepresentacao) => {
    const isRaulUser = currentUser?.id === 'usr-raul' || currentUser?.nome?.toLowerCase() === 'raul' || currentUser?.email === 'raul';
    if (!isRaulUser) {
      alert('Apenas o administrador geral Raul possui permissão para editar razões sociais.');
      return;
    }
    setEmpresas(empresas.map(e => e.id === emp.id ? emp : e));
    await saveEmpresa(emp);
  };
  const handleDeleteEmpresa = async (id: string) => {
    const isRaulUser = currentUser?.id === 'usr-raul' || currentUser?.nome?.toLowerCase() === 'raul' || currentUser?.email === 'raul';
    if (!isRaulUser) {
      alert('Apenas o administrador geral Raul possui permissão para remover razões sociais.');
      return;
    }
    setEmpresas(empresas.filter(e => e.id !== id));
    await deleteEmpresa(id);
  };

  // Usuários do Sistema
  const handleAddUsuario = async (usr: Usuario) => {
    setUsuarios([...usuarios, usr]);
    await saveUsuario(usr);
  };
  const handleEditUsuario = async (usr: Usuario) => {
    setUsuarios(usuarios.map(u => u.id === usr.id ? usr : u));
    await saveUsuario(usr);
  };
  const handleDeleteUsuario = async (id: string) => {
    setUsuarios(usuarios.filter(u => u.id !== id));
    await deleteUsuario(id);
  };

  const handleSetMeta = async (newMeta: MetaVendas) => {
    setMeta(newMeta);
    await saveMeta(newMeta);
  };

  // Transition helper from dashboard view link
  const handleViewAndEditPedido = (pedido: Pedido) => {
    setActivePedidoToEdit(pedido);
    setActiveTab('pedidos');
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSincronizarDados = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // 1. Force upload all local data to Firestore to make sure nothing is left out
      const uploadPromises: Promise<any>[] = [];
      
      usuarios.forEach(usr => {
        uploadPromises.push(saveUsuario(usr));
      });
      
      representadas.forEach(rep => {
        uploadPromises.push(saveRepresentada(rep));
      });
      
      clientes.forEach(cli => {
        uploadPromises.push(saveCliente(cli));
      });
      
      produtos.forEach(prod => {
        uploadPromises.push(saveProduto(prod));
      });
      
      pedidos.forEach(ped => {
        uploadPromises.push(savePedido(ped));
      });
      
      empresas.forEach(emp => {
        uploadPromises.push(saveEmpresa(emp));
      });
      
      if (meta) {
        uploadPromises.push(saveMeta(meta));
      }
      
      await Promise.all(uploadPromises);
      
      // 2. Fetch the latest consolidated data from Firestore
      const [
        repData,
        cliData,
        pedData,
        prodData,
        empData,
        usrData,
        metaData
      ] = await Promise.all([
        getRepresentadas(),
        getClientes(),
        getPedidos(),
        getProdutos(),
        getEmpresas(),
        getUsuarios(),
        getMeta()
      ]);

      if (repData.length > 0) setRepresentadas(repData);
      if (cliData.length > 0) setClientes(cliData);
      if (pedData.length > 0) setPedidos(pedData);
      if (prodData.length > 0) setProdutos(prodData);
      if (empData.length > 0) setEmpresas(empData);
      if (usrData.length > 0) setUsuarios(usrData);
      if (metaData) setMeta(metaData);

      alert(`Sucesso!\nSincronização forçada realizada com sucesso!\n\nDados consolidados e enviados ao Firestore:\n- ${usuarios.length} Usuários\n- ${empresas.length} Razões Sociais\n- ${representadas.length} Representadas\n- ${clientes.length} Clientes\n- ${produtos.length} Produtos\n- ${pedidos.length} Pedidos de Venda\n\nTodos os registros estão sincronizados e salvos com segurança.`);
    } catch (err: any) {
      console.error('Erro ao sincronizar dados:', err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('permissions') || errMsg.includes('insufficient') || errMsg.includes('denied')) {
        setHasPermissionError(true);
        setShowRulesGuide(true);
        alert(`Erro de permissão no Firestore. Por favor, verifique as regras de segurança.`);
      } else {
        alert(`Ocorreu um erro ao sincronizar dados com o servidor: ${errMsg}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <h3 className="font-serif font-extrabold text-lg text-white">RepresentaPRO</h3>
            <p className="text-xs text-slate-400 mt-1">Sincronizando portal com o Firestore...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen 
        usuarios={usuarios}
        empresas={empresas}
        onLoginSuccess={(userId, empresaId) => {
          setCurrentUserId(userId);
          setActiveEmpresaId(empresaId);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {activeEmpresa?.corPrimaria && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --color-emerald-50: ${activeEmpresa.corPrimaria}10;
            --color-emerald-100: ${activeEmpresa.corPrimaria}20;
            --color-emerald-200: ${activeEmpresa.corPrimaria}30;
            --color-emerald-300: ${activeEmpresa.corPrimaria}40;
            --color-emerald-400: ${activeEmpresa.corPrimaria}60;
            --color-emerald-500: ${activeEmpresa.corPrimaria}80;
            --color-emerald-600: ${activeEmpresa.corPrimaria};
            --color-emerald-700: ${activeEmpresa.corPrimaria}E0;
            --color-emerald-800: ${activeEmpresa.corPrimaria}C0;
            --color-emerald-900: ${activeEmpresa.corPrimaria}A0;
            --color-emerald-950: ${activeEmpresa.corPrimaria}80;
          }
        `}} />
      )}
      
      {/* Top Banner & Header */}
      <header className="bg-white border-b border-slate-200 py-3 sm:py-4 px-4 sm:px-6 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {activeEmpresa?.logoUrl ? (
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                <img src={activeEmpresa.logoUrl} alt="Logo" className="object-contain max-w-full max-h-full" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm shadow-emerald-200">
                <Briefcase className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif font-extrabold text-lg text-slate-900 tracking-tight">RepresentaPRO</h1>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold shadow-xs">
                  🏢 {activeEmpresaId === 'all' ? 'Todas as Representações' : activeEmpresa?.nomeFantasia}
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold shadow-xs">
                  👤 {currentUser?.nome} ({currentUser?.role})
                </span>
              </div>
              <p className="text-xs text-slate-500">Sistema Integrado de Gestão de Representação Comercial</p>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
            <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg text-right hidden sm:block">
              <span className="text-[9px] uppercase text-slate-400 block font-bold">Representadas</span>
              <strong className="text-slate-800 font-extrabold">{filteredRepresentadas.length} ativas</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg text-right hidden sm:block">
              <span className="text-[9px] uppercase text-slate-400 block font-bold">Clientes Carteira</span>
              <strong className="text-slate-800 font-extrabold">{filteredClientes.length} lojistas</strong>
            </div>
            
            {isRaul && (
              <button
                onClick={handleSincronizarDados}
                disabled={isSyncing}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed hidden sm:flex`}
                title="Sincronizar dados com o Firebase"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar dados'}</span>
              </button>
            )}

            {/* Bell/Notification Menu */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
                className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                  showNotificationsMenu 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                    : 'bg-white border-slate-200/85 hover:bg-slate-50 text-slate-600'
                }`}
                title="Notificações"
              >
                {notifications.some(n => !n.read) ? (
                  <BellRing className="w-4 h-4 text-emerald-600 animate-bounce" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Menu */}
              <AnimatePresence>
                {showNotificationsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="font-serif font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-emerald-600" /> Notificações
                      </span>
                      <div className="flex gap-1.5">
                        {notifications.length > 0 && (
                          <button
                            onClick={() => {
                              setNotifications(notifications.map(n => ({ ...n, read: true })));
                            }}
                            className="text-[10px] text-emerald-700 hover:underline font-bold"
                          >
                            Marcar lidas
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <span className="text-slate-300">|</span>
                        )}
                        <button
                          onClick={() => {
                            setNotifications([]);
                          }}
                          className="text-[10px] text-red-600 hover:underline font-bold"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    {/* Permission Status */}
                    <div className="px-4 py-2 border-b border-slate-100 bg-emerald-50/30 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        {notificationPermission === 'granted' ? (
                          <>🏢 Notificações do Navegador: <strong className="text-emerald-700 uppercase font-extrabold">Ativas</strong></>
                        ) : (
                          <>📴 Notificações do Navegador: <strong className="text-slate-500 uppercase font-extrabold">Inativas</strong></>
                        )}
                      </span>
                      {notificationPermission !== 'granted' && (
                        <button
                          onClick={requestNotificationPermission}
                          className="text-[10px] text-emerald-700 hover:underline font-extrabold"
                        >
                          Ativar
                        </button>
                      )}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 italic flex flex-col items-center gap-1.5">
                          <Info className="w-5 h-5 text-slate-300" />
                          Nenhum alerta recebido ainda
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item));
                            }}
                            className={`p-3 text-left transition-all hover:bg-slate-50 cursor-pointer ${
                              !n.read ? 'bg-emerald-50/20 border-l-2 border-emerald-500' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-bold text-[11px] text-slate-800 block">
                                {n.title}
                              </span>
                              <span className="text-[8px] font-mono text-slate-400 whitespace-nowrap">
                                {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                              {n.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => {
                setIsAuthenticated(false);
              }}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-red-100/50"
              title="Sair do sistema"
            >
              <span>Sair</span>
            </button>
          </div>

        </div>
      </header>

      {/* Alerta de erro da API do Gemini */}
      {errorMessage && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 py-3 px-6 text-xs flex flex-wrap items-center justify-center gap-3 font-medium sticky top-[73px] z-30 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {hasPermissionError && (
            <button
              onClick={() => setShowRulesGuide(true)}
              className="bg-amber-150 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
            >
              <span>Como Resolver (Passo a Passo)</span>
            </button>
          )}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6 pb-24 sm:pb-6">
        
        {/* Navigation Tabs Bar */}
        <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
          
          {/* Tab 1: Painel Geral */}
          <button 
            id="tab-dashboard"
            onClick={() => { setActiveTab('dashboard'); setActivePedidoToEdit(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Painel Geral</span>
          </button>

          {/* Tab 2: Representadas */}
          <button 
            id="tab-representadas"
            onClick={() => { setActiveTab('representadas'); setActivePedidoToEdit(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'representadas' 
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Representadas / Fábricas</span>
          </button>

          {/* Tab 3: Clientes */}
          <button 
            id="tab-clientes"
            onClick={() => { setActiveTab('clientes'); setActivePedidoToEdit(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'clientes' 
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Carteira de Clientes</span>
          </button>

          {/* Tab: Produtos */}
          <button 
            id="tab-produtos"
            onClick={() => { setActiveTab('produtos'); setActivePedidoToEdit(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'produtos' 
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Produtos / Catálogo</span>
          </button>

          {/* Tab 4: Pedidos / Vendas */}
          <button 
            id="tab-pedidos"
            onClick={() => { setActiveTab('pedidos'); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pedidos' 
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Pedidos de Venda</span>
          </button>

          {/* Tab: Financeiro */}
          {currentUser?.role === 'Administrador' && (
            <button 
              id="tab-financeiro"
              onClick={() => { setActiveTab('financeiro'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'financeiro' 
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Financeiro & Comissões</span>
            </button>
          )}

          {/* Tab 5: Administração & Multiempresas */}
          {currentUser?.role === 'Administrador' && (
            <button 
              id="tab-admin"
              onClick={() => { setActiveTab('admin'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ml-auto ${
                activeTab === 'admin' 
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-dashed border-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Configurações & Acesso</span>
            </button>
          )}

        </div>

        {/* Tab Contents Frame */}
        <div className="flex-1 min-h-[450px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <DashboardTab 
                  pedidos={filteredPedidos}
                  clientes={filteredClientes}
                  representadas={filteredRepresentadas}
                  meta={meta}
                  setMeta={handleSetMeta}
                  onNavigateToTab={setActiveTab}
                  onEditPedido={handleViewAndEditPedido}
                  empresaRepresentacao={activeEmpresa}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'representadas' && (
                <RepresentadasTab 
                  representadas={filteredRepresentadas}
                  pedidos={filteredPedidos}
                  onAdd={handleAddRepresentada}
                  onEdit={handleEditRepresentada}
                  onDelete={handleDeleteRepresentada}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'clientes' && (
                <ClientesTab 
                  clientes={filteredClientes}
                  pedidos={filteredPedidos}
                  representadas={filteredRepresentadas}
                  onAdd={handleAddCliente}
                  onEdit={handleEditCliente}
                  onDelete={handleDeleteCliente}
                />
              )}

              {activeTab === 'produtos' && (
                <ProdutosTab 
                  produtos={filteredProdutos}
                  representadas={filteredRepresentadas}
                  onAdd={handleAddProduto}
                  onEdit={handleEditProduto}
                  onDelete={handleDeleteProduto}
                />
              )}

              {activeTab === 'pedidos' && (
                <PedidosTab 
                  pedidos={filteredPedidos}
                  clientes={filteredClientes}
                  representadas={filteredRepresentadas}
                  produtos={filteredProdutos}
                  activePedidoToEdit={activePedidoToEdit}
                  onClearActiveEdit={() => setActivePedidoToEdit(null)}
                  onAdd={handleAddPedido}
                  onEdit={handleEditPedido}
                  onDelete={handleDeletePedido}
                  empresaRepresentacao={activeEmpresa}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'financeiro' && currentUser?.role === 'Administrador' && (
                <FinanceiroTab 
                  pedidos={filteredPedidos}
                  clientes={filteredClientes}
                  representadas={filteredRepresentadas}
                  onEditPedido={handleEditPedido}
                  onDeletePedido={handleDeletePedido}
                  currentUser={currentUser}
                  empresaRepresentacao={activeEmpresa}
                />
              )}

              {activeTab === 'admin' && currentUser?.role === 'Administrador' && (
                <AdminTab 
                  empresas={empresas}
                  usuarios={usuarios}
                  activeEmpresaId={activeEmpresaId}
                  currentUserId={currentUserId}
                  onAddEmpresa={handleAddEmpresa}
                  onEditEmpresa={handleEditEmpresa}
                  onDeleteEmpresa={handleDeleteEmpresa}
                  onAddUsuario={handleAddUsuario}
                  onEditUsuario={handleEditUsuario}
                  onDeleteUsuario={handleDeleteUsuario}
                  onSelectEmpresa={handleSelectEmpresa}
                  onSelectUsuario={handleSelectUsuario}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <span>&copy; {new Date().getFullYear()} Desenvolvido por Raul Soares. Todos os direitos reservados.</span>
          <div className="flex items-center gap-1.5">
            <a href="https://wa.me/5532999098468" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              Contato WhatsApp: (32) 99909-8468
            </a>
            <span className="hidden sm:inline-block text-slate-300 mx-2">|</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Multiempresas: <strong className="text-slate-600">{empresas.length}</strong></span>
            </span>
          </div>
        </div>
      </footer>

      {/* Bottom Tab Bar for Mobile & PWA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/85 px-2 py-2 flex justify-around items-center shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:hidden">
        
        {/* Mobile Tab 1: Painel */}
        <button
          onClick={() => { setActiveTab('dashboard'); setActivePedidoToEdit(null); }}
          className={`flex flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'text-emerald-600 scale-105' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-[8px] font-bold mt-0.5">Painel</span>
        </button>

        {/* Mobile Tab 2: Representadas */}
        <button
          onClick={() => { setActiveTab('representadas'); setActivePedidoToEdit(null); }}
          className={`flex flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
            activeTab === 'representadas' ? 'text-emerald-600 scale-105' : 'text-slate-500'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span className="text-[8px] font-bold mt-0.5">Fábricas</span>
        </button>

        {/* Mobile Tab 3: Clientes */}
        <button
          onClick={() => { setActiveTab('clientes'); setActivePedidoToEdit(null); }}
          className={`flex flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
            activeTab === 'clientes' ? 'text-emerald-600 scale-105' : 'text-slate-500'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[8px] font-bold mt-0.5">Clientes</span>
        </button>

        {/* Mobile Tab 4: Produtos */}
        <button
          onClick={() => { setActiveTab('produtos'); setActivePedidoToEdit(null); }}
          className={`flex flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
            activeTab === 'produtos' ? 'text-emerald-600 scale-105' : 'text-slate-500'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span className="text-[8px] font-bold mt-0.5">Produtos</span>
        </button>

        {/* Mobile Tab 5: Pedidos */}
        <button
          onClick={() => { setActiveTab('pedidos'); }}
          className={`flex flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
            activeTab === 'pedidos' ? 'text-emerald-600 scale-105' : 'text-slate-500'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="text-[8px] font-bold mt-0.5">Pedidos</span>
        </button>

        {/* Mobile Tab 5.5: Financeiro */}
        {currentUser?.role === 'Administrador' && (
          <button
            onClick={() => { setActiveTab('financeiro'); setActivePedidoToEdit(null); }}
            className={`flex flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'financeiro' ? 'text-emerald-600 scale-105' : 'text-slate-500'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5">Financeiro</span>
          </button>
        )}

        {/* Mobile Tab 6: Admin */}
        {currentUser?.role === 'Administrador' && (
          <button
            onClick={() => { setActiveTab('admin'); }}
            className={`flex flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'admin' ? 'text-slate-800 scale-105' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[8px] font-bold mt-0.5">Acesso</span>
          </button>
        )}

      </div>

      {/* Modal Guia de Regras do Firestore */}
      <AnimatePresence>
        {showRulesGuide && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 text-slate-800 font-sans my-8"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="font-serif font-extrabold text-base text-slate-900 leading-tight">Como Corrigir as Permissões do Firestore</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Siga os passos abaixo para liberar o acesso ao banco <strong>representapro-b84c3</strong></p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRulesGuide(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-600 leading-relaxed max-h-[350px] overflow-y-auto pr-2">
                <div className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] shrink-0 mt-0.5">1</span>
                  <div>
                    <strong className="text-slate-900 font-bold block mb-0.5">Acesse o Console do Firebase</strong>
                    <p>Clique no link para abrir o console em outra aba: <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline hover:text-emerald-700">console.firebase.google.com</a> e selecione o seu projeto <strong>representapro-b84c3</strong>.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] shrink-0 mt-0.5">2</span>
                  <div>
                    <strong className="text-slate-900 font-bold block mb-0.5">Navegue até o Firestore Database</strong>
                    <p>No menu lateral esquerdo, clique em <strong>Firestore Database</strong> (dentro do menu "Build" ou "Criação").</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] shrink-0 mt-0.5">3</span>
                  <div>
                    <strong className="text-slate-900 font-bold block mb-0.5">Selecione a aba "Regras" (Rules)</strong>
                    <p>Na parte superior da tela do Firestore, clique na segunda aba chamada <strong>Regras</strong> (ao lado de "Dados").</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] shrink-0 mt-0.5">4</span>
                  <div>
                    <strong className="text-slate-900 font-bold block mb-0.5">Substitua o código de regras pelo seguinte:</strong>
                    <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] font-mono text-slate-700 mt-1 overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] shrink-0 mt-0.5">5</span>
                  <div>
                    <strong className="text-slate-900 font-bold block mb-0.5">Clique no botão "Publicar" (Publish)</strong>
                    <p>Clique no botão azul <strong>Publicar</strong> no canto superior direito para aplicar as regras modificadas.</p>
                  </div>
                </div>

                <div className="flex gap-3 pb-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] shrink-0 mt-0.5">6</span>
                  <div>
                    <strong className="text-slate-900 font-bold block mb-0.5">Recarregue este aplicativo</strong>
                    <p>Após a publicação (que demora cerca de 10 segundos para propagar), <strong>recarregue esta página</strong> do RepresentaPRO. O erro sumirá e o banco será sincronizado com sucesso!</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowRulesGuide(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  Entendi, vou configurar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Push Toast Alerts */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-800 flex gap-3.5"
          >
            <div className="shrink-0 p-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg h-fit self-start">
              {activeToast.type === 'order' ? (
                <ShoppingCart className="w-5 h-5 text-emerald-400 animate-pulse" />
              ) : (
                <Coins className="w-5 h-5 text-amber-400 animate-bounce" />
              )}
            </div>
            
            <div className="flex-1 text-left">
              <span className="font-serif font-bold text-xs text-slate-100 block">
                {activeToast.title}
              </span>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {activeToast.message}
              </p>
              <div className="flex justify-between items-center mt-2 border-t border-slate-800 pt-1.5">
                <span className="text-[9px] font-mono text-slate-500">Notificação Push (Sistema)</span>
                <button
                  onClick={() => {
                    setNotifications(notifications.map(item => item.id === activeToast.id ? { ...item, read: true } : item));
                    setActiveToast(null);
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
                >
                  Entendi
                </button>
              </div>
            </div>

            <button 
              onClick={() => setActiveToast(null)} 
              className="text-slate-500 hover:text-slate-300 transition-colors h-fit self-start cursor-pointer"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
