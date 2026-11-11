// Tasa especial y temporal del IGV para MYPE de restaurantes, hoteles y
// alojamientos turísticos (Ley 31556).
//
// Marco normativo:
//  - Ley 31556 (12/08/2022): tasa especial del 8 % del IGV, vigente del
//    01/09/2022 al 31/12/2024 (art. 4 original).
//  - Ley 32219 (29/12/2024): prorroga el 8 % para los ejercicios 2025 y 2026,
//    y fija el 12 % para 2027 (modifica los arts. 1, 3 y 4 de la Ley 31556).
//  - Ley 32387 (16/06/2025): eleva gradualmente el Impuesto de Promoción
//    Municipal (IPM) del 2 % al 4 % (+0,5 % anual desde 2026), sin afectar el
//    8 % del IGV del régimen especial.
//
// En el comprobante el porcentaje de IGV se reporta como la tasa total (IGV +
// IPM), igual que el 18 % del régimen general (16 % de IGV + 2 % de IPM). Por
// eso la tasa especial aplicable es:
//   - 2022-2025: 8 % + 2 %   = 10 %
//   - 2026:      8 % + 2,5 % = 10,5 %
//   - 2027:      12 % + 3 %  = 15 %

export const IGV_ESPECIAL = 8;

// Tasa especial del IGV (componente IGV) según el año de emisión: 8 % entre
// 2022 y 2026 y 12 % en 2027. Fuera de ese rango no hay tasa especial.
export function tasaEspecialIgv(anio) {
  const y = Number(anio);
  if (y >= 2022 && y <= 2026) return 8;
  if (y === 2027) return 12;
  return 0;
}

// Impuesto de Promoción Municipal según el año (Ley 32387): 2 % hasta 2025 y
// +0,5 % por año desde 2026 hasta 4 %.
export function tasaIPM(anio) {
  const y = Number(anio);
  if (y >= 2029) return 4;
  if (y >= 2026) return 2 + 0.5 * (y - 2025);
  return 2;
}

// Tasa total del régimen especial (IGV especial + IPM) del año. Es el
// porcentaje que viaja en cada línea gravada.
export function tasaEspecialTotal(anio) {
  return tasaEspecialIgv(anio) + tasaIPM(anio);
}

// Tasa total del régimen general vigente en la práctica de SUNAT (16 % de IGV
// + 2 % de IPM). La Ley 32387 modificó el art. 17 del TUO del IGV (14 %) y el
// art. 76 de la Ley de Tributación Municipal (IPM hasta 4 %), pero su
// aplicación cuantitativa es progresiva y la plataforma mantiene el 18 %; se
// deja como constante para no alterar el cálculo del régimen general.
export const TASA_GENERAL = 18;

// ¿Está vigente la tasa especial en el año indicado? (2025-2026 al 8 % de IGV;
// 2027 al 12 %). Fuera de ese rango rige la tasa general.
export function vigenteTasaEspecial(anio) {
  const y = Number(anio);
  return y >= 2025 && y <= 2027;
}
