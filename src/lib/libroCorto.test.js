import { describe, it, expect } from 'vitest';
import { columnRef, buildXlsx } from './xlsx.js';
import {
  LEYENDAS_AMAZONIA, leyendaAmazonia, verificacionSire, descripcion, marcadorSsco,
  estadoLegible, hojaVentas, hojaCompras, buildLibroCorto,
} from './libroCorto.js';

describe('referencias de columna', () => {
  it('convierte índice a letra de Excel', () => {
    expect(columnRef(0)).toBe('A');
    expect(columnRef(25)).toBe('Z');
    expect(columnRef(26)).toBe('AA');
    expect(columnRef(27)).toBe('AB');
  });
});

describe('libro corto', () => {
  const venta = {
    fecha_emision: '2026-11-10',
    cliente: { num_doc: '20512345678', razon_social: 'Inversiones Plumífero E.I.R.L.' },
    detalles: [{ descripcion: 'Servicio de instalación' }],
    bi_gravada: 1000, igv: 180, inafecta: 0, exonerada: 0, isc: 0, total: 1180,
    estado_sunat: 'ACEPTADO',
    xml_path: 'x.xml', cdr_path: 'x.zip', pdf_path: 'x.pdf',
    leyendas: [{ code: '2001', value: LEYENDAS_AMAZONIA['2001'] }],
  };

  it('detecta la leyenda de Amazonía por su código', () => {
    expect(leyendaAmazonia(venta.leyendas)).toBe(LEYENDAS_AMAZONIA['2001']);
    expect(leyendaAmazonia([{ code: '1000', value: 'SON...' }])).toBe('');
    expect(leyendaAmazonia(null)).toBe('');
  });

  it('resume los artefactos disponibles', () => {
    expect(verificacionSire(venta)).toBe('XML+CDR+PDF');
    expect(verificacionSire({ xml_path: 'x' })).toBe('XML');
    expect(verificacionSire({})).toBe('—');
  });

  it('resume la descripción y agrega el conteo de ítems', () => {
    expect(descripcion(venta)).toBe('Servicio de instalación');
    expect(descripcion({ detalles: [{ descripcion: 'A' }, { descripcion: 'B' }] })).toBe('A (+1 ítem)');
    expect(descripcion({ descripcion: 'Suelta' })).toBe('Suelta');
  });

  it('traduce el estado SUNAT', () => {
    expect(estadoLegible('ACEPTADO')).toBe('Aceptado');
    expect(estadoLegible('ANULADO')).toBe('Anulado');
    expect(estadoLegible(null)).toBe('Pendiente');
  });

  it('arma la hoja de ventas con las columnas pedidas', () => {
    const { rows } = hojaVentas([venta]);
    expect(rows[0]).toEqual([
      'Fecha', 'RUC', 'Cliente', 'Descripción', 'Base', 'IGV', 'Inafecto',
      'Exonerado', 'ISC', 'Total', 'Estado', 'Verificación SIRE', 'Amazonía', 'SSCO',
    ]);
    const fila = rows[1];
    expect(fila[0]).toBe('10/11/2026');
    expect(fila[1]).toBe('20512345678');
    expect(fila[3]).toBe('Servicio de instalación');
    expect(fila[9]).toBe(1180);
    expect(fila[10]).toBe('Aceptado');
    expect(fila[11]).toBe('XML+CDR+PDF');
    expect(fila[12]).toBe(LEYENDAS_AMAZONIA['2001']);
    expect(fila[13]).toBe('');
  });

  it('marca los comprobantes de proveedores SSCO', () => {
    const compraSsco = {
      fecha_emision: '2026-11-05',
      proveedor: { num_doc: '10001276510', razon_social: 'TAPIA GONZALES MONICA FABIOLA' },
      bi_gravada: 800, igv: 144, total: 944,
      ssco: true,
      ssco_detalle: { resolucion: 'Resolución de Intendencia N.º 024-024-0090639/SUNAT' },
    };
    expect(marcadorSsco(compraSsco)).toContain('SSCO');
    expect(marcadorSsco(compraSsco)).toContain('024-024-0090639');
    expect(marcadorSsco({ ssco: false })).toBe('');
    const { rows } = hojaCompras([compraSsco]);
    expect(rows[1][13]).toContain('SSCO');
  });

  it('usa "Proveedor" en compras y suma totales', () => {
    const compras = [{
      fecha_emision: '2026-11-05',
      proveedor: { num_doc: '20100123456', razon_social: 'Distribuidora Andina S.A.C.' },
      detalles: [{ descripcion: 'Compra de mercadería' }],
      bi_gravada: 800, igv: 144, total: 944, estado_sunat: 'ACEPTADO',
    }];
    const { rows } = hojaCompras(compras);
    expect(rows[0][2]).toBe('Proveedor');
    const total = rows[rows.length - 1];
    expect(total[0]).toBe('TOTAL');
    expect(total[4]).toBe(800);
    expect(total[9]).toBe(944);
  });

  it('genera un .xlsx no vacío con la firma ZIP (PK)', () => {
    const { bytes, filename } = buildLibroCorto([venta], []);
    expect(filename).toBe('Libro_Ventas_Compras.xlsx');
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

describe('generador xlsx', () => {
  it('incluye las partes obligatorias del contenedor OOXML', () => {
    const bytes = buildXlsx([{ name: 'Hoja1', rows: [['a', 1]] }]);
    const text = Buffer.from(bytes).toString('latin1');
    for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) {
      expect(text).toContain(part);
    }
  });

  it('escapa los caracteres especiales del XML', () => {
    const bytes = buildXlsx([{ name: 'H', rows: [['a & b < c > "d"']] }]);
    const text = Buffer.from(bytes).toString('utf8');
    expect(text).toContain('a &amp; b &lt; c &gt; &quot;d&quot;');
  });
});
