
// One experimental 300x250 in-article display banner; no Native/Popunder/Social Bar.
function articleDisplayAdMarkup() {
  return '<aside class="story-inline-sponsor" aria-label="آگهی تبلیغاتی"'
    + ' style="margin:24px auto;padding:12px;border-top:1px solid #8884;border-bottom:1px solid #8884;max-width:100%;text-align:center">'
    + '<div style="font-size:11px;opacity:.65;margin-bottom:9px">آگهی · محتوای تبلیغاتی</div>'
    + '<div id="pendar-article-display-ad" style="width:300px;max-width:100%;min-height:250px;margin:0 auto"></div>'
    + '</aside>';
}
function loadArticleDisplayAd() {
  const slot=document.getElementById("pendar-article-display-ad");
  if (!slot || slot.dataset.requested==="1") return;
  slot.dataset.requested="1";
  // Set Adsterra options immediately before invoking the display tag.
  window.atOptions={key:"184394f0e43c2ef26ae4cfc176de3f42",format:"iframe",height:250,width:300,params:{}};
  const script=document.createElement("script");
  script.async=true;
  script.src="https://www.highrevenueformat.com/184394f0e43c2ef26ae4cfc176de3f42/invoke.js";
  slot.appendChild(script);
}

/* Pendar — story detail: the single-story page (openStory) and its helpers —
   relatedStories (the thread around a story), timelineSection,
   storyPeopleSuggestions and the ask/answer chips (showAsk, window._asks).
   Extracted from app.js; loaded as a classic script BEFORE app.js because
   route() reaches openStory on a #/story deep link and feed cards call it.
   Uses app.js helpers (feedCard, credBadge, geoBadge, detailGeoStrip, miniMap,
   peopleRow, referenceStrip, setArticleSeo), figures-core (figuresSection) and
   entities (canonicalStrip) at runtime. No behavior change. */

/* Linked and sourced Pendar editorial reports (build-time, never on page load).
   Only show an authored article when the exported model output has passed the
   server's citation and quality checks; otherwise retain existing summary. */
function pendarEditorialReport(s){
  const preview=window.PendarEditorialPilots?.[String(s?.id||"")];
  const report=s?.editorial_report||preview;
  if(!report || !["ai_draft","pilot_draft"].includes(report.status) || !Array.isArray(report.paragraphs) || report.paragraphs.length<3)return "";
  const pilot=report.status==="pilot_draft";
  const renderCitations=(items)=>{
    const refs=(Array.isArray(items)?items:[]).filter(c=>c && typeof c.url==="string" && (/^https?:\/\//i.test(c.url)||/^\/story\/[a-f0-9-]{36}\/$/i.test(c.url)));
    const content=refs.map(c=>{
      const href=c.url.startsWith("/story/")?"#/story/"+c.url.split("/")[2]:c.url;
      const ext=!c.url.startsWith("/story/");
      return '<a class="story-report-cite" href="'+esc(href)+'"'+(ext?' target="_blank" rel="noopener noreferrer"':"")+' aria-label="باز کردن استناد '+esc(c.id||"")+'">'+esc(c.id||"منبع")+'</a>';
    }).join("");
    return content?'<span class="story-report-cites">'+content+'</span>':"";
  };
  const rows=report.paragraphs.map(block=>{
    if(!block||typeof block.text_fa!=="string"||!Array.isArray(block.citations))return "";
    return '<p>'+esc(block.text_fa)+' '+renderCitations(block.citations)+'</p>';
  }).filter(Boolean).join("");
  if(!rows)return "";
  return '<article class="story-editorial" aria-label="متن گزارش">'
    +pendarAuthorByline(s,report)
    +(s.image_url?'<figure class="story-editorial-photo"><img class="hero-img" src="'+esc(s.image_url)+'" alt="'+esc(report.title_fa||s.headline_fa||"")+'" loading="eager" referrerpolicy="no-referrer"><figcaption class="hero-credit">'+esc(s.image_credit||"")+'</figcaption></figure>':'')
    +'<p class="story-editorial-lead">'+esc(report.lead_fa||"")+' '+renderCitations(report.lead_citations)+'</p>'
    +'<div class="story-editorial-body">'+rows+'</div>'
    +'</article>';
}
function pendarHistoricalContext(s){
  const context=s?.editorial_context;
  if(!context)return "";
  const past=Array.isArray(context.background)?context.background:[];
  const future=Array.isArray(context.later)?context.later:[];
  const all=past.concat(future);
  if(!all.length)return "";
  const render=(items)=>items.map(item=>{
    if(!item||typeof item.id!=="string"||!/^[a-f0-9-]{36}$/i.test(item.id))return "";
    const date=String(item.published_at||"").slice(0,10);
    return '<li><a href="#/story/'+esc(item.id)+'"><time datetime="'+esc(date)+'">'+esc(date)+'</time>'
      +'<span>'+esc(item.headline_fa||"خبر مرتبط")+'</span></a></li>';
  }).join("");
  return '<section class="story-history" aria-labelledby="story-history-heading">'
    +'<h2 id="story-history-heading">پیشینهٔ ماجرا و خبرهای مرتبط</h2>'
    +'<p class="story-history-caveat">ارتباط این خبرها بر پایهٔ اشتراک موضوعی است؛ لزوماً دنباله یا علت یکدیگر نیستند.</p>'
    +(past.length?'<h3>پیش از این خبر</h3><ol>'+render(past)+'</ol>':"")
    +(future.length?'<h3>تحولات مرتبط پس از این خبر</h3><ol>'+render(future)+'</ol>':"")
    +'</section>';
}

/* Historical fallback for stories exported before editorial_context was added. */
async function loadPendarHistoricalFallback(s){
 if(s && s.editorial_context)return;
 const host=document.getElementById("story-history-fallback");if(!host)return;
 try{
  const source=await getJSON(DATA+"/press-source-stories.json");
  if(document.getElementById("story-history-fallback")!==host)return;
  const entries=new Map();
  for(const group of Object.values(source||{}))if(Array.isArray(group))for(const row of group)if(row&&row.id)entries.set(row.id,row);
  const stop=new Set("این آن برای درباره گزارش خبری اخبار ایران ایرانی تهران خبر که در از با به را و یا امروز روز تازه جدید است شده بود گفت اعلام منتشر رسانه خبرگزاری بررسی کشور منطقه".split(" "));
  const words=t=>new Set((String(t||"").toLowerCase().replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/سوپرنفتکش|ابرنفتکش/g,"نفتکش").replace(/‌/g," ").match(/[\u0600-\u06ffA-Za-z0-9]{4,}/g)||[]).filter(w=>!stop.has(w)));
  const title=words(s.headline_fa),body=new Set([...title,...words(s.summary_fa)]);
  const anchor=Date.parse(s.published_at||"");if(title.size<2||!Number.isFinite(anchor))return;
  const earlier=[],later=[];
  for(const c of entries.values()){
   if(c.id===s.id||!/^[0-9a-f-]{36}$/i.test(c.id))continue;
   const date=Date.parse(c.published_at||"");
   if(!Number.isFinite(date)||Math.abs(anchor-date)>540*864e5||Math.abs(anchor-date)<36*36e5)continue;
   const heading=words(c.headline_fa),other=new Set([...heading,...words(c.summary_fa)]);
   const sharedHead=[...title].filter(w=>heading.has(w));
   const generic=new Set(["تنگه","هرمز","دریایی","نیروی","سپاه","امنیت","دولت","دومین","نظامی"]);
   if(!sharedHead.some(w=>!generic.has(w)))continue;
   const common=sharedHead.length,all=[...body].filter(w=>other.has(w)).length;
   if(common<2&&!(common>=1&&all>=3))continue;
   if(all<2||all/Math.max(1,Math.min(body.size,other.size))<.22)continue;
   (date<anchor?earlier:later).push({id:c.id,headline_fa:c.headline_fa,published_at:c.published_at,score:common*5+all*2});
  }
  const pick=(a,n)=>a.sort((x,y)=>y.score-x.score).slice(0,n).sort((x,y)=>String(x.published_at).localeCompare(String(y.published_at))).map(({score,...row})=>row);
  host.innerHTML=pendarHistoricalContext({editorial_context:{background:pick(earlier,4),later:pick(later,2)}});
 }catch(_){/* No unsupported context if archive is unavailable. */}
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

async function loadRelatedIranScenarioLinks(story) {
  const host=document.getElementById("story-scenarios");
  if(!host)return;
  const text=[story.headline_fa,story.summary_fa,story.what_happened_fa].join(" ");
  if(!/ایران|تهران|جمهوری\s*اسلامی|ریال/.test(text))return;
  let catalog;
  try{catalog=await getJSON(`${DATA}/iran-scenario-catalog.json`);}
  catch(_){return;}
  const normalized=v=>String(v||"").replace(/[ي]/g,"ی").replace(/[ك]/g,"ک").replace(/‌/g," ").toLowerCase();
  const hay=normalized(text);
  const rules={
    deal:/مذاکر|توافق|آتش.?بس|دیپلماسی|ترک مخاصمه/,
    regroup:/سرکوب|بازداشت|انقباض|اقتدارگرا/,
    war:/جنگ|بمباران|حمله|درگیری|موشک/,
    transition:/گذار|سرنگونی|فروپاشی|دولت موقت|انتقال قدرت/,
    attrition:/تورم|تحریم|ریال|فرسایش|رکود/,
    recovery:/چین|روسیه|سرمایه.?گذاری|وام/
  };
  const selected=(catalog.families||[]).filter(f=>rules[f.key]&&rules[f.key].test(hay)).slice(0,3);
  if(!selected.length)return;
  const subs=(catalog.scenarios||[]).filter(s=>selected.some(f=>f.key===s.family)&&
    (s.match_terms||[]).some(term=>normalized(term).length>=7&&hay.includes(normalized(term)))).slice(0,5);
  const htmlLinks=selected.map(f=>'<a href="/radar/iran-scenarios/'+esc(f.key)+'/">'+esc(f.title)+' ↗</a>').join(" · ");
  const subLinks=subs.map(s=>'<a href="/radar/iran-scenarios/'+esc(s.family)+'/'+esc(s.slug)+'/">'+esc(s.title)+' ↗</a>').join(" · ");
  host.innerHTML='<div class="layers"><h3 class="section-h">سناریوهای مرتبط در رادار پندار <span class="n">پیوند موضوعی؛ نه تأیید پیش‌بینی</span></h3>'+
     '<div class="views"><div class="view"><p>'+htmlLinks+'</p>'+(subLinks?'<p>'+subLinks+'</p>':"")+
     '<p class="muted">این پیوندها از تطبیق موضوع خبر با سناریوها به‌دست آمده‌اند؛ برای بررسی استدلال هر تحلیل‌گر و شواهد اصلی، پروندهٔ سناریو را باز کنید.</p></div></div></div>';
}

async function openStory(id) {
  // Defensive normalization for copied/encoded deep links.  A stray control
  // character (e.g. %01 before a UUID) previously produced a valid-looking
  // route that could never match an exported story JSON file.
  const rawId = String(id || "");
  const uuidMatch = rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const cleanId = uuidMatch ? uuidMatch[0] :
    (window.PENDAR_STORY_PERMALINKS?.slug_to_id?.[rawId] || rawId.replace(/[\\x00-\\x1F\\x7F]/g, "").trim());
  // Every existing UUID remains valid. For selected stories the stable
  // readable alias is the canonical public address.
  const canonicalPath=typeof window.pendarStoryURL==="function"
    ? window.pendarStoryURL(cleanId) : "/story/"+encodeURIComponent(cleanId)+"/";
  if (cleanId !== rawId && !window.PENDAR_STORY_PERMALINKS?.slug_to_id?.[rawId]) {
    history.replaceState(null, "", canonicalPath);
    updateRouteSeo(canonicalPath);
  } else {
    setHash(canonicalPath);
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
  const report=s.editorial_report||window.PendarEditorialPilots?.[String(s.id||"")];
  const editorial=!!(report && ["ai_draft","pilot_draft"].includes(report.status) && Array.isArray(report.paragraphs) && report.paragraphs.length>=3);
  const articleTitle=editorial?(report?.title_fa||s.headline_fa):s.headline_fa;
  if(typeof setArticleSeo==="function")setArticleSeo({...s,headline_fa:articleTitle,seo_title_fa:articleTitle,meta_description_fa:editorial?(report?.lead_fa||s.summary_fa):s.summary_fa});
  const [peopleSuggestions, storyBookData] = await Promise.all([storyPeopleSuggestions(s), loadBooks(), loadPendarEditorialAuthors().catch(()=>null)]);
  const storyBooks=(storyBookData.books||[]).filter(b=>(b.mentions||[]).some(m=>String(m.story_id||"")===String(cleanId)));
  const storyBooksSection=storyBooks.length?`<section class="story-books"><div class="rule"><span>کتاب‌های مرتبط با این خبر</span><span class="l"></span></div><div class="press-book-links">${storyBooks.map(b=>`<button onclick="openBook('${esc(b.slug)}')"><span>کتاب</span><b>${esc(b.title_fa||"")}</b></button>`).join("")}</div></section>`:"";
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join("");
  const views = (s.source_views || []).map(sv => `<div class="view"><div class="v-h"><span class="v-name">${esc(sv.source_name)}</span></div><p>${esc(sv.viewpoint_fa || "")}</p></div>`).join("");
  const cites = (s.sources || []).map(c => `<a class="cite" href="${esc(c.article_url || "#")}" target="_blank" rel="noopener noreferrer">
      <div class="c-body"><div class="c-src news-citation-publisher">${newsPublisherIdentity(newsPublisherSources({sources:[c]},1)[0]||{name:c.source_name||"منبع",domain:""})}</div><div class="c-title">${esc(c.original_headline || "")}</div></div>
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

  // Magazine sidebar uses only relevant items with a source image.
  const magazineRelated=relatedStories(s).filter(item=>item && /^https?:\/\//.test(String(item.image_url||""))).slice(0,6);
  const magazineSideStories=magazineRelated.map(item=>
    '<a class="magazine-side-story" href="'+(typeof window.pendarStoryURL==="function"?window.pendarStoryURL(item.id):"/story/"+encodeURIComponent(item.id)+"/")+'">'
    +'<span class="magazine-side-picture"><img src="'+esc(item.image_url)+'" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.magazine-side-story&quot;).remove()"></span>'
    +'<span class="magazine-side-story-title">'+esc(item.headline_fa||"")+'</span></a>'
  ).join("");


  v.innerHTML = `
    <div class="magazine-reader">
      <header class="magazine-masthead"><div class="magazine-container magazine-masthead-inner">
        <a class="magazine-brand" href="/" aria-label="خانهٔ پندار"><img src="/assets/pendar-logo.svg" alt="پندار"></a>
        <span class="magazine-masthead-tagline">خبر، اندیشه و فرهنگ</span>
        <a class="magazine-masthead-back" href="/">بازگشت به صفحهٔ اول ←</a>
      </div></header>
      <nav class="magazine-topnav" aria-label="بخش‌های پندار"><div class="magazine-container magazine-topnav-links">
        <a href="/">خانه</a><a href="/reports/">گزارش‌ها</a><a href="/headlines/">سرخط</a><a href="/figures/">چهره‌ها</a>
        <a href="/books/">کتاب</a><a href="/movies/">جان فیلم</a><a href="/press/">پیشخوان جراید</a>
      </div></nav>
      <div class="magazine-container magazine-article-container">
        <nav class="magazine-breadcrumb" aria-label="موقعیت صفحه"><a href="/">پندار</a><span>/</span>
          <a href="${editorial?"/reports/":"/headlines/"}">${editorial?"گزارش‌ها":"سرخط"}</a><span>/</span>
          <span>${esc(CAT_FA[s.category]||"خبر")}</span>
        </nav>
        <div class="magazine-article-layout">
          <article class="magazine-article-paper">
    <button class="back" onclick="showFeed()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg> بازگشت به سرخط</button>
    <div class="d-head"><div class="meta"><span class="chip">${CAT_FA[s.category] || "خبر"}</span><span class="dot"></span><span class="muted">${relTime(s.published_at)}</span>${trendBadge(s.trend)}<span class="spacer" style="flex:1"></span>${saveBtn(s.id)}</div>
      <h1>${esc(articleTitle || "")}</h1>
      <div class="d-meta" ${editorial?'hidden':""}><span class="imp ${imp.cls}"><span class="bars"><i></i><i></i><i></i></span><span class="lbl">${imp.lbl}</span></span>
        <span class="dot"></span><span class="muted">${faN(s.source_count || 0)} منبع</span>
        <span class="dot"></span><span class="muted">${IRAN_FA[s.iran_relevance] || ""}</span></div></div>
    ${!editorial && s.summary_fa ? `<p class="magazine-article-lead">${esc(s.summary_fa)}</p>` : ""}
    ${!editorial && s.image_url ? `<figure class="magazine-article-photo"><img class="hero-img" src="${esc(s.image_url)}" alt="" loading="eager" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()"></figure>` : ''}
    ${!editorial && s.image_url && s.image_credit ? `<div class="hero-credit">عکس از: ${esc(s.image_credit)}</div>` : ''}
    ${pendarEditorialReport(s)}
    ${!editorial?'<div class="magazine-news-narrative">'
       +(s.what_happened_fa&&s.what_happened_fa!==s.summary_fa?'<h2>چه اتفاقی افتاد؟</h2><p>'+esc(s.what_happened_fa)+'</p>':'')
       +(s.why_it_matters_fa&&s.why_it_matters_fa!==s.summary_fa&&s.why_it_matters_fa!==s.what_happened_fa?'<h2>چرا اهمیت دارد؟</h2><p>'+esc(s.why_it_matters_fa)+'</p>':'')
       +'</div>':""}
<aside class="pendar-telegram-promo telegram-prominent"><span class="telegram-mark" aria-hidden="true">➤</span><span class="telegram-copy"><strong>پندار در تلگرام</strong><p>خبرها و گزارش‌های منتخب را مستقیم در کانال دنبال کنید.</p></span><a href="https://t.me/pendario" target="_blank" rel="noopener noreferrer">عضویت در کانال ←</a></aside>
    ${!editorial?articleDisplayAdMarkup():""}
    <details class="story-examination"><summary><span>زیر ذره‌بین پندار<small class="story-examination-description">منابع، پیشینه، دیدگاه‌ها و پرسش‌وپاسخ</small></span></summary><div class="story-examination-body">
    ${pendarHistoricalContext(s)}
    <div id="story-history-fallback"></div>
    ${detailGeoStrip(s)}
    ${peopleRow(s.entities)}
    ${peopleSuggestions}
    ${storyBooksSection}

    ${futureNewsDetail(s)}
    <div id="story-scenarios"></div>
    ${known}
    ${cred}
    ${trendSec}
    ${relSection}
    <div class="layers"><h3 class="section-h">منابع چه می‌گویند <span class="n">دیدگاه هر منبع، جدا از واقعیت</span></h3><div class="views">${views || '<p class="muted">—</p>'}</div>${consensus}</div>
    ${quotedPeople}
    ${figuresSection(s.figures)}
    ${!editorial && ((String(s.what_happened_fa||"")+String(s.why_it_matters_fa||"")+String(s.summary_fa||"")).length >= 900 && (s.sources||[]).length >= 3) ? articleDisplayAdMarkup().replaceAll("pendar-article-display-ad","pendar-article-display-ad-second") : ""}
    <div class="layers"><h3 class="section-h">منابع و اطلاعات پرونده</h3><div class="d-meta"><span>${faN(s.source_count||0)} منبع</span> · <span>${esc(IRAN_FA[s.iran_relevance]||"")}</span></div><div class="cites">${cites}</div></div>
    <div class="ask"><div class="a-h"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" style="color:var(--accent)"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" stroke-linejoin="round"/></svg> دربارهٔ این خبر بپرس</div>
      <p class="a-sub">پاسخ‌های آماده از روی همین خبر.</p>
      <div class="chips">${chips}</div>
      <div class="answer" id="answer"><div class="a-bubble" id="a-bubble"></div>
        <div class="grounded"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg> مبتنی بر منابع همین خبر</div></div>
    </div>
    </div></details>
    <div id="story-discovery"></div>
          </article>
          <aside class="magazine-article-rail" aria-label="مطالب مرتبط"><section class="country-radar-panel" aria-label="رادار کشورها"><div class="country-radar-header"><span class="radar-indicator" aria-hidden="true"></span><h2>رادار کشورها</h2><a href="/radar/">همه ←</a></div><p class="country-radar-intro">تحولات و نشانه‌های مهم</p><a class="country-radar-item" href="/us-radar/"><span class="country-radar-flag" aria-hidden="true">🇺🇸</span><span><strong>رادار آمریکا</strong><small>تحولات سیاسی و پیامدها برای ایران</small></span><span class="country-radar-arrow">←</span></a><a class="country-radar-item" href="/israel-radar/"><span class="country-radar-flag" aria-hidden="true">🇮🇱</span><span><strong>رادار اسرائیل</strong><small>تحولات سیاسی و منطقه‌ای</small></span><span class="country-radar-arrow">←</span></a><a class="country-radar-item" href="/radar/iran-scenarios/"><span class="country-radar-flag" aria-hidden="true">🇮🇷</span><span><strong>سناریوهای ایران</strong><small>روندها و احتمال‌های آینده</small></span><span class="country-radar-arrow">←</span></a></section>
            <section class="magazine-rail-box">
              <div class="magazine-rail-heading"><h2>در همین موضوع</h2><a href="/headlines/">بیشتر ←</a></div>
              ${magazineSideStories||'<p class="magazine-rail-empty">خبرهای مرتبط در آرشیو پندار</p>'}
            </section>
            <section class="magazine-rail-nav"><h2>بیشتر در پندار</h2>
              <a href="/reports/">گزارش‌های تحریریه ←</a>
              <a href="/figures/">چهره‌ها و دیدگاه‌ها ←</a>
              <a href="/press/">پیشخوان جراید ←</a>
            </section>
          </aside>
        </div>
      </div>
      <footer class="magazine-article-footer"><div class="magazine-container">
        <a href="/">پندار</a><span>خبر، اندیشه و فرهنگ</span>
        <nav aria-label="پیوندهای پایین صفحه"><a href="/reports/">گزارش‌ها</a><a href="/headlines/">سرخط</a><a href="/books/">کتاب</a><a href="/movies/">فیلم و سریال</a></nav>
      </div></footer>
    </div>`;
  loadPendarHistoricalFallback(s);
  loadArticleDisplayAd();
  // Second placement only on substantial news stories; delay avoids competing
  // global atOptions mutations from the two network invocations.
  if(document.getElementById("pendar-article-display-ad-second")) {
    setTimeout(function(){
      if(!document.getElementById("pendar-article-display-ad-second"))return;
      const slot=document.getElementById("pendar-article-display-ad-second");
      if(slot.dataset.requested)return;
      slot.dataset.requested="1";
      window.atOptions={key:"184394f0e43c2ef26ae4cfc176de3f42",format:"iframe",height:250,width:300,params:{}};
      const js=document.createElement("script");
      js.async=true;
      js.src="https://www.highrevenueformat.com/184394f0e43c2ef26ae4cfc176de3f42/invoke.js";
      slot.appendChild(js);
    },2500);
  }
  renderContentDiscovery(document.getElementById("story-discovery"),s);
  loadRelatedIranScenarioLinks(s).catch(()=>{});
}
function showAsk(i) {
  document.querySelectorAll(".qchip").forEach(c => c.classList.remove("on"));
  document.getElementById("answer").classList.add("show");
  document.getElementById("a-bubble").textContent = (window._asks[i] || {}).a || "—";
}
