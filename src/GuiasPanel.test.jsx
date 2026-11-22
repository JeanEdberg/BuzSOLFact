// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuiasPanel from './GuiasPanel.jsx';
import { api } from './lib/api.js';

const guias = [
  {
    id: 7,
    serie: 'T001',
    correlativo: '00000001',
    numero_completo: 'T001-00000001',
    fecha_emision: '2026-11-21',
    destinatario: { razon_social: 'DESTINATARIO UNO SAC', numero_documento: '20100070970' },
    des_traslado: 'Venta',
    fecha_traslado: '2026-11-21',
    estado_sunat: 'ACEPTADO',
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('GuiasPanel', () => {
  it('no consulta la API si no hay conexión', () => {
    const listGuias = vi.spyOn(api, 'listGuias');

    render(<GuiasPanel api={api} companyId={1} conectado={false} />);

    expect(screen.getByText(/Conecta la API/i)).toBeTruthy();
    expect(listGuias).not.toHaveBeenCalled();
  });

  it('lista las guías reales y no comprobantes de venta', async () => {
    vi.spyOn(api, 'listGuias').mockResolvedValue(guias);

    render(<GuiasPanel api={api} companyId={1} conectado />);

    await waitFor(() => expect(screen.getByText('T001-00000001')).toBeTruthy());
    expect(screen.getByText('DESTINATARIO UNO SAC')).toBeTruthy();
    expect(screen.getByText('ACEPTADO')).toBeTruthy();
    expect(api.listGuias).toHaveBeenCalledWith({ companyId: 1 });
  });

  it('avisa cuando no hay guías emitidas', async () => {
    vi.spyOn(api, 'listGuias').mockResolvedValue([]);

    render(<GuiasPanel api={api} companyId={1} conectado />);

    await waitFor(() => expect(screen.getByText(/Todavía no hay guías/i)).toBeTruthy());
  });

  it('muestra el error si la consulta falla', async () => {
    vi.spyOn(api, 'listGuias').mockRejectedValue(new Error('sin conexión'));

    render(<GuiasPanel api={api} companyId={1} conectado />);

    await waitFor(() => expect(screen.getByText(/sin conexión/)).toBeTruthy());
  });

  it('filtra por número o destinatario', async () => {
    vi.spyOn(api, 'listGuias').mockResolvedValue(guias);

    render(<GuiasPanel api={api} companyId={1} conectado />);
    await waitFor(() => expect(screen.getByText('T001-00000001')).toBeTruthy());

    await userEvent.type(screen.getByPlaceholderText(/Buscar número/i), 'inexistente');

    expect(screen.queryByText('T001-00000001')).toBeNull();
    expect(screen.getByText(/Ninguna guía coincide/i)).toBeTruthy();
  });

  it('reenvía una guía a SUNAT y refresca la lista', async () => {
    const listGuias = vi.spyOn(api, 'listGuias').mockResolvedValue(guias);
    const enviarSunat = vi.spyOn(api, 'enviarSunat').mockResolvedValue({});

    render(<GuiasPanel api={api} companyId={1} conectado />);
    await waitFor(() => expect(screen.getByText('T001-00000001')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: /SUNAT/i }));

    await waitFor(() => expect(enviarSunat).toHaveBeenCalledWith('dispatch-guides', 7));
    expect(listGuias).toHaveBeenCalledTimes(2);
  });
});
