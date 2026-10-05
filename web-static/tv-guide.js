let tvGuideCache=null;
let tvGuideState={mode:"now",channel:"all",group:"all",query:""};
let tvStreamingState={query:"",kind:"all",service:"all",sort:"recent"};

const TV_GUIDE_SOURCE_LABELS={
  official:"رسمی",
  verified:"تأییدشده",
  aggregated:"تجمیعی",
  planned:"در صف اتصال",
  error:"خطای موقت"
};

const TV_GUIDE_GROUPS={
  all:"همه",
  general:"عمومی",
  series:"سریال",
  movies:"فیلم",
  sports:"ورزش",
  kids:"کودک",
  news:"خبر",
  docs:"مستند",
  music:"موسیقی"
};

const TV_GUIDE_STREAMING=[
  {name:"فیلیمو",status:"planned"},
  {name:"نماوا",status:"planned"},
  {name:"فیلم‌نت",status:"planned"},
  {name:"تلوبیون",status:"planned"},
  {name:"لنز",status:"planned"},
  {name:"گپ‌فیلم",status:"planned"},
  {name:"دیجی‌تون",status:"planned"},
  {name:"تماشاخونه",status:"planned"},
  {name:"استارنت",status:"planned"}
];

async function loadTVGuide(){
  if(tvGuideCache)return tvGuideCache;
  let d=null;
  try{d=await getJSON(DATA+"/tv-guide.json?v="+Date.now(),7000)}catch(_){}
  tvGuideCache=d&&typeof d==="object"?d:{generated_at:null,channels:[],programmes:[],sources:[]};
  tvGuideCache.channels=Array.isArray(tvGuideCache.channels)?tvGuideCache.channels:[];
  tvGuideCache.programmes=Array.isArray(tvGuideCache.programmes)?tvGuideCache.programmes:[];
  tvGuideCache.sources=Array.isArray(tvGuideCache.sources)?tvGuideCache.sources:[];
  return tvGuideCache;
}

function _tvDate(v){const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function _tvFaTime(v){
  const d=_tvDate(v); if(!d)return "—";
  return new Intl.DateTimeFormat("fa-IR",{timeZone:"Asia/Tehran",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
}
function _tvDayKey(d){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const get=t=>parts.find(x=>x.type===t)?.value||"";
  return get("year")+"-"+get("month")+"-"+get("day");
}
function _tvFaDate(v){
  const d=_tvDate(v); if(!d)return "";
  return new Intl.DateTimeFormat("fa-IR",{timeZone:"Asia/Tehran",weekday:"long",day:"numeric",month:"long"}).format(d);
}
function _tvChannelMap(d){return new Map((d.channels||[]).map(c=>[String(c.id),c]))}
function _tvNorm(v){return String(v||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/‌/g," ").replace(/\s+/g," ").trim().toLowerCase()}
function _tvJs(v){return String(v||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
function _tvProgrammeKey(p){return _tvNorm(p?.title_fa||p?.title_en||p?.title||"")}
function _tvGroupLabel(g){return TV_GUIDE_GROUPS[g]||g||"عمومی"}
function _tvLooksJunk(p,c){
  const t=_tvNorm(p?.title_fa||p?.title_en||"");
  if(!t||["برنامه","program","بدون عنوان","پخش آنلاین","زنده"].includes(t))return true;
  if(/^[۰-۹0-9]{1,2}:[۰-۹0-9]{2}\s*[-–—]\s*[۰-۹0-9]{1,2}:[۰-۹0-9]{2}$/.test(t))return true;
  if(c?.source_key==="iranintl"&&t===_tvNorm(c?.name_fa||c?.name||"")&&!p?.desc_fa)return true;
  if(c?.source_key==="irib"&&/^(میان[ ‌-]?برنامه|آگهی|پیام[ ‌-]?بازرگانی|آرم|تیزر|پیش[ ‌-]?(پرده|نمایش)|وله|فیلر|کپشن|هویت بصری|برنامک|اعلام برنامه|تقدیم برنامه|نشان شبکه|نشان پیام|اینفو آرم)/.test(t))return true;
  return false;
}
function _tvProgrammeScore(p,c){
  if(_tvLooksJunk(p,c))return -1000;
  let score=100+Math.min(50,String(p?.title_fa||p?.title_en||"").length);
  if(p?.desc_fa)score+=10;
  if(p?.icon)score+=3;
  return score;
}
function _tvSourceBadge(tier){
  const cls=["official","verified","aggregated","error"].includes(tier)?tier:"planned";
  return '<span class="tv-source-badge '+cls+'">'+esc(TV_GUIDE_SOURCE_LABELS[tier]||tier||"")+'</span>';
}
function _tvQualityBadge(p,c){
  const q=Number(p?.quality_score||0);
  const label=q>=90?"اعتماد بالا":q>=75?"قابل اتکا":"محدود";
  return '<span class="tv-quality-badge" title="امتیاز کیفیت '+faN(q)+' از ۱۰۰">'+label+'</span>';
}
function _tvChannelLogo(c){
  if(c&&c.logo)return '<img src="'+esc(c.logo)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">';
  return '<b>'+esc(String(c?.name_fa||c?.name||"TV").slice(0,2))+'</b>';
}
function _tvProgrammeStreaming(p){
  const rows=Array.isArray(p?.streaming_services)?p.streaming_services:[];
  if(!rows.length)return "";
  return '<span class="tv-program-streaming">'+rows.slice(0,4).map(s=>{
    const name=s.name_fa||s.key||"سرویس";
    if(s.logo)return '<span class="tv-program-provider" title="'+esc(name)+'"><img src="'+esc(s.logo)+'" alt="'+esc(name)+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></span>';
    return '<span class="tv-program-provider fallback" title="'+esc(name)+'">'+esc(name.slice(0,2))+'</span>';
  }).join("")+(rows.length>4?'<small>+'+faN(rows.length-4)+'</small>':"")+'</span>';
}
function _tvProgrammeCard(p,c,now){
  const s=_tvDate(p.start), e=_tvDate(p.stop);
  const live=!!(s&&e&&s<=now&&now<e);
  const linked=!!p.canonical_slug;
  let progress="";
  if(live){
    const pct=Math.max(0,Math.min(100,((now-s)/(e-s))*100));
    progress='<span class="tv-progress"><i style="width:'+pct.toFixed(1)+'%"></i></span>';
  }
  const meta=[p.year,(p.categories||[]).slice(0,2).join(" · ")].filter(Boolean).join(" · ");
  const pid=_tvProgrammeKey(p);
  const cid=String(c?.id||p.channel_id||"");
  return '<article class="tv-program '+(live?"is-live ":"")+(linked?"is-linked":"")+'">'+
    '<button class="tv-channel-logo tv-link-reset" onclick="openTVChannel(\''+_tvJs(cid)+'\')" title="صفحهٔ '+esc(c?.name_fa||c?.name||"شبکه")+'">'+_tvChannelLogo(c)+'</button>'+
    '<div class="tv-program-main">'+
      '<div class="tv-program-top"><span class="tv-time">'+_tvFaTime(p.start)+(p.stop?"–"+_tvFaTime(p.stop):"")+'</span>'+(live?'<span class="tv-live-dot">● در حال پخش</span>':"")+(linked?'<span class="tv-canonical-badge">جان فیلم</span>':"")+'</div>'+
      '<h3><button class="tv-title-link" onclick="openTVProgramme(\''+_tvJs(pid)+'\')">'+esc(p.title_fa||p.title||"بدون عنوان")+'</button></h3>'+
      '<p class="tv-channel-name"><button class="tv-inline-link" onclick="openTVChannel(\''+_tvJs(cid)+'\')">'+esc(c?.name_fa||c?.name||p.channel_id||"")+'</button>'+(meta?" · "+esc(meta):"")+' '+_tvSourceBadge(c?.confidence||"aggregated")+' '+_tvQualityBadge(p,c)+'</p>'+
      (linked?'<div class="tv-program-watch"><span>'+esc(p.canonical_title||"")+'</span>'+_tvProgrammeStreaming(p)+'</div>':"")+
      (p.desc_fa?'<p class="tv-desc">'+esc(p.desc_fa)+'</p>':"")+
      progress+
    '</div>'+
    (p.icon?'<button class="tv-program-art tv-link-reset" onclick="openTVProgramme(\''+_tvJs(pid)+'\')"><img src="'+esc(p.icon)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></button>':"")+
  '</article>';
}

function _tvModeRows(d,mode){
  const now=new Date(), cmap=_tvChannelMap(d);
  let rows=(d.programmes||[]).filter(p=>{
    const c=cmap.get(String(p.channel_id));
    return _tvDate(p.start)&&_tvDate(p.stop)&&!_tvLooksJunk(p,c);
  });
  if(tvGuideState.channel!=="all")rows=rows.filter(p=>String(p.channel_id)===String(tvGuideState.channel));
  if(tvGuideState.group!=="all")rows=rows.filter(p=>cmap.get(String(p.channel_id))?.group===tvGuideState.group);
  const q=_tvNorm(tvGuideState.query);
  if(q)rows=rows.filter(p=>{
    const c=cmap.get(String(p.channel_id));
    return _tvNorm([p.title_fa,p.title_en,p.desc_fa,(p.categories||[]).join(" "),c?.name_fa,c?.name].join(" ")).includes(q);
  });
  if(mode==="now"){
    rows=rows.filter(p=>_tvDate(p.start)<=now&&now<_tvDate(p.stop)&&p.current_eligible!==false&&Number(p.quality_score||100)>=74);
    const best=new Map();
    for(const p of rows){
      const key=String(p.channel_id), c=cmap.get(key), prev=best.get(key);
      if(!prev||_tvProgrammeScore(p,c)>_tvProgrammeScore(prev,c)||(_tvProgrammeScore(p,c)===_tvProgrammeScore(prev,c)&&_tvDate(p.start)>_tvDate(prev.start)))best.set(key,p);
    }
    rows=[...best.values()];
  }
  else if(mode==="tonight"){
    const key=_tvDayKey(now);
    rows=rows.filter(p=>{
      const s=_tvDate(p.start);
      if(_tvDayKey(s)!==key)return false;
      const h=Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tehran",hour:"2-digit",hour12:false}).format(s));
      return h>=17;
    });
  } else if(mode==="sports"){
    rows=rows.filter(p=>{
      const c=cmap.get(String(p.channel_id)), txt=_tvNorm([p.title_fa,(p.categories||[]).join(" "),c?.group].join(" "));
      return c?.group==="sports"||/(فوتبال|والیبال|بسکتبال|تنیس|ورزش|مسابقه|لیگ|جام|sport|football|soccer|basketball|volleyball|tennis)/i.test(txt);
    }).filter(p=>_tvDate(p.stop)>new Date(now.getTime()-2*3600e3));
  } else if(mode==="next"){
    rows=rows.filter(p=>_tvDate(p.start)>now&&_tvDate(p.start)<new Date(now.getTime()+8*3600e3));
  }
  rows.sort((a,b)=>_tvDate(a.start)-_tvDate(b.start));
  return rows;
}

function _tvToolbar(d){
  const channels=(d.channels||[]).filter(c=>(d.programmes||[]).some(p=>String(p.channel_id)===String(c.id)));
  const options=['<option value="all">همهٔ شبکه‌ها</option>'].concat(channels.map(c=>'<option value="'+esc(c.id)+'" '+(tvGuideState.channel===c.id?"selected":"")+'>'+esc(c.name_fa||c.name||c.id)+'</option>')).join("");
  const groupOrder=["all","news","sports","movies","series","kids","docs","general"];
  const groups='<div class="tv-groups">'+groupOrder.map(g=>'<button class="'+(tvGuideState.group===g?"on":"")+'" onclick="tvGuideState.group=\''+g+'\';tvGuideState.channel=\'all\';renderTVGuide()">'+esc(TV_GUIDE_GROUPS[g]||g)+'</button>').join("")+'</div>';
  return groups+'<div class="tv-toolbar">'+
    '<label class="tv-search"><span>⌕</span><input type="search" placeholder="جست‌وجوی برنامه یا شبکه…" value="'+esc(tvGuideState.query)+'" oninput="tvGuideState.query=this.value;renderTVGuide()"></label>'+
    '<select onchange="tvGuideState.channel=this.value;renderTVGuide()">'+options+'</select>'+
  '</div>';
}

function _tvTabs(){
  const tabs=[["now","الان"],["tonight","امشب"],["next","بعدی‌ها"],["sports","ورزش"],["channels","شبکه‌ها"],["streaming","استریمینگ"],["sources","منابع"]];
  return '<div class="tv-tabs">'+tabs.map(x=>'<button class="'+(tvGuideState.mode===x[0]?"on":"")+'" onclick="showTVGuide(\''+x[0]+'\')">'+x[1]+'</button>').join("")+'</div>';
}

function _tvChannels(d){
  const now=new Date(), ps=d.programmes||[];
  const visible=(d.channels||[]).filter(c=>tvGuideState.group==="all"||c.group===tvGuideState.group);
  const cards=visible.map(c=>{
    const rows=ps.filter(p=>String(p.channel_id)===String(c.id)&&!_tvLooksJunk(p,c)).sort((a,b)=>_tvDate(a.start)-_tvDate(b.start));
    const current=rows.find(p=>_tvDate(p.start)<=now&&now<_tvDate(p.stop));
    const next=rows.find(p=>_tvDate(p.start)>now);
    return '<button class="tv-channel-card" onclick="openTVChannel(\''+_tvJs(c.id)+'\')">'+
      '<span class="tv-channel-card-logo">'+_tvChannelLogo(c)+'</span>'+
      '<span class="tv-channel-card-copy"><strong>'+esc(c.name_fa||c.name||c.id)+'</strong><small>'+esc(_tvGroupLabel(c.group))+' · '+esc(c.source_name||"")+'</small>'+
      (current?'<em>الان: '+esc(current.title_fa||current.title||"")+'</em>':next?'<em>بعدی '+_tvFaTime(next.start)+': '+esc(next.title_fa||next.title||"")+'</em>':'<em>برنامه‌ای در بازه فعلی نیست</em>')+
      '</span>'+_tvSourceBadge(c.confidence||"aggregated")+
    '</button>';
  }).join("");
  return cards?'<div class="tv-channel-grid">'+cards+'</div>':'<div class="state"><div class="big">هنوز شبکه‌ای وارد نشده است</div></div>';
}

async function openTVChannel(channelId){
  show("tvguide"); setTab("");
  const el=document.getElementById("tv-guide-content");
  if(el)el.innerHTML='<div class="spinner"></div>';
  const d=await loadTVGuide(), cmap=_tvChannelMap(d), c=cmap.get(String(channelId));
  if(!c){el.innerHTML='<div class="state"><div class="big">شبکه پیدا نشد</div></div>';return}
  const now=new Date();
  const rows=(d.programmes||[]).filter(p=>String(p.channel_id)===String(c.id)&&!_tvLooksJunk(p,c)).sort((a,b)=>_tvDate(a.start)-_tvDate(b.start));
  const current=rows.find(p=>_tvDate(p.start)<=now&&now<_tvDate(p.stop));
  const future=rows.filter(p=>_tvDate(p.stop)>=now).slice(0,40);
  const cats=[...new Set(rows.flatMap(p=>p.categories||[]).filter(Boolean))].slice(0,8);
  const desc=c.description_fa||c.description||('صفحهٔ '+(c.name_fa||c.name||'شبکه')+' در راهنمای تماشای پندار؛ شامل اطلاعات شبکه، وضعیت منبع و جدول پخش ثبت‌شده.');
  document.title=(c.name_fa||c.name||"شبکه")+" | راهنمای تماشا";
  setHash("#/tv/channel/"+encodeURIComponent(String(c.id)));
  el.innerHTML=
    '<button class="back" onclick="showTVGuide(\'channels\')">بازگشت به شبکه‌ها</button>'+
    '<section class="tv-entity-hero"><div class="tv-entity-logo">'+_tvChannelLogo(c)+'</div><div class="tv-entity-copy"><span class="press-kicker">شبکهٔ تلویزیونی</span><h1>'+esc(c.name_fa||c.name||c.id)+'</h1>'+
      (c.name&&c.name!==c.name_fa?'<div class="tv-entity-en" dir="ltr">'+esc(c.name)+'</div>':"")+
      '<p>'+esc(desc)+'</p><div class="tv-entity-meta"><span>'+esc(_tvGroupLabel(c.group))+'</span><span>'+esc(c.source_name||"منبع ثبت نشده")+'</span>'+_tvSourceBadge(c.confidence||"aggregated")+(c.trust_score?'<span>اعتماد '+faN(c.trust_score)+'/۱۰۰</span>':"")+'</div></div></section>'+
    (cats.length?'<div class="tv-tag-row">'+cats.map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>':"")+
    (current?'<section class="tv-entity-section"><div class="tv-list-head"><h2>در حال پخش</h2></div>'+_tvProgrammeCard(current,c,now)+'</section>':"")+
    '<section class="tv-entity-section"><div class="tv-list-head"><h2>جدول پخش</h2><span>'+faN(future.length)+' برنامهٔ آینده</span></div>'+
      (future.length?'<div class="tv-program-list">'+future.map(p=>_tvProgrammeCard(p,c,now)).join("")+'</div>':'<div class="state tv-empty"><div class="big">برنامهٔ آینده‌ای ثبت نشده</div></div>')+'</section>';
}

async function openTVProgramme(programmeKey){
  show("tvguide"); setTab("");
  const el=document.getElementById("tv-guide-content");
  if(el)el.innerHTML='<div class="spinner"></div>';
  const d=await loadTVGuide(), cmap=_tvChannelMap(d), key=_tvNorm(programmeKey);
  const rows=(d.programmes||[]).filter(p=>_tvProgrammeKey(p)===key&&!_tvLooksJunk(p,cmap.get(String(p.channel_id)))).sort((a,b)=>_tvDate(a.start)-_tvDate(b.start));
  if(!rows.length){el.innerHTML='<div class="state"><div class="big">برنامه پیدا نشد</div></div>';return}
  const now=new Date(), p=rows.find(x=>_tvDate(x.start)<=now&&now<_tvDate(x.stop))||rows.find(x=>_tvDate(x.start)>=now)||rows[rows.length-1];
  const channels=[...new Map(rows.map(x=>{const ch=cmap.get(String(x.channel_id));return [String(x.channel_id),ch]}).filter(x=>x[1])).values()];
  const descriptions=rows.map(x=>String(x.desc_fa||"").trim()).filter(Boolean).sort((a,b)=>b.length-a.length);
  const desc=descriptions[0]||('صفحهٔ برنامهٔ «'+(p.title_fa||p.title_en||"")+'» در راهنمای تماشای پندار؛ زمان‌های پخش و شبکه‌های پخش‌کننده در این صفحه به‌روز می‌شوند.');
  const categories=[...new Set(rows.flatMap(x=>x.categories||[]).filter(Boolean))];
  const future=rows.filter(x=>_tvDate(x.stop)>=now).slice(0,30);
  const past=rows.filter(x=>_tvDate(x.stop)<now).slice(-8).reverse();
  const canonical=rows.find(x=>x.canonical_slug);
  document.title=(p.title_fa||p.title_en||"برنامه")+" | راهنمای تماشا";
  setHash("#/tv/program/"+encodeURIComponent(key));
  el.innerHTML=
    '<button class="back" onclick="showTVGuide(\'now\')">بازگشت به راهنمای تماشا</button>'+
    '<section class="tv-entity-hero tv-programme-hero">'+(p.icon?'<div class="tv-entity-art"><img src="'+esc(p.icon)+'" alt="" loading="eager" referrerpolicy="no-referrer"></div>':'<div class="tv-entity-art fallback">TV</div>')+
      '<div class="tv-entity-copy"><span class="press-kicker">برنامهٔ تلویزیونی</span><h1>'+esc(p.title_fa||p.title_en||"بدون عنوان")+'</h1>'+
      (p.title_en&&p.title_en!==p.title_fa?'<div class="tv-entity-en" dir="ltr">'+esc(p.title_en)+'</div>':"")+
      '<p>'+esc(desc)+'</p>'+
      '<div class="tv-entity-meta">'+(p.year?'<span>'+esc(p.year)+'</span>':"")+categories.slice(0,5).map(x=>'<span>'+esc(x)+'</span>').join("")+(canonical?'<button onclick="openMovie(\''+_tvJs(canonical.canonical_slug)+'\')">صفحهٔ مرتبط در جان فیلم ←</button>':"")+'</div></div></section>'+
    '<section class="tv-entity-section"><div class="tv-list-head"><h2>شبکه‌های پخش‌کننده</h2><span>'+faN(channels.length)+' شبکه</span></div><div class="tv-program-channels">'+channels.map(ch=>'<button onclick="openTVChannel(\''+_tvJs(ch.id)+'\')"><span class="tv-channel-card-logo">'+_tvChannelLogo(ch)+'</span><span><b>'+esc(ch.name_fa||ch.name||"")+'</b><small>'+esc(_tvGroupLabel(ch.group))+'</small></span></button>').join("")+'</div></section>'+
    '<section class="tv-entity-section"><div class="tv-list-head"><h2>پخش‌های آینده</h2><span>'+faN(future.length)+' نوبت</span></div>'+
      (future.length?'<div class="tv-airings">'+future.map(x=>{const ch=cmap.get(String(x.channel_id));return '<button onclick="openTVChannel(\''+_tvJs(x.channel_id)+'\')"><b>'+esc(ch?.name_fa||ch?.name||"")+'</b><span>'+esc(_tvFaDate(x.start))+' · '+_tvFaTime(x.start)+'–'+_tvFaTime(x.stop)+'</span></button>'}).join("")+'</div>':'<div class="state tv-empty"><div class="big">پخش آینده‌ای ثبت نشده</div></div>')+'</section>'+
    (past.length?'<section class="tv-entity-section"><div class="tv-list-head"><h2>پخش‌های اخیر</h2></div><div class="tv-airings muted">'+past.map(x=>{const ch=cmap.get(String(x.channel_id));return '<button onclick="openTVChannel(\''+_tvJs(x.channel_id)+'\')"><b>'+esc(ch?.name_fa||ch?.name||"")+'</b><span>'+esc(_tvFaDate(x.start))+' · '+_tvFaTime(x.start)+'</span></button>'}).join("")+'</div></section>':"");
}

function _tvSources(d){
  const stats=d.source_stats||{}, errors=d.source_errors||{};
  const rows=(d.sources||[]).map(s=>{
    const st=stats[s.key], err=errors[s.key];
    const state=st?(s.status||s.confidence||"aggregated"):(err?"error":"planned");
    const meta=st?(faN(st.channels||0)+" شبکه · "+faN(st.programmes||0)+" برنامه · کیفیت میانگین "+faN(st.avg_quality||0)+"/۱۰۰"):(err?"اتصال در آخرین نوبت ناموفق بود":"هنوز وارد جدول نشده");
    return '<div class="tv-source-row"><span><strong>'+esc(s.name)+'</strong><small>'+esc(s.note||"")+'</small><em>'+esc(meta)+'</em></span>'+_tvSourceBadge(state)+'</div>';
  }).join("");
  return '<div class="tv-source-list">'+rows+'</div><p class="tv-method">فقط منبعی که در آخرین گردآوری واقعاً دادهٔ معتبر تحویل داده باشد «متصل» محسوب می‌شود. خطای یک منبع مانع به‌روزرسانی بقیهٔ Guide نمی‌شود.</p>';
}

function _tvStreamServiceLogo(s,compact=false){
  const name=s?.name_fa||s?.name_en||s?.key||"سرویس";
  if(s?.logo)return '<img src="'+esc(s.logo)+'" alt="'+esc(name)+'" title="'+esc(name)+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-flex\'"><span class="tv-stream-fallback" style="display:none">'+esc(name.slice(0,2))+'</span>';
  return '<span class="tv-stream-fallback">'+esc(name.slice(0,2))+'</span>';
}
function _tvStreamPoster(m){
  if(m?.poster_url)return '<img src="'+esc(m.poster_url)+'" alt="'+esc(m.title_fa||m.original_title||"")+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">';
  return '<span>🎬</span>';
}
function _tvStreamRows(movies,streaming){
  const map=new Map((movies.movies||[]).map(m=>[String(m.slug),m]));
  return Object.entries(streaming.availability||{}).map(([slug,av])=>({movie:map.get(String(slug)),availability:Array.isArray(av)?av:[]})).filter(x=>x.movie&&x.availability.length);
}
function _tvStreamFilterRows(rows){
  const q=_tvNorm(tvStreamingState.query);
  return rows.filter(x=>{
    const m=x.movie;
    if(tvStreamingState.kind!=="all"&&m.type!==tvStreamingState.kind)return false;
    if(tvStreamingState.service!=="all"&&!x.availability.some(a=>String(a.service)===tvStreamingState.service))return false;
    if(q&&!_tvNorm([m.title_fa,m.original_title,(m.aliases||[]).join(" "),(m.genres_fa||[]).join(" "),m.country_fa].join(" ")).includes(q))return false;
    return true;
  }).sort((a,b)=>{
    if(tvStreamingState.sort==="multi")return b.availability.length-a.availability.length||Number(b.movie.year||0)-Number(a.movie.year||0);
    if(tvStreamingState.sort==="year")return Number(b.movie.year||0)-Number(a.movie.year||0);
    if(tvStreamingState.sort==="title")return String(a.movie.title_fa||"").localeCompare(String(b.movie.title_fa||""),"fa");
    const ad=Date.parse(a.movie.first_seen_at||"")||0,bd=Date.parse(b.movie.first_seen_at||"")||0;
    return bd-ad||Number(b.movie.year||0)-Number(a.movie.year||0);
  });
}
function _tvStreamProviderMarks(av,services){
  const seen=new Set();
  return av.map(a=>{
    const key=String(a.service||"");
    if(!key||seen.has(key))return "";
    seen.add(key);
    const s=services.get(key)||{key,name_fa:key};
    return '<span class="tv-stream-provider-mark" title="'+esc(s.name_fa||s.name_en||key)+'">'+_tvStreamServiceLogo(s,true)+'</span>';
  }).join("");
}
function _tvStreamTitleCard(row,services){
  const m=row.movie,av=row.availability||[];
  return '<button class="tv-stream-title-card" onclick="openMovie(\''+esc(m.slug)+'\')">'+
    '<span class="tv-stream-poster">'+_tvStreamPoster(m)+'</span>'+
    '<span class="tv-stream-copy"><span class="tv-stream-kicker">'+(m.type==="series"?"سریال":"فیلم")+(m.year?" · "+esc(m.year):"")+'</span>'+
      '<strong>'+esc(m.title_fa||m.original_title||"")+'</strong>'+
      (m.original_title&&m.original_title!==m.title_fa?'<small dir="ltr">'+esc(m.original_title)+'</small>':"")+
      '<span class="tv-stream-provider-list">'+_tvStreamProviderMarks(av,services)+'</span>'+
      (av.length>1?'<em>روی '+faN(av.length)+' سرویس</em>':"")+
    '</span>'+
  '</button>';
}
function _tvStreamingToolbar(services){
  const connected=(services||[]).filter(s=>(s.health||{}).status==="ok");
  const serviceOptions=['<option value="all">همهٔ سرویس‌ها</option>'].concat(connected.map(s=>'<option value="'+esc(s.key)+'" '+(tvStreamingState.service===s.key?"selected":"")+'>'+esc(s.name_fa||s.name_en||s.key)+'</option>')).join("");
  return '<div class="tv-stream-discovery-toolbar">'+
    '<label class="tv-stream-search"><span>⌕</span><input type="search" placeholder="اسم فیلم یا سریال را بنویس…" value="'+esc(tvStreamingState.query)+'" oninput="tvStreamingState.query=this.value;renderTVGuide()"></label>'+
    '<select onchange="tvStreamingState.kind=this.value;renderTVGuide()"><option value="all" '+(tvStreamingState.kind==="all"?"selected":"")+'>همه</option><option value="movie" '+(tvStreamingState.kind==="movie"?"selected":"")+'>فیلم</option><option value="series" '+(tvStreamingState.kind==="series"?"selected":"")+'>سریال</option></select>'+
    '<select onchange="tvStreamingState.service=this.value;renderTVGuide()">'+serviceOptions+'</select>'+
    '<select onchange="tvStreamingState.sort=this.value;renderTVGuide()"><option value="recent" '+(tvStreamingState.sort==="recent"?"selected":"")+'>تازه اضافه‌شده</option><option value="multi" '+(tvStreamingState.sort==="multi"?"selected":"")+'>روی چند سرویس</option><option value="year" '+(tvStreamingState.sort==="year"?"selected":"")+'>سال ساخت</option><option value="title" '+(tvStreamingState.sort==="title"?"selected":"")+'>الفبایی</option></select>'+
  '</div>';
}
async function _tvStreaming(){
  let streaming={services:[],stats:{}},movies={movies:[]};
  try{
    const loaded=await Promise.all([
      typeof loadStreamingAvailability==="function"?loadStreamingAvailability():Promise.resolve(streaming),
      typeof loadMovies==="function"?loadMovies():Promise.resolve(movies)
    ]);
    streaming=loaded[0]||streaming; movies=loaded[1]||movies;
  }catch(_){}
  const services=(streaming.services||[]).length?streaming.services:TV_GUIDE_STREAMING.map(x=>({name_fa:x.name,status:x.status,key:_tvNorm(x.name)}));
  const serviceMap=new Map(services.map(s=>[String(s.key),s]));
  const allRows=_tvStreamRows(movies,streaming);
  const rows=_tvStreamFilterRows(allRows);
  const connected=services.filter(s=>(s.health||{}).status==="ok");
  const multi=allRows.filter(x=>x.availability.length>1).sort((a,b)=>b.availability.length-a.availability.length).slice(0,8);
  const recent=allRows.slice().sort((a,b)=>(Date.parse(b.movie.first_seen_at||"")||0)-(Date.parse(a.movie.first_seen_at||"")||0)||Number(b.movie.year||0)-Number(a.movie.year||0)).slice(0,10);

  const serviceCards=services.map(s=>{
    const h=s.health||{},name=s.name_fa||s.name_en||s.key||"سرویس";
    const state=h.status==="ok"?"متصل":h.status==="error"?"خطای موقت":"در صف اتصال";
    const stat=h.status==="ok"&&Number(h.matched_titles||0)?faN(h.matched_titles)+" عنوان تأییدشده":state;
    return '<button class="tv-streaming-card '+(tvStreamingState.service===s.key?"on":"")+'" title="'+esc(name)+'" aria-label="'+esc(name)+'" onclick="tvStreamingState.service=\''+esc(s.key)+'\';renderTVGuide()">'+
      '<strong class="tv-stream-logo">'+_tvStreamServiceLogo(s)+'</strong><span>'+stat+'</span></button>';
  }).join("");

  const discovery=_tvStreamingToolbar(services)+
    '<div class="tv-stream-result-head"><h2>کجا تماشا کنم؟</h2><span>'+faN(rows.length)+' عنوان با موجودی تأییدشده</span></div>'+
    (rows.length?'<div class="tv-stream-title-grid">'+rows.map(x=>_tvStreamTitleCard(x,serviceMap)).join("")+'</div>':'<div class="state tv-empty"><div class="big">نتیجهٔ تأییدشده‌ای پیدا نشد</div><p>نتیجهٔ مبهم یا بدون تطبیق دقیق عمداً نمایش داده نمی‌شود.</p></div>');

  let highlights="";
  if(!tvStreamingState.query&&tvStreamingState.kind==="all"&&tvStreamingState.service==="all"){
    highlights=
      (recent.length?'<section class="tv-stream-highlight"><div class="tv-stream-result-head"><h2>تازه اضافه‌شده</h2><span>'+faN(recent.length)+' عنوان</span></div><div class="tv-stream-rail">'+recent.map(x=>_tvStreamTitleCard(x,serviceMap)).join("")+'</div></section>':"")+
      (multi.length?'<section class="tv-stream-highlight"><div class="tv-stream-result-head"><h2>روی چند سرویس</h2><span>انتخاب آسان‌تر بین سرویس‌ها</span></div><div class="tv-stream-rail">'+multi.map(x=>_tvStreamTitleCard(x,serviceMap)).join("")+'</div></section>':"");
  }

  return '<div class="tv-streaming-intro"><h2>استریمینگ</h2><p>جست‌وجوی یکپارچهٔ فیلم و سریال در سرویس‌های فارسی؛ فقط با تطبیق دقیق و موجودی تأییدشده.</p>'+
    '<div class="tv-stream-stats"><span><b>'+faN((streaming.stats||{}).canonical_titles||movies.movies.length||0)+'</b> عنوان بررسی‌شده</span><span><b>'+faN((streaming.stats||{}).titles_with_availability||allRows.length)+'</b> عنوان قابل تماشا</span><span><b>'+faN(connected.length)+'</b> سرویس متصل</span></div></div>'+
    '<div class="tv-streaming-grid">'+serviceCards+'</div>'+highlights+discovery;
}

async function showTVGuide(mode){
  mode=mode||"now";
  if(String(mode).startsWith("channel/")) return openTVChannel(String(mode).slice(8));
  if(String(mode).startsWith("program/")) return openTVProgramme(String(mode).slice(8));
  tvGuideState.mode=mode;
  show("tvguide"); setTab("");
  document.title="راهنمای تماشا | پندار";
  const el=document.getElementById("tv-guide-content");
  if(el&&!tvGuideCache)el.innerHTML='<div class="spinner"></div>';
  await loadTVGuide();
  renderTVGuide();
  setHash("#/tv/"+encodeURIComponent(tvGuideState.mode));
}

async function renderTVGuide(){
  const el=document.getElementById("tv-guide-content"); if(!el)return;
  const d=await loadTVGuide(), now=new Date(), mode=tvGuideState.mode;
  const active=Object.keys(d.source_stats||{}).length;
  const linkStats=d.canonical_link_stats||{};
  const generated=d.generated_at?_tvFaDate(d.generated_at)+" · "+_tvFaTime(d.generated_at):"در انتظار نخستین به‌روزرسانی";
  let body="";
  if(mode==="channels")body=_tvChannels(d);
  else if(mode==="sources")body=_tvSources(d);
  else if(mode==="streaming")body=await _tvStreaming();
  else{
    const rows=_tvModeRows(d,mode), cmap=_tvChannelMap(d);
    const title=mode==="now"?"در حال پخش":mode==="tonight"?"امشب":mode==="sports"?"ورزش":mode==="next"?"چند ساعت آینده":"برنامه‌ها";
    body='<div class="tv-list-head"><h2>'+title+'</h2><span>'+faN(rows.length)+' برنامه</span></div>'+
      (rows.length?'<div class="tv-program-list">'+rows.map(p=>_tvProgrammeCard(p,cmap.get(String(p.channel_id)),now)).join("")+'</div>':'<div class="state tv-empty"><div class="big">در این بازه برنامه‌ای پیدا نشد</div><p>ممکن است منبع EPG هنوز برای این شبکه یا بازهٔ زمانی متصل نشده باشد.</p></div>');
  }
  const controls=(mode==="streaming"||mode==="sources")?"":_tvToolbar(d);
  el.innerHTML='<header class="tv-hero">'+
    '<div><span class="press-kicker">راهنمای یکپارچهٔ تماشای فارسی</span><h1>'+(mode==="streaming"?"چی ببینم و کجا؟":"الان چی پخش می‌شه؟")+'</h1><p>'+(mode==="streaming"?"فیلم و سریال را بین سرویس‌های فارسی جست‌وجو کن و فقط موجودی تأییدشده را ببین.":"تلویزیون، شبکه‌های فارسی‌زبان، ورزش و سرویس‌های استریمینگ؛ همه در یک راهنمای واحد.")+'</p></div>'+
    '<div class="tv-status-card"><b>'+faN((d.channels||[]).length)+'</b><span>شبکهٔ دارای داده</span><small>'+faN(active)+' منبع متصل'+(Number(linkStats.linked_programmes||0)?' · '+faN(linkStats.linked_programmes)+' برنامه متصل به جان فیلم':"")+' · آخرین ساخت '+esc(generated)+'</small></div>'+
  '</header>'+_tvTabs()+controls+body+
  '<div class="tv-footer-note">زمان‌ها بر اساس ساعت ایران نمایش داده می‌شوند. رکوردهای فنی، تبلیغاتی، placeholder و زمان‌بندی‌های هم‌پوشان پیش از نمایش فیلتر می‌شوند.</div>';
}
