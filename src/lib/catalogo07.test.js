import { describe, it, expect } from 'vitest';
import { CATALOGO07, CODIGOS_GRAVADOS, porcentajeIgvDe, nombreAfectacion } from './catalogo07.js';

describe('catálogo 07 de afectación del IGV', () => {
  it('incluye los códigos oficiales de la RS 117-2017/SUNAT', () => {
    const codes = CATALOGO07.map((a) => a.code);
    for (const c of ['10', '11', '12', '13', '14', '15', '16', '17', '20', '21',
      '30', '31', '32', '33', '34', '35', '36', '40']) {
      expect(codes).toContain(c);
    }
  });

  it('no repite códigos', () => {
    const codes = CATALOGO07.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('porcentaje de IGV por afectación', () => {
  it('aplica 18% (16% IGV + 2% IPM) a las operaciones gravadas', () => {
    for (const c of CODIGOS_GRAVADOS) {
      expect(porcentajeIgvDe(c)).toBe(18);
    }
  });

  it('aplica 4% al IVAP (arroz pilado)', () => {
    expect(porcentajeIgvDe('17')).toBe(4);
  });

  it('aplica 0% a exoneradas, inafectas y exportación', () => {
    for (const c of ['20', '21', '30', '31', '32', '33', '34', '35', '36', '40']) {
      expect(porcentajeIgvDe(c)).toBe(0);
    }
  });
});

describe('nombre de afectación', () => {
  it('resuelve el nombre y hace fallback al código', () => {
    expect(nombreAfectacion('10')).toBe('Gravado - Operación Onerosa');
    expect(nombreAfectacion('99')).toBe('99');
  });
});
