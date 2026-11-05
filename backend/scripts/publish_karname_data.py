#!/usr/bin/env python3
"""Publish the verified, generated predictions ledger without fabricating data.

Source of truth is karname/daftar.md; this tool ONLY copies the generated
backend/data/karname.json. It does not edit claims or generate adjudications.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "backend/data/karname.json"


def validate(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Karname root must be a JSON object")
    for key in ("claims", "speakers"):
        if not isinstance(payload.get(key), list):
            raise ValueError(f"Karname {key} must be an array")
    ids = []
    for claim in payload["claims"]:
        if not isinstance(claim, dict) or not isinstance(claim.get("id"), str) or not claim["id"].strip():
            raise ValueError("Every claim must have a non-empty string id")
        if not isinstance(claim.get("speakers", []), list):
            raise ValueError(f"Claim {claim['id']} speakers must be an array")
        if not isinstance(claim.get("text", ""), str):
            raise ValueError(f"Claim {claim['id']} text must be a string")
        ids.append(claim["id"])
    if len(ids) != len(set(ids)):
        raise ValueError("Karname contains duplicate claim ids")
    for person in payload["speakers"]:
        if not isinstance(person, dict) or not (person.get("key") or person.get("name")):
            raise ValueError("Every speaker needs a key or name")
    for pair in payload.get("pairs", []):
        if not isinstance(pair, dict) or pair.get("a") not in ids or pair.get("b") not in ids:
            raise ValueError("Karname pair references an unknown claim")
    return payload


def publish(site: Path, source: Path = SOURCE, previous: Path | None = None) -> str:
    site = Path(site)
    output = site / "data/karname.json"
    choices = [("new", source)]
    if previous:
        choices.append(("previous", Path(previous) / "data/karname.json"))
    for label, path in choices:
        if not path.is_file():
            continue
        try:
            payload = validate(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, ValueError, UnicodeError) as exc:
            if label == "new":
                raise ValueError(f"Refusing invalid generated Karname source: {exc}") from exc
            print(f"Skipping invalid previous Karname: {exc}", file=sys.stderr)
            continue
        output.parent.mkdir(parents=True, exist_ok=True)
        tmp = output.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        tmp.replace(output)
        print(f"Karname data published from {label}: {len(payload['claims'])} claims")
        return label
    # Keep an already valid data file if an artifact carried one over.
    if output.is_file():
        try:
            validate(json.loads(output.read_text(encoding="utf-8")))
            print("Karname: kept valid existing dataset")
            return "existing"
        except (OSError, ValueError, UnicodeError):
            output.unlink()
    print("Karname source not available; dashboard remains in transparent empty state")
    return "missing"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, type=Path)
    parser.add_argument("--source", default=SOURCE, type=Path)
    parser.add_argument("--previous", type=Path)
    args = parser.parse_args()
    publish(args.site, args.source, args.previous)
