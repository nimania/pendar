/* Pendar — header smart search: natural-language, cross-dataset local
   retrieval over stories, books, figures, press and topics. Extracted from
   app.js; loaded as a classic script BEFORE app.js. Wired to the header box
   via inline onclick/oninput in index.html; builds its doc index lazily from
   the dataset loaders (loadFigures, loadBooks, loadPressDirectory...) at
   runtime, after every script has loaded. No behavior change. */

// Header smart search — natural-language, cross-dataset local retrieval.
let _smartSearchTimer=null, _smartSearchDocs=null;
function toggleSmartSearch(force){
  const box=document.getElementById("smart-search");
  const open=typeof force==="boolean"?force:!box.classList.contains("open");
  box.classList.toggle("open",open);
  if(open) setTimeout(()=>document.getElementById("smart-search-input")?.focus(),30);
}
function smartSearchKey(e){ if(e.key==="Escape"){toggleSmartSearch(false);e.currentTarget.blur();} }
function _sq(s){return String(s||"").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim()}
const _SS_STOP=new Set("چه کدام کی کسی کسانی درباره در مورد را رو از به با برای که آیا و یا یک این آن های ها است هست هستند بوده شده می شود میکند می‌کند کرده کنند گفته گفت حرف نظر دیدگاه خبر اخبار رسانه رسانه‌ها نشریه نشریات".split(" "));
const _SS_SEM={
  "جنگ":["جنگ","درگیری","حمله","نظامی","نبرد","موشکی","آتش بس","آتش‌بس","تنش"],
  "احتمال":["احتمال","ممکن","خطر","هشدار","پیش بینی","پیش‌بینی","سناریو","انتظار"],
  "اقتصاد":["اقتصاد","اقتصادی","تورم","رکود","رشد","بازار","معیشت"],
  "دلار":["دلار","ارز","نرخ ارز","ریال","تومان"],
  "حجاب":["حجاب","پوشش","عفاف"],
  "آب":["آب","خشکسالی","سد","کم آبی","کم‌آبی","منابع آبی"],
  "آلودگی":["آلودگی","هوا","ریزگرد","گرد و غبار","گردوغبار"],
  "هوش":["هوش مصنوعی","هوش","AI","مدل زبانی","یادگیری ماشین"],
  "انتخابات":["انتخابات","رای","رأی","نامزد","صندوق"],
  "تحریم":["تحریم","تحریم‌ها","محدودیت اقتصادی","فشار اقتصادی"],
  "مذاکره":["مذاکره","گفتگو","گفت‌وگو","دیپلماسی","توافق"],
  "هسته‌ای":["هسته‌ای","هسته ای","اتمی","غنی سازی","غنی‌سازی"]
};
function _ssStem(t){return t.replace(/(هایی|های|ها|ترین|تر|ی)$/,"")}
function _ssQuery(q){
  const n=_sq(q), raw=n.split(" ").filter(Boolean), base=raw.filter(t=>!_SS_STOP.has(t)).map(_ssStem).filter(t=>t.length>1);
  const expanded=new Set(base);
  for(const t of base) for(const [k,vals] of Object.entries(_SS_SEM)) if(t===_ssStem(k)||vals.some(v=>_sq(v).split(" ").map(_ssStem).includes(t))) vals.forEach(v=>_sq(v).split(" ").forEach(x=>expanded.add(_ssStem(x))));
  const personIntent=/چه\s*کسان|چه\s*کسی|کی\s|افراد|چهره/.test(n);
  const sourceIntent=/چه\s*رسانه|کدام\s*رسانه|چه\s*نشریه|کدام\s*نشریه|منابع/.test(n);
  return {n,base:[...new Set(base)],terms:[...expanded].filter(Boolean),personIntent,sourceIntent};
}
function _ssScore(d,Q){
  const t=_sq(d.text), title=_sq(d.title), words=new Set(t.split(" ").map(_ssStem));
  let score=0, hits=0;
  for(const z0 of Q.terms){
    const z=_ssStem(z0); if(!z) continue;
    if(title.includes(z)){score+=9;hits++}
    else if(t.includes(z)){score+=3;hits++}
    else if(z.length>=4 && [...words].some(w=>w.length>=4&&(w.startsWith(z)||z.startsWith(w)))){score+=1.2;hits++}
  }
  if(Q.base.length && Q.base.every(z=>t.includes(z)||title.includes(z)))score+=8;
  if(Q.personIntent&&d.kind==="دیدگاه")score+=7;
  if(Q.sourceIntent&&["جریده","مطلب جریده"].includes(d.kind))score+=7;
  if(d.kind==="چهره"&&title===Q.n)score+=30;
  if(d.canonicalId&&title===Q.n)score+=45;
  if(d.canonicalId)score+=2;
  return score+(hits?Math.min(hits,5):0);
}
function _ssHumanRoles(roles){
  const labels={
    figure:"چهره",
    book_person:"پدیدآورندهٔ کتاب",
    content_source:"منبع محتوایی",
    author:"نویسنده",
    translator:"مترجم",
    editor:"ویراستار",
    director:"کارگردان",
    actor:"بازیگر",
    publisher:"ناشر",
    journalist:"روزنامه‌نگار",
    researcher:"پژوهشگر"
  };
  return [...new Set((roles||[]).map(r=>{
    const raw=String(r||"").trim();
    if(!raw)return "";
    if(labels[raw])return labels[raw];
    // Never leak internal role codes into the public search UI.
    if(/^[a-z0-9_:-]+$/i.test(raw))return "";
    return raw;
  }).filter(Boolean))].join(" · ");
}

async function _buildSmartSearchDocs(){
  if(_smartSearchDocs) return _smartSearchDocs;
  const docs=[];
  try{
    const f=await loadFigures();
    (f.figures||[]).forEach(x=>{
      const posts=x.posts||[];
      // Every real directory profile belongs in global search, even before it
      // has a published statement. Media/source adapters remain excluded.
      if(x.directory!==false){
        docs.push({
          kind:"چهره",
          title:x.name_fa,
          sub:x.role_fa||"",
          handle:x.handle,
          go:`openFigure('${String(x.handle).replace(/'/g,"\\'")}')`,
          text:[x.name_fa,x.role_fa,x.handle,...(x.aliases||[])].join(" "),
          aliases:x.aliases||[],
          count:Number(x.count||posts.length||0)
        });
      }
      posts.forEach(p=>docs.push({kind:"دیدگاه",title:x.name_fa,sub:p.topic_fa||p.source_name||"دیدگاه",handle:x.handle,go:`openStatement('${String(statementKey(p)).replace(/'/g,"\\'")}')`,text:[x.name_fa,x.role_fa,...(x.aliases||[]),p.topic_fa,p.summary_fa,p.source_name].join(" "),snippet:p.summary_fa||""}));
    });
  }catch(_){}
  try{
    const feed=await getJSON(`${DATA}/feed.json`), arr=Array.isArray(feed)?feed:(feed.items||[]);
    arr.forEach(x=>docs.push({kind:"خبر",title:x.headline_fa||x.title_fa||x.title||"",sub:(x.source_names||[]).slice(0,3).join(" · "),go:`openStory('${x.id}')`,text:[x.headline_fa,x.summary_fa,x.what_happened_fa,(x.source_names||[]).join(" ")].join(" "),snippet:x.summary_fa||x.what_happened_fa||""}));
  }catch(_){}
  const visiblePressNames=new Set();
  try{
    const manifest=await loadPressDirectory();
    (manifest||[]).forEach(x=>{if(x&&x.source_name&&Number(x.count||0)>0)visiblePressNames.add(String(x.source_name));});
  }catch(_){}
  try{
    const archive=await getJSON(`${DATA}/press-source-stories.json`);
    Object.entries(archive||{}).forEach(([source,items])=>{
      const arr=Array.isArray(items)?items:[];
      arr.forEach(x=>docs.push({kind:"مطلب جریده",title:x.headline_fa||x.title_fa||"",sub:source,source,go:`openStory('${x.id}')`,text:[source,x.headline_fa,x.summary_fa,x.category].join(" "),snippet:x.summary_fa||""}));
    });
  }catch(_){}
  PRESS_SOURCES
    .filter(x=>[x.name,...(x.aliases||[])].some(n=>visiblePressNames.has(n)))
    .forEach(x=>docs.push({kind:"جریده",title:x.name,sub:x.type||"",source:x.name,go:`showPress('${String(x.name).replace(/'/g,"\\'")}')`,text:[x.name,(x.aliases||[]).join(" "),x.type,x.lang].join(" ")}));
  try{
    const b=await loadBooks();
    (b.books||[]).forEach(x=>{
      const creators=(x.creators||[]).map(c=>c.name_fa).join(" · ");
      const publisher=x.publisher?.name_fa||"";
      docs.push({kind:"کتاب",title:x.title_fa||"",sub:[creators,publisher].filter(Boolean).join(" · "),go:`openBook('${String(x.slug).replace(/'/g,"\\'")}')`,text:[x.title_fa,x.subtitle_fa,x.original_title,creators,publisher,x.category_fa].join(" "),snippet:x.description_fa||""});
    });
    (b.people||[]).forEach(x=>docs.push({kind:"پدیدآورنده",title:x.name_fa||"",sub:(x.roles_fa||[]).join(" · "),go:`openBookPerson('${String(x.slug).replace(/'/g,"\\'")}')`,text:[x.name_fa,...(x.roles_fa||[])].join(" ")}));
    (b.publishers||[]).forEach(x=>docs.push({kind:"ناشر",title:x.name_fa||"",sub:faN((x.book_slugs||[]).length)+" کتاب",go:`openPublisher('${String(x.slug).replace(/'/g,"\\'")}')`,text:[x.name_fa,...(x.categories_fa||[])].join(" ")}));
  }catch(_){}
  try{
    const m=await loadMovies();
    (m.movies||[]).forEach(x=>{
      const director=x.director?.name_fa||x.director?.name_en||"";
      docs.push({kind:x.type==="series"?"سریال":"فیلم",title:x.title_fa||x.original_title||"",sub:[x.year,director].filter(Boolean).join(" · "),go:`openMovie('${String(x.slug).replace(/'/g,"\\'")}')`,text:[x.title_fa,x.original_title,director,...(x.cast||[]),...(x.genres_fa||[])].join(" "),snippet:x.overview_fa||""});
    });
  }catch(_){}
  try{
    const k=await loadPendarKnowledge();
    const add=(kind,rows,label,subfn)=>{
      (rows||[]).forEach(x=>docs.push({
        kind:label,
        title:x.title||x.name_fa||"",
        sub:subfn?subfn(x):"",
        go:`openKnowledgeEntity('${kind}','${String(x.id||"").replace(/'/g,"\\'")}')`,
        text:[x.title,x.summary,x.field,x.category,x.type,x.country,(x.topicIds||[]).join(" ")].join(" "),
        snippet:x.summary||""
      }));
    };
    add("person",k.people,"دانش · شخص",x=>x.field||x.place||"");
    add("figure",k.figures,"دانش · چهره",x=>x.category||x.life||"");
    add("topic",k.topics,"دانش · موضوع",x=>x.category||"");
    add("collection",k.collections,"دانش · پرونده",x=>"پرونده مطالعاتی");
    add("path",k.paths,"دانش · مسیر",x=>"مسیر مطالعه");
    add("festival",k.festivals,"دانش · آیین",x=>x.dateLabel||"");
    add("organization",k.organizations,"دانش · نهاد",x=>[x.type,x.country].filter(Boolean).join(" · "));
  }catch(_){}
  // Canonical registry entries are deliberately omitted from public search.
  // Users should see actual people, books, articles and sections — not internal
  // identity records or implementation labels.
  _smartSearchDocs=docs; return docs;
}
function _ssExcerpt(s,Q){
  const x=String(s||"").trim(); if(!x)return "";
  const low=_sq(x); let at=-1;
  for(const t of Q.base){const p=low.indexOf(t);if(p>=0&&(at<0||p<at))at=p}
  if(at<0)return x.slice(0,155)+(x.length>155?"…":"");
  const st=Math.max(0,at-55), out=x.slice(st,st+190); return (st?"…":"")+out+(st+190<x.length?"…":"");
}
function _ssRenderRow(d,Q,label){
  const sn=_ssExcerpt(d.snippet,Q);
  return `<button class="smart-search-result" onclick="${d.go};toggleSmartSearch(false)"><span class="ss-kind">${esc(label||d.kind)}</span><span><b>${esc(d.title)}</b><small>${esc(d.sub||"")}</small>${sn?`<em>${esc(sn)}</em>`:""}</span></button>`;
}
async function smartSearch(q){
  clearTimeout(_smartSearchTimer);
  _smartSearchTimer=setTimeout(async()=>{
    const out=document.getElementById("smart-search-results"), Q=_ssQuery(q);
    if(Q.n.length<2){out.innerHTML='<div class="smart-search-hint">می‌توانی طبیعی بنویسی؛ مثلاً «چه کسانی درباره احتمال جنگ حرف زده‌اند؟»</div>';return}
    out.innerHTML='<div class="smart-search-hint">در حال جست‌وجو در خبرها، گفته‌ها، کتاب‌ها و دانش پندار…</div>';
    const docs=await _buildSmartSearchDocs();
    let ranked=docs.map(d=>({d,score:_ssScore(d,Q)})).filter(x=>x.score>1).sort((a,b)=>b.score-a.score);
    // Collapse duplicate canonical identities that share the same visible name.
    // Prefer a person over a source when both exist under that exact name.
    const canonicalByName=new Map();
    ranked.forEach(x=>{
      if(!x.d.canonicalId)return;
      const k=_canonicalNorm(x.d.title);
      const prev=canonicalByName.get(k);
      const rank=t=>t==="person"?4:t==="organization"?3:t==="publisher"?2:t==="source"?1:0;
      if(!prev || rank(x.d.canonicalType)>rank(prev.d.canonicalType) || (rank(x.d.canonicalType)===rank(prev.d.canonicalType)&&x.score>prev.score)) canonicalByName.set(k,x);
    });
    ranked=ranked.filter(x=>!x.d.canonicalId || canonicalByName.get(_canonicalNorm(x.d.title))===x);
    if(Q.personIntent){
      const by=new Map();
      ranked.filter(x=>x.d.kind==="دیدگاه").forEach(x=>{const k=x.d.handle;if(!by.has(k)||by.get(k).score<x.score)by.set(k,x)});
      const people=[...by.values()].sort((a,b)=>b.score-a.score).slice(0,7);
      const rest=ranked.filter(x=>x.d.kind!=="دیدگاه").slice(0,5);
      out.innerHTML=people.length?`<div class="ss-answer"><strong>چهره‌های مرتبط با این پرسش</strong><small>بر اساس گفته‌های ثبت‌شده در بخش چهره‌های پندار</small></div>${people.map(x=>_ssRenderRow(x.d,Q,"چهره")).join("")}${rest.length?`<div class="ss-divider">مطالب مرتبط</div>${rest.map(x=>_ssRenderRow(x.d,Q)).join("")}`:""}`:'<div class="smart-search-hint">در گفته‌های ثبت‌شده، پاسخ روشنی پیدا نشد.</div>';
      return;
    }
    if(Q.sourceIntent){
      const by=new Map();
      ranked.filter(x=>x.d.source).forEach(x=>{const k=x.d.source;if(!by.has(k)||by.get(k).score<x.score)by.set(k,x)});
      const src=[...by.values()].sort((a,b)=>b.score-a.score).slice(0,8);
      out.innerHTML=src.length?`<div class="ss-answer"><strong>رسانه‌ها و نشریات مرتبط</strong><small>بر اساس آرشیو فعلی پندار</small></div>${src.map(x=>_ssRenderRow(x.d,Q,"منبع")).join("")}`:'<div class="smart-search-hint">منبع مرتبطی پیدا نشد.</div>';return;
    }
    // When a query clearly names a known person, lead with the profile once
    // instead of flooding the panel with many statements from that same person.
    const profileHits=ranked.filter(x=>x.d.kind==="چهره").filter(x=>{
      const title=_sq(x.d.title), aliases=(x.d.aliases||[]).map(_sq);
      if(title===Q.n || aliases.includes(Q.n)) return true;
      if(Q.base.length===1) return title.split(" ").includes(Q.base[0]) || aliases.some(a=>a.split(" ").includes(Q.base[0]));
      return Q.base.every(t=>title.includes(t) || aliases.some(a=>a.includes(t)));
    }).slice(0,3);

    if(profileHits.length){
      const handles=new Set(profileHits.map(x=>x.d.handle).filter(Boolean));
      const related=[];
      const seen=new Set();
      for(const x of ranked){
        if(x.d.kind==="چهره") continue;
        // For a named-person search, prefer that person's own statements first.
        if(handles.size && x.d.handle && !handles.has(x.d.handle) && related.length<3) continue;
        const key=[x.d.kind,_sq(x.d.title),_sq(x.d.sub),_sq((x.d.snippet||"").slice(0,90))].join("|");
        if(seen.has(key)) continue;
        seen.add(key); related.push(x);
        if(related.length>=3) break;
      }
      out.innerHTML=
        `<div class="ss-answer"><strong>چهره</strong><small>پروفایل اصلی</small></div>`+
        profileHits.map(x=>_ssRenderRow(x.d,Q,x.d.count?`چهره · ${faN(x.d.count)} گفته`:"چهره")).join("")+
        (related.length?`<div class="ss-divider">چند نتیجهٔ مرتبط</div>${related.map(x=>_ssRenderRow(x.d,Q)).join("")}`:"");
      return;
    }

    // Generic searches stay compact as well: dedupe near-identical rows and
    // cap each visible title/kind combination before rendering.
    const compact=[], seen=new Set(), perTitle=new Map();
    for(const x of ranked){
      const titleKey=_sq(x.d.title), bucket=x.d.kind+"|"+titleKey;
      const n=perTitle.get(bucket)||0;
      if(n>=2) continue;
      const key=[bucket,_sq(x.d.sub),_sq((x.d.snippet||"").slice(0,90))].join("|");
      if(seen.has(key)) continue;
      seen.add(key); perTitle.set(bucket,n+1); compact.push(x);
      if(compact.length>=8) break;
    }
    out.innerHTML=compact.length?compact.map(x=>_ssRenderRow(x.d,Q)).join(""):'<div class="smart-search-hint">نتیجه‌ای پیدا نشد. عبارت را طبیعی‌تر یا کوتاه‌تر امتحان کن.</div>';
  },140);
}
document.addEventListener("click",e=>{const box=document.getElementById("smart-search");if(box?.classList.contains("open")&&!box.contains(e.target))toggleSmartSearch(false)});
