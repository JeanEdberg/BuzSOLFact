import { useEffect, useState } from 'react';
import {
  Building2, KeyRound, ShieldCheck, Leaf, Save, Loader2,
  AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { api } from './lib/api.js';

const TIPOS_AMAZONIA = [
  { value: '2001', label: '2001 · Bienes transferidos en la Amazonía' },
  { value: '2002', label: '2002 · Servicios prestados en la Amazonía' },
  { value: '2003', label: '2003 · Contratos de construcción en la Amazonía' },
];

function Campo({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';

// Accesos SOL: gestiona las credenciales SUNAT (SOL secundaria) y el certificado
// digital de cada empresa. El sistema es multiempresa: cada empresa tiene sus
// propias credenciales y su propio certificado.
export default function AccesosSol({ conectado }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [form, setForm] = useState(null);
  const [certificado, setCertificado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  async function cargarEmpresas() {
    setCargando(true);
    setError(null);
    try {
      const lista = await api.listCompanies();
      setEmpresas(lista);
      if (lista.length && empresaId == null) seleccionar(lista[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (conectado) cargarEmpresas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado]);

  async function seleccionar(id) {
    setEmpresaId(id);
    setMensaje(null);
    setError(null);
    setCertificado(null);
    setCargando(true);
    try {
      const c = await api.getCompany(id);
      setForm({
        ruc: c.ruc ?? '',
        razon_social: c.razon_social ?? '',
        usuario_sol: c.usuario_sol ?? '',
        // El backend oculta la clave actual: se deja vacía y solo se envía si cambia.
        clave_sol: '',
        certificado_password: '',
        modo_produccion: Boolean(c.modo_produccion),
        contribuyente_amazonia: Boolean(c.contribuyente_amazonia),
        tipo_amazonia: c.tipo_amazonia ?? '2001',
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  async function guardar(event) {
    event.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      const base = {
        usuario_sol: form.usuario_sol,
        modo_produccion: form.modo_produccion ? '1' : '0',
        contribuyente_amazonia: form.contribuyente_amazonia ? '1' : '0',
        tipo_amazonia: form.contribuyente_amazonia ? form.tipo_amazonia : '',
      };
      if (form.clave_sol) base.clave_sol = form.clave_sol;
      if (form.certificado_password) base.certificado_password = form.certificado_password;

      let payload;
      if (certificado) {
        // Con archivo hay que usar multipart (y POST + _method=PUT en Laravel).
        payload = new FormData();
        Object.entries(base).forEach(([k, v]) => payload.append(k, v));
        payload.append('certificado_pem', certificado);
      } else {
        payload = base;
      }

      await api.updateCompany(empresaId, payload);
      setMensaje('Credenciales SOL actualizadas correctamente.');
      setCertificado(null);
      await cargarEmpresas();
      await seleccionar(empresaId);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!conectado) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
        <KeyRound className="mx-auto mb-3 text-slate-500" />
        <p className="text-slate-300">Conecta la API en la pestaña <strong>Conexión API</strong> para gestionar los accesos SOL.</p>
        <p className="text-xs text-slate-500 mt-2">Las credenciales se guardan por empresa (sistema multiempresa).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck size={18} /> Accesos SOL (SUNAT)</h2>
          <p className="text-xs text-slate-400 mt-1">
            Credenciales SOL secundaria y certificado digital <strong>por empresa</strong>. El certificado es propio de cada RUC.
          </p>
        </div>
        <button
          onClick={cargarEmpresas}
          disabled={cargando}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm disabled:opacity-40"
        >
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /> Recargar
        </button>
      </div>

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

      {!empresas.length && !cargando && (
        <p className="text-sm text-slate-400">No hay empresas registradas. Crea una empresa para configurar sus accesos SOL.</p>
      )}

      {empresas.length > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          {empresas.map((e) => (
            <button
              key={e.id}
              onClick={() => seleccionar(e.id)}
              className={`text-left rounded-lg border p-3 transition ${empresaId === e.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'}`}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Building2 size={15} /> {e.razon_social}
              </div>
              <div className="text-xs text-slate-400 mt-1">RUC {e.ruc}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${e.modo_produccion ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {e.modo_produccion ? 'Producción' : 'Beta'}
                </span>
                {e.contribuyente_amazonia && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 flex items-center gap-1">
                    <Leaf size={10} /> Amazonía
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {form && (
        <form onSubmit={guardar} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Usuario SOL (secundario)">
              <input className={input} value={form.usuario_sol} onChange={(e) => set('usuario_sol', e.target.value)} placeholder="Ej. MODDATOS" />
            </Campo>
            <Campo label="Clave SOL" hint="Déjala vacía para conservar la actual.">
              <input className={input} type="password" autoComplete="new-password" value={form.clave_sol} onChange={(e) => set('clave_sol', e.target.value)} placeholder="••••••••" />
            </Campo>
            <Campo label="Certificado digital (.pem / .crt)" hint="Propio de esta empresa. Si no subes uno, se conserva el actual.">
              <input
                type="file"
                accept=".pem,.crt,.cer,.txt"
                onChange={(e) => setCertificado(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
              />
            </Campo>
            <Campo label="Clave del certificado" hint="Déjala vacía para conservar la actual.">
              <input className={input} type="password" autoComplete="new-password" value={form.certificado_password} onChange={(e) => set('certificado_password', e.target.value)} placeholder="••••••••" />
            </Campo>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700">
            <Campo label="Ambiente">
              <select className={input} value={form.modo_produccion ? '1' : '0'} onChange={(e) => set('modo_produccion', e.target.value === '1')}>
                <option value="0">Beta (pruebas)</option>
                <option value="1">Producción</option>
              </select>
            </Campo>
            <Campo label="Contribuyente de la Amazonía" hint="Activa la leyenda de exoneración del IGV (catálogo n.º 52).">
              <select className={input} value={form.contribuyente_amazonia ? '1' : '0'} onChange={(e) => set('contribuyente_amazonia', e.target.value === '1')}>
                <option value="0">No</option>
                <option value="1">Sí</option>
              </select>
            </Campo>
            {form.contribuyente_amazonia && (
              <Campo label="Tipo de operación (leyenda Amazonía)">
                <select className={input} value={form.tipo_amazonia} onChange={(e) => set('tipo_amazonia', e.target.value)}>
                  {TIPOS_AMAZONIA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Campo>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar accesos SOL
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
