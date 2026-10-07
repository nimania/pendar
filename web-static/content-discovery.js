/* Contextual internal reading paths. Explicit relationships first; shared
   headline terms second. Never infer a response, disagreement or quotation. */
const DISCOVERY_STOP=new Set('این آن برای درباره گزارش خبر گفته ایران آمریکا کشور امروز جدید تازه است شده شود بود دارد کرده کرد های هایش همین همه خود توسط یک دو سه بر اساس مورد گفت اعلام می در از به با که را و یا'.split(' '));
function discoveryTerms(value){return new Set(PendarEvents.norm(value).split(' ').filter(x=>x.length>2&&!DISCOVERY_STOP.has(x)));}
function discoveryOverlap(a,b){return [...a].filter(x=>b.has(x)).length;}
function discoveryRelated(context,items,limit=4){
  const words=discoveryTerms([context.headline_fa,context.topic_fa,context.summary_fa].filter(Boolean).join(' '));
  const entities=new Set((context.entities||[]).map(e=>e.slug));
  const unique=[...new Map(items.filter(s=>String(s.id)!==String(context.id)).map(s=>[String(s.id),s])).values()];
  return unique.map(s=>{
    const other=discoveryTerms([s.headline_fa,s.topic_fa,s.summary_fa].filter(Boolean).join(' '));
    const shared=discoveryOverlap(words,other),person=(s.entities||[]).some(e=>entities.has(e.slug));
    const explicit=context.story_id&&String(context.story_id)===String(s.id);
    const match=explicit||(shared>=3&&shared/Math.max(1,Math.min(words.size,other.size))>=0.12)||(shared>=2&&person);
    return {s,match,score:(explicit?100:0)+shared+(person?2:0)};
  }).filter(x=>x.match).sort((a,b)=>b.score-a.score||String(b.s.published_at||'').localeCompare(String(a.s.published_at||''))).slice(0,limit).map(x=>x.s);
}
function discoveryCard(kind,row,label){
  const title=row.headline_fa||row.video_title||row.topic_fa||'مطالعهٔ بیشتر';
  const summary=String(row.summary_fa||'');
  const image=row.image_url||row.media_url;
  return `<a class="discovery-card" href="#/${kind}/${encodeURIComponent(row.id)}">${image&&/^https?:\/\//.test(image)?`<img src="${esc(image)}" alt="" loading="lazy" onerror="this.remove()">`:''}<span><small>${esc(label)}${row.published_at?' · '+relTime(row.published_at):''}</small><b>${esc(title==='گفته در خبر'?summary.slice(0,110):title)}</b>${summary&&title!=='گفته در خبر'?`<p>${esc(summary)}</p>`:''}</span><i>←</i></a>`;
}
function discoverySection(title,body){return body?`<section class="discovery-section"><div class="rule"><span>${esc(title)}</span><span class="l"></span></div>${body}</section>`:'';}
async function renderContentDiscovery(el,context,person=null,expectedRoute=currentRoute()){
  try{
    if(!ALL.length)ALL=await getJSON(`${DATA}/stories.json`);
    const [figures,events]=await Promise.all([loadFigures().catch(()=>({figures:[]})),loadEventTrends().catch(()=>[])]);
    if(!document.contains(el)||currentRoute()!==expectedRoute)return;
    const related=discoveryRelated(context,ALL);
    const storyIds=new Set([context.story_id,...(context.headline_fa?[context.id]:[]),...related.map(s=>s.id)].filter(Boolean).map(String));
    const eventRows=events.filter(g=>g.items.some(s=>storyIds.has(String(s.id)))).slice(0,2);
    const people=figures.figures||[];
    const candidates=people.flatMap(f=>(f.posts||[]).filter(p=>String(p.id)!==String(context.id)).map(p=>({...p,_person:f})));
    const linked=discoveryRelated(context,candidates,4);
    const samePerson=person?(person.posts||[]).filter(p=>String(p.id)!==String(context.id)).slice().sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||''))).slice(0,3):[];
    const used=new Set(samePerson.map(p=>String(p.id)));
    const posts=linked.filter(p=>!used.has(String(p.id))).slice(0,3);
    const topics=(context.topics||[]).filter(t=>t.slug).slice(0,4);
    el.innerHTML=discoverySection('ماجرا را دنبال کنید',eventRows.map((g,i)=>eventCard(g,i,true)).join(''))+
      discoverySection('گزارش‌های مرتبط',`<div class="discovery-grid">${related.map(s=>discoveryCard('story',s,'ارتباط موضوعی')).join('')}</div>`.replace('<div class="discovery-grid"></div>',''))+
      discoverySection('گفته‌ها و تحلیل‌های مرتبط',posts.length?`<div class="discovery-grid">${posts.map(p=>discoveryCard('statement',p,p._person.name_fa||'چهره')).join('')}</div>`:'')+
      discoverySection('از همین چهره',samePerson.length?`<a class="discovery-person" href="#/figure/${encodeURIComponent(person.handle)}">همهٔ گفته‌های ${esc(person.name_fa)} ←</a><div class="discovery-grid">${samePerson.map(p=>discoveryCard('statement',p,person.name_fa)).join('')}</div>`:'')+
      `<nav class="discovery-paths" aria-label="مسیرهای بیشتر در پندار">${topics.map(t=>`<a href="#/topic/${encodeURIComponent(t.slug)}">${esc(t.name_fa||t.slug)} ←</a>`).join('')}<a href="#/trends">ماجراهای ترند ←</a><a href="#/headlines">سرخط خبرها ←</a><a href="#/figures">چهره‌ها و گفته‌ها ←</a></nav>`;
  }catch(_){if(document.contains(el)&&currentRoute()===expectedRoute)el.innerHTML='<nav class="discovery-paths"><a href="#/trends">ماجراهای ترند ←</a><a href="#/headlines">سرخط خبرها ←</a></nav>';}
}
async function renderHeadlinesDiscovery(){
  const el=document.getElementById('headlines-discovery');if(!el)return;
  try{
    const [events,figures]=await Promise.all([loadEventTrends().catch(()=>[]),loadFigures().catch(()=>({figures:[]}))]);
    const seen=new Set();
    const posts=(figures.figures||[]).flatMap(f=>(f.posts||[]).map(p=>({...p,_person:f}))).filter(p=>p.summary_fa&&p.published_at)
      .sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at))).filter(p=>{if(seen.has(p._person.handle))return false;seen.add(p._person.handle);return true;}).slice(0,3);
    el.innerHTML=`<div class="headlines-discovery-grid"><section>${discoverySection('پشت این سرخط‌ها چه ماجرایی است؟',events.slice(0,3).map((g,i)=>eventCard(g,i,true)).join(''))}</section><section>${discoverySection('تازه‌ترین گفته‌های چهره‌ها',posts.map(p=>discoveryCard('statement',p,p._person.name_fa)).join(''))}</section></div><nav class="discovery-paths"><a href="#/trends">همهٔ ماجراها ←</a><a href="#/figures">چهره‌ها و گفته‌ها ←</a><a href="#/videos/recaps">جان کلام ویدئوها ←</a></nav>`;
  }catch(_){el.innerHTML='';}
}
