"""Resolve monitored search terms into Pendar's person, story-event and place taxonomy.

Never turn a keyword into a new 'figure' solely because it looks like a name.
Known people require curated identity sources; existing figure corpus wins.
Draft event/place pages are noindex until they have substantive reporting.
"""
from __future__ import annotations
import html
import json
import re
import unicodedata
from pathlib import Path

KNOWN_PEOPLE={
 "احمد آرام":{"slug":"ahmad-aram","name":"احمد آرام","description":"مترجم، نویسنده و پژوهشگر ایرانی","source":"https://www.wikidata.org/wiki/Q5956408"},
 "رامین راستاد":{"slug":"ramin-rastad","name":"رامین راستاد","description":"بازیگر ایرانی","source":"https://www.ifilmtv.ir/artist/content/2569"},
 "محمود احمدی‌نژاد":{"slug":"mahmoud-ahmadinejad","name":"محمود احمدی‌نژاد","description":"رئیس‌جمهور پیشین ایران","source":"https://www.wikidata.org/wiki/Q34448"},
}
KNOWN_COUNTRIES={
 "عراق":"iraq","ایران":"iran","ترکیه":"turkey","اسپانیا":"spain","آمریکا":"united-states",
 "ایالات متحده":"united-states","آلمان":"germany","فرانسه":"france","اسرائیل":"israel",
 "پاکستان":"pakistan","افغانستان":"afghanistan","روسیه":"russia","چین":"china",
 "انگلستان":"united-kingdom","بریتانیا":"united-kingdom","قطر":"qatar","امارات":"uae",
}
PROVINCES={
 "تهران":"tehran","اصفهان":"isfahan","فارس":"fars","خراسان رضوی":"razavi-khorasan",
 "خوزستان":"khuzestan","مازندران":"mazandaran","گیلان":"gilan","البرز":"alborz",
 "آذربایجان شرقی":"east-azerbaijan","آذربایجان غربی":"west-azerbaijan",
 "کرمان":"kerman","کرمانشاه":"kermanshah","قم":"qom","یزد":"yazd","قزوین":"qazvin",
 "سیستان و بلوچستان":"sistan-and-baluchestan","گلستان":"golestan","لرستان":"lorestan",
 "هرمزگان":"hormozgan","کردستان":"kurdistan","ایلام":"ilam","همدان":"hamedan",
 "مرکزی":"markazi","بوشهر":"bushehr","زنجان":"zanjan","سمنان":"semnan",
 "اردبیل":"ardabil","چهارمحال و بختیاری":"chaharmahal-and-bakhtiari",
 "کهگیلویه و بویراحمد":"kohgiluyeh-and-boyer-ahmad",
 "خراسان جنوبی":"south-khorasan","خراسان شمالی":"north-khorasan",
}
CITY_NAMES={"نوشهر":"nowshahr","مشهد":"mashhad","تبریز":"tabriz","شیراز":"shiraz",
    "اهواز":"ahvaz","رشت":"rasht","بابل":"babol","ساری":"sari","کرج":"karaj","قم":"qom",
    "مشهد مقدس":"mashhad","یزد":"yazd"}
EVENTS=[
 (("حمله آمریکا به ایران","حملهٔ آمریکا به ایران","حمله امريكا به ايران"),"us-iran-military-attack","تحولات نظامی ایران و آمریکا"),
 (("جنگ ایران و اسرائیل","جنگ ایران اسرائیل"),"iran-israel-conflict","تحولات ایران و اسرائیل"),
]
ALIASES={
 "احمدینژاد":"محمود احمدی‌نژاد","احمدی نژاد":"محمود احمدی‌نژاد","محمود احمدینژاد":"محمود احمدی‌نژاد",
 "محمود احمدی نژاد":"محمود احمدی‌نژاد","محمود احمدینژاد":"محمود احمدی‌نژاد",
 "سرجیو راموس":"سرخیو راموس",
}
def norm(value):
    x=unicodedata.normalize("NFKC",str(value or "")).replace("ي","ی").replace("ك","ک").replace("\u200c"," ")
    x=re.sub(r"[\u064b-\u065f]","",x)
    x=re.sub(r"\s+"," ",x).strip()
    return x

def clean_title(title):
    """Delete erroneous standalone 'ط', not legitimate single-letter 'و'."""
    x=unicodedata.normalize("NFKC",str(title or "")).replace("ي","ی").replace("ك","ک")
    # Preserve meaningful Persian half-spaces (می‌شود, نامه‌ها, etc.).
    return re.sub(r"\s+"," ",re.sub(r"(?<!\S)ط(?!\S)","",x)).strip()

def canonical_label(topic):
    cleaned=norm(topic)
    normalized_aliases={norm(k):v for k,v in ALIASES.items()}
    return normalized_aliases.get(cleaned,cleaned)

def figures_index(site):
    path=Path(site)/"data"/"figures.json"
    try:
        source=json.loads(path.read_text(encoding="utf-8"))
        rows=source.get("figures",[]) if isinstance(source,dict) else []
    except (OSError,ValueError):rows=[]
    mapping={}
    for row in rows:
        if not isinstance(row,dict):continue
        handle=str(row.get("handle") or "").strip()
        if not re.fullmatch(r"[a-z0-9_.-]{2,90}",handle,re.I):continue
        names=[row.get("name_fa"),row.get("name")]+(row.get("aliases") if isinstance(row.get("aliases"),list) else [])
        for name in names:
            label=norm(name)
            if label and label not in mapping:mapping[label]=row
    return mapping

def classify(site,keyword,index=None):
    canonical=canonical_label(keyword)
    known=figures_index(site) if index is None else index
    if norm(canonical) in known:
        person=known[norm(canonical)]
        return {"kind":"person","label":canonical,"url":"/@"+person["handle"]+"/",
                "existing":True,"name":person.get("name_fa") or canonical,"record":person}
    matched_person=next((person for label,person in KNOWN_PEOPLE.items() if norm(label)==norm(canonical)),None)
    if matched_person is not None:
        person=matched_person
        return {"kind":"person","label":canonical,"url":"/@"+person["slug"]+"/",
                "existing":False,"name":person["name"],"record":person}
    for labels,slug,desc in EVENTS:
        if canonical in labels or norm(canonical) in {norm(t) for t in labels}:
            return {"kind":"event","label":desc,"url":"/events/"+slug+"/","slug":slug}
    if canonical in KNOWN_COUNTRIES:
        return {"kind":"country","label":canonical,"url":"/places/country/"+KNOWN_COUNTRIES[canonical]+"/"}
    # An exact province name is not assumed to be a city.
    if canonical in PROVINCES:
        return {"kind":"province","label":canonical,"url":"/places/province/"+PROVINCES[canonical]+"/"}
    if canonical in CITY_NAMES:
        return {"kind":"city","label":canonical,"url":"/places/city/"+CITY_NAMES[canonical]+"/"}
    return {"kind":"topic","label":canonical,"url":None}

def related_people(site,row,index=None,limit=5):
    index=figures_index(site) if index is None else index
    title=str(row.get("trend_keyword") or "")
    report=row.get("report") or {}
    body=" ".join([title, str(report.get("title_fa") or ""),str(report.get("lead_fa") or "")]+
        [str(p.get("text_fa") or "") for p in report.get("paragraphs",[])])
    result=[]
    seen=set()
    # Full names only; require at least two tokens for matching in article prose.
    for name in list(KNOWN_PEOPLE)+[n for n in index if len(n.split())>=2]:
        if len(norm(name).split())<2 or norm(name) not in norm(body):continue
        item=classify(site,name,index)
        if item["kind"]=="person" and item["url"] not in seen:
            result.append(item);seen.add(item["url"])
        if len(result)>=limit:break
    return result

def write_context_page(site,assignment,related=None):
    """Short, transparently provisional landing only for whitelisted identities.
    Do not overwrite established figure profile HTML.
    """
    if assignment["kind"] not in {"person","event","country","province","city"}:
        return
    if assignment.get("existing"):return
    from trends_magazine import magazine_shell,e
    url=assignment["url"]
    target=Path(site)/url.lstrip("/")/"index.html"
    if target.is_file():return
    title=assignment["label"]
    desc=(assignment.get("record",{}).get("description") if assignment["kind"]=="person"
          else "آرشیو و پوشش خبری مرتبط با "+title)
    notes=[]
    if assignment["kind"]=="person":
        original=assignment["record"]
        notes.append('<p>'+e(desc)+'</p><p>پروندهٔ این چهره در پندار در حال تکمیل و راستی‌آزمایی است.</p>')
        notes.append('<p>مرجع شناسایی: <a href="'+e(original["source"])+'" rel="noopener noreferrer">اطلاعات هویتی ←</a></p>')
    elif assignment["kind"]=="event":
        notes.append('<p>این صفحه برای پیوند دادن گزارش‌های یک ماجرا پیش‌بینی شده است. اخبار تازه پس از کنترل منابع به آن افزوده می‌شوند.</p>')
    else:
        notes.append('<p>این صفحه ساختار اولیهٔ «نشانی» برای کشور، استان یا شهر است و هنوز پروندهٔ جغرافیایی کامل محسوب نمی‌شود.</p>')
    related=related or []
    if related:
        notes.append('<h2>در خبرهای پندار</h2><ul>'+''.join('<li><a href="'+e(x["url"])+'">'+e(x["title"])+'</a></li>' for x in related[:8])+'</ul>')
    body='<div class="magazine-article-kicker">'+e({"person":"چهره‌ها","event":"ماجرا","country":"نشانی","province":"نشانی","city":"نشانی"}[assignment["kind"]])+'</div><h1>'+e(title)+'</h1>'+''.join(notes)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(magazine_shell(title,body,desc or title,path=url,kind="ProfilePage" if assignment["kind"]=="person" else "WebPage",robots="noindex,follow"),encoding="utf-8")
