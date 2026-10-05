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
import os
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from yt_dlp import YoutubeDL

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
DOWNSUB_ENDPOINT = "https://api.downsub.com/download"
YOUTUBE_RECAP_STATE_OUT = HERE.parent / "data" / "youtube-recap-state.json"
YOUTUBE_RETRY_HOURS = 72
YOUTUBE_RECAP_VERSION = 2

# Keep videos visible in the archive, but do not spend transcript/AI credits
# on channels whose uploads do not need Jan Kalam recaps.
YOUTUBE_RECAP_EXCLUDE_HANDLES = {
    "nima-afshar-naderi",
}

# Trusted interview/media channels. Their latest uploads are scanned once per
# build and title-matched against *all* curated figures, so hosted appearances
# do not require a one-off rule per person.
YOUTUBE_SHARED_HOSTS = (
    "https://www.youtube.com/@Parsi_Live",
    "https://www.youtube.com/@Abdi_media4",
)

SYSTEM = """تو ویراستار «جان کلام» هستی. متن عمومی یک چهره را از منبع اصلی دریافت می‌کنی.
فقط محتوای دارای موضع، ادعا، تصمیم، استدلال یا پیام عمومی معنادار را publish=true کن.
تبلیغ، تبریک ساده، بازنشر بدون نظر تازه، محتوای تکراری و متن تقریباً خالی را publish=false کن.
برای موارد منتشرشدنی:
- topic_fa حداکثر ۸ کلمه باشد.
- summary_fa یک بازگویی دقیق و خنثی در ۳ تا ۶ جمله باشد که برای کارت و تایم‌لاین مناسب است.
- recap_fa یک ری‌کپ حرفه‌ای، مفصل، نکته‌به‌نکته، وفادارانه و یکپارچه از کل محتوای متن باشد.
  ری‌کپ باید روان و قابل خواندن به‌عنوان متن مستقل باشد، ترتیب و منطق استدلال گوینده را تا حد
  ممکن حفظ کند، نکات مهم را حذف نکند، ادعا و ارزیابی را به خود گوینده نسبت دهد، از افزودن
  تحلیل، داوری یا اطلاعات بیرونی خودداری کند و از تکرار زائد پرهیز کند. اگر متن طولانی است،
  ری‌کپ نیز متناسب با آن مفصل باشد و به چند پاراگراف پیوسته تقسیم شود؛ هدف این است که کسی
  بدون دیدن ویدئو، جان و مسیر کامل سخنان را بفهمد و بتوان از آن برای تهیه متن «جان کلام»
  استفاده کرد.
- key_points_fa فهرستی از مهم‌ترین نکات مستقل و وفادارانه باشد؛ هر مورد یک جمله کوتاه.
شدت لحن را تغییر نده و ترجمه را نقل‌قول مستقیم فارسی جا نزن.
خروجی فقط JSON با کلید posts و برای هر id:
publish, topic_fa, summary_fa, recap_fa, key_points_fa."""



VIDEO_RECAP_SYSTEM = """تو ویراستار حرفه‌ای «جان کلام» هستی. متن پیاده‌شدهٔ یک ویدئوی عمومی از یک چهره را می‌گیری.
این ویدئو از قبل برای پردازش انتخاب شده است؛ دربارهٔ انتشار یا حذف آن تصمیم نگیر.
فقط بر اساس متن ورودی و بدون افزودن اطلاعات بیرونی، خروجی فارسی بساز:
- topic_fa: عنوان دقیق و کوتاه، حداکثر ۸ کلمه.
- summary_fa: خلاصهٔ خنثی ۳ تا ۶ جمله‌ای.
- recap_fa: ری‌کپ حرفه‌ای، مفصل، نکته‌به‌نکته، روان، یکپارچه و وفادارانه. مسیر استدلال، ترتیب نکات، مثال‌ها، هشدارها و نتیجه‌گیری‌ها حفظ شود؛ ادعاها به گوینده نسبت داده شوند و هیچ تحلیل یا داوری تازه‌ای اضافه نشود. متن باید برای تولید ویدئوی «جان کلام» قابل استفاده باشد.
- key_points_fa: مهم‌ترین نکات مستقل؛ هر مورد یک جملهٔ کوتاه.
خروجی فقط یک JSON object با همین چهار کلید باشد."""


def _video_recap(provider, row: dict) -> dict:
    if getattr(provider, "name", "") == "mock":
        return {}
    prompt = "ویدئو:\n" + json.dumps(row, ensure_ascii=False)
    result = provider.generate(system=VIDEO_RECAP_SYSTEM, user=prompt, context={"video": row})
    data = result.data if isinstance(result.data, dict) else {}
    if any(k in data for k in ("recap_fa", "summary_fa", "topic_fa")):
        return data
    posts = data.get("posts")
    if isinstance(posts, list) and posts:
        return posts[0] if isinstance(posts[0], dict) else {}
    if isinstance(posts, dict):
        vid = str(row.get("id") or "")
        hit = posts.get(vid)
        if isinstance(hit, dict):
            return hit
        for value in posts.values():
            if isinstance(value, dict):
                return value
    return {}

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


def _youtube_name_variants(figure) -> tuple[str, ...]:
    """Conservative title-match variants for hosted appearances."""
    raw = [figure.name_fa, *getattr(figure, "aliases", ())]
    out = []
    for value in raw:
        value = re.sub(r"\s+", " ", str(value or "")).strip()
        # Short/common tokens are too risky for global title matching.
        if len(value) < 5 or value in out:
            continue
        out.append(value)
    return tuple(out)


def collect_youtube_catalog() -> list[dict]:
    """Latest uploads for every curated figure with a discoverable YouTube presence.

    Official channels are attached directly. In addition, a small allow-list of
    trusted host channels is fetched once and their video titles are matched
    against every figure's canonical name and aliases. This makes the feature
    global rather than person-specific while avoiding noisy YouTube-wide search.
    """
    rows: list[dict] = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; Pendar/1.0)"}
    with httpx.Client(headers=headers, timeout=25, follow_redirects=True) as client:
        # 1) Direct/official channels declared on the figure.
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
                    "source_type": "official",
                })

        # 2) Hosted appearances: scan each trusted host once, then match all people.
        matchers = [
            (figure, _youtube_name_variants(figure))
            for figure in FIGURES
        ]
        for host_url in YOUTUBE_SHARED_HOSTS:
            try:
                channel_id = youtube_channel_id(client, host_url)
                if not channel_id:
                    print(f"youtube catalog: shared host unresolved {host_url}")
                    continue
                entries = youtube_feed(client, channel_id)[:15]
            except Exception as exc:
                print(f"youtube catalog: shared host unavailable {host_url} ({type(exc).__name__})")
                continue
            for entry in entries:
                title = re.sub(r"\s+", " ", str(entry.get("title") or "")).strip()
                if not title:
                    continue
                for figure, needles in matchers:
                    if not needles or not any(n in title for n in needles):
                        continue
                    rows.append({
                        "id": entry["id"],
                        "handle": figure.handle,
                        "title": title,
                        "url": entry["url"],
                        "published_at": entry["published_at"],
                        "thumbnail": entry.get("media_url"),
                        "channel_url": host_url,
                        "source_type": "hosted",
                    })

    # De-duplicate the same video when it is reachable through more than one rule.
    dedup = {}
    for row in rows:
        dedup[(row["handle"], row["id"])] = row
    return list(dedup.values())


def _sample_text(text: str, limit: int = YOUTUBE_TRANSCRIPT_CHARS) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    third = limit // 3
    middle_start = max(0, len(text) // 2 - third // 2)
    return (text[:third] + "\n[… بخش میانی …]\n" +
            text[middle_start:middle_start + third] +
            "\n[… بخش پایانی …]\n" + text[-third:])


def _lang_rank(lang: str) -> int:
    lang = str(lang or "").lower().replace("_", "-")
    preferred = ["fa", "fa-auto", "fa-ir", "en", "en-auto", "en-us", "en-gb"]
    for i, value in enumerate(preferred):
        if lang == value or lang.startswith(value + "-"):
            return i
    return 99


def _downsub_transcript(client: httpx.Client, video_id: str) -> tuple[str, str]:
    """Fetch a transcript through the paid DownSub API when configured.

    The parser is intentionally tolerant because DownSub may return either
    transcript text directly or metadata containing downloadable subtitle URLs.
    """
    key = os.environ.get("DOWNSUB_API_KEY", "").strip()
    if not key:
        return "", ""
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        r = client.post(
            DOWNSUB_ENDPOINT,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"url": video_url},
            timeout=60,
        )
    except Exception as exc:
        print(f"youtube: DownSub request failed {video_id} ({type(exc).__name__})")
        return "", ""
    if r.status_code != 200:
        print(f"youtube: DownSub HTTP {r.status_code} for {video_id}")
        return "", ""

    # Some API responses may be plain subtitle/transcript text.
    ctype = str(r.headers.get("content-type") or "").lower()
    if "json" not in ctype:
        text = _caption_text_from_payload(r.text)
        if len(text) >= 120:
            print(f"youtube: DownSub transcript ok {video_id} (plain)")
            return _sample_text(text), ""
        return "", ""

    try:
        data = r.json()
    except Exception:
        return "", ""

    text_candidates: list[tuple[int, str, str]] = []
    url_candidates: list[tuple[int, str, str]] = []

    def walk(node, inherited_lang=""):
        if isinstance(node, dict):
            lang = str(
                node.get("lang") or node.get("language") or node.get("language_code")
                or node.get("code") or inherited_lang or ""
            )
            for key_name in ("transcript", "content", "text", "subtitle_text", "body"):
                value = node.get(key_name)
                if isinstance(value, str) and len(value.strip()) >= 120 and not value.startswith(("http://", "https://")):
                    text_candidates.append((_lang_rank(lang), lang, value))
            for key_name in ("url", "download_url", "download", "src", "link"):
                value = node.get(key_name)
                if isinstance(value, str) and value.startswith(("http://", "https://")):
                    url_candidates.append((_lang_rank(lang), lang, value))
            for value in node.values():
                if isinstance(value, (dict, list)):
                    walk(value, lang)
        elif isinstance(node, list):
            for value in node:
                walk(value, inherited_lang)
        elif isinstance(node, str) and len(node.strip()) >= 120 and not node.startswith(("http://", "https://")):
            text_candidates.append((_lang_rank(inherited_lang), inherited_lang, node))

    walk(data)

    # Prefer Persian, then English; avoid random language tracks when metadata exists.
    for _, lang, raw in sorted(text_candidates, key=lambda x: x[0]):
        if lang and _lang_rank(lang) >= 99:
            continue
        text = _caption_text_from_payload(raw)
        if len(text) >= 120:
            print(f"youtube: DownSub transcript ok {video_id} ({lang or 'unknown'})")
            return _sample_text(text), lang

    for _, lang, url in sorted(url_candidates, key=lambda x: x[0]):
        if lang and _lang_rank(lang) >= 99:
            continue
        try:
            rr = client.get(url, timeout=60)
            if rr.status_code != 200:
                continue
            text = _caption_text_from_payload(rr.text)
            if len(text) >= 120:
                print(f"youtube: DownSub subtitle ok {video_id} ({lang or 'unknown'})")
                return _sample_text(text), lang
        except Exception:
            continue

    # If the response had no usable language metadata, accept a substantial direct text.
    for _, lang, raw in text_candidates:
        if lang:
            continue
        text = _caption_text_from_payload(raw)
        if len(text) >= 120:
            print(f"youtube: DownSub transcript ok {video_id} (unlabeled)")
            return _sample_text(text), ""
    print(f"youtube: DownSub returned no usable transcript for {video_id}")
    return "", ""


def _load_recap_state() -> dict:
    try:
        data = json.loads(YOUTUBE_RECAP_STATE_OUT.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_recap_state(state: dict) -> None:
    YOUTUBE_RECAP_STATE_OUT.parent.mkdir(parents=True, exist_ok=True)
    YOUTUBE_RECAP_STATE_OUT.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _retry_due(row: dict) -> bool:
    if not row:
        return True
    if int(row.get("version") or 0) != YOUTUBE_RECAP_VERSION:
        return True
    if row.get("status") == "success":
        return False
    raw = str(row.get("last_attempt") or "")
    if not raw:
        return True
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
        return (now - dt).total_seconds() >= YOUTUBE_RETRY_HOURS * 3600
    except ValueError:
        return True


def _timedtext_transcript(client: httpx.Client, video_id: str) -> tuple[str, str]:
    """Best-effort fallback when youtube-transcript-api is blocked on cloud IPs.

    YouTube's public timedtext endpoint can expose uploaded or auto-generated
    captions without requiring us to download or redistribute the media itself.
    """
    for lang in ("fa", "en", "ar", "tr", "fr", "de"):
        for kind in ("", "asr"):
            params = {"v": video_id, "lang": lang, "fmt": "json3"}
            if kind:
                params["kind"] = kind
            try:
                r = client.get("https://www.youtube.com/api/timedtext", params=params)
                if r.status_code != 200 or not r.text.strip():
                    continue
                data = r.json()
                parts = []
                for event in data.get("events", []):
                    segs = event.get("segs") or []
                    text = "".join(str(seg.get("utf8") or "") for seg in segs)
                    text = html.unescape(text).replace("\n", " ").strip()
                    if text:
                        parts.append(text)
                text = re.sub(r"\s+", " ", " ".join(parts)).strip()
                if len(text) >= 120:
                    return _sample_text(text), lang
            except Exception:
                continue
    return "", ""


def _caption_text_from_payload(payload: str) -> str:
    payload = str(payload or "")
    if not payload.strip():
        return ""
    # json3 captions
    try:
        data = json.loads(payload)
        parts = []
        for event in data.get("events", []):
            segs = event.get("segs") or []
            text = "".join(str(seg.get("utf8") or "") for seg in segs)
            text = html.unescape(text).replace("\n", " ").strip()
            if text:
                parts.append(text)
        if parts:
            return re.sub(r"\s+", " ", " ".join(parts)).strip()
    except Exception:
        pass
    # VTT/SRT fallback: strip timestamps, cue indexes and markup.
    lines = []
    for raw in payload.splitlines():
        line = raw.strip()
        if not line or line == "WEBVTT" or "-->" in line or re.fullmatch(r"\d+", line):
            continue
        line = re.sub(r"<[^>]+>", "", line)
        line = re.sub(r"\{\\an\d+\}", "", line)
        line = html.unescape(line).strip()
        if line:
            lines.append(line)
    # Auto captions often repeat overlapping cues; collapse adjacent duplicates.
    out = []
    for line in lines:
        if not out or line != out[-1]:
            out.append(line)
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def _ytdlp_transcript(client: httpx.Client, video_id: str) -> tuple[str, str]:
    """Discover caption tracks with yt-dlp and fetch the best text track."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "socket_timeout": 20,
    }
    proxy = os.environ.get("YOUTUBE_PROXY_URL", "").strip()
    if proxy:
        opts["proxy"] = proxy
    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        print(f"youtube: yt-dlp metadata unavailable {video_id} ({type(exc).__name__})")
        return "", ""

    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}
    preferred = ["fa", "fa-IR", "en", "en-US", "en-GB", "ar", "tr", "fr", "de"]
    choices = []
    for source_rank, tracks in ((0, manual), (1, auto)):
        for lang, formats in tracks.items():
            lang_rank = preferred.index(lang) if lang in preferred else len(preferred) + 1
            choices.append((source_rank, lang_rank, lang, formats or []))
    choices.sort(key=lambda x: (x[0], x[1]))

    for _, _, lang, formats in choices:
        formats = sorted(
            formats,
            key=lambda x: 0 if x.get("ext") == "json3" else 1 if x.get("ext") == "vtt" else 2,
        )
        for fmt in formats:
            cap_url = fmt.get("url")
            if not cap_url:
                continue
            try:
                r = client.get(cap_url)
                if r.status_code != 200:
                    continue
                text = _caption_text_from_payload(r.text)
                if len(text) >= 120:
                    print(f"youtube: yt-dlp captions ok {video_id} ({lang})")
                    return _sample_text(text), str(lang or "")
            except Exception:
                continue
    return "", ""


def youtube_transcript(api: YouTubeTranscriptApi, client: httpx.Client,
                       video_id: str) -> tuple[str, str]:
    if os.environ.get("DOWNSUB_API_KEY", "").strip():
        text, lang = _downsub_transcript(client, video_id)
        if text:
            return text, lang
    try:
        listing = api.list(video_id)
        transcript = None
        preferred = ["fa", "en", "ar", "tr", "fr", "de"]
        try:
            transcript = listing.find_transcript(preferred)
        except Exception:
            transcript = next(iter(listing), None)
        if transcript is not None:
            fetched = transcript.fetch()
            text = " ".join(str(s.text or "").strip() for s in fetched if str(s.text or "").strip())
            text = _sample_text(html.unescape(text))
            if len(text) >= 120:
                return text, str(getattr(transcript, "language_code", "") or "")
    except Exception as exc:
        print(f"youtube: transcript api blocked {video_id} ({type(exc).__name__}); trying timedtext")

    text, lang = _timedtext_transcript(client, video_id)
    if text:
        print(f"youtube: timedtext fallback ok {video_id} ({lang})")
        return text, lang

    text, lang = _ytdlp_transcript(client, video_id)
    if text:
        return text, lang
    return "", ""


def collect_youtube(provider, old: list[dict], catalog: list[dict] | None = None) -> list[dict]:
    seen = {str(x.get("id")) for x in old if x.get("platform") == "youtube"}
    fresh: list[dict] = []
    attempts = 0
    recap_state = _load_recap_state()
    headers = {"User-Agent": "Mozilla/5.0 (compatible; JanKalam/1.0)"}
    api = YouTubeTranscriptApi()

    candidates = catalog if isinstance(catalog, list) else []
    # Process newest catalog items first; this covers official channels and
    # trusted hosted appearances with the same recap pipeline.
    candidates = sorted(
        [
            x for x in candidates
            if isinstance(x, dict)
            and x.get("id")
            and x.get("handle")
            and str(x.get("handle") or "") not in YOUTUBE_RECAP_EXCLUDE_HANDLES
        ],
        key=lambda x: str(x.get("published_at") or ""),
        reverse=True,
    )

    by_handle = {f.handle: f for f in FIGURES}
    with httpx.Client(headers=headers, timeout=25, follow_redirects=True) as client:
        for entry in candidates:
            if attempts >= YOUTUBE_MAX_NEW_PER_RUN:
                break
            figure = by_handle.get(str(entry.get("handle") or ""))
            if figure is None:
                continue
            ext_id = "youtube-" + str(entry["id"])
            if ext_id in seen:
                continue
            state_key = f"{figure.handle}:{entry['id']}"
            if not _retry_due(recap_state.get(state_key) or {}):
                continue
            attempts += 1
            transcript, lang = youtube_transcript(api, client, str(entry["id"]))
            if len(transcript) < 120:
                recap_state[state_key] = {
                    "status": "no_transcript",
                    "version": YOUTUBE_RECAP_VERSION,
                    "last_attempt": datetime.now().astimezone().isoformat(),
                }
                print(f"youtube: transcript unavailable {entry['id']} after fallbacks")
                continue
            lab = _video_recap(provider, {
                "id": entry["id"],
                "person": figure.name_fa,
                "role": figure.role_fa,
                "video_title": entry.get("title") or "",
                "transcript": transcript,
            })
            summary = str(lab.get("summary_fa") or "").strip()
            recap = str(lab.get("recap_fa") or "").strip()
            if not summary or not recap:
                recap_state[state_key] = {
                    "status": "ai_incomplete",
                    "version": YOUTUBE_RECAP_VERSION,
                    "last_attempt": datetime.now().astimezone().isoformat(),
                }
                print(f"youtube: AI recap incomplete {entry['id']}")
                continue
            recap_state[state_key] = {
                "status": "success",
                "version": YOUTUBE_RECAP_VERSION,
                "last_attempt": datetime.now().astimezone().isoformat(),
            }
            fresh.append({
                "id": ext_id, "handle": figure.handle, "name_fa": figure.name_fa,
                "role_fa": figure.role_fa, "field": figure.field, "kind": "analysis",
                "platform": "youtube", "source_language": lang or "und",
                "translation_label_fa": ("بازگویی از ویدئوی اصلی" if lang == "fa"
                                         else f"بازگویی از {lang or 'زبان اصلی'}"),
                "topic_fa": str(lab.get("topic_fa") or entry.get("title") or "ویدئوی تازه").strip(),
                "summary_fa": summary,
                "recap_fa": recap,
                "key_points_fa": [
                    str(x).strip() for x in (lab.get("key_points_fa") or [])
                    if str(x).strip()
                ][:20],
                "transcript_available": True,
                "url": entry.get("url"),
                "published_at": entry.get("published_at"),
                "media_url": entry.get("thumbnail") or entry.get("media_url"),
                "video_title": entry.get("title") or "",
                "source_type": entry.get("source_type") or "official",
            })
    _save_recap_state(recap_state)
    print(f"youtube: {attempts} catalog videos checked; {len(fresh)} substantive recaps")
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
    catalog: list[dict] = []
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
        fresh.extend(collect_youtube(provider, old, catalog))
    except Exception as exc:
        print(f"youtube collector: keeping existing data ({type(exc).__name__})")

    by_id = {
        str(x.get("id")): x
        for x in old
        if isinstance(x, dict)
        and x.get("id")
        and not (
            str(x.get("platform") or "") == "youtube"
            and str(x.get("handle") or "") in YOUTUBE_RECAP_EXCLUDE_HANDLES
        )
    }
    for x in fresh:
        by_id[str(x["id"])] = x
    merged = _bounded(list(by_id.values()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"external figures: {len(fresh)} fresh substantive rows; {len(merged)} rows kept")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
