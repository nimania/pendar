"""Enrich Jan Kalam books with Torob product data.

Uses the public read-only MCP service from mmdju/torob-mcp:
- search_products -> product card, Torob URL, image, cheapest price
- product_details -> seller offers and direct shop URLs

The script is conservative: a Torob result is accepted only when the normalized
book title is present in the returned product name. Dynamic commerce data lives
under book["torob"]; editorial metadata remains untouched.

Merchant images remain candidates. Visually reviewed covers are pinned in the
editorial registry and shipped as repository assets.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
try:
    from scripts.book_catalog import curate_payload
except ModuleNotFoundError:
    from book_catalog import curate_payload

ROOT = Path(__file__).resolve().parent.parent
BOOKS = ROOT / "public" / "data" / "books.json"
BOOKS_JS = ROOT / "public" / "data" / "books.js"
ASSETS = ROOT / "public" / "assets" / "books"
ENDPOINT = os.environ.get("TOROB_MCP_URL", "https://torob-mcp.mmdju3.workers.dev/mcp")
GAP = float(os.environ.get("TOROB_MCP_GAP", "5.5"))
MAX_BOOKS = int(os.environ.get("TOROB_BOOK_LIMIT", "2"))


def norm(s: str | None) -> str:
    x = str(s or "")
    x = x.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک").replace("‌", " ")
    x = re.sub(r"[^0-9A-Za-zآ-ی\s]", " ", x)
    return re.sub(r"\s+", " ", x).strip().lower()


def rpc(method: str, params=None, rid=1):
    body = json.dumps(
        {"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}}
    ).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "content-type": "application/json",
            "accept": "application/json, text/event-stream",
            "user-agent": "JanKalam-Books/1.0 (+https://github.com/nimania/jan-kalam)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            raw = res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        retry = err.headers.get("retry-after")
        raise RuntimeError(f"Torob MCP HTTP {err.code}" + (f"; retry-after={retry}" if retry else "")) from err
    payload = next(
        (line[5:].strip() for line in reversed(raw.splitlines()) if line.startswith("data:")),
        raw,
    )
    return json.loads(payload)


def call(name: str, arguments: dict, rid: int):
    res = rpc("tools/call", {"name": name, "arguments": arguments}, rid=rid)
    time.sleep(GAP)
    result = res.get("result") or {}
    blocks = result.get("content") or []
    text = blocks[0].get("text") if blocks and isinstance(blocks[0], dict) else ""
    if result.get("isError"):
        raise RuntimeError(text or f"Torob MCP tool error: {name}")
    return json.loads(text or "{}")


def _creator_hint(book: dict) -> str:
    people = [c.get("name_fa") for c in book.get("creators") or [] if c.get("name_fa")]
    if not people:
        for edition in book.get("editions") or []:
            for c in edition.get("creators") or []:
                if c.get("name_fa"):
                    people.append(c["name_fa"])
    return people[0] if people else ""


def _choose_product(book: dict, products: list[dict]) -> dict | None:
    title = norm(book.get("title_fa"))
    if not title:
        return None
    title_tokens = [t for t in title.split() if len(t) > 1]
    best = None
    best_score = -1
    for p in products:
        name = norm(p.get("name_fa") or p.get("name_en"))
        if not name:
            continue
        # Hard gate: exact normalized title phrase or every meaningful title token.
        phrase = title in name
        token_hits = sum(1 for t in title_tokens if t in name.split())
        if not phrase and token_hits < max(2, len(title_tokens)):
            continue
        score = (100 if phrase else 0) + token_hits * 10
        creator = norm(_creator_hint(book))
        identities = [norm(c.get('name_fa')) for c in book.get('creators') or []]
        identities += [norm(c.get('name_fa')) for e in book.get('editions') or [] for c in e.get('creators') or []]
        # Montesquieu has two common Persian spellings.
        identities += ['مونتسکیو'] if 'منتسکیو' in identities else []
        publisher = norm((book.get('publisher') or {}).get('name_fa')).removeprefix('نشر ').removeprefix('انتشارات ')
        isbn = re.sub(r'[^0-9X]', '', str(book.get('isbn') or '').upper())
        isbn_hit = bool(isbn and isbn in re.sub(r'[^0-9X]', '', str(p.get('isbn') or p.get('name_fa') or '').upper()))
        creator_hit = any(h and h in name for h in identities)
        publisher_hit = bool(publisher and publisher in name)
        if not isbn_hit and not creator_hit and not publisher_hit:
            continue
        if isbn_hit:
            score += 60
        if creator_hit:
            score += 20
        if p.get("available"):
            score += 3
        if score > best_score:
            best, best_score = p, score
    return best


def _project_offer(o: dict) -> dict:
    return {
        "shop_name": o.get("shop_name"),
        "shop_city": o.get("shop_city"),
        "shop_id": o.get("shop_id"),
        "shop_score": o.get("shop_score"),
        "shop_votes": o.get("shop_votes"),
        "price_toman": o.get("price_toman"),
        "price_text": o.get("price_text"),
        "was_price_text": o.get("was_price_text"),
        "available": bool(o.get("available")),
        "price_unreliable": bool(o.get("price_unreliable")),
        "free_shipping": bool(o.get("free_shipping")),
        "payment_on_delivery": bool(o.get("payment_on_delivery")),
        "same_day_delivery": bool(o.get("same_day_delivery")),
        "postage_text": o.get("postage_text"),
        "delivered_price_toman": o.get("delivered_price_toman"),
        "last_price_change_date": o.get("last_price_change_date"),
        "url": o.get("url"),
    }


def enrich() -> dict:
    if not BOOKS.exists():
        raise SystemExit("books.json does not exist")
    payload = curate_payload(json.loads(BOOKS.read_text(encoding="utf-8")))
    books = payload.get("books") or []
    rid = 10

    # Initialize the stateless Streamable HTTP MCP endpoint once per run.
    rpc(
        "initialize",
        {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "jankalam-books", "version": "1.0.0"},
        },
        rid=1,
    )
    rpc("notifications/initialized", {}, rid=2)
    time.sleep(GAP)

    done = matched = 0
    # Fill missing commerce first. Once all books have Torob data, refresh the
    # oldest checked rows first so prices naturally rotate without bursts.
    def priority(book):
        torob=book.get("torob") or {}
        return (0 if not torob.get('checked_at') else 1, str(torob.get('checked_at') or ''))
    queue=sorted(books, key=priority)
    for book in queue:
        if done >= MAX_BOOKS:
            break
        title = str(book.get("title_fa") or "").strip()
        if not title:
            continue
        creator = _creator_hint(book)
        queries = [f"کتاب {title} {creator}".strip(), f"کتاب {title}"]
        search = None
        product = None
        search_failed = False
        for query in queries:
            try:
                search = call(
                    "search_products",
                    {"query": query, "sort": "popularity", "limit": 8},
                    rid=rid,
                )
                rid += 1
            except Exception as exc:
                print(f"search failed for {title}: {exc}")
                search_failed = True
                search = None
                break
            products = (search or {}).get("products") or []
            product = _choose_product(book, products)
            if product:
                break

        done += 1
        if not product:
            # A bot challenge/network failure is not evidence that a previous
            # match disappeared. Preserve the last known commerce snapshot.
            if not search_failed and not (book.get("torob") or {}).get("matched"):
                book["torob"] = {
                    "matched": False,
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                    "query": (search or {}).get("query") if search else queries[-1],
                }
            continue

        detail_args = {
            "prk": product.get("prk"),
            "max_offers": 12,
            "max_in_person": 5,
        }
        if product.get("details_url"):
            detail_args["details_url"] = product["details_url"]
        try:
            details = call("product_details", detail_args, rid=rid)
            rid += 1
            offers_checked_at = datetime.now(timezone.utc).isoformat()
        except Exception as exc:
            print(f"details failed for {title}: {exc}")
            details = {}
            # Keep the previous seller list when only the detail call fails.
            previous=(book.get("torob") or {})
            offers_checked_at = None
            if previous.get("matched") and previous.get("prk") == product.get("prk") and previous.get("offers"):
                offers_checked_at = previous.get('offers_checked_at') or previous.get('checked_at')
                details={
                    "offers": previous.get("offers") or [],
                    "offer_count": previous.get("offer_count"),
                    "price_range_toman": previous.get("price_range_toman"),
                    "price_spread_toman": previous.get("price_spread_toman"),
                    "attribution": previous.get("attribution"),
                }

        offers = [
            _project_offer(o)
            for o in (details.get("offers") or [])
            if o.get("url") and o.get("shop_name")
        ]
        # Available first, then reliable, then price; keep distinct shops.
        offers.sort(
            key=lambda o: (
                not o["available"],
                o["price_unreliable"],
                o["price_toman"] is None,
                o["price_toman"] or 10**18,
            )
        )
        uniq, seen = [], set()
        for o in offers:
            key = norm(o.get("shop_name"))
            if not key or key in seen:
                continue
            seen.add(key)
            uniq.append(o)
            if len(uniq) >= 8:
                break

        # Commerce images are candidates only. Editorial cover replacements
        # require visual review and a record in book-curation.json.

        book["torob"] = {
            "matched": True,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "offers_checked_at": offers_checked_at,
            "match_basis": "title_and_creator_or_publisher_or_isbn",
            "edition_verified": False,
            "prk": product.get("prk"),
            "name_fa": product.get("name_fa"),
            "product_url": product.get("url"),
            "details_url": product.get("details_url"),
            "image_source_url": product.get("image"),
            "price_toman": product.get("price_toman"),
            "price_text": product.get("price_text"),
            "available": bool(product.get("available")),
            "shop_name": product.get("shop_name"),
            "offer_count": details.get("offer_count"),
            "price_range_toman": details.get("price_range_toman"),
            "price_spread_toman": details.get("price_spread_toman"),
            "offers": uniq,
            "attribution": details.get("attribution") or (search or {}).get("attribution") or "Torob",
        }
        matched += 1
        print(f"torob: matched {title} -> {product.get('name_fa')} ({len(uniq)} shops)")

    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    BOOKS.write_text(compact, encoding="utf-8")
    BOOKS_JS.write_text("window.__BOOKS_DATA__=" + compact + ";\n", encoding="utf-8")
    print(f"torob books: checked={done}, matched={matched}")
    return payload


if __name__ == "__main__":
    enrich()
