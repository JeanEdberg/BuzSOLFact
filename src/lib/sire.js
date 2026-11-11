// Generadores del SIRE (Sistema Integrado de Registros Electrónicos), el
// entregable vigente que reemplazó al PLE para ventas y compras.
//   - RVIE (ventas)  -> Anexo N.º 3 de la RS 112-2021, archivo 140400
//   - RCE  (compras) -> Anexo N.º 11 de la RS 040-2022, archivo 080400
// Reglas confirmadas contra archivos reales aceptados por SUNAT:
//   * cada línea termina en '|' y usa CRLF;
//   * RVIE informa 33 campos (34-40 los completa la Administración y NO se envían);
//   * RCE informa 37 campos y sí envía 38-41 vacíos.
// A diferencia del PLE, la razón social admite hasta 1500 caracteres y aparece
// el ICBPER; no hay CUO ni "estado" informado.

import { PLE_SEPARATOR as SEP, formatDate, money, exchangeRate } from './ple.js';

const EOL = '\r\n';
const AUTO = '';

function field(fields) {
  return fields
    .map((value) => (value === null || value === undefined ? '' : String(value)))
    .join(SEP) + SEP;
}

// Nombre oficial del SIRE: LE + RUC(11) + AAAAMM + 00 + libro(6) + 02 (reemplaza
// la propuesta) + 1112 (operativa, con información, soles, generado por SIRE).
export function sireFilename(ruc, periodo, libro) {
  const yyyymm = String(periodo ?? '').replace(/\D/g, '').slice(0, 6);
  return `LE${ruc}${yyyymm}00${libro}021112.TXT`;
}

function periodo6(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

function cabecera(ruc, razonSocial, per, doc, conVencimiento) {
  return [
    ruc,                                  // 1 RUC del generador
    razonSocial,                          // 2 ID (razón social, hasta 1500)
    per,                                  // 3 periodo AAAAMM
    AUTO,                                 // 4 CAR SUNAT (vacío en reemplazo)
    formatDate(doc.fecha_emision),        // 5 fecha de emisión
    conVencimiento ? formatDate(doc.fecha_vencimiento) : '', // 6 vencimiento / pago
    doc.tipo_documento,                   // 7 tipo de comprobante
    doc.serie,                            // 8 serie
  ];
}

export function buildRvie(rows, { ruc, razon_social }) {
  const per = periodo6(rows[0]?.periodo);
  const body = rows.map((r) => {
    const c = r.cliente ?? {};
    return field([
      ...cabecera(ruc, razon_social, per, r, false),
      r.numero,                           // 9 número (o inicial del rango)
      r.numero_final,                     // 10 número final del rango
      c.tipo_doc,                         // 11 tipo de documento del cliente
      c.num_doc,                          // 12 número de documento
      c.razon_social,                     // 13 razón social / nombres
      money(r.valor_exportacion),         // 14 valor facturado de exportación
      money(r.bi_gravada),                // 15 base imponible gravada
      money(r.descuento_bi),              // 16 descuento de la base
      money(r.igv),                       // 17 IGV / IPM
      money(r.descuento_igv),             // 18 descuento del IGV
      money(r.exonerada),                 // 19 exonerado
      money(r.inafecta),                  // 20 inafecto
      money(r.isc),                       // 21 ISC
      money(r.bi_ivap),                   // 22 base del IVAP
      money(r.ivap),                      // 23 IVAP
      money(r.icbper),                    // 24 ICBPER
      money(r.otros_tributos),            // 25 otros tributos y cargos
      money(r.total),                     // 26 importe total
      r.moneda || 'PEN',                  // 27 moneda
      exchangeRate(r.tipo_cambio),        // 28 tipo de cambio
      formatDate(r.ref_fecha_emision),    // 29 fecha del comprobante modificado
      r.ref_tipo_documento,               // 30 tipo del comprobante modificado
      r.ref_serie,                        // 31 serie del comprobante modificado
      r.ref_numero,                       // 32 número del comprobante modificado
      r.contrato,                         // 33 identificador del proyecto / contrato
    ]);
  });
  return { filename: sireFilename(ruc, per, '140400'), content: body.join(EOL) + EOL };
}

export function buildRce(rows, { ruc, razon_social }) {
  const per = periodo6(rows[0]?.periodo);
  const body = rows.map((r) => {
    const p = r.proveedor ?? {};
    return field([
      ...cabecera(ruc, razon_social, per, r, true),
      r.anio_dua,                         // 9 año de emisión de la DUA
      r.numero,                           // 10 número (o inicial del rango)
      r.numero_final,                     // 11 número final del rango
      p.tipo_doc,                         // 12 tipo de documento del proveedor
      p.num_doc,                          // 13 número de documento
      p.razon_social,                     // 14 razón social / nombres
      money(r.bi_gravada),                // 15 BI gravada destinada a gravadas/exportación
      money(r.igv),                       // 16 IGV del campo 15
      money(r.bi_gravada_mixta),          // 17 BI gravada a gravadas y no gravadas
      money(r.igv_mixta),                 // 18 IGV del campo 17
      money(r.bi_gravada_no_grav),        // 19 BI gravada destinada a no gravadas
      money(r.igv_no_grav),               // 20 IGV del campo 19
      money(r.no_gravada),                // 21 adquisiciones no gravadas
      money(r.isc),                       // 22 ISC
      money(r.icbper),                    // 23 ICBPER
      money(r.otros_tributos),            // 24 otros tributos y cargos
      money(r.total),                     // 25 importe total
      r.moneda || 'PEN',                  // 26 moneda
      exchangeRate(r.tipo_cambio),        // 27 tipo de cambio
      formatDate(r.ref_fecha_emision),    // 28 fecha del comprobante modificado
      r.ref_tipo_documento,               // 29 tipo del comprobante modificado
      r.ref_serie,                        // 30 serie del comprobante modificado
      r.cod_dep_aduanera,                 // 31 código de la dependencia aduanera
      r.ref_numero,                       // 32 número del comprobante modificado
      r.clasificacion_bienes,             // 33 clasificación de bienes y servicios
      r.contrato,                         // 34 identificador del proyecto
      '',                                 // 35 porcentaje de participación
      '',                                 // 36 IMB (Ley 31053)
      '',                                 // 37 CAR original (ajustes posteriores)
      '', '', '', '',                     // 38-41 se envían vacíos
    ]);
  });
  return { filename: sireFilename(ruc, per, '080400'), content: body.join(EOL) + EOL };
}
