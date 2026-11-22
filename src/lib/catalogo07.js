// Catálogo N.º 07 de SUNAT: códigos de tipo de afectación del IGV.
// Fuente: RS 117-2017/SUNAT, Anexo VII (campo cbc:TaxExemptionReasonCode).
export const CATALOGO07 = [
  { code: '10', name: 'Gravado - Operación Onerosa' },
  { code: '11', name: 'Gravado - Retiro por premio' },
  { code: '12', name: 'Gravado - Retiro por donación' },
  { code: '13', name: 'Gravado - Retiro' },
  { code: '14', name: 'Gravado - Retiro por publicidad' },
  { code: '15', name: 'Gravado - Bonificaciones' },
  { code: '16', name: 'Gravado - Retiro por entrega a trabajadores' },
  { code: '17', name: 'Gravado - IVAP' },
  { code: '20', name: 'Exonerado - Operación Onerosa' },
  { code: '21', name: 'Exonerado - Transferencia Gratuita' },
  { code: '30', name: 'Inafecto - Operación Onerosa' },
  { code: '31', name: 'Inafecto - Retiro por Bonificación' },
  { code: '32', name: 'Inafecto - Retiro' },
  { code: '33', name: 'Inafecto - Retiro por Muestras Médicas' },
  { code: '34', name: 'Inafecto - Retiro por Convenio Colectivo' },
  { code: '35', name: 'Inafecto - Retiro por premio' },
  { code: '36', name: 'Inafecto - Retiro por publicidad' },
  { code: '40', name: 'Exportación' },
];

// El gravado usa 18% (16% IGV + 2% IPM). El IVAP (arroz pilado) usa 4%.
// El resto del catálogo no lleva IGV.
export const CODIGOS_GRAVADOS = ['10', '11', '12', '13', '14', '15', '16'];

export function porcentajeIgvDe(codigo) {
  if (codigo === '17') return 4;
  return CODIGOS_GRAVADOS.includes(codigo) ? 18 : 0;
}

export function nombreAfectacion(codigo) {
  return CATALOGO07.find((a) => a.code === codigo)?.name ?? codigo;
}
