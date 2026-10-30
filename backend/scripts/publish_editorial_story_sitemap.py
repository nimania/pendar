#!/usr/bin/env python3
"""Publish an evidence-checked sitemap of Pendar's *authored* /story/ pages.

Run after the Jan Kalam news migration (and, on full builds, after the
general sitemap reconciliation). News stories and legacy archives never enter
this sitemap. No article HTML is synthesized or modified here.
"""
from __future__ import annotations

import argparse
import html
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

ORIGIN = "https://pendar.io"
NAME = "sitemap-editorial.xml"
NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
ET.register_namespace("", NS)
Q = "{" + NS + "}"
UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", re.I)
SEGMENT = re.compile(r"[A-Za-z0-9][A-Za-z0-9-]{2,100}")
TAG = re.compile(r"<[^>]*>", re.S)
ATTR = re.compile(r'([a-zA-Z_:][-a-zA-Z0-9_:]*)\s*=\s*(["\'])(.*?)\2', re.S)
SEO_SECTION = re.compile(
    r'<section\b[^>]*\bid=["\']seo-static["\'][^>]*>(.*?)<!--\s*seo-end\s*-->',
    re.I | re.S,
)
PARAGRAPH = re.compile(r"<p\b[^>]*>(.*?)</p>", re.I | re.S)
H1 = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.I | re.S)
SCRIPT = re.compile(
    r'<script\b[^>]*\bid=["\']seo-schema["\'][^>]*>(.*?)</script>', re.I | re.S
)


def attrs(tag: str) -> dict[str, str]:
    return {key.lower(): html.unescape(value) for key, _, value in ATTR.findall(tag)}


def visible(markup: str) -> str:
    markup = re.sub(r"<(script|style|nav|aside)\b[^>]*>.*?</\1>", "", markup, flags=re.I | re.S)
    return " ".join(html.unescape(TAG.sub(" ", markup)).split())


def candidate_url(site: Path, url: str) -> tuple[Path | None, str]:
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc != "pendar.io"
            or parsed.query or parsed.fragment or not parsed.path.endswith("/")):
        return None, "invalid_url"
    parts = parsed.path.strip("/").split("/")
    if len(parts) != 2 or parts[0] != "story" or not SEGMENT.fullmatch(parts[1]):
        return None, "invalid_story_path"
    folder = unquote(parts[1])
    if not SEGMENT.fullmatch(folder):
        return None, "unsafe_path"
    return site / "story" / folder / "index.html", ""


def validate_story(site: Path, url: str) -> str | None:
    path, reason = candidate_url(site, url)
    if reason:
        return reason
    if path is None or not path.is_file():
        return "missing_html"
    content = path.read_text(encoding="utf-8")
    match_head = re.search(r"<head\b[^>]*>(.*?)</head>", content, re.I | re.S)
    if not match_head or "<body" not in content.lower():
        return "missing_document"
    head = match_head.group(1)
    canonical = [attrs(tag).get("href") for tag in re.findall(r"<link\b[^>]*>", head, re.I)
                 if attrs(tag).get("rel", "").lower() == "canonical"]
    if canonical != [url]:
        return "not_self_canonical"
    meta = [attrs(tag) for tag in re.findall(r"<meta\b[^>]*>", head, re.I)]
    robots = [x.get("content", "").lower() for x in meta if x.get("name", "").lower() == "robots"]
    if not robots or not any("index" in x.split(",") or "index" in x.replace(" ", "").split(",") for x in robots):
        return "not_explicitly_indexable"
    if any("noindex" in x for x in robots):
        return "noindex"
    if any(x.get("http-equiv", "").lower() == "refresh" for x in meta):
        return "redirect"
    title = re.search(r"<title\b[^>]*>(.*?)</title>", head, re.I | re.S)
    if not title or len(visible(title.group(1))) < 12:
        return "generic_title"
    section = SEO_SECTION.search(content)
    if not section:
        return "missing_prerendered_article"
    body = section.group(1)
    heading = H1.search(body)
    if not heading or len(visible(heading.group(1))) < 8:
        return "missing_article_heading"
    paragraphs = [visible(p) for p in PARAGRAPH.findall(body)]
    text = " ".join(p for p in paragraphs if p)
    if len(text) < 300:
        return "insufficient_article_text"
    schema = SCRIPT.search(head)
    if not schema:
        return "missing_article_schema"
    try:
        schema_data = json.loads(schema.group(1))
    except (ValueError, TypeError):
        return "invalid_article_schema"
    if not isinstance(schema_data, dict):
        return "invalid_article_schema"
    graph = schema_data.get("@graph", [])
    # Full rebuilds emit @graph; fast-deployed editorial permalinks emit a
    # single top-level Article. Both are legitimate JSON-LD representations.
    nodes = [schema_data] + (graph if isinstance(graph, list) else [])
    if not any(
        isinstance(node, dict)
        and node.get("@type") in ("Article", "NewsArticle", "ReportageNewsArticle")
        and node.get("url") == url for node in nodes
    ):
        return "article_schema_url_mismatch"
    return None


def canonical_targets(site: Path, url: str) -> list[str]:
    """Extract all declared canonicals, rather than trusting the first match."""
    path, reason = candidate_url(site, url)
    if reason or path is None or not path.is_file():
        return []
    content = path.read_text(encoding="utf-8")
    head = re.search(r"<head\b[^>]*>(.*?)</head>", content, re.I | re.S)
    if not head:
        return []
    return [attrs(tag).get("href", "") for tag in re.findall(r"<link\b[^>]*>", head.group(1), re.I)
            if attrs(tag).get("rel", "").lower() == "canonical"]


def article_fingerprint(site: Path, url: str) -> str:
    """A report alias must share the actual prerendered article, not a title."""
    path, reason = candidate_url(site, url)
    if reason or path is None or not path.is_file():
        return ""
    source = path.read_text(encoding="utf-8")
    section = SEO_SECTION.search(source)
    if not section:
        return ""
    body = section.group(1)
    heading = H1.search(body)
    text = " ".join(visible(p) for p in PARAGRAPH.findall(body))
    if not heading or len(text) < 300:
        return ""
    # Compare report body + heading; navigation, HTML and SEO wrappers may
    # legitimately differ across UUID and readable permalink variants.
    return visible(heading.group(1)) + "\n" + text


def build(site: Path) -> dict:
    site = Path(site)
    data_file = site / "data/news-destinations.json"
    if not data_file.is_file():
        raise RuntimeError("Missing news-destinations.json; run Jan Kalam migration first")
    data = json.loads(data_file.read_text(encoding="utf-8"))
    owned = data.get("editorial")
    if not isinstance(owned, dict) or not owned:
        raise RuntimeError("No declared Pendar-authored stories; refusing to publish empty sitemap")
    index = site / "sitemap.xml"
    if not index.is_file():
        raise RuntimeError("Missing sitemap index")
    tree = ET.parse(index)
    root = tree.getroot()
    if root.tag != Q + "sitemapindex":
        raise RuntimeError("Expected sitemapindex")

    valid_urls: set[str] = set()
    rejected = Counter()
    recovered = Counter()
    examples: dict[str, list[str]] = {}
    canonical_diagnostics: list[dict[str, str]] = []
    for story_id, url in sorted(owned.items()):
        if not UUID.fullmatch(story_id) or not isinstance(url, str):
            rejected["invalid_ownership_record"] += 1
            continue
        problem = validate_story(site, url)
        if problem == "not_self_canonical":
            canonical = canonical_targets(site, url)
            if len(canonical) == 1 and canonical[0] != url:
                target = canonical[0]
                # Only accept a real, self-canonical, independently readable
                # /story/ page carrying precisely the same article text.
                target_problem = validate_story(site, target)
                if (target_problem is None
                        and article_fingerprint(site, url)
                        and article_fingerprint(site, url) == article_fingerprint(site, target)):
                    valid_urls.add(target)
                    recovered["verified_matching_canonical_alias"] += 1
                    continue
                if len(canonical_diagnostics) < 8:
                    canonical_diagnostics.append({
                        "listed": url, "declared_canonical": target,
                        "canonical_problem": target_problem or "body_mismatch",
                    })
            elif len(canonical_diagnostics) < 8:
                canonical_diagnostics.append({
                    "listed": url, "canonical_tags": str(canonical),
                    "canonical_problem": "zero_or_multiple_canonicals",
                })
        if problem:
            rejected[problem] += 1
            if len(examples.setdefault(problem, [])) < 5:
                examples[problem].append(url)
        else:
            valid_urls.add(url)

    # Never publish a sitemap of redirects or empty SPA wrappers.
    if not valid_urls:
        raise RuntimeError("Zero independently readable, self-canonical editorial stories; refusing release")

    # All /story/ URL discovery is centralized in the curated sitemap. Remove
    # stale news, duplicates and unqualified editorials from older sitemap shards.
    removed = 0
    for entry in root.findall(Q + "sitemap"):
        loc = entry.findtext(Q + "loc") or ""
        parsed = urlsplit(loc)
        filename = parsed.path.lstrip("/")
        if (f"{parsed.scheme}://{parsed.netloc}" != ORIGIN or "/" in filename
                or not filename.endswith(".xml") or filename == NAME):
            continue
        target = site / filename
        if not target.is_file():
            continue
        doc = ET.parse(target)
        sheet = doc.getroot()
        if sheet.tag != Q + "urlset":
            raise RuntimeError("Unexpected XML in " + filename)
        dirty = False
        for node in list(sheet.findall(Q + "url")):
            value = node.findtext(Q + "loc") or ""
            if urlsplit(value).path.startswith("/story/"):
                sheet.remove(node)
                removed += 1
                dirty = True
        if dirty:
            doc.write(target, encoding="utf-8", xml_declaration=True)

    output = ET.Element(Q + "urlset")
    for url in sorted(valid_urls):
        node = ET.SubElement(output, Q + "url")
        ET.SubElement(node, Q + "loc").text = url
    ET.ElementTree(output).write(site / NAME, encoding="utf-8", xml_declaration=True)

    entries = [x for x in root.findall(Q + "sitemap")
               if x.findtext(Q + "loc") == ORIGIN + "/" + NAME]
    for extra in entries[1:]:
        root.remove(extra)
    if not entries:
        entry = ET.SubElement(root, Q + "sitemap")
        ET.SubElement(entry, Q + "loc").text = ORIGIN + "/" + NAME
    tree.write(index, encoding="utf-8", xml_declaration=True)

    # Validate the actual written output, not merely the preflight candidates.
    published = ET.parse(site / NAME).getroot()
    urls = [x.findtext(Q + "loc") for x in published.findall(Q + "url")]
    if len(urls) != len(valid_urls) or set(urls) != valid_urls:
        raise RuntimeError("Published editorial sitemap was truncated or duplicated")
    for url in urls:
        problem = validate_story(site, url)
        if problem:
            raise RuntimeError("Invalid story advertised in sitemap: " + url + " " + problem)

    audit = {
        "owner": "pendar.io /story/ authored reports",
        "sitemap": ORIGIN + "/" + NAME,
        "candidates": len(owned),
        "indexable": len(valid_urls),
        "removed_old_story_sitemap_entries": removed,
        "excluded_by_reason": dict(sorted(rejected.items())),
        "recovered_by_reason": dict(sorted(recovered.items())),
        "excluded_canonical_examples": canonical_diagnostics,
        "excluded_examples": examples,
        "sample_urls": sorted(valid_urls)[:20],
    }
    report = site / "data/story-sitemap-audit.json"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Pendar authored story sitemap: " + json.dumps(
        {key: value for key, value in audit.items() if key not in ("excluded_examples", "excluded_canonical_examples", "sample_urls")},
        ensure_ascii=False), flush=True)
    if canonical_diagnostics:
        print("Canonical mismatch examples: " + json.dumps(canonical_diagnostics[:5], ensure_ascii=False), flush=True)
    return audit


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, type=Path)
    build(parser.parse_args().site)
