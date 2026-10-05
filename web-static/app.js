/* Pendar — static build. Reads pre-generated JSON from ./data (no backend).
   Shared core utilities (DATA, faN, esc, relTime, getJSON, label dictionaries,
   impInfo, homeEditorialText) now live in core.js, loaded before this file. */

// Shared data caches must exist before startup renderers run.
let _FIG = null, _NEWS_PEOPLE = null, _CURATED_POEMS = null, _STUDIO_RECAPS = null, _PROJECT_FINANCE = null;


// Canonical entities (registry, _canonicalNorm, loadCanonicalEntities,
// canonicalStrip, openEntityProfile, openEntityGraph, openCanonicalEntity,
// renderCanonicalEntity) now live in entities.js, loaded before this file.


function setArticleSeo(x){
  const title=(x.seo_title_fa||x.headline_fa||x.title_original||"پیشخوان جراید").trim();
  const desc=(x.meta_description_fa||x.summary_fa||"").trim();
  document.title=title+" | پندار";
  let m=document.querySelector('meta[name="description"]');
  if(!m){m=document.createElement("meta");m.name="description";document.head.appendChild(m);}
  if(desc)m.content=desc;
  let k=document.querySelector('meta[name="keywords"]');
  if(!k){k=document.createElement("meta");k.name="keywords";document.head.appendChild(k);}
  k.content=(x.seo_keywords_fa||[]).join("، ");
  let schema=document.getElementById("press-article-schema");
  if(!schema){schema=document.createElement("script");schema.type="application/ld+json";schema.id="press-article-schema";document.head.appendChild(schema);}
  const articleSchema={
    "@type":"Article",
    "headline":title,"description":desc,
    "datePublished":x.source_published_at||x.published_at||undefined,
    "dateModified":x.published_at||undefined,
    "author":{"@type":"Organization","name":x.publisher||"پیشخوان جراید"},
    "publisher":{"@type":"Organization","name":"پندار"},
    "mainEntityOfPage":location.href,
    "isBasedOn":x.source_url||x.article_url||undefined,
    "keywords":(x.seo_keywords_fa||[]).join(", ")
  };
  const e=x.event||{};
  const graph=[articleSchema];
  if(e.is_event||e.start_iso||e.date_fa||e.location_fa||e.address_fa){
    graph.push({
      "@type":"Event",
      "name":x.headline_fa||x.title_original||title,
      "description":desc,
      "startDate":e.start_iso||undefined,
      "endDate":e.end_iso||undefined,
      "location":(e.location_fa||e.address_fa)?{
        "@type":"Place","name":e.location_fa||undefined,
        "address":e.address_fa||undefined
      }:undefined,
      "url":x.source_url||x.article_url||location.href
    });
  }
  schema.textContent=JSON.stringify({"@context":"https://schema.org","@graph":graph});
}


// Header smart search (toggleSmartSearch, smartSearch, _buildSmartSearchDocs
// and the scoring/semantic helpers) now lives in search.js, loaded before
// this file.

const VIEWS = { feed: "feed-view", detail: "detail-view", trends: "trends-view",
  factchecks: "factchecks-view", topics: "topics-view", topicarchive: "topic-archive-view",
  weather: "weather-view", iran: "iran-view", faq: "faq-view", market: "market-view",
  figures: "figures-view", press: "press-view", books: "books-view", movies: "movies-view", tvguide: "tv-guide-view", knowledge: "knowledge-view", entity: "entity-view", graph: "entity-graph-view", profile: "entity-profile-view", entityqa: "entity-qa-view", system: "system-view", tech: "tech-view" };
const TABS = ["feed", "trends", "factchecks", "iran", "topics"];
const SCOPE_FA = { local: "استانی", national: "کشوری", international: "بین‌المللی" };
function setTab(w) { for (const t of TABS) document.getElementById("tab-" + t).classList.toggle("active", w === t); }
function show(v) {
  for (const [key, id] of Object.entries(VIEWS))
    document.getElementById(id).style.display = key === v ? "block" : "none";
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showFeed() { show("feed"); setTab("feed"); setHash(""); }
function showTopics() { show("topics"); setTab("topics"); renderTopics(); setHash("#/topics"); }
function showTrends() { show("trends"); setTab("trends"); renderTrends(); setHash("#/trends"); }
function showFactchecks() { show("factchecks"); setTab("factchecks"); renderFactchecks(); setHash("#/fact"); }
function showFaq() { show("faq"); setTab("faq"); renderFaq(); setHash("#/faq"); }

let booksCache = null;
async function loadBooks(){
  if(booksCache) return _curateBookData(booksCache);
  let d=null;
  try{d=await getJSON(`${DATA}/books.json?v=${Date.now()}`,7000);}catch(_){}
  if(!d || !Array.isArray(d.books) || !d.books.length){
    d=(window.__BOOKS_DATA__ && typeof window.__BOOKS_DATA__==="object")
      ? window.__BOOKS_DATA__ : {books:[],people:[],publishers:[]};
  }
  booksCache={
    ...d,
    books:Array.isArray(d.books)?d.books:[],
    people:Array.isArray(d.people)?d.people:[],
    publishers:Array.isArray(d.publishers)?d.publishers:[]
  };
  return _curateBookData(booksCache);
}
function _bookBySlug(d,slug){return (d.books||[]).find(x=>String(x.slug)===String(slug))}
function _toman(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>0 ? n.toLocaleString("fa-IR")+" تومان" : "—";
}
async function openPublisher(slug, canonicalId=null){
  const canonicalPub=canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByRef("books.publishers",slug);
  canonicalId=canonicalPub?.id||canonicalId;
  show("books"); setTab("");
  const lede=document.getElementById("books-lede"); if(lede) lede.style.display="none";
  const el=document.getElementById("books-content"); el.innerHTML='<div class="spinner"></div>';
  const d=await loadBooks(), p=(d.publishers||[]).find(x=>x.slug===slug);
  if(!p){el.innerHTML='<div class="state"><div class="big">ناشر پیدا نشد</div></div>';return}
  const books=(p.book_slugs||[]).map(s=>_bookBySlug(d,s)).filter(Boolean);
  el.innerHTML=`<button class="back" onclick="showBooks('publishers')">بازگشت به ناشرها</button>${_bookPublisherProfile(p,books)}${canonicalPub?canonicalStrip(canonicalPub):""}<div class="books-grid">${books.map(_bookCard).join("")}</div>`;
  document.title=p.name_fa+" | ناشرهای جانِ کتاب";
  setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/publisher/"+encodeURIComponent(slug));
}
function _personIdentityNorm(s){
  return String(s||"").replace(/ي/g,"ی").replace(/ى/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim().toLowerCase();
}
function _figureForBookPerson(person, figureData){
  if(!person) return null;
  const explicit=String(person.figure_handle||person.handle||"").trim().toLowerCase();
  if(explicit){
    const byHandle=(figureData.figures||[]).find(f=>String(f.handle||"").toLowerCase()===explicit);
    if(byHandle) return byHandle;
  }
  const name=_personIdentityNorm(person.name_fa);
  const aliases=(person.aliases_fa||person.aliases||[]).map(_personIdentityNorm).filter(Boolean);
  return (figureData.figures||[]).find(f=>{
    const candidates=[f.name_fa,...(f.aliases_fa||[]),...(f.aliases||[])].map(_personIdentityNorm).filter(Boolean);
    return candidates.includes(name) || aliases.some(a=>candidates.includes(a));
  })||null;
}
async function openBookPerson(slug, canonicalId=null){
  const [d,figures,canonicalPerson]=await Promise.all([loadBooks(),loadFigures(),canonicalId?canonicalEntityById(canonicalId):canonicalEntityByRef("books.people",slug)]);
  canonicalId=canonicalPerson?.id||canonicalId;
  const p=(d.people||[]).find(x=>x.slug===slug);
  if(!p){
    show("books"); setTab("");
    const lede=document.getElementById("books-lede"); if(lede) lede.style.display="none";
    document.getElementById("books-content").innerHTML='<div class="state"><div class="big">پدیدآورنده پیدا نشد</div></div>';
    return;
  }
  if(canonicalPerson?.routes?.figure) return openFigure(canonicalPerson.routes.figure,true,canonicalPerson.id);
  const linkedFigure=_figureForBookPerson(p,figures);
  if(linkedFigure) return openFigure(linkedFigure.handle,true,canonicalId);
  show("books"); setTab("");
  const lede=document.getElementById("books-lede"); if(lede) lede.style.display="none";
  const el=document.getElementById("books-content"); el.innerHTML='<div class="spinner"></div>';
  const books=(p.book_slugs||[]).map(s=>_bookBySlug(d,s)).filter(Boolean);
  el.innerHTML=`<button class="back" onclick="showBooks('people')">بازگشت به پدیدآورندگان</button><div class="book-person-head"><span class="press-kicker">پدیدآورنده</span><h1>${esc(p.name_fa)}</h1><p>${esc((p.roles_fa||[]).join(" · "))}</p></div>${canonicalPerson?canonicalStrip(canonicalPerson):""}<div class="books-grid">${books.map(_bookCard).join("")}</div>`;
  setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/book-person/"+encodeURIComponent(slug));
}

// Press/periodicals (PRESS_SOURCES, press state/caches, showPress,
// renderPress, openPressArticle, press filters & health) now live in
// press.js, loaded before this file.

/* Hash routing (setHash, route, _navLock + the hashchange listener) now lives
   in router.js, loaded before this file. The route() table dispatches to the
   show.../open... view functions defined below. */

function credBadge(c) {
  if (!c) return "";
  let out = `<span class="cstatus ${CRED_CLS[c.level] || "st-neutral"}">${CRED_FA[c.level] || ""}</span>`;
  if (c.needs_verification) out += `<span class="cstatus st-warn">نیازمند راستی‌آزمایی</span>`;
  return out;
}
function fcBadge(f) {
  return f ? `<span class="cstatus st-ok fc-badge">✓ فکت‌نامه</span>` : "";
}
function geoBadge(g) {
  if (!g || !g.scope) return "";
  if (g.scope === "local") {
    const p = g.provinces && g.provinces[0];
    return `<span class="geo-badge local">${p ? esc(p.name_fa) : "استانی"}</span>`;
  }
  return `<span class="geo-badge ${g.scope}">${SCOPE_FA[g.scope] || ""}</span>`;
}

// Detail-view geo strip: bigger mini-map + a caption listing the highlighted places.
function detailGeoStrip(s) {
  const mm = miniMap(s, { detail: true });
  if (!mm) return "";
  const provs = (s.geo && s.geo.provinces || []).map(p => p.name_fa);
  const countries = (s.countries || []).map(c => c.name_fa);
  const parts = [];
  if (provs.length) parts.push("استان‌ها: " + provs.join("، "));
  if (countries.length) parts.push("کشورها: " + countries.join("، "));
  if (!parts.length && s.geo && s.geo.scope) {
    parts.push({ international: "بین‌المللی", national: "سراسر ایران",
                 local: "استانی" }[s.geo.scope] || "");
  }
  return `<div class="geo-strip">${mm}<span class="g-lbl">${esc(parts.join(" · "))}</span></div>`;
}

// A tiny "where is this story" map — Iran mini-map with highlighted provinces
// for local/national stories, world mini-map with highlighted countries otherwise.
// Purely for at-a-glance orientation; falls back to nothing when nothing to show.
function miniMap(s, opts) {
  opts = opts || {};
  const cls = opts.detail ? "mini-map mm-detail" : "mini-map";
  const provs = (s.geo && s.geo.provinces || []).map(p => p.slug);
  const scope = s.geo && s.geo.scope;
  const isIranMap = provs.length > 0 || scope === "local"
    || (scope === "national" && (!s.countries || s.countries.length === 0));

  if (isIranMap && window.IRAN_PATHS) {
    const hit = new Set(provs);
    const paths = Object.entries(window.IRAN_PATHS).map(([slug, p]) =>
      `<path d="${p.d}" class="${hit.has(slug) ? "mm-hit" : "mm-bg"}"/>`).join("");
    return `<span class="${cls}" title="${esc((s.geo && s.geo.provinces || []).map(p=>p.name_fa).join("، ") || "ایران")}">
      <svg viewBox="${window.IRAN_VIEWBOX}" preserveAspectRatio="xMidYMid meet">${paths}</svg></span>`;
  }
  if (!window.WORLD_PATHS) return "";
  const codes = new Set((s.countries || []).map(c => c.code));
  // If nothing detected but story is international, still show a world background.
  if (!codes.size && scope !== "international" && !opts.detail) return "";
  const paths = Object.entries(window.WORLD_PATHS).map(([code, d]) => {
    if (code === "_bg") return `<path d="${d}" class="mm-bg"/>`;
    return `<path d="${d}" class="${codes.has(code) ? "mm-hit" : "mm-bg"}"/>`;
  }).join("");
  const names = (s.countries || []).map(c => c.name_fa).join("، ");
  return `<span class="${cls}" title="${esc(names || "بین‌المللی")}">
    <svg viewBox="${window.WORLD_VIEWBOX}" preserveAspectRatio="xMidYMid meet">${paths}</svg></span>`;
}

// clickable chips for the named figures in a story → their own page
function peopleRow(ents) {
  if (!ents || !ents.length) return "";
  const chips = ents.slice(0, 6).map(e =>
    `<span class="person-chip" data-slug="${esc(e.slug)}" onclick="event.stopPropagation();openEntity(this.dataset.slug)">${esc(e.name_fa)}</span>`).join("");
  return `<div class="people">${chips}</div>`;
}
// self-contained styling (theme-aware) so no separate CSS file is needed
(function () {
  const css = `.people{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 2px}
.person-chip{font-size:12.5px;padding:3px 10px;border-radius:999px;cursor:pointer;
  background:rgba(26,157,126,.12);color:#1a9d7e;border:1px solid rgba(26,157,126,.32);white-space:nowrap}
.person-chip:hover{background:rgba(26,157,126,.22)}
.people-strip{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}
.timeline{margin:6px 0 0}
.tl-item{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:start;background:none;border:none;padding:9px 0;cursor:pointer;color:inherit;position:relative;font-family:inherit}
.tl-item:not(:last-child)::after{content:"";position:absolute;inset-inline-start:5px;top:20px;bottom:-9px;width:2px;background:rgba(26,157,126,.25)}
.tl-dot{flex:0 0 12px;width:12px;height:12px;border-radius:50%;background:#1a9d7e;margin-top:5px}
.tl-body{display:flex;flex-direction:column;gap:2px}
.tl-time{font-size:12px;color:#8fa89b}
.tl-h{font-size:15px;line-height:1.6}
.tl-cur{cursor:default}
.tl-cur .tl-dot{background:#e0b341;box-shadow:0 0 0 3px rgba(224,179,65,.2)}
.tl-cur .tl-h{font-weight:700}
.tl-now{font-size:11px;color:#e0b341}
button.tl-item:hover .tl-h{color:#1a9d7e}
.mini-map{flex:0 0 auto;width:78px;height:52px;border-radius:6px;background:rgba(26,157,126,.06);
  border:1px solid rgba(26,157,126,.22);padding:2px;overflow:hidden;display:inline-flex;align-items:center;justify-content:center}
.mini-map svg{width:100%;height:100%;display:block}
.mini-map .mm-bg{fill:rgba(143,168,155,.20);stroke:rgba(143,168,155,.35);stroke-width:.5;vector-effect:non-scaling-stroke}
.mini-map .mm-hit{fill:#1a9d7e;stroke:#0d5b48;stroke-width:.5;vector-effect:non-scaling-stroke}
.mm-detail{width:180px;height:120px}
.mm-caption{font-size:11.5px;color:#8fa89b;text-align:center;margin-top:4px}
.geo-strip{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0 6px}
.geo-strip .g-lbl{font-size:13px;color:#8fa89b}
.sb-click{cursor:pointer;transition:background .15s ease,color .15s ease;border-radius:8px;padding-inline:6px;margin-inline:-6px}
.sb-click:hover{background:rgba(26,157,126,.10);color:#1a9d7e}
.stile-click{cursor:pointer;transition:transform .12s ease,border-color .15s ease}
.stile-click:hover{transform:translateY(-1px);border-color:#1a9d7e;color:#1a9d7e}
.bars-svg .bar-click{cursor:pointer;transition:opacity .15s ease}
.bars-svg .bar-click:hover{opacity:.7}
.day-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px;margin:0 -4px 6px;scrollbar-width:none}
.day-chips::-webkit-scrollbar{display:none}
.day-chip{flex:0 0 auto;padding:5px 12px;font-size:12.5px;border-radius:999px;
  border:1px solid rgba(143,168,155,.35);color:#a9c4b7;background:transparent;cursor:pointer;white-space:nowrap;font-family:inherit}
.day-chip .d-n{font-size:11px;color:#8fa89b;margin-inline-start:4px}
.day-chip:hover{border-color:#1a9d7e;color:#1a9d7e}
.day-chip.on{background:rgba(26,157,126,.15);border-color:#1a9d7e;color:#1a9d7e}
.card-thumb{flex:0 0 84px;width:84px;height:84px;border-radius:8px;object-fit:cover;background:rgba(143,168,155,.10);border:1px solid rgba(143,168,155,.18)}
.hero-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:rgba(143,168,155,.10);margin:6px 0 12px;display:block}
.hero-credit{font-size:12px;color:#8fa89b;margin:-6px 0 12px;text-align:end}
.ref-strip{display:flex;flex-direction:column;gap:6px;margin:0 0 14px;padding:10px 12px;background:rgba(26,157,126,.06);border:1px solid rgba(26,157,126,.20);border-radius:10px}
.ref-strip .ref-hd{font-size:12.5px;color:#8fa89b}
.ref-strip .ref-hd b{color:#a9c4b7}
.ref-links{display:flex;flex-wrap:wrap;gap:8px}
.ref-links a{font-size:13px;padding:4px 10px;border-radius:8px;text-decoration:none;background:rgba(26,157,126,.10);color:#1a9d7e;border:1px solid rgba(26,157,126,.22);white-space:nowrap}
.ref-links a:hover{background:rgba(26,157,126,.20)}
.ref-links a .ref-src{color:#8fa89b;font-size:11.5px;margin-inline-end:4px}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
})();

function feedCard(s, homepage = false) {
  const imp = impInfo(s.importance_score);
  const badges = (s.source_names || []).slice(0, 4).map(x => `<span class="src-badge clickable" data-src="${esc(x)}" onclick="event.stopPropagation();openSource(this.dataset.src)">${esc(x)}</span>`).join("");
  // Show the article's image when the outlet's RSS provided one; otherwise
  // fall back to the mini-map (so every card has a visual anchor).
  const thumb = s.image_url
    ? `<img class="card-thumb" loading="lazy" src="${esc(s.image_url)}" alt="" onerror="this.remove()">`
    : miniMap(s);
  return `<button class="card" onclick="openStory('${s.id}')">
    <div class="meta"><span class="chip">${CAT_FA[s.category] || "خبر"}</span>
      <span class="dot"></span><span class="muted">${relTime(s.published_at)}</span>${geoBadge(s.geo)}${trendBadge(s.trend)}
      <span class="imp ${imp.cls}"><span class="bars"><i></i><i></i><i></i></span><span class="lbl">${imp.lbl}</span></span></div>
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <h2>${esc(homepage ? homeEditorialText(s.headline_fa || "") : (s.headline_fa || ""))}</h2>
        <p class="kalam">${esc(homepage ? homeEditorialText(s.summary_fa || "") : (s.summary_fa || ""))}</p>
      </div>
      ${thumb}
    </div>
    ${peopleRow(s.entities)}
    <div class="foot"><span class="sources-mini">${faN(s.source_count || 0)} منبع:</span>${badges}
      <span class="cred-row">${s.figure_count ? `<span class="fig-badge" title="دیدگاه چهره‌ها دربارهٔ این خبر">${faN(s.figure_count)} دیدگاه</span>` : ""}${credBadge(s.credibility)}${fcBadge(s.factcheck)}${saveBtn(s.id)}</span></div>
  </button>`;
}

let ALL = [];
let tier = "all";
let feedRange = "all";
async function loadFeed(renderHome = true) {
  const el = document.getElementById("feed");
  try {
    ALL = await getJSON(`${DATA}/stories.json`);
    if (renderHome) {
      renderFeed();
      renderDayChips();
      updateFreshness();
      renderHomeDaily();
    }
  } catch (e) {
    const why = e && e.name === "AbortError" ? "دریافت داده بیش از حد طول کشید." : "فایل خبرها در دسترس نیست.";
    el.innerHTML = `<div class="state"><div class="big">خبرها بارگذاری نشد</div>
      <p class="muted">${why}</p>
      <button class="fchip on" onclick="retryFeed()">تلاش دوباره</button></div>`;
  }
}
async function retryFeed() {
  const el = document.getElementById("feed");
  el.innerHTML = '<div class="loader"></div>';
  await loadFeed();
}
// A small horizontally-scrolling strip above the feed: today, yesterday, and
// the last few days that actually have stories. Fast browse "back in time".
function renderDayChips() {
  const holder = document.getElementById("day-chips");
  if (!holder) return;
  const counts = {};
  ALL.forEach(s => {
    const d = (s.published_at || "").slice(0, 10);
    if (d) counts[d] = (counts[d] || 0) + 1;
  });
  const days = Object.keys(counts).sort().reverse().slice(0, 10);
  if (!days.length) { holder.innerHTML = ""; return; }
  holder.innerHTML = days.map(d =>
    `<button class="day-chip" onclick="openDay('${d}')">${esc(dayLabel(d))}
      <span class="d-n">${faN(counts[d])}</span></button>`).join("");
}
const tierOf = s => impInfo(s.importance_score).cls;   // high | mid | low
function feedFilter(mode) {
  if (mode === "mine") return mineFeed();
  if (mode === "rising") return ALL.filter(s => s.trend && s.trend.rising);
  if (mode === "hot") return ALL.filter(s => s.trend && s.trend.hot);
  if (mode === "high" || mode === "mid" || mode === "low") return ALL.filter(s => tierOf(s) === mode);
  return ALL;
}
function renderFeed() {
  const el = document.getElementById("feed");
  if (!ALL.length) { el.innerHTML = `<div class="state"><div class="big">هنوز خبری منتشر نشده</div></div>`; return; }
  if (tier === "mine" && followCount() === 0 && !(FOLLOW.saved && FOLLOW.saved.length)) {
    el.innerHTML = `<div class="state mine-empty"><div class="big">سرخطِ تو خالی است</div>
      <p class="muted">با زدنِ ستارهٔ ★ روی موضوع‌ها (در تبِ موضوعات)، استان‌ها (در صفحهٔ ایران) و منابع، یا ذخیرهٔ خبرها، اینجا سرخطِ شخصیِ خودت ساخته می‌شود — روی همین دستگاه.</p></div>`;
    return;
  }
  let items = feedFilter(tier);
  if (feedRange !== "all") { const newest = items.map(s => new Date(s.published_at || 0).getTime()).filter(Number.isFinite).reduce((a,b)=>Math.max(a,b),0); const base = newest || Date.now(); const cut = base - Number(feedRange) * 3600e3; items = items.filter(s => { const t=new Date(s.published_at||0).getTime(); return Number.isFinite(t) && t >= cut; }); }
  if (sortMode === "new") items = items.slice().sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
  else if (sortMode === "sources") items = items.slice().sort((a,b)=>(b.source_count||0)-(a.source_count||0));
  else if (sortMode === "views") items = items.slice().sort((a,b)=>(b.figure_count||0)-(a.figure_count||0) || (b.source_count||0)-(a.source_count||0));
  else if (sortMode === "rising") items = items.slice().sort((a,b)=>((b.trend&&b.trend.velocity)||0)-((a.trend&&a.trend.velocity)||0));
  const empty = { rising: "الان خبری در حالِ رشد نیست", hot: "الان خبرِ داغی نداریم",
    mine: "هنوز خبری از دنبال‌شده‌هایت نیست" }[tier] || "خبری در این نما نیست";
  el.innerHTML = items.length ? items.map(s => feedCard(s, true)).join("")
    : `<div class="state"><div class="big">${empty}</div></div>`;
}
function setTier(t) {
  tier = t;
  document.querySelectorAll("#imp-filter .fchip").forEach(c =>
    c.classList.toggle("on", (c.getAttribute("onclick") || "").indexOf("'" + t + "'") >= 0));
  renderFeed();
}
function setFeedRange(r) { feedRange = r; document.querySelectorAll(".day-range-chips > .day-chip[data-range]").forEach(b => b.classList.toggle("on", String(b.dataset.range) === String(r))); renderFeed(); }
let sortMode = "imp";
function setSort(m) {
  sortMode = m;
  ["imp","new","sources","views","rising"].forEach(x => { const b=document.getElementById("sort-"+x); if(b) b.classList.toggle("on",m===x); });
  renderFeed();
}

// stories that share figures / topics with this one — the thread around it
function relatedStories(s) {
  const ents = new Set((s.entities || []).map(e => e.slug));
  const tops = new Set((s.topics || []).map(t => t.slug));
  return ALL.filter(c => c.id !== s.id).map(c => {
    let sc = 0;
    (c.entities || []).forEach(e => { if (ents.has(e.slug)) sc += 3; });
    (c.topics || []).forEach(t => { if (tops.has(t.slug)) sc += 1; });
    return { c, sc };
  }).filter(x => x.sc > 0)
    .sort((a, b) => b.sc - a.sc
      || String(b.c.published_at || "").localeCompare(String(a.c.published_at || "")))
    .slice(0, 8).map(x => x.c);
}
// a vertical timeline of this story + its related coverage (newest first)
function timelineSection(s, related) {
  if (!related.length) return "";
  const all = related.concat([{ __cur: true, id: s.id, headline_fa: s.headline_fa,
    published_at: s.published_at, source_count: s.source_count }]);
  all.sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
  const rows = all.map(c => c.__cur
    ? `<div class="tl-item tl-cur"><span class="tl-dot"></span><div class="tl-body">
        <span class="tl-time">${relTime(c.published_at)}</span>
        <span class="tl-h">${esc(c.headline_fa || "")}</span><span class="tl-now">همین خبر</span></div></div>`
    : `<button class="tl-item" onclick="openStory('${c.id}')"><span class="tl-dot"></span><div class="tl-body">
        <span class="tl-time">${relTime(c.published_at)} · ${faN(c.source_count || 0)} منبع</span>
        <span class="tl-h">${esc(c.headline_fa || "")}</span></div></button>`).join("");
  return `<div class="layers"><h3 class="section-h">روندِ ماجرا <span class="n">خبرهای مرتبط، به‌ترتیبِ زمان</span></h3>
    <div class="timeline">${rows}</div></div>`;
}

async function storyPeopleSuggestions(s) {
  const d = await loadFigures();
  const norm = v => String(v || "").replace(/‌/g," ").replace(/\s+/g," ").trim();
  const names = new Set((s.person_statements || []).map(q => norm(q.person_name_fa)).filter(Boolean));
  (s.entities || []).forEach(e => {
    const n = norm(e.name_fa || e.name || e.label_fa);
    if (n) names.add(n);
  });
  const people = (d.figures || []).filter(f => names.has(norm(f.name_fa))).slice(0, 8);
  if (!people.length) return "";
  return `<div class="layers story-people"><h3 class="section-h">چهره‌های مرتبط <span class="n">پروفایل و گفته‌های بیشتر</span></h3>
    <div class="story-people-grid">${people.map(p => `<article class="story-person-card">
      <button class="story-person-main" onclick="openFigure('${esc(p.handle)}')">
        ${avatar(p,"md")}<span class="story-person-copy"><b>${esc(p.name_fa)}</b><small>${esc(p.role_fa||p.field_fa||"")}</small><em>${faN((p.posts||[]).length)} گفته</em></span>
      </button>
      ${figureFollowBtn(p.handle,true)}
    </article>`).join("")}</div></div>`;
}

async function openStory(id) {
  // Defensive normalization for copied/encoded deep links.  A stray control
  // character (e.g. %01 before a UUID) previously produced a valid-looking
  // route that could never match an exported story JSON file.
  const rawId = String(id || "");
  const uuidMatch = rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const cleanId = uuidMatch ? uuidMatch[0] : rawId.replace(/[\\x00-\\x1F\\x7F]/g, "").trim();
  if (cleanId !== rawId) {
    history.replaceState(null, "", "#/story/" + encodeURIComponent(cleanId));
  } else {
    setHash("#/story/" + cleanId);
  }
  show("detail"); setTab("feed");
  const v = document.getElementById("detail-view");
  v.innerHTML = `<div class="spinner"></div>`;
  let s;
  try { s = await getJSON(`${DATA}/story/${cleanId}.json`); }
  catch (e) {
    // Deep links can outlive the compact feed.  Give a useful failure state
    // rather than leaving a blank/spinner page.
    v.innerHTML = `<button class="back" onclick="showFeed()">بازگشت به سرخط</button><div class="state"><div class="big">این خبر در آرشیو فعلی پیدا نشد</div><p class="muted">شناسهٔ خبر: ${esc(cleanId)}</p></div>`;
    return;
  }

  const imp = impInfo(s.importance_score);
  const [peopleSuggestions, storyBookData] = await Promise.all([storyPeopleSuggestions(s), loadBooks()]);
  const storyBooks=(storyBookData.books||[]).filter(b=>(b.mentions||[]).some(m=>String(m.story_id||"")===String(cleanId)));
  const storyBooksSection=storyBooks.length?`<section class="story-books"><div class="rule"><span>کتاب‌های مرتبط با این خبر</span><span class="l"></span></div><div class="press-book-links">${storyBooks.map(b=>`<button onclick="openBook('${esc(b.slug)}')"><span>کتاب</span><b>${esc(b.title_fa||"")}</b></button>`).join("")}</div></section>`:"";
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join("");
  const views = (s.source_views || []).map(sv => `<div class="view"><div class="v-h"><span class="v-name">${esc(sv.source_name)}</span></div><p>${esc(sv.viewpoint_fa || "")}</p></div>`).join("");
  const cites = (s.sources || []).map(c => `<a class="cite" href="${c.article_url || "#"}" target="_blank" rel="noopener">
      <div class="c-body"><div class="c-src">${esc(c.source_name)}</div><div class="c-title">${esc(c.original_headline || "")}</div></div>
      <span class="c-time">${relTime(c.published_at)}</span>
      <span class="ext"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg></span></a>`).join("");
  const quotedPeople = (s.person_statements || []).length ? `
    <div class="layers"><h3 class="section-h">چه کسانی در این خبر حرف زده‌اند <span class="n">گفتهٔ شخص، با لینک منبع</span></h3>
      <div class="views">${(s.person_statements || []).map(q => `<div class="view fig-view">
        <div class="v-h"><button class="fig-profile-link v-name" onclick="openFigureByName('${esc(q.person_name_fa)}')">${esc(q.person_name_fa)}</button>
          <span class="fig-role">${esc(q.role_fa || "")}</span></div>
        <p>${esc(q.statement_fa || "")}</p>
        <div class="fig-foot"><span class="muted">${q.direct_quote ? "نقل‌قول مستقیم" : "گفته در گزارش"}</span>
          <a href="${esc(q.article_url)}" target="_blank" rel="noopener">منبع · ${esc(q.source_name)} ↗</a></div>
      </div>`).join("")}</div>
    </div>` : "";
  const known = (s.facts && s.facts.length) || (s.uncertainties && s.uncertainties.length) ? `
    <div class="layers"><h3 class="section-h">واقعیت در برابر ابهام</h3><div class="know">
      <div class="panel fact"><div class="p-h"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg> آنچه معلوم است</div><ul>${li(s.facts)}</ul></div>
      <div class="panel warn"><div class="p-h"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.8-1.2 1.6v.3M12 17h.01"/></svg> آنچه هنوز نامشخص است</div><ul>${li(s.uncertainties)}</ul></div>
    </div></div>` : "";
  const consensus = (s.agreements && s.agreements.length) || (s.disagreements && s.disagreements.length) ? `
      <div class="consensus"><div class="cbox ag"><h4>نقطهٔ اشتراک</h4><p>${esc((s.agreements || [])[0] || "—")}</p></div>
        <div class="cbox dis"><h4>نقطهٔ اختلاف</h4><p>${esc((s.disagreements || [])[0] || "—")}</p></div></div>` : "";

  // Our own credibility signal + Factnameh link
  const c = s.credibility;
  const cred = c ? `
    <div class="layers"><h3 class="section-h">اعتبارِ خبر <span class="n">سنجهٔ خودکار — نه حکمِ نهایی</span></h3>
      <div class="cred-box ${c.level}">
        <div class="cred-top"><span class="cstatus ${CRED_CLS[c.level]}">${CRED_FA[c.level]}</span>
          <span class="cred-lbl">${esc(c.label_fa || "")}</span></div>
        <p class="cred-note">${esc(c.note_fa || "")}</p>
        <div class="cred-stats"><span>${faN(c.independent_sources)} منبعِ مستقل</span>
          <span class="dot"></span><span>${faN(c.agreements)} نقطهٔ اشتراک</span>
          <span class="dot"></span><span>${faN(c.disagreements)} نقطهٔ اختلاف</span></div>
      </div>
      ${s.factcheck ? `<a class="fc-link" href="${s.factcheck.url}" target="_blank" rel="noopener">
        <span class="fc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="fc-body"><b>راستی‌آزمایی‌شده در فکت‌نامه</b><span class="muted">${esc(s.factcheck.title || "مشاهدهٔ گزارش")}</span></span>
        <span class="ext"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg></span></a>` : ""}
    </div>` : "";

  const tr = s.trend;
  const trendSec = (tr && tr.total_sources > 1) ? `
    <div class="layers"><h3 class="section-h">روندِ پوشش <span class="n">۴۸ ساعتِ اخیر</span> ${trendBadge(tr)}</h3>
      <div class="trend-box">
        <div class="trend-stat"><span class="ts-v">${faN(tr.total_sources)}</span><span>منبع تاکنون</span></div>
        <div class="trend-stat"><span class="ts-v">${faN(tr.velocity)}</span><span>در ۶ ساعتِ اخیر</span></div>
        <div class="trend-stat"><span class="ts-v">${faN(tr.ratio)}×</span><span>شتابِ پوشش</span></div>
      </div>
      <div class="chart-wrap">${svgSpark(tr.curve || [], { w: 320, h: 60 })}</div>
      <p class="muted" style="margin:6px 0 0">شمارِ تجمعیِ منابعِ مستقل که این خبر را پوشش داده‌اند؛ شیبِ تندتر یعنی خبر سریع‌تر در حالِ گسترش است.</p>
    </div>` : "";

  const chips = (s.asks || []).map((a, i) => `<button class="qchip" onclick="showAsk(${i})">${esc(a.q)}</button>`).join("");
  window._asks = s.asks || [];
  const relSection = timelineSection(s, relatedStories(s));

  v.innerHTML = `
    <button class="back" onclick="showFeed()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg> بازگشت به سرخط</button>
    <div class="d-head"><div class="meta"><span class="chip">${CAT_FA[s.category] || "خبر"}</span><span class="dot"></span><span class="muted">${relTime(s.published_at)}</span>${trendBadge(s.trend)}<span class="spacer" style="flex:1"></span>${saveBtn(s.id)}</div>
      <h1>${esc(s.headline_fa || "")}</h1>
      <div class="d-meta"><span class="imp ${imp.cls}"><span class="bars"><i></i><i></i><i></i></span><span class="lbl">${imp.lbl}</span></span>
        <span class="dot"></span><span class="muted">${faN(s.source_count || 0)} منبع</span>
        <span class="dot"></span><span class="muted">${IRAN_FA[s.iran_relevance] || ""}</span></div></div>
    ${s.image_url ? `<img class="hero-img" src="${esc(s.image_url)}" alt="" loading="lazy" onerror="this.parentElement.querySelector('.hero-credit')?.remove();this.remove()">` : ''}
    ${s.image_url && s.image_credit ? `<div class="hero-credit">عکس از: ${esc(s.image_credit)}</div>` : ''}
    <div class="kalam-box"><span class="eyebrow">جان‌کلام <span class="ai">ترکیب هوش مصنوعی</span></span><p>${esc(s.summary_fa || "")}</p></div>
    ${detailGeoStrip(s)}
    ${peopleRow(s.entities)}
    ${peopleSuggestions}
    ${storyBooksSection}
    <div class="twocol"><div class="qa"><h3>چه اتفاقی افتاد؟</h3><p>${esc(s.what_happened_fa || "—")}</p></div>
      <div class="qa"><h3>چرا اهمیت دارد؟</h3><p>${esc(s.why_it_matters_fa || "—")}</p></div></div>
    ${known}
    ${cred}
    ${trendSec}
    ${relSection}
    <div class="layers"><h3 class="section-h">منابع چه می‌گویند <span class="n">دیدگاه هر منبع، جدا از واقعیت</span></h3><div class="views">${views || '<p class="muted">—</p>'}</div>${consensus}</div>
    ${figuresSection(s.figures)}
    <div class="layers"><h3 class="section-h">منابع</h3><div class="cites">${cites}</div></div>
    <div class="ask"><div class="a-h"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" style="color:var(--accent)"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" stroke-linejoin="round"/></svg> دربارهٔ این خبر بپرس</div>
      <p class="a-sub">پاسخ‌های آماده از روی همین خبر.</p>
      <div class="chips">${chips}</div>
      <div class="answer" id="answer"><div class="a-bubble" id="a-bubble"></div>
        <div class="grounded"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg> مبتنی بر منابع همین خبر</div></div>
    </div>`;
}
function showAsk(i) {
  document.querySelectorAll(".qchip").forEach(c => c.classList.remove("on"));
  document.getElementById("answer").classList.add("show");
  document.getElementById("a-bubble").textContent = (window._asks[i] || {}).a || "—";
}

/* ---- بورس اخبار ---- */
let _trendsLoaded = false;
const grp = n => Number(n).toLocaleString("en-US");
async function renderTrends() {
  if (_trendsLoaded) return;
  const el = document.getElementById("trends");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const [t, st, ents] = await Promise.all([
      getJSON(`${DATA}/trends.json`),
      getJSON(`${DATA}/stats.json`).catch(() => null),
      getJSON(`${DATA}/entities.json`).catch(() => []),
    ]);
    const peopleChips = (ents || []).slice(0, 24).map(x =>
      `<span class="person-chip" data-slug="${esc(x.slug)}" onclick="openEntity(this.dataset.slug)">${esc(x.name_fa)} <span class="chip-n">${faN(x.count)}</span></span>`).join("");
    const peopleSection = peopleChips
      ? `<div class="rule" style="margin-top:22px"><span>چهره‌ها در خبرها</span><span class="l"></span></div>
         <div class="people-strip">${peopleChips}</div>` : "";
    const topics = (t.topics || []);
    const g = t.google || {};
    const googleOn = Object.keys(g).length > 0;
    const rows = topics.map(tp => {
      const series = tp.series || [];
      const cmp = g[tp.slug];
      const chart = cmp
        ? `<div class="tp-chart cmp">${svgCompare(series, cmp.points.map(p => p.v))}</div>
           <div class="cmp-legend"><span class="lg a">جان‌کلام</span><span class="lg b">گوگل ترندز</span></div>`
        : `<div class="tp-chart">${svgSpark(series, { w: 150, h: 34 })}</div>`;
      return `<button class="tp-row" onclick="openTrendDossier('${tp.slug}')">
        <div class="tp-head"><span class="tp-name">${esc(tp.name_fa)}</span>${growthTag(tp.growth)}
          <span class="tp-n">${faN(tp.story_count)} خبر · هفته: ${faN(tp.last7 == null ? tp.story_count : tp.last7)}</span></div>
        ${chart}</button>`;
    }).join("");
    const hot = (t.hottest || []).map(h => `<div class="ticker" onclick="openStory('${h.id}')" style="cursor:pointer">
      <span class="t-name">${esc(h.headline_fa)}<span class="t-cat">${CAT_FA[h.category] || ""}</span></span>
      <span class="t-val">${faN(h.source_count)}</span>
      <span class="t-chg tx-up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>منبع</span></div>`).join("");
    const statsSection = st ? `<div class="rule" style="margin-top:2px"><span>نبض خبری</span><span class="l"></span></div>${statsBlock(st)}` : "";
    el.innerHTML = `
      ${statsSection}
      <div class="tx-hero"><span class="val">${faN(t.story_total || 0)}</span><span class="lbl">خبرِ فعال روی تخته</span>
        <span class="spacer" style="flex:1"></span><span class="lbl">${faN(topics.length)} موضوع فعال</span></div>
      ${peopleSection}
      <div class="rule"><span>رشدِ موضوع‌ها <span class="n">۱۴ روزِ اخیر</span></span><span class="l"></span></div>
      <div class="tp-board">${rows || '<p class="muted">—</p>'}</div>
      ${googleOn ? '' : '<p class="muted" style="margin:8px 0 0">مقایسه با گوگل ترندز فعلاً در دسترس نیست (آزمایشی).</p>'}
      <div class="rule" style="margin-top:26px"><span>پرپوشش‌ترین خبرها</span><span class="l"></span></div>
      <div class="tickers">${hot || '<p class="muted">—</p>'}</div>
      <p class="muted" style="margin-top:18px">«رشد» = مقایسهٔ خبرهای این هفته با هفتهٔ پیش. «پوشش» = چند منبعِ مستقل یک خبر را گفته‌اند.</p>`;
    _trendsLoaded = true;
  } catch (e) {
    el.innerHTML = `<div class="state"><div class="big">بورس اخبار بارگذاری نشد</div></div>`;
  }
}

/* ---- فکت — hub with sub-tabs: needs-verification / disagreement / Factnameh ---- */
function fcCard(f) {
  return `<a class="card fc-card" href="${f.url}" target="_blank" rel="noopener">
    <div class="meta"><span class="chip">فکت‌نامه</span><span class="dot"></span><span class="muted">${esc((f.published || "").slice(0, 10))}</span>
      <span class="ext" style="margin-inline-start:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg></span></div>
    <h2>${esc(f.title)}</h2>${f.summary ? `<p class="kalam">${esc(f.summary)}</p>` : ""}</a>`;
}
let _factData = { needs: [], disp: [], fn: [] };
async function renderFactchecks() {
  const el = document.getElementById("factchecks");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const fn = await getJSON(`${DATA}/factchecks.json`).catch(() => []);
    const needs = ALL.filter(s => s.credibility && s.credibility.needs_verification);
    const disp = ALL.filter(s => s.credibility && (s.credibility.disagreements || 0) > 0);
    _factData = { needs, disp, fn };
    const tabs = [["needs", "نیازمندِ راستی‌آزمایی", needs.length],
                  ["disp", "اختلافِ منابع", disp.length],
                  ["fn", "فکت‌نامه", fn.length]];
    const first = (tabs.find(t => t[2] > 0) || tabs[0])[0];
    el.innerHTML = `<div class="fact-note">این سنجه‌ها <b>خودکار</b>ند و از روی منابعِ هر خبر ساخته می‌شوند — نه حکمِ نهایی. راستی‌آزماییِ قطعی کارِ فکت‌نامه است.</div>
      <div class="imp-filter" id="fact-tabs">${tabs.map(t => `<button class="fchip" data-k="${t[0]}" onclick="setFactTab('${t[0]}')">${t[1]}${t[2] ? ` <span class="chip-n">${faN(t[2])}</span>` : ""}</button>`).join("")}</div>
      <div id="fact-body"></div>`;
    setFactTab(first);
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">بارگذاری نشد</div></div>`; }
}
function setFactTab(k) {
  document.querySelectorAll("#fact-tabs .fchip").forEach(c => c.classList.toggle("on", c.dataset.k === k));
  const d = _factData;
  const b = document.getElementById("fact-body");
  const empty = `<div class="state"><div class="big">موردی نیست</div></div>`;
  if (k === "needs")
    b.innerHTML = d.needs.length ? `<p class="muted" style="margin:0 0 12px">خبرهای تک‌منبع که هنوز منبعِ مستقلِ دیگری تأییدشان نکرده.</p><div class="feed">${d.needs.map(feedCard).join("")}</div>` : empty;
  else if (k === "disp")
    b.innerHTML = d.disp.length ? `<p class="muted" style="margin:0 0 12px">خبرهایی که منابع در جزئیاتشان با هم اختلاف دارند.</p><div class="feed">${d.disp.map(feedCard).join("")}</div>` : empty;
  else
    b.innerHTML = d.fn.length ? `<p class="muted" style="margin:0 0 12px">راستی‌آزماییِ مستقل و حرفه‌ای (شریکِ برنامهٔ متا). روی هر مورد بزن.</p><div class="feed">${d.fn.map(fcCard).join("")}</div>` : empty;
}

/* ---- راهنما / FAQ ---- */
let _faqLoaded = false;
const FAQ = [
  ["خبرها از کجا می‌آیند؟",
    "پندار به‌طور خودکار از فیدِ (RSS) ده‌ها خبرگزاری می‌خواند: منابعِ جهانی (رویترز، AP، بی‌بی‌سی، گاردین، الجزیره)، منابعِ داخلیِ فارسی (ایرنا، ایسنا، تسنیم) و منابعِ فارسیِ برون‌مرزی (بی‌بی‌سی فارسی، ایران اینترنشنال، رادیو فردا، دویچه‌وله). هدف این است که هم روایتِ داخلی و هم روایتِ خارجی کنارِ هم دیده شوند."],
  ["چطور از چند منبع یک خبر می‌سازد؟",
    "سیستم خبرهایی که دربارهٔ یک رویدادِ واحد هستند را «خوشه‌بندی» می‌کند: عنوان‌ها و متن‌ها را مقایسه می‌کند و گزارش‌های مربوط به یک اتفاق را در یک خبرِ واحد کنار هم می‌گذارد. برای همین زیرِ هر خبر می‌بینی «۳ منبع» یا «۵ منبع»."],
  ["منظور از تفکیکِ «واقعیت / دیدگاه / جان‌کلام / ابهام» چیست؟",
    "هر خبر چهار لایه دارد که عمداً از هم جدا نگه داشته شده‌اند: <b>واقعیت</b> (آنچه معلوم است)، <b>دیدگاهِ هر منبع</b> (هر خبرگزاری چه می‌گوید، جدا از بقیه)، <b>جان‌کلام</b> (خلاصهٔ کوتاهِ ترکیبی)، و <b>ابهام</b> (آنچه هنوز روشن نیست). این‌طوری تحلیل با واقعیت قاطی نمی‌شود."],
  ["برچسبِ «مهم / بسیار مهم» چطور حساب می‌شود؟",
    "یک امتیازِ شفاف از ۱۰۰ که از پنج عامل ساخته می‌شود: تعدادِ منابعِ مستقل (تا ۳۵)، اعتبارِ منابع (تا ۲۰)، سرعتِ پوشش/تعدادِ گزارش‌ها (تا ۱۵)، تازگیِ خبر (تا ۲۰)، و میزانِ ارتباط با ایران (تا ۱۰). امتیازِ ۷۵ به بالا «بسیار مهم»، ۵۰ تا ۷۵ «مهم»، و پایین‌تر «متوسط» است. هیچ‌چیزِ آن جعبهٔ سیاه نیست."],
  ["«اعتبارِ خبر» با فکت‌نامه چه فرقی دارد؟",
    "«اعتبارِ خبر» یک سنجهٔ <b>خودکارِ</b> ماست که فقط به دو چیز نگاه می‌کند: چند منبعِ مستقل خبر را گفته‌اند و آیا با هم توافق دارند یا اختلاف. خبرِ تک‌منبعی برچسبِ «نیازمند راستی‌آزمایی» می‌گیرد. این «حکمِ درست/غلط» نیست — فقط نشان می‌دهد یک ادعا چقدر پشتوانهٔ چندمنبعی دارد. راستی‌آزماییِ واقعی و انسانی کارِ نهادهایی مثلِ فکت‌نامه است."],
  ["فکت‌نامه چیست و کِی برچسبش را می‌بینم؟",
    "فکت‌نامه یک نهادِ مستقل و حرفه‌ایِ راستی‌آزمایی به فارسی است (شریکِ برنامهٔ راستی‌آزماییِ متا). آخرین گزارش‌هایش را در بخشِ «فکت‌نامه» می‌بینی، و اگر یکی از خبرهای ما با یک گزارشِ فکت‌نامه هم‌موضوع باشد، رویِ آن خبر برچسبِ «راستی‌آزمایی‌شده در فکت‌نامه» با لینک ظاهر می‌شود."],
  ["ارتباط با ایران چطور تعیین می‌شود؟",
    "بر اساسِ واژه‌های کلیدیِ مرتبط با ایران در متنِ خبر. اگر ربطی نباشد، سیستم به‌زور ربطی نمی‌سازد — خبر بی‌ارتباط صریحاً «بدون ارتباط مستقیم با ایران» علامت می‌خورد."],
  ["کپی‌رایت چه می‌شود؟ آیا متنِ کاملِ خبرها را می‌آورید؟",
    "نه. پندار هیچ‌وقت متنِ کاملِ مقاله‌ها را بازنشر نمی‌کند. فقط خلاصهٔ کوتاه می‌سازد و به منبعِ اصلی لینک می‌دهد تا خودت آنجا کامل بخوانی."],
  ["هوش مصنوعی دقیقاً چه‌کار می‌کند؟",
    "خلاصه و تفکیکِ چهارلایه را یک مدلِ هوش مصنوعی (جمینای) می‌سازد، اما خروجی‌اش پیش از انتشار اعتبارسنجیِ ساختاری می‌شود و همیشه به منابعِ واقعی گره خورده است. متنِ منابع دست‌نخورده و لینک‌دار می‌ماند."],
  ["هر چند وقت به‌روز می‌شود؟",
    "هر یک ساعت، به‌صورتِ خودکار. زمانِ آخرین به‌روزرسانی بالای «سرخط» نوشته شده است."],
];
function renderFaq() {
  if (_faqLoaded) return;
  document.getElementById("faq").innerHTML = FAQ.map(([q, a]) =>
    `<details class="faq-item"><summary>${esc(q)}</summary><div class="faq-a">${a}</div></details>`).join("")
    + `<p class="muted" style="margin-top:18px;text-align:center">پندار — خبر، دیدگاه و زمینه در یک شبکهٔ واحد.</p>`;
  _faqLoaded = true;
}

async function renderTopics() {
  const el = document.getElementById("topic-grid");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const topics = await getJSON(`${DATA}/topics.json`);
    const counted = topics
      .map(t => ({ ...t, n: ALL.filter(s => (s.topics || []).some(x => x.slug === t.slug)).length }))
      .filter(t => t.n > 0)
      .sort((a, b) => b.n - a.n);
    if (!counted.length) {
      el.innerHTML = `<div class="state"><div class="big">هنوز موضوعی دسته‌بندی نشده</div><p class="muted">با به‌روزرسانیِ بعدی پر می‌شود.</p></div>`;
      return;
    }
    el.innerHTML = counted.map(t => `<div class="topic" role="button" tabindex="0" onclick="openTopic('${t.slug}')">
      <div class="t-body"><div class="t-fa">${esc(t.name_fa)}</div><div class="t-count">${faN(t.n)} خبر</div></div>
      ${followBtn("topics", t.slug, "دنبال", "دنبال کن")}</div>`).join("");
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">موضوعات بارگذاری نشد</div></div>`; }
}

// archive feed grouped by importance tier ("به تفکیک اهمیت")
const TIERS = [["high", "بسیار مهم"], ["mid", "مهم"], ["low", "متوسط"]];
function groupedFeed(items) {
  if (!items.length) return `<div class="state"><div class="big">خبری نیست</div></div>`;
  let html = "";
  for (const [cls, label] of TIERS) {
    const g = items.filter(s => tierOf(s) === cls);
    if (!g.length) continue;
    html += `<div class="rule"><span>${label}</span><span class="l"></span></div>
      <div class="feed">${g.map(feedCard).join("")}</div>`;
  }
  return html;
}

/* ---- Day archive: خبرهای «امروز/دیروز/…» با تفکیک دسته ---- */
// UTC date (YYYY-MM-DD) — matches what stories.published_at.slice(0,10) uses.
function utcDayISO(offsetDays) {
  offsetDays = offsetDays || 0;
  return new Date(Date.now() + offsetDays * 86400e3).toISOString().slice(0, 10);
}
function dayLabel(dateStr) {
  if (dateStr === utcDayISO(0)) return "امروز";
  if (dateStr === utcDayISO(-1)) return "دیروز";
  const diff = Math.floor((Date.parse(utcDayISO(0)) - Date.parse(dateStr)) / 86400e3);
  if (diff > 1 && diff < 30) return faN(diff) + " روز پیش";
  return dateStr;
}
function groupedByCategory(items) {
  if (!items.length)
    return `<div class="state"><div class="big">خبری در این روز نیست</div></div>`;
  const order = Object.keys(CAT_FA).concat(["_other"]);
  const groups = {};
  items.forEach(s => {
    const k = CAT_FA[s.category] ? s.category : "_other";
    (groups[k] = groups[k] || []).push(s);
  });
  let html = "";
  for (const k of order) {
    const g = groups[k]; if (!g || !g.length) continue;
    const label = k === "_other" ? "سایر" : CAT_FA[k];
    html += `<div class="rule"><span>${esc(label)} <span class="n">${faN(g.length)}</span></span><span class="l"></span></div>
      <div class="feed">${g.map(feedCard).join("")}</div>`;
  }
  return html;
}
function openDay(dateStr) {
  if (!ALL.length) return;
  setHash("#/day/" + dateStr);
  show("topicarchive"); setTab("feed");
  document.getElementById("ta-back-t").textContent = "بازگشت به سرخط";
  document.getElementById("ta-back").onclick = showFeed;
  const items = ALL.filter(s => (s.published_at || "").slice(0, 10) === dateStr);
  document.getElementById("ta-title").textContent = "خبرهای " + dayLabel(dateStr);
  document.getElementById("ta-sub").textContent = faN(items.length) + " خبر · " + dateStr;
  document.getElementById("ta-feed").innerHTML = groupedByCategory(items);
}

async function openTrendDossier(slug) {
  if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
  const t = await getJSON(`${DATA}/trends.json`).catch(() => ({ topics: [] }));
  const tp = (t.topics || []).find(x => x.slug === slug);
  if (!tp) return openTopic(slug);
  setHash("#/trend/" + slug);
  show("topicarchive"); setTab("trends");
  document.getElementById("ta-back-t").textContent = "بازگشت به بورس اخبار";
  document.getElementById("ta-back").onclick = showTrends;
  document.getElementById("ta-title").textContent = "جانِ ماجرا: " + (tp.name_fa || slug);
  const d = tp.dossier || {};
  document.getElementById("ta-sub").textContent =
    faN(d.development_count || tp.story_count || 0) + " تحول مستقل · " +
    faN(d.source_coverage || tp.coverage || 0) + " پوشش منبع";
  const ids = new Set(d.story_ids || []);
  const items = ALL.filter(s => ids.has(s.id) || (s.topics || []).some(x => x.slug === slug));
  const timeline = items.slice().sort((a,b) => String(b.published_at||"").localeCompare(String(a.published_at||"")));
  document.getElementById("ta-feed").innerHTML =
    `<div class="trend-dossier">
      <div class="rule"><span>جانِ ماجرا</span><span class="l"></span></div>
      <p class="kalam">${esc(d.summary_fa || "این پرونده از چند تحول خبری مستقل ساخته شده است.")}</p>
      ${d.why_now_fa ? `<div class="rule"><span>چرا الان مهم است؟</span><span class="l"></span></div><p class="kalam">${esc(d.why_now_fa)}</p>` : ""}
      <div class="trend-dossier-stats"><span><b>${faN(d.development_count || tp.story_count || 0)}</b> تحول مستقل</span><span><b>${faN(d.source_coverage || tp.coverage || 0)}</b> پوشش منبع</span>${tp.growth != null ? `<span><b>${faN(tp.growth)}٪</b> رشد</span>` : ""}</div>
      <div class="rule"><span>مسیر ماجرا</span><span class="l"></span></div>
    </div>` + groupedFeed(timeline);
}

function openTopic(slug) {
  setHash("#/topic/" + slug);
  show("topicarchive"); setTab("topics");
  document.getElementById("ta-back-t").textContent = "بازگشت به موضوعات";
  document.getElementById("ta-back").onclick = showTopics;
  const items = ALL.filter(s => (s.topics || []).some(t => t.slug === slug));
  const name = ((items[0] && items[0].topics.find(t => t.slug === slug)) || {}).name_fa || slug;
  document.getElementById("ta-title").textContent = "موضوع: " + name;
  document.getElementById("ta-sub").textContent = faN(items.length) + " خبر در این موضوع";
  document.getElementById("ta-feed").innerHTML = groupedFeed(items);
}

// pre-baked reference links (persian + english wikipedia + Grokipedia) so a
// reader can pick up context from multiple encyclopedias with different tones
// and compare — same "چند منبع، خودت مقایسه کن" ethos as the news layer.
function referenceStrip(ent) {
  if (!ent || !ent.refs) return "";
  const links = ent.refs.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">
    <span class="ref-src">${esc(r.src)}</span>${esc(r.label)}</a>`).join("");
  return `<div class="ref-strip">
    <div class="ref-hd"><b>پیش‌زمینه از چند مرجع</b> — روایت‌ها متفاوت است، خودتان مقایسه کنید.</div>
    <div class="ref-links">${links}</div></div>`;
}

// a figure's page: all their stories in one place (+ follow into "my feed")
async function openEntity(slug) {
  if (!ALL.length) return;
  const items = ALL.filter(s => (s.entities || []).some(e => e.slug === slug));
  const meta = items.flatMap(s => s.entities || []).find(e => e.slug === slug) || {};
  const name = meta.name_fa || slug;
  const canonical=await canonicalEntityByName(meta.kind==="body"?"organization":"person",name);
  if(canonical) return openCanonicalEntity(canonical.id);

  // Canonical identity: if this news entity is also a registered figure,
  // resolve the legacy /person route to that single profile.
  if (meta.kind !== "body") {
    try {
      const figures = await loadFigures();
      const linked = _figureForBookPerson({name_fa:name, aliases_fa:meta.aliases_fa||meta.aliases||[]}, figures);
      if (linked) return openFigure(linked.handle);
    } catch (_) {}
  }

  setHash("#/person/" + slug);
  show("topicarchive"); setTab("feed");
  document.getElementById("ta-back-t").textContent = "بازگشت به سرخط";
  document.getElementById("ta-back").onclick = showFeed;
  document.getElementById("ta-title").textContent = (meta.kind === "body" ? "نهاد: " : "چهره: ") + name;
  document.getElementById("ta-sub").textContent = faN(items.length) + " خبر مرتبط";
  document.getElementById("ta-feed").innerHTML =
    followBar("entities", slug, "خبرهای این چهره در «سرخط من» بیاید")
    + referenceStrip(meta) + groupedFeed(items);
}

function followBar(kind, id, note) {
  return `<div class="follow-bar">${followBtn(kind, id, "در حال دنبال‌کردن", "دنبال کن")}<span class="fb-note">${esc(note)}</span></div>`;
}
async function openSource(name) {
  if (!ALL.length) return;
  const entity=await canonicalEntityByName("source",name);
  if(entity) return showPress(entity.routes?.press_source||entity.name_fa,entity.id);
  const canonical = PRESS_SOURCES.find(s => [s.name,...(s.aliases||[])].includes(name));
  if (canonical) return showPress(canonical.name);

  setHash("#/source/" + encodeURIComponent(name));
  show("topicarchive"); setTab("feed");
  document.getElementById("ta-back-t").textContent = "بازگشت به سرخط";
  document.getElementById("ta-back").onclick = showFeed;
  const items = ALL.filter(s => (s.source_names || []).includes(name));
  document.getElementById("ta-title").textContent = "منبع: " + name;
  document.getElementById("ta-sub").textContent = faN(items.length) + " خبر از این منبع";
  document.getElementById("ta-feed").innerHTML = followBar("sources", name, "خبرهای این منبع در «سرخط من» بیاید") + groupedFeed(items);
}

/* ---- ایران — province map + scope classification ----
   نقشهٔ واقعیِ استان‌ها (choropleth): مسیرهای دقیق در iran-provinces.js
   (برگرفته از masoudnemati/iran-map با مجوز MIT). */
const PATHS = (typeof window !== "undefined" && window.IRAN_PATHS) || {};
const VIEWBOX = (typeof window !== "undefined" && window.IRAN_VIEWBOX) || "0 0 990 890";

let _iranScope = "all";
function showIran() { show("iran"); setTab("iran"); renderIran(); setHash("#/iran"); }
async function renderIran() {
  const el = document.getElementById("iran");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const geo = await getJSON(`${DATA}/geo.json`).catch(() => ({ provinces: {}, scope: {} }));
    const pc = geo.provinces || {};
    const max = Math.max(1, ...Object.values(pc));
    const paths = Object.entries(PATHS).map(([slug, p]) => {
      const n = pc[slug] || 0;
      const alpha = n ? (0.30 + 0.70 * (n / max)) : 0;
      const fill = n ? ` fill="rgba(26,157,126,${alpha.toFixed(3)})"` : "";
      const cls = "prov" + (n ? " has" : "");
      const tip = esc(p.fa) + (n ? ` — ${faN(n)} خبر` : "");
      return `<path d="${p.d}" class="${cls}"${fill} onclick="openProvince('${slug}')"><title>${tip}</title></path>`;
    }).join("");
    const sc = geo.scope || {};
    const total = (sc.local || 0) + (sc.national || 0) + (sc.international || 0);
    const scopes = [["all", "همه", total], ["local", "استانی", sc.local || 0],
      ["national", "کشوری", sc.national || 0], ["international", "بین‌المللی", sc.international || 0]];
    const provChips = Object.entries(PATHS).map(([slug, p]) => {
      const n = pc[slug] || 0, on = isF("provinces", slug);
      return `<button class="pfollow ${on ? "on" : ""}" onclick="hitProvFollow('${slug}',this)"><span class="pf-star">★</span>${esc(p.fa)}${n ? ` <span class="chip-n">${faN(n)}</span>` : ""}</button>`;
    }).join("");
    el.innerHTML = `
      <div class="iran-map">
        <svg viewBox="${VIEWBOX}" class="iran-svg" role="img" aria-label="نقشهٔ استان‌های ایران">${paths}</svg>
      </div>
      <p class="muted" style="text-align:center;margin:2px 0 12px">روی هر استان بزن تا خبرهایش را ببینی — رنگِ پررنگ‌تر یعنی خبرِ بیشتر.</p>
      <details class="prov-follow"><summary>دنبال‌کردنِ استان‌ها ★</summary>
        <p class="muted" style="margin:8px 0">استان‌هایی که دنبال کنی، خبرهایشان در «سرخط من» می‌آید (روی این دستگاه ذخیره می‌شود).</p>
        <div class="pfollow-grid">${provChips}</div></details>
      <div class="imp-filter" id="iran-scopes">${scopes.map(s => `<button class="fchip" data-s="${s[0]}" onclick="setIranScope('${s[0]}')">${s[1]}${s[2] ? ` <span class="chip-n">${faN(s[2])}</span>` : ""}</button>`).join("")}</div>
      <div id="iran-body"></div>`;
    setIranScope(_iranScope);
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">صفحهٔ ایران بارگذاری نشد</div></div>`; }
}
function setIranScope(s) {
  _iranScope = s;
  document.querySelectorAll("#iran-scopes .fchip").forEach(c => c.classList.toggle("on", c.dataset.s === s));
  const items = s === "all" ? ALL : ALL.filter(x => x.geo && x.geo.scope === s);
  document.getElementById("iran-body").innerHTML = groupedFeed(items);
}
function openProvince(slug) {
  if (!ALL.length) return;
  setHash("#/province/" + slug);
  show("topicarchive"); setTab("iran");
  document.getElementById("ta-back-t").textContent = "بازگشت به ایران";
  document.getElementById("ta-back").onclick = showIran;
  const items = ALL.filter(s => s.geo && (s.geo.provinces || []).some(p => p.slug === slug));
  const name = (PATHS[slug] || {}).fa || slug;
  document.getElementById("ta-title").textContent = "استان: " + name;
  document.getElementById("ta-sub").textContent = faN(items.length) + " خبر در این استان";
  document.getElementById("ta-feed").innerHTML = followBar("provinces", slug, "خبرهای این استان در «سرخط من» بیاید") + groupedFeed(items);
}
function hitProvFollow(slug, btn) {
  toggleF("provinces", slug);
  btn.classList.toggle("on", isF("provinces", slug));
  updateMineBadge();
}

const root = document.documentElement;
document.getElementById("theme").addEventListener("click", () => {
  const cur = root.getAttribute("data-theme"), sysDark = matchMedia("(prefers-color-scheme:dark)").matches;
  root.setAttribute("data-theme", (cur === "dark" || (!cur && sysDark)) ? "light" : "dark");
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

// freshness line: when the SYSTEM last checked, and how old the NEWEST story is
let META = null;
getJSON(`${DATA}/meta.json`).then(m => { META = m; updateFreshness(); }).catch(() => {});
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
const HOME_FIGURE_EXCLUDE=new Set(["mostafatajzadeh"]);
async function renderHomePeople(){
  const section=document.getElementById("home-people-strip");
  const el=document.getElementById("home-people-list");
  if(!section||!el) return;
  try{
    const d=await loadFigures();
    const figures=(d.figures||[])
      .filter(f=>f && f.avatar &&
        f.field!=="news" &&
        !String(f.handle||"").startsWith("news-") &&
        !HOME_FIGURE_EXCLUDE.has(String(f.handle||"").toLowerCase()))
      .map(f=>({
        ...f,
        _latest:(f.posts||[]).map(p=>String(p.published_at||"")).sort().slice(-1)[0]||""
      }))
      .sort((a,b)=>String(b._latest).localeCompare(String(a._latest)))
      // The five newest figures already appear in the vertical "latest statements"
      // panel below. Skip them here so the horizontal strip adds different faces.
      .slice(5,19);
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
      .sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));
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

// Market (showMarket/renderMarket + converter) and weather/air-quality
// (showWeather/renderWeather/renderHomeWeather + helpers) now live in
// market-weather.js, loaded before this file.

// Charts (svgSpark/svgBars/_pts), the follow/save store (FOLLOW, isF,
// followBtn, saveBtn...) and the home stats block now live in
// charts-social.js, loaded before this file.

const _initialRoute = (location.hash || "").replace(/^#\/?/, "");
const _isDeepLink = Boolean(_initialRoute);
if (_isDeepLink) {
  const feedView = document.getElementById("feed-view");
  if (feedView) feedView.style.display = "none";
  setTab("");
}

function _bootReveal(){
  if (window.__routeBootTimer) clearTimeout(window.__routeBootTimer);
  document.documentElement.classList.remove("route-boot");
}

if (_isDeepLink) {
  // Route the requested destination immediately. Most deep-link views
  // (figures, videos, books, press, knowledge, etc.) do not need stories.json.
  // Load the news feed independently so a slow feed can never block navigation.
  Promise.resolve(route()).finally(_bootReveal);
  loadFeed(false).catch(()=>{});
} else {
  loadFeed(true).finally(_bootReveal);
  renderHomeStats();
  renderHomeGlance();
  renderHomePrices();
  renderHomeWeather();
  renderHomePeople();
}
updateMineBadge();


/* ---- جان کلام — commentators' views, kept apart from the facts ----
   Data: story.figures (matched per story) + data/figures.json (all figures).
   A view is always attributed to its author and linked to the original post. */
const KIND_NOTE = { party_claim: "ادعای یکی از طرفین" };
const SOCIAL_ICON = {
  telegram: '<path d="M21.5 4.5 2.5 11.8l5 1.6 1.9 5.6 2.7-3 4.5 3.3z" stroke-linejoin="round"/>',
  bale: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8 8h5a3 3 0 0 1 0 6H8zm0 6h6a3 3 0 0 1 0 6" stroke-linejoin="round"/>',
  x: '<path d="M4 4l16 16M20 4L4 20" stroke-linecap="round"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
  diner: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
  github: '<path d="M9 19c-4 1.2-4-2-5-2m10 4v-3.5c0-1 .1-1.7-.5-2.3 2.8-.3 5.7-1.4 5.7-6.2 0-1.4-.5-2.5-1.3-3.4.1-.3.6-1.6-.1-3.3 0 0-1.1-.3-3.6 1.3a12.3 12.3 0 0 0-6.4 0C5.3 2 4.2 2.3 4.2 2.3c-.7 1.7-.2 3-.1 3.3A4.8 4.8 0 0 0 2.8 9c0 4.8 2.9 5.9 5.7 6.2-.4.4-.6 1-.6 2V21"/>',
  youtube: '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M11 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M14 8h2V5h-2a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h2.2l.4-3H14V8.5a.5.5 0 0 1 .5-.5z" stroke-linejoin="round"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9S14.5 18.5 12 21c-2.5-2.5-3.5-6-3.5-9S9.5 5.5 12 3z"/>',
  podcast: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/>',
  truthsocial: '<path d="M6 5h12M12 5v14M7.5 10.5h9" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/>',
};
function avatar(p, cls) {
  if (p.avatar) return `<img class="fig-avatar ${cls || ""}" src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.classList.add('broken')">`;
  const ini = (p.name_fa || "?").trim().charAt(0);
  return `<span class="fig-avatar ${cls || ""} ini">${esc(ini)}</span>`;
}
function socialLinks(links) {
  if (!links || !links.length) return "";
  return `<div class="fig-social">${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.label)}" aria-label="${esc(l.label)}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${SOCIAL_ICON[l.kind] || SOCIAL_ICON.website}</svg><span>${esc(l.label)}</span></a>`).join("")}</div>`;
}
(function () {
  const st = document.createElement("style");
  st.textContent = `.figure-timeline{display:flex;flex-direction:column;gap:12px;margin:8px 0 24px}
.home-fig-card{padding:16px 18px;border:1px solid rgba(143,168,155,.22);border-radius:14px;background:rgba(26,157,126,.035)}
.home-fig-card:hover{border-color:rgba(26,157,126,.5)}
.home-fig-topic{font-size:17px;line-height:1.6;margin:10px 0 3px}
.home-fig-card .kalam{margin:0 0 10px;line-height:1.9}
.home-fig-card .fig-foot{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.fig-profile-link{border:0;background:none;padding:0;color:#1a9d7e;font:inherit;cursor:pointer}
.fig-profile-link:hover{text-decoration:underline}
.fig-tl-controls{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 12px}
.fig-tl-controls .imp-filter{margin:0}
.fig-field-select{font:inherit;color:inherit;background:transparent;border:1px solid rgba(143,168,155,.35);border-radius:999px;padding:6px 12px}
.fig-follow{font:inherit;font-size:12px;border:1px solid rgba(143,168,155,.35);border-radius:999px;background:transparent;color:#8fa89b;padding:4px 9px;cursor:pointer;white-space:nowrap}
.fig-follow.on{color:#e0b341;border-color:rgba(224,179,65,.5);background:rgba(224,179,65,.08)}
.fig-follow.compact{font-size:11px;padding:3px 7px}
.news-statement-tag{display:inline-block;margin:9px 0 0;font-size:12px;color:#8fa89b;background:rgba(143,168,155,.10);border-radius:999px;padding:3px 9px}
.fig-source-stats{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:7px 0 10px;font-size:13px;color:#8fa89b}
.fig-source-stats b{color:var(--text)}
.fig-profile-filters{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 16px}
.identity-verified,.profile-verified{display:inline-flex;align-items:center;justify-content:center;margin-inline-start:7px;color:#1677ff;font-size:.78em;font-weight:800;vertical-align:middle}
.identity-claimed,.profile-claimed{display:inline-block;margin-inline-start:8px;color:#6f7c75;font-size:12px;font-weight:500}
.profile-claimed{display:block;margin:4px 0 7px;color:#6f7c75}
.canonical-head b{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.figure-profile-search{position:relative;padding:12px 16px 4px;border-bottom:1px solid rgba(143,168,155,.16)}
.figure-profile-search-box{display:flex;align-items:center;gap:8px;border:1px solid rgba(143,168,155,.28);border-radius:999px;padding:8px 12px;background:rgba(143,168,155,.04)}
.figure-profile-search-box input{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit}
.figure-profile-search-box input::placeholder{color:#8fa89b}
.figure-profile-search-results{display:none;position:absolute;z-index:30;top:58px;right:16px;left:16px;background:var(--card,#fff);border:1px solid rgba(143,168,155,.24);border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.12);overflow:hidden;max-height:390px;overflow-y:auto}
.figure-search-hit{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;border-bottom:1px solid rgba(143,168,155,.12);background:transparent;color:inherit;text-align:right;cursor:pointer}
.figure-search-hit:hover{background:rgba(26,157,126,.06)}
.figure-search-hit span{display:flex;flex-direction:column;min-width:0}
.figure-search-hit b{display:flex;align-items:center;gap:4px}
.figure-search-hit small{color:#8fa89b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.figure-search-empty{padding:14px;color:#8fa89b;text-align:center}
.figure-youtube{padding:16px}.figure-youtube-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.figure-youtube-card{display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(143,168,155,.18);border-radius:14px;background:rgba(143,168,155,.035);color:inherit;text-decoration:none}.figure-youtube-thumb{position:relative;display:block;aspect-ratio:16/9;background:#111;overflow:hidden}.figure-youtube-thumb img{width:100%;height:100%;object-fit:cover;display:block}.figure-youtube-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:44px;height:32px;border-radius:9px;background:#ff0033;color:#fff;font-size:16px}.figure-youtube-body{display:flex;flex-direction:column;gap:5px;padding:10px 12px}.figure-youtube-body b{font-size:14px;line-height:1.55}.figure-youtube-body small{font-size:11.5px;color:#8fa89b}.latest-videos-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin:8px 0 22px}.latest-videos-head h1{margin:4px 0 6px}.latest-videos-head p{margin:0;max-width:720px;color:#8fa89b;line-height:1.8}.latest-videos-stats{display:flex;gap:8px;flex-wrap:wrap}.latest-videos-stats span,.latest-videos-stats button{border:1px solid rgba(143,168,155,.22);border-radius:999px;padding:7px 11px;font:inherit;font-size:12px;background:transparent;color:inherit}.latest-videos-stats button{cursor:pointer}.latest-videos-stats button.on{border-color:rgba(26,157,126,.48);background:rgba(26,157,126,.10);color:#1a9d7e}.latest-videos-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.latest-video-card{overflow:hidden;border:1px solid rgba(143,168,155,.18);border-radius:14px;background:rgba(143,168,155,.035)}.latest-video-main{display:block;color:inherit;text-decoration:none}.latest-video-copy{display:flex;flex-direction:column;gap:5px;padding:10px 12px}.latest-video-copy b{font-size:14px;line-height:1.6}.latest-video-copy small{font-size:11.5px;color:#8fa89b}.latest-video-people{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 11px}.latest-video-people button{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(143,168,155,.2);border-radius:999px;background:transparent;color:inherit;padding:4px 8px;font:inherit;font-size:11.5px;cursor:pointer}.latest-video-people img{width:20px;height:20px;border-radius:50%;object-fit:cover}.latest-video-actions{padding:0 10px 12px}.latest-video-actions button,.video-recap-btn{width:100%;border:1px solid rgba(26,157,126,.35);background:rgba(26,157,126,.08);color:#1a9d7e;border-radius:10px;padding:8px 10px;font:inherit;cursor:pointer}.figure-youtube-card>a{color:inherit;text-decoration:none}.video-recap-btn{margin:0 10px 10px;width:calc(100% - 20px)}.youtube-recap-embed{position:relative;width:100%;aspect-ratio:16/9;margin:18px 0 22px;border-radius:16px;overflow:hidden;background:#090b0a;border:1px solid rgba(143,168,155,.16)}.youtube-recap-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.video-statement-recap{font-size:17px;line-height:2.05;margin-top:18px}.video-statement-recap p{margin:0 0 1.2em}.video-statement-points{margin:18px 0;padding:16px 18px;border:1px solid rgba(143,168,155,.18);border-radius:14px;background:rgba(143,168,155,.035)}.video-statement-points h3{margin:0 0 10px}.video-statement-points li{line-height:1.85;margin:6px 0}.studio-recap-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.studio-recap-card{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid rgba(143,168,155,.18);border-radius:16px;background:rgba(143,168,155,.035)}.studio-recap-card h2{font-size:17px;line-height:1.65;margin:0}.studio-recap-card p{margin:0;color:#8fa89b;line-height:1.75}.studio-recap-card-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#8fa89b}.studio-recap-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}.studio-recap-card-actions button,.studio-recap-card-actions a,.studio-recap-toolbar button,.studio-recap-toolbar a{border:1px solid rgba(143,168,155,.22);border-radius:10px;background:transparent;color:inherit;padding:8px 11px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none}.studio-recap-card-actions .primary,.studio-recap-toolbar .primary{border-color:rgba(26,157,126,.4);background:rgba(26,157,126,.09);color:#1a9d7e}.studio-recap-article{max-width:860px;margin:0 auto;padding:6px 0 36px}.studio-recap-article h1{line-height:1.45;margin:12px 0 8px}.studio-recap-byline{color:#8fa89b;line-height:1.8}.studio-recap-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 24px}.studio-recap-body{font-size:18px;line-height:2.08}.studio-recap-body p{margin:0 0 1.35em}.studio-recap-body h2{margin:2.1em 0 .7em;font-size:22px}.studio-recap-notice{padding:11px 13px;border:1px solid rgba(143,168,155,.16);border-radius:12px;color:#8fa89b;font-size:12px;line-height:1.8}.studio-queue-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:16px 0}.studio-queue-filters{display:flex;gap:7px;flex-wrap:wrap}.studio-queue-filters button{border:1px solid rgba(143,168,155,.22);border-radius:999px;background:transparent;color:inherit;padding:7px 11px;font:inherit;font-size:12px;cursor:pointer}.studio-queue-filters button.on{border-color:rgba(26,157,126,.42);background:rgba(26,157,126,.09);color:#1a9d7e}.studio-recap-card.done{opacity:.62}.studio-recorded{display:inline-flex;align-items:center;gap:5px;color:#1a9d7e}.studio-reader-nav{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin:24px 0}.studio-reader-nav button{border:1px solid rgba(143,168,155,.22);border-radius:10px;background:transparent;color:inherit;padding:9px 12px;font:inherit;cursor:pointer}.studio-font-tools{display:flex;gap:6px;align-items:center}.studio-font-tools button{min-width:38px}.studio-recap-article.recorded .press-kicker:after{content:" · ضبط شد ✓";color:#1a9d7e}.studio-recap-body{font-size:var(--studio-font-size,18px)}.latest-video-actions .studio-mark{min-width:38px;padding-inline:10px;font-size:18px;font-weight:700}.latest-video-actions .studio-mark.ready{font-size:19px}.latest-video-actions .studio-mark.request{opacity:.82}.finance-wrap{max-width:1100px;margin:0 auto;padding-bottom:40px}.finance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.finance-metric{padding:15px;border:1px solid rgba(143,168,155,.18);border-radius:15px;background:rgba(143,168,155,.035)}.finance-metric span{display:block;color:#8fa89b;font-size:12px}.finance-metric b{display:block;font-size:24px;margin-top:5px}.finance-metric small{display:block;color:#8fa89b;margin-top:4px;line-height:1.6}.finance-note{padding:13px 15px;border:1px solid rgba(143,168,155,.18);border-radius:14px;line-height:1.9;color:#8fa89b;margin:14px 0}.finance-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}.finance-table th,.finance-table td{padding:10px 8px;border-bottom:1px solid rgba(143,168,155,.14);text-align:right;vertical-align:top}.finance-table th{color:#8fa89b;font-weight:500}.finance-video-title{display:block;max-width:430px}.finance-video-title b{display:block;color:inherit}.finance-video-title small{color:#8fa89b}.finance-money{direction:ltr;display:inline-block}.finance-empty{padding:28px;text-align:center;color:#8fa89b;border:1px dashed rgba(143,168,155,.18);border-radius:14px}@media(max-width:900px){.finance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.finance-grid{grid-template-columns:1fr}.finance-table{display:block;overflow-x:auto;white-space:nowrap}}
@media(max-width:900px){.latest-videos-grid,.studio-recap-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.figure-youtube{padding:12px}.figure-youtube-grid,.latest-videos-grid,.studio-recap-list{grid-template-columns:1fr}.home-fig-card{padding:14px}.home-fig-card .v-h{align-items:flex-start}.home-fig-card .muted{font-size:11px}}`;
  document.head.appendChild(st);
})();

// Figure cards, the figure follow store, the home figures timeline and
// figuresSection() now live in figures-core.js, loaded before this file.
let _figDirectoryMode = "direct";
async function loadCuratedPoems(){ if(_CURATED_POEMS) return _CURATED_POEMS; try{_CURATED_POEMS=await getJSON(`${DATA}/curated-figure-poems.json`);}catch(_){_CURATED_POEMS={};} return _CURATED_POEMS||{}; }
const _LOCAL_FIGURE_FALLBACKS = [
  {
    handle: "nima-afshar-naderi",
    name_fa: "نیما افشارنادری",
    role_fa: "تولیدکننده محتوا و میزبان «جان کلام»",
    field: "media",
    field_fa: "رسانه و تحلیل",
    gender: "m",
    external: true,
    verified: true,
    claimed: true,
    avatar: "https://pbs.twimg.com/profile_images/2094137144591933440/SIBK8HjF_400x400.jpg",
    channel_url: "",
    count: 0,
    posts: [],
    social: [
      {kind:"x", label:"ایکس", url:"https://x.com/nimania"},
      {kind:"instagram", label:"اینستاگرام", url:"https://www.instagram.com/nima.afsharnaderi/"},
      {kind:"youtube", label:"یوتیوب", url:"https://www.youtube.com/channel/UCYDOVO7EpX3QNEf9Ddk1-AQ"},
      {kind:"telegram", label:"تلگرام", url:"https://t.me/nimaafsharnaderi"},
      {kind:"website", label:"گروکی‌پدیا", url:"https://grokipedia.com/page/nima-afshar-naderi"}
    ]
  }
];
async function loadFigures() {
  if (_FIG) return _FIG;
  try { _FIG = await getJSON(`${DATA}/figures.json`); } catch (e) { _FIG = { figures: [], fields: {} }; }
  _FIG.figures = Array.isArray(_FIG.figures) ? _FIG.figures : [];
  for (const fallback of _LOCAL_FIGURE_FALLBACKS) {
    if (!_FIG.figures.some(f => String(f.handle||"").toLowerCase() === fallback.handle)) {
      _FIG.figures.push(fallback);
    }
  }
  return _FIG;
}
async function loadStudioRecaps() {
  if (_STUDIO_RECAPS) return _STUDIO_RECAPS;
  try {
    const rows = await getJSON(`${DATA}/studio-recaps.json`);
    _STUDIO_RECAPS = Array.isArray(rows) ? rows : [];
  } catch (_) {
    _STUDIO_RECAPS = [];
  }
  return _STUDIO_RECAPS;
}

async function loadProjectFinance() {
  try {
    _PROJECT_FINANCE = await getJSON(`${DATA}/project-finance.json?v=${Date.now()}`);
    return (_PROJECT_FINANCE && typeof _PROJECT_FINANCE === "object") ? _PROJECT_FINANCE : {};
  } catch (_) {
    return {};
  }
}

async function loadNewsPeople() {
  if (_NEWS_PEOPLE) return _NEWS_PEOPLE;
  try { _NEWS_PEOPLE = await getJSON(`${DATA}/news-people.json`); } catch (e) { _NEWS_PEOPLE = { figures: [], fields: {} }; }
  return _NEWS_PEOPLE;
}
function setFigureDirectoryMode(mode) {
  _figDirectoryMode = mode;
  renderFigures();
}

function _sysNum(v) {
  return Number.isFinite(Number(v)) ? faN(Number(v).toLocaleString("en-US")) : "—";
}
function _sysTime(iso) {
  if (!iso) return "نامشخص";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "نامشخص";
    return d.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
  } catch (_) { return "نامشخص"; }
}
function _sysState(state) {
  const s = String(state || "").toLowerCase();
  if (["active","ok","success","healthy"].includes(s)) return ["سالم","ok"];
  if (["error","failed","failure"].includes(s)) return ["خطا","bad"];
  if (["empty","warning","warn"].includes(s)) return ["هشدار","warn"];
  if (["pending","unknown"].includes(s)) return ["در انتظار","muted"];
  return [state || "نامشخص","muted"];
}
function _sysMetric(label, value, sub, cls) {
  return '<article class="sys-metric '+(cls||'')+'"><span>'+esc(label)+'</span><b>'+_sysNum(value)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</article>';
}

// Entity QA / merge console (loadEntityQA, the _qa*/qa* draft editor,
// showEntityQA, renderEntityQA) now lives in entity-qa.js, loaded before
// this file.

function showSystem() {
  show("system"); setTab(""); setHash("#/system"); renderSystem();
}
async function renderSystem() {
  const el = document.getElementById("system-content");
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';
  const safe = async (name, fallback) => {
    try { return await getJSON(`${DATA}/${name}`, 20000); } catch (_) { return fallback; }
  };
  const [health, stats, meta, pressHealth, tv, weather, periodicals, entityRegistry] = await Promise.all([
    safe("system-health.json", null),
    safe("stats.json", {}),
    safe("meta.json", {}),
    safe("press-registry-health.json", []),
    safe("tv-guide.json", {}),
    safe("weather.json", []),
    safe("periodicals.json", []),
    safe("entity-registry.json", {})
  ]);

  const hc = (health && health.counts) || {};
  const thresholds = (health && health.thresholds) || {};
  const github = (health && health.github) || {};
  const total = hc.total_news ?? stats.total;
  const feedStories = hc.feed_stories ?? meta.count;
  const figures = hc.figures;
  const statements = hc.statements;
  const majra = hc.majra_topics;
  const books = hc.books;
  const h24 = stats?.rolling?.h24;
  const today = stats?.calendar?.today;
  const yesterday = stats?.calendar?.yesterday;

  const pressRows = Array.isArray(pressHealth) ? pressHealth : [];
  const pressCounts = pressRows.reduce((m, row) => {
    const k = String(row?.state || "unknown");
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});
  const pressIssues = pressRows
    .filter(x => !["active"].includes(String(x?.state || "")))
    .sort((a,b) => String(a?.state||"").localeCompare(String(b?.state||"")))
    .slice(0, 20);

  const tvSources = Array.isArray(tv?.sources) ? tv.sources.length : Object.keys(tv?.source_stats || {}).length;
  const tvChannels = Array.isArray(tv?.channels) ? tv.channels.length : 0;
  const tvPrograms = Array.isArray(tv?.programmes) ? tv.programmes.length : 0;
  const tvErrors = tv?.source_errors && typeof tv.source_errors === "object"
    ? Object.entries(tv.source_errors)
    : [];
  const periodicalCount = Array.isArray(periodicals) ? periodicals.length : (hc.periodicals_rows || 0);
  const weatherCount = Array.isArray(weather) ? weather.length : 0;
  const erCounts = entityRegistry?.counts || {};
  const canonicalEntities = hc.canonical_entities ?? erCounts.total;
  const canonicalPeople = hc.canonical_people ?? erCounts.person;
  const entityConflicts = hc.entity_conflicts ?? (Array.isArray(entityRegistry?.conflicts) ? entityRegistry.conflicts.length : 0);

  const gateOk = health ? health.ok === true : null;
  const gateLabel = gateOk === true ? "نسخهٔ منتشرشده سالم است" : gateOk === false ? "گیت انتشار خطا دارد" : "گزارش گیت پیدا نشد";
  const gateCls = gateOk === true ? "ok" : gateOk === false ? "bad" : "warn";
  const runUrl = github.repository && github.run_id
    ? `https://github.com/${github.repository}/actions/runs/${github.run_id}`
    : "";

  const metrics = [
    _sysMetric("کل خبرهای منتشرشده", total, "آرشیو اصلی", Number(total)>=10000?"ok":"bad"),
    _sysMetric("۲۴ ساعت اخیر", h24, "خبر", ""),
    _sysMetric("امروز", today, "خبر", ""),
    _sysMetric("دیروز", yesterday, "خبر", ""),
    _sysMetric("چهره‌ها", figures, "پروفایل canonical", ""),
    _sysMetric("گفته‌ها", statements, "پست و نقل‌قول", ""),
    _sysMetric("کتاب‌ها", books, "رکورد", ""),
    _sysMetric("هویت‌های canonical", canonicalEntities, `${canonicalPeople||0} نفر · ${entityConflicts||0} تعارض`, entityConflicts?"warn":"ok"),
    _sysMetric("جان ماجرا", majra, "داده محفوظ؛ فعلاً خارج از Home", ""),
    _sysMetric("جراید", periodicalCount, "مطلب", ""),
    _sysMetric("منابع جراید", pressRows.length, `${pressCounts.active||0} فعال`, ""),
    _sysMetric("شبکه‌های TV Guide", tvChannels, `${tvSources} منبع`, ""),
    _sysMetric("برنامه‌های TV Guide", tvPrograms, `${tvErrors.length} خطای منبع`, tvErrors.length?"warn":"")
  ].join("");

  const pressIssueHtml = pressIssues.length ? pressIssues.map(row => {
    const [lbl, cls] = _sysState(row.state);
    return `<div class="sys-source-row"><div><b>${esc(row.source_name||"منبع")}</b><small>${esc(row.last_error||row.method||"")}</small></div><span class="sys-pill ${cls}">${esc(lbl)}</span></div>`;
  }).join("") : '<div class="sys-empty">همهٔ منابع ثبت‌شده در وضعیت فعال‌اند.</div>';

  const tvErrorHtml = tvErrors.length ? tvErrors.slice(0,20).map(([name,msg]) =>
    `<div class="sys-source-row"><div><b>${esc(name)}</b><small>${esc(typeof msg==="string"?msg:JSON.stringify(msg))}</small></div><span class="sys-pill bad">خطا</span></div>`
  ).join("") : '<div class="sys-empty">خطای منبعی در خروجی فعلی TV Guide ثبت نشده است.</div>';

  const thresholdLabels = {
    total_news:"کل خبرها", feed_stories:"فید اصلی", figures:"چهره‌ها",
    statements:"گفته‌ها", majra_topics:"جان ماجرا", books:"کتاب‌ها"
  };
  const thresholdHtml = Object.entries(thresholds).map(([k,v]) => {
    const current = hc[k];
    const pass = Number(current) >= Number(v);
    return `<div class="sys-th-row"><span>${esc(thresholdLabels[k]||k)}</span><b>${_sysNum(current)}</b><small>حداقل ${_sysNum(v)}</small><span class="sys-pill ${pass?"ok":"bad"}">${pass?"قبول":"رد"}</span></div>`;
  }).join("") || '<div class="sys-empty">آستانه‌ها در این نسخه ثبت نشده‌اند.</div>';

  el.innerHTML = `
    <section class="sys-hero ${gateCls}">
      <div><span class="home-eyebrow">آخرین نسخهٔ منتشرشده</span><h2>${esc(gateLabel)}</h2>
        <p>این صفحه سلامت آخرین نسخه‌ای را نشان می‌دهد که اجازهٔ انتشار گرفته؛ build ردشده جای نسخهٔ سالم را نمی‌گیرد.</p></div>
      <div class="sys-gate"><span class="sys-dot"></span><b>${gateOk===true?"PASS":gateOk===false?"BLOCKED":"UNKNOWN"}</b></div>
    </section>
    <div class="sys-grid">${metrics}</div>\n    <div class="sys-admin-actions"><button onclick="showEntityQA()">Entity QA / Merge Console</button><span>بررسی duplicateها، aliasها و overrideهای canonical</span></div>

    <div class="sys-two">
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Freshness</span><h3>تازه‌بودن داده‌ها</h3></div></div>
        <div class="sys-detail-row"><span>آخرین گیت انتشار</span><b>${_sysTime(health?.checked_at)}</b></div>
        <div class="sys-detail-row"><span>آخرین تولید خبر</span><b>${_sysTime(meta?.built_iso)}</b></div>
        <div class="sys-detail-row"><span>آخرین TV Guide</span><b>${_sysTime(tv?.generated_at)}</b></div>
        <div class="sys-detail-row"><span>شهرهای آب‌وهوا</span><b>${_sysNum(weatherCount)}</b></div>
        <div class="sys-detail-row"><span>فید صفحهٔ اول</span><b>${_sysNum(feedStories)}</b></div>
      </section>
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Deploy</span><h3>نسخه و اجرای GitHub</h3></div></div>
        <div class="sys-detail-row"><span>Workflow</span><b>${esc(github.workflow||"—")}</b></div>
        <div class="sys-detail-row"><span>Run ID</span><b>${esc(github.run_id||"—")}</b></div>
        <div class="sys-detail-row"><span>Commit</span><code>${esc((github.sha||"—").slice(0,12))}</code></div>
        <div class="sys-detail-row"><span>Repository</span><b>${esc(github.repository||"—")}</b></div>
        ${runUrl?`<a class="sys-run-link" href="${esc(runUrl)}" target="_blank" rel="noopener">باز کردن GitHub Actions ↗</a>`:""}
      </section>
    </div>

    <div class="sys-two">
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Press</span><h3>سلامت منابع جراید</h3></div>
          <span class="sys-mini">${_sysNum(pressCounts.active||0)} فعال · ${_sysNum(pressIssues.length)} نیازمند بررسی</span></div>
        <div class="sys-source-list">${pressIssueHtml}</div>
      </section>
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">EPG</span><h3>سلامت TV Guide</h3></div>
          <span class="sys-mini">${_sysNum(tvChannels)} شبکه · ${_sysNum(tvPrograms)} برنامه</span></div>
        <div class="sys-source-list">${tvErrorHtml}</div>
      </section>
    </div>

    <section class="sys-panel">
      <div class="sys-panel-head"><div><span class="home-eyebrow">Integrity Gate</span><h3>آستانه‌های جلوگیری از انتشار خراب</h3></div>
        <span class="sys-mini">افت کل خبرها بیش از ${health?.max_total_drop!=null?faN(Math.round(health.max_total_drop*100))+"٪":"۲۰٪"} نیز deploy را می‌بندد</span></div>
      <div class="sys-thresholds">${thresholdHtml}</div>
      ${(health?.errors||[]).length?`<div class="sys-errors">${health.errors.map(e=>`<div>${esc(e)}</div>`).join("")}</div>`:""}
    </section>
  `;
}

function showTech() {
  show("tech"); setTab(""); setHash("#/tech");
  const el = document.getElementById("tech-content");
  el.innerHTML = `
    <div class="tech-grid">
      <article class="tech-card"><h2>رابط فارسی و RTL</h2><p>کامپوننت‌های رابط با الگوهای بومیِ راست‌چین طراحی شده‌اند؛ کارت، آمار، آواتار، تب‌ها، نشان‌ها، خط زمان، حالت خالی و بارگذاری.</p><div class="tech-tags"><span class="tech-tag">Card</span><span class="tech-tag">Stat</span><span class="tech-tag">Avatar</span><span class="tech-tag">Tabs</span><span class="tech-tag">Badge</span></div></article>
      <article class="tech-card"><h2>VibeFarsi UI</h2><p>برای زبان بصری و رفتار کامپوننت‌های فارسی از VibeFarsi الهام گرفته‌ایم. پندار فعلاً پروژهٔ React/Tailwind نیست؛ بنابراین الگوها در CSS/JavaScript موجود بازپیاده‌سازی شده‌اند و خود کتابخانه dependency اجرایی سایت نیست.</p><div class="tech-tags"><a class="tech-tag" href="https://vibefarsi.ir/" target="_blank" rel="noopener">vibefarsi.ir ↗</a></div></article>
      <article class="tech-card"><h2>خبر و تحلیل</h2><p>Backend پایتون خبرها را دریافت، خوشه‌بندی، رتبه‌بندی و برای خروجی استاتیک آماده می‌کند. واقعیت خبر، تحلیل رسانه و دیدگاه اشخاص در لایه‌های جدا نگهداری می‌شوند.</p><div class="tech-tags"><span class="tech-tag">Python</span><span class="tech-tag">SQLAlchemy</span><span class="tech-tag">JSON</span></div></article>
      <article class="tech-card"><h2>انتشار استاتیک</h2><p>خروجی نهایی HTML/CSS/JavaScript است و با GitHub Actions ساخته و روی GitHub Pages منتشر می‌شود؛ بنابراین خواندن سایت به سرور اپلیکیشن دائمی وابسته نیست.</p><div class="tech-tags"><span class="tech-tag">GitHub Actions</span><span class="tech-tag">GitHub Pages</span><span class="tech-tag">PWA</span></div></article>
    </div>
    <div class="rule"><span>نقشهٔ فناوری</span><span class="l"></span></div>
    <div class="tech-stack">
      <div class="tech-row"><b>جمع‌آوری</b><span>منابع خبری، منابع عمومی چهره‌ها و داده‌های مکمل</span></div>
      <div class="tech-row"><b>پردازش</b><span>Python · خوشه‌بندی خبر · استخراج گفته‌ها · رتبه‌بندی و synthesis</span></div>
      <div class="tech-row"><b>داده</b><span>SQLAlchemy و خروجی‌های JSON برای رابط استاتیک</span></div>
      <div class="tech-row"><b>رابط</b><span>HTML + Vanilla JavaScript + CSS؛ فارسی و RTL از ابتدا</span></div>
      <div class="tech-row"><b>طراحی</b><span>Design tokens داخلی پندار + الگوهای سازگارشده از VibeFarsi UI</span></div>
      <div class="tech-row"><b>انتشار</b><span>GitHub Actions → GitHub Pages</span></div>
    </div>
    <div class="rule"><span>VibeFarsi کجا اثر گذاشته؟</span><span class="l"></span></div>
    <div class="tech-card"><p>در بازطراحی تدریجی پندار، الگوهای Card و Stat برای خلاصه‌ها و اعداد، Avatar برای چهره‌ها، Segmented Control/Tabs برای فیلترها، Badge برای وضعیت‌ها، Timeline برای زنجیرهٔ رویداد و Skeleton/Empty State برای وضعیت‌های بارگذاری و نبود داده مبنا قرار می‌گیرند. این تطبیق مرحله‌ای است تا معماری سبک فعلی حفظ شود.</p></div>
  `;
}
function showFigures() {
  show("figures"); setTab("");
  document.title="چهره‌ها | پندار";
  document.getElementById("figures-lede").style.display = "";
  document.getElementById("figures").innerHTML = "";
  // A previous visit can leave timeline filters in local page state.  The
  // /figures route itself must always open on a useful default instead of an
  // apparently broken empty filtered view.
  _figTimelineMode = "all";
  _figTimelineField = "all";
  renderFigureTimeline();
  setHash("#/figures");
}
function renderFiguresDirectory() {
  document.getElementById("figure-timeline").innerHTML = "";
  _figDirectoryMode = "direct";
  renderFigures();
}
function _studioRecapBodyHtml(text) {
  const parts = String(text || "").split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  return parts.map(p => {
    const plain = p.replace(/^#+\s*/, "").trim();
    if (/^جان کلام[：:]?$/.test(plain)) return '<h2>جان کلام</h2>';
    if (/^#{1,3}\s+/.test(p)) return '<h2>'+esc(plain)+'</h2>';
    return '<p>'+esc(p).replace(/\n/g,"<br>")+'</p>';
  }).join("");
}
async function copyStudioRecap(id, btn) {
  const rows=await loadStudioRecaps();
  const row=rows.find(x=>String(x.id)===String(id));
  if(!row) return;
  try {
    await navigator.clipboard.writeText(String(row.studio_recap_fa||""));
    if(btn){const old=btn.textContent;btn.textContent="کپی شد ✓";setTimeout(()=>{btn.textContent=old},1600);}
  } catch (_) {
    if(btn) btn.textContent="کپی نشد";
  }
}
function _financeNum(v){const n=Number(v||0);return faN(n.toLocaleString("en-US"))}
function _financeUsd(v){const n=Number(v||0);return "$"+n.toFixed(n<0.01?4:2)}
async function showProjectFinance(){
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const d=await loadProjectFinance();
  const t=d.totals||{}, rows=Array.isArray(d.videos)?d.videos:[];
  const videos=Number(t.videos_seen_by_ai||0);
  const per100=videos>0?(Number(t.estimated_paid_usd||0)/videos)*100:0;
  document.title="مالی پروژه | پندار";
  setHash("#/finance");
  el.innerHTML=`<div class="finance-wrap">
    <div class="latest-videos-head">
      <button class="back" onclick="showStudioRecaps()">بازگشت به استودیو</button>
      <div><span class="press-kicker">پندار · حسابداری پروژه</span><h1>مالی پروژه</h1>
      <p>مصرف API و هزینهٔ برآوردی پردازش ویدئوها از زمان فعال شدن ثبت مالی.</p></div>
    </div>
    <div class="finance-grid">
      <article class="finance-metric"><span>ویدئوهای پردازش‌شده</span><b>${_financeNum(videos)}</b><small>ویدئوهایی که AI برایشان مصرف ثبت کرده</small></article>
      <article class="finance-metric"><span>فراخوانی Gemini</span><b>${_financeNum(t.ai_calls||0)}</b><small>${_financeNum(t.total_tokens||0)} توکن کل</small></article>
      <article class="finance-metric"><span>هزینهٔ مرجع AI</span><b class="finance-money">${_financeUsd(t.estimated_paid_usd||0)}</b><small>برآورد Paid Tier؛ الزاماً مبلغ صورتحساب نیست</small></article>
      <article class="finance-metric"><span>برآورد ۱۰۰ ویدئو</span><b class="finance-money">${videos?_financeUsd(per100):"—"}</b><small>بر اساس میانگین مصرف واقعی ثبت‌شده</small></article>
      <article class="finance-metric"><span>Input tokens</span><b>${_financeNum(t.prompt_tokens||0)}</b><small>توکن‌های ورودی Gemini</small></article>
      <article class="finance-metric"><span>Output tokens</span><b>${_financeNum(t.completion_tokens||0)}</b><small>توکن‌های خروجی Gemini</small></article>
      <article class="finance-metric"><span>DownSub requests</span><b>${_financeNum(t.downsub_requests||0)}</b><small>${_financeNum(t.downsub_http_200||0)} پاسخ HTTP 200</small></article>
      <article class="finance-metric"><span>AI بدون نرخ شناخته‌شده</span><b>${_financeNum(t.unpriced_ai_calls||0)}</b><small>برای این درخواست‌ها برآورد دلاری صفر منظور شده</small></article>
    </div>
    <div class="finance-note">
      مبلغ AI «هزینهٔ مرجع» است: اگر API روی Free Tier باشد هزینهٔ واقعی می‌تواند صفر باشد.
      نرخ مرجع فعلی برای Gemini 2.5 Flash-Lite برابر $0.10 ورودی و $0.40 خروجی به‌ازای هر یک میلیون توکن، و برای Gemini 2.5 Flash برابر $0.30 و $2.50 است.
      برای DownSub فعلاً فقط تعداد درخواست‌ها ثبت می‌شود و تا زمانی که قاعدهٔ دقیق تبدیل request به credit را قطعی نکنیم، دلار تخمینی نمی‌زنیم.
      ${d.updated_at?` آخرین ثبت: ${_sysTime(d.updated_at)}.`:""}
    </div>
    <div class="rule"><span>ریز مصرف ویدئوها</span><span class="l"></span></div>
    ${rows.length?`<table class="finance-table"><thead><tr><th>ویدئو</th><th>AI calls</th><th>Input</th><th>Output</th><th>AI est.</th><th>DownSub</th></tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td><span class="finance-video-title"><b>${esc(r.topic_fa||r.video_title||r.video_id||"ویدئو")}</b><small>${esc(r.name_fa||"")}${r.last_at?" · "+relTime(r.last_at):""}</small></span></td>
        <td>${_financeNum(r.ai_calls||0)}</td>
        <td>${_financeNum(r.prompt_tokens||0)}</td>
        <td>${_financeNum(r.completion_tokens||0)}</td>
        <td><span class="finance-money">${_financeUsd(r.estimated_paid_usd||0)}</span></td>
        <td>${_financeNum(r.downsub_requests||0)}</td>
      </tr>`).join("")}
    </tbody></table>`:'<div class="finance-empty">هنوز مصرفی ثبت نشده؛ از Build بعدی این جدول پر می‌شود.</div>'}
  </div>`;
}

const STUDIO_DONE_KEY="pendar_studio_recorded_v1";
const STUDIO_FONT_KEY="pendar_studio_font_v1";
let _studioQueueMode="pending";
function studioDoneSet(){try{return new Set(JSON.parse(localStorage.getItem(STUDIO_DONE_KEY)||"[]"))}catch(_){return new Set()}}
function studioIsDone(id){return studioDoneSet().has(String(id))}
function toggleStudioDone(id,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const s=studioDoneSet(),k=String(id);s.has(k)?s.delete(k):s.add(k);localStorage.setItem(STUDIO_DONE_KEY,JSON.stringify([...s]));if(location.hash.startsWith("#/studio-recap/"))openStudioRecap(id);else showStudioRecaps(_studioQueueMode)}
function setStudioQueueMode(mode){_studioQueueMode=mode;showStudioRecaps(mode)}
function studioFontSize(){const n=Number(localStorage.getItem(STUDIO_FONT_KEY)||18);return Math.min(30,Math.max(16,n||18))}
function adjustStudioFont(delta){const n=Math.min(30,Math.max(16,studioFontSize()+delta));localStorage.setItem(STUDIO_FONT_KEY,String(n));const el=document.querySelector(".studio-recap-body");if(el)el.style.setProperty("--studio-font-size",n+"px")}
async function showStudioRecaps(mode = _studioQueueMode) {
  _studioQueueMode=mode||"pending";
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const allRows=(await loadStudioRecaps()).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const done=studioDoneSet();
  const rows=_studioQueueMode==="done"?allRows.filter(r=>done.has(String(r.id))):_studioQueueMode==="all"?allRows:allRows.filter(r=>!done.has(String(r.id)));
  const pendingCount=allRows.filter(r=>!done.has(String(r.id))).length;
  document.title="استودیوی ضبط جان کلام | پندار";
  setHash("#/studio-recaps");
  el.innerHTML=`
    <div class="latest-videos-head">
      <button class="back" onclick="showLatestVideos('recaps')">بازگشت به ویدئوها</button>
      <div><span class="press-kicker">استودیوی ضبط جان کلام</span><h1>صف آمادهٔ ضبط</h1>
      <p>نسخه‌های مفصل و انتخاب‌شده برای خواندن مستقیم، ضبط و انتشار در یوتیوب.</p></div>
      <div class="latest-videos-stats"><span><b>${faN(pendingCount)}</b> برای ضبط</span><span><b>${faN(allRows.length)}</b> کل</span></div>
    </div>
    <div class="studio-queue-tools">
      <div class="studio-queue-filters">
        <button class="${_studioQueueMode==="pending"?"on":""}" onclick="setStudioQueueMode('pending')">برای ضبط · ${faN(pendingCount)}</button>
        <button class="${_studioQueueMode==="all"?"on":""}" onclick="setStudioQueueMode('all')">همه · ${faN(allRows.length)}</button>
        <button class="${_studioQueueMode==="done"?"on":""}" onclick="setStudioQueueMode('done')">ضبط‌شده · ${faN(allRows.length-pendingCount)}</button>
      </div>
      <div class="studio-queue-filters"><button onclick="showProjectFinance()">مالی پروژه</button></div>
    </div>
    ${rows.length?`<div class="studio-recap-list">${rows.map(r=>`
      <article class="studio-recap-card ${done.has(String(r.id))?"done":""}">
        <div class="studio-recap-card-meta"><span>${esc(r.name_fa||"")}</span><span>·</span><span>${r.published_at?relTime(r.published_at):""}</span><span>·</span><span>${faN(r.word_count||String(r.studio_recap_fa||"").split(/\s+/).filter(Boolean).length)} واژه</span>${done.has(String(r.id))?'<span class="studio-recorded">· ضبط شد ✓</span>':""}</div>
        <h2>${esc(r.topic_fa||r.video_title||"نسخهٔ ضبط")}</h2>
        <p>${esc(r.summary_fa||"")}</p>
        <div class="studio-recap-card-actions">
          <button class="primary" onclick="openStudioRecap('${String(r.id||"").replace(/'/g,"\\'")}')">${done.has(String(r.id))?"باز کردن متن":"شروع ضبط"}</button>
          <button onclick="toggleStudioDone('${String(r.id||"").replace(/'/g,"\\'")}',event)">${done.has(String(r.id))?"برگردان به صف":"ضبط شد ✓"}</button>
        </div>
      </article>`).join("")}</div>`:`<div class="state"><div class="big">${_studioQueueMode==="pending"?"صف ضبط خالی است.":"موردی در این بخش نیست."}</div></div>`}
  `;
}
async function openStudioRecap(id) {
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const rows=(await loadStudioRecaps()).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const idx=rows.findIndex(x=>String(x.id)===String(id));
  const r=idx>=0?rows[idx]:null;
  if(!r){el.innerHTML='<div class="state"><div class="big">این نسخهٔ ضبط پیدا نشد.</div></div>';return;}
  const newer=idx>0?rows[idx-1]:null;
  const older=idx<rows.length-1?rows[idx+1]:null;
  const done=studioIsDone(r.id);
  document.title=(r.topic_fa||r.video_title||"نسخهٔ ضبط")+" | استودیو";
  setHash("#/studio-recap/"+encodeURIComponent(String(r.id||"")));
  el.innerHTML=`<article class="studio-recap-article ${done?"recorded":""}">
    <button class="back" onclick="showStudioRecaps()">بازگشت به صف ضبط</button>
    <span class="press-kicker">استودیو جان کلام · ${esc(r.name_fa||"")}</span>
    <h1>${esc(r.topic_fa||r.video_title||"نسخهٔ ضبط")}</h1>
    <div class="studio-recap-byline">${esc(r.video_title||"")}${r.word_count?` · ${faN(r.word_count)} واژه`:""}${r.published_at?` · ${relTime(r.published_at)}`:""}</div>
    <div class="studio-recap-toolbar">
      <button class="primary" onclick="copyStudioRecap('${String(r.id||"").replace(/'/g,"\\'")}',this)">کپی متن</button>
      <button onclick="toggleStudioDone('${String(r.id||"").replace(/'/g,"\\'")}',event)">${done?"برگردان به صف":"ضبط شد ✓"}</button>
      <span class="studio-font-tools"><button onclick="adjustStudioFont(-1)">A−</button><button onclick="adjustStudioFont(1)">A+</button></span>
      <a href="${esc(r.url||"#")}" target="_blank" rel="noopener">ویدئوی اصلی ↗</a>
    </div>
    ${youtubeRecapEmbed(r.video_id||r.url, r.video_title||r.topic_fa||"ویدئوی اصلی")}
    <div class="studio-recap-body" style="--studio-font-size:${studioFontSize()}px">${_studioRecapBodyHtml(r.studio_recap_fa)}</div>
    <div class="studio-reader-nav">
      <div>${newer?`<button onclick="openStudioRecap('${String(newer.id||"").replace(/'/g,"\\'")}')">→ جدیدتر</button>`:""}</div>
      <div>${older?`<button onclick="openStudioRecap('${String(older.id||"").replace(/'/g,"\\'")}')">قدیمی‌تر ←</button>`:""}</div>
    </div>
  </article>`;
}
function requestStudioRecap(videoId) {
  const id=youtubeVideoId(videoId);
  if(!id) return;
  const title="[studio] "+id;
  const body="درخواست ساخت نسخهٔ ضبط پندار برای این ویدئو:\n\nhttps://www.youtube.com/watch?v="+id+"\n\nپس از ثبت این درخواست توسط حساب nimania، پردازش عمیق فقط برای همین ویدئو اجرا می‌شود.";
  const url="https://github.com/nimania/pendar/issues/new?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body);
  window.open(url,"_blank","noopener,noreferrer");
}

async function showLatestVideos(mode = "all") {
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede");
  if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline");
  if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures");
  if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const [d,studioRows]=await Promise.all([loadFigures(),loadStudioRecaps()]);
  const studioByVideo=new Map((studioRows||[]).map(r=>[String(r.video_id||""),
    r]));
  const byVideo=new Map();
  for(const person of (d.figures||[])){
    for(const v of (person.youtube_videos||[])){
      if(!v || !v.url) continue;
      const key=String(v.id||v.url);
      let row=byVideo.get(key);
      if(!row){
        row={...v,people:[]};
        byVideo.set(key,row);
      } else if (!row.recap_fa && v.recap_fa) {
        // Preserve recap enrichment if a shared video is attached to more than one person.
        row={...row,...v,people:row.people};
        byVideo.set(key,row);
      }
      if(!row.people.some(p=>String(p.handle).toLowerCase()===String(person.handle).toLowerCase())){
        row.people.push({handle:person.handle,name_fa:person.name_fa,avatar:person.avatar,role_fa:person.role_fa,directory:person.directory!==false});
      }
    }
  }
  const videos=[...byVideo.values()].sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const recapVideos=videos.filter(v=>String(v.recap_fa||"").trim());
  const recapsOnly=mode==="recaps";
  const studioCount=(studioRows||[]).length;
  const visibleVideos=recapsOnly?recapVideos:videos;
  const peopleCount=new Set(videos.flatMap(v=>v.people.filter(p=>p.directory!==false).map(p=>String(p.handle).toLowerCase()))).size;
  const sourceCount=new Set(videos.flatMap(v=>v.people.filter(p=>p.directory===false).map(p=>String(p.handle).toLowerCase()))).size;
  document.title=(recapsOnly?"جان کلام ویدئوهای چهره‌ها":"آخرین ویدئوهای چهره‌ها")+" | پندار";
  setHash(recapsOnly?"#/videos/recaps":"#/videos");
  el.innerHTML=`
    <div class="latest-videos-head">
      <button class="back" onclick="showFigures()">بازگشت به چهره‌ها</button>
      <div><span class="press-kicker">چهره‌ها · ویدئو</span><h1>${recapsOnly?"جان کلام ویدئوها":"آخرین ویدئوها"}</h1>
      <p>${recapsOnly?"ویدئوهایی که متن آن‌ها به «جان کلام» حرفه‌ای و وفادارانه تبدیل شده است.":"تازه‌ترین ویدئوهای چهره‌های پندار؛ از کانال‌های رسمی و حضورهای شناسایی‌شده در میزبان‌های معتبر."}</p></div>
      <div class="latest-videos-stats">
        <button class="${!recapsOnly?"on":""}" onclick="showLatestVideos('all')"><b>${faN(videos.length)}</b> ویدئو</button>
        <span><b>${faN(peopleCount)}</b> چهره</span>${sourceCount?`<span><b>${faN(sourceCount)}</b> منبع</span>`:""}
        ${recapVideos.length?`<button class="${recapsOnly?"on":""}" onclick="showLatestVideos('recaps')"><b>${faN(recapVideos.length)}</b> ≣ جان کلام</button>`:""}
        <button onclick="showStudioRecaps()" title="نسخه‌های ضبط آماده" aria-label="نسخه‌های ضبط آماده">${studioCount?`<b>${faN(studioCount)}</b> `:""}✦</button>
      </div>
    </div>
    ${visibleVideos.length?`<div class="latest-videos-grid">${visibleVideos.slice(0,120).map(v=>`
      <article class="latest-video-card">
        <a class="latest-video-main" href="${esc(v.url)}" target="_blank" rel="noopener">
          <span class="figure-youtube-thumb">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy">`:""}<span class="figure-youtube-play">▶</span></span>
          <span class="latest-video-copy"><b>${esc(v.title||"ویدئوی یوتیوب")}</b><small>${v.published_at?relTime(v.published_at):"YouTube"} · YouTube ↗</small></span>
        </a>
        <div class="latest-video-people">${v.people.map(p=>p.directory!==false?`<button onclick="openFigure('${String(p.handle||"").replace(/'/g,"\\'")}')">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:""}<span>${esc(p.name_fa||"")}</span></button>`:`<span class="latest-video-source">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:""}<span>${esc(p.name_fa||"")}</span></span>`).join("")}</div>
        ${v.recap_fa?`<div class="latest-video-actions"><button onclick="openStatement('youtube-${String(v.id||"").replace(/'/g,"\\'")}')">≣ <span>جان کلام</span></button>${studioByVideo.has(String(v.id||""))?`<button class="studio-mark ready" onclick="openStudioRecap('${String(studioByVideo.get(String(v.id||"")).id||"").replace(/'/g,"\\'")}')" title="نسخهٔ ضبط آماده" aria-label="نسخهٔ ضبط آماده">✦</button>`:`<button class="studio-mark request" onclick="requestStudioRecap('${String(v.id||"").replace(/'/g,"\\'")}')" title="ساخت نسخهٔ ضبط" aria-label="ساخت نسخهٔ ضبط">✧</button>`}</div>`:""}
      </article>`).join("")}</div>`:`<div class="state"><div class="big">${recapsOnly?"هنوز جان کلامی آماده نشده":"هنوز ویدئویی برای چهره‌ها پیدا نشده"}</div></div>`}
  `;
}
// The figures directory render (renderFigures) and the profile/statement
// openers (openFigure, openStatement, openNewsPerson, searchFigureProfiles,
// setFigureProfileFilter, youtube/telegram embeds) now live in
// figures-profile.js, loaded before this file.
