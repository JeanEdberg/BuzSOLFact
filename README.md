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
GET {VITE_API_URL}/v1/invoices/{id}/download-xml
GET {VITE_API_URL}/v1/invoices/{id}/download-cdr
GET {VITE_API_URL}/v1/invoices/{id}/download-pdf
GET {VITE_API_URL}/v1/boletas/{id}/download-{xml|cdr|pdf}
```

Configura la URL del backend con la variable `VITE_API_URL` (por defecto `/api`).
La autenticación usa Laravel Sanctum (`POST /auth/login`).

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
    ple.js         generadores PLE 14.1 / 8.1
    sire.js        generadores SIRE RVIE / RCE
    *.test.js      pruebas de los generadores
    sampleData.js  datos de demostración
```
