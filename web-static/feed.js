/* Pendar — news feed: the story card (feedCard), the shared stories cache
   (ALL) and feed state (tier, feedRange, sortMode), the feed loader
   (loadFeed, retryFeed), day chips, the tier/range/sort filters
   (feedFilter, renderFeed, setTier, setFeedRange, setSort). Extracted from
   app.js; loaded as a classic script BEFORE app.js because app.js's boot
   calls loadFeed() at load, and many modules read/populate the ALL cache.
   Uses app.js/other-module helpers (credBadge, geoBadge, impInfo,
   figuresSection, groupedByCategory) at runtime. No behavior change. */


// Topic-based future context for every news item, including archived deep links.
// These are conditional reading guides, not verified forecasts or risk scores.
const FUTURE_NEWS_CONTEXT = [
 {key:"security",name:"امنیت و تنش",axis:"security",words:["جنگ","حمله نظامی","درگیری","عملیات نظامی","موشک","تلفات","آتش بس","نیروهای مسلح"],effect:"اگر دامنه درگیری یا تصمیم‌های نظامی تغییر کند، مسیر امنیت منطقه، رفت‌وآمد و فعالیت اقتصادی هم می‌تواند تغییر کند. تداوم تنش و کاهش آن دو مسیر متفاوت برای پیگیری‌اند.",watch:"دامنه و تکرار رویداد، تصمیم رسمی طرف‌ها، اجرای آتش‌بس و گزارش‌های مستقل از وضعیت میدانی."},
 {key:"diplomacy",name:"روابط خارجی",words:["تحریم","مذاکره","مذاکرات","توافق","دیپلماسی","سیاست خارجی","NPT","کرملین"],effect:"اگر موضع‌گیری‌ها به توافق، محدودیت یا اقدام اجرایی برسند، روابط کشورها و امکان تجارت و همکاری می‌تواند تغییر کند. اظهارنظر به‌تنهایی نشان‌دهنده اجرای تصمیم نیست.",watch:"متن رسمی تصمیم یا توافق، زمان اجرا، واکنش طرف مقابل و شواهد عملی از تغییر سیاست."},
 {key:"economy",name:"اقتصاد و معیشت",axis:"economy",words:["تورم","نرخ ارز","بودجه","بازار انرژی","قیمت نفت","نفت ایران","حامل گاز","گاز مایع","بانک","دارایی","رمزارز","قیمت","بازار سهام"],effect:"اگر این رویداد بر عرضه، هزینه‌ها یا دسترسی به منابع مالی اثر ماندگار بگذارد، می‌تواند به قیمت‌ها، قدرت خرید و تصمیم‌های کسب‌وکار منتقل شود. باید تغییر پایدار را از نوسان کوتاه‌مدت جدا کرد.",watch:"روند قیمت و عرضه، آمار رسمی، تصمیم‌های اجرایی و اثر قابل مشاهده بر خانوارها و کسب‌وکارها."},
 {key:"services",name:"خدمات و زندگی روزمره",axis:"executive",words:["قطع برق","قطعی برق","کمبود آب","خدمات عمومی","اختلال خدمات","حمل و نقل","مدرسه","بیمارستان"],effect:"اگر اختلال یا تغییر خدمات ادامه پیدا کند، زندگی روزمره، هزینه‌ها و توان اداره امور تحت تأثیر قرار می‌گیرد. اگر رفع شود، اثر آن می‌تواند محدود و موقت بماند.",watch:"مدت و گستره تغییر، برنامه رفع مشکل، اجرای وعده‌ها و وضعیت واقعی دسترسی به خدمات."},
 {key:"politics",name:"قدرت و نهادها",axis:"authority",words:["انتقال قدرت","جانشینی","رهبری","اصولگرایان","دولت موقت","حکومت موقت","قانون اساسی","قوه قضاییه","مجلس","انتخابات"],effect:"اگر این خبر به تغییر قانون، ترکیب نهادها یا رفتار تصمیم‌گیران برسد، موازنه قدرت و مسیر تصمیم‌های بعدی می‌تواند تغییر کند. برای سنجش اثر، نتیجه اجرایی مهم‌تر از موضع‌گیری اولیه است.",watch:"تصمیم و سند رسمی، تغییر ائتلاف‌ها یا ترکیب نهادها، زمان اجرا و شواهد پاسخگویی."},
 {key:"society",name:"جامعه و مشارکت",axis:"assembly",words:["اعتراض","اعتصاب","مشارکت سیاسی","جامعه مدنی","حقوق بشر","مهاجرت","کودک سرباز"],effect:"اگر واکنش‌ها تداوم یابند یا به تغییر سیاست و رفتار جمعی برسند، این خبر می‌تواند بر مشارکت، اعتماد اجتماعی و مطالبات عمومی اثر بگذارد. یک مورد منفرد برای نتیجه‌گیری درباره روند کل جامعه کافی نیست.",watch:"تداوم و گستره واکنش‌ها، پاسخ نهادها، تغییر سیاست و داده‌های قابل مقایسه در طول زمان."},
 {key:"environment",name:"محیط‌زیست و منابع",words:["اقلیم","محیط زیست","خشکسالی","آلودگی","زلزله","سیل","جنگل"],effect:"اگر پیامدها تکرار یا تشدید شوند، می‌توانند بر سلامت، سکونت، منابع طبیعی و هزینه اداره شهرها اثر بگذارند. میزان اثر به گستره رویداد و کیفیت پاسخ وابسته است.",watch:"داده‌های اندازه‌گیری، تکرار رویداد، گستره آسیب و اجرای اقدامات پیشگیری و جبران."},
 {key:"technology",name:"فناوری و کار",words:["هوش مصنوعی","فناوری","اینترنت","استارلینک","نرم افزار"],effect:"اگر این فناوری یا تصمیم در عمل گسترش پیدا کند، شیوه کار، دسترسی به اطلاعات و هزینه خدمات می‌تواند تغییر کند. معرفی یک محصول با استفاده گسترده از آن فاصله دارد.",watch:"دسترسی واقعی، هزینه، میزان استفاده، محدودیت‌ها و نتیجه قابل سنجش در کاربردهای روزمره."},
 {key:"health",name:"سلامت و دانش",words:["سلامت","درمان","واکسن","بیماری","پژوهش علمی"],effect:"اگر نتیجه گزارش با شواهد معتبر تأیید و در عمل به کار گرفته شود، می‌تواند بر دانش، خدمات سلامت یا کیفیت زندگی اثر بگذارد. مرحله پژوهش و میزان تأیید مستقل در ارزیابی اثر تعیین‌کننده‌اند.",watch:"منبع اصلی پژوهش یا تصمیم، تأیید مستقل، مرحله اجرا و داده‌های مربوط به نتیجه."},
 {key:"culture",name:"فرهنگ و رسانه",words:["سینما","سریال","کتاب","موسیقی","نوبل","جایزه"],effect:"اثر این خبر ممکن است ابتدا در توجه مخاطبان، دیده‌شدن آثار و فرصت‌های فرهنگی ظاهر شود. اثر گسترده‌تر زمانی روشن می‌شود که استقبال یا تغییرهای نهادی تداوم پیدا کنند.",watch:"استقبال مخاطبان، دسترسی به اثر، واکنش حرفه‌ای و تغییر قابل مشاهده در تولید یا توزیع."},
 {key:"sport",name:"ورزش و رقابت",words:["ورزشی","فوتبال","پاراآسیایی","المپیک"],effect:"اثر این خبر می‌تواند بر مسیر رقابت، فرصت ورزشکاران و تصمیم‌های مدیریتی متمرکز باشد. از یک نتیجه ورزشی به‌تنهایی نمی‌توان پیامد گسترده اجتماعی یا سیاسی نتیجه گرفت.",watch:"نتیجه رقابت‌های بعدی، تصمیم فدراسیون‌ها، برنامه آماده‌سازی و تغییر شرایط ورزشکاران."},
 {key:"general",name:"پیگیری خبر",words:[],effect:"از اطلاعات فعلی این خبر، پیامد بلندمدت مشخصی نمی‌توان تعیین کرد. اگر رویداد تکرار شود، دامنه آن گسترش یابد یا به تصمیم اجرایی برسد، ارزیابی اثر آن روشن‌تر می‌شود.",watch:"خبرهای تأییدکننده، تکرار رویداد، دامنه پیامدها و تصمیم‌های رسمی مرتبط."}
];
const futureNewsNorm = value => String(value || "").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\u200c/g," ").replace(/\s+/g," ").trim();
const FUTURE_NEWS_CATEGORY = {iran:"politics",politics:"politics",world:"diplomacy",economy:"economy",technology:"technology",ai:"technology",science:"health",health:"health",environment:"environment",culture:"culture",entertainment:"culture",sport:"sport"};
function futureNewsContext(s){
 if(!s || !s.id)return null;
 const title=futureNewsNorm(s.headline_fa);
 const matches=text=>FUTURE_NEWS_CONTEXT.filter(t=>t.words.some(w=>text.includes(futureNewsNorm(w))));
 const hits=matches(title);
 // Prefer explicit headline topics; summaries help only when the title has no match.
 const summaryHits=hits.length?[]:matches(futureNewsNorm(s.summary_fa));
 const primary=hits[0]||summaryHits[0]||FUTURE_NEWS_CONTEXT.find(t=>t.key===FUTURE_NEWS_CATEGORY[s.category])||FUTURE_NEWS_CONTEXT[FUTURE_NEWS_CONTEXT.length-1];
 const iran=["high","direct","major"].includes(String(s.iran_relevance||"").toLowerCase())||/ایران|تهران|جمهوری اسلامی/.test(title);
 return {primary,secondary:hits.find(t=>t.key!==primary.key)||null,iran,basis:hits.length?"تیتر خبر":summaryHits.length?"خلاصه خبر":"موضوع خبر"};
}
function futureNewsBadge(s){
 const c=futureNewsContext(s);if(!c)return "";
 return `<span class="future-impact-badge future-impact-${c.primary.key}" title="پیامدهای احتمالی و مسیر پیگیری این خبر">اثر بر آینده · ${esc(c.primary.name)}</span>`;
}
function futureNewsDetail(s){
 const c=futureNewsContext(s);if(!c)return "";
 const t=c.primary;
 const axis=c.iran?(t.axis||c.secondary?.axis):null;
 const report=String(s.what_happened_fa||s.summary_fa||" ").trim();
 const excerpt=report.length>240?report.slice(0,240)+"…":report;
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/></svg>';
 return `<section class="future-impact-panel future-impact-${t.key}" aria-label="اثر بر آینده">
  <div class="future-impact-heading"><span class="future-impact-icon">${icon}</span><div><span class="future-impact-eyebrow">از خبر امروز تا پیامدهای فردا</span><h2>اثر بر آینده</h2></div><span class="future-impact-topic">${esc(t.name)}</span></div>
  ${excerpt?`<div class="future-impact-start"><h3>نقطهٔ شروع این خبر</h3><p>${esc(excerpt)}</p></div>`:""}
  <div class="future-impact-grid"><div><h3>چه پیامدی ممکن است داشته باشد؟</h3><p>${esc(t.effect)}</p></div><div><h3>چه چیزی را پیگیری کنیم؟</h3><p>${esc(t.watch)}</p></div></div>
  ${c.secondary?`<p class="future-impact-related">حوزهٔ مرتبط دیگر: <strong>${esc(c.secondary.name)}</strong></p>`:""}
  <div class="future-impact-footer"><small>برداشت اولیه بر پایهٔ ${c.basis}؛ رنگ نشان‌دهندهٔ حوزه است. نتیجه با شواهد بعدی روشن‌تر می‌شود.</small><nav aria-label="پیگیری در آینده‌بان"><a href="/future/">آینده‌بان ←</a>${axis?`<a href="/future/transition/watch/">دیده‌بان گذار ←</a><a href="/future/transition/institution/${axis}/">پروندهٔ مرتبط ←</a>`:""}</nav></div>
 </section>`;
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
      <span class="dot"></span><span class="muted">${relTime(s.published_at)}</span>${geoBadge(s.geo)}${trendBadge(s.trend)}${futureNewsBadge(s)}
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
