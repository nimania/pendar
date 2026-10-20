"""Publish stable newsroom @ handles and client redirects from legacy desk URLs.
GitHub Pages cannot emit HTTP 301, so legacy pages use meta refresh + canonical.
"""
from __future__ import annotations
import argparse
import html
import json
import re
from pathlib import Path

def publish(site: Path) -> int:
    catalog=json.loads((site/"data/pendar-editorial-authors.json").read_text(encoding="utf-8"))
    shell=site/"index.html"
    if not shell.is_file():
        raise FileNotFoundError(shell)
    authors=catalog["authors"]
    if len(authors)!=7:
        raise ValueError("Unexpected newsroom roster")
    count=0
    for author in authors:
        handle=author["handle"]
        desk=author["id"]
        if not re.fullmatch(r"[a-z][a-z0-9-]{2,50}",handle):
            raise ValueError("Invalid newsroom handle "+handle)
        destination=site/("@"+handle)/"index.html"
        # Never clobber an existing person profile from another publisher.
        if destination.is_file():
            existing=destination.read_text(encoding="utf-8")
            if 'data-editorial-profile-shell="1"' not in existing:
                raise ValueError("Existing @ profile collision: "+handle)
        destination.parent.mkdir(parents=True,exist_ok=True)
        content=shell.read_text(encoding="utf-8")
        content=content.replace("<head>","<head>\n<!-- data-editorial-profile-shell=\"1\" -->",1)
        canonical="https://pendar.io/@"+handle+"/"
        # Crawlers see writer-specific identity before the SPA hydrates.
        meta=(
            '<title>'+html.escape(author["display_name_fa"])+' | تحریریه پندار</title>'
            '<meta name="description" content="'+html.escape(author.get("bio_fa",""),quote=True)+'">'
            '<link rel="canonical" href="'+html.escape(canonical,quote=True)+'">'
        )
        content=content.replace("</head>",meta+"</head>",1)
        destination.write_text(content,encoding="utf-8")
        legacy=site/"editorial-author"/desk/"index.html"
        legacy.parent.mkdir(parents=True,exist_ok=True)
        url="https://pendar.io/@"+handle+"/"
        legacy.write_text(
            '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
            '<meta name="robots" content="noindex,follow">'
            '<link rel="canonical" href="'+html.escape(url,quote=True)+'">'
            '<meta http-equiv="refresh" content="0;url='+html.escape(url,quote=True)+'">'
            '<title>انتقال به صفحهٔ نویسنده | پندار</title></head><body>'
            '<p>صفحهٔ نویسنده منتقل شده است: <a href="'+html.escape(url,quote=True)+'">'
            +html.escape(author["display_name_fa"])+'</a></p></body></html>',
            encoding="utf-8")
        count+=1
    return count

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--site",type=Path,default=Path("site"))
    print("Editorial handle profiles:",publish(parser.parse_args().site))
