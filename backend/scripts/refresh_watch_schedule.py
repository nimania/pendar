"""Daily sourced release calendar. Dates without a published clock remain date-only."""
import datetime,json,os,pathlib,re,urllib.request
from bs4 import BeautifulSoup
ROOT=pathlib.Path("web-static/data/pendar-watch-schedule.json")
today=datetime.datetime.now(datetime.timezone.utc).date()
end=today+datetime.timedelta(days=14)
old=json.loads(ROOT.read_text()) if ROOT.exists() else {"channels":[],"programmes":[]}
channels={c["id"]:c for c in old["channels"]}
rows=[p for p in old["programmes"] if p.get("start","")[:10]>=today.isoformat()]
def request(url,token=None):
    headers={"User-Agent":"Pendar schedule monitor"}
    if token:headers["Authorization"]="Bearer "+token
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=20) as r:return r.read()
def api(path):
    return json.loads(request("https://api.themoviedb.org/3/"+path,os.environ["TMDB_READ_TOKEN"]))
def channel(key,name,kind,logo=None):
    channels[key]={"id":key,"name_fa":name,"platform_type":kind,"group":"series","confidence":"aggregated","logo":logo}
def event(key,title,date,source,icon=None,description=""):
    if not today.isoformat()<=date<=end.isoformat():return
    rows.append({"channel_id":key,"title_fa":title,"start":date+"T00:00:00+03:30","date_only":True,"source_url":source,"icon":icon,"quality_score":85,"desc_fa":description})
if os.getenv("TMDB_READ_TOKEN"):
    try:
        tv=api("tv/on_the_air?language=fa-IR&page=1").get("results",[])
        for item in tv[:20]:
            try:
                detail=api("tv/"+str(item["id"])+"?language=fa-IR")
                episode=detail.get("next_episode_to_air") or {}
                date=episode.get("air_date")
                if not date:continue
                for network in detail.get("networks",[]):
                    name=network.get("name","")
                    kind="world_stream" if any(x in name.lower() for x in ("netflix","amazon","prime","apple","disney","hulu","max","paramount","peacock")) else "other"
                    key="tmdb-network-"+str(network["id"])
                    channel(key,name,kind,"https://image.tmdb.org/t/p/w185"+network["logo_path"] if network.get("logo_path") else None)
                    event(key,detail.get("name") or item["name"],date,"https://www.themoviedb.org/tv/"+str(item["id"]),"https://image.tmdb.org/t/p/w500"+detail["poster_path"] if detail.get("poster_path") else None,"قسمت "+str(episode.get("episode_number",""))+" از فصل "+str(episode.get("season_number",""))+"؛ تاریخ پخش طبق TMDB، ساعت اعلام نشده.")
            except Exception as exc:print("TV",item["id"],type(exc).__name__)
        movies=api("discover/movie?language=fa-IR&region=US&with_release_type=4&release_date.gte="+today.isoformat()+"&release_date.lte="+end.isoformat()).get("results",[])
        channel("digital-world","عرضهٔ دیجیتال جهان","world_stream")
        for item in movies[:20]:
            try:
                dates=api("movie/"+str(item["id"])+"/release_dates")
                for country in dates.get("results",[]):
                    if country.get("iso_3166_1")!="US":continue
                    for release in country.get("release_dates",[]):
                        if release.get("type")!=4:continue
                        event("digital-world",item.get("title",""),release.get("release_date","")[:10],"https://www.themoviedb.org/movie/"+str(item["id"]),"https://image.tmdb.org/t/p/w500"+item["poster_path"] if item.get("poster_path") else None,"عرضهٔ دیجیتال در آمریکا طبق TMDB؛ این تاریخ تضمین موجودی در یک پلتفرم مشخص نیست.")
            except Exception as exc:print("Movie",item["id"],type(exc).__name__)
    except Exception as exc:print("TMDB",type(exc).__name__)
# Weekly clocks are extracted only from recent official announcements.
days={"شنبه":5,"یکشنبه":6,"دوشنبه":0,"سه‌شنبه":1,"چهارشنبه":2,"پنجشنبه":3,"جمعه":4}
for key,name,handle in [("stream-filimo","فیلیمو","filimo"),("stream-filmnet","فیلم‌نت","filmnetofficial"),("stream-namava","نماوا","namava_ir")]:
    channel(key,name,"iran_stream")
    try:
        soup=BeautifulSoup(request("https://t.me/s/"+handle),"html.parser")
        for message in soup.select(".tgme_widget_message"):
            box=message.select_one(".tgme_widget_message_text");stamp=message.select_one("time")
            if not box or not stamp:continue
            published=datetime.date.fromisoformat(stamp["datetime"][:10])
            if (today-published).days>10:continue
            text=box.get_text(" ",strip=True)
            if "آخرین قسمت" in text or "قسمت پایانی" in text:continue
            title=re.search(r"[«\"]([^»\"]{2,70})[»\"]",text)
            day=next((day for day in sorted(days,key=len,reverse=True) if day+"‌ها" in text or day+"ها" in text),None)
            if not title or not day:continue
            clock=re.search(r"ساعت\s*([۰-۹0-9]{1,2})(?::([۰-۹0-9]{2}))?",text)
            source=message.select_one(".tgme_widget_message_date")
            for offset in range(14):
                date=today+datetime.timedelta(days=offset)
                if date.weekday()!=days[day]:continue
                event(key,title[1],date.isoformat(),source["href"] if source else "https://t.me/s/"+handle,description="طبق اعلان هفتگی رسمی پلتفرم")
                if clock:
                    h=int(clock[1].translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹","0123456789")));minute=int((clock[2] or "0").translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹","0123456789")))
                    if ("عصر" in text or "شب" in text) and h<12:h+=12
                    if h<24 and minute<60:
                        rows[-1]["start"]=date.isoformat()+f"T{h:02}:{minute:02}:00+03:30"
                        rows[-1]["date_only"]=False
                        rows[-1]["stop"]=(datetime.datetime.fromisoformat(rows[-1]["start"])+datetime.timedelta(minutes=1)).isoformat()
    except Exception as exc:print(name,type(exc).__name__)
unique={(p["channel_id"],p["title_fa"],p["start"][:10]):p for p in rows}
ROOT.write_text(json.dumps({"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"channels":list(channels.values()),"programmes":list(unique.values())},ensure_ascii=False,indent=2)+"\n")
