# AGENTS.md

## Proyecto

**BuzSOLFact — INMOA ERP & Facturación PWA**: ERP contable para Perú (buzón
SUNAT/SUNAFIL, descarga XML/PDF/CDR y Libros Electrónicos).

## Stack

- Vite 5 + React 18 + Tailwind 3 (JavaScript, sin TypeScript).
- Tests con Vitest.
- El backend de facturación es externo (Laravel 12 + Greenter) y se consume vía
  `VITE_API_URL`; ver `src/lib/api.js` para el contrato de endpoints.

## Comandos

```bash
npm install
npm run dev      # puerto 12000
npm run build
npm test         # vitest (src/lib/*.test.js)
```

Los iconos de la PWA se generan con `python3 scripts/generate-icons.py` (requiere
Pillow) hacia `public/icons/`; no se editan a mano. Si cambia el `theme-color`,
volver a generarlos.

## Convenciones

- El cliente de la API (`src/lib/api.js`) asume el contrato real del backend:
  login con `access_token`, `invoices` paginado y `boletas` como array.
  `src/lib/mapper.js` traduce el comprobante a la fila de libro y normaliza
  fechas ISO y correlativos a 8 dígitos.
- **El service worker solo se registra en producción.** En desarrollo el
  cache-first de Vite sirve módulos antiguos y oculta los cambios; `main.jsx`
  desregistra cualquier SW previo en dev.
- El tipo de cambio se resuelve por fecha (`src/lib/tipoCambio.js`) porque la API
  no lo persiste. La PWA no puede leer el TXT de SUNAT (CORS restringido a
  `ww3.sunat.gob.pe`), así que requiere el proxy `GET /v1/tipo-cambio?fecha=`.
  La API responde `{success, message, data:{fecha, compra, venta}}`; el cliente
  desenvuelve `data` (y también acepta el TXT crudo). Se usa la tasa de venta. La
  caché se indexa por fecha y deduplica peticiones.
  El backend Laravel ya implementa el proxy
  ([PR #1](https://github.com/bvislao/Api-de-facturacion-electronica-sunat-Peru/pull/1)).
- El generador PLE (`src/lib/ple.js`) sigue el Anexo N.º 2 de la **RS
  112-2021/SUNAT**: campos separados por `|`, línea terminada en `|`, fechas
  `DD/MM/AAAA`, montos a 2 decimales, NC/ND con signo negativo.
  - Ventas 14.1 (`140100`) = 34 campos.
  - Compras 8.1 (`080100`) = 41 campos.
- El generador SIRE (`src/lib/sire.js`) sigue el Anexo N.º 3 de la RS 112-2021
  (RVIE, `140400`) y el Anexo N.º 11 de la RS 040-2022 (RCE, `080400`).
  - RVIE informa **33** campos; los 34-40 los completa la Administración y NO se envían.
  - RCE informa **37** campos y sí envía 38-41 vacíos.
  - Fin de línea CRLF. Estructura contrastada contra archivos reales aceptados por SUNAT.
- Nombre de archivo: PLE `LE` + RUC(11) + AAAAMM + `00` + libro(6) + `001111` + `.TXT`;
  SIRE reemplaza la propuesta con las banderas `021112`.
- Al añadir columnas a los libros, actualizar `ple.test.js` / `sire.test.js`
  (los tests fijan la posición y el conteo de campos).

## Backend (Laravel 12 + Greenter) — contrato relevante

El backend vive aparte (fork `JeanEdberg/Api-de-facturacion-electronica-sunat-Peru`).
Endpoints que consume la PWA, todos bajo `auth:sanctum` y prefijo `/api/v1`:

- `companies`: `GET /companies` (lista ligera con `usuario_sol`, `modo_produccion`,
  `contribuyente_amazonia`, `tipo_amazonia`), `GET /companies/{id}` (`data.company`),
  `PUT /companies/{id}` (**actualización parcial**: solo se validan los campos
  enviados; con archivo se usa `POST` + `_method=PUT`). El formulario de Accesos SOL
  manda únicamente `usuario_sol`/`clave_sol`, así que no exigir el resto de datos.
- `credit-notes` / `debit-notes`: `GET /catalogs/motivos`, `GET /` (paginador),
  `POST /`, `GET /{id}`, `POST /{id}/generate-pdf`.
- `dispatch-guides`: `GET /catalogs/transfer-reasons`, `GET /catalogs/transport-modes`,
  `GET /` (paginador), `POST /`, `GET /{id}`, `POST /{id}/generate-pdf`. El payload
  usa `fec_traslado` (se normaliza a `fecha_traslado`) y `destinatario_id`.
- `companies/{id}/gre-credentials`: `GET /`, `PUT /` (`modo` + `client_id`,
  `client_secret`, `ruc_proveedor`, `usuario_sol`, `clave_sol`), `POST /test-connection`,
  `DELETE /clear`, `POST /copy`; además `GET /gre-credentials/defaults/{modo}`.
- `notificaciones` (buzón): `GET /` (paginador Laravel en `data` + `resumen`),
  `POST /` (alta manual), `POST /{id}/marcar-leida`, `POST /sincronizar`.
- `compras` (recibidos): `GET /` (paginador), `POST /` (alta manual),
  `POST /importar-xml` (multipart `company_id` + `xml`), `GET /{id}`,
  `DELETE /{id}`. Se deduplica por `(empresa, proveedor, tipo, serie, correlativo)`
  y el modelo expone `proveedor` anidado (mismo vocabulario que `mapCompra`).
  El parser UBL acumula base e impuesto por código de tributo (`TaxSubtotal`),
  no desde `LegalMonetaryTotal`.
- `tipo-cambio`: `GET /tipo-cambio?fecha=AAAA-MM-DD`.
- `bulk` (carga masiva): `POST /bulk/documentos` (multipart `company_id`,
  `branch_id?`, `archivo` CSV/XLSX, `enviar_sunat?`), `GET /bulk/plantilla`
  (CSV de ejemplo). Cada fila es un ítem; las filas con el mismo `grupo` se
  consolidan en un comprobante con varias líneas. La extensión original del
  archivo se pasa a `SpreadsheetReader` (no confiar en el temporal sin extensión).
- `sire` (propuesta): `GET /sire/ventas|compras?company_id=&periodo=AAAA-MM`
  descarga el TXT oficial (`LE…021112.TXT`); con `?preview=1` devuelve
  `{filename, registros, contenido}` en JSON. RVIE = 33 campos; RCE = 41 campos
  (38-41 vacíos). El tipo de cambio de ventas en moneda extranjera se resuelve
  con `TipoCambioService` por fecha.
- `compras`: además del CRUD, `GET /compras/{id}/download-{xml,cdr,pdf}` y
  `POST /compras/{id}/adjuntos` (PDF manual). El modelo `Compra` guarda
  `xml_path`/`cdr_path`/`pdf_path`.
- `correlatives` (series): `GET /branches/{branch}/correlatives`,
  `POST /branches/{branch}/correlatives`, `PUT|DELETE …/{correlative}`,
  `POST /branches/{branch}/correlatives/batch`,
  `POST …/{correlative}/increment`, `GET /correlatives/document-types`.
  `Correlative::getNumeroCompletoAttribute` = `serie-correlativo(6)`. El
  correlativo que se persiste es el **último usado**.

Reglas del backend que conviene no romper:

- **Multiempresa real**: cada empresa tiene sus credenciales SOL y su **propio
  certificado** (`certificado_pem`, guardado por RUC). El certificado se resuelve
  por empresa en `GreenterService`; NO volver a una ruta fija compartida.
- Los secretos (`clave_sol`, `certificado_password`) van en `$hidden`. Al
  actualizar, si llegan vacíos o nulos el backend **conserva** el valor previo
  (Laravel convierte `""` en `null`). La UI nunca muestra el valor actual.
- El buzón se deduplica por `(company_id, entidad, codigo)`. SUNAT/SUNAFIL no
  publican API REST pública del buzón: la sincronización usa un endpoint
  configurable (`SUNAT_BUZON_ENDPOINT`, `SUNAFIL_BUZON_ENDPOINT`); sin él, el
  alta manual sigue funcionando.
- Autorización por empresa: `User::canAccessCompany($id)` (el super admin accede
  a todas). Filtrar por `company_id` cuando se envía; si no, la empresa del usuario.

Notas de entorno y convenciones del backend:

- **Generación de PDF**: DomPDF embebe el QR como imagen, así que requiere la
  extensión **GD** de PHP (`php8.4-gd`). Sin ella, `generate-pdf` devuelve 500
  (`The PHP GD extension is required`).
- **Trait de configuración**: `Company` usa `HasCompanyConfigurations` (tabla
  `company_configurations`), no `ConfigurableCompany`. Las credenciales GRE viven
  en columnas `gre_*` de `companies` y se leen con `getConfig('credenciales_gre.{modo}')`
  / `greCredentialsForMode($modo)`. `setGreCredentials($modo, $credenciales)`.
- **Tests**: los endpoints de documentos están bajo `auth:sanctum`; las pruebas
  deben autenticar (`$this->actingAs(User::factory()->create())`). Los factories de
  notas y guías ya existían; el de guías tenía una coma faltante tras `vehiculo`.
