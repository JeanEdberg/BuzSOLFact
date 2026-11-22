// Catálogo de detracciones del SPOT (DL 940).
// Fuente: RS 183-2004/SUNAT, Anexos 1, 2 y 3, con las modificaciones de la
// RS 056-2006/SUNAT (porcentajes) y RS 258-2005/SUNAT (servicios incorporados).
// El porcentaje es el aplicable al importe de la operación.
export const DETRACCIONES = [
  // Anexo 1: bienes
  { code: '001', anexo: 1, name: 'Azúcar', porcentaje: 10 },
  { code: '002', anexo: 1, name: 'Alcohol etílico', porcentaje: 10 },
  // Anexo 2: bienes
  { code: '003', anexo: 2, name: 'Recursos hidrobiológicos', porcentaje: 9 },
  { code: '004', anexo: 2, name: 'Maíz amarillo duro', porcentaje: 7 },
  { code: '005', anexo: 2, name: 'Algodón', porcentaje: 10 },
  { code: '006', anexo: 2, name: 'Caña de azúcar', porcentaje: 10 },
  { code: '007', anexo: 2, name: 'Arena y piedra', porcentaje: 10 },
  { code: '008', anexo: 2, name: 'Residuos, subproductos, desechos, recortes y desperdicios', porcentaje: 10 },
  { code: '009', anexo: 2, name: 'Bienes del inciso A) del Apéndice I de la Ley del IGV', porcentaje: 10 },
  { code: '011', anexo: 2, name: 'Aceite de pescado', porcentaje: 9 },
  { code: '012', anexo: 2, name: 'Harina, polvo y "pellets" de pescado', porcentaje: 9 },
  { code: '013', anexo: 2, name: 'Embarcaciones pesqueras', porcentaje: 9 },
  { code: '014', anexo: 2, name: 'Leche cruda entera', porcentaje: 4 },
  { code: '015', anexo: 2, name: 'Madera', porcentaje: 9 },
  // Anexo 3: servicios
  { code: '016', anexo: 3, name: 'Intermediación laboral y tercerización', porcentaje: 12 },
  { code: '017', anexo: 3, name: 'Arrendamiento de bienes', porcentaje: 12 },
  { code: '018', anexo: 3, name: 'Mantenimiento y reparación de bienes muebles', porcentaje: 9 },
  { code: '019', anexo: 3, name: 'Movimiento de carga', porcentaje: 12 },
  { code: '020', anexo: 3, name: 'Otros servicios empresariales', porcentaje: 12 },
  { code: '021', anexo: 3, name: 'Comisión mercantil', porcentaje: 12 },
  { code: '022', anexo: 3, name: 'Fabricación de bienes por encargo', porcentaje: 12 },
  { code: '023', anexo: 3, name: 'Servicio de transporte de personas', porcentaje: 12 },
  { code: '024', anexo: 3, name: 'Contratos de construcción', porcentaje: 4 },
  { code: '025', anexo: 3, name: 'Demás servicios gravados con el IGV', porcentaje: 12 },
];

// La operación está sujeta a detracción cuando supera media (1/2) UIT. El monto
// se calcula sobre el importe total de la operación.
export function montoDetraccion(importe, porcentaje) {
  return Math.round((Number(importe) || 0) * (Number(porcentaje) || 0)) / 100;
}

export function porcentajeDetraccion(code) {
  return DETRACCIONES.find((d) => d.code === code)?.porcentaje ?? 0;
}
