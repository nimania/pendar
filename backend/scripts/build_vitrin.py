"""Build the unlisted Vitrin link board from two public homepages."""
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import json, re

SOURCES = [
    ("mardomreport", "مردم‌ریپورت", "https://mardomreport.net/"),
    ("gooya", "گویا نیوز", "https://news.gooya.com/"),
]
class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None
        self.text = []
        self.items = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.text = []
    def handle_data(self, data):
        if self.href is not None:
            self.text.append(data)
    def handle_endtag(self, tag):
        if tag == "a" and self.href:
            title = " ".join(" ".join(self.text).split())
            self.items.append((self.href, title))
            self.href = None
            self.text = []

def collect(key, name, base):
    req = Request(base, headers={"User-Agent": "Mozilla/5.0 (compatible; PendarVitrin/1.0; +https://pendar.io)"})
    with urlopen(req, timeout=25) as response:
        raw = response.read(2_000_000)
        charset = response.headers.get_content_charset() or "utf-8"
    parser = Links()
    parser.feed(raw.decode(charset, errors="replace"))
    seen = set()
    links = []
    for href, title in parser.items:
        url = urljoin(base, href.strip())
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            continue
        if len(title) < 14 or len(title) > 240 or re.search(r"^(صفحه اصلی|آرشیو|درباره|تماس|بیشتر|خانه|تبلیغ)", title):
            continue
        if key == "gooya" and not (re.search(r"/20\d\d/\d\d/", parsed.path) or re.search(r"\.(?:php|html?)$", parsed.path)):
            continue
        if key == "mardomreport" and (parsed.path in ("/", "") and parsed.netloc.endswith("mardomreport.net")):
            continue
        if url in seen:
            continue
        seen.add(url)
        links.append({"title": title, "url": url})
        if len(links) == 100:
            break
    return {"id": key, "name": name, "homepage": base, "items": links}

def main():
    out = Path("public/data/vitrin.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    old = {}
    if out.exists():
        try:
            old = {entry["id"]: entry for entry in json.loads(out.read_text(encoding="utf-8")).get("sources", [])}
        except (ValueError, KeyError):
            pass
    sources = []
    for key, name, base in SOURCES:
        try:
            item = collect(key, name, base)
            if not item["items"]:
                raise ValueError("No article links parsed")
            item["updated_at"] = datetime.now(timezone.utc).isoformat()
            print(key, len(item["items"]))
        except Exception as exc:
            print(f"Warning: {key}: {exc}")
            item = old.get(key, {"id": key, "name": name, "homepage": base, "items": [], "updated_at": None})
        sources.append(item)
    out.write_text(json.dumps({"sources": sources}, ensure_ascii=False), encoding="utf-8")

if __name__ == "__main__":
    main()
