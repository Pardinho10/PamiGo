/** Normaliza texto para búsquedas: sin tildes, minúsculas y sin espacios extremos. */
function norm(value) {
  return (value || '').toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pamiApp() {
  return {
    meds: [],
    medFiltered: [],
    medPaged: [],
    medQueryDroga: '',
    medQueryMarca: '',
    medLab: '',
    medCob: '',
    medLaboratorios: [],
    medCoberturas: [],
    medCount: 0,
    dataUpdated: '',
    medPage: 1,
    medPageSize: 20,
    medTotalPages: 1,
    _ciudadesPorProv: {},

    prests: [],
    prestFiltered: [],
    prestPaged: [],
    prestQuery: '',
    prestModulo: '',
    prestCount: 0,
    prestPage: 1,
    prestPageSize: 20,
    prestTotalPages: 1,

    farms: [],
    farmFiltered: [],
    farmPaged: [],
    farmQuery: '',
    farmProvincia: '',
    farmCiudad: '',
    farmProvincias: [],
    farmCiudades: [],
    farmCount: 0,
    farmPage: 1,
    farmPageSize: 20,
    farmTotalPages: 1,

    init() {
      this.loadData();
      this.loadMeta();
    },

    /** Fecha de actualización de cada conjunto, para mostrarla en el pie. */
    async loadMeta() {
      try {
        const res = await fetch('./data/meta.json', { cache: 'no-store' });
        if (!res.ok) return;
        const meta = await res.json();
        const etiquetas = { medicamentos: 'medicamentos', farmacias: 'farmacias', prestadores: 'prestadores' };
        const partes = [];
        for (const clave of Object.keys(etiquetas)) {
          const fecha = meta[clave] && meta[clave].actualizado;
          if (!fecha) continue;
          const [anio, mes, dia] = String(fecha).split('-');
          if (!anio || !mes || !dia) continue;
          partes.push(`${etiquetas[clave]} al ${dia}/${mes}/${anio}`);
        }
        this.dataUpdated = partes.join(' · ');
      } catch (e) {
        console.warn('No se pudieron leer los metadatos de datos', e);
      }
    },

    async loadData() {
      try {
        const [mRes, pRes, fRes] = await Promise.all([
          fetch('./data/medicamentos.json', { cache: 'no-store' }),
          fetch('./data/prestadores.json', { cache: 'no-store' }),
          fetch('./data/farmacias.json', { cache: 'no-store' })
        ]);
        const medicamentos = await mRes.json();
        const prestadores = await pRes.json();
        const farmacias = await fRes.json();

        // Índices de búsqueda normalizados (se calculan una sola vez)
        this.meds = medicamentos.map(m => Object.assign(m, {
          _droga: norm(m.droga),
          _marca: norm(m.marca)
        }));
        this.prests = prestadores.map(p => Object.assign(p, {
          _busqueda: norm([p.ugl_desc, p.ugl_id, p.modulo_pami_desc].join(' '))
        }));
        this.farms = farmacias.map(f => Object.assign(f, {
          _busqueda: norm([f.farmacia_desc, f.farmacia_direcc, f.farmacia_localid].join(' '))
        }));
        this.medCount = this.meds.length;
        this.prestCount = this.prests.length;
        this.farmCount = this.farms.length;
        this.buildFarmFilters();
        this.buildMedFilters();
        this.filterMeds();
        this.filterPrest();
        this.filterFarm();
      } catch (e) {
        console.error('Error cargando datos', e);
      }
    },

    buildFarmFilters() {
      const provincias = new Set();
      const ciudadesPorProv = {};
      for (const f of this.farms) {
        const prov = (f.provincia_id || '').toString().trim();
        const city = (f.farmacia_localid || '').toString().trim();
        if (prov) {
          provincias.add(prov);
          if (!ciudadesPorProv[prov]) ciudadesPorProv[prov] = new Set();
          if (city) ciudadesPorProv[prov].add(city);
        }
      }
      this._ciudadesPorProv = ciudadesPorProv;
      this.farmProvincias = Array.from(provincias).sort((a, b) => a.localeCompare(b, 'es'));
      this.updateFarmCiudades();
    },

    updateFarmCiudades() {
      if (!this.farmProvincia) {
        const all = new Set();
        if (this._ciudadesPorProv) {
          for (const s of Object.values(this._ciudadesPorProv)) {
            for (const c of s) all.add(c);
          }
        }
        this.farmCiudades = Array.from(all).sort((a, b) => a.localeCompare(b, 'es'));
      } else if (this._ciudadesPorProv && this._ciudadesPorProv[this.farmProvincia]) {
        this.farmCiudades = Array.from(this._ciudadesPorProv[this.farmProvincia]).sort((a, b) => a.localeCompare(b, 'es'));
      } else {
        this.farmCiudades = [];
      }
    },

    onFarmProvinciaChange() {
      this.farmCiudad = '';
      this.updateFarmCiudades();
      this.farmPage = 1;
      this.filterFarm();
    },

    buildMedFilters() {
      const coberturas = new Map();
      for (const m of this.meds) {
        const cob = (m.cobertura || '').toString().trim();
        if (cob) coberturas.set(cob, (coberturas.get(cob) || 0) + 1);
      }
      this.medCoberturas = Array.from(coberturas, ([valor, cantidad]) => ({ valor, cantidad }))
        .sort((a, b) => parseFloat(a.valor) - parseFloat(b.valor));
      this.updateMedLaboratorios(this.meds);
    },

    /** Recalcula los laboratorios disponibles según los filtros de droga y marca. */
    updateMedLaboratorios(rows) {
      const conteo = new Map();
      for (const m of (rows || this.meds)) {
        const lab = (m.laboratorio || '').toString().trim();
        if (!lab) continue;
        conteo.set(lab, (conteo.get(lab) || 0) + 1);
      }

      const lista = Array.from(conteo, ([nombre, cantidad]) => ({ nombre, cantidad }));

      // Si el laboratorio elegido no aparece en el resultado, se conserva con 0
      // para que el usuario entienda por qué no hay coincidencias.
      if (this.medLab && !conteo.has(this.medLab)) {
        lista.push({ nombre: this.medLab, cantidad: 0 });
      }

      lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      this.medLaboratorios = lista;
    },

    filterMeds() {
      const qd = norm(this.medQueryDroga);
      const qm = norm(this.medQueryMarca);
      let res = this.meds;
      if (qd) {
        res = res.filter(m => m._droga.includes(qd));
      }
      if (qm) {
        res = res.filter(m => m._marca.includes(qm));
      }

      this.updateMedLaboratorios(res);

      if (this.medLab) {
        res = res.filter(m => (m.laboratorio || '').toString().trim() === this.medLab);
      }
      if (this.medCob) {
        res = res.filter(m => (m.cobertura || '').toString().trim() === this.medCob);
      }

      this.medFiltered = res;
      this.medPage = 1;
      this.paginateMeds();
    },

    clearMeds() {
      this.medQueryDroga = '';
      this.medQueryMarca = '';
      this.medLab = '';
      this.medCob = '';
      this.filterMeds();
    },

    paginateMeds() {
      const size = Number(this.medPageSize) || 20;
      this.medTotalPages = Math.max(1, Math.ceil(this.medFiltered.length / size));
      if (this.medPage > this.medTotalPages) this.medPage = this.medTotalPages;
      const start = (this.medPage - 1) * size;
      this.medPaged = this.medFiltered.slice(start, start + size);
    },

    filterPrest() {
      const q = norm(this.prestQuery);
      const qm = norm(this.prestModulo);
      let res = this.prests;
      if (q) {
        res = res.filter(p => p._busqueda.includes(q));
      }
      if (qm) {
        res = res.filter(p => (p.modulo_pami_desc || '').toString().toLowerCase().includes(qm));
      }
      this.prestFiltered = res;
      this.prestPage = 1;
      this.paginatePrest();
    },

    clearPrest() {
      this.prestQuery = '';
      this.prestModulo = '';
      this.filterPrest();
    },

    paginatePrest() {
      const size = Number(this.prestPageSize) || 20;
      this.prestTotalPages = Math.max(1, Math.ceil(this.prestFiltered.length / size));
      if (this.prestPage > this.prestTotalPages) this.prestPage = this.prestTotalPages;
      const start = (this.prestPage - 1) * size;
      this.prestPaged = this.prestFiltered.slice(start, start + size);
    },

    filterFarm() {
      const q = norm(this.farmQuery);
      const prov = (this.farmProvincia || '').toString().trim().toLowerCase();
      const city = (this.farmCiudad || '').toString().trim().toLowerCase();
      let res = this.farms;
      if (prov) {
        res = res.filter(f => (f.provincia_id || '').toString().toLowerCase() === prov);
      }
      if (city) {
        res = res.filter(f => (f.farmacia_localid || '').toString().toLowerCase() === city);
      }
      if (q) {
        res = res.filter(f => f._busqueda.includes(q));
      }
      this.farmFiltered = res;
      this.farmPage = 1;
      this.paginateFarm();
    },

    clearFarm() {
      this.farmQuery = '';
      this.farmProvincia = '';
      this.farmCiudad = '';
      this.updateFarmCiudades();
      this.filterFarm();
    },

    paginateFarm() {
      const size = Number(this.farmPageSize) || 20;
      this.farmTotalPages = Math.max(1, Math.ceil(this.farmFiltered.length / size));
      if (this.farmPage > this.farmTotalPages) this.farmPage = this.farmTotalPages;
      const start = (this.farmPage - 1) * size;
      this.farmPaged = this.farmFiltered.slice(start, start + size);
    }
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('pamiApp', pamiApp);
});

if (window.Alpine && typeof Alpine.data === 'function') {
  Alpine.data('pamiApp', pamiApp);
}
