/* Pendar Knowledge Hub
   Migrated from nimania/pendar. This is the durable knowledge layer under the
   live Pendar news/people/press product. */
let _PENDAR_KNOWLEDGE = null;

const pkEsc = s => (typeof esc==="function" ? esc(s) : String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])));
const pkNorm = s => String(s||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim().toLowerCase();

async function loadPendarKnowledge(){
  if(_PENDAR_KNOWLEDGE) return _PENDAR_KNOWLEDGE;
  const names=["people","figures","books","organizations","festivals","collections","topics","paths","articles"];
  const rows=await Promise.all(names.map(async n=>{
    try{return await getJSON("data/pendar-"+n+".json?v="+Date.now(),7000)}catch(_){return []}
  }));
  _PENDAR_KNOWLEDGE=Object.fromEntries(names.map((n,i)=>[n,Array.isArray(rows[i])?rows[i]:[]]));
  return _PENDAR_KNOWLEDGE;
}

function _pkNav(active){
  const tabs=[
    ["home","نمای کلی"],["people","آدم‌ها"],["topics","موضوعات"],
    ["collections","پرونده‌ها"],["paths","مسیرهای مطالعه"],["festivals","آیین‌ها"],["organizations","نهادها"]
  ];
  return '<nav class="pk-tabs">'+tabs.map(([id,t])=>'<button class="'+(active===id?'on':'')+'" onclick="showKnowledge(\''+id+'\')">'+t+'</button>').join("")+'</nav>';
}
function _pkStat(n,label){return '<div class="pk-stat"><b>'+faN(n)+'</b><span>'+label+'</span></div>'}
function _pkAsset(item){
  const p=item?.image?.path||item?.cover?.path||"";
  return /^assets\/(people|figures|books)\//.test(p) ? "assets/pendar/"+p.replace(/^assets\//,"") : "";
}
function _pkCard(kind,id,title,summary,meta,item){
  const img=_pkAsset(item);
  return '<button class="pk-card '+(img?'has-img':'')+'" onclick="openKnowledgeEntity(\''+kind+'\',\''+pkEsc(id)+'\')">'+
    (img?'<img class="pk-card-img" src="'+pkEsc(img)+'" alt="" loading="lazy">':'')+
    '<span class="press-kicker">'+pkEsc(meta||kind)+'</span><strong>'+pkEsc(title||id)+'</strong><p>'+pkEsc(summary||"")+'</p></button>';
}

async function showKnowledge(section="home"){
  show("knowledge"); setTab("");
  const el=document.getElementById("knowledge-content");
  if(!el)return;
  el.innerHTML='<div class="spinner"></div>';
  const d=await loadPendarKnowledge();
  document.title="دانش پندار | پندار";

  if(section.includes("/")){
    const [kind,id]=section.split("/");
    return openKnowledgeEntity(kind,id,false);
  }

  let body="";
  if(section==="people"){
    const all=[
      ...d.people.map(x=>({...x,kind:"person",meta:x.field||"شخصیت فرهنگی"})),
      ...d.figures.map(x=>({...x,kind:"figure",meta:x.category||"چهره تاریخی"}))
    ];
    body='<div class="pk-grid">'+all.map(x=>_pkCard(x.kind,x.id,x.title,x.summary,x.meta,x)).join("")+'</div>';
  }else if(section==="topics"){
    body='<div class="pk-grid">'+d.topics.map(x=>_pkCard("topic",x.id,x.title,x.summary,x.category,x)).join("")+'</div>';
  }else if(section==="collections"){
    body='<div class="pk-grid">'+d.collections.map(x=>_pkCard("collection",x.id,x.title,x.summary,"پرونده مطالعاتی",x)).join("")+'</div>';
  }else if(section==="paths"){
    body='<div class="pk-grid">'+d.paths.map(x=>_pkCard("path",x.id,x.title,x.summary,"مسیر مطالعه",x)).join("")+'</div>';
  }else if(section==="festivals"){
    body='<div class="pk-grid">'+d.festivals.map(x=>_pkCard("festival",x.id,x.title,x.summary,x.dateLabel,x)).join("")+'</div>';
  }else if(section==="organizations"){
    body='<div class="pk-grid">'+d.organizations.map(x=>_pkCard("organization",x.id,x.title,x.summary,[x.type,x.country].filter(Boolean).join(" · "),x)).join("")+'</div>';
  }else{
    const featured=[
      ...d.collections.slice(0,3).map(x=>_pkCard("collection",x.id,x.title,x.summary,"پرونده",x)),
      ...d.festivals.slice(0,2).map(x=>_pkCard("festival",x.id,x.title,x.summary,x.dateLabel,x)),
      ...d.people.slice(0,3).map(x=>_pkCard("person",x.id,x.title,x.summary,x.field,x))
    ].join("");
    body='<section class="pk-hero"><span class="home-eyebrow">لایهٔ دانش پندار</span><h1>ایران را فقط از خبر امروز نبین</h1><p>چهره‌ها، کتاب‌ها، آیین‌ها، نهادها و پرونده‌های تاریخی در همان شبکه‌ای که خبرها و دیدگاه‌های امروز را نگه می‌دارد.</p></section>'+
      '<div class="pk-stats">'+_pkStat(d.people.length+d.figures.length,"شخص و چهره تاریخی")+_pkStat(d.books.length,"کتاب پایه")+_pkStat(d.topics.length,"موضوع")+_pkStat(d.organizations.length,"نهاد")+_pkStat(d.festivals.length,"آیین")+'</div>'+
      '<div class="rule"><span>برای شروع</span><span class="l"></span></div><div class="pk-grid">'+featured+'</div>';
  }

  el.innerHTML='<header class="pk-head"><div><span class="press-kicker">Pendar Knowledge</span><h1>دانش پندار</h1><p>تاریخ، فرهنگ و اندیشه؛ متصل به پندار امروز.</p></div></header>'+_pkNav(section)+body+
    '<p class="pk-origin">این مجموعه از پروژهٔ اولیهٔ Pendar مهاجرت کرده و به‌تدریج با هویت‌های اصلی سایت ادغام می‌شود؛ هدف نهایی یک مرجع برای هر موجودیت است.</p>';
  setHash(section==="home"?"#/knowledge":"#/knowledge/"+section);
}

async function _pkCanonicalPerson(item){
  try{
    const figures=await loadFigures();
    const linked=_figureForBookPerson({name_fa:item.title,aliases_fa:item.aliases?[item.aliases].flat():[]},figures);
    if(linked)return {kind:"figure",value:linked.handle};
  }catch(_){}
  try{
    const books=await loadBooks();
    const p=(books.people||[]).find(x=>pkNorm(x.name_fa)===pkNorm(item.title));
    if(p)return {kind:"book-person",value:p.slug};
  }catch(_){}
  return null;
}

async function openKnowledgeEntity(kind,id,setRoute=true){
  show("knowledge"); setTab("");
  const el=document.getElementById("knowledge-content");
  el.innerHTML='<div class="spinner"></div>';
  const d=await loadPendarKnowledge();
  const map={person:"people",figure:"figures",topic:"topics",collection:"collections",path:"paths",festival:"festivals",organization:"organizations",book:"books",article:"articles"};
  const item=(d[map[kind]]||[]).find(x=>String(x.id)===String(id));
  if(!item){el.innerHTML='<div class="state"><div class="big">این مدخل پیدا نشد</div></div>';return}

  if(kind==="person" || kind==="figure"){
    const canonical=await _pkCanonicalPerson(item);
    if(canonical?.kind==="figure") return openFigure(canonical.value);
    if(canonical?.kind==="book-person") return openBookPerson(canonical.value);
  }
  if(kind==="book"){
    try{
      const books=await loadBooks();
      const current=(books.books||[]).find(b=>pkNorm(b.title_fa||b.title)===pkNorm(item.title));
      if(current) return openBook(current.slug);
    }catch(_){}
  }

  const facts=[];
  if(item.life)facts.push(item.life);
  if(item.place)facts.push(item.place);
  if(item.field)facts.push(item.field);
  if(item.category)facts.push(item.category);
  if(item.type)facts.push(item.type);
  if(item.country)facts.push(item.country);
  if(item.dateLabel)facts.push(item.dateLabel);

  const bios=(item.biography||[]).map(x=>'<p>'+pkEsc(x)+'</p>').join("");
  const timeline=(item.timeline||[]).length?'<section class="pk-section"><h2>خط زمان</h2><div class="pk-timeline">'+item.timeline.map(x=>'<div><b>'+pkEsc(x.date)+'</b><span>'+pkEsc(x.text)+'</span></div>').join("")+'</div></section>':"";
  const pathSteps=(item.steps||[]).length?'<section class="pk-section"><h2>گام‌ها</h2><div class="pk-timeline">'+item.steps.map(x=>'<div><b>'+pkEsc(x.title)+'</b><span>'+pkEsc(x.text)+(x.url?' <a class="pk-source" href="'+pkEsc(x.url)+'" target="_blank" rel="noopener">منبع ↗</a>':'')+'</span></div>').join("")+'</div></section>':"";
  const sections=(item.sections||[]).length?'<section class="pk-section">'+item.sections.map(x=>'<article><h2>'+pkEsc(x[0])+'</h2><p>'+pkEsc(x[1])+'</p></article>').join("")+'</section>':"";
  const relatedBooks=(item.bookIds||[]).map(bid=>d.books.find(b=>b.id===bid)).filter(Boolean);
  const books=relatedBooks.length?'<section class="pk-section"><h2>کتاب‌های مرتبط</h2><div class="pk-grid">'+relatedBooks.map(b=>_pkCard("book",b.id,b.title,b.summary,b.author,b)).join("")+'</div></section>':"";
  const source=item.sourceUrl||item.officialUrl;
  const sourceLink=source?'<a class="pk-source" href="'+pkEsc(source)+'" target="_blank" rel="noopener">منبع اصلی ↗</a>':"";

  const hero=_pkAsset(item);
  el.innerHTML='<button class="back" onclick="showKnowledge(\''+(kind==="festival"?"festivals":kind==="organization"?"organizations":kind==="collection"?"collections":kind==="path"?"paths":kind==="topic"?"topics":"people")+'\')">بازگشت به دانش پندار</button>'+
    '<article class="pk-detail">'+(hero?'<img class="pk-detail-img" src="'+pkEsc(hero)+'" alt="'+pkEsc(item.title||"")+'">':'')+'<span class="press-kicker">'+pkEsc(kind==="figure"?"چهره تاریخی":kind==="person"?"شخص":kind==="organization"?"نهاد":kind==="festival"?"آیین":kind==="collection"?"پرونده":kind==="path"?"مسیر مطالعه":"موضوع")+'</span>'+
    '<h1>'+pkEsc(item.title)+'</h1>'+(facts.length?'<div class="pk-facts">'+facts.map(x=>'<span>'+pkEsc(x)+'</span>').join("")+'</div>':"")+
    '<p class="pk-summary">'+pkEsc(item.summary||"")+'</p>'+bios+timeline+pathSteps+sections+books+
    (item.note?'<p class="pk-note">'+pkEsc(item.note)+'</p>':"")+(item.notes?'<p class="pk-note">'+pkEsc(item.notes)+'</p>':"")+sourceLink+'</article>';
  document.title=(item.title||"دانش پندار")+" | پندار";
  if(setRoute)setHash("#/knowledge/"+kind+"/"+encodeURIComponent(id));
}

window.showKnowledge=showKnowledge;
window.openKnowledgeEntity=openKnowledgeEntity;
