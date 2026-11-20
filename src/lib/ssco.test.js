import { describe, it, expect } from 'vitest';
import { buildXlsx } from './xlsx.js';
import { readXlsx, parseSharedStrings, colFromRef, parseSheet } from './xlsxRead.js';
import {
  COLUMNAS_SSCO, excelSerialToDate, normalizarDoc, parseSscoPadron, buildSscoIndex,
  consultarSsco, marcarSsco, resumenSsco, fechaLimiteRevision,
} from './ssco.js';

const CABECERA = [
  'RUC', 'Razón social', 'Domicilio fiscal', 'Resolución de atribución como SSCO',
  'Fecha de emisión de la resolución de atribución',
  'Fecha en la que la resolución de atribución quedó firme',
  'RUC o documento de identidad del representante legal (1)',
  'Apellidos y nombres del representante legal', 'Fecha de publicación (2)',
];

const FILA = [
  10001276510, 'TAPIA GONZALES MONICA FABIOLA', 'AV. ALFREDO MENDIOLA NRO. 1018',
  'Resolución de Intendencia N.º 024-024-0090639/SUNAT', 46293, 46310,
  '10001276510', 'TAPIA GONZALES MONICA FABIOLA', 46326,
];

describe('lector xlsx', () => {
  it('convierte referencias de columna a índice', () => {
    expect(colFromRef('A')).toBe(0);
    expect(colFromRef('Z')).toBe(25);
    expect(colFromRef('AA')).toBe(26);
    expect(colFromRef('AB')).toBe(27);
  });

  it('lee cadenas compartidas', () => {
    const xml = '<sst><si><t>Hola</t></si><si><r><t>Mun</t></r><r><t>do</t></r></si></sst>';
    expect(parseSharedStrings(xml)).toEqual(['Hola', 'Mundo']);
  });

  it('descomprime y lee un .xlsx generado localmente', async () => {
    const bytes = buildXlsx([{ name: 'Hoja1', rows: [CABECERA, FILA] }]);
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const sheets = await readXlsx(ab);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows[0][0]).toBe('RUC');
    expect(sheets[0].rows[1][0]).toBe(10001276510);
    expect(sheets[0].rows[1][1]).toBe('TAPIA GONZALES MONICA FABIOLA');
  });

  it('parsea una hoja respetando huecos de columna', () => {
    const xml = '<row><c r="A1" t="s"><v>0</v></c><c r="C1"><v>7</v></c></row>';
    const rows = parseSheet(xml, ['texto']);
    expect(rows[0][0]).toBe('texto');
    expect(rows[0][1]).toBeUndefined();
    expect(rows[0][2]).toBe(7);
  });
});

describe('padrón SSCO', () => {
  it('convierte el serial de fecha de Excel', () => {
    expect(excelSerialToDate(46293)).toBe('2026-09-28');
    expect(excelSerialToDate('')).toBe('');
    expect(excelSerialToDate(0)).toBe('');
  });

  it('normaliza RUC/DNI a dígitos', () => {
    expect(normalizarDoc('10-001276510')).toBe('10001276510');
    expect(normalizarDoc(20123456789)).toBe('20123456789');
  });

  it('parsea el padrón saltando la cabecera', () => {
    const registros = parseSscoPadron([CABECERA, FILA]);
    expect(registros).toHaveLength(1);
    const r = registros[0];
    expect(r.ruc).toBe('10001276510');
    expect(r.razon_social).toBe('TAPIA GONZALES MONICA FABIOLA');
    expect(r.fecha_emision).toBe('2026-09-28');
    expect(r.fecha_publicacion).toBe('2026-10-31');
    expect(COLUMNAS_SSCO.ruc).toBe(0);
  });

  it('ignora filas sin RUC', () => {
    expect(parseSscoPadron([CABECERA, ['', 'SIN RUC']])).toEqual([]);
    expect(parseSscoPadron([])).toEqual([]);
  });

  it('consulta por RUC en el índice', () => {
    const index = buildSscoIndex(parseSscoPadron([CABECERA, FILA]));
    expect(consultarSsco(index, '10001276510')?.razon_social).toBe('TAPIA GONZALES MONICA FABIOLA');
    expect(consultarSsco(index, '20123456789')).toBeNull();
    expect(consultarSsco(null, '10001276510')).toBeNull();
  });

  it('marca las filas del libro cuya contraparte es SSCO', () => {
    const index = buildSscoIndex(parseSscoPadron([CABECERA, FILA]));
    const filas = marcarSsco([
      { proveedor: { num_doc: '10001276510' }, igv: 144, total: 944 },
      { proveedor: { num_doc: '20123456789' }, igv: 18, total: 118 },
    ], index);
    expect(filas[0].ssco).toBe(true);
    expect(filas[0].ssco_detalle.resolucion).toContain('024-024-0090639');
    expect(filas[1].ssco).toBe(false);
  });

  it('resume el IGV sin crédito y el importe sin gasto', () => {
    const index = buildSscoIndex(parseSscoPadron([CABECERA, FILA]));
    const filas = marcarSsco([
      { proveedor: { num_doc: '10001276510' }, igv: 144, total: 944 },
      { proveedor: { num_doc: '10001276510' }, igv: 180, total: 1180 },
      { proveedor: { num_doc: '20123456789' }, igv: 18, total: 118 },
    ], index);
    const r = resumenSsco(filas);
    expect(r.total).toBe(3);
    expect(r.ssco).toBe(2);
    expect(r.igv_sin_credito).toBe(324);
    expect(r.importe_sin_gasto).toBe(2124);
  });

  it('calcula una fecha de referencia para la solicitud de revisión', () => {
    expect(fechaLimiteRevision('2026-10-31')).toBe('2026-12-12');
    expect(fechaLimiteRevision('')).toBe('');
  });
});
