"""Conservative parsers for public book-distributor feeds."""
from __future__ import annotations
import re
from bs4 import BeautifulSoup

def parse_telegram_distributor(html, source, person, identity):
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for pos, msg in enumerate(soup.select(".tgme_widget_message_wrap")[-40:][::-1], 1):
        node = msg.select_one(".tgme_widget_message_text")
        if not node:
            continue
        text = node.get_text("\n", strip=True)
        author = re.search(r"(?:نویسنده|نويسنده)\s*[:：]?\s*([^\n|]+)", text)
        if not author:
            continue
        publisher = re.search(r"(?:ناشر|انتشارات)\s*[:：]?\s*([^\n|]+)", text)
        translator = re.search(r"(?:مترجم|ترجمه)\s*[:：]?\s*([^\n|]+)", text)
        pages = re.search(r"(\d{2,4})\s*صفحه", text)
        price = re.search(r"(?:قیمت|قيمت)\s*[:：]?\s*([\d.,٬،]+)\s*(هزار\s*)?(?:تومان|ریال)", text)
        lines = [x.strip(" .،-|#") for x in text.splitlines() if x.strip()]
        blocked = ("پخش ", "ناشر", "انتشارات", "نویسنده", "نويسنده", "مترجم", "ترجمه", "قطع", "چاپ", "صفحه", "قیمت", "قيمت", "تاریخ", "instagram", "www.", "http", "@")
        title = next((x for x in lines if 2 <= len(x) <= 180 and not any(x.lower().startswith(b.lower()) for b in blocked)), "")
        if not title:
            continue
        a = author.group(1).strip(" .،-|")
        if not a or len(a) > 120:
            continue
        creators = [person(a)]
        if translator:
            t = translator.group(1).strip(" .،-|")
            if t and t != a and len(t) <= 120:
                creators.append(person(t, "مترجم"))
        pub = None
        if publisher:
            pn = publisher.group(1).strip(" .،-|")
            if pn and len(pn) <= 100:
                pub = {"slug": "publisher-" + identity(pn, "")[6:], "name_fa": pn}
        link = msg.select_one("a.tgme_widget_message_date")
        href = link.get("href", "") if link else ""
        price_value = None
        if price:
            digits = re.sub(r"\D", "", price.group(1))
            if digits:
                price_value = int(digits) * (1000 if price.group(2) else 1)
                if "ریال" in price.group(0):
                    price_value //= 10
        rows.append({
            "title_fa": title,
            "author": a,
            "creators": creators,
            "publisher": pub,
            "pages": int(pages.group(1)) if pages else None,
            "cover_url": "",
            "url": href if href.startswith("https://") else source["url"],
            "format": "print",
            "source_id": source["id"],
            "source_name": source["name_fa"],
            "kind": "distribution",
            "position": pos,
            "list_label": "آخرین معرفی‌های پخش",
            "list_url": source["url"],
            "price": price_value,
            "currency": "IRT",
            "availability": "available",
        })
    if not rows:
        raise ValueError("recognized distributor posts empty")
    return rows


def cheshmeh_catalog(source, max_publishers=240, per_publisher=1000):
    """Fetch Cheshmeh Distribution's public publisher catalog API.

    The API exposes publisher, title, cover, stock, author, translator, topic and
    internal codes. Prices are stored by the upstream service in rials and are
    normalized here to tomans.
    """
    import time
    import requests
    base = source.get("endpoint") or "https://server.cheshmehdis.com/api/v1/main-level/publishers/products"
    session = requests.Session()
    session.headers.update({"User-Agent": "JanKalamBookRadar/1.0 (+https://nimania.github.io/jan-kalam/)"})
    def call(params):
        r = session.get(base, params=params, timeout=(8, 30))
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            raise ValueError("unexpected Cheshmeh catalog response")
        return data
    index = call({"limit": 1, "nocache": 1})
    publishers = index.get("items", [])[:max_publishers]
    rows = []
    for pidx, pub in enumerate(publishers, 1):
        brand_id = pub.get("id")
        if not brand_id:
            continue
        try:
            data = call({"limit": per_publisher, "brand_id": brand_id, "nocache": 1})
        except Exception:
            continue
        groups = data.get("items", [])
        group = next((g for g in groups if str(g.get("id")) == str(brand_id)), None)
        if group is None and len(groups) == 1:
            group = groups[0]
        if not group:
            continue
        publisher_name = (group.get("name") or pub.get("name") or "").strip()
        for pos, item in enumerate(group.get("products") or [], 1):
            title = (item.get("name") or "").strip()
            if not title:
                continue
            author = (item.get("author") or "").strip()
            translator = (item.get("translator") or "").strip()
            creators = []
            if author:
                creators.append({"slug": "person-" + identity(author, "")[6:], "name_fa": author, "role_fa": "نویسنده"})
            if translator:
                creators.append({"slug": "person-" + identity(translator, "")[6:], "name_fa": translator, "role_fa": "مترجم"})
            publisher = {"slug": "publisher-" + identity(publisher_name, "")[6:], "name_fa": publisher_name} if publisher_name else None
            price_rial = item.get("special_price") or item.get("price") or 0
            try:
                price_toman = int(price_rial) // 10 if int(price_rial) > 0 else None
            except (TypeError, ValueError):
                price_toman = None
            try:
                quantity = int(item.get("quantity") or 0)
            except (TypeError, ValueError):
                quantity = 0
            slug = (item.get("slug") or "").strip()
            rows.append({
                "title_fa": title,
                "author": author,
                "creators": creators,
                "publisher": publisher,
                "category_fa": (item.get("main_topic") or "").strip(),
                "cover_url": item.get("intro_image") or "",
                "url": source.get("site_url") or "https://cheshmehdis.com/publishers",
                "source_record_url": base,
                "format": "print",
                "source_id": source["id"],
                "source_name": source["name_fa"],
                "kind": "catalog",
                "position": pos,
                "list_label": publisher_name or "فهرست ناشر",
                "list_url": source.get("site_url") or "https://cheshmehdis.com/publishers",
                "price": price_toman,
                "currency": "IRT",
                "availability": "in_stock" if quantity > 0 else "out_of_stock",
                "stock_quantity": quantity,
                "purchase_exact": False,
                "external_ids": {
                    "cheshmeh_product_id": item.get("id"),
                    "cheshmeh_publish_id": item.get("publish_id"),
                    "cheshmeh_brand_id": item.get("brand_id") or brand_id,
                    "main_code": item.get("main_code"),
                    "system_code": item.get("system_code"),
                    "cheshmeh_slug": slug,
                },
            })
        if pidx % 20 == 0:
            time.sleep(0.2)
    if not rows:
        raise ValueError("Cheshmeh catalog returned no books")
    return rows
