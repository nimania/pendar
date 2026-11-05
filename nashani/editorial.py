"""Editorial formatting and media discovery for Nashani Kerman.

No external AI or forced truncation. Source provenance stays in the ledger;
outbound Telegram messages are compact, readable and unattributed to the bot.
"""
from __future__ import annotations

import html
import re
from urllib.parse import urlsplit

MAX_CAPTION = 950
BAD_LINE_MARKERS = (
    "ادامه خبر", "ادامۀ خبر", "ادامه مطلب", "ادامۀ مطلب",
    "در تلگرام", "در ایتا", "در واتساپ", "در بله",
    "لینک زیر", "عضویت در", "به کانال ما", "عکس تزیینی",
)
BULLET_START = re.compile(r"^[\s🔹🔸🔶🔷◆♦💠✅✔️▪◾⬅➖🔻🔺✳️❇️🟢🟠⭕️💢•\-*]+")
URLS = re.compile(
    r"(?:https?://|www\.)[^\s]+|(?<!\w)(?:[A-Za-z0-9_-]+\.)+(?:ir|com|net|org|me)(?:/[^\s]*)?",
    re.I,
)
HANDLES = re.compile(r"(?<!\w)@[A-Za-z0-9_]{3,}")
SENTENCES = re.compile(r"(?<=[.!؟؛])\s+")
STYLE_URL = re.compile(r"url\(\s*['\"]?([^)'\"\s]+)['\"]?\s*\)", re.I)
MEDIA_ALLOWED_SUFFIXES = ("telesco.pe", "telegram.org", "telegram-cdn.org", "telegra.ph")


def normalize_fa(text):
    text = (text or "").replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ")
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text)).strip().lower()


def clean_news_line(value):
    text = html.unescape(str(value or ""))
    text = BULLET_START.sub("", text).strip(" *•|،:–-")
    text = URLS.sub("", text)
    text = HANDLES.sub("", text)
    text = re.sub(r"\s+", " ", text).strip(" -*•|،:–")
    if not text or any(text.startswith(marker) for marker in BAD_LINE_MARKERS):
        return ""
    if text.startswith(("#", "https:", "http:")):
        return ""
    return text


def meaningful_lines(message, limit=24):
    if not message:
        return []
    lines = [clean_news_line(s) for s in message.get_text("\n", strip=True).splitlines()]
    lines = [s for s in lines if len(normalize_fa(s)) >= 10]
    # Avoid having a final list of repeated advertising lines.
    return lines[:limit]


def media_url_allowed(url):
    if not url:
        return False
    try:
        p = urlsplit(html.unescape(url).strip())
        host = (p.hostname or "").lower()
        return p.scheme == "https" and bool(host) and any(
            host == base or host.endswith("." + base) for base in MEDIA_ALLOWED_SUFFIXES
        ) and not p.username and not p.password
    except ValueError:
        return False


def extract_media(post):
    """Find full-size public Telegram photo or video, excluding link previews."""
    for video in post.select(".tgme_widget_message_video_wrap, .tgme_widget_message_video_player, .tgme_widget_message_roundvideo"):
        node = video.select_one("video[src], video source[src], source[src]")
        url = node.get("src", "") if node else ""
        if not url:
            link = video.select_one("a[href]")
            url = link.get("href", "") if link else ""
        return {"kind": "video", "url": url if media_url_allowed(url) else None}
    photo = post.select_one("a.tgme_widget_message_photo_wrap, .tgme_widget_message_photo_wrap")
    if photo:
        match = STYLE_URL.search(photo.get("style", ""))
        url = match.group(1) if match else ""
        return {"kind": "photo", "url": url if media_url_allowed(url) else None}
    return None


def brief_sentences(text, max_chars=530, max_parts=3):
    """Select whole readable sentences/clauses, never end a post in mid-sentence."""
    cleaned = clean_news_line(text)
    if not cleaned:
        return []
    phrases = [part.strip() for part in SENTENCES.split(cleaned) if part.strip()]
    if len(phrases) == 1 and len(phrases[0]) > max_chars:
        # Long Telegram prose without periods: split at a clause separator.
        phrases = [p.strip() for p in re.split(r"(?<=،)\s+", cleaned) if p.strip()]
    chosen = []
    for phrase in phrases:
        if len(phrase) > max_chars:
            continue
        total = sum(map(len, chosen)) + len(phrase) + 1
        if total > max_chars:
            break
        chosen.append(phrase)
        if len(chosen) >= max_parts:
            break
    return chosen


def compose_caption(item, limit=MAX_CAPTION):
    """Telegram-like heading + blue-diamond readable paragraphs + text attribution."""
    headline = clean_news_line(item.get("title", "")) or "گزارش تازه"
    headline = headline[:140].rsplit(" ", 1)[0] if len(headline) > 140 else headline
    source = clean_news_line(item.get("source", "")) or "رسانه محلی"
    source = source.replace("‌", " ").replace("-", " ")
    source = re.sub(r"\s+", " ", source).strip()

    raw_lines = item.get("paragraphs") or []
    if not raw_lines:
        raw_lines = [item.get("excerpt", "")]
    snippets = []
    for line in raw_lines:
        content = clean_news_line(line)
        if not content or normalize_fa(content) == normalize_fa(headline):
            continue
        if normalize_fa(content).startswith(normalize_fa(headline)):
            content = content[len(headline):].strip(" :،؛.-")
        if not content:
            continue
        for sentence in brief_sentences(content, max_chars=355, max_parts=2):
            key = normalize_fa(sentence)
            if key and all(normalize_fa(x) != key for x in snippets):
                snippets.append(sentence)
        if len(snippets) >= 3:
            break
    prefix = f"🔶 <b>{html.escape(headline)}</b>"
    label = f"به گزارش {html.escape(source)}، "
    pieces = []
    if snippets:
        first = f"🔹 {label}{html.escape(snippets[0])}"
        if len(prefix) + len(first) + 17 <= limit:
            pieces.append(first)
        for sentence in snippets[1:3]:
            part = "🔹 " + html.escape(sentence)
            if len(prefix) + sum(len(p) for p in pieces) + len(part) + 22 > limit:
                break
            pieces.append(part)
    if not pieces:
        pieces.append("🔹 " + label.rstrip("، ") + " خبر را منتشر کرد.")
    footer = "#کرمان #نشانی_کرمان"
    return prefix + "\n\n" + "\n\n".join(pieces) + "\n\n" + footer
