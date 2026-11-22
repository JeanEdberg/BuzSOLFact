// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsuariosPanel from './UsuariosPanel.jsx';
import { api } from './lib/api.js';

const usuarios = [
  { id: 1, name: 'Ericka Coveñas', email: 'ericka@inmoa.com', role: 'company_admin', role_label: 'Administrador de Empresa', active: true },
  { id: 2, name: 'Operador Uno', email: 'operador@inmoa.com', role: 'company_user', role_label: 'Usuario de Empresa', active: false },
];

const roles = [
  { name: 'company_admin', label: 'Administrador de Empresa' },
  { name: 'company_user', label: 'Usuario de Empresa' },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UsuariosPanel', () => {
  it('no consulta la API si no hay conexión', () => {
    const listUsers = vi.spyOn(api, 'listUsers');

    render(<UsuariosPanel conectado={false} />);

    expect(screen.getByText(/Conecta con la API/i)).toBeTruthy();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('lista los usuarios de la empresa con su rol y estado', async () => {
    vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);

    render(<UsuariosPanel conectado companyId={1} />);

    await waitFor(() => expect(screen.getByText('ericka@inmoa.com')).toBeTruthy());
    expect(screen.getByText('operador@inmoa.com')).toBeTruthy();
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].textContent).toContain('Administrador de Empresa');
    expect(filas[1].textContent).toContain('Usuario de Empresa');
    expect(screen.getByText('Activo')).toBeTruthy();
    expect(screen.getByText('Inactivo')).toBeTruthy();
  });

  it('crea un usuario con la empresa activa y recarga el listado', async () => {
    const listUsers = vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);
    const createUser = vi.spyOn(api, 'createUser').mockResolvedValue({ success: true });

    render(<UsuariosPanel conectado companyId={7} />);
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/Nombre/i), 'Nuevo Operador');
    await userEvent.type(screen.getByLabelText(/Correo/i), 'nuevo@inmoa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'ClaveSegura123');
    await userEvent.click(screen.getByRole('button', { name: /Crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
    expect(createUser).toHaveBeenCalledWith({
      name: 'Nuevo Operador',
      email: 'nuevo@inmoa.com',
      password: 'ClaveSegura123',
      role_name: 'company_user',
      user_type: 'user',
      company_id: 7,
    });
    await waitFor(() => expect(screen.getByText(/nuevo@inmoa.com creado/i)).toBeTruthy());
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('muestra el error del backend y no recarga', async () => {
    const listUsers = vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);
    vi.spyOn(api, 'createUser').mockRejectedValue(new Error('No autorizado para esa empresa'));

    render(<UsuariosPanel conectado companyId={1} />);
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText(/Nombre/i), 'X');
    await userEvent.type(screen.getByLabelText(/Correo/i), 'x@inmoa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'ClaveSegura123');
    await userEvent.click(screen.getByRole('button', { name: /Crear usuario/i }));

    await waitFor(() => expect(screen.getByText('No autorizado para esa empresa')).toBeTruthy());
    expect(listUsers).toHaveBeenCalledTimes(1);
  });
});
