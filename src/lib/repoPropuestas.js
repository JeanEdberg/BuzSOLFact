// Repositorio local de propuestas SIRE por periodo.
//
// Cada propuesta (RVIE/RCE) que se descarga o se sube queda archivada por
// (empresa, libro, periodo). La clave es el periodo: volver a descargar o subir
// la propuesta de un mes REEMPLAZA la anterior, de modo que nunca se acumulan
// versiones duplicadas del mismo mes.

import { parsePropuestaSire } from './cruceSire.js';

const CLAVE = 'inmoa:sire-propuestas:v1';

// Respaldo en memoria cuando `localStorage` no existe (SSR, tests) o falla.
let memoria = null;

function almacen() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Acceso bloqueado: se usa el respaldo en memoria.
  }
  return null;
}

function leerTodo() {
  const store = almacen();
  try {
    const raw = store ? store.getItem(CLAVE) : memoria;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function escribirTodo(data) {
  const json = JSON.stringify(data);
  const store = almacen();
  try {
    if (store) store.setItem(CLAVE, json);
    else memoria = json;
  } catch {
    // Cuota o almacenamiento no disponible: el repositorio queda solo en memoria.
    memoria = json;
  }
}

const claveEmpresa = (companyId) => (companyId ? `empresa:${companyId}` : 'demo');

// Guarda (o reemplaza) la propuesta de un periodo. Devuelve la entrada guardada.
export function guardarPropuesta({ companyId, libro, periodo, contenido, origen = 'manual', nombre = '' }) {
  const registros = parsePropuestaSire(contenido, libro);
  const entrada = {
    libro,
    periodo,
    contenido,
    registros: registros.length,
    origen,
    nombre,
    actualizadoEn: new Date().toISOString(),
  };
  const data = leerTodo();
  const empresa = data[claveEmpresa(companyId)] ?? {};
  empresa[libro] = empresa[libro] ?? {};
  empresa[libro][periodo] = entrada;
  data[claveEmpresa(companyId)] = empresa;
  escribirTodo(data);
  return entrada;
}

// Obtiene la propuesta guardada de un periodo (o null si no existe).
export function obtenerPropuesta({ companyId, libro, periodo }) {
  const data = leerTodo();
  const entrada = data[claveEmpresa(companyId)]?.[libro]?.[periodo];
  if (!entrada) return null;
  return { ...entrada, filas: parsePropuestaSire(entrada.contenido, libro) };
}

// Lista las propuestas archivadas de una empresa y libro, ordenadas por periodo.
export function listarPropuestas({ companyId, libro } = {}) {
  const data = leerTodo();
  const empresa = data[claveEmpresa(companyId)] ?? {};
  const libros = libro ? [libro] : Object.keys(empresa);
  const salida = [];
  for (const l of libros) {
    for (const periodo of Object.keys(empresa[l] ?? {})) {
      salida.push({ ...empresa[l][periodo], libro: l, periodo });
    }
  }
  return salida.sort((a, b) => a.periodo.localeCompare(b.periodo));
}

export function eliminarPropuesta({ companyId, libro, periodo }) {
  const data = leerTodo();
  const empresa = data[claveEmpresa(companyId)] ?? {};
  if (empresa[libro]) delete empresa[libro][periodo];
  escribirTodo(data);
}
