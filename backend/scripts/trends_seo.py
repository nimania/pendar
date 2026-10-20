"""Crawlable metadata, original editorial cover art and scoped sitemap for Trends.

No third-party photographs are hotlinked or republished without rights clearance.
Generated PNGs are labelled graphic illustrations, never documentary photos.
"""
from __future__ import annotations

import hashlib
import html
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

BASE = "https://pendar.io"
SITE_NAME = "پندار"
NS = "http://www.sitemaps.org/schemas/sitemap/0.9"

def text(value):
    return str(value or "").strip()

def escape(value):
    return html.escape(text(value), quote=True)

def stable_key(value):
    normalized = re.sub(r"\s+", " ", text(value).replace("ي", "ی").replace("ك", "ک")).casefold()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]

def absolute(path):
    path = text(path)
    return path if path.startswith("https://pendar.io/") else BASE + "/" + path.lstrip("/")

def canonical_path(kind, identifier=None):
    if kind == "index": return "/search-trends/"
    if kind == "report": return "/search-trends/report/" + text(identifier) + "/"
    return "/search-trends/topic/" + text(identifier) + "/"

def valid_date(value):
    try:
        date = datetime.fromisoformat(text(value).replace("Z","+00:00"))
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
        return date.astimezone(timezone.utc).isoformat()
    except (ValueError,TypeError):
        return None

def cover(site, key, headline, keyword):
    """Create 1200x630 original social-card PNG with explicit editorial styling."""
    from PIL import Image, ImageDraw, ImageFont
    name = re.fullmatch(r"[a-f0-9]{16}", key)
    if not name: raise ValueError("Invalid cover identifier")
    target = Path(site) / "assets" / "trends" / (key + ".png")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.stat().st_size >= 20000:
        return "/assets/trends/" + key + ".png"
    h = int(hashlib.sha256(keyword.encode("utf-8")).hexdigest()[:8], 16)
    palette = [(18,53,59),(24,54,65),(34,56,65),(27,62,61)]
    start = palette[h % len(palette)]
    img = Image.new("RGB", (1200, 630))
    draw = ImageDraw.Draw(img)
    for y in range(630):
        shift = int(24*y/630)
        shade = tuple(min(255,c+shift) for c in start)
        draw.line((0,y,1200,y),fill=shade)
    draw.ellipse((760,-260,1420,400),outline=(60,117,113),width=7)
    draw.ellipse((860,-150,1300,290),outline=(69,135,123),width=3)
    draw.rounded_rectangle((72,60,1128,570),radius=28,outline=(98,137,131),width=3)
    # A search lens is an illustration, not a chart implying measured search volume.
    draw.ellipse((110,390,222,502),outline=(250,175,100),width=15)
    draw.line((206,482,264,544),fill=(250,175,100),width=15)
    draw.rounded_rectangle((830,76,1100,128),radius=10,fill=(221,106,53))
    font_paths = [
        "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/opentype/noto/NotoNaskhArabic-Regular.ttf",
    ]
    def font(size):
        for path in font_paths:
            if Path(path).is_file():
                try: return ImageFont.truetype(path,size)
                except OSError: pass
        return ImageFont.load_default()
    def write(pos, content, fill, f, anchor=None, direction=None):
        kwargs = {"fill": fill, "font": f}
        if anchor: kwargs["anchor"] = anchor
        if direction:
            try: draw.text(pos,content,direction=direction,**kwargs);return
            except (KeyError,ValueError): pass
        draw.text(pos,content,**kwargs)
    write((965,100),"PENDAR",fill=(255,255,255),f=font(24),anchor="mm")
    write((1080,197),"از جست‌وجوها",fill=(151,223,213),f=font(32),anchor="ra",direction="rtl")
    trimmed = re.sub(r"\s+"," ",text(headline))
    # Layout by approximate grapheme count; preserve full title in HTML, alt and schema.
    lines=[]
    while trimmed and len(lines)<3:
        if len(trimmed)<=33:
            lines.append(trimmed);break
        ix=trimmed.rfind(" ",0,34)
        if ix<13: ix=33
        lines.append(trimmed[:ix].strip());trimmed=trimmed[ix:].strip()
    if trimmed and len(lines)==3 and len(" ".join(lines))<len(text(headline)):
        lines[-1] = lines[-1][:28]+"…"
    for i,line in enumerate(lines):
        write((1080,270+i*75),line,fill=(255,253,249),f=font(43),anchor="ra",direction="rtl")
    write((325,542),"PENDAR.IO  /  SEARCH TRENDS",fill=(166,193,190),f=font(20))
    img.save(target,format="PNG",optimize=True)
    return "/assets/trends/" + key + ".png"

def head_meta(title,description,path,image=None,kind="WebPage",published=None,keyword=None,robots="index,follow"):
    url=absolute(path)
    headline=text(title)[:140]
    desc=text(description)[:170] or "گزارش‌ها و موضوعات جست‌وجوشده در پندار."
    published = valid_date(published)
    image_url = absolute(image) if image and text(image).startswith("/assets/trends/") else None
    article = kind == "Article"
    schema = {
        "@context": "https://schema.org",
        "@type": kind,
        "@id": url + "#webpage",
        "mainEntityOfPage": url,
        "url": url,
        "name": headline,
        "inLanguage": "fa-IR",
        "description": desc,
        "publisher": {"@type":"Organization","name":"پندار","url":BASE+"/"},
    }
    if article:
        schema["headline"]=headline
        schema["author"]={"@type":"Organization","name":"تحریریه پندار","url":BASE+"/"}
        schema["isAccessibleForFree"]=True
        if published: schema["datePublished"]=published
        if image_url: schema["image"]=[image_url]
    if keyword: schema["about"]={"@type":"Thing","name":text(keyword)}
    tags=[
        '<title>'+escape(headline)+' | پندار</title>',
        '<meta name="description" content="'+escape(desc)+'">',
        '<meta name="robots" content="'+escape(robots)+',max-image-preview:large">',
        '<link rel="canonical" href="'+escape(url)+'">',
        '<meta property="og:site_name" content="پندار">',
        '<meta property="og:locale" content="fa_IR">',
        '<meta property="og:type" content="'+('article' if article else 'website')+'">',
        '<meta property="og:title" content="'+escape(headline)+' | پندار">',
        '<meta property="og:description" content="'+escape(desc)+'">',
        '<meta property="og:url" content="'+escape(url)+'">',
        '<meta name="twitter:card" content="'+('summary_large_image' if image_url else 'summary')+'">',
    ]
    if image_url:
        tags.extend((
            '<meta property="og:image" content="'+escape(image_url)+'">',
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta property="og:image:alt" content="'+escape("طرح گرافیکی پندار: "+headline)+'">',
            '<meta name="twitter:image" content="'+escape(image_url)+'">',
        ))
    if article and published:
        tags.append('<meta property="article:published_time" content="'+escape(published)+'">')
    tags.append('<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False).replace("<","\\u003c")+'</script>')
    return "\n".join(tags)

def update_sitemap(site, indexed):
    """Write a bounded sub-sitemap and register it in the existing sitemap index."""
    site=Path(site)
    unique=sorted(set(canonical_path("index") if x=="/search-trends/" else x
                      for x in indexed if x.startswith("/search-trends/")))
    ET.register_namespace("",NS)
    root=ET.Element("{"+NS+"}urlset")
    for path in unique:
        record=ET.SubElement(root,"{"+NS+"}url")
        ET.SubElement(record,"{"+NS+"}loc").text=absolute(path)
    dest=site/"sitemap-search-trends.xml"
    ET.ElementTree(root).write(dest,encoding="utf-8",xml_declaration=True)
    # Discovery works even if the main sitemap is a urlset instead of an index.
    robots=site/"robots.txt"
    directive="Sitemap: https://pendar.io/sitemap-search-trends.xml"
    existing=robots.read_text(encoding="utf-8") if robots.is_file() else "User-agent: *\\nAllow: /\\n"
    if directive not in existing:
        robots.write_text(existing.rstrip()+"\\n"+directive+"\\n",encoding="utf-8")
    master=site/"sitemap.xml"
    if not master.is_file():return len(unique)
    try:
        tree=ET.parse(master)
        parent=tree.getroot()
        tag=parent.tag.split("}")[-1]
        if tag!="sitemapindex":return len(unique)
        wanted=absolute("/sitemap-search-trends.xml")
        if not any((el.text or "")==wanted for el in parent.iter() if el.tag.split("}")[-1]=="loc"):
            node=ET.SubElement(parent,"{"+NS+"}sitemap")
            ET.SubElement(node,"{"+NS+"}loc").text=wanted
            tree.write(master,encoding="utf-8",xml_declaration=True)
    except ET.ParseError as exc:
        print("::warning::Site sitemap index could not be parsed:",exc)
    return len(unique)
