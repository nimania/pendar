#!/usr/bin/env python3
"""Build Pendar TV Guide JSON from current machine-readable EPG sources.

The collector is conservative: a source is published only when its current
schedule can be parsed. Planned sources remain visible in the registry but do
not create synthetic programme rows.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from html import unescape
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

PERSIANA_XML = "https://raw.githubusercontent.com/Samhouston010/persiana-tv-epg/main/persiana.xml"
IRIB_XML = "https://raw.githubusercontent.com/Samhouston010/sepehr-irib-epg/main/sepehr.xml"
IRIB_CHANNELS = "https://raw.githubusercontent.com/Samhouston010/sepehr-irib-epg/main/channels.json"
IRANINTL_XML = "https://raw.githubusercontent.com/SandObserver/iranintl-xmltv/main/output/iranintl.xml"
EPGPW_GB_GZ = "https://epg.pw/xmltv/epg_GB.xml.gz"
ARIANA_SCHEDULE = "https://www.arianatelevision.com/program-schedule/"

SOURCE_REGISTRY = [
    {"key": "irib", "name": "صداوسیما / تلوبیون", "status": "aggregated", "note": "EPG جاریِ شبکه‌های سراسری و استانی؛ گردآوری‌شده از APIهای تلوبیون/سپهر"},
    {"key": "persiana", "name": "Persiana Group", "status": "aggregated", "note": "XMLTV جاریِ شبکه‌های گروه پرشیانا"},
    {"key": "bbc-persian", "name": "BBC Persian", "status": "planned", "note": "صفحه رسمی شناسایی شده؛ اتصال ماشینی پایدار هنوز در حال تکمیل است"},
    {"key": "iranintl", "name": "Iran International", "status": "verified", "note": "XMLTV تازه‌شونده، استخراج‌شده از جدول رسمی شبکه"},
    {"key": "radiofarda", "name": "Radio Farda", "status": "official", "note": "جدول پخش روزانهٔ رسمی رادیو فردا"},
    {"key": "gem", "name": "GEM Group", "status": "planned", "note": "نیازمند تطبیق چند منبع"},
    {"key": "afintl", "name": "Afghanistan International", "status": "official", "note": "جدول پخش مستقیم از صفحه رسمی Live شبکه"},
    {"key": "ariana", "name": "Ariana TV", "status": "official", "note": "جدول هفتگی مستقیم از صفحه رسمی Ariana Television"},
    {"key": "tolo", "name": "TOLO TV", "status": "planned", "note": "Schedule رسمی"},
    {"key": "mbc-persia", "name": "MBC Persia", "status": "planned", "note": "زمان‌بندی نیمه‌ساختاریافته"},
]

def fetch(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Pendar-TVGuide/1.1 (+https://nimania.github.io/pendar/)",
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()

def parse_xmltv_time(value: str) -> datetime:
    m = re.match(r"(\d{14})(?:\s*([+-])(\d{2})(\d{2}))?", value or "")
    if not m:
        raise ValueError("bad XMLTV time: %r" % value)
    dt = datetime.strptime(m.group(1), "%Y%m%d%H%M%S")
    if m.group(2):
        mins = int(m.group(3)) * 60 + int(m.group(4))
        if m.group(2) == "-":
            mins = -mins
        dt = dt.replace(tzinfo=timezone(timedelta(minutes=mins)))
    else:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def text_by_lang(node: ET.Element, tag: str, lang: str) -> str:
    for x in node.findall(tag):
        if x.attrib.get("lang") == lang and (x.text or "").strip():
            return (x.text or "").strip()
    x = node.find(tag)
    return (x.text or "").strip() if x is not None else ""

def channel_group(cid: str, name: str, raw_group: str = "") -> str:
    s = (cid + " " + name + " " + raw_group).lower()
    if any(x in s for x in ("sport", "fight", "ورزش", "ورزشی")):
        return "sports"
    if any(x in s for x in ("junior", "kids", "پویا", "نهال", "کودک")):
        return "kids"
    if any(x in s for x in ("خبر", "news", "irinn")):
        return "news"
    if any(x in s for x in ("cinema", "نمایش")):
        return "movies"
    if any(x in s for x in ("series", "turkey", "korea", "آی‌فیلم", "ifilm", "تماشا")):
        return "series"
    if any(x in s for x in ("docs", "documentary", "مستند")):
        return "docs"
    if any(x in s for x in ("music", "folk", "موسیقی")):
        return "music"
    return "general"

def programme_payload(node: ET.Element, channel_id: str, start: datetime, stop: datetime) -> dict:
    title_fa = text_by_lang(node, "title", "fa") or text_by_lang(node, "title", "en") or "بدون عنوان"
    title_en = text_by_lang(node, "title", "en")
    desc_fa = text_by_lang(node, "desc", "fa")
    cats = []
    for c in node.findall("category"):
        val = (c.text or "").strip()
        if val and val not in cats:
            cats.append(val)
    icon_node = node.find("icon")
    rating_node = node.find("star-rating/value")
    return {
        "channel_id": channel_id,
        "start": iso(start),
        "stop": iso(stop),
        "title_fa": title_fa,
        "title_en": title_en or None,
        "desc_fa": desc_fa or None,
        "year": (node.findtext("date") or "").strip() or None,
        "categories": cats[:4],
        "icon": icon_node.attrib.get("src") if icon_node is not None else None,
        "rating": (rating_node.text or "").strip() if rating_node is not None else None,
    }

def ingest_xmltv(
    *,
    key: str,
    name: str,
    url: str,
    confidence: str,
    now: datetime,
    metadata: dict[str, dict] | None = None,
) -> tuple[list[dict], list[dict]]:
    root = ET.fromstring(fetch(url))
    raw_channels: dict[str, dict] = {}

    for node in root.findall("channel"):
        raw_id = (node.attrib.get("id") or "").strip()
        if not raw_id or raw_id.lower() == "podcast":
            continue
        meta = (metadata or {}).get(raw_id, {})
        name_fa = meta.get("name") or text_by_lang(node, "display-name", "fa") or text_by_lang(node, "display-name", "en") or raw_id
        name_en = meta.get("name_en") or text_by_lang(node, "display-name", "en") or name_fa
        if "رادیو" in str(name_fa) or str(meta.get("group", "")).strip() == "رادیویی":
            continue
        icon = node.find("icon")
        logo = meta.get("logo") or (icon.attrib.get("src") if icon is not None else None)
        cid = key + ":" + raw_id
        raw_channels[raw_id] = {
            "id": cid,
            "name_fa": name_fa,
            "name": name_en,
            "logo": logo,
            "group": channel_group(raw_id, name_fa, str(meta.get("group", ""))),
            "source_key": key,
            "source_name": name,
            "confidence": confidence,
        }

    lo, hi = now - timedelta(hours=12), now + timedelta(days=8)
    programmes: list[dict] = []
    used: set[str] = set()

    for node in root.findall("programme"):
        raw_id = (node.attrib.get("channel") or "").strip()
        if raw_id not in raw_channels:
            continue
        try:
            start = parse_xmltv_time(node.attrib.get("start", ""))
            stop = parse_xmltv_time(node.attrib.get("stop", ""))
        except Exception:
            continue
        if stop < lo or start > hi or stop <= start:
            continue
        cid = raw_channels[raw_id]["id"]
        programmes.append(programme_payload(node, cid, start, stop))
        used.add(raw_id)

    channels = [raw_channels[cid] for cid in raw_channels if cid in used]
    programmes.sort(key=lambda x: (x["start"], x["channel_id"]))
    if not channels or not programmes:
        raise RuntimeError(f"{name}: no current EPG rows")
    return channels, programmes

TIME_RANGE_TITLE_RE = re.compile(
    r"^\s*[۰-۹0-9]{1,2}:[۰-۹0-9]{2}\s*[-–—]\s*[۰-۹0-9]{1,2}:[۰-۹0-9]{2}\s*$"
)

GENERIC_JUNK_TITLES = {
    "برنامه", "program", "بدون عنوان", "پخش آنلاین", "زنده"
}

IRIB_JUNK_PREFIXES = (
    "میان برنامه", "میان‌برنامه",
    "آگهی", "پیام بازرگانی", "پیام های بازرگانی", "پیام‌های بازرگانی",
    "آرم ", "آرم‌", "آرم استیشن", "آرم بازرگانی", "آرم تایم",
    "تیزر", "پیش پرده", "پیش‌پرده", "پیش نمایش", "پیش‌نمایش",
    "وله ", "وله‌", "فیلر", "کپشن", "هویت بصری",
    "برنامک", "اعلام برنامه", "تقدیم برنامه",
    "نشان شبکه", "نشان پیام", "اینفو آرم"
)

IRIB_JUNK_EXACT = {"هم اکنون", "آرم", "نشان", "پایان برنامه"}

def normalize_programme_title(title: str) -> str:
    t = re.sub(r"\s+", " ", str(title or "")).strip(" -–—|/")
    t = re.sub(r"^هم\s*اکنون\s*[/:\-]\s*", "", t, flags=re.I)
    t = re.sub(r"\s*[-–—]?\s*تایم\s+تقریبی\s*$", "", t, flags=re.I)
    return t.strip()

def is_junk_programme(p: dict, channel: dict | None = None) -> bool:
    title = normalize_programme_title(p.get("title_fa") or p.get("title_en") or "")
    if not title:
        return True
    low = title.casefold()
    if low in GENERIC_JUNK_TITLES:
        return True
    if TIME_RANGE_TITLE_RE.match(title):
        return True

    source = (channel or {}).get("source_key") or str(p.get("channel_id", "")).split(":", 1)[0]
    channel_name = normalize_programme_title((channel or {}).get("name_fa") or (channel or {}).get("name") or "")

    if source == "iranintl" and channel_name and low == channel_name.casefold() and not p.get("desc_fa"):
        return True
    if source == "radiofarda" and low in {"پخش آنلاین", "زنده"}:
        return True
    if source == "irib":
        if title in IRIB_JUNK_EXACT:
            return True
        if any(title.startswith(prefix) for prefix in IRIB_JUNK_PREFIXES):
            return True
    return False

SOURCE_TRUST_SCORES = {
    "official": 100,
    "verified": 88,
    "aggregated": 72,
    "planned": 0,
}

SOURCE_TRUST_OVERRIDES = {
    "irib": 76,
    "persiana": 74,
    "iranintl": 90,
    "radiofarda": 100,
    "afintl": 100,
    "ariana": 100,
}

MIN_PUBLISH_SCORE = 68
MIN_NOW_SCORE = 74

def source_trust_score(channel: dict | None = None) -> int:
    channel = channel or {}
    key = str(channel.get("source_key") or "")
    if key in SOURCE_TRUST_OVERRIDES:
        return SOURCE_TRUST_OVERRIDES[key]
    return SOURCE_TRUST_SCORES.get(str(channel.get("confidence") or "aggregated"), 0)

def programme_quality_score(p: dict, channel: dict | None = None) -> int:
    if is_junk_programme(p, channel):
        return 0
    title = normalize_programme_title(p.get("title_fa") or p.get("title_en") or "")
    score = source_trust_score(channel)

    if len(title) >= 4:
        score += 4
    if p.get("desc_fa"):
        score += 6
    if p.get("icon"):
        score += 2
    if p.get("categories"):
        score += 2

    try:
        start = parse_iso(p["start"])
        stop = parse_iso(p["stop"])
        minutes = (stop - start).total_seconds() / 60
        if 2 <= minutes <= 360:
            score += 4
        elif minutes < 2 or minutes > 480:
            score -= 50
        if (channel or {}).get("source_key") == "irib" and abs(minutes - 30) < 0.01 and not p.get("desc_fa"):
            score -= 4
    except Exception:
        score -= 50

    return max(0, min(100, int(score)))

def _programme_score(p: dict, channel: dict | None = None) -> int:
    q = programme_quality_score(p, channel)
    if q <= 0:
        return -1000
    title = normalize_programme_title(p.get("title_fa") or p.get("title_en") or "")
    return q * 10 + min(len(title), 50)

def clean_programmes(programmes: list[dict], channels: list[dict]) -> tuple[list[dict], dict]:
    """Remove placeholders and repair overlaps, especially in IRIB data."""
    cmap = {str(c.get("id")): c for c in channels}
    grouped: dict[str, list[dict]] = {}
    for p in programmes:
        grouped.setdefault(str(p.get("channel_id")), []).append(dict(p))

    cleaned: list[dict] = []
    stats = {
        "input": len(programmes),
        "removed_junk": 0,
        "removed_duplicate_start": 0,
        "trimmed_overlap": 0,
        "removed_low_quality": 0,
        "output": 0,
    }

    for cid, rows in grouped.items():
        channel = cmap.get(cid, {})
        source = channel.get("source_key")
        rows.sort(key=lambda p: (p.get("start") or "", -_programme_score(p, channel)))

        unique: list[dict] = []
        i = 0
        while i < len(rows):
            same = [rows[i]]
            j = i + 1
            while j < len(rows) and rows[j].get("start") == rows[i].get("start"):
                same.append(rows[j])
                j += 1
            best = max(same, key=lambda p: _programme_score(p, channel))
            stats["removed_duplicate_start"] += max(0, len(same) - 1)
            unique.append(best)
            i = j

        if source == "irib":
            for idx, p in enumerate(unique[:-1]):
                try:
                    start = parse_iso(p["start"])
                    stop = parse_iso(p["stop"])
                    nxt = parse_iso(unique[idx + 1]["start"])
                    if start < nxt < stop:
                        p["stop"] = iso(nxt)
                        stats["trimmed_overlap"] += 1
                except Exception:
                    pass

        for p in unique:
            p["title_fa"] = normalize_programme_title(p.get("title_fa") or p.get("title_en") or "")
            if is_junk_programme(p, channel):
                stats["removed_junk"] += 1
                continue
            try:
                start = parse_iso(p["start"])
                stop = parse_iso(p["stop"])
                if stop <= start:
                    stats["removed_low_quality"] += 1
                    continue
                duration_minutes = round((stop - start).total_seconds() / 60, 1)
            except Exception:
                stats["removed_low_quality"] += 1
                continue

            quality = programme_quality_score(p, channel)
            if quality < MIN_PUBLISH_SCORE:
                stats["removed_low_quality"] += 1
                continue

            p["quality_score"] = quality
            p["duration_minutes"] = duration_minutes
            p["current_eligible"] = bool(
                quality >= MIN_NOW_SCORE and 2 <= duration_minutes <= 360
            )
            cleaned.append(p)

    cleaned.sort(key=lambda x: (x["start"], x["channel_id"]))
    stats["output"] = len(cleaned)
    return cleaned, stats


def load_irib_metadata() -> dict[str, dict]:
    rows = json.loads(fetch(IRIB_CHANNELS).decode("utf-8-sig"))
    out: dict[str, dict] = {}
    for row in rows if isinstance(rows, list) else []:
        tvg = str(row.get("tvg_id") or "").strip()
        if tvg:
            out[tvg] = row
    return out


FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")

class TextTokens(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tokens: list[str] = []

    def handle_data(self, data: str) -> None:
        for part in re.split(r"[\r\n]+", unescape(data or "")):
            t = re.sub(r"\s+", " ", part).strip()
            if t:
                self.tokens.append(t)

def html_tokens(raw: bytes) -> list[str]:
    p = TextTokens()
    p.feed(raw.decode("utf-8", errors="ignore"))
    return p.tokens

def _local_slot(day, hm: str, tz: ZoneInfo) -> datetime:
    h, m = [int(x) for x in hm.translate(FA_DIGITS).split(":")]
    return datetime(day.year, day.month, day.day, h, m, tzinfo=tz).astimezone(timezone.utc)

def ingest_radiofarda(now: datetime) -> tuple[list[dict], list[dict]]:
    tz = ZoneInfo("Asia/Tehran")
    local_today = now.astimezone(tz).date()
    rx = re.compile(r"^([۰-۹0-9]{1,2}:[۰-۹0-9]{2})\s*-\s*([۰-۹0-9]{1,2}:[۰-۹0-9]{2})(?:\s+زنده)?$")
    programmes: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for off in range(-1, 6):
        day = local_today + timedelta(days=off)
        url = f"https://www.radiofarda.com/tv/schedule/97/{day.year}/{day.month}/{day.day}"
        try:
            tokens = html_tokens(fetch(url))
        except Exception as exc:
            print("WARNING: Radio Farda day", day, "failed:", exc)
            continue
        for i, token in enumerate(tokens):
            m = rx.match(token)
            if not m:
                continue
            title = ""
            desc = ""
            for t in tokens[i + 1 : i + 12]:
                if rx.match(t):
                    break
                if t in {".", ",.", "،", "Image", "XS", "SM", "MD", "LG"}:
                    continue
                if t.startswith("Image"):
                    continue
                if not title:
                    title = t
                elif not desc and len(t) > 12 and t != title:
                    desc = t
                    break
            if not title:
                continue
            start = _local_slot(day, m.group(1), tz)
            stop = _local_slot(day, m.group(2), tz)
            if stop <= start:
                stop += timedelta(days=1)
            key = (iso(start), title)
            if key in seen:
                continue
            seen.add(key)
            programmes.append({
                "channel_id": "radiofarda:tv",
                "start": iso(start),
                "stop": iso(stop),
                "title_fa": title,
                "title_en": None,
                "desc_fa": desc or None,
                "year": None,
                "categories": ["خبر"],
                "icon": None,
                "rating": None,
            })

    lo, hi = now - timedelta(hours=12), now + timedelta(days=8)
    programmes = [p for p in programmes if parse_iso(p["stop"]) >= lo and parse_iso(p["start"]) <= hi]
    programmes.sort(key=lambda x: x["start"])
    if not programmes:
        raise RuntimeError("Radio Farda: no current schedule parsed")
    channel = {
        "id": "radiofarda:tv",
        "name_fa": "رادیو فردا",
        "name": "Radio Farda",
        "logo": None,
        "group": "news",
        "source_key": "radiofarda",
        "source_name": "Radio Farda",
        "confidence": "official",
    }
    return [channel], programmes

def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)

def ingest_ariana(now: datetime) -> tuple[list[dict], list[dict]]:
    """Parse the weekly schedule embedded in Ariana Television's official page."""
    raw = fetch(ARIANA_SCHEDULE).decode("utf-8", errors="ignore")
    match = re.search(
        r'id=["\']jtrt_table_settings_508["\'][^>]*>(.*?)</(?:script|div|textarea)>',
        raw,
        flags=re.I | re.S,
    )
    if not match:
        raise RuntimeError("Ariana TV: embedded schedule JSON not found")
    payload = unescape(match.group(1)).strip()
    data = json.loads(payload)
    if not isinstance(data, list) or not data or not isinstance(data[0], list):
        raise RuntimeError("Ariana TV: invalid schedule JSON")
    rows = list(data[0])
    if rows:
        rows = rows[1:]

    tz = ZoneInfo("Asia/Kabul")
    local_today = now.astimezone(tz).date()
    programmes: list[dict] = []

    for off in range(-1, 7):
        day = local_today + timedelta(days=off)
        # JS Date.day(): Sunday=0 ... Saturday=6. Table columns:
        # time, Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday.
        js_day = (day.weekday() + 1) % 7
        col = js_day + 2
        if col > 7:
            col = 1
        starts: list[tuple[datetime, str]] = []
        current_day = day
        prev_minutes = None
        for row in rows:
            if not isinstance(row, list) or len(row) <= col or not row[0] or not row[col]:
                continue
            hm = re.sub(r"<[^>]+>", "", str(row[0])).strip()
            title = re.sub(r"<[^>]+>", "", unescape(str(row[col]))).strip()
            mt = re.search(r"([0-9]{1,2}):([0-9]{2})", hm.translate(FA_DIGITS))
            if not mt or not title:
                continue
            h, m = int(mt.group(1)), int(mt.group(2))
            minutes = h * 60 + m
            if prev_minutes is not None and minutes + 8 * 60 < prev_minutes:
                current_day += timedelta(days=1)
            dt = datetime(current_day.year, current_day.month, current_day.day, h, m, tzinfo=tz)
            starts.append((dt.astimezone(timezone.utc), title))
            prev_minutes = minutes
        for i, (start, title) in enumerate(starts):
            stop = starts[i + 1][0] if i + 1 < len(starts) else start + timedelta(minutes=30)
            if stop < now - timedelta(hours=12) or start > now + timedelta(days=7):
                continue
            programmes.append({
                "channel_id": "ariana:tv",
                "start": iso(start),
                "stop": iso(stop),
                "title_fa": title,
                "title_en": title,
                "desc_fa": None,
                "year": None,
                "categories": ["ورزش"] if re.search(r"(sport|football|cricket|fifa|cup|league|match)", title, re.I) else [],
                "icon": None,
                "rating": None,
            })

    # Deduplicate overlap caused by entries that wrap after midnight.
    uniq = {}
    for p in programmes:
        uniq[(p["start"], p["title_fa"])] = p
    programmes = sorted(uniq.values(), key=lambda x: x["start"])
    if not programmes:
        raise RuntimeError("Ariana TV: no current schedule rows")
    channel = {
        "id": "ariana:tv",
        "name_fa": "آریانا تلویزیون",
        "name": "Ariana Television",
        "logo": None,
        "group": "general",
        "source_key": "ariana",
        "source_name": "Ariana TV",
        "confidence": "official",
    }
    return [channel], programmes

def ingest_afintl(now: datetime) -> tuple[list[dict], list[dict]]:
    """Parse Afghanistan International's official live now/next schedule."""
    raw = fetch("https://www.afintl.com/live")
    tokens = html_tokens(raw)
    try:
        start_i = tokens.index("جدول پخش")
    except ValueError:
        raise RuntimeError("Afghanistan International: schedule marker not found")

    segment = tokens[start_i + 1 :]
    for marker in ("پخش زنده و سایر برنامه‌های افغانستان اینترنشنال", "برای دسترسی به اطلاعات جامع"):
        for i, t in enumerate(segment):
            if t.startswith(marker):
                segment = segment[:i]
                break

    digit = r"[۰-۹0-9]"
    only_time = re.compile(rf"^({digit}{{1,2}}:{digit}{{2}})$")
    joined = re.compile(rf"^({digit}{{1,2}}:{digit}{{2}})\s*(.+)$")
    ignored = {"در حال پخش", "Live TV", "جدول پخش", "آخرین خبرها"}
    pairs: list[tuple[str, str]] = []

    i = 0
    while i < len(segment):
        token = segment[i].strip()
        m_join = joined.match(token)
        if m_join and m_join.group(2).strip():
            pairs.append((m_join.group(1), m_join.group(2).strip()))
            i += 1
            continue
        m = only_time.match(token)
        if not m:
            i += 1
            continue
        title = ""
        j = i + 1
        while j < min(len(segment), i + 7):
            candidate = segment[j].strip()
            if only_time.match(candidate) or joined.match(candidate):
                break
            if candidate not in ignored and len(candidate) > 1:
                title = candidate
                break
            j += 1
        if title:
            pairs.append((m.group(1), title))
        i = max(i + 1, j)

    if len(pairs) < 5:
        raise RuntimeError(f"Afghanistan International: too few schedule rows ({len(pairs)})")

    tz = ZoneInfo("Asia/Kabul")
    local_now = now.astimezone(tz)
    current_day = local_now.date()
    programmes: list[dict] = []
    starts: list[tuple[datetime, str]] = []
    prev_minutes = None

    for hm, title in pairs:
        ascii_hm = hm.translate(FA_DIGITS)
        h, m = [int(x) for x in ascii_hm.split(":")]
        minutes = h * 60 + m
        if prev_minutes is not None and minutes + 8 * 60 < prev_minutes:
            current_day += timedelta(days=1)
        dt = datetime(current_day.year, current_day.month, current_day.day, h, m, tzinfo=tz)
        if not starts and dt < local_now - timedelta(hours=4):
            dt += timedelta(days=1)
            current_day = dt.date()
        starts.append((dt.astimezone(timezone.utc), title))
        prev_minutes = minutes

    for idx, (start, title) in enumerate(starts):
        stop = starts[idx + 1][0] if idx + 1 < len(starts) else start + timedelta(minutes=30)
        if stop <= now - timedelta(hours=2) or start >= now + timedelta(hours=36):
            continue
        programmes.append({
            "channel_id": "afintl:tv",
            "start": iso(start),
            "stop": iso(stop),
            "title_fa": title,
            "title_en": None,
            "desc_fa": None,
            "year": None,
            "categories": ["خبر ورزشی" if "ورزشی" in title else "خبر"],
            "icon": None,
            "rating": None,
        })

    if not programmes:
        raise RuntimeError("Afghanistan International: no current programme rows")
    channel = {
        "id": "afintl:tv",
        "name_fa": "افغانستان اینترنشنال",
        "name": "Afghanistan International",
        "logo": None,
        "group": "news",
        "source_key": "afintl",
        "source_name": "Afghanistan International",
        "confidence": "official",
    }
    return [channel], programmes

def ingest_bbc_persian(now: datetime) -> tuple[list[dict], list[dict]]:
    """Prefer BBC's official schedule; fall back to a standard XMLTV mirror."""
    time_re = re.compile(r"^(\d{2}):(\d{2})\s+GMT$")
    dur_re = re.compile(r"^(\d{2}):(\d{2}):(\d{2})$")
    programmes: list[dict] = []
    seen: set[tuple[str, str]] = set()
    today = now.date()

    for off in range(-1, 5):
        day = today + timedelta(days=off)
        url = f"https://wspartners.bbc.com/schedules/bbc_persian_tv/day/{day.isoformat()}"
        try:
            tokens = html_tokens(fetch(url))
        except Exception:
            continue
        for i, token in enumerate(tokens):
            mt = time_re.match(token)
            if not mt:
                continue
            block = []
            for t in tokens[i + 1 : i + 28]:
                if time_re.match(t):
                    break
                block.append(t)
            duration = None
            for t in reversed(block):
                md = dur_re.match(t)
                if md:
                    duration = timedelta(hours=int(md.group(1)), minutes=int(md.group(2)), seconds=int(md.group(3)))
                    break
            title = ""
            for t in block:
                if dur_re.match(t):
                    continue
                if t in {"Back to top", "Early", "Morning", "Afternoon", "Evening"}:
                    continue
                if re.match(r"^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}\s+GMT$", t):
                    continue
                if len(t) > 1:
                    title = t
                    break
            if not title or duration is None:
                continue
            start = datetime(day.year, day.month, day.day, int(mt.group(1)), int(mt.group(2)), tzinfo=timezone.utc)
            stop = start + duration
            key = (iso(start), title)
            if key in seen:
                continue
            seen.add(key)
            programmes.append({
                "channel_id": "bbc-persian:tv",
                "start": iso(start),
                "stop": iso(stop),
                "title_fa": title,
                "title_en": None,
                "desc_fa": None,
                "year": None,
                "categories": ["خبر"],
                "icon": None,
                "rating": None,
            })

    confidence = "official"
    if not programmes:
        confidence = "aggregated"
        raw = gzip.decompress(fetch(EPGPW_GB_GZ))
        root = ET.fromstring(raw)
        ids = set()
        for ch in root.findall("channel"):
            names = [" ".join((x.text or "").split()) for x in ch.findall("display-name")]
            if any("bbc persian" in n.lower() for n in names):
                cid = (ch.attrib.get("id") or "").strip()
                if cid:
                    ids.add(cid)
        if not ids:
            raise RuntimeError("BBC Persian: no channel found in fallback EPG")
        lo, hi = now - timedelta(hours=12), now + timedelta(days=5)
        for node in root.findall("programme"):
            raw_id = (node.attrib.get("channel") or "").strip()
            if raw_id not in ids:
                continue
            try:
                start = parse_xmltv_time(node.attrib.get("start", ""))
                stop = parse_xmltv_time(node.attrib.get("stop", ""))
            except Exception:
                continue
            if stop < lo or start > hi or stop <= start:
                continue
            title_fa = text_by_lang(node, "title", "fa")
            title_en = text_by_lang(node, "title", "en") or text_by_lang(node, "title", "")
            title = title_fa or title_en or "BBC Persian"
            key = (iso(start), title)
            if key in seen:
                continue
            seen.add(key)
            desc = text_by_lang(node, "desc", "fa") or text_by_lang(node, "desc", "en")
            programmes.append({
                "channel_id": "bbc-persian:tv",
                "start": iso(start),
                "stop": iso(stop),
                "title_fa": title,
                "title_en": title_en or None,
                "desc_fa": desc or None,
                "year": None,
                "categories": ["خبر"],
                "icon": None,
                "rating": None,
            })

    lo, hi = now - timedelta(hours=12), now + timedelta(days=8)
    programmes = [p for p in programmes if parse_iso(p["stop"]) >= lo and parse_iso(p["start"]) <= hi]
    programmes.sort(key=lambda x: x["start"])
    if not programmes:
        raise RuntimeError("BBC Persian: no current schedule parsed")
    channel = {
        "id": "bbc-persian:tv",
        "name_fa": "بی‌بی‌سی فارسی",
        "name": "BBC Persian",
        "logo": "https://i.imgur.com/4uTMnPb.png",
        "group": "news",
        "source_key": "bbc-persian",
        "source_name": "BBC Persian",
        "confidence": confidence,
    }
    return [channel], programmes

def build() -> dict:
    now = datetime.now(timezone.utc)
    channels: list[dict] = []
    programmes: list[dict] = []
    errors: dict[str, str] = {}

    specs = [
        dict(key="irib", name="صداوسیما / تلوبیون", url=IRIB_XML, confidence="aggregated", metadata_loader=load_irib_metadata),
        dict(key="persiana", name="Persiana Group", url=PERSIANA_XML, confidence="aggregated", metadata_loader=None),
        dict(key="iranintl", name="Iran International", url=IRANINTL_XML, confidence="verified", metadata_loader=lambda: {"iranintl.iitv": {"name": "ایران اینترنشنال", "name_en": "Iran International", "group": "خبری"}}),
    ]
    for spec in specs:
        try:
            metadata = spec["metadata_loader"]() if spec["metadata_loader"] else None
            ch, pr = ingest_xmltv(
                key=spec["key"],
                name=spec["name"],
                url=spec["url"],
                confidence=spec["confidence"],
                now=now,
                metadata=metadata,
            )
            channels.extend(ch)
            programmes.extend(pr)
        except Exception as exc:
            errors[spec["key"]] = f"{type(exc).__name__}: {exc}"
            print("WARNING:", spec["name"], "failed:", exc)

    for key, name, loader in (
        ("radiofarda", "Radio Farda", ingest_radiofarda),
        ("afintl", "Afghanistan International", ingest_afintl),
        ("ariana", "Ariana TV", ingest_ariana),
    ):
        try:
            ch, pr = loader(now)
            channels.extend(ch)
            programmes.extend(pr)
        except Exception as exc:
            errors[key] = f"{type(exc).__name__}: {exc}"
            print("WARNING:", name, "failed:", exc)

    if not channels or not programmes:
        raise RuntimeError("All active EPG sources failed; refusing to overwrite good data")

    programmes.sort(key=lambda x: (x["start"], x["channel_id"]))
    programmes, quality_stats = clean_programmes(programmes, channels)
    used = {p["channel_id"] for p in programmes}
    channels = [c for c in channels if c["id"] in used]
    source_stats = {}
    quality_acc = {}
    for c in channels:
        c["trust_score"] = source_trust_score(c)
        s = source_stats.setdefault(c["source_key"], {"channels": 0, "programmes": 0})
        s["channels"] += 1
    for p in programmes:
        key = p["channel_id"].split(":", 1)[0]
        source_stats.setdefault(key, {"channels": 0, "programmes": 0})["programmes"] += 1
        qa = quality_acc.setdefault(key, {"sum": 0, "count": 0})
        qa["sum"] += int(p.get("quality_score") or 0)
        qa["count"] += 1

    for key, st in source_stats.items():
        qa = quality_acc.get(key, {"sum": 0, "count": 0})
        st["avg_quality"] = round(qa["sum"] / qa["count"]) if qa["count"] else 0

    return {
        "schema_version": 2,
        "generated_at": iso(now),
        "timezone": "Asia/Tehran",
        "sources": SOURCE_REGISTRY,
        "source_stats": source_stats,
        "source_errors": errors,
        "quality_stats": quality_stats,
        "channels": channels,
        "programmes": programmes,
    }

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", default="web-static/data/tv-guide.json")
    args = ap.parse_args()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    data = build()

    if out.exists():
        try:
            old = json.loads(out.read_text(encoding="utf-8"))
            comparable = ("channels", "programmes", "sources", "source_stats", "source_errors", "quality_stats")
            if all(old.get(k) == data.get(k) for k in comparable):
                print("TV Guide unchanged:", len(data["channels"]), "channels,", len(data["programmes"]), "programmes")
                return
        except Exception:
            pass

    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    parts = [f"{k}={v['channels']}ch/{v['programmes']}p" for k, v in data["source_stats"].items()]
    print("TV Guide:", len(data["channels"]), "channels,", len(data["programmes"]), "programmes", "|", ", ".join(parts), "| quality", data.get("quality_stats"), "->", out)

if __name__ == "__main__":
    main()
