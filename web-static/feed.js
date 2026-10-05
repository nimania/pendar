/* Pendar — news feed: the story card (feedCard), the shared stories cache
   (ALL) and feed state (tier, feedRange, sortMode), the feed loader
   (loadFeed, retryFeed), day chips, the tier/range/sort filters
   (feedFilter, renderFeed, setTier, setFeedRange, setSort). Extracted from
   app.js; loaded as a classic script BEFORE app.js because app.js's boot
   calls loadFeed() at load, and many modules read/populate the ALL cache.
   Uses app.js/other-module helpers (credBadge, geoBadge, impInfo,
   figuresSection, groupedByCategory) at runtime. No behavior change. */

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
