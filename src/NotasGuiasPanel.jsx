import { useEffect, useState } from 'react';
import {
  FileMinus, FilePlus, Truck, Plus, Trash2, Send, Download, Loader2,
  AlertCircle, CheckCircle2, Building2, Link2,
} from 'lucide-react';
import { api } from './lib/api.js';

const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';
const label = 'block text-xs text-slate-400 mb-1';

const hoy = () => new Date().toISOString().slice(0, 10);

const UNIDADES = ['NIU', 'KGM', 'ZZ', 'LTR', 'MTR', 'BLL', 'CJ', 'SET'];
const AFECTACIONES = [
  { code: '10', name: 'Gravado - Operación Onerosa' },
  { code: '20', name: 'Exonerado - Operación Onerosa' },
  { code: '30', name: 'Inafecto - Operación Onerosa' },
  { code: '40', name: 'Exportación de bienes o servicios' },
];

const SUBTIPOS = [
  { id: 'nota-credito', label: 'Notas de crédito', icon: FileMinus, recurso: 'credit-notes' },
  { id: 'nota-debito', label: 'Notas de débito', icon: FilePlus, recurso: 'debit-notes' },
  { id: 'guia', label: 'Guías de remisión', icon: Truck, recurso: 'dispatch-guides' },
];

const itemVacio = () => ({ codigo: '', descripcion: '', unidad: 'NIU', cantidad: 1, mto_valor_unitario: 0, tip_afe_igv: '10', peso_total: '' });

const esGuia = (sub) => sub === 'guia';

/**
 * Emisión de notas de crédito/débito y guías de remisión.
 *
 * El camino queda armado para cuando el usuario configure sus series: la serie
 * se escribe a mano y el correlativo lo asigna el backend por sucursal. Tras
 * emitir se puede enviar a SUNAT y descargar XML/CDR/PDF desde el listado.
 */
export default function NotasGuiasPanel({ conectado }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [branchId, setBranchId] = useState(null);
  const [clientes, setClientes] = useState([]);

  const [sub, setSub] = useState('nota-credito');
  const [motivos, setMotivos] = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [facturasCliente, setFacturasCliente] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [accion, setAccion] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const [form, setForm] = useState(formInicial('nota-credito'));

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

  useEffect(() => {
    if (!conectado) return;
    cargarCatalogos(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, conectado]);

  function formInicial(subId) {
    if (esGuia(subId)) {
      return {
        serie: 'T001', fecha_emision: hoy(), destinatario_id: '',
        cod_traslado: '01', mod_traslado: '01', fecha_traslado: hoy(),
        peso_total: 1, und_peso_total: 'KGM', num_bultos: 1,
        partida_ubigeo: '', partida_direccion: '', llegada_ubigeo: '', llegada_direccion: '',
        conductor_nombres: '', conductor_apellidos: '', conductor_tipo_doc: '1',
        conductor_num_doc: '', conductor_licencia: '', vehiculo_placa: '',
        transportista_tipo_doc: '6', transportista_num_doc: '', transportista_razon_social: '', transportista_nro_mtc: '',
        observaciones: '',
        factura_vinculada: '',
        documentos_relacionados: [],
        detalles: [itemVacio()],
      };
    }
    return {
      serie: subId === 'nota-credito' ? 'FC01' : 'FD01',
      fecha_emision: hoy(), moneda: 'PEN',
      tipo_doc_afectado: '01', num_doc_afectado: '', cod_motivo: '', des_motivo: '',
      clienteTipoDoc: '6', clienteNumDoc: '', clienteRazonSocial: '',
      detalles: [itemVacio()],
    };
  }

  async function cargarCatalogos(subId) {
    setMotivos([]);
    setModalidades([]);
    try {
      if (subId === 'nota-credito') setMotivos(await api.motivosNotaCredito());
      else if (subId === 'nota-debito') setMotivos(await api.motivosNotaDebito());
      else {
        const [m, mo] = await Promise.all([api.motivosTrasladoGuia(), api.modalidadesTrasladoGuia()]);
        setMotivos(m);
        setModalidades(mo);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarEmpresa(id) {
    setEmpresaId(id);
    setMensaje(null);
    try {
      const [suc, cli] = await Promise.all([api.listBranches(id), api.listClients(id)]);
      setSucursales(suc);
      setClientes(cli);
      setBranchId(suc[0]?.id ?? null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function cargarDocumentos() {
    if (!conectado || !empresaId) {
      setDocumentos([]);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const fn = sub === 'nota-credito' ? api.listNotasCredito
        : sub === 'nota-debito' ? api.listNotasDebito
          : api.listGuias;
      setDocumentos(await fn({ companyId: empresaId, branchId }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDocumentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, empresaId, branchId]);

  function cambiarSub(id) {
    setSub(id);
    setForm(formInicial(id));
    setMensaje(null);
    setError(null);
  }

  const setCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  function setItem(indice, campo, valor) {
    setForm((f) => {
      const detalles = f.detalles.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d));
      return { ...f, detalles };
    });
  }

  const agregarItem = () => setForm((f) => ({ ...f, detalles: [...f.detalles, itemVacio()] }));
  const quitarItem = (indice) => setForm((f) => ({ ...f, detalles: f.detalles.filter((_, i) => i !== indice) }));

  // Guías por traslado de compra: se busca la factura del cliente por su RUC y
  // se transcriben sus ítems a la guía.
  async function buscarFacturasCliente(numeroDocumento) {
    if (!numeroDocumento) {
      setFacturasCliente([]);
      return;
    }
    try {
      const facturas = await api.listFacturasCliente({ companyId: empresaId, numeroDocumento });
      setFacturasCliente(facturas);
    } catch (e) {
      setError(e.message);
    }
  }

  function vincularFactura(numeroCompleto) {
    if (!numeroCompleto) {
      setForm((f) => ({ ...f, factura_vinculada: '', documentos_relacionados: [] }));
      return;
    }
    const factura = facturasCliente.find((x) => x.numero_completo === numeroCompleto);
    setForm((f) => {
      const detalles = factura?.detalles?.length
        ? factura.detalles.map((d) => ({
            codigo: d.codigo ?? '',
            descripcion: d.descripcion ?? '',
            unidad: d.unidad ?? 'NIU',
            cantidad: d.cantidad ?? 1,
            peso_total: d.peso_total ?? '',
          }))
        : f.detalles;
      return {
        ...f,
        factura_vinculada: numeroCompleto,
        documentos_relacionados: factura
          ? [{ tipo: '01', tipo_desc: 'FACTURA', numero: factura.numero_completo }]
          : [],
        observaciones: f.observaciones || `Traslado por compra según factura ${numeroCompleto}`,
        detalles,
      };
    });
  }

  function cambiarDestinatario(valor) {
    setForm((f) => ({ ...f, destinatario_id: valor, factura_vinculada: '', documentos_relacionados: [] }));
    setFacturasCliente([]);
    const cliente = clientes.find((c) => String(c.id) === String(valor));
    if (cliente?.numero_documento) buscarFacturasCliente(cliente.numero_documento);
  }

  function construirPayload() {
    if (esGuia(sub)) {
      return {
        company_id: empresaId,
        branch_id: branchId,
        destinatario_id: Number(form.destinatario_id),
        serie: form.serie,
        fecha_emision: form.fecha_emision,
        cod_traslado: form.cod_traslado,
        mod_traslado: form.mod_traslado,
        fecha_traslado: form.fecha_traslado,
        peso_total: Number(form.peso_total),
        und_peso_total: form.und_peso_total,
        num_bultos: Number(form.num_bultos),
        partida: { ubigeo: form.partida_ubigeo, direccion: form.partida_direccion },
        llegada: { ubigeo: form.llegada_ubigeo, direccion: form.llegada_direccion },
        conductor_tipo: 'Principal',
        conductor_tipo_doc: form.conductor_tipo_doc,
        conductor_num_doc: form.conductor_num_doc,
        conductor_licencia: form.conductor_licencia,
        conductor_nombres: form.conductor_nombres,
        conductor_apellidos: form.conductor_apellidos,
        vehiculo_placa: form.vehiculo_placa,
        transportista_tipo_doc: form.transportista_tipo_doc,
        transportista_num_doc: form.transportista_num_doc,
        transportista_razon_social: form.transportista_razon_social,
        transportista_nro_mtc: form.transportista_nro_mtc,
        observaciones: form.observaciones,
        documentos_relacionados: form.documentos_relacionados ?? [],
        detalles: form.detalles.map((d) => ({
          codigo: d.codigo, descripcion: d.descripcion, unidad: d.unidad, cantidad: Number(d.cantidad),
          peso_total: d.peso_total === '' || d.peso_total == null ? undefined : Number(d.peso_total),
        })),
      };
    }

    return {
      company_id: empresaId,
      branch_id: branchId,
      serie: form.serie,
      fecha_emision: form.fecha_emision,
      moneda: form.moneda,
      tipo_doc_afectado: form.tipo_doc_afectado,
      num_doc_afectado: form.num_doc_afectado,
      cod_motivo: form.cod_motivo,
      des_motivo: form.des_motivo,
      client: {
        tipo_documento: form.clienteTipoDoc,
        numero_documento: form.clienteNumDoc,
        razon_social: form.clienteRazonSocial,
      },
      detalles: form.detalles.map((d) => ({
        codigo: d.codigo,
        descripcion: d.descripcion,
        unidad: d.unidad,
        cantidad: Number(d.cantidad),
        mto_valor_unitario: Number(d.mto_valor_unitario),
        tip_afe_igv: d.tip_afe_igv,
      })),
    };
  }

  async function emitir(event) {
    event.preventDefault();
    if (!empresaId || !branchId) {
      setError('Selecciona empresa y sucursal.');
      return;
    }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const payload = construirPayload();
      const fn = sub === 'nota-credito' ? api.crearNotaCredito : sub === 'nota-debito' ? api.crearNotaDebito : api.crearGuia;
      const doc = await fn(payload);
      if (doc?.success === false) throw new Error(doc.message || 'No se pudo emitir el documento');
      setMensaje(`Documento ${doc?.numero_completo ?? ''} emitido (estado ${doc?.estado_sunat ?? 'PENDIENTE'}).`);
      setForm(formInicial(sub));
      await cargarDocumentos();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function enviar(doc) {
    setAccion(`${doc.id}-enviar`);
    setError(null);
    try {
      const recurso = SUBTIPOS.find((s) => s.id === sub).recurso;
      await api.enviarSunat(recurso, doc.id);
      setMensaje(`Documento ${doc.numero_completo ?? doc.id} enviado a SUNAT.`);
      await cargarDocumentos();
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  async function descargar(doc, format) {
    setAccion(`${doc.id}-${format}`);
    setError(null);
    try {
      const recurso = SUBTIPOS.find((s) => s.id === sub).recurso;
      await api.descargarDocumento(recurso, doc.id, format);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccion(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Notas y guías</h3>
        <p className="text-sm text-slate-400 mt-1">
          Emite notas de crédito/débito y guías de remisión. El correlativo lo asigna el
          backend por sucursal; la serie se configura en la pestaña Series.
        </p>
      </div>

      {!conectado && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> Conecta la API (pestaña Conexión) para emitir.
        </div>
      )}

      <div className="flex gap-2">
        {SUBTIPOS.map(({ id, label: texto, icon: Icon }) => (
          <button
            key={id}
            onClick={() => cambiarSub(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${sub === id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <Icon size={16} /> {texto}
          </button>
        ))}
      </div>

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

      <form onSubmit={emitir} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Building2 size={18} className="text-blue-400" /> Nuevo documento
        </h4>

        {esGuia(sub) ? (
          <CamposGuia
            form={form}
            setCampo={setCampo}
            motivos={motivos}
            modalidades={modalidades}
            clientes={clientes}
            facturas={facturasCliente}
            onDestinatario={cambiarDestinatario}
            onVincularFactura={vincularFactura}
          />
        )
          : <CamposNota form={form} setCampo={setCampo} motivos={motivos} sub={sub} />}

        <DetallesTabla form={form} setItem={setItem} agregarItem={agregarItem} quitarItem={quitarItem} guia={esGuia(sub)} />

        <button
          type="submit"
          disabled={!conectado || guardando || !empresaId || !branchId}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {guardando ? 'Emitiendo…' : 'Emitir'}
        </button>
      </form>

      <div className="space-y-3">
        <h4 className="font-semibold">Emitidos</h4>
        {cargando && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Cargando…</div>}
        {!cargando && documentos.length === 0 && <p className="text-sm text-slate-500">No hay documentos emitidos.</p>}
        {documentos.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/40 text-xs uppercase text-slate-400">
                <tr>
                  <th className="p-3">Número</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Estado SUNAT</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {documentos.map((d) => (
                  <tr key={d.id}>
                    <td className="p-3 font-mono text-blue-400">{d.numero_completo ?? `${d.serie}-${d.correlativo}`}</td>
                    <td className="p-3">{String(d.fecha_emision).slice(0, 10)}</td>
                    <td className="p-3">{d.estado_sunat ?? 'PENDIENTE'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => enviar(d)} disabled={accion === `${d.id}-enviar`} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-2 py-1 rounded">
                          {accion === `${d.id}-enviar` ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} SUNAT
                        </button>
                        {['xml', 'cdr', 'pdf'].map((f) => (
                          <button key={f} onClick={() => descargar(d, f)} disabled={accion === `${d.id}-${f}`} className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-2 py-1 rounded">
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
    </div>
  );
}

function CamposNota({ form, setCampo, motivos, sub }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className={label}>Serie</label>
        <input className={input} value={form.serie} onChange={(e) => setCampo('serie', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Fecha de emisión</label>
        <input type="date" className={input} value={form.fecha_emision} onChange={(e) => setCampo('fecha_emision', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Tipo doc. afectado</label>
        <select className={input} value={form.tipo_doc_afectado} onChange={(e) => setCampo('tipo_doc_afectado', e.target.value)}>
          <option value="01">Factura</option>
          {sub === 'nota-credito' && <option value="03">Boleta</option>}
        </select>
      </div>
      <div>
        <label className={label}>N° doc. afectado</label>
        <input className={input} placeholder="F001-00000123" value={form.num_doc_afectado} onChange={(e) => setCampo('num_doc_afectado', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Motivo (catálogo)</label>
        <select className={input} value={form.cod_motivo} onChange={(e) => setCampo('cod_motivo', e.target.value)} required>
          <option value="">Selecciona…</option>
          {motivos.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Descripción del motivo</label>
        <input className={input} value={form.des_motivo} onChange={(e) => setCampo('des_motivo', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Moneda</label>
        <select className={input} value={form.moneda} onChange={(e) => setCampo('moneda', e.target.value)}>
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div>
        <label className={label}>Doc. cliente</label>
        <select className={input} value={form.clienteTipoDoc} onChange={(e) => setCampo('clienteTipoDoc', e.target.value)}>
          <option value="6">RUC</option>
          <option value="1">DNI</option>
        </select>
      </div>
      <div>
        <label className={label}>N° documento cliente</label>
        <input className={input} value={form.clienteNumDoc} onChange={(e) => setCampo('clienteNumDoc', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Razón social cliente</label>
        <input className={input} value={form.clienteRazonSocial} onChange={(e) => setCampo('clienteRazonSocial', e.target.value)} required />
      </div>
    </div>
  );
}

function CamposGuia({ form, setCampo, motivos, modalidades, clientes, facturas, onDestinatario, onVincularFactura }) {
  const trasladoPorCompra = form.cod_traslado === '02';
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className={label}>Destinatario</label>
        <select className={input} value={form.destinatario_id} onChange={(e) => onDestinatario(e.target.value)} required>
          <option value="">Selecciona…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.razon_social} · {c.numero_documento}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Serie</label>
        <input className={input} value={form.serie} onChange={(e) => setCampo('serie', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Fecha de emisión</label>
        <input type="date" className={input} value={form.fecha_emision} onChange={(e) => setCampo('fecha_emision', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Fecha de traslado</label>
        <input type="date" className={input} value={form.fecha_traslado} onChange={(e) => setCampo('fecha_traslado', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Motivo de traslado</label>
        <select className={input} value={form.cod_traslado} onChange={(e) => setCampo('cod_traslado', e.target.value)} required>
          {motivos.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Modalidad</label>
        <select className={input} value={form.mod_traslado} onChange={(e) => setCampo('mod_traslado', e.target.value)}>
          {modalidades.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
        </select>
      </div>
      {trasladoPorCompra && (
        <div className="md:col-span-2 bg-slate-900/30 border border-slate-700 rounded-lg p-3">
          <label className={`${label} flex items-center gap-1`}>
            <Link2 size={13} /> Factura vinculada (traslado por compra)
          </label>
          <select
            className={input}
            value={form.factura_vinculada ?? ''}
            onChange={(e) => onVincularFactura(e.target.value)}
          >
            <option value="">Sin factura vinculada</option>
            {facturas.map((f) => (
              <option key={f.id} value={f.numero_completo}>
                {f.numero_completo} · {String(f.fecha_emision).slice(0, 10)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Elige el destinatario para ver sus facturas. Al vincular una factura se
            transcriben sus ítems (producto, cantidad, peso) y queda registrada en
            los documentos relacionados de la guía.
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={label}>Peso</label>
          <input type="number" step="0.001" className={input} value={form.peso_total} onChange={(e) => setCampo('peso_total', e.target.value)} required />
        </div>
        <div>
          <label className={label}>Unidad</label>
          <select className={input} value={form.und_peso_total} onChange={(e) => setCampo('und_peso_total', e.target.value)}>
            <option value="KGM">KGM</option>
            <option value="TNE">TNE</option>
          </select>
        </div>
        <div>
          <label className={label}>Bultos</label>
          <input type="number" className={input} value={form.num_bultos} onChange={(e) => setCampo('num_bultos', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={label}>Placa del vehículo</label>
        <input className={input} value={form.vehiculo_placa} onChange={(e) => setCampo('vehiculo_placa', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Partida ubigeo</label>
          <input className={input} maxLength={6} value={form.partida_ubigeo} onChange={(e) => setCampo('partida_ubigeo', e.target.value)} required />
        </div>
        <div>
          <label className={label}>Llegada ubigeo</label>
          <input className={input} maxLength={6} value={form.llegada_ubigeo} onChange={(e) => setCampo('llegada_ubigeo', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={label}>Partida dirección</label>
        <input className={input} value={form.partida_direccion} onChange={(e) => setCampo('partida_direccion', e.target.value)} required />
      </div>
      <div>
        <label className={label}>Llegada dirección</label>
        <input className={input} value={form.llegada_direccion} onChange={(e) => setCampo('llegada_direccion', e.target.value)} required />
      </div>
      {form.mod_traslado === '02' && (
        <>
          <div>
            <label className={label}>Conductor nombres</label>
            <input className={input} value={form.conductor_nombres} onChange={(e) => setCampo('conductor_nombres', e.target.value)} />
          </div>
          <div>
            <label className={label}>Conductor apellidos</label>
            <input className={input} value={form.conductor_apellidos} onChange={(e) => setCampo('conductor_apellidos', e.target.value)} />
          </div>
          <div>
            <label className={label}>Doc. conductor</label>
            <input className={input} value={form.conductor_num_doc} onChange={(e) => setCampo('conductor_num_doc', e.target.value)} />
          </div>
          <div>
            <label className={label}>Licencia</label>
            <input className={input} value={form.conductor_licencia} onChange={(e) => setCampo('conductor_licencia', e.target.value)} />
          </div>
        </>
      )}
      {form.mod_traslado === '01' && (
        <>
          <div>
            <label className={label}>Transportista RUC</label>
            <input className={input} value={form.transportista_num_doc} onChange={(e) => setCampo('transportista_num_doc', e.target.value)} />
          </div>
          <div>
            <label className={label}>Transportista razón social</label>
            <input className={input} value={form.transportista_razon_social} onChange={(e) => setCampo('transportista_razon_social', e.target.value)} />
          </div>
          <div>
            <label className={label}>N° MTC</label>
            <input className={input} value={form.transportista_nro_mtc} onChange={(e) => setCampo('transportista_nro_mtc', e.target.value)} />
          </div>
        </>
      )}
      <div className="md:col-span-2">
        <label className={label}>Observaciones</label>
        <input
          className={input}
          placeholder="Bienes transferidos en la Amazonía / traslado por compra…"
          value={form.observaciones}
          onChange={(e) => setCampo('observaciones', e.target.value)}
        />
      </div>
    </div>
  );
}

function DetallesTabla({ form, setItem, agregarItem, quitarItem, guia }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">Ítems</span>
        <button type="button" onClick={agregarItem} className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded">
          <Plus size={12} /> Añadir ítem
        </button>
      </div>
      <div className="space-y-2">
        {form.detalles.map((d, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-12 items-end bg-slate-900/30 rounded-lg p-2">
            <div className="md:col-span-2">
              <label className={label}>Código</label>
              <input className={input} value={d.codigo} onChange={(e) => setItem(i, 'codigo', e.target.value)} required />
            </div>
            <div className="md:col-span-4">
              <label className={label}>Descripción</label>
              <input className={input} value={d.descripcion} onChange={(e) => setItem(i, 'descripcion', e.target.value)} required />
            </div>
            <div className="md:col-span-1">
              <label className={label}>Unidad</label>
              <select className={input} value={d.unidad} onChange={(e) => setItem(i, 'unidad', e.target.value)}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className={label}>Cant.</label>
              <input type="number" step="0.001" className={input} value={d.cantidad} onChange={(e) => setItem(i, 'cantidad', e.target.value)} required />
            </div>
            {!guia && (
              <>
                <div className="md:col-span-2">
                  <label className={label}>Valor unit.</label>
                  <input type="number" step="0.01" className={input} value={d.mto_valor_unitario} onChange={(e) => setItem(i, 'mto_valor_unitario', e.target.value)} required />
                </div>
                <div className="md:col-span-1">
                  <label className={label}>Afect.</label>
                  <select className={input} value={d.tip_afe_igv} onChange={(e) => setItem(i, 'tip_afe_igv', e.target.value)}>
                    {AFECTACIONES.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
                  </select>
                </div>
              </>
            )}
            {guia && (
              <div className="md:col-span-2">
                <label className={label}>Peso (kg)</label>
                <input type="number" step="0.001" className={input} value={d.peso_total} onChange={(e) => setItem(i, 'peso_total', e.target.value)} />
              </div>
            )}
            <div className="md:col-span-1 flex justify-end">
              <button type="button" onClick={() => quitarItem(i)} disabled={form.detalles.length === 1} className="text-red-400 hover:text-red-300 disabled:opacity-30 p-2">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
