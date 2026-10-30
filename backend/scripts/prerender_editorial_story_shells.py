#!/usr/bin/env python3
"""Repair generic /story/ shells only when a complete authored report exists.

Runs after news ownership is resolved and before publishing the curated
editorial sitemap. Never synthesizes a report from an unreviewed news summary.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

try:
    from .publish_story_permalinks import ensure_article_html, update_html_canonical
    from .publish_editorial_story_sitemap import ORIGIN, candidate_url, canonical_targets, validate_story
except ImportError:
    from publish_story_permalinks import ensure_article_html, update_html_canonical
    from publish_editorial_story_sitemap import ORIGIN, candidate_url, canonical_targets, validate_story

UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", re.I)
META = re.compile(r'<meta\b[^>]*\bname=["\x27]robots["\x27][^>]*>', re.I)
SCHEMA = re.compile(r'<script\b[^>]*\bid=["\x27]seo-schema["\x27][^>]*>.*?</script>', re.I | re.S)
STATIC = re.compile(r'<section\b[^>]*\bid=["\x27]seo-static["\x27][^>]*>.*?<!--\s*seo-end\s*-->', re.I | re.S)
REFRESH = re.compile(r'<meta\b[^>]*\bhttp-equiv=["\x27]refresh["\x27]', re.I)


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback


def has_full_report(detail: dict) -> bool:
    report = detail.get("editorial_report")
    if not isinstance(report, dict) or report.get("status") not in ("ai_draft", "published"):
        return False
    blocks = report.get("paragraphs")
    if not isinstance(blocks, list) or len(blocks) < 3:
        return False
    text = " ".join(str(p.get("text_fa") or "").strip()
                    for p in blocks if isinstance(p, dict))
    return len(text) >= 350 and len([p for p in blocks if isinstance(p, dict)
                                     and len(str(p.get("text_fa") or "")) >= 40]) >= 3


def ready_template(source: str) -> str:
    # The homepage is only a SPA template; remove *homepage* SEO annotations,
    # retaining its scripts and CSS while constructing the complete report.
    source = STATIC.sub("", source)
    source = SCHEMA.sub("", source)
    source = META.sub("", source)
    return source


def repair(site: Path) -> dict:
    site = Path(site)
    owned = read_json(site / "data/news-destinations.json", {}).get("editorial", {})
    if not isinstance(owned, dict) or not owned:
        raise RuntimeError("Missing editorial ownership manifest")
    shell_path = site / "index.html"
    if not shell_path.is_file():
        raise RuntimeError("Missing site HTML template")
    shell = ready_template(shell_path.read_text(encoding="utf-8"))
    if '<main class="wrap">' not in shell:
        raise RuntimeError("Missing HTML content insertion point")

    fixed = 0
    skipped = Counter()
    fixed_sample = []
    for sid, target in sorted(owned.items()):
        if not UUID.fullmatch(str(sid)) or not isinstance(target, str):
            skipped["invalid_ownership"] += 1
            continue
        path, invalid = candidate_url(site, target)
        if invalid or path is None:
            skipped["invalid_target"] += 1
            continue
        if validate_story(site, target) is None:
            skipped["already_valid"] += 1
            continue
        existing = path.read_text(encoding="utf-8") if path.is_file() else ""
        declared = canonical_targets(site, target)
        if REFRESH.search(existing) or re.search(r'<meta\b[^>]*\bname=["\x27]robots["\x27][^>]*\bnoindex', existing, re.I):
            skipped["intentional_redirect_or_noindex"] += 1
            continue
        # A canonical to another /story/ route can be a deliberate alias.
        # Never override it just to boost sitemap counts.
        if declared and declared not in ([ORIGIN + "/"], [target]):
            skipped["preserve_other_canonical"] += 1
            continue
        detail = read_json(site / "data/story" / (sid + ".json"), {})
        if not isinstance(detail, dict) or str(detail.get("id") or sid) != sid or not has_full_report(detail):
            skipped["no_complete_editorial_report"] += 1
            continue

        rendered = ensure_article_html(site, sid, detail, shell, editorial=True)
        if not rendered or 'id="seo-static"' not in rendered:
            skipped["cannot_prerender"] += 1
            continue
        uuid_url = ORIGIN + "/story/" + sid + "/"
        if target != uuid_url:
            rendered = update_html_canonical(rendered, uuid_url, target)
        # Keep the original UUID address functional but pointing at the same
        # canonical permalink; do not create a competing index candidate.
        uuid_path = site / "story" / sid / "index.html"
        to_write = [path] if path == uuid_path else [path, uuid_path]
        old = {p: p.read_bytes() if p.is_file() else None for p in to_write}
        try:
            for dest in to_write:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(rendered, encoding="utf-8")
            reason = validate_story(site, target)
            if reason:
                raise ValueError(reason)
        except (OSError, ValueError) as exc:
            for dest, previous in old.items():
                if previous is None:
                    dest.unlink(missing_ok=True)
                else:
                    dest.write_bytes(previous)
            skipped["generated_page_failed_validation"] += 1
            continue
        fixed += 1
        if len(fixed_sample) < 15:
            fixed_sample.append(target)

    result = {
        "editorial_candidates": len(owned), "repaired": fixed,
        "skipped": dict(sorted(skipped.items())), "sample_repaired": fixed_sample,
    }
    audit = site / "data/editorial-story-prerender-audit.json"
    audit.parent.mkdir(parents=True, exist_ok=True)
    audit.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Editorial prerender repair: " + json.dumps(
        {k: v for k, v in result.items() if k != "sample_repaired"}, ensure_ascii=False), flush=True)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, type=Path)
    repair(parser.parse_args().site)
