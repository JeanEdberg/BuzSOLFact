import { describe, it, expect } from 'vitest';
import { buildRvie, buildRce, sireFilename } from './sire.js';

const ruc = '20614684772';

const venta = {
  tipo_documento: '01', serie: 'F001', numero: '0000142', numero_final: '0000142',
  fecha_emision: '2026-11-10', periodo: '2026-11', moneda: 'PEN', tipo_cambio: 1,
  cliente: { tipo_doc: '6', num_doc: '20512345678', razon_social: 'Inversiones Plumífero E.I.R.L.' },
  bi_gravada: 1000, igv: 180, icbper: 0, total: 1180,
};

const compra = {
  tipo_documento: '01', serie: 'F010', numero: '0008877', numero_final: '0008877',
  fecha_emision: '2026-11-05', periodo: '2026-11', moneda: 'PEN', tipo_cambio: 1,
  proveedor: { tipo_doc: '6', num_doc: '20100123456', razon_social: 'Distribuidora Andina S.A.C.' },
  bi_gravada: 800, igv: 144, icbper: 0, total: 944,
};

const opts = { ruc, razon_social: 'INMOA ERP & FACTURACIÓN S.A.C.' };

describe('formato SIRE', () => {
  it('arma el nombre oficial del archivo', () => {
    expect(sireFilename(ruc, '2026-11', '140400')).toBe(`LE${ruc}20261100140400021112.TXT`);
    expect(sireFilename(ruc, '2026-11', '080400')).toBe(`LE${ruc}20261100080400021112.TXT`);
  });

  it('RVIE informa 33 campos (34-40 los completa la Administración)', () => {
    const { content, filename } = buildRvie([venta], opts);
    const cols = content.trimEnd().split('|');
    expect(filename).toMatch(/140400/);
    expect(cols).toHaveLength(34);            // 33 campos + vacío final por el '|'
    expect(cols[0]).toBe(ruc);                // RUC del generador
    expect(cols[2]).toBe('202611');           // periodo AAAAMM
    expect(cols[3]).toBe('');                 // CAR vacío
    expect(cols[6]).toBe('01');               // tipo comprobante
    expect(cols[13]).toBe('0.00');            // valor exportación
    expect(cols[14]).toBe('1000.00');         // base gravada
    expect(cols[16]).toBe('180.00');          // IGV
    expect(cols[23]).toBe('0.00');            // ICBPER (no existe en PLE)
    expect(cols[25]).toBe('1180.00');         // importe total
    expect(cols[26]).toBe('PEN');             // moneda
  });

  it('RCE informa 41 campos (38-41 vacíos)', () => {
    const { content, filename } = buildRce([compra], opts);
    const cols = content.trimEnd().split('|');
    expect(filename).toMatch(/080400/);
    expect(cols).toHaveLength(42);            // 41 campos + vacío final
    expect(cols[11]).toBe('6');               // tipo doc proveedor
    expect(cols[12]).toBe('20100123456');
    expect(cols[14]).toBe('800.00');          // BI gravada DG
    expect(cols[15]).toBe('144.00');          // IGV DG
    expect(cols[24]).toBe('944.00');          // importe total
    expect(cols.slice(37, 41)).toEqual(['', '', '', '']); // 38-41 vacíos
  });

  it('usa CRLF como fin de línea', () => {
    const { content } = buildRvie([venta, venta], opts);
    expect(content.endsWith('\r\n')).toBe(true);
    expect(content.split('\r\n').filter(Boolean)).toHaveLength(2);
  });
});
