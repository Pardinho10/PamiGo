#!/usr/bin/env python3
"""
PamiGo — descarga de conjuntos de datos oficiales.

Resuelve las URLs vigentes contra la API de datos.gob.ar (CKAN/Andino) y guarda
los archivos crudos en data/raw/ junto con un manifiesto de procedencia.

    python3 scripts/fetch_data.py                # todos los conjuntos
    python3 scripts/fetch_data.py medicamentos   # solo uno
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

API = 'https://datos.gob.ar/api/3/action/package_show?id='
UA = 'PamiGo-ETL/1.0 (+https://github.com/Pardinho10/PamiGo)'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')

DATASETS = {
    'medicamentos': 'medicamentos-para-afiliados',
    'farmacias': 'farmacias',
    'prestadores': 'listado-de-prestadores',
    # Catálogo auxiliar: no se publica, se usa para derivar la UGL de cada farmacia
    'ugls': 'agencias-ugls',
    # El conjunto contiene dos listados: el de UGLs (con CAPs, agencias y bocas) y
    # el de agencias locales. El de agencias se descarga por URL exacta.
    'agencias': 'agencias-ugls',
}


def get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode('utf-8'))


def download(url, destination):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=180) as response:
        data = response.read()
    with open(destination, 'wb') as handle:
        handle.write(data)
    return len(data)


# URL exacta del recurso en uso para el conjunto de agencias (no es el más reciente).
FORCED_URLS = {
    'agencias': 'http://datos.pami.org.ar/dataset/6fda9ef9-7dab-4a1a-879d-a963f05c7fde/resource/f6e33659-84c9-4e97-a271-f9023c8c891c/download/listado-de-agencias-.xlsx',
}


def newest_resource(resources):
    """Elige el recurso más reciente en un formato tabular."""
    usable = [
        resource for resource in resources
        if (resource.get('format') or '').upper() in ('XLSX', 'CSV')
    ]
    if not usable:
        raise SystemExit('El conjunto no tiene recursos XLSX ni CSV')
    return max(usable, key=lambda r: str(r.get('last_modified') or r.get('modified') or ''))


def main():
    targets = sys.argv[1:] or list(DATASETS)
    unknown = [t for t in targets if t not in DATASETS]
    if unknown:
        raise SystemExit('Conjunto desconocido: ' + ', '.join(unknown))

    os.makedirs(RAW, exist_ok=True)
    manifest_path = os.path.join(RAW, 'sources.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding='utf-8') as handle:
            manifest = json.load(handle)

    for name in targets:
        package_id = DATASETS[name]
        package = get_json(API + package_id)['result']
        if name in FORCED_URLS:
            candidates = [r for r in package.get('resources', [])
                          if r.get('url', '').rstrip('/') == FORCED_URLS[name].rstrip('/')]
            if not candidates:
                raise SystemExit(f'No se encontró el recurso de {name} en la API')
            resource = candidates[0]
        else:
            resource = newest_resource(package.get('resources', []))

        url = resource['url']
        extension = os.path.splitext(url)[1].lower() or '.bin'
        destination = os.path.join(RAW, name + extension)

        size = download(url, destination)
        manifest[name] = {
            'dataset': package_id,
            'title': package.get('title'),
            'resource': resource.get('name'),
            'format': (resource.get('format') or '').upper(),
            'resource_url': url,
            'resource_updated': str(resource.get('last_modified') or resource.get('modified')),
            'dataset_updated': str(package.get('metadata_modified')),
            'downloaded_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'bytes': size,
            'file': os.path.relpath(destination, ROOT).replace(os.sep, '/'),
        }
        print(f'{name:14} {os.path.basename(destination):32} {size:>9} bytes  '
              f'actualizado {manifest[name]["resource_updated"][:19]}')

    with open(manifest_path, 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
        handle.write('\n')

    print('\nManifiesto: data/raw/sources.json')


if __name__ == '__main__':
    main()
