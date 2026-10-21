#!/usr/bin/env python3
"""Validate static SPA direct entrypoints before GitHub Pages deployment."""
import json
import re
import sys
from pathlib import Path

def validate(root: Path) -> list[str]:
    errors=[]
    shell=root/"index.html"
    if not shell.is_file():
        return ["missing site/index.html"]
    html=shell.read_text(encoding="utf-8")
    if '<base href="/">' not in html:
        errors.append("Missing absolute base href; nested routes may fetch relative JS")
    routes=["reports","diner","future","headlines","figures","books","movies","press"]
    directory=root/"data/pendar-editorial-authors.json"
    if directory.is_file():
        try:
            authors=json.loads(directory.read_text(encoding="utf-8")).get("authors",[])
            routes += ["editorial-author/"+a["id"] for a in authors]
            routes += ["@"+a["handle"] for a in authors]
        except (ValueError,KeyError,TypeError):
            errors.append("Invalid editorial author directory")
    else:
        errors.append("Missing editorial author directory")
    for route in routes:
        p=root/route/"index.html"
        if not p.is_file():
            errors.append(f"Missing direct-route shell: /{route}/")
        elif p.stat().st_size<1000 and not route.startswith("editorial-author/"):
            errors.append(f"Empty or truncated direct-route shell: /{route}/")
    # A standalone maritime page must not accidentally become the SPA homepage.
    naval=root/"naval/index.html"
    naval_feed=root/"naval/events.json"
    if not naval.is_file():
        errors.append("Missing dedicated maritime route: /naval/")
    elif "PENDAR · NAVAL OBSERVER" not in naval.read_text(encoding="utf-8"):
        errors.append("Maritime route replaced by homepage SPA shell: /naval/")
    if not naval_feed.is_file():
        errors.append("Missing local fallback maritime event archive: /naval/events.json")
    if not (root/"404.html").is_file():
        errors.append("Missing SPA fallback 404.html")
    script_src=re.findall(r'<script[^>]+src="([^"]+)"',html)
    for src in script_src:
        relative=src.split("?",1)[0].lstrip("/")
        if relative.startswith(("https:","http:")):continue
        if not (root/relative).is_file():
            errors.append(f"Missing referenced initial script: {relative}")
    for feature in ("diner.js","future.js"):
        if not (root/feature).is_file():
            errors.append(f"Missing lazy route module: {feature}")
    return errors

if __name__=="__main__":
    root=Path(sys.argv[1] if len(sys.argv)>1 else "site")
    errors=validate(root)
    if errors:
        for error in errors: print("::error::"+error)
        raise SystemExit(1)
    print("Direct-route entrypoints, lazy route modules and script references verified")
