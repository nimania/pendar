#!/usr/bin/env python3
"""Refresh cached news article SPA shells without discarding prerendered SEO.

Fast Deploy restores a successful Pages artifact and replaces only site/index.html.
Old story/{uuid}/index.html files would otherwise keep outdated JS/CSS forever.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import re

UUID_RE = re.compile(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")
SEO_SECTION_RE = re.compile(
    r'(<section\s+id="seo-static"[\s\S]*?<!--\s*seo-end\s*-->)',
    re.I,
)
SEO_SCHEMA_RE = re.compile(
    r'<script\b[^>]*\bid="seo-schema"[^>]*>[\s\S]*?</script>', re.I
)
HEAD_RE = re.compile(r"<head\b[^>]*>([\s\S]*?)</head>", re.I)
TITLE_RE = re.compile(r"<title\b[^>]*>[\s\S]*?</title>", re.I)
DESCRIPTION_RE = re.compile(
    r'<meta\s+name="description"\s+[^>]*>', re.I
)
TAG_RE = re.compile(r"<(?:meta|link)\b[^>]*>", re.I)
KEEP_META_RE = re.compile(
    r'(?:rel="canonical"|name="robots"|property="og:[^"]+"|name="twitter:[^"]+")',
    re.I,
)
REMOVE_META_RE = re.compile(
    r'<(?:meta|link)\b[^>]*(?:rel="canonical"|name="robots"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>',
    re.I,
)
# These first-paint rules are needed on the homepage, not as thousands of
# inline duplicates in each story entry. The same rules are now retained in
# the shared heritage-article.css, which story pages already load.
SHARED_HOME_STYLE_IDS = (
    "heritage-live-visibility",
    "figures-timeline-critical",
    "homepage-news-image-safety",
    "pendar-priority-home",
    "story-editorial-critical",
)


def compact_story_shell(shell: str) -> str:
    """Move shared inline rules into the common article stylesheet.

    Preserve the editorial CSS, app bootstrap, route DOM, article metadata,
    and any prerendered text. Only whitespace between line-separated tags in
    the *template* (not article SEO content) is compacted.
    """
    for style_id in SHARED_HOME_STYLE_IDS:
        pattern = r'<style\s+id="' + re.escape(style_id) + r'">[\s\S]*?</style>[\t ]*\r?\n?'
        shell = re.sub(pattern, "", shell, count=1, flags=re.I)
    # Critical article rules are loaded from heritage-article.css. Never
    # duplicate them across thousands of prerendered article/identity routes.
    shell = re.sub(r'>[ \t]*\r?\n[ \t]*<', '><', shell)
    return shell


VISIBILITY_CSS = (
    '<style id="pendar-prerender-visibility">'
    'html:not(.js-enabled) main.wrap{display:none!important}'
    'html.js-enabled #seo-static{display:none!important}'
    '</style>'
)


def refresh_shell(shell: str, old: str) -> str:
    """Use the current app shell, retaining SEO metadata and crawler-readable text."""
    template = shell
    oldhead_match = HEAD_RE.search(old)
    if oldhead_match:
        oldhead = oldhead_match.group(1)
        title = TITLE_RE.search(oldhead)
        description = DESCRIPTION_RE.search(oldhead)
        if title:
            template = TITLE_RE.sub(lambda _: title.group(0), template, count=1)
        if description:
            template = DESCRIPTION_RE.sub(lambda _: description.group(0), template, count=1)
        seo_tags = [x.group(0) for x in TAG_RE.finditer(oldhead)
                    if KEEP_META_RE.search(x.group(0))]
        schema = SEO_SCHEMA_RE.search(oldhead)
        if seo_tags or schema:
            template = REMOVE_META_RE.sub("", template)
            template = SEO_SCHEMA_RE.sub("", template)
            template = template.replace("</head>", "".join(seo_tags)
                                        + (schema.group(0) if schema else "")
                                        + "</head>", 1)

    if '<base href="/">' not in template:
        template = template.replace("<head>", '<head><base href="/">', 1)
    # Repeated inline UI CSS makes cached direct article pages exceed the
    # publication footprint. Compact only the shared SPA wrapper; do NOT
    # compact the prerendered SEO article body, its tags, or its source links.
    template = compact_story_shell(template)
    seo_section = SEO_SECTION_RE.search(old)
    if seo_section:
        # The cached body is the authoritative prerendered editorial article
        # used by search engines; only its application shell is replaced.
        template = template.replace('<main class="wrap">',
                                    seo_section.group(1) + '<main class="wrap">', 1)
        template = template.replace("</head>", VISIBILITY_CSS + "</head>", 1)
    return template


def run(site: Path) -> tuple[int, int]:
    shell_path = site / "index.html"
    shell = shell_path.read_text(encoding="utf-8")
    assert 'heritage-article.css?v=' in shell, "Current article CSS absent from root shell"
    assert 'story-detail.js?v=' in shell, "Current article renderer absent from root shell"
    shared_css = (site / "heritage-article.css").read_text(encoding="utf-8")
    for style_id in SHARED_HOME_STYLE_IDS:
        if f"/* {style_id} */" not in shared_css:
            raise RuntimeError("Missing shared homepage fallback rules: " + style_id)
    refreshed = protected = 0
    for entry in (site / "story").glob("*/index.html"):
        if not UUID_RE.fullmatch(entry.parent.name):
            continue
        current = entry.read_text(encoding="utf-8")
        result = refresh_shell(shell, current)
        if 'heritage-article.css?v=' not in result:
            raise RuntimeError(f"New magazine CSS disappeared from {entry}")
        if 'id="seo-static"' in current:
            if 'id="seo-static"' not in result:
                raise RuntimeError(f"Prerendered article lost: {entry}")
            if 'id="seo-schema"' in current and 'id="seo-schema"' not in result:
                raise RuntimeError(f"Article structured data lost: {entry}")
            protected += 1
        if result != current:
            entry.write_text(result, encoding="utf-8")
            refreshed += 1
    return refreshed, protected


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", type=Path, default=Path("site"))
    args = ap.parse_args()
    count, seo_count = run(args.site)
    print(f"Refreshed {count} cached article entry shells; preserved "
          f"{seo_count} prerendered article bodies and their SEO metadata.")
