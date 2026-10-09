/* Event dossiers: bounded, conservative grouping of published story clusters.
   Broad topic/entity overlap alone never merges two events. No invented totals. */
(function(root) {
  const stop = new Set('از به با در و یا که را این آن برای درباره گزارش گزارشها گزارشهایی گزارش‌های گزارش‌هایی اخبار خبر تازه جدید اخیر ایران آمریکا کشور اعلام اظهارات واکنش بررسی تحولات گفت شد است شده می شود مورد پس یک دو بر اساس'.split(' '));
  function norm(v) { return String(v || '').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u064b-\u065f]/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim(); }
  function tokens(v) { return new Set(norm(v).split(' ').filter(x => x.length > 2 && !stop.has(x))); }
  function stamp(v) { const s = String(v || ''); return Date.parse(s && !/(Z|[+-]\d\d:\d\d)$/.test(s) ? s+'Z' : s) || 0; }
  function overlap(a,b) { return [...a].filter(x=>b.has(x)).length; }
  function isIranStory(s) {
    return (s.countries||[]).some(c=>c.code==='IR') || (s.geo?.provinces||[]).length>0 ||
      (s.topics||[]).some(t=>t.slug==='iran') ||
      /(?:^|\s)(?:ایران|ایرانی|ایرانیان|تهران|هرمز|سپاه)(?:\s|$)/.test(norm((s.headline_fa||'')+' '+(s.summary_fa||'')));
  }
  function same(a,b) {
    if (Math.abs(stamp(a.published_at)-stamp(b.published_at)) > 36*3600000) return false;
    const x=tokens(a.headline_fa), y=tokens(b.headline_fa), n=overlap(x,y);
    const similarity=n/Math.max(1,Math.min(x.size,y.size));
    const entities=new Set((a.entities||[]).map(e=>e.slug));
    const common=(b.entities||[]).some(e=>entities.has(e.slug));
    return n>=3 && (similarity>=0.67 || (common && similarity>=0.5));
  }
  function build(stories, now=Date.now()) {
    const unique=new Map();
    (stories||[]).forEach(s=>{if(s.id && s.headline_fa && !/اخبار گوناگون|گزارش‌های پراکنده|اخبار متفرقه|مروری بر اخبار|تحلیل اخبار شهری|درگذشت‌های اخیر/.test(s.headline_fa)) unique.set(String(s.id),s);});
    const recent=[...unique.values()].filter(s=>stamp(s.published_at)>now-72*3600000 && stamp(s.published_at)<=now+3600000)
      .sort((a,b)=>stamp(a.published_at)-stamp(b.published_at));
    const groups=[];
    recent.forEach(s=>{
      // Match the anchor, not every member: prevents transitive mega-topics.
      const g=groups.find(g=>same(g.items[0],s));
      if(g) g.items.push(s); else groups.push({id:'event-'+s.id,items:[s]});
    });
    return groups.map(g=>{
      g.items.sort((a,b)=>stamp(b.published_at)-stamp(a.published_at));
      const lead=g.items.slice().sort((a,b)=>(b.source_count||0)-(a.source_count||0)||(b.importance_score||0)-(a.importance_score||0))[0];
      const sources=[...new Set(g.items.flatMap(s=>s.source_names||[]).filter(Boolean))];
      const sparks=g.items.map(s=>(s.trend||{}).spark||[]).filter(a=>a.length);
      const spark=Array.from({length:Math.max(0,...sparks.map(a=>a.length))},(_,i)=>sparks.reduce((n,a)=>n+(Number(a[i])||0),0));
      const velocity=g.items.reduce((n,s)=>n+(Number((s.trend||{}).velocity)||0),0);
      const updated=g.items[0].published_at;
      const age=Math.max(0,(now-stamp(updated))/3600000);
      const score=(Math.log1p(sources.length)*12+Math.log1p(velocity)*8+Math.log1p(g.items.length)*4+(lead.importance_score||0)*0.55)*Math.exp(-age/48);
      return {...g,title:lead.headline_fa,lead,sources,spark,updated,score,velocity,category:lead.category,
        sourceCount:sources.length,summary:lead.summary_fa||'',rising:g.items.some(s=>(s.trend||{}).rising)};
    }).filter(g=>g.sources.length>=2 || g.items.length>=2).sort((a,b)=>b.score-a.score).slice(0,30);
  }
  root.PendarEvents={build,same,norm,stamp,isIranStory};
  if(typeof module!=='undefined') module.exports=root.PendarEvents;
})(typeof window==='undefined'?globalThis:window);

async function loadEventTrends() {
  if (!ALL.length) ALL=await getJSON(`${DATA}/stories.json`);
  const archive=await getJSON(`${DATA}/event-trends.json`,30000).catch(()=>({events:[]}));
  return PendarEvents.build([...(archive.events||[]).flatMap(g=>g.items||[]),...ALL]);
}
function eventCard(g,rank,compact=false) {
  return `<a class="event-card ${compact?'event-compact':''}" href="#/event/${encodeURIComponent(g.id)}">
    <span class="event-rank">${faN(rank+1)}</span><span class="event-copy">
    <small>${esc(CAT_FA[g.category]||'خبر')} · ${g.rising?'در حال رشد':'در کانون خبرها'}</small>
    <b>${esc(g.title)}</b>${!compact&&g.summary?`<p>${esc(g.summary)}</p>`:''}
    <small>${faN(g.sourceCount)} رسانه · ${faN(g.items.length)} گزارش تجمیعی · ${relTime(g.updated)}</small>
    </span>${!compact&&g.spark.length?`<span class="event-spark">${svgSpark(g.spark,{w:110,h:32})}</span>`:''}<span class="event-arrow">←</span></a>`;
}
async function renderEventTrends() {
  const el=document.getElementById('event-trends');
  if(!el) return;
  try {
    const [res,eds]=await Promise.all([loadEventTrends().then(v=>({ok:true,v}),e=>({ok:false,e})),loadEditorialTrends()]);
    if(!res.ok&&!eds.length)throw res.e;
    const groups=res.ok?res.v:[];
    el.innerHTML=(eds.length?`<div class="rule"><span>ویژهٔ پندار</span><span class="l"></span></div><div class="editorial-board">${eds.map(editorialCard).join('')}</div>`:'')+`<div class="rule"><span>ماجراهای ترند</span><span class="l"></span></div>
      <p class="muted">هر ماجرا، گزارش‌های مرتبط با یک رویداد مشخص است. روی آن بزنید تا توضیح، تازه‌ترین گزارش‌ها و سیر ماجرا را بخوانید.</p>
      <div class="event-board">${groups.map((g,i)=>eventCard(g,i)).join('')||'<p class="muted">هنوز ماجرای تازه با پوشش چند رسانه ثبت نشده است.</p>'}</div>`;
  } catch (_) {el.innerHTML='<p class="muted">ماجراهای ترند فعلاً بارگذاری نشد. <button onclick="renderEventTrends()">تلاش دوباره</button></p>';}
}
async function renderHomeEvents() {
  const el=document.getElementById('home-events'); if(!el)return;
  try {
    const [res,eds]=await Promise.all([loadEventTrends().then(v=>({ok:true,v}),e=>({ok:false,e})),loadEditorialTrends()]);
    if(!res.ok&&!eds.length)throw res.e;
    const groups=(res.ok?res.v:[]).filter(g=>g.items.some(PendarEvents.isIranStory));
    el.innerHTML=`<div class="home-panel-title"><b>ماجراهای ترند ایران</b><div class="home-event-tools"><a href="#/trends">همهٔ ماجراها ←</a><button type="button" aria-label="ماجراهای قبلی" onclick="scrollHomeEvents(-1)">→</button><button type="button" aria-label="ماجراهای بعدی" onclick="scrollHomeEvents(1)">←</button></div></div>
      <div class="home-event-rail" aria-label="مرور ماجراهای ترند">${eds.map(homeEditorialTile).join('')}${groups.slice(0,6).map(homeEventCard).join('')||(eds.length?'':'<p class="muted">هنوز ماجرای تازه با پوشش چند رسانه ثبت نشده است.</p>')}</div>`;
  }catch(_){el.innerHTML='<p class="muted">ماجراهای ترند فعلاً در دسترس نیست.</p>';}
}
function homeEventCard(g,rank) {
  const image=g.lead?.image_url||g.items.find(s=>s.image_url)?.image_url;
  return `<a class="home-event-tile" href="#/event/${encodeURIComponent(g.id)}" title="${esc(g.title)}">
    <span class="home-event-photo"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 36h32M12 29l8-9 8 5 9-14M29 11h8v8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>${image&&/^https?:\/\//.test(image)?`<img src="${esc(image)}" alt="" loading="lazy" onerror="this.remove()">`:''}<span class="home-event-number">${faN(rank+1)}</span></span>
    <span class="home-event-caption"><b>${esc(g.title)}</b><small>${g.rising?'<i class="home-event-rising" title="در حال رشد">↗</i>':''}${faN(g.sourceCount)} رسانه <span>· ${relTime(g.updated)}</span></small></span></a>`;
}
function scrollHomeEvents(direction) {
  const rail=document.querySelector('.home-event-rail');
  if(rail)rail.scrollBy({left:-direction*rail.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
let _activeEvent=null, _eventRequest=0;
async function openEventDossier(id) {
  const request=++_eventRequest;
  setHash('#/event/'+encodeURIComponent(id));show('topicarchive');setTab('trends');
  document.getElementById('ta-back-t').textContent='بازگشت به بورس اخبار';
  document.getElementById('ta-back').onclick=showTrends;
  document.getElementById('ta-title').textContent='ماجرا';
  document.getElementById('ta-sub').textContent='';
  const el=document.getElementById('ta-feed');el.innerHTML='<div class="spinner"></div>';
  if(String(id).startsWith('editorial-'))return openEditorialDossier(id,request,el);
  try {
    const groups=await loadEventTrends();
    let g=groups.find(x=>x.id===id);
    if(!g && /^event-[0-9a-f-]{36}$/i.test(id)) {
      const s=await getJSON(`${DATA}/story/${id.slice(6)}.json`).catch(()=>null);
      if(s) g={id,title:s.headline_fa,lead:s,items:[s],sources:s.source_names||(s.sources||[]).map(x=>x.source_name),updated:s.published_at};
    }
    if(request!==_eventRequest || currentRoute()!=='event/'+id)return;
    if(!g){el.innerHTML='<div class="state"><div class="big">این ماجرا در آرشیو فعلی پیدا نشد</div><a href="#/trends">ماجراهای تازه ←</a></div>';return;}
    _activeEvent=g;
    document.getElementById('ta-title').textContent=g.title;
    document.getElementById('ta-sub').textContent=`${faN(g.sources.length)} رسانه · ${faN(g.items.length)} گزارش تجمیعی · آخرین گزارش ${relTime(g.updated)}`;
    const paragraphs=g.items.filter(s=>s.summary_fa).slice(0,3);
    el.innerHTML=`<div class="event-layout"><div><section class="trend-dossier event-summary">
      <div class="rule"><span>جانِ ماجرا</span><span class="l"></span></div>
      ${paragraphs.length?paragraphs.map((s,i)=>`<p class="kalam">${i?'<b>در گزارش مرتبط: </b>':''}${esc(s.summary_fa)} <a href="#/story/${encodeURIComponent(s.id)}">گزارش و منابع ←</a></p>`).join(''):'<p class="kalam">توضیح تفصیلی در گزارش اصلی این ماجرا در دسترس است.</p>'}
      <p class="muted">این توضیح از خلاصهٔ گزارش‌های پندار گردآوری شده و با گزارش‌های تازه تغییر می‌کند. تعداد رسانه‌ها بر اساس نام‌های یکتای ثبت‌شده است.</p>
      </section><div class="home-panel-tabs" role="tablist" aria-label="گزارش‌های ماجرا">
      ${[['selected','برگزیده'],['latest','تازه‌ترین'],['analysis','تحلیل‌ها']].map(([k,n])=>`<button role="tab" data-event-tab="${k}" aria-selected="false" onclick="setEventTab('${k}')">${n}</button>`).join('')}</div><div id="event-feed"></div></div>
      <aside class="event-aside"><div id="event-people"></div><div class="rule"><span>رسانه‌های پوشش‌دهنده</span><span class="l"></span></div><div class="event-sources">${g.sources.map(n=>`<span class="chip">${esc(n)}</span>`).join('')}</div>
      <div class="rule"><span>سیر ماجرا</span><span class="l"></span></div><div class="timeline">${g.items.slice().reverse().map(s=>`<a class="tl-item" href="#/story/${encodeURIComponent(s.id)}"><span class="tl-dot"></span><span class="tl-body"><small class="tl-time">${relTime(s.published_at)}</small><span class="tl-h">${esc(s.headline_fa)}</span></span></a>`).join('')}</div></aside></div>`;
    setEventTab('selected');
    const people=await storyPeopleSuggestions({...g.lead,entities:[...new Map(g.items.flatMap(s=>s.entities||[]).map(e=>[e.slug,e])).values()]});
    if(request===_eventRequest && document.getElementById('event-people'))document.getElementById('event-people').innerHTML=people;
  }catch(_){if(request===_eventRequest)el.innerHTML='<p class="muted">ماجرا بارگذاری نشد. <a href="#/trends">بازگشت به ماجراها</a></p>';}
}
function setEventTab(k) {
  if(!_activeEvent)return;
  document.querySelectorAll('[data-event-tab]').forEach(b=>{const on=b.dataset.eventTab===k;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));});
  let items=_activeEvent.items.slice();
  if(k==='analysis')items=items.filter(s=>s.content_type==='analysis'||s.kind==='analysis'||/تحلیل|یادداشت|گفتگو|گفت‌وگو/.test(s.headline_fa||''));
  items.sort(k==='latest'?(a,b)=>PendarEvents.stamp(b.published_at)-PendarEvents.stamp(a.published_at):(a,b)=>(b.importance_score||0)-(a.importance_score||0)||(b.source_count||0)-(a.source_count||0));
  document.getElementById('event-feed').innerHTML=items.length?`<div class="feed">${items.map(feedCard).join('')}</div>`:'<p class="muted">هنوز تحلیل جداگانه‌ای برای این ماجرا ثبت نشده است.</p>';
}

/* «ماجرای ویژهٔ پندار»: hand-written, source-attributed explainers pinned above
   the automatic event board. Same editorial contract as stories — facts, views,
   synthesis and uncertainty kept apart; summaries + links, never copied articles.
   Data: data/pendar-editorial-trends.json (edit that file to publish/retire). */
let _editorialCache=null;
async function loadEditorialTrends() {
  if(_editorialCache)return _editorialCache;
  const d=await getJSON(`${DATA}/pendar-editorial-trends.json`,15000).catch(()=>({items:[]}));
  const now=Date.now();
  _editorialCache=(d.items||[]).filter(x=>x&&x.id&&x.title&&x.status!=='draft'&&(!x.expires_at||PendarEvents.stamp(x.expires_at)>now))
    .sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||PendarEvents.stamp(b.updated_at||b.published_at)-PendarEvents.stamp(a.updated_at||a.published_at));
  return _editorialCache;
}
function editorialImage(d,eager=false) {
  if(!d.image)return '';
  const fallback=d.image_fallback||d.image;
  return `<picture>${d.image_fallback?`<source srcset="${esc(d.image)}" type="image/webp">`:''}<img src="${esc(fallback)}" alt="${esc(d.image_alt||'')}" ${eager?'fetchpriority="high"':'loading="lazy"'} onerror="this.closest('picture').remove()"></picture>`;
}
function editorialMeta(d) {
  return `${faN((d.sources||[]).length)} منبع · به‌روزرسانی ${relTime(d.updated_at||d.published_at)}`;
}
function editorialCard(d) {
  return `<a class="editorial-card" href="#/event/${encodeURIComponent(d.id)}">
    <span class="editorial-media">${editorialImage(d)}</span>
    <span class="editorial-copy"><small class="editorial-kicker">${esc(d.kicker||'ماجرای ویژه')}</small>
    <b>${esc(d.title)}</b>${d.dek?`<p>${esc(d.dek)}</p>`:''}<small>${editorialMeta(d)}</small></span><span class="event-arrow">←</span></a>`;
}
function homeEditorialTile(d) {
  return `<a class="home-event-tile home-editorial-tile" href="#/event/${encodeURIComponent(d.id)}" title="${esc(d.title)}">
    <span class="home-event-photo">${editorialImage(d)}<span class="home-event-number home-editorial-badge">ویژه</span></span>
    <span class="home-event-caption"><b>${esc(d.title)}</b><small>${esc(d.kicker||'ماجرای ویژه')} <span>· ${relTime(d.updated_at||d.published_at)}</span></small></span></a>`;
}
function editorialRefs(d,ids) {
  const list=d.sources||[];
  return (ids||[]).map(id=>{const i=list.findIndex(x=>x.id===id);if(i<0)return '';const x=list[i];
    return `<a class="src-ref" href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.name+' — '+x.title)}">${faN(i+1)}</a>`;}).join('');
}
function editorialSection(d,sec) {
  const head=`<div class="rule"><span>${esc(sec.title||'')}</span><span class="l"></span></div>`;
  const items=(sec.items||[]).map(it=>`<li>${it.who?`<b>${esc(it.who)}: </b>`:''}${esc(it.text)}${it.src?`<span class="src-refs">${editorialRefs(d,it.src)}</span>`:''}</li>`).join('');
  const paras=(sec.paragraphs||[]).map(p=>`<p class="kalam">${esc(p)}</p>`).join('');
  return `<section class="editorial-section editorial-${esc(sec.kind||'text')}">${head}${paras}${items?`<ul class="editorial-list">${items}</ul>`:''}</section>`;
}
function editorialOutlook(d) {
  if(!(d.outlook||[]).length)return '';
  const rows=d.outlook.map(o=>{const lv=Math.max(0,Math.min(5,Number(o.level)||0));
    return `<div class="outlook-row"><div class="outlook-label"><b>${esc(o.label)}</b>${o.note?`<small>${esc(o.note)}</small>`:''}</div>
      <div class="outlook-meter" role="img" aria-label="${esc(o.level_fa||'')}">${Array.from({length:5},(_,i)=>`<i class="${i<lv?'on':''}"></i>`).join('')}<span>${esc(o.level_fa||'')}</span></div></div>`;}).join('');
  return `<section class="editorial-section"><div class="rule"><span>احتمال‌ها در یک نگاه</span><span class="l"></span></div><div class="editorial-outlook">${rows}</div>${d.outlook_note?`<p class="muted">${esc(d.outlook_note)}</p>`:''}</section>`;
}
async function openEditorialDossier(id,request,el) {
  try {
    const d=(await loadEditorialTrends()).find(x=>x.id===id);
    if(request!==_eventRequest || currentRoute()!=='event/'+id)return;
    if(!d){el.innerHTML='<div class="state"><div class="big">این ماجرا پیدا نشد</div><a href="#/trends">ماجراهای تازه ←</a></div>';return;}
    _activeEvent=null;
    document.title=d.title+' | پندار';
    document.getElementById('ta-title').textContent=d.title;
    document.getElementById('ta-sub').textContent=`${d.kicker||'ماجرای ویژه'} · ${editorialMeta(d)}`;
    const terms=(d.match_terms||[]).map(t=>PendarEvents.norm(t).toLowerCase()).filter(Boolean);
    if(!ALL.length){try{ALL=await getJSON(`${DATA}/stories.json`);}catch(_){}}
    if(request!==_eventRequest)return;
    const related=terms.length?ALL.filter(s=>{const h=PendarEvents.norm((s.headline_fa||'')+' '+(s.summary_fa||'')).toLowerCase();return terms.some(t=>h.includes(t));})
      .sort((a,b)=>PendarEvents.stamp(b.published_at)-PendarEvents.stamp(a.published_at)).slice(0,8):[];
    const sources=(d.sources||[]).map((x,i)=>`<li><span class="src-n">${faN(i+1)}</span><a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b><span>${esc(x.title)}</span></a>${x.date?`<small>${esc(x.date)}</small>`:''}</li>`).join('');
    el.innerHTML=`<div class="event-layout editorial-dossier"><div>
      ${d.image?`<figure class="editorial-hero">${editorialImage(d,true)}${d.image_credit?`<figcaption>${esc(d.image_credit)}</figcaption>`:''}</figure>`:''}
      ${d.dek?`<p class="editorial-dek">${esc(d.dek)}</p>`:''}
      ${d.short_answer?`<section class="editorial-section editorial-answer"><div class="rule"><span>پاسخ کوتاه</span><span class="l"></span></div><p class="kalam">${esc(d.short_answer)}</p></section>`:''}
      ${editorialOutlook(d)}
      ${(d.sections||[]).map(sec=>editorialSection(d,sec)).join('')}
      ${related.length?`<section class="editorial-section"><div class="rule"><span>تازه‌ترین گزارش‌های مرتبط در پندار</span><span class="l"></span></div><div class="feed">${related.map(feedCard).join('')}</div></section>`:''}
      <p class="muted editorial-note">این توضیح را تحریریهٔ پندار از گزارش‌های منابع فهرست‌شده گردآوری کرده است؛ واقعیت، روایت طرف‌ها، جمع‌بندی و نامعلوم‌ها جدا آمده‌اند و از متن منابع فقط خلاصه و پیوند آمده است. شماره‌های کنار هر بند به منبع آن اشاره دارد.</p>
      </div><aside class="event-aside">
      ${(d.watch||[]).length?`<div class="rule"><span>چه چیزهایی را دنبال کنیم؟</span><span class="l"></span></div><ul class="editorial-watch">${d.watch.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}
      <div class="rule"><span>منابع</span><span class="l"></span></div><ol class="editorial-sources">${sources}</ol></aside></div>`;
  }catch(_){if(request===_eventRequest)el.innerHTML='<p class="muted">ماجرا بارگذاری نشد. <a href="#/trends">بازگشت به ماجراها</a></p>';}
}
