/* Pendar — canonical entities: the entity registry + local fallbacks, name
   normalization, canonical lookups (byId/byRef/byName), the entity profile
   page, the relations graph, and the canonical-entity view. Extracted from
   app.js; loaded as a classic script BEFORE app.js because a deep-link boot
   can route() into openEntityProfile/openEntityGraph/openCanonicalEntity, and
   book/QA/figure code calls canonicalStrip/_canonicalNorm/_entityTypeFa at
   runtime. Those app.js helpers (show, setTab, avatar, figureCard) run only
   at runtime, after every script has loaded. No behavior change. */

let _ENTITY_REGISTRY = null;
function _canonicalNorm(v) {
  return String(v||"")
    .replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[ۀة]/g,"ه")
    .replace(/[\u200c\u200f\u200eـ]/g," ")
    .replace(/[«»“”"'‘’()[\]{}،,:;؛!?؟/\\|+_=*~^%$#@]+/g," ")
    .toLowerCase().replace(/\s+/g," ").trim();
}
const _LOCAL_ENTITY_FALLBACKS = [
  {
    id:"person:nima-afshar-naderi",
    type:"person",
    name_fa:"نیما افشارنادری",
    aliases:["نیما افشار نادری","Nima Afshar Naderi"],
    roles:["figure","تولیدکننده محتوا و میزبان «جان کلام»"],
    refs:[{dataset:"figures",key:"nima-afshar-naderi"}],
    routes:{figure:"nima-afshar-naderi"},
    meta:{
      role_fa:"تولیدکننده محتوا و میزبان «جان کلام»",
      field_fa:"رسانه و تحلیل",
      verified:true,
      claimed:true,
      social:[
        {kind:"x",label:"ایکس",url:"https://x.com/nimania"},
        {kind:"instagram",label:"اینستاگرام",url:"https://www.instagram.com/nima.afsharnaderi/"},
        {kind:"youtube",label:"یوتیوب",url:"https://www.youtube.com/channel/UCYDOVO7EpX3QNEf9Ddk1-AQ"},
        {kind:"telegram",label:"تلگرام",url:"https://t.me/nimaafsharnaderi"},
        {kind:"website",label:"گروکی‌پدیا",url:"https://grokipedia.com/page/nima-afshar-naderi"}
      ]
    }
  }
];
function _injectLocalEntities(reg){
  reg = reg && typeof reg==="object" ? reg : {entities:[],edges:[],alias_index:{}};
  reg.entities = Array.isArray(reg.entities) ? reg.entities : [];
  reg.edges = Array.isArray(reg.edges) ? reg.edges : [];
  reg.alias_index = reg.alias_index && typeof reg.alias_index==="object" ? reg.alias_index : {};
  for(const fallback of _LOCAL_ENTITY_FALLBACKS){
    let current=reg.entities.find(x=>String(x.id)===fallback.id);
    if(!current){reg.entities.push(fallback);current=fallback}
    else{
      current.meta=Object.assign({},fallback.meta,current.meta||{});
      current.routes=Object.assign({},fallback.routes,current.routes||{});
      current.refs=[...(current.refs||[])];
      for(const ref of fallback.refs||[]) if(!current.refs.some(r=>r.dataset===ref.dataset&&String(r.key)===String(ref.key))) current.refs.push(ref);
      current.aliases=[...new Set([...(current.aliases||[]),...(fallback.aliases||[])])];
    }
    reg.alias_index.person=reg.alias_index.person||{};
    for(const n of [current.name_fa,...(current.aliases||[])]) reg.alias_index.person[_canonicalNorm(n)]=current.id;
  }
  return reg;
}
async function loadCanonicalEntities() {
  if (_ENTITY_REGISTRY) return _ENTITY_REGISTRY;
  try {
    const d = await getJSON(DATA + "/entity-registry.json?v=" + Date.now(), 12000);
    _ENTITY_REGISTRY = _injectLocalEntities(d);
  } catch (_) {
    _ENTITY_REGISTRY = _injectLocalEntities({entities:[],edges:[],alias_index:{}});
  }
  return _ENTITY_REGISTRY;
}
const _PERSON_REGISTRY_BUCKETS=new Map();
async function _loadPersonRegistryBucket(number){
  if(!_PERSON_REGISTRY_BUCKETS.has(number))_PERSON_REGISTRY_BUCKETS.set(number,getJSON(DATA+"/people/"+number+".json?v=person1",20000));
  try{return await _PERSON_REGISTRY_BUCKETS.get(number)}catch(error){_PERSON_REGISTRY_BUCKETS.delete(number);throw error}
}
async function canonicalEntityById(id) {
  const d=await loadCanonicalEntities(),resolved=(d.redirects||{})[String(id)]||String(id);
  const entity=(d.entities||[]).find(x=>String(x.id)===resolved);
  const tmdb=entity?.meta?.tmdb_id||String(id).match(/^person:tmdb-(\d+)$/)?.[1];
  if(tmdb){
    try{const bucket=await _loadPersonRegistryBucket(Number(tmdb)%64),record=bucket[String(tmdb)];if(record)return record}catch(_){}
  }
  return entity||null;
}
async function canonicalEntityByRef(dataset,key){
  if(!dataset||key==null)return null;
  const d=await loadCanonicalEntities(),k=String(key);
  const entity=(d.entities||[]).find(x=>(x.refs||[]).some(r=>r.dataset===dataset&&String(r.key)===k));
  if(entity)return canonicalEntityById(entity.id);
  const upstream=k.match(/^tmdb-(\d+)$/);
  return dataset==="figures"?canonicalEntityById("person:"+k):null;
}
async function canonicalEntityByName(type, name) {
  if (!type || !name) return null;
  const d = await loadCanonicalEntities();
  const id = d.alias_index && d.alias_index[type] ? d.alias_index[type][_canonicalNorm(name)] : null;
  return id ? ((d.entities||[]).find(x=>x.id===id)||null) : null;
}
function _canonicalRelationLabel(rel, incoming) {
  const m = {created_by:"پدیدآورنده",published_by:"ناشر",directed_by:"کارگردان",cast_member:"بازیگر",about_topic:"موضوع",related_topic:"موضوع مرتبط",quoted_by:"نقل‌شده در",related_person:"فرد مرتبط",mentioned_by_source:"ذکر در رسانه",mentioned_by_person:"اشاره توسط"};
  if (incoming && rel==="created_by") return "اثر";
  if (incoming && rel==="published_by") return "کتاب ناشر";
  if (incoming && rel==="directed_by") return "فیلم";
  if (incoming && rel==="cast_member") return "اثر";
  if (incoming && rel==="quoted_by") return "چهرهٔ نقل‌شده";
  if (incoming && rel==="mentioned_by_source") return "اثر نام‌برده";
  if (incoming && rel==="mentioned_by_person") return "اثر نام‌برده";
  if (incoming && rel==="related_person") return "فرد مرتبط";
  return m[rel] || "مرتبط";
}
function canonicalStrip(entity) {
  // Canonical identity data is an internal plumbing layer. Keep it available
  // to routing/data code, but never expose registry IDs, "Pendar 360" or
  // relationship-debug controls in the public UI.
  return "";
}


function _profileEntityNames(entity){
  return new Set([entity?.name_fa,...(entity?.aliases||[])].map(_canonicalNorm).filter(Boolean));
}
function _profileStoryMatches(entity,story,names){
  if(!story)return false;
  if(entity.type==="source"){
    const src=[...(story.source_names||[]),...((story.sources||[]).map(x=>typeof x==="string"?x:(x?.name||x?.source_name||"")))];
    return src.some(x=>names.has(_canonicalNorm(x)));
  }
  if(entity.type==="topic"){
    const slug=entity.routes?.topic;
    return (story.topics||[]).some(t=>(slug&&String(t.slug)===String(slug))||names.has(_canonicalNorm(t.name_fa||t.name||"")));
  }
  return (story.entities||[]).some(e=>names.has(_canonicalNorm(e.name_fa||e.name||"")));
}
function _profilePeriodicalMatches(entity,row,names){
  if(!row)return false;
  if(entity.type==="source"){
    return names.has(_canonicalNorm(row.publisher||row.source_name||""));
  }
  const text=[
    row.headline_fa,row.title_fa,row.title_original,row.summary_fa,row.body_fa,
    row.meta_description_fa,row.section_fa,...(row.key_points_fa||[]),...(row.seo_keywords_fa||[])
  ].filter(Boolean).join(" ");
  const hay=" "+_canonicalNorm(text)+" ";
  if(hay.trim().length<2)return false;
  for(const n of names){
    if(!n)continue;
    // Match complete normalized names/aliases, not arbitrary substrings.
    if(hay.includes(" "+n+" "))return true;
  }
  return false;
}
function _profileTimelineCard(row){
  const click=row.go?' onclick="'+row.go+'"':'';
  return '<article class="p360-time-row"'+click+'><span class="p360-time-kind">'+esc(row.kind)+'</span><div><b>'+esc(row.title||"")+'</b>'+(row.sub?'<p>'+esc(row.sub)+'</p>':"")+'<small>'+esc(row.when||"")+'</small></div></article>';
}
function _profileRelationCards(rows){
  return rows.map(x=>'<button class="p360-rel" onclick="openEntityProfile(\''+esc(x.entity.id)+'\')"><small>'+esc(x.label)+'</small><b>'+esc(x.entity.name_fa||x.entity.id)+'</b><span>'+esc(_entityTypeFa(x.entity.type))+'</span></button>').join("");
}
function _profileFallbackAvatar(entity){
  const letter=String(entity.name_fa||"?").trim().slice(0,1)||"?";
  return '<div class="p360-avatar-fallback">'+esc(letter)+'</div>';
}
async function openEntityProfile(id){
  id=decodeURIComponent(String(id||""));
  const [reg,figData,bookData,movieData,periodicals]=await Promise.all([
    loadCanonicalEntities(),loadFigures(),loadBooks(),loadMovies(),loadPeriodicals()
  ]);
  const entity=(reg.entities||[]).find(x=>x.id===id);
  show("profile");setTab("");setHash("#/profile/"+encodeURIComponent(id));
  const el=document.getElementById("entity-profile-content");
  if(!entity){el.innerHTML='<div class="state"><div class="big">این هویت پیدا نشد</div></div>';return}
  document.title=(entity.name_fa||"هویت")+" — نمای ۳۶۰ | پندار";

  const names=_profileEntityNames(entity);
  const links=_entityGraphLinks(reg,id);
  const figure=entity.routes?.figure?(figData.figures||[]).find(x=>String(x.handle)===String(entity.routes.figure)):null;
  const posts=figure?(figure.posts||[]):[];
  const stories=(ALL||[]).filter(s=>_profileStoryMatches(entity,s,names));

  const linkedBooks=[];
  const linkedMovies=[];
  const seenBooks=new Set(),seenMovies=new Set();
  function addBookEntity(e){
    const slug=e?.routes?.book;if(!slug||seenBooks.has(slug))return;
    const b=(bookData.books||[]).find(x=>String(x.slug)===String(slug));if(b){seenBooks.add(slug);linkedBooks.push(b)}
  }
  function addMovieEntity(e){
    const slug=e?.routes?.movie;if(!slug||seenMovies.has(slug))return;
    const m=(movieData.movies||[]).find(x=>String(x.slug)===String(slug));if(m){seenMovies.add(slug);linkedMovies.push(m)}
  }
  if(entity.type==="book")addBookEntity(entity);
  if(entity.type==="movie")addMovieEntity(entity);
  links.forEach(x=>{if(x.entity.type==="book")addBookEntity(x.entity);if(x.entity.type==="movie")addMovieEntity(x.entity)});

  const sourceLinks=links.filter(x=>x.entity.type==="source");
  const topicLinks=links.filter(x=>x.entity.type==="topic");
  const peopleLinks=links.filter(x=>x.entity.type==="person");
  const orgLinks=links.filter(x=>x.entity.type==="organization");
  const publisherLinks=links.filter(x=>x.entity.type==="publisher");

  const pressItems=(periodicals||[])
    .filter(x=>_profilePeriodicalMatches(entity,x,names))
    .slice()
    .sort((a,b)=>String(b.source_published_at||b.published_at||"").localeCompare(String(a.source_published_at||a.published_at||"")))
    .slice(0,18);

  const timeline=[];
  stories.forEach(s=>timeline.push({
    date:s.published_at||"",kind:"خبر",title:s.headline_fa||s.title_fa||"",sub:s.summary_fa||"",
    when:relTime(s.published_at),go:"openStory('"+esc(s.id)+"')"
  }));
  posts.forEach(p=>timeline.push({
    date:p.published_at||"",kind:p.kind==="news_statement"?"گفته در خبر":"دیدگاه",title:p.topic_fa||figure?.name_fa||entity.name_fa,
    sub:p.summary_fa||"",when:relTime(p.published_at),go:"openStatement('"+esc(statementKey(p))+"')"
  }));
  pressItems.forEach(x=>timeline.push({
    date:x.source_published_at||x.published_at||"",kind:"جریده",title:x.headline_fa||x.title_fa||x.title_original||"",
    sub:x.summary_fa||"",when:relTime(x.source_published_at||x.published_at),go:"openPressArticle('"+esc(x.id)+"')"
  }));
  timeline.sort((a,b)=>String(b.date).localeCompare(String(a.date)));

  const directPosts=posts.filter(p=>p.kind!=="news_statement");
  const newsPosts=posts.filter(p=>p.kind==="news_statement");
  const relationTypes=new Set(links.map(x=>x.entity.type));
  const stats=[
    ["خبر",stories.length],["جراید",pressItems.length],["گفته/دیدگاه",posts.length],["کتاب",linkedBooks.length],["فیلم/سریال",linkedMovies.length],["رابطه",links.length]
  ];

  let portrait="";
  if(figure && typeof avatar==="function") portrait=avatar(figure,"lg");
  else if(entity.meta?.avatar||entity.meta?.image){
    const src=entity.meta.avatar||entity.meta.image;
    portrait='<img class="p360-avatar-img" src="'+esc(src)+'" alt="" loading="eager" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode(\''+esc((entity.name_fa||"?").slice(0,1))+'\'))">';
  }else portrait=_profileFallbackAvatar(entity);

  const roleText=typeof _ssHumanRoles==="function"?_ssHumanRoles(entity.roles):(entity.roles||[]).join(" · ");
  const summary=entity.meta?.summary||entity.meta?.role_fa||entity.meta?.field_fa||"";
  const specialized='<button onclick="openCanonicalEntity(\''+esc(id)+'\')">صفحهٔ تخصصی</button>';
  const graphBtn='<button onclick="openEntityGraph(\''+esc(id)+'\')">شبکهٔ ارتباطی</button>';

  const storyHtml=stories.length?'<div class="feed">'+stories.slice(0,6).map(feedCard).join("")+'</div>':'<div class="p360-empty">در فید جاری خبری برای این هویت ثبت نشده است.</div>';
  const postHtml=posts.length?'<div class="p360-posts">'+posts.slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||""))).slice(0,8).map(p=>'<button onclick="openStatement(\''+esc(statementKey(p))+'\')"><small>'+(p.kind==="news_statement"?"گفته در خبر":"دیدگاه")+' · '+esc(relTime(p.published_at))+'</small><b>'+esc(p.topic_fa||"")+'</b><p>'+esc(p.summary_fa||"")+'</p></button>').join("")+'</div>':'<div class="p360-empty">گفته‌ای برای این هویت ثبت نشده است.</div>';
  const pressHtml=pressItems.length?'<div class="p360-periodicals">'+pressItems.slice(0,10).map(x=>'<button onclick="openPressArticle(\''+esc(x.id)+'\')"><small>'+esc(x.publisher||"جریده")+' · '+esc(relTime(x.source_published_at||x.published_at))+'</small><b>'+esc(x.headline_fa||x.title_fa||x.title_original||"")+'</b><span>'+esc((x.summary_fa||"").slice(0,180))+'</span></button>').join("")+'</div>':'<div class="p360-empty">در آرشیو فعلی جراید ذکری از این هویت پیدا نشد.</div>';
  const booksHtml=linkedBooks.length?'<div class="books-grid">'+linkedBooks.slice(0,8).map(_bookCard).join("")+'</div>':'<div class="p360-empty">کتاب مرتبطی در رجیستری ثبت نشده است.</div>';
  const moviesHtml=linkedMovies.length?'<div class="movie-grid">'+linkedMovies.slice(0,8).map(_movieCard).join("")+'</div>':'<div class="p360-empty">فیلم یا سریال مرتبطی ثبت نشده است.</div>';
  const relGroups=[
    ["آدم‌ها",peopleLinks],["رسانه‌ها",sourceLinks],["موضوعات",topicLinks],["نهادها",orgLinks],["ناشرها",publisherLinks]
  ].filter(x=>x[1].length);
  const relationsHtml=relGroups.length?relGroups.map(([label,rows])=>'<div class="p360-rel-group"><h3>'+esc(label)+' <span>'+faN(rows.length)+'</span></h3><div class="p360-rel-grid">'+_profileRelationCards(rows.slice(0,12))+'</div></div>').join(""):'<div class="p360-empty">رابطهٔ مستقیمی هنوز ثبت نشده است.</div>';

  el.innerHTML=
    '<button class="back" onclick="history.length>1?history.back():showFeed()">بازگشت</button>'+
    '<article class="p360">'+
      '<header class="p360-hero"><div class="p360-avatar">'+portrait+'</div><div class="p360-identity"><h1>'+esc(entity.name_fa||"")+'</h1>'+(roleText?'<p class="p360-roles">'+esc(roleText)+'</p>':"")+(summary?'<p class="p360-summary">'+esc(summary)+'</p>':"")+'</div></header>'+
      '<div class="p360-stats">'+stats.map(x=>'<span><b>'+faN(x[1])+'</b><small>'+x[0]+'</small></span>').join("")+'</div>'+
      '<nav class="p360-jump"><button onclick="document.getElementById(\'p360-timeline\')?.scrollIntoView({behavior:\'smooth\'})">خط زمانی</button><button onclick="document.getElementById(\'p360-news\')?.scrollIntoView({behavior:\'smooth\'})">خبرها</button><button onclick="document.getElementById(\'p360-press\')?.scrollIntoView({behavior:\'smooth\'})">جراید</button><button onclick="document.getElementById(\'p360-statements\')?.scrollIntoView({behavior:\'smooth\'})">گفته‌ها</button><button onclick="document.getElementById(\'p360-books\')?.scrollIntoView({behavior:\'smooth\'})">کتاب‌ها</button><button onclick="document.getElementById(\'p360-movies\')?.scrollIntoView({behavior:\'smooth\'})">فیلم‌ها</button><button onclick="document.getElementById(\'p360-relations\')?.scrollIntoView({behavior:\'smooth\'})">شبکه</button></nav>'+
      '<section class="p360-section" id="p360-timeline"><div class="p360-section-head"><div><span>Timeline</span><h2>خط زمانی</h2></div><small>'+faN(timeline.length)+' رویداد در دادهٔ فعلی</small></div>'+(timeline.length?'<div class="p360-timeline">'+timeline.slice(0,16).map(_profileTimelineCard).join("")+'</div>':'<div class="p360-empty">رویداد زمان‌دار ثبت نشده است.</div>')+'</section>'+
      '<section class="p360-section" id="p360-news"><div class="p360-section-head"><div><span>News</span><h2>خبرهای مرتبط</h2></div><small>'+faN(stories.length)+' خبر در فید جاری</small></div>'+storyHtml+'</section>'+
      '<section class="p360-section" id="p360-press"><div class="p360-section-head"><div><span>Press mentions</span><h2>در جراید</h2></div><small>'+faN(pressItems.length)+' مطلب مرتبط در آرشیو فعلی</small></div>'+pressHtml+'</section>'+
      '<section class="p360-section" id="p360-statements"><div class="p360-section-head"><div><span>Statements</span><h2>گفته‌ها و دیدگاه‌ها</h2></div><small>'+faN(directPosts.length)+' مستقیم · '+faN(newsPosts.length)+' در خبر</small></div>'+postHtml+'</section>'+
      '<section class="p360-section" id="p360-books"><div class="p360-section-head"><div><span>Books</span><h2>کتاب‌ها</h2></div><small>'+faN(linkedBooks.length)+' اثر مرتبط</small></div>'+booksHtml+'</section>'+
      '<section class="p360-section" id="p360-movies"><div class="p360-section-head"><div><span>Screen</span><h2>فیلم و سریال</h2></div><small>'+faN(linkedMovies.length)+' اثر مرتبط</small></div>'+moviesHtml+'</section>'+
      '<section class="p360-section" id="p360-relations"><div class="p360-section-head"><div><span>Knowledge graph</span><h2>شبکهٔ ارتباطی</h2></div><button onclick="openEntityGraph(\''+esc(id)+'\')">باز کردن Graph کامل ←</button></div>'+relationsHtml+'</section>'+
    '</article>';
}

let _entityGraphFilter="all";
function _entityTypeFa(type){
  const m={person:"شخص",organization:"نهاد",source:"رسانه",publisher:"ناشر",book:"کتاب",movie:"فیلم/سریال",topic:"موضوع",place:"مکان"};
  return m[type]||type||"هویت";
}
function _entityGraphLinks(data,id){
  const all=new Map((data.entities||[]).map(x=>[x.id,x])),out=[];
  for(const edge of (data.edges||[])){
    let other=null,incoming=false;
    if(edge.from===id) other=all.get(edge.to);
    else if(edge.to===id){other=all.get(edge.from);incoming=true}
    if(!other) continue;
    out.push({entity:other,edge:edge,incoming:incoming,label:_canonicalRelationLabel(edge.rel,incoming)});
  }
  return out;
}
function setEntityGraphFilter(id,type){
  _entityGraphFilter=type||"all";
  openEntityGraph(id,false);
}
async function openEntityGraph(id,resetFilter=true){
  id=decodeURIComponent(String(id||""));
  if(resetFilter)_entityGraphFilter="all";
  const data=await loadCanonicalEntities();
  const entity=(data.entities||[]).find(x=>x.id===id);
  show("graph");setTab("");setHash("#/graph/"+encodeURIComponent(id));
  const el=document.getElementById("entity-graph-content");
  if(!entity){el.innerHTML='<div class="state"><div class="big">این هویت پیدا نشد</div></div>';return}
  document.title="شبکهٔ "+(entity.name_fa||"هویت")+" | پندار";
  const allLinks=_entityGraphLinks(data,id);
  const typeCounts={};
  for(const x of allLinks)typeCounts[x.entity.type]=(typeCounts[x.entity.type]||0)+1;
  const links=allLinks.filter(x=>_entityGraphFilter==="all"||x.entity.type===_entityGraphFilter).slice(0,24);
  const W=1000,H=620,cx=500,cy=310;
  const positions=links.map((x,i)=>{
    const n=links.length,ring=i<12?1:2,idx=ring===1?i:i-12,count=ring===1?Math.min(n,12):Math.max(1,n-12);
    const a=(-Math.PI/2)+(Math.PI*2*idx/count)+(ring===2?Math.PI/count:0);
    const rx=ring===1?315:430,ry=ring===1?205:255;
    return {...x,x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry};
  });
  const lines=positions.map(p=>'<line x1="'+cx+'" y1="'+cy+'" x2="'+p.x.toFixed(1)+'" y2="'+p.y.toFixed(1)+'"></line>').join("");
  const nodes=positions.map(p=>{
    const left=(p.x/W*100).toFixed(2),top=(p.y/H*100).toFixed(2);
    return '<button class="entity-graph-node type-'+esc(p.entity.type)+'" style="left:'+left+'%;top:'+top+'%" onclick="openCanonicalEntity(\''+esc(p.entity.id)+'\')"><small>'+esc(p.label)+'</small><b>'+esc(p.entity.name_fa||p.entity.id)+'</b><span>'+esc(_entityTypeFa(p.entity.type))+'</span></button>';
  }).join("");
  const filters=[["all","همه",allLinks.length],...Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).map(([t,n])=>[t,_entityTypeFa(t),n])];
  const filterHtml=filters.map(x=>'<button class="fchip '+(_entityGraphFilter===x[0]?'on':'')+'" onclick="setEntityGraphFilter(\''+esc(id)+'\',\''+esc(x[0])+'\')">'+esc(x[1])+' <span>'+faN(x[2])+'</span></button>').join("");
  const relSummary=Object.entries(allLinks.reduce((m,x)=>{m[x.label]=(m[x.label]||0)+1;return m},{})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>'<span><b>'+faN(x[1])+'</b> '+esc(x[0])+'</span>').join("");
  el.innerHTML='<button class="back" onclick="openCanonicalEntity(\''+esc(id)+'\')">بازگشت به پروفایل</button>'+
    '<section class="entity-graph-hero"><div><span class="press-kicker">Relationship Graph</span><h1>'+esc(entity.name_fa||entity.id)+'</h1><p>'+faN(allLinks.length)+' پیوند مستقیمِ ثبت‌شده در رجیستری canonical پندار</p></div><div class="entity-graph-hero-actions"><button onclick="openEntityProfile(\''+esc(id)+'\')">پروفایل ۳۶۰</button><button onclick="openCanonicalEntity(\''+esc(id)+'\')">صفحهٔ تخصصی</button></div></section>'+
    '<div class="entity-graph-filters">'+filterHtml+'</div>'+
    (relSummary?'<div class="entity-graph-summary">'+relSummary+'</div>':'')+
    (links.length?'<div class="entity-graph-stage"><svg class="entity-graph-lines" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+lines+'</svg><button class="entity-graph-center" onclick="openCanonicalEntity(\''+esc(id)+'\')"><small>'+esc(_entityTypeFa(entity.type))+'</small><b>'+esc(entity.name_fa||entity.id)+'</b></button>'+nodes+'</div>':'<div class="state"><div class="big">برای این هویت هنوز رابطهٔ مستقیمی ثبت نشده</div></div>')+
    '<p class="entity-graph-note">این نمودار فقط رابطه‌های ثبت‌شده در دادهٔ پندار را نشان می‌دهد؛ نزدیکی بصری به‌تنهایی معنای رابطهٔ قوی‌تر ندارد.</p>';
}

async function openCanonicalEntity(id) {
  id = decodeURIComponent(String(id||""));
  const entity = await canonicalEntityById(id);
  if (!entity) {
    show("entity"); setTab(""); setHash("#/entity/"+encodeURIComponent(id));
    const el=document.getElementById("entity-content");
    if(el) el.innerHTML='<div class="state"><div class="big">این هویت پیدا نشد</div></div>';
    return;
  }
  const routes=entity.routes||{};
  if(entity.type==="person") return openFigure(routes.figure||entity.id.slice(7),true,entity.id);
  if(entity.type==="book" && routes.book) return openBook(routes.book,entity.id);
  if(entity.type==="publisher" && routes.publisher) return openPublisher(routes.publisher,entity.id);
  if(entity.type==="source" && routes.press_source) return showPress(routes.press_source,entity.id);
  if(entity.type==="movie" && routes.movie) return openMovie(routes.movie,entity.id);
  return renderCanonicalEntity(entity);
}
async function renderCanonicalEntity(entity) {
  const d=await loadCanonicalEntities();
  show("entity"); setTab(""); setHash("#/entity/"+encodeURIComponent(entity.id));
  document.title=(entity.name_fa||"هویت")+" | پندار";
  const el=document.getElementById("entity-content");
  const roles=(entity.roles||[]).filter(Boolean);
  const all=new Map((d.entities||[]).map(x=>[x.id,x]));
  const rels=[];
  for(const edge of (d.edges||[])){
    let other=null,incoming=false;
    if(edge.from===entity.id) other=all.get(edge.to);
    else if(edge.to===entity.id){other=all.get(edge.from);incoming=true}
    if(other) rels.push({other:other,label:_canonicalRelationLabel(edge.rel,incoming)});
  }
  const relHtml = rels.length ? '<div class="rule"><span>پیوندها در پندار</span><span class="l"></span></div><div class="canonical-grid">' + rels.map(function(x){
    return '<button onclick="openCanonicalEntity(\'' + esc(x.other.id) + '\')"><small>' + esc(x.label) + '</small><b>' + esc(x.other.name_fa||x.other.id) + '</b><span>' + esc(x.other.type) + '</span></button>';
  }).join("") + '</div>' : "";
  el.innerHTML='<button class="back" onclick="history.length>1?history.back():showFeed()">بازگشت</button><article class="canonical-profile"><span class="press-kicker">' +
    esc(entity.type||"entity") + '</span><h1>' + esc(entity.name_fa||entity.id) + '</h1>' +
    (roles.length?'<p class="canonical-roles">'+roles.map(esc).join(" · ")+'</p>':"") +
    (entity.meta && entity.meta.summary?'<p>'+esc(entity.meta.summary)+'</p>':"") +
    canonicalStrip(entity) + relHtml + '</article>';
}

