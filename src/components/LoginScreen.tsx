import React, { useState } from 'react';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { Lock, User, AlertCircle, ChevronRight, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, SYSTEM_ADMIN_EMAIL } from '../firebase';

interface LoginScreenProps {
  initialError?: string | null;
}

export default function LoginScreen({ initialError }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError || null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!normalizedEmail || !password) {
      setError('Informe seu e-mail e senha.');
      return;
    }

    setBusy(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setNotice('Enviamos uma confirmação para seu e-mail. Confirme o endereço e depois entre novamente.');
      }
    } catch (err: any) {
      setError(err?.code === 'auth/too-many-requests'
        ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
        : 'Não foi possível entrar. Confira o e-mail e a senha ou use “Criar acesso” se ainda não configurou sua conta.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAccess = async () => {
    setError(null);
    setNotice(null);
    if (!normalizedEmail || password.length < 8) {
      setError('Informe o e-mail cadastrado pela empresa e uma senha com pelo menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await sendEmailVerification(credential.user);
      await signOut(auth);
      setNotice('Se esse e-mail tiver um convite ativo, enviaremos a confirmação de acesso. Confirme o endereço e entre novamente.');
    } catch (err: any) {
      setError(err?.code === 'auth/email-already-in-use'
        ? 'Esta conta já existe. Use “Esqueci minha senha” para definir uma nova senha.'
        : err?.code === 'auth/weak-password'
          ? 'Escolha uma senha com pelo menos 8 caracteres.'
          : 'Não foi possível criar o acesso. Confira o e-mail ou fale com o administrador da empresa.');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setNotice(null);
    if (!normalizedEmail) {
      setError('Informe seu e-mail para solicitar a redefinição da senha.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice('Se houver uma conta para esse e-mail, você receberá as instruções para redefinir a senha.');
    } catch {
      // Keep the response generic so the form does not disclose registered emails.
      setNotice('Se houver uma conta para esse e-mail, você receberá as instruções para redefinir a senha.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (result.user.email?.toLowerCase() !== SYSTEM_ADMIN_EMAIL || !result.user.emailVerified) {
        await signOut(auth);
        setError('Esta conta Google não tem acesso de administrador do sistema.');
      }
    } catch {
      setError('Não foi possível autenticar com o Google. Verifique a configuração do provedor no Firebase.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071F38] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#174F7F]/40 via-[#071F38] to-[#051526] -z-10" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#FD9619]/10 rounded-full blur-3xl -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto h-16 w-16 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-black/25 p-1.5 ring-1 ring-white/10">
          <img src="/representapro-icon.svg" alt="RepresentaPRO" className="w-full h-full object-contain" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="font-sans font-extrabold text-3xl tracking-[-0.04em]"><span className="text-white">Representa</span><span className="text-[#FD9619]">PRO</span></h2>
          <p className="text-xs text-slate-400 mt-1">Acesso protegido por conta verificada</p>
        </motion.div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#061A2E]/90 backdrop-blur-md py-8 px-6 sm:px-10 rounded-3xl border border-white/10 shadow-2xl space-y-5">
          {error && <div role="alert" className="p-3 bg-red-950/50 border border-red-900 text-red-300 rounded-xl text-xs flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
          {notice && <div role="status" className="p-3 bg-emerald-950/50 border border-emerald-900 text-emerald-200 rounded-xl text-xs flex items-start gap-2"><Mail className="w-4 h-4 shrink-0 mt-0.5" /><span>{notice}</span></div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider mb-1.5">E-mail cadastrado</label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500"><User className="h-4 w-4" /></div>
                <input id="login-email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-bold" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider mb-1.5">Senha</label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500"><Lock className="h-4 w-4" /></div>
                <input id="password" type="password" autoComplete="current-password" placeholder="Mínimo de 8 caracteres" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
            </div>

            <button disabled={busy} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-6">
              <span>{busy ? 'Aguarde…' : 'Acessar o Sistema'}</span><ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex flex-col sm:flex-row justify-between gap-2 text-[11px]">
            <button disabled={busy} type="button" onClick={handleCreateAccess} className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2 disabled:opacity-60">Criar acesso do convite</button>
            <button disabled={busy} type="button" onClick={handlePasswordReset} className="text-slate-400 hover:text-white underline underline-offset-2 disabled:opacity-60">Esqueci minha senha</button>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-[10px] leading-relaxed text-slate-400">A conta só libera acesso se o e-mail verificado tiver sido cadastrado por um administrador. Para abrir o sistema sem internet, entre neste dispositivo enquanto estiver online. A sessão e os dados ficarão salvos aqui; use apenas um aparelho confiável e clique em “Sair” ao terminar.</p>
            <button disabled={busy} type="button" onClick={handleGoogleAdminLogin} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              <ShieldCheck className="w-4 h-4 text-emerald-300" /><span>Entrar como administrador do sistema</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
