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
function figureCard(p, withName, detail = false) {
  const party = p.kind === "party_claim"
    ? `<span class="cstatus st-warn" title="این شخص خودش طرفِ این ماجراست">${KIND_NOTE.party_claim}</span>` : "";
  const head = withName
    ? `<div class="v-h">${figureProfileLink(p, avatar(p, "sm"))}<div class="fig-id"><a class="v-name" href="#/figure/${esc(p.handle)}" onclick="event.preventDefault();${p._newsPerson ? "openNewsPerson" : "openFigure"}('${esc(p.handle)}')">${esc(p.name_fa)}</a><span class="fig-role">${esc(p.role_fa)}</span></div><span class="spacer" style="flex:1"></span>${party}</div>`
    : `<div class="v-h"><span class="fig-topic">${esc(p.topic_fa || "")}</span><span class="spacer" style="flex:1"></span>${party}</div>`;
  return `<div class="view fig-view" ${detail ? "" : statementCardAttrs(p)}>${head}
    ${figureTextParagraphs(p)}${figureSourceNote(p)}
    <div class="fig-foot"><button class="fig-profile-link" onclick="openStatement(\'${statementKey(p)}\')">صفحهٔ این گفته</button><span class="muted">${relTime(p.published_at)}${p.source_language && p.source_language !== "fa" ? " · " + esc(p.translation_label_fa || ("ترجمه از " + p.source_language)) : ""}</span>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${p.kind === "news_statement" ? "منبع این گفته" : p.platform === "truthsocial" ? "پست اصلی در تروث سوشیال" : p.platform === "youtube" ? "ویدئو در یوتیوب" : "متن کامل در " + (String(p.url || "").includes("ble.ir/") ? "بله" : "تلگرام")} ↗</a>` : ""}</div></div>`;
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
function setFigureTimelineMode(mode) { _figTimelineMode = mode; renderFigureTimeline(); }
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
  // Self-heal stale/removed field values left behind by an older deployment.
  // This also protects deep links after the exported field taxonomy changes.
  if (!posts.length && _figTimelineMode === "all" && _figTimelineField !== "all") {
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
    <select class="fig-field-select" onchange="setFigureTimelineField(this.value)" aria-label="فیلتر حوزه" ${isNewsMode ? "disabled" : ""}>
      <option value="all">همهٔ حوزه‌ها</option>
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
  el.innerHTML = controls + `<div class="x-figure-stream">` + posts.slice(0, 40).map(p => `<article class="x-figure-post" ${statementCardAttrs(p)}>
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
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">↗ <span>متن اصلی</span></a>` : ""}
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

