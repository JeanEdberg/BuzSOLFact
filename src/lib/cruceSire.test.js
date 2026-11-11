import { describe, it, expect } from 'vitest';
import {
  claveComprobante, parsePropuestaSire, cruzarConPropuesta,
} from './cruceSire.js';

const SEP = '|';
// Arma una línea del RVIE (ventas) con los campos que interesan al cruce.
function lineaRvie({ tipo = '01', serie = 'F001', numero = '00000142', doc = '20512345678', rs = 'Cliente SAC', bi = '1000.00', igv = '180.00', total = '1180.00', fecha = '10/11/2026' }) {
  const c = new Array(33).fill('');
  c[0] = '20614684772';
  c[2] = '202611';
  c[4] = fecha;
  c[6] = tipo;
  c[7] = serie;
  c[8] = numero;
  c[11] = doc;
  c[12] = rs;
  c[14] = bi;
  c[16] = igv;
  c[25] = total;
  c[26] = 'PEN';
  return c.join(SEP) + SEP;
}

// Arma una línea del RCE (compras).
function lineaRce({ tipo = '01', serie = 'F010', numero = '0008877', doc = '20100123456', rs = 'Proveedor SAC', bi = '800.00', igv = '144.00', total = '944.00', fecha = '05/11/2026' }) {
  const c = new Array(41).fill('');
  c[0] = '20614684772';
  c[2] = '202611';
  c[4] = fecha;
  c[6] = tipo;
  c[7] = serie;
  c[9] = numero;
  c[12] = doc;
  c[13] = rs;
  c[14] = bi;
  c[15] = igv;
  c[24] = total;
  c[25] = 'PEN';
  return c.join(SEP) + SEP;
}

describe('clave de comprobante', () => {
  it('normaliza el correlativo quitando ceros a la izquierda', () => {
    expect(claveComprobante('01', 'F001', '00000142', '20512345678'))
      .toBe(claveComprobante('01', 'f001', '142', '20512345678'));
  });
});

describe('parseo de la propuesta SIRE', () => {
  it('parsea el RVIE de ventas', () => {
    const txt = `${lineaRvie({})}\r\n`;
    const [r] = parsePropuestaSire(txt, 'ventas');
    expect(r.serie).toBe('F001');
    expect(r.numero).toBe('00000142');
    expect(r.bi_gravada).toBe(1000);
    expect(r.igv).toBe(180);
    expect(r.total).toBe(1180);
    expect(r.fecha_emision).toBe('2026-11-10');
    expect(r.clave).toBe(claveComprobante('01', 'F001', '00000142', '20512345678'));
  });

  it('parsea el RCE de compras', () => {
    const [r] = parsePropuestaSire(lineaRce({}), 'compras');
    expect(r.serie).toBe('F010');
    expect(r.numero).toBe('0008877');
    expect(r.num_doc).toBe('20100123456');
    expect(r.igv).toBe(144);
    expect(r.total).toBe(944);
  });

  it('ignora líneas vacías', () => {
    expect(parsePropuestaSire('\r\n\r\n', 'ventas')).toEqual([]);
  });
});

describe('cruce contra la propuesta SIRE', () => {
  const propio = {
    tipo_documento: '01', serie: 'F001', numero: '00000142',
    fecha_emision: '2026-11-10', moneda: 'PEN',
    cliente: { num_doc: '20512345678', razon_social: 'Cliente SAC' },
    bi_gravada: 1000, igv: 180, total: 1180,
  };

  it('detecta coincidencias exactas', () => {
    const propuesta = parsePropuestaSire(lineaRvie({}), 'ventas');
    const res = cruzarConPropuesta([propio], propuesta, 'ventas');
    expect(res.coincidencias).toHaveLength(1);
    expect(res.soloPropuesta).toHaveLength(0);
    expect(res.soloPropio).toHaveLength(0);
    expect(res.diferencias).toHaveLength(0);
  });

  it('detecta comprobantes que SUNAT propone y no están en mi libro', () => {
    const propuesta = parsePropuestaSire(lineaRvie({ numero: '00000999' }), 'ventas');
    const res = cruzarConPropuesta([propio], propuesta, 'ventas');
    expect(res.soloPropuesta).toHaveLength(1);
    expect(res.soloPropuesta[0].numero).toBe('00000999');
    expect(res.soloPropio).toHaveLength(1);
  });

  it('detecta diferencias de importes', () => {
    const propuesta = parsePropuestaSire(lineaRvie({ igv: '190.00' }), 'ventas');
    const res = cruzarConPropuesta([propio], propuesta, 'ventas');
    expect(res.diferencias).toHaveLength(1);
    expect(res.diferencias[0].cambios).toEqual([{ campo: 'igv', propio: 180, propuesta: 190 }]);
  });

  it('propaga la marca SSCO al resultado del cruce', () => {
    const compra = {
      tipo_documento: '01', serie: 'F010', numero: '0008877', moneda: 'PEN',
      proveedor: { num_doc: '10001276510', razon_social: 'TAPIA' },
      bi_gravada: 800, igv: 144, total: 944, ssco: true,
    };
    const propuesta = parsePropuestaSire(lineaRce({ doc: '10001276510' }), 'compras');
    const res = cruzarConPropuesta([compra], propuesta, 'compras');
    expect(res.ssco).toHaveLength(1);
    expect(res.coincidencias).toHaveLength(1);
  });
});
