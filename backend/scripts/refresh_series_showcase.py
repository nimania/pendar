"""Refresh sourced series showcases; retain last known rows when sources fail."""
import json,re,datetime,urllib.request,pathlib
from bs4 import BeautifulSoup
path=pathlib.Path("web-static/data/pendar-series-showcase.json")
data=json.loads(path.read_text())
known={ (r["platform"],r["title"]):r for r in data["items"] }
today=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; PendarSourceMonitor/1.0)"})
    with urllib.request.urlopen(req,timeout=30) as response:
        return BeautifulSoup(response.read(),"html.parser")
for platform,slug in [("Netflix","netflix"),("Prime Video","amazon-prime"),("Disney+","disney"),("Apple TV","apple-tv")]:
    url="https://flixpatrol.com/top10/"+slug+"/"
    try:
        soup=fetch(url)
        heading=soup.find(lambda t:t.name in ("h2","h3") and "TOP TV Shows" in t.get_text())
        if not heading:raise ValueError("TV ranking missing")
        table=heading.find_next("table")
        rows=[]
        heading_date=re.search(r"on (\\w+ \\d+, \\d{4})",heading.get_text())
        date=datetime.datetime.strptime(heading_date[1],"%B %d, %Y").date().isoformat() if heading_date else today
        for tr in table.select("tr"):
            cells=tr.find_all("td")
            if len(cells)<2:continue
            title=cells[1].get_text(" ",strip=True)
            rank=re.search(r"\\d+",cells[0].get_text())
            if not title or not rank:continue
            rows.append(dict(title=title,platform=platform,region="world",rank=int(rank[0]),checked_at=date,source_url=url,reason="رتبهٔ جهانی FlixPatrol"))
        if not rows:raise ValueError("No valid chart rows")
        data["items"]=[r for r in data["items"] if r["platform"]!=platform]+rows[:10]
    except Exception as exc:print(platform,type(exc).__name__)
for platform,channel in [("فیلیمو","filimo"),("فیلم‌نت","filmnetofficial"),("نماوا","namava_ir")]:
    url="https://t.me/s/"+channel
    try:
        soup=fetch(url); rows={}
        for message in soup.select(".tgme_widget_message"):
            box=message.select_one(".tgme_widget_message_text")
            if not box:continue
            text=box.get_text(" ",strip=True)
            # Only explicitly identified series; exclude variety programmes and films.
            match=re.search(r"سریال\\s*[«\"#]([^»\"،؛.!\\n]{2,60})",text)
            if not match:continue
            title=match[1].strip().replace("_"," ")
            if "#" in text[match.start():match.start()+8]: title=title.split(" ")[0] if "_" not in match[1] else title
            stamp=message.select_one("time[datetime]")
            if not stamp:continue
            published=stamp["datetime"][:10]
            if (datetime.date.fromisoformat(today)-datetime.date.fromisoformat(published)).days>14:continue
            link=message.select_one(".tgme_widget_message_date")
            source=link.get("href",url) if link else url
            photo=message.select_one(".tgme_widget_message_photo_wrap")
            image=re.search(r"url\\(['\"]?(.*?)['\"]?\\)",photo.get("style","")) if photo else None
            rows[title]=dict(title=title,platform=platform,region="iran",checked_at=today,published_at=published,source_url=source,reason="اعلان تازه در کانال رسمی",poster_url=image[1] if image else None)
        if rows:data["items"]=[r for r in data["items"] if r["platform"]!=platform]+list(rows.values())[-10:]
    except Exception as exc:print(platform,type(exc).__name__)
for row in data["items"]:
    previous=known.get((row["platform"],row["title"]),{})
    for key in ("release_date","release_source"):
        if previous.get(key):row[key]=previous[key]
data["checked_at"]=today
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
