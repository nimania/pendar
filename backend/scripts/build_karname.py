#!/usr/bin/env python3
"""Deterministically compile karname/daftar.md into backend/data/karname.json.

The original Claude ledger has not yet been imported. This module never
invents claims, sources, evaluations, timestamps or probabilities.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LEDGER = ROOT / "karname/daftar.md"
DEFAULT_OUTPUT = ROOT / "backend/data/karname.json"


def extract(markdown: str) -> dict:
    fence = chr(96) * 3
    matches = re.findall(r"(?ms)^" + re.escape(fence) + r"json\s*\n(.*?)\n" +
                         re.escape(fence) + r"\s*$", markdown)
    if len(matches) != 1:
        raise ValueError("Exactly one fenced JSON block is required in daftar.md")
    payload = json.loads(matches[0])
    try:
        from .publish_karname_data import validate
    except ImportError:
        from publish_karname_data import validate
    validate(payload)
    people = {p.get("key") or p.get("name") for p in payload["speakers"]}
    if len(people) != len(payload["speakers"]):
        raise ValueError("Duplicated speaker identities")
    for claim in payload["claims"]:
        if not set(claim.get("speakers", [])).issubset(people):
            raise ValueError("Unknown speaker on claim " + claim["id"])
        if claim.get("result") is not None and not claim.get("result_source"):
            raise ValueError("A scored claim must include a result_source: " + claim["id"])
        if claim.get("source_type") == "secondary_editorial_recap":
            if not claim.get("source_record_id") or not claim.get("source_ref_url"):
                raise ValueError("Recap attribution is incomplete on " + claim["id"])
    if payload.get("is_complete") is True and payload.get("dataset_scope") != "canonical_full_ledger":
        raise ValueError("Only a confirmed canonical_full_ledger may claim completeness")
    return payload


def build(ledger: Path = DEFAULT_LEDGER, output: Path = DEFAULT_OUTPUT,
          check: bool = False) -> dict:
    payload = extract(Path(ledger).read_text(encoding="utf-8"))
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    output = Path(output)
    if check:
        if not output.is_file() or output.read_text(encoding="utf-8") != rendered:
            raise ValueError("Generated Karname JSON is out of sync with daftar.md")
    else:
        if output.is_file():
            previous = json.loads(output.read_text(encoding="utf-8"))
            older = {c["id"] for c in previous.get("claims", [])}
            newer = {c["id"] for c in payload["claims"]}
            missing = older - newer
            if missing:
                raise ValueError("Refusing to drop existing claim IDs: " +
                                 ", ".join(sorted(missing)[:12]))
        output.parent.mkdir(parents=True, exist_ok=True)
        temp = output.with_suffix(".json.tmp")
        temp.write_text(rendered, encoding="utf-8")
        temp.replace(output)
    print(f"Karname ledger: {len(payload['claims'])} claims; "
          f"{len(payload['speakers'])} speakers; complete={payload.get('is_complete') is True}")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        build(args.ledger, args.output, check=args.check)
    except (OSError, ValueError) as exc:
        print(f"Karname generation stopped: {exc}", file=sys.stderr)
        sys.exit(1)
