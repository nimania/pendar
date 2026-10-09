#!/usr/bin/env python3
"""Validate Pendar Future Observatory's exported static artifact.

Checks actual site/ output, rather than merely Git source paths.
"""
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("site")
routes = [
    "future", "future/method", "future/transition",
    "future/transition/fattahi", "future/transition/watch",
    "future/transition/editor",
] + [
    "future/transition/institution/" + key for key in
    ("authority", "executive", "justice", "mahestan", "security", "economy", "watch", "assembly")
]
assets = [
    "future-live.js",
    "future-editor.js",
    "data/stories.json",
    "data/future-methodology.json",
    "data/future-research-books.json",
    "data/future-fattahi-model.json",
    "data/future-evidence-reviews.json",
]
errors = []
for route in routes:
    p = root / route / "index.html"
    if not p.is_file() or p.stat().st_size < 200:
        errors.append(f"Missing or empty page: {p}")
        continue
    body = p.read_text(encoding="utf-8")
    if "<html" not in body or "</html>" not in body:
        errors.append(f"Malformed page: {p}")
for rel in assets:
    p = root / rel
    if not p.is_file() or p.stat().st_size == 0:
        errors.append(f"Missing asset: {p}")
for rel in (x for x in assets if x.endswith(".json") and x != "data/stories.json"):
    p = root / rel
    if p.is_file():
        try:
            json.loads(p.read_text(encoding="utf-8"))
        except (ValueError, UnicodeError) as e:
            errors.append(f"Invalid JSON: {rel}: {e}")
watch = root / "future/transition/watch/index.html"
if watch.is_file() and "/future-live.js" not in watch.read_text(encoding="utf-8"):
    errors.append("Watch page does not load /future-live.js")
if errors:
    for message in errors:
        print("FAIL:", message)
    sys.exit(1)
print(f"PASS: {len(routes)} Future routes and {len(assets)} required assets")
