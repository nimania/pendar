/* Pendar — static build. Reads pre-generated JSON from ./data (no backend).
   Shared core utilities (DATA, faN, esc, relTime, getJSON, label dictionaries,
   impInfo, homeEditorialText) now live in core.js, loaded before this file. */

// Shared data caches must exist before startup renderers run.
// Shared dataset caches (_FIG, _NEWS_PEOPLE, _CURATED_POEMS, _STUDIO_RECAPS,
// _PROJECT_FINANCE) now live in loaders.js, loaded before this file.


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

const VIEWS = { home: "home-view", feed: "feed-view", detail: "detail-view", trends: "trends-view",
  factchecks: "factchecks-view", topics: "topics-view", topicarchive: "topic-archive-view",
  weather: "weather-view", iran: "iran-view", faq: "faq-view", market: "market-view",
  figures: "figures-view", press: "press-view", books: "books-view", movies: "movies-view", tvguide: "tv-guide-view", knowledge: "knowledge-view", entity: "entity-view", graph: "entity-graph-view", profile: "entity-profile-view", entityqa: "entity-qa-view", system: "system-view", tech: "tech-view", badbadak: "badbadak-view", usradar: "us-radar-view" };
const TABS = ["home", "feed", "trends", "factchecks", "iran", "topics"];
const SCOPE_FA = { local: "استانی", national: "کشوری", international: "بین‌المللی" };
function setTab(w) { for (const t of TABS) document.getElementById("tab-" + t).classList.toggle("active", w === t); }
function show(v) {
  document.documentElement.classList.add("app-ready");
  document.documentElement.classList.remove("route-boot");
  for (const [key, id] of Object.entries(VIEWS))
    document.getElementById(id).style.display = key === v ? "block" : "none";
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showHome() {
  show("home"); setTab("home"); setHash("");
  document.title="پندار | خبر، چهره‌ها، کتاب، فیلم و سریال";
  renderHomeStats(); renderHomeGlance(); renderHomePrices(); renderHomeWeather();
  renderHomePeople(); renderHomeCulture(); renderHomeEvents();
  if (ALL.length) renderHomeDaily(); else loadFeed(true);
}
async function showFeed() {
  show("feed"); setTab("feed"); setHash("#/headlines");
  document.title="سرخط خبرها | پندار";
  renderHeadlinesDiscovery();
  if (!ALL.length) await loadFeed(true);
  else { renderFeed(); renderDayChips(); }
}
function showTopics() { show("topics"); setTab("topics"); renderTopics(); setHash("#/topics"); }
function showTrends() { show("trends"); setTab("trends"); renderTrends(); setHash("#/trends"); }
function showFactchecks() { show("factchecks"); setTab("factchecks"); renderFactchecks(); setHash("#/fact"); }
function showFaq() { show("faq"); setTab("faq"); renderFaq(); setHash("#/faq"); }

// Book app glue (booksCache, loadBooks, _bookBySlug, _toman,
// openPublisher, openBookPerson) now lives in book-app.js, loaded before
// this file.

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

// News feed: the story card (feedCard), the shared ALL stories cache + feed
// state, loadFeed/retryFeed, day chips and the tier/range/sort filters
// (feedFilter, renderFeed, setTier, setFeedRange, setSort) now live in
// feed.js, loaded before this file.

// Story detail: the single-story page (openStory) and its helpers
// (relatedStories, timelineSection, storyPeopleSuggestions, showAsk) now
// live in story-detail.js, loaded before this file.

// Secondary views: trends (renderTrends), fact-checks (renderFactchecks,
// fcCard, setFactTab), topics (renderTopics) and FAQ (renderFaq) now live
// in secondary-views.js, loaded before this file. grp moved to core.js.

// archive feed grouped by importance tier ("به تفکیک اهمیت")
// TIERS moved to nav.js (next to groupedFeed, its only user).
// Feed grouping (groupedFeed, groupedByCategory, utcDayISO, dayLabel) and
// the navigation openers (openDay, openTrendDossier, openTopic,
// referenceStrip, openEntity, followBar, openSource) now live in nav.js,
// loaded before this file.

/* ---- ایران — province map + scope classification ----
   نقشهٔ واقعیِ استان‌ها (choropleth): مسیرهای دقیق در iran-provinces.js
   (برگرفته از masoudnemati/iran-map با مجوز MIT). */
const PATHS = (typeof window !== "undefined" && window.IRAN_PATHS) || {};
const VIEWBOX = (typeof window !== "undefined" && window.IRAN_VIEWBOX) || "0 0 990 890";

// Iran/provinces view (showIran, renderIran, setIranScope, openProvince,
// hitProvFollow) now lives in iran.js, loaded before this file.

const root = document.documentElement;
document.getElementById("theme").addEventListener("click", () => {
  const cur = root.getAttribute("data-theme"), sysDark = matchMedia("(prefers-color-scheme:dark)").matches;
  root.setAttribute("data-theme", (cur === "dark" || (!cur && sysDark)) ? "light" : "dark");
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

// freshness line: when the SYSTEM last checked, and how old the NEWEST story is
let META = null;
getJSON(`${DATA}/meta.json`).then(m => { META = m; updateFreshness(); }).catch(() => {});
// Home page widgets (updateFreshness, renderHomePrices, renderHomeGlance,
// renderHomePeople, renderHomeDaily, renderHomeMajra, scrollHomeMajra)
// now live in home.js, loaded before this file.

// Market (showMarket/renderMarket + converter) and weather/air-quality
// (showWeather/renderWeather/renderHomeWeather + helpers) now live in
// market-weather.js, loaded before this file.

// Charts (svgSpark/svgBars/_pts), the follow/save store (FOLLOW, isF,
// followBtn, saveBtn...) and the home stats block now live in
// charts-social.js, loaded before this file.

const _initialRoute = currentRoute();
const _isDeepLink = Boolean(_initialRoute);
if (_isDeepLink) {
  const feedView = document.getElementById("home-view");
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
  showHome();
  _bootReveal();
  renderHomeStats();
  renderHomeGlance();
  renderHomePrices();
  renderHomeWeather();
  renderHomePeople();
  renderHomeCulture();
  renderHomeEvents();
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
// The figures directory (_figDirectoryMode, setFigureDirectoryMode,
// showFigures, renderFiguresDirectory) now lives in figures-profile.js,
// loaded before this file.
// Studio recaps (showStudioRecaps, openStudioRecap, requestStudioRecap +
// done/queue/font state), project finance (showProjectFinance) and latest
// videos (showLatestVideos) now live in studio-videos.js, loaded before
// this file.
// The figures directory render (renderFigures) and the profile/statement
// openers (openFigure, openStatement, openNewsPerson, searchFigureProfiles,
// setFigureProfileFilter, youtube/telegram embeds) now live in
// figures-profile.js, loaded before this file.
