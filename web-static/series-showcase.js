/* Shared homepage / Jan Film showcase, with explicitly sourced evidence. */
const SERIES_SHOWCASE_SEED = {"checked_at":"2026-10-06","sources":[{"name":"فیلیمو","url":"https://t.me/s/filimo","region":"iran"},{"name":"فیلم‌نت","url":"https://t.me/s/filmnetofficial","region":"iran"},{"name":"نماوا","url":"https://t.me/s/namava_ir","region":"iran","status":"رتبهٔ قابل تأیید موجود نیست"}],"items":[{"title":"East of Eden","platform":"Netflix","region":"world","rank":1,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/netflix/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Monster: The Lizzie Borden Story","platform":"Netflix","region":"world","rank":2,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/netflix/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Not a Stranger","platform":"Netflix","region":"world","rank":3,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/netflix/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Neagley","platform":"Prime Video","region":"world","rank":1,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/amazon-prime/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Reacher","platform":"Prime Video","region":"world","rank":2,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/amazon-prime/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Off Campus","platform":"Prime Video","region":"world","rank":3,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/amazon-prime/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Coven Academy","platform":"Disney+","region":"world","rank":1,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/disney/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Loki","platform":"Disney+","region":"world","rank":2,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/disney/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Africa Earth's Wild Home","platform":"Disney+","region":"world","rank":3,"checked_at":"2026-10-06","source_url":"https://flixpatrol.com/top10/disney/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Ted Lasso","platform":"Apple TV","region":"world","rank":1,"checked_at":"2026-10-05","source_url":"https://flixpatrol.com/top10/apple-tv/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Slow Horses","platform":"Apple TV","region":"world","rank":2,"checked_at":"2026-10-05","source_url":"https://flixpatrol.com/top10/apple-tv/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"Silo","platform":"Apple TV","region":"world","rank":3,"checked_at":"2026-10-05","source_url":"https://flixpatrol.com/top10/apple-tv/","reason":"رتبهٔ جهانی FlixPatrol"},{"title":"بدنام","platform":"فیلیمو","region":"iran","reason":"قسمت ۲۶؛ قسمت پایانی ۱۷ مهر","checked_at":"2026-10-06","source_url":"https://r.filimo.com/Tbadnam26"},{"title":"کنکل","platform":"فیلیمو","region":"iran","reason":"اعلان رسمی قسمت هفتم","checked_at":"2026-10-06","source_url":"https://r.filimo.com/TCankel7"},{"title":"کوری","platform":"فیلم‌نت","region":"iran","reason":"اعلان رسمی قسمت پایانی","checked_at":"2026-10-06","source_url":"https://t.me/s/filmnetofficial"},{"title":"اعتراف می‌کنم","platform":"فیلم‌نت","region":"iran","reason":"اعلان رسمی قسمت نهم","checked_at":"2026-10-06","source_url":"https://t.me/s/filmnetofficial"}]};
let seriesShowcaseCache;
async function loadSeriesShowcase(){
  if(seriesShowcaseCache)return seriesShowcaseCache;
  try { const d=await getJSON(DATA+"/pendar-series-showcase.json?v="+Date.now(),8000);
    if(Array.isArray(d.items)&&d.items.length) return seriesShowcaseCache=d;
  }catch(_){}
  return seriesShowcaseCache=SERIES_SHOWCASE_SEED;
}
function seriesTitleNorm(s){return String(s||"").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[^a-z0-9\u0600-\u06ff]/g,"");}
async function seriesShowcaseRows(){
  const [data,catalog,master]=await Promise.all([loadSeriesShowcase(),loadMovies(),loadMovieMaster()]);
  const all=[...(catalog.movies||[]),...(master.items||[]).map(_masterMovie)].filter(m=>m.type==="series");
  return {data,rows:data.items.map(row=>{
    const match=all.find(m=>[m.title_fa,m.original_title].some(t=>seriesTitleNorm(t)===seriesTitleNorm(row.title)));
    return {...row,movie:match};
  })};
}
function seriesShowcaseCard(row,detail){
  const m=row.movie, title=m?.title_fa||row.title;
  const href=m?.master_id?"#/master-movie/"+encodeURIComponent(m.master_id):m?.slug?"#/movie/"+encodeURIComponent(m.slug):row.source_url;
  const external=!m;
  const age=Date.now()-Date.parse(row.checked_at+"T00:00:00Z");
  const stale=age>3*86400000;
  return '<article class="series-evidence-card"><a class="trend-card" href="'+esc(href)+'"'+(external?' target="_blank" rel="noopener"':'')+'><span class="trend-cover"><span class="book-cover-placeholder">'+esc(title)+'</span>'+
    ((m?.poster_url||row.poster_url)?'<img class="book-cover" src="'+esc(m?.poster_url||row.poster_url)+'" alt="" loading="lazy" onerror="this.remove()">':'')+
    '</span><strong class="trend-title">'+esc(title)+'</strong><small class="series-platform">'+esc(row.platform)+(row.rank?' · #'+faN(row.rank):'')+'</small></a>'+
    '<small class="series-reason">'+esc(row.reason)+'</small>'+
    (detail?'<p>'+esc(m?.overview_fa||'')+'</p><small>بررسی: '+esc(faN(row.checked_at))+(stale?' · نیازمند بازبینی':'')+'</small><a class="series-source" href="'+esc(row.source_url)+'" target="_blank" rel="noopener">منبع '+(external?'و مشاهده':'')+' ↗</a>':'')+'</article>';
}
let seriesShowcaseRegion="all",seriesShowcasePlatform="all";
async function renderSeriesShowcase(detail=false){
  const el=document.getElementById(detail?"series-showcase-full":"home-series-strip");
  if(!el)return;
  try{
    const {data,rows}=await seriesShowcaseRows();
    if(!document.contains(el))return;
    const platforms=[...new Set(rows.filter(r=>seriesShowcaseRegion==="all"||r.region===seriesShowcaseRegion).map(r=>r.platform))];
    const filters=detail?'<div class="series-filters">'+[["all","همه"],["iran","ایران"],["world","جهان"]].map(([k,label])=>'<button class="fchip '+(seriesShowcaseRegion===k?'on':'')+'" onclick="seriesShowcaseRegion=\''+k+'\';seriesShowcasePlatform=\'all\';renderSeriesShowcase(true)">'+label+'</button>').join('')+'<select aria-label="پلتفرم" onchange="seriesShowcasePlatform=this.value;renderSeriesShowcase(true)"><option value="all">همهٔ پلتفرم‌ها</option>'+platforms.map(p=>'<option '+(seriesShowcasePlatform===p?'selected':'')+'>'+esc(p)+'</option>').join('')+'</select></div>':'';
    el.innerHTML='<div class="trend-head"><h2>ویترین سریال</h2>'+(!detail?'<a class="trend-more" href="#/movies">نمای کامل در جان فیلم ←</a>':'')+'</div>'+filters+
      [["iran","سریال‌های ایران"],["world","سریال‌های جهان"]].filter(([k])=>!detail||seriesShowcaseRegion==="all"||k===seriesShowcaseRegion).map(([k,label])=>{
        let group=rows.filter(r=>r.region===k&&(!detail||seriesShowcasePlatform==="all"||r.platform===seriesShowcasePlatform));
        if(!detail)group=k==="iran"?group.slice(0,4):group.filter(r=>r.rank===1).slice(0,4);
        return '<section class="series-region"><h3>'+label+'</h3><div class="'+(detail?'series-full-grid':'trend-strip')+'">'+group.map(r=>seriesShowcaseCard(r,detail)).join('')+'</div></section>';
      }).join('')+(detail?'<p class="movie-method">جهان: رتبه‌های تجمیعی FlixPatrol؛ ایران: اعلان رسمی قسمت‌ها، بدون ادعای رتبهٔ بینندگان. تاریخ هر کارت مربوط به آخرین بررسی منبع است.</p><p class="movie-method">نماوا: رتبهٔ قابل تأیید در دسترس نیست. <a href="https://www.namava.ir/" target="_blank" rel="noopener">مشاهدهٔ پلتفرم ↗</a></p>':'');
    el.style.display="";
  }catch(_){el.innerHTML='<p class="movie-method">ویترین سریال موقتاً در دسترس نیست. <button onclick="renderSeriesShowcase('+detail+')">تلاش دوباره</button></p>';}
}
