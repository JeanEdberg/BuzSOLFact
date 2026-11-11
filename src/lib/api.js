// Cliente para la API de facturación electrónica SUNAT.
// Los endpoints de descarga siguen la convención del backend Laravel:
//   GET /api/v1/invoices/{id}/download-xml
//   GET /api/v1/invoices/{id}/download-cdr
//   GET /api/v1/invoices/{id}/download-pdf
//   GET /api/v1/boletas/{id}/download-...
// El token se obtiene con POST /api/auth/login (Laravel Sanctum).

const BASE_URL = import.meta.env?.VITE_API_URL || '/api';

export class SunatApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'SunatApiError';
    this.status = status;
  }
}

function resourceFor(tipoDocumento) {
  // 01 Factura, 03 Boleta; el resto de comprobantes se exponen bajo invoices.
  return tipoDocumento === '03' ? 'boletas' : 'invoices';
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
      authToken = data.token ?? data.access_token ?? authToken;
      return data;
    },

    async listDocumentos({ tipo = '01', desde, hasta } = {}) {
      const params = new URLSearchParams();
      if (desde) params.set('fecha_desde', desde);
      if (hasta) params.set('fecha_hasta', hasta);
      const response = await request(`/v1/${resourceFor(tipo)}?${params}`);
      const data = await response.json();
      return data.data ?? data;
    },

    // Descarga un artefacto del comprobante y dispara la bajada en el navegador.
    async download(tipoDocumento, id, format) {
      const resource = resourceFor(tipoDocumento);
      const response = await request(`/v1/${resource}/${id}/download-${format}`);
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
