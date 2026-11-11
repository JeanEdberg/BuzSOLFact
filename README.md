# BuzSOLFact — INMOA ERP & Facturación PWA

ERP contable para Perú con **buzón electrónico SUNAT / SUNAFIL**, descarga de
comprobantes (**XML / PDF / CDR**) y generación de **Libros Electrónicos**
(Registro de Ventas 14.1 y Registro de Compras 8.1).

## Requisitos

- Node.js 18+ (probado con 24) y npm.

## Puesta en marcha

```bash
npm install
npm run dev      # http://localhost:12000
npm run build    # bundle de producción en dist/
npm test         # pruebas de los generadores PLE
```

## Funcionalidades

| Módulo | Descripción |
|---|---|
| Buzón SUNAT / SUNAFIL | Notificaciones electrónicas unificadas. |
| Registro de Compras | Comprobantes recibidos con descarga XML/PDF/CDR. |
| Facturación & Boletas | Comprobantes emitidos con descarga XML/PDF/CDR. |
| Guías de Remisión | Consulta y búsqueda de comprobantes. |
| Libros Electrónicos | Genera y descarga los TXT del PLE 14.1 y 8.1. |

## Descarga de comprobantes

Los botones XML / PDF / CDR llaman a la API de facturación electrónica
(Laravel + Greenter):

```
POST {VITE_API_URL}/auth/login              -> { access_token, user }
GET  {VITE_API_URL}/v1/invoices             -> paginador
GET  {VITE_API_URL}/v1/boletas              -> array
GET  {VITE_API_URL}/v1/invoices/{id}/download-xml|cdr|pdf
GET  {VITE_API_URL}/v1/boletas/{id}/download-xml|cdr|pdf
```

Configura la URL del backend con la variable `VITE_API_URL` (por defecto `/api`).
La autenticación usa Laravel Sanctum.

### Conectar la API

La pestaña **Conexión API** permite iniciar sesión con las credenciales del
backend. Al conectar, los comprobantes emitidos se cargan desde la API y se
mapean (`src/lib/mapper.js`) a las filas que consumen los generadores de libros.
El botón **Restaurar datos demo** vuelve a la fuente local.

Notas del contrato real de la API:

- El login devuelve `access_token` (no `token`).
- `GET /v1/invoices` devuelve un **paginador** (`data.data[]`); `GET /v1/boletas`
  devuelve un **array plano** (`data[]`). El cliente normaliza ambos.
- **La API no persiste el tipo de cambio** (solo existe dentro del JSON del
  detalle al emitir). La PWA lo resuelve por fecha al generar el libro (ver
  abajo).
- La API solo emite comprobantes propios: no expone comprobantes recibidos, así
  que el Registro de Compras se alimenta de la fuente local hasta que exista un
  módulo de compras.

## Tipo de cambio (proxy requerido en el backend)

La API no guarda el tipo de cambio, así que se resuelve por fecha al generar el
libro. SUNAT publica la tasa del día en un archivo de texto:

```
https://www.sunat.gob.pe/a/txt/tipoCambio.txt   ->  10/11/2026|3.409|3.418|
```

Ese archivo **no se puede leer desde el navegador**: responde
`Access-Control-Allow-Origin: https://ww3.sunat.gob.pe`, así que CORS lo bloquea.
Además solo trae la tasa del día, sin histórico. Por eso el backend debe exponer
un proxy con caché por fecha:

```
GET {VITE_API_URL}/v1/tipo-cambio?fecha=2026-11-10
  -> { "success": true, "message": "...",
       "data": { "fecha": "2026-11-10", "compra": 3.409, "venta": 3.418 } }
```

El cliente acepta JSON (y desenvuelve `data`) o el TXT crudo de SUNAT. Se usa la
**tasa de venta** para convertir la operación a soles. `src/lib/tipoCambio.js`
cachea por fecha (una sola consulta aunque haya muchos comprobantes del mismo
día) y deduplica las peticiones simultáneas.

**Backend (Laravel):** el proxy está implementado en el PR
[`bvislao/Api-de-facturacion-electronica-sunat-Peru#1`](https://github.com/bvislao/Api-de-facturacion-electronica-sunat-Peru/pull/1)
(endpoint `GET /api/v1/tipo-cambio`, tabla `tipo_cambios` y comando diario
`sunat:sync-tipo-cambio`). Como SUNAT solo publica la tasa del día, el backend la
persiste a diario para ir acumulando el histórico.

## Libros Electrónicos (PLE y SIRE)

`src/lib/ple.js` genera los archivos planos del **PLE** según el Anexo N.º 2 de la
RS 112-2021/SUNAT:

- **Registro de Ventas e Ingresos 14.1** (`140100`) — 34 campos.
- **Registro de Compras 8.1** (`080100`) — 41 campos.

`src/lib/sire.js` genera los archivos del **SIRE**, el entregable vigente que
reemplazó al PLE para ventas y compras:

- **RVIE — ventas** (`140400`, Anexo N.º 3 de la RS 112-2021) — 33 campos informados.
- **RCE — compras** (`080400`, Anexo N.º 11 de la RS 040-2022) — 41 campos.

Reglas aplicadas en ambos: campos separados por `|`, línea terminada en `|`,
fechas `DD/MM/AAAA`, montos con 2 decimales, fin de línea CRLF y notas de
crédito/débito con signo negativo. El nombre del archivo sigue el patrón oficial:

```
PLE:  LE + RUC(11) + AAAAMM + 00 + libro(6) + 001111 + .TXT
SIRE: LE + RUC(11) + AAAAMM + 00 + libro(6) + 021112 + .TXT   (02 = reemplaza la propuesta)
```

## Estructura

```
index.html
public/            manifest.json, sw.js
src/
  App.jsx          interfaz (pestañas, descargas, panel de libros)
  main.jsx         punto de entrada + registro del service worker
  index.css        Tailwind
  lib/
    api.js         cliente de la API de facturación
    mapper.js      comprobante de la API -> fila de libro
    tipoCambio.js  tipo de cambio SUNAT por fecha (proxy del backend)
    ple.js         generadores PLE 14.1 / 8.1
    sire.js        generadores SIRE RVIE / RCE
    *.test.js      pruebas de los generadores y del mapeador
    sampleData.js  datos de demostración
```
