"""Extract brief headlines from public news homepages without a usable RSS.

Only whitelisted publisher pages are supported. This avoids feeding navigation
links, advertisements, article body text or unrelated external websites into
news. No full article text, image bytes, or inferred timestamps are stored.
"""
from __future__ import annotations

import re
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup

from app.ingestion.schemas import NormalizedItem
from app.models.source import Source

# Bartarinha article pages carry /بخش-.../<numeric-id>-<slug>.
_ARTICLE_PATH = re.compile(r"^/بخش-[^/]+/[0-9]{5,}(?:-|$)")


def parse_html_news(raw: str | bytes, source: Source) -> list[NormalizedItem]:
    host = urlsplit(source.homepage_url or source.feed_url).hostname
    if source.name != "برترین‌ها" or host not in {"bartarinha.ir", "www.bartarinha.ir"}:
        raise ValueError("Unsupported public HTML news source")

    soup = BeautifulSoup(raw, "html.parser")
    for tag in soup.select("script, style, nav, footer, header, aside"):
        tag.decompose()

    items: list[NormalizedItem] = []
    seen: set[str] = set()
    for anchor in soup.select("a[href]"):
        url = urljoin(source.homepage_url or source.feed_url, anchor.get("href", ""))
        parts = urlsplit(url)
        if parts.scheme != "https" or (parts.hostname or "").removeprefix("www.") != "bartarinha.ir":
            continue
        if not _ARTICLE_PATH.match(unquote(parts.path)):
            continue
        # Preserve the canonical story path; drop tracking queries / fragments.
        clean_url = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
        if clean_url in seen:
            continue
        title = re.sub(r"\\s+", " ", anchor.get_text(" ", strip=True)).strip()
        if not (15 <= len(title) <= 220):
            continue
        seen.add(clean_url)
        items.append(NormalizedItem(
            title=title,
            article_url=clean_url,
            language="fa",
            description=None,
            published_at=None,  # homepage does not reliably expose per-post timestamps
            image_url=None,
            raw_content=None,
        ))
        if len(items) >= 40:
            break
    return items
