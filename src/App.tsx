import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ShoppingCart,
  Landmark,
  AlertCircle,
  Tag,
  ShieldCheck,
  Coins,
  Bell,
  BellOff,
  BellRing,
  Info,
  RefreshCw,
  X as CloseIcon,
} from 'lucide-react';
import { formatarMoeda, getUserPermissions } from './utils';
import { motion, AnimatePresence } from 'motion/react';
import { Representada, Cliente, Lead, Pedido, MetaVendas, Produto, Usuario, EmpresaRepresentacao } from './types';
import {
  DEMO_EMPRESA_ID,
  DEMO_REPRESENTADAS,
  DEMO_CLIENTES,
  DEMO_PEDIDOS,
  DEMO_METAS,
  DEMO_PRODUTOS,
  DEMO_EMPRESAS,
  DEMO_USUARIOS,
  DEMO_NOTIFICACOES,
} from './data';
import {
  auth,
  resolveUserProfile,
  isSystemAdminAccount,
  scopedCollection,
  TenantScope,
  getRepresentadas,
  saveRepresentada,
  deleteRepresentada,
  getClientes,
  saveCliente,
  deleteCliente,
  getLeads,
  saveLead,
  convertLeadToCliente,
  LeadConversionError,
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
  clearOfflineFirestoreCache,
  waitForOfflineWritesToSync,
} from './firebase';
import DashboardTab from './components/DashboardTab';
import RepresentadasTab from './components/RepresentadasTab';
import ClientesTab from './components/ClientesTab';
import LeadsTab from './components/LeadsTab';
import PedidosTab from './components/PedidosTab';
import ProdutosTab from './components/ProdutosTab';
import FinanceiroTab from './components/FinanceiroTab';
import AdminTab from './components/AdminTab';
import LoginScreen from './components/LoginScreen';

function isTemporaryConnectionError(error: any): boolean {
  const details = `${error?.code || ''} ${error?.message || error || ''}`;
  return (typeof navigator !== 'undefined' && !navigator.onLine)
    || /network|unavailable|offline|timed out|deadline|could not reach/i.test(details);
}

export default function App() {
  const isDemoMode =
    typeof window !== 'undefined' &&
    ['1', 'true'].includes(new URLSearchParams(window.location.search).get('demo') || '');

  // Production state starts empty and is populated only after Firebase Auth
  // resolves a verified UID-bound profile. Demo data is local and synthetic.
  const [representadas, setRepresentadas] = useState<Representada[]>(() => isDemoMode ? DEMO_REPRESENTADAS : []);
  const [clientes, setClientes] = useState<Cliente[]>(() => isDemoMode ? DEMO_CLIENTES : []);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>(() => isDemoMode ? DEMO_PEDIDOS : []);
  const [meta, setMeta] = useState<MetaVendas>(() => isDemoMode ? DEMO_METAS : { metaMensal: 0, anoMes: new Date().toISOString().slice(0, 7) });
  const [produtos, setProdutos] = useState<Produto[]>(() => isDemoMode ? DEMO_PRODUTOS : []);
  const [empresas, setEmpresas] = useState<EmpresaRepresentacao[]>(() => isDemoMode ? DEMO_EMPRESAS : []);
  const [activeEmpresaId, setActiveEmpresaId] = useState<string>(() => isDemoMode ? DEMO_EMPRESA_ID : '');
  const [usuarios, setUsuarios] = useState<Usuario[]>(() => isDemoMode ? DEMO_USUARIOS : []);
  const [currentUser, setCurrentUser] = useState<Usuario | null>(() => isDemoMode ? DEMO_USUARIOS[0] : null);
  const currentUserId = currentUser?.id || '';
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isDemoMode);
  const [authReady, setAuthReady] = useState<boolean>(isDemoMode);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator === 'undefined' || navigator.onLine);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const snapshotSyncState = React.useRef<Record<string, { fromCache: boolean; hasPendingWrites: boolean }>>({});

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    const removeSecrets = (value: any): any => {
      if (Array.isArray(value)) return value.map(removeSecrets);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
          .filter(([key]) => !['senha', 'gmailUser', 'gmailAppPass'].includes(key))
          .map(([key, nested]) => [key, removeSecrets(nested)]));
      }
      return value;
    };
    for (const key of ['rep_usuarios', 'rep_empresas']) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const safeRecords = removeSecrets(JSON.parse(raw));
        localStorage.setItem(key, JSON.stringify(safeRecords));
      } catch {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem('rep_current_user_id');
    localStorage.removeItem('rep_is_authenticated');
    localStorage.removeItem('rep_active_empresa_id');
  }, [isDemoMode]);

  // --- UI Navigation & Active States ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'representadas' | 'clientes' | 'leads' | 'pedidos' | 'produtos' | 'financeiro' | 'admin'>('dashboard');
  const [activePedidoToEdit, setActivePedidoToEdit] = useState<Pedido | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!isDemoMode);
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

  const [notifications, setNotifications] = useState<AppNotification[]>(() => isDemoMode ? DEMO_NOTIFICACOES : []);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });

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
              icon: '/representapro-icon.svg',
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

  // Firebase Auth restores its local session so the previously cached profile
  // and tenant data can open while offline. Online refreshes still revalidate
  // the account, and Firestore rules remain authoritative for server requests.
  useEffect(() => {
    if (isDemoMode) {
      setAuthReady(true);
      setLoading(false);
      return;
    }

    let attemptId = 0;
    const resolveAuthenticatedUser = async (firebaseUser: NonNullable<typeof auth.currentUser>) => {
      const currentAttempt = ++attemptId;
      setLoading(true);
      try {
        const profile = await resolveUserProfile(firebaseUser);
        if (!profile.ativo) throw new Error('Este usuário foi desativado. Fale com o administrador da empresa.');
        if (currentAttempt !== attemptId) return;
        setCurrentUser(profile);
        setUsuarios([profile]);
        setActiveEmpresaId(isSystemAdminAccount(firebaseUser) ? 'all' : (profile.empresaRepresentacaoId || ''));
        setIsAuthenticated(true);
        setSessionError(null);
      } catch (error: any) {
        if (currentAttempt !== attemptId) return;
        const message = error?.message || 'Não foi possível validar o acesso deste usuário.';
        const temporaryConnectionFailure = isTemporaryConnectionError(error);
        if (!temporaryConnectionFailure) await signOut(auth).catch(() => undefined);
        setCurrentUser(null);
        setUsuarios([]);
        setIsAuthenticated(false);
        setSessionError(temporaryConnectionFailure
          ? 'Sem conexão. Este aparelho precisa ter acessado a conta online ao menos uma vez para guardar o perfil e os dados. Tentaremos novamente quando a internet voltar.'
          : message);
      } finally {
        if (currentAttempt === attemptId) {
          setAuthReady(true);
          setLoading(false);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        attemptId += 1;
        setCurrentUser(null);
        setUsuarios([]);
        setIsAuthenticated(false);
        setActiveEmpresaId('');
        setSessionError(null);
        setAuthReady(true);
        setLoading(false);
        return;
      }
      void resolveAuthenticatedUser(firebaseUser);
    });

    const retryWhenOnline = () => {
      if (auth.currentUser) void resolveAuthenticatedUser(auth.currentUser);
    };
    window.addEventListener('online', retryWhenOnline);
    return () => {
      attemptId += 1;
      unsubscribe();
      window.removeEventListener('online', retryWhenOnline);
    };
  }, [isDemoMode]);

  const systemAdmin = !isDemoMode && isSystemAdminAccount(auth.currentUser);
  const tenantScope: TenantScope = {
    tenantId: systemAdmin ? activeEmpresaId : (currentUser?.empresaRepresentacaoId || ''),
    systemAdmin,
  };
  const canManageUsers = Boolean(systemAdmin || currentUser?.role === 'Administrador' || currentUser?.permissoes?.gerenciarUsuarios);

  // Initial reads are tenant-scoped in Firestore. The UI filter below is only
  // presentation; the security rules independently enforce the same boundary.
  useEffect(() => {
    if (isDemoMode) return;
    if (!authReady || !isAuthenticated || !currentUser) {
      setRepresentadas([]);
      setClientes([]);
      setLeads([]);
      setPedidos([]);
      setProdutos([]);
      setEmpresas([]);
      setUsuarios([]);
      return;
    }

    const scope: TenantScope = {
      tenantId: systemAdmin ? activeEmpresaId : (currentUser.empresaRepresentacaoId || ''),
      systemAdmin,
    };
    if (!scope.systemAdmin && !scope.tenantId) {
      setErrorMessage('O usuário autenticado ainda não está vinculado a uma empresa.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const dataPermissions = getUserPermissions(currentUser);
    setLoading(true);
    setRepresentadas([]);
    setClientes([]);
    setLeads([]);
    setPedidos([]);
    setProdutos([]);
    setEmpresas([]);
    setUsuarios([currentUser]);

    Promise.all([
      dataPermissions.verRepresentadas ? getRepresentadas(scope) : Promise.resolve([]),
      dataPermissions.verClientes ? getClientes(scope) : Promise.resolve([]),
      dataPermissions.verLeads ? getLeads(scope, currentUser) : Promise.resolve([]),
      getPedidos(scope, currentUser),
      dataPermissions.verProdutos ? getProdutos(scope) : Promise.resolve([]),
      getEmpresas(scope),
      getUsuarios(scope, currentUser, canManageUsers),
      dataPermissions.verFinanceiro ? getMeta(scope) : Promise.resolve({ metaMensal: 0, anoMes: new Date().toISOString().slice(0, 7), empresaRepresentacaoId: scope.tenantId }),
    ]).then(([repData, cliData, leadData, pedData, prodData, empData, usrData, metaData]) => {
      if (cancelled) return;
      setRepresentadas(repData);
      setClientes(cliData);
      setLeads(leadData);
      setPedidos(pedData);
      setProdutos(prodData);
      setEmpresas(empData);
      setUsuarios(usrData);
      setMeta(metaData);
      setErrorMessage(null);
      setHasPermissionError(false);
    }).catch((error: any) => {
      if (cancelled) return;
      console.error('Falha ao carregar dados protegidos:', error);
      const message = error?.message || 'Falha ao carregar dados da empresa.';
      setHasPermissionError(message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied'));
      setErrorMessage('Não foi possível carregar os dados autorizados para este usuário. Verifique a conexão e as permissões da conta.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [isDemoMode, authReady, isAuthenticated, currentUser?.id, activeEmpresaId, systemAdmin, canManageUsers]);

  // Tenant-scoped live updates. The Firestore rules reject an unfiltered query
  // for ordinary members, even if someone alters the frontend.
  const isFirstSnapshot = React.useRef(true);
  const representadasRef = React.useRef(representadas);
  const clientesRef = React.useRef(clientes);
  const pedidosRef = React.useRef(pedidos);
  const activeEmpresaIdRef = React.useRef(activeEmpresaId);
  useEffect(() => { representadasRef.current = representadas; }, [representadas]);
  useEffect(() => { clientesRef.current = clientes; }, [clientes]);
  useEffect(() => { pedidosRef.current = pedidos; }, [pedidos]);
  useEffect(() => { activeEmpresaIdRef.current = activeEmpresaId; }, [activeEmpresaId]);

  useEffect(() => {
    if (isDemoMode || !authReady || !isAuthenticated || !currentUser || loading) return;
    const scope: TenantScope = {
      tenantId: systemAdmin ? activeEmpresaId : (currentUser.empresaRepresentacaoId || ''),
      systemAdmin,
    };
    if (!scope.systemAdmin && !scope.tenantId) return;

    const dataPermissions = getUserPermissions(currentUser);
    isFirstSnapshot.current = true;
    snapshotSyncState.current = {};
    setIsUsingCachedData(false);
    setHasPendingSync(false);
    const subscriptions: Array<() => void> = [];
    const subscribe = (name: string, handler: (snapshot: any) => void, owner?: Usuario) => {
      subscriptions.push(onSnapshot(
        scopedCollection(name, scope, owner),
        { includeMetadataChanges: true },
        (snapshot) => {
          snapshotSyncState.current[name] = {
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
          };
          const statuses = Object.values(snapshotSyncState.current) as Array<{ fromCache: boolean; hasPendingWrites: boolean }>;
          setIsUsingCachedData(statuses.some((status) => status.fromCache));
          setHasPendingSync(statuses.some((status) => status.hasPendingWrites));
          handler(snapshot);
        },
        (error) => {
          console.warn(`Atualização protegida indisponível: ${name}`, error.code);
        },
      ));
    };

    subscribe('pedidos', (snapshot) => {
      const list = snapshot.docs.map((item: any) => item.data() as Pedido);
      if (!isFirstSnapshot.current) {
        snapshot.docChanges().forEach((change: any) => {
          const data = change.doc.data() as Pedido;
          if (data.empresaRepresentacaoId !== activeEmpresaIdRef.current && activeEmpresaIdRef.current !== 'all') return;
          if (change.type === 'added') {
            const repName = representadasRef.current.find((r) => r.id === data.representadaId)?.nomeFantasia || 'Fábrica';
            const cliName = clientesRef.current.find((c) => c.id === data.clienteId)?.nomeFantasia || 'Cliente';
            triggerAppNotification('Novo Pedido de Venda 📦', `Pedido nº ${data.numeroPedido} (${cliName} ➔ ${repName}) no valor de ${formatarMoeda(data.valorTotal)} foi inserido no sistema.`, 'order');
          } else if (change.type === 'modified') {
            const previous = pedidosRef.current.find((item) => item.id === data.id);
            if (data.statusComissao === 'Liberada' && previous?.statusComissao !== 'Liberada') {
              const repName = representadasRef.current.find((r) => r.id === data.representadaId)?.nomeFantasia || 'Fábrica';
              triggerAppNotification('Comissão Liberada! 💸', `A comissão de ${formatarMoeda(data.valorComissao)} do pedido nº ${data.numeroPedido} (${repName}) foi liberada pelo administrador.`, 'commission');
            }
          }
        });
      }
      setPedidos(list);
      isFirstSnapshot.current = false;
    }, currentUser);
    if (dataPermissions.verClientes) subscribe('clientes', (snapshot) => setClientes(snapshot.docs.map((item: any) => item.data() as Cliente)));
    if (dataPermissions.verLeads) subscribe('leads', (snapshot) => setLeads(snapshot.docs.map((item: any) => item.data() as Lead)), currentUser);
    if (dataPermissions.verRepresentadas) subscribe('representadas', (snapshot) => setRepresentadas(snapshot.docs.map((item: any) => item.data() as Representada)));
    if (dataPermissions.verProdutos) subscribe('produtos', (snapshot) => setProdutos(snapshot.docs.map((item: any) => item.data() as Produto)));
    subscribe('empresas', (snapshot) => setEmpresas(snapshot.docs.map((item: any) => item.data() as EmpresaRepresentacao)));
    if (canManageUsers) {
      subscribe('usuarios', (snapshot) => {
        const profiles = snapshot.docs.map((item: any) => { const { senha: _password, gmailUser: _gmailUser, gmailAppPass: _gmailPass, ...safe } = item.data(); return { ...safe, id: item.id } as Usuario; });
        setUsuarios(Array.from(new Map([currentUser, ...profiles].map((profile) => [profile.id, profile])).values()));
      });
    }
    if (dataPermissions.verFinanceiro) {
      subscribe('meta', (snapshot) => {
        const matching = scope.tenantId === 'all' ? snapshot.docs[0] : snapshot.docs.find((item: any) => item.data().empresaRepresentacaoId === scope.tenantId);
        if (matching) setMeta(matching.data() as MetaVendas);
      });
    }

    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [isDemoMode, authReady, isAuthenticated, currentUser?.id, activeEmpresaId, systemAdmin, canManageUsers, loading]);

  // --- Active selections and UI presentation filters ---
  const activeEmpresa = empresas.find((company) => company.id === activeEmpresaId) || empresas[0];
  const userPermissions = getUserPermissions(currentUser || undefined);
  const isRaul = systemAdmin || isDemoMode;
  const showAllData = systemAdmin && activeEmpresaId === 'all';
  const filteredRepresentadas = showAllData ? representadas : representadas.filter((item) => item.empresaRepresentacaoId === activeEmpresaId);
  const filteredClientes = showAllData ? clientes : clientes.filter((item) => item.empresaRepresentacaoId === activeEmpresaId);
  const filteredLeads = showAllData ? leads : leads.filter((item) => item.empresaRepresentacaoId === activeEmpresaId);
  let baseFilteredPedidos = showAllData ? pedidos : pedidos.filter((item) => item.empresaRepresentacaoId === activeEmpresaId);
  if (!userPermissions.verTodasVendas && !showAllData && currentUser) {
    baseFilteredPedidos = baseFilteredPedidos.filter((item) => item.createdByUserId === currentUser.id || item.createdByUserId === currentUser.legacyId);
  }
  const filteredPedidos = baseFilteredPedidos;
  const filteredProdutos = showAllData ? produtos : produtos.filter((item) => item.empresaRepresentacaoId === activeEmpresaId);

  useEffect(() => {
    const allowed = activeTab === 'dashboard' ? userPermissions.verDashboard
      : activeTab === 'representadas' ? userPermissions.verRepresentadas
        : activeTab === 'clientes' ? userPermissions.verClientes
        : activeTab === 'leads' ? userPermissions.verLeads
          : activeTab === 'produtos' ? userPermissions.verProdutos
            : activeTab === 'financeiro' ? currentUser?.role === 'Administrador' || userPermissions.verFinanceiro
              : activeTab === 'admin' ? currentUser?.role === 'Administrador'
                : true;
    if (!allowed) {
      const nextTab = userPermissions.verDashboard ? 'dashboard'
        : userPermissions.verRepresentadas ? 'representadas'
          : userPermissions.verClientes ? 'clientes'
          : userPermissions.verLeads ? 'leads'
            : userPermissions.verProdutos ? 'produtos'
              : 'pedidos';
      setActiveTab(nextTab);
    }
  }, [activeTab, currentUser?.role, userPermissions.verDashboard, userPermissions.verRepresentadas, userPermissions.verClientes, userPermissions.verLeads, userPermissions.verProdutos, userPermissions.verFinanceiro]);

  const handleSelectEmpresa = (id: string) => {
    if (systemAdmin || isDemoMode) setActiveEmpresaId(id);
  };

  // --- Handlers for CRUD ---
  
  // Representadas
  const handleAddRepresentada = async (rep: Representada) => {
    const targetEmpId = systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId);
    const withEmp = { ...rep, empresaRepresentacaoId: targetEmpId };
    setRepresentadas([...representadas, withEmp]);
    if (!isDemoMode) await saveRepresentada(withEmp);
  };
  const handleEditRepresentada = async (rep: Representada) => {
    const existing = representadas.find(r => r.id === rep.id);
    const updated = { ...existing, ...rep, empresaRepresentacaoId: existing?.empresaRepresentacaoId || (systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId)) };
    setRepresentadas(representadas.map(r => r.id === rep.id ? updated : r));
    if (!isDemoMode) await saveRepresentada(updated);
  };
  const handleDeleteRepresentada = async (id: string) => {
    setRepresentadas(representadas.filter(r => r.id !== id));
    if (!isDemoMode) await deleteRepresentada(id);
  };

  // Clientes
  const handleAddCliente = async (cli: Cliente) => {
    const targetEmpId = systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId);
    const withEmp = { ...cli, empresaRepresentacaoId: targetEmpId };
    setClientes([...clientes, withEmp]);
    if (!isDemoMode) await saveCliente(withEmp);
  };
  const handleEditCliente = async (cli: Cliente) => {
    const existing = clientes.find(c => c.id === cli.id);
    const updated = { ...existing, ...cli, empresaRepresentacaoId: existing?.empresaRepresentacaoId || (systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId)) };
    setClientes(clientes.map(c => c.id === cli.id ? updated : c));
    if (!isDemoMode) await saveCliente(updated);
  };
  const handleDeleteCliente = async (id: string) => {
    setClientes(clientes.filter(c => c.id !== id));
    if (!isDemoMode) await deleteCliente(id);
  };

  const handleAddLead = (lead: Lead) => {
    const tenantId = lead.empresaRepresentacaoId;
    if (!tenantId || tenantId === 'all' || (!systemAdmin && tenantId !== currentUser?.empresaRepresentacaoId)) {
      setErrorMessage('O lead precisa estar vinculado à empresa autorizada deste usuário.');
      return;
    }
    const safeLead = { ...lead, empresaRepresentacaoId: tenantId };
    setLeads((current) => [safeLead, ...current]);
    if (!isDemoMode) {
      void saveLead(safeLead).catch((error: any) => {
        setLeads((current) => current.filter((item) => item.id !== safeLead.id));
        console.error('Falha ao salvar lead:', error?.code || 'unknown');
        setErrorMessage('Não foi possível salvar o lead. Verifique a conexão e as permissões da conta.');
      });
    }
  };

  const handleEditLead = (lead: Lead) => {
    const existing = leads.find((item) => item.id === lead.id);
    if (!existing || existing.empresaRepresentacaoId !== lead.empresaRepresentacaoId) {
      setErrorMessage('Não foi possível validar o vínculo deste lead. Atualize os dados e tente novamente.');
      return;
    }
    const safeLead = {
      ...lead,
      empresaRepresentacaoId: existing.empresaRepresentacaoId,
      criadoPorUserId: existing.criadoPorUserId,
      criadoEm: existing.criadoEm,
      responsavelUserId: existing.responsavelUserId,
    };
    setLeads((current) => current.map((item) => item.id === safeLead.id ? safeLead : item));
    if (!isDemoMode) {
      void saveLead(safeLead).catch((error: any) => {
        setLeads((current) => current.map((item) => item.id === safeLead.id && item.atualizadoEm === safeLead.atualizadoEm ? existing : item));
        console.error('Falha ao atualizar lead:', error?.code || 'unknown');
        setErrorMessage('Não foi possível atualizar o lead. Verifique a conexão e as permissões da conta.');
      });
    }
  };

  const handleConvertLead = async (convertedLead: Lead, cliente: Cliente) => {
    const existing = leads.find((item) => item.id === convertedLead.id);
    if (!userPermissions.editarLeads || !userPermissions.verClientes || !userPermissions.editarClientes
      || !existing || existing.empresaRepresentacaoId !== convertedLead.empresaRepresentacaoId
      || existing.etapa === 'Convertido' || existing.etapa === 'Perdido') {
      setErrorMessage('Não foi possível converter o lead. Confira se o cliente já está cadastrado e tente novamente.');
      return;
    }

    const linkedCliente = clientes.find((item) => item.id === existing.id
      && item.leadOrigemId === existing.id
      && item.empresaRepresentacaoId === existing.empresaRepresentacaoId);
    const clienteConvertido: Cliente = {
      ...cliente,
      id: existing.id,
      empresaRepresentacaoId: existing.empresaRepresentacaoId,
      leadOrigemId: existing.id,
    };
    const cnpjDigits = clienteConvertido.cnpj.replace(/\D/g, '');
    const duplicateCustomer = Boolean(cnpjDigits) && clientes.some((item) => item.id !== clienteConvertido.id
      && item.empresaRepresentacaoId === clienteConvertido.empresaRepresentacaoId
      && item.cnpj.replace(/\D/g, '') === cnpjDigits);
    if (duplicateCustomer) {
      setErrorMessage('Não foi possível converter o lead porque já existe outro cliente com este CNPJ nesta empresa.');
      return;
    }

    const leadConvertidoSeguro: Lead = {
      ...convertedLead,
      id: existing.id,
      empresaRepresentacaoId: existing.empresaRepresentacaoId,
      responsavelUserId: existing.responsavelUserId,
      criadoPorUserId: existing.criadoPorUserId,
      criadoEm: existing.criadoEm,
    };
    setLeads((current) => current.map((item) => item.id === existing.id ? leadConvertidoSeguro : item));
    setClientes((current) => current.some((item) => item.id === clienteConvertido.id)
      ? current.map((item) => item.id === clienteConvertido.id ? clienteConvertido : item)
      : [clienteConvertido, ...current]);
    if (!isDemoMode) {
      await convertLeadToCliente(leadConvertidoSeguro, clienteConvertido).catch((error: unknown) => {
        const clientWasSaved = error instanceof LeadConversionError && error.clientSaved;
        setLeads((current) => current.map((item) => item.id === existing.id && item.atualizadoEm === leadConvertidoSeguro.atualizadoEm ? existing : item));
        setClientes((current) => {
          if (clientWasSaved) {
            return current.some((item) => item.id === clienteConvertido.id)
              ? current.map((item) => item.id === clienteConvertido.id ? clienteConvertido : item)
              : [clienteConvertido, ...current];
          }
          return linkedCliente
            ? current.map((item) => item.id === linkedCliente.id ? linkedCliente : item)
            : current.filter((item) => item.id !== clienteConvertido.id);
        });
        const errorCode = error instanceof Error && 'code' in error ? String(error.code) : 'unknown';
        console.error('Falha ao converter lead em cliente:', errorCode);
        setErrorMessage(clientWasSaved
          ? 'O cliente foi salvo, mas o lead continua aberto. Tente converter novamente para concluir sem duplicar o cadastro.'
          : 'A conversão não foi sincronizada. O lead foi preservado; confira a conexão e as permissões.');
      });
    }
  };

  // Pedidos
  const handleAddPedido = async (pedido: Pedido) => {
    const targetEmpId = systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId);
    const withEmp = { ...pedido, empresaRepresentacaoId: targetEmpId, createdByUserId: auth.currentUser?.uid };
    setPedidos([withEmp, ...pedidos]);
    if (!isDemoMode) await savePedido(withEmp);
  };
  const handleEditPedido = async (pedido: Pedido) => {
    const existing = pedidos.find(p => p.id === pedido.id);
    const updated = { ...existing, ...pedido, empresaRepresentacaoId: existing?.empresaRepresentacaoId || (systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId)) };
    if (!updated.createdByUserId) {
      updated.createdByUserId = auth.currentUser?.uid;
    }
    setPedidos(pedidos.map(p => p.id === pedido.id ? updated : p));
    if (!isDemoMode) await savePedido(updated);
  };
  const handleDeletePedido = async (id: string) => {
    setPedidos(pedidos.filter(p => p.id !== id));
    if (!isDemoMode) await deletePedido(id);
  };

  // Produtos
  const handleAddProduto = async (prod: Produto) => {
    const targetEmpId = systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId);
    const withEmp = { ...prod, empresaRepresentacaoId: targetEmpId };
    setProdutos([...produtos, withEmp]);
    if (!isDemoMode) await saveProduto(withEmp);
  };
  const handleEditProduto = async (prod: Produto) => {
    const existing = produtos.find(p => p.id === prod.id);
    const updated = { ...existing, ...prod, empresaRepresentacaoId: existing?.empresaRepresentacaoId || (systemAdmin && activeEmpresaId === 'all' ? (empresas[0]?.id || '') : (currentUser?.empresaRepresentacaoId || activeEmpresaId)) };
    setProdutos(produtos.map(p => p.id === prod.id ? updated : p));
    if (!isDemoMode) await saveProduto(updated);
  };
  const handleDeleteProduto = async (id: string) => {
    setProdutos(produtos.filter(p => p.id !== id));
    if (!isDemoMode) await deleteProduto(id);
  };

  // Empresas de Representação (Razões Sociais)
  const handleAddEmpresa = async (emp: EmpresaRepresentacao) => {
    const isRaulUser = systemAdmin || isDemoMode;
    if (!isRaulUser) {
      alert('Apenas o administrador geral Raul possui permissão para cadastrar razões sociais.');
      return;
    }
    setEmpresas([...empresas, emp]);
    if (!isDemoMode) await saveEmpresa(emp);
  };
  const handleEditEmpresa = async (emp: EmpresaRepresentacao) => {
    const isRaulUser = systemAdmin || isDemoMode;
    if (!isRaulUser) {
      alert('Apenas o administrador geral Raul possui permissão para editar razões sociais.');
      return;
    }
    setEmpresas(empresas.map(e => e.id === emp.id ? emp : e));
    if (!isDemoMode) await saveEmpresa(emp);
  };
  const handleDeleteEmpresa = async (id: string) => {
    const isRaulUser = systemAdmin || isDemoMode;
    if (!isRaulUser) {
      alert('Apenas o administrador geral Raul possui permissão para remover razões sociais.');
      return;
    }
    setEmpresas(empresas.filter(e => e.id !== id));
    if (!isDemoMode) await deleteEmpresa(id);
  };

  // Usuários do Sistema
  const handleAddUsuario = async (usr: Usuario) => {
    setUsuarios([...usuarios, usr]);
    if (!isDemoMode) await saveUsuario(usr);
  };
  const handleEditUsuario = async (usr: Usuario) => {
    setUsuarios(usuarios.map(u => u.id === usr.id ? usr : u));
    if (!isDemoMode) await saveUsuario(usr);
  };
  const handleDeleteUsuario = async (id: string) => {
    setUsuarios(usuarios.filter(u => u.id !== id));
    if (!isDemoMode) await deleteUsuario(id);
  };

  const handleSetMeta = async (newMeta: MetaVendas) => {
    setMeta(newMeta);
    if (!isDemoMode) await saveMeta(newMeta);
  };

  // Transition helper from dashboard view link
  const handleViewAndEditPedido = (pedido: Pedido) => {
    setActivePedidoToEdit(pedido);
    setActiveTab('pedidos');
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSincronizarDados = async () => {
    if (isDemoMode) {
      alert('Modo demonstração: os dados são fictícios e não são sincronizados.');
      return;
    }
    if (isSyncing || !currentUser) return;
    setIsSyncing(true);
    const scope: TenantScope = {
      tenantId: systemAdmin ? activeEmpresaId : (currentUser.empresaRepresentacaoId || ''),
      systemAdmin,
    };
    try {
      const [repData, cliData, leadData, pedData, prodData, empData, usrData, metaData] = await Promise.all([
        getUserPermissions(currentUser).verRepresentadas ? getRepresentadas(scope, true) : Promise.resolve([]),
        getUserPermissions(currentUser).verClientes ? getClientes(scope, true) : Promise.resolve([]),
        getUserPermissions(currentUser).verLeads ? getLeads(scope, currentUser, true) : Promise.resolve([]),
        getPedidos(scope, currentUser, true),
        getUserPermissions(currentUser).verProdutos ? getProdutos(scope, true) : Promise.resolve([]),
        getEmpresas(scope, true),
        getUsuarios(scope, currentUser, canManageUsers, true),
        getUserPermissions(currentUser).verFinanceiro ? getMeta(scope, true) : Promise.resolve({ metaMensal: 0, anoMes: new Date().toISOString().slice(0, 7), empresaRepresentacaoId: scope.tenantId }),
      ]);
      setRepresentadas(repData);
      setClientes(cliData);
      setLeads(leadData);
      setPedidos(pedData);
      setProdutos(prodData);
      setEmpresas(empData);
      setUsuarios(usrData);
      setMeta(metaData);
      alert('Dados atualizados a partir do Firestore para a empresa autorizada.');
    } catch (error: any) {
      console.error('Falha ao atualizar dados:', error);
      alert('Não foi possível atualizar os dados. Verifique a conexão e as permissões da conta.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      window.location.href = window.location.pathname;
      return;
    }
    if (!navigator.onLine) {
      setErrorMessage('Para sair com segurança, reconecte-se primeiro. Assim garantimos que alterações pendentes sejam sincronizadas e removemos a cópia offline deste aparelho.');
      return;
    }

    let timeoutId: number | undefined;
    try {
      await Promise.race([
        waitForOfflineWritesToSync(),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('A sincronização ainda está pendente.')), 10000);
        }),
      ]);
    } catch (error: any) {
      setErrorMessage(error?.message === 'A sincronização ainda está pendente.'
        ? 'Ainda há alterações aguardando confirmação do servidor. Mantenha o sistema aberto e tente sair novamente quando a sincronização terminar.'
        : 'Não foi possível confirmar a sincronização. Verifique a conexão antes de sair.');
      return;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }

    try {
      await clearOfflineFirestoreCache();
    } catch {
      alert('Não consegui apagar a cópia offline com segurança. Feche as outras abas do RepresentaPRO e tente sair novamente.');
      window.location.reload();
      return;
    }

    await signOut(auth);
    Object.keys(localStorage).filter((key) => key.startsWith('rep_')).forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071F38] flex flex-col items-center justify-center p-6 text-white font-sans">
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
      <LoginScreen initialError={sessionError} />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-800 flex flex-col font-sans">
      {isDemoMode && (
        <div className="bg-amber-100 text-amber-900 border-b border-amber-200 text-[11px] font-extrabold text-center py-1.5 px-3 tracking-wide">
          MODO DEMONSTRAÇÃO • dados fictícios • nenhuma alteração é enviada ao banco real
        </div>
      )}
      {!isDemoMode && (!isOnline || isUsingCachedData || hasPendingSync) && (
        <div role="status" aria-live="polite" className={`px-4 py-2 text-center text-[11px] font-bold ${hasPendingSync ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-900'}`}>
          {hasPendingSync
            ? 'Alterações salvas neste aparelho e aguardando conexão para sincronizar.'
            : !isOnline
              ? 'Sem internet — exibindo os dados disponíveis da última sincronização neste aparelho.'
              : 'Conexão instável — mostrando a cópia local enquanto o sistema tenta atualizar.'}
        </div>
      )}
      
      {/* Top Banner & Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 border-t-4 border-t-[#FD9619] py-3 sm:py-4 px-4 sm:px-6 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center p-1 overflow-hidden shrink-0">
              <img src="/representapro-icon.svg" alt="RepresentaPRO" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-sans font-extrabold text-xl tracking-[-0.04em] leading-none">
                  <span className="text-[#0B3259]">Representa</span><span className="text-[#FD9619]">PRO</span>
                </h1>
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
            
            {isRaul && !isDemoMode && (
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
              onClick={() => { void handleLogout(); }}
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
          {userPermissions.verDashboard && (
            <button 
              id="tab-dashboard"
              onClick={() => { setActiveTab('dashboard'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Painel Geral</span>
            </button>
          )}

          {/* Tab 2: Representadas */}
          {userPermissions.verRepresentadas && (
            <button 
              id="tab-representadas"
              onClick={() => { setActiveTab('representadas'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'representadas' 
                  ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>Representadas / Fábricas</span>
            </button>
          )}

          {/* Tab 3: Clientes */}
          {userPermissions.verClientes && (
            <button 
              id="tab-clientes"
              onClick={() => { setActiveTab('clientes'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'clientes' 
                  ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Carteira de Clientes</span>
            </button>
          )}

          {userPermissions.verLeads && (
            <button
              id="tab-leads"
              onClick={() => { setActiveTab('leads'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Prospecção</span>
            </button>
          )}

          {/* Tab: Produtos */}
          {userPermissions.verProdutos && (
            <button 
              id="tab-produtos"
              onClick={() => { setActiveTab('produtos'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'produtos' 
                  ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Produtos / Catálogo</span>
            </button>
          )}

          {/* Tab 4: Pedidos / Vendas */}
          <button 
            id="tab-pedidos"
            onClick={() => { setActiveTab('pedidos'); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pedidos' 
                ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Pedidos de Venda</span>
          </button>

          {/* Tab: Financeiro */}
          {(currentUser?.role === 'Administrador' || userPermissions.verFinanceiro) && (
            <button 
              id="tab-financeiro"
              onClick={() => { setActiveTab('financeiro'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'financeiro' 
                  ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Financeiro & Comissões</span>
            </button>
          )}

          {/* Tab 5: Administração & Multiempresas */}
          {(currentUser?.role === 'Administrador' || userPermissions.gerenciarUsuarios) && (
            <button 
              id="tab-admin"
              onClick={() => { setActiveTab('admin'); setActivePedidoToEdit(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ml-auto ${
                activeTab === 'admin' 
                  ? 'bg-[#0B3259] text-white shadow-md ring-1 ring-[#FD9619]/30' 
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
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'leads' && userPermissions.verLeads && (
                <LeadsTab
                  leads={filteredLeads}
                  clientes={filteredClientes}
                  representadas={filteredRepresentadas}
                  empresas={empresas}
                  currentUser={currentUser}
                  activeEmpresaId={activeEmpresaId}
                  isSystemAdmin={systemAdmin}
                  canEdit={userPermissions.editarLeads}
                  canConvert={userPermissions.editarLeads && userPermissions.verClientes && userPermissions.editarClientes}
                  onAdd={handleAddLead}
                  onEdit={handleEditLead}
                  onConvert={handleConvertLead}
                />
              )}

              {activeTab === 'produtos' && (
                <ProdutosTab 
                  produtos={filteredProdutos}
                  representadas={filteredRepresentadas}
                  onAdd={handleAddProduto}
                  onEdit={handleEditProduto}
                  onDelete={handleDeleteProduto}
                  currentUser={currentUser}
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

              {activeTab === 'financeiro' && (currentUser?.role === 'Administrador' || userPermissions.verFinanceiro) && (
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
                  isSystemAdmin={systemAdmin}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-5 px-6 pb-20 sm:pb-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
          <span>&copy; {new Date().getFullYear()} Desenvolvido por Raul Soares. Todos os direitos reservados.</span>
          <div className="flex items-center gap-1.5">
            <a href="https://wa.me/5532999098468" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-green-700 hover:text-green-800 transition-colors font-bold bg-green-50 px-3 py-1 rounded-lg border border-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-green-600 shrink-0"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.729-1.452L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.413 9.863-9.843.002-2.63-1.023-5.101-2.886-6.968C16.583 1.94 14.113.916 11.49.916c-5.434 0-9.858 4.414-9.861 9.845-.001 1.716.452 3.39 1.31 4.869L1.91 22.12l6.737-1.766zm10.37-4.144c-.3-.15-1.771-.875-2.046-.975-.276-.1-.477-.15-.677.15-.2.3-.777.975-.951 1.175-.174.2-.35.225-.65.075-1.041-.521-2.071-1.302-2.851-1.997-.6-.518-1.07-1.116-1.153-1.29-.1-.3-.01-.45.09-.599.09-.15.2-.3.3-.45.1-.15.15-.25.225-.4.075-.15.038-.3-.019-.45-.056-.15-.477-1.15-.653-1.575-.171-.413-.345-.356-.477-.356-.124-.002-.266-.002-.409-.002-.143 0-.377.054-.575.273-.2.22-.765.748-.765 1.822 0 1.074.78 2.114.89 2.263.11.15 1.516 2.315 3.673 3.243 1.171.504 1.882.68 2.538.74.656.06 1.252-.027 1.724-.097.525-.078 1.593-.65 1.819-1.275.225-.625.225-1.15.157-1.275-.069-.125-.262-.2-.562-.35z"/></svg>
              <span>32 99909-8468</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Bottom Tab Bar for Mobile & PWA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/85 px-2 py-2 flex justify-start gap-1 overflow-x-auto items-center shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:hidden">
        
        {/* Mobile Tab 1: Painel */}
        {userPermissions.verDashboard && (
          <button
            onClick={() => { setActiveTab('dashboard'); setActivePedidoToEdit(null); }}
            className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'text-emerald-600 scale-105' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5">Painel</span>
          </button>
        )}

        {/* Mobile Tab 2: Representadas */}
        {userPermissions.verRepresentadas && (
          <button
            onClick={() => { setActiveTab('representadas'); setActivePedidoToEdit(null); }}
            className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'representadas' ? 'text-emerald-600 scale-105' : 'text-slate-500'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5">Fábricas</span>
          </button>
        )}

        {/* Mobile Tab 3: Clientes */}
        {userPermissions.verClientes && (
          <button
            onClick={() => { setActiveTab('clientes'); setActivePedidoToEdit(null); }}
            className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'clientes' ? 'text-emerald-600 scale-105' : 'text-slate-500'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5">Clientes</span>
          </button>
        )}

        {userPermissions.verLeads && (
          <button
            onClick={() => { setActiveTab('leads'); setActivePedidoToEdit(null); }}
            aria-label="Abrir CRM de prospecção"
            className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'leads' ? 'text-emerald-600 scale-105' : 'text-slate-500'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5">Leads</span>
          </button>
        )}

        {/* Mobile Tab 4: Produtos */}
        {userPermissions.verProdutos && (
          <button
            onClick={() => { setActiveTab('produtos'); setActivePedidoToEdit(null); }}
            className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'produtos' ? 'text-emerald-600 scale-105' : 'text-slate-500'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5">Produtos</span>
          </button>
        )}

        {/* Mobile Tab 5: Pedidos */}
        <button
          onClick={() => { setActiveTab('pedidos'); }}
          className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
            activeTab === 'pedidos' ? 'text-emerald-600 scale-105' : 'text-slate-500'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="text-[8px] font-bold mt-0.5">Pedidos</span>
        </button>

        {/* Mobile Tab 5.5: Financeiro */}
        {(currentUser?.role === 'Administrador' || userPermissions.verFinanceiro) && (
          <button
            onClick={() => { setActiveTab('financeiro'); setActivePedidoToEdit(null); }}
            className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
              activeTab === 'financeiro' ? 'text-emerald-600 scale-105' : 'text-slate-500'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5">Financeiro</span>
          </button>
        )}

        {/* Mobile Tab 6: Admin */}
        {(currentUser?.role === 'Administrador' || userPermissions.gerenciarUsuarios) && (
          <button
            onClick={() => { setActiveTab('admin'); }}
            className={`flex shrink-0 flex-col items-center justify-center w-12 py-1 text-center transition-all cursor-pointer ${
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

