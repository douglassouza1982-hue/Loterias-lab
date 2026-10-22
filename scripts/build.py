"""Converte dados/*.json (formato do espelho) em web/data/*.json compactos e gera dist/preview.html (dados embutidos, modo demonstração)."""
import json, pathlib, datetime

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
MODALIDADES = ['megasena','lotofacil','quina','lotomania','timemania','duplasena','diadesorte','supersete','maismilionaria']

def converter(nome):
    d = json.loads((RAIZ / 'dados' / f'{nome}.json').read_text(encoding='utf-8'))
    reg = {'n': [], 'x': []}
    for k in sorted(d, key=int):
        v = d[k]
        if nome in ('timemania', 'diadesorte'):
            reg['n'].append(sorted(int(a) for a in v[:7]))
            if nome == 'diadesorte':
                reg['x'].append(MESES.index(v[7].strip()) + 1)
        elif nome == 'maismilionaria':
            reg['n'].append(sorted(int(a) for a in v[:6])); reg['x'].append(sorted(int(a) for a in v[6:8]))
        elif nome == 'duplasena':
            reg['n'].append(sorted(int(a) for a in v[:6]) + sorted(int(a) for a in v[6:12]))
        elif nome == 'supersete':
            reg['n'].append([int(a) for a in v])
        else:
            reg['n'].append(sorted(int(a) for a in v))
    if not reg['x']:
        del reg['x']
    return reg

if __name__ == '__main__':
    dados_dir = RAIZ / 'web' / 'data'
    dados_dir.mkdir(parents=True, exist_ok=True)
    tudo = {}
    for m in MODALIDADES:
        destino = dados_dir / f'{m}.json'
        # web/data é a fonte viva (atualizada pelo robô); só converte do espelho se ainda não existir
        if not destino.exists():
            destino.write_text(json.dumps(converter(m), separators=(',', ':')), encoding='utf-8')
        tudo[m] = json.loads(destino.read_text(encoding='utf-8'))
    meta = dados_dir / 'meta.json'
    if not meta.exists():
        meta.write_text(json.dumps({'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
                                    'ultimo': {m: len(tudo[m]['n']) for m in MODALIDADES}}), encoding='utf-8')
    html = (RAIZ / 'web' / 'index.html').read_text(encoding='utf-8')
    for tag in ['<script src="config.js"></script>\n',
                '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n',
                '<link rel="manifest" href="manifest.webmanifest">\n', '<link rel="icon" href="icon.svg" type="image/svg+xml">\n',
                '<link rel="apple-touch-icon" href="icon-192.png">\n']:
        html = html.replace(tag, '')
    html = html.replace('/*__DADOS__*/null', json.dumps(tudo, separators=(',', ':')))
    (RAIZ / 'dist').mkdir(exist_ok=True)
    (RAIZ / 'dist' / 'preview.html').write_text(html, encoding='utf-8')
    print('ok', {m: len(v['n']) for m, v in tudo.items()})
