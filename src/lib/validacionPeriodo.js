// Validación SSCO de un periodo completo.
//
// Une las dos piezas del control tributario:
//   1. El padrón SSCO de SUNAT (¿la contraparte no tiene capacidad operativa?).
//   2. La propuesta SIRE del periodo (¿qué propone la Administración?).
//
// Devuelve un reporte con las referencias necesarias para abrir el comprobante
// exacto en el registro correspondiente.

import { marcarSsco, resumenSsco, consultarSsco } from './ssco.js';
import { cruzarConPropuesta, claveComprobante } from './cruceSire.js';

const money = (v) => Math.round(Number(v ?? 0) * 100) / 100;

// Referencia mínima para navegar al comprobante en el registro.
function referencia(row, libro) {
  const contraparte = libro === 'compras' ? row.proveedor : row.cliente;
  return {
    libro,
    id: row.id ?? null,
    tipo_documento: row.tipo_documento,
    serie: row.serie,
    numero: row.numero,
    fecha_emision: row.fecha_emision,
    num_doc: contraparte?.num_doc ?? '',
    razon_social: contraparte?.razon_social ?? '',
    igv: money(row.igv),
    total: money(row.total),
  };
}

// Ejecuta la validación del periodo.
//   - `propios`: comprobantes del libro (ya filtrados al periodo).
//   - `propuesta`: filas de la propuesta SIRE (o null si no se cargó).
//   - `padronIndex`: índice SSCO (Map RUC -> registro) o null.
export function validarPeriodo({ propios = [], propuesta = null, libro = 'compras', padronIndex = null, periodo = '' }) {
  const marcadas = padronIndex ? marcarSsco(propios, padronIndex, libro === 'compras' ? 'proveedor' : 'cliente') : propios;

  const cruce = propuesta
    ? cruzarConPropuesta(marcadas, propuesta, libro)
    : null;

  // SSCO detectados en mi libro.
  const sscoPropios = marcadas.filter((r) => r.ssco).map((r) => ({
    ...referencia(r, libro),
    resolucion: r.ssco_detalle?.resolucion ?? '',
    fecha_publicacion: r.ssco_detalle?.fecha_publicacion ?? '',
  }));

  // SSCO que SUNAT propone pero que no están en mi libro: requieren revisión.
  const enLibro = new Set(marcadas.map((r) => claveComprobante(r.tipo_documento, r.serie, r.numero, r[libro === 'compras' ? 'proveedor' : 'cliente']?.num_doc)));
  const sscoPropuesta = [];
  if (propuesta && padronIndex) {
    for (const p of propuesta) {
      if (enLibro.has(p.clave)) continue;
      const detalle = consultarSsco(padronIndex, p.num_doc);
      if (detalle) {
        sscoPropuesta.push({
          libro,
          id: null,
          tipo_documento: p.tipo_documento,
          serie: p.serie,
          numero: p.numero,
          fecha_emision: p.fecha_emision,
          num_doc: p.num_doc,
          razon_social: p.razon_social,
          igv: money(p.igv),
          total: money(p.total),
          resolucion: detalle.resolucion ?? '',
          fecha_publicacion: detalle.fecha_publicacion ?? '',
        });
      }
    }
  }

  const resumen = resumenSsco(marcadas);
  const igvAfectado = money(
    [...sscoPropios, ...sscoPropuesta].reduce((acc, r) => acc + Number(r.igv ?? 0), 0),
  );
  const importeAfectado = money(
    [...sscoPropios, ...sscoPropuesta].reduce((acc, r) => acc + Number(r.total ?? 0), 0),
  );

  return {
    periodo,
    libro,
    conPropuesta: Boolean(propuesta),
    resumen: {
      comprobantes: resumen.total,
      conSsco: sscoPropios.length,
      igv_sin_credito: resumen.igv_sin_credito,
      importe_sin_gasto: resumen.importe_sin_gasto,
    },
    sscoPropios,
    sscoPropuesta,
    igvAfectado,
    importeAfectado,
    hayHallazgos: sscoPropios.length + sscoPropuesta.length > 0,
    cruce,
  };
}
