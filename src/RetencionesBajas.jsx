import { useEffect, useState } from 'react';
import {
  Receipt, Ban, Plus, Trash2, Send, Download, Loader2, AlertCircle,
  CheckCircle2, RefreshCw,
} from 'lucide-react';
import { api } from './lib/api.js';

const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';
const label = 'block text-xs text-slate-400 mb-1';

const hoy = () => new Date().toISOString().slice(0, 10);
const money = (v) => `S/ ${Number(v ?? 0).toFixed(2)}`;

const ESTADO_COLOR = {
  PENDIENTE: 'text-amber-400',
  ENVIADO: 'text-blue-400',
  PROCESANDO: 'text-blue-400',
  ACEPTADO: 'text-emerald-400',
  RECHAZADO: 'text-red-400',
  ERROR: 'text-red-400',
};

const REGIMENES = [
  { code: '01', name: 'Tasa 3%' },
  { code: '02', name: 'Tasa 6%' },
  { code: '03', name: 'Tasa 10%' },
];

const TIPOS_DOC_ANULAR = [
  { code: '01', name: 'Factura' },
  { code: '03', name: 'Boleta' },
  { code: '07', name: 'Nota de crédito' },
  { code: '08', name: 'Nota de débito' },
];

const detalleVacio = (tasa) => ({
  tipo_doc: '01', num_doc: '', fecha_emision: hoy(), fecha_retencion: hoy(),
  moneda: 'PEN', imp_total: 0, imp_pagar: 0, imp_retenido: 0, tasa,
});

const SUBTABS = [
  { id: 'retenciones', label: 'Retenciones', icon: Receipt },
  { id: 'anulaciones', label: 'Anulaciones', icon: Ban },
];

/**
 * Retenciones (tipo 20) y comunicación de baja (anulación de comprobantes).
 *
 * Retención: se declara el proveedor y los comprobantes retenidos; el importe
 * retenido se calcula con la tasa del régimen. Anulación: se eligen documentos
 * ACEPTADOS de una fecha (máx. 7 días), se arma el resumen RA y se consulta el
 * ticket hasta el CDR.
 */
export default function RetencionesBajas({ conectado }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [branchId, setBranchId] = useState(null);

  const [sub, setSub] = useState('retenciones');
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [accion, setAccion] = useState(null);

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
      setBranchId(suc[0]?.id ?? null);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Retenciones y anulaciones</h3>
        <p className="text-sm text-slate-400 mt-1">
          Emite comprobantes de retención y comunica la baja de comprobantes aceptados.
        </p>
      </div>

      {!conectado && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> Conecta la API (pestaña Conexión) para operar.
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <label className={label}>Empresa</label>
          <select className={input} value={empresaId ?? ''} onChange={(e) => cambiarEmpresa(Number(e.target.value))} disabled={!conectado}>
            <option value="">—</option>
            {empresas.map((c) => <option key={c.id} value={c.id}>{c.razon_social ?? c.nombre ?? c.id}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Sucursal</label>
          <select className={input} value={branchId ?? ''} onChange={(e) => setBranchId(Number(e.target.value))} disabled={!conectado || !sucursales.length}>
            {sucursales.length === 0 && <option value="">Sin sucursales</option>}
            {sucursales.map((b) => <option key={b.id} value={b.id}>{b.nombre ?? b.direccion ?? `Sucursal ${b.id}`}</option>)}
          </select>
        </div>
      </div>

      {(error || mensaje) && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2 border ${error ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
          {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {error || mensaje}
        </div>
      )}

      <div className="flex gap-2">
        {SUBTABS.map(({ id, label: etiqueta, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setSub(id); setError(null); setMensaje(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${sub === id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <Icon size={16} /> {etiqueta}
          </button>
        ))}
      </div>

      {sub === 'retenciones'
        ? <Retenciones conectado={conectado} empresaId={empresaId} branchId={branchId} setError={setError} setMensaje={setMensaje} accion={accion} setAccion={setAccion} />
        : <Anulaciones conectado={conectado} empresaId={empresaId} branchId={branchId} setError={setError} setMensaje={setMensaje} accion={accion} setAccion={setAccion} />}
    </div>
  );
}

function Retenciones({ conectado, empresaId, branchId, setError, setMensaje, accion, setAccion }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(formInicial());

  function formInicial() {
    return {
      serie: 'R001', fecha_emision: hoy(), moneda: 'PEN', regimen: '01', tasa: 3,
      observacion: '', proveedorTipoDoc: '6', proveedorNumDoc: '', proveedorRazonSocial: '',
      detalles: [detalleVacio(3)],
    };
  }

  const setCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  async function cargar() {
    if (!conectado || !empresaId) { setLista([]); return; }
    setCargando(true);
    setError(null);
    try {
      setLista(await api.listRetenciones({ companyId: empresaId, branchId }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [empresaId, branchId, conectado]);

  function recalcular(detalles, tasa) {
    return detalles.map((d) => {
      const total = Number(d.imp_total) || 0;
      const retenido = Number(((total * tasa) / 100).toFixed(2));
      return { ...d, imp_retenido: retenido, imp_pagar: Number((total - retenido).toFixed(2)) };
    });
  }

  function setTasa(tasa) {
    setForm((f) => ({ ...f, tasa, detalles: recalcular(f.detalles, tasa) }));
  }

  function setItem(indice, campo, valor) {
    setForm((f) => {
      let detalles = f.detalles.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d));
      if (campo === 'imp_total') detalles = recalcular(detalles, f.tasa);
      return { ...f, detalles };
    });
  }

  const agregarItem = () => setForm((f) => ({ ...f, detalles: [...f.detalles, detalleVacio(f.tasa)] }));
  const quitarItem = (i) => setForm((f) => ({ ...f, detalles: f.detalles.filter((_, idx) => idx !== i) }));

  const totalRetenido = form.detalles.reduce((a, d) => a + (Number(d.imp_retenido) || 0), 0);
  const totalPagado = form.detalles.reduce((a, d) => a + (Number(d.imp_pagar) || 0), 0);

  async function emitir(event) {
    event.preventDefault();
    if (!empresaId || !branchId) { setError('Selecciona empresa y sucursal.'); return; }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const payload = {
        company_id: empresaId,
        branch_id: branchId,
        serie: form.serie,
        fecha_emision: form.fecha_emision,
        moneda: form.moneda,
        regimen: form.regimen,
        tasa: Number(form.tasa),
        observacion: form.observacion,
        imp_retenido: totalRetenido,
        imp_pagado: totalPagado,
        proveedor: {
          tipo_documento: form.proveedorTipoDoc,
          numero_documento: form.proveedorNumDoc,
          razon_social: form.proveedorRazonSocial,
        },
        detalles: form.detalles.map((d) => ({
          tipo_doc: d.tipo_doc,
          num_doc: d.num_doc,
          fecha_emision: d.fecha_emision,
          fecha_retencion: d.fecha_retencion,
          moneda: d.moneda,
          imp_total: Number(d.imp_total),
          imp_pagar: Number(d.imp_pagar),
          imp_retenido: Number(d.imp_retenido),
          pagos: [{ moneda: d.moneda, fecha: d.fecha_retencion, importe: Number(d.imp_pagar) }],
          tipo_cambio: { fecha: d.fecha_emision, factor: 1, moneda_obj: d.moneda, moneda_ref: d.moneda },
        })),
      };
      const doc = await api.crearRetencion(payload);
      setMensaje(`Retención ${doc?.numero_completo ?? ''} creada (estado ${doc?.estado_sunat ?? 'PENDIENTE'}).`);
      setForm(formInicial());
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function enviar(doc) {
    setAccion(`enviar-${doc.id}`);
    setError(null);
    try {
      await api.enviarSunat('retentions', doc.id);
      setMensaje(`Retención ${doc.numero_completo ?? doc.id} enviada a SUNAT.`);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  async function descargar(doc, format) {
    setAccion(`desc-${doc.id}-${format}`);
    setError(null);
    try {
      await api.descargarDocumento('retentions', doc.id, format);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={emitir} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <h4 className="font-semibold flex items-center gap-2"><Receipt size={18} className="text-blue-400" /> Nueva retención</h4>

        <div className="grid gap-2 md:grid-cols-4">
          <div><label className={label}>Serie</label><input className={input} value={form.serie} onChange={(e) => setCampo('serie', e.target.value)} /></div>
          <div><label className={label}>Fecha emisión</label><input type="date" className={input} value={form.fecha_emision} onChange={(e) => setCampo('fecha_emision', e.target.value)} /></div>
          <div>
            <label className={label}>Régimen</label>
            <select className={input} value={form.regimen} onChange={(e) => { const r = REGIMENES.find((x) => x.code === e.target.value); setCampo('regimen', e.target.value); setTasa(r ? Number(r.name.match(/\d+/)[0]) : form.tasa); }}>
              {REGIMENES.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </div>
          <div><label className={label}>Tasa (%)</label><input type="number" step="0.01" className={input} value={form.tasa} onChange={(e) => setTasa(e.target.value)} /></div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <label className={label}>Tipo doc. proveedor</label>
            <select className={input} value={form.proveedorTipoDoc} onChange={(e) => setCampo('proveedorTipoDoc', e.target.value)}>
              <option value="6">RUC</option>
              <option value="1">DNI</option>
              <option value="4">Carné extranjería</option>
            </select>
          </div>
          <div><label className={label}>Número</label><input className={input} value={form.proveedorNumDoc} onChange={(e) => setCampo('proveedorNumDoc', e.target.value)} /></div>
          <div><label className={label}>Razón social</label><input className={input} value={form.proveedorRazonSocial} onChange={(e) => setCampo('proveedorRazonSocial', e.target.value)} /></div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Comprobantes retenidos</span>
            <button type="button" onClick={agregarItem} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"><Plus size={14} /> Añadir</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr className="text-left border-b border-slate-700">
                  <th className="py-1 pr-2">Tipo</th>
                  <th className="py-1 pr-2">Número</th>
                  <th className="py-1 pr-2">Emisión</th>
                  <th className="py-1 pr-2 text-right">Total</th>
                  <th className="py-1 pr-2 text-right">Retenido</th>
                  <th className="py-1 pr-2 text-right">A pagar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.detalles.map((d, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="py-1 pr-2">
                      <select className={input} value={d.tipo_doc} onChange={(e) => setItem(i, 'tipo_doc', e.target.value)}>
                        <option value="01">Factura</option>
                        <option value="03">Boleta</option>
                        <option value="12">Ticket</option>
                        <option value="14">Recibo servicios</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2"><input className={input} value={d.num_doc} onChange={(e) => setItem(i, 'num_doc', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input type="date" className={input} value={d.fecha_emision} onChange={(e) => setItem(i, 'fecha_emision', e.target.value)} /></td>
                    <td className="py-1 pr-2"><input type="number" step="0.01" className={input} value={d.imp_total} onChange={(e) => setItem(i, 'imp_total', e.target.value)} /></td>
                    <td className="py-1 pr-2 text-right text-slate-300">{money(d.imp_retenido)}</td>
                    <td className="py-1 pr-2 text-right text-slate-300">{money(d.imp_pagar)}</td>
                    <td className="py-1 pr-2 text-right">
                      <button type="button" onClick={() => quitarItem(i)} disabled={form.detalles.length === 1} className="p-1 text-red-400 hover:text-red-300 disabled:opacity-30"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="text-sm text-slate-300">
            Retenido: <span className="font-medium text-white">{money(totalRetenido)}</span>
            <span className="mx-2 text-slate-600">|</span>
            A pagar: <span className="font-medium text-white">{money(totalPagado)}</span>
          </div>
          <button type="submit" disabled={!conectado || guardando} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />} Emitir retención
          </button>
        </div>
      </form>

      <ListaDocumentos
        titulo="Retenciones emitidas"
        documentos={lista}
        cargando={cargando}
        onRefrescar={cargar}
        accion={accion}
        enviar={enviar}
        descargar={descargar}
        numero={(r) => r.numero_completo}
        extra={(r) => `Retenido ${money(r.imp_retenido)}`}
      />
    </div>
  );
}

function Anulaciones({ conectado, empresaId, branchId, setError, setMensaje, accion, setAccion }) {
  const [fecha, setFecha] = useState(hoy());
  const [candidatos, setCandidatos] = useState([]);
  const [seleccion, setSeleccion] = useState({});
  const [motivoBaja, setMotivoBaja] = useState('ERROR EN LA EMISION');
  const [motivosEspecificos, setMotivosEspecificos] = useState({});
  const [bajas, setBajas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function cargarCandidatos(f = fecha) {
    if (!conectado || !empresaId || !branchId) { setCandidatos([]); return; }
    setCargando(true);
    setError(null);
    try {
      const { items } = await api.documentosAnulables({ companyId: empresaId, branchId, fechaReferencia: f });
      setCandidatos(items);
      setSeleccion({});
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function cargarBajas() {
    if (!conectado || !empresaId) { setBajas([]); return; }
    try {
      setBajas(await api.listBajas({ companyId: empresaId, branchId }));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { cargarCandidatos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [empresaId, branchId, conectado]);
  useEffect(() => { cargarBajas(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [empresaId, branchId, conectado]);

  const toggle = (doc) => setSeleccion((s) => ({ ...s, [`${doc.tipo_documento}-${doc.serie}-${doc.correlativo}`]: !s[`${doc.tipo_documento}-${doc.serie}-${doc.correlativo}`] }));
  const seleccionados = candidatos.filter((d) => seleccion[`${d.tipo_documento}-${d.serie}-${d.correlativo}`]);

  async function comunicar(event) {
    event.preventDefault();
    if (!empresaId || !branchId) { setError('Selecciona empresa y sucursal.'); return; }
    if (seleccionados.length === 0) { setError('Selecciona al menos un comprobante.'); return; }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const payload = {
        company_id: empresaId,
        branch_id: branchId,
        fecha_referencia: fecha,
        motivo_baja: motivoBaja,
        detalles: seleccionados.map((d) => ({
          tipo_documento: d.tipo_documento,
          serie: d.serie,
          correlativo: d.correlativo,
          motivo_especifico: motivosEspecificos[`${d.tipo_documento}-${d.serie}-${d.correlativo}`] || 'ANULACION DE LA OPERACION',
        })),
      };
      const doc = await api.crearBaja(payload);
      setMensaje(`Comunicación de baja ${doc?.numero_completo ?? ''} creada.`);
      setSeleccion({});
      await cargarBajas();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function enviar(doc) {
    setAccion(`enviar-${doc.id}`);
    setError(null);
    try {
      const r = await api.enviarSunat('voided-documents', doc.id);
      setMensaje(r?.ticket ? `Baja enviada. Ticket: ${r.ticket}` : 'Baja enviada a SUNAT.');
      await cargarBajas();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  async function consultar(doc) {
    setAccion(`estado-${doc.id}`);
    setError(null);
    try {
      const r = await api.consultarEstadoBaja(doc.id);
      setMensaje(`Estado de la baja: ${r?.estado_sunat ?? 'desconocido'}.`);
      await cargarBajas();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  async function descargar(doc, format) {
    setAccion(`desc-${doc.id}-${format}`);
    setError(null);
    try {
      await api.descargarDocumento('voided-documents', doc.id, format);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={comunicar} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h4 className="font-semibold flex items-center gap-2"><Ban size={18} className="text-blue-400" /> Comunicar baja</h4>
          <div className="flex items-end gap-2">
            <div>
              <label className={label}>Fecha de referencia</label>
              <input type="date" className={input} value={fecha} onChange={(e) => { setFecha(e.target.value); cargarCandidatos(e.target.value); }} />
            </div>
            <button type="button" onClick={() => cargarCandidatos()} disabled={!conectado || cargando} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-3 py-2 rounded-lg text-sm">
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Buscar
            </button>
          </div>
        </div>

        <div>
          <label className={label}>Motivo de baja</label>
          <input className={input} value={motivoBaja} onChange={(e) => setMotivoBaja(e.target.value)} />
        </div>

        {candidatos.length === 0 ? (
          <p className="text-sm text-slate-400">No hay comprobantes aceptados para la fecha seleccionada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr className="text-left border-b border-slate-700">
                  <th className="py-1 pr-2" />
                  <th className="py-1 pr-2">Tipo</th>
                  <th className="py-1 pr-2">Número</th>
                  <th className="py-1 pr-2 text-right">Monto</th>
                  <th className="py-1 pr-2">Motivo específico</th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((d) => {
                  const key = `${d.tipo_documento}-${d.serie}-${d.correlativo}`;
                  return (
                    <tr key={key} className="border-b border-slate-800">
                      <td className="py-1 pr-2"><input type="checkbox" checked={!!seleccion[key]} onChange={() => toggle(d)} /></td>
                      <td className="py-1 pr-2">{d.tipo_nombre}</td>
                      <td className="py-1 pr-2">{d.numero_completo}</td>
                      <td className="py-1 pr-2 text-right">{money(d.monto)}</td>
                      <td className="py-1 pr-2">
                        <input
                          className={input}
                          placeholder="ANULACION DE LA OPERACION"
                          value={motivosEspecificos[key] ?? ''}
                          onChange={(e) => setMotivosEspecificos((m) => ({ ...m, [key]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={!conectado || guardando || seleccionados.length === 0} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />} Comunicar baja ({seleccionados.length})
          </button>
        </div>
      </form>

      <ListaDocumentos
        titulo="Comunicaciones de baja"
        documentos={bajas}
        cargando={false}
        onRefrescar={cargarBajas}
        accion={accion}
        enviar={enviar}
        consultar={consultar}
        descargar={descargar}
        numero={(b) => b.numero_completo}
        extra={(b) => `${b.total_documentos} documento(s)`}
      />
    </div>
  );
}

function ListaDocumentos({ titulo, documentos, cargando, onRefrescar, accion, enviar, consultar, descargar, numero, extra }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">{titulo}</h4>
        <button onClick={onRefrescar} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          {cargando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refrescar
        </button>
      </div>
      {documentos.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay registros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-xs uppercase">
              <tr className="text-left border-b border-slate-700">
                <th className="py-2 pr-3">Número</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Detalle</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-800">
                  <td className="py-2 pr-3">{numero(doc)}</td>
                  <td className="py-2 pr-3">{doc.fecha_emision?.slice(0, 10)}</td>
                  <td className="py-2 pr-3 text-slate-400">{extra(doc)}</td>
                  <td className={`py-2 pr-3 ${ESTADO_COLOR[doc.estado_sunat] ?? 'text-slate-300'}`}>{doc.estado_sunat}</td>
                  <td className="py-2 pr-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => enviar(doc)} disabled={accion !== null || doc.estado_sunat === 'ACEPTADO'} className="p-2 text-blue-400 hover:text-blue-300 disabled:opacity-30" title="Enviar a SUNAT">
                        {accion === `enviar-${doc.id}` ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                      {consultar && (
                        <button onClick={() => consultar(doc)} disabled={accion !== null || !doc.ticket} className="p-2 text-emerald-400 hover:text-emerald-300 disabled:opacity-30" title="Consultar estado">
                          {accion === `estado-${doc.id}` ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        </button>
                      )}
                      <button onClick={() => descargar(doc, 'xml')} disabled={accion !== null} className="p-2 text-slate-400 hover:text-slate-300 disabled:opacity-30" title="Descargar XML"><Download size={16} /></button>
                      <button onClick={() => descargar(doc, 'cdr')} disabled={accion !== null} className="p-2 text-slate-400 hover:text-slate-300 disabled:opacity-30" title="Descargar CDR"><Download size={16} /></button>
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
