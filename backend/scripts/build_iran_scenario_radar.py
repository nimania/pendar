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
from functools import lru_cache
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
MAX_NEW_PER_RUN = 120
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


@lru_cache(maxsize=1)
def priority_analyst_roster():
    """Read the small human-curated analyst registry once per generator run."""
    registry = read_json(Path(__file__).resolve().parents[1] /
                         "data" / "iran-future-analysts.json", {})
    return registry.get("people", []) if isinstance(registry, dict) else []


def priority_analyst(speaker, handle=""):
    """Match a person by a known profile or exact name, never by affiliation alone."""
    subject = normalize(speaker).casefold()
    profile_handle = normalize(handle).lstrip("@").casefold()
    for person in priority_analyst_roster():
        if not isinstance(person, dict) or not person.get("active"):
            continue
        names = {normalize(person.get("name_fa")).casefold(),
                 normalize(person.get("name_en")).casefold()}
        names.update(normalize(alias).casefold() for alias in person.get("aliases", []))
        if (subject and subject in names) or (profile_handle and
                 profile_handle == str(person.get("handle", "")).casefold()):
            return person
    return None


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
DAILY_SCORE_CAP = {"story": 4, "figure": 2, "statement": 2}
# Named, linkable expert views are weighted in the analyst component ONLY.
# A second mention of the same person must not manufacture extra momentum.
MAX_ANALYST_FAMILY_DAILY = 3
MAX_PER_SPEAKER_FAMILY_DAILY = 2


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
    analyst_total = {}
    speaker_total = {}
    for item in sorted(records, key=lambda x: (int(x.get("ts") or 0), str(x.get("id") or "")), reverse=True):
        if item.get("by") != "pendar-auto":
            continue
        if "raw_direction" in item:
            item["direction"] = int(item.get("raw_direction") or 0)
            item["weight"] = int(item.get("raw_weight") or 1)
            if item.get("direction") and item.get("score_kind") == "capped":
                item["score_kind"] = ("reported_event" if item.get("source_type") == "story" else "analyst_view")
        if not item.get("direction"):
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
        speaker_key = None
        if kind in ("figure", "statement"):
            analyst_key = (item.get("date"), item.get("family"))
            remaining = min(remaining, MAX_ANALYST_FAMILY_DAILY -
                            analyst_total.get(analyst_key, 0))
            speaker = normalize(item.get("speaker")).casefold()
            identity = str(item.get("analyst_handle") or speaker).casefold()
            if identity:
                speaker_key = (item.get("date"), item.get("family"), identity)
                remaining = min(remaining, MAX_PER_SPEAKER_FAMILY_DAILY -
                                speaker_total.get(speaker_key, 0))
        if remaining <= 0:
            item["direction"] = 0
            item["score_kind"] = "capped"
            item["review_note"] = "سقف امتیاز روزانه برای جلوگیری از اثر تکرار خبر"
        else:
            item["weight"] = min(magnitude, remaining)
            used[key] = used.get(key, 0) + item["weight"]
            if kind in ("figure", "statement"):
                analyst_total[analyst_key] = analyst_total.get(analyst_key, 0) + item["weight"]
                if speaker_key is not None:
                    speaker_total[speaker_key] = speaker_total.get(speaker_key, 0) + item["weight"]


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




def public_link(url):
    """Safe navigable citation URLs. Never invent references."""
    from urllib.parse import urlsplit
    url = str(url or "").strip()
    if url.startswith("/story/") and re.fullmatch(r"/story/[0-9a-fA-F-]{8,64}/", url):
        return url
    if re.fullmatch(r"/@[A-Za-z0-9_-]{2,80}/?", url):
        return url
    if url.startswith("https://"):
        parsed = urlsplit(url)
        if parsed.hostname and not parsed.username and not parsed.password:
            return url[:1400]
    return ""


def links_from_detail(detail, story_url):
    links = []
    if story_url:
        links.append({"label": "پروندهٔ خبر در پندار", "url": story_url, "kind": "pendar"})
    for source in (detail.get("sources") or []):
        if not isinstance(source, dict):
            continue
        url = public_link(source.get("article_url"))
        name = normalize(source.get("source_name") or "منبع اصلی")[:100]
        if url and not any(x["url"] == url for x in links):
            links.append({"label": name, "url": url, "kind": "original"})
        if len(links) >= 9:
            break
    return links


def match_directional_phrase(text, family, kind):
    """Human-readable rule explanation, quoting *only* text in the input."""
    value = normalize(text)
    if kind == "story":
        patterns = EVENT_RULES[family]
        direction = assess_signal(value, family, kind)[0]
        if direction:
            for pattern in patterns[0 if direction > 0 else 1]:
                match = re.search(pattern, value)
                if match:
                    return match.group(0)[:120]
    else:
        for pattern in (CLAIM_OPPOSE.pattern, CLAIM_SUPPORT.pattern):
            match = re.search(pattern, value)
            if match:
                return match.group(0)[:120]
    return ""


def from_story_detail(story, data):
    identity = str(story.get("id") or "")
    if not re.fullmatch(r"[0-9a-fA-F-]{8,64}", identity):
        return {}
    return read_json(data / "story" / (identity + ".json"), {})


def make_candidate(row, kind, now):
    raw = row.get("published_at") or row.get("date")
    parsed = date_and_ms(raw)
    if parsed is None:
        return None
    date, ts, moment = parsed
    if moment > now + timedelta(hours=1) or now - moment > MAX_INPUT_AGE:
        return None
    speaker = ""
    speaker_role = ""
    speaker_url = ""
    related_people = []
    uncertainty = ""
    source_links = []
    source_doc_id = str(row.get("id") or "")
    if kind in ("figure", "statement"):
        if kind == "figure" and row.get("kind") not in ("analysis", "party_claim"):
            return None
        text = normalize(row.get("statement_fa") if kind == "statement"
                         else (row.get("summary_fa") or row.get("topic_fa")))
        speaker = normalize(row.get("person_name_fa") or row.get("name_fa") or row.get("_figure_name"))
        speaker_role = normalize(row.get("role_fa") or row.get("_figure_role"))
        profile_handle = str(row.get("_figure_handle") or row.get("handle") or "").lstrip("@")
        if kind == "figure":
            speaker_url = public_link("/@" + profile_handle) if profile_handle else ""
        else:
            speaker_url = ""
        original = public_link(row.get("article_url") or row.get("url"))
        news_link = public_link(row.get("_story_url"))
        if original:
            source_links.append({"label": "منبع اصلی اظهارنظر", "url": original, "kind": "original"})
        if news_link:
            source_links.append({"label": "خبر مرتبط در پندار", "url": news_link, "kind": "pendar"})
        if speaker_url:
            source_links.append({"label": "صفحهٔ چهره در پندار", "url": speaker_url, "kind": "figure"})
        source = speaker or "اظهارنظر ثبت‌شده در پندار"
        identity = (str(row.get("id") or original) if kind == "figure"
                    else source_doc_id + "|" + speaker + "|" + text)
        label = "دیدگاه منتسب؛ وقوع رویداد را اثبات نمی‌کند"
    else:
        text = normalize(row.get("headline_fa") or row.get("title_fa") or row.get("title"))
        source = normalize("، ".join(str(x) for x in row.get("source_names", [])[:3])
                           if isinstance(row.get("source_names"), list) else "خبر ثبت‌شده در پندار")
        detail = row.get("_detail") if isinstance(row.get("_detail"), dict) else {}
        identity = source_doc_id
        story_url = ("/story/" + identity + "/" if re.fullmatch(r"[0-9a-fA-F-]{8,64}", identity) else "")
        source_links = links_from_detail(detail, story_url)
        related_people = [
            {"name": normalize(p.get("person_name_fa"))[:100],
             "role": normalize(p.get("role_fa"))[:100],
             "statement": normalize(p.get("statement_fa"))[:500],
             "direct_quote": bool(p.get("direct_quote")),
             "source_url": public_link(p.get("article_url"))}
            for p in detail.get("person_statements", [])[:12] if isinstance(p, dict)
            and normalize(p.get("person_name_fa"))
        ]
        uncertainty = normalize("؛ ".join(str(x) for x in detail.get("uncertainties", [])[:2]))[:320]
        label = "خبر گردآوری‌شده؛ اصالت ادعاها مستقلاً راستی‌آزمایی نشده است"
        speaker = ""
        speaker_role = ""
    family = classify(text)
    if kind == "story" and not family:
        family = classify(text + " " + normalize(row.get("summary_fa")))
    if not family or not text or not identity:
        return None
    fingerprint = hashlib.sha256((kind + "|" + identity + "|" + family).encode("utf-8")).hexdigest()[:18]
    direction, weight, score_kind, note = assess_signal(text, family,
                                      "story" if kind == "story" else "figure")
    # An unsourced news card must not generate a seemingly factual score.
    if kind == "story" and not any(link["kind"] == "original" for link in source_links) and direction:
        direction, weight, score_kind = 0, 1, "unscored"
        note = "منبع اصلی قابل پیوند نیست؛ بدون امتیاز تا تکمیل استناد"
    # A named person's claim requires a reference, not only an unlinked summary.
    if kind in ("figure", "statement") and not any(link["kind"] == "original" for link in source_links) and direction:
        direction, weight, score_kind = 0, 1, "unscored"
        note = "لینک اظهارنظر اصلی در دسترس نیست؛ بدون امتیاز"
    expert = (priority_analyst(speaker, profile_handle if kind == "figure" else "")
              if kind in ("figure", "statement") else None)
    # Priority requires a traceable ORIGINAL statement and explicit directional
    # language. It cannot turn an ambiguous opinion into a real-world event.
    if expert and direction and score_kind == "analyst_view":
        weight = 2
        note += "؛ وزن ۲ برای دیدگاه مستندِ گروه آینده ایران، نه تأیید مستقل رویداد"
        if not speaker_url:
            speaker_url = public_link("/@" + str(expert["handle"]))
    matched = match_directional_phrase(text, family, "story" if kind == "story" else "figure")
    reason = ("عبارت شناسایی‌شده: «" + matched + "»؛ " + note) if matched and direction else note
    return {
        "id": "auto-" + fingerprint, "date": date, "ts": ts,
        "family": family, "direction": direction, "weight": weight,
        "raw_direction": direction, "raw_weight": weight,
        "text": text[:500], "source": source[:180],
        "source_url": source_links[0]["url"] if source_links else "",
        "source_links": source_links,
        "source_type": kind, "source_doc_id": source_doc_id,
        "speaker": speaker, "speaker_role": speaker_role,
        "analyst_priority": bool(expert and direction and score_kind == "analyst_view"),
        "analyst_handle": str(expert["handle"]) if expert else "",
        "analyst_group": "iran_future_expert_views" if expert else "",
        "speaker_url": speaker_url,
        "related_people": related_people, "uncertainty": uncertainty,
        "evidence_phrase": matched if direction else "",
        "score_reason": reason[:400],
        "by": "pendar-auto", "score_kind": score_kind,
        "review_status": "auto_unverified",
        "review_note": label + "؛ " + note,
    }


def update_snapshots(data, records, now):
    """Append an observation whenever *published evidence or score* changes."""
    path = data / "iran-scenario-snapshots.json"
    previous = read_json(path, {})
    if not isinstance(previous, dict):
        previous = {}
    snapshots = previous.get("snapshots", [])
    if not isinstance(snapshots, list):
        snapshots = []
    scores = {family: sum(int(x.get("direction") or 0) * int(x.get("weight") or 1)
              for x in records if x.get("family") == family) for family in FAMILIES}
    signatures = sorted((str(x.get("id")), int(x.get("direction") or 0),
                         int(x.get("weight") or 1), str(x.get("score_reason") or ""))
                        for x in records)
    digest = hashlib.sha256(json.dumps(signatures, ensure_ascii=False,
                             separators=(",", ":")).encode("utf-8")).hexdigest()[:24]
    recent = snapshots[-1] if snapshots else {}
    if recent.get("digest") != digest:
        changes = {family: scores[family] -
                   int((recent.get("scores") or {}).get(family) or 0) for family in FAMILIES}
        snapshots.append({"at": now.isoformat(), "digest": digest, "scores": scores,
                          "changes": changes, "signal_count": len(records),
                          "recent_signal_ids": [x["id"] for x in records[:15]]})
    payload = {"version": 1, "generated_at": now.isoformat(),
               "score_is_probability": False, "snapshots": snapshots[-2000:]}
    path.write_text(json.dumps(payload, ensure_ascii=False,
                    separators=(",", ":")) + "\n", encoding="utf-8")
    return payload

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
        if not isinstance(story, dict):
            continue
        detail = from_story_detail(story, data)
        prepared = {**story, "_detail": detail}
        candidate = make_candidate(prepared, "story", now)
        if candidate:
            candidates.append(candidate)
        # Story-level named statements are separate, attributed evidence,
        # never disguised as events. Every scored statement needs its source URL.
        story_id = str(story.get("id") or "")
        news_url = "/story/" + story_id + "/" if re.fullmatch(r"[0-9a-fA-F-]{8,64}", story_id) else ""
        for statement in detail.get("person_statements", [])[:12]:
            if not isinstance(statement, dict):
                continue
            statement_row = {**statement, "id": story_id,
                             "_story_url": news_url,
                             "published_at": statement.get("published_at") or story.get("published_at")}
            candidate = make_candidate(statement_row, "statement", now)
            if candidate:
                candidates.append(candidate)
    for figure in figures.get("figures", []):
        if not isinstance(figure, dict):
            continue
        for post in figure.get("posts", []):
            if isinstance(post, dict):
                record = {**post, "_figure_name": figure.get("name_fa"),
                          "_figure_role": figure.get("role_fa"),
                          "_figure_handle": figure.get("handle")}
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
    snapshots = update_snapshots(data, result, now)
    (data / "iran-scenario-history.json").write_text(
        json.dumps(history, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8")
    scored = sum(x.get("by") == "pendar-auto" and bool(x.get("direction")) for x in result)
    meta = {"generated_at": now.isoformat(), "total": len(result),
            "automatic_candidates": min(len(automatic), MAX_AUTO_HISTORY),
            "new_candidates": added, "auto_scored": scored,
            "auto_direction_policy": "conservative_rules_with_daily_caps_unverified",
            "priority_analyst_policy": {
                "group": "iran_future_expert_views", "named_analysts": 10,
                "linked_directional_view_points": 2,
                "ordinary_directional_view_points": 1,
                "per_speaker_per_family_daily_cap": MAX_PER_SPEAKER_FAMILY_DAILY,
                "all_analysts_per_family_daily_cap": MAX_ANALYST_FAMILY_DAILY,
                "only_analyst_component": True, "not_probability": True,
            },
            "priority_scored_views": sum(
                1 for x in result if x.get("analyst_priority")
                and x.get("score_kind") == "analyst_view" and x.get("direction")
            ),
            "sources": ["Pendar published headlines", "Pendar attributed figure posts"],
            "history_points": len(history["points"]), "history_file": "iran-scenario-history.json",
            "snapshots_file": "iran-scenario-snapshots.json",
            "last_observed_change": (snapshots["snapshots"][-1]["at"] if snapshots["snapshots"] else None),
            "poll_interval_seconds": 60, "upstream_news_schedule_minutes": 15,
            "upstream_figure_schedule_minutes": 30}
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
