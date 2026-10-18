/* Pendar newsroom: transparent AI editorial desks (names/photos pending approval). */
let _pendarAuthorPromise=null;
async function loadPendarEditorialAuthors(){
  if(window.PENDAR_EDITORIAL_AUTHORS)return window.PENDAR_EDITORIAL_AUTHORS;
  if(!_pendarAuthorPromise){
    _pendarAuthorPromise=getJSON(DATA+"/pendar-editorial-authors.json").then(data=>{
      if(!Array.isArray(data.authors)||data.authors.length!==7)throw Error("Editorial roster invalid");
      window.PENDAR_EDITORIAL_AUTHORS=data;
      return data;
    }).catch(e=>{_pendarAuthorPromise=null;throw e});
  }
  return _pendarAuthorPromise;
}
/* Compatibility attribution for articles exported before the author schema.
   The build-time classifier remains authoritative after the next news cycle. */
function pendarEditorialAuthorId(story){
  const catalog=window.PENDAR_EDITORIAL_AUTHORS;
  if(!catalog)return "desk";
  const known=new Set(catalog.authors.map(a=>a.id));
  const explicit=story?.editorial_author_id||story?.editorial_report?.author_id;
  if(explicit==="desk"||known.has(explicit))return explicit;
  const norm=x=>String(x||"").toLowerCase().replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ");
  const head=norm(story?.headline_fa),summary=norm(story?.summary_fa),body=norm(story?.what_happened_fa).slice(0,1300);
  const scored=catalog.authors.map(a=>{
    let total=0,terms=0;
    for(const word of a.keywords||[]){
      const w=norm(word).trim();if(w.length<4)continue;
      if(head.includes(w)){total+=5;terms++;}
      else if(summary.includes(w)){total+=2;terms++;}
      else if(body.includes(w)){total++;terms++;}
    }
    return {id:a.id,total,terms};
  }).filter(a=>a.total>0).sort((a,b)=>b.total-a.total||b.terms-a.terms||a.id.localeCompare(b.id));
  if(!scored.length)return "desk";
  if(scored.length>1&&scored[0].total===scored[1].total&&scored[0].terms===scored[1].terms)return "desk";
  return scored[0].id;
}
function pendarAuthorName(id){
  const catalog=window.PENDAR_EDITORIAL_AUTHORS;
  const a=catalog?.authors?.find(x=>x.id===id);
  return a?.display_name_fa || catalog?.fallback?.display_name_fa || "تحریریه پندار";
}
function pendarAuthorByline(story,report){
  const id=report?.author_id||story?.editorial_author_id||(report?.status==="pilot_draft"?"diplomacy":pendarEditorialAuthorId(story));
  const name=pendarAuthorName(id);
  const href="/editorial-author/"+encodeURIComponent(id)+"/";
  return '<div class="story-author-byline"><span class="story-author-monogram" aria-hidden="true">پ</span>'
    +'<span class="story-author-credit"><a href="'+esc(href)+'">'+esc(name)+'</a>'
    +'<small>دبیر مجازی تحریریه · تهیه‌شده با هوش مصنوعی</small></span></div>';
}
async function showPendarEditorialAuthor(slug){
  show("editorialauthor");setTab("");setHash("#/editorial-author/"+slug);
  const target=document.getElementById("editorial-author-view");
  target.innerHTML='<div class="spinner"></div>';
  try{
    const catalog=await loadPendarEditorialAuthors();
    const desk=catalog.authors.find(x=>x.id===slug) || (slug==="desk"?catalog.fallback:null);
    if(!desk){
      target.innerHTML='<div class="state">این پروفایل در تحریریه پندار وجود ندارد.</div>';
      return;
    }
    const [current,sourceIndex]=await Promise.all([
      getJSON(DATA+"/stories.json").catch(()=>[]),
      getJSON(DATA+"/press-source-stories.json").catch(()=>({}))
    ]);
    const unique=new Map();
    for(const card of Array.isArray(current)?current:[]){
      if(card?.has_editorial_report && pendarEditorialAuthorId(card)===slug)unique.set(card.id,card);
    }
    for(const group of Object.values(sourceIndex||{})){
      if(!Array.isArray(group))continue;
      for(const row of group){
        if(row?.has_editorial_report && pendarEditorialAuthorId(row)===slug && !unique.has(row.id))unique.set(row.id,row);
      }
    }
    const reports=[...unique.values()].sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
    const listings=reports.map(s=>'<a class="editorial-author-item" href="/story/'+esc(s.id)+'/"><strong>'+esc(s.editorial_report_title_fa||s.headline_fa||"خبر پندار")+'</strong><small>'+esc(String(s.published_at||"").slice(0,10))+' · گزارش پندار</small></a>').join("");
    const avatar=desk.portrait_url?'<img src="'+esc(desk.portrait_url)+'" alt="" loading="lazy">':'<span class="editorial-author-placeholder" aria-hidden="true">پ</span>';
    target.innerHTML='<nav class="editorial-author-back"><a href="/headlines/">← بازگشت به سرخط</a></nav>'
      +'<div class="editorial-author-header"><div class="editorial-author-avatar">'+avatar+'</div>'
      +'<div><p class="editorial-author-eyebrow">تحریریهٔ پندار · دبیر مجازی</p>'
      +'<h1>'+esc(desk.display_name_fa)+'</h1>'
      +'<p>'+esc(desk.bio_fa||"")+'</p>'
      +'<p class="editorial-author-disclosure">'+esc(catalog.disclosure_fa||"هویت تحریریه‌ای مبتنی بر هوش مصنوعی")+'</p></div></div>'
      +'<section class="editorial-author-publications"><h2>گزارش‌های تنظیم‌شده</h2>'
      +(listings||'<p class="muted">گزارش واجد شرایط انتشار برای این دبیر هنوز ثبت نشده است.</p>')
      +'</section>';
    document.title=desk.display_name_fa+" | تحریریه پندار";
  }catch(_){
    target.innerHTML='<div class="state">فهرست دبیران در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.</div>';
  }
}
