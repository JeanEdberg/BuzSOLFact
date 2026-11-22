# AGENTS.md

## Proyecto

**BuzSOLFact — INMOA ERP & Facturación PWA**: ERP contable para Perú (buzón
SUNAT/SUNAFIL, descarga XML/PDF/CDR y Libros Electrónicos).

## Stack

- Vite 5 + React 18 + Tailwind 3 (JavaScript, sin TypeScript).
- Tests con Vitest. Los de `src/lib/*.test.js` cubren la lógica; los de UI
  (`.test.jsx`) usan `jsdom` + Testing Library con `// @vitest-environment jsdom`
  y stubbean `fetch`, nunca el componente.
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
   Para la empresa real INMOA, `InmoaSeeder` crea `jguevara91@inmoa.com`
   (super admin) e `inmoalogisticaysoluciones@gmail.com` (admin de INMOA); las
   contraseñas se leen de `INMOA_SUPERADMIN_PASSWORD` / `INMOA_ADMIN_PASSWORD`
   en el `.env` del backend. `php artisan migrate:fresh --seed` deja todo listo.

## Entorno de demo local (SQLite + datos INMOA)

Para enseñar la app sin MySQL ni credenciales reales:

```bash
cd /tmp/api-sunat
touch database/demo.sqlite
export DB_CONNECTION=sqlite DB_DATABASE=/tmp/api-sunat/database/demo.sqlite
export INMOA_SUPERADMIN_PASSWORD='...' INMOA_ADMIN_PASSWORD='...'
php artisan migrate:fresh --force
php artisan db:seed --class=RolesAndPermissionsSeeder --force
php artisan db:seed --class=InmoaSeeder --force
php artisan serve --host=127.0.0.1 --port=12001
```

Las variables van por entorno y **no** se tocan en el `.env` del backend, que
sigue apuntando a MySQL.

La fuente del buzón de la empresa hay que apuntarla al puente con
`POST /api/v1/notificaciones/fuente`; el endpoint incluye la ruta, es decir
`http://127.0.0.1:12002/buzon`, no sólo el host.

### SUNAT/SUNAFIL no es alcanzable desde este entorno

`e-menu.sunat.gob.pe` resetea la conexión (el resto de internet responde). El
puente devuelve entonces "el servidor de la casilla no responde". La cadena
PWA → Laravel → puente funciona; lo que falta es salida a SUNAT. Para ver el
buzón con datos, sembrar `Notificacion` a mano en la base de demo.

## Autocompletado por RUC/DNI

- La PWA consulta el padrón al escribir los 11 dígitos del RUC (pestaña
  Conexión API → Crear empresa) y rellena razón social, dirección y ubigeo.
- Endpoint backend `GET /api/v1/consulta-documento?tipo_documento=6&numero_documento=…`
  (tipo 6 = RUC, tipo 1 = DNI). Devuelve `{ disponible, encontrado, mensaje, data }`.
- Es **público** (el alta de empresa ocurre antes del login) y va con
  `throttle:30,1`. Usa Decolecta (`DECOLECTA_TOKEN`); sin token responde
  `disponible: false` y el formulario pide los datos a mano.

## Aislamiento por empresa

- `app/Http/Controllers/Concerns/ScopesByCompany.php` limita las consultas a la
  empresa del usuario. El `super_admin` ve todas; cualquier otro rol solo la
  suya, aunque pida otro `company_id`. Al aplicar el trait a un modelo cuya
  clave es `id` (no `company_id`), pasar la columna: `scopeToUserCompany($q, $r, 'id')`.


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

## Base de datos Supabase (PostgreSQL)

El backend usa SQLite/MySQL en desarrollo. Para apuntar a Supabase (PostgreSQL):

1. En el backend, instala la extensión de PHP: `sudo apt-get install -y php8.4-pgsql` (verifica con `php -m | grep pgsql`).
2. Copia la cadena de conexión de Supabase (Project Settings → Database). En `.env` del backend:

   ```
   DB_CONNECTION=pgsql
   DB_HOST=aws-0-<region>.pooler.supabase.com   # Session pooler o conexión directa
   DB_PORT=5432
   DB_DATABASE=postgres
   DB_USERNAME=postgres.<project-ref>
   DB_PASSWORD=<tu-password>
   DB_SSLMODE=require
   ```

3. Prepara el esquema y los datos base: `php artisan migrate:fresh --seed`.
   Deja 25 regiones, 196 provincias, 1874 distritos y la empresa INMOA.

Notas de portabilidad ya resueltas: `UbiDistritoSeeder` solo desactiva las claves foráneas en SQLite/MySQL, y `UbiProvinciasSeeder` incluye la provincia 080400 (Calca) que antes faltaba y rompía el sembrado en PostgreSQL. El `sslmode` se lee de `DB_SSLMODE`.

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

## Exoneración de la Amazonía (Ley 27037)

`src/lib/amazonia.js` modela el ámbito territorial de la Amazonía (art. 3.1 de la
Ley 27037, con las modificaciones de las Leyes 27759, 29525 y 30399). Es espejo
de `App\Support\Amazonia` del backend y sirve para decidir en pantalla si una
empresa opera en la zona a partir de su **ubigeo**, sin depender solo del flag
manual `contribuyente_amazonia`.

- `perteneceAmazonia(ubigeo)`: acepta 6 dígitos (o prefijos de 2/4). Devuelve
  `true` para los departamentos íntegros (Amazonas, Loreto, Madre de Dios, San
  Martín, Ucayali), las provincias completas (Jaén, San Ignacio, La Convención,
  Leoncio Prado, Marañón, Pachitea, Puerto Inca, Chanchamayo, Satipo, Oxapampa)
  y los distritos nombrados uno por uno.
- `esContribuyenteAmazonia(empresa)`: `true` si la marca manual, el `es_amazonia`
  que calcula el backend o el ubigeo indican Amazonía.
- `tipoAmazoniaDe(empresa)`: leyenda por defecto (2001 bienes / 2002 servicios /
  2003 construcción).

En `EmisionIndividual.jsx` el bloque verde de Amazonía ofrece el selector de
leyenda y un interruptor *Aplicar exoneración*: al activarlo las líneas gravadas
pasan a exoneradas (afectación 20) y el payload envía `tipo_amazonia` y
`aplicar_amazonia`. La exoneración y el régimen especial de la Ley 31556 son
excluyentes. `NotasGuiasPanel.jsx` añade el selector de leyenda a las guías (el
backend la antepone a `observaciones`) y `AccesosSol.jsx` avisa cuando el ubigeo
de la empresa ya cae en la Amazonía aunque el interruptor esté en «No».

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
  `POST /`, `GET /{id}`, `POST /{id}/generate-pdf`, `POST /{id}/send-sunat` y
  `GET /{id}/download-{xml,cdr,pdf}`.
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
  `GET /` (paginador), `POST /`, `GET /{id}`, `POST /{id}/generate-pdf`,
  `POST /{id}/send-sunat` y `GET /{id}/download-{xml,cdr,pdf}`. El payload
  usa `fec_traslado` (se normaliza a `fecha_traslado`) y `destinatario_id`.
  Acepta `documentos_relacionados` (array `{tipo, tipo_desc, numero[, fecha]}`,
  catálogo 61: la factura que sustenta el traslado) y `datos_adicionales`; ambos se
  persisten y `documentos_relacionados` se emite en el XML como
  `cac:AdditionalDocumentReference` (`GreenterService::createDespatch` →
  `Despatch::setAddDocs`) y se imprime en el PDF de la guía ("DOCUMENTOS
  RELACIONADOS") en todos los formatos.
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
  `POST /fuente` (configura fuente + credenciales SOL), `POST /probar-fuente`
  (valida la conexión sin importar), `POST /{id}/adjuntos`
  (multipart `archivo` PDF/imagen) y
  `GET /{id}/adjunto` (descarga). El listado añade `alertas.certificado` con
  `tiene`, `vencido`, `por_vencer`, `vence_en` y `dias_restantes`; el panel
  pinta un aviso cuando el certificado venció o está por vencer. También añade
  `fuente` (`sunat`, `sunafil`, `configurado`, `token`, `sol`, `origenes`).
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
  publican API REST pública del buzón: la fuente se resuelve **por empresa**
  (columnas `buzon_sunat_endpoint`, `buzon_sunafil_endpoint`, `buzon_token`) y,
  si están vacías, cae a la global del entorno (`SUNAT_BUZON_ENDPOINT`,
  `SUNAFIL_BUZON_ENDPOINT`, `BUZON_TOKEN`). El endpoint configurado debe
  responder `{ "data": [ {entidad, codigo, asunto, fecha, ...} ] }`; el backend
  lo consulta con el `ruc` y el `usuario_sol` de la empresa y manda el token como
  `Bearer`. Sin ninguna fuente, la sincronización no falla y el alta manual sigue
  disponible. La PWA lo configura en el botón *Fuente* del panel del buzón.
- **El buzón usa la Clave SOL real, no un endpoint genérico.** El acceso al
  buzón exige login en el Menú SOL, así que la fuente es el puente
  `tools/buzon-bridge/sol_buzon.py` del repo del backend: hace el OAuth2 de
  SUNAT con la Clave SOL de la empresa y devuelve el buzón como JSON. El backend
  manda la clave en la cabecera `X-SOL-Clave` (nunca en la URL, para no dejarla
  en logs) junto con `Authorization: Bearer <BUZON_TOKEN>`. `fuente.sol` del
  listado indica si hay usuario y clave guardados; si falta, el panel avisa de
  que sincronizar no traerá nada. *Probar conexión* llama a `/probar-fuente` y
  muestra el motivo real (clave rechazada, captcha, puente caído). El puente
  separa el mensaje para el usuario (`error`) del texto crudo de SUNAT
  (`detalle`). Las credenciales `MODDATOS`/`moddatos` del seeder son de
  **prueba** y SUNAT las rechaza en producción: la clave real se guarda desde
  el panel y nunca se muestra de vuelta.
- **Los errores de la API se muestran como texto, no como JSON.** `request()`
  de `src/lib/api.js` lee el cuerpo del error y usa `message` y `error` del
  backend, que ya están redactados para el usuario. Nunca volcar el cuerpo
  crudo: el mensaje real queda enterrado entre llaves y comillas. Si un panel
  muestra un estado vacío, comprobar también si hay error, para no afirmar
  "no hay datos" cuando en realidad la lectura falló.
- Autorización por empresa: `User::canAccessCompany($id)` (el super admin accede
  a todas). Filtrar por `company_id` cuando se envía; si no, la empresa del usuario.

Notas de entorno y convenciones del backend:

- **Generación de PDF**: DomPDF embebe el QR como imagen, así que requiere la
  extensión **GD** de PHP (`php8.4-gd`). Sin ella, `generate-pdf` devuelve 500
  (`The PHP GD extension is required`).
- **QR en todos los formatos**: el QR (obligatorio en la representación impresa)
  debe salir en factura, boleta, notas 07/08 y guías, en `A4`, `A5`, `80mm` y
  `50mm`. `resources/views/pdf/components/qr-footer.blade.php` envuelve el bloque
  en `.qr-info-container` (`display: table`): sin ese contenedor, el
  `display: table-cell` de `.qr-section` rompe DomPDF y el QR desaparece en A5.
  Las notas de 80mm/50mm reutilizan `components/reference-document` (no imprimir
  los arrays `$documento_afectado`/`$motivo` directamente).
  `tests/Feature/QrPdfTest.php` verifica que el PDF contenga un XObject de imagen
  (`/Image`) en cada formato; los documentos se crean con `Model::create()` (no
  existen factories de `Invoice`/`Boleta`).
- **Trait de configuración**: `Company` usa `HasCompanyConfigurations` (tabla
  `company_configurations`), no `ConfigurableCompany`. Las credenciales GRE viven
  en columnas `gre_*` de `companies` y se leen con `getConfig('credenciales_gre.{modo}')`
  / `greCredentialsForMode($modo)`. `setGreCredentials($modo, $credenciales)`.
- **Tests**: los endpoints de documentos están bajo `auth:sanctum`; las pruebas
  deben autenticar (`$this->actingAs(User::factory()->create())`). Los factories de
  notas y guías ya existían; el de guías tenía una coma faltante tras `vehiculo`.

## Onboarding self-service y envío asíncrono

- **Registro desde la PWA**: la pestaña *Conexión* tiene dos modos (`Ingresar` /
  `Crear empresa`). El registro llama a `POST /api/auth/register` y deja la
  sesión lista (empresa + sucursal + usuario admin). `api.register(payload)`
  acepta JSON o `FormData` cuando se adjunta el certificado `.pem`.
- **Envío en segundo plano**: `api.enviarSunat(recurso, id, { async: true })`
  manda `{"async": true}`; el backend responde **202** y encola
  `SendDocumentToSunatJob` (reintentos automáticos). La lista de facturas tiene
  el interruptor *Envío en segundo plano (con reintentos)*.
- **Certificado por empresa (backend)**: cada RUC firma con su propio PEM
  (`Company::certificadoContenido()`), ya **no** con un archivo fijo compartido.
  Al crear empresa sin certificado, `usuario_sol`/`clave_sol` son opcionales.

## Puente SUNAFIL (`tools/buzon-bridge/`) — lecciones

El puente vive en el repo del backend, no en este. Lo que sigue se aprendió
depurando la descarga de la carta, que costó cinco intentos.

- **La casilla no tiene URL por documento.** Todo es JSF/PrimeFaces: el estado
  de la vista va y viene en `javax.faces.ViewState`, y hay que devolverlo en
  cada petición. Nunca se puede "adivinar" una URL de PDF.
- **Hay dos modos de submit.** Las constancias son submit normal. La carta
  exige POST AJAX (`Faces-Request: partial/ajax`, `partial.ajax=true`,
  `partial.event=click`). Sin eso el servidor no registra qué fila se eligió y
  la descarga posterior falla con un 500 **dentro** de SUNAFIL
  (`viewId:/jsfDocs/modulos/...`).
- **No deducir los campos del HTML.** El puente los deducía y fallaba. Los
  campos reales, copiados de la pestaña Red del navegador, están en
  `carta_sunafil.py`. Si SUNAFIL cambia la pantalla, hay que volver a copiarlos.
- **El botón de descarga del diálogo se llama siempre `btnverDocumento`**, con
  valor vacío. No es un `j_idtNN` generado. Se perdió tiempo intentando
  elegirlo por su texto visible, y excluyéndolo por su nombre.
- **`CERTIFICATE_VERIFY_FAILED` no es un fallo de cifrado.** Significa que el
  saludo TLS se negoció y sólo falló la validación del certificado. Tratarlo
  como fallo de cifrado dejaba al puente sin ninguna configuración válida y
  abortaba antes de la primera petición. Ahora se reintenta sin verificar.
- **El `ViewState` es de la vista, no del formulario**, y hay que usar el más
  reciente: el de una respuesta anterior ya caducó.

### Estado verificado contra SUNAFIL real

| documento | resultado |
|---|---|
| `carta` | PDF de 132 KB |
| `constancia_deposito` | PDF de 25 KB |
| `constancia_acuse` | PDF de 42 KB |

### Pendiente: el ERP no usa el puente para descargar

El puente expone `POST /documento` y descarga los tres PDF, pero el backend
Laravel **no lo llama**. `BuzonService` sólo tiene `sincronizar()` (listar) y
`adjuntar()` (subida manual). `GET /v1/notificaciones/{id}/adjunto` sirve el
archivo guardado en `Storage::disk('public')`, no lo pide al puente.

Para cerrar el circuito hace falta: un método en `BuzonService` que llame a
`/documento` con `{ruc, usuario, clave, bandeja, indice, tipo}`, guardar el
binario en el disco y que `descargarAdjunto` lo sirva.

### Paneles conectados a la API (no copias)

Cada pestaña del menú tiene su componente en `src/`: `GuiasPanel`,
`ResumenDiario`, `RetencionesBajas`, `CargaMasiva`, `ImportacionHistorica`.
Si una pestaña muestra datos de otra, es un bug de `App.jsx`, no del panel.

Campos reales que devuelve `GET /v1/dispatch-guides`: el destinatario viene
anidado (`destinatario.razon_social`, `destinatario.numero_documento`) y el
motivo de traslado es `des_traslado`. No existen `destinatario_razon_social`
ni `motivo_traslado`; el modelo no declara `$appends`, así que los accessors
no se serializan.

`NotasGuiasPanel` acepta `subInicial` para abrirse directamente en la
subpestaña de guías (`'guia'`) desde el botón "Emitir una guía".

### El backend vive en `/workspace/api-sunat`, no en `/tmp`

El 2026-11-22 el entorno se reinició y borró `/tmp`, llevándose el clon del
backend y un commit que nunca se subió. Se recuperó replicando las acciones
`file_editor` y los comandos de escritura del historial de eventos en
`/var/openhands/conversations/<id>/events/`.

Para evitarlo: clonar el backend bajo `/workspace/` y hacer push en cuanto
haya un commit, no al final de la sesión.

Para reconstruir un archivo perdido, los eventos guardan cada acción con sus
argumentos completos:

```bash
cd /var/openhands/conversations/<id>/events
python3 -c "
import json,glob
for f in glob.glob('*.json'):
    d=json.load(open(f)); tc=d.get('tool_call') or {}
    a=tc.get('arguments') or {}
    if isinstance(a,str):
        import json as j; a=j.loads(a)
    if 'NOMBRE_DEL_ARCHIVO' in (a.get('path') or ''): print(f, a.get('command'))
"
```

Ojo: las ediciones hechas con `sed -i` o `python3 - <<PY` por terminal no
aparecen como `file_editor`, hay que extraerlas aparte del `tool_call` de
`terminal`.

### Entorno PHP para pruebas

`php8.4-cli` más `bcmath soap gd zip mbstring xml curl sqlite3 intl`, Composer
desde `getcomposer.org`. Sin `.env` la suite falla entera con
`MissingAppKeyException`: copiar `.env.example`, `php artisan key:generate`,
y apuntar `DB_CONNECTION=sqlite` a `database/database.sqlite`.
