import { useEffect, useState } from 'react';
import {
  Truck, RefreshCw, Send, Download, Loader2, AlertCircle, ArrowRight,
} from 'lucide-react';

const RECURSO = 'dispatch-guides';

/**
 * Guías de remisión (tipo 09).
 *
 * Muestra las guías emitidas con su estado en SUNAT y permite reenviarlas o
 * descargar XML, CDR y PDF. La emisión de una guía nueva vive en la pestaña
 * "Notas y Guías", que es donde está el formulario completo.
 */
export default function GuiasPanel({ api, companyId, conectado, onIrANotas }) {
  const [guias, setGuias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [accion, setAccion] = useState(null);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!conectado) {
      setGuias([]);
      return;
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado, companyId]);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      setGuias(await api.listGuias({ companyId }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function enviar(guia) {
    setAccion(`${guia.id}-enviar`);
    setError(null);
    try {
      await api.enviarSunat(RECURSO, guia.id);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  async function descargar(guia, formato) {
    setAccion(`${guia.id}-${formato}`);
    setError(null);
    try {
      await api.descargarDocumento(RECURSO, guia.id, formato);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  const termino = busqueda.trim().toLowerCase();
  const filtradas = termino
    ? guias.filter((g) => [
      g.numero_completo,
      g.serie,
      g.correlativo,
      g.destinatario?.razon_social,
      g.destinatario?.numero_documento,
    ].some((v) => String(v ?? '').toLowerCase().includes(termino)))
    : guias;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Truck size={20} className="text-blue-400" /> Guías de remisión
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Guías electrónicas (tipo 09) emitidas a la empresa. Aquí consultas su
            estado en SUNAT y descargas los archivos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar número o destinatario…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={cargar}
            disabled={!conectado || cargando}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium"
          >
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Actualizar
          </button>
          {onIrANotas && (
            <button
              onClick={onIrANotas}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Emitir una guía <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {!conectado && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> Conecta la API para consultar las guías reales.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {conectado && !cargando && filtradas.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-400">
            {guias.length === 0
              ? 'Todavía no hay guías de remisión emitidas.'
              : 'Ninguna guía coincide con la búsqueda.'}
          </p>
        </div>
      )}

      {filtradas.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/40 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Destinatario</th>
                <th className="p-3">Traslado</th>
                <th className="p-3">Estado SUNAT</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtradas.map((g) => (
                <tr key={g.id}>
                  <td className="p-3 font-mono text-blue-400">
                    {g.numero_completo ?? `${g.serie}-${g.correlativo}`}
                  </td>
                  <td className="p-3">{String(g.fecha_emision ?? '').slice(0, 10)}</td>
                  <td className="p-3">
                    <p>{g.destinatario?.razon_social ?? '—'}</p>
                    <p className="text-xs text-slate-500">{g.destinatario?.numero_documento ?? ''}</p>
                  </td>
                  <td className="p-3 text-xs text-slate-400">
                    {g.des_traslado ?? g.cod_traslado ?? '—'}
                    {g.fecha_traslado ? ` · ${String(g.fecha_traslado).slice(0, 10)}` : ''}
                  </td>
                  <td className="p-3">{g.estado_sunat ?? 'PENDIENTE'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => enviar(g)}
                        disabled={accion === `${g.id}-enviar`}
                        className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-2 py-1 rounded"
                      >
                        {accion === `${g.id}-enviar`
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Send size={12} />} SUNAT
                      </button>
                      {['xml', 'cdr', 'pdf'].map((f) => (
                        <button
                          key={f}
                          onClick={() => descargar(g, f)}
                          disabled={accion === `${g.id}-${f}`}
                          className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-2 py-1 rounded"
                        >
                          <Download size={12} /> {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
