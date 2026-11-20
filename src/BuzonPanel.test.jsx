// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuzonPanel from './BuzonPanel.jsx';

const empresa = {
  id: 7,
  ruc: '20614684772',
  razon_social: 'INMOA LOGISTICA Y SOLUCIONES E.I.R.L.',
  buzon_sunat_endpoint: 'http://127.0.0.1:12002/buzon',
  buzon_sunafil_endpoint: 'http://127.0.0.1:12002/buzon',
  usuario_sol: 'MODDATOS',
};

const listado = {
  data: [],
  resumen: { pendientes: 0, total: 0 },
  fuente: { sunat: true, sunafil: true, configurado: true, token: true, sol: true, origenes: ['empresa'] },
};

function stubFetch() {
  globalThis.fetch = vi.fn(async (url) => {
    const cuerpo = String(url).includes('/companies') ? { data: [empresa] } : listado;
    return {
      ok: true,
      status: 200,
      json: async () => cuerpo,
      text: async () => JSON.stringify(cuerpo),
    };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BuzonPanel · fuente del buzón', () => {
  it('precarga los endpoints y el usuario SOL de la empresa al abrir el formulario', async () => {
    stubFetch();
    render(<BuzonPanel conectado />);

    await userEvent.click(await screen.findByRole('button', { name: 'Fuente' }));

    const sunat = await screen.findByPlaceholderText(/Endpoint SUNAT/);
    expect(sunat.value).toBe(empresa.buzon_sunat_endpoint);
    expect(screen.getByPlaceholderText(/Endpoint SUNAFIL/).value).toBe(empresa.buzon_sunafil_endpoint);
    expect(screen.getByPlaceholderText(/Usuario SOL/).value).toBe('MODDATOS');
  });

  it('no precarga la Clave SOL: el backend nunca la devuelve', async () => {
    stubFetch();
    render(<BuzonPanel conectado />);

    await userEvent.click(await screen.findByRole('button', { name: 'Fuente' }));

    expect((await screen.findByPlaceholderText(/Clave SOL/)).value).toBe('');
  });

  it('avisa cuando falta la Clave SOL y por eso no se puede sincronizar', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const cuerpo = String(url).includes('/companies')
        ? { data: [{ ...empresa, usuario_sol: null }] }
        : { ...listado, fuente: { ...listado.fuente, sol: false } };
      return { ok: true, status: 200, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) };
    });

    render(<BuzonPanel conectado />);

    await waitFor(() => expect(screen.getByText(/Falta la Clave SOL/)).toBeTruthy());
  });
});

describe('BuzonPanel · buzones independientes', () => {
  const conConteo = {
    ...listado,
    resumen: { pendientes: 31, total: 51, por_entidad: { SUNAT: 51, SUNAFIL: 4 } },
  };

  function stubPorEntidad(espia) {
    globalThis.fetch = vi.fn(async (url, opciones) => {
      if (String(url).includes('/companies')) {
        return { ok: true, status: 200, json: async () => ({ data: [empresa] }), text: async () => '' };
      }
      if (String(url).includes('/sincronizar')) espia(opciones);
      return { ok: true, status: 200, json: async () => conConteo, text: async () => '' };
    });
  }

  it('muestra un contador propio por buzón', async () => {
    stubPorEntidad(() => {});
    render(<BuzonPanel conectado />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SUNAT 51 avisos/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /SUNAFIL 4 avisos/ })).toBeTruthy();
    });
  });

  it('sincroniza solo el buzón elegido, no los dos', async () => {
    const cuerpos = [];
    stubPorEntidad((opciones) => cuerpos.push(JSON.parse(opciones.body)));
    render(<BuzonPanel conectado />);

    await userEvent.click(await screen.findByRole('button', { name: /SUNAFIL 4 avisos/ }));
    await userEvent.click(screen.getByRole('button', { name: /Sincronizar/ }));

    await waitFor(() => expect(cuerpos.length).toBe(1));
    expect(cuerpos[0]).toEqual({ company_id: 7, entidad: 'SUNAFIL' });
  });

  it('al abrir consulta solo el buzón de SUNAT por defecto', async () => {
    const consultas = [];
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('/companies')) {
        return { ok: true, status: 200, json: async () => ({ data: [empresa] }), text: async () => '' };
      }
      consultas.push(String(url));
      return { ok: true, status: 200, json: async () => conConteo, text: async () => '' };
    });

    render(<BuzonPanel conectado />);

    await waitFor(() => expect(consultas.length).toBeGreaterThan(0));
    expect(consultas[0]).toContain('entidad=SUNAT');
  });
});
