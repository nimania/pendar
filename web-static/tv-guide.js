let tvGuideCache=null;
let tvGuideState={mode:"now",channel:"all",query:""};

const TV_GUIDE_SOURCE_LABELS={
  official:"رسمی",
  verified:"تأییدشده",
  aggregated:"تجمیعی",
  planned:"در صف اتصال"
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
  {name:"دیجی‌تون",status:"planned"}
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
function _tvSourceBadge(tier){
  const cls=tier==="official"?"official":tier==="verified"?"verified":tier==="aggregated"?"aggregated":"planned";
  return '<span class="tv-source-badge '+cls+'">'+esc(TV_GUIDE_SOURCE_LABELS[tier]||tier||"")+'</span>';
}
function _tvChannelLogo(c){
  if(c&&c.logo)return '<img src="'+esc(c.logo)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">';
  return '<b>'+esc(String(c?.name_fa||c?.name||"TV").slice(0,2))+'</b>';
}
function _tvProgrammeCard(p,c,now){
  const s=_tvDate(p.start), e=_tvDate(p.stop);
  const live=!!(s&&e&&s<=now&&now<e);
  let progress="";
  if(live){
    const pct=Math.max(0,Math.min(100,((now-s)/(e-s))*100));
    progress='<span class="tv-progress"><i style="width:'+pct.toFixed(1)+'%"></i></span>';
  }
  const meta=[p.year,(p.categories||[]).slice(0,2).join(" · ")].filter(Boolean).join(" · ");
  return '<article class="tv-program '+(live?"is-live":"")+'">'+
    '<div class="tv-channel-logo">'+_tvChannelLogo(c)+'</div>'+
    '<div class="tv-program-main">'+
      '<div class="tv-program-top"><span class="tv-time">'+_tvFaTime(p.start)+(p.stop?"–"+_tvFaTime(p.stop):"")+'</span>'+(live?'<span class="tv-live-dot">● در حال پخش</span>':"")+'</div>'+
      '<h3>'+esc(p.title_fa||p.title||"بدون عنوان")+'</h3>'+
      '<p class="tv-channel-name">'+esc(c?.name_fa||c?.name||p.channel_id||"")+(meta?" · "+esc(meta):"")+'</p>'+
      (p.desc_fa?'<p class="tv-desc">'+esc(p.desc_fa)+'</p>':"")+
      progress+
    '</div>'+
    (p.icon?'<div class="tv-program-art"><img src="'+esc(p.icon)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></div>':"")+
  '</article>';
}

function _tvModeRows(d,mode){
  const now=new Date(), cmap=_tvChannelMap(d);
  let rows=(d.programmes||[]).filter(p=>_tvDate(p.start)&&_tvDate(p.stop));
  if(tvGuideState.channel!=="all")rows=rows.filter(p=>String(p.channel_id)===String(tvGuideState.channel));
  const q=_tvNorm(tvGuideState.query);
  if(q)rows=rows.filter(p=>{
    const c=cmap.get(String(p.channel_id));
    return _tvNorm([p.title_fa,p.title_en,p.desc_fa,(p.categories||[]).join(" "),c?.name_fa,c?.name].join(" ")).includes(q);
  });
  if(mode==="now")rows=rows.filter(p=>_tvDate(p.start)<=now&&now<_tvDate(p.stop));
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
  return '<div class="tv-toolbar">'+
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
  const cards=(d.channels||[]).map(c=>{
    const rows=ps.filter(p=>String(p.channel_id)===String(c.id)).sort((a,b)=>_tvDate(a.start)-_tvDate(b.start));
    const current=rows.find(p=>_tvDate(p.start)<=now&&now<_tvDate(p.stop));
    const next=rows.find(p=>_tvDate(p.start)>now);
    return '<button class="tv-channel-card" onclick="tvGuideState.channel=\''+esc(c.id)+'\';showTVGuide(\'now\')">'+
      '<span class="tv-channel-card-logo">'+_tvChannelLogo(c)+'</span>'+
      '<span class="tv-channel-card-copy"><strong>'+esc(c.name_fa||c.name||c.id)+'</strong><small>'+esc(TV_GUIDE_GROUPS[c.group]||c.group||"شبکه")+' · '+esc(c.source_name||"")+'</small>'+
      (current?'<em>الان: '+esc(current.title_fa||current.title||"")+'</em>':next?'<em>بعدی '+_tvFaTime(next.start)+': '+esc(next.title_fa||next.title||"")+'</em>':'<em>برنامه‌ای در بازه فعلی نیست</em>')+
      '</span>'+_tvSourceBadge(c.confidence||"aggregated")+
    '</button>';
  }).join("");
  return cards?'<div class="tv-channel-grid">'+cards+'</div>':'<div class="state"><div class="big">هنوز شبکه‌ای وارد نشده است</div></div>';
}

function _tvSources(d){
  const rows=(d.sources||[]).map(s=>'<div class="tv-source-row"><span><strong>'+esc(s.name)+'</strong><small>'+esc(s.note||"")+'</small></span>'+_tvSourceBadge(s.status||s.confidence||"planned")+'</div>').join("");
  return '<div class="tv-source-list">'+rows+'</div><p class="tv-method">برنامه‌های نمایش‌داده‌شده فقط از منبعی وارد می‌شوند که دادهٔ زمان‌بندی آن در آخرین نوبت گردآوری معتبر بوده باشد. منابع «در صف اتصال» هنوز در جدول برنامه استفاده نمی‌شوند.</p>';
}

function _tvStreaming(){
  return '<div class="tv-streaming-intro"><h2>کجا تماشا کنم؟</h2><p>این لایه برای موجودی فیلم و سریال روی سرویس‌های ایرانی است و به صفحهٔ هر عنوان در «جان فیلم» وصل خواهد شد.</p></div>'+
  '<div class="tv-streaming-grid">'+TV_GUIDE_STREAMING.map(s=>'<div class="tv-streaming-card"><strong>'+esc(s.name)+'</strong><span>در صف اتصال</span></div>').join("")+'</div>';
}

async function showTVGuide(mode){
  tvGuideState.mode=mode||"now";
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
  const active=(d.sources||[]).filter(s=>s.status!=="planned").length;
  const generated=d.generated_at?_tvFaDate(d.generated_at)+" · "+_tvFaTime(d.generated_at):"در انتظار نخستین به‌روزرسانی";
  let body="";
  if(mode==="channels")body=_tvChannels(d);
  else if(mode==="sources")body=_tvSources(d);
  else if(mode==="streaming")body=_tvStreaming();
  else{
    const rows=_tvModeRows(d,mode), cmap=_tvChannelMap(d);
    const title=mode==="now"?"در حال پخش":mode==="tonight"?"امشب":mode==="sports"?"ورزش":mode==="next"?"چند ساعت آینده":"برنامه‌ها";
    body='<div class="tv-list-head"><h2>'+title+'</h2><span>'+faN(rows.length)+' برنامه</span></div>'+
      (rows.length?'<div class="tv-program-list">'+rows.map(p=>_tvProgrammeCard(p,cmap.get(String(p.channel_id)),now)).join("")+'</div>':'<div class="state tv-empty"><div class="big">در این بازه برنامه‌ای پیدا نشد</div><p>ممکن است منبع EPG هنوز برای این شبکه یا بازهٔ زمانی متصل نشده باشد.</p></div>');
  }
  el.innerHTML='<header class="tv-hero">'+
    '<div><span class="press-kicker">راهنمای یکپارچهٔ تماشای فارسی</span><h1>الان چی پخش می‌شه؟</h1><p>تلویزیون، شبکه‌های فارسی‌زبان، ورزش و در ادامه سرویس‌های استریمینگ؛ همه در یک جدول زمانی واحد.</p></div>'+
    '<div class="tv-status-card"><b>'+faN((d.channels||[]).length)+'</b><span>شبکهٔ دارای داده</span><small>'+faN(active)+' منبع متصل · آخرین ساخت '+esc(generated)+'</small></div>'+
  '</header>'+_tvTabs()+_tvToolbar(d)+body+
  '<div class="tv-footer-note">زمان‌ها بر اساس ساعت ایران نمایش داده می‌شوند. منبع و سطح اطمینان هر شبکه جداگانه نگهداری می‌شود.</div>';
}
