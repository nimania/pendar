/* Pendar — home page widgets: the freshness line (updateFreshness) and the
   homepage section renderers (renderHomePrices, renderHomeGlance,
   renderHomePeople, renderHomeDaily, renderHomeMajra, scrollHomeMajra).
   Extracted from app.js; loaded as a classic script BEFORE app.js because
   app.js's boot code and the META fetch callback call these synchronously/
   on resolve at load. Uses app.js globals and helpers (META, ALL, feedCard,
   groupedByCategory, openStory...) at runtime. No behavior change. */

function updateFreshness() {
  const el = document.getElementById("built"); if (!el) return;
  const parts = [];
  if (META && (META.built_iso || META.built)) parts.push("آخرین بازبینیِ سیستم: " + (META.built_iso ? relTime(META.built_iso) : META.built));
  if (ALL && ALL.length) {
    const newest = ALL.map(s => s.published_at).filter(Boolean).sort().slice(-1)[0];
    if (newest) parts.push("تازه‌ترین خبر: " + relTime(newest));
  }
  if (parts.length) el.textContent = parts.join(" · ");
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
      .filter(f=>f && f.avatar &&
        f.field!=="news" &&
        !String(f.handle||"").startsWith("news-") &&
        !HOME_FIGURE_EXCLUDE.has(String(f.handle||"").toLowerCase()))
      .map(f=>({
        ...f,
        _recentVideo:homeHasRecentVideo(f,peopleByHandle.get(String(f.handle||"").toLowerCase())?.meta||{}),
        _latest:(f.posts||[]).map(p=>String(p.published_at||"")).sort().slice(-1)[0]||""
      }))
      .sort((a,b)=>String(b._latest).localeCompare(String(a._latest)))
      ;
    const priority = eligible.filter(f => homeFigurePriority(f) < HOME_FIGURE_PRIORITY.length)
      .sort((a,b) => homeFigurePriority(a) - homeFigurePriority(b));
    const remaining = eligible.filter(f => homeFigurePriority(f) === HOME_FIGURE_PRIORITY.length);
    const figures = [...priority, ...remaining].slice(0,14);
    if(!figures.length){ section.style.display="none"; return; }
    el.innerHTML=figures.map(f=>`
      <button class="home-person" onclick="openFigure('${esc(f.handle)}')" aria-label="${esc(f.name_fa||"")}${f._recentVideo?" — ویدئوی تازه در ۴۸ ساعت گذشته":""}"${f._recentVideo?' title="ویدئوی تازه در ۴۸ ساعت گذشته"':""}>
        <span class="home-person-ring${f._recentVideo?" has-recent-video":""}"><img src="${esc(f.avatar)}" alt="" loading="lazy" onerror="this.closest('.home-person')?.remove()"></span>
        <span class="home-person-name">${esc(f.name_fa||"")}</span>
      </button>`).join("");
    section.style.display="";
  }catch(_){
    section.style.display="none";
  }
}

let homeCultureMode="bestsellers";
function setHomeCultureMode(mode){
  if(!["bestsellers","books","series"].includes(mode))return;
  homeCultureMode=mode;
  document.querySelectorAll("[data-home-culture]").forEach(button=>{
    const on=button.dataset.homeCulture===mode;
    button.classList.toggle("on",on);
    button.setAttribute("aria-selected",String(on));
  });
  renderHomeCulture();
}
function renderHomeCulture(){
  const panes={
    bestsellers:document.getElementById("home-bestsellers-strip"),
    books:document.getElementById("home-books-strip"),
    series:document.getElementById("home-series-strip")
  };
  Object.entries(panes).forEach(([key,el])=>{if(el)el.style.display=key===homeCultureMode?"":"none";});
  const title=document.getElementById("home-culture-title");
  if(title)title.textContent={bestsellers:"پرفروش‌های امروز",books:"ترندهای کتاب",series:"سریال‌های تازه"}[homeCultureMode]||"ویترین فرهنگ و سرگرمی";
  if(homeCultureMode==="bestsellers")renderHomeBookBestsellers();
  else if(homeCultureMode==="books")renderBookTrends("home-books-strip",{heading:false,limit:6});
  else renderHomeSeries();
}

// Two independent homepage windows: headlines and culture.
let homeNewsMode="selected";
function setHomeNewsMode(mode){
  if(!["selected","latest"].includes(mode))return;
  homeNewsMode=mode;
  document.querySelectorAll("[data-home-news]").forEach(button=>{
    const on=button.dataset.homeNews===mode;button.classList.toggle("on",on);button.setAttribute("aria-selected",String(on));
  });
  renderHomeDaily();
}
function renderHomeDaily(){
  const storyEl=document.getElementById("home-daily-stories");
  if(!storyEl)return;
  const title=document.getElementById("home-news-title");
  if(title)title.textContent=homeNewsMode==="latest"?"سرخط‌های تازه":"مهم‌ترین اتفاق‌ها";
  const score=s=>{
    const imp=Number(s.importance_score||0);
    const sources=Math.min(Number(s.source_count||0),8)*3;
    const figures=Math.min(Number(s.figure_count||0),6)*2;
    const hot=s.trend?.hot?12:s.trend?.rising?7:0;
    const age=s.published_at?Math.max(0,(Date.now()-new Date(s.published_at).getTime())/36e5):999;
    return imp+sources+figures+hot+Math.max(0,18-Math.min(age,18));
  };
  const time=s=>Date.parse(s.published_at||s.last_seen_at||"")||0;
  const stories=(ALL||[]).slice().sort(homeNewsMode==="latest"?(a,b)=>time(b)-time(a):(a,b)=>score(b)-score(a)||time(b)-time(a)).slice(0,5);
  storyEl.innerHTML=stories.length?stories.map((s,i)=>`
    <button class="home-intel-row" onclick="openStory('${esc(s.id)}')">
      <span class="home-intel-rank">${faN(i+1)}</span>
      <span class="home-intel-copy"><b>${esc(homeEditorialText(s.headline_fa||""))}</b><small>${[relTime(s.published_at),s.source_count?faN(s.source_count)+" منبع":"",s.figure_count?faN(s.figure_count)+" دیدگاه":""].filter(Boolean).join(" · ")}</small></span>
      <span class="home-intel-go">←</span>
    </button>`).join(''):'<div class="state"><div class="big">هنوز سرخطی ثبت نشده</div></div>';
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

function renderHomeSeries(){ return renderSeriesShowcase(false); }
