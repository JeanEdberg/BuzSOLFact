import { useEffect, useState } from 'react';
import {
  Bell, RefreshCw, Loader2, AlertCircle, CheckCircle2, MailOpen,
  Plus, Building2, Paperclip, ExternalLink, X,
} from 'lucide-react';
import { api } from './lib/api.js';
import { notificaciones as demoNotificaciones } from './lib/sampleData.js';

const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';

const colorEntidad = (entidad) =>
  entidad === 'SUNAT'
    ? 'bg-amber-500/20 text-amber-400'
    : 'bg-purple-500/20 text-purple-400';

const fechaCorta = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleDateString('es-PE');
};

// Buzón electrónico SUNAT / SUNAFIL. Con la API conectada muestra las
// notificaciones reales por empresa; sin conexión, datos de demostración.
export default function BuzonPanel({ conectado }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [items, setItems] = useState([]);
  const [resumen, setResumen] = useState({ pendientes: 0, total: 0 });
  const [entidad, setEntidad] = useState('');
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nueva, setNueva] = useState({ entidad: 'SUNAT', asunto: '', tipo: '', fecha: '', codigo: '', detalle: '', url: '' });
  const [guardando, setGuardando] = useState(false);

  async function cargarEmpresas() {
    try {
      const lista = await api.listCompanies();
      setEmpresas(lista);
      if (lista.length && empresaId == null) setEmpresaId(lista[0].id);
      return lista;
    } catch (e) {
      setError(e.message);
      return [];
    }
  }

  async function cargarNotificaciones(id, filtro = entidad) {
    if (!id) return;
    setCargando(true);
    setError(null);
    try {
      const { items: lista, resumen: r } = await api.listNotificaciones({
        companyId: id,
        entidad: filtro || undefined,
      });
      setItems(lista);
      setResumen(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!conectado) return;
    (async () => {
      const lista = await cargarEmpresas();
      if (lista.length) cargarNotificaciones(lista[0].id, '');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado]);

  async function cambiarEmpresa(id) {
    setEmpresaId(id);
    await cargarNotificaciones(id);
  }

  async function sincronizar() {
    if (!empresaId) return;
    setSincronizando(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await api.sincronizarBuzon(empresaId);
      await cargarNotificaciones(empresaId);
      const importadas = r?.importadas ?? 0;
      setMensaje(
        importadas > 0
          ? `Sincronizado: ${importadas} notificación(es) nueva(s).`
          : 'Buzón sincronizado. No hay notificaciones nuevas (o la entidad no tiene endpoint configurado).',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSincronizando(false);
    }
  }

  async function marcarLeida(n) {
    try {
      await api.marcarNotificacionLeida(n.id);
      await cargarNotificaciones(empresaId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function registrar(event) {
    event.preventDefault();
    if (!empresaId) return;
    setGuardando(true);
    setError(null);
    try {
      await api.crearNotificacion({ company_id: empresaId, ...nueva });
      setNueva({ entidad: 'SUNAT', asunto: '', tipo: '', fecha: '', codigo: '', detalle: '', url: '' });
      setMostrarForm(false);
      await cargarNotificaciones(empresaId);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // Sin conexión: se muestra el demo para no dejar la pantalla vacía.
  if (!conectado) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Datos de demostración. Conecta la API en la pestaña <strong>Conexión API</strong> para ver el buzón real por empresa.
        </div>
        <div className="grid gap-3">
          {demoNotificaciones.map((n) => (
            <div key={n.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${colorEntidad(n.entidad)}`}>{n.entidad}</span>
                <h4 className="font-medium mt-1">{n.titulo}</h4>
                <p className="text-xs text-slate-400">Fecha: {n.fecha} · {n.tipo}</p>
              </div>
              <span className="text-xs text-slate-500">Demo</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2"><Bell size={18} /> Buzón SUNAT / SUNAFIL</h3>
          <p className="text-xs text-slate-400 mt-1">
            {resumen.pendientes} pendiente(s) · {resumen.total} en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={`${input} w-auto`}
            value={entidad}
            onChange={(e) => { setEntidad(e.target.value); cargarNotificaciones(empresaId, e.target.value); }}
          >
            <option value="">Todas las entidades</option>
            <option value="SUNAT">SUNAT</option>
            <option value="SUNAFIL">SUNAFIL</option>
          </select>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
          >
            <Plus size={15} /> Registrar
          </button>
          <button
            onClick={sincronizar}
            disabled={sincronizando || !empresaId}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            {sincronizando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sincronizar
          </button>
        </div>
      </div>

      {empresas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {empresas.map((e) => (
            <button
              key={e.id}
              onClick={() => cambiarEmpresa(e.id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${empresaId === e.id ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
            >
              <Building2 size={12} /> {e.razon_social} <span className="text-slate-500">({e.ruc})</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {mensaje && (
        <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {mensaje}
        </div>
      )}

      {mostrarForm && (
        <form onSubmit={registrar} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Registrar notificación</h4>
            <button type="button" onClick={() => setMostrarForm(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select className={input} value={nueva.entidad} onChange={(e) => setNueva({ ...nueva, entidad: e.target.value })}>
              <option value="SUNAT">SUNAT</option>
              <option value="SUNAFIL">SUNAFIL</option>
            </select>
            <input className={input} placeholder="Código (opcional)" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value })} />
            <input className={input} type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} />
          </div>
          <input required className={input} placeholder="Asunto" value={nueva.asunto} onChange={(e) => setNueva({ ...nueva, asunto: e.target.value })} />
          <div className="grid sm:grid-cols-2 gap-3">
            <input className={input} placeholder="Tipo (opcional)" value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })} />
            <input className={input} placeholder="Enlace (opcional)" value={nueva.url} onChange={(e) => setNueva({ ...nueva, url: e.target.value })} />
          </div>
          <textarea className={input} rows={2} placeholder="Detalle (opcional)" value={nueva.detalle} onChange={(e) => setNueva({ ...nueva, detalle: e.target.value })} />
          <div className="flex justify-end">
            <button type="submit" disabled={guardando} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Guardar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Cargando notificaciones…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">No hay notificaciones para esta empresa. Sincroniza o registra una manualmente.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((n) => (
            <div key={n.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-start gap-4">
              <div className="min-w-0">
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${colorEntidad(n.entidad)}`}>{n.entidad}</span>
                {n.estado === 'pendiente' && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded font-semibold bg-blue-500/20 text-blue-300">Pendiente</span>
                )}
                <h4 className="font-medium mt-1">{n.asunto}</h4>
                <p className="text-xs text-slate-400">
                  {fechaCorta(n.fecha)}{n.tipo ? ` · ${n.tipo}` : ''}{n.codigo ? ` · ${n.codigo}` : ''}
                </p>
                {n.detalle && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{n.detalle}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {n.tiene_adjunto && <Paperclip size={15} className="text-slate-400" title="Con adjunto" />}
                {n.url && (
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white"><ExternalLink size={15} /></a>
                )}
                {n.estado === 'pendiente' && (
                  <button onClick={() => marcarLeida(n)} className="flex items-center gap-1 text-blue-400 hover:underline text-sm" title="Marcar como leída">
                    <MailOpen size={15} /> Leída
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
