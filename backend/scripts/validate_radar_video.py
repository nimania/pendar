"""Preflight validation of Persian Radar video scripts (does not publish).

Usage:
 python backend/scripts/validate_radar_video.py path/to/script.md --wpm 130
 python backend/scripts/validate_radar_video.py path/to/script.md --wpm 130 --json

An estimated pass is not a guarantee of spoken duration; calibrate from recorded speech.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

MIN_SECONDS = 480
DEFAULT_WPM = 130
WORD_RE = re.compile(r"[^\W_]+(?:[\u200c'’][^\W_]+)*", re.UNICODE)
REQUIRED_SECTIONS = ("نقشهٔ امروز", "جان کلام", "فردا چه چیزی را زیر نظر بگیریم")

def spoken_text(markdown: str) -> str:
    # Keep only spoken transcript preceding an optional source appendix.
    source_header = re.search(r"(?m)^#{1,6}\s*(?:منابع|یادداشت‌های راستی‌آزمایی|ضمیمهٔ منابع)\s*$", markdown)
    if source_header:
        markdown = markdown[:source_header.start()]
    markdown = re.sub(r"```[\s\S]*?```", " ", markdown)
    markdown = re.sub(r"(?m)^#{1,6}\s+.*$", " ", markdown)
    markdown = re.sub(r"(?m)^\s*[-*]\s*\[[ xX]\]\s*", "", markdown)
    markdown = re.sub(r"!\[[^]]*\]\([^)]*\)", " ", markdown)
    markdown = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", markdown)
    markdown = re.sub(r"https?://\S+", " ", markdown)
    markdown = re.sub(r"(?m)^\s*\|.*\|\s*$", " ", markdown)
    return markdown

def assess(script: str, wpm: float) -> dict:
    if wpm <= 0:
        raise ValueError("wpm must be positive")
    words = len(WORD_RE.findall(spoken_text(script)))
    estimated_seconds = round(words / wpm * 60)
    missing_sections = [label for label in REQUIRED_SECTIONS if label not in script]
    reasons = []
    if estimated_seconds < MIN_SECONDS:
        reasons.append("estimated_spoken_duration_below_8_minutes")
    if missing_sections:
        reasons.append("missing_required_sections")
    return {
        "words": words,
        "wpm": wpm,
        "estimated_seconds": estimated_seconds,
        "estimated_minutes": round(estimated_seconds / 60, 2),
        "minimum_spoken_seconds": MIN_SECONDS,
        "required_minimum_words_at_speed": int(MIN_SECONDS * wpm / 60 + 0.9999),
        "missing_sections": missing_sections,
        "passes_automated_preflight": not reasons,
        "reasons": reasons,
        "warning": "Estimate only: manually check citations, evidence independence, and measured voice duration."
    }

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", type=Path, help="UTF-8 Markdown transcript")
    parser.add_argument("--wpm", type=float, default=DEFAULT_WPM)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    report = assess(args.script.read_text(encoding="utf-8"), args.wpm)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"Spoken words: {report['words']} | estimated: {report['estimated_minutes']} min @ {args.wpm:g} WPM")
        print("PASS (estimated only)" if report["passes_automated_preflight"] else "FAIL: " + ", ".join(report["reasons"]))
        print(report["warning"])
    return 0 if report["passes_automated_preflight"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
