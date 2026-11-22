import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createApi } from './api.js';

// Cada respuesta puede ser el cuerpo o `{ status, body }` para simular errores.
function mockFetch(respuestas) {
  const llamadas = [];
  globalThis.fetch = vi.fn(async (url, options) => {
    llamadas.push({ url, options });
    const siguiente = respuestas.shift() ?? {};
    const esError = 'status' in siguiente && 'body' in siguiente;
    const status = esError ? siguiente.status : 200;
    const cuerpo = esError ? siguiente.body : siguiente;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => cuerpo,
      text: async () => JSON.stringify(cuerpo),
      blob: async () => new Blob(['%PDF-1.4']),
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
  it('envía endpoints, token y Clave SOL, y devuelve el estado', async () => {
    const llamadas = mockFetch([
      { data: { sunat: true, sunafil: false, configurado: true, token: true, origenes: ['empresa'] } },
    ]);
    const api = createApi({ baseUrl: '/api' });

    const estado = await api.configurarFuenteBuzon({
      companyId: 7,
      sunatEndpoint: 'https://proveedor.test/buzon',
      token: 'tok',
      usuarioSol: 'MODDATOS',
      claveSol: 'clave-real',
    });

    expect(llamadas[0].url).toBe('/api/v1/notificaciones/fuente');
    expect(llamadas[0].options.method).toBe('POST');
    expect(JSON.parse(llamadas[0].options.body)).toEqual({
      company_id: 7,
      buzon_sunat_endpoint: 'https://proveedor.test/buzon',
      buzon_sunafil_endpoint: '',
      buzon_token: 'tok',
      usuario_sol: 'MODDATOS',
      clave_sol: 'clave-real',
    });
    expect(estado.configurado).toBe(true);
  });
});

describe('api.probarFuenteBuzon', () => {
  it('devuelve el motivo real cuando la fuente rechaza la conexión', async () => {
    mockFetch([
      {
        status: 502,
        body: { success: false, conectado: false, message: 'SUNAT rechazó las credenciales SOL.' },
      },
    ]);
    const api = createApi({ baseUrl: '/api' });

    const resultado = await api.probarFuenteBuzon({ companyId: 7, entidad: 'SUNAT' });

    expect(resultado.conectado).toBe(false);
    expect(resultado.message).toBe('SUNAT rechazó las credenciales SOL.');
  });

  it('informa cuántas notificaciones ve cuando conecta', async () => {
    const llamadas = mockFetch([{ conectado: true, total: 3, message: 'Conexión correcta.' }]);
    const api = createApi({ baseUrl: '/api' });

    const resultado = await api.probarFuenteBuzon({ companyId: 7 });

    expect(llamadas[0].url).toBe('/api/v1/notificaciones/probar-fuente');
    expect(resultado).toMatchObject({ conectado: true, total: 3 });
  });
});

describe('mensajes de error del backend', () => {
  it('muestra el motivo legible y no el JSON crudo', async () => {
    mockFetch([
      {
        status: 502,
        body: {
          success: false,
          message: 'No se pudo sincronizar el buzón SUNAFIL',
          error: 'La Clave SOL es válida, pero el servidor de la casilla no responde.',
        },
      },
    ]);
    const api = createApi({ baseUrl: '/api' });

    await expect(api.sincronizarBuzon(1, 'SUNAFIL')).rejects.toThrow(
      'No se pudo sincronizar el buzón SUNAFIL: La Clave SOL es válida, pero el servidor de la casilla no responde.',
    );
  });

  it('usa el texto tal cual cuando la respuesta no es JSON', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('no es JSON');
      },
      text: async () => '<html>Error interno</html>',
      headers: { get: () => null },
    }));
    const api = createApi({ baseUrl: '/api' });

    await expect(api.sincronizarBuzon(1)).rejects.toThrow('Error interno');
  });

  it('conserva el código de estado en el error', async () => {
    mockFetch([{ status: 502, body: { message: 'Fallo', error: 'Casilla caída' } }]);
    const api = createApi({ baseUrl: '/api' });

    await expect(api.sincronizarBuzon(1, 'SUNAFIL')).rejects.toMatchObject({
      status: 502,
      name: 'SunatApiError',
    });
  });

  it('ignora los campos que no son texto y cae al mensaje genérico', async () => {
    mockFetch([
      { status: 422, body: { message: '', error: { ruc: ['El RUC es obligatorio.'] } } },
    ]);
    const api = createApi({ baseUrl: '/api' });

    const error = await api.sincronizarBuzon(1).catch((e) => e);

    expect(error.message).not.toContain('[object Object]');
    expect(error.message).toContain('Error 422');
  });
});

// @vitest-environment jsdom
describe('api.descargarAdjuntoNotificacion', () => {
  // jsdom no implementa `createObjectURL`, y `saveBlob` lo necesita para
  // ofrecer la descarga.
  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('pide el tipo al backend cuando se descarga una constancia', async () => {
    const llamadas = mockFetch([]);
    const api = createApi({ baseUrl: 'https://api.test' });

    await api.descargarAdjuntoNotificacion(7, 'constancia_acuse');

    // Sin el tipo el backend bajaría la carta, que es el valor por defecto.
    expect(llamadas[0].url).toBe(
      'https://api.test/v1/notificaciones/7/adjunto?tipo=constancia_acuse',
    );
  });

  it('no añade consulta cuando no se pide un tipo concreto', async () => {
    const llamadas = mockFetch([]);
    const api = createApi({ baseUrl: 'https://api.test' });

    await api.descargarAdjuntoNotificacion(7);

    expect(llamadas[0].url).toBe('https://api.test/v1/notificaciones/7/adjunto');
  });
});
