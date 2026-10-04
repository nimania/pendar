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
api_paths=set()
for src in scripts[-20:]:
    try: body,_=get(src)
    except Exception: continue
    for m in re.finditer(r'bo\.base_url\+["\']([^"\']+)["\']', body):
        path=m.group(1)
        if path.startswith("/"):
            api_paths.add(path)
out={"page":PAGE,"scripts":scripts,"candidates":sorted(cands),"api_paths":sorted(api_paths),"contexts":contexts[:40]}
print(json.dumps(out,ensure_ascii=False,indent=2))


API_SAMPLE="https://server.cheshmehdis.com/api/v1/main-level/publishers/products?limit=2&nocache=1"
try:
    sample_text, sample_type = get(API_SAMPLE)
    sample_json = json.loads(sample_text)
    print(json.dumps({"api_sample_url":API_SAMPLE,"content_type":sample_type,"top_keys":list(sample_json.keys()) if isinstance(sample_json,dict) else [],"sample":sample_json},ensure_ascii=False,indent=2)[:30000])
except Exception as exc:
    print(json.dumps({"api_sample_url":API_SAMPLE,"error":type(exc).__name__,"detail":str(exc)},ensure_ascii=False))


FILTER_SAMPLE="https://server.cheshmehdis.com/api/v1/filter/requirement"
try:
    t,ct=get(FILTER_SAMPLE)
    j=json.loads(t)
    print(json.dumps({"filter_sample_url":FILTER_SAMPLE,"content_type":ct,"top_keys":list(j.keys()) if isinstance(j,dict) else [],"sample":j},ensure_ascii=False,indent=2)[:30000])
except Exception as exc:
    print(json.dumps({"filter_sample_url":FILTER_SAMPLE,"error":type(exc).__name__,"detail":str(exc)},ensure_ascii=False))
