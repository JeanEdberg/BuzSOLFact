// Cliente para la API de facturación electrónica SUNAT.
// Endpoints reales del backend (Laravel 12 + Sanctum):
//   POST /api/auth/login                      -> { access_token, user }
//   GET  /api/v1/invoices                     -> paginator ({ data: { data: [...] } })
//   GET  /api/v1/boletas                      -> array plano ({ data: [...] })
//   GET  /api/v1/invoices/{id}/download-xml|cdr|pdf
//   GET  /api/v1/boletas/{id}/download-xml|cdr|pdf
//   GET  /api/v1/auth/me

import { normalizarLista, recurso } from './mapper.js';

const BASE_URL = import.meta.env?.VITE_API_URL || '/api';

export class SunatApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'SunatApiError';
    this.status = status;
  }
}

export function createApi({ baseUrl = BASE_URL, token = null } = {}) {
  let authToken = token;

  async function request(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    if (options.body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new SunatApiError(
        `Error ${response.status} en ${path}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        response.status,
      );
    }
    return response;
  }

  async function listar(tipo, { desde, hasta, perPage = 500 } = {}) {
    const params = new URLSearchParams({ per_page: String(perPage) });
    if (desde) params.set('fecha_desde', desde);
    if (hasta) params.set('fecha_hasta', hasta);
    const response = await request(`/v1/${recurso({ tipo_documento: tipo })}?${params}`);
    return normalizarLista(await response.json());
  }

  return {
    setToken(value) {
      authToken = value;
    },

    async login({ email, password }) {
      const response = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      authToken = data.access_token ?? data.token ?? authToken;
      return data;
    },

    async me() {
      const response = await request('/v1/auth/me');
      return response.json();
    },

    // Comprobantes emitidos (facturas + boletas) del periodo indicado.
    async listVentas({ desde, hasta } = {}) {
      const [facturas, boletas] = await Promise.all([
        listar('01', { desde, hasta }),
        listar('03', { desde, hasta }),
      ]);
      return [...facturas, ...boletas];
    },

    listDocumentos({ tipo = '01', desde, hasta } = {}) {
      return listar(tipo, { desde, hasta });
    },

    // Descarga un artefacto del comprobante y dispara la bajada en el navegador.
    async download(tipoDocumento, id, format) {
      const response = await request(`/v1/${recurso({ tipo_documento: tipoDocumento })}/${id}/download-${format}`);
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
      const fallbackExt = format === 'pdf' ? 'pdf' : format === 'cdr' ? 'zip' : 'xml';
      const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `comprobante-${id}.${fallbackExt}`;
      saveBlob(blob, filename);
      return filename;
    },
  };
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(filename, content) {
  saveBlob(new Blob([content], { type: 'text/plain;charset=windows-1252' }), filename);
}

export const api = createApi();
