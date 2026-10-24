#!/usr/bin/env python3
"""Add validated, recent canonical stories to the fast-deploy sitemap.

Never removes older sitemap entries and never modifies story HTML.
"""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

BASE = "https://pendar.io"
NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
ET.register_namespace("", NS)
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)

def read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return default

def run(site: Path, limit=100):
    stories = read(site/"data"/"stories.json", [])
    rows = stories if isinstance(stories, list) else stories.get("stories", [])
    mapping = read(site/"data"/"story-permalinks.json", {}).get("id_to_slug", {})
    candidates = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        sid = str(row.get("id", ""))
        if not UUID.fullmatch(sid):
            continue
        file = site/"story"/sid/"index.html"
        if not file.is_file():
            continue
        html = file.read_text(encoding="utf-8")
        if 'id="seo-static"' not in html or not re.search(r'<meta\s+name="robots"\s+content="index,follow', html, re.I):
            continue
        expected = BASE + "/story/" + str(mapping.get(sid) or sid) + "/"
        canonical = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', html, re.I)
        if not canonical or canonical.group(1) != expected:
            continue
        date = str(row.get("published_at") or "")
        candidates.append((date, expected))
    selected = sorted(set(candidates), reverse=True)[:limit]
    if not selected:
        print("::warning::No validated recent story URLs for sitemap; leaving published sitemap unchanged")
        return 0
    index = site/"sitemap.xml"
    if not index.is_file():
        raise RuntimeError("Missing sitemap.xml; cannot advertise fast-deploy stories")
    root = ET.parse(index).getroot()
    if root.tag != "{%s}sitemapindex" % NS:
        raise RuntimeError("Expected sitemapindex at sitemap.xml")
    name = "sitemap-fast-stories.xml"
    loc = BASE + "/" + name
    output = ET.Element("{%s}urlset" % NS)
    for _, url in selected:
        ET.SubElement(ET.SubElement(output, "{%s}url" % NS), "{%s}loc" % NS).text = url
    ET.ElementTree(output).write(site/name, encoding="utf-8", xml_declaration=True)
    if not any(node.text == loc for node in root.iter("{%s}loc" % NS)):
        ET.SubElement(ET.SubElement(root, "{%s}sitemap" % NS), "{%s}loc" % NS).text = loc
        ET.ElementTree(root).write(index, encoding="utf-8", xml_declaration=True)
    print(f"Fast story sitemap: {len(selected)} verified canonical story URLs")
    return len(selected)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--site", type=Path, default=Path("site"))
    p.add_argument("--limit", type=int, default=100)
    a = p.parse_args()
    run(a.site, a.limit)
