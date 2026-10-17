"""Materialize browsable, shareable dossiers for every Iran scenario family/subscenario.

Works in both complete and fast UI deployments. Pages are real directory-index
HTML (not client-only routes), with crawlable introductory content and a
source-linked evidence reader that uses current Pendar datasets after loading.
"""
from __future__ import annotations

import argparse
from html import escape
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[2]
STATIC = ROOT / "web-static"
CATALOG = STATIC / "data" / "iran-scenario-catalog.json"
SHELL = STATIC / "radar" / "iran-scenarios" / "scenario-template.html"
READER = STATIC / "radar" / "iran-scenarios" / "scenario" / "reader.js"
SLUG = re.compile(r"^[a-z][a-z0-9-]{1,70}$")


def build(site: Path) -> dict:
    site = Path(site)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    families = catalog["families"]
    scenarios = catalog["scenarios"]
    family_keys = {f["key"] for f in families}
    assert len(family_keys) == len(families) == 6
    assert len({(s["family"], s["slug"]) for s in scenarios}) == len(scenarios)
    assert all(SLUG.fullmatch(f["key"]) for f in families)
    assert all(SLUG.fullmatch(s["slug"]) and s["family"] in family_keys for s in scenarios)
    assert all(s["proponent"]["handle"] and s["proponent"]["name"] for s in scenarios)

    parent = site / "radar" / "iran-scenarios"
    parent.mkdir(parents=True, exist_ok=True)
    data_dir = site / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(CATALOG, data_dir / "iran-scenario-catalog.json")
    shutil.copy2(STATIC / "radar" / "iran-scenarios" / "index.html", parent / "index.html")
    reader_dir = parent / "scenario"
    reader_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(READER, reader_dir / "reader.js")
    template = SHELL.read_text(encoding="utf-8")

    def person_link(person):
        handle = person["handle"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]{2,80}", handle):
            raise ValueError("Unsafe person handle")
        return ('<a href="/@' + escape(handle, quote=True) + '/">'
                + escape(person["name"]) + '</a>')

    def page(family, scenario=None):
        title = scenario["title"] if scenario else family["title"]
        description = scenario["description"] if scenario else family["description"]
        url = ("/radar/iran-scenarios/" + family["key"] + "/" +
               (scenario["slug"] + "/" if scenario else ""))
        short_title = scenario["title"] if scenario else "پروندهٔ کلی"
        if scenario:
            intro = ('<section class="panel"><h2>توضیح زیرسناریو</h2><p>' +
                     escape(description) + '</p><p>مطرح‌کننده در نقشهٔ اولیه: ' +
                     person_link(scenario["proponent"]) + '</p>' +
                     '<small>انتساب اولیه، جای سند اصلی اظهارنظر را نمی‌گیرد؛ آرشیو و لینک‌ها هنگام بارگذاری بررسی می‌شوند.</small></section>')
        else:
            children = [s for s in scenarios if s["family"] == family["key"]]
            intro = ('<section class="panel"><h2>سناریوهای جزئی این خانواده</h2><ul>' +
                     "".join('<li><a href="' + url + escape(s["slug"]) + '/">' +
                             escape(s["title"]) + '</a> — ' +
                             person_link(s["proponent"]) + '</li>' for s in children) +
                     '</ul><p><strong>نشانه‌های قابل رصد:</strong> ' +
                     escape(family["watch"]) + '</p></section>')
        replacements = {
            "__PATH__": url,
            "__DESCRIPTION__": escape(description, quote=True),
            "__TITLE__": escape(title, quote=True),
            "__TYPE__": "زیرسناریو" if scenario else "خانوادهٔ سناریو",
            "__FAMILY_TITLE__": escape(family["title"]),
            "__FAMILY__": family["key"],
            "__SUB__": scenario["slug"] if scenario else "",
            "__SHORT_TITLE__": escape(short_title),
            "__STATIC_INTRO__": intro,
        }
        rendered = template
        for token, value in replacements.items():
            rendered = rendered.replace(token, value)
        if "__" in rendered and re.search(r"__[A-Z_]+__", rendered):
            raise ValueError("Unresolved template placeholder in " + url)
        dest = site / url.lstrip("/") / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(rendered, encoding="utf-8")
        return "https://pendar.io" + url

    generated = []
    for family in families:
        generated.append(page(family))
        for scenario in scenarios:
            if scenario["family"] == family["key"]:
                generated.append(page(family, scenario))

    # Full build and fast deploy already have XML sitemaps from build_seo.py.
    sitemap = site / "sitemap-1.xml"
    if sitemap.is_file():
        content = sitemap.read_text(encoding="utf-8")
        if "</urlset>" in content:
            additions = "".join(
                "<url><loc>" + escape(u) + "</loc></url>"
                for u in generated if "<loc>" + escape(u) + "</loc>" not in content
            )
            if additions:
                sitemap.write_text(content.replace("</urlset>", additions + "</urlset>"),
                                   encoding="utf-8")
    print(f"Iran scenario dossiers: {len(families)} families + "
          f"{len(scenarios)} subscenarios = {len(generated)} pages")
    return {"families": len(families), "subscenarios": len(scenarios),
            "pages": len(generated), "urls": generated}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, type=Path)
    args = ap.parse_args()
    build(args.site)
