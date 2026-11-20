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
