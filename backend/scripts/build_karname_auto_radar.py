#!/usr/bin/env python3
"""Publish *observations*, not verified claims, from the scheduled Karname queue.

No person is declared to have uttered a paraphrased or news-indexed excerpt.
No score, verdict, due date or source verification is inferred. This file can
be published automatically, without editorial intervention, because its
uncertainties are explicit and the original published source is identified.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "backend/data/karname-candidates.json"
OUTPUT = ROOT / "web-static/karname/auto-radar.json"
MAX_TEXT = 1200
MAX_ITEMS = 5000


def safe_url(value: object) -> str | None:
    candidate = str(value or "")
    if (len(candidate) > 2048
            or not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::443)?/[^\s<>\"'\\]*", candidate)):
        return None
    return candidate


def source_rank(origin: dict) -> tuple[int, int]:
    feed = origin.get("feed")
    score = {
        "editorial_view": 4 if origin.get("text_field") == "quote_fa" else 1,
        "editorial_recap": 2,
        "figure_post": 1,
    }.get(feed, 0)
    return score, int(bool(safe_url(origin.get("source_url"))))


def source_label(origin: dict) -> str:
    if origin.get("feed") == "editorial_view" and origin.get("text_field") == "quote_fa":
        return "نقل‌قول ثبت‌شده در پندار؛ تطبیق با گفتار اصلی انجام نشده"
    if origin.get("feed") == "editorial_recap":
        return "بازگویی تحریریهٔ پندار؛ نقل‌قول مستقیم نیست"
    return "متن خبر یا خلاصهٔ خبری؛ گویندهٔ جمله مستقلاً احراز نشده"


def public_identity(c: dict) -> dict:
    raw = str(c.get("speaker_name") or "").strip()[:120]
    status = c.get("identity_status")
    handle = str(c.get("speaker_handle") or "")
    verified_profile = (status in {"matched_canonical_handle", "matched_unique_name"}
                        and bool(re.fullmatch(r"[A-Za-z0-9_-]{2,100}", handle)))
    return {
        # For a news person, name describes who the *story mentions*, not an
        # independently verified speaker of this extracted sentence.
        "label": raw if raw else "چهرهٔ نامشخص",
        "role": "گویندهٔ احتمالی در منبع" if verified_profile else "نام مرتبط با خبر؛ انتساب نیازمند بررسی",
        "profile_handle": handle if verified_profile else None,
        "identity_verified_from_primary": False,
        "identity_status": status if isinstance(status, str) else "unknown",
    }


def validate_queue(queue: dict) -> list[dict]:
    if not isinstance(queue, dict) or not isinstance(queue.get("candidates"), list):
        raise ValueError("Missing candidate array")
    rows = queue["candidates"]
    if len(rows) > MAX_ITEMS:
        raise ValueError("Unexpectedly large candidate queue; refusing automatic publication")
    ids = []
    for item in rows:
        if not isinstance(item, dict):
            raise ValueError("Non-object candidate")
        id_ = item.get("id")
        if not isinstance(id_, str) or not re.fullmatch(r"KC-[a-f0-9]{18}", id_):
            raise ValueError("Invalid machine-generated candidate ID")
        ids.append(id_)
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate candidate IDs")
    return rows


def publishable(item: dict) -> bool:
    if item.get("status") != "pending_editorial_review":
        return False
    excerpt = item.get("excerpt_exact_from_field")
    if not isinstance(excerpt, str) or not 25 <= len(excerpt) <= MAX_TEXT:
        return False
    origins = item.get("origins")
    if not isinstance(origins, list) or not origins:
        return False
    # Only already-published editorial feeds, not unknown private systems.
    valid = any(
        isinstance(o, dict) and o.get("project") == "pendar"
        and o.get("feed") in {"editorial_view", "editorial_recap", "figure_post"}
        and isinstance(o.get("record_id"), str) and o.get("record_id")
        and isinstance(o.get("text_field"), str)
        for o in origins
    )
    return valid


def aggregate(queue: dict) -> dict:
    rows = validate_queue(queue)
    public = []
    for candidate in rows:
        if not publishable(candidate):
            continue
        evidence = sorted(
            (o for o in candidate["origins"] if isinstance(o, dict)
             and o.get("project") == "pendar"),
            key=source_rank, reverse=True)
        if not evidence:
            continue
        best = evidence[0]
        trigger = candidate.get("trigger_hint") or {}
        if not isinstance(trigger, dict):
            trigger = {}
        public.append({
            "id": candidate["id"],
            "text_from_source": candidate["excerpt_exact_from_field"],
            "person": public_identity(candidate),
            "observation_status": "auto_collected_unverified",
            "publication_approved": False,
            "evaluation": None,
            "source": {
                "kind": best.get("feed"),
                "record_id": best.get("record_id"),
                "title": str(best.get("source_title") or "")[:200],
                "link": safe_url(best.get("source_url")),
                "text_origin": source_label(best),
                "speech_date_verified": False,
                "primary_verified": False,
                "source_count": len(evidence),
                "indexed_at": (best.get("editorial_published_at")
                               or best.get("editorial_recorded_at")),
            },
            "trigger": {
                "kind": trigger.get("kind") if trigger.get("kind") in
                        {"conditional", "time_expression", "undetermined"} else "undetermined",
                "condition_mention": str(trigger.get("raw_condition") or "")[:200] or None,
                "time_mention": str(trigger.get("raw_time_expression") or "")[:150] or None,
                # Exact ISO deadlines require independently grounded resolution.
                "verified_deadline": None,
                "result": None,
                "needs_evidence": True,
            },
        })
    public.sort(key=lambda c: (str(c["source"]["indexed_at"] or ""), c["id"]), reverse=True)
    return {
        "schema_version": 1,
        "scope": "automatically_collected_observations_not_verified_predictions",
        "is_editorially_approved": False,
        "automation": "published_by_karname_scheduled_intake",
        "summary": {
            "visible_observations": len(public),
            "requires_source_verification": len(public),
            "independently_verified_results": 0,
        },
        "notice_fa": "این بخش به‌صورت خودکار از منابع منتشرشده گردآوری می‌شود. متن می‌تواند بازگویی یا خلاصهٔ خبر باشد؛ انتساب، تاریخ بیان، تحقق شرط و نتیجه هنوز مستقلاً تأیید نشده‌اند.",
        "items": public,
    }


def build(source: Path = SOURCE, output: Path = OUTPUT, *, check=False) -> dict:
    data = aggregate(json.loads(Path(source).read_text(encoding="utf-8")))
    rendered = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    output = Path(output)
    if check:
        if not output.is_file() or output.read_text(encoding="utf-8") != rendered:
            raise ValueError("Auto-radar file differs from canonical queue")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        tmp = output.with_suffix(".json.tmp")
        tmp.write_text(rendered, encoding="utf-8")
        tmp.replace(output)
    print(f"Karname auto-radar: {data['summary']['visible_observations']} unverified source observations, no outcomes scored")
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        build(args.source, args.output, check=args.check)
    except (ValueError, OSError) as exc:
        print("Automated radar stopped:", exc, file=sys.stderr)
        sys.exit(1)
