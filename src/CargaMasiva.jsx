import { useState } from 'react';
import {
  Upload, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Send,
} from 'lucide-react';

/**
 * Emisión masiva de comprobantes.
 *
 * El usuario descarga la plantilla, la rellena (una fila por ítem, varias filas
 * con el mismo `grupo` forman un comprobante con varias líneas) y la sube. El
 * backend valida fila a fila y devuelve qué se emitió y qué falló.
 */
export default function CargaMasiva({ api, companyId, conectado }) {
  const [archivo, setArchivo] = useState(null);
  const [enviarSunat, setEnviarSunat] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const deshabilitado = !conectado || !companyId || !archivo || cargando;

  async function descargarPlantilla() {
    setError(null);
    try {
      await api.descargarPlantillaCarga();
    } catch (e) {
      setError(`No se pudo descargar la plantilla: ${e.message}`);
    }
  }

  async function procesar() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const { resumen, message } = await api.cargaMasiva({
        companyId,
        file: archivo,
        enviarSunat,
      });
      setResultado({ ...resumen, message });
    } catch (e) {
      setError(`No se pudo procesar la carga: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Carga masiva de comprobantes</h3>
        <p className="text-sm text-slate-400 mt-1">
          Emite decenas de boletas o facturas de una vez. Descarga la plantilla,
          rellénala en Excel y súbela. Cada fila es un ítem; las filas con el mismo
          <code className="mx-1 px-1 bg-slate-700 rounded">grupo</code>
          se unen en un solo comprobante con varias líneas.
        </p>
      </div>

      {!conectado && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> Conecta la API (pestaña Conexión) para emitir.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Download size={18} className="text-blue-400" /> 1. Plantilla
          </h4>
          <p className="text-xs text-slate-400">
            Incluye la cabecera y una fila de ejemplo. Acepta CSV y XLSX.
          </p>
          <button
            onClick={descargarPlantilla}
            disabled={!conectado}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
          >
            <FileSpreadsheet size={16} /> Descargar plantilla CSV
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Upload size={18} className="text-blue-400" /> 2. Subir archivo
          </h4>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${conectado ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}>
            <FileSpreadsheet size={16} />
            {archivo ? archivo.name : 'Seleccionar CSV o XLSX'}
            <input
              type="file"
              accept=".csv,.xlsx,.txt"
              className="hidden"
              disabled={!conectado}
              onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setResultado(null); e.target.value = ''; }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={enviarSunat}
              onChange={(e) => setEnviarSunat(e.target.checked)}
              disabled={!conectado}
            />
            Enviar a SUNAT después de emitir
          </label>
          <button
            onClick={procesar}
            disabled={deshabilitado}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
          >
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {cargando ? 'Procesando…' : 'Emitir comprobantes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {resultado && (
        <div className="space-y-3">
          <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2 border ${resultado.errores?.length ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
            {resultado.errores?.length ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {resultado.message}
          </div>

          {resultado.emitidos?.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/40 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="p-3">Comprobante</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Estado SUNAT</th>
                    <th className="p-3">Fila</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {resultado.emitidos.map((d) => (
                    <tr key={d.id}>
                      <td className="p-3 font-mono text-blue-400">{d.numero_completo}</td>
                      <td className="p-3">{d.tipo_documento === '01' ? 'Factura' : 'Boleta'}</td>
                      <td className="p-3">{d.estado_sunat ?? '—'}</td>
                      <td className="p-3 text-slate-400">{d.fila_inicial}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resultado.errores?.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-red-400">Filas con errores</h4>
              {resultado.errores.map((e, i) => (
                <p key={i} className="text-xs text-red-300">
                  Fila {e.fila}: {e.mensaje}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
