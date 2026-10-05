/* Pendar — book app glue: the books data cache + loader (booksCache,
   loadBooks), _bookBySlug, _toman price format, and the publisher /
   book-person profile openers (openPublisher, openBookPerson,
   _personIdentityNorm, _figureForBookPerson). Extracted from app.js;
   loaded as a classic script BEFORE app.js (and before books-hub.js,
   book-market-ui.js and knowledge-hub.js, which call these at runtime).
   route() reaches openPublisher/openBookPerson on deep links. Uses
   book-curation.js (_curateBookData), entities.js (canonicalStrip,
   canonicalEntityByName) and books-hub.js (_bookCard, showBooks) helpers at
   runtime. No behavior change. */

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
