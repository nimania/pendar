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
