// Validación SSCO (Sujeto Sin Capacidad Operativa).
//
// La SUNAT publica la relación de SSCO que emiten comprobantes por operaciones
// no reales:
//   https://www.sunat.gob.pe/padronesnotificaciones/sujeSinCapacidadOperativa.html
//   -> ssco/sujesincapacidadOperativa.xlsx
//
// Efecto para el adquirente (comprador) por los comprobantes emitidos por un
// SSCO: NO dan derecho a crédito fiscal del IGV ni sustentan costo o gasto para
// el Impuesto a la Renta (aplica desde el 20.03.2022). Por eso el libro debe
// marcarlos para no tomarlos como crédito/gasto.

import { readXlsx } from './xlsxRead.js';

// Columnas del padrón oficial (0-based), según la cabecera publicada por SUNAT.
export const COLUMNAS_SSCO = {
  ruc: 0,
  razon_social: 1,
  domicilio: 2,
  resolucion: 3,
  fecha_emision: 4,
  fecha_firme: 5,
  rep_legal_doc: 6,
  rep_legal_nombre: 7,
  fecha_publicacion: 8,
};

// Convierte un serial de fecha de Excel (días desde 1899-12-30) a 'AAAA-MM-DD'.
export function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = Math.round((n - 25569) * 86400 * 1000); // 25569 = días hasta 1970-01-01
  return new Date(ms).toISOString().slice(0, 10);
}

// Normaliza un RUC/DNI a dígitos (el padrón trae el RUC como número).
export function normalizarDoc(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function texto(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function fecha(value) {
  // Puede venir como serial numérico o ya como texto.
  if (typeof value === 'number') return excelSerialToDate(value);
  return texto(value);
}

// Convierte las filas del padrón (matriz, con cabecera) en registros.
export function parseSscoPadron(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const registros = [];
  for (let i = 1; i < rows.length; i += 1) {
    const fila = rows[i] ?? [];
    const ruc = normalizarDoc(fila[COLUMNAS_SSCO.ruc]);
    if (!ruc) continue;
    registros.push({
      ruc,
      razon_social: texto(fila[COLUMNAS_SSCO.razon_social]),
      domicilio: texto(fila[COLUMNAS_SSCO.domicilio]),
      resolucion: texto(fila[COLUMNAS_SSCO.resolucion]),
      fecha_emision: fecha(fila[COLUMNAS_SSCO.fecha_emision]),
      fecha_firme: fecha(fila[COLUMNAS_SSCO.fecha_firme]),
      rep_legal_doc: normalizarDoc(fila[COLUMNAS_SSCO.rep_legal_doc]),
      rep_legal_nombre: texto(fila[COLUMNAS_SSCO.rep_legal_nombre]),
      fecha_publicacion: fecha(fila[COLUMNAS_SSCO.fecha_publicacion]),
    });
  }
  return registros;
}

// Índice RUC -> registro, para consultar en O(1).
export function buildSscoIndex(registros) {
  const index = new Map();
  for (const r of registros ?? []) index.set(r.ruc, r);
  return index;
}

// Lee un archivo .xlsx del padrón (ArrayBuffer) y devuelve sus registros.
export async function parseSscoArchivo(arrayBuffer) {
  const sheets = await readXlsx(arrayBuffer);
  const hoja = sheets[0];
  if (!hoja) throw new Error('El archivo no contiene hojas');
  return parseSscoPadron(hoja.rows);
}

// Busca un documento (RUC/DNI) en el índice SSCO. Devuelve el registro o null.
export function consultarSsco(index, doc) {
  if (!index || !index.size) return null;
  return index.get(normalizarDoc(doc)) ?? null;
}

// Marca las filas del libro con la condición SSCO de su contraparte.
// `contraparte` indica qué campo usar: 'proveedor' (compras) o 'cliente'.
export function marcarSsco(rows, index, contraparte = 'proveedor') {
  return (rows ?? []).map((row) => {
    const doc = row?.[contraparte]?.num_doc ?? row?.num_doc;
    const match = consultarSsco(index, doc);
    return {
      ...row,
      ssco: Boolean(match),
      ssco_detalle: match,
    };
  });
}

// Resumen de la validación SSCO sobre un conjunto de filas marcadas.
export function resumenSsco(rows) {
  const afectadas = (rows ?? []).filter((r) => r.ssco);
  const afectaCredito = afectadas.reduce((acc, r) => acc + Number(r.igv ?? 0), 0);
  const afectaGasto = afectadas.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  return {
    total: (rows ?? []).length,
    ssco: afectadas.length,
    igv_sin_credito: Math.round(afectaCredito * 100) / 100,
    importe_sin_gasto: Math.round(afectaGasto * 100) / 100,
    filas: afectadas,
  };
}

// Fecha límite de la solicitud de revisión: 30 días hábiles tras la publicación.
// Se aproxima con días calendario (42) para dar una referencia al cliente; el
// cómputo exacto de días hábiles lo determina la SUNAT.
export function fechaLimiteRevision(fechaPublicacion) {
  if (!fechaPublicacion) return '';
  const base = new Date(`${fechaPublicacion}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return '';
  base.setUTCDate(base.getUTCDate() + 42);
  return base.toISOString().slice(0, 10);
}
