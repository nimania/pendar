"""Replace retired book pages in the final artifact, after SEO generation."""
from pathlib import Path
import html
import json
from urllib.parse import quote

BASE = 'https://nimania.github.io/pishkhan/'
KINDS = ('books', 'book', 'publisher', 'book-person')

def migrate(site):
    site = Path(site)
    routes = {('books', '')}
    for mode in ('new', 'used', 'reviews', 'people', 'publishers', 'all'):
        routes.add(('books', mode))
    # Include previously published slugs even if absent from the current catalog.
    for kind in KINDS:
        for page in (site / kind).glob('*/index.html'):
            routes.add((kind, page.parent.name))
    catalog = site / 'data/books.json'
    if catalog.exists():
        data = json.loads(catalog.read_text())
        collections = []
        if isinstance(data, dict):
            collections = [
                (data.get('books', []), 'book'),
                (data.get('people', []), 'book-person'),
                (data.get('publishers', []), 'publisher'),
            ]
        elif isinstance(data, list):
            collections = [(data, 'book')]
        for rows, kind in collections:
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                slug = row.get('slug')
                if slug and '/' not in str(slug) and '..' not in str(slug):
                    routes.add((kind, str(slug)))
    for kind, slug in routes:
        target = BASE + ('#/books/' + quote(slug) if kind == 'books' and slug else '' if kind == 'books' else kind + '/' + quote(slug) + '/')
        out = site / kind / slug / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        safe = html.escape(target, quote=True)
        out.write_text('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>پیشخوان کتاب</title><link rel="canonical" href="' + safe + '"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=' + safe + '"></head><body><p>پیشخوان کتاب، زیرپروژه‌ای از پندار، به نشانی مستقل منتقل شده است.</p><a href="' + safe + '">رفتن به پیشخوان کتاب</a></body></html>')
        (out.parent / 'seo.json').unlink(missing_ok=True)
    # Retired Pendar book URLs must not remain in its discovery sitemaps.
    import xml.etree.ElementTree as ET
    ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
    for path in site.glob('*sitemap*.xml'):
        root = ET.fromstring(path.read_text())
        if root.tag != ns + 'urlset':
            continue
        for node in list(root):
            loc = node.find(ns + 'loc')
            if loc is not None and any((loc.text or '').startswith('https://pendar.io/' + kind + '/') for kind in KINDS):
                root.remove(node)
        ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
        ET.ElementTree(root).write(path, encoding='utf-8', xml_declaration=True)
    print(f'Pishkhan: {len(routes)} retired book routes now redirect to the independent site.')

if __name__ == '__main__':
    import sys
    migrate(sys.argv[1])
