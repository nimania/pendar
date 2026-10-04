"""Bounded public catalog/classifieds adapters. No accounts or contact data."""
from __future__ import annotations
import json
import re
import time
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
try:
    from scripts.book_radar import identity, norm
except ModuleNotFoundError:
    from book_radar import identity, norm


def person(name, role='نویسنده'):
    return {'slug': 'person-' + identity(name, '')[6:], 'name_fa': name, 'role_fa': role}


def publisher(name):
    return {'slug': 'publisher-' + identity(name, '')[6:], 'name_fa': name} if name else None


def decode_rpc(text):
    # Workers return either ordinary JSON or MCP's SSE envelope.
    messages = [line[5:].strip() for line in text.splitlines() if line.startswith('data:')]
    for raw in messages or [text]:
        message = json.loads(raw)
        if 'result' in message or 'error' in message:
            if message.get('error') or message.get('result', {}).get('isError'):
                raise ValueError('public MCP source unavailable')
            result = message['result']
            if 'structuredContent' in result:
                return result['structuredContent']
            for c in result.get('content', []):
                if c.get('type') == 'text':
                    return json.loads(c['text'])
    raise ValueError('MCP response missing result')


class PublicMCP:
    def __init__(self, endpoint):
        self.endpoint, self.last_call = endpoint, 0

    def call(self, tool, arguments):
        gap = 3.2 - (time.monotonic() - self.last_call)
        if gap > 0:
            time.sleep(gap)
        self.last_call = time.monotonic()
        response = requests.post(self.endpoint, json={'jsonrpc': '2.0', 'id': 1,
            'method': 'tools/call', 'params': {'name': tool, 'arguments': arguments}},
            headers={'Accept': 'application/json, text/event-stream'}, timeout=(8, 28))
        response.raise_for_status()
        if len(response.content) > 2500000:
            raise ValueError('MCP response too large')
        return decode_rpc(response.text)


def digikala(shelves, source):
    out = []
    for kind, data in shelves.items():
        if data.get('low_confidence') or data.get('unmatched_terms') or data.get('query_used') != 'کتاب':
            raise ValueError('search scope not applied')
        for pos, b in enumerate(data.get('items', [])[:20], 1):
            raw = b.get('title', '')
            # Explicit single-work product titles only; bundles have no work identity.
            if re.search(r'مجموعه|بسته|جلدی|جلد[ی ]*\d', raw):
                continue
            m = re.fullmatch(r'کتاب\s+(.+?)\s+اثر\s+(.+)', raw)
            if not m or not str(b.get('url', '')).startswith('https://www.digikala.com/product/dkp-'):
                continue
            title, tail = m.groups()
            parts = re.split(r'\s+(ترجمه|انتشارات|نشر)\s+', tail, maxsplit=1)
            author = parts[0].strip()
            if not author:
                continue
            creators, pub = [person(author)], None
            if len(parts) == 3:
                role, name = parts[1:]
                if role == 'ترجمه':
                    tr = re.split(r'\s+(?:انتشارات|نشر)\s+', name, maxsplit=1)
                    creators.append(person(tr[0], 'مترجم'))
                    pub = publisher(tr[1]) if len(tr) > 1 else None
                else:
                    pub = publisher(name)
            out.append({'title_fa': title, 'author': author, 'creators': creators, 'publisher': pub,
                'cover_url': '', 'url': b['url'], 'format': 'print', 'source_id': source['id'],
                'source_name': source['name_fa'], 'kind': kind, 'position': pos,
                'list_label': 'پرفروش‌های جست‌وجوی «کتاب»' if kind == 'bestseller' else 'جدیدترین‌های جست‌وجوی «کتاب»',
                'list_url': source['url'],
                'rating': b.get('rating_stars'), 'rating_count': b.get('rating_count'),
                'price': b.get('price_toman'), 'currency': 'IRT',
                'availability': 'in_stock' if b.get('in_stock') is True else 'out_of_stock' if b.get('in_stock') is False else 'unknown'})
    if not out:
        raise ValueError('single-work book search empty')
    return out


def fidibo(html, source):
    soup = BeautifulSoup(html, 'html.parser')
    roots = []
    for script in soup.find_all('script'):
        text = script.string or script.get_text()
        for m in re.finditer(r'window\.(?:categoryContext|homeContext)\s*=\s*', text):
            value, _ = json.JSONDecoder().raw_decode(text[m.end():])
            roots.append(value)
    def groups(node):
        if isinstance(node, dict):
            if str(node.get('component', '')).startswith('HL_BOOKS'):
                yield node
            else:
                for value in node.values():
                    yield from groups(value)
        elif isinstance(node, list):
            for value in node:
                yield from groups(value)
    out = []
    for root in roots:
        for g in groups(root):
            label = g.get('title', '')
            kind = 'bestseller' if 'پرفروش' in label else 'new_to_store' if 'تازه' in label else None
            if not kind:
                continue
            for pos, b in enumerate(g.get('items', [])[:20], 1):
                author, narrator = b.get('subtitle', ''), b.get('narrator', '')
                # Subtitle can be the narrator. Omit uncertain work identity.
                if not author or (narrator and norm(author) == norm(narrator)):
                    continue
                path = (b.get('action') or {}).get('web_url', '')
                if not re.match(r'^/book/\d+', path) or not b.get('title'):
                    continue
                creators = [person(author)]
                if narrator:
                    creators.append(person(narrator, 'گوینده'))
                pub_path = (b.get('footerTextAction') or {}).get('web_url', '')
                pm = re.fullmatch(r'/publishers/\d+-(.+)', pub_path)
                pub = publisher(pm[1].replace('-', ' ')) if pm else None
                cover = (b.get('cover') or {}).get('image', '')
                if not re.fullmatch(r'https://cdn\.fidibo\.com/phoenixpub/content/[\w-]+/[\w-]+\.(?:jpg|png|webp)', cover):
                    cover = ''
                out.append({'title_fa': b['title'], 'author': author, 'creators': creators, 'publisher': pub,
                    'cover_url': cover, 'url': urljoin(source['url'], path),
                    'format': 'audio' if b.get('content_type') == 'audiobook' else 'ebook',
                    'source_id': source['id'], 'source_name': source['name_fa'], 'kind': kind,
                    'position': pos, 'list_label': label,
                    'list_url': urljoin(source['url'], (g.get('action') or {}).get('web_url') or source['url']),
                    'rating': (b.get('rate') or {}).get('score'), 'rating_count': (b.get('rate') or {}).get('responses'),
                    'price': b.get('price'), 'currency': 'IRT'})
    if not out:
        raise ValueError('Fidibo recognized shelves empty')
    return out


def classified_group(data, query, now, slug=None):
    if data.get('filters_not_applied', {}).get('category') or data.get('category_note'):
        raise ValueError('book category not applied')
    rows = []
    for item in data.get('items', [])[:12]:
        url = item.get('url', '')
        if not re.fullmatch(r'https://divar\.ir/v/[A-Za-z0-9_-]+', url):
            continue
        price = item.get('price_toman')
        reliable = not item.get('price_is_placeholder') and not item.get('negotiable') and isinstance(price, (int, float)) and price > 0
        rows.append({'token': item.get('token'), 'title_fa': item.get('title'), 'url': url,
            'asking_price_toman': price if reliable else None,
            'price_label_fa': 'قیمت اعلامی آگهی' if reliable else 'قیمت نیازمند بررسی' if item.get('price_is_placeholder') else 'توافقی / نامشخص',
            'city': item.get('city'), 'observed_at': now.isoformat(), 'condition': 'unknown'})
    return {'query': query, 'book_slug': slug, 'observed_at': now.isoformat(), 'items': rows}
