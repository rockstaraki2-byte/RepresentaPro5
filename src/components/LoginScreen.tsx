import React, { useState, useEffect } from 'react';
import { Usuario, EmpresaRepresentacao } from '../types';
import { Briefcase, Lock, User, AlertCircle, ChevronRight, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginScreenProps {
  usuarios: Usuario[];
  empresas: EmpresaRepresentacao[];
  onLoginSuccess: (userId: string, empresaId: string) => void;
}

export default function LoginScreen({ usuarios, empresas, onLoginSuccess }: LoginScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    if (!showSuggestions) return;
    const handleOutsideClick = () => {
      setShowSuggestions(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [showSuggestions]);

  // Filter active users based on search query
  const filteredUsers = usuarios.filter(u => 
    u.ativo && (
      u.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleSelectUser = (usr: Usuario) => {
    setSelectedUser(usr);
    setSearchQuery(usr.nome);
    setShowSuggestions(false);
    setError(null);

    const isRaul = usr.id === 'usr-raul' || usr.nome?.toLowerCase() === 'raul' || usr.email?.toLowerCase() === 'raul';
    if (isRaul) {
      setSelectedEmpresaId('all');
    } else if (usr.empresaRepresentacaoId) {
      setSelectedEmpresaId(usr.empresaRepresentacaoId);
    } else {
      setSelectedEmpresaId(empresas[0]?.id || '');
    }
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setSearchQuery('');
    setPassword('');
    setError(null);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedUser) {
      setError('Por favor, pesquise e selecione um usuário.');
      return;
    }

    if (!selectedUser.ativo) {
      setError('Esta conta de usuário está inativa. Contate o administrador.');
      return;
    }

    // Default password to '123456' if not specified in database
    const correctPassword = selectedUser.senha || '123456';

    if (correctPassword !== password) {
      setError('Senha incorreta para esta conta de usuário.');
      return;
    }

    // Login successful
    onLoginSuccess(selectedUser.id, selectedEmpresaId);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950 to-slate-950 -z-10" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/30 text-white"
        >
          <Briefcase className="w-6 h-6" />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-serif font-extrabold text-2xl text-white tracking-tight">RepresentaPRO</h2>
          <p className="text-xs text-slate-400 mt-1">Plataforma de Gestão Comercial e Multiempresas</p>
        </motion.div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-950/80 backdrop-blur-md py-8 px-6 sm:px-10 rounded-3xl border border-slate-800 shadow-2xl space-y-6"
        >
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-900 text-red-400 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Search Input wrapper to stop outside click propagation */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <label htmlFor="usuario-search" className="block text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider mb-1.5">
                Usuário / Colaborador (Digite para buscar)
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="usuario-search"
                  type="text"
                  placeholder="Ex: Raul, André, Bruno..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedUser && e.target.value !== selectedUser.nome) {
                      setSelectedUser(null);
                    }
                    setShowSuggestions(true);
                    setError(null);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="block w-full pl-10 pr-10 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-bold"
                  autoComplete="off"
                />
                {selectedUser && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                  >
                    <span className="text-sm font-bold">&times;</span>
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {showSuggestions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute z-50 mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-900"
                  >
                    {filteredUsers.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 italic text-center">
                        Nenhum usuário ativo encontrado
                      </div>
                    ) : (
                      filteredUsers.map((usr) => {
                        const userCompany = empresas.find(e => e.id === usr.empresaRepresentacaoId);
                        return (
                          <div
                            key={usr.id}
                            onClick={() => handleSelectUser(usr)}
                            className="p-3 hover:bg-slate-900 cursor-pointer flex flex-col gap-0.5 text-left transition-all"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-white">{usr.nome}</span>
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{usr.role}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-serif">
                              {userCompany ? `🏢 ${userCompany.nomeFantasia}` : '👑 Administrador Geral (Acesso Total)'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Identified Company Display */}
            {selectedUser && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3"
              >
                <div className="p-2 bg-emerald-600/10 text-emerald-400 rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-mono uppercase text-slate-500 block leading-none">
                    Representação Identificada
                  </span>
                  <strong className="text-xs text-white mt-1 block">
                    {selectedUser.empresaRepresentacaoId 
                      ? (empresas.find(e => e.id === selectedUser.empresaRepresentacaoId)?.nomeFantasia || 'Carregando...')
                      : 'Administrador Geral (Acesso a Todas)'}
                  </strong>
                </div>
              </motion.div>
            )}

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={!selectedUser}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedUser}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shadow-emerald-950/20 mt-6"
            >
              <span>Acessar o Sistema</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>

    </div>
  );
}
