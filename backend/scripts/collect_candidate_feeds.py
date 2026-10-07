"""Refresh candidate headlines and verified official RSS/YouTube archives.

No title-only recap or inferred policy attribution. Failed requests retain the
previous rows and their original timestamps. Requires only the Python stdlib.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
import json
import os
import sys
from pathlib import Path
import re
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'data/us-candidate-sources.json'

def fetch(url):
    req = Request(url, headers={'User-Agent': 'Pendar/1.0 candidate-news'})
    with urlopen(req, timeout=12) as response:
        return response.read(2_000_000).decode('utf-8', errors='replace')

def safe_url(url):
    return urlparse(url).scheme in ('https', 'http')

def norm(text):
    return re.sub(r'[^a-z0-9]+', ' ', unescape(text).lower()).strip()

def matches(title, person):
    text = ' ' + norm(title) + ' '
    return any(' ' + norm(alias) + ' ' in text for alias in person['aliases']) and (
        not person.get('require_context') or any(norm(word) in text for word in person['context']))

def stamp(value):
    try:
        dt = parsedate_to_datetime(value)
    except (ValueError, TypeError):
        try:
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            return ''
    if not dt.tzinfo:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()

def parse_feed(body, person, official=False, source=''):
    root = ET.fromstring(body)
    atom = {'a': 'http://www.w3.org/2005/Atom', 'm': 'http://search.yahoo.com/mrss/'}
    rows = []
    items = root.findall('.//item')
    for entry in items or root.findall('a:entry', atom):
        title = entry.findtext('title') or entry.findtext('a:title', namespaces=atom) or ''
        link = entry.findtext('link')
        if not link:
            links = entry.findall('a:link', atom)
            link = next((x.get('href') for x in links if x.get('rel', 'alternate') == 'alternate'), '')
        date = stamp(entry.findtext('pubDate') or entry.findtext('a:published', namespaces=atom) or '')
        if not date or not safe_url(link) or (not official and not matches(title, person)):
            continue
        publisher = entry.findtext('source') or source
        rows.append({'id': sha256(link.encode()).hexdigest()[:20], 'title': unescape(title),
                     'url': link, 'published_at': date, 'source': publisher,
                     'kind': 'official' if official else 'news', 'language': 'en'})
    return rows

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls = []; self.feeds = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a' and a.get('href'): self.urls.append(a['href'])
        if tag == 'link' and a.get('type') in ('application/rss+xml', 'application/atom+xml'):
            self.feeds.append(a.get('href', ''))

def discover_official(site, person):
    parser = Links(); parser.feed(fetch(site))
    sources = [{'label': 'وب‌سایت رسمی', 'url': site}]
    rows = []; errors = []
    labels = {'x.com': 'ایکس رسمی', 'twitter.com': 'ایکس رسمی', 'facebook.com': 'فیس‌بوک رسمی', 'instagram.com': 'اینستاگرام رسمی'}
    for link in parser.urls:
        url = urljoin(site, link); host = (urlparse(url).hostname or '').removeprefix('www.')
        if host in labels and safe_url(url):
            sources.append({'label': labels[host], 'url': url})
    for link in list(dict.fromkeys(parser.feeds))[:2]:
        url = urljoin(site, link)
        if urlparse(url).hostname != urlparse(site).hostname: continue
        try: rows.extend(parse_feed(fetch(url), person, True, 'وب‌سایت رسمی'))
        except Exception as exc: errors.append(type(exc).__name__)
    youtube = [urljoin(site, x) for x in parser.urls if urlparse(urljoin(site, x)).hostname in ('www.youtube.com', 'youtube.com')]
    for url in list(dict.fromkeys(youtube))[:1]:
        if not re.search(r'/(?:channel/|@|user/|c/)', urlparse(url).path): continue
        sources.append({'label': 'یوتیوب رسمی', 'url': url})
        try:
            channel = re.search(r'/channel/(UC[\w-]{22})', url)
            if not channel:
                channel = re.search(r'"(?:externalId|channelId)"\s*:\s*"(UC[\w-]{22})"', fetch(url))
            if channel:
                feed = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channel.group(1)
                rows.extend(parse_feed(fetch(feed), person, True, 'یوتیوب رسمی'))
        except Exception as exc: errors.append(type(exc).__name__)
    return rows, sources, errors

def merge_rows(old, new):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    by_id = {}
    for r in old + new:
        if r.get('published_at', '') >= cutoff:
            by_id[r['id']] = {**by_id.get(r['id'], {}), **r}
    titles = set(); result = []
    for row in sorted(by_id.values(), key=lambda r: r['published_at'], reverse=True):
        key = norm(row['title'].rsplit(' - ', 1)[0])
        if key in titles: continue
        titles.add(key); result.append(row)
    return result[:40]

def collect(person, previous):
    old = previous.get(person['handle'], {})
    now = datetime.now(timezone.utc).isoformat()
    news = []; official = []; errors = []; sources = []
    query = '(' + ' OR '.join('"' + x + '"' for x in person['aliases']) + ') (' + ' OR '.join(person['context']) + ') when:30d'
    news_url = 'https://news.google.com/rss/search?' + urlencode({'q': query, 'hl': 'en-US', 'gl': 'US', 'ceid': 'US:en'})
    news_ok = False
    try:
        news = parse_feed(fetch(news_url), person); news_ok = True
    except Exception as exc: errors.append('news: ' + type(exc).__name__)
    for site in person.get('official_sites', []):
        try:
            found, links, failures = discover_official(site, person)
            official.extend(found); sources.extend(links); errors.extend(failures)
        except Exception as exc:
            sources.append({'label': 'وب‌سایت رسمی', 'url': site})
            errors.append('official: ' + type(exc).__name__)
    sources = list({r['url']: r for r in old.get('sources', []) + sources}.values())
    return person['handle'], {'news': merge_rows(old.get('news', []), news),
        'official': merge_rows(old.get('official', []), official), 'sources': sources,
        'checked_at': now, 'news_updated_at': now if news_ok else old.get('news_updated_at'),
        'errors': errors}

def translate_titles(people, provider):
    cache = {r['title']: r['title_fa'] for p in people.values() for kind in ('news', 'official') for r in p[kind] if r.get('title_fa')}
    pending = list(dict.fromkeys(r['title'] for p in people.values() for kind in ('news', 'official') for r in p[kind] if r['title'] not in cache))
    for start in range(0, len(pending), 35):
        batch = pending[start:start + 35]
        try:
            result = provider.generate(system='Translate news headlines into accurate natural Persian. Preserve attribution, allegations, uncertainty, names and numbers. Do not add facts. Remove trailing publisher names. Return JSON {"titles": [{"id": integer, "title_fa": string}]}.',
                user=json.dumps([{'id': i, 'title': title} for i, title in enumerate(batch)], ensure_ascii=False), context={})
            for row in result.data.get('titles', []):
                i = row.get('id'); fa = row.get('title_fa', '')
                if isinstance(i, int) and 0 <= i < len(batch) and isinstance(fa, str) and re.search(r'[\u0600-\u06ff]', fa):
                    cache[batch[i]] = fa.strip()
        except Exception as exc:
            print('Headline translation deferred:', type(exc).__name__)
    for person in people.values():
        for kind in ('news', 'official'):
            for row in person[kind]:
                if row['title'] in cache:
                    row['title_fa'] = cache[row['title']]
                    row['title_original'] = row['title']

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', required=True); args = ap.parse_args()
    out = Path(args.out)
    try: previous = json.loads(out.read_text()).get('people', {})
    except (OSError, ValueError): previous = {}
    people = json.loads(REGISTRY.read_text())['people']
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = dict(pool.map(lambda p: collect(p, previous), people))
    if os.environ.get('AI_API_KEY'):
        sys.path.insert(0, str(ROOT))
        from app.ai.providers import get_provider
        provider = get_provider()
        if provider.name != 'mock': translate_titles(results, provider)
    payload = {'updated_at': datetime.now(timezone.utc).isoformat(), 'people': results}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(f"Collected {sum(len(p['news']) for p in results.values())} news, {sum(len(p['official']) for p in results.values())} official items for {len(results)} candidates")

if __name__ == '__main__': main()
