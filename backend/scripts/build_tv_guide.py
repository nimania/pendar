#!/usr/bin/env python3
"""Build Pendar TV Guide JSON from current machine-readable EPG sources.

The collector is conservative: a source is published only when its current
schedule can be parsed. Planned sources remain visible in the registry but do
not create synthetic programme rows.
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
IRIB_XML = "https://raw.githubusercontent.com/Samhouston010/sepehr-irib-epg/main/sepehr.xml"
IRIB_CHANNELS = "https://raw.githubusercontent.com/Samhouston010/sepehr-irib-epg/main/channels.json"
IRANINTL_XML = "https://raw.githubusercontent.com/SandObserver/iranintl-xmltv/main/output/iranintl.xml"

SOURCE_REGISTRY = [
    {"key": "irib", "name": "صداوسیما / تلوبیون", "status": "aggregated", "note": "EPG جاریِ شبکه‌های سراسری و استانی؛ گردآوری‌شده از APIهای تلوبیون/سپهر"},
    {"key": "persiana", "name": "Persiana Group", "status": "aggregated", "note": "XMLTV جاریِ شبکه‌های گروه پرشیانا"},
    {"key": "bbc-persian", "name": "BBC Persian", "status": "planned", "note": "جدول رسمی قابل استخراج"},
    {"key": "iranintl", "name": "Iran International", "status": "verified", "note": "XMLTV تازه‌شونده، استخراج‌شده از جدول رسمی شبکه"},
    {"key": "radiofarda", "name": "Radio Farda", "status": "planned", "note": "جدول رسمی روزانه"},
    {"key": "gem", "name": "GEM Group", "status": "planned", "note": "نیازمند تطبیق چند منبع"},
    {"key": "afintl", "name": "Afghanistan International", "status": "planned", "note": "جدول رسمی + اکنون/بعدی"},
    {"key": "ariana", "name": "Ariana TV", "status": "planned", "note": "TV Schedule رسمی"},
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

def load_irib_metadata() -> dict[str, dict]:
    rows = json.loads(fetch(IRIB_CHANNELS).decode("utf-8-sig"))
    out: dict[str, dict] = {}
    for row in rows if isinstance(rows, list) else []:
        tvg = str(row.get("tvg_id") or "").strip()
        if tvg:
            out[tvg] = row
    return out

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

    if not channels or not programmes:
        raise RuntimeError("All active EPG sources failed; refusing to overwrite good data")

    programmes.sort(key=lambda x: (x["start"], x["channel_id"]))
    used = {p["channel_id"] for p in programmes}
    channels = [c for c in channels if c["id"] in used]
    source_stats = {}
    for c in channels:
        s = source_stats.setdefault(c["source_key"], {"channels": 0, "programmes": 0})
        s["channels"] += 1
    for p in programmes:
        key = p["channel_id"].split(":", 1)[0]
        source_stats.setdefault(key, {"channels": 0, "programmes": 0})["programmes"] += 1

    return {
        "schema_version": 2,
        "generated_at": iso(now),
        "timezone": "Asia/Tehran",
        "sources": SOURCE_REGISTRY,
        "source_stats": source_stats,
        "source_errors": errors,
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
            comparable = ("channels", "programmes", "sources", "source_stats", "source_errors")
            if all(old.get(k) == data.get(k) for k in comparable):
                print("TV Guide unchanged:", len(data["channels"]), "channels,", len(data["programmes"]), "programmes")
                return
        except Exception:
            pass

    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    parts = [f"{k}={v['channels']}ch/{v['programmes']}p" for k, v in data["source_stats"].items()]
    print("TV Guide:", len(data["channels"]), "channels,", len(data["programmes"]), "programmes", "|", ", ".join(parts), "->", out)

if __name__ == "__main__":
    main()
