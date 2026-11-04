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
import unicodedata
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

REPO = os.getenv("GITHUB_REPOSITORY", "nimania/pendar")
BRANCH = "nashani-state"
STATE_PATH = "nashani/state.json"
USER_AGENT = "NashaniKermanRadar/1.0 (public-source monitoring)"
MAX_AGE = timedelta(hours=5)
SENSITIVE = (
    "کشته", "کشته‌شد", "جان باخت", "جان‌باخت", "مجروح", "تلفات",
    "بازداشت", "قتل", "تجاوز", "اتهام", "دستگیری", "انفجار",
    "ترور", "حمله", "اعدام", "آدم ربایی", "خودکشی",
    "مفقود", "درگیری", "انتحاری", "بمب", "موشک", "زلزله",
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
        if message is None:
            continue
        lines = [line.strip() for line in message.get_text("\n", strip=True).splitlines()]
        lines = [line for line in lines if line]
        if not lines:
            continue
        stamp = element.select_one(".tgme_widget_message_date time[datetime]")
        if stamp is None:
            stamp = element.select_one("time[datetime]")
        when = parse_time(stamp.get("datetime")) if stamp else None
        title = short_text(lines[0], 140)
        body = short_text(" ".join(lines), 720)
        if len(normalize(body)) < 20:
            continue
        result.append({
            "url": "https://t.me/" + ident,
            "title": title,
            "excerpt": body,
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


def evaluate(item, now):
    stamp = parse_time(item["published_at"])
    if not stamp or stamp > now + timedelta(minutes=5) or now - stamp > MAX_AGE:
        return None
    relevance = city_relevance(item["title"] + " " + item["excerpt"])
    if relevance == "reject":
        return None
    sensitive = is_sensitive(item["title"] + " " + item["excerpt"])
    item["id"] = story_id(item["url"])
    item["risk"] = "sensitive" if sensitive else "ordinary"
    item["city_confidence"] = relevance
    item["status"] = "review" if sensitive or relevance != "high" else "ready"
    item["detected_at"] = now.isoformat()
    item["other_sources"] = []
    return item


def telegram_message(item):
    title = html.escape(short_text(item["title"], 125))
    lead = item["excerpt"]
    if normalize(lead).startswith(normalize(item["title"])):
        lead = lead[len(item["title"]):].strip(" :؛-—|")
    lead = html.escape(short_text(lead, 460) or item["title"])
    source = html.escape(item["source"])
    link = html.escape(item["url"], quote=True)
    return (f"📍 <b>نشانی | کرمان</b>\n\n"
            f"<b>{title}</b>\n\n"
            f"به گزارش «{source}»: {lead}\n\n"
            f"🔗 <a href=\"{link}\">منبع و متن اصلی</a>\n"
            f"#کرمان #نشانی_کرمان")


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
        result = http_json(self.endpoint(), method="PUT", payload=payload, token=self.token)
        self.sha = result["content"]["sha"]


def send_to_telegram(item, token, channel):
    if not token or not channel:
        raise RuntimeError("Missing Nashani Telegram token or channel")
    # Require explicit channel selection. Never fall back to @pendario.
    if not (re.fullmatch(r"@[A-Za-z0-9_]{5,32}", channel)
            or re.fullmatch(r"-100\d{6,}", channel)):
        raise ValueError("NASHANI_CHANNEL_ID must be an @handle or numeric channel ID")
    url = "https://api.telegram.org/bot" + token + "/sendMessage"
    response = http_json(url, method="POST", payload={
        "chat_id": channel, "text": telegram_message(item),
        "parse_mode": "HTML", "link_preview_options": {"is_disabled": True},
    })
    if response.get("ok") is not True:
        raise RuntimeError("Telegram rejected message")
    return response["result"].get("message_id")


def check_and_publish(item, state, ledger, token, channel):
    # Reserve first. A transport timeout can otherwise create duplicate posts.
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", default="nashani/sources.json")
    parser.add_argument("--approve", default="", help="Specific reviewed story ID to publish")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch previews without writing state or publishing")
    args = parser.parse_args()
    sources = json.load(open(args.sources, encoding="utf-8"))["sources"]
    enabled = [s for s in sources if s.get("enabled")]
    now = utcnow()
    results = []
    failed = []
    for source in enabled:
        try:
            posts = source_posts(source)
            results.extend(posts)
            print(json.dumps({"source": source["handle"], "posts": len(posts)},
                             ensure_ascii=False))
        except Exception as error:
            failed.append(source["handle"])
            print(f"Source {source['handle']} failed: {type(error).__name__}", file=sys.stderr)
    if args.dry_run:
        relevant = [evaluate(dict(p), now) for p in results]
        relevant = [p for p in relevant if p]
        print(json.dumps({"fetched": len(results), "eligible": len(relevant),
                          "source_errors": failed, "sample": relevant[:5]},
                         ensure_ascii=False, indent=2))
        return
    if not results and failed:
        raise RuntimeError("No news sources reachable: refusing to update state")
    ledger = Ledger(os.getenv("GITHUB_TOKEN", ""))
    state = ledger.load()
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
        item = evaluate(dict(post), now)
        if item is None:
            continue
        old = duplicate(item, queue)
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
        for item in new:
            if item.get("status") == "ready":
                check_and_publish(item, state, ledger, token, channel)
    else:
        print("Safe preview mode: outbound publishing DISABLED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never print full Telegram request URL: it contains a secret bot token.
        print(f"::error::Nashani radar failed ({type(exc).__name__})", file=sys.stderr)
        sys.exit(1)
