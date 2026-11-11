import { describe, it, expect } from 'vitest';
import {
  buildVentas141, buildCompras81, pleFilename, formatDate, money, period,
} from './ple.js';

const ruc = '20614684772';
const periodo = '2026-11';

const venta = {
  tipo_documento: '01', serie: 'F001', numero: '0000142',
  fecha_emision: '2026-11-10', moneda: 'PEN', tipo_cambio: 1,
  cliente: { tipo_doc: '6', num_doc: '20512345678', razon_social: 'Inversiones Plumífero E.I.R.L.' },
  bi_gravada: 1000, igv: 180, total: 1180,
};

describe('formato PLE', () => {
  it('normaliza fechas y montos', () => {
    expect(formatDate('2026-11-10')).toBe('10/11/2026');
    expect(money(1000)).toBe('1000.00');
    expect(money(undefined)).toBe('0.00');
    expect(period('2026-11')).toBe('20261100');
  });

  it('arma el nombre oficial del archivo', () => {
    expect(pleFilename(ruc, periodo, '140100')).toBe(`LE${ruc}20261100140100001111.TXT`);
    expect(pleFilename(ruc, periodo, '080100')).toBe(`LE${ruc}20261100080100001111.TXT`);
  });

  it('genera una línea de ventas con 34 campos terminada en |', () => {
    const { content, filename } = buildVentas141([venta], { ruc, periodo });
    const line = content.trimEnd();
    expect(filename).toMatch(/140100/);
    expect(line.endsWith('|')).toBe(true);
    expect(line.split('|')).toHaveLength(35); // 34 campos + vacío final por el '|'
  });

  it('coloca el periodo, la fecha y los importes en las columnas correctas', () => {
    const { content } = buildVentas141([venta], { ruc, periodo });
    const cols = content.trimEnd().split('|');
    expect(cols[0]).toBe('20261100');       // periodo
    expect(cols[3]).toBe('10/11/2026');     // fecha emisión
    expect(cols[5]).toBe('01');             // tipo comprobante
    expect(cols[6]).toBe('F001');           // serie
    expect(cols[7]).toBe('0000142');        // número
    expect(cols[9]).toBe('6');              // tipo doc cliente
    expect(cols[10]).toBe('20512345678');   // número doc cliente
    expect(cols[13]).toBe('1000.00');       // base imponible gravada
    expect(cols[15]).toBe('180.00');        // IGV
    expect(cols[23]).toBe('1180.00');       // importe total
    expect(cols[24]).toBe('PEN');           // moneda
    expect(cols[33]).toBe('1');             // estado
  });

  it('genera una línea de compras con 41 campos', () => {
    const compra = {
      tipo_documento: '01', serie: 'F010', numero: '0008877',
      fecha_emision: '2026-11-05', moneda: 'PEN', tipo_cambio: 1,
      proveedor: { tipo_doc: '6', num_doc: '20100123456', razon_social: 'Distribuidora Andina S.A.C.' },
      bi_gravada: 800, igv: 144, total: 944,
    };
    const { content, filename } = buildCompras81([compra], { ruc, periodo });
    const cols = content.trimEnd().split('|');
    expect(filename).toMatch(/080100/);
    expect(cols).toHaveLength(42);          // 41 campos + vacío final
    expect(cols[5]).toBe('01');
    expect(cols[10]).toBe('6');
    expect(cols[11]).toBe('20100123456');
    expect(cols[13]).toBe('800.00');        // BI gravada
    expect(cols[14]).toBe('144.00');        // IGV
    expect(cols[22]).toBe('944.00');        // importe total
    expect(cols[40]).toBe('1');             // estado
  });
});
