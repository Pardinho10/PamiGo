#!/usr/bin/env node
/**
 * PamiGo — servidor de desarrollo con URLs amigables
 * Emula el comportamiento de .htaccess en local.
 *
 *   node serve.js            → http://127.0.0.1:5176
 *   PORT=8080 node serve.js
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5176);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const ROUTES = new Set(['medicamentos', 'farmacias', 'prestadores', 'agencias', 'cartilla']);

function safeJoin(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.normalize(path.join(ROOT, clean));
  return resolved.startsWith(ROOT) ? resolved : null;
}

function send(res, status, filePath, extraHeaders) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('500 Internal Server Error');
    }
    res.writeHead(status, Object.assign({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }, extraHeaders || {}));
    res.end(data);
  });
}

function exists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch (e) {
    return false;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || HOST));
  const pathname = url.pathname;
  const log = (status) => console.log(`${status}  ${req.method} ${pathname}`);

  // 1) Compatibilidad: la antigua portada pami.html ahora es /
  if (pathname === '/pami.html') {
    res.writeHead(301, { Location: '/' });
    log(301);
    return res.end();
  }

  // 2) /pagina.html -> /pagina (301), solo si el archivo existe
  const isInternalHtml = pathname === '/index.html' || pathname === '/404.html';
  if (!isInternalHtml && /^\/[^/]+\.html$/.test(pathname) && exists(safeJoin(pathname))) {
    res.writeHead(301, { Location: pathname.replace(/\.html$/, '') });
    log(301);
    return res.end();
  }

  // 3) Archivos estáticos reales
  let file = safeJoin(pathname);
  if (!file) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    log(403);
    return res.end('403 Forbidden');
  }

  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (exists(file)) return send(res, 200, file), log(200);

  // 4) /nombre -> nombre.html
  if (!path.extname(pathname) && exists(file + '.html')) {
    return send(res, 200, file + '.html'), log(200);
  }

  // 5) Rutas de la SPA -> index.html
  const segment = pathname.split('/').filter(Boolean).pop();
  if (ROUTES.has((segment || '').toLowerCase())) {
    return send(res, 200, path.join(ROOT, 'index.html')), log(200);
  }

  // 6) 404
  send(res, 404, path.join(ROOT, '404.html'));
  log(404);
});

server.listen(PORT, HOST, () => {
  console.log(`PamiGo dev server → http://${HOST}:${PORT}`);
  console.log('Rutas: / · /medicamentos · /farmacias · /prestadores · /agencias · /cartilla');
});
