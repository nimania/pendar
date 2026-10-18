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
/* Dedicated high-resolution portraits take precedence over the historic
   seven-person 112px sprite. Keep sprite as a backward-compatible fallback. */
function pendarAuthorPortraitURL(id){
  const person=window.PENDAR_EDITORIAL_AUTHORS?.authors?.find(a=>a.id===id);
  const value=String(person?.portrait_hd_url||"").trim();
  return /^\/assets\/editorial\/[a-z0-9_.-]+\.(?:webp|avif|png|jpg|jpeg)$/i.test(value)?value:"";
}
function pendarAuthorAvatar(id,cls){
  const url=pendarAuthorPortraitURL(id);
  const safeClass=String(cls||"").replace(/[^a-z0-9_-]/gi,"");
  if(url)return '<img class="'+safeClass+'" src="'+esc(url)+'" alt="" loading="lazy" decoding="async">';
  const css=pendarAuthorPortraitCSS(id);
  return '<span class="'+safeClass+'" aria-hidden="true"'+(css?' style="'+css+'"':"")+'>'
    +(css?"":"پ")+'</span>';
}
// Stable, human-readable editorial URLs. Legacy /editorial-author/:id/
// remains available; changing the display URLs does not invalidate backlinks.
const PENDAR_WRITER_SLUGS={
  diplomacy:"arman-shayegan",politics:"bahar-dadfar",
  economy:"saman-farahmand",society:"taraneh-nikroush",
  environment:"mahtab-sarvestani",culture:"mana-radfar",
  technology:"parsa-mehrayin"
};
function pendarWriterURL(id){
  const slug=PENDAR_WRITER_SLUGS[id];
  return slug?"/writers/"+slug+"/":"/editorial-author/"+encodeURIComponent(id||"desk")+"/";
}
function pendarWriterIdFromSlug(slug){
  return Object.keys(PENDAR_WRITER_SLUGS).find(id=>PENDAR_WRITER_SLUGS[id]===slug)||"";
}
function pendarAuthorName(id){
  const catalog=window.PENDAR_EDITORIAL_AUTHORS;
  const a=catalog?.authors?.find(x=>x.id===id);
  return a?.display_name_fa || catalog?.fallback?.display_name_fa || "تحریریه پندار";
}
function pendarAuthorByline(story,report){
  const id=report?.author_id||story?.editorial_author_id||(report?.status==="pilot_draft"?"diplomacy":pendarEditorialAuthorId(story));
  const name=pendarAuthorName(id);
  const href=pendarWriterURL(id);
  const avatar=pendarAuthorAvatar(id,"story-author-monogram");
  return '<div class="story-author-byline"><a class="story-author-avatar-link" href="'+esc(href)+'" aria-label="آرشیو مطالب '+esc(name)+'">'+avatar+'</a>'
    +'<span class="story-author-credit"><a href="'+esc(href)+'">'+esc(name)+'</a>'
    +'<small>'+esc(story?.published_at?new Date(story.published_at).toLocaleDateString("fa-IR"):"")+'</small></span></div>';
}
async function showPendarEditorialAuthor(slug,preservePrettyURL){
  // Resolve the new readable slug back to the same approved internal author ID.
  const authorId=pendarWriterIdFromSlug(slug)||slug;
  show("editorialauthor");setTab("");
  if(!preservePrettyURL)setHash("#/editorial-author/"+authorId);
  slug=authorId;
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
    const images=new Map((Array.isArray(current)?current:[])
      .filter(item=>item?.id&&item?.image_url).map(item=>[item.id,item.image_url]));
    for(const item of reports){
      if(!item.image_url&&images.has(item.id))item.image_url=images.get(item.id);
    }
    const listings=reports.map(s=>pendarMagazineReportCard(s,{showAuthor:false})).join("");
    const avatar=pendarAuthorAvatar(desk.id,"editorial-author-placeholder");
    target.innerHTML=pendarMagazineCollectionFrame(
      '<nav class="editorial-author-back"><a href="/reports/">← آرشیو گزارش‌های پندار</a></nav>'
      +'<header class="editorial-author-header"><div class="editorial-author-avatar">'+avatar+'</div>'
      +'<div><p class="editorial-author-eyebrow">'+esc(desk.role_fa||"تحریریه پندار")+'</p>'
      +'<h1>'+esc(desk.display_name_fa)+'</h1>'
      +'<p>'+esc(desk.bio_fa||"")+'</p>'
      +'<p class="editorial-author-total">'+faN(reports.length)+' گزارش در آرشیو</p>'
      +'</div></header>'
      +'<section class="editorial-author-publications"><div class="magazine-author-section-heading"><h2>گزارش‌های تنظیم‌شده</h2><a href="/reports/">همهٔ گزارش‌ها ←</a></div>'
      +'<div class="editorial-author-cards">'+(listings||'<p class="muted">گزارش واجد شرایط انتشار برای این دبیر هنوز ثبت نشده است.</p>')+'</div>'
      +'</section>'
    );
    document.title=desk.display_name_fa+" | تحریریه پندار";
  }catch(_){
    target.innerHTML='<div class="state">فهرست دبیران در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.</div>';
  }
}
