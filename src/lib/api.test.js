import { describe, it, expect, vi, afterEach } from 'vitest';
import { createApi } from './api.js';

function mockFetch(respuestas) {
  const llamadas = [];
  globalThis.fetch = vi.fn(async (url, options) => {
    llamadas.push({ url, options });
    const cuerpo = respuestas.shift() ?? {};
    return {
      ok: true,
      status: 200,
      json: async () => cuerpo,
      text: async () => JSON.stringify(cuerpo),
      headers: { get: () => null },
    };
  });
  return llamadas;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api.register', () => {
  it('envía JSON y guarda el token devuelto', async () => {
    const llamadas = mockFetch([{ access_token: 'tok-123', user: { company_id: 5 } }]);
    const api = createApi({ baseUrl: '/api' });

    const data = await api.register({ email: 'a@b.com', ruc: '20123456789' });

    expect(data.access_token).toBe('tok-123');
    expect(llamadas[0].url).toBe('/api/auth/register');
    expect(llamadas[0].options.method).toBe('POST');
    expect(llamadas[0].options.headers['Content-Type']).toBe('application/json');
    expect(llamadas[0].options.headers.Authorization).toBeUndefined();
  });

  it('con FormData no fuerza Content-Type y usa el token en la siguiente llamada', async () => {
    const llamadas = mockFetch([
      { access_token: 'tok-abc' },
      { data: [] },
    ]);
    const api = createApi({ baseUrl: '/api' });

    const fd = new FormData();
    fd.append('email', 'a@b.com');
    await api.register(fd);
    await api.me();

    expect(llamadas[0].options.headers['Content-Type']).toBeUndefined();
    expect(llamadas[1].options.headers.Authorization).toBe('Bearer tok-abc');
  });
});

describe('api.consultarDocumento', () => {
  it('envía tipo_documento y numero_documento como query', async () => {
    const llamadas = mockFetch([
      { disponible: true, encontrado: true, mensaje: 'Datos encontrados.', data: { razon_social: 'X' } },
    ]);
    const api = createApi({ baseUrl: '/api' });

    const res = await api.consultarDocumento({ tipoDocumento: 6, numeroDocumento: '20614684772' });

    expect(res.encontrado).toBe(true);
    expect(llamadas[0].url).toBe('/api/v1/consulta-documento?tipo_documento=6&numero_documento=20614684772');
  });
});

describe('api.enviarSunat', () => {
  it('sin async no envía cuerpo', async () => {
    const llamadas = mockFetch([{ data: { id: 1 } }]);
    const api = createApi({ baseUrl: '/api' });

    await api.enviarSunat('invoices', 1);

    expect(llamadas[0].options.body).toBeUndefined();
  });

  it('con async=true envía { async: true }', async () => {
    const llamadas = mockFetch([{ data: { id: 1 } }]);
    const api = createApi({ baseUrl: '/api' });

    await api.enviarSunat('invoices', 1, { async: true });

    expect(JSON.parse(llamadas[0].options.body)).toEqual({ async: true });
    expect(llamadas[0].options.headers['Content-Type']).toBe('application/json');
  });
});

describe('api.listNotificaciones', () => {
  it('devuelve items, resumen, alertas y fuente del buzón', async () => {
    const llamadas = mockFetch([
      {
        data: { data: [{ id: 1, entidad: 'SUNAT', asunto: 'Resolución' }], total: 1 },
        resumen: { pendientes: 1, total: 1 },
        alertas: { certificado: { tiene: true, por_vencer: false, vencido: false } },
        fuente: { sunat: true, sunafil: false, configurado: true, token: true, origenes: ['empresa'] },
      },
    ]);
    const api = createApi({ baseUrl: '/api' });

    const res = await api.listNotificaciones({ companyId: 1, entidad: 'SUNAT' });

    expect(llamadas[0].url).toBe('/api/v1/notificaciones?company_id=1&entidad=SUNAT');
    expect(res.items).toHaveLength(1);
    expect(res.resumen.total).toBe(1);
    expect(res.fuente.configurado).toBe(true);
  });
});

describe('api.configurarFuenteBuzon', () => {
  it('envía endpoints y token, y devuelve el estado', async () => {
    const llamadas = mockFetch([
      { data: { sunat: true, sunafil: false, configurado: true, token: true, origenes: ['empresa'] } },
    ]);
    const api = createApi({ baseUrl: '/api' });

    const estado = await api.configurarFuenteBuzon({
      companyId: 7,
      sunatEndpoint: 'https://proveedor.test/buzon',
      token: 'tok',
    });

    expect(llamadas[0].url).toBe('/api/v1/notificaciones/fuente');
    expect(llamadas[0].options.method).toBe('POST');
    expect(JSON.parse(llamadas[0].options.body)).toEqual({
      company_id: 7,
      buzon_sunat_endpoint: 'https://proveedor.test/buzon',
      buzon_sunafil_endpoint: '',
      buzon_token: 'tok',
    });
    expect(estado.configurado).toBe(true);
  });
});
