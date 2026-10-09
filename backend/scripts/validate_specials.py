#!/usr/bin/env python3
"""Validate «ویژه‌های پندار» (hand-written / auto-drafted special explainers).

Contract: docs/specials.md. Data: web-static/data/pendar-editorial-trends.json.
Editorial notes (repo-only, never published): editorial/specials/<slug>.md

The same checks will gate auto-drafted specials later (phase 2), so every rule
here is a rule the generator must also satisfy. Errors fail the deploy;
warnings are printed only.

Usage:  python backend/scripts/validate_specials.py [--data FILE] [--root DIR]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = ROOT / "web-static" / "data" / "pendar-editorial-trends.json"

STATUSES = {"draft", "live", "archived"}
ORIGINS = {"manual", "auto"}
SENSITIVITY = {"normal", "sensitive"}
REVIEW = {"approved", "pending", "rejected"}
CATEGORIES = {"politics", "economy", "tech", "society", "security", "world", "culture", "science", "environment", "sport"}
# Section kinds every special must carry, in the order readers meet them.
REQUIRED_KINDS = ["fact", "views", "synthesis", "uncertainty"]
CITED_KINDS = {"fact", "views", "uncertainty"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SRC_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}(?:-\d{2})?$")  # YYYY-MM allowed when the day is unknown
QUESTION_HINTS = ("؟", "?")


def _iso(v) -> bool:
    if not isinstance(v, str):
        return False
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def _text(v, min_len=1) -> bool:
    return isinstance(v, str) and len(v.strip()) >= min_len


def validate_item(it: dict, root: Path) -> tuple[list[str], list[str]]:
    e: list[str] = []
    w: list[str] = []
    slug = it.get("slug", "")
    tag = slug or it.get("id") or "?"

    def err(msg):
        e.append(f"[{tag}] {msg}")

    def warn(msg):
        w.append(f"[{tag}] {msg}")

    # identity & lifecycle
    if not isinstance(slug, str) or not SLUG_RE.match(slug):
        err("slug must be lowercase latin words joined by '-' (e.g. starlink-iran)")
    if it.get("id") != f"editorial-{slug}":
        err(f"id must be 'editorial-{slug}'")
    status = it.get("status")
    if status not in STATUSES:
        err(f"status must be one of {sorted(STATUSES)}")
    origin = it.get("origin", "manual")
    if origin not in ORIGINS:
        err(f"origin must be one of {sorted(ORIGINS)}")
    if it.get("sensitivity", "normal") not in SENSITIVITY:
        err(f"sensitivity must be one of {sorted(SENSITIVITY)}")
    if it.get("category") not in CATEGORIES:
        err(f"category must be one of {sorted(CATEGORIES)}")
    for k in ("published_at", "updated_at"):
        if not _iso(it.get(k)):
            err(f"{k} must be an ISO date-time like 2026-10-09T09:45:00+03:30")
    if it.get("expires_at") is not None and not _iso(it.get("expires_at")):
        err("expires_at must be ISO date-time or absent")

    # auto drafts may never go live without a human approval
    if origin == "auto" and status == "live" and it.get("review") != "approved":
        err("auto-generated special cannot be live without review: approved")
    if origin == "auto" and it.get("sensitivity") == "sensitive" and status == "live" and not _text(it.get("reviewed_by")):
        err("sensitive auto special needs reviewed_by")
    if it.get("review") is not None and it.get("review") not in REVIEW:
        err(f"review must be one of {sorted(REVIEW)}")

    # headline block
    title = it.get("title", "")
    if not _text(title, 10):
        err("title missing or too short")
    elif not any(q in title for q in QUESTION_HINTS):
        warn("title is not phrased as a question — a special answers a real question")
    if not _text(it.get("question"), 8):
        (warn if origin == "manual" else err)("question (the one central question this special answers) is missing")
    if not _text(it.get("dek"), 20):
        err("dek (one-sentence standfirst) missing")
    sa = it.get("short_answer", "")
    if not _text(sa, 60):
        err("short_answer missing or under 60 characters")
    elif len(sa) > 700:
        warn(f"short_answer is long ({len(sa)} chars); aim for 2–4 sentences")
    terms = it.get("match_terms")
    if not isinstance(terms, list) or not terms or not all(_text(t) for t in terms):
        err("match_terms must be a non-empty list of words that link news to this special")

    # image
    for k in ("image", "image_alt", "image_credit"):
        if not _text(it.get(k)):
            err(f"{k} missing")
    for k in ("image", "image_fallback"):
        p = it.get(k)
        if _text(p) and not (root / "web-static" / p).is_file():
            err(f"{k} file not found: web-static/{p}")

    # sources
    sources = it.get("sources") or []
    ids: list[str] = []
    if len(sources) < 3:
        err("needs at least 3 sources")
    for i, s in enumerate(sources):
        sid = s.get("id", "")
        if not SRC_ID_RE.match(str(sid)):
            err(f"sources[{i}].id invalid: {sid!r}")
        ids.append(sid)
        if not _text(s.get("name")):
            err(f"source {sid}: name missing")
        if not _text(s.get("title")):
            err(f"source {sid}: title missing")
        if not str(s.get("url", "")).startswith("https://"):
            err(f"source {sid}: url must start with https://")
        if not DATE_RE.match(str(s.get("date", ""))):
            err(f"source {sid}: date must be YYYY-MM-DD (or YYYY-MM if the day is unknown)")
    dup = {x for x in ids if ids.count(x) > 1}
    if dup:
        err(f"duplicate source ids: {sorted(dup)}")
    names = {s.get("name") for s in sources}
    if len(sources) >= 3 and len(names) < 2:
        warn("all sources come from one outlet — add independent outlets")

    # sections
    sections = it.get("sections") or []
    kinds = [s.get("kind") for s in sections]
    for k in REQUIRED_KINDS:
        if k not in kinds:
            err(f"missing required section kind '{k}'")
    order = [k for k in kinds if k in REQUIRED_KINDS]
    if order != sorted(order, key=REQUIRED_KINDS.index):
        warn(f"sections should run {' → '.join(REQUIRED_KINDS)}")
    used: set[str] = set()
    for s in sections:
        kind = s.get("kind")
        if not _text(s.get("title")):
            err(f"section '{kind}' has no title")
        items = s.get("items") or []
        paras = s.get("paragraphs") or []
        if kind == "synthesis":
            if not paras:
                err("synthesis section needs paragraphs")
            continue
        if kind in CITED_KINDS and not items:
            err(f"section '{kind}' has no items")
        if kind == "fact" and len(items) < 3:
            warn("fewer than 3 facts")
        for j, x in enumerate(items):
            if not _text(x.get("text"), 15):
                err(f"{kind}[{j}] text missing")
            if kind == "views" and not _text(x.get("who")):
                err(f"views[{j}] needs 'who' — every view is attributed")
            src = x.get("src") or []
            if kind in CITED_KINDS and not src:
                err(f"{kind}[{j}] has no source — every claim must cite a source id")
            for sid in src:
                if sid not in ids:
                    err(f"{kind}[{j}] cites unknown source '{sid}'")
                used.add(sid)
    unused = [x for x in ids if x not in used]
    if unused:
        warn(f"sources never cited: {unused}")
    if "views" in kinds:
        whos = {x.get("who") for s in sections if s.get("kind") == "views" for x in s.get("items") or []}
        if len(whos) < 2:
            warn("views has fewer than 2 distinct sides")

    # outlook meter (optional, but if present it is labelled as editorial judgement)
    outlook = it.get("outlook")
    if outlook:
        for j, o in enumerate(outlook):
            if not _text(o.get("label")) or not _text(o.get("level_fa")) or not _text(o.get("note")):
                err(f"outlook[{j}] needs label, level_fa and note")
            if o.get("level") not in (1, 2, 3, 4, 5):
                err(f"outlook[{j}].level must be an integer 1–5")
        if not _text(it.get("outlook_note")):
            err("outlook present without outlook_note (must say it is editorial judgement, not a forecast)")

    watch = it.get("watch") or []
    if len(watch) < 3:
        warn("watch list should have at least 3 signals")

    # editorial notes = the learning data; required for every live manual special
    notes = root / "editorial" / "specials" / f"{slug}.md"
    if status == "live" and origin == "manual" and not notes.is_file():
        err(f"editorial notes missing: editorial/specials/{slug}.md (copy _template.md)")
    return e, w


def validate(data: dict, root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warns: list[str] = []
    items = data.get("items")
    if not isinstance(items, list):
        return ["top-level 'items' list missing"], []
    if not _iso(data.get("updated_at")):
        errors.append("top-level updated_at must be ISO date-time")
    slugs = [i.get("slug") for i in items]
    dup = {s for s in slugs if slugs.count(s) > 1}
    if dup:
        errors.append(f"duplicate slugs: {sorted(dup)}")
    pinned = [i.get("slug") for i in items if i.get("pinned") and i.get("status") == "live"]
    if len(pinned) > 3:
        warns.append(f"{len(pinned)} pinned live specials; keep at most 3 pinned")
    for it in items:
        e, w = validate_item(it, root)
        errors += e
        warns += w
    return errors, warns


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", type=Path, default=DEFAULT_DATA)
    p.add_argument("--root", type=Path, default=ROOT)
    a = p.parse_args()
    try:
        data = json.loads(a.data.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read {a.data}: {exc}")
        return 1
    errors, warns = validate(data, a.root)
    for x in warns:
        print("warning:", x)
    for x in errors:
        print("ERROR:", x)
    n = len(data.get("items") or [])
    if errors:
        print(f"Specials: {len(errors)} error(s) in {n} special(s).")
        return 1
    print(f"Specials: {n} special(s) valid, {len(warns)} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
