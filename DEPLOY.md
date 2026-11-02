# PamiGo v1.0.0 — despliegue

Sitio 100 % estático (HTML + CSS + JS + JSON). No requiere backend, PHP ni base de datos.

## Estructura

```
index.html            portada (raíz del sitio)
404.html              página de error con la identidad de la app
pami.css              estilos (?v=1.0.0)
pami.js               lógica Alpine (búsquedas, filtros, paginación)
router.js             URLs amigables por tab
favicon.svg           monograma "P" para pestaña del navegador
logo.svg              marca cápsula (hero, footer, maskable)
site.webmanifest      metadatos de instalación
robots.txt            indexación
sitemap.xml           mapa del sitio (reemplazar TU-DOMINIO)
data/*.json           medicamentos, farmacias y prestadores
.htaccess             Apache / cPanel
_redirects            Netlify / Cloudflare Pages
vercel.json           Vercel
serve.js              servidor local con URLs amigables
```

## URLs públicas

| Ruta | Contenido |
|---|---|
| `/` | Medicamentos (portada) |
| `/medicamentos` | Medicamentos |
| `/farmacias` | Farmacias por provincia y localidad |
| `/prestadores` | Resumen de prestadores por UGL y módulo |
| `/cartilla` | Acceso a la cartilla oficial de PAMI |

`/pami.html` (URL vieja) redirige 301 a `/`.
Cualquier `.html` existente se sirve sin extensión y redirige 301 desde la versión con `.html`.

## 1. Probar en local

```bash
node serve.js            # http://127.0.0.1:5176
PORT=8080 node serve.js  # otro puerto
```

`serve.js` imita la reescritura de `.htaccess`: rutas amigables, 301 de `.html`, 404 propio.
Con `python3 -m http.server` **no** funcionan las rutas amigables (solo `/`).

## 2. Publicar

### Apache / cPanel / hosting compartido
1. Subir **todo** el contenido de la carpeta a `public_html` (incluido `.htaccess`, que es oculto).
2. Verificar que `mod_rewrite` esté activo (en cPanel: *Módulos de Apache* o pedirlo al soporte).
3. Si el sitio **no** lleva SSL, comentar el bloque "Forzar HTTPS" de `.htaccess` (líneas 13-16).

### Netlify / Cloudflare Pages
Arrastrar la carpeta o conectar el repo. `_redirects` ya define las rutas y el 404.

### Vercel
`vercel.json` ya activa `cleanUrls` y las rewrites. No requiere build command; output directory = raíz.

### GitHub Pages
No soporta reescrituras: usar `index.html` y aceptar `/#farmacias` (el router lee el hash como fallback).

## 3. Checklist antes de publicar

- [ ] Reemplazar `TU-DOMINIO` en `sitemap.xml`.
- [ ] Actualizar el dominio en `<link rel="canonical">` de `index.html`.
- [ ] Subir `?v=` de `pami.css`, `pami.js` y `router.js` al publicar cambios (evita caché vieja).
- [ ] Confirmar que `/medicamentos`, `/farmacias`, `/prestadores` y `/cartilla` responden 200 al recargar.
- [ ] Probar `/no-existe` → debe mostrar la 404 propia.
- [ ] Verificar HTTPS y que `data/*.json` se sirva con `application/json`.

## 4. Versionado

Se usa SemVer (`MAJOR.MINOR.PATCH`) y la versión visible está en el footer.
Documentar cada release en `CHANGELOG.md` y actualizar el `?v=` de los assets.
