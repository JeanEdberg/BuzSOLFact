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
