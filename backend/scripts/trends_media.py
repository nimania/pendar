"""Verified, topic-matched open photographs for Pendar Trends.

Only predefined Commons file titles with confirmed open-license information
are considered. Resolve file metadata at build time; no third-party news image
hotlinking and no guessing an event photograph from a keyword.
"""
from __future__ import annotations
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json, re

CATALOG = (
    {"id":"sergio-ramos","tokens":("سرخیو راموس","سرجیو راموس","sergio ramos"),
     "file":"Sergio Ramos (4980320681).jpg","credit":"Jan S0L0","license":"CC BY-SA 2.0",
     "license_url":"https://creativecommons.org/licenses/by-sa/2.0/",
     "alt":"سرخیو راموس در تصویری آرشیوی از سال ۲۰۱۰",
     "caption":"عکس آرشیوی سرخیو راموس (۲۰۱۰)؛ ارتباطی با تصاویر مذاکرات نقل‌وانتقالاتی ندارد."},
    {"id":"tehran-railway","tokens":("بلیت قطار","بلیط قطار","پیش فروش قطار","پیش‌فروش قطار","راه آهن تهران","راه‌آهن تهران"),
     "file":"Tehran railway station.jpg","credit":"Matin abdavi","license":"CC BY-SA 4.0",
     "license_url":"https://creativecommons.org/licenses/by-sa/4.0/",
     "alt":"نمایی واقعی از ایستگاه راه‌آهن تهران",
     "caption":"نمای آرشیوی ایستگاه راه‌آهن تهران؛ عکس مربوط به زمان پیش‌فروش بلیت نیست."},
    {"id":"social-security","tokens":("تأمین اجتماعی","تامین اجتماعی","سازمان تامین اجتماعی","سازمان تأمین اجتماعی","بیمه کارفرما","کارفرمایان بیمه"),
     "file":"Iranian Social Security Organization Main Building.JPG",
     "credit":"Hansueli Krapf (cropped by Iranianson)","license":"CC BY-SA 3.0",
     "license_url":"https://creativecommons.org/licenses/by-sa/3.0/",
     "alt":"ساختمان مرکزی سازمان تأمین اجتماعی ایران در تهران",
     "caption":"نمای آرشیوی ساختمان سازمان تأمین اجتماعی؛ تصویر مربوط به اطلاعیهٔ جدید نیست."},
)
API="https://commons.wikimedia.org/w/api.php"
def select_photo(keyword,title=""):
    text=(str(keyword or "")+" "+str(title or "")).casefold().replace("ي","ی").replace("ك","ک")
    for item in CATALOG:
        if any(term.casefold() in text for term in item["tokens"]):
            return item
    return None

def verify_and_install(site,keyword,title=""):
    selected=select_photo(keyword,title)
    if selected is None:return None
    api=API+"?"+urlencode({"action":"query","titles":"File:"+selected["file"],
         "prop":"imageinfo","iiprop":"url|extmetadata","iiurlwidth":"1150","format":"json"})
    try:
        req=Request(api,headers={"User-Agent":"PendarNewsroom/1.0 (image-credit-verification; contact: pendar.io)"})
        with urlopen(req,timeout=9) as resp:
            data=json.load(resp)
        pages=data["query"]["pages"]
        details=next(iter(pages.values())).get("imageinfo",[{}])[0]
        metadata=details.get("extmetadata",{})
        license_str=re.sub("<[^>]+>","",str(metadata.get("LicenseShortName",{}).get("value",""))).lower()
        wanted=selected["license"].lower().replace(" ","")
        if wanted not in license_str.replace(" ",""):
            print("::warning::Rejected Commons photo (license changed)",selected["id"],license_str)
            return None
        url=str(details.get("thumburl") or "")
        if not url.startswith("https://upload.wikimedia.org/"):return None
        with urlopen(Request(url,headers={"User-Agent":"PendarNewsroom/1.0 (image-credit-verification)"}),timeout=14) as response:
            size=response.headers.get("Content-Length")
            if size and int(size)>5_000_000:return None
            raw=response.read(5_000_001)
        if len(raw)>5_000_000:return None
        from PIL import Image, ImageOps
        with Image.open(BytesIO(raw)) as source:
            img=ImageOps.exif_transpose(source)
            if img.width<480 or img.height<270:return None
            img.thumbnail((1150,800))
            img=img.convert("RGB")
            dest=Path(site)/"assets"/"trends"/"photos"/(selected["id"]+".webp")
            dest.parent.mkdir(parents=True,exist_ok=True)
            img.save(dest,"WEBP",quality=78,method=5)
        from urllib.parse import quote
        source_page="https://commons.wikimedia.org/wiki/File:"+quote(selected["file"].replace(" ","_"))
        return {"url":"/assets/trends/photos/"+selected["id"]+".webp",
                "credit":selected["credit"],"license":selected["license"],
                "license_url":selected["license_url"],"source_url":source_page,
                "alt":selected["alt"],"caption":selected["caption"]}
    except (OSError,KeyError,ValueError,RuntimeError,ImportError,StopIteration) as exc:
        print("::warning::Commons photograph unavailable:",selected["id"],type(exc).__name__)
        return None
