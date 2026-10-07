"""Update the public motorcycle sample from the latest official Fenabrave PDF.
Never replaces the previous dataset when extraction or validation fails.
"""
import argparse
import io
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from pypdf import PdfReader
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
INDEX = 'https://www.fenabrave.org.br/portalv2/Conteudo/Emplacamentos'

def download(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'MasterMotos/1.0'}), timeout=45) as response:
        return response.read(30 * 1024 * 1024)

def extract(pdf, source, period):
    reader = PdfReader(io.BytesIO(pdf))
    models, total_month, total_year = [], None, None
    motorcycles = False
    for page in reader.pages:
        text = page.extract_text() or ''
        if 'Emplacamento Motocicletas' in text:
            motorcycles = True
            heading = re.search(r'Emplacamento Motocicletas\s+(\w+)/(20\d{2})', text)
            months = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
            name = ''.join(c for c in unicodedata.normalize('NFD', heading[1].lower()) if not unicodedata.combining(c)) if heading else ''
            if name not in months or f'{heading[2]}-{months.index(name)+1:02d}' != period:
                raise ValueError('O período da tabela não corresponde ao arquivo oficial.')
            totals = re.search(r'Motos\s+([\d.]+)\s+[\d.]+\s+([\d.]+)', text)
            if totals:
                total_month, total_year = [int(x.replace('.', '')) for x in totals.groups()]
        if not motorcycles or 'Modelos mais emplacados acumulado' not in text:
            continue
        # Match only ranked model rows, including zero monthly sales and movement arrows.
        pattern = r'\d+[º°]\s+([^/\n]+)/([^\n]+?)\s+([\d.,]+)\s+([\d.,]+)\s*[^\d]*?([\d.]+)\s+[\d,]+%'
        for match in re.finditer(pattern, text):
            brand, model, previous, current, year = match.groups()
            count = lambda value: int(value.replace('.', '').replace(',00', ''))
            models.append({'brand': brand.strip(), 'model': model.strip(), 'monthly': count(current), 'previous': count(previous), 'yearToDate': count(year)})
    if not total_month or not total_year or not 60 <= len(models) <= 120:
        raise ValueError('Relatório sem tabela completa reconhecível. A base anterior foi preservada.')
    keys = [(row['brand'], row['model']) for row in models]
    if len(set(keys)) != len(keys) or sum(row['yearToDate'] for row in models) > total_year or sum(row['monthly'] for row in models) > total_month:
        raise ValueError('Totais ou modelos inconsistentes. A base anterior foi preservada.')
    return {'schemaVersion': 1, 'period': period, 'source': source, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'totalMonthly': total_month, 'totalYearToDate': total_year, 'scope': 'Modelos publicados nos rankings por segmento da Fenabrave; não inclui todos os modelos do país.', 'models': models}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', help='Use a downloaded official PDF for a reproducible extraction')
    parser.add_argument('--period')
    args = parser.parse_args()
    if args.pdf:
        if not args.period or not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', args.period):
            raise ValueError('Informe --period AAAA-MM.')
        source = f'https://www.fenabrave.org.br/portal/files/{args.period.replace("-", "_")}_02.pdf'
        pdf, period = Path(args.pdf).read_bytes(), args.period
    else:
        html = download(INDEX).decode('utf-8', errors='replace')
        reports = re.findall(r'(?:https://www.fenabrave.org.br)?/portal/files/(20\d{2})_(\d{2})_02\.pdf', html)
        if not reports:
            raise ValueError('Nenhum relatório público identificado na página oficial.')
        year, month = max(reports)
        period = f'{year}-{month}'
        source = f'https://www.fenabrave.org.br/portal/files/{year}_{month}_02.pdf'
        pdf = download(source)
    result = extract(pdf, source, period)
    target = ROOT / 'Data' / 'market-sales.json'
    target.parent.mkdir(exist_ok=True)
    if target.exists():
        previous = json.loads(target.read_text(encoding='utf-8'))
        if previous['period'] > period:
            raise ValueError('Recusada atualização para um período mais antigo.')
        if all(previous.get(key) == value for key, value in result.items() if key != 'checkedAt'):
            print('Dados oficiais já atualizados:', period)
            return
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(target)
    print(f'Atualizado: {period}, {len(result["models"])} modelos publicados.')

if __name__ == '__main__':
    main()
