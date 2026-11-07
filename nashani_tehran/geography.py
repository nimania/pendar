"""Geographic gate for Tehran city news, excluding nationwide and province-only coverage."""
import re
import unicodedata
def norm(v):
    s=unicodedata.normalize("NFKC",str(v or "")).replace("ي","ی").replace("ك","ک").replace("\u200c"," ")
    return re.sub(r"\s+"," ",s).lower()
def has(s,x):
    return re.search(r"(?<!\w)"+re.escape(norm(x))+r"(?!\w)",s) is not None
PLACES=("شهر تهران","شهرداری تهران","شورای شهر تهران","متروی تهران","ترافیک تهران","اتوبوسرانی تهران","میدان تجریش","میدان انقلاب","میدان ونک","میدان آزادی تهران","خیابان ولیعصر","برج میلاد","پل طبیعت","بزرگراه همت","بزرگراه چمران","بزرگراه مدرس","بزرگراه حکیم","بزرگراه نیایش","تهرانپارس","نازی آباد","نارمک","اکباتان","جنت آباد","شهرک غرب","سعادت آباد","صادقیه","یوسف آباد","گیشا","سیدخندان","نیاوران","فرمانیه","پونک","پیروزی","افسریه","دزاشیب","بازار بزرگ تهران")
CONTEXT=("شهرداری","شورای شهر","محله","خیابان","میدان","مترو","اتوبوس","ترافیک","آلودگی هوا","پایتخت","بزرگراه","منطقه","ساکنان","شهروندان","بوستان")
OUTSIDE=("شهریار","ورامین","پاکدشت","پردیس","دماوند","فیروزکوه","اسلامشهر","قدس","ملارد","قرچک","کرج")
def geo_relevance(text):
    s=norm(text)
    if any(has(s,x) for x in PLACES):
        return "tehran_city"
    if not has(s,"تهران"):
        return None
    if has(s,"استان تهران") and not any(has(s,x) for x in CONTEXT):
        return None
    if any(has(s,x) for x in OUTSIDE) and not any(has(s,x) for x in CONTEXT):
        return None
    return "tehran_city" if any(has(s,x) for x in CONTEXT) else None
def is_local_news(item):
    s=" ".join(str(item.get(x) or "") for x in ("title","excerpt"))
    s+=" "+" ".join(str(x) for x in (item.get("paragraphs") or []))
    return geo_relevance(s)
