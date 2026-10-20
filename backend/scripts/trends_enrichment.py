"""Editorial enrichment of sourced trends with Pendar's existing destinations.

All relationships are made from explicit topic terms or verified identity
mentions. The module never invents statistics or unverified athlete profiles.
"""
import re
from trends_topics import classify, norm, KNOWN_PEOPLE, figures_index

MARKET_WORDS=("تتر","usdt","دلار","ارز","نرخ ارز","طلا","سکه","بیت کوین","بیت‌کوین","کریپتو","رمزارز","بورس","قیمت")
WEATHER_WORDS=("آب و هوا","آب‌وهوا","هواشناسی","کیفیت هوا","آلودگی هوا","بارش","بارندگی","باران","دما","هشدار نارنجی","گردوغبار","گرد و غبار")
LOCALITY_ALIASES=(("خرم‌آباد","خرم آباد","city"),("لرستان","لرستان","province"))

def research_text(row):
    report=row.get("report") or {}
    return " ".join([str(row.get("trend_keyword") or ""),str(report.get("title_fa") or ""),
       str(report.get("lead_fa") or "")]+[str(p.get("text_fa") or "") for p in report.get("paragraphs",[])])

def smart_destinations(site,row):
    """Return named portal links and geographic paths with exact evidence."""
    report=row.get("report") or {}
    headline=" ".join([str(row.get("trend_keyword") or ""),str(report.get("title_fa") or ""),str(report.get("lead_fa") or "")])
    text=norm(headline)
    out=[]
    if any(norm(w) in text for w in MARKET_WORDS):
        out.append({"url":"/market/","label":"پندار بازار","detail":"قیمت‌های لحظه‌ای و تازه‌ترین اخبار بازار","kind":"service"})
    if any(norm(w) in text for w in WEATHER_WORDS):
        out.append({"url":"/weather/","label":"آب‌وهوا و کیفیت هوای ایران","detail":"وضعیت هوا، آلودگی و پیش‌بینی‌های تازه","kind":"service"})
    full=norm(research_text(row))
    from trends_context import includes
    mentions_khorramabad=includes(full,"خرم آباد") or includes(full,"خرم‌آباد")
    for canonical,alias,kind in LOCALITY_ALIASES:
        # Khorramabad is in Lorestan province: a factual geographic parent,
        # not a claim that all Lorestan news concerns Khorramabad.
        linked=includes(full,alias) or includes(full,canonical) or (canonical=="لرستان" and mentions_khorramabad)
        if linked:
            entry=classify(site,canonical,{})
            if entry["kind"]==kind:out.append({"url":entry["url"],"label":canonical,
                        "detail":"خبرها و گزارش‌های مرتبط با "+canonical,"kind":kind})
    return out

def reporter_people(site,row,index=None):
    """Precisely match full names from the source report, not vague single surnames."""
    from trends_topics import related_people
    return related_people(site,row,index=index,limit=6)
