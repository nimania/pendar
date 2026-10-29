"""Export the complete news archive and retire its UI, preserving authored reports.

Run on the assembled publication artifact, after SEO and readable permalinks.
The news collector and its public JSON remain available to Jan Kalam.
"""
from __future__ import annotations

import argparse
import gzip
import html
import json
import re
from pathlib import Path
from urllib.parse import quote, urlparse
import xml.etree.ElementTree as ET

BASE = "https://nimania.github.io/jan-kalam/"
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)
COLLECTIONS = ("headlines", "feed", "news", "topic", "topics", "source", "day",
               "province", "iran", "fact", "trend")


def read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def editorial_story(row):
    # Conservatively keep any declared editorial record on Pendar, including
    # an older record whose report body is absent from the compact feed.
    return bool(row.get("editorial_report") or row.get("has_editorial_report"))


def news_url(kind, arg=""):
    if kind == "story":
        return BASE + "?story=" + quote(arg, safe="")
    if kind in ("headlines", "feed", "news"):
        return BASE
    return BASE + "#/" + kind + ("/" + quote(arg, safe="") if arg else "")


def redirect_page(target):
    escaped = html.escape(target, quote=True)
    return ('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>خبرها در جان‌کلام</title><link rel="canonical" href="' + escaped + '">'
            '<meta name="robots" content="noindex,follow">'
            '<meta http-equiv="refresh" content="0;url=' + escaped + '">'
            '<script>location.replace(' + json.dumps(target).replace("<", "\\u003c") + ');</script>'
            '</head><body><main><h1>خبرها در جان‌کلام</h1>'
            '<p>خبرخوان و آرشیو خبرهای پندار به جان‌کلام منتقل شده است.</p>'
            '<p><a href="' + escaped + '">ادامه در جان‌کلام ←</a></p>'
            '<p><a href="https://pendar.io/reports/">گزارش‌های تألیفی پندار</a></p>'
            '</main></body></html>')


def migrate(site):
    site = Path(site)
    data = site / "data"
    assert (data / "stories.json").is_file(), "Missing news data; refusing migration"
    feed = read(data / "stories.json", [])
    archive = read(data / "editorial-archive.json", {}).get("reports", [])
    protected = {str(row.get("id")) for row in archive if row.get("id")}
    # Editorial ownership survives a compact collector refresh that omits
    # report metadata; a previously protected URL must not become news.
    protected.update(read(data / "news-destinations.json", {}).get("editorial", {}))
    protected.update(str(row["id"]) for row in feed if editorial_story(row))
    pilots = site / "story-editorial-pilots.js"
    if pilots.is_file():
        protected.update(re.findall(r'^[ \t]*[\"\']([0-9a-f-]{36})[\"\']\s*:',
                                    pilots.read_text(encoding="utf-8"), re.M | re.I))
    stories = {}
    for path in sorted((data / "story").glob("*.json")):
        row = read(path, {})
        sid = str(row.get("id") or path.stem)
        if not UUID.fullmatch(sid) or not row:
            continue
        if editorial_story(row):
            protected.add(sid)
        stories[sid] = row
    missing = [row["id"] for row in feed if row.get("id") not in stories]
    if missing:
        raise ValueError("Missing published news details: " + ", ".join(missing[:5]))
    mapping = read(data / "story-permalinks.json", {}).get("id_to_slug", {})
    editorial = {sid: "https://pendar.io/story/" + quote(mapping.get(sid) or sid, safe="") + "/"
                 for sid in sorted(protected)}
    news = {sid: row for sid, row in stories.items() if sid not in protected}
    manifest = {"version": 1, "editorial": editorial,
                "news_ids": sorted(news), "slug_to_id": {slug: sid for sid, slug in mapping.items()}}
    data.mkdir(parents=True, exist_ok=True)
    (data / "news-destinations.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    (data / "news-destinations.js").write_text(
        "window.PENDAR_NEWS_DESTINATIONS=" + json.dumps({"editorial": editorial, "slug_to_id": manifest["slug_to_id"]}, ensure_ascii=False).replace("<", "\\u003c") + ";\n",
        encoding="utf-8")
    exported = {"version": 1, "stories": news, "editorial": editorial,
                "slug_to_id": manifest["slug_to_id"], "meta": read(data / "meta.json", {})}
    (data / "news-export.json.gz").write_bytes(gzip.compress(
        json.dumps(exported, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))

    moved = set()
    def write(kind, arg, target):
        if arg and ("/" in arg or "\\" in arg or arg in (".", "..")):
            return
        route = "/" + kind + "/" + (arg + "/" if arg else "")
        page = site / kind / arg / "index.html"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(redirect_page(target), encoding="utf-8")
        (page.parent / "seo.json").unlink(missing_ok=True)
        moved.add(route)

    for sid in news:
        target = news_url("story", sid)
        write("story", sid, target)
        slug = mapping.get(sid)
        if isinstance(slug, str) and slug:
            write("story", slug, target)
    for kind in COLLECTIONS:
        args = {""} | {p.parent.name for p in (site / kind).glob("*/index.html")}
        for arg in args:
            write(kind, arg, news_url(kind, arg))
    for page in (site / "event").glob("*/index.html"):
        # Editorial explainers use editorial-* IDs and stay on Pendar.
        arg = page.parent.name
        if arg.startswith("event-"):
            write("event", arg, news_url("event", arg))

    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    for path in site.glob("*sitemap*.xml"):
        root = ET.fromstring(path.read_text(encoding="utf-8"))
        if root.tag != ns + "urlset":
            continue
        for node in list(root):
            loc = node.find(ns + "loc")
            if loc is not None and urlparse(loc.text or "").path in moved:
                root.remove(node)
        ET.register_namespace("", ns[1:-1])
        ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
    result = {"news": len(news), "protected_reports": len(protected), "redirects": len(moved)}
    print("Jan Kalam migration:", json.dumps(result))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    migrate(parser.parse_args().site)
