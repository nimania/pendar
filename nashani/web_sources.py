"""Strict date-verified intake for the two user-supplied Kerman news websites.

Only article pages on approved hosts/paths. A dated listing or updated homepage
NEVER counts as evidence that an individual story is fresh.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import html
import json
import re
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

TEHRAN = timezone(timedelta(hours=3, minutes=30))
HOSTS = {
    "kerna.ir": ("/news/",),
    "www.kerna.ir": ("/news/",),
    "www.irib-news.ir": ("/fa/news/",),
    "irib-news.ir": ("/fa/news/",),
}
MONTHS = (
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
)
DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
JALALI = re.compile(
    r"(?:^|[^\w])(\d{1,2})\s+(" + "|".join(MONTHS)
    + r")\s+(1[34]\d{2})\b"
)
SLASH_DATE = re.compile(r"\b(1[34]\d{2})[/.-](\d{1,2})[/.-](\d{1,2})\b")
CLOCK = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")


def jalali_to_gregorian(jy, jm, jd):
    """Convert a validated Solar Hijri date to a Gregorian (y, m, d) tuple."""
    if not (1300 <= jy <= 1499 and 1 <= jm <= 12 and
            1 <= jd <= (31 if jm <= 6 else 30 if jm <= 11 else 30)):
        raise ValueError("Invalid Jalali date")
    jy += 1595
    days = (-355668 + 365 * jy + (jy // 33) * 8 +
            ((jy % 33) + 3) // 4 + jd +
            (31 * (jm - 1) if jm < 7 else 186 + 30 * (jm - 7)))
    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        gy += 100 * ((days - 1) // 36524)
        days = (days - 1) % 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1
    leap = gy % 4 == 0 and (gy % 100 != 0 or gy % 400 == 0)
    lengths = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    for month, length in enumerate(lengths, 1):
        if gd <= length:
            return gy, month, gd
        gd -= length
    raise ValueError("Invalid converted date")


def parse_article_time(raw):
    """Accept ISO publish times or explicit Jalali dates; reject ambiguous dates."""
    raw = html.unescape(str(raw or "")).translate(DIGITS).strip()
    if not raw:
        return None
    try:
        iso = raw.replace("Z", "+00:00")
        if re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:[+-]\d\d:\d\d)?", iso):
            result = datetime.fromisoformat(iso)
            if result.tzinfo is None:
                result = result.replace(tzinfo=TEHRAN)
            return result.astimezone(timezone.utc)
    except ValueError:
        pass
    m = JALALI.search(raw)
    if m:
        day, month, year = int(m[1]), MONTHS.index(m[2]) + 1, int(m[3])
    else:
        m = SLASH_DATE.search(raw)
        if not m:
            return None
        year, month, day = map(int, m.groups())
    try:
        y, mo, d = jalali_to_gregorian(year, month, day)
        clock = CLOCK.search(raw[m.end():m.end() + 80])
        if not clock:
            # Date-only articles cannot be safely placed in a five-hour window.
            return None
        dt = datetime(y, mo, d, int(clock[1]), int(clock[2]), tzinfo=TEHRAN)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def is_allowed_article(url):
    parsed = urlsplit(url)
    return (parsed.scheme == "https" and parsed.username is None and
            parsed.password is None and parsed.hostname in HOSTS and
            any(parsed.path.lower().startswith(prefix)
                for prefix in HOSTS.get(parsed.hostname, ())))


def get_html(url, timeout=18):
    req = Request(url, headers={"User-Agent": "NashaniKermanRadar/1.0"})
    with urlopen(req, timeout=timeout) as response:
        # Never trust a redirect outside our allowed sites.
        end_url = response.geturl()
        original_host = urlsplit(url).hostname
        if urlsplit(end_url).hostname != original_host:
            raise ValueError("Unexpected redirect to another host")
        return BeautifulSoup(response.read(1_000_000), "html.parser")


def published_at(soup):
    # Article metadata is preferred; never use the clock at the top of a listing.
    for field in ({"property": "article:published_time"},
                  {"name": "datePublished"}, {"itemprop": "datePublished"}):
        node = soup.find("meta", attrs=field)
        if node:
            parsed = parse_article_time(node.get("content"))
            if parsed:
                return parsed
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.string or script.get_text())
        except (ValueError, TypeError):
            continue
        def find_date(value):
            if isinstance(value, dict):
                if value.get("datePublished"):
                    return parse_article_time(value["datePublished"])
                return next((t for child in value.values()
                             if (t := find_date(child)) is not None), None)
            if isinstance(value, list):
                return next((t for child in value
                             if (t := find_date(child)) is not None), None)
            return None
        date = find_date(payload)
        if date:
            return date
    # Kerna presents "7 آبان 1405" and "19:05" near the article header.
    heading = soup.select_one("h1")
    if not heading:
        return None
    for parent in list(heading.parents)[:3]:
        txt = parent.get_text(" ", strip=True)[:1200]
        date = parse_article_time(txt)
        if date:
            return date
    # No article-level date: fail closed.
    return None


def article_title(soup):
    h = soup.select_one("h1")
    return h.get_text(" ", strip=True) if h else ""


def article_excerpt(soup, title):
    for node in soup.select(
            '[itemprop="articleBody"] p, .news-body p, .news-content p, '
            '.article-content p, article p, .newsText p'):
        candidate = node.get_text(" ", strip=True)
        if len(candidate) >= 45 and candidate != title:
            return candidate[:700]
    # Some news sites render their lead as an independent meta description.
    desc = soup.find("meta", attrs={"name": "description"})
    value = desc.get("content", "") if desc else ""
    return value[:700] if len(value) >= 35 else ""


def website_posts(source, max_articles=12):
    homepage = source["url"]
    page = get_html(homepage)
    found = []
    unique = set()
    for link in page.select("a[href]"):
        url = urljoin(homepage, link.get("href", ""))
        if not is_allowed_article(url) or url in unique:
            continue
        unique.add(url)
        found.append(url)
        if len(found) >= max_articles:
            break
    output = []
    for url in found:
        try:
            article = get_html(url)
            published = published_at(article)
            title = article_title(article)
            excerpt = article_excerpt(article, title)
            if not published or not title or not excerpt:
                continue
            output.append({
                "url": url,
                "source_post_id": urlsplit(url).path.rstrip("/").split("/")[-1],
                "title": title,
                "excerpt": excerpt,
                "paragraphs": [excerpt],
                "published_at": published.isoformat(),
                "media": None,  # Website visuals need separate verified permissions.
                "source": source["name"],
                "source_handle": source["handle"],
            })
        except (ValueError, TimeoutError, OSError):
            continue
    return output
