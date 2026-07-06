import React, { useState } from 'react';
import { Usuario, EmpresaRepresentacao } from '../types';
import { Briefcase, Lock, User, AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  usuarios: Usuario[];
  empresas: EmpresaRepresentacao[];
  onLoginSuccess: (userId: string, empresaId: string) => void;
}

export default function LoginScreen({ usuarios, empresas, onLoginSuccess }: LoginScreenProps) {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const inputCleaned = loginInput.trim().toLowerCase();
    if (!inputCleaned) {
      setError('Por favor, informe seu usuário ou e-mail.');
      return;
    }
    if (!password) {
      setError('Por favor, informe sua senha de acesso.');
      return;
    }

    // Try to find the active user
    const foundUser = usuarios.find(u => 
      u.nome.toLowerCase() === inputCleaned || 
      u.email.toLowerCase() === inputCleaned
    );

    if (!foundUser) {
      setError('Usuário ou senha incorretos.');
      return;
    }

    if (!foundUser.ativo) {
      setError('Esta conta de usuário está inativa. Contate o administrador.');
      return;
    }

    // Default password to '123456' if not specified in database
    const correctPassword = foundUser.senha || '123456';

    if (correctPassword !== password) {
      setError('Usuário ou senha incorretos.');
      return;
    }

    // Determine active company ID
    const isRaul = foundUser.id === 'usr-raul' || foundUser.nome?.toLowerCase() === 'raul' || foundUser.email?.toLowerCase() === 'raul';
    let selectedEmpresaId = '';
    if (isRaul) {
      selectedEmpresaId = 'all';
    } else if (foundUser.empresaRepresentacaoId) {
      selectedEmpresaId = foundUser.empresaRepresentacaoId;
    } else {
      selectedEmpresaId = empresas[0]?.id || '';
    }

    // Login successful
    onLoginSuccess(foundUser.id, selectedEmpresaId);
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
            <div className="p-3 bg-red-950/50 border border-red-900 text-red-400 rounded-xl text-xs flex items-start gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider mb-1.5">
                Usuário ou E-mail
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  placeholder="Digite seu usuário ou e-mail"
                  value={loginInput}
                  onChange={(e) => {
                    setLoginInput(e.target.value);
                    setError(null);
                  }}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-bold"
                  autoComplete="off"
                />
              </div>
            </div>

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
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shadow-emerald-950/20 mt-6"
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
