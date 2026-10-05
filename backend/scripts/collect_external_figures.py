"""Collect non-Telegram posts for Jan Kalam figure profiles.

Current collectors:
- Truth Social: public Mastodon-compatible API.
- YouTube: official channel feed for discovery + transcript/captions for substance.

YouTube is deliberately transcript-first: a video without an accessible transcript is
not turned into a Jan Kalam statement from its title/description alone. All collectors
are best-effort; failures keep the previous cached external-figure data intact.
"""
from __future__ import annotations

import html
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from youtube_transcript_api import YouTubeTranscriptApi

from app.ai.providers import get_provider
from app.figures import FIGURES

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "data" / "external-figure-posts.json"
YOUTUBE_CATALOG_OUT = HERE.parent / "data" / "youtube-videos.json"

TRUTH_BASE = "https://truthsocial.com"
TRUTH_ACCOUNT = "realDonaldTrump"
TRUTH_LIMIT = 30

YOUTUBE_MAX_NEW_PER_RUN = 12
YOUTUBE_MAX_PER_CHANNEL = 3
YOUTUBE_KEEP_PER_FIGURE = 40
YOUTUBE_TRANSCRIPT_CHARS = 32000

SYSTEM = """تو ویراستار «جان کلام» هستی. متن عمومی یک چهره را از منبع اصلی دریافت می‌کنی.
فقط محتوای دارای موضع، ادعا، تصمیم، استدلال یا پیام عمومی معنادار را publish=true کن.
تبلیغ، تبریک ساده، بازنشر بدون نظر تازه، محتوای تکراری و متن تقریباً خالی را publish=false کن.
برای موارد منتشرشدنی topic_fa حداکثر ۸ کلمه و summary_fa بازگویی دقیق و خنثی فارسی در ۳ تا ۶
جمله باشد. نکته‌های اصلی و استدلال را به خود شخص نسبت بده و چیزی اضافه نکن. شدت لحن را
تغییر نده و ترجمه را نقل‌قول مستقیم فارسی جا نزن.
خروجی فقط JSON با کلید posts و برای هر id: publish, topic_fa, summary_fa."""


def _provider():
    return get_provider()


def _label(provider, rows: list[dict]) -> dict[str, dict]:
    if getattr(provider, "name", "") == "mock" or not rows:
        return {}
    prompt = "موارد:\n" + json.dumps(rows, ensure_ascii=False)
    result = provider.generate(system=SYSTEM, user=prompt, context={"posts": rows})
    data = result.data if isinstance(result.data, dict) else {}
    return {str(x.get("id")): x for x in data.get("posts", []) if isinstance(x, dict)}


def _get(client: httpx.Client, base: str, path: str):
    r = client.get(base + path)
    r.raise_for_status()
    return r.json()


def fetch_truth() -> list[dict]:
    headers = {"User-Agent": "JanKalam/1.0 (+https://nimania.github.io/jan-kalam/)",
               "Accept": "application/json"}
    with httpx.Client(headers=headers, timeout=25, follow_redirects=True) as client:
        account = _get(client, TRUTH_BASE, f"/api/v1/accounts/lookup?acct={TRUTH_ACCOUNT}")
        rows = _get(client, TRUTH_BASE,
                    f"/api/v1/accounts/{account['id']}/statuses?exclude_replies=true&limit={TRUTH_LIMIT}")
    out = []
    for s in rows if isinstance(rows, list) else []:
        if s.get("reblog"):
            continue
        text = str(s.get("content") or "")
        if not text.strip():
            continue
        out.append({"id": str(s["id"]), "text_html": text, "url": s.get("url") or s.get("uri"),
                    "created_at": s.get("created_at"), "media": s.get("media_attachments") or []})
    return out


def collect_truth(provider, old: list[dict]) -> list[dict]:
    seen = {str(x.get("id")) for x in old if x.get("platform") == "truthsocial"}
    rows = [x for x in fetch_truth() if "truthsocial-" + x["id"] not in seen]
    labels = _label(provider, [{"id": x["id"], "text_html": x["text_html"]} for x in rows])
    public = []
    for row in rows:
        lab = labels.get(row["id"], {})
        if lab.get("publish") is not True or not str(lab.get("summary_fa") or "").strip():
            continue
        media = row.get("media") or []
        public.append({
            "id": "truthsocial-" + row["id"], "handle": "donald-trump",
            "name_fa": "دونالد ترامپ", "role_fa": "رئیس‌جمهور ایالات متحده",
            "field": "foreign", "kind": "analysis", "platform": "truthsocial",
            "source_language": "en", "translation_label_fa": "بازگویی از انگلیسی",
            "topic_fa": str(lab.get("topic_fa") or "تروث سوشیال").strip(),
            "summary_fa": str(lab.get("summary_fa") or "").strip(),
            "url": row.get("url"), "published_at": row.get("created_at"),
            "media_url": (media[0].get("url") if media and isinstance(media[0], dict) else None),
        })
    return public


def youtube_url(figure) -> str | None:
    for kind, url in figure.social:
        if kind == "youtube":
            return url
    return None


def youtube_channel_id(client: httpx.Client, url: str) -> str | None:
    m = re.search(r"/channel/(UC[\w-]{20,})", url)
    if m:
        return m.group(1)
    clean = url.split("?", 1)[0].rstrip("/")
    r = client.get(clean)
    r.raise_for_status()
    text = r.text
    patterns = [
        r'"channelId":"(UC[\w-]{20,})"',
        r'"externalId":"(UC[\w-]{20,})"',
        r'itemprop="channelId"\s+content="(UC[\w-]{20,})"',
        r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{20,})"',
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            return m.group(1)
    return None


def youtube_feed(client: httpx.Client, channel_id: str) -> list[dict]:
    r = client.get("https://www.youtube.com/feeds/videos.xml",
                   params={"channel_id": channel_id})
    r.raise_for_status()
    root = ET.fromstring(r.text)
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
        "media": "http://search.yahoo.com/mrss/",
    }
    out = []
    for entry in root.findall("atom:entry", ns):
        vid = entry.findtext("yt:videoId", default="", namespaces=ns).strip()
        if not vid:
            continue
        thumb = entry.find("media:group/media:thumbnail", ns)
        out.append({
            "id": vid,
            "title": entry.findtext("atom:title", default="", namespaces=ns).strip(),
            "published_at": entry.findtext("atom:published", default="", namespaces=ns).strip(),
            "url": f"https://www.youtube.com/watch?v={vid}",
            "media_url": thumb.get("url") if thumb is not None else None,
        })
    return out


def collect_youtube_catalog() -> list[dict]:
    """Latest uploads from every verified YouTube channel attached to a figure.

    This archive is intentionally independent from transcript/AI availability:
    a real upload should still appear on the person's profile even when YouTube
    exposes no captions for it.
    """
    rows: list[dict] = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; Pendar/1.0)"}
    with httpx.Client(headers=headers, timeout=25, follow_redirects=True) as client:
        for figure in FIGURES:
            url = youtube_url(figure)
            if not url:
                continue
            try:
                channel_id = youtube_channel_id(client, url)
                if not channel_id:
                    print(f"youtube catalog: channel id unresolved for {figure.name_fa}")
                    continue
                entries = youtube_feed(client, channel_id)[:15]
            except Exception as exc:
                print(f"youtube catalog: feed unavailable for {figure.name_fa} ({type(exc).__name__})")
                continue
            for entry in entries:
                rows.append({
                    "id": entry["id"],
                    "handle": figure.handle,
                    "title": entry["title"],
                    "url": entry["url"],
                    "published_at": entry["published_at"],
                    "thumbnail": entry.get("media_url"),
                    "channel_url": url,
                })
    return rows


def _sample_text(text: str, limit: int = YOUTUBE_TRANSCRIPT_CHARS) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    third = limit // 3
    middle_start = max(0, len(text) // 2 - third // 2)
    return (text[:third] + "\n[… بخش میانی …]\n" +
            text[middle_start:middle_start + third] +
            "\n[… بخش پایانی …]\n" + text[-third:])


def youtube_transcript(api: YouTubeTranscriptApi, video_id: str) -> tuple[str, str]:
    listing = api.list(video_id)
    transcript = None
    preferred = ["fa", "en", "ar", "tr", "fr", "de"]
    try:
        transcript = listing.find_transcript(preferred)
    except Exception:
        transcript = next(iter(listing), None)
    if transcript is None:
        return "", ""
    fetched = transcript.fetch()
    text = " ".join(str(s.text or "").strip() for s in fetched if str(s.text or "").strip())
    return _sample_text(html.unescape(text)), str(getattr(transcript, "language_code", "") or "")


def collect_youtube(provider, old: list[dict]) -> list[dict]:
    seen = {str(x.get("id")) for x in old if x.get("platform") == "youtube"}
    fresh: list[dict] = []
    attempts = 0
    headers = {"User-Agent": "Mozilla/5.0 (compatible; JanKalam/1.0)"}
    api = YouTubeTranscriptApi()
    with httpx.Client(headers=headers, timeout=25, follow_redirects=True) as client:
        for figure in FIGURES:
            if attempts >= YOUTUBE_MAX_NEW_PER_RUN:
                break
            url = youtube_url(figure)
            if not url:
                continue
            try:
                channel_id = youtube_channel_id(client, url)
                if not channel_id:
                    print(f"youtube: channel id unresolved for {figure.name_fa}")
                    continue
                entries = youtube_feed(client, channel_id)[:YOUTUBE_MAX_PER_CHANNEL]
            except Exception as exc:
                print(f"youtube: feed unavailable for {figure.name_fa} ({type(exc).__name__})")
                continue
            for entry in entries:
                ext_id = "youtube-" + entry["id"]
                if ext_id in seen or attempts >= YOUTUBE_MAX_NEW_PER_RUN:
                    continue
                attempts += 1
                try:
                    transcript, lang = youtube_transcript(api, entry["id"])
                except Exception as exc:
                    print(f"youtube: transcript unavailable {entry['id']} ({type(exc).__name__})")
                    continue
                if len(transcript) < 120:
                    continue
                labels = _label(provider, [{
                    "id": entry["id"],
                    "person": figure.name_fa,
                    "role": figure.role_fa,
                    "video_title": entry["title"],
                    "transcript": transcript,
                }])
                lab = labels.get(entry["id"], {})
                if lab.get("publish") is not True or not str(lab.get("summary_fa") or "").strip():
                    continue
                fresh.append({
                    "id": ext_id, "handle": figure.handle, "name_fa": figure.name_fa,
                    "role_fa": figure.role_fa, "field": figure.field, "kind": "analysis",
                    "platform": "youtube", "source_language": lang or "und",
                    "translation_label_fa": ("بازگویی از ویدئوی اصلی" if lang == "fa"
                                             else f"بازگویی از {lang or 'زبان اصلی'}"),
                    "topic_fa": str(lab.get("topic_fa") or entry["title"] or "ویدئوی تازه").strip(),
                    "summary_fa": str(lab.get("summary_fa") or "").strip(),
                    "url": entry["url"], "published_at": entry["published_at"],
                    "media_url": entry.get("media_url"), "video_title": entry["title"],
                })
    print(f"youtube: {attempts} new videos checked; {len(fresh)} substantive rows")
    return fresh


def load_old() -> list[dict]:
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _bounded(rows: list[dict]) -> list[dict]:
    rows = sorted(rows, key=lambda x: str(x.get("published_at") or ""), reverse=True)
    counts: dict[tuple[str, str], int] = {}
    out = []
    for row in rows:
        key = (str(row.get("platform") or ""), str(row.get("handle") or ""))
        limit = YOUTUBE_KEEP_PER_FIGURE if key[0] == "youtube" else 100
        if counts.get(key, 0) >= limit:
            continue
        counts[key] = counts.get(key, 0) + 1
        out.append(row)
    return out


def run() -> int:
    old = load_old()
    provider = _provider()
    fresh: list[dict] = []

    # Keep the visual video archive separate from AI-filtered figure statements.
    # If YouTube is temporarily unavailable, preserve the last known-good catalog.
    try:
        catalog = collect_youtube_catalog()
        if catalog:
            YOUTUBE_CATALOG_OUT.write_text(
                json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"youtube catalog: {len(catalog)} uploads saved")
    except Exception as exc:
        print(f"youtube catalog: keeping existing data ({type(exc).__name__})")
    try:
        fresh.extend(collect_truth(provider, old))
    except Exception as exc:
        print(f"truth collector: keeping existing data ({type(exc).__name__})")
    try:
        fresh.extend(collect_youtube(provider, old))
    except Exception as exc:
        print(f"youtube collector: keeping existing data ({type(exc).__name__})")

    by_id = {str(x.get("id")): x for x in old if isinstance(x, dict) and x.get("id")}
    for x in fresh:
        by_id[str(x["id"])] = x
    merged = _bounded(list(by_id.values()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"external figures: {len(fresh)} fresh substantive rows; {len(merged)} rows kept")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
