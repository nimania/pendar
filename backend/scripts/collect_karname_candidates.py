#!/usr/bin/env python3
"""Collect review-only, source-anchored Karname claim candidates from Pendar.

This is a conservative candidate detector, NOT an AI fact-checker. It never
publishes candidates, rewrites the canonical ledger, or assigns accuracy scores.
Sources are the existing curated Pendar editorial feeds. Jan Kalam's mirrored
Pendar snapshot is deliberately not ingested again.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.figures import FIGURES  # noqa: E402

RECAPS = ROOT / "backend/data/editorial-recaps.json"
VIEWS = ROOT / "web-static/data/pendar-editorial-views.json"
LEDGER = ROOT / "backend/data/karname.json"
QUEUE = ROOT / "backend/data/karname-candidates.json"
SCHEMA_VERSION = 1

PERSIAN_MAP = str.maketrans({"ي": "ی", "ى": "ی", "ك": "ک", "ۀ": "ه", "\u200c": " ",
                             "\u200f": "", "\u200e": "", "ـ": ""})
DIACRITICS = re.compile(r"[\u064b-\u065f]")
SPACE = re.compile(r"\s+")
SENTENCE_BREAK = re.compile(r"(?<=[.!؟!?])\s+")
CONDITIONAL = re.compile(r"(?:^|[\s،؛])اگر\s+[^،؛.!؟\n]{4,160}")
TIME_SIGNAL = re.compile(
    r"(?:تا|ظرف|در|از|پیش از|پس از|بین|تا پایان)\s+"
    r"(?:\S+\s+){0,7}?"
    r"(?:روز|روزه|هفته|ماه|ساله?|سال|فروردین|اردیبهشت|خرداد|تیر|مرداد|"
    r"شهریور|مهر|آبان|آذر|دی|بهمن|اسفند|ژانویه|فوریه|مارس|آوریل|مه|"
    r"ژوئن|ژوئیه|اوت|سپتامبر|اکتبر|نوامبر|دسامبر|۲۰۲[۶-۹]|202[6-9])",
    re.IGNORECASE,
)
EXACT_DATE = re.compile(r"\b20\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b")
FUTURE_VERB = re.compile(r"(?:خواهد|خواهند|خواهیم)\s+(?:شد|بود|کرد|داد|داشت|گرفت|رفت|"
                         r"یافت|رسید|آمد|دید|پذیرفت|دادند|رفتند|ماند|برد|باخت|افتاد|ساخت|گذاشت)")
FUTURE_PREDICATE = re.compile(r"(?:رخ\s+(?:خواهد\s+داد|می\s*دهد)|"
                              r"اتفاق\s+(?:خواهد\s+افتاد|می\s*افتد)|"
                              r"آغاز\s+(?:می\s*شود|خواهد\s+شد)|"
                              r"(?:شکل|تشکیل)\s+(?:می\s*گیرد|خواهد\s+گرفت))")
PROBABILITY = re.compile(r"(?:احتمال|محتمل|بعید|ممکن\s+است|به\s+نظر\s+می\s+رسد|"
                         r"بالاتر\s+از\s*[۰-۹0-9]+\s*درصد)")
EVENT = re.compile(r"(?:جنگ|حمله|انتخابات|سنا|کنگره|پارلمان|مجلس|پیروز|شکست|"
                   r"توافق|مذاکر|فروپاشی|استیضاح|برکنار|اقتصاد|رکود|تورم|"
                   r"قیمت|دلار|نفت|تحریم|هرمز|سریال|فصل|پخش|تمدید|ساخت|"
                   r"دولت|نخست.?وزیر|اعتراض|انقلاب|گذار|بازگشت)")
FORECAST_VERB = re.compile(r"(?:پیش.?بینی\s+(?:می\s*کن|کرد|اش)|"
                           r"رخ\s+می\s*دهد|به\s+وقوع\s+می\s*پیوندد)")
EDITORIAL_META = re.compile(
    r"(?:^این\s+پرونده\b|^این\s+گزارش\b|^محور\s+گفت\s*و?\s*گو\b|"
    r"^ادعاهای\s+مربوط\b|^در\s+این\s+(?:متن|گزارش|پرونده)\b|"
    r"مستقلاً\s+تأیید\s+نشده|"
    r"نه\s+(?:خبر|تأیید|پیش.?بینی)\b|"
    r"^این(?:‌|\s)?ها\s+پیش.?بینی\b|"
    r"متن\s+پیاده.?شده|نقل\s+است\s+نه\s+تأیید|"
    r"^نمی.?توانم\s+پیش.?بینی\b|"
    r"^پیش.?بینی\s+قبلی\b|"
    r"^به\s+تعبیر\s+مجری\b|^مجری\s+(?:می\s+گوید|می\s+پرسد)\b|"
    r"راستی.?آزمایی\s+مستقل\s+نشده|"
    r"^اما\s+واکنش\s+.*درست\s+محاسبه\s+نکرد|"
    r"^درباره\s+احتمال\s+.*پرهیز\s+می\s+دهد)"
)
STOPWORDS = set("که از در به را و با برای این آن اگر تا می شود شده است بود هستند "
                "خواهد خواهند کرد کرده همان همه یک دو سه بر چه پس پیش یا اما نیز "
                "رو روی خود هم فقط او آنها اوست خودشان ما شما آنها را".split())


def norm(value: str) -> str:
    s = DIACRITICS.sub("", str(value or "").translate(PERSIAN_MAP)).casefold()
    s = re.sub(r"[^0-9a-z\u0600-\u06ff]+", " ", s)
    return SPACE.sub(" ", s).strip()


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def valid_url(value: object) -> str | None:
    s = str(value or "").strip()
    return s if re.match(r"^https://[^/\s]+\S*$", s) else None


def figure_lookup(figures=FIGURES) -> tuple[dict, dict]:
    handles: dict[str, object] = {}
    names: dict[str, set[str]] = {}
    for fig in figures:
        handle = str(fig.handle)
        handles[norm(handle)] = fig
        for label in [fig.name_fa, *fig.aliases]:
            n = norm(label)
            if n:
                names.setdefault(n, set()).add(handle)
    return handles, names


def attribution(source: dict, kind: str, handles: dict, names: dict) -> dict:
    # Never attribute a whole panel recap to just the first participant.
    hints = source.get("speaker_handles") if kind == "editorial_recap" else None
    if isinstance(hints, list) and len(hints) > 1:
        return {"speaker_handle": None, "speaker_name": source.get("name_fa"),
                "speaker_candidates": [str(x) for x in hints],
                "identity_status": "multi_speaker_requires_review"}
    raw = (source.get("speaker_handle") or
           (hints[0] if isinstance(hints, list) and len(hints) == 1 else None) or
           (source.get("handle") if kind == "editorial_view" else None))
    name = str(source.get("name_fa") or "")
    if raw and norm(str(raw)) in handles:
        fig = handles[norm(str(raw))]
        return {"speaker_handle": fig.handle, "speaker_name": fig.name_fa,
                "speaker_candidates": [fig.handle], "identity_status": "matched_canonical_handle"}
    possible = names.get(norm(name), set())
    if len(possible) == 1:
        handle = next(iter(possible))
        fig = handles[norm(handle)]
        return {"speaker_handle": fig.handle, "speaker_name": fig.name_fa,
                "speaker_candidates": [fig.handle], "identity_status": "matched_unique_name"}
    candidates = [str(raw)] if raw else sorted(possible)
    return {"speaker_handle": None, "speaker_name": name or None,
            "speaker_candidates": candidates, "identity_status": "unresolved_requires_review"}


def spans(text: str):
    """Yield exact excerpts from the source. Never rewrite someone else's words."""
    for paragraph in str(text or "").splitlines():
        paragraph = paragraph.strip()
        if not paragraph or len(paragraph) < 35:
            continue
        sentences = SENTENCE_BREAK.split(paragraph)
        for sentence in sentences:
            sentence = sentence.strip()
            if 35 <= len(sentence) <= 650:
                yield sentence


def qualifies(text: str) -> tuple[str, str] | None:
    t = norm(text)
    if EDITORIAL_META.search(t):
        return None
    if re.search(r"(?:نه\s+می.?توان\s+پیش.?بینی\s+کرد|"
                 r"نمی.?توان\s+پیش.?بینی\s+کرد|"
                 r"پیش.?بینی\s+نمی.?کنم)", t):
        return None
    conditional = bool(CONDITIONAL.search(text))
    # Future tense alone is not a verifiable claim (e.g. a general maxim).
    explicit = bool((FUTURE_VERB.search(text) or FUTURE_PREDICATE.search(text))
                    and EVENT.search(text))
    probabilistic = bool(PROBABILITY.search(text) and EVENT.search(text))
    forecast = bool(FORECAST_VERB.search(text) and EVENT.search(text))
    if not (explicit or probabilistic or forecast):
        return None
    if conditional:
        return "conditional_forecast", "conditional"
    if probabilistic:
        return "probabilistic_forecast", "probabilistic"
    return "forecast_candidate", "unspecified"


def trigger_hint(excerpt: str, certainty: str) -> dict:
    signal = TIME_SIGNAL.search(excerpt)
    condition = CONDITIONAL.search(excerpt)
    exact = EXACT_DATE.search(excerpt)
    # An exact ISO date appearing in the excerpt is not automatically a deadline.
    # The reviewer must confirm its semantic role.
    return {
        "kind": "conditional" if condition else ("time_expression" if signal else "undetermined"),
        "raw_condition": condition.group(0).strip(" ،؛") if condition else None,
        "raw_time_expression": signal.group(0) if signal else None,
        "mentioned_iso_date": exact.group(0) if exact else None,
        "verified_due_at": None,
        "certainty": certainty,
        "review_required": True,
    }


def tokens(text: str) -> set[str]:
    return {w for w in norm(text).split() if len(w) >= 3 and w not in STOPWORDS}


def ledger_near_matches(excerpt: str, speaker_handle: str | None, claims: list[dict],
                        speakers: dict) -> list[str]:
    base = tokens(excerpt)
    if len(base) < 3 or not speaker_handle:
        return []
    matches = []
    for claim in claims:
        claimed = claim.get("speakers") or []
        if not any(speaker_handle == (speakers.get(key) or {}).get("handle") or
                   speaker_handle == key for key in claimed):
            continue
        other = tokens(str(claim.get("text") or ""))
        if len(other) < 3:
            continue
        overlap = len(base & other)
        ratio = overlap / len(base | other)
        containment = overlap / min(len(base), len(other))
        if ratio >= 0.55 or (overlap >= 5 and containment >= 0.82):
            matches.append(str(claim["id"]))
    return sorted(set(matches))


def source_records(recaps: list, views: list):
    for item in recaps:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        yield ("editorial_recap", item, "recap_fa", str(item.get("recap_fa") or ""))
    for group in views:
        if not isinstance(group, dict):
            continue
        profile = group.get("profile") or {}
        for post in group.get("posts", []):
            if not isinstance(post, dict) or not post.get("id") or not post.get("quote_fa"):
                continue
            record = dict(post)
            record.setdefault("handle", profile.get("handle"))
            record.setdefault("name_fa", profile.get("name_fa"))
            yield ("editorial_view", record, "quote_fa", str(record["quote_fa"]))


def build_queue(recaps: list, views: list, ledger: dict, previous: dict | None = None,
                figures=FIGURES) -> dict:
    handles, names = figure_lookup(figures)
    existing_claims = ledger.get("claims") or []
    speakers = {s.get("key"): s for s in ledger.get("speakers", [])}
    prior = {c.get("id"): c for c in (previous or {}).get("candidates", [])
             if isinstance(c, dict) and isinstance(c.get("id"), str)}
    # The inbox is append-only; reviewed or dismissed records are never reset.
    found = copy.deepcopy(prior)
    active_ids: set[str] = set()
    scanned_sources: set[tuple[str, str]] = set()
    metrics = {"sources_scanned": 0, "source_spans_scanned": 0,
               "matched_new": 0, "ambiguous_sources": 0}
    for kind, source, field, full_text in source_records(recaps, views):
        metrics["sources_scanned"] += 1
        scanned_sources.add((kind, str(source["id"])))
        who = attribution(source, kind, handles, names)
        if who["identity_status"] == "multi_speaker_requires_review":
            metrics["ambiguous_sources"] += 1
        for excerpt in spans(full_text):
            metrics["source_spans_scanned"] += 1
            category = qualifies(excerpt)
            if not category:
                continue
            claim_type, certainty = category
            speaker_identifier = who["speaker_handle"] or "|".join(who["speaker_candidates"]) or who["speaker_name"] or "unknown"
            claim_key = norm(excerpt) + "\n" + norm(speaker_identifier)
            id_ = "KC-" + digest(claim_key)[:18]
            active_ids.add(id_)
            origin = {
                "project": "pendar",
                "feed": kind,
                "record_id": str(source["id"]),
                "text_field": field,
                "source_title": str(source.get("source_name") or ""),
                "source_url": valid_url(source.get("url")),
                "source_date_label": source.get("source_date_fa"),
                "editorial_recorded_at": source.get("recorded_at"),
                "editorial_published_at": source.get("published_at"),
                "primary_speech_date_verified": False,
                "primary_source_verified": False,
                "source_content_sha256": digest(full_text),
            }
            if id_ in found:
                candidate = found[id_]
                if candidate.get("status") == "screened_out_by_current_filter" and candidate.get("editorial_decision") is None:
                    candidate["status"] = "pending_editorial_review"
                    candidate.pop("automated_screening_note", None)
                if not any(o.get("record_id") == origin["record_id"] and o.get("feed") == kind
                           for o in candidate.get("origins", [])):
                    candidate.setdefault("origins", []).append(origin)
                continue
            candidate = {
                "id": id_,
                "status": "pending_editorial_review",
                "extraction_method": "conservative_rule_based_v1",
                "type_candidate": claim_type,
                "speaker_handle": who["speaker_handle"],
                "speaker_name": who["speaker_name"],
                "speaker_candidates": who["speaker_candidates"],
                "identity_status": who["identity_status"],
                "excerpt_exact_from_field": excerpt,
                "excerpt_is_original_speech_verified": False,
                "trigger_hint": trigger_hint(excerpt, certainty),
                "related_ledger_claim_ids_for_review": ledger_near_matches(
                    excerpt, who["speaker_handle"], existing_claims, speakers),
                "origins": [origin],
                "editorial_decision": None,
            }
            found[id_] = candidate
            metrics["matched_new"] += 1
    # Do not erase history: when tightened filters reject an older machine
    # candidate, keep the record but remove it from the pending review count.
    # Never auto-screen a candidate whose source has gone missing.
    for candidate_id, candidate in found.items():
        if (candidate_id not in active_ids
                and candidate.get("status") == "pending_editorial_review"
                and candidate.get("editorial_decision") is None
                and candidate.get("origins")
                and all((o.get("feed"), str(o.get("record_id"))) in scanned_sources
                        for o in candidate["origins"])):
            candidate["status"] = "screened_out_by_current_filter"
            candidate["automated_screening_note"] = (
                "No longer meets conservative extraction conditions; preserved "
                "for audit, not an editorial judgment."
            )
    queue = {
        "schema_version": SCHEMA_VERSION,
        "publication_policy": "internal_review_queue_only_no_public_import",
        "sources": ["backend/data/editorial-recaps.json",
                    "web-static/data/pendar-editorial-views.json"],
        "mirrored_jan_kalam_skipped": True,
        "stats": {
            "total": len(found),
            "pending": sum(c.get("status") == "pending_editorial_review" for c in found.values()),
            "screened": sum(c.get("status") == "screened_out_by_current_filter"
                            for c in found.values()),
            "reviewed": sum(c.get("status") not in
                            ("pending_editorial_review", "screened_out_by_current_filter")
                            for c in found.values()),
            "sources_scanned": metrics["sources_scanned"],
            "source_spans_scanned": metrics["source_spans_scanned"],
            "ambiguous_sources": metrics["ambiguous_sources"],
        },
        "candidates": sorted(found.values(), key=lambda c: c["id"]),
    }
    return queue


def read_json(path: Path, default):
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def run(recaps_path: Path = RECAPS, views_path: Path = VIEWS,
        ledger_path: Path = LEDGER, output: Path = QUEUE, *, check=False) -> dict:
    for path in (recaps_path, views_path, ledger_path):
        if not path.is_file():
            raise ValueError("Required input not found: " + str(path))
    recaps, views = read_json(recaps_path, []), read_json(views_path, [])
    ledger = read_json(ledger_path, {})
    if not isinstance(recaps, list) or not isinstance(views, list):
        raise ValueError("Editorial sources must be arrays")
    if not isinstance(ledger, dict) or not isinstance(ledger.get("claims"), list):
        raise ValueError("Canonical Karname registry missing")
    previous = read_json(output, {"candidates": []})
    if not isinstance(previous, dict) or not isinstance(previous.get("candidates"), list):
        raise ValueError("Previous candidate queue is malformed; refusing destructive overwrite")
    generated = build_queue(recaps, views, ledger, previous)
    rendered = json.dumps(generated, ensure_ascii=False, indent=2) + "\n"
    if check:
        if not output.is_file() or output.read_text(encoding="utf-8") != rendered:
            raise ValueError("Review queue differs from generated result")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        tmp = output.with_suffix(".json.tmp")
        tmp.write_text(rendered, encoding="utf-8")
        tmp.replace(output)
    print("Karname candidate intake:", json.dumps(generated["stats"], ensure_ascii=False))
    return generated


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--recaps", type=Path, default=RECAPS)
    parser.add_argument("--views", type=Path, default=VIEWS)
    parser.add_argument("--ledger", type=Path, default=LEDGER)
    parser.add_argument("--output", type=Path, default=QUEUE)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        run(args.recaps, args.views, args.ledger, args.output, check=args.check)
    except (OSError, ValueError, TypeError) as exc:
        print("Karname candidate intake stopped:", exc, file=sys.stderr)
        sys.exit(1)
