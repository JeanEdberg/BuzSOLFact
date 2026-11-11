// Datos de demostración. En producción se reemplazan por las respuestas de la
// API de facturación (listDocumentos) y por los comprobantes del buzón.

export const empresa = {
  ruc: '20614684772',
  razon_social: 'INMOA ERP & FACTURACIÓN S.A.C.',
};

export const notificaciones = [
  { id: 1, entidad: 'SUNAT', titulo: 'Resolución de Intendencia N° 023-2026', fecha: '2026-11-10', tipo: 'Alerta' },
  { id: 2, entidad: 'SUNAFIL', titulo: 'Notificación de Inspección Laboral N° 890-2026', fecha: '2026-11-09', tipo: 'Urgente' },
];

// Comprobantes de venta (emitidos) y de compra (recibidos). Cada uno expone los
// importes que consumen tanto la tabla de descargas como los generadores PLE.
export const comprobantesVenta = [
  {
    id: 101, tipo_documento: '01', serie: 'F001', numero: '0000142',
    fecha_emision: '2026-11-10', estado_sunat: 'ACEPTADO', moneda: 'PEN', tipo_cambio: 1,
    cliente: { tipo_doc: '6', num_doc: '20512345678', razon_social: 'Inversiones Plumífero E.I.R.L.' },
    bi_gravada: 1000, igv: 180, total: 1180,
  },
  {
    id: 102, tipo_documento: '03', serie: 'B001', numero: '0000388',
    fecha_emision: '2026-11-10', estado_sunat: 'ACEPTADO', moneda: 'PEN', tipo_cambio: 1,
    cliente: { tipo_doc: '1', num_doc: '45678912', razon_social: 'Pérez Gómez, Juan' },
    bi_gravada: 250, igv: 45, total: 295,
  },
  {
    id: 103, tipo_documento: '01', serie: 'F001', numero: '0000143',
    fecha_emision: '2026-11-10', estado_sunat: 'PENDIENTE', moneda: 'USD', tipo_cambio: 3.75,
    cliente: { tipo_doc: '6', num_doc: '20987654321', razon_social: 'Exportadora del Sur S.A.C.' },
    valor_exportacion: 5000, exonerada: 0, total: 5000,
  },
];

export const comprobantesCompra = [
  {
    id: 501, tipo_documento: '01', serie: 'F010', numero: '0008877',
    fecha_emision: '2026-11-05', estado_sunat: 'ACEPTADO', moneda: 'PEN', tipo_cambio: 1,
    proveedor: { tipo_doc: '6', num_doc: '20100123456', razon_social: 'Distribuidora Andina S.A.C.' },
    bi_gravada: 800, igv: 144, total: 944,
  },
  {
    id: 502, tipo_documento: '01', serie: 'F020', numero: '0000123',
    fecha_emision: '2026-11-07', estado_sunat: 'ACEPTADO', moneda: 'PEN', tipo_cambio: 1,
    proveedor: { tipo_doc: '6', num_doc: '20405060708', razon_social: 'Servicios Integrales del Perú S.A.' },
    bi_gravada: 1500, igv: 270, total: 1770,
  },
  {
    id: 503, tipo_documento: '01', serie: 'F030', numero: '0000456',
    fecha_emision: '2026-11-08', estado_sunat: 'ACEPTADO', moneda: 'PEN', tipo_cambio: 1,
    proveedor: { tipo_doc: '6', num_doc: '20707070707', razon_social: 'Transportes Rápidos E.I.R.L.' },
    no_gravada: 400, total: 400,
  },
];
