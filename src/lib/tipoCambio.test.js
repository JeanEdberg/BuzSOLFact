import { describe, it, expect, vi } from 'vitest';
import {
  parseTipoCambio, normalizarFecha, elegirTasa, crearServicioTipoCambio,
} from './tipoCambio.js';

describe('tipo de cambio SUNAT', () => {
  it('parsea el TXT oficial (fecha|compra|venta)', () => {
    expect(parseTipoCambio('10/11/2026|3.409|3.418|')).toEqual({
      fecha: '2026-11-10', compra: 3.409, venta: 3.418,
    });
    expect(parseTipoCambio('10/11/2026|3.409|3.418|\r\n')).toEqual({
      fecha: '2026-11-10', compra: 3.409, venta: 3.418,
    });
  });

  it('devuelve null si el TXT no tiene el formato esperado', () => {
    expect(parseTipoCambio('')).toBeNull();
    expect(parseTipoCambio('<html>error</html>')).toBeNull();
    expect(parseTipoCambio('2026-11-10|3.409|3.418')).toBeNull();
  });

  it('normaliza fechas ISO y latinas', () => {
    expect(normalizarFecha('2026-11-10T00:00:00.000000Z')).toBe('2026-11-10');
    expect(normalizarFecha('10/11/2026')).toBe('2026-11-10');
    expect(normalizarFecha('')).toBe('');
  });

  it('usa la tasa de venta para convertir a soles', () => {
    expect(elegirTasa({ compra: 3.4, venta: 3.42 })).toBe(3.42);
    expect(elegirTasa({ compra: 3.4 })).toBe(3.4);
    expect(elegirTasa(null)).toBeNull();
  });

  it('consulta una sola vez por fecha (caché)', async () => {
    const fetchCotizacion = vi.fn(async () => ({ fecha: '2026-11-10', compra: 3.4, venta: 3.42 }));
    const servicio = crearServicioTipoCambio({ fetchCotizacion });

    const [a, b] = await Promise.all([servicio.obtener('2026-11-10'), servicio.obtener('2026-11-10T00:00:00Z')]);
    expect(a).toBe(3.42);
    expect(b).toBe(3.42);
    expect(fetchCotizacion).toHaveBeenCalledTimes(1);
  });

  it('detecta las fechas sin tasa y las precarga', async () => {
    const fetchCotizacion = vi.fn(async (fecha) => ({ fecha, compra: 3.4, venta: 3.42 }));
    const servicio = crearServicioTipoCambio({ fetchCotizacion });

    const documentos = [
      { moneda: 'PEN', fecha_emision: '2026-11-10' },                          // no requiere
      { moneda: 'USD', fecha_emision: '2026-11-10T00:00:00.000000Z' },         // requiere
      { moneda: 'USD', fecha_emision: '2026-11-09' },                          // requiere
      { moneda: 'USD', fecha_emision: '2026-11-09', tipo_cambio: 3.75 },       // ya resuelto
    ];

    expect(servicio.faltantes(documentos).sort()).toEqual(['2026-11-09', '2026-11-10']);
    await servicio.precargar(servicio.faltantes(documentos));
    expect(servicio.faltantes(documentos)).toEqual([]);
    expect(fetchCotizacion).toHaveBeenCalledTimes(2);
  });
});
