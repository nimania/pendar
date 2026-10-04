#!/usr/bin/env python3
"""Build Pendar TV Guide JSON from live XMLTV sources.

Phase 1 intentionally ingests only sources with a stable machine-readable feed.
Other sources stay in the registry as planned and are not fabricated.
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

PERSIANA_XML = "https://raw.githubusercontent.com/Samhouston010/persiana-tv-epg/main/persiana.xml"

SOURCE_REGISTRY = [
    {"key": "persiana", "name": "Persiana Group", "status": "aggregated", "note": "XMLTV جاری؛ منبع تجمیعی با دادهٔ زمان‌بندی پرشیانا"},
    {"key": "irib", "name": "صداوسیما / تلوبیون", "status": "planned", "note": "اتصال مستقیم به کنداکتور و EPG در مرحلهٔ بعد"},
    {"key": "bbc-persian", "name": "BBC Persian", "status": "planned", "note": "جدول رسمی قابل استخراج"},
    {"key": "iranintl", "name": "Iran International", "status": "planned", "note": "جدول رسمی + اکنون/بعدی"},
    {"key": "radiofarda", "name": "Radio Farda", "status": "planned", "note": "جدول رسمی روزانه"},
    {"key": "gem", "name": "GEM Group", "status": "planned", "note": "نیازمند تطبیق چند منبع"},
    {"key": "afintl", "name": "Afghanistan International", "status": "planned", "note": "جدول رسمی + اکنون/بعدی"},
    {"key": "ariana", "name": "Ariana TV", "status": "planned", "note": "TV Schedule رسمی"},
    {"key": "tolo", "name": "TOLO TV", "status": "planned", "note": "Schedule رسمی"},
    {"key": "mbc-persia", "name": "MBC Persia", "status": "planned", "note": "زمان‌بندی نیمه‌ساختاریافته"},
]

SPORT_RE = re.compile(r"(sport|fight|ورزش|فوتبال|والیبال|بسکتبال|تنیس|لیگ|جام)", re.I)

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Pendar-TVGuide/1.0 (+https://nimania.github.io/pendar/)"})
    with urllib.request.urlopen(req, timeout=30) as r:
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

def channel_group(cid: str, name: str) -> str:
    s = (cid + " " + name).lower()
    if "sport" in s or "fight" in s:
        return "sports"
    if "junior" in s:
        return "kids"
    if "cinema" in s:
        return "movies"
    if any(x in s for x in ("series", "turkey", "korea", "comedy")):
        return "series"
    if "docs" in s:
        return "docs"
    if any(x in s for x in ("music", "folk")):
        return "music"
    return "general"

def build() -> dict:
    root = ET.fromstring(fetch(PERSIANA_XML))
    raw_channels = {}
    for node in root.findall("channel"):
        cid = (node.attrib.get("id") or "").strip()
        if not cid or cid.lower() == "podcast":
            continue
        name_fa = text_by_lang(node, "display-name", "fa") or text_by_lang(node, "display-name", "en") or cid
        name_en = text_by_lang(node, "display-name", "en") or name_fa
        icon = node.find("icon")
        raw_channels[cid] = {
            "id": cid,
            "name_fa": name_fa,
            "name": name_en,
            "logo": icon.attrib.get("src") if icon is not None else None,
            "group": channel_group(cid, name_en),
            "source_key": "persiana",
            "source_name": "Persiana Group",
            "confidence": "aggregated",
        }

    now = datetime.now(timezone.utc)
    lo, hi = now - timedelta(hours=12), now + timedelta(days=8)
    programmes = []
    used = set()
    for node in root.findall("programme"):
        cid = (node.attrib.get("channel") or "").strip()
        if cid not in raw_channels:
            continue
        try:
            start = parse_xmltv_time(node.attrib.get("start", ""))
            stop = parse_xmltv_time(node.attrib.get("stop", ""))
        except Exception:
            continue
        if stop < lo or start > hi:
            continue
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
        programmes.append({
            "channel_id": cid,
            "start": iso(start),
            "stop": iso(stop),
            "title_fa": title_fa,
            "title_en": title_en or None,
            "desc_fa": desc_fa or None,
            "year": (node.findtext("date") or "").strip() or None,
            "categories": cats[:4],
            "icon": icon_node.attrib.get("src") if icon_node is not None else None,
            "rating": (rating_node.text or "").strip() if rating_node is not None else None,
        })
        used.add(cid)

    programmes.sort(key=lambda x: (x["start"], x["channel_id"]))
    channels = [raw_channels[cid] for cid in raw_channels if cid in used]
    if not channels or not programmes:
        raise RuntimeError("EPG source returned no current programmes; refusing to overwrite good data")

    return {
        "schema_version": 1,
        "generated_at": iso(now),
        "timezone": "Asia/Tehran",
        "sources": SOURCE_REGISTRY,
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

    # Avoid rewriting purely because generated_at changed when the usable EPG did not.
    if out.exists():
        try:
            old = json.loads(out.read_text(encoding="utf-8"))
            if old.get("channels") == data["channels"] and old.get("programmes") == data["programmes"] and old.get("sources") == data["sources"]:
                print("TV Guide unchanged:", len(data["channels"]), "channels,", len(data["programmes"]), "programmes")
                return
        except Exception:
            pass

    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("TV Guide:", len(data["channels"]), "channels,", len(data["programmes"]), "programmes ->", out)

if __name__ == "__main__":
    main()
