import { useMemo, useState } from 'react';
import {
  Bell, FileText, ShoppingCart, Truck, Search, CheckCircle2, RefreshCw,
  Download, AlertCircle, BookOpen,
} from 'lucide-react';
import { api, downloadText } from './lib/api.js';
import { buildVentas141, buildCompras81, summarize } from './lib/ple.js';
import { buildRvie, buildRce } from './lib/sire.js';
import {
  empresa, notificaciones, comprobantesVenta, comprobantesCompra,
} from './lib/sampleData.js';

const TABS = [
  { id: 'buzon', label: 'Buzón SUNAT / SUNAFIL', icon: Bell },
  { id: 'compras', label: 'Registro de Compras', icon: ShoppingCart },
  { id: 'facturas', label: 'Facturación & Boletas', icon: FileText },
  { id: 'guias', label: 'Guías de Remisión', icon: Truck },
  { id: 'libros', label: 'Libros Electrónicos', icon: BookOpen },
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
    RECHAZADO: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[estado] ?? 'bg-slate-600 text-slate-300'}`}>
      {estado}
    </span>
  );
}

function ComprobantesTable({ documentos, titulo, onDownload, busy, contraparte }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
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
            <tr key={d.id} className="hover:bg-slate-700/50">
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

function LibrosPanel() {
  const [periodo, setPeriodo] = useState('2026-11');
  const [mensaje, setMensaje] = useState(null);

  const resumenVentas = useMemo(() => summarize(comprobantesVenta, 'ventas'), []);
  const resumenCompras = useMemo(() => summarize(comprobantesCompra, 'compras'), []);

  // Cada libro se ofrece en los dos formatos: PLE (histórico) y SIRE (vigente).
  const FORMATOS = {
    ple: {
      etiqueta: 'PLE',
      detalle: 'Histórico (RS 112-2021)',
      ventas: (rows) => buildVentas141(rows, { ruc: empresa.ruc, periodo }),
      compras: (rows) => buildCompras81(rows, { ruc: empresa.ruc, periodo }),
    },
    sire: {
      etiqueta: 'SIRE',
      detalle: 'Vigente (Anexos 3 y 11)',
      ventas: (rows) => buildRvie(rows.map((r) => ({ ...r, periodo })), { ruc: empresa.ruc, razon_social: empresa.razon_social }),
      compras: (rows) => buildRce(rows.map((r) => ({ ...r, periodo })), { ruc: empresa.ruc, razon_social: empresa.razon_social }),
    },
  };

  function generar(tipo, formato) {
    const rows = tipo === 'ventas' ? comprobantesVenta : comprobantesCompra;
    const built = FORMATOS[formato][tipo](rows);
    downloadText(built.filename, built.content);
    setMensaje(`Generado ${built.filename} · formato ${FORMATOS[formato].etiqueta} (${rows.length} registros).`);
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
          Separador <code>|</code>, codificación latin-1.
        </p>
      </div>

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
              <p className="text-xs text-slate-400">{c.resumen.registros} registros</p>
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
                  title={f.detalle}
                  className="flex items-center justify-center gap-2 bg-blue-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-500"
                >
                  <Download size={15} /> {f.etiqueta}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('buzon');
  const [busy, setBusy] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState('');

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

  const guiasFiltradas = comprobantesVenta.filter((d) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return `${d.serie}-${d.numero}`.toLowerCase().includes(q)
      || (d.cliente?.razon_social ?? '').toLowerCase().includes(q);
  });

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
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
            Sistema Conectado
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
                documentos={comprobantesCompra}
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
                documentos={comprobantesVenta}
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
                documentos={guiasFiltradas}
                contraparte="Cliente"
                onDownload={handleDownload}
                busy={busy}
              />
            </div>
          )}

          {activeTab === 'libros' && <LibrosPanel />}
        </div>
      </main>
    </div>
  );
}
