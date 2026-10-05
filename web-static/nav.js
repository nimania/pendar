/* Pendar — feed grouping + navigation openers. Extracted from app.js: the
   feed grouping/date utilities (groupedFeed, utcDayISO, dayLabel,
   groupedByCategory) and the archive/navigation openers — a day's archive
   (openDay), a trend dossier (openTrendDossier), a topic (openTopic), a
   canonical reference strip (referenceStrip), an entity (openEntity), the
   follow bar (followBar) and a source archive (openSource). Loaded as a
   classic script BEFORE app.js because route() reaches the openers on deep
   links and feed/story rendering calls groupedFeed/groupedByCategory. Uses
   feed.js (ALL, feedCard), entities.js, press.js (PRESS_SOURCES, showPress)
   and app.js helpers (show, setTab, showFeed) at runtime. No behavior
   change. */

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
