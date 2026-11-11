import { useMemo, useState } from 'react';
import {
  Bell, FileText, ShoppingCart, Truck, Search, CheckCircle2, RefreshCw,
  Download, AlertCircle, BookOpen, Plug, Loader2,
} from 'lucide-react';
import { createApi, downloadText, downloadBlob } from './lib/api.js';
import { buildVentas141, buildCompras81, summarize } from './lib/ple.js';
import { buildRvie, buildRce } from './lib/sire.js';
import { buildLibroCorto } from './lib/libroCorto.js';
import { mapVenta } from './lib/mapper.js';
import { crearServicioTipoCambio, normalizarFecha } from './lib/tipoCambio.js';
import {
  empresa, notificaciones, comprobantesVenta, comprobantesCompra,
} from './lib/sampleData.js';

const api = createApi();

// El tipo de cambio se resuelve por fecha contra el backend (proxy de SUNAT).
const tipoCambio = crearServicioTipoCambio({
  fetchCotizacion: (fecha) => api.getTipoCambio(fecha),
});

const TABS = [
  { id: 'buzon', label: 'Buzón SUNAT / SUNAFIL', icon: Bell },
  { id: 'compras', label: 'Registro de Compras', icon: ShoppingCart },
  { id: 'facturas', label: 'Facturación & Boletas', icon: FileText },
  { id: 'guias', label: 'Guías de Remisión', icon: Truck },
  { id: 'libros', label: 'Libros Electrónicos', icon: BookOpen },
  { id: 'conexion', label: 'Conexión API', icon: Plug },
];

const money = (value) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value ?? 0);

function DownloadButtons({ documento, onDownload, busy }) {
  const formats = [
    { key: 'xml', label: 'XML' },
    { key: 'pdf', label: 'PDF' },
    { key: 'cdr', label: 'CDR' },
  ];
  return (
    <div className="flex justify-center gap-2">
      {formats.map((f) => (
        <button
          key={f.key}
          onClick={() => onDownload(documento, f.key)}
          disabled={busy === `${documento.id}-${f.key}`}
          title={`Descargar ${f.label}`}
          className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-xs"
        >
          {busy === `${documento.id}-${f.key}` ? '…' : f.label}
        </button>
      ))}
    </div>
  );
}

function EstadoBadge({ estado }) {
  const map = {
    ACEPTADO: 'bg-emerald-500/20 text-emerald-400',
    PENDIENTE: 'bg-amber-500/20 text-amber-400',
    ENVIADO: 'bg-sky-500/20 text-sky-400',
    PROCESANDO: 'bg-sky-500/20 text-sky-400',
    RECHAZADO: 'bg-red-500/20 text-red-400',
    ERROR: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[estado] ?? 'bg-slate-600 text-slate-300'}`}>
      {estado ?? '—'}
    </span>
  );
}

function ComprobantesTable({ documentos, contraparte, onDownload, busy }) {
  if (!documentos.length) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-sm text-slate-400">
        No hay comprobantes para mostrar.
      </div>
    );
  }
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
            <th className="p-4">Serie / Número</th>
            <th className="p-4">{contraparte}</th>
            <th className="p-4">Emisión</th>
            <th className="p-4">Total</th>
            <th className="p-4">Estado SUNAT</th>
            <th className="p-4 text-center">Descargas (XML / PDF / CDR)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700 text-sm">
          {documentos.map((d) => (
            <tr key={`${d.tipo_documento}-${d.id}`} className="hover:bg-slate-700/50">
              <td className="p-4 font-mono font-medium text-blue-400">{d.serie}-{d.numero}</td>
              <td className="p-4">{(d.cliente ?? d.proveedor)?.razon_social}</td>
              <td className="p-4">{d.fecha_emision}</td>
              <td className="p-4">{money(d.total)}</td>
              <td className="p-4"><EstadoBadge estado={d.estado_sunat} /></td>
              <td className="p-4"><DownloadButtons documento={d} onDownload={onDownload} busy={busy} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FORMATOS = {
  ple: {
    etiqueta: 'PLE',
    detalle: 'Histórico (RS 112-2021)',
    ventas: (rows, ctx) => buildVentas141(rows, ctx),
    compras: (rows, ctx) => buildCompras81(rows, ctx),
  },
  sire: {
    etiqueta: 'SIRE',
    detalle: 'Vigente (Anexos 3 y 11)',
    ventas: (rows, ctx) => buildRvie(rows.map((r) => ({ ...r, periodo: ctx.periodo })), ctx),
    compras: (rows, ctx) => buildRce(rows.map((r) => ({ ...r, periodo: ctx.periodo })), ctx),
  },
};

function LibrosPanel({ ventas, compras }) {
  const [periodo, setPeriodo] = useState('2026-11');
  const [mensaje, setMensaje] = useState(null);
  const [generando, setGenerando] = useState(false);

  // El periodo del selector es 'YYYY-MM'; las fechas vienen como 'YYYY-MM-DD'.
  const filtrar = (rows) => rows.filter((r) => (r.fecha_emision ?? '').startsWith(periodo));
  const ventasPeriodo = useMemo(() => filtrar(ventas), [ventas, periodo]);
  const comprasPeriodo = useMemo(() => filtrar(compras), [compras, periodo]);

  const resumenVentas = useMemo(() => summarize(ventasPeriodo, 'ventas'), [ventasPeriodo]);
  const resumenCompras = useMemo(() => summarize(comprasPeriodo, 'compras'), [comprasPeriodo]);

  // La API no persiste el tipo de cambio: se resuelve por fecha al generar.
  const faltaTc = tipoCambio.faltantes([...ventasPeriodo, ...comprasPeriodo]).length;

  async function generar(tipo, formato) {
    const rows = tipo === 'ventas' ? ventasPeriodo : comprasPeriodo;
    setGenerando(true);
    setMensaje(null);
    try {
      // Consulta las tasas faltantes (una vez por fecha) antes de armar el libro.
      await tipoCambio.precargar(tipoCambio.faltantes(rows));
      const resueltas = rows.map((r) => {
        if (!r.moneda || r.moneda === 'PEN' || r.tipo_cambio) return r;
        const tasa = tipoCambio.cache.get(normalizarFecha(r.fecha_emision));
        return tasa != null ? { ...r, tipo_cambio: tasa } : r;
      });
      const ctx = { ruc: empresa.ruc, razon_social: empresa.razon_social, periodo };
      const built = FORMATOS[formato][tipo](resueltas, ctx);
      downloadText(built.filename, built.content);
      setMensaje(`Generado ${built.filename} · formato ${FORMATOS[formato].etiqueta} (${rows.length} registros).`);
    } catch (error) {
      setMensaje(`No se pudo generar el libro: ${error.message}`);
    } finally {
      setGenerando(false);
    }
  }

  // Excel corto: una hoja de ventas y otra de compras del periodo, con las
  // columnas resumidas que usa el cliente (incluye Amazonía y verificación SIRE).
  function generarExcel() {
    setMensaje(null);
    try {
      const built = buildLibroCorto(ventasPeriodo, comprasPeriodo);
      const nombre = `Libro_${periodo.replace('-', '')}_Ventas_Compras.xlsx`;
      downloadBlob(built.bytes, nombre, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setMensaje(`Generado ${nombre} · ${ventasPeriodo.length} venta(s) y ${comprasPeriodo.length} compra(s).`);
    } catch (error) {
      setMensaje(`No se pudo generar el Excel: ${error.message}`);
    }
  }

  const cards = [
    { tipo: 'ventas', titulo: 'Registro de Ventas e Ingresos', resumen: resumenVentas },
    { tipo: 'compras', titulo: 'Registro de Compras', resumen: resumenCompras },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Periodo (AAAA-MM)</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <p className="text-xs text-slate-400">
          Formatos oficiales SUNAT: <strong>PLE</strong> (RS 112-2021, histórico) y <strong>SIRE</strong> (vigente).
          Separador <code>|</code>, codificación latin-1. El <strong>Excel</strong> es un resumen corto (ventas y compras) para el cliente.
        </p>
      </div>

      <button
        onClick={generarExcel}
        disabled={generando || (!ventasPeriodo.length && !comprasPeriodo.length)}
        className="flex items-center gap-2 bg-emerald-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download size={16} /> Descargar Excel corto (ventas y compras)
      </button>

      {faltaTc > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> {faltaTc} fecha(s) con moneda extranjera sin tipo de cambio.
          Se consultarán a SUNAT al generar (requiere el proxy <code>/v1/tipo-cambio</code> en el backend).
        </div>
      )}

      {mensaje && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <div key={c.tipo} className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
            <div>
              <h3 className="font-semibold">{c.titulo}</h3>
              <p className="text-xs text-slate-400">{c.resumen.registros} registros en {periodo}</p>
            </div>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-slate-400">Base gravada</dt><dd>{money(c.resumen.bi_gravada)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">IGV</dt><dd>{money(c.resumen.igv)}</dd></div>
              {c.tipo === 'ventas' ? (
                <>
                  <div className="flex justify-between"><dt className="text-slate-400">Exonerada</dt><dd>{money(c.resumen.exonerada)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Inafecta</dt><dd>{money(c.resumen.inafecta)}</dd></div>
                </>
              ) : (
                <div className="flex justify-between"><dt className="text-slate-400">No gravada</dt><dd>{money(c.resumen.no_gravada)}</dd></div>
              )}
              <div className="flex justify-between font-semibold border-t border-slate-700 pt-1"><dt>Total</dt><dd>{money(c.resumen.total)}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(FORMATOS).map(([key, f]) => (
                <button
                  key={key}
                  onClick={() => generar(c.tipo, key)}
                  disabled={!c.resumen.registros || generando}
                  title={f.detalle}
                  className="flex items-center justify-center gap-2 bg-blue-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {f.etiqueta}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConexionPanel({ onConectar, conectado, cargando, error, token }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="max-w-lg space-y-4">
      <h3 className="text-xl font-bold">Conexión a la API de facturación</h3>
      <p className="text-sm text-slate-400">
        Ingresa con las credenciales del backend Laravel. Al conectar, los comprobantes
        emitidos se cargan desde <code>/api/v1/invoices</code> y <code>/api/v1/boletas</code>.
      </p>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => onConectar({ email, password })}
          disabled={cargando}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {cargando ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
          {cargando ? 'Conectando…' : 'Conectar y cargar'}
        </button>
        {conectado && (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 size={16} /> Conectado. Token: {token ? `${token.slice(0, 8)}…` : '—'}
          </p>
        )}
        {error && (
          <p className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle size={16} /> {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('buzon');
  const [busy, setBusy] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [ventas, setVentas] = useState(comprobantesVenta);
  const [compras, setCompras] = useState(comprobantesCompra);
  const [fuente, setFuente] = useState('demo');
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorConexion, setErrorConexion] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  async function conectar({ email, password }) {
    setCargando(true);
    setErrorConexion(null);
    try {
      const sesion = await api.login({ email, password });
      setToken(sesion.access_token ?? sesion.token ?? null);
      const emitidos = await api.listVentas();
      setVentas(emitidos.map((d) => mapVenta(d)));
      // La API de facturación no expone comprobantes recibidos; se conserva la
      // fuente local para compras hasta conectar un módulo de compras.
      setCompras(comprobantesCompra);
      setFuente('api');
      setAviso(`Conectado. ${emitidos.length} comprobante(s) emitido(s) cargado(s) desde la API.`);
    } catch (error) {
      setErrorConexion(error.message);
    } finally {
      setCargando(false);
    }
  }

  function volverADemo() {
    setVentas(comprobantesVenta);
    setCompras(comprobantesCompra);
    setFuente('demo');
    setToken(null);
    api.setToken(null);
    setAviso('Se restauraron los datos de demostración.');
  }

  async function handleDownload(documento, format) {
    setBusy(`${documento.id}-${format}`);
    setAviso(null);
    try {
      await api.download(documento.tipo_documento, documento.id, format);
      setAviso(`Descarga ${format.toUpperCase()} iniciada para ${documento.serie}-${documento.numero}.`);
    } catch (error) {
      setAviso(`No se pudo descargar ${format.toUpperCase()}: ${error.message}`);
    } finally {
      setBusy(null);
    }
  }

  const filtrados = (rows) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((d) =>
      `${d.serie}-${d.numero}`.toLowerCase().includes(q)
      || (d.cliente ?? d.proveedor)?.razon_social?.toLowerCase().includes(q));
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex-col hidden md:flex">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-xl font-bold text-blue-400">INMOA ERP PWA</h1>
          <p className="text-xs text-slate-400">RUC: {empresa.ruc}</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={volverADemo}
            className="w-full text-xs text-slate-400 hover:text-slate-200 underline"
          >
            Restaurar datos demo
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
          <span className={`text-xs px-3 py-1 rounded-full border ${fuente === 'api' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-600/40 text-slate-300 border-slate-600'}`}>
            {fuente === 'api' ? 'API conectada' : 'Datos demo'}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {aviso && (
            <div className="flex items-center gap-2 text-sm bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
              <AlertCircle size={16} className="text-blue-400" /> {aviso}
            </div>
          )}

          {activeTab === 'buzon' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Notificaciones Electrónicas en Tiempo Real</h3>
                <button className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500">
                  <RefreshCw size={16} /> Sincronizar Buzones
                </button>
              </div>
              <div className="grid gap-3">
                {notificaciones.map((n) => (
                  <div key={n.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${n.entidad === 'SUNAT' ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {n.entidad}
                      </span>
                      <h4 className="font-medium mt-1">{n.titulo}</h4>
                      <p className="text-xs text-slate-400">Fecha: {n.fecha} · {n.tipo}</p>
                    </div>
                    <button className="text-blue-400 hover:underline text-sm">Ver Detalle</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'compras' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Comprobantes de Compra Recibidos</h3>
              <ComprobantesTable
                documentos={filtrados(compras)}
                contraparte="Proveedor"
                onDownload={handleDownload}
                busy={busy}
              />
            </div>
          )}

          {activeTab === 'facturas' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Facturación & Boletas Emitidas</h3>
              <ComprobantesTable
                documentos={filtrados(ventas)}
                contraparte="Cliente"
                onDownload={handleDownload}
                busy={busy}
              />
            </div>
          )}

          {activeTab === 'guias' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h3 className="text-xl font-bold">Consulta y Descarga de Comprobantes</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar serie o cliente..."
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <button className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 flex items-center gap-2">
                    <Search size={16} /> Buscar
                  </button>
                </div>
              </div>
              <ComprobantesTable
                documentos={filtrados(ventas)}
                contraparte="Cliente"
                onDownload={handleDownload}
                busy={busy}
              />
            </div>
          )}

          {activeTab === 'libros' && <LibrosPanel ventas={ventas} compras={compras} />}

          {activeTab === 'conexion' && (
            <ConexionPanel
              onConectar={conectar}
              conectado={fuente === 'api'}
              cargando={cargando}
              error={errorConexion}
              token={token}
            />
          )}
        </div>
      </main>
    </div>
  );
}
