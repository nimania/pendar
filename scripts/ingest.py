"""Fetch small attributed RSS excerpts, retain last good data on errors."""
import argparse, hashlib, html, json, re, sys, urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
NOW = datetime.now(timezone.utc)

def safe_url(value):
    p = urlsplit(value or '')
    if p.scheme not in ('http', 'https') or not p.netloc:
        return ''
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode([(k,v) for k,v in parse_qsl(p.query) if not k.startswith('utm_')]), ''))

def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', value or ''))).strip()

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Pendar/0.1 (+https://nimania.github.io/pendar/)'})
    with urllib.request.urlopen(req, timeout=25) as r:
        raw = r.read(4_000_001)
    if len(raw) > 4_000_000:
        raise ValueError('Feed exceeds size limit')
    return raw

def parse(raw, source):
    root = ET.fromstring(raw)
    if root.tag not in ('rss', '{http://www.w3.org/2005/Atom}feed'):
        raise ValueError('Source is not RSS or Atom')
    result = []
    items = root.findall('.//item')
    for item in items[:20]:
        title = plain(item.findtext('title'))
        url = safe_url(item.findtext('link'))
        if not title or not url:
            continue
        try:
            published = parsedate_to_datetime(item.findtext('pubDate'))
            if published.tzinfo is None:
                published = published.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            continue  # Don't invent publication timestamps.
        if published > NOW:
            continue
        desc = plain(item.findtext('description'))
        excerpt = ' '.join(desc.split()[:28])
        if len(desc.split()) > 28:
            excerpt += '…'
        if not excerpt:
            excerpt = 'این خوراک توضیح کوتاهی ارائه نکرده است؛ متن اصلی در وب‌سایت منبع قابل مطالعه است.'
        result.append(dict(id=hashlib.sha256(url.encode()).hexdigest()[:14], title=title,
            sourceId=source['id'], sourceTitle=source['title'], sourceUrl=url,
            publishedAt=published.isoformat(), fetchedAt=NOW.isoformat(), summary=excerpt,
            language=source['language'], topicIds=source['topicIds'], kind='article'))
    return result[:5 if source['language'] == 'fa' else 3]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture-dir', type=Path)
    args = parser.parse_args()
    sources = json.loads((DATA/'sources.json').read_text())
    path = DATA/'articles.json'
    old = json.loads(path.read_text()) if path.exists() else []
    articles = {x['id']: x for x in old}
    checks = []
    good = 0
    for source in sources:
        try:
            raw = (args.fixture_dir/(source['id']+'.xml')).read_bytes() if args.fixture_dir else fetch(source['feedUrl'])
            items = parse(raw, source)
            if not items:
                raise ValueError('No valid items returned')
            articles.update({x['id']:x for x in items})
            checks.append(dict(sourceId=source['id'], title=source['title'], ok=True,
                itemCount=len(items), latestPublishedAt=max(x['publishedAt'] for x in items)))
            good += 1
        except Exception as error:
            checks.append(dict(sourceId=source['id'], title=source['title'], ok=False, error=type(error).__name__))
    ordered = sorted(articles.values(), key=lambda x:x['publishedAt'], reverse=True)[:80]
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2))
    prior_status = json.loads((DATA/'ingestion.json').read_text()) if (DATA/'ingestion.json').exists() else {}
    status = dict(lastAttemptAt=NOW.isoformat(), lastSuccessAt=NOW.isoformat() if good else prior_status.get('lastSuccessAt'),
        successfulSources=good, sourceCount=len(sources), sources=checks, itemCount=len(ordered),
        schedule='every 6 hours', summarization='attributed-feed-excerpts')
    (DATA/'ingestion.json').write_text(json.dumps(status, ensure_ascii=False, indent=2))
    print(f'{good}/{len(sources)} feeds successful; {len(ordered)} articles stored')
    return 0 if good else 1

if __name__ == '__main__':
    sys.exit(main())
