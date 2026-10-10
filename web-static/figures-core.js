/* Pendar — figures core: commentator/figure cards, the figure follow store,
   the home figures timeline, and the per-story figures section. Extracted
   from app.js; loaded as a classic script BEFORE app.js because figuresSection()
   and figureCard() are called by story/statement rendering that a deep-link
   boot can trigger via route(). These call shared helpers that stay in app.js
   (avatar, openFigure, loadFigures) only at runtime. The figure directory and
   profile/statement openers remain in app.js (interleaved with other features).
   No behavior change. */

function statementKey(p) { return encodeURIComponent(String(p.id || "")); }
function figureProfileLink(person, content, className = "") {
  return `<a class="${className}" href="#/figure/${esc(encodeURIComponent(person.handle || ""))}" onclick="event.preventDefault();event.stopPropagation();openFigure(decodeURIComponent('${esc(encodeURIComponent(person.handle || "").replace(/'/g,"%27"))}'))">${content}</a>`;
}
function statementCardClick(event, id) {
  if (event.target.closest("a, button, input, select, textarea, iframe")) return;
  if (window.getSelection && String(window.getSelection())) return;
  openStatement(id);
}
function statementCardKey(event, id) {
  if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  openStatement(id);
}
function statementCardAttrs(p) {
  const id = statementKey(p).replace(/'/g, "%27");
  return `tabindex="0" role="link" style="cursor:pointer" aria-label="مشاهدهٔ کامل دیدگاه" onclick="statementCardClick(event,'${id}')" onkeydown="statementCardKey(event,'${id}')"`;
}
function figureSourceNote(p) {
  return p.source_note_fa ? `<p class="muted fig-note">${esc(p.source_name || "")} · ${esc(p.source_note_fa)}</p>` : "";
}
// Registration is an activity signal, never a substitute for the source date.
function figureActivityTime(p, now = Date.now()) {
  return Math.max(0, ...[p.published_at, p.editorial ? p.recorded_at : null]
    .map(value => Date.parse(value || "")).filter(time => Number.isFinite(time) && time <= now));
}
function figureTextParagraphs(p, className = "") {
  return String(p.summary_fa || "").split(/\n\s*\n/).filter(part => part.trim())
    .map(part => `<p${className ? ` class="${esc(className)}"` : ""}>${esc(part.trim())}</p>`).join("");
}
/* Editorial/transcript quotes (reviewed نقل‌قول‌ها merged from
   pendar-editorial-views.json) get a distinct card background so they read
   apart from the regular Telegram/news دیدگاه‌ها. */
function isEditorialQuote(p) {
  return !!(p && (p.editorial || p.platform === "transcript"));
}
// Label the "source" link by the URL/platform, so a video source reads right
// even on an editorial/transcript post (whose platform isn't "youtube").
function sourceLinkLabel(p) {
  const u = String(p.url || "");
  if (p.kind === "news_statement") return "منبع این گفته";
  if (/(youtube\.com|youtu\.be)/i.test(u)) return "ویدئو در یوتیوب";
  if (p.platform === "truthsocial") return "پست اصلی در تروث سوشیال";
  if (p.platform === "youtube") return "ویدئو در یوتیوب";
  if (u.includes("ble.ir/")) return "متن کامل در بله";
  return "متن کامل در تلگرام";
}
function figureCard(p, withName, detail = false) {
  const party = p.kind === "party_claim"
    ? `<span class="cstatus st-warn" title="این شخص خودش طرفِ این ماجراست">${KIND_NOTE.party_claim}</span>` : "";
  const head = withName
    ? `<div class="v-h">${figureProfileLink(p, avatar(p, "sm"))}<div class="fig-id"><a class="v-name" href="#/figure/${esc(p.handle)}" onclick="event.preventDefault();${p._newsPerson ? "openNewsPerson" : "openFigure"}('${esc(p.handle)}')">${esc(p.name_fa)}</a><span class="fig-role">${esc(p.role_fa)}</span></div><span class="spacer" style="flex:1"></span>${party}</div>`
    : `<div class="v-h"><span class="fig-topic">${esc(p.topic_fa || "")}</span><span class="spacer" style="flex:1"></span>${party}</div>`;
  return `<div class="view fig-view${isEditorialQuote(p) ? " fig-quote" : ""}" ${detail ? "" : statementCardAttrs(p)}>${head}
    ${figureTextParagraphs(p)}${figureSourceNote(p)}
    <div class="fig-foot"><button class="fig-profile-link" onclick="openStatement(\'${statementKey(p)}\')">صفحهٔ این گفته</button><span class="muted">${relTime(p.published_at)}${p.source_language && p.source_language !== "fa" ? " · " + esc(p.translation_label_fa || ("ترجمه از " + p.source_language)) : ""}</span>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${sourceLinkLabel(p)} ↗</a>` : ""}</div></div>`;
}
const FIG_FOLLOW_KEY = "jankalam-figure-follows";
let _figTimelineMode = "all";
let _figTimelineField = "all";
function figureFollows() {
  try { return new Set(JSON.parse(localStorage.getItem(FIG_FOLLOW_KEY) || "[]")); }
  catch (e) { return new Set(); }
}
function isFigureFollowed(handle) { return figureFollows().has(String(handle).toLowerCase()); }
function toggleFigureFollow(handle, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  const key = String(handle).toLowerCase(), s = figureFollows();
  s.has(key) ? s.delete(key) : s.add(key);
  localStorage.setItem(FIG_FOLLOW_KEY, JSON.stringify([...s]));
  if (document.getElementById("figures-view").style.display === "block" && (location.hash.startsWith("#/figure/")||location.hash.startsWith("#/entity/person"))) openFigure(handle,false);
  else renderFigureTimeline();
}
function figureFollowBtn(handle, compact) {
  const on = isFigureFollowed(handle);
  return `<button class="fig-follow ${on ? "on" : ""} ${compact ? "compact" : ""}" onclick="toggleFigureFollow('${esc(handle)}',event)" aria-label="${on ? "دنبال نکردن" : "دنبال کردن"}">${on ? "★ دنبال می‌کنم" : "☆ دنبال کن"}</button>`;
}
const FIGURE_TIMELINE_TOPICS = [
  {id:"all", label:"همهٔ موضوع‌ها"},
  {id:"ai", label:"فناوری و هوش مصنوعی", terms:["هوش مصنوعی","مدل زبانی","یادگیری ماشین","فناوری","تکنولوژی","chatgpt","openai","claude","gemini","deepseek","artificial intelligence"]},
  {id:"politics", label:"سیاست و ایران", terms:["انتخابات","حکومت","دولت","گذار سیاسی","جمهوری اسلامی","دموکراسی","مجلس","سیاست ایران"]},
  {id:"economy", label:"اقتصاد", terms:["اقتصاد","تورم","بازار","بودجه","سرمایه‌گذاری","ارز","تجارت"]},
  {id:"culture", label:"فرهنگ و هنر", terms:["سینما","موسیقی","ادبیات","کتاب","هنر","فرهنگ","فیلم"]},
  {id:"society", label:"جامعه", terms:["جامعه","آموزش","حقوق بشر","زنان","دانشگاه","مهاجرت"]}
];
let _figTimelineTopic = "all";
function figureMatchesTopic(post, topic) {
  if(topic.id === "all") return true;
  // Topic labels belong to individual posts, never to their authors.
  const assigned = [post.topic_ids,post.topics,post.subject_topics]
    .flatMap(v => Array.isArray(v) ? v : typeof v === "string" ? [v] : [])
    .map(v => typeof v === "string" ? v : v && (v.id || v.slug) || "")
    .map(v => String(v).toLowerCase());
  if(assigned.length) return assigned.includes(topic.id);
  const normalized = value => String(value || "").toLowerCase()
    .replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\u200c/g," ").replace(/\s+/g," ");
  const haystack = normalized([post.topic_fa,post.summary_fa,post.headline_fa,post.quote_fa]
    .filter(Boolean).join(" "));
  return topic.terms.some(term => haystack.includes(normalized(term)));
}
function setFigureTimelineTopic(topic) {
  if(!FIGURE_TIMELINE_TOPICS.some(x=>x.id===topic)) return;
  _figTimelineTopic = topic;
  _figTimelineField = "all";
  renderFigureTimeline();
}
function setFigureTimelineMode(mode) { _figTimelineMode = mode; if(mode === "news") _figTimelineTopic = "all"; renderFigureTimeline(); }
function setFigureTimelineField(field) { _figTimelineField = field; renderFigureTimeline(); }
async function renderFigureTimeline() {
  const el = document.getElementById("figure-timeline");
  if (!el) return;
  const d = await loadFigures();
  const isNewsMode = _figTimelineMode === "news";
  const fields = d.fields || {};
  let posts = (d.figures || []).flatMap(f => (f.posts || []).map(p => ({
    ...p, field: f.field,
    name_fa: p.name_fa || f.name_fa,
    role_fa: p.role_fa || f.role_fa,
    field_fa: f.field_fa || fields[f.field] || "",
    avatar: p.avatar || f.avatar,
    _newsPerson: isNewsMode
  }))).sort((a, b) => figureActivityTime(b) - figureActivityTime(a));
  const follows = figureFollows();
  if (isNewsMode) posts = posts.filter(p => p.kind === "news_statement");
  if (_figTimelineMode === "following") posts = posts.filter(p => follows.has(String(p.handle).toLowerCase()));
  if (_figTimelineField !== "all" && !isNewsMode) posts = posts.filter(p => p.field === _figTimelineField);
  const selectedTopic = FIGURE_TIMELINE_TOPICS.find(t => t.id === _figTimelineTopic) || FIGURE_TIMELINE_TOPICS[0];
  if(!isNewsMode) posts = posts.filter(p => figureMatchesTopic(p,selectedTopic));
  // Self-heal stale/removed field values left behind by an older deployment.
  // This also protects deep links after the exported field taxonomy changes.
  if (!posts.length && _figTimelineMode === "all" && _figTimelineField !== "all" && _figTimelineTopic === "all") {
    _figTimelineField = "all";
    posts = (d.figures || []).flatMap(f => (f.posts || []).map(p => ({
      ...p, field: f.field,
      name_fa: p.name_fa || f.name_fa,
      role_fa: p.role_fa || f.role_fa,
      field_fa: f.field_fa || fields[f.field] || "",
      avatar: p.avatar || f.avatar,
      _newsPerson: false
    }))).sort((a,b) => figureActivityTime(b) - figureActivityTime(a));
  }
  const controls = `<div class="fig-tl-controls">
    <div class="imp-filter">
      <button class="fchip ${_figTimelineMode === "all" ? "on" : ""}" onclick="setFigureTimelineMode('all')">همه</button>
      <button class="fchip ${_figTimelineMode === "following" ? "on" : ""}" onclick="setFigureTimelineMode('following')">★ دنبال‌شده‌ها ${follows.size ? '<span class="chip-n">'+faN(follows.size)+'</span>' : ""}</button>
      ${(d.figures || []).some(f => (f.posts || []).some(p => p.kind === "news_statement")) ? `<button class="fchip ${_figTimelineMode === "news" ? "on" : ""}" onclick="setFigureTimelineMode('news')">چهره‌های خبر</button>` : ""}
    </div>
    <div class="fig-topic-filters" role="group" aria-label="تایم‌لاین‌های موضوعی">
      ${FIGURE_TIMELINE_TOPICS.map(t => `<button class="fchip ${_figTimelineTopic===t.id?"on":""}" onclick="setFigureTimelineTopic('${t.id}')" aria-pressed="${_figTimelineTopic===t.id}">${t.label}</button>`).join("")}
    </div>
    <select class="fig-field-select" onchange="setFigureTimelineField(this.value)" aria-label="حوزهٔ فعالیت چهره (مستقل از موضوع مطلب)" ${isNewsMode ? "disabled" : ""}>
      <option value="all">همهٔ تخصص‌ها</option>
      ${Object.entries(fields).map(([k,v]) => `<option value="${esc(k)}" ${_figTimelineField===k?"selected":""}>${esc(v)}</option>`).join("")}
    </select>
  </div>`;
  if (!posts.length) {
    const msg = _figTimelineMode === "following" && !follows.size
      ? "هنوز هیچ چهره‌ای را دنبال نکرده‌ای — روی ☆ کنار نام افراد بزن."
      : "در این فیلتر دیدگاه تازه‌ای نیست.";
    el.innerHTML = controls + `<div class="state"><div class="big">${msg}</div></div>`;
    return;
  }
  el.innerHTML = controls + `<div class="x-figure-stream">` + posts.slice(0, 40).map(p => `<article class="x-figure-post${isEditorialQuote(p) ? " is-quote" : ""}" ${statementCardAttrs(p)}>
    <div class="x-figure-avatar">${figureProfileLink(p, avatar(p, "sm"))}</div>
    <div class="x-figure-content">
      <div class="x-figure-head">
        <div class="x-figure-identity"><a class="x-figure-name" href="#/figure/${esc(p.handle)}" onclick="event.preventDefault();${p._newsPerson ? "openNewsPerson" : "openFigure"}('${esc(p.handle)}')">${esc(p.name_fa)}</a><span class="x-figure-role">${esc(p.role_fa || p.field_fa || "")}</span><span class="x-figure-dot">·</span><time>${relTime(p.published_at)}</time></div>
        ${figureFollowBtn(p.handle,true)}
      </div>
      ${p.kind === "news_statement" ? `<div class="x-figure-context">گفته در خبر · ${esc(p.source_name || "منبع خبری")}</div>` : ""}
      ${p.topic_fa ? `<h2 class="x-figure-topic">${esc(p.topic_fa)}</h2>` : ""}
      ${figureTextParagraphs(p, "x-figure-text")}${figureSourceNote(p)}
      ${telegramEmbed(p)}
      <div class="x-figure-actions">
        <button onclick="${p._newsPerson ? "openNewsPerson" : "openFigure"}('${esc(p.handle)}')">◯ <span>پروفایل</span></button>
        <button onclick="openStatement('${statementKey(p)}')">▢ <span>صفحهٔ گفته</span></button>
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">↗ <span>${sourceLinkLabel(p)}</span></a>` : ""}
      </div>
    </div>
  </article>`).join("") + `</div>`;
}

function figuresSection(list) {
  if (!list || !list.length) return "";
  return `<div class="layers"><h3 class="section-h">چهره‌ها <span class="n">دیدگاه شخصی — نه واقعیتِ خبر</span></h3>
    <div class="views">${list.map(p => figureCard(p, true)).join("")}</div>
    <p class="muted fig-note">دیدگاه‌های مستقیم از کانال‌های عمومی خود افراد و «گفته در خبر» از منابع خبری جدا برچسب می‌خورند؛ لینک هر مورد به منبع همان گفته می‌رود.
      <a href="#/figures" onclick="event.preventDefault();showFigures()">ورود به چهره‌ها</a></p></div>`;
}

