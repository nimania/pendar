/* Pendar newsroom: approved pen names, portraits pending; AI disclosure in profiles. */
let _pendarAuthorPromise=null;
async function loadPendarEditorialAuthors(){
  if(window.PENDAR_EDITORIAL_AUTHORS)return window.PENDAR_EDITORIAL_AUTHORS;
  if(!_pendarAuthorPromise){
    _pendarAuthorPromise=getJSON(DATA+"/pendar-editorial-authors.json?v=20261018-sprite-1").then(data=>{
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
/* One optimized image file holds the seven user-approved portrait crops. */
function pendarAuthorPortraitCSS(id){
  const a=window.PENDAR_EDITORIAL_AUTHORS?.authors?.find(person=>person.id===id);
  if(!a||a.portrait_status!=="installed"||!Number.isInteger(a.portrait_index)||a.portrait_index<0||a.portrait_index>6)return "";
  const position=(a.portrait_index*100/6).toFixed(4);
  return "background-image:url('/assets/editorial/pendar-authors-sprite.avif');background-size:700% 100%;background-position:"+position+"% center;background-repeat:no-repeat;";
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
  const avatarStyle=pendarAuthorPortraitCSS(id);
  const avatar='<span class="story-author-monogram" aria-hidden="true"'+(avatarStyle?' style="'+avatarStyle+'"':"")+'>'+(avatarStyle?"":"پ")+'</span>';
  return '<div class="story-author-byline">'+avatar
    +'<span class="story-author-credit"><a href="'+esc(href)+'">'+esc(name)+'</a>'
    +'<small>گزارش پندار · تحریریهٔ پندار</small></span></div>';
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
    const [index,current,sourceIndex]=await Promise.all([
      getJSON(DATA+"/editorial-archive.json").catch(()=>null),
      getJSON(DATA+"/stories.json").catch(()=>[]),
      getJSON(DATA+"/press-source-stories.json").catch(()=>({}))
    ]);
    const unique=new Map();
    if(Array.isArray(index?.reports)){
      for(const row of index.reports){
        if(row?.status==="ai_draft" && row.author_id===slug)unique.set(row.id,row);
      }
    }else{
      for(const card of Array.isArray(current)?current:[]){
        if(card?.has_editorial_report && pendarEditorialAuthorId(card)===slug)unique.set(card.id,card);
      }
      for(const group of Object.values(sourceIndex||{})){
        if(!Array.isArray(group))continue;
        for(const row of group){
          if(row?.has_editorial_report && pendarEditorialAuthorId(row)===slug && !unique.has(row.id))unique.set(row.id,row);
        }
      }
    }
    const reports=[...unique.values()].sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
    const listings=reports.map(s=>'<a class="editorial-author-item" href="/story/'+esc(s.id)+'/"><strong>'+esc(s.title_fa||s.editorial_report_title_fa||s.headline_fa||"خبر پندار")+'</strong><small>'+esc(String(s.published_at||"").slice(0,10))+' · گزارش پندار</small></a>').join("");
    const avatarStyle=pendarAuthorPortraitCSS(desk.id);
    const avatar='<span class="editorial-author-placeholder" aria-hidden="true"'+(avatarStyle?' style="'+avatarStyle+'"':"")+'>'+(avatarStyle?"":"پ")+'</span>';
    target.innerHTML='<nav class="editorial-author-back"><a href="/reports/">← آرشیو گزارش‌های پندار</a></nav>'
      +'<div class="editorial-author-header"><div class="editorial-author-avatar">'+avatar+'</div>'
      +'<div><p class="editorial-author-eyebrow">'+esc(desk.role_fa||"تحریریه پندار")+' · تحریریهٔ پندار</p>'
      +'<h1>'+esc(desk.display_name_fa)+'</h1>'
      +'<p>'+esc(desk.bio_fa||"")+'</p>'
      +'</div></div>'
      +'<section class="editorial-author-publications"><h2>گزارش‌های تنظیم‌شده</h2>'
      +(listings||'<p class="muted">گزارش واجد شرایط انتشار برای این دبیر هنوز ثبت نشده است.</p>')
      +'</section>';
    document.title=desk.display_name_fa+" | تحریریه پندار";
  }catch(_){
    target.innerHTML='<div class="state">فهرست دبیران در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.</div>';
  }
}
