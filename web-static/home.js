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
async function renderHomePeople(){
  const section=document.getElementById("home-people-strip");
  const el=document.getElementById("home-people-list");
  if(!section||!el) return;
  try{
    const d=await loadFigures();
    const eligible=(d.figures||[])
      .filter(f=>f && f.avatar &&
        f.field!=="news" &&
        !String(f.handle||"").startsWith("news-") &&
        !HOME_FIGURE_EXCLUDE.has(String(f.handle||"").toLowerCase()))
      .map(f=>({
        ...f,
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
      <button class="home-person" onclick="openFigure('${esc(f.handle)}')" aria-label="${esc(f.name_fa||"")}">
        <span class="home-person-ring"><img src="${esc(f.avatar)}" alt="" loading="lazy" onerror="this.closest('.home-person')?.remove()"></span>
        <span class="home-person-name">${esc(f.name_fa||"")}</span>
      </button>`).join("");
    section.style.display="";
  }catch(_){
    section.style.display="none";
  }
}

// Homepage daily intelligence: the strongest current stories plus the latest figure statements.
async function renderHomeDaily(){
  const storyEl=document.getElementById("home-daily-stories");
  const voiceEl=document.getElementById("home-daily-voices");
  if(!storyEl||!voiceEl) return;
  const score=s=>{
    const imp=Number(s.importance_score||0);
    const sources=Math.min(Number(s.source_count||0),8)*3;
    const figures=Math.min(Number(s.figure_count||0),6)*2;
    const hot=s.trend?.hot?12:s.trend?.rising?7:0;
    const age=s.published_at?Math.max(0,(Date.now()-new Date(s.published_at).getTime())/36e5):999;
    const freshness=Math.max(0,18-Math.min(age,18));
    return imp+sources+figures+hot+freshness;
  };
  const stories=(ALL||[]).slice().sort((a,b)=>score(b)-score(a)).slice(0,5);
  storyEl.innerHTML=stories.length?stories.map((s,i)=>`
    <button class="home-intel-row" onclick="openStory('${esc(s.id)}')">
      <span class="home-intel-rank">${faN(i+1)}</span>
      <span class="home-intel-copy"><b>${esc(homeEditorialText(s.headline_fa||""))}</b><small>${[relTime(s.published_at),s.source_count?faN(s.source_count)+" منبع":"",s.figure_count?faN(s.figure_count)+" دیدگاه":""].filter(Boolean).join(" · ")}</small></span>
      <span class="home-intel-go">←</span>
    </button>`).join(""):'<div class="state"><div class="big">هنوز سرخطی ثبت نشده</div></div>';
  try{
    const d=await loadFigures();
    // Homepage voices are intentionally limited to curated figures with a real
    // portrait. News-only people (synthetic "news-*" profiles / field=news)
    // stay in the dedicated news-people views and never fill this homepage box.
    const homeFigures=(d.figures||[]).filter(f =>
      f && f.avatar &&
      f.field !== "news" &&
      !String(f.handle||"").startsWith("news-") &&
      !HOME_FIGURE_EXCLUDE.has(String(f.handle||"").toLowerCase())
    );
    const rankedPosts=homeFigures.flatMap(f=>(f.posts||[]).map(p=>({...p,_person:f})))
      .filter(p=>p.published_at)
      .sort((a,b)=>homeFigurePriority(a._person)-homeFigurePriority(b._person) || String(b.published_at).localeCompare(String(a.published_at)));
    // Show at most one item per figure on the homepage. Because rankedPosts is
    // newest-first, the first item we keep is that person's latest statement.
    const seenHomeFigures=new Set();
    const posts=rankedPosts.filter(p=>{
      const key=String(p._person?.handle||p.handle||"").toLowerCase();
      if(!key || seenHomeFigures.has(key)) return false;
      seenHomeFigures.add(key);
      return true;
    }).slice(0,5);
    voiceEl.innerHTML=posts.length?posts.map(p=>`
      <button class="home-voice-row" onclick="openStatement('${esc(statementKey(p))}')">
        ${avatar(p._person,"sm")}
        <span class="home-intel-copy"><span class="home-voice-name">${esc(p._person.name_fa||"")}</span><b>${esc(homeEditorialText(p.topic_fa||p.summary_fa||"دیدگاه تازه"))}</b><small>${[relTime(p.published_at),p.kind==="news_statement"?"در خبرها":"دیدگاه مستقیم"].join(" · ")}</small></span>
        <span class="home-intel-go">←</span>
      </button>`).join(""):'<div class="state"><div class="big">گفتهٔ تازه‌ای ثبت نشده</div></div>';
  }catch(_){
    voiceEl.innerHTML='<div class="state"><div class="big">گفته‌ها در دسترس نیستند</div></div>';
  }
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

async function renderHomeSeries() {
  const el = document.getElementById("home-series-strip");
  if (!el) return;
  try {
    const [catalog, master] = await Promise.all([loadMovies(), loadMovieMaster()]);
    const items = [...(catalog.movies || []), ...(master.items || []).map(_masterMovie)];
    const seen = new Set();
    const series = items.filter(m => {
      const key = m.master_id || m.slug;
      if (m.type !== "series" || !key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0,12);
    if (!series.length) { el.style.display = "none"; return; }
    el.innerHTML = '<div class="trend-head"><h2>ویترین سریال</h2><a class="trend-more" href="#/movies" onclick="event.preventDefault();movieState.kind=\'series\';showMovies()">همهٔ سریال‌ها ←</a></div><div class="trend-strip">' +
      series.map(m => {
        const href = m.master_id ? "#/master-movie/" + encodeURIComponent(m.master_id) : "#/movie/" + encodeURIComponent(m.slug);
        return '<a class="trend-card" href="' + esc(href) + '"><span class="trend-cover"><span class="book-cover-placeholder">' + esc(m.title_fa || m.original_title || "") + '</span>' +
          (m.poster_url ? '<img class="book-cover" src="' + esc(m.poster_url) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
          '</span><strong class="trend-title">' + esc(m.title_fa || m.original_title || "") + '</strong><small class="trend-author">' + esc(m.year ? faN(m.year) : "سریال") + '</small></a>';
      }).join("") + '</div>';
    el.style.display = "";
  } catch (_) { el.style.display = "none"; }
}
