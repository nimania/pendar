"""Build a dependency-free static portal from linked JSON records."""
import html, json, shutil
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir()
shutil.copytree(ROOT/'assets',OUT/'assets')
DATA={k:json.loads((ROOT/'data'/f'{k}.json').read_text()) for k in ['books','people','topics','festivals','collections','paths','organizations','articles','sources']}
STATUS=json.loads((ROOT/'data/ingestion.json').read_text())
LABELS={'book':'کتاب','person':'نویسنده','topic':'موضوع','festival':'آیین','collection':'پرونده','path':'مسیر مطالعه','organization':'نهاد','article':'مطلب'}
FOLDERS={'book':'books','person':'people','topic':'topics','festival':'calendar','collection':'collections','path':'paths','organization':'organizations','article':'today'}
RECORDS=[x for group in DATA.values() for x in group if 'kind' in x]
TOPICS={x['id']:x for x in DATA['topics']}
BOOKS={x['id']:x for x in DATA['books']}
def e(s):return html.escape(str(s or ''),quote=True)
def fa(n):return str(n).translate(str.maketrans('0123456789','۰۱۲۳۴۵۶۷۸۹'))
def route(x):return f'{FOLDERS[x["kind"]]}/{x["id"]}/'
def ext(url,label):
 if urlsplit(url).scheme not in ['http','https']:return ''
 return f'<a class="external" href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} <span aria-hidden="true">↗</span></a>'
def chips(ids,b):return '<div class="chips">'+''.join(f'<a href="{b}topics/{t}/">{e(TOPICS[t]["title"])}</a>' for t in ids if t in TOPICS)+'</div>'
def card(x,b='',featured=False):
 sub=x.get('author') or x.get('type') or x.get('category') or x.get('sourceTitle') or LABELS[x['kind']]
 date=f'<time data-date="{e(x["publishedAt"])}" datetime="{e(x["publishedAt"])}"></time>' if x.get('publishedAt') else ''
 extra=f'<span class="lang">EN</span>' if x.get('language')=='en' else ''
 return f'''<article class="card kind-{x['kind']}" data-category="{e(x.get('category') or x.get('type') or x.get('sourceTitle') or '')}" data-search="{e(x['title']+' '+x.get('summary','')+' '+sub+' '+' '.join(TOPICS[t]['title'] for t in x.get('topicIds',[]) if t in TOPICS))}"><div class="meta">{e(sub)}{extra}{date}</div><h3><a href="{b}{route(x)}">{e(x['title'])}</a></h3><p>{e(x.get('summary',''))}</p><div class="card-bottom"><span>{LABELS[x['kind']]}</span><a href="{b}{route(x)}">بیشتر بخوانید</a></div></article>'''
def grid(xs,b='',cls=''):return f'<div class="cards {cls}">'+''.join(card(x,b) for x in xs)+'</div>'
NAV=[('','خانه'),('today/','پندار امروز'),('books/','کتابخانه'),('topics/','موضوعات'),('calendar/','تقویم ایران'),('collections/','پرونده‌ها'),('paths/','مسیرهای مطالعه'),('organizations/','نهادها و جریان‌ها')]
def head(title,path,b):
 return f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="پندار؛ کشف ایران، اندیشه و فرهنگ آن. کتابخانه، پرونده‌ها، آیین‌ها و نهادها."><title>{e(title)} | پندار</title><link rel="canonical" href="https://nimania.github.io/pendar/{path}"><link rel="icon" href="{b}assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="{b}assets/vazirmatn.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="{b}assets/style.css"><script src="{b}assets/app.js" defer></script></head><body><a class="skip" href="#content">رفتن به محتوا</a><div class="topline"><span>ایران، اندیشه و فرهنگ</span><time id="today-date"></time><a href="{b}about/">درباره پندار</a></div><header><div class="masthead"><a class="brand" href="{b}">پندار<span>برای کشف ایران</span></a><form action="{b}search/" class="global-search" role="search"><label for="global-q" class="sr-only">جستجو در پندار</label><input id="global-q" name="q" placeholder="کتاب، موضوع، آیین یا نهاد…"><button type="submit">جستجو</button></form><span class="edition">نسخه آلفا <b>۰٫۱</b></span></div><nav aria-label="بخش‌های پندار">'''+''.join(f'<a href="{b}{url}"'+(' aria-current="page"' if path==url else '')+f'>{label}</a>' for url,label in NAV)+'''</nav></header><main id="content">'''
def write(path,title,body):
 depth=len([x for x in path.split('/') if x]);b='../'*depth
 directory=OUT/path;directory.mkdir(parents=True,exist_ok=True)
 text=head(title,path,b)+body+f'''</main><footer><div><strong>پندار</strong><p>برای کشف ایران، اندیشه و فرهنگ آن.</p></div><div><a href="{b}about/">مأموریت و اصول</a><a href="{b}sources/">منابع و وضعیت پایش</a><a href="https://github.com/nimania/pendar" target="_blank" rel="noopener">مخزن پندار</a></div><p>منابع و دانش اصلی عمومی‌اند.<br>ثبت یک اثر یا دیدگاه به معنای تأیید آن نیست.</p></footer></body></html>'''
 (directory/'index.html').write_text(text)
def heading(title,desc='',eyebrow=''):return f'<div class="page-heading"><span class="eyebrow">{e(eyebrow)}</span><h1>{e(title)}</h1><p>{e(desc)}</p></div>'
def section(title,url,content,b=''):return f'<section><div class="section-head"><h2>{title}</h2><a href="{b}{url}">مشاهده همه</a></div>{content}</section>'
def filterbar(options,placeholder='جستجو در این بخش…'):
 return f'<div class="filterbar"><label class="sr-only" for="filter-q">جستجو</label><input id="filter-q" placeholder="{placeholder}"><label class="sr-only" for="filter-category">فیلتر دسته</label><select id="filter-category"><option value="">همه دسته‌ها</option>'+''.join(f'<option>{e(x)}</option>' for x in sorted(set(options)))+'</select><span id="result-count" class="meta" role="status"></span></div><div id="empty-results" hidden class="empty">نتیجه‌ای پیدا نشد. عبارت کوتاه‌تر یا دسته دیگری را امتحان کنید.</div>'
def figure(b):return f'<figure class="manuscript"><img src="{b}assets/sada.webp" width="1000" height="1350" alt="نگاره جشن سده از شاهنامه شاه‌تهماسب؛ جمعی پیرامون آتش در چشم‌انداز کوهستانی" loading="lazy"><figcaption>'+ext('https://www.metmuseum.org/art/collection/search/452111','جشن سده، شاهنامه شاه‌تهماسب · موزه متروپولیتن · مالکیت عمومی')+'</figcaption></figure>'
def related(x,b):
 ids=set(x.get('topicIds',[]));other=[r for r in RECORDS if r!=x and r['kind'] not in ['person','topic'] and ids.intersection(r.get('topicIds',[]))]
 return '<section><h2>ادامه کشف</h2>'+grid(other[:6],b)+'</section>' if other else ''
# Home: useful results above the fold, no marketing gate.
featured=DATA['collections'][1]
news=DATA['articles'][:3]
body='''<div class="home-top"><div><span class="eyebrow">برای امروز شما</span><h1>چه بخوانیم، چه کشف کنیم؟</h1></div><p>از یک داستان تا یک پرونده؛<br>راهی برای نزدیک‌تر شدن به ایران.</p></div>'''
body+='''<div class="discovery-layout"><a class="feature-story" href="collections/shahnameh/"><img src="assets/sada.webp" alt="نگاره جشن سده از شاهنامه شاه‌تهماسب" width="1000" height="1350"><div><span class="eyebrow">پرونده منتخب</span><h2>شاهنامه؛<br>از داستان به تصویر</h2><p>متن فردوسی، نگارگری و حافظه فرهنگی ایران</p><span>ورود به پرونده</span></div></a><aside class="daily-panel"><div class="section-head"><h2>پندار امروز</h2><a href="today/">همه مطالب</a></div><p class="meta">آخرین مطالب موجود در منابع؛ با تاریخ انتشار اصلی.</p>'''
for n in news:body+=f'<article class="news-row"><span class="meta">{e(n["sourceTitle"])} · <time data-date="{e(n["publishedAt"])}"></time></span><h3><a href="{route(n)}">{e(n["title"])}</a></h3></article>'
body+='''<div class="calendar-mini"><span class="eyebrow">نزدیک‌ترین آیین</span><a id="next-festival" href="calendar/">تقویم ایران</a><span id="festival-countdown" class="meta">روزها تا آیین بعدی</span></div></aside></div>'''
body+=section('سه پیشنهاد برای شروع','paths/',grid([DATA['books'][0],DATA['paths'][0],DATA['festivals'][0]]))
body+=section('در کتابخانه پندار','books/',grid(DATA['books'][:4],cls='four'))
body+=section('جهان موضوعات','topics/', '<div class="topic-cloud">'+''.join(f'<a href="topics/{t["id"]}/">{t["title"]}<span>{t["category"]}</span></a>' for t in DATA['topics'])+'</div>')
body+=section('پرونده‌های پندار','collections/',grid(DATA['collections']))
body+=section('نهادها و جریان‌ها','organizations/',grid(DATA['organizations'][:3]))
write('','خانه',body)
# Section indexes.
for folder,key,title,desc in [('people','people','نویسندگان','آثار و منابع مرتبط با نویسندگان در پندار.'),('books','books','کتابخانه پندار','آثار و منابعی برای شروع مطالعه؛ هر کتاب با معرفی، پیشنهاد خواندن و منبع.'),('topics','topics','جهان موضوعات','از یک موضوع به کتاب، پرونده، نهاد و مطلب مرتبط برسید.'),('collections','collections','پرونده‌های پندار','منابع و پرسش‌ها را کنار هم بخوانید.'),('paths','paths','مسیرهای مطالعه','اگر نمی‌دانید از کجا شروع کنید، یک مسیر انتخاب کنید.'),('organizations','organizations','نهادها و جریان‌ها','بنیادها، نشریات و احزاب؛ معرفی فرهنگی و گرایش سیاسی به‌صورت جداگانه.'),('today','articles','پندار امروز','تازه‌ترین مطالب موجود در خوراک منابع. تاریخ زیر هر مطلب، زمان انتشار در منبع است.')]:
 xs=DATA[key];opts=[x.get('category') or x.get('type') or x.get('sourceTitle') or LABELS[x['kind']] for x in xs]
 content=heading(title,desc,fa(len(xs))+' مدخل')
 if key=='articles':content+='<div class="notice">اگر مطلبی قدیمی است، به این معناست که خوراک منبع مطلب تازه‌تری ارائه نکرده است. <a href="../sources/">وضعیت منابع</a></div>'
 content+=filterbar(opts)+grid(xs,'../')
 write(folder+'/',title,content)
# Calendar is computed in Tehran using the Persian Intl calendar.
body=heading('تقویم ایران','جشن‌ها و آیین‌ها با تاریخ، معرفی و منابع. زمان برگزاری محلی ممکن است متفاوت باشد.','آیین و حافظه')
body+='<p class="notice">تاریخ‌ها بر مبنای تقویم خورشیدی این نسخه‌اند؛ برای حضور در یک برنامه، تاریخ اعلام‌شده برگزارکننده را بررسی کنید.</p><div class="festival-grid">'
for f in DATA['festivals']:
 body+=f'<article class="festival-card" data-festival="{f["id"]}" data-month="{f["month"]}" data-day="{f["day"]}"><div class="date-tile"><b>{fa(f["day"])}</b><span>{["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"][f["month"]-1]}</span></div><div><span class="meta countdown">در حال محاسبه تاریخ بعدی</span><h2><a href="{f["id"]}/">{f["title"]}</a></h2><p>{f["summary"]}</p><span class="meta">{f["dateLabel"]}</span></div></article>'
body+='</div><section><h2>برای فهم آیین‌ها</h2>'+grid([DATA['collections'][2],DATA['books'][0]],'../')+'</section>'
write('calendar/','تقویم ایران',body)
# Every item is a real internal detail page.
for x in RECORDS:
 path=route(x);b='../../';k=x['kind']
 body=f'<div class="breadcrumbs"><a href="{b}">پندار</a> / <a href="../">{LABELS[k]}</a></div>'+heading(x['title'],'' if k=='article' else x.get('summary',''),LABELS[k])+chips(x.get('topicIds',[]),b)
 content=''
 if k=='book':
  content=f'<div class="book-info"><span>نویسنده</span><a href="{b}people/{x["authorId"]}/">{e(x["author"])}</a><span>زبان</span><b>فارسی</b><span>حوزه</span><b>{e(x["category"])}</b></div><h2>چرا بخوانیم؟</h2><p>{e(x["why"])}</p><h2>راهنمای شروع</h2><p>{e(x["notes"])}</p><h2>نسخه و مشخصات</h2><p>ناشر، سال و شابک چاپ‌های موجود هنوز تکمیل نشده‌اند. پیوند زیر به متن دیجیتال یا معرفی پژوهشی اثر می‌رسد.</p>'
 elif k=='person':
  content='<h2>آثار در پندار</h2>'+grid([r for r in DATA['books'] if r['authorId']==x['id']],b)
 elif k=='topic':
  content='<h2>از اینجا شروع کنید</h2><p>یک منبع را انتخاب کنید، پرسش خود را مشخص کنید و سپس منابع مرتبط را کنار آن قرار دهید.</p>'
  if x['bookIds']:content+='<h2>کتاب‌ها</h2>'+grid([BOOKS[z] for z in x['bookIds']],b)
  # Include only relevant sourced content; no fabricated topic histories.
 elif k=='festival':
  content=f'<p class="date-banner">{e(x["dateLabel"])}</p><h2>راهنمای مطالعه</h2><p>{e(x["notes"])}</p>'
  if x['id']=='sadeh':content+=figure(b)
 elif k=='organization':
  content=f'<dl class="facts"><dt>نوع</dt><dd>{e(x["type"])}</dd><dt>حوزه فعالیت</dt><dd>{e(x["scope"])}</dd><dt>کشور</dt><dd>{e(x["country"])}</dd><dt>گرایش سیاسی</dt><dd>نیازمند بررسی اسناد؛ در این نسخه برچسب قطعی ثبت نشده است.</dd><dt>وضعیت فعالیت جاری</dt><dd>{e(x["status"])}</dd><dt>آخرین بررسی معرفی</dt><dd>۸ مهر ۱۴۰۵</dd></dl><p>معرفی فرهنگی یک نهاد، معادل طبقه‌بندی سیاسی آن نیست. برای شناخت مواضع، متن رسمی و منابع مستقل را کنار هم بخوانید.</p>'
 elif k=='collection':
  if x['id']=='shahnameh':content+=figure(b)
  for h,p in x['sections']:content+=f'<h2>{e(h)}</h2><p>{e(p)}</p>'
  if x['id']=='constitution':
   content+='<h2>نقشه زمانی برای شروع مطالعه</h2><ol class="timeline"><li><b>۱۹۰۵ تا ۱۹۰۶ میلادی</b><p>اعتراض‌ها و شکل‌گیری مجلس؛ مرحله آغازین انقلاب مشروطه.</p></li><li><b>۱۹۰۶ تا ۱۹۰۸ میلادی</b><p>بحث قانون اساسی و کشاکش‌های سیاسی.</p></li><li><b>۱۹۰۸ تا ۱۹۰۹ میلادی</b><p>استبداد صغیر و مبارزه برای بازگشت مشروطه.</p></li><li><b>۱۹۰۹ تا ۱۹۱۱ میلادی</b><p>بازگشت نظام مشروطه و تجربه مجلس دوم.</p></li></ol><p class="meta">سال‌ها در این نمودار مطابق تقسیم‌بندی منبع میلادی‌اند؛ تبدیل آن‌ها به یک سال خورشیدی واحد دقیق نیست.</p>'+ext('https://www.iranicaonline.org/articles/constitutional-revolution-i/','منبع تقسیم‌بندی زمانی')
  content+='<h2>کتاب‌های این پرونده</h2>'+grid([BOOKS[z] for z in x['bookIds']],b)
 elif k=='path':
  content='<ol class="reading-steps">'
  for step in x['steps']:
   link=f'<a class="button" href="{b}{e(step["local"])}">شروع این گام</a>' if step.get('local') else ext(step['url'],'خواندن منبع این گام')
   content+=f'<li><h2>{e(step["title"])}</h2><p>{e(step["text"])}</p>{link}</li>'
  content+='</ol>'
 elif k=='article':
  content=f'<div class="article-meta"><b>{e(x["sourceTitle"])}</b><time data-date="{e(x["publishedAt"])}" datetime="{e(x["publishedAt"])}"></time><span>{"متن منبع به انگلیسی" if x["language"]=="en" else "متن منبع به فارسی"}</span></div><h2>این مطلب درباره چیست؟</h2><p>{e(x["summary"])}</p><p class="meta">این توضیح کوتاه از خوراک رسمی منبع دریافت شده است. متن کامل و جزئیات در صفحه اصلی منبع قرار دارد.</p><h2>برای دنبال‌کردن موضوع</h2><p>موضوعات مرتبط و مدخل‌های زیر را مرور کنید. تاریخ انتشار منبع را هنگام استفاده از اطلاعات رویدادها در نظر بگیرید.</p>'
 if x.get('sourceUrl'):content+='<div class="source-box"><h2>منبع و مطالعه بیشتر</h2>'+ext(x['sourceUrl'],'مشاهده متن یا معرفی در منبع اصلی')+'</div>'
 body+='<div class="detail-body">'+content+'</div>'+related(x,b)
 write(path,x['title'],body)
# Search index and client interface.
index=[dict(title=r['title'],summary=r.get('summary',''),kind=r['kind'],label=LABELS[r['kind']],url=route(r),topics=[TOPICS[t]['title'] for t in r.get('topicIds',[]) if t in TOPICS],extra=r.get('author') or r.get('type') or r.get('sourceTitle') or '') for r in RECORDS]
(OUT/'assets/search-index.json').write_text(json.dumps(index,ensure_ascii=False))
(OUT/'assets/festivals.json').write_text(json.dumps(DATA['festivals'],ensure_ascii=False))
body=heading('جستجو در پندار','کتاب، نویسنده، موضوع، پرونده، آیین، نهاد و مطلب را در یک جا پیدا کنید.')
body+='<div id="search-page"><div class="filterbar"><label for="search-q" class="sr-only">عبارت جستجو</label><input id="search-q" placeholder="مثلاً مشروطه، شاهنامه یا بخارا"><label for="search-kind" class="sr-only">نوع نتیجه</label><select id="search-kind"><option value="">همه بخش‌ها</option>'+''.join(f'<option value="{k}">{v}</option>' for k,v in LABELS.items())+'</select></div><p id="search-status" role="status" class="meta">در حال دریافت فهرست…</p><div id="search-results" class="cards"></div><noscript><p>برای جستجو جاوااسکریپت را فعال کنید؛ همه بخش‌ها از منوی سایت قابل مرورند.</p></noscript></div>'
write('search/','جستجو',body)
body=heading('منابع و وضعیت پایش','منشأ هر مطلب روشن است؛ آخرین دریافت و خطای هر خوراک اینجا نمایش داده می‌شود.')
body+='<div class="status-banner"><div><span class="meta">آخرین تلاش دریافت</span><b><time data-datetime="'+e(STATUS['lastAttemptAt'])+'"></time></b></div><div><span class="meta">خوراک موفق</span><b>'+fa(STATUS['successfulSources'])+' از '+fa(STATUS['sourceCount'])+'</b></div><div><span class="meta">مطالب نگهداری‌شده</span><b>'+fa(STATUS['itemCount'])+'</b></div></div>'
body+='<p class="notice">برنامه دریافت: هر شش ساعت، پس از فعال‌شدن GitHub Actions. موفقیت دریافت به معنی تازه‌بودن تاریخ مطالب منبع نیست. خلاصه‌ها فعلاً گزیده کوتاه خوراک‌اند و بازنویسی هوش مصنوعی فعال نیست.</p><div class="cards">'
for s in DATA['sources']:
 c=next(x for x in STATUS['sources'] if x['sourceId']==s['id'])
 body+=f'<article class="card"><span class="meta">سطح {s["tier"]} · {"فارسی" if s["language"]=="fa" else "انگلیسی"}</span><h2>{s["title"]}</h2><p>{"آخرین دریافت موفق" if c["ok"] else "دریافت ناموفق؛ داده قبلی حفظ شده"}</p>'+ext(s['feedUrl'],'خوراک اصلی')+(f'<p class="meta">آخرین انتشار: <time data-date="{e(c["latestPublishedAt"])}"></time></p>' if c.get('latestPublishedAt') else '')+'</article>'
body+='</div><h2>منابع مرجع</h2><div class="topic-cloud">'+ext('https://www.iranicaonline.org/','دانشنامه ایرانیکا')+ext('https://ganjoor.net/','گنجور')+ext('https://www.metmuseum.org/art/collection/search/452111','موزه متروپولیتن')+'</div><h2>اصل ثبت محتوا</h2><p>متن کامل آثار دارای حق نشر بازنشر نمی‌شود. پیوند و گزیده کوتاه با انتساب به منبع ارائه می‌شود. تاریخ مبهم، گرایش سیاسی نامشخص و اطلاعات چاپ تأییدنشده با حدس تکمیل نمی‌شوند.</p>'
write('sources/','منابع',body)
body=heading('پندار؛ برای کشف ایران','اندیشه، تاریخ، فرهنگ و زندگی مدنی ایران.','درباره پندار')
body+='<div class="detail-body"><p>ایران در پندار مجموعه‌ای تاریخی و فرهنگی از زبان، ادبیات، آیین‌ها، میراث، اندیشه و تجربه ایرانیان است. هدف این است که برای شناخت یک موضوع بتوانید از منابع مشخص آغاز کنید و میان کتاب‌ها، اشخاص، نهادها و پرونده‌ها حرکت کنید.</p><h2>هویت و اصول تحریریه</h2><p>ایران‌گرایی، تاریخ و هویت ایرانی، حکومت قانون، آزادی‌های مدنی، سکولاریسم، اقتصاد بازار، لیبرالیسم کلاسیک و محافظه‌کاری از حوزه‌های توجه پندارند. این توجه جای مطالعه دیدگاه‌های متفاوت و نقد مستند را نمی‌گیرد.</p><p>حضور یک کتاب، نویسنده، نهاد یا دیدگاه به معنای تأیید آن نیست. رویکرد فرهنگی و گرایش سیاسی جدا ثبت می‌شوند. هر معرفی به منبع پیوند دارد و طبقه‌بندی اختلافی به‌عنوان حکم قطعی عرضه نمی‌شود.</p><h2>در این نسخه</h2><p>کتابخانه، موضوعات، پرونده‌ها، تقویم آیین‌ها، مسیرهای مطالعه، معرفی نویسندگان، نهادها و جستجو قابل استفاده‌اند. دو خوراک فرهنگی برای دریافت دوره‌ای آماده شده‌اند.</p><h2>در مرحله بعد</h2><p>گسترش کتابخانه و منابع، افزودن رویدادهای مستند و نقشه، تکمیل اطلاعات چاپ و صفحات تاریخی، خلاصه‌سازی مبتنی بر منابع و صف بررسی تحریریه. «از پندار بپرس» هنوز راه‌اندازی نشده است.</p><h2>دسترسی و پایداری</h2><p>دانش اصلی پندار عمومی باقی می‌ماند. حمایت مالی و مشارکت کاربران در فاز بعد بررسی می‌شود.</p></div>'
write('about/','درباره پندار',body)
write('404/','صفحه پیدا نشد',heading('این صفحه پیدا نشد','از جستجو یا بخش‌های پندار ادامه دهید.')+'<a class="button" href="../search/">جستجو در پندار</a>')
# GitHub Pages serves 404.html at arbitrary depths, so use absolute project paths here.
notfound=(OUT/'404/index.html').read_text().replace('../','/pendar/')
(OUT/'404.html').write_text(notfound)
(OUT/'.nojekyll').touch()
(OUT/'robots.txt').write_text('User-agent: *\nAllow: /pendar/\nSitemap: https://nimania.github.io/pendar/sitemap.xml\n')
urls=['']+[p.parent.relative_to(OUT).as_posix()+'/' for p in OUT.rglob('index.html') if p.parent!=OUT]
(OUT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>https://nimania.github.io/pendar/'+u+'</loc></url>' for u in urls)+'</urlset>')
print(f'Built {len(urls)} pages; indexed {len(index)} records')
