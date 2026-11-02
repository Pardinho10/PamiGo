/* ==========================================================================
   PamiGo — router de URLs amigables
   /            → Medicamentos
   /medicamentos
   /farmacias
   /prestadores
   /cartilla
   Funciona con la reescritura del servidor (.htaccess / _redirects / serve.js)
   ========================================================================== */

(function () {
  'use strict';

  var TABS = {
    '': 'medicamentos',
    'medicamentos': 'medicamentos',
    'farmacias': 'farmacias',
    'prestadores': 'prestadores',
    'cartilla': 'cartilla'
  };

  var TARGETS = {
    'medicamentos': '#medicamentos',
    'farmacias': '#farmacias',
    'prestadores': '#prestadores',
    'cartilla': '#cartilla'
  };

  function basePath() {
    // Admite despliegue en subdirectorio (ej.: /pamigo/) manteniendo la base del <html>.
    var path = window.location.pathname.replace(/\/index\.html$/, '/');
    var segments = path.split('/').filter(Boolean);
    var last = segments.length ? segments[segments.length - 1] : '';

    if (TABS[last.toLowerCase()] !== undefined && last !== '') {
      segments.pop();
    }

    return '/' + (segments.length ? segments.join('/') + '/' : '');
  }

  function currentRoute() {
    var last = window.location.pathname.replace(/\/index\.html$/, '/').split('/').filter(Boolean).pop() || '';
    var route = TABS[last.toLowerCase()];
    // Soporte de retrocompatibilidad con #hash
    if (!route && window.location.hash) {
      route = TABS[window.location.hash.replace('#', '').toLowerCase()];
    }
    return route || 'medicamentos';
  }

  function tabButton(route) {
    return document.querySelector('[data-bs-target="' + TARGETS[route] + '"]');
  }

  function showTab(route, push) {
    var btn = tabButton(route);
    if (!btn) return;

    if (window.bootstrap && window.bootstrap.Tab) {
      window.bootstrap.Tab.getOrCreateInstance(btn).show();
    } else {
      btn.click();
    }

    document.title = documentTitleFor(route);

    if (push) {
      var url = basePath() + (route === 'medicamentos' ? '' : route);
      if (url !== window.location.pathname) {
        window.history.pushState({ route: route }, '', url);
      }
    }
  }

  function documentTitleFor(route) {
    var base = 'PamiGo — Medicamentos, prestadores y farmacias';
    var titles = {
      'medicamentos': base,
      'farmacias': 'Farmacias habilitadas — PamiGo',
      'prestadores': 'Prestadores y UGL — PamiGo',
      'cartilla': 'Cartilla oficial de prestadores — PamiGo'
    };
    return titles[route] || base;
  }

  function onTabShown(event) {
    var target = event.target.getAttribute('data-bs-target');
    var route = Object.keys(TARGETS).filter(function (key) {
      return TARGETS[key] === target;
    })[0];
    if (!route) return;

    var url = basePath() + (route === 'medicamentos' ? '' : route);
    document.title = documentTitleFor(route);
    if (url !== window.location.pathname) {
      window.history.pushState({ route: route }, '', url);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Normaliza /index.html → /
    if (/\/index\.html$/.test(window.location.pathname)) {
      window.history.replaceState({}, '', window.location.pathname.replace(/index\.html$/, ''));
    }

    showTab(currentRoute(), false);
    document.addEventListener('shown.bs.tab', onTabShown);

    window.addEventListener('popstate', function () {
      showTab(currentRoute(), false);
    });
  });
})();
