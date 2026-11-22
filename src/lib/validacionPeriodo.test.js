import { describe, it, expect } from 'vitest';
import { buildRce } from './sire.js';
import { buildSscoIndex } from './ssco.js';
import { parsePropuestaSire } from './cruceSire.js';
import { validarPeriodo } from './validacionPeriodo.js';

const ctx = { ruc: '20614684772', razon_social: 'INMOA ERP & FACTURACIÓN S.A.C.' };

const compra = (numero, ruc, extra = {}) => ({
  id: Number(numero), tipo_documento: '01', serie: 'F010', numero,
  fecha_emision: '2026-11-05', moneda: 'PEN', tipo_cambio: 1,
  proveedor: { tipo_doc: '6', num_doc: ruc, razon_social: 'Proveedor X S.A.C.' },
  bi_gravada: 800, igv: 144, total: 944,
  ...extra,
});

const padron = buildSscoIndex([
  { ruc: '20100123456', razon_social: 'Distribuidora Andina S.A.C.', resolucion: 'Resolución N.º 024-024-0090639/SUNAT', fecha_publicacion: '2026-10-31' },
]);

describe('validación SSCO por periodo', () => {
  it('marca el comprobante del proveedor SSCO y devuelve su referencia', () => {
    const propios = [compra('0008877', '20100123456'), compra('0000123', '20405060708')];
    const rep = validarPeriodo({ propios, libro: 'compras', padronIndex: padron, periodo: '2026-11' });

    expect(rep.resumen.comprobantes).toBe(2);
    expect(rep.resumen.conSsco).toBe(1);
    expect(rep.hayHallazgos).toBe(true);
    expect(rep.sscoPropios).toHaveLength(1);
    expect(rep.sscoPropios[0]).toMatchObject({
      libro: 'compras', serie: 'F010', numero: '0008877', num_doc: '20100123456',
      resolucion: 'Resolución N.º 024-024-0090639/SUNAT', igv: 144, total: 944,
    });
  });

  it('detecta un SSCO que SUNAT propone y que no está en mi libro', () => {
    const propios = [compra('0000123', '20405060708')];
    // La propuesta RCE trae una compra de un proveedor SSCO no registrada.
    const propuesta = parsePropuestaSire(
      buildRce([
        { tipo_documento: '01', serie: 'F010', numero: '0000123', fecha_emision: '2026-11-05', periodo: '2026-11',
          moneda: 'PEN', tipo_cambio: 1, proveedor: { tipo_doc: '6', num_doc: '20405060708', razon_social: 'Servicios X S.A.' },
          bi_gravada: 800, igv: 144, total: 944 },
        { tipo_documento: '01', serie: 'F099', numero: '0009001', fecha_emision: '2026-11-09', periodo: '2026-11',
          moneda: 'PEN', tipo_cambio: 1, proveedor: { tipo_doc: '6', num_doc: '20100123456', razon_social: 'Distribuidora Andina S.A.C.' },
          bi_gravada: 500, igv: 90, total: 590 },
      ], ctx).content,
      'compras',
    );

    const rep = validarPeriodo({ propios, propuesta, libro: 'compras', padronIndex: padron, periodo: '2026-11' });
    expect(rep.conPropuesta).toBe(true);
    expect(rep.sscoPropuesta).toHaveLength(1);
    expect(rep.sscoPropuesta[0]).toMatchObject({ serie: 'F099', numero: '0009001', num_doc: '20100123456', igv: 90 });
    expect(rep.igvAfectado).toBe(90);
    expect(rep.importeAfectado).toBe(590);
  });

  it('suma el IGV afectado de los SSCO propios y de la propuesta', () => {
    const propios = [compra('0008877', '20100123456')];
    const rep = validarPeriodo({ propios, libro: 'compras', padronIndex: padron });
    expect(rep.resumen.igv_sin_credito).toBe(144);
    expect(rep.igvAfectado).toBe(144);
    expect(rep.importeAfectado).toBe(944);
  });

  it('sin hallazgos cuando ninguna contraparte es SSCO', () => {
    const propios = [compra('0000123', '20405060708'), compra('0000456', '20707070707')];
    const rep = validarPeriodo({ propios, libro: 'compras', padronIndex: padron });
    expect(rep.resumen.conSsco).toBe(0);
    expect(rep.hayHallazgos).toBe(false);
    expect(rep.sscoPropios).toHaveLength(0);
  });

  it('sin padrón no marca SSCO pero conserva el cruce con la propuesta', () => {
    const propios = [compra('0008877', '20100123456')];
    const propuesta = parsePropuestaSire(
      buildRce([{ tipo_documento: '01', serie: 'F010', numero: '0008877', fecha_emision: '2026-11-05', periodo: '2026-11',
        moneda: 'PEN', tipo_cambio: 1, proveedor: { tipo_doc: '6', num_doc: '20100123456', razon_social: 'Distribuidora Andina S.A.C.' },
        bi_gravada: 800, igv: 144, total: 944 }], ctx).content,
      'compras',
    );
    const rep = validarPeriodo({ propios, propuesta, libro: 'compras', padronIndex: null });
    expect(rep.resumen.conSsco).toBe(0);
    expect(rep.cruce.coincidencias).toHaveLength(1);
  });
});
