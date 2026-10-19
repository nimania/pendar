function movieMentionHasEvidence(movie,mention){
 const norm=v=>String(v||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").toLowerCase().replace(/[^0-9a-z\u0600-\u06ff]+/g," ").trim().replace(/\s+/g," ");
 const text=norm([mention.headline_fa,mention.topic_fa,mention.summary_fa].filter(Boolean).join(" "));
 return (movie.aliases||[movie.title_fa,movie.original_title]).filter(Boolean).some(alias=>{
   const title=norm(alias);if(title.length<3)return false;
   const escaped=title.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
   if(title.split(" ").length>2)return (" "+text+" ").includes(" "+title+" ");
   return new RegExp("(?:^| )(?:فیلم(?: سینمایی)?|سریال|مستند|انیمیشن|movie|film|series|documentary) (?:به نام |با عنوان |با نام )?"+escaped+"(?: |$)").test(text)||new RegExp("(?:^| )"+escaped+" (?:فیلم|سریال|مستند|movie|film|series)(?: |$)").test(text);
 });
}
/* Pendar — figure directory render + profile/statement openers. Extracted
   from app.js (completes the figures split begun in figures-core.js): the
   figures directory grid (renderFigures), profile openers
   (openFigure/openNewsPerson/openFigureByName), profile tab filter
   (_figureProfileFilter, setFigureProfileFilter), figure profile search,
   the YouTube/Telegram embeds, and the statement page (openStatement).
   Loaded as a classic script BEFORE app.js because route() reaches
   openFigure/openStatement/openNewsPerson on deep links. Uses app.js and
   other modules' helpers (groupedFeed, postRow, _bookCard, _movieCard,
   avatar, canonicalStrip, figureCard) at runtime. No behavior change. */

let _personDirectoryQuery="",_personDirectoryVisible=100;
function showPersonDirectory(){show("figures");setTab("");document.getElementById("figures-view").classList.remove("figure-profile-mode");document.getElementById("figures-view").classList.add("figure-directory-mode");document.getElementById("figures-lede").style.display="";document.getElementById("figure-timeline").innerHTML="";_personDirectoryQuery="";_personDirectoryVisible=100;renderFigures();setHash("#/figures/directory")}
async function renderFigures(query=_personDirectoryQuery,reset=false) {
  _personDirectoryQuery=query;if(reset)_personDirectoryVisible=100;
  document.getElementById("figures-lede").style.display="";
  const el=document.getElementById("figures");el.innerHTML='<div class="spinner"></div>';
  const all=await loadPersonDirectory();if(query!==_personDirectoryQuery)return;
  const q=_canonicalNorm(query),people=all.filter(x=>!q||_canonicalNorm([x.name_fa,x.handle,x.role_fa,...(x.aliases||[])].join(" ")).includes(q)).sort((a,b)=>(b.count||0)-(a.count||0)||String(a.name_fa||"").localeCompare(String(b.name_fa||""),"fa"));
  el.innerHTML='<p class="muted">'+faN(all.length)+' چهره در پندار؛ گفته‌ها، خبرها و آثار هر شخص در یک پروفایل.</p><input id="person-directory-query" type="search" placeholder="جستجوی نام یا حرفه…" value="'+esc(query)+'" onchange="renderFigures(this.value,true)"><div class="fig-grid">'+people.slice(0,_personDirectoryVisible).map(x=>'<button class="fig-person" onclick="'+(x.canonical_id?'openCanonicalEntity(\''+esc(x.canonical_id)+'\')':'openFigure(\''+esc(x.handle)+'\')')+'">'+avatar(x,"md")+'<span class="fp-body"><span class="fp-name">'+esc(x.name_fa)+'</span><span class="fp-role">'+esc(x.role_fa||"")+'</span><span class="fp-count">'+faN(x.count||(x.posts||[]).length)+' گفته</span></span></button>').join("")+'</div>'+(people.length>_personDirectoryVisible?'<button class="movie-load-more" onclick="_personDirectoryVisible+=100;renderFigures()">نمایش بیشتر · '+faN(Math.min(_personDirectoryVisible,people.length))+' از '+faN(people.length)+'</button>':people.length?'':'<div class="state">چهره‌ای پیدا نشد.</div>');
}
async function openNewsPerson(handle) { return openFigure(handle); }
async function openFigureByName(name) {
  const people = await loadPersonDirectory();
  const norm = s => String(s || "").replace(/‌/g, " ").replace(/\s+/g, " ").trim();
  const x = people.find(f => norm(f.name_fa) === norm(name));
  if (x) return x.canonical_id?openCanonicalEntity(x.canonical_id):openFigure(x.handle);
}
async function searchFigureProfiles(query) {
  const box=document.getElementById("figure-profile-search-results");
  if(!box) return;
  const q=_canonicalNorm(query||"");
  if(!q){box.innerHTML="";box.style.display="none";return}
  const people=await loadPersonDirectory();
  if(_canonicalNorm(document.querySelector(".figure-profile-search input")?.value||"")!==q)return;
  const rows=people.filter(f=>{
    const hay=[f.name_fa,f.handle,f.role_fa,f.field_fa,...(f.aliases||[])].map(_canonicalNorm).join(" ");
    return hay.includes(q);
  }).slice(0,8);
  box.style.display="block";
  box.innerHTML=rows.length?rows.map(f=>`<button class="figure-search-hit" onclick="openFigure('${String(f.handle||"").replace(/'/g,"\\'")}')">${avatar(f,"sm")}<span><b>${esc(f.name_fa||"")}${f.verified?'<em class="profile-verified" title="هویت تأییدشده">✓</em>':""}</b><small>${esc(f.role_fa||f.field_fa||"")}</small></span></button>`).join(""):'<div class="figure-search-empty">چهره‌ای پیدا نشد.</div>';
}
let _figureProfileFilter = "all";
function setFigureProfileFilter(handle, mode) {
  _figureProfileFilter = ["videos","books"].includes(mode) ? "works" : mode;
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
  document.getElementById("figures-view").classList.add("figure-profile-mode");
  document.getElementById("figures-view").classList.remove("figure-directory-mode");
  document.getElementById("figures-lede").style.display = "none";
  document.getElementById("figure-timeline").innerHTML = "";
  const el = document.getElementById("figures");
  if (!post) { el.innerHTML = '<div class="state"><div class="big">این گفته پیدا نشد</div></div>'; return; }
  const statementBooks=(statementBookData.books||[]).filter(b=>(b.mentions||[]).some(m=>String(m.post_id||"")===String(raw)));
  const statementBooksSection=statementBooks.length?'<div class="rule"><span>کتاب‌های مرتبط با این گفته</span><span class="l"></span></div><div class="press-book-links">'+statementBooks.map(b=>'<button onclick="openBook(\''+esc(b.slug)+'\')"><span>کتاب</span><b>'+esc(b.title_fa||"")+'</b></button>').join("")+'</div>':"";
  const statementMovies=(statementMovieData.movies||[]).filter(m=>(m.mentions||[]).some(mm=>String(mm.post_id||"")===String(raw)&&movieMentionHasEvidence(m,mm)));
  const statementMoviesSection=statementMovies.length?'<div class="rule"><span>فیلم‌ها و سریال‌های مرتبط با این گفته</span><span class="l"></span></div><div class="press-book-links">'+statementMovies.map(m=>'<button onclick="openMovie(\''+esc(m.slug)+'\')"><span>فیلم</span><b>'+esc(m.title_fa||m.original_title||"")+'</b></button>').join("")+'</div>':"";
  setHash("#/statement/" + encodeURIComponent(raw));
  const isYoutube = post.platform === "youtube";
  const recapText = String(post.recap_fa || "").trim();
  const recapHtml = recapText
    ? '<section class="video-statement-recap"><div class="rule"><span>≣ جان کلام</span><span class="l"></span></div>' +
      recapText.split(/\n{2,}/).map(p=>'<p>'+esc(p)+'</p>').join('') + '</section>'
    : '';
  const videoEmbedHtml = isYoutube
    ? youtubeRecapEmbed(post.url || String(post.id||"").replace(/^youtube-/,""), post.video_title || post.topic_fa || "ویدئوی اصلی")
    : "";
  const pointRows = Array.isArray(post.key_points_fa) ? post.key_points_fa.filter(Boolean) : [];
  const pointsHtml = pointRows.length
    ? '<section class="video-statement-points"><h3>نکات اصلی</h3><ul>' + pointRows.map(x=>'<li>'+esc(x)+'</li>').join('') + '</ul></section>'
    : '';
  const relatedStatements=(person.posts||[]).filter(p=>String(p.id)!==raw)
    .sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")))
    .slice(0,5);
  const otherStatements=relatedStatements.map(p=>'<a class="statement-side-link" href="/statement/'+encodeURIComponent(statementKey(p))+'/"><b>'+esc(p.topic_fa||p.headline_fa||p.title_fa||String(p.text_fa||p.text||"گفتهٔ دیگر").slice(0,92))+'</b><small>'+esc(relTime(p.published_at))+'</small></a>').join("");
  el.innerHTML = '<div class="statement-layout">' +
    '<div class="statement-main">' +
      '<button class="back" onclick="' + (isNews ? "openNewsPerson" : "openFigure") + "('" + esc(person.handle) + "')\">بازگشت به پروفایل</button>" +
      '<div class="fig-head">' + figureProfileLink(person,avatar(person,"lg")) + '<div class="fig-head-body"><h1>' + figureProfileLink(person,esc(person.name_fa)) + '</h1><p class="muted">' + esc(person.role_fa||"") + '</p></div></div>' +
      '<div class="rule"><span>' + (isYoutube ? "جان کلام" : (isNews ? "گفته در خبر" : "دیدگاه")) + '</span><span class="l"></span></div>' +
      figureCard(post,false,true) + telegramEmbed(post) + videoEmbedHtml + pointsHtml + recapHtml +
      statementBooksSection + statementMoviesSection +
      '<p class="muted fig-note">این صفحه نشانی مستقل دارد و می‌توان مستقیماً به همین گفته ارجاع داد.</p>' +
    '</div>' +
    '<aside class="statement-side" aria-label="گفته‌ها و مطالب مکمل">' +
      '<section class="statement-side-panel"><h2>از همین چهره</h2><a class="statement-person-link" href="/@'+encodeURIComponent(person.handle)+'/">'+esc(person.name_fa)+' ← مشاهدهٔ پروفایل</a>'+otherStatements+'</section>' +
      ((post.related_people||[]).length?'<section class="statement-side-panel"><h2>چهره‌های مرتبط</h2>'+post.related_people.slice(0,6).map(r=>'<a class="statement-side-link" href="/@'+encodeURIComponent(r.handle)+'/"><b>'+esc(r.name_fa)+'</b><small>'+(r.relation==="response"?"پاسخ یا واکنش":"نام‌برده در گفته")+'</small></a>').join("")+'</section>':"")+
      '<section class="statement-side-panel"><h2>مطالب و زمینهٔ مرتبط</h2><div id="statement-discovery"></div></section>' +
      '<section class="statement-side-panel statement-side-ad"><h2>تبلیغات</h2>'+articleDisplayAdMarkup()+'</section>' +
    '</aside></div>';
  loadArticleDisplayAd();
  renderContentDiscovery(document.getElementById("statement-discovery"),post,person);
}
function telegramEmbed(post) {
  if (!post || !post.telegram_media || !String(post.url || "").startsWith("https://t.me/")) return "";
  const m = String(post.url).match(/^https:\/\/t\.me\/([^/?#]+)\/(\d+)/);
  if (!m) return "";
  const src = `https://t.me/${encodeURIComponent(m[1])}/${m[2]}?embed=1&mode=tme`;
  return `<div class="telegram-embed telegram-embed-${esc(post.telegram_media)}"><iframe src="${src}" loading="lazy" frameborder="0" scrolling="no" allow="autoplay; encrypted-media; picture-in-picture" title="رسانهٔ پست تلگرام"></iframe></div>`;
}

function _figureWorkUrl(value) {
  try { const url=new URL(String(value||"")); return ["http:","https:"].includes(url.protocol)?url.href:""; } catch (_) { return ""; }
}
function _figureWorkKey(work, kind) {
  if(work.internal_target)return "pendar:"+work.internal_target.kind+":"+work.internal_target.id;
  if(work.tmdb_id&&["movie","tv"].includes(kind))return "tmdb:"+kind+":"+work.tmdb_id;
  const id=kind==="video"?youtubeVideoId(work.url):"";
  if(id) return "youtube:"+id;
  const url=_figureWorkUrl(work.url);
  if(url){const parsed=new URL(url);for(const key of [...parsed.searchParams.keys()])if(key.startsWith("utm_"))parsed.searchParams.delete(key);return parsed.href;}
  return String(work.id||work.title_fa||work.title||"");
}
function _figureMediaWorks(person, canonical) {
  const array=value=>Array.isArray(value)?value:[];
  const meta=canonical?.meta||{};
  const groups={videos:new Map(),podcasts:new Map(),other:new Map(),channels:new Map(),books:new Map(),films:new Map()};
  const add=(group,work,kind)=>{
    if(!work||typeof work!=="object")return;
    const row={...work,url:_figureWorkUrl(work.url),kind};
    if(!row.url&&!row.title_fa&&!row.title)return;
    const key=_figureWorkKey(row,kind);if(!key)return;
    const old=groups[group].get(key);
    groups[group].set(key,{...row,...old,recap_fa:old?.recap_fa||row.recap_fa,statement_id:old?.statement_id||row.statement_id,thumbnail:old?.thumbnail||row.thumbnail});
  };
  for(const v of [...array(person.youtube_videos),...array(meta.youtube_videos),...array(person.videos),...array(meta.videos)])add("videos",v,"video");
  for(const p of array(person.posts)){
    if(p.kind==="news_statement"||p.platform!=="youtube")continue;
    add("videos",{id:String(p.id||"").replace(/^youtube-/,""),url:p.url,title:p.video_title||p.topic_fa||"ویدئو",thumbnail:p.media_url,published_at:p.published_at,recap_fa:p.recap_fa,statement_id:p.id,source_type:p.source_type},"video");
  }
  for(const p of [...array(person.podcasts),...array(meta.podcasts)])add("podcasts",p,"podcast");
  for(const work of [...array(person.works),...array(meta.works)]){
    const kind=String(work.kind||work.type||"other").toLowerCase();
    add(["video","youtube"].includes(kind)?"videos":["podcast","episode"].includes(kind)?"podcasts":kind==="book"?"books":["movie","film","tv","series"].includes(kind)?"films":"other",work,kind);
  }
  for(const link of array(person.social)){
    if(link.kind==="podcast")add("podcasts",{...link,title:link.label||"پادکست",format:"channel"},"podcast");
    if(link.kind==="youtube")add("channels",{...link,title:"کانال ویدئوهای "+person.name_fa},"channel");
  }
  const values=map=>[...map.values()].sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  return {videos:values(groups.videos),podcasts:values(groups.podcasts),other:values(groups.other),channels:values(groups.channels),books:values(groups.books),films:values(groups.films)};
}
function _figureWorkCard(work) {
  const labels={podcast:"پادکست",episode:"قسمت پادکست",channel:"کانال ویدئو",audio:"صوت",music:"موسیقی",article:"مقاله",poem:"شعر",book:"کتاب",movie:"فیلم",tv:"سریال",project:"پروژه"};
  const thumb=_figureWorkUrl(work.thumbnail);
  const body=(thumb?'<img class="figure-work-cover" src="'+esc(thumb)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':"")+'<span class="figure-work-type">'+esc(work.type_fa||labels[work.kind]||"اثر")+'</span><b>'+esc(work.title_fa||work.title||work.label||"اثر")+'</b>'+((work.role_fa||work.year)?'<small>'+esc([work.role_fa,work.year].filter(Boolean).join(" · "))+'</small>':"")+(work.description_fa?'<p>'+esc(work.description_fa)+'</p>':"")+(work.published_at?'<small>'+esc(relTime(work.published_at))+'</small>':"");
  const target=work.internal_target;
  const internal=target&&['book','movie'].includes(target.kind)&&target.id;
  const href=internal?'#/'+(target.kind==='book'?'book/':'master-movie/')+encodeURIComponent(target.id):work.url;
  return '<article class="figure-work-card">'+(href?'<a href="'+esc(href)+'"'+(internal?'':' target="_blank" rel="noopener"')+'>'+body+'<span class="figure-work-open">'+(internal?'مشاهده در پندار':'مشاهدهٔ اثر ↗')+'</span></a>':body)+'</article>';
}
function _figureVideoCard(video) {
  if(!video.url)return _figureWorkCard({...video,type_fa:"ویدئو"});
  const statement=video.statement_id||(video.recap_fa&&video.id?"youtube-"+String(video.id).replace(/^youtube-/,""):"");
  return '<article class="figure-youtube-card"><a href="'+esc(video.url)+'" target="_blank" rel="noopener"><span class="figure-youtube-thumb">'+(video.thumbnail?'<img src="'+esc(_figureWorkUrl(video.thumbnail))+'" alt="" loading="lazy">':"")+'<span class="figure-youtube-play">▶</span></span><span class="figure-youtube-body"><b>'+esc(video.title_fa||video.title||"ویدئو")+'</b><small>'+esc(video.source_type==="hosted"?"گفت‌وگو / حضور ویدئویی":"ویدئو")+(video.published_at?" · "+esc(relTime(video.published_at)):"")+'</small></span></a>'+(video.recap_fa&&statement?'<button class="video-recap-btn" onclick="openStatement(\''+statementKey({id:statement})+'\')">جان کلام</button>':"")+'</article>';
}

async function openFigure(handle, resetFilter = true, canonicalId = null) {
  const canonicalFigure=canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByRef("figures",handle);
  canonicalId=canonicalFigure?.id||canonicalId;
  if (resetFilter) _figureProfileFilter = "all";
  setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/figure/" + handle);
  show("figures"); setTab("");
  document.getElementById("figures-view").classList.add("figure-profile-mode");
  document.getElementById("figures-view").classList.remove("figure-directory-mode");
  document.getElementById("figures-lede").style.display = "none";
  document.getElementById("figure-timeline").innerHTML = "";
  const el = document.getElementById("figures");
  const existingProfile=!resetFilter && el.querySelector(".x-profile[data-profile-handle]");
  const switchingTab=!!existingProfile && existingProfile.dataset.profileHandle===String(handle);
  if(!switchingTab)el.innerHTML = `<div class="spinner"></div>`;
  const [d, curatedPoems, bookData, movieData] = await Promise.all([loadFigures(), loadCuratedPoems(), loadBooks(), loadMovies()]);
  const base = (d.figures || []).find(f => f.handle.toLowerCase() === String(handle).toLowerCase()||(canonicalFigure?.refs||[]).some(r=>r.dataset==="figures"&&String(r.key)===String(f.handle)));
  const x=canonicalFigure?_personFigureRecord(canonicalFigure,base):base;
  if (!x) { el.innerHTML = `<div class="state"><div class="big">این چهره پیدا نشد</div></div>`; return; }
  let israelSection="";
  if(x.israel_radar||(typeof ISR!=="undefined"&&ISR?.people?.some(p=>p.handle===x.handle))){try{await loadISRadar();await loadISRNews();israelSection=isrProfileSection(x.handle);}catch(_){}}
  const direct = (x.posts || []).filter(p => p.kind !== "news_statement");
  const news = (x.posts || []).filter(p => p.kind === "news_statement");
  const nameNorm=s=>String(s||"").replace(/ي/g,"ی").replace(/ى/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim();
  const personNames=new Set([x.name_fa,...(canonicalFigure?.aliases||[])].map(nameNorm));
  const bookPeople=(bookData.people||[]).filter(p=>personNames.has(nameNorm(p.name_fa))||(canonicalFigure?.refs||[]).some(r=>r.dataset==="books.people"&&String(r.key)===String(p.slug)));
  const figureBooks=[...new Set(bookPeople.flatMap(p=>p.book_slugs||[]))].map(s=>_bookBySlug(bookData,s)).filter(Boolean);
  const master=canonicalFigure?.meta?.tmdb_id?await loadMovieMaster():{items:[]};
  const filmography=canonicalFigure?.meta?.filmography||{};
  const mediaWorks=(master.items||[]).filter(m=>Object.prototype.hasOwnProperty.call(filmography,m.pendar_id)).map(_masterMovie);
  const figureMovies=(movieData.movies||[]).filter(m=>(m.mentions||[]).some(mm=>movieMentionHasEvidence(m,mm)&&mm.kind==="figure"&&(String(mm.handle||"").toLowerCase()===String(x.handle||"").toLowerCase()||(x.posts||[]).some(p=>String(p.id)===String(mm.post_id)))));
  const profileMedia=_figureMediaWorks(x,canonicalFigure);
  const localFilmIds=new Set(mediaWorks.map(m=>m.master_id));
  profileMedia.films=profileMedia.films.filter(w=>!w.internal_target||!localFilmIds.has(w.internal_target.id));
  const localBookIds=new Set(figureBooks.map(b=>b.slug));
  profileMedia.books=profileMedia.books.filter(w=>!w.internal_target||!localBookIds.has(w.internal_target.id));
  const youtubeVideos=profileMedia.videos;
  const canonicalNames=new Set([x.name_fa,...(canonicalFigure?.aliases||[])].map(_canonicalNorm).filter(Boolean));
  const figureStories=(typeof ALL!=="undefined"?ALL:[]).filter(s=>(s.entities||[]).some(e=>canonicalNames.has(_canonicalNorm(e.name_fa||e.name||""))));
  let shown = _figureProfileFilter === "direct" ? direct : _figureProfileFilter === "news" ? news : (_figureProfileFilter === "works" || _figureProfileFilter === "books" || _figureProfileFilter === "movies" || _figureProfileFilter === "stories" || _figureProfileFilter === "videos" || _figureProfileFilter === "about") ? [] : (x.posts || []);
  const latest = (x.posts || []).map(p => p.published_at).filter(Boolean).sort().pop();
  const poems = Array.isArray(curatedPoems[x.handle]) ? curatedPoems[x.handle] : [];
  const poemSection = poems.length ? `<section class="curated-poems"><div class="curated-poems-head"><div><span class="curated-kicker">اثر ویژه</span><h2>یک شعر؛ بخش‌های منتشرشده</h2><p>این ${faN(poems.length)} متن، بخش‌های مختلف یک شعر از مونا برزویی‌اند. ترتیب نهایی بخش‌ها هنوز اعلام نشده است؛ شماره‌های زیر فقط برای تفکیک در آرشیو جان کلام‌اند و ترتیب شعر را نشان نمی‌دهند.</p></div><span class="curated-count">${faN(poems.length)} بخش</span></div><div class="curated-poem-list">${poems.map((p,i)=>`<article class="curated-poem"><div class="curated-poem-no" title="شمارهٔ آرشیوی؛ نه ترتیب شعر">بخش ${faN(i+1)}*</div><div class="curated-poem-text">${esc(p.text||"").replace(/\\n/g,"<br>")}</div></article>`).join("")}</div></section>` : "";
  const hasWorks=figureBooks.length||profileMedia.books.length||mediaWorks.length||profileMedia.films.length||poems.length||youtubeVideos.length||profileMedia.podcasts.length||profileMedia.other.length||profileMedia.channels.length;
  const worksSection=figureBooks.length||profileMedia.books.length||mediaWorks.length||profileMedia.films.length||poems.length||youtubeVideos.length||profileMedia.podcasts.length||profileMedia.other.length||profileMedia.channels.length?`<section class="figure-works">${figureBooks.length||profileMedia.books.length?'<h2>کتاب‌ها</h2><div class="books-grid">'+figureBooks.map(_bookCard).join("")+'</div><div class="figure-work-grid">'+profileMedia.books.map(_figureWorkCard).join("")+'</div>':""}${mediaWorks.length||profileMedia.films.length?'<h2>فیلم‌ها و سریال‌ها</h2><div class="movie-grid">'+mediaWorks.map(_movieCard).join("")+'</div><div class="figure-work-grid">'+profileMedia.films.map(_figureWorkCard).join("")+'</div>':""}${profileMedia.podcasts.length?'<h2>پادکست‌ها</h2><div class="figure-work-grid">'+profileMedia.podcasts.map(_figureWorkCard).join("")+'</div>':""}${youtubeVideos.length||profileMedia.channels.length?'<h2>ویدئوها</h2><div class="figure-youtube-grid">'+youtubeVideos.map(_figureVideoCard).join("")+'</div><div class="figure-work-grid">'+profileMedia.channels.map(_figureWorkCard).join("")+'</div>':""}${poemSection}${profileMedia.other.length?'<h2>دیگر آثار</h2><div class="figure-work-grid">'+profileMedia.other.map(_figureWorkCard).join("")+'</div>':""}</section>`:'<div class="state"><div class="big">اثری ثبت نشده است.</div></div>';
  let usRadarRecord=null;try{const radar=await getJSON(DATA+"/us-radar.json?v="+Date.now());usRadarRecord=(radar.iran_meter||[]).find(m=>m.handle===x.handle)||null;}catch(_){}
  const usRadarSection=usRadarRecord?'<section class="x-profile-feed"><div class="rule"><span>رادار آمریکا · انتخابات ۲۰۲۶</span><span class="l"></span></div><div class="profile-us-radar"><div><b>'+esc(usRadarRecord.state||x.us_radar?.state||"")+' · سنا ۲۰۲۶</b><span class="usr-party '+esc(String(usRadarRecord.party||x.us_radar?.party||"").toLowerCase())+'">'+esc(usRadarRecord.party||x.us_radar?.party||"")+'</span></div><p>'+esc(usRadarRecord.summary_fa||"")+'</p><dl><dt>جنگ ایران</dt><dd>'+esc(usRadarRecord.war||"نامشخص")+'</dd><dt>اختیارات جنگی</dt><dd>'+esc(usRadarRecord.war_power||"نامشخص")+'</dd><dt>تحریم/دیپلماسی</dt><dd>'+esc(usRadarRecord.sanctions||"نامشخص")+'</dd><dt>اسرائیل</dt><dd>'+esc(usRadarRecord.israel||"نامشخص")+'</dd><dt>نسبت با ترامپ</dt><dd>'+esc(usRadarRecord.trump||"نامشخص")+'</dd></dl><small>منبع: '+esc(usRadarRecord.source||"")+' · اطمینان داده: '+esc(usRadarRecord.confidence||"")+'</small><button class="fig-profile-link" onclick="showUSRadar()">بازگشت به رادار آمریکا</button></div></section>':"";
  let candidateFeed=null;
  try{if(x.us_radar||usRadarRecord||(typeof USR_FALLBACK!=="undefined"?USR_FALLBACK.candidates:[]).some(c=>c.handle===x.handle)){
    const feed=await getJSON(DATA+"/candidate-feeds.json?v="+Date.now());candidateFeed=feed.people?.[x.handle]||null;
  }}catch(_){}
  const candidateNews=candidateFeed?.news||[],candidateOfficial=candidateFeed?.official||[];
  const hasAbout=!!(canonicalFigure?.meta?.biography_fa||canonicalFigure?.meta?.summary||x.role_fa||canonicalFigure?.meta?.birthday||canonicalFigure?.meta?.deathday);
  const hasFeed=(x.posts||[]).length>0||candidateNews.length>0||candidateOfficial.length>0;
  const defaultFilter=hasFeed?"all":figureStories.length?"stories":hasWorks?"works":hasAbout?"about":"all";
  const available={all:hasFeed,direct:direct.length,news:news.length,stories:figureStories.length+candidateNews.length,works:hasWorks,movies:figureMovies.length,usradar:!!usRadarRecord,official:candidateOfficial.length,about:hasAbout};
  if(!available[_figureProfileFilter]){_figureProfileFilter=defaultFilter;shown=defaultFilter==="all"?(x.posts||[]):[];}
  const feedCards=rows=>rows.map(r=>`<article class="candidate-feed-card"><small>${esc(r.source||"")} · ${esc(r.published_at?relTime(r.published_at):"")}</small><h3><a href="${esc(_figureWorkUrl(r.url))}" target="_blank" rel="noopener">${esc(r.title_fa||r.title)}</a></h3></article>`).join("");
  const candidateNewsSection=candidateNews.length?'<section class="candidate-news"><h2>تازه‌ترین خبرهای رسانه‌ها</h2>'+feedCards(candidateNews)+'</section>':"";
  const officialSection=candidateOfficial.length?'<section class="candidate-news"><h2>از زبان خودش</h2>'+feedCards(candidateOfficial)+'</section>':"";
  const candidateSources=(candidateFeed?.sources||[]).filter(r=>_figureWorkUrl(r.url));
  const sourceLinks=candidateSources.length?'<div class="candidate-source-links">'+candidateSources.map(r=>'<a href="'+esc(_figureWorkUrl(r.url))+'" target="_blank" rel="noopener">'+esc(r.label)+'</a>').join("")+'</div>':"";
  const aboutSection='<section class="x-profile-feed"><p class="x-bio">'+esc(canonicalFigure?.meta?.biography_fa||canonicalFigure?.meta?.summary||x.role_fa||"معرفی تکمیلی هنوز ثبت نشده است.")+'</p>'+(canonicalFigure?.meta?.birthday?'<p class="x-bio">تولد: '+esc(faN(canonicalFigure.meta.birthday))+'</p>':"")+(canonicalFigure?.meta?.deathday?'<p class="x-bio">درگذشت: '+esc(faN(canonicalFigure.meta.deathday))+'</p>':"")+(canonicalFigure?.meta?.picture_source?'<p class="x-bio"><a href="'+esc(_figureWorkUrl(canonicalFigure.meta.picture_source))+'" target="_blank" rel="noopener">منبع و مجوز عکس ↗</a></p>':"")+'</section>';
  const postRow = p => `<article class="x-post${isEditorialQuote(p) ? " is-quote" : ""}" ${statementCardAttrs(p)}>
    <div class="x-post-rail">${figureProfileLink(x,avatar(x,"sm"))}</div>
    <div class="x-post-body">
      <div class="x-post-meta"><b>${figureProfileLink(x,esc(x.name_fa))}</b><span>·</span><time>${relTime(p.published_at)}</time></div>
      ${p.kind === "news_statement" ? `<div class="x-post-context">گفته در خبر · ${esc(p.source_name || "منبع خبری")}</div>` : (p.topic_fa ? `<div class="x-post-topic">${esc(p.topic_fa)}</div>` : "")}
      ${figureTextParagraphs(p)}${figureSourceNote(p)}
      ${telegramEmbed(p)}
      <div class="x-post-actions">
        <button onclick="openStatement(' ${statementKey(p)}'.trim())" title="صفحهٔ این گفته">◯ <span>صفحهٔ گفته</span></button>
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" title="${sourceLinkLabel(p)}">↗ <span>${sourceLinkLabel(p)}</span></a>` : ""}
      </div>
    </div>
  </article>`;
  // Deterministic, distinct accounts from the existing figure directory;
  // exclude the current profile and accounts without a working profile handle.
  const suggestions=(d.figures||[]).filter(p=>p&&p.handle&&p.handle!==x.handle&&p.name_fa)
    .sort((a,b)=>(b.count||0)-(a.count||0)||String(a.name_fa).localeCompare(String(b.name_fa),"fa"))
    .slice(0,6);
  const suggestionCards=suggestions.map(p=>{
    const followed=isFigureFollowed(p.handle);
    return '<div class="figure-rail-person">'
      +'<a class="figure-rail-person-link" href="/@'+encodeURIComponent(p.handle)+'/" aria-label="مشاهدهٔ '+esc(p.name_fa)+'">'
      +(p.avatar?'<img src="'+esc(p.avatar)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<span class="figure-rail-initial">'+esc(p.name_fa.slice(0,1))+'</span>')
      +'<span><b>'+esc(p.name_fa)+'</b><small>'+esc(p.role_fa||p.field_fa||"مشاهدهٔ پروفایل")+'</small></span></a>'
      +'<button type="button" class="figure-rail-follow'+(followed?' on':'')+'" data-figure-follow="'+esc(p.handle)+'" onclick="toggleFigureRailFollow(this)" aria-pressed="'+followed+'">'+(followed?'✓ دنبال می‌کنم':'+ دنبال کن')+'</button></div>';
  }).join("");
  const nextProfileMarkup = `<div class="x-profile" data-profile-handle="${esc(x.handle)}">
    ${renderPersonProfileHeader(x,{actions:figureFollowBtn(x.handle,false),stats:`<span><b>${faN(direct.length)}</b> دیدگاه مستقیم</span><span><b>${faN(news.length)}</b> گفته در خبر</span>${figureStories.length ? `<span><b>${faN(figureStories.length)}</b> خبر</span>` : ""}${figureBooks.length+profileMedia.books.length ? `<span><b>${faN(figureBooks.length+profileMedia.books.length)}</b> کتاب</span>` : ""}${mediaWorks.length+profileMedia.films.length ? `<span><b>${faN(mediaWorks.length+profileMedia.films.length)}</b> فیلم/سریال</span>` : ""}${profileMedia.podcasts.length ? `<span><b>${faN(profileMedia.podcasts.length)}</b> پادکست</span>` : ""}${youtubeVideos.length ? `<span><b>${faN(youtubeVideos.length)}</b> ویدئو</span>` : ""}${latest ? `<span>آخرین فعالیت ${relTime(latest)}</span>` : ""}`})}
    ${canonicalFigure?canonicalStrip(canonicalFigure):""}
    <div class="figure-profile-columns">
      <div class="figure-profile-primary">
    <nav class="x-profile-tabs" aria-label="بخش‌های پروفایل">
      ${hasFeed?`<button class="${_figureProfileFilter==="all"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','all')">همه</button>`:""}
      ${direct.length?`<button class="${_figureProfileFilter==="direct"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','direct')">دیدگاه‌ها</button>`:""}
      ${news.length?`<button class="${_figureProfileFilter==="news"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','news')">گفته در خبرها</button>`:""}
      ${figureStories.length||candidateNews.length?`<button class="${_figureProfileFilter==="stories"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','stories')">خبرها</button>`:""}
      ${hasWorks?`<button class="${_figureProfileFilter==="works"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','works')">آثار</button>`:""}

      ${figureMovies.length ? `<button class="${_figureProfileFilter==="movies"?"on":""}" onclick="setFigureProfileFilter(\'${esc(x.handle)}\',\'movies\')">اشاره به فیلم‌ها</button>` : ""}
      ${usRadarRecord?`<button class="${_figureProfileFilter==="usradar"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','usradar')">رادار آمریکا</button>`:""}
      ${candidateOfficial.length?`<button class="${_figureProfileFilter==="official"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','official')">از زبان خودش</button>`:""}
    </nav>
    ${_figureProfileFilter==="stories" ? `<section class="figure-stories">${figureStories.length?groupedFeed(figureStories):""}${candidateNewsSection}</section>` : ""}
    ${_figureProfileFilter==="books" ? `<section class="figure-books"><div class="books-grid">${figureBooks.map(_bookCard).join("")}</div></section>` : ""}
    ${_figureProfileFilter==="movies" ? `<section class="figure-movies"><div class="movie-grid">${figureMovies.map(_movieCard).join("")}</div></section>` : ""}
    ${_figureProfileFilter==="works"||(_figureProfileFilter==="all"&&!shown.length&&hasWorks)?worksSection:""}
    ${_figureProfileFilter==="all"?candidateNewsSection+officialSection:""}
    ${_figureProfileFilter==="official"?officialSection:""}
    ${sourceLinks}
    ${candidateFeed?.news_updated_at?'<small class="muted">آخرین بررسی خبرها: '+esc(relTime(candidateFeed.news_updated_at))+'</small>':""}
    ${israelSection}
    ${_figureProfileFilter==="usradar"?usRadarSection:""}\n    <div class="x-profile-feed" ${(_figureProfileFilter==="works"||_figureProfileFilter==="books"||_figureProfileFilter==="movies"||_figureProfileFilter==="stories"||_figureProfileFilter==="videos"||_figureProfileFilter==="usradar"||_figureProfileFilter==="official"||_figureProfileFilter==="about"||(_figureProfileFilter==="all"&&!shown.length)) ? 'style="display:none"' : ""}>${shown.length ? shown.map(postRow).join("") : '<div class="state"><div class="big">در این بخش موردی ثبت نشده.</div></div>'}</div>
    <p class="muted fig-note x-profile-note">دیدگاه‌ها از منابع عمومی خود شخص می‌آیند؛ موارد «در خبرها» گفته‌هایی هستند که رسانه‌ها به او نسبت داده‌اند.</p>
      </div>
      <aside class="figure-profile-side" aria-label="چهره‌های پیشنهادی و تبلیغات">
        <section class="figure-rail-box"><h2>دنبال کن</h2>
          <div class="figure-rail-people">${suggestionCards}</div>
          <a class="figure-rail-more" href="/figures/">همهٔ چهره‌ها ←</a>
        </section>
        <section class="figure-rail-box figure-rail-ad" aria-label="تبلیغات"><h2>تبلیغات</h2>${articleDisplayAdMarkup()}</section>
      </aside>
    </div>
  </div>`;
  if(switchingTab){
    const temporary=document.createElement("div");
    temporary.innerHTML=nextProfileMarkup;
    const nextPrimary=temporary.querySelector(".figure-profile-primary");
    const currentPrimary=existingProfile.querySelector(".figure-profile-primary");
    if(nextPrimary && currentPrimary){
      currentPrimary.replaceChildren(...Array.from(nextPrimary.childNodes));
    }else{
      el.innerHTML=nextProfileMarkup;
      loadArticleDisplayAd();
    }
  }else{
    el.innerHTML=nextProfileMarkup;
    loadArticleDisplayAd();
  }
}

/* Figures directory: the directory mode state (_figDirectoryMode), its
   setter (setFigureDirectoryMode), the directory page (showFigures) and the
   directory render (renderFiguresDirectory). Moved here from app.js to keep
   the figures views together; showFigures resets the figures-core timeline
   filters and is reached by route() for #/figures. */
let _figDirectoryMode = "direct";
function setFigureDirectoryMode(mode) {
  _figDirectoryMode = mode;
  renderFigures();
}
function showFigures() {
  show("figures"); setTab("");
  document.getElementById("figures-view").classList.remove("figure-profile-mode","figure-directory-mode");
  document.getElementById("figures-lede").style.display="";
  document.title="چهره‌ها | پندار";
  document.getElementById("figures-lede").style.display = "";
  document.getElementById("figures").innerHTML = "";
  // A previous visit can leave timeline filters in local page state.  The
  // /figures route itself must always open on a useful default instead of an
  // apparently broken empty filtered view.
  _figTimelineMode = "all";
  _figTimelineField = "all";
  document.getElementById("figures").innerHTML='<a class="back" href="#/figures/directory">فهرست و جستجوی همهٔ چهره‌ها</a>';
  renderFigureTimeline();
  setHash("#/figures");
}
function renderFiguresDirectory() {
  document.getElementById("figure-timeline").innerHTML = "";
  showPersonDirectory();
}

function renderPersonProfileHeader(x,options={}){
  const name=x.name_fa||x.name||"";
  return `<div class="figure-profile-search"><button class="x-back figure-profile-back" onclick="showFigures()" aria-label="بازگشت به چهره‌ها" title="بازگشت به چهره‌ها">←</button><div class="figure-profile-search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="جستجو میان چهره‌ها…" autocomplete="off" oninput="searchFigureProfiles(this.value)" onfocus="if(this.value)searchFigureProfiles(this.value)"></div><div id="figure-profile-search-results" class="figure-profile-search-results"></div></div>
    <div class="x-cover" style="position:relative;overflow:hidden">
      <div style="position:absolute;top:clamp(14px,3vw,30px);right:clamp(14px,3vw,30px);left:14px;z-index:1;pointer-events:none;text-align:right;text-shadow:0 1px 5px #0007">
        <strong style="display:block;color:#fff;font-size:clamp(19px,3vw,30px);line-height:1.4">${esc(name)}</strong>
        ${x.role_fa?`<span style="display:block;margin-top:5px;color:#fffe;font-size:clamp(12px,1.5vw,16px);line-height:1.5;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.role_fa)}</span>`:""}
      </div>
    </div><div class="x-profile-main"><div class="x-avatar-wrap">${options.avatar||avatar(x,"lg")}</div><div class="x-profile-actions">${options.actions||""}</div>
    <h1>${esc(name)}${x.verified?'<span class="profile-verified" title="هویت تأییدشده">✓</span>':""}</h1>
    ${x.claimed?'<div class="profile-claimed">این پروفایل توسط خود فرد تأیید و مدیریت می‌شود.</div>':""}
    ${(x.profile_handle===undefined?x.handle:x.profile_handle)?'<div class="x-handle">@'+esc(x.profile_handle===undefined?x.handle:x.profile_handle)+'</div>':x.name&&x.name!==name?'<div class="x-handle" dir="ltr">'+esc(x.name)+'</div>':""}
    <p class="x-bio">${esc(x.role_fa||"")}</p>${socialLinks(x.social||[])}
    <div class="x-profile-stats">${options.stats||""}</div>${options.details||""}</div>`;
}

/* Sidebar follow actions must not navigate to the recommended profile.
   Share the same persisted follow set as the ordinary profile control. */
function toggleFigureRailFollow(button){
  const handle=button?.dataset?.figureFollow;
  if(!handle)return;
  const key=String(handle).toLowerCase(), follows=figureFollows();
  if(follows.has(key))follows.delete(key);else follows.add(key);
  localStorage.setItem(FIG_FOLLOW_KEY,JSON.stringify([...follows]));
  document.querySelectorAll('[data-figure-follow]').forEach(el=>{
    if(String(el.dataset.figureFollow).toLowerCase()!==key)return;
    const on=follows.has(key);
    el.classList.toggle('on',on);
    el.setAttribute('aria-pressed',String(on));
    el.textContent=on?'✓ دنبال می‌کنم':'+ دنبال کن';
  });
}
