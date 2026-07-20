import React, { useState } from 'react';
import { EmpresaRepresentacao, Usuario, UserRole } from '../types';
import { 
  Building2, 
  Users, 
  UserPlus, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Edit3, 
  Trash2, 
  Building,
  KeyRound,
  Lock,
  User,
  Activity,
  Globe,
  Briefcase
} from 'lucide-react';
import { formatarCNPJ, formatarTelefone } from '../utils';

interface AdminTabProps {
  empresas: EmpresaRepresentacao[];
  usuarios: Usuario[];
  activeEmpresaId: string;
  currentUserId: string;
  onAddEmpresa: (emp: EmpresaRepresentacao) => void;
  onEditEmpresa: (emp: EmpresaRepresentacao) => void;
  onDeleteEmpresa: (id: string) => void;
  onAddUsuario: (usr: Usuario) => void;
  onEditUsuario: (usr: Usuario) => void;
  onDeleteUsuario: (id: string) => void;
  onSelectEmpresa: (id: string) => void;
  onSelectUsuario: (id: string) => void;
}

export default function AdminTab({
  empresas,
  usuarios,
  activeEmpresaId,
  currentUserId,
  onAddEmpresa,
  onEditEmpresa,
  onDeleteEmpresa,
  onAddUsuario,
  onEditUsuario,
  onDeleteUsuario,
  onSelectEmpresa,
  onSelectUsuario,
}: AdminTabProps) {
  // Current states (moved to top to be available to all functions and state initializers)
  const activeUser = usuarios.find(u => u.id === currentUserId) || usuarios[0];
  const isCurrentUserAdmin = activeUser?.role === 'Administrador';
  const isRaul = activeUser?.id === 'usr-raul' || activeUser?.nome?.toLowerCase() === 'raul' || activeUser?.email === 'raul';

  // Filter visible users and companies for restricted admins
  const visibleUsuarios = usuarios.filter(usr => {
    if (isRaul) return true;
    if (activeUser?.empresaRepresentacaoId) {
      return usr.empresaRepresentacaoId === activeUser.empresaRepresentacaoId;
    }
    return true;
  });

  const visibleEmpresas = empresas.filter(emp => {
    if (isRaul) return true;
    if (activeUser?.empresaRepresentacaoId) {
      return emp.id === activeUser.empresaRepresentacaoId;
    }
    return true;
  });

  const [subTab, setSubTab] = useState<'empresas' | 'usuarios'>('usuarios');
  
  // Modals editing state
  const [editingEmpresaId, setEditingEmpresaId] = useState<string | null>(null);
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<Partial<EmpresaRepresentacao>>({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
    cidade: '',
    uf: '',
    gmailUser: '',
    gmailAppPass: '',
  });

  const [editingUsuarioId, setEditingUsuarioId] = useState<string | null>(null);
  const [showUsuarioModal, setShowUsuarioModal] = useState(false);
  const [usuarioForm, setUsuarioForm] = useState<Partial<Usuario>>({
    nome: '',
    email: '',
    role: 'Administrador',
    ativo: true,
    empresaRepresentacaoId: activeEmpresaId,
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        setValidationError('A imagem do logo deve ter no máximo 1.5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setEmpresaForm(prev => ({ ...prev, logoUrl: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleActiveLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert('A imagem do logo deve ter no máximo 1.5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const logoDataUrl = event.target?.result as string;
        const activeEmp = visibleEmpresas.find(e => e.id === activeEmpresaId) || visibleEmpresas[0];
        if (activeEmp) {
          onEditEmpresa({
            ...activeEmp,
            logoUrl: logoDataUrl
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveActiveLogo = () => {
    const activeEmp = visibleEmpresas.find(e => e.id === activeEmpresaId) || visibleEmpresas[0];
    if (activeEmp && confirm('Tem certeza que deseja remover o logo desta empresa?')) {
      onEditEmpresa({
        ...activeEmp,
        logoUrl: ''
      });
    }
  };

  // --- Handlers for Empresa ---
  const handleAddEditEmpresaClick = (emp?: EmpresaRepresentacao) => {
    if (emp) {
      setEmpresaForm(emp);
      setEditingEmpresaId(emp.id);
    } else {
      setEmpresaForm({
        nomeFantasia: '',
        razaoSocial: '',
        cnpj: '',
        telefone: '',
        email: '',
        endereco: '',
        cidade: '',
        uf: '',
        logoUrl: '',
        gmailUser: '',
        gmailAppPass: '',
      });
      setEditingEmpresaId(null);
    }
    setValidationError(null);
    setShowEmpresaModal(true);
  };

  const handleEmpresaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaForm.nomeFantasia?.trim() || !empresaForm.razaoSocial?.trim() || !empresaForm.cnpj?.trim()) {
      setValidationError('Preencha os campos obrigatórios (*).');
      return;
    }

    const cleanedCnpj = empresaForm.cnpj.replace(/\D/g, '');
    if (cleanedCnpj.length !== 14) {
      setValidationError('CNPJ deve conter exatamente 14 dígitos numéricos.');
      return;
    }

    const finalEmp: EmpresaRepresentacao = {
      id: editingEmpresaId || `emp-${Date.now()}`,
      nomeFantasia: empresaForm.nomeFantasia.trim(),
      razaoSocial: empresaForm.razaoSocial.trim(),
      cnpj: formatarCNPJ(cleanedCnpj),
      telefone: empresaForm.telefone?.trim() || '',
      email: empresaForm.email?.trim() || '',
      endereco: empresaForm.endereco?.trim() || '',
      cidade: empresaForm.cidade?.trim() || '',
      uf: empresaForm.uf?.toUpperCase().trim() || '',
      logoUrl: empresaForm.logoUrl?.trim() || '',
      corPrimaria: empresaForm.corPrimaria || '#059669',
      gmailUser: empresaForm.gmailUser?.trim() || '',
      gmailAppPass: empresaForm.gmailAppPass?.trim() || '',
      isDefault: editingEmpresaId ? (empresas.find(e => e.id === editingEmpresaId)?.isDefault || false) : (empresas.length === 0),
    };

    if (editingEmpresaId) {
      onEditEmpresa(finalEmp);
    } else {
      onAddEmpresa(finalEmp);
    }
    setShowEmpresaModal(false);
  };

  const handleDeleteEmpresaClick = (id: string, name: string) => {
    if (empresas.length <= 1) {
      alert('Você deve manter pelo menos uma empresa de representação ativa.');
      return;
    }
    if (id === activeEmpresaId) {
      alert('Não é possível excluir a empresa atualmente ativa no sistema. Mude de empresa primeiro.');
      return;
    }
    if (confirm(`Tem certeza que deseja remover a empresa "${name}"? Todos os cadastros associados a esta empresa de representação ficarão inacessíveis nesta sessão.`)) {
      onDeleteEmpresa(id);
    }
  };

  // --- Handlers for Usuario ---
  const handleAddEditUsuarioClick = (usr?: Usuario) => {
    if (usr) {
      setUsuarioForm(usr);
      setEditingUsuarioId(usr.id);
    } else {
      setUsuarioForm({
        nome: '',
        email: '',
        role: 'Administrador',
        ativo: true,
        empresaRepresentacaoId: activeEmpresaId,
      });
      setEditingUsuarioId(null);
    }
    setValidationError(null);
    setShowUsuarioModal(true);
  };

  const handleUsuarioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isEditingRaul = editingUsuarioId === 'usr-raul' || usuarioForm.nome?.toLowerCase() === 'raul' || usuarioForm.email?.toLowerCase() === 'raul';
    const requiresCompany = !isEditingRaul && (usuarioForm.role !== 'Administrador');

    if (!usuarioForm.nome?.trim() || !usuarioForm.email?.trim() || (requiresCompany && !usuarioForm.empresaRepresentacaoId)) {
      setValidationError('Preencha os campos obrigatórios (*).');
      return;
    }

    if (!isEditingRaul && usuarioForm.role !== 'Administrador' && !usuarioForm.senha?.trim()) {
      setValidationError('Para representantes e vendedores, a senha de login é obrigatória.');
      return;
    }

    let finalUsr: Usuario = {
      id: editingUsuarioId || `usr-${Date.now()}`,
      nome: usuarioForm.nome.trim(),
      email: usuarioForm.email.trim(),
      role: (usuarioForm.role as UserRole) || 'Administrador',
      ativo: usuarioForm.ativo !== undefined ? usuarioForm.ativo : true,
      empresaRepresentacaoId: usuarioForm.empresaRepresentacaoId,
      senha: usuarioForm.role !== 'Administrador' ? usuarioForm.senha?.trim() : undefined,
    };

    if (isEditingRaul) {
      finalUsr = {
        ...finalUsr,
        id: 'usr-raul',
        nome: 'Raul',
        email: 'raul',
        role: 'Administrador',
        ativo: true,
        senha: '230213'
      };
      delete finalUsr.empresaRepresentacaoId;
    }

    if (editingUsuarioId) {
      onEditUsuario(finalUsr);
    } else {
      onAddUsuario(finalUsr);
    }
    setShowUsuarioModal(false);
  };

  const handleDeleteUsuarioClick = (id: string, name: string) => {
    if (id === currentUserId) {
      alert('Não é possível remover o próprio usuário atualmente logado!');
      return;
    }
    if (confirm(`Tem certeza que deseja remover o usuário "${name}"?`)) {
      onDeleteUsuario(id);
    }
  };

  return (
    <div className="space-y-6">

      {/* Profile & Sandbox Testing Simulation Hub - Raul Only */}
      {isRaul && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded font-bold">
                Sandbox de Simulação de Acesso e Multiempresas
              </span>
              <h3 className="font-serif font-extrabold text-base leading-tight">Painel de Login & Identidades</h3>
              <p className="text-xs text-slate-300">
                Alternando os seletores abaixo, você simula o comportamento do sistema com bancos de dados isolados e restrições de permissões em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto shrink-0">
              {/* Empresa Selector */}
              {isRaul && (
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
                    Empresa Ativa (Banco de Dados Isolado):
                  </label>
                  <select
                    value={activeEmpresaId}
                    onChange={(e) => onSelectEmpresa(e.target.value)}
                    className="w-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white font-bold transition-all focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900 text-emerald-400 font-bold">
                      👑 Todas as Representações (Acesso Total)
                    </option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                        🏢 {emp.nomeFantasia}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Profile User/Role Selector */}
              <div className={`space-y-1 ${!isRaul ? 'sm:col-span-2' : ''}`}>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
                  Usuário / Nível de Acesso Ativo:
                </label>
                <select
                  value={currentUserId}
                  onChange={(e) => onSelectUsuario(e.target.value)}
                  className="w-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white font-bold transition-all focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {usuarios.map(usr => {
                    const isUsrRaul = usr.id === 'usr-raul' || usr.nome?.toLowerCase() === 'raul' || usr.email?.toLowerCase() === 'raul';
                    const empName = isUsrRaul ? '👑 Todas (Acesso Total)' : (empresas.find(e => e.id === usr.empresaRepresentacaoId)?.nomeFantasia || 'N/A');
                    return (
                      <option key={usr.id} value={usr.id} className="bg-slate-900 text-white">
                        👤 {usr.nome} ({usr.role}) - {empName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Access Rights Information Footer inside Sandbox */}
          <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Perfil Atual: <strong className="text-white">{activeUser?.nome}</strong> ({activeUser?.role})</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <Building className="w-4 h-4 text-blue-400" />
              <span>Empresa Padrão: <strong className="text-white">{empresas.find(e => e.id === activeEmpresaId)?.nomeFantasia}</strong></span>
            </div>
            {!isCurrentUserAdmin && (
              <div className="flex items-center gap-1.5 bg-amber-950/40 text-amber-300 border border-amber-800/50 px-3 py-1.5 rounded-lg">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Restrições Ativas: Somente <strong>Administradores</strong> podem cadastrar novos usuários ou razões sociais.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuração da Logo para a Razão Social Ativada no Sistema */}
      {(() => {
        const activeEmp = visibleEmpresas.find(e => e.id === activeEmpresaId) || visibleEmpresas[0];
        return (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-5 justify-between">
            <div className="flex items-center gap-4">
              {activeEmp?.logoUrl ? (
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-xs">
                  <img src={activeEmp.logoUrl} alt="Logo" className="object-contain max-w-full max-h-full" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center border border-dashed border-slate-300 shrink-0 font-bold font-serif text-lg">
                  {activeEmp?.nomeFantasia?.substring(0, 2).toUpperCase() || 'EP'}
                </div>
              )}
              <div>
                <span className="text-[9px] uppercase font-mono tracking-widest text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded">
                  Configuração de Logo (Empresa Ativa)
                </span>
                <h4 className="font-serif font-extrabold text-slate-900 text-sm mt-1 leading-tight">{activeEmp?.nomeFantasia}</h4>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">CNPJ: {activeEmp?.cnpj} | {activeEmp?.razaoSocial}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto shrink-0">
              <label className="w-full sm:w-auto bg-slate-900 hover:bg-slate-850 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center shadow-xs">
                <span>Alterar Logo</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleActiveLogoUpload} 
                  className="hidden" 
                />
              </label>
              {activeEmp?.logoUrl && (
                <button
                  onClick={handleRemoveActiveLogo}
                  className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Remover Logo</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tabs toggle */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setSubTab('usuarios')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            subTab === 'usuarios' 
              ? 'border-emerald-600 text-emerald-700' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>Controle de Usuários ({visibleUsuarios.length})</span>
          </div>
        </button>
        <button
          onClick={() => setSubTab('empresas')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            subTab === 'empresas' 
              ? 'border-emerald-600 text-emerald-700' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>Razões Sociais / Empresas Representadas ({visibleEmpresas.length})</span>
          </div>
        </button>
      </div>

      {/* --- CONTENT 1: USUARIOS --- */}
      {subTab === 'usuarios' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div>
              <h4 className="font-serif font-bold text-sm text-slate-800">Equipes e Acessos</h4>
              <p className="text-[11px] text-slate-400">Configure as contas dos representantes, gestores e vendedores com permissões específicas.</p>
            </div>
            <button
              disabled={!isCurrentUserAdmin}
              onClick={() => handleAddEditUsuarioClick()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              <span>Adicionar Usuário</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleUsuarios.map(usr => {
              const userCompany = visibleEmpresas.find(e => e.id === usr.empresaRepresentacaoId);
              return (
                <div key={usr.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-800 leading-none">{usr.nome}</h5>
                          <span className="text-[9px] text-slate-400 font-mono leading-none">{usr.email}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                        usr.role === 'Administrador' ? 'bg-red-50 text-red-700 border border-red-100' :
                        usr.role === 'Representante' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {usr.role}
                      </span>
                    </div>

                    <div className="border-t border-dashed border-slate-100 pt-2.5 space-y-1 text-[11px] text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>Vinculado a:</span>
                        <strong className="text-slate-700 font-serif">
                          {usr.id === 'usr-raul' || usr.nome?.toLowerCase() === 'raul' || usr.email?.toLowerCase() === 'raul'
                            ? '👑 Todas (Acesso Total)'
                            : (userCompany?.nomeFantasia || 'Nenhuma')}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Status:</span>
                        <div className="flex items-center gap-1">
                          {usr.ativo ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-700 font-bold">Ativo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-red-700 font-bold">Inativo</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end gap-1.5">
                    <button
                      disabled={!isCurrentUserAdmin}
                      onClick={() => handleAddEditUsuarioClick(usr)}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Editar dados"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={!isCurrentUserAdmin || usr.id === currentUserId}
                      onClick={() => handleDeleteUsuarioClick(usr.id, usr.nome)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- CONTENT 2: EMPRESAS --- */}
      {subTab === 'empresas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div>
              <h4 className="font-serif font-bold text-sm text-slate-800">Razões Sociais e CNPJs</h4>
              <p className="text-[11px] text-slate-400">Cadastre as razões sociais da representação. Os relatórios adaptam-se automaticamente de acordo com a empresa selecionada. <span className="font-bold text-amber-600">(Apenas o administrador geral Raul pode adicionar ou remover razões sociais).</span></p>
            </div>
            <button
              disabled={!isRaul}
              onClick={() => handleAddEditEmpresaClick()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shrink-0"
              title={isRaul ? "Cadastrar nova empresa" : "Apenas o administrador geral (Raul) pode cadastrar empresas"}
            >
              <Plus className="w-4 h-4" />
              <span>Nova Razão Social</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleEmpresas.map(emp => (
              <div key={emp.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {emp.logoUrl ? (
                        <div className="w-12 h-12 bg-white border border-slate-150 rounded-lg flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                          <img src={emp.logoUrl} alt="Logo" className="object-contain max-w-full max-h-full" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center border border-dashed border-slate-200 shrink-0">
                          <Building2 className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-serif font-bold text-base text-slate-800 leading-tight">{emp.nomeFantasia}</h5>
                          {emp.id === activeEmpresaId && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-100">Ativa</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.cnpj}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-100 pt-2.5 space-y-1.5 text-xs text-slate-600">
                    <div>
                      <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Razão Social</span>
                      <strong className="text-slate-800">{emp.razaoSocial}</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block">Cidade / UF</span>
                        <span className="text-slate-700 font-medium">{emp.cidade || 'N/A'}{emp.uf ? `, ${emp.uf}` : ''}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-400 block font-bold">Contato</span>
                        <span className="text-slate-700 font-mono font-medium">{emp.telefone ? formatarTelefone(emp.telefone) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-1.5">
                  <button
                    onClick={() => onSelectEmpresa(emp.id)}
                    className="mr-auto text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Ativar no Sistema
                  </button>
                  <button
                    disabled={!isRaul}
                    onClick={() => handleAddEditEmpresaClick(emp)}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={isRaul ? "Editar" : "Apenas Raul pode alterar as razões sociais"}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={!isRaul || emp.id === activeEmpresaId}
                    onClick={() => handleDeleteEmpresaClick(emp.id, emp.nomeFantasia)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={isRaul ? "Excluir" : "Apenas Raul pode remover as razões sociais"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODAL 1: EMPRESA CRUD --- */}
      {showEmpresaModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-serif font-bold text-sm text-slate-800">
                {editingEmpresaId ? 'Editar Razão Social' : 'Cadastrar Razão Social'}
              </h3>
              <button 
                onClick={() => setShowEmpresaModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="font-bold text-lg">&times;</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {validationError && (
                <div className="p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-700 border-red-100">
                  {validationError}
                </div>
              )}

              <form onSubmit={handleEmpresaSubmit} id="empresa-form-elem" className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">CNPJ da Representação *</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={empresaForm.cnpj || ''}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Nome Fantasia *</label>
                  <input
                    type="text"
                    placeholder="Ex: Planalto Vendas"
                    value={empresaForm.nomeFantasia || ''}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, nomeFantasia: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Razão Social Completa *</label>
                  <input
                    type="text"
                    placeholder="Ex: Planalto Representações Ltda"
                    value={empresaForm.razaoSocial || ''}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, razaoSocial: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-slate-500">Telefone</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={empresaForm.telefone || ''}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-slate-500">Email Comercial</label>
                    <input
                      type="email"
                      placeholder="vendas@empresa.com.br"
                      value={empresaForm.email || ''}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Logotipo da Empresa (PNG / JPG)</label>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-lg">
                    {empresaForm.logoUrl ? (
                      <div className="relative w-12 h-12 bg-white rounded border border-slate-150 flex items-center justify-center overflow-hidden shrink-0">
                        <img src={empresaForm.logoUrl} alt="Logo" className="object-contain max-w-full max-h-full" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setEmpresaForm(prev => ({ ...prev, logoUrl: undefined }))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold shadow hover:bg-red-600 cursor-pointer"
                          title="Remover logo"
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 rounded border border-dashed border-slate-250 flex items-center justify-center text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider leading-none select-none shrink-0">
                        Sem Logo
                      </div>
                    )}
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500">Endereço Fiscal</label>
                  <input
                    type="text"
                    placeholder="Av. Principal, 123"
                    value={empresaForm.endereco || ''}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, endereco: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-slate-500">Cidade</label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo"
                      value={empresaForm.cidade || ''}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, cidade: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-slate-500">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="SP"
                      value={empresaForm.uf || ''}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, uf: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500">Logo (URL Pública)</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/logo.png"
                    value={empresaForm.logoUrl || ''}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, logoUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">Insira um link válido para exibir a logo no topo da aplicação e impressos.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Cor Primária (Hexadecimal)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={empresaForm.corPrimaria || '#059669'}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, corPrimaria: e.target.value })}
                      className="h-8 w-8 cursor-pointer rounded overflow-hidden bg-transparent"
                    />
                    <input
                      type="text"
                      placeholder="#059669"
                      value={empresaForm.corPrimaria || '#059669'}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, corPrimaria: e.target.value })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none font-mono uppercase text-slate-800"
                    />
                  </div>
                </div>

                {/* Seção de E-mail por Empresa (Multi-tenant SMTP) */}
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-3.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800">
                      Configuração de E-mail da Empresa (Gmail)
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Configure os dados do Gmail desta empresa para que os pedidos enviados via e-mail saiam diretamente da conta dela. Se deixado em branco, o sistema usará as credenciais globais ou fallback local.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono uppercase text-slate-500">E-mail do Gmail</label>
                      <input
                        type="email"
                        placeholder="exemplo@gmail.com"
                        value={empresaForm.gmailUser || ''}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, gmailUser: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono uppercase text-slate-500">Senha de App do Google</label>
                      <input
                        type="password"
                        placeholder="xxxx xxxx xxxx xxxx"
                        value={empresaForm.gmailAppPass || ''}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, gmailAppPass: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowEmpresaModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEmpresaSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                {editingEmpresaId ? 'Salvar Alterações' : 'Cadastrar Empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: USUARIO CRUD --- */}
      {showUsuarioModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-serif font-bold text-sm text-slate-800">
                {editingUsuarioId ? 'Editar Usuário' : 'Adicionar Usuário'}
              </h3>
              <button 
                onClick={() => setShowUsuarioModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="font-bold text-lg">&times;</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {validationError && (
                <div className="p-3 rounded-lg text-xs font-medium border bg-red-50 text-red-700 border-red-100">
                  {validationError}
                </div>
              )}

              <form onSubmit={handleUsuarioSubmit} id="usuario-form-elem" className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Nome do Usuário *</label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva"
                    value={usuarioForm.nome || ''}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, nome: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Email do Usuário *</label>
                  <input
                    type="email"
                    placeholder="ex: joao@representante.com"
                    value={usuarioForm.email || ''}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Empresa de Representação *</label>
                  <select
                    value={usuarioForm.empresaRepresentacaoId || ''}
                    onChange={(e) => setUsuarioForm({ ...usuarioForm, empresaRepresentacaoId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="">Selecione uma empresa...</option>
                    {visibleEmpresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nomeFantasia} ({emp.razaoSocial})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Nível de Acesso *</label>
                    <select
                      value={usuarioForm.role || 'Administrador'}
                      onChange={(e) => setUsuarioForm({ ...usuarioForm, role: e.target.value as UserRole })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="Administrador">Administrador</option>
                      <option value="Representante">Representante</option>
                      <option value="Vendedor">Vendedor</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Status do Usuário</label>
                    <select
                      value={usuarioForm.ativo ? 'true' : 'false'}
                      onChange={(e) => setUsuarioForm({ ...usuarioForm, ativo: e.target.value === 'true' })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>

                {/* Password field / Google Sign in note */}
                {usuarioForm.role === 'Administrador' ? (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-700 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Acesso Google Ativo</span>
                    </div>
                    <p className="text-slate-500 leading-normal">
                      Administradores efetuam login exclusivo via conta Google integrada (Google Workspace). Não usam senha local.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Senha de Acesso *</label>
                    <input
                      type="text" // Use text or password, text is handier in management but password is safe. Let's use standard text with password feel or password with preview.
                      placeholder="Defina a senha de login (Mínimo 6 dígitos)"
                      value={usuarioForm.senha || ''}
                      onChange={(e) => setUsuarioForm({ ...usuarioForm, senha: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-800 font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400">Usuários não-administradores farão login usando e-mail e esta senha.</p>
                  </div>
                )}
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowUsuarioModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUsuarioSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                {editingUsuarioId ? 'Salvar Alterações' : 'Adicionar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
