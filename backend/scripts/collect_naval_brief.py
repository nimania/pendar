#!/usr/bin/env python3
"""Independent, attributed maritime-news digest. No tracking or coordinates.

Produces a static historical list from existing reviewed seed entries and
published public-source headlines. It never parses vessel positions, creates
tracks or forecasts deployments. Updated on the naval-data branch only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

RSS = "https://news.usni.org/feed"
MAX_BYTES = 1_500_000
MIN_AGE = dt.timedelta(hours=48)
KEYWORDS = (
    "fleet and marine tracker", "western pacific pulse", "carrier", "warship",
    "naval", "maritime", "amphibious", "destroyer", "frigate", "fleet",
    "ship movements", "navy ships", "ships at sea", "task group",
)
REGIONS = (
    ("redsea", ("red sea",)),
    ("gulf", ("arabian sea", "persian gulf", "gulf of oman")),
    ("med", ("mediterranean",)),
    ("arctic", ("arctic", "high north", "north sea")),
    ("westpac", ("western pacific", "south china sea", "east china sea")),
    ("pacific", ("pacific",)),
    ("indian", ("indian ocean",)),
    ("atlantic", ("atlantic",)),
)
COUNTRIES = (
    ("uk", ("royal navy", "british navy", "hms ")),
    ("fr", ("french navy", "marine nationale", "charles de gaulle")),
    ("nato", ("nato", "allied maritime")),
    ("us", ("u.s. navy", "uss ", "us navy", "usni news fleet")),
)

def clean(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", "", value or "")).strip()[:280]

def rss_items(xml: bytes) -> list[dict]:
    root = ET.fromstring(xml)
    rows = []
    for item in root.findall(".//item"):
        get = lambda name: clean(item.findtext(name) or "")
        title, link, published = get("title"), get("link"), get("pubDate")
        try:
            when = email.utils.parsedate_to_datetime(published).astimezone(dt.timezone.utc)
        except (TypeError, ValueError, OverflowError):
            continue
        u = urllib.parse.urlsplit(link)
        if u.scheme != "https" or u.hostname != "news.usni.org":
            continue
        rows.append({"original_title": title, "url": urllib.parse.urlunsplit(
            (u.scheme, u.netloc, u.path, "", "")), "published": when})
    return rows

def build_record(row: dict, now: dt.datetime) -> dict | None:
    original = row["original_title"]
    low = original.lower()
    if not any(word in low for word in KEYWORDS):
        return None
    when = row["published"]
    if when > now - MIN_AGE or when < now - dt.timedelta(days=120):
        return None
    region = next((region for region, terms in REGIONS if any(term in low for term in terms)), "global")
    country = next((country for country, terms in COUNTRIES if any(term in low for term in terms)), "other")
    tracker = "fleet and marine tracker" in low
    if tracker:
        country, region = "us", "global"
        title = "انتشار گزارش دوره‌ای ناوگروه‌های آمریکا"
    elif "western pacific pulse" in low:
        title = "انتشار گزارش تحولات دریایی غرب اقیانوس آرام"
    elif "exercise" in low or "drill" in low:
        title = "گزارش یک رزمایش دریایی در منبع"
    else:
        title = "گزارش تازه منبع درباره تحولات دریایی"
    return {
        "id": "usni-" + hashlib.sha256(row["url"].encode()).hexdigest()[:18],
        "date": when.date().isoformat(),
        "country": country,
        "region": region,
        "type": "گزارش استقرار" if tracker else "خبر دریایی",
        "sensitive": tracker,
        "title": title,
        "original_title": original,
        "description": "این مدخل صرفاً به متن منبع پیوند می‌دهد و موقعیت یا مسیر هیچ ناوی را نمایش نمی‌دهد.",
        "source": "USNI News",
        "url": row["url"],
    }

def load_existing(path: Path) -> list[dict]:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
        rows = doc.get("events", [])
        if not isinstance(rows, list):
            raise ValueError("events must be a list")
        return [r for r in rows if isinstance(r, dict) and r.get("id") and r.get("date") and
                str(r.get("url", "")).startswith("https://")]
    except (OSError, ValueError) as exc:
        raise RuntimeError("Existing naval archive invalid: " + str(exc)) from exc

def run(existing: Path, output: Path, now: dt.datetime | None = None) -> tuple[int, int]:
    now = now or dt.datetime.now(dt.timezone.utc)
    known = load_existing(existing)
    incoming = []
    try:
        request = urllib.request.Request(RSS, headers={"User-Agent": "PendarNavalArchive/1.0 (+https://pendar.io/naval/)", "Accept": "application/rss+xml, application/xml, text/xml"})
        with urllib.request.urlopen(request, timeout=18) as response:
            payload = response.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise ValueError("Feed too large")
        for item in rss_items(payload):
            record = build_record(item, now)
            if record:
                incoming.append(record)
    except (OSError, ET.ParseError, ValueError) as exc:
        print("WARNING: Source unavailable; retaining verified archive:", str(exc), file=sys.stderr)

    # Prefer established/editorially seeded records to scraped headlines with
    # the same canonical URL. Nothing is removed when sources fail.
    by_url = {urllib.parse.urlsplit(r["url"]).path: r for r in known}
    added = 0
    for row in incoming:
        key = urllib.parse.urlsplit(row["url"]).path
        if key not in by_url:
            by_url[key] = row
            added += 1
    if not added:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(existing.read_bytes())
        return 0, len(known)
    events = sorted(by_url.values(), key=lambda x: (x.get("date", ""), x.get("id", "")), reverse=True)[:300]
    if len(events) < len(known) and len(known) <= 300:
        raise RuntimeError("Naval collection regression")
    archive = {"version": 1, "updated_at": now.isoformat(timespec="seconds"),
               "scope": "Public regional reports only; no vessel coordinates, routes or live tracking.",
               "events": events}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return added, len(events)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--existing", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    added, total = run(args.existing, args.output)
    print(f"Naval digest: {added} added, {total} sourced records")
