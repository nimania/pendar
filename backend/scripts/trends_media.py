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
import json, re, html, hashlib
from urllib.parse import quote

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

# Licensed image discovery for the most frequent editorial subjects. These
# queries represent concepts, never a supposedly documentary image of a new
# event. Restrict suggestions to manually defined semantic categories.
IMAGE_TOPICS = (
    {"id":"football","terms":("فوتبال","ورزشی","باشگاه","لیگ برتر","خیبر","استقلال","پرسپولیس","داوری","مربی"),
     "query":"football stadium Iran","required":("stadium","football"),
     "alt":"نمای آرشیوی از یک ورزشگاه فوتبال","caption":"تصویر آرشیوی مرتبط با فوتبال؛ عکس رویداد گزارش‌شده نیست."},
    {"id":"rail","terms":("قطار","راه‌آهن","راه آهن","ریل","بلیت سفر"),
     "query":"railway station Iran","required":("railway","station","train"),
     "alt":"عکس آرشیوی از راه‌آهن","caption":"تصویر آرشیوی مرتبط با حمل‌ونقل ریلی."},
    {"id":"market","terms":("قیمت تتر","تتر","USDT","رمزارز","ارز دیجیتال","بیت کوین","بیت‌کوین","بازار ارز"),
     "query":"cryptocurrency bitcoin","required":("bitcoin","cryptocurrency","crypto"),
     "alt":"عکس مفهومی واقعی از ارزهای دیجیتال","caption":"عکس آرشیوی مرتبط با بازار رمزارز، نه نمودار قیمت امروز."},
    {"id":"finance","terms":("بورس","اقتصاد","تورم","بازار سهام","دلار","سکه","بانک مرکزی"),
     "query":"Tehran Stock Exchange building","required":("tehran","stock","exchange"),
     "alt":"عکس آرشیوی مرتبط با بازارهای مالی ایران","caption":"تصویر آرشیوی مرتبط با اقتصاد و بازار."},
    {"id":"weather","terms":("آب‌وهوا","آب و هوا","هواشناسی","گردوغبار","بارندگی","آلودگی هوا","بارش","سیل"),
     "query":"Tehran air pollution smog","required":("smog","pollution","tehran"),
     "alt":"تصویر آرشیوی از وضعیت هوا","caption":"عکس آرشیوی مرتبط با وضعیت هوا؛ مربوط به زمان گزارش نیست."},
    {"id":"medicine","terms":("سلامت","درمان","بیمارستان","بهداشت","دارو"),
     "query":"hospital Tehran Iran","required":("hospital","tehran","iran"),
     "alt":"تصویر آرشیوی از یک مرکز درمانی","caption":"تصویر آرشیوی مرتبط با خدمات درمانی."},
    {"id":"culture","terms":("فیلم","سینما","سریال","جشنواره","بازیگر","نمایش"),
     "query":"cinema Tehran Iran","required":("cinema","theatre","tehran"),
     "alt":"تصویر آرشیوی مرتبط با سینما","caption":"عکس آرشیوی از فضای سینما؛ تصویر رویداد امروز نیست."},
    {"id":"nature","terms":("محیط زیست","آب","خشکسالی","دریاچه","جنگل","رودخانه"),
     "query":"Iran lake landscape","required":("lake","iran","landscape"),
     "alt":"عکس آرشیوی از طبیعت ایران","caption":"عکس آرشیوی طبیعت، نه مستند تصویری رویداد گزارش."},
    {"id":"transport","terms":("هواپیما","پرواز","فرودگاه","بلیط هواپیما","بلیت هواپیما"),
     "query":"Tehran airport terminal","required":("airport","terminal","tehran"),
     "alt":"عکس آرشیوی از فرودگاه","caption":"عکس آرشیوی مرتبط با سفرهای هوایی."},
)
def photo_topic(keyword,title=""):
    content=(str(keyword or "")+" "+str(title or "")).replace("ي","ی").replace("ك","ک").lower()
    for topic in IMAGE_TOPICS:
        if any(term.lower() in content for term in topic["terms"]):
            return topic
    return None

def _plain(value):
    return html.unescape(re.sub(r"<[^>]*>"," ",str(value or ""))).replace("\n"," ").strip()[:150]

def _allowed_license(meta):
    name=_plain(meta.get("LicenseShortName",{}).get("value",""))
    if not re.fullmatch(r"(?:CC BY(?:-SA)? [234]\.0|CC0(?: 1\.0)?|Public domain)",name,re.I):
        return None
    lic_url=str(meta.get("LicenseUrl",{}).get("value",""))
    if name.lower().startswith("cc") and not lic_url.startswith("https://creativecommons.org/"):
        return None
    return name,lic_url

def _discover(topic):
    parameters={"action":"query","generator":"search",
                "gsrsearch":topic["query"],"gsrnamespace":"6","gsrlimit":"8",
                "prop":"imageinfo","iiprop":"url|size|extmetadata",
                "iiurlwidth":"1150","format":"json"}
    req=Request(API+"?"+urlencode(parameters),
       headers={"User-Agent":"PendarEditorialImageResearch/1.0 (https://pendar.io)"})
    with urlopen(req,timeout=10) as response:
        data=json.load(response)
    pages=list(data.get("query",{}).get("pages",{}).values())
    return [p for p in pages if isinstance(p,dict)]

def _install_candidate(site,item,topic):
    title=str(item.get("title") or "")
    if not title.lower().startswith("file:") or not re.search(r"\.(?:jpe?g|png|webp)$",title,re.I):
        return None
    if not any(w in title.lower() for w in topic["required"]):return None
    info=next(iter(item.get("imageinfo") or []),{})
    meta=info.get("extmetadata") or {}
    permitted=_allowed_license(meta)
    if not permitted:return None
    license_name,license_url=permitted
    artist=_plain(meta.get("Artist",{}).get("value",""))
    if not artist:return None
    width=int(info.get("width") or 0);height=int(info.get("height") or 0)
    if width<640 or height<380:return None
    url=str(info.get("thumburl") or info.get("url") or "")
    source=str(info.get("descriptionurl") or "")
    if not url.startswith("https://upload.wikimedia.org/"):return None
    if not source.startswith("https://commons.wikimedia.org/wiki/File:"):return None
    key=hashlib.sha256(title.encode("utf-8")).hexdigest()[:14]
    dest=Path(site)/"assets"/"trends"/"photos"/(topic["id"]+"-"+key+".webp")
    if not dest.is_file() or dest.stat().st_size<7000:
        req=Request(url,headers={"User-Agent":"PendarEditorialImageResearch/1.0 (https://pendar.io)"})
        with urlopen(req,timeout=12) as response:
            raw=response.read(4_500_001)
        if len(raw)>4_500_000:return None
        from PIL import Image,ImageOps
        with Image.open(BytesIO(raw)) as image:
            image=ImageOps.exif_transpose(image)
            if image.width<600 or image.height<340:return None
            image.thumbnail((1150,850))
            dest.parent.mkdir(parents=True,exist_ok=True)
            image.convert("RGB").save(dest,"WEBP",quality=81,method=5)
    return {"url":"/assets/trends/photos/"+dest.name,"credit":artist,
            "license":license_name,"license_url":license_url,
            "source_url":source,"alt":topic["alt"],"caption":topic["caption"]}

def select_photo(keyword,title=""):
    text=(str(keyword or "")+" "+str(title or "")).casefold().replace("ي","ی").replace("ك","ک")
    for item in CATALOG:
        if any(term.casefold() in text for term in item["tokens"]):
            return item
    return None

def verify_and_install(site,keyword,title=""):
    selected=select_photo(keyword,title)
    if selected is None:
        topic=photo_topic(keyword,title)
        if topic is None:return None
        try:
            choices=_discover(topic)
            # Stable selection across runs avoids flickering previews.
            for item in sorted(choices,key=lambda x:str(x.get("title") or ""))[:6]:
                candidate=_install_candidate(site,item,topic)
                if candidate:return candidate
        except (OSError,KeyError,ValueError,RuntimeError,ImportError,StopIteration) as exc:
            print("::warning::No verified topic photo:",topic["id"],type(exc).__name__)
        return None
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
