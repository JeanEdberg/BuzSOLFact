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
