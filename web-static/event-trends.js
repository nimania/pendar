/* Event dossiers: bounded, conservative grouping of published story clusters.
   Broad topic/entity overlap alone never merges two events. No invented totals. */
(function(root) {
  const stop = new Set('از به با در و یا که را این آن برای درباره گزارش گزارشها گزارشهایی گزارش‌های گزارش‌هایی اخبار خبر تازه جدید اخیر ایران آمریکا کشور اعلام اظهارات واکنش بررسی تحولات گفت شد است شده می شود مورد پس یک دو بر اساس'.split(' '));
  function norm(v) { return String(v || '').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u064b-\u065f]/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim(); }
  function tokens(v) { return new Set(norm(v).split(' ').filter(x => x.length > 2 && !stop.has(x))); }
  function stamp(v) { const s = String(v || ''); return Date.parse(s && !/(Z|[+-]\d\d:\d\d)$/.test(s) ? s+'Z' : s) || 0; }
  function overlap(a,b) { return [...a].filter(x=>b.has(x)).length; }
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
  root.PendarEvents={build,same,norm,stamp};
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
    const groups=await loadEventTrends();
    el.innerHTML=`<div class="rule"><span>ماجراهای ترند</span><span class="l"></span></div>
      <p class="muted">هر ماجرا، گزارش‌های مرتبط با یک رویداد مشخص است. روی آن بزنید تا توضیح، تازه‌ترین گزارش‌ها و سیر ماجرا را بخوانید.</p>
      <div class="event-board">${groups.map((g,i)=>eventCard(g,i)).join('')||'<p class="muted">هنوز ماجرای تازه با پوشش چند رسانه ثبت نشده است.</p>'}</div>`;
  } catch (_) {el.innerHTML='<p class="muted">ماجراهای ترند فعلاً بارگذاری نشد. <button onclick="renderEventTrends()">تلاش دوباره</button></p>';}
}
async function renderHomeEvents() {
  const el=document.getElementById('home-events'); if(!el)return;
  try {
    const groups=await loadEventTrends();
    el.innerHTML=`<div class="home-panel-title"><span><b>ماجراهای ترند</b><small>چه خبر است و ماجرا از چه قرار است؟</small></span><a href="#/trends">همهٔ ماجراها ←</a></div>
      <div class="home-event-grid">${groups.slice(0,6).map((g,i)=>eventCard(g,i,true)).join('')||'<p class="muted">هنوز ماجرای تازه با پوشش چند رسانه ثبت نشده است.</p>'}</div>`;
  }catch(_){el.innerHTML='<p class="muted">ماجراهای ترند فعلاً در دسترس نیست.</p>';}
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
