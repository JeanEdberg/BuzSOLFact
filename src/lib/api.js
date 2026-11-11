// Cliente para la API de facturación electrónica SUNAT.
// Endpoints reales del backend (Laravel 12 + Sanctum):
//   POST /api/auth/login                      -> { access_token, user }
//   GET  /api/v1/invoices                     -> paginator ({ data: { data: [...] } })
//   GET  /api/v1/boletas                      -> array plano ({ data: [...] })
//   GET  /api/v1/invoices/{id}/download-xml|cdr|pdf
//   GET  /api/v1/boletas/{id}/download-xml|cdr|pdf
//   GET  /api/v1/auth/me

import { normalizarLista, recurso } from './mapper.js';
import { parseTipoCambio } from './tipoCambio.js';

const BASE_URL = import.meta.env?.VITE_API_URL || '/api';

export class SunatApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'SunatApiError';
    this.status = status;
  }
}

export function createApi({ baseUrl = BASE_URL, token = null } = {}) {
  let authToken = token;

  async function request(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    // FormData debe llevar su propio Content-Type (con el boundary del multipart).
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

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

  // El backend limita per_page a 100: se recorren todas las páginas.
  async function listarTodasLasPaginas(path, paramsBase) {
    const filas = [];
    let page = 1;
    // Tope de seguridad por si el paginador no informa last_page.
    for (let guard = 0; guard < 500; guard++) {
      const params = new URLSearchParams(paramsBase);
      params.set('page', String(page));
      const response = await request(`${path}?${params}`);
      const json = await response.json();
      const paginador = json?.data ?? {};
      const lote = Array.isArray(paginador.data)
        ? paginador.data
        : normalizarLista(json);
      filas.push(...lote);
      const lastPage = paginador.last_page ?? (paginador.next_page_url ? page + 1 : page);
      if (!lote.length || page >= lastPage) break;
      page += 1;
    }
    return filas;
  }

  async function listar(tipo, { desde, hasta } = {}) {
    const params = new URLSearchParams({ per_page: '100' });
    if (desde) params.set('fecha_desde', desde);
    if (hasta) params.set('fecha_hasta', hasta);
    return listarTodasLasPaginas(`/v1/${recurso({ tipo_documento: tipo })}`, params);
  }

  // Listado paginado de un recurso (notas, guías): recorre todas las páginas.
  async function listarPaginado(nombre, { companyId, branchId } = {}) {
    const params = new URLSearchParams({ per_page: '100' });
    if (companyId) params.set('company_id', String(companyId));
    if (branchId) params.set('branch_id', String(branchId));
    return listarTodasLasPaginas(`/v1/${nombre}`, params);
  }

  // Catálogos (motivos, modalidades): la API responde { data: [{code, name}] }.
  async function catalogos(ruta) {
    const response = await request(`/v1/${ruta}`);
    const json = await response.json();
    return normalizarLista(json);
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
      authToken = data.access_token ?? data.token ?? authToken;
      return data;
    },

    async me() {
      const response = await request('/v1/auth/me');
      return response.json();
    },

    // Empresas registradas (multiempresa). Cada una tiene sus propias
    // credenciales SOL secundarias y su certificado digital.
    async listCompanies() {
      const response = await request('/v1/companies');
      const json = await response.json();
      return json?.data ?? json;
    },

    async getCompany(id) {
      const response = await request(`/v1/companies/${id}`);
      const json = await response.json();
      return json?.data?.company ?? json?.data ?? json;
    },

    // Actualiza los datos de la empresa (incluidas las credenciales SOL).
    // Acepta un objeto plano o un FormData (cuando se sube el certificado).
    // Laravel no procesa archivos en PUT: con FormData se usa POST + _method=PUT.
    async updateCompany(id, payload) {
      let options;
      if (payload instanceof FormData) {
        if (!payload.has('_method')) payload.append('_method', 'PUT');
        options = { method: 'POST', body: payload };
      } else {
        options = { method: 'PUT', body: JSON.stringify(payload) };
      }
      const response = await request(`/v1/companies/${id}`, options);
      const json = await response.json();
      return json?.data ?? json;
    },

    // Registro de compras (comprobantes recibidos de proveedores). El listado
    // viene en un paginador de Laravel: { data: { data: [...] } }.
    async listCompras({ companyId, fechaDesde, fechaHasta, estadoSunat } = {}) {
      const params = new URLSearchParams();
      if (companyId) params.set('company_id', String(companyId));
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);
      if (estadoSunat) params.set('estado_sunat', estadoSunat);
      const items = await listarTodasLasPaginas('/v1/compras', params);
      return { items, total: items.length };
    },

    async crearCompra(payload) {
      const response = await request('/v1/compras', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Sube el XML UBL del proveedor (multipart) y devuelve la compra registrada.
    async importarCompraXml(companyId, file) {
      const form = new FormData();
      form.append('company_id', String(companyId));
      form.append('xml', file);
      const response = await request('/v1/compras/importar-xml', { method: 'POST', body: form });
      const json = await response.json();
      return json?.data ?? json;
    },

    async eliminarCompra(id) {
      const response = await request(`/v1/compras/${id}`, { method: 'DELETE' });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Descarga XML/CDR/PDF de un comprobante de compra (los que el proveedor
    // envió, o los que el usuario adjuntó a mano cuando solo tenía el PDF).
    async descargarCompra(id, format) {
      const response = await request(`/v1/compras/${id}/download-${format}`);
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
      const fallbackExt = format === 'pdf' ? 'pdf' : format === 'cdr' ? 'zip' : 'xml';
      const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `compra-${id}.${fallbackExt}`;
      saveBlob(blob, filename);
      return filename;
    },

    // Adjunta un artefacto a una compra (multipart: tipo=xml|cdr|pdf + archivo).
    async adjuntarCompra(id, tipo, file) {
      const form = new FormData();
      form.append('tipo', tipo);
      form.append('archivo', file);
      const response = await request(`/v1/compras/${id}/adjuntos`, { method: 'POST', body: form });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Envía a SUNAT un comprobante ya emitido. tipo: 'invoices'|'boletas'|
    // 'credit-notes'|'debit-notes'|'dispatch-guides'.
    async enviarSunat(recurso, id) {
      const response = await request(`/v1/${recurso}/${id}/send-sunat`, { method: 'POST' });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Emite una factura o boleta individual (no masiva).
    async crearFactura(payload) {
      const response = await request('/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async crearBoleta(payload) {
      const response = await request('/v1/boletas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async crearNotaCredito(payload) {
      const response = await request('/v1/credit-notes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async crearNotaDebito(payload) {
      const response = await request('/v1/debit-notes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async crearGuia(payload) {
      const response = await request('/v1/dispatch-guides', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Notas de crédito / débito / guías: listados y catálogos.
    async listNotasCredito({ companyId, branchId } = {}) {
      return listarPaginado('credit-notes', { companyId, branchId });
    },

    async listNotasDebito({ companyId, branchId } = {}) {
      return listarPaginado('debit-notes', { companyId, branchId });
    },

    async listGuias({ companyId, branchId } = {}) {
      return listarPaginado('dispatch-guides', { companyId, branchId });
    },

    async motivosNotaCredito() {
      return catalogos('credit-notes/catalogs/motivos');
    },

    async motivosNotaDebito() {
      return catalogos('debit-notes/catalogs/motivos');
    },

    async motivosTrasladoGuia() {
      return catalogos('dispatch-guides/catalogs/transfer-reasons');
    },

    async modalidadesTrasladoGuia() {
      return catalogos('dispatch-guides/catalogs/transport-modes');
    },

    // Descarga genérica de un artefacto (xml|cdr|pdf) de notas y guías.
    async descargarDocumento(recursoNombre, id, format) {
      const response = await request(`/v1/${recursoNombre}/${id}/download-${format}`);
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
      const fallbackExt = format === 'pdf' ? 'pdf' : format === 'cdr' ? 'zip' : 'xml';
      const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `${recursoNombre}-${id}.${fallbackExt}`;
      saveBlob(blob, filename);
      return filename;
    },

    // Resúmenes diarios (boletas).
    async listResumenes({ companyId, branchId } = {}) {
      return listarPaginado('daily-summaries', { companyId, branchId });
    },

    async boletasPendientesResumen({ companyId, branchId, fechaEmision }) {
      const params = new URLSearchParams({
        company_id: String(companyId),
        branch_id: String(branchId),
        fecha_emision: fechaEmision,
      });
      const response = await request(`/v1/daily-summaries/pending?${params}`);
      const json = await response.json();
      return { items: normalizarLista(json), total: json?.total ?? 0 };
    },

    async crearResumen({ companyId, branchId, fechaResumen }) {
      const response = await request('/v1/daily-summaries', {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          branch_id: branchId,
          fecha_resumen: fechaResumen,
        }),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async consultarEstadoResumen(id) {
      const response = await request(`/v1/daily-summaries/${id}/check-status`, { method: 'POST' });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Retenciones (tipo 20).
    async listRetenciones({ companyId, branchId } = {}) {
      return listarPaginado('retentions', { companyId, branchId });
    },

    async crearRetencion(payload) {
      const response = await request('/v1/retentions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Comunicación de baja (anulación).
    async listBajas({ companyId, branchId } = {}) {
      return listarPaginado('voided-documents', { companyId, branchId });
    },

    async documentosAnulables({ companyId, branchId, fechaReferencia, tipoDocumento }) {
      const params = new URLSearchParams({
        company_id: String(companyId),
        branch_id: String(branchId),
        fecha_referencia: fechaReferencia,
      });
      if (tipoDocumento) params.append('tipo_documento', tipoDocumento);
      const response = await request(`/v1/voided-documents/candidates?${params}`);
      const json = await response.json();
      return { items: normalizarLista(json), total: json?.total ?? 0 };
    },

    async crearBaja(payload) {
      const response = await request('/v1/voided-documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async consultarEstadoBaja(id) {
      const response = await request(`/v1/voided-documents/${id}/check-status`, { method: 'POST' });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Emisión masiva desde CSV/XLSX. Devuelve el resumen con emitidos y errores.
    async cargaMasiva({ companyId, branchId, file, enviarSunat = false }) {
      const form = new FormData();
      form.append('company_id', String(companyId));
      if (branchId) form.append('branch_id', String(branchId));
      form.append('archivo', file);
      if (enviarSunat) form.append('enviar_sunat', '1');
      const response = await request('/v1/bulk/documentos', { method: 'POST', body: form });
      const json = await response.json();
      return { resumen: json?.data ?? json, message: json?.message };
    },

    // Descarga la plantilla CSV de carga masiva.
    async descargarPlantillaCarga() {
      const response = await request('/v1/bulk/plantilla');
      const blob = await response.blob();
      saveBlob(blob, 'plantilla-carga-masiva.csv');
    },

    // Importación de comprobantes de períodos anteriores (histórico). Acepta el
    // TXT del PLE (Ventas 14.1 / Compras 8.1) o la plantilla CSV/XLSX. Los
    // comprobantes se guardan SIN enviarse a SUNAT (ya fueron declarados).
    async importarHistorico({ companyId, branchId, file }) {
      const form = new FormData();
      form.append('company_id', String(companyId));
      if (branchId) form.append('branch_id', String(branchId));
      form.append('archivo', file);
      const response = await request('/v1/historical/importar', { method: 'POST', body: form });
      const json = await response.json();
      return { resumen: json?.data ?? json, message: json?.message };
    },

    // Descarga la plantilla CSV de importación histórica (tipo: ventas|compras).
    async descargarPlantillaHistorico(tipo = 'ventas') {
      const response = await request(`/v1/historical/plantilla?tipo=${tipo}`);
      const blob = await response.blob();
      saveBlob(blob, `plantilla-historico-${tipo}.csv`);
    },

    // Propuesta SIRE (RVIE/RCE) generada por el backend a partir de los
    // comprobantes emitidos/recibidos del periodo. libro: 'ventas' | 'compras'.
    async descargarPropuestaSire(companyId, periodo, libro = 'ventas') {
      const { texto, filename } = await this.obtenerPropuestaSire(companyId, periodo, libro);
      saveBlob(new Blob([texto], { type: 'text/plain;charset=windows-1252' }), filename);
      return filename;
    },

    // Devuelve el TEXTO de la propuesta SIRE y su nombre de archivo, sin
    // descargarlo. Se usa para archivar la propuesta por periodo.
    async obtenerPropuestaSire(companyId, periodo, libro = 'ventas') {
      const params = new URLSearchParams({ periodo });
      if (companyId) params.set('company_id', String(companyId));
      const response = await request(`/v1/sire/${libro}?${params}`);
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
      const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `SIRE-${libro}-${periodo}.TXT`;
      // El TXT del SIRE viene en latin-1; se decodifica explícitamente.
      const buffer = await response.arrayBuffer();
      let texto;
      try {
        texto = new TextDecoder('windows-1252').decode(buffer);
      } catch {
        texto = new TextDecoder('utf-8').decode(buffer);
      }
      return { texto, filename };
    },

    // Vista previa de la propuesta (JSON) para revisarla sin descargar.
    async previsualizarPropuestaSire(companyId, periodo, libro = 'ventas') {
      const params = new URLSearchParams({ periodo, preview: '1' });
      if (companyId) params.set('company_id', String(companyId));
      const response = await request(`/v1/sire/${libro}?${params}`);
      const json = await response.json();
      return json?.data ?? json;
    },

    // ========================
    // SERIES / CORRELATIVOS POR SUCURSAL
    // ========================
    // Sucursales de la empresa (para elegir dónde administrar las series).
    async listBranches(companyId) {
      const params = new URLSearchParams();
      if (companyId) params.set('company_id', String(companyId));
      const response = await request(`/v1/branches?${params}`);
      const json = await response.json();
      return json?.data ?? [];
    },

    // Clientes de una empresa (destinatarios de guías y notas).
    async listClients(companyId) {
      const response = await request(`/v1/companies/${companyId}/clients`);
      const json = await response.json();
      return normalizarLista(json);
    },

    // Consulta el padrón por RUC (tipo '6') o DNI (tipo '1') para autocompletar
    // los datos del cliente al emitir. Devuelve
    // { disponible, encontrado, mensaje, data }.
    async consultarDocumento({ tipoDocumento, numeroDocumento }) {
      const params = new URLSearchParams({
        tipo_documento: String(tipoDocumento),
        numero_documento: String(numeroDocumento),
      });
      const response = await request(`/v1/consulta-documento?${params}`);
      return response.json();
    },

    // Facturas emitidas a un cliente (por RUC/DNI). Se usa para vincular una
    // guía de traslado por compra con la factura que la sustenta.
    async listFacturasCliente({ companyId, numeroDocumento } = {}) {
      const params = new URLSearchParams({ per_page: '100' });
      if (companyId) params.set('company_id', String(companyId));
      if (numeroDocumento) params.set('cliente_numero_documento', String(numeroDocumento));
      return listarTodasLasPaginas('/v1/invoices', params);
    },

    // Tipos de documento SUNAT que admiten serie.
    async tiposDocumentoSerie() {
      const response = await request('/v1/correlatives/document-types');
      const json = await response.json();
      return json?.data ?? json;
    },

    // Series configuradas en una sucursal.
    async listCorrelatives(branchId) {
      const response = await request(`/v1/branches/${branchId}/correlatives`);
      const json = await response.json();
      return json?.data?.correlatives ?? [];
    },

    async crearCorrelative(branchId, { tipoDocumento, serie, correlativoInicial = 0 }) {
      const response = await request(`/v1/branches/${branchId}/correlatives`, {
        method: 'POST',
        body: JSON.stringify({
          tipo_documento: tipoDocumento,
          serie,
          correlativo_inicial: correlativoInicial,
        }),
      });
      return response.json();
    },

    async actualizarCorrelative(branchId, id, { tipoDocumento, serie, correlativoActual }) {
      const response = await request(`/v1/branches/${branchId}/correlatives/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          tipo_documento: tipoDocumento,
          serie,
          correlativo_actual: correlativoActual,
        }),
      });
      return response.json();
    },

    async eliminarCorrelative(branchId, id) {
      const response = await request(`/v1/branches/${branchId}/correlatives/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    },

    // Buzón electrónico SUNAT / SUNAFIL. La API envuelve el listado en un
    // paginador de Laravel: { data: { data: [...], current_page, total } }.
    async listNotificaciones({ companyId, entidad, estado } = {}) {
      const params = new URLSearchParams();
      if (companyId) params.set('company_id', String(companyId));
      if (entidad) params.set('entidad', entidad);
      if (estado) params.set('estado', estado);
      const qs = params.toString();
      const response = await request(`/v1/notificaciones${qs ? `?${qs}` : ''}`);
      const json = await response.json();
      const paginador = json?.data ?? {};
      return {
        items: paginador.data ?? [],
        total: paginador.total ?? (paginador.data?.length ?? 0),
        resumen: json?.resumen ?? { pendientes: 0, total: 0 },
        alertas: json?.alertas ?? null,
      };
    },

    async crearNotificacion(payload) {
      const response = await request('/v1/notificaciones', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async marcarNotificacionLeida(id) {
      const response = await request(`/v1/notificaciones/${id}/marcar-leida`, { method: 'POST' });
      const json = await response.json();
      return json?.data ?? json;
    },

    async sincronizarBuzon(companyId) {
      const response = await request('/v1/notificaciones/sincronizar', {
        method: 'POST',
        body: JSON.stringify({ company_id: companyId }),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Adjunta (o reemplaza) el expediente PDF/imagen de una notificación.
    async adjuntarNotificacion(id, file) {
      const form = new FormData();
      form.append('archivo', file);
      const response = await request(`/v1/notificaciones/${id}/adjuntos`, { method: 'POST', body: form });
      const json = await response.json();
      return json?.data ?? json;
    },

    // Descarga el adjunto de una notificación (PDF/imagen).
    async descargarAdjuntoNotificacion(id) {
      const response = await request(`/v1/notificaciones/${id}/adjunto`);
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
      const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `notificacion-${id}`;
      saveBlob(blob, filename);
      return filename;
    },

    // La PWA no puede leer tipoCambio.txt de SUNAT directamente (CORS). El backend
    // actúa de proxy con caché por fecha y responde { fecha, compra, venta }; si
    // devuelve el TXT crudo también se acepta.
    async getTipoCambio(fecha) {
      const response = await request(`/v1/tipo-cambio?fecha=${encodeURIComponent(fecha)}`);
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        // La API envuelve las respuestas en { success, message, data }.
        return json?.data ?? json;
      }
      return parseTipoCambio(await response.text());
    },

    // Comprobantes emitidos (facturas + boletas) del periodo indicado.
    async listVentas({ desde, hasta } = {}) {
      const [facturas, boletas] = await Promise.all([
        listar('01', { desde, hasta }),
        listar('03', { desde, hasta }),
      ]);
      return [...facturas, ...boletas];
    },

    listDocumentos({ tipo = '01', desde, hasta } = {}) {
      return listar(tipo, { desde, hasta });
    },

    // Descarga un artefacto del comprobante y dispara la bajada en el navegador.
    async download(tipoDocumento, id, format) {
      const response = await request(`/v1/${recurso({ tipo_documento: tipoDocumento })}/${id}/download-${format}`);
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
      const fallbackExt = format === 'pdf' ? 'pdf' : format === 'cdr' ? 'zip' : 'xml';
      const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `comprobante-${id}.${fallbackExt}`;
      saveBlob(blob, filename);
      return filename;
    },

    // ========================
    // PADRÓN SSCO (SUJETO SIN CAPACIDAD OPERATIVA)
    // ========================
    // Cruce de un RUC/DNI contra la relación oficial de SUNAT que mantiene el
    // backend. Los comprobantes de un SSCO no dan crédito fiscal ni gasto.
    async consultarSsco(ruc) {
      const response = await request(`/v1/padrones/ssco/${encodeURIComponent(ruc)}`);
      const json = await response.json();
      return json?.data ?? json;
    },

    // Consulta en lote: devuelve { consultados, ssco: { ruc: detalle } }.
    async consultarSscoLote(rucs) {
      const response = await request('/v1/padrones/ssco/lote', {
        method: 'POST',
        body: JSON.stringify({ rucs }),
      });
      const json = await response.json();
      return json?.data ?? json;
    },

    async estadoPadronSsco() {
      const response = await request('/v1/padrones/ssco/estado');
      const json = await response.json();
      return json?.data ?? json;
    },

    // Descarga el padrón oficial de SUNAT y refresca la caché del backend.
    async refrescarPadronSsco() {
      const response = await request('/v1/padrones/ssco/refrescar', { method: 'POST' });
      const json = await response.json();
      return json;
    },

    // Carga manual del .xlsx del padrón (respaldo si SUNAT no responde).
    async subirPadronSsco(file) {
      const form = new FormData();
      form.append('archivo', file);
      const response = await request('/v1/padrones/ssco/subir', { method: 'POST', body: form });
      const json = await response.json();
      return json;
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

// Descarga binaria (por ejemplo el .xlsx del libro corto).
export function downloadBlob(bytes, filename, type = 'application/octet-stream') {
  saveBlob(new Blob([bytes], { type }), filename);
}

export const api = createApi();
