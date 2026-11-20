// Lector mínimo de libros Excel (.xlsx) sin dependencias externas.
//
// Un .xlsx es un ZIP (contenedor OOXML). Aquí se descomprime con la API
// estándar `DecompressionStream('deflate-raw')` (navegadores modernos y Node
// >= 18) y se leen las celdas de `sharedStrings.xml` y de la hoja indicada.
//
// Soporta lo que usan los padrones de SUNAT: cadenas compartidas, celdas
// numéricas (incluidas fechas serializadas) y celdas con texto en línea.

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

function u16(view, pos) { return view.getUint16(pos, true); }
function u32(view, pos) { return view.getUint32(pos, true); }

// Localiza el End Of Central Directory (EOCD) escaneando desde el final.
function findEocd(view) {
  const max = Math.min(view.byteLength, 22 + 0xffff);
  for (let i = view.byteLength - 22; i >= view.byteLength - max; i -= 1) {
    if (i >= 0 && u32(view, i) === EOCD_SIG) return i;
  }
  throw new Error('Archivo .xlsx inválido: no se encontró el directorio ZIP');
}

function decodeName(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

// Índice del directorio central: nombre -> {method, compressedSize, offset}.
function readCentralDirectory(view, bytes) {
  const eocd = findEocd(view);
  const total = u16(view, eocd + 10);
  let pos = u32(view, eocd + 16);
  const entries = new Map();
  for (let i = 0; i < total; i += 1) {
    if (u32(view, pos) !== CENTRAL_SIG) throw new Error('Directorio ZIP corrupto');
    const method = u16(view, pos + 10);
    const compressedSize = u32(view, pos + 20);
    const nameLen = u16(view, pos + 28);
    const extraLen = u16(view, pos + 30);
    const commentLen = u16(view, pos + 32);
    const offset = u32(view, pos + 42);
    const name = decodeName(bytes.subarray(pos + 46, pos + 46 + nameLen));
    entries.set(name, { method, compressedSize, offset });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// Descomprime una entrada del ZIP (deflate-raw o almacenada).
async function readEntry(bytes, view, entry) {
  if (u32(view, entry.offset) !== LOCAL_SIG) throw new Error('Cabecera local ZIP inválida');
  const nameLen = u16(view, entry.offset + 26);
  const extraLen = u16(view, entry.offset + 28);
  const start = entry.offset + 30 + nameLen + extraLen;
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new Error(`Compresión ZIP no soportada: ${entry.method}`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

// Texto de cada <si> de sharedStrings.xml (incluye runs <r><t>).
export function parseSharedStrings(xml) {
  const out = [];
  const items = xml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) || [];
  for (const item of items) {
    const runs = item.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || [];
    const text = runs
      .map((t) => t.replace(/^<t\b[^>]*>/, '').replace(/<\/t>$/, ''))
      .join('');
    out.push(unescapeXml(text));
  }
  return out;
}

function unescapeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

// Convierte la referencia de celda ('A1', 'AB12') en índice de columna (0-based).
export function colFromRef(ref) {
  const letters = (ref.match(/^[A-Z]+/) || [''])[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Filas de una hoja como matriz de valores (índice de columna respetado).
export function parseSheet(xml, sharedStrings) {
  const rows = [];
  const rowMatches = xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || [];
  for (const rowXml of rowMatches) {
    const cells = rowXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || [];
    const row = [];
    for (const cell of cells) {
      const ref = (cell.match(/r="([A-Z]+\d+)"/) || [])[1];
      const col = ref ? colFromRef(ref) : row.length;
      row[col] = cellValue(cell, sharedStrings);
    }
    rows.push(row);
  }
  return rows;
}

function cellValue(cell, sharedStrings) {
  const type = (cell.match(/t="([^"]+)"/) || [])[1];
  if (type === 'inlineStr') {
    const runs = cell.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || [];
    return unescapeXml(runs.map((t) => t.replace(/^<t\b[^>]*>/, '').replace(/<\/t>$/, '')).join(''));
  }
  const value = (cell.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
  if (value === undefined) return '';
  if (type === 's') return sharedStrings[Number(value)] ?? '';
  if (type === 'str') return unescapeXml(value);
  // Numérico: se conserva como número; los códigos de RUC/DNI no llevan decimales.
  const n = Number(value);
  return Number.isFinite(n) ? n : unescapeXml(value);
}

// Lee un .xlsx y devuelve las hojas como matrices de valores.
//   readXlsx(arrayBuffer) -> [{ name, rows: [[...], ...] }, ...]
export async function readXlsx(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = readCentralDirectory(view, bytes);

  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const sharedStrings = sharedEntry
    ? parseSharedStrings(decodeUtf8(await readEntry(bytes, view, sharedEntry)))
    : [];

  // Nombres de hoja desde workbook.xml + relaciones, en orden.
  const names = [];
  const workbookEntry = entries.get('xl/workbook.xml');
  if (workbookEntry) {
    const workbook = decodeUtf8(await readEntry(bytes, view, workbookEntry));
    for (const m of workbook.matchAll(/<sheet\b[^>]*name="([^"]*)"[^>]*>/g)) names.push(unescapeXml(m[1]));
  }

  const sheets = [];
  let index = 0;
  for (const [name, entry] of entries) {
    const match = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(name);
    if (!match) continue;
    const xml = decodeUtf8(await readEntry(bytes, view, entry));
    const sheetName = names[Number(match[1]) - 1] ?? `Hoja${match[1]}`;
    sheets.push({ name: sheetName, rows: parseSheet(xml, sharedStrings), order: Number(match[1]) });
    index += 1;
  }
  sheets.sort((a, b) => a.order - b.order);
  return sheets.map(({ name, rows }) => ({ name, rows }));
}
