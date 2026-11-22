// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

  it('desactiva a un usuario tras confirmar y recarga el listado', async () => {
    const listUsers = vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);
    const setUserActive = vi.spyOn(api, 'setUserActive').mockResolvedValue({ message: 'ok' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<UsuariosPanel conectado companyId={1} />);
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(1));

    const filaEricka = screen.getByText('ericka@inmoa.com').closest('tr');
    await userEvent.click(within(filaEricka).getByRole('button', { name: /Desactivar/i }));

    await waitFor(() => expect(setUserActive).toHaveBeenCalledWith(1, false));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/desactivado y su sesión cerrada/i)).toBeTruthy());
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('no desactiva si el usuario cancela la confirmación', async () => {
    const listUsers = vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);
    const setUserActive = vi.spyOn(api, 'setUserActive');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<UsuariosPanel conectado companyId={1} />);
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(1));

    const filaEricka = screen.getByText('ericka@inmoa.com').closest('tr');
    await userEvent.click(within(filaEricka).getByRole('button', { name: /Desactivar/i }));

    expect(setUserActive).not.toHaveBeenCalled();
  });

  it('activa a un usuario inactivo sin pedir confirmación', async () => {
    vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);
    const setUserActive = vi.spyOn(api, 'setUserActive').mockResolvedValue({ message: 'ok' });
    const confirmar = vi.spyOn(window, 'confirm');

    render(<UsuariosPanel conectado companyId={1} />);
    await waitFor(() => expect(screen.getByText('operador@inmoa.com')).toBeTruthy());

    const filaOperador = screen.getByText('operador@inmoa.com').closest('tr');
    await userEvent.click(within(filaOperador).getByRole('button', { name: /^Activar$/i }));

    await waitFor(() => expect(setUserActive).toHaveBeenCalledWith(2, true));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('cambia el rol con el desplegable de la fila', async () => {
    vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);
    const setUserRole = vi.spyOn(api, 'setUserRole').mockResolvedValue({ message: 'ok' });

    render(<UsuariosPanel conectado companyId={1} />);
    await waitFor(() => expect(screen.getByText('operador@inmoa.com')).toBeTruthy());

    const filaOperador = screen.getByText('operador@inmoa.com').closest('tr');
    const selector = within(filaOperador).getByLabelText(/Rol de Operador Uno/i);
    // Debe arrancar en el rol actual, no en la primera opción de la lista.
    expect(selector.value).toBe('company_user');

    await userEvent.selectOptions(selector, 'company_admin');

    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith(2, 'company_admin'));
  });

  it('no ofrece acciones sobre la propia cuenta', async () => {
    vi.spyOn(api, 'listUsers').mockResolvedValue(usuarios);
    vi.spyOn(api, 'listRoles').mockResolvedValue(roles);

    render(<UsuariosPanel conectado companyId={1} usuarioId={1} />);
    await waitFor(() => expect(screen.getByText('ericka@inmoa.com')).toBeTruthy());

    const filaPropia = screen.getByText('ericka@inmoa.com').closest('tr');
    expect(within(filaPropia).getByText('Tu cuenta')).toBeTruthy();
    expect(within(filaPropia).queryByRole('button')).toBeNull();
    expect(within(filaPropia).queryByRole('combobox')).toBeNull();
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
