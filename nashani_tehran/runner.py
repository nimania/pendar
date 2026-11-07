#!/usr/bin/env python3
"""Nashani Tehran local-news intake and opt-in Telegram publisher.

Uses public Telegram previews, archives only short excerpts and canonical links.
No generative rewriting; high-risk items are ALWAYS review-only.
State is isolated on the nashani-state Git branch, not the Pendar main branch.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
import hashlib
import html
import json
import os
import re
import sys
import time
import unicodedata
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

from editorial import compose_caption, extract_media, meaningful_lines, clean_news_line
from media_delivery import MediaNotAvailable, upload_public_media
from web_sources import website_posts
from geography import geo_relevance, is_local_news


REPO = os.getenv("GITHUB_REPOSITORY", "nimania/pendar")
BRANCH = "nashani-state"
EXPECTED_BOT_USERNAME = "neshanikermanbot"
EXPECTED_CHANNEL_ID = "@neshanitehran"
EXPECTED_CHANNEL_TITLE = "نشانی: تهران"
STATE_PATH = "nashani/tehran-state.json"
USER_AGENT = "NashaniTehranRadar/1.0 (public-source monitoring)"
MAX_AGE = timedelta(hours=5)
SENSITIVE = (
    "کشته", "کشته‌شد", "جان باخت", "جان‌باخت", "مجروح", "تلفات",
    "بازداشت", "قتل", "تجاوز", "اتهام", "دستگیری", "انفجار",
    "ترور", "حمله", "اعدام", "آدم ربایی", "خودکشی",
    "مفقود", "درگیری", "انتحاری", "بمب", "موشک", "زلزله",
    "احضار", "توقیف", "بازپرسی", "دادستانی", "پلمب",
)
CITY_ANCHORS = (
    "شهر کرمان", "شهرداری کرمان", "شورای شهر کرمان",
    "مناطق شهری کرمان", "خیابان های کرمان", "خیابان‌های کرمان",
    "معابر کرمان", "غرب شهر کرمان", "شرق شهر کرمان",
    "مرکز شهر کرمان", "بازار کرمان", "بافت تاریخی کرمان",
    "فرودگاه کرمان", "گنجعلی خان", "گنجعلی‌خان",
    "باغ ملی کرمان", "میدان آزادی کرمان", "محله های کرمان",
    "محله‌های کرمان", "دانشگاه علوم پزشکی کرمان",
    "شهروندان کرمانی", "ساکنان کرمان", "غرب کرمان",
)
OTHER_CITIES = (
    "رفسنجان", "سیرجان", "بافت", "زرند", "جیرفت", "کهنوج",
    "بردسیر", "بم", "شهربابک", "عنبرآباد", "رابر",
    "قلعه گنج", "قلعه‌گنج", "فهرج", "انار", "راور",
)
CITY_TERMS = ("کرمان", "کرمانی", "گنجعلی", "میدان آزادی", "چهارراه طهماسب")
REGIONAL_PLACES = (
    "سیرجان", "رفسنجان", "جیرفت", "زرند", "شهربابک", "بردسیر",
    "کهنوج", "عنبرآباد", "قلعه گنج", "قلعه‌گنج", "فهرج", "راور",
    "نرماشیر", "ریگان", "کوهبنان", "رودبار جنوب", "منوجان",
    "فاریاب", "ارزوئیه", "ارزوییه", "راین", "لاله زار",
    "گلباف", "ماهان", "گل گهر", "گل‌گهر", "مس کرمان",
)
REGIONAL_WITH_CONTEXT = (
    "شهرستان بافت", "شهر بافت", "شهرستان بم", "شهر بم",
    "شهرستان انار", "شهر انار", "استان کرمان",
    "جنوب کرمان", "شرق کرمان", "شمال کرمان", "غرب کرمان",
)
ADVERTISING_MARKERS = (
    "تبلیغات", "ثبت سفارش", "برای سفارش", "کد تخفیف",
    "فروش ویژه", "قیمت ویژه", "پرداخت درب منزل",
    "ارسال رایگان", "پرداخت در محل", "لینک خرید", "حراج",
    "سفارش دهید", "سفارش بده", "فروش اقساطی",
)
# Media-first articles must never become nonsensical text-only reports.
VISUAL_STORY_MARKERS = (
    "گزارش تصویری", "خبر تصویری", "روایت تصویری", "یک روز یک قاب",
    "عکس ها", "عکسهای", "آلبوم عکس", "تصاویر این", "تصاویر زیر",
    "به روایت تصویر", "گزارش ویدیویی", "گزارش ویدئویی",
    "ویدئوی", "ویدیوی", "در قاب تصویر",
)
SELF_PROMO_CALLS = (
    "دنبال کنید", "فالو کنید", "عضو شوید", "به ما بپیوندید",
    "مشترک شوید", "به کانال ما", "به صفحه ما",
    "ما را دنبال", "همراه ما باشید", "برای عضویت",
    "follow us", "join our channel", "subscribe",
)
SELF_PROMO_DESTINATIONS = (
    "کانال", "اینستاگرام", "تلگرام", "صفحه", "پیج",
    "شبکه های اجتماعی", "ایتا", "روبیکا", "واتساپ",
    "اپلیکیشن", "رسانه ما",
)


def utcnow():
    return datetime.now(timezone.utc)


def parse_time(raw):
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def normalize(text):
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ")
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip().lower()


def city_relevance(text):
    clean = normalize(text)
    if not any(normalize(anchor) in clean for anchor in CITY_TERMS):
        return "reject"
    confirmed = any(normalize(anchor) in clean for anchor in CITY_ANCHORS)
    if any(normalize(place) in clean for place in OTHER_CITIES) and not confirmed:
        return "review"
    return "high" if confirmed else "review"


def is_sensitive(text):
    clean = normalize(text)
    return any(normalize(term) in clean for term in SENSITIVE)


def regional_relevance(text):
    """Compatibility wrapper: a single strict rule for every news source."""
    return "high" if geo_relevance(text) else "reject"


def enforce_geography_on_queue(queue):
    """Also block previously queued off-topic posts, without deleting history."""
    excluded = 0
    for row in queue:
        if row.get("status") not in {"ready", "review"}:
            continue
        location = is_local_news(row)
        if not location:
            row["status"] = "excluded_nonlocal"
            row["review_reason"] = "not_about_tehran_city"
            excluded += 1
        else:
            row["geography"] = location
    return excluded


def looks_like_advertisement(text):
    clean = normalize(text)
    if any(normalize(term) in clean for term in ADVERTISING_MARKERS):
        return True
    # Distinguish outlet/channel follow-us posts from ordinary local news.
    return (any(normalize(term) in clean for term in SELF_PROMO_CALLS)
            and any(normalize(term) in clean for term in SELF_PROMO_DESTINATIONS))


def is_promotional_story(item):
    return looks_like_advertisement(" ".join(
        [item.get("title", ""), item.get("excerpt", "")]
        + (item.get("paragraphs") or [])))


def is_visual_story(item):
    """A report that makes no sense without its referenced pictures/video."""
    body = normalize(" ".join([item.get("title", ""), item.get("excerpt", "")]
                              + (item.get("paragraphs") or [])))
    return any(normalize(term) in body for term in VISUAL_STORY_MARKERS)


def enforce_promotion_on_queue(queue):
    """Also exclude already-queued self-promotional posts, without deleting audit history."""
    excluded = 0
    for item in queue:
        if item.get("status") in {"ready", "review"} and is_promotional_story(item):
            item["status"] = "excluded_promotion"
            item["review_reason"] = "source_self_promotion_or_advertisement"
            excluded += 1
    return excluded


def source_due(source, state, now):
    """Throttle individual public sources independently, without skipping failures."""
    cadence = int(source.get("poll_minutes", 5))
    if cadence < 5 or cadence > 120:
        raise ValueError("poll_minutes must be between 5 and 120")
    last = parse_time(state.get("source_last_checked", {}).get(source["handle"].lower()))
    # Five seconds of tolerance for GitHub Actions scheduling jitter.
    return last is None or (now - last).total_seconds() >= cadence * 60 - 5


def clean_visible_excerpt(text):
    """Keep clickable source URLs and Telegram handles out of the public caption."""
    text = re.sub(r"(?:https?://|www\.)[^\s]+|(?<!\w)(?:[A-Za-z0-9_-]+\.)+(?:ir|com|net|org|me)(?:/[^\s]*)?", " ", text or "", flags=re.I)
    text = re.sub(r"(?<!\w)@[A-Za-z0-9_]{3,}", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def short_text(text, limit=470):
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


def source_posts(source, timeout=18):
    if source.get("platform") == "website":
        return website_posts(source)
    handle = source["handle"].lstrip("@")
    if not re.fullmatch(r"[A-Za-z0-9_]{5,32}", handle):
        raise ValueError("Invalid Telegram channel handle")
    req = Request("https://t.me/s/" + handle, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout) as response:
        doc = response.read(1_500_000)
    soup = BeautifulSoup(doc, "html.parser")
    result = []
    for element in soup.select("div.tgme_widget_message[data-post]"):
        ident = element.get("data-post", "")
        if not ident.lower().startswith(handle.lower() + "/"):
            continue
        message = element.select_one(".tgme_widget_message_text")
        media = extract_media(element)
        lines = meaningful_lines(message)
        if not lines and not media:
            continue
        stamp = element.select_one(".tgme_widget_message_date time[datetime]")
        if stamp is None:
            stamp = element.select_one("time[datetime]")
        when = parse_time(stamp.get("datetime")) if stamp else None
        title = lines[0] if lines else "رسانه بدون توضیح"
        # Preserve source text in short paragraphs for structured editorial output.
        paragraphs = []
        for line in lines[:16]:
            if sum(map(len, paragraphs)) + len(line) > 1700:
                break
            paragraphs.append(line)
        body = " ".join(paragraphs) if paragraphs else title
        if len(normalize(body)) < 15 and not media:
            continue
        result.append({
            "url": "https://t.me/" + ident,
            "source_post_id": ident.split("/", 1)[1],
            "title": title,
            "excerpt": body,
            "paragraphs": paragraphs,
            "media": media,
            "published_at": when.isoformat() if when else None,
            "source": source["name"],
            "source_handle": handle,
        })
    return result


def story_id(url):
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


def duplicate(item, pending):
    title = normalize(item["title"])
    for old in pending:
        old_title = normalize(old.get("title", ""))
        if title and old_title and SequenceMatcher(None, title, old_title).ratio() >= 0.88:
            return old
    return None


def evaluate(item, now, source=None):
    stamp = parse_time(item["published_at"])
    if not stamp or stamp > now + timedelta(minutes=5) or now - stamp > MAX_AGE:
        return None
    source = source or {}
    body = item["title"] + " " + item["excerpt"]
    location = is_local_news(item)
    if not location:
        return None
    if is_promotional_story(item):
        return None
    sensitive = is_sensitive(body)
    item["id"] = story_id(item["url"])
    item["media_repost_allowed"] = bool(source.get("media_repost_allowed", False))
    item["source_hashtag"] = source.get("source_hashtag", "")
    item["risk"] = "sensitive" if sensitive else "ordinary"
    item["city_confidence"] = "high"
    item["geography"] = location
    media_missing = is_visual_story(item) and (
        not item["media_repost_allowed"] or not isinstance(item.get("media"), dict)
    )
    item["status"] = ("review" if sensitive or media_missing
                      or not item.get("paragraphs", [item["excerpt"]])
                      or source.get("review_only") else "ready")
    if media_missing:
        item["review_reason"] = "visual_report_requires_authorized_media"
    item["detected_at"] = now.isoformat()
    item["other_sources"] = []
    return item


def telegram_message(item):
    return compose_caption(item)


def http_json(url, method="GET", payload=None, token=None):
    headers = {"Accept": "application/vnd.github+json",
               "User-Agent": USER_AGENT,
               "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    with urlopen(req, timeout=20) as response:
        return json.load(response)


class Ledger:
    def __init__(self, token):
        if not token:
            raise RuntimeError("GITHUB_TOKEN required for persistent state")
        self.token = token
        self.sha = None

    def endpoint(self):
        path = quote(STATE_PATH, safe="/")
        return f"https://api.github.com/repos/{REPO}/contents/{path}"

    def load(self):
        try:
            reply = http_json(self.endpoint() + "?ref=" + BRANCH, token=self.token)
        except HTTPError as error:
            if error.code == 404:
                return {"version": 1, "initialized": False, "seen": [], "queue": [],
                        "saved_at": None}
            raise
        self.sha = reply["sha"]
        content = base64.b64decode(reply["content"]).decode("utf-8")
        state = json.loads(content)
        if not isinstance(state, dict) or state.get("version") != 1:
            raise ValueError("Unknown Nashani ledger version")
        return state

    def save(self, state):
        state["saved_at"] = utcnow().isoformat()
        content = base64.b64encode(
            (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        ).decode("ascii")
        payload = {"message": "chore(nashani): checkpoint local news radar",
                   "branch": BRANCH, "content": content}
        if self.sha:
            payload["sha"] = self.sha
        for attempt in range(4):
            try:
                result = http_json(self.endpoint(), method="PUT", payload=payload, token=self.token)
                break
            except HTTPError as error:
                if error.code in {500, 502, 503, 504} and attempt < 3:
                    # GitHub occasionally returns a transient server error to successive writes.
                    time.sleep(2 * (attempt + 1))
                    continue
                try:
                    detail = str(json.loads(error.read().decode("utf-8")).get("message", ""))[:200]
                except (ValueError, AttributeError):
                    detail = ""
                print(f"::error::Nashani state write HTTP {error.code}: {detail}", file=sys.stderr)
                raise RuntimeError("Nashani state checkpoint failed") from None
        self.sha = result["content"]["sha"]


class TelegramApiError(RuntimeError):
    """Telegram rejected a command with a definite HTTP status."""
    def __init__(self, method, code, description):
        super().__init__(f"Telegram {method} returned HTTP {code}")
        self.code = code
        self.description = description


def telegram_checked_call(api_base, method, payload=None):
    """Bot API errors are logged without showing secret-bearing request URLs."""
    try:
        return http_json(api_base + method,
                         "POST" if payload is not None else "GET", payload)
    except HTTPError as error:
        code = error.code
        try:
            details = json.loads(error.read().decode("utf-8", errors="replace"))
            description = str(details.get("description", ""))[:180]
        except (ValueError, AttributeError):
            description = ""
        # Never emit the bot token, headers or full Telegram API URL.
        print(f"::error::Telegram {method} returned HTTP {code}: {description}",
              file=sys.stderr)
        raise TelegramApiError(method, code, description) from None


def verify_telegram_identity(token, channel):
    """Read-only guard: validate exact bot and destination and posting permission."""
    if not token:
        raise RuntimeError("NASHANI_TELEGRAM_BOT_TOKEN is not configured")
    if str(channel) != str(EXPECTED_CHANNEL_ID):
        raise RuntimeError("Telegram channel ID does not match verified Nashani Tehran channel")
    api = "https://api.telegram.org/bot" + token + "/"
    me = telegram_checked_call(api, "getMe")
    bot = me.get("result") if me.get("ok") else None
    if not isinstance(bot, dict) or bot.get("username", "").lower() != EXPECTED_BOT_USERNAME:
        raise RuntimeError("Configured token does not belong to @neshanikermanbot")
    chat_result = telegram_checked_call(api, "getChat", {"chat_id": channel})
    chat = chat_result.get("result") if chat_result.get("ok") else None
    if (not isinstance(chat, dict)
            or str(chat.get("username", "")).lower() != "neshanitehran"
            or chat.get("type") != "channel"
            or str(chat.get("title", "")).strip() != EXPECTED_CHANNEL_TITLE):
        raise RuntimeError("Telegram destination is not the verified Nashani Tehran channel")
    member_result = telegram_checked_call(api, "getChatMember", {
        "chat_id": channel, "user_id": bot.get("id")
    })
    member = member_result.get("result") if member_result.get("ok") else None
    if not isinstance(member, dict) or member.get("status") not in {"administrator", "creator"}:
        raise RuntimeError("Bot is not an administrator of @neshanikerman")
    if member.get("status") == "administrator" and member.get("can_post_messages") is not True:
        raise RuntimeError("Bot is missing the Post Messages administrator permission")
    print("Nashani Telegram identity and Post Messages permission verified")
    return True


def send_to_telegram(item, token, channel):
    if not token or not channel:
        raise RuntimeError("Missing Nashani Telegram token or channel")
    if not is_local_news(item):
        raise ValueError("Rejected publication: news has no verified Tehran city geography")
    if is_promotional_story(item):
        raise ValueError("Rejected publication: source self-promotion or advertisement")
    visual_required = is_visual_story(item)
    media = item.get("media")
    if visual_required and (not item.get("media_repost_allowed") or not isinstance(media, dict)):
        raise MediaNotAvailable("Visual report requires authorized source media")
    if str(channel) != str(EXPECTED_CHANNEL_ID):
        raise ValueError("NASHANI_CHANNEL_ID must be the verified Tehran channel handle")
    verify_telegram_identity(token, channel)
    api = "https://api.telegram.org/bot" + token + "/"
    caption = telegram_message(item)
    if item.get("media_repost_allowed") and isinstance(media, dict):
        handle = item.get("source_handle", "")
        post_id = item.get("source_post_id", "")
        if re.fullmatch(r"[A-Za-z0-9_]{5,32}", handle) and str(post_id).isdigit():
            # copyMessage preserves native Telegram photos/videos and uses OUR
            # caption without exposing a forwarded-from header.
            try:
                copied = telegram_checked_call(api, "copyMessage", {
                    "chat_id": channel, "from_chat_id": "@" + handle,
                    "message_id": int(post_id), "caption": caption,
                    "parse_mode": "HTML",
                })
                if copied.get("ok"):
                    item["delivery_kind"] = media["kind"]
                    return copied["result"]["message_id"]
            except TelegramApiError as error:
                if error.code not in (400, 403):
                    raise
                lower_description = error.description.lower()
                if any(term in lower_description for term in (
                    "protected", "restricted", "can't be copied",
                    "cannot be copied", "content is protected",
                )):
                    print("Protected source media: using attributed text only")
                    media = None
        if media is not None:
            try:
                message_id = upload_public_media(token, channel, media, caption)
                item["delivery_kind"] = media["kind"]
                return message_id
            except MediaNotAvailable as error:
                if visual_required:
                    raise
                print(f"Media not available ({error}); using attributed text instead")
    if visual_required:
        raise MediaNotAvailable("Source photo/video could not be delivered; text-only blocked")
    result = telegram_checked_call(api, "sendMessage", {
        "chat_id": channel, "text": caption,
        "parse_mode": "HTML", "link_preview_options": {"is_disabled": True},
    })
    if result.get("ok") is not True:
        raise RuntimeError("Telegram rejected text message")
    item["delivery_kind"] = "text"
    return result["result"]["message_id"]


def check_and_publish(item, state, ledger, token, channel):
    if not is_local_news(item):
        raise ValueError("Manual approval rejected: news is unrelated to Tehran city")
    if is_promotional_story(item):
        raise ValueError("Manual approval cannot bypass the promotional-post filter")
    # Reserve first. A transport timeout can otherwise create duplicate posts.
    # Reject invalid bot credentials/permissions before reserving the story.
    verify_telegram_identity(token, channel)
    item["status"] = "sending_uncertain"
    ledger.save(state)
    try:
        msg_id = send_to_telegram(item, token, channel)
    except MediaNotAvailable:
        item["status"] = "review"
        item["review_reason"] = "visual_report_media_delivery_unavailable"
        ledger.save(state)
        raise
    except Exception:
        ledger.save(state)
        raise
    item["status"] = "published"
    item["telegram_message_id"] = msg_id
    item["sent_at"] = utcnow().isoformat()
    ledger.save(state)


def publish_batch(items, state, ledger, token, channel):
    """Reserve the entire outbound batch first, then save results in one commit.

    An uncertain network response leaves a post reserved, never eligible for
    automatic resending; later unattempted posts are returned to ready state.
    """
    if not items:
        return 0
    if any(is_promotional_story(item) for item in items):
        raise ValueError("Batch contains a promotional story")
    verify_telegram_identity(token, channel)
    stamp = utcnow().isoformat()
    for item in items:
        item["status"] = "sending_uncertain"
        item["reserved_at"] = stamp
    ledger.save(state)
    delivered = 0
    for position, item in enumerate(items):
        try:
            message_id = send_to_telegram(item, token, channel)
        except MediaNotAvailable:
            # Definitive no-send: hold the visual report for review, not text fallback.
            item["status"] = "review"
            item["review_reason"] = "visual_report_media_delivery_unavailable"
            continue
        except Exception:
            # This post may have reached Telegram: keep uncertain. Subsequent
            # posts were definitely not attempted, so they can be retried.
            for later in items[position + 1:]:
                later["status"] = "ready"
                later.pop("reserved_at", None)
            ledger.save(state)
            raise
        item["status"] = "published"
        item["telegram_message_id"] = message_id
        item["sent_at"] = utcnow().isoformat()
        delivered += 1
    ledger.save(state)
    print(f"Nashani published {delivered} messages in one batch")
    return delivered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", default="nashani_tehran/sources.json")
    parser.add_argument("--approve", default="", help="Specific reviewed story ID to publish")
    parser.add_argument("--check-connection", action="store_true", help="Read-only Bot API permission check; sends no message")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch previews without writing state or publishing")
    args = parser.parse_args()
    if args.check_connection:
        verify_telegram_identity(os.getenv("NASHANI_TELEGRAM_BOT_TOKEN", ""),
                                 os.getenv("NASHANI_CHANNEL_ID", ""))
        return
    sources = json.load(open(args.sources, encoding="utf-8"))["sources"]
    enabled = [s for s in sources if s.get("enabled")]
    source_map = {s["handle"].lower(): s for s in enabled}
    now = utcnow()
    ledger = None if args.dry_run else Ledger(os.getenv("GITHUB_TOKEN", ""))
    state = {"source_last_checked": {}} if args.dry_run else ledger.load()
    due = enabled if args.dry_run else [s for s in enabled if source_due(s, state, now)]
    results = []
    failed = []
    for source in due:
        try:
            posts = source_posts(source)
            if not posts:
                raise ValueError("Source returned no text posts")
            results.extend(posts)
            if not args.dry_run:
                state.setdefault("source_last_checked", {})[source["handle"].lower()] = now.isoformat()
            print(json.dumps({"source": source["handle"], "posts": len(posts)},
                             ensure_ascii=False))
        except Exception as error:
            failed.append(source["handle"])
            print(f"Source {source['handle']} failed: {type(error).__name__}", file=sys.stderr)
    if args.dry_run:
        relevant = [evaluate(dict(p), now, source_map.get(p["source_handle"].lower()))
                    for p in results]
        relevant = [p for p in relevant if p]
        print(json.dumps({"fetched": len(results), "eligible": len(relevant),
                          "source_errors": failed, "sample": relevant[:5]},
                         ensure_ascii=False, indent=2))
        return
    if not results and failed:
        raise RuntimeError("No news sources reachable: refusing to update state")
    if not state.get("initialized"):
        # User authorized first fresh Tehran post. Seed the history while
        # allowing precisely ONE newest eligible city story through.
        eligible_first = [p for p in results if evaluate(dict(p), now,
                          source_map.get(p["source_handle"].lower()))]
        eligible_first.sort(key=lambda p: p["published_at"] or "")
        first_url = eligible_first[-1]["url"] if eligible_first else None
        state["seen"] = sorted({p["url"] for p in results if p["url"] != first_url})
        state["initialized"] = True
        ledger.save(state)
        print(f"Initial Tehran baseline: {len(state['seen'])} old URLs; first eligible={bool(first_url)}")

    seen_list = list(state.get("seen", []))
    seen = set(seen_list)
    queue = state.setdefault("queue", [])
    new = []
    for post in sorted(results, key=lambda p: p["published_at"] or ""):
        if post["url"] in seen:
            continue
        seen.add(post["url"])
        seen_list.append(post["url"])
        policy = source_map.get(post["source_handle"].lower(), {})
        item = evaluate(dict(post), now, policy)
        if item is None:
            continue
        # Owner-approved media feeds preserve each distinct source post. 
        # Other outlets still deduplicate comparable headlines across sources.
        old = None if policy.get("priority_publish") else duplicate(item, queue)
        if old:
            if item["source"] != old["source"]:
                old.setdefault("other_sources", []).append({
                    "name": item["source"], "url": item["url"]})
            continue
        queue.append(item)
        new.append(item)
    excluded = enforce_geography_on_queue(queue)
    if excluded:
        print(f"Nashani geo filter excluded {excluded} previously queued unrelated stories")
    promoted = enforce_promotion_on_queue(queue)
    if promoted:
        print(f"Nashani promotion filter excluded {promoted} queued ads/subscribe posts")
    # Sync source rights after registry updates; never grant rights not in sources.json.
    for item in queue:
        if item.get("status") not in {"ready", "review"}:
            continue
        policy = source_map.get(item.get("source_handle", "").lower(), {})
        item["media_repost_allowed"] = bool(policy.get("media_repost_allowed", False))
        if (item.get("review_reason") == "visual_report_requires_authorized_media"
                and item["media_repost_allowed"] and isinstance(item.get("media"), dict)
                and not is_sensitive(item.get("title", "") + " " + item.get("excerpt", ""))
                and not policy.get("review_only")):
            item["status"] = "ready"
            item.pop("review_reason", None)
    # Recency order matters: lexicographic URL sorting would forget recent IDs.
    state["seen"] = seen_list[-5000:]
    if len(queue) > 300:
        state["queue"] = queue[-300:]
        queue = state["queue"]
    ledger.save(state)
    print(json.dumps({"new": len(new), "review": sum(i["status"] == "review" for i in new),
                      "ready": sum(i["status"] == "ready" for i in new),
                      "failures": failed}, ensure_ascii=False))

    publishing = os.getenv("NASHANI_PUBLISH_ENABLED", "").lower() == "true"
    token = os.getenv("NASHANI_TELEGRAM_BOT_TOKEN", "")
    channel = os.getenv("NASHANI_CHANNEL_ID", "")
    if args.approve:
        if not publishing:
            raise RuntimeError("Publishing disabled; no channel messages sent")
        matches = [x for x in queue if x.get("id") == args.approve]
        if len(matches) != 1 or matches[0].get("status") not in {"review", "ready"}:
            raise ValueError("Approval ID missing, duplicated or already sent")
        if not is_local_news(matches[0]):
            raise ValueError("Manual approval cannot bypass the Tehran city geographic filter")
        check_and_publish(matches[0], state, ledger, token, channel)
    elif publishing:
        # Read from the persistent queue, not only this run's fresh discoveries.
        # This drains Kerman-No's half-hour intake over subsequent five-minute
        # runs without losing safe stories when GitHub has transient errors.
        ready = []
        for item in queue:
            if item.get("status") != "ready":
                continue
            published = parse_time(item.get("published_at"))
            if not published or now - published > MAX_AGE:
                item["status"] = "expired"
                item["review_reason"] = "old_news_not_sent"
            else:
                ready.append(item)
        priority = [x for x in ready if source_map.get(x["source_handle"].lower(), {}).get("priority_publish") or source_map.get(x["source_handle"].lower(), {}).get("coverage") == "all"]
        other = [x for x in ready if x not in priority]
        priority.sort(key=lambda p: p.get("published_at") or "")
        other.sort(key=lambda p: p.get("published_at") or "")
        # Six priority posts from Kerman-No, Kerman News and qh_qv combined,
        # plus two from other outlets. Remaining safe posts stay queued.
        selected = sorted(priority[:6] + other[:2], key=lambda p: p.get("published_at") or "")
        publish_batch(selected, state, ledger, token, channel)
    else:
        print("Safe preview mode: outbound publishing DISABLED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never print full Telegram request URL: it contains a secret bot token.
        print(f"::error::Nashani radar failed ({type(exc).__name__})", file=sys.stderr)
        sys.exit(1)
