#!/usr/bin/env python3
"""Fail a Pages build if Pendar's core datasets are missing or catastrophically smaller.

This is intentionally dependency-free so every Pages-producing workflow can run it
immediately before upload-pages-artifact. A failed check stops deployment, leaving
the previously deployed GitHub Pages version untouched.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def load_json(root: Path, name: str):
    path = root / "data" / name
    if not path.is_file():
        raise ValueError(f"missing data/{name}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"invalid data/{name}: {exc}") from exc


def maybe_json(root: Path, name: str):
    path = root / "data" / name
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"invalid data/{name}: {exc}") from exc


def count_rows(value, key: str | None = None) -> int:
    if key is not None:
        if not isinstance(value, dict):
            return 0
        value = value.get(key, [])
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        return len(value)
    return 0


def snapshot(site: Path) -> dict:
    stats = load_json(site, "stats.json")
    stories = load_json(site, "stories.json")
    figures = load_json(site, "figures.json")
    trends = load_json(site, "trends.json")
    books = load_json(site, "books.json")
    entity_registry = load_json(site, "entity-registry.json")
    entity_qa = load_json(site, "entity-qa.json")

    periodicals = maybe_json(site, "periodicals.json")
    press_directory = load_json(site, "press-directory.json")
    tv_guide = load_json(site, "tv-guide.json")

    figure_rows = figures.get("figures", []) if isinstance(figures, dict) else []
    statements = sum(
        len(row.get("posts", []))
        for row in figure_rows
        if isinstance(row, dict) and isinstance(row.get("posts", []), list)
    )
    topics = trends.get("topics", []) if isinstance(trends, dict) else []
    book_rows = books.get("books", []) if isinstance(books, dict) else []
    entity_rows = entity_registry.get("entities", []) if isinstance(entity_registry, dict) else []
    entity_counts = entity_registry.get("counts", {}) if isinstance(entity_registry, dict) else {}
    entity_conflicts = entity_registry.get("conflicts", []) if isinstance(entity_registry, dict) else []
    qa_stats = entity_qa.get("stats", {}) if isinstance(entity_qa, dict) else {}
    tv_channels = tv_guide.get("channels", []) if isinstance(tv_guide, dict) else []
    tv_programmes = tv_guide.get("programmes", []) if isinstance(tv_guide, dict) else []
    tv_channel_ids = {str(x.get("id") or "") for x in tv_channels if isinstance(x, dict)}

    total = stats.get("total") if isinstance(stats, dict) else None
    if not isinstance(total, int):
        raise ValueError("data/stats.json has no integer total")

    timeline = stats.get("timeline", []) if isinstance(stats, dict) else []
    if not isinstance(timeline, list):
        raise ValueError("data/stats.json timeline is not a list")

    return {
        "total_news": total,
        "feed_stories": len(stories) if isinstance(stories, list) else 0,
        "figures": len(figure_rows),
        "statements": statements,
        "majra_topics": len([x for x in topics if isinstance(x, dict) and x.get("slug")]),
        "books": len(book_rows),
        "canonical_entities": len(entity_rows),
        "canonical_people": int(entity_counts.get("person") or 0),
        "entity_conflicts": len(entity_conflicts) if isinstance(entity_conflicts, list) else 0,
        "entity_duplicate_candidates": int(qa_stats.get("duplicate_candidates") or 0),
        "entity_ambiguous_aliases": int(qa_stats.get("ambiguous_aliases") or 0),
        "entity_orphans": int(qa_stats.get("orphans") or 0),
        "entity_broken_edges": int(qa_stats.get("broken_edges") or 0),
        "entity_invalid_overrides": int(qa_stats.get("invalid_overrides") or 0),
        "timeline_points": len(timeline),
        "periodicals_rows": count_rows(periodicals) if periodicals is not None else None,
        "press_directory_rows": count_rows(press_directory),
        "tv_channels": len(tv_channels),
        "tv_programmes": len(tv_programmes),
        "tv_has_bbc_persian": "bbc-persian:tv" in tv_channel_ids,
        "tv_has_setareh": "setareh:tv" in tv_channel_ids,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--site", required=True, type=Path)
    p.add_argument("--previous-site", type=Path)
    p.add_argument("--min-total-news", type=int, default=10000)
    p.add_argument("--min-feed-stories", type=int, default=20)
    p.add_argument("--min-figures", type=int, default=100)
    p.add_argument("--min-statements", type=int, default=100)
    p.add_argument("--min-majra-topics", type=int, default=3)
    p.add_argument("--min-books", type=int, default=50)
    p.add_argument("--min-canonical-entities", type=int, default=500)
    p.add_argument("--min-canonical-people", type=int, default=100)
    p.add_argument("--min-press-directory", type=int, default=20)
    p.add_argument("--min-tv-channels", type=int, default=2)
    p.add_argument("--min-tv-programmes", type=int, default=5)
    p.add_argument("--max-total-drop", type=float, default=0.20)
    args = p.parse_args()

    errors: list[str] = []
    try:
        cur = snapshot(args.site)
    except ValueError as exc:
        print(f"::error::Pendar integrity gate: {exc}")
        return 1

    thresholds = {
        "total_news": args.min_total_news,
        "feed_stories": args.min_feed_stories,
        "figures": args.min_figures,
        "statements": args.min_statements,
        "majra_topics": args.min_majra_topics,
        "books": args.min_books,
        "canonical_entities": args.min_canonical_entities,
        "canonical_people": args.min_canonical_people,
        "press_directory_rows": args.min_press_directory,
        "tv_channels": args.min_tv_channels,
        "tv_programmes": args.min_tv_programmes,
    }
    for key, minimum in thresholds.items():
        if cur[key] < minimum:
            errors.append(f"{key}={cur[key]} is below minimum {minimum}")

    if cur["entity_broken_edges"] > 0:
        errors.append(f"entity graph has {cur['entity_broken_edges']} broken edges")
    if cur["entity_invalid_overrides"] > 0:
        errors.append(f"entity overrides have {cur['entity_invalid_overrides']} validation errors")

    if not cur["tv_has_bbc_persian"]:
        errors.append("TV Guide is missing BBC Persian")
    if not cur["tv_has_setareh"]:
        errors.append("TV Guide is missing Setareh TV")

    # stats.timeline should describe the same published corpus as stats.total.
    if cur["timeline_points"] != cur["total_news"]:
        errors.append(
            f"timeline_points={cur['timeline_points']} does not match total_news={cur['total_news']}"
        )

    previous = None
    if args.previous_site and (args.previous_site / "data" / "stats.json").is_file():
        try:
            previous = snapshot(args.previous_site)
        except ValueError as exc:
            print(f"::warning::Could not read previous integrity baseline: {exc}")
        if previous and previous["total_news"] >= args.min_total_news:
            floor = int(previous["total_news"] * (1.0 - args.max_total_drop))
            if cur["total_news"] < floor:
                errors.append(
                    f"total_news dropped from {previous['total_news']} to {cur['total_news']} "
                    f"(more than {args.max_total_drop:.0%})"
                )

    report = {
        "ok": not errors,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "counts": cur,
        "thresholds": thresholds,
        "max_total_drop": args.max_total_drop,
        "previous_counts": previous,
        "github": {
            "repository": os.environ.get("GITHUB_REPOSITORY"),
            "workflow": os.environ.get("GITHUB_WORKFLOW"),
            "run_id": os.environ.get("GITHUB_RUN_ID"),
            "sha": os.environ.get("GITHUB_SHA"),
            "ref_name": os.environ.get("GITHUB_REF_NAME"),
        },
        "errors": errors,
    }

    if errors:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        for err in errors:
            print(f"::error::Pendar integrity gate blocked deploy: {err}")
        return 1

    out = args.site / "data" / "system-health.json"
    out.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        "Pendar integrity gate passed: "
        f"{cur['total_news']} news, {cur['figures']} figures, "
        f"{cur['statements']} statements, {cur['majra_topics']} Jan-e Majra topics, "
        f"{cur['books']} books, {cur['canonical_entities']} canonical entities, "
        f"{cur['press_directory_rows']} press sources, "
        f"{cur['tv_channels']} TV channels / {cur['tv_programmes']} programmes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
