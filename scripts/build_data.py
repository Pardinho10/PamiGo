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


def clean(value):
    if value is None:
        return ''
    text = str(value).replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
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


BUILDERS = {
    'medicamentos': (load_medicamentos, export_medicamentos),
}


def main():
    targets = sys.argv[1:] or ['medicamentos']
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

    connection = connect()
    for name in targets:
        loader, exporter = BUILDERS[name]
        total = loader(connection)
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
