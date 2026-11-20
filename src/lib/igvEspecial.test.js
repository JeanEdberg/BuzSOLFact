import { describe, it, expect } from 'vitest';
import {
  IGV_ESPECIAL,
  TASA_GENERAL,
  tasaEspecialIgv,
  tasaIPM,
  tasaEspecialTotal,
  vigenteTasaEspecial,
} from './igvEspecial.js';

describe('tasa especial del IGV (Ley 31556 / 32219)', () => {
  it('aplica 8 % de IGV especial de 2022 a 2026', () => {
    expect(tasaEspecialIgv(2022)).toBe(8);
    expect(tasaEspecialIgv(2025)).toBe(8);
    expect(tasaEspecialIgv(2026)).toBe(8);
  });

  it('sube al 12 % en 2027', () => {
    expect(tasaEspecialIgv(2027)).toBe(12);
  });

  it('no hay tasa especial fuera de 2022-2027', () => {
    expect(tasaEspecialIgv(2021)).toBe(0);
    expect(tasaEspecialIgv(2028)).toBe(0);
  });

  it('mantiene la constante de IGV especial en 8 %', () => {
    expect(IGV_ESPECIAL).toBe(8);
  });
});

describe('Impuesto de Promoción Municipal (Ley 32387)', () => {
  it('usa 2 % hasta 2025', () => {
    expect(tasaIPM(2024)).toBe(2);
    expect(tasaIPM(2025)).toBe(2);
  });

  it('sube 0,5 % por año desde 2026 hasta 4 %', () => {
    expect(tasaIPM(2026)).toBe(2.5);
    expect(tasaIPM(2027)).toBe(3);
    expect(tasaIPM(2028)).toBe(3.5);
    expect(tasaIPM(2029)).toBe(4);
    expect(tasaIPM(2030)).toBe(4);
  });
});

describe('tasa total del régimen especial', () => {
  it('suma el IGV especial y el IPM del año', () => {
    expect(tasaEspecialTotal(2022)).toBe(10); // 8 + 2
    expect(tasaEspecialTotal(2025)).toBe(10); // 8 + 2
    expect(tasaEspecialTotal(2026)).toBe(10.5); // 8 + 2,5
    expect(tasaEspecialTotal(2027)).toBe(15); // 12 + 3
  });
});

describe('vigencia de la tasa especial', () => {
  it('rige entre 2025 y 2027', () => {
    expect(vigenteTasaEspecial(2024)).toBe(false);
    expect(vigenteTasaEspecial(2025)).toBe(true);
    expect(vigenteTasaEspecial(2027)).toBe(true);
    expect(vigenteTasaEspecial(2028)).toBe(false);
  });

  it('mantiene la tasa general del régimen común en 18 %', () => {
    expect(TASA_GENERAL).toBe(18);
  });
});
