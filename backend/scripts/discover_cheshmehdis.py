"""Discover the public API used by cheshmehdis.com/publishers.

This does not modify catalog data. It records only public endpoint candidates and
sample response shapes so a stable adapter can be built without scraping rendered HTML.
"""
from __future__ import annotations
import json, re, sys
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

BASE="https://cheshmehdis.com/"
PAGE=urljoin(BASE,"publishers")
UA={"User-Agent":"JanKalamBookRadar/1.0 (+https://nimania.github.io/jan-kalam/)"}

def get(url):
    r=requests.get(url,timeout=(8,25),headers=UA)
    r.raise_for_status()
    return r.text, r.headers.get("content-type","")

html,_=get(PAGE)
soup=BeautifulSoup(html,"html.parser")
scripts=[urljoin(BASE,x.get("src")) for x in soup.find_all("script") if x.get("src")]
cands=set()
patterns=[
    r'https?://[^"\'\s)]+',
    r'["\'](/api/[^"\']+)["\']',
    r'["\'](/v\d+/[^"\']+)["\']',
    r'["\']([^"\']*(?:publisher|publishers|book|books)[^"\']*)["\']',
]
for src in scripts[-20:]:
    try: body,_=get(src)
    except Exception: continue
    for pat in patterns:
        for m in re.finditer(pat,body,re.I):
            v=m.group(1) if m.groups() else m.group(0)
            if len(v)>300: continue
            if any(k in v.lower() for k in ("publisher","book","api")):
                cands.add(urljoin(BASE,v))
contexts=[]
for src in scripts[-20:]:
    try: body,_=get(src)
    except Exception: continue
    for needle in ("getMainLevelPublishersProducts","publishers-list","base_url","book_info"):
        start=0
        while True:
            i=body.find(needle,start)
            if i<0: break
            contexts.append({"needle":needle,"script":src,"context":body[max(0,i-900):i+1800]})
            start=i+len(needle)
out={"page":PAGE,"scripts":scripts,"candidates":sorted(cands),"contexts":contexts[:40]}
print(json.dumps(out,ensure_ascii=False,indent=2))
