/* Pendar — static build. Reads pre-generated JSON from ./data (no backend). */
const DATA = "data";

// Shared data caches must exist before startup renderers run.
let _FIG = null, _NEWS_PEOPLE = null, _CURATED_POEMS = null, _STUDIO_RECAPS = null, _PROJECT_FINANCE = null;

const CAT_FA = { iran: "ایران", world: "جهان", politics: "سیاست", economy: "اقتصاد",
  technology: "فناوری", ai: "هوش مصنوعی", culture: "فرهنگ", sport: "ورزش", science: "علم", environment: "محیط‌زیست", entertainment: "سرگرمی", health: "سلامت" };
const IRAN_FA = { high: "ارتباط بالا با ایران", medium: "ارتباط با ایران",
  low: "ارتباط کم با ایران", none: "بدون ارتباط مستقیم با ایران" };
const CRED_FA = { high: "اعتبار بالا", medium: "چند منبع", low: "تک‌منبع" };
const CRED_CLS = { high: "st-ok", medium: "st-neutral", low: "st-warn" };
const faN = s => String(s).replace(".", "٫").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Homepage editorial wording: use neutral/national terminology in the public
// front page without mutating the underlying archived/source text.
function homeEditorialText(v) {
  return String(v ?? "")
    .replace(/صهیونیست(?:‌|\s)?های/g, "اسرائیلی‌های")
    .replace(/صهیونیست(?:‌|\s)?ها/g, "اسرائیلی‌ها")
    .replace(/صهیونیستی/g, "اسرائیلی")
    .replace(/صهیونیست/g, "اسرائیلی");
}

function impInfo(v) {
  if (v >= 75) return { cls: "high", lbl: "بسیار مهم" };
  if (v >= 50) return { cls: "mid", lbl: "مهم" };
  return { cls: "low", lbl: "متوسط" };
}
function relTime(iso) {
  if (!iso) return "";
  // Build timestamps are UTC but may omit the timezone suffix. Without one,
  // new Date() parses them as the viewer's LOCAL time (e.g. +3:30 in Tehran),
  // so every item looked ~3.5h old. Force UTC when no offset is present.
  if (typeof iso === "string" && !/(Z|[+-]\d\d:?\d\d)$/.test(iso)) iso += "Z";
  const mins = Math.floor((Date.now() - new Date(iso)) / 6e4);
  if (mins < 1) return "همین حالا";
  if (mins < 60) return faN(mins) + " دقیقه پیش";
  const h = Math.floor(mins / 60);
  if (h < 24) return faN(h) + " ساعت پیش";
  const d = Math.floor(h / 24);
  return d === 1 ? "دیروز" : faN(d) + " روز پیش";
}
async function getJSON(path, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(path, { cache: "no-cache", signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}


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
async function canonicalEntityById(id) {
  const d = await loadCanonicalEntities();
  return (d.entities||[]).find(x => String(x.id) === String(id)) || null;
}
async function canonicalEntityByRef(dataset, key) {
  if (!dataset || key == null) return null;
  const d = await loadCanonicalEntities();
  const k = String(key);
  return (d.entities||[]).find(x => (x.refs||[]).some(r => r.dataset===dataset && String(r.key)===k)) || null;
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
  if(entity.type==="person" && routes.figure) return openFigure(routes.figure,true,entity.id);
  if(entity.type==="person" && routes.book_person) return openBookPerson(routes.book_person,entity.id);
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


function setArticleSeo(x){
  const title=(x.seo_title_fa||x.headline_fa||x.title_original||"پیشخوان جراید").trim();
  const desc=(x.meta_description_fa||x.summary_fa||"").trim();
  document.title=title+" | پندار";
  let m=document.querySelector('meta[name="description"]');
  if(!m){m=document.createElement("meta");m.name="description";document.head.appendChild(m);}
  if(desc)m.content=desc;
  let k=document.querySelector('meta[name="keywords"]');
  if(!k){k=document.createElement("meta");k.name="keywords";document.head.appendChild(k);}
  k.content=(x.seo_keywords_fa||[]).join("، ");
  let schema=document.getElementById("press-article-schema");
  if(!schema){schema=document.createElement("script");schema.type="application/ld+json";schema.id="press-article-schema";document.head.appendChild(schema);}
  const articleSchema={
    "@type":"Article",
    "headline":title,"description":desc,
    "datePublished":x.source_published_at||x.published_at||undefined,
    "dateModified":x.published_at||undefined,
    "author":{"@type":"Organization","name":x.publisher||"پیشخوان جراید"},
    "publisher":{"@type":"Organization","name":"پندار"},
    "mainEntityOfPage":location.href,
    "isBasedOn":x.source_url||x.article_url||undefined,
    "keywords":(x.seo_keywords_fa||[]).join(", ")
  };
  const e=x.event||{};
  const graph=[articleSchema];
  if(e.is_event||e.start_iso||e.date_fa||e.location_fa||e.address_fa){
    graph.push({
      "@type":"Event",
      "name":x.headline_fa||x.title_original||title,
      "description":desc,
      "startDate":e.start_iso||undefined,
      "endDate":e.end_iso||undefined,
      "location":(e.location_fa||e.address_fa)?{
        "@type":"Place","name":e.location_fa||undefined,
        "address":e.address_fa||undefined
      }:undefined,
      "url":x.source_url||x.article_url||location.href
    });
  }
  schema.textContent=JSON.stringify({"@context":"https://schema.org","@graph":graph});
}


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

const VIEWS = { feed: "feed-view", detail: "detail-view", trends: "trends-view",
  factchecks: "factchecks-view", topics: "topics-view", topicarchive: "topic-archive-view",
  weather: "weather-view", iran: "iran-view", faq: "faq-view", market: "market-view",
  figures: "figures-view", press: "press-view", books: "books-view", movies: "movies-view", tvguide: "tv-guide-view", knowledge: "knowledge-view", entity: "entity-view", graph: "entity-graph-view", profile: "entity-profile-view", entityqa: "entity-qa-view", system: "system-view", tech: "tech-view" };
const TABS = ["feed", "trends", "factchecks", "iran", "topics"];
const SCOPE_FA = { local: "استانی", national: "کشوری", international: "بین‌المللی" };
function setTab(w) { for (const t of TABS) document.getElementById("tab-" + t).classList.toggle("active", w === t); }
function show(v) {
  for (const [key, id] of Object.entries(VIEWS))
    document.getElementById(id).style.display = key === v ? "block" : "none";
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showFeed() { show("feed"); setTab("feed"); setHash(""); }
function showTopics() { show("topics"); setTab("topics"); renderTopics(); setHash("#/topics"); }
function showTrends() { show("trends"); setTab("trends"); renderTrends(); setHash("#/trends"); }
function showFactchecks() { show("factchecks"); setTab("factchecks"); renderFactchecks(); setHash("#/fact"); }
function showFaq() { show("faq"); setTab("faq"); renderFaq(); setHash("#/faq"); }

let booksCache = null;
async function loadBooks(){
  if(booksCache) return _curateBookData(booksCache);
  let d=null;
  try{d=await getJSON(`${DATA}/books.json?v=${Date.now()}`,7000);}catch(_){}
  if(!d || !Array.isArray(d.books) || !d.books.length){
    d=(window.__BOOKS_DATA__ && typeof window.__BOOKS_DATA__==="object")
      ? window.__BOOKS_DATA__ : {books:[],people:[],publishers:[]};
  }
  booksCache={
    ...d,
    books:Array.isArray(d.books)?d.books:[],
    people:Array.isArray(d.people)?d.people:[],
    publishers:Array.isArray(d.publishers)?d.publishers:[]
  };
  return _curateBookData(booksCache);
}
function _bookBySlug(d,slug){return (d.books||[]).find(x=>String(x.slug)===String(slug))}
function _toman(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>0 ? n.toLocaleString("fa-IR")+" تومان" : "—";
}
async function openPublisher(slug, canonicalId=null){
  const canonicalPub=canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByRef("books.publishers",slug);
  canonicalId=canonicalPub?.id||canonicalId;
  show("books"); setTab("");
  const lede=document.getElementById("books-lede"); if(lede) lede.style.display="none";
  const el=document.getElementById("books-content"); el.innerHTML='<div class="spinner"></div>';
  const d=await loadBooks(), p=(d.publishers||[]).find(x=>x.slug===slug);
  if(!p){el.innerHTML='<div class="state"><div class="big">ناشر پیدا نشد</div></div>';return}
  const books=(p.book_slugs||[]).map(s=>_bookBySlug(d,s)).filter(Boolean);
  el.innerHTML=`<button class="back" onclick="showBooks('publishers')">بازگشت به ناشرها</button>${_bookPublisherProfile(p,books)}${canonicalPub?canonicalStrip(canonicalPub):""}<div class="books-grid">${books.map(_bookCard).join("")}</div>`;
  document.title=p.name_fa+" | ناشرهای جانِ کتاب";
  setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/publisher/"+encodeURIComponent(slug));
}
function _personIdentityNorm(s){
  return String(s||"").replace(/ي/g,"ی").replace(/ى/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim().toLowerCase();
}
function _figureForBookPerson(person, figureData){
  if(!person) return null;
  const explicit=String(person.figure_handle||person.handle||"").trim().toLowerCase();
  if(explicit){
    const byHandle=(figureData.figures||[]).find(f=>String(f.handle||"").toLowerCase()===explicit);
    if(byHandle) return byHandle;
  }
  const name=_personIdentityNorm(person.name_fa);
  const aliases=(person.aliases_fa||person.aliases||[]).map(_personIdentityNorm).filter(Boolean);
  return (figureData.figures||[]).find(f=>{
    const candidates=[f.name_fa,...(f.aliases_fa||[]),...(f.aliases||[])].map(_personIdentityNorm).filter(Boolean);
    return candidates.includes(name) || aliases.some(a=>candidates.includes(a));
  })||null;
}
async function openBookPerson(slug, canonicalId=null){
  const [d,figures,canonicalPerson]=await Promise.all([loadBooks(),loadFigures(),canonicalId?canonicalEntityById(canonicalId):canonicalEntityByRef("books.people",slug)]);
  canonicalId=canonicalPerson?.id||canonicalId;
  const p=(d.people||[]).find(x=>x.slug===slug);
  if(!p){
    show("books"); setTab("");
    const lede=document.getElementById("books-lede"); if(lede) lede.style.display="none";
    document.getElementById("books-content").innerHTML='<div class="state"><div class="big">پدیدآورنده پیدا نشد</div></div>';
    return;
  }
  if(canonicalPerson?.routes?.figure) return openFigure(canonicalPerson.routes.figure,true,canonicalPerson.id);
  const linkedFigure=_figureForBookPerson(p,figures);
  if(linkedFigure) return openFigure(linkedFigure.handle,true,canonicalId);
  show("books"); setTab("");
  const lede=document.getElementById("books-lede"); if(lede) lede.style.display="none";
  const el=document.getElementById("books-content"); el.innerHTML='<div class="spinner"></div>';
  const books=(p.book_slugs||[]).map(s=>_bookBySlug(d,s)).filter(Boolean);
  el.innerHTML=`<button class="back" onclick="showBooks('people')">بازگشت به پدیدآورندگان</button><div class="book-person-head"><span class="press-kicker">پدیدآورنده</span><h1>${esc(p.name_fa)}</h1><p>${esc((p.roles_fa||[]).join(" · "))}</p></div>${canonicalPerson?canonicalStrip(canonicalPerson):""}<div class="books-grid">${books.map(_bookCard).join("")}</div>`;
  setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/book-person/"+encodeURIComponent(slug));
}

let periodicalRows = [];
let pressScope = "all";
let pressLanguage = "all";
let pressKind = "all";
let pressSourceTab = "latest";
let pressSourceCurrent = "";
let pressStatsCache = null;
let pressHealthCache = null;
let pressDirectoryCache = null;

const PRESS_SOURCES = [
  // خبرگزاری‌ها و رسانه‌های خبری داخل ایران
  {name:"ایرنا", aliases:["خبرگزاری ایرنا (IRNA)"], domain:"irna.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"ایسنا", aliases:["خبرگزاری ایسنا (ISNA)"], domain:"isna.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"مهر", aliases:["خبرگزاری مهر (Mehr)"], domain:"mehrnews.com", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"فارس", aliases:["خبرگزاری فارس (Fars)"], domain:"farsnews.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"خبرگزاری صداوسیما", domain:"iribnews.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"باشگاه خبرنگاران جوان", domain:"yjc.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"خبرآنلاین", domain:"khabaronline.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"تابناک", domain:"tabnak.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"فرارو", domain:"fararu.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"انتخاب", domain:"entekhab.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"عصر ایران", domain:"asriran.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"فردانیوز", domain:"fardanews.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"رویداد۲۴", domain:"rouydad24.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"آفتاب‌نیوز", domain:"aftabnews.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"مشرق نیوز", domain:"mashreghnews.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"انصاف نیوز", domain:"ensafnews.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},

  // کانال‌ها و پادکست‌های ویدئویی
  {name:"Chanteh Podcast", aliases:["چنته پادکست"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"پادکست ویدئویی"},
  {name:"Zabane.z", domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال ویدئویی"},
  {name:"۷ آبان", aliases:["7Aban_h","7Aban"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال ویدئویی"},
  {name:"Ivar Farhadi", aliases:["ایوار فرهادی"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال شخصی"},
  {name:"فرهیختگان آنلاین", aliases:["Farhikhtegan Online"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه ویدئویی", description:"بخش آنلاین و ویدئویی روزنامهٔ فرهیختگان."},
  {name:"Manoto TV", aliases:["من‌وتو","من و تو"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"شبکه ویدئویی"},
  {name:"سیمرغ فیوچرز", aliases:["Cimorg Futures"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه آینده‌پژوهی", description:"رسانهٔ ویدئویی با تمرکز بر آینده‌پژوهی و گفت‌وگو."},
  {name:"Persian Clubhouse", domain:"youtube.com", scope:"youtube", lang:"fa", type:"گفت‌وگو و کلاب‌هاوس"},
  {name:"Baziya (Ali Zia)", aliases:["Baziya","بازیا","علی ضیا"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"تاک‌شو ویدئویی"},
  {name:"Rok Show", domain:"youtube.com", scope:"youtube", lang:"fa", type:"برنامه ویدئویی"},
  {name:"Pump VOD", domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه ویدئویی"},
  {name:"استودیو پات", aliases:["Studio Patt"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"استودیو و رسانهٔ ویدئویی با گفت‌وگوها و مهمانان متعدد."},
  {name:"فیوز پادکست", aliases:["Fuse Podcast"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"پادکست گفت‌وگومحور", description:"پادکست ویدئویی به میزبانی آرش نعل‌چگر با مهمانان مختلف."},
  {name:"افق فردا", aliases:["Tomorrow’s Horizon","Tomorrow's Horizon"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"رسانهٔ ویدئویی با گفت‌وگوها و حاضرین متعدد."},
  {name:"فیلم سجاد نی", aliases:["Sajadni Movies"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال سینمایی", description:"کانال ویدئویی سجاد نی دربارهٔ سینما و موضوعات مرتبط."},
  {name:"خیابان جمهوری", aliases:["Jomhouri Street"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"کانال گفت‌وگومحور با مهمانان مختلف."},
  {name:"جدال", aliases:["Jedaal","Jedaal Farsi"], domain:"jedaal.tv", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"رسانهٔ علی علیزاده؛ شامل برنامه‌های تحلیلی و گفت‌وگو با مهمانان."},
  {name:"سیمرغ طلایی", aliases:["Golden Simorgh","GoldenSimorgh"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"کانال ویدئویی گفت‌وگو و تحلیل با مهمانان و صاحب‌نظران."},

  // روزنامه‌ها و مطبوعات داخل ایران
  {name:"همشهری", aliases:["همشهری آنلاین"], domain:"hamshahrionline.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"پیام ما", aliases:["روزنامه پیام‌ما"], domain:"payamema.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"شرق", domain:"sharghdaily.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"اعتماد", domain:"etemadonline.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"دنیای اقتصاد", domain:"donya-e-eqtesad.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"اطلاعات", domain:"ettelaat.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"کیهان", domain:"kayhan.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"جمهوری اسلامی", domain:"jomhourieslami.net", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"هم‌میهن", domain:"hammihanonline.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"سازندگی", domain:"sazandeginews.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  // مجلات و فصلنامه‌های ایرانی
  {name:"تجربه", aliases:["مجله تجربه","ماهنامه تجربه"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"ماهنامه فرهنگی و هنری"},
  {name:"آنگاه", aliases:["مجله آنگاه","فصلنامه آنگاه"], domain:"angahmag.com", scope:"iran-magazine", lang:"fa", type:"فصلنامه فرهنگی و هنری"},
  {name:"تراژدی", aliases:["مجله تراژدی"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"روزآروز", aliases:["مجله روزآروز","روز آ روز"], domain:"roozarooz.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"بخارا", aliases:["مجله بخارا"], domain:"bukharamag.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"تنور", aliases:["مجله تنور"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"ناداستان", aliases:["مجله ناداستان"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله روایت و ادبیات غیرداستانی"},
  {name:"عصر اندیشه", aliases:["مجله عصر اندیشه"], domain:"asreandisheh.ir", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه و علوم انسانی"},
  {name:"شهریور", aliases:["مجله شهریور"], domain:"shahrivar.org", scope:"diaspora", lang:"fa", type:"مجله فارسی‌زبان خارج از ایران"},
  {name:"اندیشه پویا", aliases:["مجله اندیشه پویا"], domain:"andishepooya.ir", scope:"iran-magazine", lang:"fa", type:"ماهنامه فرهنگی و سیاسی"},
  {name:"مروارید", aliases:["مجله مروارید"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"غروب", aliases:["مجله غروب"], domain:"goroobonline.ir", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و تاریخی"},
  {name:"تجربه و شهر", aliases:["مجله تجربه و شهر"], domain:"goroobonline.ir", scope:"iran-magazine", lang:"fa", type:"مجله شهر و فرهنگ"},
  {name:"هنر و جامعه", aliases:["مجله هنر و جامعه"], domain:"goroobonline.ir", scope:"iran-magazine", lang:"fa", type:"مجله هنر و جامعه"},
  {name:"روزنامک", aliases:["ماهنامه روزنامک"], domain:"rooznamak-magazine.com", scope:"iran-magazine", lang:"fa", type:"ماهنامه فرهنگی و تاریخی"},
  {name:"فیلم", aliases:["مجله فیلم"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله سینمایی"},
  {name:"فیلم امروز", aliases:["مجله فیلم امروز"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله سینمایی"},
  {name:"شبکه آفتاب", aliases:["مجله شبکه آفتاب"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و اجتماعی"},
  {name:"سان", aliases:["مجله سان"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"معمار", aliases:["مجله معمار"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله معماری"},
  {name:"چشم‌انداز ایران", aliases:["چشم انداز ایران","مجله چشم انداز ایران"], domain:"meisami.net", scope:"iran-magazine", lang:"fa", type:"دوماهنامه سیاسی و راهبردی"},
  {name:"آزما", aliases:["مجله آزما"], domain:"azmaonline.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"کتاب‌نامه", aliases:["کتابنامه","مجله کتاب نامه"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله کتاب و نشر"},
  {name:"نگاه نو", aliases:["مجله نگاه نو"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و اجتماعی"},
  {name:"مدام", aliases:["مجله مدام"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"سیاست‌نامه", aliases:["سیاست نامه","مجله سیاست نامه"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه و سیاست"},
  {name:"خردورزی", aliases:["مجله خردورزی"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه"},
  {name:"دوباره", aliases:["مجله دوباره"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"صنوبر", aliases:["مجله صنوبر"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"آگاهی نو", aliases:["مجله آگاهی نو"], domain:"agahino.com", scope:"iran-magazine", lang:"fa", type:"مجله علوم انسانی و اندیشه"},
  {name:"مترجم", aliases:["مجله مترجم"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله ترجمه"},
  {name:"پوشه", aliases:["مجله پوشه"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"فردان", aliases:["مجله فردان"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"سخن سیاووشان", aliases:["مجله سخن سیاووشان"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"زنده‌رود", aliases:["زنده رود","مجله زنده رود"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله ادبی و فرهنگی"},
  {name:"خاطرات سیاسی", aliases:["مجله خاطرات سیاسی"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله تاریخ و سیاست"},
  {name:"سمرقند", aliases:["مجله سمرقند"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"سیزده", aliases:["مجله سیزده"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"حوالی", aliases:["مجله حوالی"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"قلم یاران", aliases:["مجله قلم یاران"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و اندیشه"},
  {name:"نقد اندیشه", aliases:["مجله نقد اندیشه"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه"},
  {name:"چارسو", aliases:["مجله چارسو"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"کتابنامه آگاهی نو", aliases:["کتاب‌نامه آگاهی نو","کتاب نامه آگاهی نو"], domain:"agahino.com", scope:"iran-magazine", lang:"fa", type:"مجله کتاب و اندیشه"},
  {name:"گواه", aliases:["مجله گواه"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"رود", aliases:["مجله رود"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"وزن دنیا", aliases:["مجله وزن دنیا"], domain:"vaznedonya.com", scope:"iran-magazine", lang:"fa", type:"مجله شعر"},
  {name:"سپیده دانایی", aliases:["ماهنامه سپیده دانایی","مجله سپیده دانایی"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"ماهنامه روان‌شناسی و خانواده"},
  {name:"نقطه‌بند", aliases:["نقطه بند","مجله نقطه بند"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"ترجمان", aliases:["ترجمان علوم انسانی","فصلنامه ترجمان"], domain:"tarjomaan.com", scope:"iran-magazine", lang:"fa", type:"فصلنامه علوم انسانی"},
  {name:"انگار", aliases:["مجله انگار"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"مهرنامه", aliases:["مجله مهرنامه","ماهنامه مهرنامه"], domain:"mehrnameh.ir", scope:"iran-magazine", lang:"fa", type:"ماهنامه علوم انسانی · متوقف‌شده"},
  {name:"دالان", aliases:["مجله دالان","Dalan Magazine"], domain:"dalan.media", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},

  // رسانه‌های ایرانی غیرفارسی‌زبان؛ در دستهٔ داخل ایران، نه رسانه‌های جهان
  {name:"Press TV", domain:"presstv.ir", scope:"iran-agency", lang:"en", type:"تلویزیون/رسانه خبری"},
  {name:"Tehran Times", domain:"tehrantimes.com", scope:"iran-paper", lang:"en", type:"روزنامه"},
  {name:"Al-Alam", aliases:["العالم"], domain:"alalam.ir", scope:"iran-agency", lang:"ar", type:"تلویزیون/رسانه خبری"},

  // مجلات فارسی‌زبان خارج از ایران
  {name:"فریدون", aliases:["مجله فریدون"], domain:"fereydoun.org", scope:"diaspora", lang:"fa", type:"مجله فارسی‌زبان خارج از ایران"},
  {name:"ایران‌نامه", aliases:["ایران نامه","Iran Namag"], domain:"irannamag.com", scope:"diaspora", lang:"fa", type:"فصلنامه ایران‌شناسی خارج از ایران"},
  {name:"ایران‌شناسی", aliases:["ایران شناسی"], domain:"fis-iran.org", scope:"diaspora", lang:"fa", type:"فصلنامه ایران‌شناسی خارج از ایران"},

  // فارسی‌زبان خارج از ایران
  {name:"بی‌بی‌سی فارسی", aliases:["بی‌بی‌سی فارسی (BBC Persian)"], domain:"bbc.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"رادیو فردا", domain:"radiofarda.com", scope:"diaspora", lang:"fa", type:"رادیو/آنلاین"},
  {name:"ایران اینترنشنال", aliases:["ایران اینترنشنال (Iran International)"], domain:"iranintl.com", scope:"diaspora", lang:"fa", type:"تلویزیون/آنلاین"},
  {name:"دویچه‌وله فارسی", aliases:["دویچه‌وله فارسی (DW Persian)"], domain:"dw.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"یورونیوز فارسی", domain:"parsi.euronews.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"ایران‌وایر", domain:"iranwire.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"کیهان لندن", domain:"kayhan.london", scope:"diaspora", lang:"fa", type:"روزنامه/آنلاین"},
  {name:"رادیو زمانه", domain:"radiozamaneh.com", scope:"diaspora", lang:"fa", type:"رادیو/آنلاین"},
  {name:"ایندیپندنت فارسی", domain:"independentpersian.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"اخبار روز", domain:"akhbar-rooz.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},

  {name:"ایلنا", domain:"ilna.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"تسنیم", domain:"tasnimnews.com", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"آنا", domain:"ana.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"اقتصادنیوز", domain:"eghtesadnews.com", scope:"iran-agency", lang:"fa", type:"اقتصادی"},
  {name:"اکوایران", domain:"ecoiran.com", scope:"iran-agency", lang:"fa", type:"اقتصادی"},
  {name:"دیپلماسی ایرانی", domain:"irdiplomacy.ir", scope:"iran-agency", lang:"fa", type:"تحلیلی"},
  {name:"جماران", domain:"jamaran.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"میزان", domain:"mizan.news", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"شفقنا فارسی", domain:"fa.shafaqna.com", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"هرانا", domain:"hra-news.org", scope:"iran-agency", lang:"fa", type:"حقوق بشر"},
  {name:"هەنگاو", domain:"hengaw.net", scope:"iran-agency", lang:"fa", type:"حقوق بشر"},
  {name:"گویا نیوز", domain:"news.gooya.com", scope:"diaspora", lang:"fa", type:"رسانه خبری"},
  {name:"ایران امروز", domain:"iran-emrooz.net", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"ایران پرس نیوز", domain:"iranpressnews.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"ایران گلوبال", domain:"iranglobal.info", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"فریدون", domain:"fereydoun.org", scope:"diaspora", lang:"fa", type:"تحلیلی"},
  {name:"ملی-مذهبی", domain:"melimazhabi.com", scope:"diaspora", lang:"fa", type:"تحلیلی"},
  {name:"صدای آمریکا فارسی", domain:"ir.voanews.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"العربیه فارسی", domain:"farsi.alarabiya.net", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"شرق‌الاوسط فارسی", domain:"persian.aawsat.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"اِپُک تایمز فارسی", domain:"persianepochtimes.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"آسو", domain:"aasoo.org", scope:"diaspora", lang:"fa", type:"محتوایی/تحلیلی"},
  {name:"Al-Monitor", domain:"al-monitor.com", scope:"world", lang:"en", type:"تحلیلی"},
  {name:"Axios", domain:"axios.com", scope:"world", lang:"en", type:"رسانه خبری"},
  {name:"Bloomberg", domain:"bloomberg.com", scope:"world", lang:"en", type:"خبرگزاری/اقتصادی"},
  {name:"CNBC", domain:"cnbc.com", scope:"world", lang:"en", type:"اقتصادی"},
  {name:"Foreign Affairs", domain:"foreignaffairs.com", scope:"world", lang:"en", type:"مجله تحلیلی"},
  {name:"Foreign Policy", domain:"foreignpolicy.com", scope:"world", lang:"en", type:"مجله تحلیلی"},
  {name:"NPR", domain:"npr.org", scope:"world", lang:"en", type:"رادیو/آنلاین"},
  {name:"Newsweek", domain:"newsweek.com", scope:"world", lang:"en", type:"مجله"},
  {name:"Sky News", domain:"news.sky.com", scope:"world", lang:"en", type:"تلویزیون/آنلاین"},
  {name:"Time", aliases:["تایم"], domain:"time.com", scope:"world", lang:"en", type:"مجله"},
  // رسانه‌های جهان
  {name:"Reuters", domain:"reuters.com", scope:"world", lang:"en", type:"خبرگزاری"},
  {name:"Associated Press", domain:"apnews.com", scope:"world", lang:"en", type:"خبرگزاری"},
  {name:"BBC", domain:"bbc.com", scope:"world", lang:"en", type:"رسانه عمومی"},
  {name:"The Guardian", domain:"theguardian.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"Guardian Weekly", aliases:["هفته‌نامه گاردین"], domain:"theguardian.com", scope:"world", lang:"en", type:"هفته‌نامه"},
  {name:"Financial Times", domain:"ft.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"The Economist", aliases:["اکونومیست"], domain:"economist.com", scope:"world", lang:"en", type:"هفته‌نامه"},
  {name:"The New York Times", domain:"nytimes.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"The Wall Street Journal", aliases:["وال‌استریت ژورنال"], domain:"wsj.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"The Washington Post", domain:"washingtonpost.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"CNN", domain:"cnn.com", scope:"world", lang:"en", type:"تلویزیون/آنلاین"},
  {name:"Al Jazeera English", aliases:["Al Jazeera"], domain:"aljazeera.com", scope:"world", lang:"en", type:"تلویزیون/آنلاین"},
  // جهان — اسپانیایی
  {name:"El País", domain:"elpais.com", scope:"world", lang:"es", type:"روزنامه"},
  {name:"Agencia EFE", domain:"efe.com", scope:"world", lang:"es", type:"خبرگزاری"},
  {name:"RTVE Noticias", domain:"rtve.es", scope:"world", lang:"es", type:"رسانه عمومی"},
  {name:"BBC Mundo", domain:"bbc.com", scope:"world", lang:"es", type:"رسانه بین‌المللی"},
  {name:"CNN en Español", domain:"cnnespanol.cnn.com", scope:"world", lang:"es", type:"تلویزیون/آنلاین"},
  {name:"DW Español", domain:"dw.com", scope:"world", lang:"es", type:"رسانه بین‌المللی"},
  {name:"France 24 Español", domain:"france24.com", scope:"world", lang:"es", type:"تلویزیون/آنلاین"},
  {name:"El Mundo", domain:"elmundo.es", scope:"world", lang:"es", type:"روزنامه"},
  {name:"La Vanguardia", domain:"lavanguardia.com", scope:"world", lang:"es", type:"روزنامه"},
  {name:"ABC España", domain:"abc.es", scope:"world", lang:"es", type:"روزنامه"},
  {name:"El Confidencial", domain:"elconfidencial.com", scope:"world", lang:"es", type:"رسانه آنلاین"},
  {name:"Clarín", domain:"clarin.com", scope:"world", lang:"es", type:"روزنامه"},
  {name:"La Nación", domain:"lanacion.com.ar", scope:"world", lang:"es", type:"روزنامه"},
  {name:"El Universal México", domain:"eluniversal.com.mx", scope:"world", lang:"es", type:"روزنامه"},
  {name:"NTN24", domain:"ntn24.com", scope:"world", lang:"es", type:"تلویزیون/آنلاین"},
  {name:"Le Monde", domain:"lemonde.fr", scope:"world", lang:"fr", type:"روزنامه"},
  {name:"France 24", domain:"france24.com", scope:"world", lang:"fr", type:"تلویزیون/آنلاین"},
  {name:"RFI", domain:"rfi.fr", scope:"world", lang:"fr", type:"رادیو/آنلاین"},
  {name:"Le Figaro", domain:"lefigaro.fr", scope:"world", lang:"fr", type:"روزنامه"},
  {name:"Libération", domain:"liberation.fr", scope:"world", lang:"fr", type:"روزنامه"},
  {name:"Anadolu Ajansı", domain:"aa.com.tr", scope:"world", lang:"tr", type:"خبرگزاری"},
  {name:"TRT Haber", domain:"trthaber.com", scope:"world", lang:"tr", type:"تلویزیون/آنلاین"},
  {name:"Hürriyet", domain:"hurriyet.com.tr", scope:"world", lang:"tr", type:"روزنامه"},
  {name:"Cumhuriyet", domain:"cumhuriyet.com.tr", scope:"world", lang:"tr", type:"روزنامه"},
  {name:"الجزيرة", domain:"aljazeera.net", scope:"world", lang:"ar", type:"تلویزیون/آنلاین"},
  {name:"العربية", domain:"alarabiya.net", scope:"world", lang:"ar", type:"تلویزیون/آنلاین"},
  {name:"الشرق الأوسط", domain:"aawsat.com", scope:"world", lang:"ar", type:"روزنامه"},
  {name:"Der Spiegel", domain:"spiegel.de", scope:"world", lang:"de", type:"مجله"},
  {name:"Frankfurter Allgemeine", domain:"faz.net", scope:"world", lang:"de", type:"روزنامه"},
  {name:"Süddeutsche Zeitung", domain:"sueddeutsche.de", scope:"world", lang:"de", type:"روزنامه"}
]

const PRESS_SCOPE_FA = {all:"همه", "iran-agency":"رسانه‌های خبری ایران", "iran-paper":"مطبوعات ایران", "iran-magazine":"مجلات ایران", youtube:"ویدئو و پادکست", diaspora:"رسانه‌های فارسی بیرون ایران", world:"رسانه‌های جهان", magazine:"مجلات"};
const PRESS_KIND_FA = {all:"همه", newspaper:"روزنامه‌ها", agency:"خبرگزاری‌ها", magazine:"مجلات", podcast:"پادکست‌ها", youtube:"کانال‌های یوتیوب", talk:"گفت‌وگومحور", broadcast:"تلویزیون و رادیو", online:"رسانه‌های آنلاین"};
function pressKindOf(s){
  const t=String(s?.type||"");
  if(/پادکست/.test(t)) return "podcast";
  if(/گفت[‌ -]?وگو|تاک[‌ -]?شو|کلاب/.test(t)) return "talk";
  if(/روزنامه/.test(t)) return "newspaper";
  if(/خبرگزاری/.test(t)) return "agency";
  if(/مجله|ماهنامه|فصلنامه|هفته[‌ -]?نامه|دوماهنامه/.test(t)) return "magazine";
  if(/تلویزیون|رادیو|شبکه/.test(t)) return "broadcast";
  if(s?.scope==="youtube") return "youtube";
  return "online";
}
function pressMatchesScope(s, scope){
  if(scope==="all") return true;
  if(scope==="magazine") return pressKindOf(s)==="magazine";
  if(scope==="iran-magazine") return s.scope==="iran-magazine";
  return s.scope===scope;
}
const PRESS_LANG_FA = {all:"همه زبان‌ها", fa:"فارسی", en:"انگلیسی", es:"اسپانیایی", fr:"فرانسوی", tr:"ترکی", ar:"عربی", de:"آلمانی"};

function pressLogo(s) {
  const src = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(s.domain) + "&sz=128";
  return `<span class="press-logo"><img src="${src}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><b style="display:none">${esc((s.name||"ج").slice(0,1))}</b></span>`;
}
function setPressScope(v){ pressScope=v; renderPress(""); }
function setPressKind(v){ pressKind=v; renderPress(""); }
function setPressLanguage(v){ pressLanguage=v; renderPress(""); }
function setPressSourceTab(sourceName, tab){ pressSourceTab=tab; renderPress(sourceName); }
function _pressFindSource(name){
  const n=_canonicalNorm(name||"");
  return PRESS_SOURCES.find(s=>[s.name,...(s.aliases||[])].some(x=>_canonicalNorm(x)===n))||null;
}
function _pressMediaData(meta, figureData){
  if(!meta||!figureData)return {adapter:null,videos:[],people:[]};
  const names=new Set([meta.name,...(meta.aliases||[])].map(_canonicalNorm));
  const figures=figureData.figures||[];
  const adapter=figures.find(f=>f.directory===false && [f.name_fa,...(f.aliases||[])].map(_canonicalNorm).some(x=>names.has(x)))||null;
  const videos=(adapter?.youtube_videos||[]).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const ids=new Set(videos.map(v=>String(v.id||"")).filter(Boolean));
  const people=figures.filter(f=>f.directory!==false && (f.youtube_videos||[]).some(v=>ids.has(String(v.id||""))))
    .map(f=>({handle:f.handle,name_fa:f.name_fa,role_fa:f.role_fa,avatar:f.avatar,count:(f.youtube_videos||[]).filter(v=>ids.has(String(v.id||""))).length}))
    .sort((a,b)=>b.count-a.count||String(a.name_fa||"").localeCompare(String(b.name_fa||""),"fa"));
  return {adapter,videos,people};
}

async function showPress(sourceName, canonicalId=null) {
  if((sourceName||"")!==pressSourceCurrent){ pressSourceCurrent=sourceName||""; pressSourceTab="latest"; }
  const canonicalSource=sourceName?(canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByName("source",sourceName)):null;
  canonicalId=canonicalSource?.id||canonicalId;
  show("press"); setTab("press");
  renderPress(sourceName || "", canonicalSource);
  setHash(sourceName ? (canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/press-source/" + encodeURIComponent(sourceName)) : "#/press");
}
async function loadPeriodicals() {
  if (periodicalRows.length) return periodicalRows;
  let rows=[]; try { rows=await getJSON(`${DATA}/periodicals.json?v=${Date.now()}`); } catch (_) {}
  periodicalRows=Array.isArray(rows)?rows:((rows && Array.isArray(rows.articles))?rows.articles:[]);
  return periodicalRows;
}
async function loadPressDirectory(){
  if(pressDirectoryCache!==null) return pressDirectoryCache;
  if(Array.isArray(window.__PRESS_DIRECTORY__)){
    pressDirectoryCache=window.__PRESS_DIRECTORY__;
    return pressDirectoryCache;
  }
  let rows=[];
  try{rows=await getJSON(`${DATA}/press-directory.json?v=${Date.now()}`,5000);}catch(_){}
  pressDirectoryCache=Array.isArray(rows)?rows:[];
  return pressDirectoryCache;
}
async function loadPressStats(){
  if(pressStatsCache) return pressStatsCache;
  let rows=[]; try{rows=await getJSON(`${DATA}/press-stats.json`);}catch(_){}
  pressStatsCache=Array.isArray(rows)?rows:[];
  return pressStatsCache;
}
async function loadPressHealth(){
  if(pressHealthCache) return pressHealthCache;
  let rows=[], registry=[];
  try{rows=await getJSON(`${DATA}/press-source-health.json`);}catch(_){}
  try{registry=await getJSON(`${DATA}/press-registry-health.json`);}catch(_){}
  rows=Array.isArray(rows)?rows:[];
  registry=Array.isArray(registry)?registry:[];
  const operational=new Set(rows.map(x=>x.source_name));
  pressHealthCache=rows.concat(registry.filter(x=>!operational.has(x.source_name)));
  return pressHealthCache;
}
function pressSourceHealth(s, rows){
  const names=[s.name,...(s.aliases||[])];
  const matches=(rows||[]).filter(x=>names.includes(x.source_name));
  if(!matches.length) return null;
  return matches.sort((a,b)=>String(b.last_run||"").localeCompare(String(a.last_run||"")))[0];
}
function pressHealthBadge(h){
  if(!h) return '<span class="press-health ph-pending">پایش در انتظار</span>';
  const map={
    active:["ph-active","فعال"],
    empty:["ph-empty","متصل · بدون آیتم"],
    error:["ph-error","خطای دریافت"],
    disabled:["ph-disabled","غیرفعال"],
    pending:["ph-pending","در انتظار"]
  };
  const x=map[h.state]||map.pending;
  return `<span class="press-health ${x[0]}" title="${esc(h.last_error||"")}">${x[1]}</span>`;
}
function pressSourceStats(s, stats){
  const names=[s.name,...(s.aliases||[])];
  const rows=stats.filter(x=>names.includes(x.source_name));
  return rows.reduce((a,x)=>({story_count:a.story_count+(x.story_count||0),iran_story_count:a.iran_story_count+(x.iran_story_count||0),latest_at:(!a.latest_at||((x.latest_at||"")>a.latest_at))?(x.latest_at||a.latest_at):a.latest_at}),{story_count:0,iran_story_count:0,latest_at:null});
}
async function renderPress(sourceName, canonicalSource=null) {
  if(sourceName && !canonicalSource) canonicalSource=await canonicalEntityByName("source",sourceName);
  const el=document.getElementById("press-content");
  if(sourceName){
    // Only article data is required to render a source page. Stats/health are
    // optional decoration and must never hold the page on a spinner.
    if(!periodicalRows.length){
      el.innerHTML='<div class="spinner"></div>';
      await loadPeriodicals();
    }
    if(pressStatsCache===null || pressHealthCache===null){
      Promise.allSettled([loadPressStats(),loadPressHealth()]).then(()=>{
        if(document.getElementById("press-content")===el &&
           decodeURIComponent(location.hash||"").includes("/press-source/")) renderPress(sourceName);
      });
    }
  }else{
    // The directory needs only the tiny synchronous manifest. Health status is
    // loaded in the background and may enhance badges later.
    if(pressDirectoryCache===null){
      el.innerHTML='<div class="spinner"></div>';
      await loadPressDirectory();
    }
    if(pressHealthCache===null){
      loadPressHealth().then(()=>{
        if(document.getElementById("press-content")===el && location.hash==="#/press") renderPress("");
      }).catch(()=>{});
    }
  }
  const rows=periodicalRows||[];
  const stats=pressStatsCache||[];
  const health=pressHealthCache||[];
  const manifest=pressDirectoryCache||[];
  const directoryMap=new Map(manifest.filter(x=>x&&x.source_name&&Number(x.count||0)>0).map(x=>[String(x.source_name),x]));
  const groups=new Map(); rows.forEach(x=>{const n=x.publisher||"نشریه";if(!groups.has(n))groups.set(n,[]);groups.get(n).push(x);});

  if(!sourceName){
    const sourceDirRow=s=>{
      const names=[s.name,...(s.aliases||[])];
      const matches=names.map(n=>directoryMap.get(n)).filter(Boolean);
      if(!matches.length) return {count:0,latest_at:null};
      return matches.reduce((a,x)=>({
        count:a.count+Number(x.count||0),
        latest_at:(!a.latest_at||String(x.latest_at||"")>String(a.latest_at||""))?(x.latest_at||a.latest_at):a.latest_at
      }),{count:0,latest_at:null});
    };
    const allSources=PRESS_SOURCES.filter(s=>pressLanguage==="all"||s.lang===pressLanguage);
    const sources=allSources.filter(s=>pressKind==="all"||pressKindOf(s)===pressKind)
      .sort((a,b)=>{
        const ad=sourceDirRow(a),bd=sourceDirRow(b);
        return Number(bd.count>0)-Number(ad.count>0)||bd.count-ad.count||String(a.name||"").localeCompare(String(b.name||""),"fa");
      });
    const kindCounts={};
    for(const s of PRESS_SOURCES) kindCounts[pressKindOf(s)]=(kindCounts[pressKindOf(s)]||0)+1;
    const kindControls=Object.entries(PRESS_KIND_FA).map(([k,v])=>`<button class="press-kind-chip ${pressKind===k?"on":""}" onclick="setPressKind('${k}')"><span>${v}</span><b>${faN(k==="all"?PRESS_SOURCES.length:(kindCounts[k]||0))}</b></button>`).join("");
    const langs=[...new Set(PRESS_SOURCES.filter(s=>pressKind==="all"||pressKindOf(s)===pressKind).map(s=>s.lang))];
    const langControls=["all",...langs].map(k=>`<button class="fchip ${pressLanguage===k?"on":""}" onclick="setPressLanguage('${k}')">${PRESS_LANG_FA[k]||k}</button>`).join("");
    const cards=sources.map(s=>{
      const dr=sourceDirRow(s), h=pressSourceHealth(s,health), kind=PRESS_KIND_FA[pressKindOf(s)]||s.type;
      const active=dr.count>0;
      return `<button class="press-source press-source-rich press-directory-card ${active?"has-content":"no-content"}" onclick="showPress('${esc(s.name)}')">
        ${pressLogo(s)}
        <span class="press-source-copy">
          <span class="press-source-title"><strong>${esc(s.name)}</strong>${pressHealthBadge(h)}</span>
          <small>${esc(s.type)} · ${PRESS_LANG_FA[s.lang]||s.lang}</small>
          ${s.description?`<p>${esc(s.description)}</p>`:""}
          <em>${active?faN(dr.count)+" مطلب":(s.scope==="youtube"?"منبع ویدئویی ثبت‌شده":"در انتظار نخستین محتوای پردازش‌شده")}${dr.latest_at?" · آخرین: "+relTime(dr.latest_at):""}</em>
        </span><span class="press-kind-label">${esc(kind)}</span>
      </button>`;
    }).join("");
    const known=new Set(PRESS_SOURCES.flatMap(s=>[s.name,...(s.aliases||[])]));
    const extra=manifest.filter(x=>x&&x.source_name&&Number(x.count||0)>0&&!known.has(String(x.source_name))).map(x=>[String(x.source_name),Number(x.count||0)]);
    const activeCount=PRESS_SOURCES.filter(s=>sourceDirRow(s).count>0).length;
    el.innerHTML=`<section class="press-directory-hero"><span class="press-kicker">دایرکتوری منابع پندار</span><h1>منابع</h1><p>روزنامه‌ها، خبرگزاری‌ها، مجلات، پادکست‌ها و رسانه‌های ویدئویی در یک فهرست واحد؛ هر منبع صفحهٔ مستقل خودش را دارد.</p><div class="press-directory-stats"><span><b>${faN(PRESS_SOURCES.length)}</b> منبع ثبت‌شده</span><span><b>${faN(activeCount)}</b> دارای محتوای پردازش‌شده</span><span><b>${faN(PRESS_SOURCES.filter(s=>s.scope==="youtube").length)}</b> منبع ویدئویی</span></div></section>
      <div class="press-kind-filter">${kindControls}</div>
      <div class="press-filter-row press-langs">${langControls}</div>
      ${cards?`<div class="press-grid press-directory-grid">${cards}</div>`:`<div class="state"><div class="big">منبعی با این فیلتر پیدا نشد</div></div>`}
      ${extra.length?`<div class="rule"><span>منابع تازهٔ پردازش‌شده</span><span class="l"></span></div><div class="press-grid">${extra.map(([name,count])=>`<button class="press-source" onclick="showPress('${esc(name)}')"><span class="press-mark">ج</span><strong>${esc(name)}</strong><small>${faN(count)} مطلب</small></button>`).join("")}</div>`:""}`;

    return;
  }

  const meta=_pressFindSource(sourceName);
  let mediaData={adapter:null,videos:[],people:[]};
  if(meta?.scope==="youtube"){
    try{ mediaData=_pressMediaData(meta,await loadFigures()); }catch(_){}
  }
  const items=meta ? [meta.name,...(meta.aliases||[])].flatMap(n=>groups.get(n)||[]) : (groups.get(sourceName)||[]);
  const st=meta?pressSourceStats(meta,stats):{story_count:0,iran_story_count:0,latest_at:null};
  const h=meta?pressSourceHealth(meta,health):null;
  // Source pages render periodical items immediately. Ordinary news-feed
  // stories are an optional enhancement loaded afterwards, never a blocker.
  const names=meta?[meta.name,...(meta.aliases||[])]:[sourceName];
  const sourceStoryCard=x=>{
    const metaBits=[];
    if(x.published_at) metaBits.push(relTime(x.published_at));
    if(x.category) metaBits.push(CAT_FA[x.category]||x.category);
    if(x.source_count>1) metaBits.push(faN(x.source_count)+" منبع");
    const relevance=IRAN_FA[x.iran_relevance]||"";
    if(relevance) metaBits.push(relevance);
    return `<article class="press-article press-click press-news-full" onclick="openStory('${esc(x.id)}')">
      <div class="press-news-meta"><span class="chip">${esc(sourceName)}</span>${metaBits.length?`<span>${metaBits.map(esc).join(" · ")}</span>`:""}</div>
      <h2>${esc(x.headline_fa||x.title_fa||"")}</h2>
      ${x.summary_fa?`<p>${esc(x.summary_fa)}</p>`:""}
      ${x.image_url?`<img class="press-news-thumb" src="${esc(x.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:""}
      <div class="press-read">پروندهٔ کامل خبر ←</div>
    </article>`;
  };
  const renderSourcePage=(feedItems=[])=>{
    const isVideo=meta?.scope==="youtube";
    const latestHtml=(items.length||feedItems.length)?`<div class="press-source-count">${faN(feedItems.length + items.length)} مطلب موجود از این منبع</div><div class="press-list">${feedItems.map(sourceStoryCard).join("")}${items.map(x=>`<article class="press-article press-click" onclick="openPressArticle('${esc(x.id)}')"><span class="chip">${esc(meta?.name||sourceName)}</span><h2>${esc(x.headline_fa||x.title_fa||x.title_original||"")}</h2>${x.summary_fa?`<p>${esc(x.summary_fa)}</p>`:""}<div class="press-read">خواندن بازگویی تفصیلی ←</div></article>`).join("")}</div>`:`<div class="state press-empty"><div class="big">هنوز مطلبی از این رسانه پردازش نشده</div><p class="muted">خود منبع در دایرکتوری ثبت شده است و محتوای تازه پس از دریافت در همین صفحه ظاهر می‌شود.</p></div>`;
    const videosHtml=mediaData.videos.length?`<div class="press-video-grid">${mediaData.videos.slice(0,60).map(v=>`<article class="press-video-card"><a href="${esc(v.url)}" target="_blank" rel="noopener"><span class="press-video-thumb">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy">`:""}<i>▶</i></span><b>${esc(v.title||"ویدئو")}</b><small>${v.published_at?relTime(v.published_at):"YouTube"}</small></a>${v.recap_fa?`<button onclick="openStatement('youtube-${String(v.id||"").replace(/'/g,"\\'")}')">جان کلام این ویدئو</button>`:""}</article>`).join("")}</div>`:`<div class="state press-empty"><div class="big">هنوز ویدئویی در خروجی ثبت نشده</div><p class="muted">کانال منبع ثبت شده و با اجرای گردآورنده، ویدئوهای تازه اینجا قرار می‌گیرند.</p></div>`;
    const peopleHtml=mediaData.people.length?`<div class="press-source-people">${mediaData.people.map(p=>`<button onclick="openFigure('${String(p.handle||"").replace(/'/g,"\\'")}')">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:`<span class="press-person-fallback">${esc((p.name_fa||"?").slice(0,1))}</span>`}<span><b>${esc(p.name_fa||"")}</b><small>${esc(p.role_fa||"")} · ${faN(p.count)} ویدئو</small></span></button>`).join("")}</div>`:`<div class="state press-empty"><div class="big">هنوز چهره‌ای به این منبع متصل نشده</div><p class="muted">با شناسایی نام مهمان‌ها در ویدئوها، پروفایل چهره‌ها به این صفحه متصل می‌شود.</p></div>`;
    const aboutHtml=`<section class="press-source-about"><h2>دربارهٔ ${esc(meta?.name||sourceName)}</h2><p>${esc(meta?.description||((meta?.type||"رسانه")+" در دایرکتوری منابع پندار."))}</p><div class="press-source-facts"><span><b>نوع</b>${esc(meta?.type||"رسانه")}</span><span><b>زبان</b>${esc(PRESS_LANG_FA[meta?.lang]||meta?.lang||"—")}</span><span><b>حوزه</b>${esc(PRESS_SCOPE_FA[meta?.scope]||meta?.scope||"—")}</span>${h?`<span><b>وضعیت پایش</b>${esc(h.state||"—")}</span>`:""}</div></section>`;
    const tabs=[["latest","آخرین مطالب"],...(isVideo?[["videos","ویدئوها"],["people","چهره‌های حاضر"]]:[]),["about","دربارهٔ منبع"]];
    const tabsHtml=`<div class="press-source-tabs">${tabs.map(([k,label])=>`<button class="${pressSourceTab===k?"on":""}" onclick="setPressSourceTab('${esc(meta?.name||sourceName)}','${k}')">${label}${k==="videos"&&mediaData.videos.length?` <b>${faN(mediaData.videos.length)}</b>`:""}${k==="people"&&mediaData.people.length?` <b>${faN(mediaData.people.length)}</b>`:""}</button>`).join("")}</div>`;
    const body=pressSourceTab==="videos"?videosHtml:pressSourceTab==="people"?peopleHtml:pressSourceTab==="about"?aboutHtml:latestHtml;
    el.innerHTML=`<div class="press-source-head"><button class="back" onclick="showPress()">همهٔ منابع</button>${meta?pressLogo(meta):""}<div><span class="press-kicker">${esc(meta?.type||"رسانه")}</span><h2>${esc(meta?.name||sourceName)} ${pressHealthBadge(h)}</h2>${meta?`<p>${PRESS_LANG_FA[meta.lang]||meta.lang}${st.iran_story_count?` · ${faN(st.iran_story_count)} خبر مرتبط با ایران`:""}${st.latest_at?` · آخرین خبر: ${relTime(st.latest_at)}`:""}${h&&h.last_run?` · آخرین پایش: ${relTime(h.last_run)}`:""}</p>`:""}</div></div>
      ${canonicalSource?canonicalStrip(canonicalSource):""}
      ${tabsHtml}
      <div class="press-source-tab-body">${body}</div>`;
  };
  renderSourcePage([]);

  (async()=>{
    let feedItems=[];
    try{
      const archive=await getJSON(`${DATA}/press-source-stories.json`,5000);
      feedItems=names.flatMap(n => Array.isArray(archive && archive[n]) ? archive[n] : []);
      const seen=new Set();
      feedItems=feedItems.filter(x=>x && x.id && !seen.has(String(x.id)) && seen.add(String(x.id)))
        .sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
    }catch(_){
      try{
        const feed=await getJSON(`${DATA}/stories.json`,5000);
        feedItems=(Array.isArray(feed)?feed:[]).filter(x=>(x.source_names||[]).some(n=>names.includes(n)));
      }catch(__){}
    }
    if(document.getElementById("press-content")===el && pressSourceCurrent===sourceName) renderSourcePage(feedItems);
  })();
}

function _pressNormText(s){
  return String(s||"").replace(/[\s\u200c]+/g," ").replace(/[،؛:,.!?؟"'«»()\[\]{}]/g,"").trim();
}
function _pressNearDuplicate(a,b){
  const x=_pressNormText(a), y=_pressNormText(b);
  if(!x||!y) return false;
  if(x===y) return true;
  const shorter=x.length<=y.length?x:y, longer=x.length>y.length?x:y;
  return shorter.length>=70 && longer.includes(shorter) && shorter.length/longer.length>.5;
}
function _gcalStamp(iso){
  const d=new Date(iso||"");
  if(Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
}
function pressEventCard(x){
  const e=x.event||{};
  const has=!!(e.is_event||e.date_fa||e.time_fa||e.start_iso||e.location_fa||e.address_fa);
  if(!has) return "";
  const where=[e.location_fa,e.address_fa].filter(Boolean).join("، ");
  const rows=[
    e.date_fa?`<div class="press-event-item"><span>تاریخ</span><b>${esc(e.date_fa)}</b></div>`:"",
    e.time_fa?`<div class="press-event-item"><span>ساعت</span><b>${esc(e.time_fa)}</b></div>`:"",
    where?`<div class="press-event-item press-event-place"><span>مکان</span><b>${esc(where)}</b></div>`:""
  ].join("");
  const actions=[];
  const start=_gcalStamp(e.start_iso);
  let end=_gcalStamp(e.end_iso);
  if(start&&!end){
    const d=new Date(e.start_iso); d.setHours(d.getHours()+2); end=_gcalStamp(d.toISOString());
  }
  if(start&&end){
    const original=x.source_url||x.article_url||x.telegram_post_url||"";
    const details=[x.summary_fa||"",original?("منبع: "+original):""].filter(Boolean).join("\n\n");
    const cal="https://calendar.google.com/calendar/render?action=TEMPLATE"
      +"&text="+encodeURIComponent(x.headline_fa||x.title_original||"رویداد")
      +"&dates="+encodeURIComponent(start+"/"+end)
      +"&details="+encodeURIComponent(details)
      +(where?"&location="+encodeURIComponent(where):"");
    actions.push(`<a class="press-event-action" href="${cal}" target="_blank" rel="noopener">افزودن به Google Calendar ↗</a>`);
  }
  if(where){
    const maps="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(where);
    actions.push(`<a class="press-event-action" href="${maps}" target="_blank" rel="noopener">مشاهده در Google Maps ↗</a>`);
  }
  return `<section class="press-event-card"><div class="press-event-kicker">اطلاعات رویداد</div><div class="press-event-grid">${rows}</div>${actions.length?`<div class="press-event-actions">${actions.join("")}</div>`:""}</section>`;
}

async function openPressArticle(id) {
  show("press"); setTab("press"); const el=document.getElementById("press-content"); el.innerHTML='<div class="spinner"></div>';
  const [rows,bookData]=await Promise.all([loadPeriodicals(),loadBooks()]);
  const x=rows.find(r=>String(r.id)===String(id));
  if(!x){el.innerHTML='<div class="state"><div class="big">مطلب پیدا نشد</div></div>';return;}
  setArticleSeo(x);
  const summary=x.summary_fa||"";
  let body=x.body_fa||x.longform_fa||"";
  if(_pressNearDuplicate(summary,body)) body="";
  const points=(x.key_points_fa||[]).map(p=>`<li>${esc(p)}</li>`).join("");
  const hero=x.image_url||x.hero_image_url||x.source_image_url||x.og_image||"";
  const originalUrl=x.source_url||x.article_url||x.telegram_post_url||"";
  const isFallback=x.enrichment_state==="metadata_fallback";
  const note=isFallback
    ?"این صفحه بر پایهٔ توضیح منتشرشده در خوراک رسمی منبع ساخته شده است؛ برای متن کامل به منبع اصلی مراجعه کنید."
    :"این متن بازنویسی مستقل و وفادارانه‌ای بر پایهٔ محتوای منبع است و جایگزین متن اصلی نیست.";
  const eventCard=pressEventCard(x);
  const relatedBooks=(bookData.books||[]).filter(b=>(b.mentions||[]).some(m=>String(m.article_id||"")===String(id)));
  const bookStrip=relatedBooks.length?`<section class="press-books"><div class="press-box-label">کتاب‌های این مطلب</div><div class="press-book-links">${relatedBooks.map(b=>`<button onclick="openBook('${esc(b.slug)}')"><span>کتاب</span><b>${esc(b.title_fa||"")}</b></button>`).join("")}</div></section>`:"";
  el.innerHTML=`<article class="press-detail press-longread">
    <button class="back press-article-back" onclick="showPress('${esc(x.publisher||"")}')">بازگشت به ${esc(x.publisher||"نشریه")}</button>
    <header class="press-longread-head">
      <div class="press-kicker-row"><span class="press-kicker">پیشخوان جراید</span><span class="press-source-name">${esc(x.publisher||"نشریه")}</span>${x.section_fa?`<span class="press-section-dot">•</span><span class="press-section-name">${esc(x.section_fa)}</span>`:""}</div>
      <h1>${esc(x.headline_fa||x.title_original||"")}</h1>
      ${x.title_original && x.title_original!==(x.headline_fa||"")?`<div class="press-original">${esc(x.title_original)}</div>`:""}
      ${summary?`<p class="press-deck">${esc(summary)}</p>`:""}
      <div class="press-article-meta">${x.source_published_at?`<span>انتشار منبع: ${esc(String(x.source_published_at).slice(0,10))}</span>`:""}<span>منبع: ${esc(x.publisher||"")}</span></div>
    </header>
    ${eventCard}
    ${hero?`<figure class="press-hero"><img src="${esc(hero)}" alt="" loading="eager" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()"></figure>`:""}
    ${points?`<section class="press-points"><div class="press-box-label">جانِ مطلب</div><ul>${points}</ul></section>`:""}
    ${bookStrip}
    ${body?`<section class="press-body">${body.split(/\\n{2,}/).map(p=>`<p>${esc(p)}</p>`).join("")}</section>`:""}
    <footer class="press-longread-foot">
      <div class="press-copyright-note">${esc(note)}</div>
      ${originalUrl?`<a class="press-source-link" href="${esc(originalUrl)}" target="_blank" rel="noopener">مشاهدهٔ منبع اصلی ↗</a>`:""}
    </footer>
  </article>`;
  setHash("#/press-article/"+encodeURIComponent(id));
}

/* ---- hash routing: shareable URLs + working Back button ----
   Each view/story gets its own #/… URL. Deep links and Back/Forward work.
   _navLock stops our own setHash() from re-triggering the router. */
let _navLock = false;
function setHash(h) {
  h = h || "#/";                              // home sentinel
  if ((location.hash || "#/") === h) return;  // no change (also no-op on first load)
  _navLock = true;
  location.hash = h;
  setTimeout(() => { _navLock = false; }, 0);
}
async function route() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const i = raw.indexOf("/");
  const kind = i < 0 ? raw : raw.slice(0, i);
  const arg = i < 0 ? "" : decodeURIComponent(raw.slice(i + 1));
  if (kind === "story" && arg) return openStory(arg);
  if (kind === "person" && arg) return openEntity(arg);
  if (kind === "topic" && arg) return openTopic(arg);
  if (kind === "trend" && arg) return openTrendDossier(arg);
  if (kind === "source" && arg) return openSource(arg);
  if (kind === "province" && arg) return openProvince(arg);
  if (kind === "day" && arg) return openDay(arg);
  if (kind === "trends") return showTrends();
  if (kind === "fact") return showFactchecks();
  if (kind === "iran") return showIran();
  if (kind === "topics") return showTopics();
  if (kind === "market") return showMarket();
  if (kind === "weather") return showWeather();
  if (kind === "faq") return showFaq();
  if (kind === "figures") return showFigures();
  if (kind === "videos") return showLatestVideos(arg === "recaps" ? "recaps" : "all");
  if (kind === "studio-recaps") return showStudioRecaps();
  if (kind === "finance") return showProjectFinance();
  if (kind === "studio-recap" && arg) return openStudioRecap(arg);
  if (kind === "press") return showPress();
  if (kind === "press-source" && arg) return showPress(arg);
  if (kind === "press-article" && arg) return openPressArticle(arg);
  if (kind === "books") return showBooks(["publishers","people","new","all","used","reviews"].includes(arg) ? arg : "books");
  if (kind === "book" && arg) return openBook(arg);
  if (kind === "movies") return showMovies();
  if (kind === "movie" && arg) return openMovie(arg);
  if (kind === "master-movie" && arg) return openMasterMovie(arg);
  if (kind === "tv") return showTVGuide(arg || "now");
  if (kind === "knowledge") return showKnowledge(arg || "home");
  if (kind === "entity" && arg) return openCanonicalEntity(arg);
  if (kind === "graph" && arg) return openEntityGraph(arg);
  if (kind === "profile" && arg) return openEntityProfile(arg);
  if (kind === "system" && arg === "entities") return showEntityQA();
  if (kind === "system") return showSystem();
  if (kind === "publisher" && arg) return openPublisher(arg);
  if (kind === "book-person" && arg) return openBookPerson(arg);
  if (kind === "tech") return showTech();
  if (kind === "figure" && arg) return openFigure(arg);
  if (kind === "news-person" && arg) return openNewsPerson(arg);
  if (kind === "statement" && arg) return openStatement(arg);
  return showFeed();
}
window.addEventListener("hashchange", () => { if (!_navLock) route(); });

function credBadge(c) {
  if (!c) return "";
  let out = `<span class="cstatus ${CRED_CLS[c.level] || "st-neutral"}">${CRED_FA[c.level] || ""}</span>`;
  if (c.needs_verification) out += `<span class="cstatus st-warn">نیازمند راستی‌آزمایی</span>`;
  return out;
}
function fcBadge(f) {
  return f ? `<span class="cstatus st-ok fc-badge">✓ فکت‌نامه</span>` : "";
}
function geoBadge(g) {
  if (!g || !g.scope) return "";
  if (g.scope === "local") {
    const p = g.provinces && g.provinces[0];
    return `<span class="geo-badge local">${p ? esc(p.name_fa) : "استانی"}</span>`;
  }
  return `<span class="geo-badge ${g.scope}">${SCOPE_FA[g.scope] || ""}</span>`;
}

// Detail-view geo strip: bigger mini-map + a caption listing the highlighted places.
function detailGeoStrip(s) {
  const mm = miniMap(s, { detail: true });
  if (!mm) return "";
  const provs = (s.geo && s.geo.provinces || []).map(p => p.name_fa);
  const countries = (s.countries || []).map(c => c.name_fa);
  const parts = [];
  if (provs.length) parts.push("استان‌ها: " + provs.join("، "));
  if (countries.length) parts.push("کشورها: " + countries.join("، "));
  if (!parts.length && s.geo && s.geo.scope) {
    parts.push({ international: "بین‌المللی", national: "سراسر ایران",
                 local: "استانی" }[s.geo.scope] || "");
  }
  return `<div class="geo-strip">${mm}<span class="g-lbl">${esc(parts.join(" · "))}</span></div>`;
}

// A tiny "where is this story" map — Iran mini-map with highlighted provinces
// for local/national stories, world mini-map with highlighted countries otherwise.
// Purely for at-a-glance orientation; falls back to nothing when nothing to show.
function miniMap(s, opts) {
  opts = opts || {};
  const cls = opts.detail ? "mini-map mm-detail" : "mini-map";
  const provs = (s.geo && s.geo.provinces || []).map(p => p.slug);
  const scope = s.geo && s.geo.scope;
  const isIranMap = provs.length > 0 || scope === "local"
    || (scope === "national" && (!s.countries || s.countries.length === 0));

  if (isIranMap && window.IRAN_PATHS) {
    const hit = new Set(provs);
    const paths = Object.entries(window.IRAN_PATHS).map(([slug, p]) =>
      `<path d="${p.d}" class="${hit.has(slug) ? "mm-hit" : "mm-bg"}"/>`).join("");
    return `<span class="${cls}" title="${esc((s.geo && s.geo.provinces || []).map(p=>p.name_fa).join("، ") || "ایران")}">
      <svg viewBox="${window.IRAN_VIEWBOX}" preserveAspectRatio="xMidYMid meet">${paths}</svg></span>`;
  }
  if (!window.WORLD_PATHS) return "";
  const codes = new Set((s.countries || []).map(c => c.code));
  // If nothing detected but story is international, still show a world background.
  if (!codes.size && scope !== "international" && !opts.detail) return "";
  const paths = Object.entries(window.WORLD_PATHS).map(([code, d]) => {
    if (code === "_bg") return `<path d="${d}" class="mm-bg"/>`;
    return `<path d="${d}" class="${codes.has(code) ? "mm-hit" : "mm-bg"}"/>`;
  }).join("");
  const names = (s.countries || []).map(c => c.name_fa).join("، ");
  return `<span class="${cls}" title="${esc(names || "بین‌المللی")}">
    <svg viewBox="${window.WORLD_VIEWBOX}" preserveAspectRatio="xMidYMid meet">${paths}</svg></span>`;
}

// clickable chips for the named figures in a story → their own page
function peopleRow(ents) {
  if (!ents || !ents.length) return "";
  const chips = ents.slice(0, 6).map(e =>
    `<span class="person-chip" data-slug="${esc(e.slug)}" onclick="event.stopPropagation();openEntity(this.dataset.slug)">${esc(e.name_fa)}</span>`).join("");
  return `<div class="people">${chips}</div>`;
}
// self-contained styling (theme-aware) so no separate CSS file is needed
(function () {
  const css = `.people{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 2px}
.person-chip{font-size:12.5px;padding:3px 10px;border-radius:999px;cursor:pointer;
  background:rgba(26,157,126,.12);color:#1a9d7e;border:1px solid rgba(26,157,126,.32);white-space:nowrap}
.person-chip:hover{background:rgba(26,157,126,.22)}
.people-strip{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}
.timeline{margin:6px 0 0}
.tl-item{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:start;background:none;border:none;padding:9px 0;cursor:pointer;color:inherit;position:relative;font-family:inherit}
.tl-item:not(:last-child)::after{content:"";position:absolute;inset-inline-start:5px;top:20px;bottom:-9px;width:2px;background:rgba(26,157,126,.25)}
.tl-dot{flex:0 0 12px;width:12px;height:12px;border-radius:50%;background:#1a9d7e;margin-top:5px}
.tl-body{display:flex;flex-direction:column;gap:2px}
.tl-time{font-size:12px;color:#8fa89b}
.tl-h{font-size:15px;line-height:1.6}
.tl-cur{cursor:default}
.tl-cur .tl-dot{background:#e0b341;box-shadow:0 0 0 3px rgba(224,179,65,.2)}
.tl-cur .tl-h{font-weight:700}
.tl-now{font-size:11px;color:#e0b341}
button.tl-item:hover .tl-h{color:#1a9d7e}
.mini-map{flex:0 0 auto;width:78px;height:52px;border-radius:6px;background:rgba(26,157,126,.06);
  border:1px solid rgba(26,157,126,.22);padding:2px;overflow:hidden;display:inline-flex;align-items:center;justify-content:center}
.mini-map svg{width:100%;height:100%;display:block}
.mini-map .mm-bg{fill:rgba(143,168,155,.20);stroke:rgba(143,168,155,.35);stroke-width:.5;vector-effect:non-scaling-stroke}
.mini-map .mm-hit{fill:#1a9d7e;stroke:#0d5b48;stroke-width:.5;vector-effect:non-scaling-stroke}
.mm-detail{width:180px;height:120px}
.mm-caption{font-size:11.5px;color:#8fa89b;text-align:center;margin-top:4px}
.geo-strip{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0 6px}
.geo-strip .g-lbl{font-size:13px;color:#8fa89b}
.sb-click{cursor:pointer;transition:background .15s ease,color .15s ease;border-radius:8px;padding-inline:6px;margin-inline:-6px}
.sb-click:hover{background:rgba(26,157,126,.10);color:#1a9d7e}
.stile-click{cursor:pointer;transition:transform .12s ease,border-color .15s ease}
.stile-click:hover{transform:translateY(-1px);border-color:#1a9d7e;color:#1a9d7e}
.bars-svg .bar-click{cursor:pointer;transition:opacity .15s ease}
.bars-svg .bar-click:hover{opacity:.7}
.day-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px;margin:0 -4px 6px;scrollbar-width:none}
.day-chips::-webkit-scrollbar{display:none}
.day-chip{flex:0 0 auto;padding:5px 12px;font-size:12.5px;border-radius:999px;
  border:1px solid rgba(143,168,155,.35);color:#a9c4b7;background:transparent;cursor:pointer;white-space:nowrap;font-family:inherit}
.day-chip .d-n{font-size:11px;color:#8fa89b;margin-inline-start:4px}
.day-chip:hover{border-color:#1a9d7e;color:#1a9d7e}
.day-chip.on{background:rgba(26,157,126,.15);border-color:#1a9d7e;color:#1a9d7e}
.card-thumb{flex:0 0 84px;width:84px;height:84px;border-radius:8px;object-fit:cover;background:rgba(143,168,155,.10);border:1px solid rgba(143,168,155,.18)}
.hero-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:rgba(143,168,155,.10);margin:6px 0 12px;display:block}
.hero-credit{font-size:12px;color:#8fa89b;margin:-6px 0 12px;text-align:end}
.ref-strip{display:flex;flex-direction:column;gap:6px;margin:0 0 14px;padding:10px 12px;background:rgba(26,157,126,.06);border:1px solid rgba(26,157,126,.20);border-radius:10px}
.ref-strip .ref-hd{font-size:12.5px;color:#8fa89b}
.ref-strip .ref-hd b{color:#a9c4b7}
.ref-links{display:flex;flex-wrap:wrap;gap:8px}
.ref-links a{font-size:13px;padding:4px 10px;border-radius:8px;text-decoration:none;background:rgba(26,157,126,.10);color:#1a9d7e;border:1px solid rgba(26,157,126,.22);white-space:nowrap}
.ref-links a:hover{background:rgba(26,157,126,.20)}
.ref-links a .ref-src{color:#8fa89b;font-size:11.5px;margin-inline-end:4px}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
})();

function feedCard(s, homepage = false) {
  const imp = impInfo(s.importance_score);
  const badges = (s.source_names || []).slice(0, 4).map(x => `<span class="src-badge clickable" data-src="${esc(x)}" onclick="event.stopPropagation();openSource(this.dataset.src)">${esc(x)}</span>`).join("");
  // Show the article's image when the outlet's RSS provided one; otherwise
  // fall back to the mini-map (so every card has a visual anchor).
  const thumb = s.image_url
    ? `<img class="card-thumb" loading="lazy" src="${esc(s.image_url)}" alt="" onerror="this.remove()">`
    : miniMap(s);
  return `<button class="card" onclick="openStory('${s.id}')">
    <div class="meta"><span class="chip">${CAT_FA[s.category] || "خبر"}</span>
      <span class="dot"></span><span class="muted">${relTime(s.published_at)}</span>${geoBadge(s.geo)}${trendBadge(s.trend)}
      <span class="imp ${imp.cls}"><span class="bars"><i></i><i></i><i></i></span><span class="lbl">${imp.lbl}</span></span></div>
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <h2>${esc(homepage ? homeEditorialText(s.headline_fa || "") : (s.headline_fa || ""))}</h2>
        <p class="kalam">${esc(homepage ? homeEditorialText(s.summary_fa || "") : (s.summary_fa || ""))}</p>
      </div>
      ${thumb}
    </div>
    ${peopleRow(s.entities)}
    <div class="foot"><span class="sources-mini">${faN(s.source_count || 0)} منبع:</span>${badges}
      <span class="cred-row">${s.figure_count ? `<span class="fig-badge" title="دیدگاه چهره‌ها دربارهٔ این خبر">${faN(s.figure_count)} دیدگاه</span>` : ""}${credBadge(s.credibility)}${fcBadge(s.factcheck)}${saveBtn(s.id)}</span></div>
  </button>`;
}

let ALL = [];
let tier = "all";
let feedRange = "all";
async function loadFeed(renderHome = true) {
  const el = document.getElementById("feed");
  try {
    ALL = await getJSON(`${DATA}/stories.json`);
    if (renderHome) {
      renderFeed();
      renderDayChips();
      updateFreshness();
      renderHomeDaily();
    }
  } catch (e) {
    const why = e && e.name === "AbortError" ? "دریافت داده بیش از حد طول کشید." : "فایل خبرها در دسترس نیست.";
    el.innerHTML = `<div class="state"><div class="big">خبرها بارگذاری نشد</div>
      <p class="muted">${why}</p>
      <button class="fchip on" onclick="retryFeed()">تلاش دوباره</button></div>`;
  }
}
async function retryFeed() {
  const el = document.getElementById("feed");
  el.innerHTML = '<div class="loader"></div>';
  await loadFeed();
}
// A small horizontally-scrolling strip above the feed: today, yesterday, and
// the last few days that actually have stories. Fast browse "back in time".
function renderDayChips() {
  const holder = document.getElementById("day-chips");
  if (!holder) return;
  const counts = {};
  ALL.forEach(s => {
    const d = (s.published_at || "").slice(0, 10);
    if (d) counts[d] = (counts[d] || 0) + 1;
  });
  const days = Object.keys(counts).sort().reverse().slice(0, 10);
  if (!days.length) { holder.innerHTML = ""; return; }
  holder.innerHTML = days.map(d =>
    `<button class="day-chip" onclick="openDay('${d}')">${esc(dayLabel(d))}
      <span class="d-n">${faN(counts[d])}</span></button>`).join("");
}
const tierOf = s => impInfo(s.importance_score).cls;   // high | mid | low
function feedFilter(mode) {
  if (mode === "mine") return mineFeed();
  if (mode === "rising") return ALL.filter(s => s.trend && s.trend.rising);
  if (mode === "hot") return ALL.filter(s => s.trend && s.trend.hot);
  if (mode === "high" || mode === "mid" || mode === "low") return ALL.filter(s => tierOf(s) === mode);
  return ALL;
}
function renderFeed() {
  const el = document.getElementById("feed");
  if (!ALL.length) { el.innerHTML = `<div class="state"><div class="big">هنوز خبری منتشر نشده</div></div>`; return; }
  if (tier === "mine" && followCount() === 0 && !(FOLLOW.saved && FOLLOW.saved.length)) {
    el.innerHTML = `<div class="state mine-empty"><div class="big">سرخطِ تو خالی است</div>
      <p class="muted">با زدنِ ستارهٔ ★ روی موضوع‌ها (در تبِ موضوعات)، استان‌ها (در صفحهٔ ایران) و منابع، یا ذخیرهٔ خبرها، اینجا سرخطِ شخصیِ خودت ساخته می‌شود — روی همین دستگاه.</p></div>`;
    return;
  }
  let items = feedFilter(tier);
  if (feedRange !== "all") { const newest = items.map(s => new Date(s.published_at || 0).getTime()).filter(Number.isFinite).reduce((a,b)=>Math.max(a,b),0); const base = newest || Date.now(); const cut = base - Number(feedRange) * 3600e3; items = items.filter(s => { const t=new Date(s.published_at||0).getTime(); return Number.isFinite(t) && t >= cut; }); }
  if (sortMode === "new") items = items.slice().sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
  else if (sortMode === "sources") items = items.slice().sort((a,b)=>(b.source_count||0)-(a.source_count||0));
  else if (sortMode === "views") items = items.slice().sort((a,b)=>(b.figure_count||0)-(a.figure_count||0) || (b.source_count||0)-(a.source_count||0));
  else if (sortMode === "rising") items = items.slice().sort((a,b)=>((b.trend&&b.trend.velocity)||0)-((a.trend&&a.trend.velocity)||0));
  const empty = { rising: "الان خبری در حالِ رشد نیست", hot: "الان خبرِ داغی نداریم",
    mine: "هنوز خبری از دنبال‌شده‌هایت نیست" }[tier] || "خبری در این نما نیست";
  el.innerHTML = items.length ? items.map(s => feedCard(s, true)).join("")
    : `<div class="state"><div class="big">${empty}</div></div>`;
}
function setTier(t) {
  tier = t;
  document.querySelectorAll("#imp-filter .fchip").forEach(c =>
    c.classList.toggle("on", (c.getAttribute("onclick") || "").indexOf("'" + t + "'") >= 0));
  renderFeed();
}
function setFeedRange(r) { feedRange = r; document.querySelectorAll(".day-range-chips > .day-chip[data-range]").forEach(b => b.classList.toggle("on", String(b.dataset.range) === String(r))); renderFeed(); }
let sortMode = "imp";
function setSort(m) {
  sortMode = m;
  ["imp","new","sources","views","rising"].forEach(x => { const b=document.getElementById("sort-"+x); if(b) b.classList.toggle("on",m===x); });
  renderFeed();
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
    </div>`;
}
function showAsk(i) {
  document.querySelectorAll(".qchip").forEach(c => c.classList.remove("on"));
  document.getElementById("answer").classList.add("show");
  document.getElementById("a-bubble").textContent = (window._asks[i] || {}).a || "—";
}

/* ---- بورس اخبار ---- */
let _trendsLoaded = false;
const grp = n => Number(n).toLocaleString("en-US");
async function renderTrends() {
  if (_trendsLoaded) return;
  const el = document.getElementById("trends");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const [t, st, ents] = await Promise.all([
      getJSON(`${DATA}/trends.json`),
      getJSON(`${DATA}/stats.json`).catch(() => null),
      getJSON(`${DATA}/entities.json`).catch(() => []),
    ]);
    const peopleChips = (ents || []).slice(0, 24).map(x =>
      `<span class="person-chip" data-slug="${esc(x.slug)}" onclick="openEntity(this.dataset.slug)">${esc(x.name_fa)} <span class="chip-n">${faN(x.count)}</span></span>`).join("");
    const peopleSection = peopleChips
      ? `<div class="rule" style="margin-top:22px"><span>چهره‌ها در خبرها</span><span class="l"></span></div>
         <div class="people-strip">${peopleChips}</div>` : "";
    const topics = (t.topics || []);
    const g = t.google || {};
    const googleOn = Object.keys(g).length > 0;
    const rows = topics.map(tp => {
      const series = tp.series || [];
      const cmp = g[tp.slug];
      const chart = cmp
        ? `<div class="tp-chart cmp">${svgCompare(series, cmp.points.map(p => p.v))}</div>
           <div class="cmp-legend"><span class="lg a">جان‌کلام</span><span class="lg b">گوگل ترندز</span></div>`
        : `<div class="tp-chart">${svgSpark(series, { w: 150, h: 34 })}</div>`;
      return `<button class="tp-row" onclick="openTrendDossier('${tp.slug}')">
        <div class="tp-head"><span class="tp-name">${esc(tp.name_fa)}</span>${growthTag(tp.growth)}
          <span class="tp-n">${faN(tp.story_count)} خبر · هفته: ${faN(tp.last7 == null ? tp.story_count : tp.last7)}</span></div>
        ${chart}</button>`;
    }).join("");
    const hot = (t.hottest || []).map(h => `<div class="ticker" onclick="openStory('${h.id}')" style="cursor:pointer">
      <span class="t-name">${esc(h.headline_fa)}<span class="t-cat">${CAT_FA[h.category] || ""}</span></span>
      <span class="t-val">${faN(h.source_count)}</span>
      <span class="t-chg tx-up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>منبع</span></div>`).join("");
    const statsSection = st ? `<div class="rule" style="margin-top:2px"><span>نبض خبری</span><span class="l"></span></div>${statsBlock(st)}` : "";
    el.innerHTML = `
      ${statsSection}
      <div class="tx-hero"><span class="val">${faN(t.story_total || 0)}</span><span class="lbl">خبرِ فعال روی تخته</span>
        <span class="spacer" style="flex:1"></span><span class="lbl">${faN(topics.length)} موضوع فعال</span></div>
      ${peopleSection}
      <div class="rule"><span>رشدِ موضوع‌ها <span class="n">۱۴ روزِ اخیر</span></span><span class="l"></span></div>
      <div class="tp-board">${rows || '<p class="muted">—</p>'}</div>
      ${googleOn ? '' : '<p class="muted" style="margin:8px 0 0">مقایسه با گوگل ترندز فعلاً در دسترس نیست (آزمایشی).</p>'}
      <div class="rule" style="margin-top:26px"><span>پرپوشش‌ترین خبرها</span><span class="l"></span></div>
      <div class="tickers">${hot || '<p class="muted">—</p>'}</div>
      <p class="muted" style="margin-top:18px">«رشد» = مقایسهٔ خبرهای این هفته با هفتهٔ پیش. «پوشش» = چند منبعِ مستقل یک خبر را گفته‌اند.</p>`;
    _trendsLoaded = true;
  } catch (e) {
    el.innerHTML = `<div class="state"><div class="big">بورس اخبار بارگذاری نشد</div></div>`;
  }
}

/* ---- فکت — hub with sub-tabs: needs-verification / disagreement / Factnameh ---- */
function fcCard(f) {
  return `<a class="card fc-card" href="${f.url}" target="_blank" rel="noopener">
    <div class="meta"><span class="chip">فکت‌نامه</span><span class="dot"></span><span class="muted">${esc((f.published || "").slice(0, 10))}</span>
      <span class="ext" style="margin-inline-start:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg></span></div>
    <h2>${esc(f.title)}</h2>${f.summary ? `<p class="kalam">${esc(f.summary)}</p>` : ""}</a>`;
}
let _factData = { needs: [], disp: [], fn: [] };
async function renderFactchecks() {
  const el = document.getElementById("factchecks");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const fn = await getJSON(`${DATA}/factchecks.json`).catch(() => []);
    const needs = ALL.filter(s => s.credibility && s.credibility.needs_verification);
    const disp = ALL.filter(s => s.credibility && (s.credibility.disagreements || 0) > 0);
    _factData = { needs, disp, fn };
    const tabs = [["needs", "نیازمندِ راستی‌آزمایی", needs.length],
                  ["disp", "اختلافِ منابع", disp.length],
                  ["fn", "فکت‌نامه", fn.length]];
    const first = (tabs.find(t => t[2] > 0) || tabs[0])[0];
    el.innerHTML = `<div class="fact-note">این سنجه‌ها <b>خودکار</b>ند و از روی منابعِ هر خبر ساخته می‌شوند — نه حکمِ نهایی. راستی‌آزماییِ قطعی کارِ فکت‌نامه است.</div>
      <div class="imp-filter" id="fact-tabs">${tabs.map(t => `<button class="fchip" data-k="${t[0]}" onclick="setFactTab('${t[0]}')">${t[1]}${t[2] ? ` <span class="chip-n">${faN(t[2])}</span>` : ""}</button>`).join("")}</div>
      <div id="fact-body"></div>`;
    setFactTab(first);
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">بارگذاری نشد</div></div>`; }
}
function setFactTab(k) {
  document.querySelectorAll("#fact-tabs .fchip").forEach(c => c.classList.toggle("on", c.dataset.k === k));
  const d = _factData;
  const b = document.getElementById("fact-body");
  const empty = `<div class="state"><div class="big">موردی نیست</div></div>`;
  if (k === "needs")
    b.innerHTML = d.needs.length ? `<p class="muted" style="margin:0 0 12px">خبرهای تک‌منبع که هنوز منبعِ مستقلِ دیگری تأییدشان نکرده.</p><div class="feed">${d.needs.map(feedCard).join("")}</div>` : empty;
  else if (k === "disp")
    b.innerHTML = d.disp.length ? `<p class="muted" style="margin:0 0 12px">خبرهایی که منابع در جزئیاتشان با هم اختلاف دارند.</p><div class="feed">${d.disp.map(feedCard).join("")}</div>` : empty;
  else
    b.innerHTML = d.fn.length ? `<p class="muted" style="margin:0 0 12px">راستی‌آزماییِ مستقل و حرفه‌ای (شریکِ برنامهٔ متا). روی هر مورد بزن.</p><div class="feed">${d.fn.map(fcCard).join("")}</div>` : empty;
}

/* ---- راهنما / FAQ ---- */
let _faqLoaded = false;
const FAQ = [
  ["خبرها از کجا می‌آیند؟",
    "پندار به‌طور خودکار از فیدِ (RSS) ده‌ها خبرگزاری می‌خواند: منابعِ جهانی (رویترز، AP، بی‌بی‌سی، گاردین، الجزیره)، منابعِ داخلیِ فارسی (ایرنا، ایسنا، تسنیم) و منابعِ فارسیِ برون‌مرزی (بی‌بی‌سی فارسی، ایران اینترنشنال، رادیو فردا، دویچه‌وله). هدف این است که هم روایتِ داخلی و هم روایتِ خارجی کنارِ هم دیده شوند."],
  ["چطور از چند منبع یک خبر می‌سازد؟",
    "سیستم خبرهایی که دربارهٔ یک رویدادِ واحد هستند را «خوشه‌بندی» می‌کند: عنوان‌ها و متن‌ها را مقایسه می‌کند و گزارش‌های مربوط به یک اتفاق را در یک خبرِ واحد کنار هم می‌گذارد. برای همین زیرِ هر خبر می‌بینی «۳ منبع» یا «۵ منبع»."],
  ["منظور از تفکیکِ «واقعیت / دیدگاه / جان‌کلام / ابهام» چیست؟",
    "هر خبر چهار لایه دارد که عمداً از هم جدا نگه داشته شده‌اند: <b>واقعیت</b> (آنچه معلوم است)، <b>دیدگاهِ هر منبع</b> (هر خبرگزاری چه می‌گوید، جدا از بقیه)، <b>جان‌کلام</b> (خلاصهٔ کوتاهِ ترکیبی)، و <b>ابهام</b> (آنچه هنوز روشن نیست). این‌طوری تحلیل با واقعیت قاطی نمی‌شود."],
  ["برچسبِ «مهم / بسیار مهم» چطور حساب می‌شود؟",
    "یک امتیازِ شفاف از ۱۰۰ که از پنج عامل ساخته می‌شود: تعدادِ منابعِ مستقل (تا ۳۵)، اعتبارِ منابع (تا ۲۰)، سرعتِ پوشش/تعدادِ گزارش‌ها (تا ۱۵)، تازگیِ خبر (تا ۲۰)، و میزانِ ارتباط با ایران (تا ۱۰). امتیازِ ۷۵ به بالا «بسیار مهم»، ۵۰ تا ۷۵ «مهم»، و پایین‌تر «متوسط» است. هیچ‌چیزِ آن جعبهٔ سیاه نیست."],
  ["«اعتبارِ خبر» با فکت‌نامه چه فرقی دارد؟",
    "«اعتبارِ خبر» یک سنجهٔ <b>خودکارِ</b> ماست که فقط به دو چیز نگاه می‌کند: چند منبعِ مستقل خبر را گفته‌اند و آیا با هم توافق دارند یا اختلاف. خبرِ تک‌منبعی برچسبِ «نیازمند راستی‌آزمایی» می‌گیرد. این «حکمِ درست/غلط» نیست — فقط نشان می‌دهد یک ادعا چقدر پشتوانهٔ چندمنبعی دارد. راستی‌آزماییِ واقعی و انسانی کارِ نهادهایی مثلِ فکت‌نامه است."],
  ["فکت‌نامه چیست و کِی برچسبش را می‌بینم؟",
    "فکت‌نامه یک نهادِ مستقل و حرفه‌ایِ راستی‌آزمایی به فارسی است (شریکِ برنامهٔ راستی‌آزماییِ متا). آخرین گزارش‌هایش را در بخشِ «فکت‌نامه» می‌بینی، و اگر یکی از خبرهای ما با یک گزارشِ فکت‌نامه هم‌موضوع باشد، رویِ آن خبر برچسبِ «راستی‌آزمایی‌شده در فکت‌نامه» با لینک ظاهر می‌شود."],
  ["ارتباط با ایران چطور تعیین می‌شود؟",
    "بر اساسِ واژه‌های کلیدیِ مرتبط با ایران در متنِ خبر. اگر ربطی نباشد، سیستم به‌زور ربطی نمی‌سازد — خبر بی‌ارتباط صریحاً «بدون ارتباط مستقیم با ایران» علامت می‌خورد."],
  ["کپی‌رایت چه می‌شود؟ آیا متنِ کاملِ خبرها را می‌آورید؟",
    "نه. پندار هیچ‌وقت متنِ کاملِ مقاله‌ها را بازنشر نمی‌کند. فقط خلاصهٔ کوتاه می‌سازد و به منبعِ اصلی لینک می‌دهد تا خودت آنجا کامل بخوانی."],
  ["هوش مصنوعی دقیقاً چه‌کار می‌کند؟",
    "خلاصه و تفکیکِ چهارلایه را یک مدلِ هوش مصنوعی (جمینای) می‌سازد، اما خروجی‌اش پیش از انتشار اعتبارسنجیِ ساختاری می‌شود و همیشه به منابعِ واقعی گره خورده است. متنِ منابع دست‌نخورده و لینک‌دار می‌ماند."],
  ["هر چند وقت به‌روز می‌شود؟",
    "هر یک ساعت، به‌صورتِ خودکار. زمانِ آخرین به‌روزرسانی بالای «سرخط» نوشته شده است."],
];
function renderFaq() {
  if (_faqLoaded) return;
  document.getElementById("faq").innerHTML = FAQ.map(([q, a]) =>
    `<details class="faq-item"><summary>${esc(q)}</summary><div class="faq-a">${a}</div></details>`).join("")
    + `<p class="muted" style="margin-top:18px;text-align:center">پندار — خبر، دیدگاه و زمینه در یک شبکهٔ واحد.</p>`;
  _faqLoaded = true;
}

async function renderTopics() {
  const el = document.getElementById("topic-grid");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const topics = await getJSON(`${DATA}/topics.json`);
    const counted = topics
      .map(t => ({ ...t, n: ALL.filter(s => (s.topics || []).some(x => x.slug === t.slug)).length }))
      .filter(t => t.n > 0)
      .sort((a, b) => b.n - a.n);
    if (!counted.length) {
      el.innerHTML = `<div class="state"><div class="big">هنوز موضوعی دسته‌بندی نشده</div><p class="muted">با به‌روزرسانیِ بعدی پر می‌شود.</p></div>`;
      return;
    }
    el.innerHTML = counted.map(t => `<div class="topic" role="button" tabindex="0" onclick="openTopic('${t.slug}')">
      <div class="t-body"><div class="t-fa">${esc(t.name_fa)}</div><div class="t-count">${faN(t.n)} خبر</div></div>
      ${followBtn("topics", t.slug, "دنبال", "دنبال کن")}</div>`).join("");
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">موضوعات بارگذاری نشد</div></div>`; }
}

// archive feed grouped by importance tier ("به تفکیک اهمیت")
const TIERS = [["high", "بسیار مهم"], ["mid", "مهم"], ["low", "متوسط"]];
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

/* ---- ایران — province map + scope classification ----
   نقشهٔ واقعیِ استان‌ها (choropleth): مسیرهای دقیق در iran-provinces.js
   (برگرفته از masoudnemati/iran-map با مجوز MIT). */
const PATHS = (typeof window !== "undefined" && window.IRAN_PATHS) || {};
const VIEWBOX = (typeof window !== "undefined" && window.IRAN_VIEWBOX) || "0 0 990 890";

let _iranScope = "all";
function showIran() { show("iran"); setTab("iran"); renderIran(); setHash("#/iran"); }
async function renderIran() {
  const el = document.getElementById("iran");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const geo = await getJSON(`${DATA}/geo.json`).catch(() => ({ provinces: {}, scope: {} }));
    const pc = geo.provinces || {};
    const max = Math.max(1, ...Object.values(pc));
    const paths = Object.entries(PATHS).map(([slug, p]) => {
      const n = pc[slug] || 0;
      const alpha = n ? (0.30 + 0.70 * (n / max)) : 0;
      const fill = n ? ` fill="rgba(26,157,126,${alpha.toFixed(3)})"` : "";
      const cls = "prov" + (n ? " has" : "");
      const tip = esc(p.fa) + (n ? ` — ${faN(n)} خبر` : "");
      return `<path d="${p.d}" class="${cls}"${fill} onclick="openProvince('${slug}')"><title>${tip}</title></path>`;
    }).join("");
    const sc = geo.scope || {};
    const total = (sc.local || 0) + (sc.national || 0) + (sc.international || 0);
    const scopes = [["all", "همه", total], ["local", "استانی", sc.local || 0],
      ["national", "کشوری", sc.national || 0], ["international", "بین‌المللی", sc.international || 0]];
    const provChips = Object.entries(PATHS).map(([slug, p]) => {
      const n = pc[slug] || 0, on = isF("provinces", slug);
      return `<button class="pfollow ${on ? "on" : ""}" onclick="hitProvFollow('${slug}',this)"><span class="pf-star">★</span>${esc(p.fa)}${n ? ` <span class="chip-n">${faN(n)}</span>` : ""}</button>`;
    }).join("");
    el.innerHTML = `
      <div class="iran-map">
        <svg viewBox="${VIEWBOX}" class="iran-svg" role="img" aria-label="نقشهٔ استان‌های ایران">${paths}</svg>
      </div>
      <p class="muted" style="text-align:center;margin:2px 0 12px">روی هر استان بزن تا خبرهایش را ببینی — رنگِ پررنگ‌تر یعنی خبرِ بیشتر.</p>
      <details class="prov-follow"><summary>دنبال‌کردنِ استان‌ها ★</summary>
        <p class="muted" style="margin:8px 0">استان‌هایی که دنبال کنی، خبرهایشان در «سرخط من» می‌آید (روی این دستگاه ذخیره می‌شود).</p>
        <div class="pfollow-grid">${provChips}</div></details>
      <div class="imp-filter" id="iran-scopes">${scopes.map(s => `<button class="fchip" data-s="${s[0]}" onclick="setIranScope('${s[0]}')">${s[1]}${s[2] ? ` <span class="chip-n">${faN(s[2])}</span>` : ""}</button>`).join("")}</div>
      <div id="iran-body"></div>`;
    setIranScope(_iranScope);
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">صفحهٔ ایران بارگذاری نشد</div></div>`; }
}
function setIranScope(s) {
  _iranScope = s;
  document.querySelectorAll("#iran-scopes .fchip").forEach(c => c.classList.toggle("on", c.dataset.s === s));
  const items = s === "all" ? ALL : ALL.filter(x => x.geo && x.geo.scope === s);
  document.getElementById("iran-body").innerHTML = groupedFeed(items);
}
function openProvince(slug) {
  if (!ALL.length) return;
  setHash("#/province/" + slug);
  show("topicarchive"); setTab("iran");
  document.getElementById("ta-back-t").textContent = "بازگشت به ایران";
  document.getElementById("ta-back").onclick = showIran;
  const items = ALL.filter(s => s.geo && (s.geo.provinces || []).some(p => p.slug === slug));
  const name = (PATHS[slug] || {}).fa || slug;
  document.getElementById("ta-title").textContent = "استان: " + name;
  document.getElementById("ta-sub").textContent = faN(items.length) + " خبر در این استان";
  document.getElementById("ta-feed").innerHTML = followBar("provinces", slug, "خبرهای این استان در «سرخط من» بیاید") + groupedFeed(items);
}
function hitProvFollow(slug, btn) {
  toggleF("provinces", slug);
  btn.classList.toggle("on", isF("provinces", slug));
  updateMineBadge();
}

const root = document.documentElement;
document.getElementById("theme").addEventListener("click", () => {
  const cur = root.getAttribute("data-theme"), sysDark = matchMedia("(prefers-color-scheme:dark)").matches;
  root.setAttribute("data-theme", (cur === "dark" || (!cur && sysDark)) ? "light" : "dark");
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

// freshness line: when the SYSTEM last checked, and how old the NEWEST story is
let META = null;
getJSON(`${DATA}/meta.json`).then(m => { META = m; updateFreshness(); }).catch(() => {});
function updateFreshness() {
  const el = document.getElementById("built"); if (!el) return;
  const parts = [];
  if (META && (META.built_iso || META.built)) parts.push("آخرین بازبینیِ سیستم: " + (META.built_iso ? relTime(META.built_iso) : META.built));
  if (ALL && ALL.length) {
    const newest = ALL.map(s => s.published_at).filter(Boolean).sort().slice(-1)[0];
    if (newest) parts.push("تازه‌ترین خبر: " + relTime(newest));
  }
  if (parts.length) el.textContent = parts.join(" · ");
}

// compact price strip on the home page (dollar / euro / lira / emami coin)
async function renderHomePrices() {
  const el = document.getElementById("home-prices");
  if (!el) return;
  try {
    const prices = await getJSON(`${DATA}/prices.json`);
    if (!prices || !prices.length) return;
    const want = ["دلار آمریکا", "یورو", "لیر ترکیه", "سکه امامی"];
    const pick = want.map(w => prices.find(p => p.label_fa === w)).filter(Boolean);
    if (!pick.length) return;
    el.innerHTML = pick.map(p => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      return `<div class="hp"><span class="hp-label">${esc(p.label_fa)}</span>
        <span class="hp-val">${faN(grp(p.value))}</span>
        <span class="hp-chg ${cls}">${arrow} ${faN(Math.abs(p.dp || 0))}٪</span></div>`;
    }).join("") + `<button class="hp-more" onclick="showMarket()">پنداربازار ›</button>`;
  } catch (e) {}
}

// Compact market + weather table directly below the home stats.
async function renderHomeGlance() {
  const el = document.getElementById("home-glance");
  if (!el) return;
  try {
    const [prices, weather] = await Promise.all([
      getJSON(`${DATA}/prices.json`).catch(() => []),
      getJSON(`${DATA}/weather.json`).catch(() => [])
    ]);
    const usd = (prices || []).find(p => p.label_fa === "دلار آمریکا");
    const tr = (prices || []).find(p => p.label_fa === "لیر ترکیه");
    const cities = ["نوشهر", "چالوس", "کرمان", "تهران"]
      .map(name => (weather || []).find(w => w.city_fa === name)).filter(Boolean);
    const delta = (n, unit="") => {
      if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
      const v=Number(n), cls=v>0?"up":v<0?"down":"flat", sign=v>0?"+":v<0?"−":"";
      return `<span class="hg-delta ${cls}">${sign}${faN(grp(Math.abs(v)))}${unit} <i>۲۴ساعت</i></span>`;
    };
    const market = [usd, tr].filter(Boolean).map(p =>
      `<button class="hg-cell" onclick="showMarket()"><span class="hg-label">${esc(p.label_fa)}</span><b>${faN(grp(p.value))}</b>${delta(p.delta24,"")}<small>تومان · ${p.dp ? faN(Math.abs(p.dp))+"٪" : "بدون تغییر"}</small></button>`
    ).join("");
    const wx = cities.map(c =>
      `<button class="hg-cell" onclick="showWeather()"><span class="hg-label">${c.icon || "🌡️"} ${esc(c.city_fa)}</span><b>${faN(c.temp)}°</b>${delta(c.delta24,"°")}<small>${esc(c.cond_fa || "")} · ${faN(c.min)}°/${faN(c.max)}°</small></button>`
    ).join("");
    if (!market && !wx) return;
    el.innerHTML = `<div class="hg-grid">${market}${wx}</div>`;
  } catch (_) {}
}

// Compact human layer on the homepage: curated figures with portraits,
// ordered by their most recent activity. News-only synthetic profiles are excluded.
// Some profiles aggregate heterogeneous/source-mixed material and are therefore
// kept off homepage surfaces while remaining fully available in Jan Kalam.
const HOME_FIGURE_EXCLUDE=new Set(["mostafatajzadeh"]);
async function renderHomePeople(){
  const section=document.getElementById("home-people-strip");
  const el=document.getElementById("home-people-list");
  if(!section||!el) return;
  try{
    const d=await loadFigures();
    const figures=(d.figures||[])
      .filter(f=>f && f.avatar &&
        f.field!=="news" &&
        !String(f.handle||"").startsWith("news-") &&
        !HOME_FIGURE_EXCLUDE.has(String(f.handle||"").toLowerCase()))
      .map(f=>({
        ...f,
        _latest:(f.posts||[]).map(p=>String(p.published_at||"")).sort().slice(-1)[0]||""
      }))
      .sort((a,b)=>String(b._latest).localeCompare(String(a._latest)))
      // The five newest figures already appear in the vertical "latest statements"
      // panel below. Skip them here so the horizontal strip adds different faces.
      .slice(5,19);
    if(!figures.length){ section.style.display="none"; return; }
    el.innerHTML=figures.map(f=>`
      <button class="home-person" onclick="openFigure('${esc(f.handle)}')" aria-label="${esc(f.name_fa||"")}">
        <span class="home-person-ring"><img src="${esc(f.avatar)}" alt="" loading="lazy" onerror="this.closest('.home-person')?.remove()"></span>
        <span class="home-person-name">${esc(f.name_fa||"")}</span>
      </button>`).join("");
    section.style.display="";
  }catch(_){
    section.style.display="none";
  }
}

// Homepage daily intelligence: the strongest current stories plus the latest figure statements.
async function renderHomeDaily(){
  const storyEl=document.getElementById("home-daily-stories");
  const voiceEl=document.getElementById("home-daily-voices");
  if(!storyEl||!voiceEl) return;
  const score=s=>{
    const imp=Number(s.importance_score||0);
    const sources=Math.min(Number(s.source_count||0),8)*3;
    const figures=Math.min(Number(s.figure_count||0),6)*2;
    const hot=s.trend?.hot?12:s.trend?.rising?7:0;
    const age=s.published_at?Math.max(0,(Date.now()-new Date(s.published_at).getTime())/36e5):999;
    const freshness=Math.max(0,18-Math.min(age,18));
    return imp+sources+figures+hot+freshness;
  };
  const stories=(ALL||[]).slice().sort((a,b)=>score(b)-score(a)).slice(0,5);
  storyEl.innerHTML=stories.length?stories.map((s,i)=>`
    <button class="home-intel-row" onclick="openStory('${esc(s.id)}')">
      <span class="home-intel-rank">${faN(i+1)}</span>
      <span class="home-intel-copy"><b>${esc(homeEditorialText(s.headline_fa||""))}</b><small>${[relTime(s.published_at),s.source_count?faN(s.source_count)+" منبع":"",s.figure_count?faN(s.figure_count)+" دیدگاه":""].filter(Boolean).join(" · ")}</small></span>
      <span class="home-intel-go">←</span>
    </button>`).join(""):'<div class="state"><div class="big">هنوز سرخطی ثبت نشده</div></div>';
  try{
    const d=await loadFigures();
    // Homepage voices are intentionally limited to curated figures with a real
    // portrait. News-only people (synthetic "news-*" profiles / field=news)
    // stay in the dedicated news-people views and never fill this homepage box.
    const homeFigures=(d.figures||[]).filter(f =>
      f && f.avatar &&
      f.field !== "news" &&
      !String(f.handle||"").startsWith("news-") &&
      !HOME_FIGURE_EXCLUDE.has(String(f.handle||"").toLowerCase())
    );
    const rankedPosts=homeFigures.flatMap(f=>(f.posts||[]).map(p=>({...p,_person:f})))
      .filter(p=>p.published_at)
      .sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));
    // Show at most one item per figure on the homepage. Because rankedPosts is
    // newest-first, the first item we keep is that person's latest statement.
    const seenHomeFigures=new Set();
    const posts=rankedPosts.filter(p=>{
      const key=String(p._person?.handle||p.handle||"").toLowerCase();
      if(!key || seenHomeFigures.has(key)) return false;
      seenHomeFigures.add(key);
      return true;
    }).slice(0,5);
    voiceEl.innerHTML=posts.length?posts.map(p=>`
      <button class="home-voice-row" onclick="openStatement('${esc(statementKey(p))}')">
        ${avatar(p._person,"sm")}
        <span class="home-intel-copy"><span class="home-voice-name">${esc(p._person.name_fa||"")}</span><b>${esc(homeEditorialText(p.topic_fa||p.summary_fa||"دیدگاه تازه"))}</b><small>${[relTime(p.published_at),p.kind==="news_statement"?"در خبرها":"دیدگاه مستقیم"].join(" · ")}</small></span>
        <span class="home-intel-go">←</span>
      </button>`).join(""):'<div class="state"><div class="big">گفتهٔ تازه‌ای ثبت نشده</div></div>';
  }catch(_){
    voiceEl.innerHTML='<div class="state"><div class="big">گفته‌ها در دسترس نیستند</div></div>';
  }
}

// Homepage Jan-e Majra: a compact window into the strongest current topic dossiers.
function scrollHomeMajra(dir) {
  const el = document.getElementById("home-majra-cards");
  if (!el) return;
  const card = el.querySelector(".hm-strip-card");
  const step = card ? card.getBoundingClientRect().width + 10 : 300;
  el.scrollBy({ left: dir * step, behavior: "smooth" });
}

async function renderHomeMajra() {
  const section = document.getElementById("home-majra");
  const el = document.getElementById("home-majra-cards");
  if (!section || !el) return;
  try {
    const t = await getJSON(`${DATA}/trends.json`, 30000);
    const stories = (ALL && ALL.length) ? ALL : await getJSON(`${DATA}/stories.json`, 30000).catch(() => []);
    const byId = new Map((stories || []).map(s => [String(s.id), s]));
    // A single story can be attached to several topic/trend slugs. On the
    // homepage that used to render the same event more than once. Keep the
    // highest-ranked topic for each lead story; topics without a resolvable
    // lead story get a stable dossier key instead.
    const seenMajra = new Set();
    const topics = [];
    for (const tp of (t.topics || []).filter(x => x && x.slug)) {
      const ids = (tp.dossier && tp.dossier.story_ids) || [];
      const story = ids.map(id => byId.get(String(id))).find(Boolean);
      const key = story ? `story:${story.id}` : `dossier:${tp.slug}`;
      if (seenMajra.has(key)) continue;
      seenMajra.add(key);
      topics.push(tp);
      if (topics.length >= 8) break;
    }
    if (!topics.length) { section.style.display = "none"; return; }
    el.innerHTML = topics.map(tp => {
      const d = tp.dossier || {};
      const story = (d.story_ids || []).map(id => byId.get(String(id))).find(Boolean);
      const image = story && story.image_url
        ? `<img loading="lazy" src="${esc(story.image_url)}" alt="" onerror="this.parentElement.classList.add('no-img');this.remove()">`
        : "";
      const dossierName = tp.name_fa || tp.slug;
      const latestHeadline = story && story.headline_fa ? story.headline_fa : "";
      const when = story && story.published_at ? relTime(story.published_at) : "";
      return `<button class="hm-strip-card ${image ? "" : "no-img"}" onclick="openTrendDossier('${esc(tp.slug)}')">
        <span class="hm-strip-media">${image}</span>
        <span class="hm-strip-copy">
          <span class="hm-dossier-name">${esc(dossierName)}</span>
          ${latestHeadline ? `<strong>${esc(latestHeadline)}</strong>` : ""}
          ${when ? `<small>${esc(when)}</small>` : ""}
        </span>
      </button>`;
    }).join("");
    if (!section.querySelector(".hm-scroll-controls")) {
      section.insertAdjacentHTML("beforeend", `<div class="hm-scroll-controls" aria-label="مرور جان ماجرا">
        <button onclick="scrollHomeMajra(1)" aria-label="قبلی">›</button>
        <button onclick="scrollHomeMajra(-1)" aria-label="بعدی">‹</button>
      </div>`);
    }
    section.style.display = "";
  } catch (e) {
    section.style.display = "";
    el.innerHTML = '<div class="state"><div class="big">جان ماجرا موقتاً در دسترس نیست</div><button class="fchip on" onclick="renderHomeMajra()">تلاش دوباره</button></div>';
  }
}

// پنداربازار — dedicated market page (full price board)
function showMarket() { show("market"); setTab("feed"); renderMarket(); setHash("#/market"); }
async function renderMarket() {
  const el = document.getElementById("market");
  try {
    const [prices, crypto] = await Promise.all([
      getJSON(`${DATA}/prices.json`).catch(() => []),
      getJSON(`${DATA}/crypto.json`).catch(() => []),
    ]);
    if ((!prices || !prices.length) && (!crypto || !crypto.length)) {
      el.innerHTML = `<div class="state"><div class="big">نرخ‌ها در دسترس نیست</div></div>`;return;
    }
    const priceRows = (prices || []).map(p => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      return `<div class="price"><div class="p-label">${esc(p.label_fa)}</div>
        <div class="p-val">${faN(grp(p.value))} <span class="p-unit">${esc(p.unit_fa)}</span></div>
        <div class="p-chg ${cls}">${arrow} ${faN(Math.abs(p.dp || 0))}٪</div></div>`;
    }).join("");
    const cryptoRows = (crypto || []).map(p => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      const value = p.value >= 1000 ? grp(Math.round(p.value)) : Number(p.value).toLocaleString("en-US", {maximumFractionDigits: p.value < 1 ? 4 : 2});
      return `<div class="price crypto-price"><div class="p-label">${esc(p.label_fa)} <span class="p-symbol">${esc(p.symbol || "")}</span></div>
        <div class="p-val">$ ${faN(value)}</div>
        <div class="p-chg ${cls}">${arrow} ${faN(Math.abs(p.dp || 0))}٪ <span class="p-unit">۲۴ساعت</span></div></div>`;
    }).join("");
    const fiatUnits = (prices || []).filter(p => ["دلار آمریکا","یورو","پوند","لیر ترکیه","درهم امارات"].includes(p.label_fa))
      .map(p => ({ id: "fiat:" + p.label_fa, label: p.label_fa, toman: Number(p.value) }));
    const usdToman = (fiatUnits.find(x => x.label === "دلار آمریکا") || {}).toman || 0;
    const cryptoUnits = (crypto || []).filter(p => Number(p.value) > 0 && usdToman > 0)
      .map(p => ({ id: "crypto:" + p.symbol, label: p.label_fa + " (" + p.symbol + ")", toman: Number(p.value) * usdToman }));
    window.JK_MARKET_UNITS = [{id:"toman",label:"تومان",toman:1}, ...fiatUnits, ...cryptoUnits];

    el.innerHTML =
      `<div class="rule"><span>تبدیل واحد مالی</span><span class="l"></span></div>
       <div class="money-converter">
         <div class="mc-field"><label>مقدار</label><input id="mc-amount" type="number" inputmode="decimal" min="0" step="any" value="1" oninput="convertMarketUnit()"></div>
         <div class="mc-field"><label>از</label><select id="mc-from" onchange="convertMarketUnit()"></select></div>
         <button class="mc-swap" onclick="swapMarketUnits()" aria-label="جابه‌جایی واحدها">⇄</button>
         <div class="mc-field"><label>به</label><select id="mc-to" onchange="convertMarketUnit()"></select></div>
         <div class="mc-result" id="mc-result">—</div>
       </div>` +
      (priceRows ? `<div class="rule"><span>ارز و طلا</span><span class="l"></span></div><div class="price-grid">${priceRows}</div>` : "") +
      (cryptoRows ? `<div class="rule" style="margin-top:26px"><span>رمزارزها</span><span class="l"></span></div><div class="price-grid crypto-grid">${cryptoRows}</div>` : "") +
      `<p class="muted" style="margin-top:14px">ارز و طلا: TGJU · رمزارزها: CoinGecko. تبدیل‌ها تقریبی و بر اساس همین آخرین نرخ‌های ذخیره‌شده‌اند.</p>`;
  setupMarketConverter();
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">پنداربازار بارگذاری نشد</div></div>`; }
}

function setupMarketConverter() {
  const units = window.JK_MARKET_UNITS || [], from = document.getElementById("mc-from"), to = document.getElementById("mc-to");
  if (!from || !to || !units.length) return;
  const opts = units.map(u => `<option value="${esc(u.id)}">${esc(u.label)}</option>`).join("");
  from.innerHTML = opts; to.innerHTML = opts;
  const usd = units.findIndex(u => u.label === "دلار آمریکا");
  from.selectedIndex = usd >= 0 ? usd : 0; to.selectedIndex = 0;
  convertMarketUnit();
}
function convertMarketUnit() {
  const units = window.JK_MARKET_UNITS || [], amount = Number(document.getElementById("mc-amount")?.value || 0);
  const from = units.find(u => u.id === document.getElementById("mc-from")?.value);
  const to = units.find(u => u.id === document.getElementById("mc-to")?.value);
  const out = document.getElementById("mc-result");
  if (!out || !from || !to || !Number.isFinite(amount) || !to.toman) return;
  const result = amount * from.toman / to.toman;
  const digits = result < 0.01 ? 8 : result < 1 ? 6 : result < 100 ? 4 : 2;
  out.innerHTML = `<b>${faN(amount.toLocaleString("en-US"))}</b> ${esc(from.label)} = <strong>${faN(result.toLocaleString("en-US",{maximumFractionDigits:digits}))}</strong> ${esc(to.label)}`;
}
function swapMarketUnits() {
  const a=document.getElementById("mc-from"), b=document.getElementById("mc-to"); if(!a||!b)return;
  const v=a.value; a.value=b.value; b.value=v; convertMarketUnit();
}

// weather + AirCheck-style air quality
function showWeather() { show("weather"); setTab("feed"); renderWeather(); setHash("#/weather"); }
const AQI_FA={good:"خوب",moderate:"قابل قبول",sensitive:"ناسالم برای گروه‌های حساس",unhealthy:"ناسالم","very-unhealthy":"بسیار ناسالم",hazardous:"خطرناک",unknown:"نامشخص"};
const POLLUTANT_FA={pm25:"PM2.5",pm10:"PM10",o3:"O₃",no2:"NO₂",so2:"SO₂",co:"CO"};
function _wxNum(v,suffix=""){return v===null||v===undefined||Number.isNaN(Number(v))?"—":faN(v)+suffix}
function _airBadge(c){
  if(c.aqi===null||c.aqi===undefined)return "";
  const est=c.air_estimated?" estimate":"";
  return `<span class="aqi-chip aqi-${esc(c.aqi_class||"unknown")}${est}"><b>AQI ${faN(c.aqi)}</b><span>${esc(c.aqi_label||AQI_FA[c.aqi_class]||"")}</span></span>`;
}
function _pollutants(c){
  const p=c.pollutants||{}, dom=new Set(c.dominant||[]);
  const rows=Object.entries(POLLUTANT_FA).map(([k,label])=>{
    const v=p[k], hit=dom.has(label);
    return `<div class="pollutant ${hit?"dominant":""}"><span>${label}</span><b>${v===null||v===undefined?"—":faN(v)}</b></div>`;
  }).join("");
  return `<div class="pollutants">${rows}</div>`;
}
function _airForecast(c){
  const rows=(c.air_forecast||[]).filter(x=>x&&x.aqi!==null&&x.aqi!==undefined);
  if(!rows.length)return "";
  return `<div class="air-forecast"><span>برآورد آینده</span>${rows.map(x=>`<em>+${faN(x.hours)}ساعت <b>AQI ${faN(x.aqi)}</b></em>`).join("")}</div>`;
}
async function renderHomeWeather() {
  const el = document.getElementById("home-weather");
  if (!el) return;
  try {
    const w = await getJSON(`${DATA}/weather.json?v=${Date.now()}`);
    if (!w || !w.length) return;
    el.innerHTML = w.slice(0, 4).map(c => `<div class="hp"><span class="hp-label">${c.icon || ""} ${esc(c.city_fa)}</span>
      <span class="hp-val">${_wxNum(c.temp,"°")}</span>
      <span class="hp-chg flat">${_wxNum(c.min,"°")} / ${_wxNum(c.max,"°")}${c.aqi!==undefined?` · AQI ${faN(c.aqi)}`:""}</span></div>`).join("")
      + `<button class="hp-more" onclick="showWeather()">هوا و آلودگی ›</button>`;
  } catch (e) {}
}
async function renderWeather() {
  const el = document.getElementById("weather");
  try {
    const w = await getJSON(`${DATA}/weather.json?v=${Date.now()}`);
    if (!w || !w.length) { el.innerHTML = `<div class="state"><div class="big">آب‌وهوا در دسترس نیست</div></div>`; return; }
    const polluted=w.filter(x=>Number.isFinite(Number(x.aqi))).sort((a,b)=>Number(b.aqi)-Number(a.aqi));
    const top=polluted.slice(0,3);
    const official=polluted.filter(x=>!x.air_estimated).length;
    const estimated=polluted.filter(x=>x.air_estimated).length;
    const overview=top.length?`<section class="air-overview">
      <div class="air-overview-head"><div><span class="press-kicker">کیفیت هوای فعلی</span><h2>آلوده‌ترین‌های این فهرست</h2></div><div class="air-source-count">${official?faN(official)+" شهر رسمی":""}${official&&estimated?" · ":""}${estimated?faN(estimated)+" شهر برآوردی":""}</div></div>
      <div class="air-rank">${top.map((c,i)=>`<div class="air-rank-row"><span class="air-rank-no">${faN(i+1)}</span><strong>${esc(c.city_fa)}</strong>${_airBadge(c)}</div>`).join("")}</div>
      <div class="aqi-legend"><span class="aqi-good">۰–۵۰ خوب</span><span class="aqi-moderate">۵۱–۱۰۰ قابل قبول</span><span class="aqi-sensitive">۱۰۱–۱۵۰ حساس</span><span class="aqi-unhealthy">۱۵۱–۲۰۰ ناسالم</span><span class="aqi-very-unhealthy">۲۰۱–۳۰۰ بسیار ناسالم</span><span class="aqi-hazardous">+۳۰۰ خطرناک</span></div>
    </section>`:"";
    const cards=w.map(c=>`<article class="wx wx-rich">
      <div class="wx-weather-row"><div class="wx-ic">${c.icon || "🌡️"}</div><div class="wx-weather-copy"><div class="wx-city">${esc(c.city_fa)}</div><div class="wx-cond">${esc(c.cond_fa || "")}</div></div><div class="wx-temp">${_wxNum(c.temp,"°")}</div></div>
      <div class="wx-mm"><span class="wx-min">کمینه ${_wxNum(c.min,"°")}</span><span class="wx-max">بیشینه ${_wxNum(c.max,"°")}</span></div>
      ${c.aqi!==undefined&&c.aqi!==null?`<div class="air-card-head">${_airBadge(c)}<span class="air-source ${c.air_estimated?"estimate":"official"}">${c.air_estimated?"برآورد مدل":"دادهٔ رسمی"}</span></div>
        ${(c.dominant||[]).length?`<div class="dominant-copy">آلایندهٔ غالب: <b>${esc((c.dominant||[]).join("، "))}</b></div>`:""}
        ${_pollutants(c)}
        ${_airForecast(c)}
        <div class="air-source-line">${esc(c.air_source_fa||"")}</div>`:`<div class="air-no-data">دادهٔ آلودگی در دسترس نیست</div>`}
    </article>`).join("");
    el.innerHTML = overview+`<div class="wx-grid wx-air-grid">${cards}</div>
      <aside class="weather-expert"><div><span class="weather-expert-kicker">کارشناس مرتبط</span><strong>محمد اصغری</strong><p>پیش‌بینی، تحلیل سامانه‌های بارشی، هشدارهای جوی و هواشناسی کشاورزی</p></div><button onclick="openFigure('asghari_weatherman')">صفحهٔ محمد اصغری ←</button></aside>
      <div class="weather-sources"><p><b>دما و شرایط جوی:</b> Open-Meteo.</p><p><b>آلودگی هوا:</b> ابتدا شبکهٔ ملی پایش کیفیت هوای سازمان حفاظت محیط‌زیست با همان endpointها و منطق منبعی که پروژهٔ متن‌باز AirCheck استفاده می‌کند. اگر دسترسی رسمی از سرور GitHub ممکن نباشد، Open-Meteo / Copernicus CAMS با برچسب «برآورد مدل» جایگزین می‌شود.</p><a href="https://github.com/ZethRise/AirCheck" target="_blank" rel="noopener">AirCheck روی GitHub ↗</a></div>`;
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">آب‌وهوا بارگذاری نشد</div></div>`; }
}

/* ============================================================
   Charts (dependency-free inline SVG), follow store, and stats
   ============================================================ */

function _pts(vals, w, h, pad) {
  pad = pad == null ? 2 : pad;
  const n = vals.length; if (!n) return [];
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0), rng = (mx - mn) || 1;
  return vals.map((v, i) => {
    const x = n === 1 ? w / 2 : pad + i * (w - 2 * pad) / (n - 1);
    const y = h - pad - ((v - mn) / rng) * (h - 2 * pad);
    return [x, y];
  });
}
// sparkline (area + line), scales to container width
function svgSpark(vals, o) {
  o = o || {}; const w = o.w || 120, h = o.h || 30;
  const p = _pts(vals, w, h, 2); if (!p.length) return "";
  const line = p.map(a => a[0].toFixed(1) + "," + a[1].toFixed(1)).join(" ");
  const area = p[0][0].toFixed(1) + "," + (h - 2) + " " + line + " " + p[p.length - 1][0].toFixed(1) + "," + (h - 2);
  const cls = o.cls || "a";
  return `<svg class="spark s-${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon class="sp-area" points="${area}"/><polyline class="sp-line" points="${line}"/></svg>`;
}
// vertical bars (activity)
function svgBars(vals, o) {
  o = o || {}; const w = o.w || 300, h = o.h || 64, n = vals.length, gap = o.gap || 2;
  const mx = Math.max(...vals, 1), bw = (w - gap * (n - 1)) / n;
  let r = "";
  for (let i = 0; i < n; i++) {
    const bh = Math.max(1.5, (vals[i] / mx) * (h - 2)), x = i * (bw + gap), y = h - bh;
    const lbl = (o.labels && o.labels[i]) ? esc(o.labels[i]) + " — " : "";
    // optional per-bar click handler + slight cursor hint via class="bar-click"
    const click = (o.onclick && o.onclick[i]) ? ` class="bar bar-click" onclick="${o.onclick[i]}"` : ' class="bar"';
    r += `<rect${click} x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5"><title>${lbl}${faN(vals[i])} خبر</title></rect>`;
  }
  return `<svg class="bars-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${r}</svg>`;
}
// two-series comparison, each normalized to its own max (shape compare, one axis)
function svgCompare(a, b, o) {
  o = o || {}; const w = o.w || 260, h = o.h || 64;
  const norm = v => { const m = Math.max(...v, 1); return v.map(x => x / m * 100); };
  const mk = (vals, cls) => {
    const p = _pts(norm(vals), w, h, 3); if (!p.length) return "";
    return `<polyline class="cmp-line c-${cls}" points="${p.map(a => a[0].toFixed(1) + "," + a[1].toFixed(1)).join(" ")}"/>` +
      `<circle class="cmp-dot c-${cls}" cx="${p[p.length - 1][0].toFixed(1)}" cy="${p[p.length - 1][1].toFixed(1)}" r="2.6"/>`;
  };
  return `<svg class="cmp-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${mk(a, "a")}${b && b.length ? mk(b, "b") : ""}</svg>`;
}
function growthTag(g) {
  if (g == null) return "";
  if (g > 0) return `<span class="gtag up">▲ ${faN(g)}٪</span>`;
  if (g < 0) return `<span class="gtag down">▼ ${faN(Math.abs(g))}٪</span>`;
  return `<span class="gtag flat">—</span>`;
}
function trendBadge(t) {
  if (!t) return "";
  if (t.hot) return `<span class="tbadge hot">🔥 داغ</span>`;
  if (t.rising) return `<span class="tbadge rise">در حال رشد</span>`;
  return "";
}

/* ----- follow / saved store (per-device, localStorage) ----- */
const FKEY = "jk_follow_v1";
function loadF() { try { return JSON.parse(localStorage.getItem(FKEY)) || {}; } catch (e) { return {}; } }
function saveF() { try { localStorage.setItem(FKEY, JSON.stringify(FOLLOW)); } catch (e) {} }
let FOLLOW = Object.assign({ topics: [], provinces: [], sources: [], entities: [], saved: [] }, loadF());
function isF(kind, id) { return (FOLLOW[kind] || []).includes(id); }
function toggleF(kind, id) {
  const a = FOLLOW[kind] || (FOLLOW[kind] = []);
  const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id);
  saveF();
}
function followCount() {
  return (FOLLOW.topics.length + FOLLOW.provinces.length + FOLLOW.sources.length
    + (FOLLOW.entities ? FOLLOW.entities.length : 0));
}
// a reusable follow/save button
function followBtn(kind, id, labelOn, labelOff) {
  const on = isF(kind, id);
  return `<button class="follow-btn ${on ? "on" : ""}" onclick="event.stopPropagation();hitFollow('${kind}','${String(id).replace(/'/g, "\\'")}',this)">
    <svg viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z" stroke-linejoin="round"/></svg>
    <span class="fb-t">${on ? (labelOn || "دنبال می‌کنی") : (labelOff || "دنبال کن")}</span></button>`;
}
function hitFollow(kind, id, btn) {
  toggleF(kind, id);
  const on = isF(kind, id);
  btn.classList.toggle("on", on);
  const t = btn.querySelector(".fb-t"); if (t) t.textContent = on ? "دنبال می‌کنی" : "دنبال کن";
  const svg = btn.querySelector("svg"); if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
  updateMineBadge();
}
function saveBtn(id) {
  const on = isF("saved", id);
  return `<button class="save-btn ${on ? "on" : ""}" title="ذخیره" aria-label="ذخیره" onclick="event.stopPropagation();hitSave('${id}',this)">
    <svg viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" stroke-linejoin="round"/></svg></button>`;
}
function hitSave(id, btn) {
  toggleF("saved", id);
  const on = isF("saved", id);
  btn.classList.toggle("on", on);
  const svg = btn.querySelector("svg"); if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
  updateMineBadge();
}
function updateMineBadge() {
  const b = document.getElementById("mine-badge");
  if (!b) return;
  const n = followCount() + (FOLLOW.saved ? FOLLOW.saved.length : 0);
  b.textContent = n ? faN(n) : "";
  b.style.display = n ? "inline-flex" : "none";
}

/* ----- personalized feed ("سرخط من") ----- */
function mineFeed() {
  return ALL.filter(s =>
    (s.topics || []).some(t => isF("topics", t.slug)) ||
    (s.geo && (s.geo.provinces || []).some(p => isF("provinces", p.slug))) ||
    (s.source_names || []).some(n => isF("sources", n)) ||
    (s.entities || []).some(e => isF("entities", e.slug)) ||
    isF("saved", s.id));
}

/* ----- home stats strip ("نبض خبری") ----- */
async function renderHomeStats() {
  const el = document.getElementById("home-stats");
  if (!el) return;
  try {
    const [st, figs] = await Promise.all([
      getJSON(`${DATA}/stats.json`),
      getJSON(`${DATA}/figures.json`).catch(() => ({ figures: [] }))
    ]);
    STATS = st;
    const roll = liveRolling(st);
    const people = (figs.figures || []);
    const allPosts = people.flatMap(f => (f.posts || []).map(p => ({...p, _person:f})));
    const now = Date.now(), countPosts = h => allPosts.filter(p => p.published_at && new Date(p.published_at).getTime() >= now-h*3600e3).length;
    const activePeople = h => new Set(allPosts.filter(p => p.published_at && new Date(p.published_at).getTime() >= now-h*3600e3).map(p => p._person.handle || p._person.name_fa)).size;
    const opinionCount = allPosts.length;
    const daily = (st.activity_daily || []).map(x => x.n);
    const figDaily = Array.from({length:7},(_,i)=>{
      const a=now-(6-i)*86400e3, b=a+86400e3;
      return allPosts.filter(p=>{const t=p.published_at?new Date(p.published_at).getTime():0;return t>=a&&t<b}).length;
    });
    const today = utcDayISO(0), yday = utcDayISO(-1);
    el.innerHTML = `<div class="statbar statbar-rich">
      <div class="sb-metrics">
        <span class="sb-item sb-click" onclick="showTrends()"><b>${faN(st.total || 0)}</b><span>کل خبرها</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click" onclick="showFigures()"><b>${faN(people.length)}</b><span>چهره‌ها</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click sb-opinions" onclick="showFigures()"><b>${faN(opinionCount)}</b><span>کل اظهارنظرها</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click" onclick="showFigures()"><b>${faN(countPosts(24))}</b><span>نظر · ۲۴ساعت</span></span>
        <span class="sb-item sb-click" onclick="showFigures()"><b>${faN(activePeople(24))}</b><span>چهرهٔ فعال · ۲۴ساعت</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click" onclick="openDay('${today}')"><b>${faN(st.calendar ? st.calendar.today : 0)}</b><span>خبر امروز ›</span></span>
        <span class="sb-item sb-click" onclick="showTrends()"><b>${faN(roll.h24)}</b><span>خبر · ۲۴ساعت</span></span>
      </div>
      <div class="sb-charts">
        <div class="sb-mini sb-click" onclick="showTrends()"><span>خبر · ۱۴ روز</span>${svgSpark(daily, { w: 150, h: 34 })}</div>
        <div class="sb-mini sb-click" onclick="showFigures()"><span>اظهارنظر · ۷ روز</span>${svgSpark(figDaily, { w: 120, h: 34, cls:"b" })}</div>
      </div>
    </div>`;
  } catch (e) {}
}
let STATS = null;
// recompute rolling windows live from the timeline so 4h/8h/12h stay fresh
function liveRolling(st) {
  const tl = (st && st.timeline) || [];
  const now = Date.now();
  const c = h => tl.filter(ms => ms >= now - h * 3600e3).length;
  return { h4: c(4), h8: c(8), h12: c(12), h24: c(24) };
}
function statsBlock(st) {
  const roll = liveRolling(st), cal = st.calendar || {};
  const daily = (st.activity_daily || []);
  const today = utcDayISO(0), yday = utcDayISO(-1);
  // rolling windows (not tied to a single day) are non-clickable; day tiles link.
  const tiles = [
    ["۴ ساعت", roll.h4, null], ["۸ ساعت", roll.h8, null],
    ["۱۲ ساعت", roll.h12, null], ["۲۴ ساعت", roll.h24, null],
    ["امروز ›", cal.today || 0, today], ["دیروز ›", cal.yesterday || 0, yday],
    ["این هفته", cal.this_week || 0, null], ["هفتهٔ پیش", cal.last_week || 0, null],
  ];
  const labels = daily.map(d => d.d.slice(5));
  // bars: each day-bar becomes a button that jumps to that day's archive
  const barsSvg = svgBars(daily.map(d => d.n), {
    labels, w: 320, h: 70,
    onclick: daily.map(d => `openDay('${d.d}')`),
  });
  return `
    <div class="stat-hero"><span class="val">${faN(st.total || 0)}</span><span class="lbl">کل خبرهای سیستم</span></div>
    <div class="stat-tiles">${tiles.map(t => {
      const cls = t[2] ? "stile stile-click" : "stile";
      const onc = t[2] ? ` onclick="openDay('${t[2]}')"` : "";
      return `<div class="${cls}"${onc}><b>${faN(t[1])}</b><span>${t[0]}</span></div>`;
    }).join("")}</div>
    <div class="rule"><span>فعالیتِ ۱۴ روزِ گذشته <span class="n">— روی هر روز بزن</span></span><span class="l"></span></div>
    <div class="chart-wrap">${barsSvg}</div>
    <p class="muted" style="margin:6px 0 4px">شمارِ خبرهای تازه در هر روز. روی «امروز/دیروز» یا هر میله بزن تا خبرهای همان روز را با تفکیک دسته ببینی.</p>`;
}

const _initialRoute = (location.hash || "").replace(/^#\/?/, "");
const _isDeepLink = Boolean(_initialRoute);
if (_isDeepLink) {
  const feedView = document.getElementById("feed-view");
  if (feedView) feedView.style.display = "none";
  setTab("");
}

function _bootReveal(){
  if (window.__routeBootTimer) clearTimeout(window.__routeBootTimer);
  document.documentElement.classList.remove("route-boot");
}

if (_isDeepLink) {
  // Route the requested destination immediately. Most deep-link views
  // (figures, videos, books, press, knowledge, etc.) do not need stories.json.
  // Load the news feed independently so a slow feed can never block navigation.
  Promise.resolve(route()).finally(_bootReveal);
  loadFeed(false).catch(()=>{});
} else {
  loadFeed(true).finally(_bootReveal);
  renderHomeStats();
  renderHomeGlance();
  renderHomePrices();
  renderHomeWeather();
  renderHomePeople();
}
updateMineBadge();


/* ---- جان کلام — commentators' views, kept apart from the facts ----
   Data: story.figures (matched per story) + data/figures.json (all figures).
   A view is always attributed to its author and linked to the original post. */
const KIND_NOTE = { party_claim: "ادعای یکی از طرفین" };
const SOCIAL_ICON = {
  telegram: '<path d="M21.5 4.5 2.5 11.8l5 1.6 1.9 5.6 2.7-3 4.5 3.3z" stroke-linejoin="round"/>',
  bale: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8 8h5a3 3 0 0 1 0 6H8zm0 6h6a3 3 0 0 1 0 6" stroke-linejoin="round"/>',
  x: '<path d="M4 4l16 16M20 4L4 20" stroke-linecap="round"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
  diner: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
  github: '<path d="M9 19c-4 1.2-4-2-5-2m10 4v-3.5c0-1 .1-1.7-.5-2.3 2.8-.3 5.7-1.4 5.7-6.2 0-1.4-.5-2.5-1.3-3.4.1-.3.6-1.6-.1-3.3 0 0-1.1-.3-3.6 1.3a12.3 12.3 0 0 0-6.4 0C5.3 2 4.2 2.3 4.2 2.3c-.7 1.7-.2 3-.1 3.3A4.8 4.8 0 0 0 2.8 9c0 4.8 2.9 5.9 5.7 6.2-.4.4-.6 1-.6 2V21"/>',
  youtube: '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M11 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M14 8h2V5h-2a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h2.2l.4-3H14V8.5a.5.5 0 0 1 .5-.5z" stroke-linejoin="round"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9S14.5 18.5 12 21c-2.5-2.5-3.5-6-3.5-9S9.5 5.5 12 3z"/>',
  truthsocial: '<path d="M6 5h12M12 5v14M7.5 10.5h9" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/>',
};
function avatar(p, cls) {
  if (p.avatar) return `<img class="fig-avatar ${cls || ""}" src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.classList.add('broken')">`;
  const ini = (p.name_fa || "?").trim().charAt(0);
  return `<span class="fig-avatar ${cls || ""} ini">${esc(ini)}</span>`;
}
function socialLinks(links) {
  if (!links || !links.length) return "";
  return `<div class="fig-social">${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.label)}" aria-label="${esc(l.label)}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${SOCIAL_ICON[l.kind] || SOCIAL_ICON.website}</svg><span>${esc(l.label)}</span></a>`).join("")}</div>`;
}
(function () {
  const st = document.createElement("style");
  st.textContent = `.figure-timeline{display:flex;flex-direction:column;gap:12px;margin:8px 0 24px}
.home-fig-card{padding:16px 18px;border:1px solid rgba(143,168,155,.22);border-radius:14px;background:rgba(26,157,126,.035)}
.home-fig-card:hover{border-color:rgba(26,157,126,.5)}
.home-fig-topic{font-size:17px;line-height:1.6;margin:10px 0 3px}
.home-fig-card .kalam{margin:0 0 10px;line-height:1.9}
.home-fig-card .fig-foot{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.fig-profile-link{border:0;background:none;padding:0;color:#1a9d7e;font:inherit;cursor:pointer}
.fig-profile-link:hover{text-decoration:underline}
.fig-tl-controls{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 12px}
.fig-tl-controls .imp-filter{margin:0}
.fig-field-select{font:inherit;color:inherit;background:transparent;border:1px solid rgba(143,168,155,.35);border-radius:999px;padding:6px 12px}
.fig-follow{font:inherit;font-size:12px;border:1px solid rgba(143,168,155,.35);border-radius:999px;background:transparent;color:#8fa89b;padding:4px 9px;cursor:pointer;white-space:nowrap}
.fig-follow.on{color:#e0b341;border-color:rgba(224,179,65,.5);background:rgba(224,179,65,.08)}
.fig-follow.compact{font-size:11px;padding:3px 7px}
.news-statement-tag{display:inline-block;margin:9px 0 0;font-size:12px;color:#8fa89b;background:rgba(143,168,155,.10);border-radius:999px;padding:3px 9px}
.fig-source-stats{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:7px 0 10px;font-size:13px;color:#8fa89b}
.fig-source-stats b{color:var(--text)}
.fig-profile-filters{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 16px}
.identity-verified,.profile-verified{display:inline-flex;align-items:center;justify-content:center;margin-inline-start:7px;color:#1677ff;font-size:.78em;font-weight:800;vertical-align:middle}
.identity-claimed,.profile-claimed{display:inline-block;margin-inline-start:8px;color:#6f7c75;font-size:12px;font-weight:500}
.profile-claimed{display:block;margin:4px 0 7px;color:#6f7c75}
.canonical-head b{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.figure-profile-search{position:relative;padding:12px 16px 4px;border-bottom:1px solid rgba(143,168,155,.16)}
.figure-profile-search-box{display:flex;align-items:center;gap:8px;border:1px solid rgba(143,168,155,.28);border-radius:999px;padding:8px 12px;background:rgba(143,168,155,.04)}
.figure-profile-search-box input{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit}
.figure-profile-search-box input::placeholder{color:#8fa89b}
.figure-profile-search-results{display:none;position:absolute;z-index:30;top:58px;right:16px;left:16px;background:var(--card,#fff);border:1px solid rgba(143,168,155,.24);border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.12);overflow:hidden;max-height:390px;overflow-y:auto}
.figure-search-hit{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;border-bottom:1px solid rgba(143,168,155,.12);background:transparent;color:inherit;text-align:right;cursor:pointer}
.figure-search-hit:hover{background:rgba(26,157,126,.06)}
.figure-search-hit span{display:flex;flex-direction:column;min-width:0}
.figure-search-hit b{display:flex;align-items:center;gap:4px}
.figure-search-hit small{color:#8fa89b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.figure-search-empty{padding:14px;color:#8fa89b;text-align:center}
.figure-youtube{padding:16px}.figure-youtube-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.figure-youtube-card{display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(143,168,155,.18);border-radius:14px;background:rgba(143,168,155,.035);color:inherit;text-decoration:none}.figure-youtube-thumb{position:relative;display:block;aspect-ratio:16/9;background:#111;overflow:hidden}.figure-youtube-thumb img{width:100%;height:100%;object-fit:cover;display:block}.figure-youtube-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:44px;height:32px;border-radius:9px;background:#ff0033;color:#fff;font-size:16px}.figure-youtube-body{display:flex;flex-direction:column;gap:5px;padding:10px 12px}.figure-youtube-body b{font-size:14px;line-height:1.55}.figure-youtube-body small{font-size:11.5px;color:#8fa89b}.latest-videos-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin:8px 0 22px}.latest-videos-head h1{margin:4px 0 6px}.latest-videos-head p{margin:0;max-width:720px;color:#8fa89b;line-height:1.8}.latest-videos-stats{display:flex;gap:8px;flex-wrap:wrap}.latest-videos-stats span,.latest-videos-stats button{border:1px solid rgba(143,168,155,.22);border-radius:999px;padding:7px 11px;font:inherit;font-size:12px;background:transparent;color:inherit}.latest-videos-stats button{cursor:pointer}.latest-videos-stats button.on{border-color:rgba(26,157,126,.48);background:rgba(26,157,126,.10);color:#1a9d7e}.latest-videos-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.latest-video-card{overflow:hidden;border:1px solid rgba(143,168,155,.18);border-radius:14px;background:rgba(143,168,155,.035)}.latest-video-main{display:block;color:inherit;text-decoration:none}.latest-video-copy{display:flex;flex-direction:column;gap:5px;padding:10px 12px}.latest-video-copy b{font-size:14px;line-height:1.6}.latest-video-copy small{font-size:11.5px;color:#8fa89b}.latest-video-people{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 11px}.latest-video-people button{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(143,168,155,.2);border-radius:999px;background:transparent;color:inherit;padding:4px 8px;font:inherit;font-size:11.5px;cursor:pointer}.latest-video-people img{width:20px;height:20px;border-radius:50%;object-fit:cover}.latest-video-actions{padding:0 10px 12px}.latest-video-actions button,.video-recap-btn{width:100%;border:1px solid rgba(26,157,126,.35);background:rgba(26,157,126,.08);color:#1a9d7e;border-radius:10px;padding:8px 10px;font:inherit;cursor:pointer}.figure-youtube-card>a{color:inherit;text-decoration:none}.video-recap-btn{margin:0 10px 10px;width:calc(100% - 20px)}.youtube-recap-embed{position:relative;width:100%;aspect-ratio:16/9;margin:18px 0 22px;border-radius:16px;overflow:hidden;background:#090b0a;border:1px solid rgba(143,168,155,.16)}.youtube-recap-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.video-statement-recap{font-size:17px;line-height:2.05;margin-top:18px}.video-statement-recap p{margin:0 0 1.2em}.video-statement-points{margin:18px 0;padding:16px 18px;border:1px solid rgba(143,168,155,.18);border-radius:14px;background:rgba(143,168,155,.035)}.video-statement-points h3{margin:0 0 10px}.video-statement-points li{line-height:1.85;margin:6px 0}.studio-recap-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0}.studio-recap-card{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid rgba(143,168,155,.18);border-radius:16px;background:rgba(143,168,155,.035)}.studio-recap-card h2{font-size:17px;line-height:1.65;margin:0}.studio-recap-card p{margin:0;color:#8fa89b;line-height:1.75}.studio-recap-card-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#8fa89b}.studio-recap-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}.studio-recap-card-actions button,.studio-recap-card-actions a,.studio-recap-toolbar button,.studio-recap-toolbar a{border:1px solid rgba(143,168,155,.22);border-radius:10px;background:transparent;color:inherit;padding:8px 11px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none}.studio-recap-card-actions .primary,.studio-recap-toolbar .primary{border-color:rgba(26,157,126,.4);background:rgba(26,157,126,.09);color:#1a9d7e}.studio-recap-article{max-width:860px;margin:0 auto;padding:6px 0 36px}.studio-recap-article h1{line-height:1.45;margin:12px 0 8px}.studio-recap-byline{color:#8fa89b;line-height:1.8}.studio-recap-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 24px}.studio-recap-body{font-size:18px;line-height:2.08}.studio-recap-body p{margin:0 0 1.35em}.studio-recap-body h2{margin:2.1em 0 .7em;font-size:22px}.studio-recap-notice{padding:11px 13px;border:1px solid rgba(143,168,155,.16);border-radius:12px;color:#8fa89b;font-size:12px;line-height:1.8}.studio-queue-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:16px 0}.studio-queue-filters{display:flex;gap:7px;flex-wrap:wrap}.studio-queue-filters button{border:1px solid rgba(143,168,155,.22);border-radius:999px;background:transparent;color:inherit;padding:7px 11px;font:inherit;font-size:12px;cursor:pointer}.studio-queue-filters button.on{border-color:rgba(26,157,126,.42);background:rgba(26,157,126,.09);color:#1a9d7e}.studio-recap-card.done{opacity:.62}.studio-recorded{display:inline-flex;align-items:center;gap:5px;color:#1a9d7e}.studio-reader-nav{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin:24px 0}.studio-reader-nav button{border:1px solid rgba(143,168,155,.22);border-radius:10px;background:transparent;color:inherit;padding:9px 12px;font:inherit;cursor:pointer}.studio-font-tools{display:flex;gap:6px;align-items:center}.studio-font-tools button{min-width:38px}.studio-recap-article.recorded .press-kicker:after{content:" · ضبط شد ✓";color:#1a9d7e}.studio-recap-body{font-size:var(--studio-font-size,18px)}.latest-video-actions .studio-mark{min-width:38px;padding-inline:10px;font-size:18px;font-weight:700}.latest-video-actions .studio-mark.ready{font-size:19px}.latest-video-actions .studio-mark.request{opacity:.82}.finance-wrap{max-width:1100px;margin:0 auto;padding-bottom:40px}.finance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.finance-metric{padding:15px;border:1px solid rgba(143,168,155,.18);border-radius:15px;background:rgba(143,168,155,.035)}.finance-metric span{display:block;color:#8fa89b;font-size:12px}.finance-metric b{display:block;font-size:24px;margin-top:5px}.finance-metric small{display:block;color:#8fa89b;margin-top:4px;line-height:1.6}.finance-note{padding:13px 15px;border:1px solid rgba(143,168,155,.18);border-radius:14px;line-height:1.9;color:#8fa89b;margin:14px 0}.finance-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}.finance-table th,.finance-table td{padding:10px 8px;border-bottom:1px solid rgba(143,168,155,.14);text-align:right;vertical-align:top}.finance-table th{color:#8fa89b;font-weight:500}.finance-video-title{display:block;max-width:430px}.finance-video-title b{display:block;color:inherit}.finance-video-title small{color:#8fa89b}.finance-money{direction:ltr;display:inline-block}.finance-empty{padding:28px;text-align:center;color:#8fa89b;border:1px dashed rgba(143,168,155,.18);border-radius:14px}@media(max-width:900px){.finance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.finance-grid{grid-template-columns:1fr}.finance-table{display:block;overflow-x:auto;white-space:nowrap}}
@media(max-width:900px){.latest-videos-grid,.studio-recap-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.figure-youtube{padding:12px}.figure-youtube-grid,.latest-videos-grid,.studio-recap-list{grid-template-columns:1fr}.home-fig-card{padding:14px}.home-fig-card .v-h{align-items:flex-start}.home-fig-card .muted{font-size:11px}}`;
  document.head.appendChild(st);
})();

function statementKey(p) { return encodeURIComponent(String(p.id || "")); }
function figureCard(p, withName) {
  const party = p.kind === "party_claim"
    ? `<span class="cstatus st-warn" title="این شخص خودش طرفِ این ماجراست">${KIND_NOTE.party_claim}</span>` : "";
  const head = withName
    ? `<div class="v-h">${avatar(p, "sm")}<div class="fig-id"><a class="v-name" href="#/figure/${esc(p.handle)}" onclick="event.preventDefault();${p._newsPerson ? "openNewsPerson" : "openFigure"}('${esc(p.handle)}')">${esc(p.name_fa)}</a><span class="fig-role">${esc(p.role_fa)}</span></div><span class="spacer" style="flex:1"></span>${party}</div>`
    : `<div class="v-h"><span class="fig-topic">${esc(p.topic_fa || "")}</span><span class="spacer" style="flex:1"></span>${party}</div>`;
  return `<div class="view fig-view">${head}
    <p>${esc(p.summary_fa || "")}</p>
    <div class="fig-foot"><button class="fig-profile-link" onclick="openStatement(\'${statementKey(p)}\')">صفحهٔ این گفته</button><span class="muted">${relTime(p.published_at)}${p.source_language && p.source_language !== "fa" ? " · " + esc(p.translation_label_fa || ("ترجمه از " + p.source_language)) : ""}</span>
      <a href="${esc(p.url)}" target="_blank" rel="noopener">${p.kind === "news_statement" ? "منبع این گفته" : p.platform === "truthsocial" ? "پست اصلی در تروث سوشیال" : p.platform === "youtube" ? "ویدئو در یوتیوب" : "متن کامل در " + (String(p.url || "").includes("ble.ir/") ? "بله" : "تلگرام")} ↗</a></div></div>`;
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
  renderFigureTimeline();
  if (document.getElementById("figures-view").style.display === "block" && location.hash.startsWith("#/figure/")) openFigure(handle);
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
  }))).sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
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
    }))).sort((a,b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
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
  el.innerHTML = controls + `<div class="x-figure-stream">` + posts.slice(0, 40).map(p => `<article class="x-figure-post">
    <div class="x-figure-avatar">${avatar(p, "sm")}</div>
    <div class="x-figure-content">
      <div class="x-figure-head">
        <div class="x-figure-identity"><a class="x-figure-name" href="#/figure/${esc(p.handle)}" onclick="event.preventDefault();${p._newsPerson ? "openNewsPerson" : "openFigure"}('${esc(p.handle)}')">${esc(p.name_fa)}</a><span class="x-figure-role">${esc(p.role_fa || p.field_fa || "")}</span><span class="x-figure-dot">·</span><time>${relTime(p.published_at)}</time></div>
        ${figureFollowBtn(p.handle,true)}
      </div>
      ${p.kind === "news_statement" ? `<div class="x-figure-context">گفته در خبر · ${esc(p.source_name || "منبع خبری")}</div>` : ""}
      ${p.topic_fa ? `<h2 class="x-figure-topic">${esc(p.topic_fa)}</h2>` : ""}
      <p class="x-figure-text">${esc(p.summary_fa || "")}</p>
      ${telegramEmbed(p)}
      <div class="x-figure-actions">
        <button onclick="${p._newsPerson ? "openNewsPerson" : "openFigure"}('${esc(p.handle)}')">◯ <span>پروفایل</span></button>
        <button onclick="openStatement('${statementKey(p)}')">▢ <span>صفحهٔ گفته</span></button>
        <a href="${esc(p.url)}" target="_blank" rel="noopener">↗ <span>متن اصلی</span></a>
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
let _figDirectoryMode = "direct";
async function loadCuratedPoems(){ if(_CURATED_POEMS) return _CURATED_POEMS; try{_CURATED_POEMS=await getJSON(`${DATA}/curated-figure-poems.json`);}catch(_){_CURATED_POEMS={};} return _CURATED_POEMS||{}; }
const _LOCAL_FIGURE_FALLBACKS = [
  {
    handle: "nima-afshar-naderi",
    name_fa: "نیما افشارنادری",
    role_fa: "تولیدکننده محتوا و میزبان «جان کلام»",
    field: "media",
    field_fa: "رسانه و تحلیل",
    gender: "m",
    external: true,
    verified: true,
    claimed: true,
    avatar: "https://pbs.twimg.com/profile_images/2094137144591933440/SIBK8HjF_400x400.jpg",
    channel_url: "",
    count: 0,
    posts: [],
    social: [
      {kind:"x", label:"ایکس", url:"https://x.com/nimania"},
      {kind:"instagram", label:"اینستاگرام", url:"https://www.instagram.com/nima.afsharnaderi/"},
      {kind:"youtube", label:"یوتیوب", url:"https://www.youtube.com/channel/UCYDOVO7EpX3QNEf9Ddk1-AQ"},
      {kind:"telegram", label:"تلگرام", url:"https://t.me/nimaafsharnaderi"},
      {kind:"website", label:"گروکی‌پدیا", url:"https://grokipedia.com/page/nima-afshar-naderi"}
    ]
  }
];
async function loadFigures() {
  if (_FIG) return _FIG;
  try { _FIG = await getJSON(`${DATA}/figures.json`); } catch (e) { _FIG = { figures: [], fields: {} }; }
  _FIG.figures = Array.isArray(_FIG.figures) ? _FIG.figures : [];
  for (const fallback of _LOCAL_FIGURE_FALLBACKS) {
    if (!_FIG.figures.some(f => String(f.handle||"").toLowerCase() === fallback.handle)) {
      _FIG.figures.push(fallback);
    }
  }
  return _FIG;
}
async function loadStudioRecaps() {
  if (_STUDIO_RECAPS) return _STUDIO_RECAPS;
  try {
    const rows = await getJSON(`${DATA}/studio-recaps.json`);
    _STUDIO_RECAPS = Array.isArray(rows) ? rows : [];
  } catch (_) {
    _STUDIO_RECAPS = [];
  }
  return _STUDIO_RECAPS;
}

async function loadProjectFinance() {
  try {
    _PROJECT_FINANCE = await getJSON(`${DATA}/project-finance.json?v=${Date.now()}`);
    return (_PROJECT_FINANCE && typeof _PROJECT_FINANCE === "object") ? _PROJECT_FINANCE : {};
  } catch (_) {
    return {};
  }
}

async function loadNewsPeople() {
  if (_NEWS_PEOPLE) return _NEWS_PEOPLE;
  try { _NEWS_PEOPLE = await getJSON(`${DATA}/news-people.json`); } catch (e) { _NEWS_PEOPLE = { figures: [], fields: {} }; }
  return _NEWS_PEOPLE;
}
function setFigureDirectoryMode(mode) {
  _figDirectoryMode = mode;
  renderFigures();
}

function _sysNum(v) {
  return Number.isFinite(Number(v)) ? faN(Number(v).toLocaleString("en-US")) : "—";
}
function _sysTime(iso) {
  if (!iso) return "نامشخص";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "نامشخص";
    return d.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
  } catch (_) { return "نامشخص"; }
}
function _sysState(state) {
  const s = String(state || "").toLowerCase();
  if (["active","ok","success","healthy"].includes(s)) return ["سالم","ok"];
  if (["error","failed","failure"].includes(s)) return ["خطا","bad"];
  if (["empty","warning","warn"].includes(s)) return ["هشدار","warn"];
  if (["pending","unknown"].includes(s)) return ["در انتظار","muted"];
  return [state || "نامشخص","muted"];
}
function _sysMetric(label, value, sub, cls) {
  return '<article class="sys-metric '+(cls||'')+'"><span>'+esc(label)+'</span><b>'+_sysNum(value)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</article>';
}

const ENTITY_QA_DRAFT_KEY="pendar_entity_override_draft_v1";
let _ENTITY_QA=null;
async function loadEntityQA(){
  if(_ENTITY_QA)return _ENTITY_QA;
  try{_ENTITY_QA=await getJSON(DATA+"/entity-qa.json?v="+Date.now(),12000)}
  catch(_){_ENTITY_QA=null}
  return _ENTITY_QA;
}
function _qaEmptyDraft(){return {version:1,merges:[],keep_separate:[],aliases:[],canonical_names:[]}}
function _qaDraft(){
  try{
    const x=JSON.parse(localStorage.getItem(ENTITY_QA_DRAFT_KEY)||"null");
    return x&&x.version===1?{..._qaEmptyDraft(),...x}:_qaEmptyDraft();
  }catch(_){return _qaEmptyDraft()}
}
function _qaSave(x){localStorage.setItem(ENTITY_QA_DRAFT_KEY,JSON.stringify(x));renderEntityQA()}
function _qaPair(a,b){return [String(a),String(b)].sort()}
function qaMerge(from,into){
  const d=_qaDraft();
  d.merges=d.merges.filter(x=>x.from!==from);
  d.merges.push({from:from,into:into});
  const pk=_qaPair(from,into).join("|");
  d.keep_separate=d.keep_separate.filter(x=>_qaPair(x[0],x[1]).join("|")!==pk);
  _qaSave(d);
}
function qaKeepSeparate(a,b){
  const d=_qaDraft(),p=_qaPair(a,b),pk=p.join("|");
  d.merges=d.merges.filter(x=>_qaPair(x.from,x.into).join("|")!==pk);
  if(!d.keep_separate.some(x=>_qaPair(x[0],x[1]).join("|")===pk))d.keep_separate.push(p);
  _qaSave(d);
}
function qaAlias(entity){
  const alias=prompt("Alias جدید برای این هویت:");
  if(!alias||!alias.trim())return;
  const d=_qaDraft(),row={entity:entity,alias:alias.trim()};
  if(!d.aliases.some(x=>x.entity===row.entity&&_canonicalNorm(x.alias)===_canonicalNorm(row.alias)))d.aliases.push(row);
  _qaSave(d);
}
function qaCanonicalName(entity,current){
  const name=prompt("نام canonical:",current||"");
  if(!name||!name.trim())return;
  const d=_qaDraft();
  d.canonical_names=d.canonical_names.filter(x=>x.entity!==entity);
  d.canonical_names.push({entity:entity,name_fa:name.trim()});
  _qaSave(d);
}
function qaClearDraft(){
  if(!confirm("Draft تصمیم‌های Entity QA پاک شود؟"))return;
  localStorage.removeItem(ENTITY_QA_DRAFT_KEY);renderEntityQA();
}
async function qaCopyDraft(){
  const txt=JSON.stringify(_qaDraft(),null,2);
  try{await navigator.clipboard.writeText(txt);document.getElementById("entity-qa-note").textContent="JSON override کپی شد."}
  catch(_){document.getElementById("entity-qa-note").textContent="کپی خودکار ممکن نبود؛ JSON پایین صفحه را کپی کن."}
}
function _qaEntity(ent){
  if(!ent)return '<span class="qa-missing">هویت ناموجود</span>';
  return '<button class="qa-entity" onclick="openCanonicalEntity(\''+esc(ent.id)+'\')"><b>'+esc(ent.name_fa||ent.id)+'</b><small>'+esc(_entityTypeFa(ent.type))+' · '+esc(ent.id)+'</small></button>';
}
function showEntityQA(){show("entityqa");setTab("");setHash("#/system/entities");renderEntityQA()}
async function renderEntityQA(){
  const el=document.getElementById("entity-qa-content");
  if(!el)return;
  el.innerHTML='<div class="spinner"></div>';
  const [qa,reg]=await Promise.all([loadEntityQA(),loadCanonicalEntities()]);
  if(!qa){el.innerHTML='<div class="state"><div class="big">گزارش Entity QA هنوز در این deploy ساخته نشده</div></div>';return}
  const entities=new Map((reg.entities||[]).map(x=>[x.id,x])),s=qa.stats||{},draft=_qaDraft(),applied=qa.applied_overrides||{};
  const candidates=(qa.duplicate_candidates||[]).slice(0,100).map(x=>{
    const a=entities.get(x.a),b=entities.get(x.b);
    return '<article class="qa-candidate"><div class="qa-pair">'+_qaEntity(a)+'<span class="qa-vs">'+faN(Math.round((x.score||0)*100))+'٪</span>'+_qaEntity(b)+'</div><div class="qa-actions"><button onclick="qaMerge(\''+esc(x.b)+'\',\''+esc(x.a)+'\')">ادغام B ← A</button><button onclick="qaMerge(\''+esc(x.a)+'\',\''+esc(x.b)+'\')">ادغام A → B</button><button onclick="qaKeepSeparate(\''+esc(x.a)+'\',\''+esc(x.b)+'\')">جدا بمانند</button></div></article>';
  }).join("");
  const ambiguous=(qa.ambiguous_aliases||[]).slice(0,100).map(x=>'<article class="qa-row"><div><b>'+esc(x.alias)+'</b><small>'+esc(x.type)+' · '+faN((x.entity_ids||[]).length)+' هویت</small></div><div class="qa-inline-entities">'+(x.entity_ids||[]).map(id=>_qaEntity(entities.get(id))).join("")+'</div></article>').join("");
  const orphans=(qa.orphans||[]).slice(0,120).map(x=>'<article class="qa-row"><div>'+_qaEntity(entities.get(x.id))+'</div><div class="qa-actions"><button onclick="qaAlias(\''+esc(x.id)+'\')">Alias</button><button onclick="qaCanonicalName(\''+esc(x.id)+'\',\''+esc(x.name_fa||"")+'\')">نام مرجع</button></div></article>').join("");
  const broken=(qa.broken_edges||[]).map(x=>'<code class="qa-error">'+esc(JSON.stringify(x))+'</code>').join("");
  const invalid=(qa.invalid_overrides||[]).map(x=>'<div class="qa-error">'+esc(x)+'</div>').join("");
  const draftCount=draft.merges.length+draft.keep_separate.length+draft.aliases.length+draft.canonical_names.length;
  el.innerHTML=
    '<button class="back" onclick="showSystem()">بازگشت به سلامت سیستم</button>'+
    '<section class="qa-hero"><div><span class="press-kicker">Entity QA / Merge Console</span><h1>کنترل هویت‌های پندار</h1><p>تشخیص هویت‌های تکراری، aliasهای مبهم، orphanها و تصمیم‌های پایدار برای build بعدی.</p></div><div class="qa-health '+((s.broken_edges||s.invalid_overrides)?"bad":"ok")+'"><b>'+((s.broken_edges||s.invalid_overrides)?"نیازمند اصلاح":"ساختار سالم")+'</b><small>'+faN(s.entities||0)+' هویت · '+faN(s.edges||0)+' رابطه</small></div></section>'+
    '<div class="qa-stats"><span><b>'+faN(s.duplicate_candidates||0)+'</b> duplicate candidate</span><span><b>'+faN(s.ambiguous_aliases||0)+'</b> alias مبهم</span><span><b>'+faN(s.orphans||0)+'</b> orphan</span><span><b>'+faN(s.no_routes||0)+'</b> بدون route</span><span><b>'+faN(s.broken_edges||0)+'</b> edge شکسته</span></div>'+
    '<section class="qa-draft"><div><h2>Draft تصمیم‌ها</h2><p>این Draft در مرورگر نگه داشته می‌شود. JSON آن دقیقاً با <code>backend/data/entity-overrides.json</code> سازگار است.</p><small>اعمال‌شده در build فعلی: '+faN(applied.merges||0)+' merge · '+faN(applied.keep_separate||0)+' keep · '+faN(applied.aliases||0)+' alias · '+faN(applied.canonical_names||0)+' نام مرجع</small></div><div class="qa-draft-actions"><button onclick="qaCopyDraft()">کپی JSON ('+faN(draftCount)+')</button><button onclick="qaClearDraft()">پاک کردن Draft</button></div><span id="entity-qa-note"></span><pre>'+esc(JSON.stringify(draft,null,2))+'</pre></section>'+
    (invalid||broken?'<section class="qa-section qa-danger"><h2>خطاهای مسدودکننده Deploy</h2>'+invalid+broken+'</section>':'')+
    '<details class="qa-section" open><summary>Duplicate candidates <b>'+faN(s.duplicate_candidates||0)+'</b></summary>'+(candidates||'<div class="sys-empty">موردی پیدا نشده.</div>')+'</details>'+
    '<details class="qa-section"><summary>Aliasهای مبهم <b>'+faN(s.ambiguous_aliases||0)+'</b></summary>'+(ambiguous||'<div class="sys-empty">موردی پیدا نشده.</div>')+'</details>'+
    '<details class="qa-section"><summary>Orphan entities <b>'+faN(s.orphans||0)+'</b></summary>'+(orphans||'<div class="sys-empty">موردی پیدا نشده.</div>')+'</details>';
}

function showSystem() {
  show("system"); setTab(""); setHash("#/system"); renderSystem();
}
async function renderSystem() {
  const el = document.getElementById("system-content");
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';
  const safe = async (name, fallback) => {
    try { return await getJSON(`${DATA}/${name}`, 20000); } catch (_) { return fallback; }
  };
  const [health, stats, meta, pressHealth, tv, weather, periodicals, entityRegistry] = await Promise.all([
    safe("system-health.json", null),
    safe("stats.json", {}),
    safe("meta.json", {}),
    safe("press-registry-health.json", []),
    safe("tv-guide.json", {}),
    safe("weather.json", []),
    safe("periodicals.json", []),
    safe("entity-registry.json", {})
  ]);

  const hc = (health && health.counts) || {};
  const thresholds = (health && health.thresholds) || {};
  const github = (health && health.github) || {};
  const total = hc.total_news ?? stats.total;
  const feedStories = hc.feed_stories ?? meta.count;
  const figures = hc.figures;
  const statements = hc.statements;
  const majra = hc.majra_topics;
  const books = hc.books;
  const h24 = stats?.rolling?.h24;
  const today = stats?.calendar?.today;
  const yesterday = stats?.calendar?.yesterday;

  const pressRows = Array.isArray(pressHealth) ? pressHealth : [];
  const pressCounts = pressRows.reduce((m, row) => {
    const k = String(row?.state || "unknown");
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});
  const pressIssues = pressRows
    .filter(x => !["active"].includes(String(x?.state || "")))
    .sort((a,b) => String(a?.state||"").localeCompare(String(b?.state||"")))
    .slice(0, 20);

  const tvSources = Array.isArray(tv?.sources) ? tv.sources.length : Object.keys(tv?.source_stats || {}).length;
  const tvChannels = Array.isArray(tv?.channels) ? tv.channels.length : 0;
  const tvPrograms = Array.isArray(tv?.programmes) ? tv.programmes.length : 0;
  const tvErrors = tv?.source_errors && typeof tv.source_errors === "object"
    ? Object.entries(tv.source_errors)
    : [];
  const periodicalCount = Array.isArray(periodicals) ? periodicals.length : (hc.periodicals_rows || 0);
  const weatherCount = Array.isArray(weather) ? weather.length : 0;
  const erCounts = entityRegistry?.counts || {};
  const canonicalEntities = hc.canonical_entities ?? erCounts.total;
  const canonicalPeople = hc.canonical_people ?? erCounts.person;
  const entityConflicts = hc.entity_conflicts ?? (Array.isArray(entityRegistry?.conflicts) ? entityRegistry.conflicts.length : 0);

  const gateOk = health ? health.ok === true : null;
  const gateLabel = gateOk === true ? "نسخهٔ منتشرشده سالم است" : gateOk === false ? "گیت انتشار خطا دارد" : "گزارش گیت پیدا نشد";
  const gateCls = gateOk === true ? "ok" : gateOk === false ? "bad" : "warn";
  const runUrl = github.repository && github.run_id
    ? `https://github.com/${github.repository}/actions/runs/${github.run_id}`
    : "";

  const metrics = [
    _sysMetric("کل خبرهای منتشرشده", total, "آرشیو اصلی", Number(total)>=10000?"ok":"bad"),
    _sysMetric("۲۴ ساعت اخیر", h24, "خبر", ""),
    _sysMetric("امروز", today, "خبر", ""),
    _sysMetric("دیروز", yesterday, "خبر", ""),
    _sysMetric("چهره‌ها", figures, "پروفایل canonical", ""),
    _sysMetric("گفته‌ها", statements, "پست و نقل‌قول", ""),
    _sysMetric("کتاب‌ها", books, "رکورد", ""),
    _sysMetric("هویت‌های canonical", canonicalEntities, `${canonicalPeople||0} نفر · ${entityConflicts||0} تعارض`, entityConflicts?"warn":"ok"),
    _sysMetric("جان ماجرا", majra, "داده محفوظ؛ فعلاً خارج از Home", ""),
    _sysMetric("جراید", periodicalCount, "مطلب", ""),
    _sysMetric("منابع جراید", pressRows.length, `${pressCounts.active||0} فعال`, ""),
    _sysMetric("شبکه‌های TV Guide", tvChannels, `${tvSources} منبع`, ""),
    _sysMetric("برنامه‌های TV Guide", tvPrograms, `${tvErrors.length} خطای منبع`, tvErrors.length?"warn":"")
  ].join("");

  const pressIssueHtml = pressIssues.length ? pressIssues.map(row => {
    const [lbl, cls] = _sysState(row.state);
    return `<div class="sys-source-row"><div><b>${esc(row.source_name||"منبع")}</b><small>${esc(row.last_error||row.method||"")}</small></div><span class="sys-pill ${cls}">${esc(lbl)}</span></div>`;
  }).join("") : '<div class="sys-empty">همهٔ منابع ثبت‌شده در وضعیت فعال‌اند.</div>';

  const tvErrorHtml = tvErrors.length ? tvErrors.slice(0,20).map(([name,msg]) =>
    `<div class="sys-source-row"><div><b>${esc(name)}</b><small>${esc(typeof msg==="string"?msg:JSON.stringify(msg))}</small></div><span class="sys-pill bad">خطا</span></div>`
  ).join("") : '<div class="sys-empty">خطای منبعی در خروجی فعلی TV Guide ثبت نشده است.</div>';

  const thresholdLabels = {
    total_news:"کل خبرها", feed_stories:"فید اصلی", figures:"چهره‌ها",
    statements:"گفته‌ها", majra_topics:"جان ماجرا", books:"کتاب‌ها"
  };
  const thresholdHtml = Object.entries(thresholds).map(([k,v]) => {
    const current = hc[k];
    const pass = Number(current) >= Number(v);
    return `<div class="sys-th-row"><span>${esc(thresholdLabels[k]||k)}</span><b>${_sysNum(current)}</b><small>حداقل ${_sysNum(v)}</small><span class="sys-pill ${pass?"ok":"bad"}">${pass?"قبول":"رد"}</span></div>`;
  }).join("") || '<div class="sys-empty">آستانه‌ها در این نسخه ثبت نشده‌اند.</div>';

  el.innerHTML = `
    <section class="sys-hero ${gateCls}">
      <div><span class="home-eyebrow">آخرین نسخهٔ منتشرشده</span><h2>${esc(gateLabel)}</h2>
        <p>این صفحه سلامت آخرین نسخه‌ای را نشان می‌دهد که اجازهٔ انتشار گرفته؛ build ردشده جای نسخهٔ سالم را نمی‌گیرد.</p></div>
      <div class="sys-gate"><span class="sys-dot"></span><b>${gateOk===true?"PASS":gateOk===false?"BLOCKED":"UNKNOWN"}</b></div>
    </section>
    <div class="sys-grid">${metrics}</div>\n    <div class="sys-admin-actions"><button onclick="showEntityQA()">Entity QA / Merge Console</button><span>بررسی duplicateها، aliasها و overrideهای canonical</span></div>

    <div class="sys-two">
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Freshness</span><h3>تازه‌بودن داده‌ها</h3></div></div>
        <div class="sys-detail-row"><span>آخرین گیت انتشار</span><b>${_sysTime(health?.checked_at)}</b></div>
        <div class="sys-detail-row"><span>آخرین تولید خبر</span><b>${_sysTime(meta?.built_iso)}</b></div>
        <div class="sys-detail-row"><span>آخرین TV Guide</span><b>${_sysTime(tv?.generated_at)}</b></div>
        <div class="sys-detail-row"><span>شهرهای آب‌وهوا</span><b>${_sysNum(weatherCount)}</b></div>
        <div class="sys-detail-row"><span>فید صفحهٔ اول</span><b>${_sysNum(feedStories)}</b></div>
      </section>
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Deploy</span><h3>نسخه و اجرای GitHub</h3></div></div>
        <div class="sys-detail-row"><span>Workflow</span><b>${esc(github.workflow||"—")}</b></div>
        <div class="sys-detail-row"><span>Run ID</span><b>${esc(github.run_id||"—")}</b></div>
        <div class="sys-detail-row"><span>Commit</span><code>${esc((github.sha||"—").slice(0,12))}</code></div>
        <div class="sys-detail-row"><span>Repository</span><b>${esc(github.repository||"—")}</b></div>
        ${runUrl?`<a class="sys-run-link" href="${esc(runUrl)}" target="_blank" rel="noopener">باز کردن GitHub Actions ↗</a>`:""}
      </section>
    </div>

    <div class="sys-two">
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Press</span><h3>سلامت منابع جراید</h3></div>
          <span class="sys-mini">${_sysNum(pressCounts.active||0)} فعال · ${_sysNum(pressIssues.length)} نیازمند بررسی</span></div>
        <div class="sys-source-list">${pressIssueHtml}</div>
      </section>
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">EPG</span><h3>سلامت TV Guide</h3></div>
          <span class="sys-mini">${_sysNum(tvChannels)} شبکه · ${_sysNum(tvPrograms)} برنامه</span></div>
        <div class="sys-source-list">${tvErrorHtml}</div>
      </section>
    </div>

    <section class="sys-panel">
      <div class="sys-panel-head"><div><span class="home-eyebrow">Integrity Gate</span><h3>آستانه‌های جلوگیری از انتشار خراب</h3></div>
        <span class="sys-mini">افت کل خبرها بیش از ${health?.max_total_drop!=null?faN(Math.round(health.max_total_drop*100))+"٪":"۲۰٪"} نیز deploy را می‌بندد</span></div>
      <div class="sys-thresholds">${thresholdHtml}</div>
      ${(health?.errors||[]).length?`<div class="sys-errors">${health.errors.map(e=>`<div>${esc(e)}</div>`).join("")}</div>`:""}
    </section>
  `;
}

function showTech() {
  show("tech"); setTab(""); setHash("#/tech");
  const el = document.getElementById("tech-content");
  el.innerHTML = `
    <div class="tech-grid">
      <article class="tech-card"><h2>رابط فارسی و RTL</h2><p>کامپوننت‌های رابط با الگوهای بومیِ راست‌چین طراحی شده‌اند؛ کارت، آمار، آواتار، تب‌ها، نشان‌ها، خط زمان، حالت خالی و بارگذاری.</p><div class="tech-tags"><span class="tech-tag">Card</span><span class="tech-tag">Stat</span><span class="tech-tag">Avatar</span><span class="tech-tag">Tabs</span><span class="tech-tag">Badge</span></div></article>
      <article class="tech-card"><h2>VibeFarsi UI</h2><p>برای زبان بصری و رفتار کامپوننت‌های فارسی از VibeFarsi الهام گرفته‌ایم. پندار فعلاً پروژهٔ React/Tailwind نیست؛ بنابراین الگوها در CSS/JavaScript موجود بازپیاده‌سازی شده‌اند و خود کتابخانه dependency اجرایی سایت نیست.</p><div class="tech-tags"><a class="tech-tag" href="https://vibefarsi.ir/" target="_blank" rel="noopener">vibefarsi.ir ↗</a></div></article>
      <article class="tech-card"><h2>خبر و تحلیل</h2><p>Backend پایتون خبرها را دریافت، خوشه‌بندی، رتبه‌بندی و برای خروجی استاتیک آماده می‌کند. واقعیت خبر، تحلیل رسانه و دیدگاه اشخاص در لایه‌های جدا نگهداری می‌شوند.</p><div class="tech-tags"><span class="tech-tag">Python</span><span class="tech-tag">SQLAlchemy</span><span class="tech-tag">JSON</span></div></article>
      <article class="tech-card"><h2>انتشار استاتیک</h2><p>خروجی نهایی HTML/CSS/JavaScript است و با GitHub Actions ساخته و روی GitHub Pages منتشر می‌شود؛ بنابراین خواندن سایت به سرور اپلیکیشن دائمی وابسته نیست.</p><div class="tech-tags"><span class="tech-tag">GitHub Actions</span><span class="tech-tag">GitHub Pages</span><span class="tech-tag">PWA</span></div></article>
    </div>
    <div class="rule"><span>نقشهٔ فناوری</span><span class="l"></span></div>
    <div class="tech-stack">
      <div class="tech-row"><b>جمع‌آوری</b><span>منابع خبری، منابع عمومی چهره‌ها و داده‌های مکمل</span></div>
      <div class="tech-row"><b>پردازش</b><span>Python · خوشه‌بندی خبر · استخراج گفته‌ها · رتبه‌بندی و synthesis</span></div>
      <div class="tech-row"><b>داده</b><span>SQLAlchemy و خروجی‌های JSON برای رابط استاتیک</span></div>
      <div class="tech-row"><b>رابط</b><span>HTML + Vanilla JavaScript + CSS؛ فارسی و RTL از ابتدا</span></div>
      <div class="tech-row"><b>طراحی</b><span>Design tokens داخلی پندار + الگوهای سازگارشده از VibeFarsi UI</span></div>
      <div class="tech-row"><b>انتشار</b><span>GitHub Actions → GitHub Pages</span></div>
    </div>
    <div class="rule"><span>VibeFarsi کجا اثر گذاشته؟</span><span class="l"></span></div>
    <div class="tech-card"><p>در بازطراحی تدریجی پندار، الگوهای Card و Stat برای خلاصه‌ها و اعداد، Avatar برای چهره‌ها، Segmented Control/Tabs برای فیلترها، Badge برای وضعیت‌ها، Timeline برای زنجیرهٔ رویداد و Skeleton/Empty State برای وضعیت‌های بارگذاری و نبود داده مبنا قرار می‌گیرند. این تطبیق مرحله‌ای است تا معماری سبک فعلی حفظ شود.</p></div>
  `;
}
function showFigures() {
  show("figures"); setTab("");
  document.title="چهره‌ها | پندار";
  document.getElementById("figures-lede").style.display = "";
  document.getElementById("figures").innerHTML = "";
  // A previous visit can leave timeline filters in local page state.  The
  // /figures route itself must always open on a useful default instead of an
  // apparently broken empty filtered view.
  _figTimelineMode = "all";
  _figTimelineField = "all";
  renderFigureTimeline();
  setHash("#/figures");
}
function renderFiguresDirectory() {
  document.getElementById("figure-timeline").innerHTML = "";
  _figDirectoryMode = "direct";
  renderFigures();
}
function _studioRecapBodyHtml(text) {
  const parts = String(text || "").split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  return parts.map(p => {
    const plain = p.replace(/^#+\s*/, "").trim();
    if (/^جان کلام[：:]?$/.test(plain)) return '<h2>جان کلام</h2>';
    if (/^#{1,3}\s+/.test(p)) return '<h2>'+esc(plain)+'</h2>';
    return '<p>'+esc(p).replace(/\n/g,"<br>")+'</p>';
  }).join("");
}
async function copyStudioRecap(id, btn) {
  const rows=await loadStudioRecaps();
  const row=rows.find(x=>String(x.id)===String(id));
  if(!row) return;
  try {
    await navigator.clipboard.writeText(String(row.studio_recap_fa||""));
    if(btn){const old=btn.textContent;btn.textContent="کپی شد ✓";setTimeout(()=>{btn.textContent=old},1600);}
  } catch (_) {
    if(btn) btn.textContent="کپی نشد";
  }
}
function _financeNum(v){const n=Number(v||0);return faN(n.toLocaleString("en-US"))}
function _financeUsd(v){const n=Number(v||0);return "$"+n.toFixed(n<0.01?4:2)}
async function showProjectFinance(){
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const d=await loadProjectFinance();
  const t=d.totals||{}, rows=Array.isArray(d.videos)?d.videos:[];
  const videos=Number(t.videos_seen_by_ai||0);
  const per100=videos>0?(Number(t.estimated_paid_usd||0)/videos)*100:0;
  document.title="مالی پروژه | پندار";
  setHash("#/finance");
  el.innerHTML=`<div class="finance-wrap">
    <div class="latest-videos-head">
      <button class="back" onclick="showStudioRecaps()">بازگشت به استودیو</button>
      <div><span class="press-kicker">پندار · حسابداری پروژه</span><h1>مالی پروژه</h1>
      <p>مصرف API و هزینهٔ برآوردی پردازش ویدئوها از زمان فعال شدن ثبت مالی.</p></div>
    </div>
    <div class="finance-grid">
      <article class="finance-metric"><span>ویدئوهای پردازش‌شده</span><b>${_financeNum(videos)}</b><small>ویدئوهایی که AI برایشان مصرف ثبت کرده</small></article>
      <article class="finance-metric"><span>فراخوانی Gemini</span><b>${_financeNum(t.ai_calls||0)}</b><small>${_financeNum(t.total_tokens||0)} توکن کل</small></article>
      <article class="finance-metric"><span>هزینهٔ مرجع AI</span><b class="finance-money">${_financeUsd(t.estimated_paid_usd||0)}</b><small>برآورد Paid Tier؛ الزاماً مبلغ صورتحساب نیست</small></article>
      <article class="finance-metric"><span>برآورد ۱۰۰ ویدئو</span><b class="finance-money">${videos?_financeUsd(per100):"—"}</b><small>بر اساس میانگین مصرف واقعی ثبت‌شده</small></article>
      <article class="finance-metric"><span>Input tokens</span><b>${_financeNum(t.prompt_tokens||0)}</b><small>توکن‌های ورودی Gemini</small></article>
      <article class="finance-metric"><span>Output tokens</span><b>${_financeNum(t.completion_tokens||0)}</b><small>توکن‌های خروجی Gemini</small></article>
      <article class="finance-metric"><span>DownSub requests</span><b>${_financeNum(t.downsub_requests||0)}</b><small>${_financeNum(t.downsub_http_200||0)} پاسخ HTTP 200</small></article>
      <article class="finance-metric"><span>AI بدون نرخ شناخته‌شده</span><b>${_financeNum(t.unpriced_ai_calls||0)}</b><small>برای این درخواست‌ها برآورد دلاری صفر منظور شده</small></article>
    </div>
    <div class="finance-note">
      مبلغ AI «هزینهٔ مرجع» است: اگر API روی Free Tier باشد هزینهٔ واقعی می‌تواند صفر باشد.
      نرخ مرجع فعلی برای Gemini 2.5 Flash-Lite برابر $0.10 ورودی و $0.40 خروجی به‌ازای هر یک میلیون توکن، و برای Gemini 2.5 Flash برابر $0.30 و $2.50 است.
      برای DownSub فعلاً فقط تعداد درخواست‌ها ثبت می‌شود و تا زمانی که قاعدهٔ دقیق تبدیل request به credit را قطعی نکنیم، دلار تخمینی نمی‌زنیم.
      ${d.updated_at?` آخرین ثبت: ${_sysTime(d.updated_at)}.`:""}
    </div>
    <div class="rule"><span>ریز مصرف ویدئوها</span><span class="l"></span></div>
    ${rows.length?`<table class="finance-table"><thead><tr><th>ویدئو</th><th>AI calls</th><th>Input</th><th>Output</th><th>AI est.</th><th>DownSub</th></tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td><span class="finance-video-title"><b>${esc(r.topic_fa||r.video_title||r.video_id||"ویدئو")}</b><small>${esc(r.name_fa||"")}${r.last_at?" · "+relTime(r.last_at):""}</small></span></td>
        <td>${_financeNum(r.ai_calls||0)}</td>
        <td>${_financeNum(r.prompt_tokens||0)}</td>
        <td>${_financeNum(r.completion_tokens||0)}</td>
        <td><span class="finance-money">${_financeUsd(r.estimated_paid_usd||0)}</span></td>
        <td>${_financeNum(r.downsub_requests||0)}</td>
      </tr>`).join("")}
    </tbody></table>`:'<div class="finance-empty">هنوز مصرفی ثبت نشده؛ از Build بعدی این جدول پر می‌شود.</div>'}
  </div>`;
}

const STUDIO_DONE_KEY="pendar_studio_recorded_v1";
const STUDIO_FONT_KEY="pendar_studio_font_v1";
let _studioQueueMode="pending";
function studioDoneSet(){try{return new Set(JSON.parse(localStorage.getItem(STUDIO_DONE_KEY)||"[]"))}catch(_){return new Set()}}
function studioIsDone(id){return studioDoneSet().has(String(id))}
function toggleStudioDone(id,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const s=studioDoneSet(),k=String(id);s.has(k)?s.delete(k):s.add(k);localStorage.setItem(STUDIO_DONE_KEY,JSON.stringify([...s]));if(location.hash.startsWith("#/studio-recap/"))openStudioRecap(id);else showStudioRecaps(_studioQueueMode)}
function setStudioQueueMode(mode){_studioQueueMode=mode;showStudioRecaps(mode)}
function studioFontSize(){const n=Number(localStorage.getItem(STUDIO_FONT_KEY)||18);return Math.min(30,Math.max(16,n||18))}
function adjustStudioFont(delta){const n=Math.min(30,Math.max(16,studioFontSize()+delta));localStorage.setItem(STUDIO_FONT_KEY,String(n));const el=document.querySelector(".studio-recap-body");if(el)el.style.setProperty("--studio-font-size",n+"px")}
async function showStudioRecaps(mode = _studioQueueMode) {
  _studioQueueMode=mode||"pending";
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const allRows=(await loadStudioRecaps()).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const done=studioDoneSet();
  const rows=_studioQueueMode==="done"?allRows.filter(r=>done.has(String(r.id))):_studioQueueMode==="all"?allRows:allRows.filter(r=>!done.has(String(r.id)));
  const pendingCount=allRows.filter(r=>!done.has(String(r.id))).length;
  document.title="استودیوی ضبط جان کلام | پندار";
  setHash("#/studio-recaps");
  el.innerHTML=`
    <div class="latest-videos-head">
      <button class="back" onclick="showLatestVideos('recaps')">بازگشت به ویدئوها</button>
      <div><span class="press-kicker">استودیوی ضبط جان کلام</span><h1>صف آمادهٔ ضبط</h1>
      <p>نسخه‌های مفصل و انتخاب‌شده برای خواندن مستقیم، ضبط و انتشار در یوتیوب.</p></div>
      <div class="latest-videos-stats"><span><b>${faN(pendingCount)}</b> برای ضبط</span><span><b>${faN(allRows.length)}</b> کل</span></div>
    </div>
    <div class="studio-queue-tools">
      <div class="studio-queue-filters">
        <button class="${_studioQueueMode==="pending"?"on":""}" onclick="setStudioQueueMode('pending')">برای ضبط · ${faN(pendingCount)}</button>
        <button class="${_studioQueueMode==="all"?"on":""}" onclick="setStudioQueueMode('all')">همه · ${faN(allRows.length)}</button>
        <button class="${_studioQueueMode==="done"?"on":""}" onclick="setStudioQueueMode('done')">ضبط‌شده · ${faN(allRows.length-pendingCount)}</button>
      </div>
      <div class="studio-queue-filters"><button onclick="showProjectFinance()">مالی پروژه</button></div>
    </div>
    ${rows.length?`<div class="studio-recap-list">${rows.map(r=>`
      <article class="studio-recap-card ${done.has(String(r.id))?"done":""}">
        <div class="studio-recap-card-meta"><span>${esc(r.name_fa||"")}</span><span>·</span><span>${r.published_at?relTime(r.published_at):""}</span><span>·</span><span>${faN(r.word_count||String(r.studio_recap_fa||"").split(/\s+/).filter(Boolean).length)} واژه</span>${done.has(String(r.id))?'<span class="studio-recorded">· ضبط شد ✓</span>':""}</div>
        <h2>${esc(r.topic_fa||r.video_title||"نسخهٔ ضبط")}</h2>
        <p>${esc(r.summary_fa||"")}</p>
        <div class="studio-recap-card-actions">
          <button class="primary" onclick="openStudioRecap('${String(r.id||"").replace(/'/g,"\\'")}')">${done.has(String(r.id))?"باز کردن متن":"شروع ضبط"}</button>
          <button onclick="toggleStudioDone('${String(r.id||"").replace(/'/g,"\\'")}',event)">${done.has(String(r.id))?"برگردان به صف":"ضبط شد ✓"}</button>
        </div>
      </article>`).join("")}</div>`:`<div class="state"><div class="big">${_studioQueueMode==="pending"?"صف ضبط خالی است.":"موردی در این بخش نیست."}</div></div>`}
  `;
}
async function openStudioRecap(id) {
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const rows=(await loadStudioRecaps()).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const idx=rows.findIndex(x=>String(x.id)===String(id));
  const r=idx>=0?rows[idx]:null;
  if(!r){el.innerHTML='<div class="state"><div class="big">این نسخهٔ ضبط پیدا نشد.</div></div>';return;}
  const newer=idx>0?rows[idx-1]:null;
  const older=idx<rows.length-1?rows[idx+1]:null;
  const done=studioIsDone(r.id);
  document.title=(r.topic_fa||r.video_title||"نسخهٔ ضبط")+" | استودیو";
  setHash("#/studio-recap/"+encodeURIComponent(String(r.id||"")));
  el.innerHTML=`<article class="studio-recap-article ${done?"recorded":""}">
    <button class="back" onclick="showStudioRecaps()">بازگشت به صف ضبط</button>
    <span class="press-kicker">استودیو جان کلام · ${esc(r.name_fa||"")}</span>
    <h1>${esc(r.topic_fa||r.video_title||"نسخهٔ ضبط")}</h1>
    <div class="studio-recap-byline">${esc(r.video_title||"")}${r.word_count?` · ${faN(r.word_count)} واژه`:""}${r.published_at?` · ${relTime(r.published_at)}`:""}</div>
    <div class="studio-recap-toolbar">
      <button class="primary" onclick="copyStudioRecap('${String(r.id||"").replace(/'/g,"\\'")}',this)">کپی متن</button>
      <button onclick="toggleStudioDone('${String(r.id||"").replace(/'/g,"\\'")}',event)">${done?"برگردان به صف":"ضبط شد ✓"}</button>
      <span class="studio-font-tools"><button onclick="adjustStudioFont(-1)">A−</button><button onclick="adjustStudioFont(1)">A+</button></span>
      <a href="${esc(r.url||"#")}" target="_blank" rel="noopener">ویدئوی اصلی ↗</a>
    </div>
    ${youtubeRecapEmbed(r.video_id||r.url, r.video_title||r.topic_fa||"ویدئوی اصلی")}
    <div class="studio-recap-body" style="--studio-font-size:${studioFontSize()}px">${_studioRecapBodyHtml(r.studio_recap_fa)}</div>
    <div class="studio-reader-nav">
      <div>${newer?`<button onclick="openStudioRecap('${String(newer.id||"").replace(/'/g,"\\'")}')">→ جدیدتر</button>`:""}</div>
      <div>${older?`<button onclick="openStudioRecap('${String(older.id||"").replace(/'/g,"\\'")}')">قدیمی‌تر ←</button>`:""}</div>
    </div>
  </article>`;
}
function requestStudioRecap(videoId) {
  const id=youtubeVideoId(videoId);
  if(!id) return;
  const title="[studio] "+id;
  const body="درخواست ساخت نسخهٔ ضبط پندار برای این ویدئو:\n\nhttps://www.youtube.com/watch?v="+id+"\n\nپس از ثبت این درخواست توسط حساب nimania، پردازش عمیق فقط برای همین ویدئو اجرا می‌شود.";
  const url="https://github.com/nimania/pendar/issues/new?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body);
  window.open(url,"_blank","noopener,noreferrer");
}

async function showLatestVideos(mode = "all") {
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede");
  if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline");
  if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures");
  if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const [d,studioRows]=await Promise.all([loadFigures(),loadStudioRecaps()]);
  const studioByVideo=new Map((studioRows||[]).map(r=>[String(r.video_id||""),
    r]));
  const byVideo=new Map();
  for(const person of (d.figures||[])){
    for(const v of (person.youtube_videos||[])){
      if(!v || !v.url) continue;
      const key=String(v.id||v.url);
      let row=byVideo.get(key);
      if(!row){
        row={...v,people:[]};
        byVideo.set(key,row);
      } else if (!row.recap_fa && v.recap_fa) {
        // Preserve recap enrichment if a shared video is attached to more than one person.
        row={...row,...v,people:row.people};
        byVideo.set(key,row);
      }
      if(!row.people.some(p=>String(p.handle).toLowerCase()===String(person.handle).toLowerCase())){
        row.people.push({handle:person.handle,name_fa:person.name_fa,avatar:person.avatar,role_fa:person.role_fa,directory:person.directory!==false});
      }
    }
  }
  const videos=[...byVideo.values()].sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const recapVideos=videos.filter(v=>String(v.recap_fa||"").trim());
  const recapsOnly=mode==="recaps";
  const studioCount=(studioRows||[]).length;
  const visibleVideos=recapsOnly?recapVideos:videos;
  const peopleCount=new Set(videos.flatMap(v=>v.people.filter(p=>p.directory!==false).map(p=>String(p.handle).toLowerCase()))).size;
  const sourceCount=new Set(videos.flatMap(v=>v.people.filter(p=>p.directory===false).map(p=>String(p.handle).toLowerCase()))).size;
  document.title=(recapsOnly?"جان کلام ویدئوهای چهره‌ها":"آخرین ویدئوهای چهره‌ها")+" | پندار";
  setHash(recapsOnly?"#/videos/recaps":"#/videos");
  el.innerHTML=`
    <div class="latest-videos-head">
      <button class="back" onclick="showFigures()">بازگشت به چهره‌ها</button>
      <div><span class="press-kicker">چهره‌ها · ویدئو</span><h1>${recapsOnly?"جان کلام ویدئوها":"آخرین ویدئوها"}</h1>
      <p>${recapsOnly?"ویدئوهایی که متن آن‌ها به «جان کلام» حرفه‌ای و وفادارانه تبدیل شده است.":"تازه‌ترین ویدئوهای چهره‌های پندار؛ از کانال‌های رسمی و حضورهای شناسایی‌شده در میزبان‌های معتبر."}</p></div>
      <div class="latest-videos-stats">
        <button class="${!recapsOnly?"on":""}" onclick="showLatestVideos('all')"><b>${faN(videos.length)}</b> ویدئو</button>
        <span><b>${faN(peopleCount)}</b> چهره</span>${sourceCount?`<span><b>${faN(sourceCount)}</b> منبع</span>`:""}
        ${recapVideos.length?`<button class="${recapsOnly?"on":""}" onclick="showLatestVideos('recaps')"><b>${faN(recapVideos.length)}</b> ≣ جان کلام</button>`:""}
        <button onclick="showStudioRecaps()" title="نسخه‌های ضبط آماده" aria-label="نسخه‌های ضبط آماده">${studioCount?`<b>${faN(studioCount)}</b> `:""}✦</button>
      </div>
    </div>
    ${visibleVideos.length?`<div class="latest-videos-grid">${visibleVideos.slice(0,120).map(v=>`
      <article class="latest-video-card">
        <a class="latest-video-main" href="${esc(v.url)}" target="_blank" rel="noopener">
          <span class="figure-youtube-thumb">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy">`:""}<span class="figure-youtube-play">▶</span></span>
          <span class="latest-video-copy"><b>${esc(v.title||"ویدئوی یوتیوب")}</b><small>${v.published_at?relTime(v.published_at):"YouTube"} · YouTube ↗</small></span>
        </a>
        <div class="latest-video-people">${v.people.map(p=>p.directory!==false?`<button onclick="openFigure('${String(p.handle||"").replace(/'/g,"\\'")}')">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:""}<span>${esc(p.name_fa||"")}</span></button>`:`<span class="latest-video-source">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:""}<span>${esc(p.name_fa||"")}</span></span>`).join("")}</div>
        ${v.recap_fa?`<div class="latest-video-actions"><button onclick="openStatement('youtube-${String(v.id||"").replace(/'/g,"\\'")}')">≣ <span>جان کلام</span></button>${studioByVideo.has(String(v.id||""))?`<button class="studio-mark ready" onclick="openStudioRecap('${String(studioByVideo.get(String(v.id||"")).id||"").replace(/'/g,"\\'")}')" title="نسخهٔ ضبط آماده" aria-label="نسخهٔ ضبط آماده">✦</button>`:`<button class="studio-mark request" onclick="requestStudioRecap('${String(v.id||"").replace(/'/g,"\\'")}')" title="ساخت نسخهٔ ضبط" aria-label="ساخت نسخهٔ ضبط">✧</button>`}</div>`:""}
      </article>`).join("")}</div>`:`<div class="state"><div class="big">${recapsOnly?"هنوز جان کلامی آماده نشده":"هنوز ویدئویی برای چهره‌ها پیدا نشده"}</div></div>`}
  `;
}
async function renderFigures() {
  document.getElementById("figures-lede").style.display = "";
  const el = document.getElementById("figures");
  el.innerHTML = `<div class="spinner"></div>`;
  const d = await loadFigures();
  const people = (d.figures || []).filter(x =>
      x.directory !== false && (((x.posts||[]).length > 0) || (x.count||0) > 0)
    )
    .sort((a,b) => (b.count||0)-(a.count||0) || String(a.name_fa||"").localeCompare(String(b.name_fa||""),"fa"));
  el.innerHTML = `<p class="muted">نظرها و دیدگاه چهره‌ها در یک فهرست واحد؛ دیدگاه‌های مستقیم و گفته‌های منتسب در خبرها داخل همان پروفایل جمع می‌شوند.</p>` +
    (people.length ? `<div class="fig-grid">${people.map(x => `<button class="fig-person" onclick="openFigure('${esc(x.handle)}')">
      ${avatar(x, "md")}
      <span class="fp-body"><span class="fp-name">${esc(x.name_fa)}</span><span class="fp-role">${esc(x.role_fa||"")}</span>
      <span class="fp-count">${faN(x.count||0)} گفته</span></span></button>`).join("")}</div>`
    : `<div class="state"><div class="big">هنوز چهره‌ای با محتوای منتشرشده نداریم</div></div>`);
}
async function openNewsPerson(handle) { return openFigure(handle); }
async function openFigureByName(name) {
  const d = await loadFigures();
  const norm = s => String(s || "").replace(/‌/g, " ").replace(/\s+/g, " ").trim();
  const x = (d.figures || []).find(f => norm(f.name_fa) === norm(name));
  if (x) return openFigure(x.handle);
}
async function searchFigureProfiles(query) {
  const box=document.getElementById("figure-profile-search-results");
  if(!box) return;
  const q=_canonicalNorm(query||"");
  if(!q){box.innerHTML="";box.style.display="none";return}
  const d=await loadFigures();
  const rows=(d.figures||[]).filter(f=>{
    const hay=[f.name_fa,f.handle,f.role_fa,f.field_fa,...(f.aliases||[])].map(_canonicalNorm).join(" ");
    return hay.includes(q);
  }).slice(0,8);
  box.style.display="block";
  box.innerHTML=rows.length?rows.map(f=>`<button class="figure-search-hit" onclick="openFigure('${String(f.handle||"").replace(/'/g,"\\'")}')">${avatar(f,"sm")}<span><b>${esc(f.name_fa||"")}${f.verified?'<em class="profile-verified" title="هویت تأییدشده">✓</em>':""}</b><small>${esc(f.role_fa||f.field_fa||"")}</small></span></button>`).join(""):'<div class="figure-search-empty">چهره‌ای پیدا نشد.</div>';
}
let _figureProfileFilter = "all";
function setFigureProfileFilter(handle, mode) {
  _figureProfileFilter = mode;
  openFigure(handle, false);
}
function youtubeVideoId(value) {
  const s=String(value||"").trim();
  if(!s) return "";
  if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m=s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}
function youtubeRecapEmbed(videoOrUrl, title) {
  const id=youtubeVideoId(videoOrUrl);
  if(!id) return "";
  const src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?rel=0";
  return '<div class="youtube-recap-embed"><iframe src="'+src+'" title="'+esc(title||"ویدئوی اصلی در یوتیوب")+'" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>';
}
async function openStatement(id) {
  const raw = decodeURIComponent(id);
  const [direct, statementBookData, statementMovieData] = await Promise.all([loadFigures(), loadBooks(), loadMovies()]);
  let person = null, post = null, isNews = false;
  for (const f of (direct.figures || [])) {
    const p = (f.posts || []).find(x => String(x.id) === raw);
    if (p) { person = f; post = p; break; }
  }
  if (post) isNews = post.kind === "news_statement";
  show("figures"); setTab("");
  document.getElementById("figures-lede").style.display = "none";
  document.getElementById("figure-timeline").innerHTML = "";
  const el = document.getElementById("figures");
  if (!post) { el.innerHTML = '<div class="state"><div class="big">این گفته پیدا نشد</div></div>'; return; }
  const statementBooks=(statementBookData.books||[]).filter(b=>(b.mentions||[]).some(m=>String(m.post_id||"")===String(raw)));
  const statementBooksSection=statementBooks.length?'<div class="rule"><span>کتاب‌های مرتبط با این گفته</span><span class="l"></span></div><div class="press-book-links">'+statementBooks.map(b=>'<button onclick="openBook(\''+esc(b.slug)+'\')"><span>کتاب</span><b>'+esc(b.title_fa||"")+'</b></button>').join("")+'</div>':"";
  const statementMovies=(statementMovieData.movies||[]).filter(m=>(m.mentions||[]).some(mm=>String(mm.post_id||"")===String(raw)));
  const statementMoviesSection=statementMovies.length?'<div class="rule"><span>فیلم‌ها و سریال‌های مرتبط با این گفته</span><span class="l"></span></div><div class="press-book-links">'+statementMovies.map(m=>'<button onclick="openMovie(\''+esc(m.slug)+'\')"><span>فیلم</span><b>'+esc(m.title_fa||m.original_title||"")+'</b></button>').join("")+'</div>':"";
  setHash("#/statement/" + encodeURIComponent(raw));
  const isYoutube = post.platform === "youtube";
  const recapText = String(post.recap_fa || "").trim();
  const recapHtml = isYoutube && recapText
    ? '<section class="video-statement-recap"><div class="rule"><span>≣ جان کلام</span><span class="l"></span></div>' +
      recapText.split(/\\n{2,}/).map(p=>'<p>'+esc(p)+'</p>').join('') + '</section>'
    : '';
  const videoEmbedHtml = isYoutube
    ? youtubeRecapEmbed(post.url || String(post.id||"").replace(/^youtube-/,""), post.video_title || post.topic_fa || "ویدئوی اصلی")
    : "";
  const pointRows = isYoutube && Array.isArray(post.key_points_fa) ? post.key_points_fa.filter(Boolean) : [];
  const pointsHtml = pointRows.length
    ? '<section class="video-statement-points"><h3>نکات اصلی</h3><ul>' + pointRows.map(x=>'<li>'+esc(x)+'</li>').join('') + '</ul></section>'
    : '';
  el.innerHTML = '<button class="back" onclick="' + (isNews ? "openNewsPerson" : "openFigure") + "(\'" + esc(person.handle) + "\')\">بازگشت به پروفایل</button>" +
    '<div class="fig-head">' + avatar(person,"lg") + '<div class="fig-head-body"><h1>' + esc(person.name_fa) + '</h1><p class="muted">' + esc(person.role_fa||"") + '</p></div></div>' +
    '<div class="rule"><span>' + (isYoutube ? "جان کلام" : (isNews ? "گفته در خبر" : "دیدگاه")) + '</span><span class="l"></span></div>' +
    figureCard(post,false) + videoEmbedHtml + pointsHtml + recapHtml +
    statementBooksSection +
    statementMoviesSection +
    ((post.related_people || []).length ? '<div class="rule"><span>ارتباط این گفته</span><span class="l"></span></div><div class="views">' +
      post.related_people.map(r => `<button class="fig-person" onclick="openFigure('${esc(r.handle)}')"><span class="fp-body"><span class="fp-name">${esc(r.name_fa)}</span><span class="fp-role">${r.relation === "response" ? "پاسخ / واکنش مرتبط" : "شخص نام‌برده در این گفته"}</span></span></button>`).join("") + '</div>' : '') +
    '<p class="muted fig-note">این صفحه نشانی مستقل دارد و می‌توان مستقیماً به همین گفته ارجاع داد.</p>';
}
function telegramEmbed(post) {
  if (!post || !post.telegram_media || !String(post.url || "").startsWith("https://t.me/")) return "";
  const m = String(post.url).match(/^https:\/\/t\.me\/([^/?#]+)\/(\d+)/);
  if (!m) return "";
  const src = `https://t.me/${encodeURIComponent(m[1])}/${m[2]}?embed=1&mode=tme`;
  return `<div class="telegram-embed telegram-embed-${esc(post.telegram_media)}"><iframe src="${src}" loading="lazy" frameborder="0" scrolling="no" allow="autoplay; encrypted-media; picture-in-picture" title="رسانهٔ پست تلگرام"></iframe></div>`;
}

async function openFigure(handle, resetFilter = true, canonicalId = null) {
  const canonicalFigure=canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByRef("figures",handle);
  canonicalId=canonicalFigure?.id||canonicalId;
  if (resetFilter) _figureProfileFilter = "all";
  setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/figure/" + handle);
  show("figures"); setTab("");
  document.getElementById("figures-lede").style.display = "none";
  document.getElementById("figure-timeline").innerHTML = "";
  const el = document.getElementById("figures");
  el.innerHTML = `<div class="spinner"></div>`;
  const [d, curatedPoems, bookData, movieData] = await Promise.all([loadFigures(), loadCuratedPoems(), loadBooks(), loadMovies()]);
  const x = (d.figures || []).find(f => f.handle.toLowerCase() === String(handle).toLowerCase());
  if (!x) { el.innerHTML = `<div class="state"><div class="big">این چهره پیدا نشد</div></div>`; return; }
  const direct = (x.posts || []).filter(p => p.kind !== "news_statement");
  const news = (x.posts || []).filter(p => p.kind === "news_statement");
  const nameNorm=s=>String(s||"").replace(/ي/g,"ی").replace(/ى/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim();
  const bookPerson=(bookData.people||[]).find(p=>nameNorm(p.name_fa)===nameNorm(x.name_fa));
  const figureBooks=(bookPerson?.book_slugs||[]).map(s=>_bookBySlug(bookData,s)).filter(Boolean);
  const figureMovies=(movieData.movies||[]).filter(m=>(m.mentions||[]).some(mm=>mm.kind==="figure"&&(String(mm.handle||"").toLowerCase()===String(x.handle||"").toLowerCase()||(x.posts||[]).some(p=>String(p.id)===String(mm.post_id)))));
  const youtubeVideos=(x.youtube_videos||[]).filter(v=>v&&v.url);
  const canonicalNames=new Set([x.name_fa,...(canonicalFigure?.aliases||[])].map(_canonicalNorm).filter(Boolean));
  const figureStories=canonicalFigure?ALL.filter(s=>(s.entities||[]).some(e=>canonicalNames.has(_canonicalNorm(e.name_fa||"")))):[];
  const shown = _figureProfileFilter === "direct" ? direct : _figureProfileFilter === "news" ? news : (_figureProfileFilter === "works" || _figureProfileFilter === "books" || _figureProfileFilter === "movies" || _figureProfileFilter === "stories" || _figureProfileFilter === "videos") ? [] : (x.posts || []);
  const latest = (x.posts || []).map(p => p.published_at).filter(Boolean).sort().pop();
  const poems = Array.isArray(curatedPoems[x.handle]) ? curatedPoems[x.handle] : [];
  const poemSection = poems.length ? `<section class="curated-poems"><div class="curated-poems-head"><div><span class="curated-kicker">اثر ویژه</span><h2>یک شعر؛ بخش‌های منتشرشده</h2><p>این ${faN(poems.length)} متن، بخش‌های مختلف یک شعر از مونا برزویی‌اند. ترتیب نهایی بخش‌ها هنوز اعلام نشده است؛ شماره‌های زیر فقط برای تفکیک در آرشیو جان کلام‌اند و ترتیب شعر را نشان نمی‌دهند.</p></div><span class="curated-count">${faN(poems.length)} بخش</span></div><div class="curated-poem-list">${poems.map((p,i)=>`<article class="curated-poem"><div class="curated-poem-no" title="شمارهٔ آرشیوی؛ نه ترتیب شعر">بخش ${faN(i+1)}*</div><div class="curated-poem-text">${esc(p.text||"").replace(/\\n/g,"<br>")}</div></article>`).join("")}</div></section>` : "";
  const postRow = p => `<article class="x-post">
    <div class="x-post-rail">${avatar(x,"sm")}</div>
    <div class="x-post-body">
      <div class="x-post-meta"><b>${esc(x.name_fa)}</b><span>·</span><time>${relTime(p.published_at)}</time></div>
      ${p.kind === "news_statement" ? `<div class="x-post-context">گفته در خبر · ${esc(p.source_name || "منبع خبری")}</div>` : (p.topic_fa ? `<div class="x-post-topic">${esc(p.topic_fa)}</div>` : "")}
      <p>${esc(p.summary_fa || "")}</p>
      ${telegramEmbed(p)}
      <div class="x-post-actions">
        <button onclick="openStatement(' ${statementKey(p)}'.trim())" title="صفحهٔ این گفته">◯ <span>صفحهٔ گفته</span></button>
        <a href="${esc(p.url)}" target="_blank" rel="noopener" title="متن اصلی">↗ <span>متن اصلی</span></a>
      </div>
    </div>
  </article>`;
  el.innerHTML = `<div class="x-profile">
    <div class="x-profile-top"><button class="x-back" onclick="showFigures()" aria-label="بازگشت">←</button><div><b>${esc(x.name_fa)}</b><small>${faN((x.posts||[]).length)} گفته</small></div></div>
    <div class="figure-profile-search"><div class="figure-profile-search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="جستجو میان چهره‌ها…" autocomplete="off" oninput="searchFigureProfiles(this.value)" onfocus="if(this.value)searchFigureProfiles(this.value)"></div><div id="figure-profile-search-results" class="figure-profile-search-results"></div></div>
    <div class="x-cover"></div>
    <div class="x-profile-main">
      <div class="x-avatar-wrap">${avatar(x,"lg")}</div>
      <div class="x-profile-actions">${figureFollowBtn(x.handle,false)}</div>
      <h1>${esc(x.name_fa)}${x.verified?'<span class="profile-verified" title="هویت تأییدشده">✓</span>':""}</h1>
      ${x.claimed?'<div class="profile-claimed">این پروفایل توسط خود فرد تأیید و مدیریت می‌شود.</div>':""}
      <div class="x-handle">@${esc(x.handle)}</div>
      <p class="x-bio">${esc(x.role_fa || "")}</p>
      ${socialLinks(x.social)}
      <div class="x-profile-stats"><span><b>${faN(direct.length)}</b> دیدگاه مستقیم</span><span><b>${faN(news.length)}</b> گفته در خبر</span>${figureStories.length ? `<span><b>${faN(figureStories.length)}</b> خبر</span>` : ""}${figureBooks.length ? `<span><b>${faN(figureBooks.length)}</b> کتاب</span>` : ""}${figureMovies.length ? `<span><b>${faN(figureMovies.length)}</b> فیلم/سریال</span>` : ""}${youtubeVideos.length ? `<span><b>${faN(youtubeVideos.length)}</b> ویدئو</span>` : ""}${latest ? `<span>آخرین فعالیت ${relTime(latest)}</span>` : ""}</div>
    </div>
    ${canonicalFigure?canonicalStrip(canonicalFigure):""}
    <nav class="x-profile-tabs" aria-label="بخش‌های پروفایل">
      <button class="${_figureProfileFilter==="all"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','all')">همه</button>
      <button class="${_figureProfileFilter==="direct"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','direct')">دیدگاه‌ها</button>
      <button class="${_figureProfileFilter==="news"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','news')">گفته در خبرها</button>
      ${figureStories.length ? `<button class="${_figureProfileFilter==="stories"?"on":""}" onclick="setFigureProfileFilter(\'${esc(x.handle)}\',\'stories\')">خبرها</button>` : ""}
      ${figureBooks.length ? `<button class="${_figureProfileFilter==="books"?"on":""}" onclick="setFigureProfileFilter(\'${esc(x.handle)}\',\'books\')">کتاب‌ها</button>` : ""}
      ${figureMovies.length ? `<button class="${_figureProfileFilter==="movies"?"on":""}" onclick="setFigureProfileFilter(\'${esc(x.handle)}\',\'movies\')">فیلم‌ها</button>` : ""}
      ${youtubeVideos.length ? `<button class="${_figureProfileFilter==="videos"?"on":""}" onclick="setFigureProfileFilter(\'${esc(x.handle)}\',\'videos\')">ویدئوها</button>` : ""}
      ${poems.length ? `<button class="${_figureProfileFilter==="works"?"on":""}" onclick="setFigureProfileFilter(\'${esc(x.handle)}\',\'works\')">آثار</button>` : ""}
    </nav>
    ${_figureProfileFilter==="stories" ? `<section class="figure-stories">${groupedFeed(figureStories)}</section>` : ""}
    ${_figureProfileFilter==="books" ? `<section class="figure-books"><div class="books-grid">${figureBooks.map(_bookCard).join("")}</div></section>` : ""}
    ${_figureProfileFilter==="movies" ? `<section class="figure-movies"><div class="movie-grid">${figureMovies.map(_movieCard).join("")}</div></section>` : ""}
    ${_figureProfileFilter==="videos" ? `<section class="figure-youtube"><div class="figure-youtube-grid">${youtubeVideos.map(v=>`<article class="figure-youtube-card"><a href="${esc(v.url)}" target="_blank" rel="noopener"><span class="figure-youtube-thumb">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy">`:""}<span class="figure-youtube-play">▶</span></span><span class="figure-youtube-body"><b>${esc(v.title||"ویدئوی یوتیوب")}</b><small>${v.published_at?relTime(v.published_at):"YouTube"} · باز کردن در یوتیوب ↗</small></span></a>${v.recap_fa?`<button class="video-recap-btn" onclick="openStatement('youtube-${String(v.id||"").replace(/'/g,"\\'")}')">ری‌کپ حرفه‌ای</button>`:""}</article>`).join("")}</div></section>` : ""}
    ${_figureProfileFilter==="works" ? poemSection : ""}\n    <div class="x-profile-feed" ${(_figureProfileFilter==="works"||_figureProfileFilter==="books"||_figureProfileFilter==="movies"||_figureProfileFilter==="stories"||_figureProfileFilter==="videos") ? 'style="display:none"' : ""}>${shown.length ? shown.map(postRow).join("") : '<div class="state"><div class="big">در این بخش موردی ثبت نشده.</div></div>'}</div>
    <p class="muted fig-note x-profile-note">دیدگاه‌ها از منابع عمومی خود شخص می‌آیند؛ موارد «در خبرها» گفته‌هایی هستند که رسانه‌ها به او نسبت داده‌اند.</p>
  </div>`;
}
