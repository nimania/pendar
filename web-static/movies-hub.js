
const movieDetailBuckets=new Map();
function _movieScope(m){
  if(movieState.scope==="editorial")return Boolean(_movieJanKalam(m));
  const countries=m.origin_country||[];
  if(movieState.scope==="iran")return countries.includes("IR")||m.original_language==="fa"||String(m.country_fa||"").includes("ایران");
  if(movieState.scope==="turkish")return countries.includes("TR")||m.original_language==="tr"||String(m.country_fa||"").includes("ترکیه");
  if(movieState.scope==="classic")return Number(m.year)>0&&Number(m.year)<1980;
  return true;
}
function _movieScopeBar(){
  return '<div class="movie-source-tabs">'+[["all","همه آثار"],["editorial","دارای جان کلام"],["iran","ایرانی"],["turkish","ترکی"],["classic","کلاسیک‌ها"]].map(x=>'<button class="'+(movieState.scope===x[0]?"on":"")+'" onclick="movieState.scope=\''+x[0]+'\';movieState.visible=100;renderMovieGrid()">'+x[1]+'</button>').join("")+'</div>';
}
function _movieLoadMore(){movieState.visible+=100;renderMovieGrid()}
async function _movieLoadDetail(raw){
  if(raw.detail_bucket===undefined||raw.detail_bucket===null)return raw;
  const bucket=Number(raw.detail_bucket);
  if(!Number.isInteger(bucket)||bucket<0||bucket>63)return raw;
  try{
    if(!movieDetailBuckets.has(bucket))movieDetailBuckets.set(bucket,getJSON(DATA+"/movie-master-details/"+bucket+".json",10000));
    const records=await movieDetailBuckets.get(bucket);
    return {...raw,...(records[raw.pendar_id]||{})};
  }catch(_){movieDetailBuckets.delete(bucket);return raw}
}
function _movieMasterDetails(raw,m){
  const fa=_movieDescriptionText(raw.overview_fa),en=_movieDescriptionText(raw.overview_en);
  const overview=fa?'<p class="movie-overview">'+esc(fa)+'</p>':en?'<p class="movie-method">خلاصه فارسی هنوز ثبت نشده؛ متن انگلیسی منبع:</p><p class="movie-overview" lang="en" dir="ltr">'+esc(en)+'</p>':'<p class="movie-method">خلاصه داستان هنوز برای این اثر ثبت نشده است.</p>';
  const credits=Array.isArray(raw.credits)?raw.credits:[],crew=credits.filter(x=>x.kind==="crew"),cast=credits.filter(x=>x.kind==="cast");
  const labels=CINEMA_ROLE_FA;
  const status={Released:"منتشرشده",Returning:"در حال پخش","Returning Series":"در حال پخش",Ended:"پایان‌یافته",Canceled:"متوقف‌شده","In Production":"در حال تولید",Planned:"برنامه‌ریزی‌شده","Post Production":"پس‌تولید",Pilot:"پایلوت"};
  const fact=(label,value)=>value?'<span><small>'+esc(label)+'</small><b>'+esc(String(value))+'</b></span>':"";
  const facts=fact("سال ساخت",raw.year?faN(raw.year):"")+fact("تاریخ انتشار",raw.release_date?_cinemaDigits(raw.release_date):"")+fact("زبان",CINEMA_LANGUAGE_FA[raw.original_language]||raw.original_language)+fact(m.type==="series"?"مدت هر قسمت":"مدت",raw.runtime_min?faN(raw.runtime_min)+" دقیقه":"")+fact("کشور",(raw.origin_country||[]).map(x=>({IR:"ایران",TR:"ترکیه",US:"آمریکا",GB:"بریتانیا",FR:"فرانسه",DE:"آلمان",JP:"ژاپن",KR:"کره جنوبی",IN:"هند"}[x]||x)).join(" / "))+fact("وضعیت",status[raw.status]||raw.status)+fact("فصل‌ها",raw.number_of_seasons?faN(raw.number_of_seasons):"")+fact("قسمت‌ها",raw.number_of_episodes?faN(raw.number_of_episodes):"");
  const people=(title,rows)=>rows.length?'<section class="movie-evidence"><h2>'+title+'</h2><div class="movie-credit-grid">'+rows.map(x=>_cinemaCredit(x)).join("")+'</div></section>':"";
  return '<section class="movie-evidence"><h2>درباره اثر</h2>'+overview+'<div class="movie-ratings">'+_cinemaRatings(raw)+(Number(raw.vote_count)>0?_movieRating("TMDB · "+faN(raw.vote_count)+" رأی",raw.vote_average):"")+'</div><div class="movie-facts">'+facts+'</div>'+((raw.networks||[]).length?'<p>شبکه: '+esc(raw.networks.map(x=>x.name).join("، "))+'</p>':"")+'</section>'+people("عوامل",crew)+people("بازیگران",cast);
}


function _movieDescriptionText(value){
  // Provider descriptions may contain HTML or escaped HTML. Template content is inert.
  let text=String(value||"");
  for(let pass=0;pass<3;pass++){
    const template=document.createElement("template");
    template.innerHTML=text.replace(/<(?:br\s*\/?|\/(?:p|div|li|h[1-6]))\s*>/gi,"\n");
    template.content.querySelectorAll("script,style,iframe,object,embed").forEach(node=>node.remove());
    const clean=template.content.textContent||"";
    if(clean===text)break;
    text=clean;
  }
  return text.replace(/\u00a0/g," ").replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}

// Editorial, spoiler-free readings keyed by exact TMDB identity; never inferred from genre or title.
const MOVIE_JAN_KALAM = {
  "movie/60243": [
    "حق با کیست؟",
    "جدایی نادر از سیمین، کشمکش خانواده و مسئولیت را به پرسشی درباره حقیقت تبدیل می‌کند. هر شخصیت دلایل خودش را دارد و قضاوت، با شناخت موقعیت او دشوارتر می‌شود.",
    "برای وقتی که درام واقع‌گرا و دوراهی‌های اخلاقی را به جواب‌های ساده ترجیح می‌دهی."
  ],
  "movie/2011": [
    "خانه، هویت و آزادی",
    "پرسپولیس، تاریخ بزرگ را از دریچه زندگی یک دختر روایت می‌کند. میان ایران و مهاجرت، پرسش اصلی این است: چطور خودت بمانی وقتی محیط از تو می‌خواهد کس دیگری باشی؟",
    "برای علاقه‌مندان به روایت شخصی، هویت و تجربه مهاجرت؛ با زبان تصویری ساده و موضوعاتی بزرگسالانه."
  ],
  "movie/582": [
    "شنیدنِ زندگی، بیداریِ وجدان",
    "زندگی دیگران درباره مرز میان اطاعت و وجدان است. نظارت بر زندگی خصوصی، به پرسشی درباره قدرت، هنر و مسئولیت فردی تبدیل می‌شود.",
    "برای وقتی که یک درام آرام و پرتنش درباره حریم خصوصی و اخلاق قدرت می‌خواهی."
  ],
  "movie/238": [
    "قدرت، خانواده، بهای وفاداری",
    "پدرخوانده، خانواده را جایی نشان می‌دهد که محبت و قدرت به هم گره خورده‌اند. وفاداری می‌تواند هم پناه باشد و هم تعهدی که آزادی انتخاب را محدود می‌کند.",
    "برای علاقه‌مندان به درام جنایی، روابط خانوادگی و روایت‌هایی با ریتم صبورانه."
  ],
  "movie/278": [
    "امید پشت دیوار",
    "رستگاری در شاوشنک درباره حفظ کرامت و امید در محیطی است که برای فرسودن انسان ساخته شده. دوستی و استقامت، قلب این روایت زندان‌اند.",
    "برای وقتی که یک درام انسانی درباره تاب‌آوری و دوستی می‌خواهی."
  ],
  "movie/155": [
    "امنیت به چه قیمتی؟",
    "شوالیه تاریکی، نبرد ابرقهرمان و تبهکار را به آزمون اخلاقی یک شهر تبدیل می‌کند. وقتی ترس همه‌گیر می‌شود، مرز میان عدالت و عبور از قانون کجاست؟",
    "برای علاقه‌مندان به تریلر جنایی و اکشنی که دوراهی اخلاقی هم دارد."
  ],
  "movie/27205": [
    "ذهن هم میدان نبرد است",
    "تلقین، یک مأموریت پیچیده را در فضای رؤیا پیش می‌برد؛ جایی که خاطره، احساس گناه و میل به کنترل واقعیت به هم می‌رسند.",
    "برای وقتی که معمای تصویری و روایت چندلایه می‌خواهی و از دنبال‌کردن جزئیات لذت می‌بری."
  ],
  "movie/157336": [
    "فاصله تا خانه",
    "میان‌ستاره‌ای، سفر فضایی را با پیوند والد و فرزند گره می‌زند. پشت مقیاس عظیم کیهان، مسئله‌ای انسانی قرار دارد: زمان و فاصله با رابطه‌های ما چه می‌کنند؟",
    "برای علاقه‌مندان به علمی‌تخیلی حماسی با محور خانواده و گذر زمان."
  ],
  "movie/496243": [
    "طبقاتی که دیده نمی‌شوند",
    "انگل از برخورد دو خانواده به شکاف طبقاتی می‌رسد؛ شکافی که در خانه، کار و کوچک‌ترین رفتارهای روزمره حضور دارد. طنز و اضطراب، کنار هم پیش می‌روند.",
    "برای وقتی که طنز تلخ و تعلیق اجتماعی می‌خواهی و تغییر لحن غافلگیرت نمی‌کند."
  ],
  "movie/424": [
    "انتخاب در دل فاجعه",
    "فهرست شیندلر، مسئولیت فردی را در دل خشونت سازمان‌یافته دنبال می‌کند. پرسش محوری‌اش این است که یک انسان، در برابر رنج دیگران، چه انتخابی می‌کند؟",
    "برای تماشای یک درام تاریخی سنگین درباره هولوکاست و مسئولیت اخلاقی."
  ],
  "movie/129": [
    "بزرگ‌شدن در جهانی ناآشنا",
    "شهر اشباح، سفر یک کودک در جهانی شگفت را به تجربه‌ای درباره هویت، کار و شجاعت تبدیل می‌کند. خیال، راهی برای دیدن ترس‌ها و امکان رشد است.",
    "برای علاقه‌مندان به جهان‌سازی خیال‌انگیز و داستان‌های بلوغ با جزئیات تصویری فراوان."
  ],
  "movie/13": [
    "زندگی فراتر از نقشه‌های ما",
    "فارست گامپ، زندگی یک مرد را از میان رخدادهای بزرگ تاریخ آمریکا عبور می‌دهد. عشق، تصادف و پشتکار، بیشتر از یک برنامه حساب‌شده مسیر او را شکل می‌دهند.",
    "برای وقتی که روایتی عاطفی، اپیزودیک و آمیخته به طنز می‌خواهی."
  ]
};

function _movieJanKalam(m){
  const url=String((m.external||{}).tmdb||"");
  const match=url.match(/^https:\/\/(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)(?:[/?#-]|$)/);
  return match?MOVIE_JAN_KALAM[match[1]+"/"+match[2]]||null:null;
}
function _movieJanKalamSection(m){
  const reading=_movieJanKalam(m);
  if(!reading)return "";
  return '<section class="movie-jan-kalam" aria-label="جان کلام فیلم"><div class="book-section-title"><h2>جان کلام</h2><span>بدون اسپویل</span></div><h3>'+esc(reading[0])+'</h3><p>'+esc(reading[1])+'</p><p class="movie-jan-kalam-audience">'+esc(reading[2])+'</p><small>برداشت تحریریه پندار</small></section>';
}

let moviesCache=null;
let streamingCache=null;
let movieMasterCache=null;
let movieState={query:"",kind:"all",genre:"all",sort:"editorial",source:"curated",scope:"all",visible:100};
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
    epg_wikidata_exact:["EPG + Wikidata","عنوان EPG فقط پس از تطبیق دقیق با یک هویت یکتای Wikidata پذیرفته شده است.","high"],
    tmdb_master:["TMDB Master","هویت این اثر مستقیماً با شناسهٔ رسمی TMDB ثبت شده است؛ بدون تطبیق حدسی.","high"]
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
async function loadMovieMaster(){
  if(movieMasterCache)return movieMasterCache;
  let summary=null,top=null;
  try{summary=await getJSON(DATA+"/movie-master-summary.json?v="+Date.now(),7000)}catch(_){}
  try{top=await getJSON(DATA+"/movie-master-top.json?v="+Date.now(),7000)}catch(_){}
  const items=top&&Array.isArray(top.items)?top.items:[];
  movieMasterCache={summary:summary&&typeof summary==="object"?summary:{stats:{}},items:items};
  return movieMasterCache;
}
function _masterGenreFa(name){
  const map={"Drama":"درام","Comedy":"کمدی","Action":"اکشن","Adventure":"ماجراجویی","Horror":"وحشت","Science Fiction":"علمی‌تخیلی","Family":"خانوادگی","Crime":"جنایی","Mystery":"معمایی","Thriller":"هیجان‌انگیز","Romance":"عاشقانه","Fantasy":"فانتزی","Animation":"انیمیشن","Documentary":"مستند","History":"تاریخی","War":"جنگی","Western":"وسترن","Music":"موسیقی","TV Movie":"فیلم تلویزیونی","Talk":"گفتگو","Reality":"رئالیتی","Kids":"کودک","News":"خبر","Soap":"سریال روزانه","War & Politics":"جنگ و سیاست","Action & Adventure":"اکشن و ماجراجویی","Sci-Fi & Fantasy":"علمی‌تخیلی و فانتزی"};
  return map[String(name||"")]||String(name||"");
}
function _masterMovie(x){
  const typ=x.media_type==="series"?"series":"movie",tmdb=String(x.tmdb_id||"");
  return {
    master_id:x.pendar_id,
    slug:"master-"+String(x.pendar_id||tmdb),
    type:typ,
    title_fa:x.title_fa||"",
    original_title:x.title_en||x.original_title||"",
    year:x.year||null,
    overview_fa:x.overview_fa||"",overview_en:x.overview_en||"",runtime_min:x.runtime_min||null,
    origin_country:x.origin_country||[],original_language:x.original_language||"",
    credits:x.credits||[],detail_bucket:x.detail_bucket,
    genres_fa:(x.genres||[]).map(g=>_masterGenreFa(g&&g.name)).filter(Boolean),
    poster_url:x.poster_path?"https://image.tmdb.org/t/p/w342"+x.poster_path:null,
    popularity:Number(x.popularity||0),
    external:{
      tmdb:tmdb?"https://www.themoviedb.org/"+(typ==="series"?"tv/":"movie/")+tmdb:null,
      imdb:x.imdb_id?"https://www.imdb.com/title/"+x.imdb_id+"/":null,
      wikidata:x.wikidata_qid?"https://www.wikidata.org/wiki/"+x.wikidata_qid:null
    },
    verification:{level:"tmdb_master",source:"TMDB Movie Master"},
    ratings:{tmdb:x.vote_average},mentions:[]
  };
}
function _movieSetSource(source){
  movieState.visible=100;
  movieState.source=source==="master"?"master":"curated";
  movieState.genre="all";
  movieState.kind="all";
  movieState.sort=movieState.source==="master"?"popularity":"editorial";
  renderMovieGrid();
}
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
  movieState.visible=100;
  movieState.kind=kind;
  const sel=document.querySelector('.movie-toolbar select[data-role="kind"]');
  if(sel)sel.value=kind;
  renderMovieGrid();
}
function _movieSetGenre(genre){
  movieState.visible=100;
  movieState.genre=genre;
  renderMovieGrid();
}
function _movieMasterCatalogBar(master){
  const s=(master.summary&&master.summary.stats)||{},items=(master.items||[]).map(_masterMovie);
  const genres=_movieGenreCounts(items),withGenres=items.filter(m=>m.genres_fa.length).length;
  const chips=genres.slice(0,10).map(([genre,count])=>'<button class="movie-catalog-genre '+(movieState.genre===genre?'on':'')+'" onclick="_movieSetGenre(\''+esc(genre).replace(/'/g,"&#39;")+'\')">'+esc(genre)+' <b>'+faN(count)+'</b></button>').join("");
  const metric=(label,value)=>'<span class="movie-catalog-metric"><b>'+faN(value||0)+'</b><span>'+label+'</span></span>';
  return '<section class="movie-catalog-bar movie-master-bar"><div class="movie-catalog-metrics">'+
    metric("کل Master",s.total_active)+metric("فیلم",s.movies)+metric("سریال",s.series)+
    metric("غنی‌شده",s.hydrated)+metric("دارای IMDb",s.with_imdb)+metric("عنوان فارسی",s.with_fa_title)+
    '</div><div class="movie-catalog-genres"><span class="movie-catalog-label">ژانرهای بخش غنی‌شده</span>'+
    '<button class="movie-catalog-genre '+(movieState.genre==="all"?'on':'')+'" onclick="_movieSetGenre(\'all\')">همه <b>'+faN(withGenres)+'</b></button>'+chips+'</div></section>';
}
function _movieSourceTabs(master){
  const s=(master.summary&&master.summary.stats)||{};
  return '<div class="movie-source-tabs"><button class="'+(movieState.source==="curated"?"on":"")+'" onclick="_movieSetSource(\'curated\')">منتخب پندار</button><button class="'+(movieState.source==="master"?"on":"")+'" onclick="_movieSetSource(\'master\')">کاتالوگ گسترده <small>'+faN(s.total_active||0)+'</small></button></div>';
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
function _movieCard(m){var genres=(m.genres_fa||[]).slice(0,2).join(" · "),fn=m.master_id?"openMasterMovie":"openMovie",arg=m.master_id||m.slug;return '<button class="movie-card" onclick="'+fn+'(\''+esc(arg)+'\')"><span class="movie-poster">'+_moviePoster(m,false)+'</span><span class="movie-card-copy"><span class="movie-kicker">'+(m.type==="series"?"سریال":"فیلم")+' · '+esc(m.year||"")+'</span><strong>'+esc(m.title_fa||m.original_title||"")+'</strong>'+(m.original_title&&m.original_title!==m.title_fa?'<small dir="ltr">'+esc(m.original_title)+'</small>':"")+(_movieJanKalam(m)?'<span class="movie-card-jan">'+esc(_movieJanKalam(m)[0])+'</span>':"")+'<em>'+esc([genres,m.country_fa].filter(Boolean).join(" · "))+'</em><span class="movie-card-foot">'+(m.ratings&&m.ratings.imdb?'IMDb '+esc(m.ratings.imdb):"")+(_movieMentionCount(m)?' · '+faN(_movieMentionCount(m))+' اشاره در جان‌کلام':"")+'</span></span></button>'}
async function showMovies(){show("movies");setTab("");document.title="جانِ فیلم | جان‌کلام";var el=document.getElementById("movies-content");el.innerHTML='<div class="spinner"></div>';var loaded=await Promise.all([loadMovies(),loadStreamingAvailability(),loadMovieMaster()]),d=loaded[0],streaming=loaded[1],master=loaded[2];el.innerHTML='<a class="back" href="#/cinema-people">چهره‌های سینما</a><header class="movie-hub-heading"><span class="press-kicker">فیلم‌ها و سریال‌ها در شبکهٔ پندار</span><h1>جانِ فیلم<span>.</span></h1><p>«منتخب پندار» آثار متصل به خبر، چهره، EPG و سرویس‌های تماشا را نشان می‌دهد؛ «کاتالوگ گسترده» لایهٔ جهانی Movie Master است.</p></header>'+_movieSourceTabs(master)+'<div id="movie-scope-bar">'+_movieScopeBar()+'</div><div id="movie-catalog-bar">'+(movieState.source==="master"?_movieMasterCatalogBar(master):_movieCatalogBar({...d,movies:_movieSelected(d,master)},streaming))+'</div><div class="movie-toolbar"><input id="movie-search" type="search" placeholder="فیلم یا سریال…" value="'+esc(movieState.query)+'" oninput="movieState.query=this.value;movieState.visible=100;renderMovieGrid()"><select data-role="kind" onchange="movieState.kind=this.value;renderMovieGrid()"><option value="all" '+(movieState.kind==="all"?"selected":"")+'>همه</option><option value="movie" '+(movieState.kind==="movie"?"selected":"")+'>فیلم</option><option value="series" '+(movieState.kind==="series"?"selected":"")+'>سریال</option></select><select onchange="movieState.sort=this.value;renderMovieGrid()"><option value="editorial" '+(movieState.sort==="editorial"?"selected":"")+'>منتخب تحریریه</option><option value="popularity" '+(movieState.sort==="popularity"?"selected":"")+'>محبوب‌تر</option><option value="year" '+(movieState.sort==="year"?"selected":"")+'>تازه‌تر</option><option value="mentions" '+(movieState.sort==="mentions"?"selected":"")+'>بیشترین اشاره</option><option value="title" '+(movieState.sort==="title"?"selected":"")+'>الفبایی</option></select></div><div class="movie-grid" id="movie-grid"></div><p class="movie-method" id="movie-grid-note"></p>';renderMovieGrid();setHash("#/movies")}

async function renderMovieGrid(){var el=document.getElementById("movie-grid");if(!el)return;var loaded=await Promise.all([loadMovies(),loadStreamingAvailability(),loadMovieMaster()]),d=loaded[0],streaming=loaded[1],master=loaded[2],q=_movieNorm(movieState.query),rows;if(movieState.source==="master"){rows=(master.items||[]).filter(x=>x.hydrated).map(_masterMovie)}else{rows=_movieSelected(d,master)}rows=rows.filter(_movieScope).filter(function(m){return movieState.kind==="all"||m.type===movieState.kind}).filter(function(m){return movieState.genre==="all"||(m.genres_fa||[]).includes(movieState.genre)}).filter(function(m){return !q||_movieNorm([m.title_fa,m.original_title].concat(m.genres_fa||[]).join(" ")).includes(q)});rows.sort(function(a,b){if(movieState.sort==="editorial"){const difference=Number(Boolean(_movieJanKalam(b)))-Number(Boolean(_movieJanKalam(a)));if(difference)return difference;return Number(b.popularity||0)-Number(a.popularity||0)}if(movieState.sort==="popularity")return Number(b.popularity||0)-Number(a.popularity||0);if(movieState.sort==="mentions")return _movieMentionCount(b)-_movieMentionCount(a);if(movieState.sort==="title")return String(a.title_fa||a.original_title||"").localeCompare(String(b.title_fa||b.original_title||""),"fa");return Number(b.year||0)-Number(a.year||0)});const scopeBar=document.getElementById("movie-scope-bar");if(scopeBar)scopeBar.innerHTML=_movieScopeBar();const bar=document.getElementById("movie-catalog-bar");if(bar)bar.innerHTML=movieState.source==="master"?_movieMasterCatalogBar(master):_movieCatalogBar({...d,movies:_movieSelected(d,master)},streaming);const tabs=document.querySelector(".movie-source-tabs");if(tabs)tabs.outerHTML=_movieSourceTabs(master);const note=document.getElementById("movie-grid-note");if(note)note.textContent=movieState.source==="master"?"آرشیو قابل مرور شامل عنوان‌های غنی‌شده است؛ جزئیات هر اثر هنگام بازکردن صفحه دریافت می‌شود. آمار کل Master شامل شناسه‌های بدون جزئیات نیز هست.":"این بخش آثار متصل و تأییدشدهٔ خود پندار را نشان می‌دهد.";el.innerHTML=rows.length?rows.slice(0,movieState.visible).map(_movieCard).join("")+(rows.length>movieState.visible?'<button class="movie-load-more" onclick="_movieLoadMore()">نمایش بیشتر · '+faN(Math.min(movieState.visible,rows.length))+' از '+faN(rows.length)+' عنوان</button>':""):'<div class="state"><div class="big">چیزی پیدا نشد</div><p>فیلتر نوع یا ژانر را تغییر بده.</p></div>'}

async function openMasterMovie(pendarId){show("movies");setTab("");var el=document.getElementById("movies-content");el.innerHTML='<div class="spinner"></div>';var master=await loadMovieMaster(),raw=(master.items||[]).find(x=>String(x.pendar_id)===String(pendarId));if(!raw){el.innerHTML='<div class="state"><div class="big">عنوان پیدا نشد</div></div>';return}raw=await _movieLoadDetail(raw);await _loadCinemaData();var m=_masterMovie(raw),links=_movieIdentityLinks(m),genres=(m.genres_fa||[]).join(" · ");document.title=(m.title_fa||m.original_title||"جان فیلم")+" | پندار";el.innerHTML='<button class="back" onclick="showMovies()">بازگشت به جانِ فیلم</button><article class="movie-detail"><div class="movie-hero"><div class="movie-poster movie-poster-lg">'+_moviePoster(m,true)+'</div><div class="movie-hero-copy"><span class="press-kicker">'+(m.type==="series"?"سریال":"فیلم")+' · '+esc(m.year||"")+'</span><h1>'+esc(m.title_fa||m.original_title||"")+'</h1>'+(m.original_title&&m.original_title!==m.title_fa?'<p class="movie-original" dir="ltr">'+esc(m.original_title)+'</p>':"")+'<p class="movie-master-genre">'+esc(genres)+'</p><div class="movie-external">'+links+'</div></div></div>'+_movieJanKalamSection(m)+_movieMasterDetails(raw,m)+await _masterMovieConnections(m)+'<section class="movie-provenance"><div class="book-section-title"><h2>هویت Master</h2><span>بدون fuzzy match</span></div><div class="movie-prov-card"><strong>TMDB Movie Master</strong><p>این رکورد مستقیماً با TMDB ID رسمی ساخته شده و در صورت موجود بودن، IMDb و Wikidata نیز از همان هویت دریافت شده‌اند.</p></div></section></article>';setHash("#/master-movie/"+encodeURIComponent(pendarId))}

async function openMovie(slug,canonicalId=null){const catalog=await loadMovies(),master=await loadMovieMaster(),candidate=_movieBySlug(catalog,slug),identity=candidate&&_movieExactKey(candidate),match=identity&&(master.items||[]).find(x=>_movieExactKey(_masterMovie(x))===identity);if(match)return openMasterMovie(match.pendar_id);var canonicalMovie=canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByRef('movies',slug);canonicalId=canonicalMovie&&canonicalMovie.id||canonicalId;show("movies");setTab("");var el=document.getElementById("movies-content");el.innerHTML='<div class="spinner"></div>';var loaded=await Promise.all([loadMovies(),loadStreamingAvailability()]),d=loaded[0],streaming=loaded[1],m=_movieBySlug(d,slug);if(!m){el.innerHTML='<div class="state"><div class="big">فیلم پیدا نشد</div></div>';return}document.title=(m.title_fa||m.original_title)+" | جانِ فیلم";var mentions=(m.mentions||[]).map(function(x){var fn=x.article_id?"openPressArticle":x.story_id?"openStory":x.post_id?"openStatement":null,id=x.article_id||x.story_id||x.post_id;var body='<span>'+esc(x.source_name||"جان‌کلام")+'</span><strong>'+esc(x.headline_fa||x.topic_fa||"اشاره به این اثر")+'</strong>'+(x.summary_fa?'<p>'+esc(_movieDescriptionText(x.summary_fa))+'</p>':"");return fn?'<button class="movie-mention" onclick="'+fn+'(\''+esc(id)+'\')">'+body+'</button>':'<div class="movie-mention">'+body+'</div>'}).join("");var ext=Object.entries(m.external||{}).filter(function(x){return /^https:\/\//.test(x[1])}).map(function(x){return '<a href="'+esc(x[1])+'" target="_blank" rel="noopener noreferrer">'+x[0].toUpperCase()+' ↗</a>'}).join("");var r=m.ratings||{};el.innerHTML='<button class="back" onclick="showMovies()">بازگشت به جانِ فیلم</button><article class="movie-detail"><div class="movie-hero"><div class="movie-poster movie-poster-lg">'+_moviePoster(m,true)+'</div><div class="movie-hero-copy"><span class="press-kicker">'+(m.type==="series"?"سریال":"فیلم")+' · '+esc(m.year||"")+'</span><h1>'+esc(m.title_fa||m.original_title||"")+'</h1>'+(m.original_title?'<p class="movie-original" dir="ltr">'+esc(m.original_title)+'</p>':"")+'<p class="movie-overview">'+esc(_movieDescriptionText(m.overview_fa))+'</p><div class="movie-ratings">'+_movieRating("IMDb",r.imdb)+_movieRating("Rotten Tomatoes",r.rotten_tomatoes,"%")+_movieRating("Metacritic",r.metacritic)+'</div><div class="movie-facts">'+(m.director&&m.director.name_fa?'<span><small>کارگردان</small><b>'+esc(m.director.name_fa)+'</b></span>':"")+(m.runtime_min?'<span><small>مدت</small><b>'+faN(m.runtime_min)+' دقیقه</b></span>':"")+(m.country_fa?'<span><small>محصول</small><b>'+esc(m.country_fa)+'</b></span>':"")+'</div>'+(m.cast&&m.cast.length?'<p class="movie-cast"><b>بازیگران:</b> '+esc(m.cast.join("، "))+'</p>':"")+'<div class="movie-external">'+ext+'</div></div></div>'+_movieJanKalamSection(m)+(canonicalMovie?canonicalStrip(canonicalMovie):'')+_movieProvenance(streaming,m)+_movieWatchSection(streaming,m)+'<section class="movie-evidence"><div class="book-section-title"><h2>در جان‌کلام</h2><span>'+faN(_movieMentionCount(m))+' اشاره</span></div><p class="movie-method">هر بار که این اثر در گفتهٔ یک چهره، خبر یا مطلب جریده شناسایی شود، پیوند آن اینجا ثبت می‌شود.</p><div class="movie-mentions">'+(mentions||'<div class="movie-empty-evidence">هنوز اشارهٔ مستندی برای این اثر ثبت نشده است.</div>')+'</div></section></article>';setHash(canonicalId?"#/entity/"+encodeURIComponent(canonicalId):"#/movie/"+encodeURIComponent(slug))}



const CINEMA_ROLE_FA={Director:"کارگردان",Writer:"نویسنده",Screenplay:"فیلمنامه‌نویس",Creator:"خالق",Producer:"تهیه‌کننده","Executive Producer":"تهیه‌کننده اجرایی",Story:"داستان","Director of Photography":"مدیر فیلم‌برداری",Editor:"تدوینگر","Original Music Composer":"آهنگساز",Casting:"انتخاب بازیگر"};
const CINEMA_LANGUAGE_FA={fa:"فارسی",en:"انگلیسی",tr:"ترکی",fr:"فرانسوی",de:"آلمانی",ja:"ژاپنی",ko:"کره‌ای",es:"اسپانیایی",it:"ایتالیایی",ar:"عربی",hi:"هندی",ru:"روسی",zh:"چینی",pt:"پرتغالی"};
let cinemaDataPromise;
async function _loadCinemaData(){if(!cinemaDataPromise)cinemaDataPromise=Promise.all([getJSON(DATA+"/cinema-people-index.json",10000).catch(()=>({people:[]})),getJSON(DATA+"/movie-ratings.json",10000).catch(()=>({items:{}}))]).then(([p,r])=>({people:new Map(((p&&p.people)||[]).map(x=>[Number(x.id),x])),ratings:(r&&r.items)||{}}));return cinemaDataPromise}
let cinemaLoaded={people:new Map(),ratings:{}};
const _cinemaLoader=_loadCinemaData;
_loadCinemaData=async function(){cinemaLoaded=await _cinemaLoader();return cinemaLoaded};
function _cinemaCredit(x){const p=cinemaLoaded.people.get(Number(x.id))||x,name=p.name_fa||p.name||x.name||"",role=x.kind==="cast"?"بازیگر":CINEMA_ROLE_FA[x.role]||"عوامل";return '<a class="movie-credit" href="#/cinema-person/'+Number(x.id)+'">'+(p.profile_path?'<img width="48" height="64" loading="lazy" alt="" src="https://image.tmdb.org/t/p/w185'+esc(p.profile_path)+'">':"")+'<b>'+esc(name)+'</b><small>'+esc(role)+'</small></a>'}
function _cinemaRatings(raw){const r=cinemaLoaded.ratings[raw.imdb_id]||{};return (r.imdb?_movieRating("IMDb · "+faN(r.imdb.votes)+" رأی",faN(r.imdb.value))+_cinemaRatingSource(r.imdb):"")+(r.rotten_tomatoes?_movieRating("راتن‌تومیتوز · منتقدان",faN(r.rotten_tomatoes.value),"٪")+_cinemaRatingSource(r.rotten_tomatoes):"")}
function _cinemaRatingSource(r){return '<small class="movie-method">'+esc(r.source.startsWith("https:")?"دادهٔ رسمی IMDb":r.source)+' · '+esc(_cinemaDigits(String(r.updated_at||"").slice(0,10)))+'</small>'}
function _movieExactKey(m){const match=String((m.external||{}).tmdb||"").match(/themoviedb\.org\/(movie|tv)\/(\d+)/);return match?match[1]+"/"+match[2]:null}
function _movieSelected(d,master){const rows=[],seen=new Set(),byKey=new Map((master.items||[]).map(x=>{const m=_masterMovie(x);return [_movieExactKey(m),m]}));for(const old of d.movies||[]){const key=_movieExactKey(old);if(key&&seen.has(key))continue;if(key)seen.add(key);rows.push(key&&byKey.has(key)?{...byKey.get(key),mentions:old.mentions||[]}:old)}for(const m of byKey.values()){const key=_movieExactKey(m);if(_movieJanKalam(m)&&!seen.has(key)){rows.push(m);seen.add(key)}}return rows}
async function _masterMovieConnections(m){const d=await loadMovies(),old=(d.movies||[]).find(x=>_movieExactKey(x)===_movieExactKey(m));if(!old)return "";const streaming=await loadStreamingAvailability();const mentions=(old.mentions||[]).map(x=>{const fn=x.article_id?"openPressArticle":x.story_id?"openStory":x.post_id?"openStatement":null,id=x.article_id||x.story_id||x.post_id;return fn?'<button class="movie-mention" onclick="'+fn+'(\''+esc(id)+'\')"><strong>'+esc(x.headline_fa||x.topic_fa||"اشاره به این اثر")+'</strong><p>'+esc(_movieDescriptionText(x.summary_fa))+'</p></button>':""}).join("");return _movieWatchSection(streaming,old)+(mentions?'<section class="movie-evidence"><h2>در جان‌کلام</h2>'+mentions+'</section>':"")}
async function openCinemaPerson(id){if(!/^\d+$/.test(String(id)))return;show("movies");setTab("");const el=document.getElementById("movies-content");el.innerHTML='<div class="spinner"></div>';const [records,master]=await Promise.all([getJSON(DATA+"/cinema-people/"+(Number(id)%64)+".json",10000),loadMovieMaster()]);const p=records[String(id)];if(!p){el.innerHTML='<p>چهره پیدا نشد.</p>';return}const name=p.name_fa||p.name,films=(master.items||[]).filter(x=>Object.prototype.hasOwnProperty.call(p.films,x.pendar_id));document.title=name+" | چهره‌های پندار";el.innerHTML='<button class="back" onclick="showCinemaPeople()">چهره‌های سینما</button><article class="movie-detail"><div class="movie-hero">'+(p.profile_path?'<img width="185" alt="'+esc(name)+'" src="https://image.tmdb.org/t/p/w185'+esc(p.profile_path)+'">':"")+'<div><span class="press-kicker">چهرهٔ سینما</span><h1>'+esc(name)+'</h1>'+(p.name_fa?'<p dir="ltr">'+esc(p.name)+'</p>':"")+'<p>'+esc((p.roles||[]).map(r=>CINEMA_ROLE_FA[r]||r).join("، "))+'</p>'+(p.birthday?'<p>تولد: '+esc(_cinemaDigits(p.birthday))+'</p>':"")+(p.deathday?'<p>درگذشت: '+esc(_cinemaDigits(p.deathday))+'</p>':"")+'<p>'+esc(_movieDescriptionText(p.biography_fa))+'</p><a target="_blank" rel="noopener" href="https://www.themoviedb.org/person/'+Number(id)+'">منبع: TMDB ↗</a></div></div><section class="movie-evidence"><h2>آثار در آرشیو پندار</h2><p class="movie-method">این فهرست از عوامل ثبت‌شدهٔ آثار موجود در آرشیو ساخته شده است.</p><div class="movie-grid">'+films.map(x=>_movieCard(_masterMovie(x))).join("")+'</div></section></article>';setHash("#/cinema-person/"+id)}
async function showCinemaPeople(){show("movies");setTab("");await _loadCinemaData();document.getElementById("movies-content").innerHTML='<button class="back" onclick="showMovies()">جانِ فیلم</button><h1>چهره‌های سینما</h1><input type="search" placeholder="نام فارسی یا اصلی…" oninput="_renderCinemaPeople(this.value)"><div class="movie-credit-grid" id="cinema-people-grid"></div>';_renderCinemaPeople("");setHash("#/cinema-people")}
function _renderCinemaPeople(q){const rows=[...cinemaLoaded.people.values()].filter(x=>!q||_movieNorm((x.name_fa||"")+" "+x.name).includes(_movieNorm(q)));document.getElementById("cinema-people-grid").innerHTML=rows.slice(0,200).map(p=>_cinemaCredit({...p,kind:"crew",role:(p.roles||[])[0]})).join("")+'<p class="movie-method">'+faN(rows.length)+' چهره؛ برای محدودکردن نتایج جست‌وجو کنید.</p>'}

function _cinemaDigits(value){return String(value).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)])}
