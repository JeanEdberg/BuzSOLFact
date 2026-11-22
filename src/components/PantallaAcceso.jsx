import { useState } from 'react';
import { LogIn, Loader2, Building2, ShieldCheck, Mail, Lock } from 'lucide-react';
import { IconoFacBuzMoa } from './MarcaFacBuzMoa';

// Pantalla de entrada: se muestra mientras no hay sesión contra el backend.
// A diferencia del panel de Conexión API (uso interno), aquí el usuario sólo
// puede entrar; el alta de empresa se hace desde administración.
export default function PantallaAcceso({ onEntrar, cargando, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function enviar(e) {
    e.preventDefault();
    if (!email || !password) return;
    onEntrar({ email, password });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#062431] via-[#0b3a4f] to-[#062431] px-4 py-10 font-sans">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <IconoFacBuzMoa tamano={72} tono="oscuro" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">FacBuzMoa</h1>
          <p className="mt-2 text-sm text-cyan-200/80 max-w-xs">
            Tu facturador y buzón tributario en un solo lugar
          </p>
        </div>

        <form
          onSubmit={enviar}
          className="bg-slate-900/70 backdrop-blur border border-cyan-400/20 rounded-2xl p-6 space-y-4 shadow-2xl shadow-black/40"
        >
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">Correo</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full bg-slate-950/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/60"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-300 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando || !email || !password}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-emerald-950 font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <ShieldCheck size={13} className="text-emerald-500" />
            Conexión cifrada con el servidor tributario
          </p>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Building2 size={13} />
          ¿Tu empresa aún no tiene acceso? Pídelo al administrador.
        </p>
      </div>
    </div>
  );
}
