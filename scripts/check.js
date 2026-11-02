#!/usr/bin/env node
/**
 * PamiGo — verificación previa al despliegue.
 * Sin dependencias externas. Se ejecuta localmente y en CI.
 *
 *   node scripts/check.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const passed = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function pass(message) {
  passed.push(message);
}

function warn(message) {
  warnings.push(message);
}

function abs(rel) {
  return path.join(ROOT, rel);
}

function exists(rel) {
  return fs.existsSync(abs(rel));
}

function read(rel) {
  return fs.readFileSync(abs(rel), 'utf8');
}

function readJSON(rel) {
  return JSON.parse(read(rel));
}

/* ------------------------------------------------------------------ */
/* 1. Archivos obligatorios                                            */
/* ------------------------------------------------------------------ */

const REQUIRED = [
  'index.html',
  '404.html',
  'pami.css',
  'pami.js',
  'router.js',
  'favicon.svg',
  'logo.svg',
  'bg-pattern.svg',
  'site.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'vercel.json',
  '_redirects',
  '.htaccess',
  'serve.js',
  'README.md',
  'package.json',
  'data/medicamentos.json',
  'data/farmacias.json',
  'data/prestadores.json'
];

const missing = REQUIRED.filter(function (file) {
  return !exists(file);
});

if (missing.length) {
  fail('Faltan archivos obligatorios: ' + missing.join(', '));
} else {
  pass('Archivos obligatorios presentes (' + REQUIRED.length + ')');
}

/* ------------------------------------------------------------------ */
/* 2. JSON válido                                                      */
/* ------------------------------------------------------------------ */

const JSON_FILES = [
  'package.json',
  'vercel.json',
  'site.webmanifest',
  'data/medicamentos.json',
  'data/farmacias.json',
  'data/prestadores.json'
];

JSON_FILES.forEach(function (file) {
  if (!exists(file)) return;
  try {
    readJSON(file);
  } catch (e) {
    fail('JSON inválido en ' + file + ': ' + e.message);
  }
});
if (!errors.some(function (e) { return e.startsWith('JSON inválido'); })) {
  pass('JSON válido en ' + JSON_FILES.length + ' archivos');
}

/* ------------------------------------------------------------------ */
/* 3. XML bien formado (sitemap)                                       */
/* ------------------------------------------------------------------ */

if (exists('sitemap.xml')) {
  const xml = read('sitemap.xml');
  if (!/<\?xml/.test(xml) || !/<\/urlset>\s*$/.test(xml.trim())) {
    fail('sitemap.xml no parece un XML completo');
  } else if (/TU-DOMINIO/.test(xml)) {
    pass('sitemap.xml válido (contiene el marcador TU-DOMINIO pendiente de reemplazo)');
  } else {
    pass('sitemap.xml válido');
  }
}

/* ------------------------------------------------------------------ */
/* 4. Conjuntos de datos                                               */
/* ------------------------------------------------------------------ */

const DATASETS = [
  {
    file: 'data/medicamentos.json',
    min: 1000,
    key: 'droga',
    fields: ['droga', 'marca', 'presentacion', 'laboratorio', 'cobertura', 'copago']
  },
  {
    file: 'data/farmacias.json',
    min: 1000,
    key: 'farmacia_desc',
    fields: ['provincia_id', 'farmacia_desc', 'farmacia_direcc', 'farmacia_localid']
  },
  {
    file: 'data/prestadores.json',
    min: 100,
    key: 'ugl_desc',
    fields: ['ugl_id', 'ugl_desc', 'modulo_pami_desc', 'q_prestadores']
  }
];

DATASETS.forEach(function (set) {
  if (!exists(set.file)) return;
  const rows = readJSON(set.file);

  if (!Array.isArray(rows)) {
    fail(set.file + ' no es un arreglo');
    return;
  }
  if (rows.length < set.min) {
    fail(set.file + ' tiene ' + rows.length + ' registros, se esperaban al menos ' + set.min);
    return;
  }

  const missingFields = set.fields.filter(function (field) {
    return !(field in rows[0]);
  });
  if (missingFields.length) {
    fail(set.file + ' no contiene los campos: ' + missingFields.join(', '));
    return;
  }

  const empty = rows.filter(function (row) {
    return row[set.key] === undefined || String(row[set.key]).trim() === '';
  });
  if (empty.length) {
    fail(set.file + ' tiene ' + empty.length + ' registros sin "' + set.key + '"');
    return;
  }

  pass(set.file + ': ' + rows.length.toLocaleString('es-AR') + ' registros con esquema correcto');
});

/* ------------------------------------------------------------------ */
/* 5. Referencias locales de index.html y 404.html                     */
/* ------------------------------------------------------------------ */

const PAGES = ['index.html', '404.html'];

PAGES.forEach(function (page) {
  if (!exists(page)) return;
  const html = read(page);
  const refs = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let match;

  while ((match = re.exec(html)) !== null) {
    refs.push(match[1]);
  }

  const local = refs.filter(function (ref) {
    return !/^(https?:)?\/\//.test(ref) && !/^(data:|mailto:|tel:|#)/.test(ref);
  });

  const broken = local.filter(function (ref) {
    const clean = ref.split('?')[0].split('#')[0];
    if (!clean || clean === '/') return !exists('index.html');
    const target = clean.replace(/^\//, '');
    return !(exists(target) || exists(target + '/index.html') || exists(path.join(target, 'index.html')));
  });

  if (broken.length) {
    fail(page + ' referencia archivos inexistentes: ' + broken.join(', '));
  } else {
    pass(page + ': ' + local.length + ' referencias locales verificadas');
  }

  if (/href="[^"]*\.html"/.test(html.replace(/href="[^"]*(404|index)\.html"/g, ''))) {
    fail(page + ' contiene enlaces internos con extensión .html');
  }
});

/* ------------------------------------------------------------------ */
/* 6. Metadatos y accesibilidad básica de la portada                   */
/* ------------------------------------------------------------------ */

if (exists('index.html')) {
  const html = read('index.html');
  const checks = [
    ['lang="es"', /<html[^>]+lang="es"/],
    ['meta viewport', /name="viewport"/],
    ['meta description', /name="description"/],
    ['canonical', /rel="canonical"/],
    ['favicon', /rel="icon"/],
    ['manifiesto', /rel="manifest"/]
  ];

  checks.forEach(function (item) {
    if (!item[1].test(html)) fail('index.html no incluye ' + item[0]);
  });

  const svgs = html.match(/<svg[^>]*>/g) || [];
  const badSvg = svgs.filter(function (tag) {
    return !/aria-label|aria-hidden|role="img"/.test(tag);
  });
  if (badSvg.length) {
    fail('index.html tiene ' + badSvg.length + ' SVG sin rol o etiqueta accesible');
  } else {
    pass('index.html: metadatos y ' + svgs.length + ' SVG etiquetados');
  }
}

/* ------------------------------------------------------------------ */
/* 7. Versión consistente entre package.json, HTML y assets            */
/* ------------------------------------------------------------------ */

if (exists('package.json') && exists('index.html')) {
  const version = readJSON('package.json').version;
  const html = read('index.html');
  const assetVersions = Array.from(html.matchAll(/\?v=([0-9]+\.[0-9]+\.[0-9]+)/g), function (m) {
    return m[1];
  });
  const footerVersion = html.match(/footer-version">v([0-9]+\.[0-9]+\.[0-9]+)/);

  const mismatched = assetVersions.filter(function (v) { return v !== version; });

  if (mismatched.length) {
    fail('index.html referencia assets con versión ' + mismatched.join(', ') +
      ' pero package.json declara ' + version);
  } else if (assetVersions.length === 0) {
    fail('index.html no versiona los assets con ?v= (riesgo de caché en producción)');
  } else {
    pass('Assets versionados en ' + version + ' (' + assetVersions.length + ' referencias)');
  }

  if (!footerVersion) {
    fail('El footer de index.html no muestra la versión');
  } else if (footerVersion[1] !== version) {
    fail('El footer muestra v' + footerVersion[1] + ' pero package.json declara ' + version);
  } else {
    pass('Versión del footer coincide con package.json (v' + version + ')');
  }

  if (exists('CHANGELOG.md')) {
    const changelog = read('CHANGELOG.md');
    if (!changelog.includes('## [' + version + ']')) {
      fail('CHANGELOG.md no tiene una entrada para la versión ' + version);
    } else {
      pass('CHANGELOG.md documenta la versión ' + version);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 8. Rutas amigables declaradas en todos los destinos                 */
/* ------------------------------------------------------------------ */

const ROUTES = ['medicamentos', 'farmacias', 'prestadores', 'cartilla'];
const CONFIGS = [
  ['vercel.json', function (body, route) { return body.includes('"/' + route + '"'); }],
  ['_redirects', function (body, route) { return body.includes('/' + route); }],
  ['.htaccess', function (body, route) { return new RegExp('\\b' + route + '\\b').test(body); }],
  ['serve.js', function (body, route) { return body.includes("'" + route + "'"); }],
  ['router.js', function (body, route) { return body.includes("'" + route + "'"); }]
];

CONFIGS.forEach(function (config) {
  const file = config[0];
  if (!exists(file)) return;
  const body = read(file);
  const missingRoutes = ROUTES.filter(function (route) {
    return !config[1](body, route);
  });

  if (missingRoutes.length) {
    fail(file + ' no declara las rutas: ' + missingRoutes.join(', '));
  } else {
    pass(file + ': ' + ROUTES.length + ' rutas amigables declaradas');
  }
});

/* ------------------------------------------------------------------ */
/* 9. Higiene del repositorio                                          */
/* ------------------------------------------------------------------ */

function gitTracked(dir) {
  try {
    const out = require('child_process')
      .execSync('git ls-files -- "' + dir + '"', { cwd: ROOT })
      .toString()
      .trim();
    return out ? out.split('\n') : [];
  } catch (e) {
    return null;
  }
}

const tracked = gitTracked('data');
if (tracked === null) {
  pass('data/: no se pudo consultar git, se omite la verificación de archivos rastreados');
} else {
  const forbidden = tracked.filter(function (file) {
    return /\.(xlsx|xls|csv)$/i.test(file) || /afiliados/i.test(file);
  });
  if (forbidden.length) {
    fail('data/ tiene archivos crudos o con datos personales versionados: ' + forbidden.join(', '));
  } else {
    pass('data/: ' + tracked.length + ' archivos versionados, ninguno crudo ni con datos personales');
  }
}

if (exists('.gitignore')) {
  const ignore = read('.gitignore');
  const patterns = ['node_modules/', 'data/*.xlsx', 'data/*.csv', 'data/afiliados'];
  const missingPatterns = patterns.filter(function (pattern) {
    return !ignore.includes(pattern);
  });
  if (missingPatterns.length) {
    fail('.gitignore no excluye: ' + missingPatterns.join(', '));
  } else {
    pass('.gitignore cubre dependencias, archivos crudos y datos personales');
  }
}

/* ------------------------------------------------------------------ */
/* 9b. Metadatos de actualización de los datos                         */
/* ------------------------------------------------------------------ */

if (exists('data/meta.json')) {
  let meta = null;
  try {
    meta = readJSON('data/meta.json');
  } catch (e) {
    fail('data/meta.json no es JSON válido: ' + e.message);
  }

  if (meta) {
    const problems = [];
    const STALE_DAYS = 90;
    const hoy = new Date();

    ['medicamentos', 'farmacias', 'prestadores'].forEach(function (dataset) {
      const entry = meta[dataset];
      if (!entry) {
        problems.push(dataset + ' sin entrada de metadatos');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.actualizado))) {
        problems.push(dataset + ' tiene una fecha inválida ("' + entry.actualizado + '")');
        return;
      }

      const rows = readJSON('data/' + dataset + '.json');
      if (entry.registros !== rows.length) {
        problems.push(dataset + ' declara ' + entry.registros + ' registros pero el JSON tiene ' + rows.length);
      }

      const dias = Math.floor((hoy - new Date(entry.actualizado + 'T00:00:00')) / 86400000);
      if (dias > STALE_DAYS) {
        warn(dataset + ': datos de hace ' + dias + ' días (actualizado ' + entry.actualizado +
          '). Conviene volver a correr scripts/fetch_data.py y scripts/build_data.py.');
      }
    });

    if (problems.length) {
      problems.forEach(fail);
    } else {
      pass('data/meta.json coherente con los tres conjuntos de datos');
    }
  }
}

/* ------------------------------------------------------------------ */
/* 10. Presupuesto de transferencia de datos                           */
/* ------------------------------------------------------------------ */

const zlib = require('zlib');
const BUDGET_GZIP = 800 * 1024;
let rawTotal = 0;
let gzipTotal = 0;

['data/medicamentos.json', 'data/farmacias.json', 'data/prestadores.json'].forEach(function (file) {
  if (!exists(file)) return;
  const buffer = fs.readFileSync(abs(file));
  rawTotal += buffer.length;
  gzipTotal += zlib.gzipSync(buffer, { level: 9 }).length;
});

if (rawTotal > 0) {
  const summary = (rawTotal / 1024 / 1024).toFixed(1) + ' MB sin comprimir, ' +
    Math.round(gzipTotal / 1024) + ' KB con gzip';
  if (gzipTotal > BUDGET_GZIP) {
    fail('Los datos superan el presupuesto de transferencia (' + summary +
      '; límite ' + Math.round(BUDGET_GZIP / 1024) + ' KB con gzip)');
  } else {
    pass('Presupuesto de datos: ' + summary);
  }
}

/* ------------------------------------------------------------------ */
/* Resultado                                                           */
/* ------------------------------------------------------------------ */

console.log('\nPamiGo — verificación previa al despliegue\n');

passed.forEach(function (line) {
  console.log('  OK    ' + line);
});

warnings.forEach(function (line) {
  console.log('  AVISO ' + line);
});

if (errors.length) {
  console.log('');
  errors.forEach(function (line) {
    console.log('  ERROR ' + line);
  });
  console.log('\n' + errors.length + ' problema(s). Paso abortado.\n');
  process.exit(1);
}

const resumen = passed.length + ' verificaciones superadas';
console.log('\n' + resumen + (warnings.length ? ' · ' + warnings.length + ' aviso(s)' : '') + '.\n');
