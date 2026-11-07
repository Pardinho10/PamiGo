#!/usr/bin/env python3
"""
PamiGo — construcción de los JSON que consume la aplicación.

Lee los archivos crudos de data/raw, los carga en una base SQLite de trabajo
(data/raw/pami.db), normaliza valores y exporta los JSON versionados.

    python3 scripts/build_data.py                # todos los conjuntos disponibles
    python3 scripts/build_data.py medicamentos   # solo uno

Requiere: openpyxl (solo para XLSX).
"""

import csv
import json
import os
import re
import sqlite3
import sys
import unicodedata
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
DATA = os.path.join(ROOT, 'data')
DB_PATH = os.path.join(RAW, 'pami.db')

# Caracteres corruptos en el origen (conversión de codificación perdida).
# Solo se corrigen los casos inequívocos: el carácter faltante se deduce de la palabra.
FIXES = {
    'Bag¿': 'Bagó',
    'Bag¿-Arcor': 'Bagó-Arcor',
    'Nutricia-Bag¿': 'Nutricia-Bagó',
    'Dom¿nguez': 'Domínguez',
    'Andr¿maco': 'Andrómaco',
    'Qu¿mica Luar': 'Química Luar',
    'Cassarß': 'Cassará',
    'KINDERVAL MAX EMULSI¿N': 'KINDERVAL MAX EMULSIÓN',
    'LEVECOM SOLUCI¿N': 'LEVECOM SOLUCIÓN',
}

MOJIBAKE = re.compile(r'[¿ßÃÂ]')


def repair_mojibake(text):
    """Revierte texto UTF-8 leído como latin-1 ("AGÃœERO" -> "AGÜERO", "1Â°" -> "1°").

    Solo se aplica si la recodificación produce UTF-8 válido; el texto correcto no cambia.
    """
    if not text or text.isascii():
        return text
    for codec in ('cp1252', 'latin-1'):
        try:
            return text.encode(codec).decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return text


def clean(value):
    if value is None:
        return ''
    text = str(value).replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    text = repair_mojibake(text)
    return FIXES.get(text, text)


def read_xlsx(path):
    import openpyxl

    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook[workbook.sheetnames[0]]
    rows = list(sheet.iter_rows(values_only=True))
    workbook.close()
    return rows


def read_csv(path):
    for encoding in ('utf-8-sig', 'latin-1'):
        try:
            with open(path, newline='', encoding=encoding) as handle:
                return list(csv.reader(handle, delimiter=';'))
        except UnicodeDecodeError:
            continue
    raise SystemExit('No se pudo decodificar ' + path)


def connect():
    os.makedirs(RAW, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.execute('PRAGMA journal_mode = MEMORY')
    return connection


def load_medicamentos(connection):
    """XLSX con encabezado en la primera fila y seis columnas."""
    path = os.path.join(RAW, 'medicamentos.xlsx')
    if not os.path.exists(path):
        raise SystemExit('Falta data/raw/medicamentos.xlsx (ejecutá fetch_data.py)')

    rows = read_xlsx(path)
    header = [str(cell).strip().upper() for cell in rows[0]]
    expected = ['DROGA', 'MARCA', 'PRESENTACION', 'LABORATORIO', 'COBERTURA', 'COPAGO']
    if header[:6] != expected:
        raise SystemExit('Encabezado inesperado en medicamentos: ' + str(header))

    connection.execute('DROP TABLE IF EXISTS medicamentos')
    connection.execute("""
        CREATE TABLE medicamentos (
            droga TEXT, marca TEXT, presentacion TEXT,
            laboratorio TEXT, cobertura TEXT, copago TEXT
        )
    """)

    records = []
    for row in rows[1:]:
        values = [clean(cell) for cell in row[:6]]
        if not values[0]:
            continue
        records.append(values)

    connection.executemany('INSERT INTO medicamentos VALUES (?,?,?,?,?,?)', records)
    connection.commit()
    return len(records)


def export_medicamentos(connection):
    cursor = connection.execute("""
        SELECT droga, marca, presentacion, laboratorio, cobertura, copago
        FROM medicamentos
        ORDER BY rowid
    """)
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


# Numerales romanos del catálogo -> número arábigo usado por el padrón
ROMANOS = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8,
    'IX': 9, 'X': 10, 'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
    'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20, 'XXI': 21, 'XXII': 22,
    'XXIII': 23, 'XXIV': 24, 'XXV': 25, 'XXVI': 26, 'XXVII': 27, 'XXVIII': 28, 'XXIX': 29,
    'XXX': 30, 'XXXI': 31, 'XXXII': 32, 'XXXIII': 33, 'XXXIV': 34, 'XXXV': 35,
    'XXXVI': 36, 'XXXVII': 37, 'XXXVIII': 38,
}

# Provincia a la que pertenece la cabecera de cada UGL (el catálogo nombra la ciudad, no la provincia).
UGL_PROVINCIA = {
    'TUCUMAN': 'TUCUMAN',
    'CORRIENTES': 'CORRIENTES',
    'CORDOBA': 'CORDOBA',
    'RIO CUARTO': 'CORDOBA',
    'MENDOZA': 'MENDOZA',
    'ROSARIO': 'SANTA FE',
    'SANTA FE': 'SANTA FE',
    'CONCORDIA': 'ENTRE RIOS',
    'ENTRE RIOS': 'ENTRE RIOS',
    'BAHIA BLANCA': 'BUENOS AIRES',
    'CAPITAL FEDERAL': 'CAPITAL FEDERAL',
    'LA PLATA': 'BUENOS AIRES',
    'SAN MARTIN': 'BUENOS AIRES',
    'LANUS': 'BUENOS AIRES',
    'MAR DEL PLATA': 'BUENOS AIRES',
    'MORON': 'BUENOS AIRES',
    'QUILMES': 'BUENOS AIRES',
    'SAN JUSTO': 'BUENOS AIRES',
    'AZUL': 'BUENOS AIRES',
    'JUNIN': 'BUENOS AIRES',
    'LUJAN': 'BUENOS AIRES',
    'CHIVILCOY': 'BUENOS AIRES',
    'SALTA': 'SALTA',
    'CHACO': 'CHACO',
    'SGO DEL ESTERO': 'SANTIAGO DEL ESTERO',
    'SANTIAGO DEL ESTERO': 'SANTIAGO DEL ESTERO',
    'NEUQUEN': 'NEUQUEN',
    'CHUBUT': 'CHUBUT',
    'MISIONES': 'MISIONES',
    'LA PAMPA': 'LA PAMPA',
    'SAN JUAN': 'SAN JUAN',
    'JUJUY': 'JUJUY',
    'FORMOSA': 'FORMOSA',
    'CATAMARCA': 'CATAMARCA',
    'LA RIOJA': 'LA RIOJA',
    'SAN LUIS': 'SAN LUIS',
    'RIO NEGRO': 'RIO NEGRO',
    'SANTA CRUZ': 'SANTA CRUZ',
    'TIERRA DEL FUEGO': 'TIERRA DEL FUEGO',
}

# El archivo de prestadores escribe el nombre de la UGL sin la numeración y con variantes.
UGL_ALIAS = {
    'santiago del estero': 'sgo del estero',
}

PROVINCIA_ALIAS = {
    'caba': 'capital federal',
    'ciudad autonoma de buenos aires': 'capital federal',
    'sgo del estero': 'santiago del estero',
    'sgo. del estero': 'santiago del estero',
}


def slug(value):
    """Clave de comparación: sin tildes, sin signos y en minúsculas."""
    text = str(value or '').replace('\xa0', ' ')
    text = unicodedata.normalize('NFD', text)
    text = text.encode('ascii', 'ignore').decode()
    text = re.sub(r'[^A-Za-z0-9 ]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip().lower()


def load_ugl_catalog():
    """Devuelve el catálogo de UGL: número, zona, provincia y etiqueta completa."""
    path = os.path.join(RAW, 'ugls.xlsx')
    if not os.path.exists(path):
        raise SystemExit('Falta data/raw/ugls.xlsx (ejecutá fetch_data.py)')

    catalog = {}
    for row in read_xlsx(path):
        if not row or not row[0]:
            continue
        label = clean(row[0])
        if ' - ' not in label:
            continue
        numero, zona = [part.strip() for part in label.split(' - ', 1)]
        numero = numero.replace('UGL', '').strip()
        provincia = UGL_PROVINCIA.get(zona.upper())
        if not provincia:
            continue
        numero_arabigo = str(ROMANOS.get(numero, numero)).strip()
        # 1) por número arábigo: es la clave del padrón y de farmacias
        catalog[numero_arabigo] = {
            'id': numero_arabigo,
            'zona': zona,
            'provincia': provincia,
            'label': label,
        }
        # 2) por numeral romano y por zona, como alias
        catalog.setdefault(numero, catalog[numero_arabigo])
        catalog.setdefault(slug(zona), catalog[numero_arabigo])
    return catalog


def single_ugl_by_province(catalog):
    """UGL única por provincia: sólo en esos casos la UGL se puede derivar sin ambigüedad."""
    agrupadas = {}
    for entry in catalog.values():
        agrupadas.setdefault(slug(entry['provincia']), []).append(entry)
    return {
        provincia: entries[0]
        for provincia, entries in agrupadas.items()
        if len(entries) == 1
    }


def load_farmacias(connection, catalog=None):
    """XLSX del padrón vigente: código, farmacia, domicilio, provincia, departamento, localidad."""
    path = os.path.join(RAW, 'farmacias.xlsx')
    if not os.path.exists(path):
        raise SystemExit('Falta data/raw/farmacias.xlsx (ejecutá fetch_data.py)')

    rows = read_xlsx(path)
    header = [clean(cell).upper() for cell in rows[0]]
    expected = ['CODIGO PAMI', 'FARMACIA', 'DOMICILIO', 'PROVINCIA', 'DEPARTAMENTO', 'LOCALIDAD']
    if header[:6] != expected:
        raise SystemExit('Encabezado inesperado en farmacias: ' + str(header))

    unicas = single_ugl_by_province(catalog or {})

    connection.execute('DROP TABLE IF EXISTS farmacias')
    connection.execute("""
        CREATE TABLE farmacias (
            codigo TEXT, provincia_id TEXT, ugl_id TEXT, ugl_desc TEXT,
            farmacia_desc TEXT, farmacia_direcc TEXT, farmacia_localid TEXT, departamento TEXT
        )
    """)

    records = []
    for row in rows[1:]:
        values = [clean(cell) for cell in row[:6]]
        codigo, farmacia, direccion, provincia, departamento, localidad = values
        if not farmacia:
            continue
        clave = slug(PROVINCIA_ALIAS.get(slug(provincia), slug(provincia)))
        ugl = unicas.get(clave)
        records.append([
            codigo,
            provincia,
            ugl['id'] if ugl else '',
            ugl['zona'] if ugl else '',
            farmacia,
            direccion,
            localidad,
            departamento,
        ])

    connection.executemany('INSERT INTO farmacias VALUES (?,?,?,?,?,?,?,?)', records)
    connection.commit()
    return len(records)


def export_farmacias(connection):
    cursor = connection.execute("""
        SELECT provincia_id, ugl_id, ugl_desc, farmacia_desc,
               farmacia_direcc, farmacia_localid, departamento
        FROM farmacias
        ORDER BY rowid
    """)
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def load_prestadores(connection, catalog=None):
    """XLSX con dos hojas; la primera lista, por UGL, la cantidad de prestadores por especialidad."""
    path = os.path.join(RAW, 'prestadores.xlsx')
    if not os.path.exists(path):
        raise SystemExit('Falta data/raw/prestadores.xlsx (ejecutá fetch_data.py)')

    import openpyxl

    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook[workbook.sheetnames[0]]
    rows = list(sheet.iter_rows(values_only=True))
    workbook.close()

    por_zona = catalog or {}

    def entry_of(name):
        key = slug(name)
        key = UGL_ALIAS.get(key, key)
        return por_zona.get(key)

    connection.execute('DROP TABLE IF EXISTS prestadores')
    connection.execute("""
        CREATE TABLE prestadores (
            ugl_id TEXT, ugl_desc TEXT, modulo_pami_id TEXT,
            modulo_pami_desc TEXT, q_prestadores INTEGER
        )
    """)

    records = []
    actual = None
    inicio = None
    for index, row in enumerate(rows):
        nombre = clean(row[1]) if len(row) > 1 else ''
        valor = row[2] if len(row) > 2 else None

        if not nombre or nombre.lower().startswith('fuente') or slug(nombre) == 'total general':
            continue

        entry = entry_of(nombre)
        if entry:
            actual = entry
            inicio = index
            continue

        if isinstance(valor, (int, float)) and actual:
            especialidad = nombre
            registros_previos = [r for r in records if r[0] == actual['id']]
            if any(r[2] == especialidad for r in registros_previos):
                # La lista de especialidades se repitió: el archivo omite la cabecera de la UGL.
                sin_cabecera = [z for z in por_zona.values()
                                if z['id'] not in {r[0] for r in records}]
                actual = sin_cabecera[0] if len(sin_cabecera) == 1 else actual
            records.append([actual['id'], actual['zona'], especialidad, especialidad, int(valor)])

    connection.executemany('INSERT INTO prestadores VALUES (?,?,?,?,?)', records)
    connection.commit()
    return len(records)


def export_prestadores(connection):
    cursor = connection.execute("""
        SELECT ugl_id, ugl_desc, modulo_pami_desc, q_prestadores
        FROM prestadores
        ORDER BY ugl_desc COLLATE NOCASE, modulo_pami_desc COLLATE NOCASE
    """)
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]



def load_agencias(connection, catalog=None):
    """Listado de UGLs, CAPs, agencias y bocas de atención (vigente).

    Dos recursos del mismo dataset se cruzan: el catálogo de UGL (zona y
    provincia) y el listado de agencias con domicilio y coordenadas.
    """
    por_zona = catalog or {}
    # catálogo de sedes UGL: domicilio y vínculo por zona
    import openpyxl

    wb = openpyxl.load_workbook(os.path.join(RAW, 'ugls.xlsx'), read_only=True, data_only=True)
    sedes = {}
    for row in wb[wb.sheetnames[0]].iter_rows(values_only=True):
        if not row or not row[0] or ' - ' not in str(row[0]):
            continue
        zona = str(row[0]).split(' - ', 1)[1].strip()
        entry = por_zona.get(slug(zona))
        if entry and entry['id'] not in sedes:
            sedes[entry['id']] = {'domicilio': clean(row[2]), 'vinculo': clean(row[3])}
    wb.close()

    # listado de agencias con domicilio, localidad y coordenadas
    wb = openpyxl.load_workbook(os.path.join(RAW, 'agencias.xlsx'), read_only=True, data_only=True)
    agrows = [r for r in wb[wb.sheetnames[0]].iter_rows(values_only=True)
              if any(c is not None for c in r)]
    wb.close()

    connection.execute('DROP TABLE IF EXISTS agencias')
    connection.execute("""
        CREATE TABLE agencias (
            ugl_id TEXT, ugl_desc TEXT, provincia TEXT,
            entidad TEXT, tipo TEXT, domicilio TEXT, localidad TEXT
        )
    """)

    records = []
    for row in agrows[3:]:
        nombre = clean(row[3])
        if not nombre:
            continue
        entry = None
        ugl_id = str(row[0]).strip() if row[0] is not None else ''
        if ugl_id in por_zona:
            entry = por_zona[ugl_id]
        else:
            zona = clean(row[1])
            entry = por_zona.get(slug(zona))
        provincia = entry['provincia'] if entry else ''
        zona_desc = entry['zona'] if entry else zona
        tipo = 'AGENCIA'
        if nombre.upper().startswith('CAP'):
            tipo = 'CAP'
        elif nombre.upper().startswith('BOCA'):
            tipo = 'BOCA'
        elif nombre.upper().startswith('UGL'):
            tipo = 'UGL'
        localidad = clean(row[7]) if len(row) > 7 else ''
        domicilio = clean(row[4])
        records.append([ugl_id, zona_desc, provincia, nombre, tipo, domicilio, localidad])

    connection.executemany('INSERT INTO agencias VALUES (?,?,?,?,?,?,?)', records)
    connection.commit()
    return len(records)


def export_agencias(connection):
    cursor = connection.execute("""
        SELECT ugl_id, ugl_desc, provincia, entidad, tipo, domicilio, localidad
        FROM agencias
        ORDER BY provincia COLLATE NOCASE, localidad COLLATE NOCASE, entidad COLLATE NOCASE
    """)
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


BUILDERS = {
    'medicamentos': (load_medicamentos, export_medicamentos),
    'farmacias': (load_farmacias, export_farmacias),
    'prestadores': (load_prestadores, export_prestadores),
    'agencias': (load_agencias, export_agencias),
}


def main():
    targets = sys.argv[1:] or ['medicamentos', 'farmacias', 'prestadores']
    unknown = [t for t in targets if t not in BUILDERS]
    if unknown:
        raise SystemExit(
            'Conjunto sin constructor todavía: ' + ', '.join(unknown) +
            '\nPendiente de remapeo de columnas (ver CHANGELOG).'
        )

    manifest_path = os.path.join(RAW, 'sources.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding='utf-8') as handle:
            manifest = json.load(handle)

    meta_path = os.path.join(DATA, 'meta.json')
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path, encoding='utf-8') as handle:
            meta = json.load(handle)

    catalog = load_ugl_catalog() if os.path.exists(os.path.join(RAW, 'ugls.xlsx')) else {}

    connection = connect()
    for name in targets:
        loader, exporter = BUILDERS[name]
        total = loader(connection, catalog) if name != 'medicamentos' else loader(connection)
        records = exporter(connection)

        destination = os.path.join(DATA, name + '.json')
        with open(destination, 'w', encoding='utf-8') as handle:
            json.dump(records, handle, ensure_ascii=False, separators=(',', ':'))
            handle.write('\n')

        source = manifest.get(name, {})
        updated = (source.get('resource_updated') or '')[:10] or date.today().isoformat()
        meta[name] = {
            'registros': len(records),
            'actualizado': updated,
            'fuente': source.get('resource_url'),
            'dataset': source.get('dataset'),
            'archivo': source.get('file'),
        }

        pending = sorted({value for record in records for value in record.values()
                          if isinstance(value, str) and MOJIBAKE.search(value)})
        print(f'{name:14} {len(records):>7} registros  ->  data/{name}.json  (al {updated})')
        if total != len(records):
            print(f'{"":14} {total - len(records)} registros descartados por datos incompletos')
        if pending:
            print(f'{"":14} valores con caracteres dudosos sin corregir ({len(pending)}): '
                  + ', '.join(pending[:6]) + ('…' if len(pending) > 6 else ''))

    connection.close()

    meta['generado'] = date.today().isoformat()
    with open(meta_path, 'w', encoding='utf-8') as handle:
        json.dump(meta, handle, indent=2, ensure_ascii=False)
        handle.write('\n')
    print('\nMetadatos: data/meta.json')


if __name__ == '__main__':
    main()
