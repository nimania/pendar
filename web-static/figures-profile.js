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
function showPersonDirectory(){show("figures");setTab("");document.getElementById("figure-timeline").innerHTML="";_personDirectoryQuery="";_personDirectoryVisible=100;renderFigures();setHash("#/figures/directory")}
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

function _figureWorkUrl(value) {
  try { const url=new URL(String(value||"")); return ["http:","https:"].includes(url.protocol)?url.href:""; } catch (_) { return ""; }
}
function _figureWorkKey(work, kind) {
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
    groups[group].set(key,{...row,...old,recap_fa:old?.recap_fa||row.recap_fa,statement_id:old?.statement_id||row.statement_id});
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
  return '<article class="figure-work-card">'+(work.url?'<a href="'+esc(work.url)+'" target="_blank" rel="noopener">'+body+'<span class="figure-work-open">مشاهدهٔ اثر ↗</span></a>':body)+'</article>';
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
  document.getElementById("figures-lede").style.display = "none";
  document.getElementById("figure-timeline").innerHTML = "";
  const el = document.getElementById("figures");
  el.innerHTML = `<div class="spinner"></div>`;
  const [d, curatedPoems, bookData, movieData] = await Promise.all([loadFigures(), loadCuratedPoems(), loadBooks(), loadMovies()]);
  const base = (d.figures || []).find(f => f.handle.toLowerCase() === String(handle).toLowerCase()||(canonicalFigure?.refs||[]).some(r=>r.dataset==="figures"&&String(r.key)===String(f.handle)));
  const x=canonicalFigure?_personFigureRecord(canonicalFigure,base):base;
  if (!x) { el.innerHTML = `<div class="state"><div class="big">این چهره پیدا نشد</div></div>`; return; }
  const direct = (x.posts || []).filter(p => p.kind !== "news_statement");
  const news = (x.posts || []).filter(p => p.kind === "news_statement");
  const nameNorm=s=>String(s||"").replace(/ي/g,"ی").replace(/ى/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim();
  const personNames=new Set([x.name_fa,...(canonicalFigure?.aliases||[])].map(nameNorm));
  const bookPeople=(bookData.people||[]).filter(p=>personNames.has(nameNorm(p.name_fa))||(canonicalFigure?.refs||[]).some(r=>r.dataset==="books.people"&&String(r.key)===String(p.slug)));
  const figureBooks=[...new Set(bookPeople.flatMap(p=>p.book_slugs||[]))].map(s=>_bookBySlug(bookData,s)).filter(Boolean);
  const master=canonicalFigure?.meta?.tmdb_id?await loadMovieMaster():{items:[]};
  const filmography=canonicalFigure?.meta?.filmography||{};
  const mediaWorks=(master.items||[]).filter(m=>Object.prototype.hasOwnProperty.call(filmography,m.pendar_id)).map(_masterMovie);
  const figureMovies=(movieData.movies||[]).filter(m=>(m.mentions||[]).some(mm=>mm.kind==="figure"&&(String(mm.handle||"").toLowerCase()===String(x.handle||"").toLowerCase()||(x.posts||[]).some(p=>String(p.id)===String(mm.post_id)))));
  const profileMedia=_figureMediaWorks(x,canonicalFigure);
  const localFilmIds=new Set((master.items||[]).filter(m=>Object.prototype.hasOwnProperty.call(filmography,m.pendar_id)).map(m=>String(m.tmdb_id)));
  profileMedia.films=profileMedia.films.filter(w=>!w.tmdb_id||!localFilmIds.has(String(w.tmdb_id)));
  const localBookNames=new Set(figureBooks.map(b=>nameNorm(b.title_fa||b.original_title)));
  profileMedia.books=profileMedia.books.filter(w=>!localBookNames.has(nameNorm(w.title_fa||w.title)));
  const youtubeVideos=profileMedia.videos;
  const canonicalNames=new Set([x.name_fa,...(canonicalFigure?.aliases||[])].map(_canonicalNorm).filter(Boolean));
  const figureStories=canonicalFigure?(typeof ALL!=="undefined"?ALL:[]).filter(s=>(s.entities||[]).some(e=>canonicalNames.has(_canonicalNorm(e.name_fa||"")))):[];
  const shown = _figureProfileFilter === "direct" ? direct : _figureProfileFilter === "news" ? news : (_figureProfileFilter === "works" || _figureProfileFilter === "books" || _figureProfileFilter === "movies" || _figureProfileFilter === "stories" || _figureProfileFilter === "videos" || _figureProfileFilter === "about") ? [] : (x.posts || []);
  const latest = (x.posts || []).map(p => p.published_at).filter(Boolean).sort().pop();
  const poems = Array.isArray(curatedPoems[x.handle]) ? curatedPoems[x.handle] : [];
  const poemSection = poems.length ? `<section class="curated-poems"><div class="curated-poems-head"><div><span class="curated-kicker">اثر ویژه</span><h2>یک شعر؛ بخش‌های منتشرشده</h2><p>این ${faN(poems.length)} متن، بخش‌های مختلف یک شعر از مونا برزویی‌اند. ترتیب نهایی بخش‌ها هنوز اعلام نشده است؛ شماره‌های زیر فقط برای تفکیک در آرشیو جان کلام‌اند و ترتیب شعر را نشان نمی‌دهند.</p></div><span class="curated-count">${faN(poems.length)} بخش</span></div><div class="curated-poem-list">${poems.map((p,i)=>`<article class="curated-poem"><div class="curated-poem-no" title="شمارهٔ آرشیوی؛ نه ترتیب شعر">بخش ${faN(i+1)}*</div><div class="curated-poem-text">${esc(p.text||"").replace(/\\n/g,"<br>")}</div></article>`).join("")}</div></section>` : "";
  const worksSection=figureBooks.length||profileMedia.books.length||mediaWorks.length||profileMedia.films.length||poems.length||youtubeVideos.length||profileMedia.podcasts.length||profileMedia.other.length||profileMedia.channels.length?`<section class="figure-works">${figureBooks.length||profileMedia.books.length?'<h2>کتاب‌ها</h2><div class="books-grid">'+figureBooks.map(_bookCard).join("")+'</div><div class="figure-work-grid">'+profileMedia.books.map(_figureWorkCard).join("")+'</div>':""}${mediaWorks.length||profileMedia.films.length?'<h2>فیلم‌ها و سریال‌ها</h2><div class="movie-grid">'+mediaWorks.map(_movieCard).join("")+'</div><div class="figure-work-grid">'+profileMedia.films.map(_figureWorkCard).join("")+'</div>':""}${profileMedia.podcasts.length?'<h2>پادکست‌ها</h2><div class="figure-work-grid">'+profileMedia.podcasts.map(_figureWorkCard).join("")+'</div>':""}${youtubeVideos.length||profileMedia.channels.length?'<h2>ویدئوها</h2><div class="figure-youtube-grid">'+youtubeVideos.map(_figureVideoCard).join("")+'</div><div class="figure-work-grid">'+profileMedia.channels.map(_figureWorkCard).join("")+'</div>':""}${poemSection}${profileMedia.other.length?'<h2>دیگر آثار</h2><div class="figure-work-grid">'+profileMedia.other.map(_figureWorkCard).join("")+'</div>':""}</section>`:'<div class="state"><div class="big">اثری ثبت نشده است.</div></div>';
  const aboutSection='<section class="x-profile-feed"><p class="x-bio">'+esc(canonicalFigure?.meta?.biography_fa||canonicalFigure?.meta?.summary||x.role_fa||"معرفی تکمیلی هنوز ثبت نشده است.")+'</p>'+(canonicalFigure?.meta?.birthday?'<p class="x-bio">تولد: '+esc(faN(canonicalFigure.meta.birthday))+'</p>':"")+(canonicalFigure?.meta?.deathday?'<p class="x-bio">درگذشت: '+esc(faN(canonicalFigure.meta.deathday))+'</p>':"")+(canonicalFigure?.meta?.picture_source?'<p class="x-bio"><a href="'+esc(_figureWorkUrl(canonicalFigure.meta.picture_source))+'" target="_blank" rel="noopener">منبع و مجوز عکس ↗</a></p>':"")+'</section>';
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
    ${renderPersonProfileHeader(x,{actions:figureFollowBtn(x.handle,false),stats:`<span><b>${faN(direct.length)}</b> دیدگاه مستقیم</span><span><b>${faN(news.length)}</b> گفته در خبر</span>${figureStories.length ? `<span><b>${faN(figureStories.length)}</b> خبر</span>` : ""}${figureBooks.length+profileMedia.books.length ? `<span><b>${faN(figureBooks.length+profileMedia.books.length)}</b> کتاب</span>` : ""}${mediaWorks.length+profileMedia.films.length ? `<span><b>${faN(mediaWorks.length+profileMedia.films.length)}</b> فیلم/سریال</span>` : ""}${profileMedia.podcasts.length ? `<span><b>${faN(profileMedia.podcasts.length)}</b> پادکست</span>` : ""}${youtubeVideos.length ? `<span><b>${faN(youtubeVideos.length)}</b> ویدئو</span>` : ""}${latest ? `<span>آخرین فعالیت ${relTime(latest)}</span>` : ""}`})}
    ${canonicalFigure?canonicalStrip(canonicalFigure):""}
    <nav class="x-profile-tabs" aria-label="بخش‌های پروفایل">
      <button class="${_figureProfileFilter==="all"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','all')">همه</button>
      <button class="${_figureProfileFilter==="direct"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','direct')">دیدگاه‌ها</button>
      <button class="${_figureProfileFilter==="news"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','news')">گفته در خبرها</button>
      <button class="${_figureProfileFilter==="stories"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','stories')">خبرها</button>
      <button class="${_figureProfileFilter==="works"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','works')">آثار</button>

      ${figureMovies.length ? `<button class="${_figureProfileFilter==="movies"?"on":""}" onclick="setFigureProfileFilter(\'${esc(x.handle)}\',\'movies\')">اشاره به فیلم‌ها</button>` : ""}
      <button class="${_figureProfileFilter==="about"?"on":""}" onclick="setFigureProfileFilter('${esc(x.handle)}','about')">درباره</button>
    </nav>
    ${_figureProfileFilter==="stories" ? `<section class="figure-stories">${figureStories.length?groupedFeed(figureStories):'<div class="state">خبری برای این شخص ثبت نشده است.</div>'}</section>` : ""}
    ${_figureProfileFilter==="books" ? `<section class="figure-books"><div class="books-grid">${figureBooks.map(_bookCard).join("")}</div></section>` : ""}
    ${_figureProfileFilter==="movies" ? `<section class="figure-movies"><div class="movie-grid">${figureMovies.map(_movieCard).join("")}</div></section>` : ""}
    ${_figureProfileFilter==="works"||(_figureProfileFilter==="all"&&!shown.length)?worksSection:""}
    ${_figureProfileFilter==="about"?aboutSection:""}\n    <div class="x-profile-feed" ${(_figureProfileFilter==="works"||_figureProfileFilter==="books"||_figureProfileFilter==="movies"||_figureProfileFilter==="stories"||_figureProfileFilter==="videos"||_figureProfileFilter==="about"||(_figureProfileFilter==="all"&&!shown.length)) ? 'style="display:none"' : ""}>${shown.length ? shown.map(postRow).join("") : '<div class="state"><div class="big">در این بخش موردی ثبت نشده.</div></div>'}</div>
    <p class="muted fig-note x-profile-note">دیدگاه‌ها از منابع عمومی خود شخص می‌آیند؛ موارد «در خبرها» گفته‌هایی هستند که رسانه‌ها به او نسبت داده‌اند.</p>
  </div>`;
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
  return `<div class="x-profile-top"><button class="x-back" onclick="showFigures()" aria-label="بازگشت">←</button><div><b>${esc(name)}</b><small>${options.subtitle||faN((x.posts||[]).length)+" گفته"}</small></div></div>
    <div class="figure-profile-search"><div class="figure-profile-search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="جستجو میان چهره‌ها…" autocomplete="off" oninput="searchFigureProfiles(this.value)" onfocus="if(this.value)searchFigureProfiles(this.value)"></div><div id="figure-profile-search-results" class="figure-profile-search-results"></div></div>
    <div class="x-cover"></div><div class="x-profile-main"><div class="x-avatar-wrap">${options.avatar||avatar(x,"lg")}</div><div class="x-profile-actions">${options.actions||""}</div>
    <h1>${esc(name)}${x.verified?'<span class="profile-verified" title="هویت تأییدشده">✓</span>':""}</h1>
    ${x.claimed?'<div class="profile-claimed">این پروفایل توسط خود فرد تأیید و مدیریت می‌شود.</div>':""}
    ${(x.profile_handle===undefined?x.handle:x.profile_handle)?'<div class="x-handle">@'+esc(x.profile_handle===undefined?x.handle:x.profile_handle)+'</div>':x.name&&x.name!==name?'<div class="x-handle" dir="ltr">'+esc(x.name)+'</div>':""}
    <p class="x-bio">${esc(x.role_fa||"")}</p>${socialLinks(x.social||[])}
    <div class="x-profile-stats">${options.stats||""}</div>${options.details||""}</div>`;
}


