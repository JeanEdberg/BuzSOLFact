import { useEffect, useState } from 'react';
import {
  CalendarClock, RefreshCw, Send, Download, Loader2, AlertCircle, CheckCircle2, FileText,
} from 'lucide-react';
import { api } from './lib/api.js';

const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';
const label = 'block text-xs text-slate-400 mb-1';

const hoy = () => new Date().toISOString().slice(0, 10);

const ESTADO_COLOR = {
  PENDIENTE: 'text-amber-400',
  PROCESANDO: 'text-blue-400',
  ACEPTADO: 'text-emerald-400',
  RECHAZADO: 'text-red-400',
};

const money = (v) => `S/ ${Number(v ?? 0).toFixed(2)}`;

/**
 * Resumen diario de boletas.
 *
 * Agrupa las boletas PENDIENTES de una fecha, las envía a SUNAT como resumen
 * (con ticket) y consulta el estado hasta obtener el CDR. Es el mecanismo por
 * el que SUNAT acepta las boletas emitidas con envío por resumen.
 */
export default function ResumenDiario({ conectado }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [branchId, setBranchId] = useState(null);

  const [fecha, setFecha] = useState(hoy());
  const [pendientes, setPendientes] = useState([]);
  const [resumenes, setResumenes] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [accion, setAccion] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    if (!conectado) return;
    (async () => {
      try {
        const lista = await api.listCompanies();
        setEmpresas(lista);
        if (lista.length) await cambiarEmpresa(lista[0].id);
      } catch (e) {
        setError(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado]);

  async function cambiarEmpresa(id) {
    setEmpresaId(id);
    setMensaje(null);
    try {
      const suc = await api.listBranches(id);
      setSucursales(suc);
      const b = suc[0]?.id ?? null;
      setBranchId(b);
      if (b) {
        await cargarPendientes(id, b, fecha);
        await cargarResumenes(id, b);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function cargarPendientes(id = empresaId, b = branchId, f = fecha) {
    if (!id || !b) {
      setPendientes([]);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const { items } = await api.boletasPendientesResumen({ companyId: id, branchId: b, fechaEmision: f });
      setPendientes(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function cargarResumenes(id = empresaId, b = branchId) {
    if (!id) {
      setResumenes([]);
      return;
    }
    try {
      setResumenes(await api.listResumenes({ companyId: id, branchId: b }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function generarResumen() {
    if (!empresaId || !branchId) {
      setError('Selecciona empresa y sucursal.');
      return;
    }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const resumen = await api.crearResumen({ companyId: empresaId, branchId, fechaResumen: fecha });
      setMensaje(`Resumen ${resumen?.numero_completo ?? ''} generado con ${resumen?.detalles?.length ?? 0} boleta(s).`);
      await cargarPendientes();
      await cargarResumenes();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function enviar(id) {
    setAccion(`enviar-${id}`);
    setError(null);
    setMensaje(null);
    try {
      const doc = await api.enviarSunat('daily-summaries', id);
      setMensaje(doc?.ticket ? `Resumen enviado. Ticket: ${doc.ticket}` : 'Resumen enviado a SUNAT.');
      await cargarResumenes();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  async function consultar(id) {
    setAccion(`estado-${id}`);
    setError(null);
    setMensaje(null);
    try {
      const doc = await api.consultarEstadoResumen(id);
      setMensaje(`Estado del resumen: ${doc?.estado_sunat ?? 'desconocido'}.`);
      await cargarResumenes();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  async function descargar(id, format) {
    setAccion(`desc-${id}-${format}`);
    setError(null);
    try {
      await api.descargarDocumento('daily-summaries', id, format);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  const totalPendientes = pendientes.reduce((acc, b) => acc + Number(b.mto_imp_venta ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Resumen diario de boletas</h3>
        <p className="text-sm text-slate-400 mt-1">
          Agrupa las boletas pendientes de una fecha, las envía a SUNAT como resumen
          y consulta el ticket hasta obtener el CDR.
        </p>
      </div>

      {!conectado && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> Conecta la API (pestaña Conexión) para gestionar resúmenes.
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-3">
        <div>
          <label className={label}>Empresa</label>
          <select className={input} value={empresaId ?? ''} onChange={(e) => cambiarEmpresa(Number(e.target.value))} disabled={!conectado}>
            <option value="">—</option>
            {empresas.map((c) => <option key={c.id} value={c.id}>{c.razon_social ?? c.nombre ?? c.id}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Sucursal</label>
          <select
            className={input}
            value={branchId ?? ''}
            onChange={(e) => { const b = Number(e.target.value); setBranchId(b); cargarPendientes(empresaId, b, fecha); cargarResumenes(empresaId, b); }}
            disabled={!conectado || !sucursales.length}
          >
            {sucursales.length === 0 && <option value="">Sin sucursales</option>}
            {sucursales.map((b) => <option key={b.id} value={b.id}>{b.nombre ?? b.direccion ?? `Sucursal ${b.id}`}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Fecha del resumen</label>
          <input type="date" className={input} value={fecha} onChange={(e) => { setFecha(e.target.value); cargarPendientes(empresaId, branchId, e.target.value); }} />
        </div>
      </div>

      {(error || mensaje) && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2 border ${error ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
          {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {error || mensaje}
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h4 className="font-semibold flex items-center gap-2">
            <CalendarClock size={18} className="text-blue-400" /> Boletas pendientes ({pendientes.length})
          </h4>
          <div className="flex items-center gap-2">
            <button onClick={() => cargarPendientes()} disabled={!conectado || cargando} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-3 py-2 rounded-lg text-sm">
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refrescar
            </button>
            <button
              onClick={generarResumen}
              disabled={!conectado || guardando || pendientes.length === 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Generar resumen
            </button>
          </div>
        </div>

        {pendientes.length === 0 ? (
          <p className="text-sm text-slate-400">No hay boletas pendientes para la fecha seleccionada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr className="text-left border-b border-slate-700">
                  <th className="py-2 pr-3">Número</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((b) => (
                  <tr key={b.id} className="border-b border-slate-800">
                    <td className="py-2 pr-3">{b.numero_completo}</td>
                    <td className="py-2 pr-3">{b.client?.razon_social ?? '—'}</td>
                    <td className="py-2 pr-3 text-right">{money(b.mto_imp_venta)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-3 font-medium" colSpan={2}>Total</td>
                  <td className="py-2 pr-3 text-right font-medium">{money(totalPendientes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
        <h4 className="font-semibold">Resúmenes generados</h4>
        {resumenes.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay resúmenes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr className="text-left border-b border-slate-700">
                  <th className="py-2 pr-3">Número</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Boletas</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Ticket</th>
                  <th className="py-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {resumenes.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800">
                    <td className="py-2 pr-3">{r.numero_completo}</td>
                    <td className="py-2 pr-3">{r.fecha_resumen?.slice(0, 10)}</td>
                    <td className="py-2 pr-3">{r.detalles?.length ?? 0}</td>
                    <td className={`py-2 pr-3 ${ESTADO_COLOR[r.estado_sunat] ?? 'text-slate-300'}`}>{r.estado_sunat}</td>
                    <td className="py-2 pr-3 text-slate-400">{r.ticket ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => enviar(r.id)}
                          disabled={accion !== null || r.estado_sunat === 'ACEPTADO'}
                          className="p-2 text-blue-400 hover:text-blue-300 disabled:opacity-30"
                          title="Enviar a SUNAT"
                        >
                          {accion === `enviar-${r.id}` ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                        <button
                          onClick={() => consultar(r.id)}
                          disabled={accion !== null || !r.ticket}
                          className="p-2 text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
                          title="Consultar estado"
                        >
                          {accion === `estado-${r.id}` ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        </button>
                        <button
                          onClick={() => descargar(r.id, 'xml')}
                          disabled={accion !== null}
                          className="p-2 text-slate-400 hover:text-slate-300 disabled:opacity-30"
                          title="Descargar XML"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => descargar(r.id, 'cdr')}
                          disabled={accion !== null}
                          className="p-2 text-slate-400 hover:text-slate-300 disabled:opacity-30"
                          title="Descargar CDR"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
