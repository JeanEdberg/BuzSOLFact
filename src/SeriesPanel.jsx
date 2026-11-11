import { useEffect, useState } from 'react';
import {
  ListOrdered, Loader2, AlertCircle, CheckCircle2, Plus, Trash2, Save, Building2,
} from 'lucide-react';
import { api } from './lib/api.js';

const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';

const proximoNumero = (serie, correlativo) =>
  `${serie}-${String(Number(correlativo ?? 0) + 1).padStart(6, '0')}`;

/**
 * Series y correlativos por sucursal.
 *
 * Cada sucursal lleva su propio numerador por tipo de documento; aquí se
 * configuran las series (p. ej. F001, B001) y el correlativo actual. El
 * correlativo es el último usado: el próximo comprobante continúa en +1.
 */
export default function SeriesPanel({ conectado }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [branchId, setBranchId] = useState(null);
  const [series, setSeries] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nueva, setNueva] = useState({ tipoDocumento: '01', serie: 'F', correlativoInicial: 0 });
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(null);

  async function cargarSeries(id) {
    if (!id) {
      setSeries([]);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      setSeries(await api.listCorrelatives(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!conectado) return;
    (async () => {
      try {
        const [lista, catalogo] = await Promise.all([api.listCompanies(), api.tiposDocumentoSerie()]);
        setEmpresas(lista);
        setTipos(catalogo);
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
      const lista = await api.listBranches(id);
      setSucursales(lista);
      const primera = lista[0]?.id ?? null;
      setBranchId(primera);
      await cargarSeries(primera);
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarSucursal(id) {
    setBranchId(id);
    await cargarSeries(id);
  }

  async function crear(event) {
    event.preventDefault();
    if (!branchId) return;
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await api.crearCorrelative(branchId, nueva);
      if (r?.success === false) throw new Error(r.message || 'No se pudo crear la serie');
      setMensaje(`Serie ${nueva.serie} creada.`);
      setNueva({ tipoDocumento: '01', serie: 'F', correlativoInicial: 0 });
      setMostrarForm(false);
      await cargarSeries(branchId);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCorrelativo(item, valor) {
    if (!branchId) return;
    setError(null);
    setMensaje(null);
    try {
      const r = await api.actualizarCorrelative(branchId, item.id, {
        tipoDocumento: item.tipo_documento,
        serie: item.serie,
        correlativoActual: Number(valor),
      });
      if (r?.success === false) throw new Error(r.message || 'No se pudo actualizar');
      setMensaje(`Serie ${item.serie} actualizada.`);
      await cargarSeries(branchId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function eliminar(item) {
    if (!branchId) return;
    setBorrando(item.id);
    setError(null);
    setMensaje(null);
    try {
      const r = await api.eliminarCorrelative(branchId, item.id);
      if (r?.success === false) throw new Error(r.message || 'No se pudo eliminar');
      setMensaje(`Serie ${item.serie} eliminada.`);
      await cargarSeries(branchId);
    } catch (e) {
      setError(e.message);
    } finally {
      setBorrando(null);
    }
  }

  if (!conectado) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Conecta la API en la pestaña <strong>Conexión API</strong> para administrar las series por sucursal.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2"><ListOrdered size={18} /> Series por sucursal</h3>
          <p className="text-xs text-slate-400 mt-1">
            El correlativo es el último número usado; el próximo comprobante continúa en +1.
          </p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          disabled={!branchId}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-3 py-2 rounded-lg text-sm"
        >
          <Plus size={15} /> Nueva serie
        </button>
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

      {sucursales.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Sucursal:</span>
          {sucursales.map((s) => (
            <button
              key={s.id}
              onClick={() => cambiarSucursal(s.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${branchId === s.id ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
            >
              {s.nombre}
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
        <form onSubmit={crear} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold">Nueva serie</h4>
          <div className="grid sm:grid-cols-3 gap-3">
            <select className={input} value={nueva.tipoDocumento} onChange={(e) => setNueva({ ...nueva, tipoDocumento: e.target.value })}>
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>{t.codigo} · {t.nombre}</option>
              ))}
            </select>
            <input
              required
              className={input}
              placeholder="Serie (p. ej. F001)"
              value={nueva.serie}
              onChange={(e) => setNueva({ ...nueva, serie: e.target.value.toUpperCase() })}
            />
            <input
              className={input}
              type="number"
              min="0"
              placeholder="Correlativo inicial"
              value={nueva.correlativoInicial}
              onChange={(e) => setNueva({ ...nueva, correlativoInicial: e.target.value })}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={guardando} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Cargando series…</p>
      ) : !branchId ? (
        <p className="text-sm text-slate-400">Esta empresa no tiene sucursales registradas.</p>
      ) : series.length === 0 ? (
        <p className="text-sm text-slate-400">No hay series configuradas. Crea la primera con «Nueva serie».</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Serie</th>
                <th className="text-left py-2">Último usado</th>
                <th className="text-left py-2">Próximo</th>
                <th className="text-right py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <FilaSerie
                  key={`${s.id}-${s.correlativo_actual}`}
                  item={s}
                  onGuardar={guardarCorrelativo}
                  onEliminar={eliminar}
                  borrando={borrando === s.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaSerie({ item, onGuardar, onEliminar, borrando }) {
  const [valor, setValor] = useState(item.correlativo_actual);
  const cambio = Number(valor) !== Number(item.correlativo_actual);

  return (
    <tr className="border-b border-slate-800">
      <td className="py-2">{item.tipo_documento_nombre}</td>
      <td className="py-2 font-mono font-medium text-blue-400">{item.serie}</td>
      <td className="py-2">
        <input
          type="number"
          min="0"
          className={`${input} w-28`}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </td>
      <td className="py-2 font-mono text-slate-300">{proximoNumero(item.serie, valor)}</td>
      <td className="py-2">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onGuardar(item, valor)}
            disabled={!cambio}
            title="Guardar correlativo"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
          >
            <Save size={14} /> Guardar
          </button>
          <button
            onClick={() => onEliminar(item)}
            disabled={borrando}
            title="Eliminar serie"
            className="flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-30 text-xs"
          >
            {borrando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Eliminar
          </button>
        </div>
      </td>
    </tr>
  );
}
