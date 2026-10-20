"""Publish every newly published, substantive Pendar Trends page to @pendario.

Uses the existing authenticated Telegram client and durable GitHub ledger on
telegram-state. A URL is reserved BEFORE delivery so uncertain network results
cannot produce duplicate channel messages. No arbitrary daily cap.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

try:
    from backend.scripts.publish_figures import Telegram, GitHubLedger, DeliveryUncertain, TelegramRejected
except ImportError:
    from publish_figures import Telegram, GitHubLedger, DeliveryUncertain, TelegramRejected

STATE_PATH = "telegram/trends-state.json"
SITE = "https://pendar.io"
SECTIONS = ("reports", "briefs", "subjects")


def candidates(data):
    if not isinstance(data, dict):
        raise ValueError("Invalid trends dataset")
    rows = []
    seen = set()
    for section in SECTIONS:
        source = data.get(section) or []
        if not isinstance(source, list):
            raise ValueError("Invalid trends section: " + section)
        for item in source:
            if not isinstance(item, dict):
                continue
            path = str(item.get("url") or "").strip()
            title = str(item.get("title") or item.get("title_fa") or "").strip()
            lead = str(item.get("lead_fa") or item.get("description") or item.get("summary_fa") or "").strip()
            parsed = urlsplit(path)
            if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
                continue
            if not path.startswith("/trends/") or not path.endswith("/"):
                continue
            if not (path.startswith("/trends/report/") or path.startswith("/trends/topic/") or path.startswith("/trends/subject/")):
                continue
            if not title or path in seen:
                continue
            seen.add(path)
            rows.append({"url": SITE + path, "key": path, "title": title, "lead": lead})
    return rows


def message(row):
    lead = row["lead"].replace("\n", " ").strip()
    if len(lead) > 420:
        lead = lead[:417].rsplit(" ", 1)[0] + "…"
    title = html.escape(row["title"])
    description = "\n\n" + html.escape(lead) if lead else ""
    link = html.escape(row["url"], quote=True)
    return f'📈 <b>ترندهای پندار</b>\n\n<b>{title}</b>{description}\n\n<a href="{link}">متن کامل در پندار ←</a>'


def publish(data, ledger, telegram, chat_id, dry_run=False):
    rows = candidates(data)
    if dry_run:
        for row in rows:
            print(message(row) + "\n----")
        print("Eligible trends:", len(rows))
        return len(rows)

    state = ledger.load()
    if state is None:
        state = {"version": 1, "seen": []}
    seen = set(state.get("seen") or [])
    sent = 0
    for row in rows:
        key = row["key"]
        if key in seen:
            continue
        # Reserve before calling the Telegram API: uncertain outcomes require
        # manual review instead of potentially duplicating a sent post.
        seen.add(key)
        state["seen"] = sorted(seen)
        ledger.save(state)
        try:
            telegram.call("sendMessage", {
                "chat_id": chat_id, "text": message(row),
                "parse_mode": "HTML", "disable_web_page_preview": False,
            })
        except (DeliveryUncertain, TelegramRejected):
            print("::error::Trend delivery failed/uncertain; reserved URL requires manual review:", key)
            raise
        sent += 1
        print("Published trend:", key)
    return sent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--trends", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    data = json.loads(args.trends.read_text(encoding="utf-8"))
    if args.dry_run:
        publish(data, None, None, None, dry_run=True)
        return
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    gh = os.environ.get("GH_TOKEN", "").strip()
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if not token or not gh or not repo:
        raise RuntimeError("Telegram token or GitHub ledger credentials missing")
    telegram = Telegram(token)
    chat = telegram.verify(os.environ.get("TELEGRAM_BOT_USERNAME", "janekalaam_bot"),
                           os.environ.get("TELEGRAM_CHAT_ID", "@pendario"))
    print("Trends published:", publish(data, GitHubLedger(repo, gh, path=STATE_PATH), telegram, chat))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("::error::Telegram trend publisher failed:", type(exc).__name__, file=sys.stderr)
        sys.exit(1)
