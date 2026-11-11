// Libro corto (versión Excel) de ventas y compras.
//
// Es un resumen exportable para el cliente, distinto de los formatos oficiales
// PLE/SIRE. Columnas por registro:
//   Fecha | RUC | Cliente/Proveedor | Descripción | Base | IGV | Inafecto |
//   Exonerado | ISC | Total | Estado | Verificación SIRE | Amazonía | SSCO
//
// "Verificación SIRE" resume qué artefactos existen del comprobante (XML, CDR,
// PDF). "Amazonía" señala si el comprobante lleva la leyenda de exoneración del
// IGV por la Ley de la Amazonía (catálogo n.º 52: 2001/2002/2003). "SSCO" marca
// al proveedor/cliente que figura en el padrón de Sujetos Sin Capacidad
// Operativa: sus comprobantes no dan crédito fiscal ni sustentan gasto.

import { buildXlsx } from './xlsx.js';
import { formatDate, money } from './ple.js';

// Leyendas de Amazonía (catálogo n.º 52 de SUNAT).
export const LEYENDAS_AMAZONIA = {
  2001: 'BIENES TRANSFERIDOS EN LA AMAZONIA REGION SELVA PARA SER CONSUMIDOS EN LA MISMA',
  2002: 'SERVICIOS PRESTADOS EN LA AMAZONIA REGION SELVA PARA SER CONSUMIDOS EN LA MISMA',
  2003: 'CONTRATOS DE CONSTRUCCION EJECUTADOS EN LA AMAZONIA REGION SELVA',
};

// Texto para la columna "Amazonía" a partir de las leyendas del comprobante.
export function leyendaAmazonia(leyendas) {
  if (!Array.isArray(leyendas)) return '';
  const codes = leyendas
    .map((l) => String(l?.code ?? l?.codigo ?? ''))
    .filter((c) => LEYENDAS_AMAZONIA[c]);
  if (!codes.length) return '';
  return codes.map((c) => LEYENDAS_AMAZONIA[c]).join(' / ');
}

// Texto para la columna "SSCO": la resolución de atribución si el comprobante
// proviene de un Sujeto Sin Capacidad Operativa; vacío en caso contrario.
export function marcadorSsco(row) {
  if (!row?.ssco) return '';
  const detalle = row.ssco_detalle ?? {};
  return detalle.resolucion ? `SSCO · ${detalle.resolucion}` : 'SSCO (sin crédito fiscal ni gasto)';
}

// Resume la disponibilidad de artefactos: 'XML+CDR+PDF', 'XML', '—', etc.
export function verificacionSire(row) {
  const partes = [];
  if (row.xml_path) partes.push('XML');
  if (row.cdr_path) partes.push('CDR');
  if (row.pdf_path) partes.push('PDF');
  return partes.length ? partes.join('+') : '—';
}

// Descripción del comprobante: la primera línea del detalle (o su resumen).
export function descripcion(row) {
  const items = row.detalles ?? row.items;
  if (Array.isArray(items) && items.length) {
    const primera = items[0]?.descripcion ?? items[0]?.descripcion_item ?? '';
    if (items.length > 1) return `${primera} (+${items.length - 1} ítem${items.length - 1 === 1 ? '' : 's'})`;
    return primera;
  }
  return row.descripcion ?? '';
}

const ESTADOS = {
  ACEPTADO: 'Aceptado',
  PENDIENTE: 'Pendiente',
  ENVIADO: 'Enviado',
  PROCESANDO: 'Procesando',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
  BAJA: 'Anulado',
  ERROR: 'Error',
};

export function estadoLegible(estado) {
  if (!estado) return 'Pendiente';
  return ESTADOS[String(estado).toUpperCase()] ?? String(estado);
}

const num = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function filaVenta(r) {
  return [
    formatDate(r.fecha_emision),
    r.cliente?.num_doc ?? '',
    r.cliente?.razon_social ?? '',
    descripcion(r),
    num(r.bi_gravada),
    num(r.igv),
    num(r.inafecta),
    num(r.exonerada),
    num(r.isc),
    num(r.total),
    estadoLegible(r.estado_sunat),
    verificacionSire(r),
    leyendaAmazonia(r.leyendas),
    marcadorSsco(r),
  ];
}

function filaCompra(r) {
  return [
    formatDate(r.fecha_emision),
    r.proveedor?.num_doc ?? '',
    r.proveedor?.razon_social ?? '',
    descripcion(r),
    num(r.bi_gravada),
    num(r.igv),
    num(r.inafecta),
    num(r.exonerada),
    num(r.isc),
    num(r.total),
    estadoLegible(r.estado_sunat),
    verificacionSire(r),
    leyendaAmazonia(r.leyendas),
    marcadorSsco(r),
  ];
}

// Los importes de la columna Total se calculan como suma de la fila; se
// redondean a 2 decimales para que cuadren con la suma de las partes.
function filaTotales(rows, fila) {
  const filas = rows.map(fila);
  const suma = (idx) => Math.round(filas.reduce((acc, f) => acc + Number(f[idx] ?? 0), 0) * 100) / 100;
  return [
    'TOTAL', '', `${rows.length} comprobante(s)`, '',
    suma(4), suma(5), suma(6), suma(7), suma(8), suma(9),
    '', '', '', '',
  ];
}

const CABECERA = [
  'Fecha', 'RUC', 'Cliente', 'Descripción', 'Base', 'IGV', 'Inafecto',
  'Exonerado', 'ISC', 'Total', 'Estado', 'Verificación SIRE', 'Amazonía', 'SSCO',
];

const CABECERA_COMPRAS = ['Fecha', 'RUC', 'Proveedor', ...CABECERA.slice(3)];

export function hojaVentas(rows) {
  return {
    name: 'Ventas',
    rows: [CABECERA, ...rows.map(filaVenta), filaTotales(rows, filaVenta)],
  };
}

export function hojaCompras(rows) {
  return {
    name: 'Compras',
    rows: [CABECERA_COMPRAS, ...rows.map(filaCompra), filaTotales(rows, filaCompra)],
  };
}

export function buildLibroCorto(ventas, compras) {
  return {
    filename: 'Libro_Ventas_Compras.xlsx',
    bytes: buildXlsx([hojaVentas(ventas), hojaCompras(compras)]),
  };
}
