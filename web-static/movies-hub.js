let moviesCache=null;
let streamingCache=null;
let movieState={query:"",kind:"all",genre:"all",sort:"year"};
function _movieNorm(v){return String(v||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim().toLowerCase()}
function _movieBySlug(d,slug){return (d.movies||[]).find(function(x){return String(x.slug)===String(slug)})}
function _movieMentionCount(m){return Array.isArray(m.mentions)?m.mentions.length:0}
function _moviePoster(m,large){if(!m.poster_url)return '<span class="movie-poster-fallback">🎬</span>';return '<img src="'+esc(m.poster_url)+'" alt="'+esc(m.title_fa||m.original_title||"")+'" loading="'+(large?"eager":"lazy")+'" referrerpolicy="no-referrer" onerror="this.remove()">'}
function _movieRating(label,value,suffix){if(value===undefined||value===null)return "";return '<span class="movie-rating"><b>'+esc(String(value))+(suffix||"")+'</b><small>'+esc(label)+'</small></span>'}
function _movieVerificationMeta(m){
  const v=m&&m.verification||{},level=String(v.level||"");
  const map={
    hand_verified:["تأیید دستی پندار","هویت این اثر به‌صورت دستی بررسی و ثبت شده است.","high"],
    provider_catalog:["کاتالوگ رسمی سرویس","هویت اثر از کاتالوگ خود سرویس استریم گرفته شده است.","high"],
    provider_search:["جست‌وجوی رسمی سرویس","هویت با نتیجهٔ مستقیم جست‌وجوی سرویس استریم تأیید شده است.","high"],
    wikidata_exact:["Wikidata دقیق","عنوان/نام جایگزین و نوع اثر با یک هویت یکتای Wikidata تطبیق دارد.","high"],
    epg_provider_exact:["EPG + سرویس","عنوان EPG فقط پس از تطبیق دقیق با جست‌وجوی خود سرویس پذیرفته شده است.","high"],
    epg_wikidata_exact:["EPG + Wikidata","عنوان EPG فقط پس از تطبیق دقیق با یک هویت یکتای Wikidata پذیرفته شده است.","high"]
  };
  const x=map[level]||["منبع ثبت‌شده",String(v.source||"هویت این اثر از دادهٔ canonical پندار آمده است."),"normal"];
  return {label:x[0],detail:x[1],tone:x[2],level:level,source:v.source||"",qid:v.qid||"",providers:Array.isArray(v.providers)?v.providers:[]};
}
function _movieIdentityLinks(m){
  const ext=m&&m.external||{},rows=[];
  [["wikidata","Wikidata"],["tmdb","TMDB"],["imdb","IMDb"]].forEach(function(x){const url=ext[x[0]];if(/^https:\/\//.test(String(url||"")))rows.push('<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+x[1]+' ↗</a>')});
  return rows.join("");
}
function _movieAvailabilityEvidence(streaming,m){
  const rows=Array.isArray((streaming&&streaming.availability||{})[m.slug])?streaming.availability[m.slug]:[],search=Array.isArray((streaming&&streaming.search_links||{})[m.slug])?streaming.search_links[m.slug]:[],services=_streamServiceMap(streaming||{});
  if(!rows.length&&!search.length)return '<p class="movie-prov-empty">موجودی تأییدشده یا مسیر جست‌وجویی برای این اثر ثبت نشده است.</p>';
  const confirmed=rows.map(function(x){
    const s=services.get(String(x.service))||{},name=s.name_fa||s.name_en||x.service||"سرویس";
    const via=x.verified_by==="provider_catalog"?"کاتالوگ رسمی سرویس":x.verified_by==="provider_search"?"جست‌وجوی مستقیم سرویس":x.match==="provider_identity"?"شناسهٔ مستقیم سرویس":"تطبیق دقیق سرویس";
    return '<div class="movie-prov-service"><span class="movie-prov-logo">'+_streamLogo(s)+'</span><span><b>'+esc(name)+'</b><small>'+esc(via)+(x.direct?" · لینک مستقیم":"")+'</small></span></div>';
  }).join("");
  const lookup=search.map(function(x){const svc=services.get(String(x.service))||{},name=svc.name_fa||svc.name_en||x.service||"سرویس";return '<div class="movie-prov-service search-only"><span class="movie-prov-logo">'+_streamLogo(svc)+'</span><span><b>'+esc(name)+'</b><small>'+(x.basis==="imdb_id"?"جست‌وجوی دقیق با IMDb":"جست‌وجوی عنوان/سال")+' · موجودی تضمین نشده</small></span></div>'}).join("");
  return '<div class="movie-prov-services">'+confirmed+lookup+'</div>';
}
function _movieProvenance(streaming,m){
  const meta=_movieVerificationMeta(m),links=_movieIdentityLinks(m);
  return '<section class="movie-provenance"><div class="book-section-title"><h2>منبع هویت و موجودی</h2><span>شفافیت داده</span></div>'+
    '<div class="movie-prov-grid"><div class="movie-prov-card"><span class="movie-prov-label">تأیید هویت</span><strong>'+esc(meta.label)+'</strong><p>'+esc(meta.detail)+'</p>'+(meta.source?'<small>منبع ثبت: '+esc(meta.source)+'</small>':"")+(links?'<div class="movie-prov-links">'+links+'</div>':"")+'</div>'+
    '<div class="movie-prov-card"><span class="movie-prov-label">تأیید موجودی</span>'+_movieAvailabilityEvidence(streaming,m)+'</div></div>'+
    '<p class="movie-method">پندار نتیجهٔ fuzzy یا حدسی را به‌عنوان هویت یا موجودی قطعی نمایش نمی‌دهد؛ تطبیق‌ها باید دقیق و قابل ردیابی باشند.</p></section>';
}
async function loadMovies(){if(moviesCache)return moviesCache;let d=null;try{d=await getJSON(DATA+"/movies.json?v="+Date.now(),5000)}catch(_){}if(!d||!Array.isArray(d.movies)||!d.movies.length)d=(window.__MOVIES_DATA__&&typeof window.__MOVIES_DATA__==="object")?window.__MOVIES_DATA__:{movies:[]};moviesCache={...d,movies:Array.isArray(d.movies)?d.movies:[]};return moviesCache}
async function loadStreamingAvailability(){if(streamingCache)return streamingCache;let d=null;try{d=await getJSON(DATA+"/streaming.json?v="+Date.now(),7000)}catch(_){}streamingCache=d&&typeof d==="object"?d:{services:[],availability:{},stats:{}};streamingCache.services=Array.isArray(streamingCache.services)?streamingCache.services:[];streamingCache.availability=streamingCache.availability&&typeof streamingCache.availability==="object"?streamingCache.availability:{};streamingCache.search_links=streamingCache.search_links&&typeof streamingCache.search_links==="object"?streamingCache.search_links:{};return streamingCache}
function _streamServiceMap(d){return new Map((d.services||[]).map(x=>[String(x.key),x]))}
function _streamLogo(s){if(!s)return "";const name=s.name_fa||s.name_en||s.key||"سرویس";return s.logo?'<img src="'+esc(s.logo)+'" alt="'+esc(name)+'" title="'+esc(name)+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline\'"><span class="stream-logo-fallback" style="display:none">'+esc(name.slice(0,2))+'</span>':'<span class="stream-logo-fallback">'+esc(name.slice(0,2))+'</span>'}
function _movieWatchSection(streaming,m){const rows=Array.isArray((streaming.availability||{})[m.slug])?streaming.availability[m.slug]:[],search=Array.isArray((streaming.search_links||{})[m.slug])?streaming.search_links[m.slug]:[],services=_streamServiceMap(streaming);const cards=rows.map(x=>{const service=services.get(String(x.service))||{};const name=service.name_fa||x.service;return '<a class="movie-watch-card" href="'+esc(x.url||service.homepage||"#")+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(name)+'" title="'+esc(name)+'"><span class="movie-watch-logo">'+_streamLogo(service)+'</span><small>'+esc(x.direct?"لینک مستقیمِ تأییدشده":"موجودی تأییدشده")+'</small><b>↗</b></a>'}).join("")+search.map(x=>{const service=services.get(String(x.service))||{},name=service.name_fa||x.service;return '<a class="movie-watch-card is-search" href="'+esc(x.url||"#")+'" target="_blank" rel="noopener noreferrer" aria-label="جست‌وجو در '+esc(name)+'" title="این لینک موجودی را تضمین نمی‌کند؛ جست‌وجوی مستقیم سرویس است"><span class="movie-watch-logo">'+_streamLogo(service)+'</span><small>'+(x.basis==="imdb_id"?"جست‌وجوی دقیق با IMDb":"جست‌وجو با عنوان و سال")+'</small><b>⌕</b></a>'}).join("");if(!cards)return '<section class="movie-watch"><div class="book-section-title"><h2>کجا تماشا کنم؟</h2><span>در حال بررسی</span></div><p class="movie-method">فعلاً هیچ موجودی یا مسیر جست‌وجوی قابل اتکایی برای این عنوان ثبت نشده است.</p></section>';return '<section class="movie-watch"><div class="book-section-title"><h2>کجا تماشا کنم؟</h2><span>'+faN(rows.length)+' موجودی تأییدشده</span></div><p class="movie-method">«موجودی تأییدشده» با نتیجهٔ جست‌وجو فرق دارد؛ کارت‌های جست‌وجو فقط شما را با شناسهٔ دقیق یا عنوان/سال به سرویس می‌برند.</p><div class="movie-watch-grid">'+cards+'</div></section>'}
function _movieGenreCounts(movies){
  const counts=new Map();
  (movies||[]).forEach(m=>(m.genres_fa||[]).forEach(g=>{
    g=String(g||"").trim();
    if(g)counts.set(g,(counts.get(g)||0)+1);
  }));
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"fa"));
}
function _movieHasExternal(m,key){
  const url=String((m.external||{})[key]||"");
  return /^https:\/\//.test(url);
}
function _movieCatalogStats(d,streaming){
  const movies=d.movies||[], total=movies.length;
  const film=movies.filter(m=>m.type==="movie").length;
  const series=movies.filter(m=>m.type==="series").length;
  const withGenres=movies.filter(m=>Array.isArray(m.genres_fa)&&m.genres_fa.length).length;
  const imdb=movies.filter(m=>_movieHasExternal(m,"imdb")).length;
  const tmdb=movies.filter(m=>_movieHasExternal(m,"tmdb")).length;
  const available=new Set(Object.keys((streaming&&streaming.availability)||{})).size;
  const genres=_movieGenreCounts(movies);
  return {total,film,series,withGenres,imdb,tmdb,available,genres};
}
function _movieSetKind(kind){
  movieState.kind=kind;
  const sel=document.querySelector('.movie-toolbar select[data-role="kind"]');
  if(sel)sel.value=kind;
  renderMovieGrid();
}
function _movieSetGenre(genre){
  movieState.genre=genre;
  renderMovieGrid();
}
function _movieCatalogBar(d,streaming){
  const s=_movieCatalogStats(d,streaming);
  const chips=s.genres.slice(0,10).map(([genre,count])=>
    '<button class="movie-catalog-genre '+(movieState.genre===genre?'on':'')+'" onclick="_movieSetGenre(\''+esc(genre).replace(/'/g,"&#39;")+'\')">'+esc(genre)+' <b>'+faN(count)+'</b></button>'
  ).join("");
  const metric=(key,label,value,click)=>'<button class="movie-catalog-metric '+(click&&movieState.kind===key?'on':'')+'" '+(click?'onclick="_movieSetKind(\''+key+'\')"':'')+'><b>'+faN(value)+'</b><span>'+label+'</span></button>';
  return '<section class="movie-catalog-bar">'+
    '<div class="movie-catalog-metrics">'+
      metric("all","کل کاتالوگ",s.total,true)+
      metric("movie","فیلم",s.film,true)+
      metric("series","سریال",s.series,true)+
      metric("available","دارای لینک تماشا",s.available,false)+
      metric("imdb","IMDb",s.imdb,false)+
      metric("tmdb","TMDB",s.tmdb,false)+
    '</div>'+
    '<div class="movie-catalog-genres"><span class="movie-catalog-label">ژانرهای غالب</span>'+
      '<button class="movie-catalog-genre '+(movieState.genre==="all"?'on':'')+'" onclick="_movieSetGenre(\'all\')">همه ژانرها <b>'+faN(s.withGenres)+'</b></button>'+
      chips+
    '</div>'+
  '</section>';
}
function _movieCard(m){var genres=(m.genres_fa||[]).slice(0,2).join(" · ");return '<button class="movie-card" onclick="openMovie(\''+esc(m.slug)+'\')"><span class="movie-poster">'+_moviePoster(m,false)+'</span><span class="movie-card-copy"><span class="movie-kicker">'+(m.type==="series"?"سریال":"فیلم")+' · '+esc(m.year||"")+'</span><strong>'+esc(m.title_fa||m.original_title||"")+'</strong>'+(m.original_title&&m.original_title!==m.title_fa?'<small dir="ltr">'+esc(m.original_title)+'</small>':"")+'<em>'+esc([genres,m.country_fa].filter(Boolean).join(" · "))+'</em><span class="movie-card-foot">'+(m.ratings&&m.ratings.imdb?'IMDb '+esc(m.ratings.imdb):"")+(_movieMentionCount(m)?' · '+faN(_movieMentionCount(m))+' اشاره در جان‌کلام':"")+'</span></span></button>'}
async function showMovies(){show("movies");setTab("");document.title="جانِ فیلم | جان‌کلام";var el=document.getElementById("movies-content");el.innerHTML='<div class="spinner"></div>';var loaded=await Promise.all([loadMovies(),loadStreamingAvailability()]),d=loaded[0],streaming=loaded[1];el.innerHTML='<header class="movie-hub-heading"><span class="press-kicker">فیلم‌ها و سریال‌هایی که به شبکهٔ جان‌کلام راه پیدا می‌کنند</span><h1>جانِ فیلم<span>.</span></h1><p>فیلم، سریال، عوامل و اشاره‌های ثبت‌شده در جراید و گفته‌های چهره‌ها؛ با تمرکز روی پیوندها، نه فقط فهرست آثار.</p></header><div id="movie-catalog-bar">'+_movieCatalogBar(d,streaming)+'</div><div class="movie-toolbar"><input id="movie-search" type="search" placeholder="فیلم، سریال، کارگردان یا بازیگر…" value="'+esc(movieState.query)+'" oninput="movieState.query=this.value;renderMovieGrid()"><select data-role="kind" onchange="movieState.kind=this.value;renderMovieGrid()"><option value="all" '+(movieState.kind==="all"?"selected":"")+'>همه</option><option value="movie" '+(movieState.kind==="movie"?"selected":"")+'>فیلم</option><option value="series" '+(movieState.kind==="series"?"selected":"")+'>سریال</option></select><select onchange="movieState.sort=this.value;renderMovieGrid()"><option value="year" '+(movieState.sort==="year"?"selected":"")+'>تازه‌تر</option><option value="rating" '+(movieState.sort==="rating"?"selected":"")+'>امتیاز IMDb</option><option value="mentions" '+(movieState.sort==="mentions"?"selected":"")+'>بیشترین اشاره</option><option value="title" '+(movieState.sort==="title"?"selected":"")+'>الفبایی</option></select></div><div class="movie-grid" id="movie-grid"></div><p class="movie-method">عنوان‌ها از کاتالوگ سرویس‌ها، جان جراید، گفته‌های چهره‌ها و EPG وارد می‌شوند؛ فقط هویت‌های تأییدشده وارد فهرست عمومی می‌شوند.</p>';renderMovieGrid();setHash("#/movies")}
async function renderMovieGrid(){var el=document.getElementById("movie-grid");if(!el)return;var loaded=await Promise.all([loadMovies(),loadStreamingAvailability()]),d=loaded[0],streaming=loaded[1],q=_movieNorm(movieState.query);var rows=(d.movies||[]).filter(function(m){return movieState.kind==="all"||m.type===movieState.kind}).filter(function(m){return movieState.genre==="all"||(m.genres_fa||[]).includes(movieState.genre)}).filter(function(m){return !q||_movieNorm([m.title_fa,m.original_title,m.director&&m.director.name_fa,m.director&&m.director.name_en].concat(m.cast||[],m.genres_fa||[]).join(" ")).includes(q)});rows.sort(function(a,b){if(movieState.sort==="rating")return Number((b.ratings||{}).imdb||0)-Number((a.ratings||{}).imdb||0);if(movieState.sort==="mentions")return _movieMentionCount(b)-_movieMentionCount(a);if(movieState.sort==="title")return String(a.title_fa||"").localeCompare(String(b.title_fa||""),"fa");return Number(b.year||0)-Number(a.year||0)});const bar=document.getElementById("movie-catalog-bar");if(bar)bar.innerHTML=_movieCatalogBar(d,streaming);el.innerHTML=rows.length?rows.map(_movieCard).join(""):'<div class="state"><div class="big">چیزی پیدا نشد</div><p>فیلتر نوع یا ژانر را تغییر بده.</p></div>'}
async function openMovie(slug,canonicalId=null){var canonicalMovie=canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByRef('movies',slug);canonicalId=canonicalMovie&&canonicalMovie.id||canonicalId;show("movies");setTab("");var el=document.getElementById("movies-content");el.innerHTML='<div class="spinner"></div>';var loaded=await Promise.all([loadMovies(),loadStreamingAvailability()]),d=loaded[0],streaming=loaded[1],m=_movieBySlug(d,slug);if(!m){el.innerHTML='<div class="state"><div class="big">فیلم پیدا نشد</div></div>';return}document.title=(m.title_fa||m.original_title)+" | جانِ فیلم";var mentions=(m.mentions||[]).map(function(x){var fn=x.article_id?"openPressArticle":x.story_id?"openStory":x.post_id?"openStatement":null,id=x.article_id||x.story_id||x.post_id;var body='<span>'+esc(x.source_name||"جان‌کلام")+'</span><strong>'+esc(x.headline_fa||x.topic_fa||"اشاره به این اثر")+'</strong>'+(x.summary_fa?'<p>'+esc(x.summary_fa)+'</p>':"");return fn?'<button class="movie-mention" onclick="'+fn+'(\''+esc(id)+'\')">'+body+'</button>':'<div class="movie-mention">'+body+'</div>'}).join("");var ext=Object.entries(m.external||{}).filter(function(x){return /^https:\/\//.test(x[1])}).map(function(x){return '<a href="'+esc(x[1])+'" target="_blank" rel="noopener noreferrer">'+x[0].toUpperCase()+' ↗</a>'}).join("");var r=m.ratings||{};el.innerHTML='<button class="back" onclick="showMovies()">بازگشت به جانِ فیلم</button><article class="movie-detail"><div class="movie-hero"><div class="movie-poster movie-poster-lg">'+_moviePoster(m,true)+'</div><div class="movie-hero-copy"><span class="press-kicker">'+(m.type==="series"?"سریال":"فیلم")+' · '+esc(m.year||"")+'</span><h1>'+esc(m.title_fa||m.original_title||"")+'</h1>'+(m.original_title?'<p class="movie-original" dir="ltr">'+esc(m.original_title)+'</p>':"")+'<p class="movie-overview">'+esc(m.overview_fa||"")+'</p><div class="movie-ratings">'+_movieRating("IMDb",r.imdb)+_movieRating("Rotten Tomatoes",r.rotten_tomatoes,"%")+_movieRating("Metacritic",r.metacritic)+'</div><div class="movie-facts">'+(m.director&&m.director.name_fa?'<span><small>کارگردان</small><b>'+esc(m.director.name_fa)+'</b></span>':"")+(m.runtime_min?'<span><small>مدت</small><b>'+faN(m.runtime_min)+' دقیقه</b></span>':"")+(m.country_fa?'<span><small>محصول</small><b>'+esc(m.country_fa)+'</b></span>':"")+'</div>'+(m.cast&&m.cast.length?'<p class="movie-cast"><b>بازیگران:</b> '+esc(m.cast.join("، "))+'</p>':"")+'<div class="movie-external">'+ext+'</div></div></div>'+(canonicalMovie?canonicalStrip(canonicalMovie):'')+_movieProvenance(streaming,m)+_movieWatchSection(streaming,m)+'<section class="movie-evidence"><div class="book-section-title"><h2>در جان‌کلام</h2><span>'+faN(_movieMentionCount(m))+' اشاره</span></div><p class="movie-method">هر بار که این اثر در گفتهٔ یک چهره، خبر یا مطلب جریده شناسایی شود، پیوند آن اینجا ثبت می‌شود.</p><div class="movie-mentions">'+(mentions||'<div class="movie-empty-evidence">هنوز اشارهٔ مستندی برای این اثر ثبت نشده است.</div>')+'</div></section></article>';setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/movie/"+encodeURIComponent(slug))}
