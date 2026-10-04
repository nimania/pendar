"""Durable editorial covers and structured, edition-aware commerce links."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote, urlparse

CURATION = Path(__file__).resolve().parents[2] / 'web-static/data/book-curation.json'
FORMATS = {'print': 'چاپی', 'ebook': 'الکترونیکی', 'audio': 'صوتی', 'multi': 'نسخه‌های مختلف'}


def safe_url(url):
    parsed = urlparse(str(url or ''))
    return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username


def discovery_links(book):
    # Searches are explicitly discovery links, never evidence of availability.
    english = str(book.get('language') or book.get('source_lang') or '').startswith('en')
    title = book.get('title_en') or book.get('original_title') if english else book.get('title_fa')
    creator = next((c.get('name_fa') for c in book.get('creators', []) if c.get('name_fa')), '')
    q = quote(str(title or '') + (' ' + creator if creator and not english else ''))
    if english:
        stores = [('Amazon', 'https://www.amazon.com/s?k=', 'multi'),
                  ('Google Books', 'https://books.google.com/books?q=', 'ebook'),
                  ('Kobo', 'https://www.kobo.com/search?query=', 'multi'),
                  ('Barnes & Noble', 'https://www.barnesandnoble.com/s/', 'multi')]
    else:
        stores = [('دیجی‌کالا', 'https://www.digikala.com/search/?q=', 'print'),
                  ('ایران‌کتاب', 'https://www.iranketab.ir/result/', 'print'),
                  ('۳۰بوک', 'https://www.30book.com/search?q=', 'print'),
                  ('شهر کتاب آنلاین', 'https://shahreketabonline.com/all-products?name=', 'print'),
                  ('طاقچه', 'https://taaghche.com/search?q=', 'multi'),
                  ('فیدیبو', 'https://fidibo.com/search?q=', 'multi'),
                  ('کتابراه', 'https://www.ketabrah.ir/search?q=', 'multi')]
    return [{'store': store, 'url': base + q, 'format': fmt,
             'format_fa': FORMATS[fmt], 'exact': False, 'link_type': 'search',
             'price': None, 'currency': None, 'availability': 'unknown',
             'last_checked': None} for store, base, fmt in stores]


def normalize_link(link):
    row = dict(link)
    text = str(row.get('format_fa') or '')
    fmt = row.get('format') or ('ebook' if 'الکترونیک' in text else 'audio' if 'صوتی' in text else 'print')
    row['format'] = fmt
    row.setdefault('link_type', 'product' if row.get('exact') else 'search')
    row.setdefault('price', None)
    row.setdefault('currency', None)
    row.setdefault('availability', 'unknown')
    row.setdefault('last_checked', None)
    return row


def apply_curation(book, registry=None):
    if registry is None:
        registry = json.loads(CURATION.read_text(encoding='utf-8')) if CURATION.exists() else {}
    editorial = (registry.get('books') or {}).get(book.get('slug'), {})
    for key in ('cover_url', 'cover', 'isbn', 'publisher_url'):
        if key in editorial:
            book[key] = editorial[key]
    links = list(book.get('purchase_links') or []) + list(editorial.get('purchase_links') or [])
    # Prefer curated verified product entries; dedupe by destination, not store
    # (a store may have separate ebook and audio editions).
    out = {}
    for link in links:
        if safe_url(link.get('url')) and link.get('exact'):
            out[link['url']] = normalize_link(link)
    book['purchase_links'] = list(out.values())
    book['discovery_links'] = discovery_links(book)
    for edition in book.get('editions') or []:
        edition['purchase_links'] = [normalize_link(x) for x in edition.get('purchase_links', []) if safe_url(x.get('url'))]
    book.setdefault('language', 'fa')
    return book


def curate_payload(payload):
    registry = json.loads(CURATION.read_text(encoding='utf-8')) if CURATION.exists() else {}
    for book in payload.get('books') or []:
        apply_curation(book, registry)
    return payload
