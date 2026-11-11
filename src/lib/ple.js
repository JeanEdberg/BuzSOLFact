// Generadores de Libros Electrónicos (PLE) de SUNAT.
// Estructura tomada del Anexo N.º 2 de la RS 112-2021/SUNAT:
//   - Registro de Ventas e Ingresos 14.1 (archivo 140100) -> 34 campos
//   - Registro de Compras 8.1            (archivo 080100) -> 41 campos
// Cada campo se separa con '|' y la línea termina en '|'. Las notas de crédito
// (tipo 07) y débito (08) se registran con signo negativo en los importes.

export const PLE_SEPARATOR = '|';
const EOL = '\r\n';

export function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function money(value) {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

export function exchangeRate(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : '';
}

// Acepta 'YYYY-MM', 'YYYY-MM-DD' o 'YYYYMM' y devuelve 'YYYYMM00'.
export function period(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 6);
  return `${digits}00`;
}

function field(fields) {
  return fields
    .map((value) => (value === null || value === undefined ? '' : String(value)))
    .join(PLE_SEPARATOR) + PLE_SEPARATOR;
}

function cuo(periodo, index) {
  return `${periodo}${String(index + 1).padStart(6, '0')}`.slice(0, 40);
}

// Campo 3: número correlativo del asiento contable. El primer dígito identifica
// el origen ('M' para comprobantes emitidos por el propio contribuyente).
function correlativo(index) {
  return `M${String(index + 1).padStart(7, '0')}`;
}

// Nombre oficial: LE + RUC(11) + AAAA + MM + DD(00) + libro(6) + oportunidad(2)
// + indicadores operaciones/contenido/moneda/libro-electrónico (1111).
export function pleFilename(ruc, periodo, libro) {
  const yyyymm = period(periodo).slice(0, 6);
  return `LE${ruc}${yyyymm}00${libro}001111.TXT`;
}

export function buildVentas141(rows, { ruc, periodo }) {
  const per = period(periodo);
  const body = rows.map((r, i) => field([
    per,
    cuo(per, i),
    correlativo(i),
    formatDate(r.fecha_emision),
    formatDate(r.fecha_vencimiento),
    r.tipo_documento,
    r.serie,
    r.numero,
    '',
    r.cliente?.tipo_doc,
    r.cliente?.num_doc,
    r.cliente?.razon_social,
    money(r.valor_exportacion),
    money(r.bi_gravada),
    money(r.descuento_bi),
    money(r.igv),
    money(r.descuento_igv),
    money(r.exonerada),
    money(r.inafecta),
    money(r.isc),
    money(r.bi_ivap),
    money(r.ivap),
    money(r.otros_tributos),
    money(r.total),
    r.moneda || 'PEN',
    exchangeRate(r.tipo_cambio),
    formatDate(r.ref_fecha_emision),
    r.ref_tipo_documento,
    r.ref_serie,
    r.ref_numero,
    r.contrato,
    '',
    '',
    r.estado ?? '1',
  ]));

  return { filename: pleFilename(ruc, per, '140100'), content: body.join(EOL) + EOL };
}

export function buildCompras81(rows, { ruc, periodo }) {
  const per = period(periodo);
  const body = rows.map((r, i) => field([
    per,
    cuo(per, i),
    correlativo(i),
    formatDate(r.fecha_emision),
    formatDate(r.fecha_vencimiento),
    r.tipo_documento,
    r.serie,
    r.anio_dua,
    r.numero,
    '',
    r.proveedor?.tipo_doc,
    r.proveedor?.num_doc,
    r.proveedor?.razon_social,
    money(r.bi_gravada),
    money(r.igv),
    money(r.bi_gravada_mixta),
    money(r.igv_mixta),
    money(r.bi_gravada_no_grav),
    money(r.igv_no_grav),
    money(r.no_gravada),
    money(r.isc),
    money(r.otros_tributos),
    money(r.total),
    r.moneda || 'PEN',
    exchangeRate(r.tipo_cambio),
    formatDate(r.ref_fecha_emision),
    r.ref_tipo_documento,
    r.ref_serie,
    '',
    r.ref_numero,
    formatDate(r.fecha_detraccion),
    r.numero_detraccion,
    '',
    r.clasificacion_bienes,
    r.contrato,
    '',
    '',
    '',
    '',
    '',
    r.estado ?? '1',
  ]));

  return { filename: pleFilename(ruc, per, '080100'), content: body.join(EOL) + EOL };
}

export function summarize(rows, type) {
  const sum = (key) => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
  if (type === 'ventas') {
    return {
      registros: rows.length,
      bi_gravada: sum('bi_gravada'),
      igv: sum('igv'),
      exonerada: sum('exonerada'),
      inafecta: sum('inafecta'),
      total: sum('total'),
    };
  }
  return {
    registros: rows.length,
    bi_gravada: sum('bi_gravada'),
    igv: sum('igv'),
    no_gravada: sum('no_gravada'),
    total: sum('total'),
  };
}
