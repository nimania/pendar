"""Share unchanged SPA chrome across prerendered SEO pages.

Generated HTML retains its individual article text, canonical, metadata and
all script order. A parser-blocking shared script inserts the original SPA
<main> before deferred UI modules execute.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

SHELL_SCRIPT = '<script src="/seo-app-shell.js" onerror="document.documentElement.classList.remove(&quot;js-enabled&quot;)"></script>'
_MAIN = re.compile(r'<main\s+class="wrap">[\s\S]*?</main>', re.I)
_STYLE = re.compile(r'<style\b(?P<attrs>[^>]*)>(?P<code>[\s\S]*?)</style>', re.I)
_SCRIPT = re.compile(r'<script\b(?P<attrs>[^>]*)>(?P<code>[\s\S]*?)</script>', re.I)


def share_template(site: Path, template: str) -> tuple[str, str]:
    site = Path(site)
    if SHELL_SCRIPT not in template:
        match = _MAIN.search(template)
        if not match:
            raise ValueError("Missing SPA main markup: refusing to generate incomplete SEO pages")
        original_main = match.group(0)
        (site / "seo-app-shell.js").write_text(
            "document.write(" + json.dumps(original_main, ensure_ascii=True) + ");\n",
            encoding="utf-8",
        )
        template = template[:match.start()] + SHELL_SCRIPT + template[match.end():]
    elif not (site / "seo-app-shell.js").is_file():
        raise ValueError("SEO SPA shell reference exists but shared file is missing")

    style_no = 0
    def replace_style(match):
        nonlocal style_no
        style_no += 1
        name = f"seo-shared-style-{style_no}.css"
        (site / name).write_text(match.group("code"), encoding="utf-8")
        # Keep this stylesheet in exactly the same cascade position.
        return f'<link rel="stylesheet" href="/{name}">'
    template = _STYLE.sub(replace_style, template)

    script_no = 0
    def replace_script(match):
        nonlocal script_no
        attrs = match.group("attrs")
        # JSON-LD and scripts with their own src must remain untouched.
        if re.search(r'\bsrc\s*=', attrs, re.I) or re.search(r'\btype\s*=\s*["\'](?:application/ld\+json|application/json)', attrs, re.I):
            return match.group(0)
        script_no += 1
        name = f"seo-shared-inline-{script_no}.js"
        (site / name).write_text(match.group("code"), encoding="utf-8")
        return f'<script src="/{name}"></script>'
    template = _SCRIPT.sub(replace_script, template)
    return template, SHELL_SCRIPT
