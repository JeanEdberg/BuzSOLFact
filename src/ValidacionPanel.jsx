import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, ExternalLink, FileSpreadsheet, Loader2,
  RefreshCw, ShieldAlert, Upload, XCircle,
} from 'lucide-react';
import { api, downloadBlob } from './lib/api.js';
import { parseSscoArchivo, buildSscoIndex, marcarSsco } from './lib/ssco.js';
import { parsePropuestaSire } from './lib/cruceSire.js';
import { validarPeriodo } from './lib/validacionPeriodo.js';
import {
  guardarPropuesta, obtenerPropuesta, listarPropuestas, eliminarPropuesta,
} from './lib/repoPropuestas.js';
import { buildLibroCorto } from './lib/libroCorto.js';

const money = (value) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value ?? 0);

const mesActual = () => new Date().toISOString().slice(0, 7);

// Panel de verificación cruzada por periodo: comprobantes propios vs. propuesta
// SIRE y padrón SSCO. Da seguridad al cliente sobre qué comprobantes sustentan
// crédito fiscal y gasto.
export default function ValidacionPanel({ ventas, compras, companyId, conectado, irAComprobante }) {
  const [padronIndex, setPadronIndex] = useState(null);
  const [padronNombre, setPadronNombre] = useState('');
  const [estadoPadron, setEstadoPadron] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [cargandoPadron, setCargandoPadron] = useState(false);

  // Validación por periodo.
  const [periodo, setPeriodo] = useState(mesActual());
  const [libro, setLibro] = useState('compras');
  const [reporte, setReporte] = useState(null);
  const [validando, setValidando] = useState(false);
  const [propuestas, setPropuestas] = useState(() => listarPropuestas({ companyId }));

  const comprasMarcadas = useMemo(
    () => (padronIndex ? marcarSsco(compras, padronIndex, 'proveedor') : compras),
    [compras, padronIndex],
  );
  const ventasMarcadas = useMemo(
    () => (padronIndex ? marcarSsco(ventas, padronIndex, 'cliente') : ventas),
    [ventas, padronIndex],
  );

  const propios = libro === 'compras' ? comprasMarcadas : ventasMarcadas;

  function refrescarListaPropuestas() {
    setPropuestas(listarPropuestas({ companyId }));
  }

  // Descarga el padrón SSCO del backend y lo indexa.
  async function cargarPadronDesdeApi() {
    setCargandoPadron(true);
    setMensaje(null);
    setError(null);
    try {
      const estado = await api.estadoPadronSsco();
      setEstadoPadron(estado);
      if (!estado?.registros) {
        setMensaje('El padrón del backend está vacío. Pulsa "Actualizar desde SUNAT" o sube el archivo.');
        return;
      }
      const rucs = [...compras, ...ventas].map((r) => r.proveedor?.num_doc ?? r.cliente?.num_doc).filter(Boolean);
      const unicos = [...new Set(rucs)];
      if (!unicos.length) {
        setMensaje('No hay comprobantes cargados para cruzar.');
        return;
      }
      const lote = await api.consultarSscoLote(unicos);
      const mapa = lote?.ssco ?? {};
      setPadronIndex(new Map(Object.entries(mapa).map(([ruc, detalle]) => [ruc, detalle])));
      setPadronNombre(`backend (${estado.registros} registros)`);
      setMensaje(`Padrón cruzado: ${Object.keys(mapa).length} contraparte(s) del libro figuran como SSCO.`);
    } catch (e) {
      setError(`No se pudo cruzar con el padrón del backend: ${e.message}`);
    } finally {
      setCargandoPadron(false);
    }
  }

  async function refrescarPadronSunat() {
    setCargandoPadron(true);
    setMensaje(null);
    setError(null);
    try {
      const res = await api.refrescarPadronSsco();
      if (res?.success) {
        setMensaje(res.message ?? 'Padrón actualizado.');
        await cargarPadronDesdeApi();
      } else {
        setError(res?.message ?? 'No se pudo actualizar el padrón desde SUNAT.');
      }
    } catch (e) {
      setError(`No se pudo actualizar el padrón desde SUNAT: ${e.message}`);
    } finally {
      setCargandoPadron(false);
    }
  }

  async function subirPadron(file) {
    if (!file) return;
    setMensaje(null);
    setError(null);
    setCargandoPadron(true);
    try {
      if (conectado) {
        const res = await api.subirPadronSsco(file);
        if (res?.success) setMensaje(res.message ?? 'Padrón cargado en el backend.');
      }
      const buffer = await file.arrayBuffer();
      const registros = await parseSscoArchivo(buffer);
      setPadronIndex(buildSscoIndex(registros));
      setPadronNombre(file.name);
      setMensaje(`Padrón SSCO cargado (${registros.length} registros).`);
    } catch (e) {
      setError(`No se pudo leer el padrón: ${e.message}`);
    } finally {
      setCargandoPadron(false);
    }
  }

  // Validación del periodo: usa la propuesta archivada, la descarga del backend
  // o la subida a mano; siempre cruza contra el padrón SSCO.
  async function validarPeriodoActual({ descargarSiFalta = false } = {}) {
    setValidando(true);
    setMensaje(null);
    setError(null);
    try {
      let propuesta = obtenerPropuesta({ companyId, libro, periodo });
      let origen = propuesta?.origen;

      if (!propuesta && descargarSiFalta) {
        if (!conectado) throw new Error('Conecta la API para descargar la propuesta SIRE del periodo.');
        const { texto } = await api.obtenerPropuestaSire(companyId, periodo, libro);
        guardarPropuesta({ companyId, libro, periodo, contenido: texto, origen: 'servidor' });
        propuesta = obtenerPropuesta({ companyId, libro, periodo });
        origen = 'servidor';
      }

      const filas = propuesta?.filas ?? null;
      const rep = validarPeriodo({ propios, propuesta: filas, libro, padronIndex, periodo });
      setReporte({ ...rep, origenPropuesta: origen });
      refrescarListaPropuestas();

      if (!propuesta) {
        setMensaje('No hay propuesta SIRE archivada para el periodo. Descárgala del servidor o súbela en .TXT.');
      } else if (rep.hayHallazgos) {
        setMensaje(`Se encontraron ${rep.sscoPropios.length + rep.sscoPropuesta.length} hallazgo(s) SSCO en ${periodo}.`);
      } else {
        setMensaje(`Sin observaciones SSCO en ${periodo}.`);
      }
    } catch (e) {
      setError(`No se pudo validar el periodo: ${e.message}`);
    } finally {
      setValidando(false);
    }
  }

  // Sube el TXT de la propuesta, lo archiva por periodo y valida.
  async function subirPropuestaPeriodo(file) {
    if (!file) return;
    setMensaje(null);
    setError(null);
    try {
      const texto = await file.text();
      const registros = parsePropuestaSire(texto, libro);
      if (!registros.length) {
        setError(`No se reconocieron comprobantes en ${file.name}. ¿Es la propuesta ${libro === 'compras' ? 'RCE' : 'RVIE'} del periodo ${periodo}?`);
        return;
      }
      guardarPropuesta({ companyId, libro, periodo, contenido: texto, origen: 'manual', nombre: file.name });
      setMensaje(`Propuesta ${libro === 'compras' ? 'RCE' : 'RVIE'} de ${periodo} archivada (${registros.length} registros).`);
      await validarPeriodoActual();
    } catch (e) {
      setError(`No se pudo leer la propuesta: ${e.message}`);
    }
  }

  function quitarPropuesta(p) {
    eliminarPropuesta({ companyId, libro: p.libro, periodo: p.periodo });
    refrescarListaPropuestas();
  }

  function exportarValidado() {
    try {
      const built = buildLibroCorto(ventasMarcadas, comprasMarcadas);
      downloadBlob(
        built.bytes,
        'Libro_Validado_SSCO.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      setMensaje('Excel validado generado (incluye la columna SSCO).');
    } catch (e) {
      setError(`No se pudo generar el Excel: ${e.message}`);
    }
  }

  const propuestasPeriodo = propuestas.filter((p) => p.libro === libro);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-400" /> Validación SSCO del periodo
        </h3>
        <p className="text-xs text-slate-400">
          Elige el mes a revisar. Se cruza el libro del periodo contra la <strong>propuesta SIRE</strong> de SUNAT
          y contra el <strong>padrón SSCO</strong>. Los comprobantes de un SSCO <strong>no dan crédito fiscal ni
          sustentan gasto</strong> (Decreto Legislativo N.º 1532).
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Periodo a revisar</label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => { setPeriodo(e.target.value); setReporte(null); }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Libro</label>
            <select
              value={libro}
              onChange={(e) => { setLibro(e.target.value); setReporte(null); }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="compras">Compras (RCE)</option>
              <option value="ventas">Ventas (RVIE)</option>
            </select>
          </div>
          <button
            onClick={() => validarPeriodoActual({ descargarSiFalta: true })}
            disabled={validando}
            className="flex items-center gap-2 bg-amber-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-500 disabled:opacity-40"
            title="Descarga la propuesta SIRE del periodo (si no está archivada) y la cruza con el padrón SSCO"
          >
            {validando ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
            Validar SSCO del periodo
          </button>
          <button
            onClick={() => validarPeriodoActual()}
            disabled={validando}
            className="flex items-center gap-2 bg-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-600 disabled:opacity-40"
            title="Valida solo con lo que ya está archivado"
          >
            <RefreshCw size={15} /> Validar con lo archivado
          </button>
          <label className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm cursor-pointer">
            <Upload size={15} /> Subir propuesta (.TXT)
            <input
              type="file"
              accept=".txt,.TXT"
              className="hidden"
              onChange={(e) => { subirPropuestaPeriodo(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
        </div>

        {padronNombre && (
          <p className="text-xs text-slate-400">Padrón activo: <span className="text-slate-200">{padronNombre}</span></p>
        )}
        {estadoPadron && (
          <p className="text-xs text-slate-500">Fuente oficial: {estadoPadron.fuente} · {estadoPadron.registros} registros</p>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
            Administrar padrón y propuestas archivadas
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={cargarPadronDesdeApi}
                disabled={!conectado || cargandoPadron}
                className="flex items-center gap-2 bg-blue-600 px-3 py-2 rounded-lg text-sm hover:bg-blue-500 disabled:opacity-40"
              >
                {cargandoPadron ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Cruzar con padrón (API)
              </button>
              <button
                onClick={refrescarPadronSunat}
                disabled={!conectado || cargandoPadron}
                className="flex items-center gap-2 bg-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-600 disabled:opacity-40"
              >
                <Download size={15} /> Actualizar desde SUNAT
              </button>
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer ${cargandoPadron ? 'bg-slate-700/50 opacity-40' : 'bg-slate-700 hover:bg-slate-600'}`}>
                <Upload size={15} /> Subir padrón (.xlsx)
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  disabled={cargandoPadron}
                  onChange={(e) => { subirPadron(e.target.files?.[0]); e.target.value = ''; }}
                />
              </label>
              <button
                onClick={exportarValidado}
                className="flex items-center gap-2 bg-emerald-600 px-3 py-2 rounded-lg text-sm hover:bg-emerald-500"
              >
                <FileSpreadsheet size={15} /> Excel validado
              </button>
            </div>

            {propuestasPeriodo.length > 0 && (
              <div>
                <p className="text-slate-400 mb-1">Propuestas archivadas ({libro}):</p>
                <ul className="space-y-1">
                  {propuestasPeriodo.map((p) => (
                    <li key={p.periodo} className="flex items-center justify-between gap-2 bg-slate-900/60 rounded px-2 py-1">
                      <span>
                        <span className="text-slate-200">{p.periodo}</span> · {p.registros} reg. · {p.origen}
                        {p.nombre ? ` · ${p.nombre}` : ''}
                      </span>
                      <button onClick={() => quitarPropuesta(p)} className="text-red-400 hover:text-red-300">Quitar</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </div>

      {mensaje && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {reporte && <ReporteValidacion reporte={reporte} onAbrir={irAComprobante} />}
    </div>
  );
}

// Reporte visual del periodo: qué comprobantes caen en un SSCO y el enlace para
// abrirlos en el registro correspondiente.
function ReporteValidacion({ reporte, onAbrir }) {
  const { resumen, sscoPropios, sscoPropuesta, cruce, periodo, libro, origenPropuesta } = reporte;
  const hay = sscoPropios.length + sscoPropuesta.length > 0;

  return (
    <div className="space-y-4">
      <div className={`border rounded-xl p-5 space-y-3 ${hay ? 'bg-amber-500/10 border-amber-500/40' : 'bg-emerald-500/10 border-emerald-500/40'}`}>
        <h3 className="font-semibold flex items-center gap-2">
          {hay
            ? <><AlertTriangle size={18} className="text-amber-400" /> Hallazgos SSCO en {periodo} ({libro})</>
            : <><CheckCircle2 size={18} className="text-emerald-400" /> Sin observaciones SSCO en {periodo} ({libro})</>}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-slate-400 text-xs">Comprobantes del periodo</div><div>{resumen.comprobantes}</div></div>
          <div><div className="text-slate-400 text-xs">Con contraparte SSCO</div><div className="text-amber-400 font-semibold">{sscoPropios.length + sscoPropuesta.length}</div></div>
          <div><div className="text-slate-400 text-xs">IGV sin crédito fiscal</div><div className="text-amber-400">{money(reporte.igvAfectado)}</div></div>
          <div><div className="text-slate-400 text-xs">Importe sin gasto</div><div className="text-amber-400">{money(reporte.importeAfectado)}</div></div>
        </div>
        <p className="text-xs text-slate-400">
          Propuesta SIRE: {reporte.conPropuesta ? `cargada (${origenPropuesta ?? 'local'})` : 'no disponible'} ·
          Los comprobantes de un SSCO no otorgan crédito fiscal ni sustentan gasto.
        </p>
      </div>

      {sscoPropios.length > 0 && (
        <TablaSsco titulo={`En tu libro (${libro})`} filas={sscoPropios} onAbrir={onAbrir} puedeAbrir />
      )}
      {sscoPropuesta.length > 0 && (
        <TablaSsco titulo="Propuestos por SUNAT y no registrados en tu libro" filas={sscoPropuesta} onAbrir={onAbrir} puedeAbrir={false} />
      )}

      {cruce && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2 text-xs">
          <h4 className="font-semibold text-sm">Cruce con la propuesta SIRE</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div><span className="text-slate-400">Mi libro:</span> {cruce.totalPropio}</div>
            <div><span className="text-slate-400">Propuesta:</span> {cruce.totalPropuesta}</div>
            <div className="text-emerald-400">Coinciden: {cruce.coincidencias.length}</div>
            <div className="text-amber-400">Solo en propuesta: {cruce.soloPropuesta.length}</div>
            <div className="text-sky-400">Solo en mi libro: {cruce.soloPropio.length}</div>
            <div className="text-red-400">Con diferencias: {cruce.diferencias.length}</div>
          </div>
          {cruce.soloPropuesta.length > 0 && (
            <div>
              <p className="flex items-center gap-1 text-amber-400 font-medium mt-2">
                <AlertTriangle size={13} /> SUNAT propone comprobantes que no están en tu libro
              </p>
              <ul className="text-slate-300">
                {cruce.soloPropuesta.slice(0, 10).map((p, i) => (
                  <li key={i}>{p.serie}-{p.numero} · {p.razon_social} · {money(p.total)}</li>
                ))}
              </ul>
            </div>
          )}
          {cruce.diferencias.length > 0 && (
            <div>
              <p className="flex items-center gap-1 text-red-400 font-medium mt-2">
                <XCircle size={13} /> Diferencias de importes
              </p>
              <ul className="text-slate-300">
                {cruce.diferencias.slice(0, 10).map((d, i) => (
                  <li key={i}>
                    {d.comprobante}: {d.cambios.map((c) => `${c.campo} ${money(c.propio)} → ${money(c.propuesta)}`).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TablaSsco({ titulo, filas, onAbrir, puedeAbrir }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
      <h4 className="font-semibold text-sm text-amber-400">{titulo}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-700">
            <tr>
              <th className="text-left py-1">Comprobante</th>
              <th className="text-left">Fecha</th>
              <th className="text-left">RUC</th>
              <th className="text-left">Contraparte</th>
              <th className="text-left">Resolución</th>
              <th className="text-right">IGV</th>
              <th className="text-right">Total</th>
              <th className="text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r, i) => (
              <tr key={`${r.serie}-${r.numero}-${i}`} className="border-b border-slate-700/50">
                <td className="py-1 text-slate-200">{r.serie}-{r.numero}</td>
                <td>{r.fecha_emision}</td>
                <td>{r.num_doc}</td>
                <td>{r.razon_social}</td>
                <td className="text-amber-400">{r.resolucion || '—'}</td>
                <td className="text-right">{money(r.igv)}</td>
                <td className="text-right">{money(r.total)}</td>
                <td className="text-right">
                  {puedeAbrir ? (
                    <button
                      onClick={() => onAbrir?.(r)}
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      title="Abrir el comprobante en su registro"
                    >
                      <ExternalLink size={13} /> Ver
                    </button>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
