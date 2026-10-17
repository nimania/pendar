"""Create the Iran scenario candidate ledger from Pendar's published news and figure views.

Only reuses inputs already collected by Pendar. Only explicitly directional patterns are scored automatically, with smaller weights
for attributed analysis; ambiguous stories remain neutral. Scores are not probabilities
or independently verified facts. Preserve the user's legacy ledger and the
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
MAX_AUTO_HISTORY = 5000
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



# Conservative, inspectable event rules. A keyword by itself NEVER changes scores.
# Headlines reporting what someone predicts/claims are not factual event evidence.
EVENT_RULES = {
    "deal": (
        (r"امضای? (?:توافق|تفاهم)", r"توافق (?:نهایی|امضا|حاصل|اجرایی) شد",
         r"مذاکرات? (?:مستقیم|رسمی) (?:آغاز|از سر گرفته) شد", r"آتش بس (?:برقرار|اجرا) شد"),
        (r"مذاکرات? (?:شکست خورد|متوقف|لغو) شد", r"شکست (?:مذاکرات|گفتگوها)",
         r"توافق (?:ایران )?(?:لغو|متوقف) شد", r"از مذاکرات خارج شد"),
    ),
    "regroup": (
        (r"موج (?:جدید )?بازداشت", r"تشدید (?:سرکوب|بازداشت)",
         r"محدودیت های? (?:سیاسی|رسانه ای) (?:تشدید|افزایش) یافت"),
        (r"آزادی (?:گسترده )?زندانیان سیاسی", r"کاهش (?:سرکوب|بازداشت)"),
    ),
    "war": (
        (r"حمله (?:نظامی|هوایی|موشکی) (?:به|علیه) ایران (?:آغاز|انجام) شد",
         r"حملات? (?:هوایی|موشکی|نظامی) (?:به ایران )?(?:آغاز|از سر گرفته) شد",
         r"بمباران (?:ایران|تهران) (?:آغاز|انجام) شد", r"درگیری نظامی (?:آغاز|گسترش) یافت"),
        (r"آتش بس (?:برقرار|اجرا) شد", r"حملات? (?:هوایی|موشکی|نظامی) (?:به ایران )?متوقف شد",
         r"پایان (?:جنگ|درگیری)", r"توقف (?:بمباران|حملات)"),
    ),
    "transition": (
        (r"دولت (?:موقت|انتقالی) تشکیل شد", r"انتقال قدرت (?:انجام|آغاز) شد",
         r"حکومت (?:سقوط|فروپاشی) کرد", r"کناره گیری (?:رهبر|رئیس جمهور) از قدرت"),
        (r"دولت (?:موقت|انتقالی) منحل شد", r"تلاش برای (?:گذار|سرنگونی) شکست خورد"),
    ),
    "attrition": (
        (r"تحریم (?:های? )?(?:جدید|تشدید) شد", r"تحریم (?:های? )?جدید (?:اعمال|وضع) شد",
         r"نرخ تورم (?:افزایش|جهش) یافت", r"ارزش ریال (?:کاهش|سقوط) یافت",
         r"رکود اقتصادی (?:تشدید|عمیق تر) شد", r"مذاکرات? (?:شکست خورد|متوقف) شد"),
        (r"تحریم (?:های? )?(?:لغو|کاهش) شد", r"نرخ تورم کاهش یافت",
         r"ارزش ریال افزایش یافت", r"بازگشت رشد اقتصادی"),
    ),
    "recovery": (
        (r"وام (?:روسیه|چین) (?:پرداخت|تصویب) شد",
         r"توافق (?:راهبردی|اقتصادی) با چین (?:امضا|اجرایی) شد",
         r"سرمایه گذاری چین در ایران (?:آغاز|افزایش) یافت"),
        (r"وام (?:روسیه|چین) لغو شد",
         r"توافق (?:راهبردی|اقتصادی) با چین تعلیق شد",
         r"سرمایه گذاری چین در ایران متوقف شد"),
    ),
}
ATTRIBUTION = re.compile(
    r"به گفته|به باور|به اعتقاد|ادعا|پیش بینی|پیش\s*بینی|احتمال|سناریو|"
    r"هشدار داد|معتقد است|خواهد شد|ممکن است|می تواند|گفت\s*:"
)
CLAIM_SUPPORT = re.compile(
    r"احتمال|وقوع|قطعی|در راه|در آستانه|نزدیک|پیش رو|ناگزیر|سناریوی|"
    r"پیش بینی|پیش\s*بینی|تشدید|بازگشت|آغاز"
)
CLAIM_OPPOSE = re.compile(
    r"منتفی|بعید|نامحتمل|رد کرد|کنار گذاشته|اتفاق نمی افتد|رخ نمی دهد|"
    r"نخواهد شد|کاهش احتمال|پایان یافته"
)
DAILY_SCORE_CAP = {"story": 4, "figure": 2}


def assess_signal(text, family, kind):
    """Return direction, weight, evidence type, explanation (not probability)."""
    value = normalize(text)
    positives, negatives = EVENT_RULES[family]
    pos = any(re.search(p, value) for p in positives)
    neg = any(re.search(p, value) for p in negatives)
    if kind == "story":
        if ATTRIBUTION.search(value):
            return 0, 1, "unscored", "گزارش یک ادعا یا پیش بینی؛ وقوع رویداد احراز نشده است"
        if pos != neg:
            return (1 if pos else -1), 2, "reported_event", "رویداد با قاعده روشن؛ نیازمند راستی آزمایی"
        return 0, 1, "unscored", "سرخط مبهم یا بدون رویداد قابل امتیازدهی"
    # Statements are NOT treated as news facts. Capture only explicitly
    # directional predictions in a separate, lower-weight discourse component.
    if kind == "figure":
        if CLAIM_OPPOSE.search(value) and not CLAIM_SUPPORT.search(value):
            return -1, 1, "analyst_view", "دیدگاه منفی تحلیل گر؛ نه شاهد مستقل"
        if CLAIM_SUPPORT.search(value) and not CLAIM_OPPOSE.search(value):
            return 1, 1, "analyst_view", "دیدگاه مثبت تحلیل گر؛ نه شاهد مستقل"
    return 0, 1, "unscored", "بدون جهت صریح یا دارای نشانه های متعارض"


def apply_daily_caps(records):
    """Prevent many headlines/analysts in one day from manufacturing momentum."""
    used = {}
    for item in sorted(records, key=lambda x: (int(x.get("ts") or 0), str(x.get("id") or "")), reverse=True):
        if item.get("by") != "pendar-auto" or not item.get("direction"):
            continue
        kind = item.get("source_type")
        if kind not in DAILY_SCORE_CAP:
            item["direction"] = 0
            item["score_kind"] = "unscored"
            item["review_note"] = "نوع منبع برای امتیازدهی خودکار قابل تشخیص نیست"
            continue
        key = (item.get("date"), item.get("family"), kind)
        magnitude = abs(int(item.get("direction", 0)) * int(item.get("weight", 1)))
        remaining = DAILY_SCORE_CAP[kind] - used.get(key, 0)
        if remaining <= 0:
            item["direction"] = 0
            item["score_kind"] = "capped"
            item["review_note"] = "سقف امتیاز روزانه برای جلوگیری از اثر تکرار خبر"
        else:
            item["weight"] = min(magnitude, remaining)
            used[key] = used.get(key, 0) + item["weight"]


def build_history(records, now):
    """Create daily reproducible cumulative indexes, with component separation."""
    from datetime import date
    first = min((str(r.get("date")) for r in records if
                 re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(r.get("date") or ""))),
                default=now.date().isoformat())
    start = date.fromisoformat(first)
    end = now.date()
    # Avoid corrupt historical dates from holding the client to enormous ranges.
    if end < start:
        start = end
    if (end - start).days > 1825:
        start = end - timedelta(days=1825)
    daily = {}
    for row in records:
        day = str(row.get("date") or "")
        fam = row.get("family")
        if fam not in FAMILIES or not (start.isoformat() <= day <= end.isoformat()):
            continue
        value = int(row.get("direction") or 0) * int(row.get("weight") or 1)
        mode = ("event" if row.get("score_kind") == "reported_event" else
                "analyst" if row.get("score_kind") == "analyst_view" else
                "legacy" if row.get("by") != "pendar-auto" else "unscored")
        daily.setdefault(day, []).append((fam, mode, value))
    totals = {f: 0 for f in FAMILIES}
    components = {k: {f: 0 for f in FAMILIES} for k in ("event", "analyst", "legacy")}
    points = []
    day = start
    while day <= end:
        delta = {f: 0 for f in FAMILIES}
        for fam, mode, value in daily.get(day.isoformat(), []):
            delta[fam] += value
            totals[fam] += value
            if mode in components:
                components[mode][fam] += value
        points.append({"date": day.isoformat(), "scores": totals.copy(),
                       "daily": delta, "components": {k: v.copy() for k, v in components.items()}})
        day += timedelta(days=1)
    return {"version": 1, "generated_at": now.isoformat(), "families": list(FAMILIES),
            "points": points, "score_is_probability": False,
            "method": "Cumulative directional signal points: reported events + attributed views + unverified legacy seed; daily automated caps"}



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
    direction, weight, score_kind, note = assess_signal(
        text + (" " + summary if kind == "story" else ""), family, kind)
    return {
        "id": "auto-" + fingerprint, "date": date, "ts": ts,
        "family": family, "direction": direction, "weight": weight,
        "text": text[:500], "source": source[:180],
        "source_url": url, "source_type": kind, "by": "pendar-auto",
        "score_kind": score_kind, "review_status": "auto_unverified",
        "review_note": label + "؛ " + note,
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
        prior = combined.get(candidate["id"])
        if prior and prior.get("by") == "pendar-auto" and prior.get("review_status") != "reviewed":
            # Upgrade formerly neutral candidates while preserving editor-approved signals.
            combined[candidate["id"]] = candidate
        elif prior is None and added < MAX_NEW_PER_RUN:
            combined[candidate["id"]] = candidate
            added += 1
    # Bound the public payload without removing the original authored records.
    originals = [x for x in combined.values() if x.get("by") != "pendar-auto"]
    automatic = [x for x in combined.values() if x.get("by") == "pendar-auto"]
    automatic.sort(key=lambda x: (int(x.get("ts") or 0), str(x.get("id") or "")), reverse=True)
    result = originals + automatic[:MAX_AUTO_HISTORY]
    apply_daily_caps(result)
    result.sort(key=lambda x: (int(x.get("ts") or 0), str(x.get("id") or "")), reverse=True)
    data.mkdir(parents=True, exist_ok=True)
    destination = data / "iran-scenario-signals.json"
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    history = build_history(result, now)
    (data / "iran-scenario-history.json").write_text(
        json.dumps(history, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8")
    scored = sum(x.get("by") == "pendar-auto" and bool(x.get("direction")) for x in result)
    meta = {"generated_at": now.isoformat(), "total": len(result),
            "automatic_candidates": min(len(automatic), MAX_AUTO_HISTORY),
            "new_candidates": added, "auto_scored": scored,
            "auto_direction_policy": "conservative_rules_with_daily_caps_unverified",
            "sources": ["Pendar published headlines", "Pendar attributed figure posts"],
            "history_points": len(history["points"]), "history_file": "iran-scenario-history.json"}
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
