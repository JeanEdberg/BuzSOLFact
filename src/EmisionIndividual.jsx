import { useEffect, useState } from 'react';
import {
  FileText, Receipt, Plus, Trash2, Send, Loader2, AlertCircle, CheckCircle2, Building2, Search,
} from 'lucide-react';
import { api } from './lib/api.js';

const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';
const label = 'block text-xs text-slate-400 mb-1';

const hoy = () => new Date().toISOString().slice(0, 10);

const UNIDADES = ['NIU', 'KGM', 'ZZ', 'LTR', 'MTR', 'BLL', 'CJ', 'SET'];
const AFECTACIONES = [
  { code: '10', name: 'Gravado' },
  { code: '20', name: 'Exonerado' },
  { code: '30', name: 'Inafecto' },
  { code: '40', name: 'Exportación' },
];

const TIPOS = [
  { id: 'factura', label: 'Factura', icon: FileText },
  { id: 'boleta', label: 'Boleta', icon: Receipt },
];

const itemVacio = (exonerado = false) => ({
  codigo: '', descripcion: '', unidad: 'NIU', cantidad: 1, mto_valor_unitario: 0,
  tip_afe_igv: exonerado ? '20' : '10',
});

/**
 * Emisión individual de facturas y boletas.
 *
 * Es la alternativa a la carga masiva: se arma un comprobante con su cliente y
 * sus ítems. El correlativo lo asigna el backend por sucursal; tras emitir se
 * puede enviar a SUNAT y descargar XML/CDR/PDF.
 */
export default function EmisionIndividual({ api, companyId, conectado, onEmitido }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(companyId ?? null);
  const [sucursales, setSucursales] = useState([]);
  const [branchId, setBranchId] = useState(null);

  const [tipo, setTipo] = useState('factura');
  const [enviarSunat, setEnviarSunat] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const empresa = empresas.find((e) => e.id === empresaId);
  const esAmazonia = Boolean(empresa?.contribuyente_amazonia);

  const [form, setForm] = useState(formInicial('factura'));

  function formInicial(tipoId) {
    return {
      serie: tipoId === 'factura' ? 'F001' : 'B001',
      fecha_emision: hoy(),
      fecha_vencimiento: '',
      moneda: 'PEN',
      forma_pago_tipo: 'Contado',
      clienteTipoDoc: '6',
      clienteNumDoc: '',
      clienteRazonSocial: '',
      clienteDireccion: '',
      detalles: [itemVacio()],
    };
  }

  useEffect(() => {
    if (!conectado) return;
    (async () => {
      try {
        const lista = await api.listCompanies();
        setEmpresas(lista);
        const id = empresaId ?? lista[0]?.id ?? null;
        if (id) await cambiarEmpresa(id, lista);
      } catch (e) {
        setError(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado]);

  useEffect(() => {
    if (companyId && companyId !== empresaId) cambiarEmpresa(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function cambiarEmpresa(id, lista = empresas) {
    setEmpresaId(id);
    setMensaje(null);
    try {
      const suc = await api.listBranches(id);
      setSucursales(suc);
      setBranchId(suc[0]?.id ?? null);
      // Contribuyente de la Amazonía: sus ventas van exoneradas del IGV.
      const esAmazonia = Boolean(lista.find((e) => e.id === id)?.contribuyente_amazonia);
      if (esAmazonia) {
        setForm((f) => ({ ...f, detalles: f.detalles.map((d) => ({ ...d, tip_afe_igv: '20' })) }));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function cambiarTipo(id) {
    setTipo(id);
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

  // Al cambiar el tipo de documento se reconsulta si ya había un número.
  function cambiarTipoDocCliente(tipoDoc) {
    setForm((f) => ({ ...f, clienteTipoDoc: tipoDoc, clienteNumDoc: '', clienteRazonSocial: '', clienteDireccion: '' }));
  }

  // Toma los datos del padrón (RUC/DNI) para autocompletar al cliente.
  async function consultarCliente() {
    const numero = (form.clienteNumDoc ?? '').trim();
    if (!numero) {
      setError('Ingresa el RUC o DNI del cliente para consultarlo.');
      return;
    }
    setBuscando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await api.consultarDocumento({ tipoDocumento: form.clienteTipoDoc, numeroDocumento: numero });
      if (res?.encontrado && res.data) {
        setForm((f) => ({
          ...f,
          clienteRazonSocial: res.data.razon_social ?? f.clienteRazonSocial,
          clienteDireccion: res.data.direccion ?? f.clienteDireccion,
        }));
        setMensaje(`Datos de ${res.data.razon_social ?? numero} cargados desde el padrón.`);
      } else {
        setMensaje(res?.mensaje ?? 'No se pudo autocompletar; escribe los datos a mano.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBuscando(false);
    }
  }

  const agregarItem = () => setForm((f) => ({ ...f, detalles: [...f.detalles, itemVacio(esAmazonia)] }));
  const quitarItem = (indice) => setForm((f) => ({ ...f, detalles: f.detalles.filter((_, i) => i !== indice) }));

  function construirPayload() {
    const base = {
      company_id: empresaId,
      branch_id: branchId,
      serie: form.serie,
      fecha_emision: form.fecha_emision,
      moneda: form.moneda,
      client: {
        tipo_documento: form.clienteTipoDoc,
        numero_documento: form.clienteNumDoc,
        razon_social: form.clienteRazonSocial,
        direccion: form.clienteDireccion || undefined,
      },
      detalles: form.detalles.map((d) => ({
        codigo: d.codigo,
        descripcion: d.descripcion,
        unidad: d.unidad,
        cantidad: Number(d.cantidad),
        mto_valor_unitario: Number(d.mto_valor_unitario),
        tip_afe_igv: d.tip_afe_igv,
        // La boleta exige el porcentaje de IGV; gravado = 18, resto = 0.
        porcentaje_igv: d.tip_afe_igv === '10' ? 18 : 0,
      })),
    };

    if (tipo === 'factura') {
      return {
        ...base,
        forma_pago_tipo: form.forma_pago_tipo,
        fecha_vencimiento: form.fecha_vencimiento || undefined,
      };
    }
    return { ...base, metodo_envio: 'individual' };
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
      const doc = tipo === 'factura' ? await api.crearFactura(payload) : await api.crearBoleta(payload);
      if (doc?.success === false) throw new Error(doc.message || 'No se pudo emitir el comprobante');

      let texto = `Comprobante ${doc?.numero_completo ?? ''} emitido (estado ${doc?.estado_sunat ?? 'PENDIENTE'}).`;
      if (enviarSunat && doc?.id) {
        const recurso = tipo === 'factura' ? 'invoices' : 'boletas';
        await api.enviarSunat(recurso, doc.id);
        texto = `Comprobante ${doc?.numero_completo ?? ''} emitido y enviado a SUNAT.`;
      }
      setMensaje(texto);
      setForm(formInicial(tipo));
      onEmitido?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold">Emitir comprobante</h3>
        <p className="text-sm text-slate-400 mt-1">
          Emite una factura o boleta individual. El correlativo lo asigna el backend
          por sucursal; la serie se configura en la pestaña Series.
        </p>
      </div>

      {!conectado && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
          <AlertCircle size={16} /> Conecta la API (pestaña Conexión) para emitir.
        </div>
      )}

      <div className="flex gap-2">
        {TIPOS.map(({ id, label: texto, icon: Icon }) => (
          <button
            key={id}
            onClick={() => cambiarTipo(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tipo === id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
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
          <Building2 size={18} className="text-blue-400" /> {tipo === 'factura' ? 'Factura' : 'Boleta'}
        </h4>

        {esAmazonia && (
          <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              Empresa de la Amazonía: las ventas de bienes o servicios se emiten
              <strong> exoneradas del IGV</strong> (afectación 20). El comprobante
              incluirá la leyenda de Amazonía.
            </span>
          </div>
        )}

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
            <label className={label}>Moneda</label>
            <select className={input} value={form.moneda} onChange={(e) => setCampo('moneda', e.target.value)}>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {tipo === 'factura' ? (
            <>
              <div>
                <label className={label}>Forma de pago</label>
                <select className={input} value={form.forma_pago_tipo} onChange={(e) => setCampo('forma_pago_tipo', e.target.value)}>
                  <option value="Contado">Contado</option>
                  <option value="Credito">Crédito</option>
                </select>
              </div>
              <div>
                <label className={label}>Fecha de vencimiento</label>
                <input type="date" className={input} value={form.fecha_vencimiento} onChange={(e) => setCampo('fecha_vencimiento', e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <label className={label}>Envío</label>
              <input className={`${input} opacity-60`} value="Individual" disabled />
            </div>
          )}
          <div>
            <label className={label}>Doc. cliente</label>
            <select className={input} value={form.clienteTipoDoc} onChange={(e) => cambiarTipoDocCliente(e.target.value)}>
              <option value="6">RUC</option>
              <option value="1">DNI</option>
              <option value="4">Carné de extranjería</option>
            </select>
          </div>
          <div>
            <label className={label}>N° documento cliente</label>
            <div className="flex gap-2">
              <input className={input} value={form.clienteNumDoc} onChange={(e) => setCampo('clienteNumDoc', e.target.value)} required />
              <button
                type="button"
                onClick={consultarCliente}
                disabled={buscando || (form.clienteTipoDoc !== '6' && form.clienteTipoDoc !== '1')}
                title="Consultar datos del cliente en el padrón"
                className="flex items-center gap-1 shrink-0 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-3 py-2 rounded-lg text-xs"
              >
                {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Autocompletar
              </button>
            </div>
          </div>
          <div>
            <label className={label}>Razón social cliente</label>
            <input className={input} value={form.clienteRazonSocial} onChange={(e) => setCampo('clienteRazonSocial', e.target.value)} required />
          </div>
          <div>
            <label className={label}>Dirección (opcional)</label>
            <input className={input} value={form.clienteDireccion} onChange={(e) => setCampo('clienteDireccion', e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Ítems</span>
            <button type="button" onClick={agregarItem} className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded">
              <Plus size={12} /> Añadir ítem
            </button>
          </div>
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
              <div className="md:col-span-1 flex justify-end">
                <button type="button" onClick={() => quitarItem(i)} disabled={form.detalles.length === 1} className="text-red-400 hover:text-red-300 disabled:opacity-30 p-2">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={enviarSunat} onChange={(e) => setEnviarSunat(e.target.checked)} disabled={!conectado} />
          Enviar a SUNAT después de emitir
        </label>

        <button
          type="submit"
          disabled={!conectado || guardando || !empresaId || !branchId}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {guardando ? 'Emitiendo…' : 'Emitir'}
        </button>
      </form>
    </div>
  );
}
