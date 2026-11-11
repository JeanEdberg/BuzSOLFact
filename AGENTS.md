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

## Integración viva PWA ↔ API (desarrollo)

Para ver la app contra el backend real:

1. Backend: `nohup php artisan serve --host=0.0.0.0 --port=12001` (log en
   `/tmp/api-sunat-server.log`).
2. PWA: `npm run dev` (puerto 12000). `vite.config.js` **proxya `/api`** a
   `http://127.0.0.1:12001` (configurable con `VITE_API_PROXY`), así que en dev
   no hace falta `VITE_API_URL` ni CORS.
3. En la pestaña **Conexión API** entrar con un usuario del backend. El seeder
   crea `admin@sunatapi.com` / `admin123456` (super admin),
   `company@sunatapi.com` / `company123456` y `api@sunatapi.com` / `api123456`.

Reglas que no romper:

- **Una sola instancia de la API.** `App.jsx` y los paneles deben importar el
  singleton `{ api }` de `src/lib/api.js`; crear otra instancia con `createApi()`
  deja el token de login solo en esa copia y los paneles reciben 401.
- **`per_page` está limitado a 100** en el backend (reglas `max:100` en los
  `Index*Request`). No pedir 200/500: el cliente pagina con
  `listarTodasLasPaginas()` (lee `last_page` del paginador de Laravel).
- El backend responde **401** solo si la petición lleva `Accept: application/json`;
  sin esa cabecera redirige a la ruta `login` (inexistente). El cliente ya la envía.
- Al poblar la DB de un entorno ya existente, `php artisan migrate --force` antes
  de probar: las tablas `daily_summaries`, `retentions` y `voided_documents`
  pueden estar pendientes y el panel devuelve 500 (`no such table`).

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
- **Pestañas de operación**: `CargaMasiva.jsx` (emisión masiva desde plantilla),
  `EmisionIndividual.jsx` (factura/boleta individual), `ImportacionHistorica.jsx`
  (histórico PLE/plantilla), `NotasGuiasPanel.jsx` (notas 07/08 y guías 09) y
  `RetencionesBajas.jsx` (retenciones 20 y comunicación de baja RA)
  siguen el mismo patrón: reciben `api` y `conectado`, cargan empresa/sucursal y
  muestran aviso ámbar cuando no hay API. El `NotasGuiasPanel` reutiliza los
  catálogos del backend para los motivos y la modalidad de traslado, y usa
  `descargarDocumento(recurso, id, format)`.

## Tasa especial del IGV (Ley 31556)

`src/lib/igvEspecial.js` modela la tasa especial y temporal del IGV para MYPE de
restaurantes, hoteles y alojamientos turísticos. El porcentaje que viaja en cada
línea gravada (`porcentaje_igv`, `<cbc:Percent>`) es la **tasa total IGV + IPM**,
igual que el 18 % del régimen general (16 % IGV + 2 % IPM).

- **Ley 31556** (12/08/2022): IGV especial del 8 %, vigente del 01/09/2022 al
  31/12/2024 (art. 4 original).
- **Ley 32219** (29/12/2024): prorroga el 8 % para 2025 y 2026 y fija el 12 %
  para 2027 (modifica los arts. 1, 3 y 4 de la Ley 31556).
- **Ley 32387** (16/06/2025): sube el IPM del 2 % al 4 % (+0,5 % anual desde
  2026) sin tocar el 8 % del IGV especial. Modificó además el art. 17 del TUO del
  IGV (14 %) y el art. 76 de la Ley de Tributación Municipal (IPM 4 %), pero su
  aplicación cuantitativa es progresiva; por eso `TASA_GENERAL` se mantiene en
  18 % y no se altera el régimen común.

Totales del régimen especial: 10 % (2022-2025), 10,5 % (2026), 15 % (2027). En
`EmisionIndividual.jsx` hay una casilla "Régimen especial… (Ley 31556)" que solo
se habilita cuando el año de emisión está entre 2025 y 2027; aplica la tasa a los
ítems gravados y a la base de la detracción. Requisitos de fondo que la UI
recuerda: MYPE con ventas anuales ≤ 1700 UIT y ≥ 70 % de ingresos del rubro.

## Validación SSCO / SIRE

Módulo de control tributario: marca las contrapartes que SUNAT publica como
**Sujetos Sin Capacidad Operativa (SSCO)** y cruza el libro contra la propuesta
**SIRE**. Los comprobantes de un SSCO **no dan crédito fiscal ni sustentan gasto**
(Decreto Legislativo N.º 1532).

Frontend:

- `src/lib/xlsxRead.js` — `readXlsx(ArrayBuffer)` → `[{name, rows}]`. Lee OOXML
  (ZIP store + deflate) **sin dependencias externas**; soporta celdas en línea y
  compartidas. Sirve para el padrón `.xlsx` de SUNAT (Hoja1 con cabecera).
- `src/lib/ssco.js` — `parseSscoPadron`, `buildSscoIndex`, `consultarSsco`,
  `marcarSsco(filas, index, 'proveedor'|'cliente')`, `resumenSsco`,
  `excelSerialToDate` (convierte el serial de fecha de Excel a ISO).
- `src/lib/cruceSire.js` — `parsePropuestaSire(texto, 'ventas'|'compras')` y
  `cruzarConPropuesta(filas, propuesta, tipo)`: devuelve coincidencias,
  `soloPropuesta` (en SIRE y no en el libro), `soloPropio`, `diferencias` de
  importes y los `ssco` detectados.
- `src/lib/repoPropuestas.js` — repositorio local (localStorage) de propuestas
  SIRE por **periodo** y libro; re-descargar reemplaza la anterior, sin
  duplicados.
- `src/lib/validacionPeriodo.js` — `validarPeriodo({propios, propuesta, libro,
  padronIndex, periodo})`: cruce del **periodo elegido (mes/año)** contra la
  propuesta SIRE y el padrón; devuelve el reporte con IGV/importe afectado y las
  referencias directas a cada comprobante (`sscoPropios`).
- `src/ValidacionPanel.jsx` — pestaña "Validación SSCO / SIRE": pide el
  **periodo (mes/año)** y el libro, descarga la propuesta del backend (o usa la
  archivada), cruza contra el padrón y muestra el reporte con enlace **Ver** al
  comprobante. También permite subir un `.TXT` de propuesta y administrar el
  padrón (`api.consultarSscoLote`, `.xlsx` manual, actualizar desde SUNAT).
- `src/lib/libroCorto.js` — columna "SSCO" vía `marcadorSsco`.

Backend (`/tmp/api-sunat`):

- `SscoPadron` + migración `create_ssco_padron_table`; `XlsxReader` (ZipArchive +
  SimpleXML) y `SscoService`; `SscoController` bajo `api/v1/padrones/ssco`:
  `GET /{ruc}`, `GET /estado`, `POST /lote`, `POST /refrescar` (descarga desde
  SUNAT) y `POST /subir` (padrón `.xlsx` manual).
- `SirePropuesta` + migración `create_sire_propuestas_table` (**única**
  `company_id`+`libro`+`periodo`, sin duplicados); `SireService` genera RVIE/RCE
  desde los comprobantes del periodo; `SireController` bajo `api/v1/sire`:
  `GET /{libro}?periodo=AAAA-MM[&preview=1]` (genera, archiva y descarga el
  `.TXT` en windows-1252 con el nombre oficial), `GET /{libro}/{periodo}`
  (recupera la archivada), `GET /` (lista), `POST /subir` (archiva un `.TXT`
  descargado del portal). El **periodo canónico es `AAAA-MM`**; la columna es
  `string(7)`.
- En `SireService`, la fecha se formatea **una sola vez** al construir la línea
  (`d/m/Y`); no re-parsear con `Carbon::parse()` un `d/m/Y` ya formateado, porque
  lo interpreta como `m/d/Y` y desfasa el mes.
- `rep_legal_doc` es **string(30)**: el DNI del representante legal llegó a 20 y
  provocó truncado; no reducirlo.
- La sincronización real deja **1162 registros** en BD (padrón oficial SUNAT).
- Tests: `tests/Feature/SscoPadronTest.php` y `tests/Feature/SirePropuestaTest.php`
  (Pest, `RefreshDatabase`, `actingAs(User::factory())`).

Integración de compras PWA↔API: **cerrada**. El backend expone `/v1/compras`
(listado, alta manual, importación del XML UBL del proveedor, descarga y
adjuntos); el registro de compras del libro ya se carga desde la API. El cruce
SSCO de compras opera tanto con datos de la API como locales.

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
- `daily-summaries` (resumen diario de boletas, tipo RC): `GET /` (paginador),
  `GET /pending?company_id=&branch_id=&fecha_emision=` (boletas PENDIENTES de la
  fecha), `POST /` (agrupa las pendientes y asigna correlativo), `POST /{id}/send-sunat`,
  `POST /{id}/check-status`, `GET /{id}/download-{xml,cdr}`. El modelo `DailySummary`
  expone `fecha_emision` y `numero_completo` (accessors) para `FileService`.
- `retentions` (comprobante de retención, tipo 20): `GET /` (paginador),
  `POST /` (el correlativo lo asigna el backend por sucursal, tipo `20`),
  `GET /{id}`, `POST /{id}/send-sunat`, `GET /{id}/download-{xml,cdr}`.
  `imp_retenido`/`imp_pagado` son la suma de los detalles.
- `voided-documents` (comunicación de baja, resumen RA): `GET /` (paginador),
  `GET /candidates?company_id=&branch_id=&fecha_referencia=&tipo_documento=`
  (documentos ACEPTADOS anulables), `POST /` (valida máx. 7 días y duplicados),
  `GET /{id}`, `POST /{id}/send-sunat`, `POST /{id}/check-status`,
  `GET /{id}/download-{xml,cdr}`. El correlativo del RA es por fecha de
  comunicación; `numero_completo` = `RA-AAAAMMDD-correlativo`.
- `dispatch-guides`: `GET /catalogs/transfer-reasons`, `GET /catalogs/transport-modes`,
  `GET /` (paginador), `POST /`, `GET /{id}`, `POST /{id}/generate-pdf`. El payload
  usa `fec_traslado` (se normaliza a `fecha_traslado`) y `destinatario_id`.
  Acepta `documentos_relacionados` (array `{tipo, tipo_desc, numero[, emisor]}`,
  catálogo 61: la factura que sustenta el traslado) y `datos_adicionales`; ambos se
  persisten y `documentos_relacionados` se emite en el XML como
  `cac:AdditionalDocumentReference` (`GreenterService::createDespatch` →
  `Despatch::setAddDocs`).
- `invoices`: `GET /` acepta el filtro `cliente_numero_documento` (RUC/DNI del
  cliente) para listar las facturas de un cliente y vincularlas a una guía.
- `consulta-documento`: `GET /consulta-documento?tipo_documento=6|1&numero_documento=…`
  consulta el padrón RUC/DNI para autocompletar el cliente. Devuelve
  `{success, disponible, encontrado, mensaje, data}`; sin proveedor configurado
  (`SUNAT_CONSULTA_RUC_ENDPOINT` / `SUNAT_CONSULTA_DNI_ENDPOINT`, opcionalmente
  con `SUNAT_CONSULTA_USUARIO`/`SUNAT_CONSULTA_CLAVE`) responde `disponible:false`
  y la PWA cae al ingreso manual.
- `companies/{id}/gre-credentials`: `GET /`, `PUT /` (`modo` + `client_id`,
  `client_secret`, `ruc_proveedor`, `usuario_sol`, `clave_sol`), `POST /test-connection`,
  `DELETE /clear`, `POST /copy`; además `GET /gre-credentials/defaults/{modo}`.
- `notificaciones` (buzón): `GET /` (paginador Laravel en `data` + `resumen`),
  `POST /` (alta manual), `POST /{id}/marcar-leida`, `POST /sincronizar`,
  `POST /{id}/adjuntos` (multipart `archivo` PDF/imagen) y
  `GET /{id}/adjunto` (descarga). El listado añade `alertas.certificado` con
  `tiene`, `vencido`, `por_vencer`, `vence_en` y `dias_restantes`; el panel
  pinta un aviso cuando el certificado venció o está por vencer.
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
- `historical` (importación de períodos anteriores): `POST /historical/importar`
  (multipart `company_id`, `branch_id?`, `archivo` TXT/CSV/XLSX) y
  `GET /historical/plantilla?tipo=ventas|compras`. `HistoricalImportService`
  detecta el formato: si el archivo trae `|` se trata como PLE y `PleParser`
  clasifica por número de campos (34 = Ventas 14.1, 41 = Compras 8.1); si no, se
  lee como plantilla con columna `tipo_registro`. Los comprobantes se guardan con
  estado `ACEPTADO` y SIN enviar a SUNAT (idempotente: reimportar actualiza).
  En ventas se omiten las notas 07/08; en compras los buckets mixtos/no gravados
  del PLE se suman a los principales.
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
