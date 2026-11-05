"""Strict geography gate for the Nashani Kerman news channel.

News must explicitly concern Kerman city, a Kerman-province locality, or
an interprovincial border/route with a clearly named Kerman endpoint.
Do not assume a national headline is local just because it came from a
Kerman-based outlet. Fail closed on uncertain and missing geography.
"""
from __future__ import annotations

import re
import unicodedata

# Unique or strongly Kerman-associated locality names. Keep unusual names here;
# short/common nouns require a qualified location (see AMBIGUOUS_PLACES).
KERMAN_PLACES = (
    "جیرفت", "رفسنجان", "سیرجان", "زرند", "بردسیر", "شهربابک",
    "شهر بابک", "عنبرآباد", "کهنوج", "فهرج", "نرماشیر",
    "ریگان", "کوهبنان", "منوجان", "ارزوئیه", "ارزوییه",
    "قلعه گنج", "قلعه‌گنج", "رودبار جنوب", "رابر",
    "فاریاب", "گلباف", "ماهان", "راین", "لاله زار",
    "لاله‌زار", "هجدک", "شهداد", "دهبکری", "چترود",
    "کشکوئیه", "کشکوییه", "صفائیه", "صفاییه",
    "بم", "راور", "گل گهر", "گل‌گهر", "مس سرچشمه",
    "ارگ بم", "کویر لوت", "ارگ راین",
)
# Potentially ambiguous in Persian (e.g. بافت=tissue; انار=pomegranate).
# A qualifier such as شهرستان/شهر/فرمانداری is required.
AMBIGUOUS_PLACES = ("بافت", "انار")
QUALIFIERS = (
    "شهر", "شهرستان", "فرمانداری", "شهرداری", "بخش",
    "بیمارستان", "محور", "جاده", "مسیر", "کمربندی",
    "شورای شهر", "بخشدار", "روستاهای", "ساکنان",
)
# The neighboring provinces are relevant only when the text establishes an
# actual Kerman connection. An article solely about Yazd or Hormozgan is not.
ADJACENT_PROVINCES = (
    "یزد", "فارس", "هرمزگان", "سیستان و بلوچستان",
    "خراسان جنوبی", "بندرعباس", "زاهدان", "طبس",
    "حاجی آباد", "حاجی‌آباد", "میناب",
)
ADJACENCY_CONTEXT = (
    "مرز", "هم مرز", "هم‌مرز", "همجوار", "بین استانی", "بین‌استانی",
    "محور", "جاده", "مسیر", "کریدور", "ترانزیت", "راه آهن",
    "راه‌آهن", "مرزی", "پایانه", "اتصال",
)


def normalized(text):
    value = unicodedata.normalize("NFKC", str(text or ""))
    return re.sub(r"\s+", " ", value.replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ")).strip().lower()


def contains_place(text, name):
    pattern = r"(?<!\w)" + re.escape(normalized(name)) + r"(?!\w)"
    return re.search(pattern, text) is not None


def geo_relevance(text):
    """Return a grounded geography class, or None if not proven local."""
    clean = normalized(text)
    if not clean:
        return None

    # Exact word boundary protects against کرمانشاه and کرمانشاهی.
    if contains_place(clean, "کرمان") or re.search(r"(?<!\w)کرمانی(?:ان|ها)?(?!\w)", clean):
        return "kerman"
    if any(contains_place(clean, name) for name in KERMAN_PLACES):
        return "kerman"

    for place in AMBIGUOUS_PLACES:
        for prefix in QUALIFIERS:
            if contains_place(clean, prefix + " " + place):
                return "kerman"

    # An adjacent-province town alone is insufficient: even with a cross-border
    # word, a Kerman-side endpoint must also be named above.
    return None


def is_local_news(item):
    """Treat article headline/body as evidence, NOT its source or channel name."""
    text = " ".join(str(item.get(k) or "") for k in ("title", "excerpt"))
    if item.get("paragraphs"):
        text += " " + " ".join(str(s) for s in item["paragraphs"])
    return geo_relevance(text)
