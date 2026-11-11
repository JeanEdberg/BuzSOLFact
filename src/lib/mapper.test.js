import { describe, it, expect } from 'vitest';
import { mapVenta, mapCompra, normalizarLista, padCorrelativo, isoDate, recurso } from './mapper.js';
import { buildVentas141 } from './ple.js';
import { buildRvie } from './sire.js';

// Comprobante tal como lo devuelve la API (Invoice serializado por Laravel).
const invoice = {
  id: 10,
  tipo_documento: '01',
  serie: 'F001',
  correlativo: '142',
  fecha_emision: '2026-11-10T00:00:00.000000Z',
  fecha_vencimiento: '2026-11-10T00:00:00.000000Z',
  moneda: 'PEN',
  mto_oper_gravadas: '1000.00',
  mto_oper_exoneradas: '0.00',
  mto_oper_inafectas: '0.00',
  mto_oper_exportacion: '0.00',
  mto_igv: '180.00',
  mto_isc: '0.00',
  mto_icbper: '0.00',
  mto_otros_tributos: '0.00',
  mto_imp_venta: '1180.00',
  estado_sunat: 'ACEPTADO',
  client: { tipo_documento: '6', numero_documento: '20512345678', razon_social: 'Inversiones Plumífero E.I.R.L.' },
};

describe('mapper de la API', () => {
  it('normaliza fechas ISO y correlativos', () => {
    expect(isoDate('2026-11-10T00:00:00.000000Z')).toBe('2026-11-10');
    expect(padCorrelativo('142')).toBe('00000142');
    expect(padCorrelativo(7)).toBe('00000007');
    expect(padCorrelativo('A-1')).toBe('A-1'); // no numérico se respeta
  });

  it('normaliza las dos formas de respuesta del listado', () => {
    expect(normalizarLista({ data: [1, 2] })).toEqual([1, 2]);          // boletas: array plano
    expect(normalizarLista({ data: { data: [1, 2] } })).toEqual([1, 2]); // facturas: paginator
    expect(normalizarLista(null)).toEqual([]);
  });

  it('elige el recurso correcto según el tipo de documento', () => {
    expect(recurso({ tipo_documento: '03' })).toBe('boletas');
    expect(recurso({ tipo_documento: '01' })).toBe('invoices');
    expect(recurso({ tipo_documento: '07' })).toBe('invoices');
  });

  it('mapea el comprobante a una fila de ventas con las columnas correctas', () => {
    const fila = mapVenta(invoice);
    expect(fila.numero).toBe('00000142');
    expect(fila.fecha_emision).toBe('2026-11-10');
    expect(fila.bi_gravada).toBe('1000.00');
    expect(fila.igv).toBe('180.00');
    expect(fila.total).toBe('1180.00');
    expect(fila.cliente.num_doc).toBe('20512345678');
    expect(fila.tipo_cambio).toBe(1); // PEN => 1
  });

  it('deja el tipo de cambio en null si la moneda no es PEN y no se informa', () => {
    const usd = { ...invoice, moneda: 'USD' };
    expect(mapVenta(usd).tipo_cambio).toBeNull();
    expect(mapVenta(usd, { tipoCambio: 3.75 }).tipo_cambio).toBe(3.75);
    expect(mapVenta(usd, { tipoCambio: () => 3.8 }).tipo_cambio).toBe(3.8);
  });

  it('la fila mapeada alimenta los generadores PLE y SIRE sin huecos', () => {
    const fila = { ...mapVenta(invoice), periodo: '2026-11' };
    const ple = buildVentas141([fila], { ruc: '20614684772', periodo: '2026-11' });
    const cols = ple.content.trimEnd().split('|');
    expect(cols[13]).toBe('1000.00'); // base imponible
    expect(cols[15]).toBe('180.00');  // IGV
    expect(cols[23]).toBe('1180.00'); // total
    expect(cols[24]).toBe('PEN');     // moneda
    expect(cols[25]).toBe('1.000');   // tipo de cambio

    const rvie = buildRvie([fila], { ruc: '20614684772', razon_social: 'INMOA' });
    expect(rvie.content.trimEnd().split('|')).toHaveLength(34);
  });

  it('mapea una compra con proveedor', () => {
    const compra = { ...invoice, proveedor: invoice.client, mto_oper_exoneradas: '400.00', mto_imp_venta: '400.00' };
    const fila = mapCompra(compra);
    expect(fila.proveedor.num_doc).toBe('20512345678');
    expect(fila.no_gravada).toBe('400.00');
  });

  it('mapea una compra tal como la devuelve el registro de compras de la API', () => {
    // Forma real: el modelo Compra expone 'proveedor' anidado con el mismo
    // vocabulario que el frontend, y los importes en mto_*.
    const compra = {
      id: 7,
      tipo_documento: '01',
      serie: 'F010',
      correlativo: '0008877',
      fecha_emision: '2026-11-05T00:00:00.000000Z',
      moneda: 'USD',
      tipo_cambio: '3.750',
      mto_oper_gravadas: '800.00',
      mto_igv: '144.00',
      mto_imp_venta: '944.00',
      estado_sunat: 'ACEPTADO',
      proveedor: { tipo_documento: '6', numero_documento: '20100123456', razon_social: 'Distribuidora Andina S.A.C.' },
    };

    const fila = mapCompra(compra);

    expect(fila.numero).toBe('00008877');
    expect(fila.fecha_emision).toBe('2026-11-05');
    expect(fila.proveedor.razon_social).toBe('Distribuidora Andina S.A.C.');
    expect(fila.bi_gravada).toBe('800.00');
    expect(fila.igv).toBe('144.00');
    expect(fila.total).toBe('944.00');
    expect(fila.tipo_cambio).toBe('3.750');
  });
});
