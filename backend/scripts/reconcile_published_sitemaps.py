#!/usr/bin/env python3
"""Repair sitemap references after the priority deployment omits optional pages.

Only advertise local, existing, indexable, self-canonical routes. The original
generated sitemap can include heavy movie archives subsequently excluded by
prepare_priority_site. Publishing such URLs would give Google dead links.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
ET.register_namespace("", NS)
Q = "{" + NS + "}"
ORIGIN = "https://pendar.io"
CANONICAL_RE = re.compile(r'<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"', re.I)
ROBOTS_RE = re.compile(r'<meta\b[^>]*\bname="robots"[^>]*\bcontent="([^"]+)"', re.I)


def valid(site: Path, url: str) -> bool:
    parsed = urlsplit(url)
    if f"{parsed.scheme}://{parsed.netloc}" != ORIGIN or parsed.query or parsed.fragment:
        return False
    clean = unquote(parsed.path)
    if ".." in Path(clean).parts or not clean.startswith("/"):
        return False
    target = site / clean.lstrip("/") / "index.html"
    if not target.is_file():
        return False
    # Avoid advertising noindex aliases or non-self canonical pages even when a
    # static placeholder exists.
    html = target.read_text(encoding="utf-8")
    robots = ROBOTS_RE.search(html)
    canonical = CANONICAL_RE.search(html)
    if robots and "noindex" in robots.group(1).lower():
        return False
    return bool(canonical and canonical.group(1) == url)


def reconcile(site: Path) -> dict:
    index_path = site / "sitemap.xml"
    index = ET.parse(index_path)
    root = index.getroot()
    if root.tag != Q + "sitemapindex":
        raise ValueError("Expected a sitemapindex in sitemap.xml")
    seen: set[str] = set()
    kept = missing = duplicates = 0
    shards = []
    empty_indexes = []

    for entry in list(root.findall(Q + "sitemap")):
        loc = entry.findtext(Q + "loc") or ""
        p = urlsplit(loc)
        name = Path(unquote(p.path)).name
        if f"{p.scheme}://{p.netloc}" != ORIGIN or "/" in name or not name.startswith("sitemap-") or not name.endswith(".xml"):
            continue
        target = site / name
        if not target.is_file():
            root.remove(entry)
            missing += 1
            continue
        doc = ET.parse(target)
        rows = doc.getroot()
        if rows.tag != Q + "urlset":
            raise ValueError(f"Unexpected XML root in {name}")
        before = len(rows.findall(Q + "url"))
        for item in list(rows.findall(Q + "url")):
            url = item.findtext(Q + "loc") or ""
            if url in seen:
                rows.remove(item)
                duplicates += 1
            elif not valid(site, url):
                rows.remove(item)
                missing += 1
            else:
                seen.add(url)
                kept += 1
        after = len(rows.findall(Q + "url"))
        if after:
            doc.write(target, encoding="utf-8", xml_declaration=True)
            shards.append({"file": name, "before": before, "after": after})
        else:
            root.remove(entry)
            empty_indexes.append(name)
            target.unlink()
    index.write(index_path, encoding="utf-8", xml_declaration=True)
    manifest = site / "data" / "seo-manifest.json"
    if manifest.is_file():
        data = json.loads(manifest.read_text(encoding="utf-8"))
        paths = [
            path for path in data.get("generated_paths", [])
            if isinstance(path, str) and
            (site / path).is_file() and ".." not in Path(path).parts
        ]
        data["generated_paths"] = paths
        data["pages"] = sum(1 for p in paths if p.endswith("/index.html")) + 1
        data["indexable"] = kept
        manifest.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    stats = {"kept": kept, "missing_or_noncanonical": missing,
             "duplicates": duplicates, "empty_sitemaps_removed": empty_indexes,
             "sitemaps": shards}
    print("Published sitemap reconciliation:", json.dumps(
        {k: v for k, v in stats.items() if k != "sitemaps"}, ensure_ascii=False
    ), flush=True)
    if kept < 100:
        raise ValueError("Too few valid public URLs remain; refusing to publish.")
    (site / "data" / "published-sitemap-audit.json").write_text(
        json.dumps(stats, ensure_ascii=False), encoding="utf-8"
    )
    return stats


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--site", required=True, type=Path)
    reconcile(p.parse_args().site)
