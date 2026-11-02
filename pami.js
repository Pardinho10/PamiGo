function pamiApp() {
  return {
    meds: [],
    medFiltered: [],
    medPaged: [],
    medQueryDroga: '',
    medQueryMarca: '',
    medQueryTipo: '',
    medCount: 0,
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
    },

    async loadData() {
      try {
        const [mRes, pRes, fRes] = await Promise.all([
          fetch('./data/medicamentos.json', { cache: 'no-store' }),
          fetch('./data/prestadores.json', { cache: 'no-store' }),
          fetch('./data/farmacias.json', { cache: 'no-store' })
        ]);
        this.meds = await mRes.json();
        this.prests = await pRes.json();
        this.farms = await fRes.json();
        this.medCount = this.meds.length;
        this.prestCount = this.prests.length;
        this.farmCount = this.farms.length;
        this.buildFarmFilters();
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

    filterMeds() {
      const qd = (this.medQueryDroga || '').toString().trim().toLowerCase();
      const qm = (this.medQueryMarca || '').toString().trim().toLowerCase();
      const qt = (this.medQueryTipo || '').toString().trim().toLowerCase();
      let res = this.meds;
      if (qd) {
        res = res.filter(m => (m.droga || '').toString().toLowerCase().includes(qd));
      }
      if (qm) {
        res = res.filter(m => (m.marca || '').toString().toLowerCase().includes(qm));
      }
      if (qt) {
        res = res.filter(m => ((m.cobertura || '') + ' ' + (m.presentacion || '')).toString().toLowerCase().includes(qt));
      }
      this.medFiltered = res;
      this.medPage = 1;
      this.paginateMeds();
    },

    clearMeds() {
      this.medQueryDroga = '';
      this.medQueryMarca = '';
      this.medQueryTipo = '';
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
      const q = (this.prestQuery || '').toString().trim().toLowerCase();
      const qm = (this.prestModulo || '').toString().trim().toLowerCase();
      let res = this.prests;
      if (q) {
        res = res.filter(p => ((p.ugl_desc || '') + ' ' + (p.ugl_id || '')).toString().toLowerCase().includes(q));
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
      const q = (this.farmQuery || '').toString().trim().toLowerCase();
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
        res = res.filter(f => ((f.farmacia_desc || '') + ' ' + (f.farmacia_direcc || '') + ' ' + (f.farmacia_localid || '')).toString().toLowerCase().includes(q));
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
