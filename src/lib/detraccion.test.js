import { describe, it, expect } from 'vitest';
import { DETRACCIONES, montoDetraccion, porcentajeDetraccion } from './detraccion.js';

describe('catálogo de detracciones (RS 183-2004/SUNAT)', () => {
  it('no repite códigos', () => {
    const codes = DETRACCIONES.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('incluye los porcentajes oficiales de bienes y servicios', () => {
    expect(porcentajeDetraccion('003')).toBe(9);   // recursos hidrobiológicos
    expect(porcentajeDetraccion('005')).toBe(10);  // algodón
    expect(porcentajeDetraccion('014')).toBe(4);   // leche cruda
    expect(porcentajeDetraccion('016')).toBe(12);  // intermediación laboral
    expect(porcentajeDetraccion('020')).toBe(12);  // otros servicios empresariales
    expect(porcentajeDetraccion('024')).toBe(4);   // contratos de construcción
  });

  it('devuelve 0 para un código desconocido', () => {
    expect(porcentajeDetraccion('999')).toBe(0);
  });
});

describe('monto de detracción', () => {
  it('calcula el porcentaje sobre el importe de la operación', () => {
    expect(montoDetraccion(1000, 12)).toBe(120);
    expect(montoDetraccion(1000, 4)).toBe(40);
  });

  it('redondea a dos decimales', () => {
    expect(montoDetraccion(333.33, 12)).toBe(40);
    expect(montoDetraccion(100, 9)).toBe(9);
  });

  it('trata valores vacíos como cero', () => {
    expect(montoDetraccion(null, 12)).toBe(0);
    expect(montoDetraccion(1000, null)).toBe(0);
  });
});
