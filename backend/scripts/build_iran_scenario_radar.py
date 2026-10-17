"""Create the Iran scenario candidate ledger from Pendar's published news and figure views.

Only reuses inputs already collected by Pendar. Automatic candidates are explicitly
unreviewed and neutral (direction=0); mention frequency is NOT a probability,
verification, or directional signal. Preserve the user's legacy ledger and the
previously published automatic records across fast GitHub Pages deployments.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re

FAMILIES = ("deal", "regroup", "war", "transition", "attrition", "recovery")
TERMS = {
    "deal": (r"مذاکر", r"توافق", r"دیپلماسی", r"آتش\s*بس", r"ترک\s*مخاصمه"),
    "regroup": (r"سرکوب", r"انقباض\s*سیاسی", r"اقتدارگرای", r"قلعه\s*خاموش", r"تصفیه\s*سیاسی"),
    "war": (r"جنگ", r"بمباران", r"حمله\s*(?:نظامی|هوایی|موشکی)", r"درگیری\s*نظامی", r"موشک"),
    "transition": (r"سرنگونی", r"گذار\s*(?:سیاسی|قدرت|از|حکومت)", r"فروپاشی", r"تغییر\s*نظام", r"دولت\s*موقت"),
    "attrition": (r"تورم", r"تحریم", r"ارزش\s*ریال", r"کاهش\s*ارزش\s*پول", r"بحران\s*اقتصادی", r"فرسایش", r"محاصره\s*دریایی"),
    "recovery": (r"چرخش\s*به\s*شرق", r"پساترامپ", r"بازسازی\s*اقتصاد", r"وام\s*روسیه", r"تفاهم\s*با\s*چین"),
}
IRAN = re.compile(r"ایران|ایرانی|جمهوری\s*اسلامی|تهران|ریال|سپاه|حکومت\s*اسلامی")
MAX_NEW_PER_RUN = 30
MAX_AUTO_HISTORY = 1500
MAX_INPUT_AGE = timedelta(days=14)


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError):
        return default


def normalize(value):
    return re.sub(r"\s+", " ", str(value or "").replace("ي", "ی")
                  .replace("ك", "ک").replace("\u200c", " ")).strip()


def date_and_ms(value):
    if not value:
        return None
    try:
        day = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if day.tzinfo is None:
            day = day.replace(tzinfo=timezone.utc)
        day = day.astimezone(timezone.utc)
        return (day.date().isoformat(), int(day.timestamp() * 1000), day)
    except (TypeError, ValueError, OverflowError):
        return None


def classify(text):
    value = normalize(text)
    if not IRAN.search(value):
        return None
    hits = {key: sum(bool(re.search(pattern, value)) for pattern in patterns)
            for key, patterns in TERMS.items()}
    ranked = sorted(hits.items(), key=lambda kv: kv[1], reverse=True)
    if not ranked or ranked[0][1] == 0 or (len(ranked) > 1 and ranked[0][1] == ranked[1][1]):
        return None
    return ranked[0][0]


def make_candidate(row, kind, now):
    raw = row.get("published_at") or row.get("date")
    parsed = date_and_ms(raw)
    if parsed is None:
        return None
    date, ts, moment = parsed
    if moment > now + timedelta(hours=1) or now - moment > MAX_INPUT_AGE:
        return None
    if kind == "figure":
        if row.get("kind") not in ("analysis", "party_claim"):
            return None
        text = normalize(row.get("summary_fa") or row.get("topic_fa"))
        url = str(row.get("url") or "")
        name = normalize(row.get("person_name_fa") or row.get("name_fa") or row.get("_figure_name"))
        source = name or "دیدگاه ثبت‌شده در پندار"
        label = "دیدگاه تحلیل‌گر؛ تأیید رویداد نیست"
        identity = url or str(row.get("id") or "")
    else:
        text = normalize(row.get("headline_fa") or row.get("title_fa") or row.get("title"))
        summary = normalize(row.get("summary_fa"))
        name_list = row.get("source_names")
        source = "، ".join(str(x) for x in name_list[:3]) if isinstance(name_list, list) else "خبر ثبت‌شده در پندار"
        label = "سرخط گردآوری‌شده؛ راستی‌آزمایی مستقل نشده"
        identity = str(row.get("id") or "")
        url = "/story/" + identity + "/" if re.fullmatch(r"[0-9a-fA-F-]{8,64}", identity) else ""
    family = classify(text + " " + (summary if kind == "story" else ""))
    if not family or not text or not identity:
        return None
    fingerprint = hashlib.sha256((kind + "|" + identity + "|" + family).encode("utf-8")).hexdigest()[:18]
    return {
        "id": "auto-" + fingerprint, "date": date, "ts": ts,
        "family": family, "direction": 0, "weight": 1,
        "text": text[:500], "source": source[:180],
        "source_url": url, "source_type": kind, "by": "pendar-auto",
        "review_status": "unreviewed", "review_note": label,
    }


def build(site: Path, seed: Path, now=None):
    now = now or datetime.now(timezone.utc)
    data = site / "data"
    if not (data / "stories.json").is_file() or not (data / "figures.json").is_file():
        raise ValueError("Pendar's published news/figure inputs are missing")
    stories = read_json(data / "stories.json", [])
    figures = read_json(data / "figures.json", {})
    if not isinstance(stories, list) or not isinstance(figures, dict):
        raise ValueError("Malformed published Pendar input")
    legacy = read_json(seed, [])
    previous = read_json(data / "iran-scenario-signals.json", [])
    if not isinstance(legacy, list) or not isinstance(previous, list):
        raise ValueError("Malformed scenario ledger")
    # Restore existing ledger before discovering anything new. Never delete
    # historical/manual records because a news source has become unavailable.
    combined = {}
    for entry in legacy + previous:
        if isinstance(entry, dict) and entry.get("id") and entry.get("family") in FAMILIES:
            combined[str(entry["id"])] = entry
    candidates = []
    for story in stories:
        if isinstance(story, dict):
            candidate = make_candidate(story, "story", now)
            if candidate:
                candidates.append(candidate)
    for figure in figures.get("figures", []):
        if not isinstance(figure, dict):
            continue
        for post in figure.get("posts", []):
            if isinstance(post, dict):
                record = {**post, "_figure_name": figure.get("name_fa")}
                candidate = make_candidate(record, "figure", now)
                if candidate:
                    candidates.append(candidate)
    candidates.sort(key=lambda s: (s["ts"], s["id"]), reverse=True)
    added = 0
    for candidate in candidates:
        if candidate["id"] not in combined and added < MAX_NEW_PER_RUN:
            combined[candidate["id"]] = candidate
            added += 1
    # Bound the public payload without removing the original authored records.
    originals = [x for x in combined.values() if x.get("by") != "pendar-auto"]
    automatic = [x for x in combined.values() if x.get("by") == "pendar-auto"]
    automatic.sort(key=lambda x: (int(x.get("ts") or 0), str(x.get("id") or "")), reverse=True)
    result = originals + automatic[:MAX_AUTO_HISTORY]
    result.sort(key=lambda x: (int(x.get("ts") or 0), str(x.get("id") or "")), reverse=True)
    data.mkdir(parents=True, exist_ok=True)
    destination = data / "iran-scenario-signals.json"
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta = {"generated_at": now.isoformat(), "total": len(result),
            "automatic_candidates": min(len(automatic), MAX_AUTO_HISTORY),
            "new_candidates": added, "auto_direction_policy": "neutral_until_editorial_review",
            "sources": ["Pendar published headlines", "Pendar attributed figure posts"]}
    (data / "iran-scenario-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Iran scenario ledger: {len(result)} records, {added} new unreviewed candidates")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--seed", type=Path, default=Path("web-static/data/iran-scenario-seed.json"))
    args = parser.parse_args()
    build(args.site, args.seed)


if __name__ == "__main__":
    main()
