# PamiGo — Changelog

Todas las versiones notables de PamiGo se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [1.5.1] — 2026-11-02

### Cambiado
- Armonía cálida de superficies: encabezados de tabla, filas alternadas y pies pasan de gris frío a
  crema (`#EFE9DC`, `#FBF7EE`, `#FCF9F2`); sombras y placeholders en tonos topo.

## [1.5.0] — 2026-11-02

### Cambiado
- Fondo cálido de la aplicación: base café suave (`#F6F0E5`) con patrón repetible de píldoras,
  frascos, cruces y pulsos en tonos crema y naranja (`bg-pattern.svg`).

## [1.4.0] — 2026-11-02

### Añadido
- La barra de resultados de cada vista indica la fecha oficial del conjunto que está mostrando, además del
  resumen por conjunto que ya figuraba en el pie.

## [1.3.0] — 2026-11-02

### Añadido
- Farmacias y prestadores actualizados a los archivos del 06/08/2026: 15.241 farmacias (antes 13.689) y
  4.388 combinaciones de UGL y especialidad (antes 2.520 filas).
- Constructor para el padrón de farmacias vigente, con remapeo de columnas y nueva columna Departamento.
- Constructor para el archivo de prestadores, que interpreta los bloques de UGL con especialidades y
  valida que la suma por UGL coincida con el total informado y con el total general (42.675).
- UGL derivada por provincia desde el catálogo de agencias de PAMI, con aviso en la interfaz.
- Reparación genérica de texto UTF-8 leído como latin-1/cp1252 en los archivos de origen
  ("AGÃœERO" → "AGÜERO", "1Â° DE MAYO" → "1° DE MAYO").

### Cambiado
- La tabla de farmacias reemplaza la columna Código Postal por Departamento.
- La tabla de prestadores reemplaza "Módulo" por "Especialidad", acorde al archivo vigente.
- El catálogo de UGL y agencias se descarga como insumo del ETL y no se publica.

### Corregido
- El selector de registros por página no volvía a paginar la tabla: cambiar de 20 a 100 no alteraba las
  filas visibles hasta forzar otro filtro.

## [1.2.0] — 2026-11-02

### Añadido
- `scripts/fetch_data.py` y `scripts/build_data.py`: canalización de datos reproducible que resuelve
  las URLs vigentes en la API de datos.gob.ar, descarga los archivos crudos, los normaliza en una base
  SQLite de trabajo y exporta los JSON que consume la aplicación.
- `data/meta.json` con la fecha de actualización, el origen y la cantidad de registros de cada conjunto.
- El pie muestra la última actualización de los conjuntos oficiales.
- La verificación de CI valida la coherencia de `data/meta.json` y advierte cuando un conjunto supera
  los 90 días de antigüedad.

### Cambiado
- Medicamentos actualizado a la publicación del 02/10/2026 (vigencia 01/10/2026): 574 presentaciones
  modificadas y 6.586 copagos actualizados respecto de la versión anterior.
- Se corrigieron los nombres de laboratorio con codificación dañada que eran inequívocos
  (`Bag¿` → Bagó, `Dom¿nguez` → Domínguez, `Andr¿maco` → AndrÓmaco, `Qu¿mica Luar` → Química Luar,
  `Cassarß` → Cassará, `Nutricia-Bag¿`, `Bag¿-Arcor`, `KINDERVAL MAX EMULSI¿N`, `LEVECOM SOLUCI¿N`).
- Los JSON se exportan sin espacios de formato (medicamentos pasa de 1,4 MB a 1,29 MB).

### Pendiente
- Farmacias: el estándar vigente (agosto 2026) tiene otro esquema y no incluye UGL ni código postal.
- Prestadores: la versión vigente cambia la estructura a especialidades por UGL y requiere rehacer la vista.

## [1.1.0] — 2025-11-01

### Añadido
- Filtro por laboratorio en el buscador de medicamentos. El selector muestra el conteo de productos por
  laboratorio y sus opciones se recalculan según el principio activo y la marca ingresados; si el
  laboratorio elegido queda sin coincidencias se conserva marcado con `(0)` para explicar el resultado vacío.
- Selector de cobertura con los cinco valores del conjunto de datos (40 %, 50 %, 60 %, 80 %, 100 %) y la
  cantidad de registros de cada uno, en reemplazo del campo de texto libre.
- Los cuatro filtros de medicamentos quedan en una única línea en pantallas de escritorio.

### Corregido
- Búsqueda insensible a mayúsculas y tildes en los tres buscadores: "losartan" ahora encuentra
  "losartán" y "acido acetilsalicilico" coincide con los registros que contienen la cadena equivalente.
  Los índices de búsqueda se normalizan una sola vez al cargar los datos.

### Cambiado
- La acción "Limpiar" se traslada a la barra de resultados, junto al selector de registros por página, en
  las tres vistas, para liberar espacio en la fila de filtros.

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
