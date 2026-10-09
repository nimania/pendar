"""Checks for backend/scripts/validate_specials.py. Runs with plain `python` (no pytest needed)."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("validate_specials", ROOT / "backend" / "scripts" / "validate_specials.py")
vs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vs)

DATA = json.loads((ROOT / "web-static" / "data" / "pendar-editorial-trends.json").read_text(encoding="utf-8"))


def errors_for(mutate) -> list[str]:
    d = copy.deepcopy(DATA)
    mutate(d["items"][0])
    return vs.validate(d, ROOT)[0]


def has(errs, needle):
    assert any(needle in e for e in errs), f"expected error containing {needle!r}, got {errs}"


def main():
    errs, _ = vs.validate(DATA, ROOT)
    assert not errs, errs

    def uncited(it):
        it["sections"][0]["items"][0]["src"] = []
    has(errors_for(uncited), "every claim must cite")

    def unknown(it):
        it["sections"][0]["items"][0]["src"] = ["made-up-source"]
    has(errors_for(unknown), "unknown source 'made-up-source'")

    def anon_view(it):
        next(s for s in it["sections"] if s["kind"] == "views")["items"][0]["who"] = ""
    has(errors_for(anon_view), "needs 'who'")

    def no_uncertainty(it):
        it["sections"] = [s for s in it["sections"] if s["kind"] != "uncertainty"]
    has(errors_for(no_uncertainty), "missing required section kind 'uncertainty'")

    def auto_unreviewed(it):
        it["origin"] = "auto"
    has(errors_for(auto_unreviewed), "cannot be live without review")

    def auto_ok(it):
        it.update(origin="auto", review="approved", reviewed_by="نیما")
    assert not errors_for(auto_ok)

    def no_notes(it):
        it["slug"], it["id"] = "no-notes-yet", "editorial-no-notes-yet"
    has(errors_for(no_notes), "editorial notes missing")

    def bad_level(it):
        it["outlook"][0]["level"] = 7
    has(errors_for(bad_level), "level must be an integer 1–5")

    def no_outlook_note(it):
        it["outlook_note"] = ""
    has(errors_for(no_outlook_note), "outlook_note")

    def bad_image(it):
        it["image"] = "assets/pendar/editorial/missing.webp"
    has(errors_for(bad_image), "image file not found")

    def http_source(it):
        it["sources"][0]["url"] = "http://example.com"
    has(errors_for(http_source), "https://")

    print("Specials validator: 12 checks passed.")


if __name__ == "__main__":
    main()
