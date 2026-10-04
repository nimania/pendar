"""Read public store shelves and book review feeds; keep explicit dated evidence."""
from __future__ import annotations
import argparse
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, quote
from email.utils import parsedate_to_datetime
import requests
from bs4 import BeautifulSoup
try:
    from scripts.book_market_sources import PublicMCP, digikala, fidibo, classified_group, classified_batches
    from scripts.book_distributors import parse_telegram_distributor, cheshmeh_catalog, clean_publisher_name
except ModuleNotFoundError:
    from book_market_sources import PublicMCP, digikala, fidibo, classified_group, classified_batches
    from book_distributors import parse_telegram_distributor, cheshmeh_catalog, clean_publisher_name
try:
    from scripts.book_radar import identity, norm, daily_history, indicators, rebuild_graph, attach_radar
    from scripts.book_catalog import curate_payload
except ModuleNotFoundError:
    from book_radar import identity, norm, daily_history, indicators, rebuild_graph, attach_radar
    from book_catalog import curate_payload

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / 'backend/book-radar-sources.json'


def fetch(url):
    r = requests.get(url, timeout=(8, 22), headers={'User-Agent': 'JanKalamBookRadar/1.0 (+https://nimania.github.io/jan-kalam/)'})
    r.raise_for_status()
    if len(r.content) > 2500000:
        raise ValueError('response too large')
    return r.text


def person(name, role='نویسنده'):
    return {'slug': 'person-' + identity(name, '')[6:], 'name_fa': name, 'role_fa': role}


def taaghche(html, source):
    s = BeautifulSoup(html, 'html.parser')
    node = s.find('script', id='__NEXT_DATA__')
    if not node:
        raise ValueError('public shelf data missing')
    data = json.loads(node.string)['props']['pageProps']['pageConfig']['boxes']
    out = []
    for box in data:
        text = norm(box.get('title', '') + ' ' + box.get('subtitle', ''))
        kind = 'bestseller' if 'پرفروش' in text else 'new_to_store' if 'تازه' in text else None
        if not kind:
            continue  # Discounts, featured marketing and free shelves are not trend evidence.
        for pos, b in enumerate((box.get('bookData') or {}).get('books', [])[:20], 1):
            authors = [a for a in b.get('authors', []) if a.get('type') == 1]
            if not b.get('id') or not b.get('title') or not authors:
                continue
            creators = [person(' '.join([a.get('firstName', ''), a.get('lastName', '')]).strip()) for a in authors]
            creators += [person(' '.join([a.get('firstName', ''), a.get('lastName', '')]).strip(), 'مترجم') for a in b.get('authors', []) if a.get('type') == 2]
            fmt = 'audio' if b.get('type') == 'Audio' else 'ebook'
            route = 'audiobook' if fmt == 'audio' else 'book'
            url = f"https://taaghche.com/{route}/{b['id']}/{quote(b['title'])}"
            cover = b.get('coverUri') or ''
            # Only canonical publisher artwork, never badges or merchant-generated thumbnails.
            if not re.fullmatch(r'https://img\.taaghche\.com/(?:frontCover|audioCover)/\d+\.(?:jpg|png)', cover):
                cover = ''
            pubname = b.get('publisher') or ''
            pub = {'slug': 'publisher-' + identity(pubname, '')[6:], 'name_fa': pubname} if pubname else None
            out.append({'title_fa': b['title'], 'author': creators[0]['name_fa'], 'creators': creators, 'publisher': pub, 'subtitle_fa': b.get('subtitle') or '', 'pages': b.get('numberOfPages') or None, 'store_added_at': b.get('creationDate'), 'store_publication_label': b.get('publishDate'), 'cover_url': cover, 'url': url, 'format': fmt, 'source_id': source['id'], 'source_name': source['name_fa'], 'kind': kind, 'position': pos, 'list_label': box['title'], 'list_url': source['url'], 'rating': b.get('rating'), 'rating_count': b.get('rateCounts'), 'price': b.get('price'), 'currency': 'IRT'})
    if not out:
        raise ValueError('recognized shelves empty')
    return out


def ketabrah(html, source):
    s = BeautifulSoup(html, 'html.parser')
    out = []
    for box in s.select('.grid-container'):
        header = box.select_one('a.header h2')
        if not header:
            continue
        label = header.get_text(' ', strip=True)
        kind = 'bestseller' if 'پرفروش' in label else 'new_to_store' if 'تازه' in label else None
        if not kind:
            continue
        list_url = urljoin(source['url'], header.find_parent('a').get('href', ''))
        for pos, cell in enumerate(box.select('.cell')[:20], 1):
            title = cell.select_one('h3 a.title')
            author = cell.select_one('.authors a')
            if not title or not author:
                continue
            raw = title.get_text(' ', strip=True)
            fmt = 'audio' if raw.startswith('کتاب صوتی') else 'ebook'
            clean = re.sub(r'^کتاب(?: صوتی)?\s+', '', raw)
            url = urljoin(source['url'], title.get('href', ''))
            if not re.search(r'/(?:book|audiobook)/\d+', url):
                continue
            img = cell.select_one('a.cover img')
            cover = (img.get('data-src') or img.get('src', '')) if img else ''
            if not re.fullmatch(r'https://img\.ketabrah\.com/img/s/\d+\.jpg', cover):
                cover = ''
            out.append({'title_fa': clean, 'author': author.get_text(' ', strip=True), 'creators': [person(author.get_text(' ', strip=True))], 'cover_url': cover, 'url': url, 'format': fmt, 'source_id': source['id'], 'source_name': source['name_fa'], 'kind': kind, 'position': pos, 'list_label': label, 'list_url': list_url, 'price': None, 'currency': None})
    if not out:
        raise ValueError('recognized shelves empty')
    return out


def reading_feed(xml, source, now):
    root = ET.fromstring(xml)
    rows = []
    for item in root.findall('.//item')[:12]:
        title, url = item.findtext('title') or '', item.findtext('link') or ''
        if not url.startswith('https://'):
            continue
        try:
            date = parsedate_to_datetime(item.findtext('pubDate') or '').astimezone(timezone.utc)
        except (ValueError, TypeError):
            continue
        if (now-date).days < 0 or (now-date).days > 45:
            continue
        if 'فیلم' in title or not any(w in norm(title) for w in ['کتاب', 'نویسنده', 'رمان', 'خواندن']):
            continue
        rows.append({'title_fa': BeautifulSoup(title, 'html.parser').get_text(), 'url': url, 'source_name': source['name_fa'], 'source_id': source['id'], 'source_type': source['kind'], 'published_at': date.isoformat(), 'observed_at': now.isoformat()})
    return rows


def repair_publisher_metadata(payload):
    """Collapse publisher names polluted by edition labels such as «چشمه چاپ پنجم»."""
    for b in payload.get('books', []):
        nodes = [b] + list(b.get('editions') or [])
        for node in nodes:
            pub = node.get('publisher') or {}
            raw = pub.get('name_fa')
            if not raw:
                continue
            clean = clean_publisher_name(raw)
            if clean and clean != raw:
                m = re.search(r'(?:نوبت\s+)?چاپ\s*[:：]?\s*(.+)$', raw)
                if m and not node.get('print_label'):
                    node['print_label'] = m.group(1).strip(' .،-|')
                node['publisher'] = {'slug': 'publisher-' + identity(clean, '')[6:], 'name_fa': clean}
    rebuild_graph(payload)
    return payload


def collect(payload, registry, now=None, local=None):
    now = now or datetime.now(timezone.utc)
    repair_publisher_metadata(payload)
    previous = payload.get('radar') or {}
    books = {b['slug']: b for b in payload.get('books', [])}
    # Repair earlier product-title records that accidentally included a translator
    # in the author string. The corrected source row will recreate this edition.
    for slug, b in list(books.items()):
        if b.get('discovery') == 'direct_shelf' and any(re.search(r'ترجم(?:ه|ۀ)', c.get('name_fa', '')) for c in b.get('creators', []) if c.get('role_fa') == 'نویسنده') and all(l.get('store') == 'دیجی‌کالا' for e in b.get('editions', []) for l in e.get('purchase_links', [])):
            del books[slug]
    observed, health, readings = [], [], []
    classifieds = previous.get('classifieds') or {}
    # Sequential small public requests; each source fails independently.
    for source in registry['sources']:
        status = {'id': source['id'], 'name_fa': source['name_fa'], 'url': source['url'], 'kind': source['kind'], 'attempted_at': now.isoformat()}
        try:
            fixture = Path(local[source['id']]).read_text() if local and source['id'] in local else None
            if source['adapter'] == 'divar':
                client = PublicMCP(source['endpoint'])
                if fixture:
                    groups = [classified_group(data, q, now) for q, data in json.loads(fixture).items()]
                else:
                    groups, failures = classified_batches(client, source['queries'], source['cities'], now, classifieds)
                    if failures:
                        status['note_fa'] = f'{failures} بخش جست‌وجو دریافت نشد؛ تاریخ نمونه‌های قبلی حفظ شده است'
                for group in groups:
                    q = group['query']
                    compact = lambda v: re.sub(r'[^\w]', '', norm(v)).replace('آ', 'ا')
                    matches = [b['slug'] for b in books.values() if compact(b['title_fa']) == compact(q)]
                    group['book_slug'] = matches[0] if len(matches) == 1 else None
                classifieds = {'observed_at': max(g['observed_at'] for g in groups) if groups else now.isoformat(), 'cities': source['cities'], 'scope_fa': source.get('scope_fa', 'نمونهٔ آگهی‌های کتاب در شهرهای انتخاب‌شده'), 'groups': groups}
                rows = [r for g in groups for r in g['items']]
            elif source['adapter'] == 'digikala':
                client = PublicMCP(source['endpoint'])
                shelves = json.loads(fixture) if fixture else {kind: client.call('search_digikala', {'query': 'کتاب', 'sort': sort, 'limit': 20}) for kind, sort in [('bestseller', 'best_selling'), ('new_to_store', 'newest')]}
                rows = digikala(shelves, source)
            elif source['adapter'] == 'fidibo':
                raw = fixture if fixture is not None else fetch(source['url'])
                rows = fidibo(raw, source)
                if fixture is None and source.get('extra_url'):
                    try:
                        rows += fidibo(fetch(source['extra_url']), source)
                    except Exception:
                        status['note_fa'] = 'قفسهٔ متنی دریافت شد؛ تازه‌های صفحهٔ اصلی فعلاً در دسترس نیست'
            else:
                raw = fixture if fixture is not None else (None if source['adapter'] == 'cheshmeh_catalog' else fetch(source['url']))
                if source['adapter'] == 'rss':
                    rows = reading_feed(raw, source, now)
                elif source['adapter'] == 'telegram_distributor':
                    rows = parse_telegram_distributor(raw, source, person, identity)
                elif source['adapter'] == 'cheshmeh_catalog':
                    rows = cheshmeh_catalog(source, identity)
                else:
                    rows = (taaghche if source['adapter'] == 'taaghche' else ketabrah)(raw, source)
            if source['adapter'] == 'rss':
                readings.extend(rows)
            elif source['adapter'] != 'divar':
                for r in rows:
                    slug = identity(r['title_fa'], r['author'])
                    # Safe orthographic reconciliation only when title AND author uniquely match.
                    compact = lambda v: re.sub(r'[^\w]', '', norm(v)).replace('آ', 'ا')
                    matches = [b['slug'] for b in books.values() if compact(b['title_fa']) == compact(r['title_fa']) and any(compact(c['name_fa']) == compact(r['author']) for c in b.get('creators', []) if c.get('role_fa') == 'نویسنده')]
                    if len(matches) == 1:
                        slug = matches[0]
                    b = books.setdefault(slug, {'slug': slug, 'record_type': 'work', 'title_fa': r['title_fa'], 'language': 'fa', 'discovery': 'direct_shelf', 'confidence': 'source_verified', 'first_seen_at': now.isoformat(), 'mentions': [], 'mention_count': 0, 'editions': []})
                    # Distinct store editions and formats retain their own creator/publisher metadata.
                    edition = {'label_fa': r['source_name'] + ' · ' + {'audio':'صوتی','print':'چاپی','ebook':'الکترونیکی'}[r['format']], 'creators': r['creators'], 'publisher': r.get('publisher'), 'pages': r.get('pages'), 'print_label': r.get('print_label'), 'store_added_at': r.get('store_added_at'), 'store_publication_label': r.get('store_publication_label'), 'purchase_links': ([{'store': r['source_name'], 'url': r['url'], 'exact': True, 'format': r['format'], 'price': r.get('price'), 'currency': r.get('currency'), 'availability': r.get('availability', 'unknown'), 'last_checked': now.isoformat()}] if r.get('purchase_exact', True) else [])}
                    editions = {e['purchase_links'][0]['url']: e for e in b.get('editions', []) if e.get('purchase_links')}
                    if edition.get('purchase_links'):
                        editions[r['url']] = edition
                        b['editions'] = list(editions.values())
                    elif not any((e.get('label_fa') == edition.get('label_fa') and e.get('publisher') == edition.get('publisher')) for e in b.get('editions', [])):
                        b.setdefault('editions', []).append(edition)
                    b.setdefault('creators', [c for c in r['creators'] if c['role_fa'] == 'نویسنده'])
                    if r.get('subtitle_fa'):
                        b['subtitle_fa'] = r['subtitle_fa']
                    if r.get('category_fa') and not b.get('category_fa'):
                        b['category_fa'] = r['category_fa']
                    if r.get('external_ids'):
                        b.setdefault('external_ids', {}).update({k: v for k, v in r['external_ids'].items() if v not in (None, '')})
                    if 'stock_quantity' in r:
                        b.setdefault('source_inventory', {})[r['source_id']] = {'quantity': r.get('stock_quantity'), 'availability': r.get('availability'), 'checked_at': now.isoformat()}
                    if not b.get('cover_url') and r.get('cover_url'):
                        b['cover_url'] = r['cover_url']
                        b['cover'] = {'source_name': r['source_name'], 'source_url': r['url'], 'verification': 'canonical_provider_artwork'}
                    if r.get('publisher') and not b.get('publisher'):
                        b['publisher'] = r['publisher']
                    observed.append({k: r[k] for k in ('source_id', 'source_name', 'kind', 'position', 'format', 'list_label', 'list_url', 'url', 'rating', 'rating_count') if k in r} | {'slug': slug, 'observed_at': now.isoformat()})
            status.update(status='ok', count=len(rows), last_success_at=now.isoformat())
        except Exception as e:
            old = next((s for s in previous.get('sources', []) if s['id'] == source['id']), {})
            status.update(status='unavailable', count=0, last_success_at=old.get('last_success_at'), error=type(e).__name__)
            readings.extend(r for r in previous.get('reading', []) if r.get('source_id') == source['id'])
        health.append(status)
    history = daily_history([r for r in previous.get('history', []) if r['slug'] in books], observed, now)
    for b in books.values():
        if b.get('discovery') == 'direct_shelf' or any(r['slug'] == b['slug'] for r in history):
            b['radar'] = indicators(b['slug'], history, now)
    payload['books'] = list(books.values())
    payload['radar'] = {'updated_at': now.isoformat(), 'method_version': 2, 'sources': health, 'history': history, 'classifieds': classifieds, 'reading': list({r['url']: r for r in readings}.values())[:24], 'scope_fa': 'فهرست‌های منتخب و پرفروش فروشگاه‌های پایش‌شده؛ بدون دسترسی به تعداد فروش بازار'}
    rebuild_graph(payload)
    return curate_payload(payload)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--catalog', default=str(ROOT / 'backend/public/data/books.json'))
    p.add_argument('--out-js')
    p.add_argument('--local-fixtures', help='JSON source-id -> local path (development only)')
    a = p.parse_args()
    path = Path(a.catalog)
    payload = json.loads(path.read_text()) if path.exists() else {'books': []}
    seed = ROOT / 'web-static/data/books.json'
    if seed.exists() and seed.resolve() != path.resolve():
        attach_radar(payload, json.loads(seed.read_text()))
    local = json.loads(a.local_fixtures) if a.local_fixtures else None
    collect(payload, json.loads(REGISTRY.read_text()), local=local)
    compact = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(compact)
    if a.out_js:
        Path(a.out_js).write_text('window.__BOOKS_DATA__=' + compact + ';\n')
    print(json.dumps({'books': len(payload['books']), 'signals': len(payload['radar']['history']), 'sources': payload['radar']['sources']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
