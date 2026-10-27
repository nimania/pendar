/* Pendar — home page widgets: the freshness line (updateFreshness) and the
   homepage section renderers (renderHomePrices, renderHomeGlance,
   renderHomePeople, renderHomeDaily, renderHomeMajra, scrollHomeMajra).
   Extracted from app.js; loaded as a classic script BEFORE app.js because
   app.js's boot code and the META fetch callback call these synchronously/
   on resolve at load. Uses app.js globals and helpers (META, ALL, feedCard,
   groupedByCategory, openStory...) at runtime. No behavior change. */

function updateFreshness() {
  const el=document.getElementById("home-news-freshness");if(!el)return;
  const built=META&&(META.built_iso||META.built);
  const newest=(ALL||[]).map(s=>s.published_at).filter(Boolean).sort().slice(-1)[0];
  const clock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>';
  const item=(label,date,relative)=>`<span class="home-freshness-item">${clock}<span><small>${label}</small><b>${esc(relative?relTime(date):date)}</b></span></span>`;
  el.innerHTML=(built?item('بازبینی پندار',built,Boolean(META.built_iso)):'')+(newest?item('تازه‌ترین خبر',newest,true):'');
  el.hidden=!built&&!newest;
}

// compact price strip on the home page (dollar / euro / lira / emami coin)
async function renderHomePrices() {
  const el = document.getElementById("home-prices");
  if (!el) return;
  try {
    const prices = await getJSON(`${DATA}/prices.json`);
    if (!prices || !prices.length) return;
    const want = ["دلار آمریکا", "یورو", "لیر ترکیه", "سکه امامی"];
    const pick = want.map(w => prices.find(p => p.label_fa === w)).filter(Boolean);
    if (!pick.length) return;
    el.innerHTML = pick.map(p => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      return `<div class="hp"><span class="hp-label">${esc(p.label_fa)}</span>
        <span class="hp-val">${faN(grp(p.value))}</span>
        <span class="hp-chg ${cls}">${arrow} ${faN(Math.abs(p.dp || 0))}٪</span></div>`;
    }).join("") + `<button class="hp-more" onclick="showMarket()">پنداربازار ›</button>`;
  } catch (e) {}
}

// Compact market + weather table directly below the home stats.
async function renderHomeGlance() {
  const el = document.getElementById("home-glance");
  if (!el) return;
  try {
    const [prices, weather] = await Promise.all([
      getJSON(`${DATA}/prices.json`).catch(() => []),
      getJSON(`${DATA}/weather.json`).catch(() => [])
    ]);
    const usd = (prices || []).find(p => p.label_fa === "دلار آمریکا");
    const tr = (prices || []).find(p => p.label_fa === "لیر ترکیه");
    const cities = ["نوشهر", "چالوس", "کرمان", "تهران"]
      .map(name => (weather || []).find(w => w.city_fa === name)).filter(Boolean);
    const delta = (n, unit="") => {
      if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
      const v=Number(n), cls=v>0?"up":v<0?"down":"flat", sign=v>0?"+":v<0?"−":"";
      return `<span class="hg-delta ${cls}">${sign}${faN(grp(Math.abs(v)))}${unit} <i>۲۴ساعت</i></span>`;
    };
    const market = [usd, tr].filter(Boolean).map(p =>
      `<button class="hg-cell" onclick="showMarket()"><span class="hg-label">${esc(p.label_fa)}</span><b>${faN(grp(p.value))}</b>${delta(p.delta24,"")}<small>تومان · ${p.dp ? faN(Math.abs(p.dp))+"٪" : "بدون تغییر"}</small></button>`
    ).join("");
    const wx = cities.map(c =>
      `<button class="hg-cell" onclick="showWeather()"><span class="hg-label">${c.icon || "🌡️"} ${esc(c.city_fa)}</span><b>${faN(c.temp)}°</b>${delta(c.delta24,"°")}<small>${esc(c.cond_fa || "")} · ${faN(c.min)}°/${faN(c.max)}°</small></button>`
    ).join("");
    if (!market && !wx) return;
    el.innerHTML = `<div class="hg-grid">${market}${wx}</div>`;
  } catch (_) {}
}

// Compact human layer on the homepage: curated figures with portraits,
// ordered by their most recent activity. News-only synthetic profiles are excluded.
// Some profiles aggregate heterogeneous/source-mixed material and are therefore
// kept off homepage surfaces while remaining fully available in Jan Kalam.
const HOME_FIGURE_EXCLUDE=new Set(["mostafatajzadeh", "masih_alinejad"]);
const HOME_FIGURE_PRIORITY = ["mehdimotaharnia1344", "garajetadayoni", "abbas-souri", "iranemana_official", "darwinsabouri"];
function homeFigurePriority(f, now = Date.now()) {
  // Newly registered interview views deserve discovery even without a source date.
  if ((f.posts || []).some(p => p.editorial && p.platform === "transcript" &&
    figureActivityTime(p, now) > 0 && now - figureActivityTime(p, now) <= 48 * 60 * 60 * 1000)) return -1;
  const fresh = (f.posts || []).some(p => {
    const time = Date.parse(p.published_at || "");
    return Number.isFinite(time) && time <= now && now - time <= 24 * 60 * 60 * 1000;
  });
  if (!fresh) return HOME_FIGURE_PRIORITY.length;
  const index = HOME_FIGURE_PRIORITY.indexOf(String(f.handle || "").toLowerCase());
  return index < 0 ? HOME_FIGURE_PRIORITY.length : index;
}
function homeHasRecentVideo(person, meta={}, now=Date.now()){
  const array=value=>Array.isArray(value)?value:[];
  const video=row=>{
    if(!row||typeof row!=="object")return false;
    const kind=String(row.kind||row.type||row.media_type||"").toLowerCase();
    return row.platform==="youtube"||["video","youtube"].includes(kind)||row.media_type==="video"||
      /(?:youtu\.be\/[^/?]+|youtube\.com\/(?:watch[?/]?|shorts\/|live\/|embed\/))/i.test(String(row.url||""))||
      /\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(String(row.media_url||row.url||""));
  };
  const rows=[...array(person.youtube_videos),...array(meta.youtube_videos),...array(person.videos),...array(meta.videos),
    ...array(person.posts).filter(video),...array(meta.posts).filter(video),
    ...array(person.works).filter(video),...array(meta.works).filter(video)];
  return rows.some(row=>{
    const time=Date.parse(row?.published_at||row?.publishedAt||row?.uploaded_at||"");
    return Number.isFinite(time)&&time<=now&&now-time<=48*60*60*1000;
  });
}
let homeStatementsLimit=24;
let homeStatementsCache=[];
function showMoreHomeStatements(){homeStatementsLimit+=24;paintHomeStatements();}
function paintHomeStatements(){
  const el=document.getElementById('home-people-list');if(!el)return;
  const rows=homeStatementsCache.slice(0,homeStatementsLimit);
  el.innerHTML=rows.map(({person:f,post:p})=>{
    const title=String(p.topic_fa||p.headline_fa||p.summary_fa||p.recap_fa||p.text||'').trim().slice(0,220);
    const date=p.published_at||p.recorded_at||'';
    const id=encodeURIComponent(String(p.id));
    const photo=typeof f.avatar==='string'&&f.avatar.startsWith('https://')?f.avatar:'';
    return `<a class="home-statement-card" href="/statement/${id}/" aria-label="${esc(f.name_fa||'')} — ${esc(title)}">
      <span class="home-statement-avatar">${photo?`<img src="${esc(photo)}" loading="lazy" alt="" onerror="this.remove()">`:`<span>${esc(String(f.name_fa||'؟').slice(0,1))}</span>`}</span>
      <span class="home-statement-copy"><span class="home-statement-meta"><strong>${esc(f.name_fa||'')}</strong>${date?`<time class="home-statement-time" datetime="${esc(date)}">${esc(relTime(date))}</time>`:''}</span><b>${esc(title)}</b></span><span class="home-statement-arrow" aria-hidden="true">←</span>
    </a>`;
  }).join('')+(homeStatementsCache.length>rows.length?`<div class="home-statements-more"><button type="button" onclick="showMoreHomeStatements()">نمایش گفته‌های بیشتر · ${faN(homeStatementsCache.length-rows.length)} مورد دیگر ↓</button></div>`:'');
}
async function renderHomePeople(){
  const section=document.getElementById("home-people-strip");
  const el=document.getElementById("home-people-list");
  if(!section||!el) return;
  try{
    const [d,registry]=await Promise.all([loadFigures(),loadCanonicalEntities().catch(()=>({entities:[]}))]);
    const peopleByHandle=new Map();
    for(const person of registry.entities||[]){
      for(const ref of person.refs||[])if(ref.dataset==="figures")peopleByHandle.set(String(ref.key).toLowerCase(),person);
      if(person.type==="person"&&person.meta?.handle)peopleByHandle.set(String(person.meta.handle).toLowerCase(),person);
    }
    const eligible=(d.figures||[])
      .filter(f=>f &&
        !f.us_radar && !f.israel_radar && !peopleByHandle.get(String(f.handle||"").toLowerCase())?.meta?.us_radar &&
        !(typeof USR_FALLBACK!=="undefined"?USR_FALLBACK.candidates:[]).some(c=>c.handle===f.handle) &&
        f.field!=="news" &&
        !String(f.handle||"").startsWith("news-") &&
        !HOME_FIGURE_EXCLUDE.has(String(f.handle||"").toLowerCase()))
      .map(f=>({
        ...f,
        _recentVideo:homeHasRecentVideo(f,peopleByHandle.get(String(f.handle||"").toLowerCase())?.meta||{}),
        _latest:Math.max(0,...(f.posts||[]).map(p=>figureActivityTime(p)))
      }))
      .sort((a,b)=>b._latest-a._latest)
      ;
    const statements=[];
    const used=new Set();
    for(const f of eligible){
      const posts=(f.posts||[]).filter(p=>p&&p.id&&(p.topic_fa||p.summary_fa||p.text||p.recap_fa)&&!["draft","private","pending"].includes(String(p.status||"").toLowerCase()));
      posts.sort((a,b)=>figureActivityTime(b)-figureActivityTime(a));
      const post=posts[0];
      if(!post||used.has(String(post.id)))continue;
      used.add(String(post.id));
      statements.push({person:f,post,time:figureActivityTime(post)});
    }
    statements.sort((a,b)=>b.time-a.time);
    homeStatementsCache=statements;
    if(!statements.length){section.style.display='none';return;}
    paintHomeStatements();
    section.style.display="";
  }catch(_){
    section.style.display="none";
  }
}

let homeCultureMode="books";
function setHomeCultureMode(mode){
  if(!["books","turkish","series"].includes(mode))return;
  homeCultureMode=mode;
  document.querySelectorAll("[data-home-culture]").forEach(button=>{
    const on=button.dataset.homeCulture===mode;
    button.classList.toggle("on",on);
    button.setAttribute("aria-selected",String(on));
  });
  renderHomeCulture();
}
function homeMiniBars(values){
  const max=Math.max(1,...values);
  return `<span class="home-mini-bars" aria-hidden="true">${values.map(v=>`<i style="height:${Math.max(12,Math.round(v/max*100))}%"></i>`).join("")}</span>`;
}
async function renderHomeCultureDashboard(){
  const el=document.getElementById("home-culture-dashboard"); if(!el)return;
  try{
    const [books,movies,figures,series]=await Promise.all([
      loadBooks().catch(()=>({books:[]})),
      loadMovies().catch(()=>({movies:[]})),
      loadFigures().catch(()=>({figures:[]})),
      seriesShowcaseRows().catch(()=>({rows:[]}))
    ]);
    const bookCount=(books.books||[]).length;
    const filmRows=(movies.movies||[]);
    const movieCount=filmRows.filter(x=>x.type!=="series").length;
    const seriesCount=filmRows.filter(x=>x.type==="series").length;
    const peopleCount=(figures.figures||[]).length;
    const freshSeries=(series.rows||[]).length;
    const culturalFresh=Math.max(1,freshSeries+(BOOK_TRENDS?.length||0));
    const bars=[bookCount,movieCount,seriesCount,peopleCount].map(v=>Math.max(1,Math.round(Math.log10(v+1)*10)));
    el.innerHTML=`<div class="home-kpis home-kpis-culture">
      <button onclick="showBooks()"><b>${faN(bookCount)}</b><span>کتاب</span></button>
      <button onclick="showMovies()"><b>${faN(movieCount+seriesCount)}</b><span>فیلم و سریال</span></button>
      <button onclick="showFigures()"><b>${faN(peopleCount)}</b><span>چهره</span></button>
      <button onclick="showMovies()"><b>${faN(freshSeries)}</b><span>سریال تازه</span></button>
    </div><div class="home-dashboard-foot"><span>نمای کلی محتوای پندار</span>${homeMiniBars(bars)}</div>`;
  }catch(_){el.innerHTML="";}
}
function renderHomeCulture(){
  const panes={
    books:document.getElementById("home-book-pane"),
    turkish:document.getElementById("home-turkish-strip"),
    series:document.getElementById("home-series-strip")
  };
  Object.entries(panes).forEach(([key,el])=>{if(el)el.style.display=key===homeCultureMode?"":"none";});
  const title=document.getElementById("home-culture-title");
  if(title)title.textContent="ویترین امروز";
  renderHomeCultureDashboard();
  if(homeCultureMode==="books"){renderHomeBookBestsellers();renderBookTrends("home-books-strip",{heading:false,limit:6});}
  else if(homeCultureMode==="turkish")renderHomeTurkishTonight();
  else renderHomeSeries();
}

// Two independent homepage windows: headlines and culture.
let homeNewsMode="reports";
function setHomeNewsMode(mode){
  if(!["reports","events","people","latest"].includes(mode))return;
  homeNewsMode=mode;
  document.querySelectorAll("[data-home-news]").forEach(button=>{
    const on=button.dataset.homeNews===mode;button.classList.toggle("on",on);button.setAttribute("aria-selected",String(on));
  });
  renderHomeDaily();
}
function renderHomeNewsDashboard(stories){
  const el=document.getElementById("home-news-dashboard"); if(!el)return;
  const now=Date.now(),day=86400000;
  const recent=(ALL||[]).filter(s=>{const t=Date.parse(s.published_at||s.last_seen_at||"");return Number.isFinite(t)&&t<=now&&now-t<=day;});
  const sourceNames=new Set(),topicKeys=new Set();
  for(const s of recent){
    for(const src of (s.sources||[])){
      const name=typeof src==="string"?src:(src.source_name||src.name||src.id);
      if(name)sourceNames.add(name);
    }
    for(const t of (s.topics||[])){
      const key=typeof t==="string"?t:(t.slug||t.name_fa||t.name);
      if(key)topicKeys.add(key);
    }
  }
  const hot=recent.filter(s=>s.trend?.hot||s.trend?.rising).length;
  const bins=Array(8).fill(0);
  for(const s of recent){
    const t=Date.parse(s.published_at||s.last_seen_at||"");
    const age=Math.max(0,now-t),idx=Math.min(7,7-Math.floor(age/(3*3600e3)));
    bins[idx]++;
  }
  const latest=recent.map(s=>Date.parse(s.published_at||s.last_seen_at||"")).filter(Number.isFinite).sort((a,b)=>b-a)[0];
  el.innerHTML=`<div class="home-kpis">
    <button onclick="showFeed()"><b>${faN(recent.length)}</b><span>خبر · ۲۴ساعت</span></button>
    <button onclick="showFeed()"><b>${faN(sourceNames.size||Math.max(...recent.map(x=>Number(x.source_count||0)),0))}</b><span>منبع فعال</span></button>
    <button onclick="showTopics()"><b>${faN(topicKeys.size)}</b><span>موضوع فعال</span></button>
    <button onclick="showTrends()"><b>${faN(hot)}</b><span>داغ / رو به رشد</span></button>
  </div><div class="home-dashboard-foot"><span>رادار خبری · ۲۴ ساعت اخیر</span>${homeMiniBars(bins)}</div>`;
}
function homeStorySourceBadges(story){
  const sources=newsPublisherSources(story,4);
  if(!sources.length)return "";
  const count=Math.max(0,Number(story.source_count||0)-sources.length);
  return sources.map(newsPublisherIdentity).join("")+
    (count?'<span class="home-news-source-more" title="منابع بیشتر در متن خبر">+'+faN(count)+'</span>':"");
}
function renderHomeDaily(){
  const storyEl=document.getElementById("home-daily-stories");
  if(!storyEl)return;
  // A presentation hook for mode-specific editorial styling; no data change.
  storyEl.dataset.homeMode=homeNewsMode;
  const title=document.getElementById("home-news-title");
  if(title)title.textContent=homeNewsMode==="reports"?"گزارش‌های تحریریه":homeNewsMode==="events"?"ماجراها و ترندها":homeNewsMode==="people"?"چهره‌ها و جان کلام":homeNewsMode==="latest"?"سرخط‌های تازه":"وایرال";
  // The independent site-activity section stays visible at the bottom on every tab.
  renderHomeNewsDashboard(ALL||[]);
  storyEl.classList.toggle("home-recaps-list",homeNewsMode==="recaps");
  storyEl.classList.toggle("home-events-in-table",homeNewsMode==="events");
  storyEl.classList.toggle("home-people-in-table",homeNewsMode==="people");
  if(homeNewsMode==="reports"){renderHomeReports();return;}
  if(homeNewsMode==="people"){renderHomePeopleDirectory();return;}
  if(homeNewsMode==="events"){renderHomeEvents();return;}
  if(homeNewsMode==="recaps"){renderHomeRecaps();return;}
  const score=s=>{
    const imp=Number(s.importance_score||0);
    const sources=Math.min(Number(s.source_count||0),8)*3;
    const figures=Math.min(Number(s.figure_count||0),6)*2;
    const hot=s.trend?.hot?12:s.trend?.rising?7:0;
    const age=s.published_at?Math.max(0,(Date.now()-new Date(s.published_at).getTime())/36e5):999;
    return imp+sources+figures+hot+Math.max(0,18-Math.min(age,18));
  };
  const time=s=>Date.parse(s.published_at||s.last_seen_at||"")||0;
  const pool=(ALL||[]).filter(s=>homeNewsMode==="viral"?Boolean(s.trend?.hot||s.trend?.rising):true);
  const stories=pool.slice().sort(homeNewsMode==="latest"?(a,b)=>time(b)-time(a):(a,b)=>score(b)-score(a)||time(b)-time(a)).slice(0,5);
  renderHomeNewsDashboard(stories);
  storyEl.innerHTML=stories.length?stories.map((s,i)=>{
    const state=s.trend?.hot?"داغ":s.trend?.rising?"در حال رشد":"";
    const strength=Math.min(100,Math.max(12,Number(s.source_count||1)*11));
    const photo=typeof s.image_url==="string"&&/^https?:\/\//i.test(s.image_url)?s.image_url:"";
    return `<button class="home-intel-row home-intel-row-rich" onclick="openStory('${esc(s.id)}')">
      <span class="home-intel-rank">${faN(i+1)}</span>
      <span class="home-news-thumb">${photo?`<img src="${esc(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('is-empty');this.remove()">`:`<span class="home-news-thumb-fallback">پندار</span>`}</span>
      <span class="home-intel-copy"><b>${esc(homeEditorialText(s.headline_fa||""))}</b>${s.has_editorial_report?'<span class="home-report-pill">گزارش پندار</span>':""}
        <span class="home-news-source-line">${homeStorySourceBadges(s)}</span>
        <small>${[relTime(s.published_at),s.source_count?faN(s.source_count)+" منبع":"",s.figure_count?faN(s.figure_count)+" چهره":"",state].filter(Boolean).join(" · ")}</small>
        <span class="home-intel-meter"><i style="width:${strength}%"></i></span>
      </span>
      <span class="home-intel-go">←</span>
    </button>`;
  }).join('') :`<div class="state"><div class="big">${homeNewsMode==="viral"?"فعلاً خبر داغ یا رو به رشدی ثبت نشده":"هنوز سرخطی ثبت نشده"}</div></div>`;
}


/* Public homepage recaps: only statements with an actual recap text,
   never private studio recording drafts. */
let homeRecapFilter="all",homeRecapQuery="";
let homeRecapRows=[];
function setHomeRecapFilter(value){
  homeRecapFilter=value;
  paintHomeRecaps();
}
function setHomeRecapQuery(value){
  homeRecapQuery=String(value||"").trim().toLocaleLowerCase("fa");
  paintHomeRecaps();
}
function paintHomeRecaps(){
  if(homeNewsMode!=="recaps")return;
  const el=document.getElementById("home-daily-stories");if(!el)return;
  const editing=document.activeElement?.matches?.(".home-recap-search input")===true;
  const caret=editing?document.activeElement.selectionStart:null;
  const people=[...new Set(homeRecapRows.map(x=>x.name).filter(Boolean))];
  const filters=[["all","همهٔ جان کلام‌ها"],...people.slice(0,5).map(x=>[x,x])];
  const matches=homeRecapRows.filter(x=>(homeRecapFilter==="all"||x.name===homeRecapFilter)&&(!homeRecapQuery||[x.title,x.name,x.summary,x.source].join(" ").toLocaleLowerCase("fa").includes(homeRecapQuery)));
  const controls='<div class="home-recap-controls"><div class="home-recap-filters">'+filters.map(([key,label])=>'<button type="button" class="'+(key===homeRecapFilter?'on':'')+'" onclick="setHomeRecapFilter('+JSON.stringify(key).replace(/"/g,"&quot;")+')">'+esc(label)+'</button>').join("")+'</div><label class="home-recap-search"><span>جست‌وجو در جان کلام</span><input type="search" placeholder="عنوان یا نام گوینده" aria-label="جست‌وجوی جان کلام" value="'+esc(homeRecapQuery)+'" oninput="setHomeRecapQuery(this.value)"></label><small>'+faN(matches.length)+' جان کلام</small></div>';
  const cards=matches.slice(0,30).map(r=>{
    const photo=typeof r.avatar==="string"&&/^https?:\/\//i.test(r.avatar)?r.avatar:"";
    const mins=Math.max(1,Math.ceil(r.words/160));
    return '<a class="home-recap-item" href="/statement/'+encodeURIComponent(r.id)+'/" aria-label="'+esc(r.title)+'">'+
      '<span class="home-recap-avatar">'+(photo?'<img src="'+esc(photo)+'" alt="" loading="lazy" onerror="this.remove()">':'<span>'+esc(r.name.slice(0,1)||"پ")+'</span>')+'</span>'+
      '<span class="home-recap-copy"><b>'+esc(r.title)+'</b><small class="home-recap-byline">'+esc(r.name)+(r.date?' · '+esc(relTime(r.date)):'')+' · حدود '+faN(mins)+' دقیقه مطالعه</small>'+
      (r.summary?'<span class="home-recap-summary">'+esc(r.summary)+'</span>':'')+
      (r.source?'<small class="home-recap-source">منبع: '+esc(r.source)+'</small>':'')+'</span><span class="home-recap-arrow" aria-hidden="true">←</span></a>';
  }).join("");
  el.innerHTML=controls+'<div class="home-recap-results">'+(cards||'<div class="state"><div class="big">موردی مطابق این فیلتر پیدا نشد.</div></div>')+'</div>';
  if(editing){const field=el.querySelector(".home-recap-search input");field?.focus();if(field&&caret!==null)field.setSelectionRange(caret,caret);}
}
async function renderHomeRecaps(){
  if(homeNewsMode!=="recaps")return;
  const el=document.getElementById("home-daily-stories");if(!el)return;
  el.innerHTML='<div class="spinner"></div>';
  try{
    const d=await loadFigures();
    if(homeNewsMode!=="recaps")return;
    const seen=new Map();
    for(const f of d.figures||[]){
      for(const p of f.posts||[]){
        const id=String(p.id||"");
        const recap=String(p.recap_fa||"").trim();
        if(!id||recap.length<120)continue;
        if(["draft","pending","private"].includes(String(p.status||"").toLowerCase()))continue;
        const title=String(p.topic_fa||p.video_title||"جان کلام").trim();
        const name=String(f.name_fa||p.name_fa||"").trim();
        const summary=String(p.summary_fa||"").trim().slice(0,220);
        const candidate={id,title,name,avatar:f.avatar||p.avatar||"",date:p.published_at||p.recorded_at||"",summary,source:String(p.source_name||"").trim(),words:recap.split(/\s+/).length};
        if(!seen.has(id)||(!seen.get(id).avatar&&candidate.avatar))seen.set(id,candidate);
      }
    }
    homeRecapRows=[...seen.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.title.localeCompare(b.title,"fa"));
    paintHomeRecaps();
  }catch(_){
    if(homeNewsMode==="recaps")el.innerHTML='<div class="state"><div class="big">دریافت جان کلام ممکن نشد</div><button class="fchip on" onclick="renderHomeRecaps()">تلاش دوباره</button></div>';
  }
}

let homePeopleTimelineLimit=24,homePeopleTimelineRows=[];
function moreHomePeopleTimeline(){homePeopleTimelineLimit+=24;paintHomePeopleTimeline();}
function paintHomePeopleTimeline(){
  if(homeNewsMode!=="people")return;
  const el=document.getElementById("home-daily-stories");if(!el)return;
  const rows=homePeopleTimelineRows.slice(0,homePeopleTimelineLimit);
  const cards=rows.map(({f,p})=>{
    const isRecap=String(p.recap_fa||"").trim().length>=120;
    const headline=String(p.topic_fa||p.video_title||p.headline_fa||(isRecap?"جان کلام":"گفتهٔ تازه")).trim();
    const original=String((isRecap?(p.summary_fa||p.recap_fa):(p.text||p.summary_fa||p.content_fa||p.recap_fa))||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
    const excerpt=original.slice(0,460);
    const date=p.published_at||p.recorded_at||"";
    const image=typeof f.avatar==="string"&&(/^(https?:\/\/|\/|assets\/|figures\/|data\/)/i.test(f.avatar))?f.avatar:"";
    const link="/statement/"+encodeURIComponent(String(p.id))+"/";
    return '<article class="home-people-timeline-row">'+
      '<div class="home-people-timeline-avatar">'+(image?'<img src="'+esc(image)+'" alt="" loading="lazy" onerror="this.remove()">':'<span>'+esc(String(f.name_fa||"؟").slice(0,1))+'</span>')+'</div>'+
      '<div class="home-people-timeline-copy"><div class="home-people-timeline-meta"><strong>'+esc(f.name_fa||"")+'</strong>'+(isRecap?'<span class="home-people-recap-chip">جان کلام</span>':'')+(date?'<time datetime="'+esc(date)+'">'+esc(relTime(date))+'</time>':'')+'</div>'+
      (headline?'<a class="home-people-timeline-title" href="'+link+'">'+esc(headline)+'</a>':'')+
      (excerpt?'<p class="home-people-timeline-excerpt">'+esc(excerpt)+(original.length>460?'…':'')+'</p>':'')+
      '<a class="home-people-timeline-read" href="'+link+'">خواندن گفتهٔ کامل ←</a></div></article>';
  }).join("");
  el.innerHTML='<div class="home-people-timeline">'+(cards||'<div class="state">هنوز گفته‌ای برای نمایش ثبت نشده است.</div>')+'</div>'+
    (homePeopleTimelineRows.length>rows.length?'<div class="home-people-timeline-more"><button type="button" onclick="moreHomePeopleTimeline()">نمایش گفته‌های بیشتر · '+faN(homePeopleTimelineRows.length-rows.length)+' مورد دیگر ↓</button></div>':'')+
    '<div class="home-person-directory-footer"><a href="/figures/">همهٔ چهره‌ها ←</a></div>';
}
async function renderHomePeopleDirectory(){
  if(homeNewsMode!=="people")return;
  const el=document.getElementById("home-daily-stories");if(!el)return;
  el.innerHTML='<div class="spinner"></div>';
  try{
    const [d,directory]=await Promise.all([loadFigures(),loadPersonDirectory()]);
    if(homeNewsMode!=="people")return;
    const profileByHandle=new Map(),profileByName=new Map();
    const normalize=v=>String(v||"").trim().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ");
    for(const row of directory){
      if(!row.avatar)continue;
      const handles=[row.handle,row.profile_handle,...(row.refs||[]).filter(x=>x.dataset==="figures").map(x=>x.key)];
      for(const h of handles)if(h)profileByHandle.set(String(h).toLowerCase(),row.avatar);
      if(row.name_fa)profileByName.set(normalize(row.name_fa),row.avatar);
    }
    const people=(d.figures||[]).filter(f=>f&&f.handle&&f.name_fa&&!f.us_radar&&!f.israel_radar&&!String(f.handle).startsWith("news-")&&!HOME_FIGURE_EXCLUDE.has(String(f.handle).toLowerCase()));
    const seen=new Set(),rows=[];
    for(const f of people){
      const posts=(f.posts||[]).filter(p=>p&&p.id&&(p.topic_fa||p.video_title||p.headline_fa||p.summary_fa||p.text||p.recap_fa)&&!["draft","pending","private"].includes(String(p.status||"").toLowerCase())).sort((a,b)=>figureActivityTime(b)-figureActivityTime(a));
      // A single unified, chronological timeline: statements and published recaps.
      for(const p of posts){
        if(seen.has(String(p.id)))continue;
        const time=figureActivityTime(p); // Undated published items remain available after dated posts.
        seen.add(String(p.id));
        const portrait=profileByHandle.get(String(f.handle).toLowerCase())||profileByName.get(normalize(f.name_fa))||f.avatar||p.avatar||"";
        rows.push({f:{...f,avatar:portrait},p,time});
      }
    }
    homePeopleTimelineRows=rows.sort((a,b)=>b.time-a.time);
    paintHomePeopleTimeline();
  }catch(_){if(homeNewsMode==="people")el.innerHTML='<div class="state">دریافت آخرین گفته‌ها ممکن نشد.</div>';}
}

// Homepage Jan-e Majra: a compact window into the strongest current topic dossiers.
function scrollHomeMajra(dir) {
  const el = document.getElementById("home-majra-cards");
  if (!el) return;
  const card = el.querySelector(".hm-strip-card");
  const step = card ? card.getBoundingClientRect().width + 10 : 300;
  el.scrollBy({ left: dir * step, behavior: "smooth" });
}

async function renderHomeMajra() {
  const section = document.getElementById("home-majra");
  const el = document.getElementById("home-majra-cards");
  if (!section || !el) return;
  try {
    const t = await getJSON(`${DATA}/trends.json`, 30000);
    const stories = (ALL && ALL.length) ? ALL : await getJSON(`${DATA}/stories.json`, 30000).catch(() => []);
    const byId = new Map((stories || []).map(s => [String(s.id), s]));
    // A single story can be attached to several topic/trend slugs. On the
    // homepage that used to render the same event more than once. Keep the
    // highest-ranked topic for each lead story; topics without a resolvable
    // lead story get a stable dossier key instead.
    const seenMajra = new Set();
    const topics = [];
    for (const tp of (t.topics || []).filter(x => x && x.slug)) {
      const ids = (tp.dossier && tp.dossier.story_ids) || [];
      const story = ids.map(id => byId.get(String(id))).find(Boolean);
      const key = story ? `story:${story.id}` : `dossier:${tp.slug}`;
      if (seenMajra.has(key)) continue;
      seenMajra.add(key);
      topics.push(tp);
      if (topics.length >= 8) break;
    }
    if (!topics.length) { section.style.display = "none"; return; }
    el.innerHTML = topics.map(tp => {
      const d = tp.dossier || {};
      const story = (d.story_ids || []).map(id => byId.get(String(id))).find(Boolean);
      const image = story && story.image_url
        ? `<img loading="lazy" src="${esc(story.image_url)}" alt="" onerror="this.parentElement.classList.add('no-img');this.remove()">`
        : "";
      const dossierName = tp.name_fa || tp.slug;
      const latestHeadline = story && story.headline_fa ? story.headline_fa : "";
      const when = story && story.published_at ? relTime(story.published_at) : "";
      return `<button class="hm-strip-card ${image ? "" : "no-img"}" onclick="openTrendDossier('${esc(tp.slug)}')">
        <span class="hm-strip-media">${image}</span>
        <span class="hm-strip-copy">
          <span class="hm-dossier-name">${esc(dossierName)}</span>
          ${latestHeadline ? `<strong>${esc(latestHeadline)}</strong>` : ""}
          ${when ? `<small>${esc(when)}</small>` : ""}
        </span>
      </button>`;
    }).join("");
    if (!section.querySelector(".hm-scroll-controls")) {
      section.insertAdjacentHTML("beforeend", `<div class="hm-scroll-controls" aria-label="مرور جان ماجرا">
        <button onclick="scrollHomeMajra(1)" aria-label="قبلی">›</button>
        <button onclick="scrollHomeMajra(-1)" aria-label="بعدی">‹</button>
      </div>`);
    }
    section.style.display = "";
  } catch (e) {
    section.style.display = "";
    el.innerHTML = '<div class="state"><div class="big">جان ماجرا موقتاً در دسترس نیست</div><button class="fchip on" onclick="renderHomeMajra()">تلاش دوباره</button></div>';
  }
}

function renderHomeSeries(){ return renderSeriesShowcase(false,"world"); }

// Tonight follows the reader-facing date in Iran, independent of device timezone.
function homeTonightDay(now=new Date()){
  const day=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short'}).format(now);
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(day);
}
async function renderHomeTurkishTonight(){
  const el=document.getElementById('home-turkish-strip');if(!el)return;
  el.innerHTML='<div class="spinner"></div>';
  try{
    const {rows,live}=await loadMeshkiSeries();
    if(homeCultureMode!=='turkish'||!document.contains(el))return;
    const tonight=rows.filter(s=>s.kind!=='film'&&s.status==='در حال پخش'&&s.dayIndex!=null&&s.dayIndex!==''&&Number(s.dayIndex)===homeTonightDay());
    const ascii=v=>String(v).replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)));
    const clock=s=>{
      const match=ascii(s.airing||'').match(/(\d{1,2})[:：](\d{2})/);
      if(!match||Number(match[1])>23||Number(match[2])>59)return 'ساعت پخش ثبت نشده';
      const minutes=(Number(match[1])*60+Number(match[2])+30)%(24*60);
      return faN(String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0'))+' · به وقت ایران';
    };
    el.innerHTML=`<div class="trend-head"><h2>سریال‌های ترکی امشب</h2><a class="trend-more" href="#/tv/week">تقویم پخش ←</a></div>
      <p class="home-tonight-date">${esc(new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',weekday:'long',day:'numeric',month:'long'}).format(new Date()))} · ${faN(tonight.length)} سریال</p>
      <div class="home-tonight-list">${tonight.map(s=>`<a class="home-tonight-card" href="#/tv/week"><span class="home-tonight-image">${s.hero?`<img src="${esc(s.hero)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span><span><b>${esc(s.titleFa||s.titleTr)}</b><small>${esc(MESHKI_NETWORKS[s.network]?.nameFa||s.network||'')}</small><em>${esc(clock(s))}</em></span><span class="home-tonight-go">←</span></a>`).join('')||'<p class="muted">طبق تقویم موجود، سریال ترکی برای امشب ثبت نشده است.</p>'}</div>
      <p class="home-tonight-note">${live?'طبق تقویم هفتگی مشکی‌مدیا':'بر اساس تقویم ذخیره‌شدهٔ مشکی‌مدیا'}؛ تغییر یا لغو پخش ممکن است. <a href="#/tv/week">راهنمای تماشا در پندار ←</a></p>`;
  }catch(_){if(homeCultureMode==='turkish')el.innerHTML='<p class="muted">تقویم امشب فعلاً در دسترس نیست. <button onclick="renderHomeTurkishTonight()">تلاش دوباره</button></p>';}
}

/* Homepage default newsroom feed; share the validated archive data and article routes. */
let homeReportsRequest=0;
async function renderHomeReports(){
  const host=document.getElementById("home-daily-stories");
  if(!host)return;
  const request=++homeReportsRequest;
  host.innerHTML='<div class="spinner"></div>';
  try{
    const [reports]=await Promise.all([loadPendarEditorialArchive(),loadPendarEditorialAuthors().catch(()=>null)]);
    if(request!==homeReportsRequest||homeNewsMode!=="reports"||document.getElementById("home-daily-stories")!==host)return;
    const rows=reports.slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||""))).slice(0,20);
    // Older editorial archive records do not contain an image_url. Resolve from
    // the actual story payload, and never invent or substitute a generic image.
    const cards=await getJSON(DATA+"/stories.json").catch(()=>[]);
    const images=new Map((Array.isArray(cards)?cards:[]).filter(x=>x?.id&&x.image_url).map(x=>[String(x.id),x.image_url]));
    const leads=new Map((Array.isArray(cards)?cards:[]).filter(x=>x?.id&&x.summary_fa).map(x=>[String(x.id),x.summary_fa]));
    await Promise.all(rows.filter(row=>!row.lead_fa||(!row.image_url&&!images.has(String(row.id)))).map(async row=>{
      try{
        const detail=await getJSON(DATA+"/story/"+encodeURIComponent(row.id)+".json");
        if(detail?.image_url)images.set(String(row.id),detail.image_url);
        if(detail?.editorial_report?.lead_fa)leads.set(String(row.id),detail.editorial_report.lead_fa);
        else if(detail?.summary_fa&&!leads.has(String(row.id)))leads.set(String(row.id),detail.summary_fa);
      }catch(_){}
    }));
    if(request!==homeReportsRequest||homeNewsMode!=="reports"||document.getElementById("home-daily-stories")!==host)return;
    host.innerHTML=rows.length?'<div class="home-report-list">'+rows.map((row,i)=>{
      const id=String(row.id||"");
      const title=row.title_fa||row.editorial_report_title_fa||row.headline_fa||"";
      // Build a compact, source-grounded hook from the report's actual lead.
      const rawLead=String(row.teaser_fa||row.lead_fa||leads.get(id)||"").replace(/\s+/g," ").trim();
      let teaser=rawLead;
      if(teaser.length>120){
        const first=teaser.slice(0,120);
        const stop=Math.max(first.lastIndexOf("؛"),first.lastIndexOf("؟"),first.lastIndexOf("،"),first.lastIndexOf(" "));
        teaser=first.slice(0,stop>=90?stop:180).trim().replace(/[،؛\s]+$/,"")+"…";
      }
      const source=row.image_url||images.get(id)||"";
      const img=typeof source==="string"&&(source.startsWith("https://")||source.startsWith("http://")||source.startsWith("/assets/"))?source:"";
      return '<a class="home-intel-row home-intel-row-rich" href="/story/'+esc(id)+'/">'
        +'<span class="home-intel-rank">'+faN(i+1)+'</span>'
        +'<span class="home-news-thumb">'+(img?'<img src="'+esc(img)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">':'<span class="home-news-thumb-fallback">پندار</span>')+'</span>'
        +'<span class="home-intel-copy"><b>'+esc(title)+'</b>'+(teaser?'<span class="home-report-lead">'+esc(teaser)+'</span>':"")+'</span>'
        +'<span class="home-intel-go">←</span></a>';
    }).join("")+'</div><a class="home-all-reports" href="/reports/">آرشیو همهٔ گزارش‌ها ←</a>':'<div class="state"><div class="big">هنوز گزارشی در آرشیو ثبت نشده است.</div></div>';
  }catch(_){
    if(request===homeReportsRequest&&homeNewsMode==="reports")host.innerHTML='<div class="state">دریافت گزارش‌ها فعلاً ممکن نیست. <a href="/reports/">آرشیو گزارش‌ها</a></div>';
  }
}


/* Latest public statements, split into news and opinion on the homepage. */
let homeQuoteMode="opinions";
let homeQuotesCache=null;
function setHomeQuoteMode(mode){
  if(!["news","opinions"].includes(mode))return;
  homeQuoteMode=mode;
  document.querySelectorAll("[data-home-quote-mode]").forEach(button=>{
    const selected=button.dataset.homeQuoteMode===mode;
    button.classList.toggle("on",selected);
    button.setAttribute("aria-selected",String(selected));
    button.style.background=selected?"var(--accent-soft)":"transparent";
    button.style.color=selected?"var(--accent)":"var(--ink-soft)";
    button.style.fontWeight=selected?"700":"600";
  });
  paintHomeQuotes();
}
function isHomeNewsQuote(f,p){
  const kind=String(p.kind||p.type||p.post_type||p.statement_type||"").toLowerCase();
  if(/news|official|announcement|press.release/.test(kind))return true;
  if(p.is_official_statement===true||p.is_news===true||p.category==="news")return true;
  const profile=[f.handle,f.name_fa,f.role_fa,f.role,f.title_fa,f.position_fa,f.field]
    .filter(Boolean).join(" ").toLowerCase();
  // Explicit public-office roles and current-event sources belong under news.
  return /ترامپ|trump|رئیس.?جمهور|president|نخست.?وزیر|prime minister|وزیر|minister|فرماندار|governor|شهردار|mayor|سخنگو|spokesperson|مدیرعامل|مدیرکل|رئیس.{0,18}(آتش.?نشانی|پلیس|هلال.?احمر|اورژانس)|آتش.?نشانی|fire chief|police chief|official|مقام رسمی/.test(profile);
}
function paintHomeQuotes(){
  const host=document.getElementById("home-quotes-list");
  if(!host||!homeQuotesCache)return;
  const rows=homeQuotesCache[homeQuoteMode]||[];
  const cards=rows.slice(0,20).map(({f,p})=>{
    const title=String(p.topic_fa||p.video_title||p.headline_fa||"گفتهٔ تازه").split("\n").join(" ").trim();
    const raw=String(p.summary_fa||p.text||p.content_fa||p.recap_fa||"").replace(/<[^>]*>/g," ").split("\n").join(" ").trim();
    const excerpt=raw.length>145?raw.slice(0,145).trim()+"…":raw;
    const source=String(f.avatar||"");
    const photo=source.startsWith("https://")||source.startsWith("http://")||source.startsWith("/")||source.startsWith("assets/")||source.startsWith("figures/")?source:"";
    const href="/statement/"+encodeURIComponent(String(p.id))+"/";
    return '<a class="home-quote-card" href="'+href+'">'+
      '<span class="home-quote-avatar">'+(photo?'<img src="'+esc(photo)+'" alt="" loading="lazy" onerror="this.remove()">':'<span>'+esc(String(f.name_fa).slice(0,1))+'</span>')+'</span>'+
      '<span class="home-quote-copy"><span class="home-quote-meta"><b>'+esc(f.name_fa)+'</b>'+(p.published_at?'<time>'+esc(relTime(p.published_at))+'</time>':'')+'</span>'+
      '<strong>'+esc(title)+'</strong>'+(excerpt?'<span class="home-quote-excerpt">'+esc(excerpt)+'</span>':'')+'</span><span class="home-quote-arrow" aria-hidden="true">←</span></a>';
  }).join("");
  host.innerHTML=cards||'<div class="state">فعلاً مورد تازه‌ای در این بخش نداریم.</div>';
}
async function renderHomeQuotes(){
  const host=document.getElementById("home-quotes-list");
  if(!host)return;
  host.innerHTML='<div class="spinner"></div>';
  try{
    const d=await loadFigures();
    const grouped={news:[],opinions:[]};
    for(const f of d.figures||[]){
      if(!f||!f.handle||!f.name_fa||f.us_radar||f.israel_radar||HOME_FIGURE_EXCLUDE.has(String(f.handle).toLowerCase()))continue;
      const byCategory={news:null,opinions:null};
      for(const p of f.posts||[]){
        if(!p||!p.id||["draft","pending","private"].includes(String(p.status||"").toLowerCase()))continue;
        const category=isHomeNewsQuote(f,p)?"news":"opinions";
        if(!byCategory[category]||figureActivityTime(p)>figureActivityTime(byCategory[category]))byCategory[category]=p;
      }
      for(const category of ["news","opinions"]){
        const p=byCategory[category];
        if(p)grouped[category].push({f,p,time:figureActivityTime(p)});
      }
    }
    for(const category of ["news","opinions"])grouped[category].sort((a,b)=>b.time-a.time);
    homeQuotesCache=grouped;
    paintHomeQuotes();
  }catch(_){host.innerHTML='<div class="state">دریافت گفته‌ها فعلاً ممکن نیست.</div>';}
}
renderHomeQuotes();
