#!/usr/bin/env python3
"""Build one indexed Karname registry from documented and machine-extracted data.

The two source datasets remain authoritative for their different trust levels.
This index combines them for discovery, not for scoring or identity certification.
Screened-out machine candidates are indexed without republishing their dubious
text or original person attribution.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
LEDGER = ROOT / "backend/data/karname.json"
QUEUE = ROOT / "backend/data/karname-candidates.json"
RADAR = ROOT / "web-static/karname/auto-radar.json"
OUTPUT = ROOT / "web-static/karname/unified-index.json"


def read_json(path: Path) -> dict:
    result = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(result, dict):
        raise ValueError("Input JSON must be an object: " + str(path))
    return result


def normalized(ledger: dict, queue: dict, radar: dict) -> dict:
    sys.path.insert(0, str(ROOT / "backend"))
    from scripts.build_karname_auto_radar import validate_queue

    official = ledger.get("claims")
    speakers = ledger.get("speakers")
    if not isinstance(official, list) or not isinstance(speakers, list):
        raise ValueError("Missing official claims or speakers")
    names = {}
    for person in speakers:
        if not isinstance(person, dict):
            raise ValueError("Malformed official speaker")
        key = person.get("key")
        if not isinstance(key, str) or not key or key in names:
            raise ValueError("Missing/duplicate official speaker key")
        names[key] = person.get("name") or key

    candidates = validate_queue(queue)
    auto_items = radar.get("items")
    if (radar.get("scope") != "automatically_collected_observations_not_verified_predictions"
            or not isinstance(auto_items, list)):
        raise ValueError("Missing or invalid public automatic observation feed")
    radar_by_id = {c.get("id"): c for c in auto_items if isinstance(c, dict)}
    if len(radar_by_id) != len(auto_items) or None in radar_by_id:
        raise ValueError("Duplicate/invalid observation IDs")
    if any(c.get("observation_status") != "auto_collected_unverified"
           or c.get("evaluation") is not None for c in auto_items):
        raise ValueError("Unverified observations cannot acquire scores in this index")

    entries = []
    official_ids = set()
    for claim in official:
        if not isinstance(claim, dict):
            raise ValueError("Malformed documented claim")
        id_ = claim.get("id")
        if not isinstance(id_, str) or not id_ or id_ in official_ids:
            raise ValueError("Duplicate/invalid official claim ID")
        official_ids.add(id_)
        keys = claim.get("speakers") or []
        if not isinstance(keys, list) or any(k not in names for k in keys):
            raise ValueError("Invalid official speaker reference")
        scenarios = claim.get("scenarios") or []
        entries.append({
            "id": id_, "layer": "historical_ledger", "status": "recorded",
            "title": str(claim.get("text") or claim.get("speaker_note") or "")[:1200],
            "speaker_labels": [names[k] for k in keys],
            "speaker_keys": list(keys),
            "identity_verification_level": "as_recorded_in_historical_ledger",
            "topics": sorted({str(x.get("family")) for x in scenarios
                              if isinstance(x, dict) and x.get("family")}),
            "time_label": str(claim.get("due_label") or "")[:150] or None,
            "time_is_verified_deadline": False,
            "has_result_source": bool(claim.get("result_source")),
            "linked_ledger_claim_ids_for_review": [],
            "source_pointer": "backend/data/karname.json",
        })

    if len(official_ids.intersection(radar_by_id)) > 0:
        raise ValueError("Automatic observation ID collides with official claim")
    current_candidate_ids = {c["id"] for c in candidates}
    if not set(radar_by_id).issubset(current_candidate_ids):
        raise ValueError("Public radar refers to missing machine candidates")

    pending = screened = other = 0
    for c in candidates:
        id_ = c["id"]
        status = c.get("status")
        if id_ in official_ids:
            raise ValueError("Candidate ID collides with official ledger")
        linked = [x for x in c.get("related_ledger_claim_ids_for_review", [])
                  if isinstance(x, str) and x in official_ids]
        if status == "pending_editorial_review":
            pending += 1
            visible = radar_by_id.get(id_)
            if visible is None:
                raise ValueError("Pending candidate not in public radar: " + id_)
            identity = visible.get("person") or {}
            origin = visible.get("source") or {}
            trigger = visible.get("trigger") or {}
            if (not isinstance(identity, dict) or not isinstance(origin, dict)
                    or not isinstance(trigger, dict)):
                raise ValueError("Malformed radar evidence")
            entries.append({
                "id": id_, "layer": "automatic_observation", "status": "unverified",
                "title": str(visible.get("text_from_source") or "")[:1200],
                "speaker_labels": [str(identity.get("label") or "نام مرتبط با خبر")[:120]],
                "speaker_keys": [identity["profile_handle"]]
                if identity.get("profile_handle") else [],
                "identity_verification_level": "not_verified_from_primary",
                "topics": [],  # Never imply a stance by lexical coincidence.
                "time_label": str(trigger.get("time_mention") or "")[:150] or None,
                "time_is_verified_deadline": False,
                "trigger_kind": trigger.get("kind") or "undetermined",
                "condition_mention": trigger.get("condition_mention"),
                "has_result_source": False,
                "linked_ledger_claim_ids_for_review": linked,
                "source_pointer": str(origin.get("record_id") or "")[:200],
                "source_kind": origin.get("kind"),
                "source_url": origin.get("link"),
            })
        elif status == "screened_out_by_current_filter":
            screened += 1
            entries.append({
                "id": id_, "layer": "quality_audit", "status": "screened_out",
                "title": "مدخل ماشینی کنارگذاشته‌شده از پیش‌بینی‌های قابل‌پیگیری",
                "speaker_labels": [], "speaker_keys": [],
                "identity_verification_level": "not_attributed",
                "topics": [], "time_label": None,
                "time_is_verified_deadline": False,
                "has_result_source": False,
                "linked_ledger_claim_ids_for_review": linked,
                "source_pointer": "backend/data/karname-candidates.json",
                "screening_reason": str(c.get("screening_reason_fa")
                                        or c.get("automated_screening_note")
                                        or "از فیلتر کیفی عبور نکرده است.")[:500],
            })
        else:
            other += 1
            # Future resolved/withdrawn statuses remain traceable, but are
            # not exposed as statements without an explicit publication policy.
            entries.append({
                "id": id_, "layer": "quality_audit", "status": "other_not_publicly_attributed",
                "title": "مدخل ثبت‌شده با وضعیت نیازمند تعیین تکلیف",
                "speaker_labels": [], "speaker_keys": [],
                "identity_verification_level": "not_attributed",
                "topics": [], "time_label": None,
                "time_is_verified_deadline": False,
                "has_result_source": False,
                "linked_ledger_claim_ids_for_review": linked,
                "source_pointer": "backend/data/karname-candidates.json",
            })

    if len(radar_by_id) != pending:
        raise ValueError("Published radar count differs from the pending review count")
    counts = {
        "total": len(entries),
        "documented": len(official),
        "automatic_unverified": pending,
        "screened_from_public_claims": screened,
        "other_review_states": other,
    }
    if (counts["total"] != sum(v for k, v in counts.items() if k != "total")
            or len({e["id"] for e in entries}) != counts["total"]):
        raise ValueError("Integrated index count/ID integrity failure")

    return {
        "schema_version": 1,
        "scope": "integrated_discovery_index_not_a_verdict_or_primary_source",
        "source_of_truth": {
            "documented": "/data/karname.json",
            "unverified_observations": "/karname/auto-radar.json",
            "review_queue": "backend/data/karname-candidates.json",
        },
        "counts": counts,
        "notice_fa": "این نمایه همهٔ رکوردهای کارنامه را با سطح اطمینانشان به هم متصل می‌کند. رصدهای ماشینی پیش‌بینی تأییدشده نیستند؛ رکوردهای پالایش‌شده فقط برای ممیزی نگهداری می‌شوند.",
        "entries": entries,
    }


def build(ledger_path: Path = LEDGER, queue_path: Path = QUEUE, radar_path: Path = RADAR,
          output: Path = OUTPUT, *, check: bool = False) -> dict:
    integrated = normalized(
        read_json(Path(ledger_path)), read_json(Path(queue_path)), read_json(Path(radar_path)))
    content = json.dumps(integrated, ensure_ascii=False, indent=2) + "\n"
    output = Path(output)
    if check:
        if not output.is_file() or output.read_text(encoding="utf-8") != content:
            raise ValueError("Unified Karname index is out of sync")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        tmp = output.with_suffix(".json.tmp")
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(output)
    print("Karname integrated index:", json.dumps(integrated["counts"], ensure_ascii=False))
    return integrated


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--ledger", type=Path, default=LEDGER)
    p.add_argument("--queue", type=Path, default=QUEUE)
    p.add_argument("--radar", type=Path, default=RADAR)
    p.add_argument("--output", type=Path, default=OUTPUT)
    p.add_argument("--check", action="store_true")
    args = p.parse_args()
    try:
        build(args.ledger, args.queue, args.radar, args.output, check=args.check)
    except (ValueError, OSError, TypeError) as exc:
        print("Karname integrated index refused inconsistent inputs:", exc, file=sys.stderr)
        sys.exit(1)
