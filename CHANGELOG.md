# PamiGo — Changelog

Todas las versiones notables de PamiGo se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [1.0.0] — 2025-11-01

Primera versión lista para producción.

### Añadido
- Rediseño visual completo con paleta PamiGo: `#0B2344`, `#45658D`, `#916EAF`, `#F8951D`.
- Tipografía Lato (400/700/900) y sistema de radios unificado en `0.5rem`.
- Identidad de marca: hero con wordmark `PamiGo.` + logo cápsula (`logo.svg`).
- Favicon con monograma "P" (`favicon.svg`), legible a 16 px.
- URLs amigables sin `.html`: `/`, `/medicamentos`, `/farmacias`, `/prestadores`, `/cartilla`.
- Router cliente por tab: deep links, botón atrás/adelante y títulos de página por sección.
- Página `404.html` con la identidad de la app.
- `site.webmanifest` (instalable / PWA básica), `robots.txt` y `sitemap.xml`.
- Configuración de despliegue: `.htaccess` (Apache/cPanel), `_redirects` (Netlify/Cloudflare) y `vercel.json`.
- Servidor de desarrollo `serve.js` con el mismo comportamiento de reescritura que producción.
- Cabeceras de seguridad, compresión y caché con cache-busting (`?v=1.0.0`).
- Integración continua con GitHub Actions: verificación de estructura, datos, versión y
  configuración, más prueba de humo de rutas amigables y 404 (`node scripts/check.js`).

### Cambiado
- Tablas responsive: en pantallas menores a 576 px pasan a formato tarjeta con etiquetas, sin scroll horizontal.
- Tabs en grilla 2×2 en mobile.
- Métricas del hero (medicamentos, farmacias, prestadores) en tarjetas translúcidas.
- Aviso de cartilla movido dentro del panel de prestadores (antes flotaba fuera de contexto).
- Footer reorganizado: autoría, colaboración y versión.

### Corregido
- Textos desalineados y contenedores con radios inconsistentes (999 px / 1 rem).
- Desborde horizontal en 320 px y cortes de columna en tablet (768 px).
- Encabezado de tabla visible cuando la búsqueda no arroja resultados.
