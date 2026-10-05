/* Pendar — studio recaps, project finance, and latest videos. Extracted from
   app.js: the studio recap reader + done/queue/font state (STUDIO_DONE_KEY,
   STUDIO_FONT_KEY, _studioQueueMode, showStudioRecaps, openStudioRecap,
   requestStudioRecap, copyStudioRecap), the project-finance page
   (_financeNum/_financeUsd, showProjectFinance) and the latest-videos view
   (showLatestVideos). Loaded as a classic script BEFORE app.js because
   route() reaches these on deep links. Uses app.js loaders
   (loadStudioRecaps, loadProjectFinance), the _PROJECT_FINANCE cache and
   helpers (openStatement, figureCard, youtubeRecapEmbed) at runtime.
   No behavior change. */

function _studioRecapBodyHtml(text) {
  const parts = String(text || "").split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  return parts.map(p => {
    const plain = p.replace(/^#+\s*/, "").trim();
    if (/^جان کلام[：:]?$/.test(plain)) return '<h2>جان کلام</h2>';
    if (/^#{1,3}\s+/.test(p)) return '<h2>'+esc(plain)+'</h2>';
    return '<p>'+esc(p).replace(/\n/g,"<br>")+'</p>';
  }).join("");
}
async function copyStudioRecap(id, btn) {
  const rows=await loadStudioRecaps();
  const row=rows.find(x=>String(x.id)===String(id));
  if(!row) return;
  try {
    await navigator.clipboard.writeText(String(row.studio_recap_fa||""));
    if(btn){const old=btn.textContent;btn.textContent="کپی شد ✓";setTimeout(()=>{btn.textContent=old},1600);}
  } catch (_) {
    if(btn) btn.textContent="کپی نشد";
  }
}
function _financeNum(v){const n=Number(v||0);return faN(n.toLocaleString("en-US"))}
function _financeUsd(v){const n=Number(v||0);return "$"+n.toFixed(n<0.01?4:2)}
async function showProjectFinance(){
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const d=await loadProjectFinance();
  const t=d.totals||{}, rows=Array.isArray(d.videos)?d.videos:[];
  const videos=Number(t.videos_seen_by_ai||0);
  const per100=videos>0?(Number(t.estimated_paid_usd||0)/videos)*100:0;
  document.title="مالی پروژه | پندار";
  setHash("#/finance");
  el.innerHTML=`<div class="finance-wrap">
    <div class="latest-videos-head">
      <button class="back" onclick="showStudioRecaps()">بازگشت به استودیو</button>
      <div><span class="press-kicker">پندار · حسابداری پروژه</span><h1>مالی پروژه</h1>
      <p>مصرف API و هزینهٔ برآوردی پردازش ویدئوها از زمان فعال شدن ثبت مالی.</p></div>
    </div>
    <div class="finance-grid">
      <article class="finance-metric"><span>ویدئوهای پردازش‌شده</span><b>${_financeNum(videos)}</b><small>ویدئوهایی که AI برایشان مصرف ثبت کرده</small></article>
      <article class="finance-metric"><span>فراخوانی Gemini</span><b>${_financeNum(t.ai_calls||0)}</b><small>${_financeNum(t.total_tokens||0)} توکن کل</small></article>
      <article class="finance-metric"><span>هزینهٔ مرجع AI</span><b class="finance-money">${_financeUsd(t.estimated_paid_usd||0)}</b><small>برآورد Paid Tier؛ الزاماً مبلغ صورتحساب نیست</small></article>
      <article class="finance-metric"><span>برآورد ۱۰۰ ویدئو</span><b class="finance-money">${videos?_financeUsd(per100):"—"}</b><small>بر اساس میانگین مصرف واقعی ثبت‌شده</small></article>
      <article class="finance-metric"><span>Input tokens</span><b>${_financeNum(t.prompt_tokens||0)}</b><small>توکن‌های ورودی Gemini</small></article>
      <article class="finance-metric"><span>Output tokens</span><b>${_financeNum(t.completion_tokens||0)}</b><small>توکن‌های خروجی Gemini</small></article>
      <article class="finance-metric"><span>DownSub requests</span><b>${_financeNum(t.downsub_requests||0)}</b><small>${_financeNum(t.downsub_http_200||0)} پاسخ HTTP 200</small></article>
      <article class="finance-metric"><span>AI بدون نرخ شناخته‌شده</span><b>${_financeNum(t.unpriced_ai_calls||0)}</b><small>برای این درخواست‌ها برآورد دلاری صفر منظور شده</small></article>
    </div>
    <div class="finance-note">
      مبلغ AI «هزینهٔ مرجع» است: اگر API روی Free Tier باشد هزینهٔ واقعی می‌تواند صفر باشد.
      نرخ مرجع فعلی برای Gemini 2.5 Flash-Lite برابر $0.10 ورودی و $0.40 خروجی به‌ازای هر یک میلیون توکن، و برای Gemini 2.5 Flash برابر $0.30 و $2.50 است.
      برای DownSub فعلاً فقط تعداد درخواست‌ها ثبت می‌شود و تا زمانی که قاعدهٔ دقیق تبدیل request به credit را قطعی نکنیم، دلار تخمینی نمی‌زنیم.
      ${d.updated_at?` آخرین ثبت: ${_sysTime(d.updated_at)}.`:""}
    </div>
    <div class="rule"><span>ریز مصرف ویدئوها</span><span class="l"></span></div>
    ${rows.length?`<table class="finance-table"><thead><tr><th>ویدئو</th><th>AI calls</th><th>Input</th><th>Output</th><th>AI est.</th><th>DownSub</th></tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td><span class="finance-video-title"><b>${esc(r.topic_fa||r.video_title||r.video_id||"ویدئو")}</b><small>${esc(r.name_fa||"")}${r.last_at?" · "+relTime(r.last_at):""}</small></span></td>
        <td>${_financeNum(r.ai_calls||0)}</td>
        <td>${_financeNum(r.prompt_tokens||0)}</td>
        <td>${_financeNum(r.completion_tokens||0)}</td>
        <td><span class="finance-money">${_financeUsd(r.estimated_paid_usd||0)}</span></td>
        <td>${_financeNum(r.downsub_requests||0)}</td>
      </tr>`).join("")}
    </tbody></table>`:'<div class="finance-empty">هنوز مصرفی ثبت نشده؛ از Build بعدی این جدول پر می‌شود.</div>'}
  </div>`;
}

const STUDIO_DONE_KEY="pendar_studio_recorded_v1";
const STUDIO_FONT_KEY="pendar_studio_font_v1";
let _studioQueueMode="pending";
function studioDoneSet(){try{return new Set(JSON.parse(localStorage.getItem(STUDIO_DONE_KEY)||"[]"))}catch(_){return new Set()}}
function studioIsDone(id){return studioDoneSet().has(String(id))}
function toggleStudioDone(id,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const s=studioDoneSet(),k=String(id);s.has(k)?s.delete(k):s.add(k);localStorage.setItem(STUDIO_DONE_KEY,JSON.stringify([...s]));if(location.hash.startsWith("#/studio-recap/"))openStudioRecap(id);else showStudioRecaps(_studioQueueMode)}
function setStudioQueueMode(mode){_studioQueueMode=mode;showStudioRecaps(mode)}
function studioFontSize(){const n=Number(localStorage.getItem(STUDIO_FONT_KEY)||18);return Math.min(30,Math.max(16,n||18))}
function adjustStudioFont(delta){const n=Math.min(30,Math.max(16,studioFontSize()+delta));localStorage.setItem(STUDIO_FONT_KEY,String(n));const el=document.querySelector(".studio-recap-body");if(el)el.style.setProperty("--studio-font-size",n+"px")}
async function showStudioRecaps(mode = _studioQueueMode) {
  _studioQueueMode=mode||"pending";
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const allRows=(await loadStudioRecaps()).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const done=studioDoneSet();
  const rows=_studioQueueMode==="done"?allRows.filter(r=>done.has(String(r.id))):_studioQueueMode==="all"?allRows:allRows.filter(r=>!done.has(String(r.id)));
  const pendingCount=allRows.filter(r=>!done.has(String(r.id))).length;
  document.title="استودیوی ضبط جان کلام | پندار";
  setHash("#/studio-recaps");
  el.innerHTML=`
    <div class="latest-videos-head">
      <button class="back" onclick="showLatestVideos('recaps')">بازگشت به ویدئوها</button>
      <div><span class="press-kicker">استودیوی ضبط جان کلام</span><h1>صف آمادهٔ ضبط</h1>
      <p>نسخه‌های مفصل و انتخاب‌شده برای خواندن مستقیم، ضبط و انتشار در یوتیوب.</p></div>
      <div class="latest-videos-stats"><span><b>${faN(pendingCount)}</b> برای ضبط</span><span><b>${faN(allRows.length)}</b> کل</span></div>
    </div>
    <div class="studio-queue-tools">
      <div class="studio-queue-filters">
        <button class="${_studioQueueMode==="pending"?"on":""}" onclick="setStudioQueueMode('pending')">برای ضبط · ${faN(pendingCount)}</button>
        <button class="${_studioQueueMode==="all"?"on":""}" onclick="setStudioQueueMode('all')">همه · ${faN(allRows.length)}</button>
        <button class="${_studioQueueMode==="done"?"on":""}" onclick="setStudioQueueMode('done')">ضبط‌شده · ${faN(allRows.length-pendingCount)}</button>
      </div>
      <div class="studio-queue-filters"><button onclick="showProjectFinance()">مالی پروژه</button></div>
    </div>
    ${rows.length?`<div class="studio-recap-list">${rows.map(r=>`
      <article class="studio-recap-card ${done.has(String(r.id))?"done":""}">
        <div class="studio-recap-card-meta"><span>${esc(r.name_fa||"")}</span><span>·</span><span>${r.published_at?relTime(r.published_at):""}</span><span>·</span><span>${faN(r.word_count||String(r.studio_recap_fa||"").split(/\s+/).filter(Boolean).length)} واژه</span>${done.has(String(r.id))?'<span class="studio-recorded">· ضبط شد ✓</span>':""}</div>
        <h2>${esc(r.topic_fa||r.video_title||"نسخهٔ ضبط")}</h2>
        <p>${esc(r.summary_fa||"")}</p>
        <div class="studio-recap-card-actions">
          <button class="primary" onclick="openStudioRecap('${String(r.id||"").replace(/'/g,"\\'")}')">${done.has(String(r.id))?"باز کردن متن":"شروع ضبط"}</button>
          <button onclick="toggleStudioDone('${String(r.id||"").replace(/'/g,"\\'")}',event)">${done.has(String(r.id))?"برگردان به صف":"ضبط شد ✓"}</button>
        </div>
      </article>`).join("")}</div>`:`<div class="state"><div class="big">${_studioQueueMode==="pending"?"صف ضبط خالی است.":"موردی در این بخش نیست."}</div></div>`}
  `;
}
async function openStudioRecap(id) {
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede"); if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline"); if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures"); if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const rows=(await loadStudioRecaps()).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const idx=rows.findIndex(x=>String(x.id)===String(id));
  const r=idx>=0?rows[idx]:null;
  if(!r){el.innerHTML='<div class="state"><div class="big">این نسخهٔ ضبط پیدا نشد.</div></div>';return;}
  const newer=idx>0?rows[idx-1]:null;
  const older=idx<rows.length-1?rows[idx+1]:null;
  const done=studioIsDone(r.id);
  document.title=(r.topic_fa||r.video_title||"نسخهٔ ضبط")+" | استودیو";
  setHash("#/studio-recap/"+encodeURIComponent(String(r.id||"")));
  el.innerHTML=`<article class="studio-recap-article ${done?"recorded":""}">
    <button class="back" onclick="showStudioRecaps()">بازگشت به صف ضبط</button>
    <span class="press-kicker">استودیو جان کلام · ${esc(r.name_fa||"")}</span>
    <h1>${esc(r.topic_fa||r.video_title||"نسخهٔ ضبط")}</h1>
    <div class="studio-recap-byline">${esc(r.video_title||"")}${r.word_count?` · ${faN(r.word_count)} واژه`:""}${r.published_at?` · ${relTime(r.published_at)}`:""}</div>
    <div class="studio-recap-toolbar">
      <button class="primary" onclick="copyStudioRecap('${String(r.id||"").replace(/'/g,"\\'")}',this)">کپی متن</button>
      <button onclick="toggleStudioDone('${String(r.id||"").replace(/'/g,"\\'")}',event)">${done?"برگردان به صف":"ضبط شد ✓"}</button>
      <span class="studio-font-tools"><button onclick="adjustStudioFont(-1)">A−</button><button onclick="adjustStudioFont(1)">A+</button></span>
      <a href="${esc(r.url||"#")}" target="_blank" rel="noopener">ویدئوی اصلی ↗</a>
    </div>
    ${youtubeRecapEmbed(r.video_id||r.url, r.video_title||r.topic_fa||"ویدئوی اصلی")}
    <div class="studio-recap-body" style="--studio-font-size:${studioFontSize()}px">${_studioRecapBodyHtml(r.studio_recap_fa)}</div>
    <div class="studio-reader-nav">
      <div>${newer?`<button onclick="openStudioRecap('${String(newer.id||"").replace(/'/g,"\\'")}')">→ جدیدتر</button>`:""}</div>
      <div>${older?`<button onclick="openStudioRecap('${String(older.id||"").replace(/'/g,"\\'")}')">قدیمی‌تر ←</button>`:""}</div>
    </div>
  </article>`;
}
function requestStudioRecap(videoId) {
  const id=youtubeVideoId(videoId);
  if(!id) return;
  const title="[studio] "+id;
  const body="درخواست ساخت نسخهٔ ضبط پندار برای این ویدئو:\n\nhttps://www.youtube.com/watch?v="+id+"\n\nپس از ثبت این درخواست توسط حساب nimania، پردازش عمیق فقط برای همین ویدئو اجرا می‌شود.";
  const url="https://github.com/nimania/pendar/issues/new?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body);
  window.open(url,"_blank","noopener,noreferrer");
}

async function showLatestVideos(mode = "all") {
  show("figures"); setTab("");
  const lede=document.getElementById("figures-lede");
  if(lede) lede.style.display="none";
  const timeline=document.getElementById("figure-timeline");
  if(timeline) timeline.innerHTML="";
  const el=document.getElementById("figures");
  if(!el) return;
  el.innerHTML='<div class="spinner"></div>';
  const [d,studioRows]=await Promise.all([loadFigures(),loadStudioRecaps()]);
  const studioByVideo=new Map((studioRows||[]).map(r=>[String(r.video_id||""),
    r]));
  const byVideo=new Map();
  for(const person of (d.figures||[])){
    for(const v of (person.youtube_videos||[])){
      if(!v || !v.url) continue;
      const key=String(v.id||v.url);
      let row=byVideo.get(key);
      if(!row){
        row={...v,people:[]};
        byVideo.set(key,row);
      } else if (!row.recap_fa && v.recap_fa) {
        // Preserve recap enrichment if a shared video is attached to more than one person.
        row={...row,...v,people:row.people};
        byVideo.set(key,row);
      }
      if(!row.people.some(p=>String(p.handle).toLowerCase()===String(person.handle).toLowerCase())){
        row.people.push({handle:person.handle,name_fa:person.name_fa,avatar:person.avatar,role_fa:person.role_fa,directory:person.directory!==false});
      }
    }
  }
  const videos=[...byVideo.values()].sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const recapVideos=videos.filter(v=>String(v.recap_fa||"").trim());
  const recapsOnly=mode==="recaps";
  const studioCount=(studioRows||[]).length;
  const visibleVideos=recapsOnly?recapVideos:videos;
  const peopleCount=new Set(videos.flatMap(v=>v.people.filter(p=>p.directory!==false).map(p=>String(p.handle).toLowerCase()))).size;
  const sourceCount=new Set(videos.flatMap(v=>v.people.filter(p=>p.directory===false).map(p=>String(p.handle).toLowerCase()))).size;
  document.title=(recapsOnly?"جان کلام ویدئوهای چهره‌ها":"آخرین ویدئوهای چهره‌ها")+" | پندار";
  setHash(recapsOnly?"#/videos/recaps":"#/videos");
  el.innerHTML=`
    <div class="latest-videos-head">
      <button class="back" onclick="showFigures()">بازگشت به چهره‌ها</button>
      <div><span class="press-kicker">چهره‌ها · ویدئو</span><h1>${recapsOnly?"جان کلام ویدئوها":"آخرین ویدئوها"}</h1>
      <p>${recapsOnly?"ویدئوهایی که متن آن‌ها به «جان کلام» حرفه‌ای و وفادارانه تبدیل شده است.":"تازه‌ترین ویدئوهای چهره‌های پندار؛ از کانال‌های رسمی و حضورهای شناسایی‌شده در میزبان‌های معتبر."}</p></div>
      <div class="latest-videos-stats">
        <button class="${!recapsOnly?"on":""}" onclick="showLatestVideos('all')"><b>${faN(videos.length)}</b> ویدئو</button>
        <span><b>${faN(peopleCount)}</b> چهره</span>${sourceCount?`<span><b>${faN(sourceCount)}</b> منبع</span>`:""}
        ${recapVideos.length?`<button class="${recapsOnly?"on":""}" onclick="showLatestVideos('recaps')"><b>${faN(recapVideos.length)}</b> ≣ جان کلام</button>`:""}
        <button onclick="showStudioRecaps()" title="نسخه‌های ضبط آماده" aria-label="نسخه‌های ضبط آماده">${studioCount?`<b>${faN(studioCount)}</b> `:""}✦</button>
      </div>
    </div>
    ${visibleVideos.length?`<div class="latest-videos-grid">${visibleVideos.slice(0,120).map(v=>`
      <article class="latest-video-card">
        <a class="latest-video-main" href="${esc(v.url)}" target="_blank" rel="noopener">
          <span class="figure-youtube-thumb">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy">`:""}<span class="figure-youtube-play">▶</span></span>
          <span class="latest-video-copy"><b>${esc(v.title||"ویدئوی یوتیوب")}</b><small>${v.published_at?relTime(v.published_at):"YouTube"} · YouTube ↗</small></span>
        </a>
        <div class="latest-video-people">${v.people.map(p=>p.directory!==false?`<button onclick="openFigure('${String(p.handle||"").replace(/'/g,"\\'")}')">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:""}<span>${esc(p.name_fa||"")}</span></button>`:`<span class="latest-video-source">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:""}<span>${esc(p.name_fa||"")}</span></span>`).join("")}</div>
        ${v.recap_fa?`<div class="latest-video-actions"><button onclick="openStatement('youtube-${String(v.id||"").replace(/'/g,"\\'")}')">≣ <span>جان کلام</span></button>${studioByVideo.has(String(v.id||""))?`<button class="studio-mark ready" onclick="openStudioRecap('${String(studioByVideo.get(String(v.id||"")).id||"").replace(/'/g,"\\'")}')" title="نسخهٔ ضبط آماده" aria-label="نسخهٔ ضبط آماده">✦</button>`:`<button class="studio-mark request" onclick="requestStudioRecap('${String(v.id||"").replace(/'/g,"\\'")}')" title="ساخت نسخهٔ ضبط" aria-label="ساخت نسخهٔ ضبط">✧</button>`}</div>`:""}
      </article>`).join("")}</div>`:`<div class="state"><div class="big">${recapsOnly?"هنوز جان کلامی آماده نشده":"هنوز ویدئویی برای چهره‌ها پیدا نشده"}</div></div>`}
  `;
}
