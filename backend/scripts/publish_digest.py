"""Post a periodic digest of the top news and figure statements to Telegram.

Runs on every build but only actually posts once per DIGEST_INTERVAL_HOURS,
gated by a small timestamp kept on the telegram-state branch. It reuses the
Telegram client and GitHub-backed state ledger from publish_figures. The slot
timestamp is reserved before sending, so a transient failure skips one window
rather than risking a duplicate digest.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:  # as a package import (tests) or as a standalone script (CI workflow)
    from backend.scripts.publish_figures import GitHubLedger, Telegram, clipped
except ImportError:
    from publish_figures import GitHubLedger, Telegram, clipped

SITE = os.environ.get("SITE_URL", "https://pendar.io").rstrip("/")
DIGEST_STATE_PATH = "telegram/digest-state.json"
DIGEST_INTERVAL_HOURS = int(os.environ.get("DIGEST_INTERVAL_HOURS", "8"))
MAX_NEWS = int(os.environ.get("DIGEST_MAX_NEWS", "5"))
MAX_VOICES = int(os.environ.get("DIGEST_MAX_VOICES", "4"))

_CATEGORY_EMOJI = {
    "iran": "🇮🇷", "world": "🌍", "politics": "🏛", "economy": "💰",
    "technology": "💻", "ai": "🤖", "culture": "🎭", "sport": "⚽",
    "science": "🔬", "environment": "🌱", "entertainment": "🎬", "health": "🩺",
}


def _fa_num(value):
    return str(value).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))


def _parse_time(value):
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _recent(items, now, hours, time_key):
    cutoff = now - timedelta(hours=hours)
    out = []
    for item in items:
        when = _parse_time(item.get(time_key))
        if when and when >= cutoff:
            out.append(item)
    return out


def _link(label, url):
    return f'<a href="{html.escape(url, quote=True)}">{html.escape(label)}</a>'


def top_stories(stories, now, hours):
    recent = _recent(stories, now, hours, "published_at")
    recent.sort(key=lambda s: s.get("importance_score") or 0, reverse=True)
    return recent[:MAX_NEWS]


def top_voices(figures, now, hours):
    posts = []
    for fig in figures:
        for post in fig.get("posts", []):
            if post.get("kind") not in {"analysis", "party_claim"}:
                continue
            if not str(post.get("summary_fa") or "").strip():
                continue
            posts.append(post)
    recent = _recent(posts, now, hours, "published_at")
    recent.sort(key=lambda p: _parse_time(p.get("published_at")) or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True)
    # One statement per figure keeps the digest varied.
    seen, picked = set(), []
    for post in recent:
        handle = post.get("handle") or ""
        if handle in seen:
            continue
        seen.add(handle)
        picked.append(post)
        if len(picked) >= MAX_VOICES:
            break
    return picked


def build_digest(figures_data, stories_data, now, hours=DIGEST_INTERVAL_HOURS, site=SITE):
    """Return the HTML digest text, or None when there is nothing worth sending."""
    figures = (figures_data or {}).get("figures", []) if isinstance(figures_data, dict) else []
    stories = stories_data if isinstance(stories_data, list) else []
    news = top_stories(stories, now, hours)
    voices = top_voices(figures, now, hours)
    if not news and not voices:
        return None

    lines = [f"📊 <b>جمع‌بندی {_fa_num(hours)} ساعت گذشتهٔ پندار</b>", ""]
    if news:
        lines.append("📰 <b>مهم‌ترین خبرها</b>")
        for s in news:
            emoji = _CATEGORY_EMOJI.get(str(s.get("category") or ""), "•")
            headline = clipped(str(s.get("headline_fa") or "خبر").strip(), 110)
            url = f"{site}/s/{s.get('id')}/"
            count = s.get("source_count") or 0
            tail = f" <i>({_fa_num(count)} منبع)</i>" if count else ""
            lines.append(f"{emoji} {_link(headline, url)}{tail}")
        lines.append("")
    if voices:
        lines.append("🗣 <b>تازه‌ترین گفته‌های چهره‌ها</b>")
        for p in voices:
            name = html.escape(clipped(str(p.get("name_fa") or "").strip(), 60))
            topic = clipped(str(p.get("topic_fa") or "دیدگاه تازه").strip(), 90)
            handle = str(p.get("handle") or "")
            url = f"{site}/#/figure/{handle}" if handle else (p.get("url") or site)
            lines.append(f"• <b>{name}</b> — {_link(topic, url)}")
        lines.append("")
    lines.append(_link("مرور کامل در پندار ←", f"{site}/"))
    return "\n".join(lines).strip()


def digest_payload(text, chat_id):
    return {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
            "disable_web_page_preview": True}


def publish_digest(figures_data, stories_data, ledger, telegram, chat_id, *,
                   now=None, hours=DIGEST_INTERVAL_HOURS, force=False):
    now = now or datetime.now(timezone.utc)
    state = ledger.load() or {}
    last = _parse_time(state.get("last_digest_at"))
    if not force and last and (now - last) < timedelta(hours=hours):
        due_in = timedelta(hours=hours) - (now - last)
        print(f"Digest not due yet (next in ~{int(due_in.total_seconds() // 60)} min)")
        return {"sent": 0, "reason": "not_due"}
    text = build_digest(figures_data, stories_data, now, hours=hours)
    if not text:
        print("Digest has no news or voices in the window; nothing to send")
        return {"sent": 0, "reason": "empty"}
    # Reserve the slot before sending so a failure skips this window, not duplicates it.
    ledger.save({"version": 1, "last_digest_at": now.isoformat()})
    telegram.call("sendMessage", digest_payload(text, chat_id))
    print("Digest sent")
    return {"sent": 1, "reason": "ok"}


def _load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--figures", required=True, type=Path)
    parser.add_argument("--stories", required=True, type=Path)
    parser.add_argument("--hours", type=int, default=DIGEST_INTERVAL_HOURS)
    parser.add_argument("--force", action="store_true", help="Ignore the interval gate")
    parser.add_argument("--dry-run", action="store_true", help="Preview only; no API calls or state writes")
    args = parser.parse_args(argv)
    figures_data = _load(args.figures) if args.figures.exists() else {}
    stories_data = _load(args.stories) if args.stories.exists() else []
    if args.dry_run:
        text = build_digest(figures_data, stories_data, datetime.now(timezone.utc), hours=args.hours)
        print(text or "(nothing to send in this window)")
        return 0
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print("::notice::Telegram is not enabled: add the TELEGRAM_BOT_TOKEN repository secret")
        return 0
    gh_token = os.environ.get("GH_TOKEN", "").strip()
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    if not gh_token or not repository:
        raise RuntimeError("GitHub repository and delivery-state credentials are required")
    telegram = Telegram(token)
    chat_id = telegram.verify(os.environ.get("TELEGRAM_BOT_USERNAME", "janekalaam_bot"),
                              os.environ.get("TELEGRAM_CHAT_ID", "@pendario"))
    ledger = GitHubLedger(repository, gh_token, path=DIGEST_STATE_PATH)
    result = publish_digest(figures_data, stories_data, ledger, telegram, chat_id,
                            hours=args.hours, force=args.force)
    print("Telegram digest: " + json.dumps(result))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError, KeyError, TypeError):
        print("::error::Telegram digest failed. Check bot/channel permissions and state.",
              file=sys.stderr)
        sys.exit(1)
