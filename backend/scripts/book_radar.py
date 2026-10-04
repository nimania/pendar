"""Direct book discovery, daily evidence, and edition-safe catalog overlays.

Scores describe visibility in monitored store shelves, never national sales.
No review of a full book is generated from a title or a marketing blurb.
"""
from __future__ import annotations
import copy
import hashlib
from datetime import datetime, timezone, timedelta


def norm(value):
    return ' '.join(str(value or '').replace('ي', 'ی').replace('ك', 'ک').replace('‌', ' ').split()).lower()


def identity(title, author):
    # A same-title book with a different author is a different work.
    return 'radar-' + hashlib.sha1((norm(title) + '|' + norm(author)).encode()).hexdigest()[:12]


def person_profile_allowed(name):
    # Existing user exclusion applies to person pages, not book coverage.
    compact = norm(name).replace(' ', '').replace('ـ', '').replace('\u200d', '')
    return not any(token in compact for token in ('خمینی', 'خامنهای', 'پهلوی'))


def stamp(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def daily_history(previous, incoming, now):
    cutoff = now - timedelta(days=90)
    rows = {}
    for row in list(previous or []) + list(incoming or []):
        dt = stamp(row.get('observed_at'))
        if not dt or not cutoff <= dt <= now:
            continue
        key = (row['slug'], row['source_id'], row['kind'], row['format'], row.get('list_label', ''), dt.date().isoformat())
        if key not in rows or row['observed_at'] > rows[key]['observed_at']:
            rows[key] = row
    return sorted(rows.values(), key=lambda r: (r['observed_at'], r['slug']))


def indicators(slug, history, now):
    rows = [r for r in history if r['slug'] == slug]
    latest = {}
    for row in rows:
        key = (row['source_id'], row['kind'], row['format'], row.get('list_label', ''))
        if key not in latest or row['observed_at'] > latest[key]['observed_at']:
            latest[key] = row
    active = [r for r in latest.values() if (dt := stamp(r['observed_at'])) and timedelta(0) <= now-dt <= timedelta(days=2)]
    # One provider gets at most one contribution, even with audio + ebook.
    source_scores = {}
    for r in active:
        weight = (3 if r['kind'] == 'bestseller' else 1) / (1 + max(0, r['position']-1)/10)
        source_scores[r['source_id']] = max(weight, source_scores.get(r['source_id'], 0))
    comparisons = []
    for row in active:
        if row['kind'] != 'bestseller':
            continue
        old = [r for r in rows if (r['source_id'], r['kind'], r['format'], r.get('list_label', '')) == (row['source_id'], row['kind'], row['format'], row.get('list_label', '')) and (dt := stamp(r['observed_at'])) and timedelta(days=7) <= now-dt <= timedelta(days=10)]
        if old:
            baseline = max(old, key=lambda r: r['observed_at'])
            comparisons.append({'source': row['source_name'], 'format': row['format'], 'change': baseline['position']-row['position'], 'from': baseline['observed_at'], 'to': row['observed_at']})
    return {'score': round(sum(source_scores.values()) + max(0, len(source_scores)-1), 2), 'source_count': len(source_scores), 'signals': active, 'weekly_changes': comparisons, 'history_days': len({r['observed_at'][:10] for r in rows})}


def rebuild_graph(payload):
    people, publishers = {}, {}
    for b in payload.get('books', []):
        for e in [b] + list(b.get('editions') or []):
            for c in e.get('creators') or []:
                if not c.get('slug') or not person_profile_allowed(c.get('name_fa')):
                    continue
                p = people.setdefault(c['slug'], {'slug': c['slug'], 'name_fa': c['name_fa'], 'roles_fa': [], 'book_slugs': []})
                if c.get('role_fa') and c['role_fa'] not in p['roles_fa']:
                    p['roles_fa'].append(c['role_fa'])
                if b['slug'] not in p['book_slugs']:
                    p['book_slugs'].append(b['slug'])
            pub = e.get('publisher') or {}
            if pub.get('slug'):
                p = publishers.setdefault(pub['slug'], {'slug': pub['slug'], 'name_fa': pub['name_fa'], 'book_slugs': [], 'categories_fa': []})
                if b['slug'] not in p['book_slugs']:
                    p['book_slugs'].append(b['slug'])
                if b.get('category_fa') and b['category_fa'] not in p['categories_fa']:
                    p['categories_fa'].append(b['category_fa'])
    payload['people'], payload['publishers'] = list(people.values()), list(publishers.values())


def attach_radar(target, source):
    """Keep independent discoveries when news/press rebuild a smaller catalog."""
    incoming = source.get('radar') or {}
    current = target.get('radar') or {}
    if not incoming:
        return target
    newer = str(incoming.get('updated_at') or '') >= str(current.get('updated_at') or '')
    books = {b['slug']: b for b in target.get('books', [])}
    for row in source.get('books', []):
        if not row.get('radar'):
            continue
        old = books.get(row['slug'])
        if not old:
            books[row['slug']] = copy.deepcopy(row)
        elif newer:
            commerce = {k: old[k] for k in ('torob',) if old.get(k)}
            mentions = old.get('mentions') or row.get('mentions') or []
            old.update(copy.deepcopy(row))
            old.update(commerce)
            old['mentions'], old['mention_count'] = mentions, len(mentions)
    target['books'] = list(books.values())
    if newer:
        target['radar'] = copy.deepcopy(incoming)
    rebuild_graph(target)
    return target
