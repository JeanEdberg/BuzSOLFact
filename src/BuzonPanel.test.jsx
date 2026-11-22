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

  it('cuando falla la sincronización no afirma que el buzón está vacío', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('/companies')) {
        return { ok: true, status: 200, json: async () => ({ data: [empresa] }), text: async () => '' };
      }
      if (String(url).includes('/sincronizar')) {
        const cuerpo = {
          success: false,
          message: 'No se pudo sincronizar el buzón SUNAFIL',
          error: 'La Clave SOL es válida, pero el servidor de la casilla no responde.',
        };
        return {
          ok: false,
          status: 502,
          json: async () => cuerpo,
          text: async () => JSON.stringify(cuerpo),
        };
      }
      return { ok: true, status: 200, json: async () => listado, text: async () => '' };
    });

    render(<BuzonPanel conectado />);

    await userEvent.click(await screen.findByRole('button', { name: /SUNAFIL/ }));
    await userEvent.click(screen.getByRole('button', { name: /Sincronizar/ }));

    expect(
      await screen.findByText(/el servidor de la casilla no responde/),
    ).toBeTruthy();
    expect(screen.queryByText(/No hay notificaciones para esta empresa/)).toBeNull();
    expect(screen.getByText(/no se sabe si hay notificaciones/)).toBeTruthy();
  });
});

describe('BuzonPanel · abrir y notificarse', () => {
  // Una notificación de SUNAFIL sin carta bajada: el caso que abre el acuse.
  const conPendiente = {
    data: {
      data: [
        {
          id: 42,
          entidad: 'SUNAFIL',
          asunto: 'Carta inductiva general',
          estado: 'pendiente',
          fecha: '2026-10-29',
          codigo: '0000122241 - 2026 - SUNAFIL/DPPR/SDPA',
          tiene_adjunto: false,
        },
      ],
      total: 1,
    },
    resumen: { pendientes: 1, total: 1 },
    fuente: { sunat: true, sunafil: true, configurado: true, token: true, sol: true, origenes: ['empresa'] },
  };

  function stubConPendiente() {
    globalThis.fetch = vi.fn(async (url) => {
      const cuerpo = String(url).includes('/companies') ? { data: [empresa] } : conPendiente;
      return { ok: true, status: 200, json: async () => cuerpo, text: async () => '' };
    });
  }

  it('pide confirmación en vez de abrir la carta al primer clic', async () => {
    stubConPendiente();
    render(<BuzonPanel conectado />);

    await userEvent.click(await screen.findByRole('button', { name: /SUNAFIL/ }));

    await userEvent.click(
      await screen.findByTitle(/Abrir la carta y notificarse/),
    );

    // Aparece el aviso, pero todavía no se llamó al backend.
    expect(await screen.findByText(/Abrir la carta registra el acuse/)).toBeTruthy();
    const llamadas = globalThis.fetch.mock.calls.map(([u]) => String(u));
    expect(llamadas.some((u) => u.includes('/abrir'))).toBe(false);
  });

  it('cancelar no abre nada', async () => {
    stubConPendiente();
    render(<BuzonPanel conectado />);

    await userEvent.click(await screen.findByRole('button', { name: /SUNAFIL/ }));
    await userEvent.click(await screen.findByTitle(/Abrir la carta y notificarse/));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByText(/Abrir la carta registra el acuse/)).toBeNull();
    });
    const llamadas = globalThis.fetch.mock.calls.map(([u]) => String(u));
    expect(llamadas.some((u) => u.includes('/abrir'))).toBe(false);
  });

  it('confirmar llama a /abrir y avisa de las constancias que faltan', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/companies')) {
        return { ok: true, status: 200, json: async () => ({ data: [empresa] }), text: async () => '' };
      }
      if (u.includes('/abrir')) {
        const cuerpo = {
          success: true,
          data: { ok: true, archivos: ['carta'], pendientes: { constancia_acuse: 'aún no publicada' } },
        };
        return { ok: true, status: 200, json: async () => cuerpo, text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => conPendiente, text: async () => '' };
    });

    render(<BuzonPanel conectado />);

    await userEvent.click(await screen.findByRole('button', { name: /SUNAFIL/ }));
    await userEvent.click(await screen.findByTitle(/Abrir la carta y notificarse/));
    await userEvent.click(await screen.findByRole('button', { name: /Sí, abrir y notificarse/ }));

    expect(await screen.findByText(/acuse registrado/i)).toBeTruthy();
    expect(await screen.findByText(/constancia_acuse/)).toBeTruthy();

    const abrir = globalThis.fetch.mock.calls.find(([u]) => String(u).includes('/abrir'));
    expect(abrir[1].method).toBe('POST');
    expect(JSON.parse(abrir[1].body)).toEqual({ confirmo: true });
  });
});
