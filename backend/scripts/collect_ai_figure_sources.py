#!/usr/bin/env python3
"""Collect public Telegram posts for manual editorial review. Never publish."""
import argparse
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "backend/data/ai-figure-sources.json"
OUTPUT = ROOT / "ai-figure-intake.json"

class TelegramParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.posts = []
        self.current = None
        self.capture = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        css = a.get("class", "").split()
        if tag == "div" and "tgme_widget_message" in css and a.get("data-post"):
            self.current = {"post_id": a["data-post"], "text": "", "published_at": None}
        if self.current is None:
            return
        if tag == "div" and "tgme_widget_message_text" in css:
            self.capture += 1
        elif self.capture and tag == "div":
            self.capture += 1
        if tag == "time" and a.get("datetime"):
            self.current["published_at"] = a["datetime"]
        if tag == "br" and self.capture:
            self.current["text"] += "\n"

    def handle_data(self, data):
        if self.current is not None and self.capture:
            self.current["text"] += data

    def handle_endtag(self, tag):
        if tag == "div" and self.capture:
            self.capture -= 1
        # All published messages are finalized when a new message begins or parsing ends.

AI_TERMS = ("هوش مصنوعی", "یادگیری ماشین", "مدل زبانی", "مدل‌های زبانی",
            "یادگیری عمیق", "شبکه عصبی", "عامل هوشمند", "چت‌بات",
            "machine learning", "deep learning", "artificial intelligence",
            "llm", "openai", "chatgpt", "claude", "gemini", "deepseek",
            "qwen", "transformer", "agentic", "agents", "copilot")

def relevant_ai(text):
    normalized = " ".join(text.casefold().replace("ي", "ی").replace("ك", "ک").split())
    return any(term in normalized for term in AI_TERMS)

def collect(source, timeout=15):
    url = source["url"]
    if not re.fullmatch(r"https://t[.]me/s/[A-Za-z0-9_]+", url):
        raise ValueError("Unapproved Telegram endpoint")
    req = urllib.request.Request(url, headers={"User-Agent": "PendarFigureIntake/1.0 (public source review)"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        html = response.read(2_000_000).decode("utf-8", errors="replace")
    # Use BeautifulSoup for robust extraction of nested Telegram cards.
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    result = []
    for node in soup.select(".tgme_widget_message[data-post]"):
        post_id = node.get("data-post", "")
        text_node = node.select_one(".tgme_widget_message_text")
        if not post_id or not text_node:
            continue
        body = text_node.get_text(" ", strip=True)[:12000]
        if not body:
            continue
        time_node = node.select_one("time[datetime]")
        date = time_node.get("datetime") if time_node else None
        message_url = "https://t.me/" + post_id.lstrip("@")
        fingerprint = hashlib.sha256((source["figure"] + "\n" + message_url).encode()).hexdigest()[:20]
        result.append({"id": fingerprint, "figure": source["figure"],
                       "source": source["label"], "url": message_url,
                       "published_at": date, "text": body,
                       "status": "pending_editorial_review",
                       "ai_relevance": "candidate" if relevant_ai(body) else "other_topic",
                       "needs_human_topic_review": True})
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=OUTPUT)
    args = ap.parse_args()
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))["sources"]
    pending, errors, seen = [], [], set()
    # Exclude links that have already passed through the curated figure archive.
    curated_path = ROOT / "web-static/data/pendar-editorial-views.json"
    if curated_path.exists():
        for entry in json.loads(curated_path.read_text(encoding="utf-8")):
            for post in entry.get("posts", []):
                link = str(post.get("url") or "")
                if link:
                    seen.add(hashlib.sha256((entry.get("profile", {}).get("handle", "") + chr(10) + link).encode()).hexdigest()[:20])
    for source in sources:
        try:
            for item in collect(source):
                if item["id"] not in seen:
                    pending.append(item)
                    seen.add(item["id"])
        except Exception as exc:
            errors.append({"figure": source["figure"], "error": str(exc)[:200]})
    report = {"checked_at": datetime.now(timezone.utc).isoformat(),
              "publication_enabled": False,
              "ai_candidates": sum(x["ai_relevance"] == "candidate" for x in pending),
              "pending": pending, "errors": errors}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Queued {len(pending)} public posts; {len(errors)} source errors. No publication.")
    return 0 if not errors else 1

if __name__ == "__main__":
    raise SystemExit(main())
