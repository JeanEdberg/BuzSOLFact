// Cruce entre la información del contribuyente (sus comprobantes) y la
// propuesta del SIRE que publica la SUNAT.
//
// La propuesta SIRE es un archivo TXT con el mismo formato que genera
// `sire.js`:
//   * RVIE (ventas)  -> archivo 140400, 33 campos.
//   * RCE  (compras) -> archivo 080400, 37 campos informados.
// Aquí se parsea ese TXT y se compara contra los comprobantes propios para
// detectar diferencias antes de aceptar la propuesta.

const SEP = '|';

function campos(linea) {
  // Cada línea termina en '|'; se descarta el último elemento vacío.
  const partes = linea.split(SEP);
  if (partes.length && partes[partes.length - 1] === '') partes.pop();
  return partes;
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const txt = (v) => String(v ?? '').trim();

// Clave estable de un comprobante: tipo + serie + número + documento contraparte.
export function claveComprobante(tipoDocumento, serie, numero, numDoc) {
  const n = String(numero ?? '').replace(/^0+/, '') || '0';
  return [txt(tipoDocumento), txt(serie).toUpperCase(), n, txt(numDoc)].join('::');
}

// Convierte una fecha 'DD/MM/AAAA' del SIRE a 'AAAA-MM-DD'.
function fechaIso(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(txt(value));
  if (!m) return txt(value);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Parsea una línea del RVIE (ventas, 140400).
function filaRvie(c) {
  return {
    tipo_documento: txt(c[6]),
    serie: txt(c[7]),
    numero: txt(c[8]),
    num_doc: txt(c[11]),
    razon_social: txt(c[12]),
    bi_gravada: num(c[14]),
    igv: num(c[16]),
    exonerada: num(c[18]),
    inafecta: num(c[19]),
    isc: num(c[20]),
    total: num(c[25]),
    moneda: txt(c[26]),
    fecha_emision: fechaIso(c[4]),
  };
}

// Parsea una línea del RCE (compras, 080400).
function filaRce(c) {
  return {
    tipo_documento: txt(c[6]),
    serie: txt(c[7]),
    numero: txt(c[9]),
    num_doc: txt(c[12]),
    razon_social: txt(c[13]),
    bi_gravada: num(c[14]),
    igv: num(c[15]),
    exonerada: num(c[20]),
    total: num(c[24]),
    moneda: txt(c[25]),
    fecha_emision: fechaIso(c[4]),
  };
}

// Parsea el TXT de la propuesta SIRE y devuelve sus registros normalizados.
// `libro` es 'ventas' (RVIE) o 'compras' (RCE).
export function parsePropuestaSire(contenido, libro = 'ventas') {
  const fila = libro === 'compras' ? filaRce : filaRvie;
  const lineas = String(contenido ?? '').split(/\r?\n/);
  const registros = [];
  for (const linea of lineas) {
    if (!linea.trim()) continue;
    const c = campos(linea);
    if (c.length < 10) continue;
    const r = fila(c);
    if (!r.serie || !r.numero) continue;
    r.clave = claveComprobante(r.tipo_documento, r.serie, r.numero, r.num_doc);
    registros.push(r);
  }
  return registros;
}

// Normaliza una fila propia (del libro) a la forma comparable.
function filaPropia(row, libro) {
  const contraparte = libro === 'compras' ? row.proveedor : row.cliente;
  return {
    tipo_documento: txt(row.tipo_documento),
    serie: txt(row.serie),
    numero: txt(row.numero),
    num_doc: txt(contraparte?.num_doc),
    razon_social: txt(contraparte?.razon_social),
    bi_gravada: num(row.bi_gravada),
    igv: num(row.igv),
    exonerada: num(row.exonerada),
    inafecta: num(row.inafecta),
    isc: num(row.isc),
    total: num(row.total),
    moneda: txt(row.moneda || 'PEN'),
    fecha_emision: txt(row.fecha_emision),
    ssco: Boolean(row.ssco),
  };
}

const IMPORTES = ['bi_gravada', 'igv', 'exonerada', 'inafecta', 'isc', 'total'];

// Compara los comprobantes propios contra la propuesta SIRE.
//   - `soloPropuesta`: SUNAT la propone pero no está en mi libro (riesgo).
//   - `soloPropio`:     está en mi libro pero SUNAT no la propone.
//   - `diferencias`:    coincide la clave pero cambia algún importe.
//   - `coincidencias`:  clave e importes iguales.
export function cruzarConPropuesta(propios, propuesta, libro = 'ventas') {
  const misFilas = (propios ?? []).map((r) => filaPropia(r, libro));
  const porClave = new Map();
  for (const f of misFilas) porClave.set(claveComprobante(f.tipo_documento, f.serie, f.numero, f.num_doc), f);

  const clavesPropuesta = new Set();
  const soloPropuesta = [];
  const diferencias = [];
  const coincidencias = [];

  for (const p of propuesta ?? []) {
    clavesPropuesta.add(p.clave);
    const mia = porClave.get(p.clave);
    if (!mia) {
      soloPropuesta.push(p);
      continue;
    }
    const cambios = IMPORTES
      .filter((k) => Math.abs(num(mia[k]) - num(p[k])) > 0.01)
      .map((k) => ({ campo: k, propio: num(mia[k]), propuesta: num(p[k]) }));
    if (cambios.length) {
      diferencias.push({ clave: p.clave, comprobante: `${p.serie}-${p.numero}`, cambios, propuesta: p, propio: mia });
    } else {
      coincidencias.push(p);
    }
  }

  const soloPropio = misFilas.filter((f) => !clavesPropuesta.has(claveComprobante(f.tipo_documento, f.serie, f.numero, f.num_doc)));

  return {
    libro,
    totalPropio: misFilas.length,
    totalPropuesta: (propuesta ?? []).length,
    soloPropuesta,
    soloPropio,
    diferencias,
    coincidencias,
    ssco: misFilas.filter((f) => f.ssco),
  };
}
