"""Archive actual radar revisions; never turn a successful fetch into a new poll."""
import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]

def load(path, default):
    try: return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError): return default

def revision(country, data):
    if country == 'israel':
        poll = data['poll']
        return {'date': poll['date'], 'source': poll['publisher'], 'url': poll['url'],
                'series': 'kan-kantar-seats', 'values': {p['id']: p['seats'] for p in data['parties']},
                'labels': {p['id']: p['name_fa'] for p in data['parties']},
                'reviewed_at': data.get('updated_at'), 'election_date': data['election_date']}
    generic = data['generic']
    return {'date': data.get('generic_date', '2026-10-06'), 'source': generic['label'],
            'url': data.get('generic_source_url', ''), 'series': 'reuters-ipsos-registered-national',
            'values': {'d': generic['d'], 'r': generic['r']}, 'labels': {'d': 'دموکرات', 'r': 'جمهوری‌خواه'},
            'ratings': {r['district']: r['rating'] for r in data.get('house_races', [])},
            'reviewed_at': data.get('generic_reviewed_at') or data.get('updated_iso'), 'election_date': '2026-11-03'}

def update_country(country, data, old, now):
    point = revision(country, data)
    material = {k: v for k, v in point.items() if k != 'reviewed_at'}
    digest = hashlib.sha256(json.dumps(material, sort_keys=True).encode()).hexdigest()
    history = list(old.get('history', []))
    if not history and country=='us':
        for poll in data.get('generic_polls', []):
            if poll['date'] < point['date']:
                history.append({'date':poll['date'], 'values':poll['values'], 'url':poll['url'], 'source':poll['source'], 'series':point['series'], 'labels':point['labels'], 'recorded_at':now})
    changes = list(old.get('changes', []))
    if digest != old.get('fingerprint'):
        prev = history[-1] if history else None
        deltas = []
        if prev and prev['series'] == point['series']:
            for key, value in point['values'].items():
                before = prev['values'].get(key)
                if before is not None and value != before:
                    deltas.append(f"{point['labels'][key]}: {before} ← {value}")
            for key, value in point.get('ratings', {}).items():
                before = prev.get('ratings', {}).get(key)
                if before is not None and before != value: deltas.append(f'{key}: {before} ← {value}')
        title = ('؛ '.join(deltas) if deltas else ('حمایت ملی: دموکرات‌ها '+str(point['values']['d'])+'٪؛ جمهوری‌خواهان '+str(point['values']['r'])+'٪' if country=='us' else 'نظرسنجی کان: یاشار '+str(point['values'].get('yashar',0))+' کرسی؛ لیکود '+str(point['values'].get('likud',0))+' کرسی'))
        history.append({**point, 'recorded_at': now})
        changes.append({'id': digest[:20], 'date': point['date'], 'recorded_at': now,
                        'title_fa': title, 'source': point['source'], 'url': point['url']})
    return {**old, 'fingerprint': digest, 'reviewed_at': point['reviewed_at'],
            'poll_date': point['date'], 'election_date': point['election_date'],
            'history': history[-180:], 'changes': changes[-100:]}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--out', required=True)
    parser.add_argument('--check-sources', action='store_true'); args = parser.parse_args()
    out = Path(args.out)
    old = load(out, load(ROOT/'web-static/data/pendar-radar-status.json', {'countries': {}}))
    now = datetime.now(timezone.utc).isoformat()
    countries = {}
    for country, filename in [('us', 'us-radar.json'), ('israel', 'pendar-israel-radar.json')]:
        data = load(ROOT/'web-static/data'/filename, {})
        state = update_country(country, data, old.get('countries', {}).get(country, {}), now)
        if args.check_sources:
            url = revision(country, data)['url']
            try:
                with urlopen(Request(url, headers={'User-Agent': 'Pendar-Radar/1.0'}), timeout=15) as response:
                    body = response.read(3_000_000)
                state['source_check'] = {'checked_at': now, 'ok': True,
                    'content_hash': hashlib.sha256(body).hexdigest(), 'url': url}
            except Exception as exc:
                state['source_check'] = {'checked_at': now, 'ok': False,
                    'error': type(exc).__name__, 'url': url,
                    'last_success_at': old.get('countries', {}).get(country, {}).get('source_check', {}).get('last_success_at')}
            if state['source_check']['ok']: state['source_check']['last_success_at'] = now
        countries[country] = state
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'countries': countries}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

if __name__ == '__main__': main()
