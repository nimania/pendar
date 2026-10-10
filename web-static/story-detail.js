/* Pendar — story detail: the single-story page (openStory) and its helpers —
   relatedStories (the thread around a story), timelineSection,
   storyPeopleSuggestions and the ask/answer chips (showAsk, window._asks).
   Extracted from app.js; loaded as a classic script BEFORE app.js because
   route() reaches openStory on a #/story deep link and feed cards call it.
   Uses app.js helpers (feedCard, credBadge, geoBadge, detailGeoStrip, miniMap,
   peopleRow, referenceStrip, setArticleSeo), figures-core (figuresSection) and
   entities (canonicalStrip) at runtime. No behavior change. */

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
    ${futureNewsDetail(s)}
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
    </div><div id="story-discovery"></div>`;
  renderContentDiscovery(document.getElementById("story-discovery"),s);
}
function showAsk(i) {
  document.querySelectorAll(".qchip").forEach(c => c.classList.remove("on"));
  document.getElementById("answer").classList.add("show");
  document.getElementById("a-bubble").textContent = (window._asks[i] || {}).a || "—";
}
