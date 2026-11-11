// Mapea los comprobantes que devuelve la API de facturación (Laravel + Greenter)
// a las filas que consumen los generadores de libros (PLE y SIRE).
//
// Campos reales del modelo Invoice/Boleta: serie, correlativo, numero_completo,
// fecha_emision, fecha_vencimiento, moneda, mto_oper_gravadas, mto_oper_exoneradas,
// mto_oper_inafectas, mto_oper_exportacion, mto_igv, mto_isc, mto_base_ivap, mto_ivap,
// mto_icbper, mto_otros_tributos, mto_imp_venta, estado_sunat y la relación client.
//
// Limitación conocida: la API NO persiste el tipo de cambio (solo existe dentro del
// JSON del detalle al emitir). Si la moneda no es PEN y no se pasa un valor, el campo
// de tipo de cambio sale vacío y SUNAT rechaza el registro. Pásalo con `tipoCambio`.

const SOLES = 'PEN';

// Laravel serializa las fechas como ISO (2026-11-10T00:00:00.000000Z).
export function isoDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

// El correlativo se guarda sin relleno ('142'); SUNAT espera 8 dígitos en facturas
// y boletas ('00000142').
export function padCorrelativo(value) {
  const s = String(value ?? '');
  return /^\d+$/.test(s) ? s.padStart(8, '0') : s;
}

function contraparte(source) {
  return {
    tipo_doc: source?.tipo_documento ?? '',
    num_doc: source?.numero_documento ?? '',
    razon_social: source?.razon_social ?? '',
  };
}

// Recursos de la API: '03' boletas, el resto facturas.
export function recurso(doc) {
  return String(doc?.tipo_documento ?? '').startsWith('03') ? 'boletas' : 'invoices';
}

// Acepta la respuesta del listado y devuelve siempre un array. El índice de
// facturas devuelve un paginator ({ data: [...] }) y el de boletas un array plano.
export function normalizarLista(payload) {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function resolverTipoCambio(doc, tipoCambio) {
  if (doc?.tipo_cambio !== undefined && doc?.tipo_cambio !== null) return doc.tipo_cambio;
  if (doc?.moneda && doc.moneda !== SOLES) {
    if (typeof tipoCambio === 'function') return tipoCambio(isoDate(doc.fecha_emision));
    if (tipoCambio !== undefined) return tipoCambio;
  }
  return doc?.moneda === SOLES ? 1 : null;
}

// Fila del libro de VENTAS (PLE 14.1 y SIRE RVIE comparten estos importes).
export function mapVenta(doc, { tipoCambio } = {}) {
  return {
    id: doc.id,
    tipo_documento: doc.tipo_documento,
    serie: doc.serie,
    numero: padCorrelativo(doc.correlativo),
    fecha_emision: isoDate(doc.fecha_emision),
    fecha_vencimiento: isoDate(doc.fecha_vencimiento),
    moneda: doc.moneda ?? SOLES,
    tipo_cambio: resolverTipoCambio(doc, tipoCambio),
    valor_exportacion: doc.mto_oper_exportacion,
    bi_gravada: doc.mto_oper_gravadas,
    igv: doc.mto_igv,
    exonerada: doc.mto_oper_exoneradas,
    inafecta: doc.mto_oper_inafectas,
    isc: doc.mto_isc,
    bi_ivap: doc.mto_base_ivap,
    ivap: doc.mto_ivap,
    icbper: doc.mto_icbper,
    otros_tributos: doc.mto_otros_tributos,
    total: doc.mto_imp_venta,
    cliente: contraparte(doc.client),
    estado_sunat: doc.estado_sunat,
    // Para el libro corto (Excel) y la verificación de artefactos.
    descripcion: doc.descripcion,
    detalles: doc.detalles,
    leyendas: doc.leyendas,
    xml_path: doc.xml_path,
    cdr_path: doc.cdr_path,
    pdf_path: doc.pdf_path,
  };
}

// Fila del libro de COMPRAS. La API solo emite comprobantes propios, así que esta
// función espera el comprobante recibido ya normalizado con el mismo vocabulario
// de importes (mto_*) y una contraparte en `proveedor` o `client`.
export function mapCompra(doc, { tipoCambio } = {}) {
  return {
    id: doc.id,
    tipo_documento: doc.tipo_documento,
    serie: doc.serie,
    numero: padCorrelativo(doc.correlativo ?? doc.numero),
    fecha_emision: isoDate(doc.fecha_emision),
    fecha_vencimiento: isoDate(doc.fecha_vencimiento),
    moneda: doc.moneda ?? SOLES,
    tipo_cambio: resolverTipoCambio(doc, tipoCambio),
    bi_gravada: doc.mto_oper_gravadas ?? doc.bi_gravada,
    igv: doc.mto_igv ?? doc.igv,
    bi_gravada_mixta: doc.mto_oper_gravadas_mixta ?? doc.bi_gravada_mixta,
    igv_mixta: doc.mto_igv_mixta ?? doc.igv_mixta,
    bi_gravada_no_grav: doc.mto_oper_gravadas_no_grav ?? doc.bi_gravada_no_grav,
    igv_no_grav: doc.mto_igv_no_grav ?? doc.igv_no_grav,
    no_gravada: doc.mto_oper_exoneradas ?? doc.no_gravada,
    exonerada: doc.mto_oper_exoneradas ?? doc.exonerada,
    inafecta: doc.mto_oper_inafectas ?? doc.inafecta,
    isc: doc.mto_isc,
    icbper: doc.mto_icbper,
    otros_tributos: doc.mto_otros_tributos,
    total: doc.mto_imp_venta ?? doc.total,
    proveedor: contraparte(doc.proveedor ?? doc.client),
    estado_sunat: doc.estado_sunat,
    // Para el libro corto (Excel) y la verificación de artefactos.
    descripcion: doc.descripcion,
    detalles: doc.detalles,
    leyendas: doc.leyendas,
    xml_path: doc.xml_path,
    cdr_path: doc.cdr_path,
    pdf_path: doc.pdf_path,
  };
}
