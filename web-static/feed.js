/* Pendar — news feed: the story card (feedCard), the shared stories cache
   (ALL) and feed state (tier, feedRange, sortMode), the feed loader
   (loadFeed, retryFeed), day chips, the tier/range/sort filters
   (feedFilter, renderFeed, setTier, setFeedRange, setSort). Extracted from
   app.js; loaded as a classic script BEFORE app.js because app.js's boot
   calls loadFeed() at load, and many modules read/populate the ALL cache.
   Uses app.js/other-module helpers (credBadge, geoBadge, impInfo,
   figuresSection, groupedByCategory) at runtime. No behavior change. */


// Trial only: shortlist at most ten top-ranked Iran-related news items.
// Keyword matching creates a review candidate, NEVER a verified impact or score.
const FUTURE_NEWS_PILOT=[
 {name:"انتقال قدرت و نهادها",words:["انتقال قدرت","جانشینی","رهبری","اصولگرایان","مجلس","قوه قضاییه","دولت موقت"],why:"ممکن است برای پیگیری انسجام نهادها یا تغییر موازنه قدرت مهم باشد."},
 {name:"امنیت و روابط خارجی",words:["جنگ","حمله نظامی","آتش بس","مذاکره","تحریم","اسرائیل","آمریکا"],why:"ممکن است بر سناریوهای تنش یا کاهش تنش و تصمیم‌های سیاست خارجی اثر بگذارد."},
 {name:"اقتصاد و خدمات",words:["تورم","ارز","بودجه","برق","گاز","بحران اقتصادی"],why:"ممکن است نشانه‌ای برای بررسی پایداری اقتصادی و خدمات عمومی باشد."},
 {name:"جامعه و مشارکت",words:["اعتراض","اعتصاب","انتخابات","مشارکت سیاسی","جامعه مدنی"],why:"ممکن است برای رصد تغییر رفتار جمعی و مشارکت اجتماعی مرتبط باشد."}
];
const futureNewsNorm = value => String(value || "").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\u200c/g," ").replace(/\s+/g," ").trim();
let _futureNewsFeed = null;
let _futureNewsCandidates = new Map();
function futureNewsPilot(s){
 if(!s || !s.id)return null;
 // Cache the shortlist for this feed snapshot; never sort or mutate ALL.
 if(_futureNewsFeed !== ALL){
  _futureNewsFeed = ALL;
  _futureNewsCandidates = new Map();
  const sorted=ALL.filter(x=>x&&x.id).slice().sort((a,b)=>(Number(b.importance_score)||0)-(Number(a.importance_score)||0));
  for(const item of sorted){
   const title=futureNewsNorm(item.headline_fa);
   if(!["high","direct","major"].includes(String(item.iran_relevance||"").toLowerCase()) && !/ایران|تهران|جمهوری اسلامی/.test(title))continue;
   const hit=FUTURE_NEWS_PILOT.find(t=>t.words.some(w=>title.includes(futureNewsNorm(w))));
   if(hit)_futureNewsCandidates.set(String(item.id),hit);
   if(_futureNewsCandidates.size===10)break;
  }
 }
 return _futureNewsCandidates.get(String(s.id)) || null;
}
function futureNewsTrialBadge(s){
 const t=futureNewsPilot(s);
 return t?'<span class="future-pilot-badge" title="نامزد ارزیابی تحریری؛ اثر تأیید نشده">◌ اثر احتمالی بر آینده</span>':"";
}
function futureNewsTrialDetail(s){
 const t=futureNewsPilot(s);if(!t)return "";
 // A headline alone is not sufficient evidence for a confirmed change.
 const watch={
 "انتقال قدرت و نهادها":"آیا تصمیم‌ها یا جابه‌جایی‌های نهادی دیگری رخ می‌دهد؟ آیا واکنش بازیگران اصلی مستند می‌شود؟",
 "امنیت و روابط خارجی":"آیا اقدام یا اعلام موضع رسمی تازه‌ای ثبت می‌شود؟ آیا طرف‌های دیگر آن را تأیید می‌کنند؟",
 "اقتصاد و خدمات":"آیا داده رسمی یا گزارش مستقلِ دیگری تغییر وضعیت را تأیید می‌کند؟ آیا اختلال ادامه پیدا می‌کند؟",
 "جامعه و مشارکت":"آیا شواهد مستقلی از تداوم، گسترش یا کاهش مشارکت و کنش جمعی به دست می‌آید؟"
 }[t.name]||"چه شواهد مستقلی در روزهای بعد منتشر می‌شود؟";
 const title=String(s.headline_fa||"").trim();
 const report=String(s.what_happened_fa||s.summary_fa||"").trim();
 const excerpt=report.length>220?report.slice(0,217).replace(/\\s+\\S*$/,"")+"…":report;
 return '<section class="layers future-pilot-panel" aria-label="اثر احتمالی بر آینده">'+
 '<div class="future-pilot-top"><span class="future-pilot-icon" aria-hidden="true">◎</span><h3>اثر بر آینده</h3><span class="future-pilot-label">آزمایشی · نامزد بررسی</span></div>'+
 '<h4 class="future-pilot-question">این رویداد چه اثری بر «'+esc(t.name)+'» می‌تواند داشته باشد؟</h4>'+
 '<div class="future-pilot-steps"><div><strong><span aria-hidden="true">◷</span> چه چیزی تغییر کرده؟</strong><p>'+esc(excerpt||title)+'</p><small>خلاصه گزارش خبر؛ وقوع و دامنه تغییر نیازمند بررسی منابع است.</small></div>'+
 '<div><strong><span aria-hidden="true">↗</span> اثر احتمالی بر آینده</strong><p>'+esc(t.why)+'</p><small>فرضیه موضوعی برآمده از تیتر، نه نتیجه‌گیری مستقل.</small></div>'+
 '<div class="future-pilot-watch"><strong><span aria-hidden="true">◉</span> از این به بعد چه چیزی را زیر نظر بگیریم؟</strong><p>'+esc(watch)+'</p></div></div>'+
 '<p class="future-pilot-status">وضعیت شواهد: در انتظار ارزیابی مستقل · جهت و میزان اثر تعیین نشده</p>'+
 '<p class="future-pilot-caveat">این کارت به‌صورت آزمایشی از ارتباط موضوعی تیتر ساخته شده است. شاخص‌ها و احتمال سناریوها تغییر نکرده‌اند.</p>'+
 '<nav class="future-pilot-links" aria-label="پیگیری اثر خبر"><a href="/future/transition/watch/">پیگیری در دیده‌بان گذار ←</a><a href="/future/">آینده‌بان ←</a></nav></section>';
}

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
      <span class="dot"></span><span class="muted">${relTime(s.published_at)}</span>${geoBadge(s.geo)}${trendBadge(s.trend)}${homepage ? futureNewsTrialBadge(s) : ""}
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
let _feedRequest = null;
let tier = "all";
let feedRange = "all";
async function loadFeed(renderHome = true) {
  const el = document.getElementById("feed");
  try {
    if (!_feedRequest) {
      _feedRequest = getJSON(`${DATA}/stories.json`).finally(() => { _feedRequest = null; });
    }
    ALL = await _feedRequest;
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
