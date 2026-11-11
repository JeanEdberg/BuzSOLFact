// Tipo de cambio SUNAT para comprobantes en moneda extranjera.
//
// La API de facturación no persiste el tipo de cambio, así que se resuelve por
// fecha al generar el libro. Fuente oficial: SUNAT publica a diario
//   https://www.sunat.gob.pe/a/txt/tipoCambio.txt  ->  "10/11/2026|3.409|3.418|"
// (fecha | compra | venta). El archivo NO permite peticiones desde el navegador
// (Access-Control-Allow-Origin solo habilita ww3.sunat.gob.pe) y solo trae la tasa
// del día, por lo que el backend debe actuar de proxy con caché por fecha.

const ENDPOINT = 'https://www.sunat.gob.pe/a/txt/tipoCambio.txt';

// "10/11/2026|3.409|3.418|" -> { fecha: '2026-11-10', compra: 3.409, venta: 3.418 }
export function parseTipoCambio(texto) {
  const linea = String(texto ?? '').trim().split(/\r?\n/)[0] ?? '';
  const [fecha, compra, venta] = linea.split('|').map((v) => v.trim());
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha ?? '');
  if (!m) return null;
  const num = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  return { fecha: `${m[3]}-${m[2]}-${m[1]}`, compra: num(compra), venta: num(venta) };
}

// Un solo formato de fecha ('YYYY-MM-DD') de cara al resto de la aplicación.
export function normalizarFecha(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const s = String(valor);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const latina = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (latina) return `${latina[3]}-${latina[2]}-${latina[1]}`;
  return s.slice(0, 10);
}

// SUNAT expresa los montos en soles. Para un comprobante en moneda extranjera se
// usa la tasa de venta: es la que convierte la operación a soles para el libro.
export function elegirTasa(cotizacion) {
  if (!cotizacion) return null;
  return cotizacion.venta ?? cotizacion.compra ?? null;
}

// Cachea por fecha para no golpear a SUNAT una vez por comprobante. Los periodos
// ya cerrados no cambian, así que además admite precarga.
export function crearServicioTipoCambio({ fetchCotizacion, cache = new Map() } = {}) {
  if (typeof fetchCotizacion !== 'function') {
    throw new Error('crearServicioTipoCambio requiere fetchCotizacion(fecha)');
  }

  // Se cachea la promesa, no solo el resultado: así dos comprobantes de la misma
  // fecha comparten una única petición en vuelo.
  const enVuelo = new Map();

  async function obtener(fecha) {
    const dia = normalizarFecha(fecha);
    if (!dia) return null;
    if (cache.has(dia)) return cache.get(dia);
    if (enVuelo.has(dia)) return enVuelo.get(dia);

    const peticion = (async () => {
      try {
        const cotizacion = await fetchCotizacion(dia);
        const tasa = elegirTasa(cotizacion);
        if (tasa != null) cache.set(dia, tasa);
        return tasa;
      } finally {
        enVuelo.delete(dia);
      }
    })();

    enVuelo.set(dia, peticion);
    return peticion;
  }

  return {
    obtener,
    async precargar(fechas = []) {
      const unicas = [...new Set(fechas.map(normalizarFecha).filter(Boolean))];
      await Promise.all(unicas.map((f) => obtener(f)));
    },
    // Fechas (ISO) de los comprobantes en moneda extranjera sin tasa conocida.
    faltantes(documentos = []) {
      const pendientes = new Set();
      for (const d of documentos) {
        if (!d?.moneda || d.moneda === 'PEN') continue;
        if (d.tipo_cambio) continue;
        const dia = normalizarFecha(d.fecha_emision);
        if (dia && !cache.has(dia)) pendientes.add(dia);
      }
      return [...pendientes];
    },
    cache,
  };
}

export const SUNAT_TIPO_CAMBIO_URL = ENDPOINT;
