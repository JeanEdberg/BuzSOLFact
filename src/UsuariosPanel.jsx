import { useEffect, useState } from 'react';
import { UserPlus, Loader2, Users, CheckCircle2, AlertCircle, Mail, Shield, Power, PowerOff } from 'lucide-react';
import { api } from './lib/api.js';

const VACIO = { name: '', email: '', password: '', role_name: 'company_user', user_type: 'user' };

// Alta y listado de usuarios de la empresa. Sin esto no había forma de dar
// acceso a operadores sin entrar por consola.
export default function UsuariosPanel({ conectado, companyId, usuarioId = null, esSuperAdmin = false }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [filaEnCurso, setFilaEnCurso] = useState(null);

  async function cargar() {
    if (!conectado) return;
    setCargando(true);
    try {
      const [u, r] = await Promise.all([api.listUsers(), api.listRoles()]);
      setUsuarios(u);
      setRoles(r);
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [conectado]);

  const setCampo = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      await api.createUser({
        ...form,
        company_id: companyId ?? null,
      });
      setMensaje({ tipo: 'ok', texto: `Usuario ${form.email} creado.` });
      setForm(VACIO);
      await cargar();
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setGuardando(false);
    }
  }

  // Desactivar corta la sesión abierta del usuario en su siguiente petición.
  async function alternarActivo(usuario) {
    const activar = !usuario.active;
    if (!activar && !window.confirm(`¿Desactivar a ${usuario.name}? Su sesión se cerrará de inmediato.`)) {
      return;
    }

    setFilaEnCurso(usuario.id);
    setMensaje(null);
    try {
      await api.setUserActive(usuario.id, activar);
      setMensaje({
        tipo: 'ok',
        texto: activar ? `${usuario.name} puede volver a entrar.` : `${usuario.name} desactivado y su sesión cerrada.`,
      });
      await cargar();
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setFilaEnCurso(null);
    }
  }

  async function cambiarRol(usuario, roleName) {
    if (!roleName || roleName === usuario.role) return;

    setFilaEnCurso(usuario.id);
    setMensaje(null);
    try {
      await api.setUserRole(usuario.id, roleName);
      setMensaje({ tipo: 'ok', texto: `Rol de ${usuario.name} actualizado.` });
      await cargar();
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setFilaEnCurso(null);
    }
  }

  const esPropia = (u) => usuarioId != null && u.id === usuarioId;

  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/60';

  if (!conectado) {
    return (
      <p className="text-sm text-slate-400">
        Conecta con la API para gestionar usuarios de la empresa.
      </p>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-cyan-400" />
        <h3 className="text-lg font-semibold">Usuarios de la empresa</h3>
      </div>

      <form onSubmit={crear} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
        <p className="text-sm text-slate-400">
          Da acceso a tus operadores. Cada usuario entra con su propio correo y contraseña.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="usuario-nombre" className="block text-xs text-slate-400 mb-1">Nombre</label>
            <input id="usuario-nombre" value={form.name} onChange={setCampo('name')} className={inputCls} required />
          </div>
          <div>
            <label htmlFor="usuario-correo" className="block text-xs text-slate-400 mb-1">Correo</label>
            <input id="usuario-correo" type="email" value={form.email} onChange={setCampo('email')} className={inputCls} required />
          </div>
          <div>
            <label htmlFor="usuario-password" className="block text-xs text-slate-400 mb-1">Contraseña (mínimo 8)</label>
            <input id="usuario-password" type="password" value={form.password} onChange={setCampo('password')} className={inputCls} minLength={8} required />
          </div>
          <div>
            <label htmlFor="usuario-rol" className="block text-xs text-slate-400 mb-1">Rol</label>
            <select id="usuario-rol" value={form.role_name} onChange={setCampo('role_name')} className={inputCls}>
              {roles.length === 0 && <option value="company_user">Usuario de empresa</option>}
              {roles.map((r) => (
                <option key={r.name} value={r.name}>{r.label ?? r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {mensaje && (
          <p className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${mensaje.tipo === 'ok'
            ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30'
            : 'text-red-300 bg-red-950/40 border-red-500/30'}`}>
            {mensaje.tipo === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {mensaje.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="flex items-center gap-2 bg-emerald-500 text-emerald-950 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-emerald-400 disabled:opacity-40"
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {guardando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Usuarios existentes</h4>
          {cargando && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </div>
        {usuarios.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">
            {cargando ? 'Cargando…' : 'Todavía no hay usuarios.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-xs text-slate-400">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Nombre</th>
                <th className="text-left px-5 py-2 font-medium">Correo</th>
                <th className="text-left px-5 py-2 font-medium">Rol</th>
                <th className="text-left px-5 py-2 font-medium">Estado</th>
                <th className="text-right px-5 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-slate-700/60">
                  <td className="px-5 py-2.5">{u.name}</td>
                  <td className="px-5 py-2.5 text-slate-300 flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-500" />{u.email}
                  </td>
                  <td className="px-5 py-2.5 text-slate-300">
                    {esPropia(u) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Shield size={13} className="text-cyan-400" />
                        {u.role_label ?? u.role}
                      </span>
                    ) : (
                      <select
                        aria-label={`Rol de ${u.name}`}
                        value={u.role ?? ''}
                        disabled={filaEnCurso === u.id}
                        onChange={(e) => cambiarRol(u, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 disabled:opacity-40"
                      >
                        {u.role && !roles.some((r) => r.name === u.role) && (
                          <option value={u.role}>{u.role_label ?? u.role}</option>
                        )}
                        {roles.map((r) => (
                          <option key={r.name} value={r.name}>{r.label ?? r.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.active
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-700 text-slate-400'}`}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {esPropia(u) ? (
                      <span className="text-xs text-slate-500">Tu cuenta</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => alternarActivo(u)}
                        disabled={filaEnCurso === u.id}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition disabled:opacity-40 ${u.active
                          ? 'border-red-500/30 text-red-300 hover:bg-red-950/40'
                          : 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40'}`}
                      >
                        {filaEnCurso === u.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : u.active ? <PowerOff size={13} /> : <Power size={13} />}
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
