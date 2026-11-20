import { useState } from 'react';
import {
  Upload, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, History, Info,
} from 'lucide-react';

/**
 * Importación de comprobantes de períodos anteriores (histórico).
 *
 * Sube el archivo plano del PLE (Registro de Ventas 14.1 / Registro de Compras
 * 8.1) que se descarga de SUNAT, o la plantilla CSV/XLSX. Los comprobantes se
 * registran SIN enviarse a SUNAT, porque ya fueron declarados en su momento, y
 * quedan disponibles para los libros y la propuesta del SIRE.
 */
export default function ImportacionHistorica({ api, companyId, conectado }) {
  const [tipo, setTipo] = useState('ventas');
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const deshabilitado = !conectado || !companyId || !archivo || cargando;

  async function descargarPlantilla() {
    setError(null);
    try {
      await api.descargarPlantillaHistorico(tipo);
    } catch (e) {
      setError(`No se pudo descargar la plantilla: ${e.message}`);
    }
  }

  async function importar() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const { resumen, message } = await api.importarHistorico({ companyId, file: archivo });
      setResultado({ ...resumen, message });
    } catch (e) {
      setError(`No se pudo importar el archivo: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History size={20} className="text-blue-400" /> Importación de períodos anteriores
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Carga el histórico de ventas y compras de meses o años anteriores. Acepta
          el TXT del PLE (Ventas 14.1 / Compras 8.1) o una plantilla CSV/XLSX. Los
          comprobantes se registran sin reenviarse a SUNAT.
        </p>
      </div>

      {!conectado && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> Conecta la API (pestaña Conexión) para importar.
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <span>
          El formato se detecta solo: un archivo con el separador <code className="mx-1 px-1 bg-slate-700 rounded">|</code>
          se trata como PLE; un CSV o XLSX, como plantilla. Reimportar el mismo
          archivo actualiza los comprobantes en vez de duplicarlos.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Download size={18} className="text-blue-400" /> 1. Plantilla (opcional)
          </h4>
          <p className="text-xs text-slate-400">
            Si no tienes el TXT del PLE, descarga la plantilla del libro que quieras
            importar y rellénala.
          </p>
          <div className="flex gap-2">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ventas">Ventas</option>
              <option value="compras">Compras</option>
            </select>
            <button
              onClick={descargarPlantilla}
              disabled={!conectado}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
            >
              <FileSpreadsheet size={16} /> Descargar plantilla
            </button>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Upload size={18} className="text-blue-400" /> 2. Subir archivo
          </h4>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${conectado ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}>
            <FileSpreadsheet size={16} />
            {archivo ? archivo.name : 'Seleccionar TXT, CSV o XLSX'}
            <input
              type="file"
              accept=".txt,.csv,.xlsx"
              className="hidden"
              disabled={!conectado}
              onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setResultado(null); e.target.value = ''; }}
            />
          </label>
          <button
            onClick={importar}
            disabled={deshabilitado}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
          >
            {cargando ? <Loader2 size={16} className="animate-spin" /> : <History size={16} />}
            {cargando ? 'Importando…' : 'Importar histórico'}
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

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Total de filas', resultado.total],
              ['Importados', resultado.importados],
              ['Actualizados', resultado.actualizados],
              ['Omitidos', resultado.omitidos?.length ?? 0],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-slate-400">{etiqueta}</p>
                <p className="text-2xl font-bold">{valor ?? 0}</p>
              </div>
            ))}
          </div>

          {resultado.omitidos?.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-amber-400">Filas omitidas</h4>
              {resultado.omitidos.slice(0, 20).map((o, i) => (
                <p key={i} className="text-xs text-amber-300">Fila {o.fila}: {o.motivo}</p>
              ))}
            </div>
          )}

          {resultado.errores?.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-red-400">Filas con errores</h4>
              {resultado.errores.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs text-red-300">Fila {e.fila}: {e.mensaje}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
