#!/usr/bin/env python3
"""Nashani Kerman local-news intake and opt-in Telegram publisher.

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

REPO = os.getenv("GITHUB_REPOSITORY", "nimania/pendar")
BRANCH = "nashani-state"
EXPECTED_BOT_USERNAME = "neshanikermanbot"
EXPECTED_CHANNEL_ID = -1003958286892
EXPECTED_CHANNEL_TITLE = "نشانی: کرمان"
STATE_PATH = "nashani/state.json"
USER_AGENT = "NashaniKermanRadar/1.0 (public-source monitoring)"
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
    clean = normalize(text)
    if city_relevance(text) != "reject":
        return "high"
    if any(normalize(term) in clean for term in REGIONAL_PLACES + REGIONAL_WITH_CONTEXT):
        return "high"
    return "reject"


def looks_like_advertisement(text):
    clean = normalize(text)
    return any(normalize(term) in clean for term in ADVERTISING_MARKERS)


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
    coverage = source.get("coverage", "city")
    full_feed = coverage == "all"
    relevance = regional_relevance(body) if coverage == "region" else city_relevance(body)
    if relevance == "reject" and not full_feed:
        return None
    if full_feed and relevance == "reject":
        relevance = "source_full_feed"
    if looks_like_advertisement(body):
        return None
    sensitive = is_sensitive(body)
    item["id"] = story_id(item["url"])
    item["media_repost_allowed"] = bool(source.get("media_repost_allowed", False))
    item["source_hashtag"] = source.get("source_hashtag", "")
    item["risk"] = "sensitive" if sensitive else "ordinary"
    item["city_confidence"] = relevance
    item["status"] = "review" if sensitive or not item.get("paragraphs", [item["excerpt"]]) or source.get("review_only") or (not full_feed and relevance != "high") else "ready"
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
        raise RuntimeError("Telegram channel ID does not match verified Nashani Kerman channel")
    api = "https://api.telegram.org/bot" + token + "/"
    me = telegram_checked_call(api, "getMe")
    bot = me.get("result") if me.get("ok") else None
    if not isinstance(bot, dict) or bot.get("username", "").lower() != EXPECTED_BOT_USERNAME:
        raise RuntimeError("Configured token does not belong to @neshanikermanbot")
    chat_result = telegram_checked_call(api, "getChat", {"chat_id": channel})
    chat = chat_result.get("result") if chat_result.get("ok") else None
    if (not isinstance(chat, dict)
            or chat.get("id") != EXPECTED_CHANNEL_ID
            or chat.get("type") != "channel"
            or str(chat.get("title", "")).strip() != EXPECTED_CHANNEL_TITLE):
        raise RuntimeError("Telegram destination is not the verified Nashani Kerman channel")
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
    if str(channel) != str(EXPECTED_CHANNEL_ID):
        raise ValueError("NASHANI_CHANNEL_ID must be the verified numeric channel ID")
    verify_telegram_identity(token, channel)
    api = "https://api.telegram.org/bot" + token + "/"
    caption = telegram_message(item)
    media = item.get("media")
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
                print(f"Media not available ({error}); using attributed text instead")
    result = telegram_checked_call(api, "sendMessage", {
        "chat_id": channel, "text": caption,
        "parse_mode": "HTML", "link_preview_options": {"is_disabled": True},
    })
    if result.get("ok") is not True:
        raise RuntimeError("Telegram rejected text message")
    item["delivery_kind"] = "text"
    return result["result"]["message_id"]


def check_and_publish(item, state, ledger, token, channel):
    # Reserve first. A transport timeout can otherwise create duplicate posts.
    # Reject invalid bot credentials/permissions before reserving the story.
    verify_telegram_identity(token, channel)
    item["status"] = "sending_uncertain"
    ledger.save(state)
    try:
        msg_id = send_to_telegram(item, token, channel)
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
    parser.add_argument("--sources", default="nashani/sources.json")
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
        state["seen"] = sorted({p["url"] for p in results})
        state["initialized"] = True
        ledger.save(state)
        print(f"Initial baseline: {len(state['seen'])} URLs, no historic news published")
        return

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
