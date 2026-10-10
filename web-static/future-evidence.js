/* Future evidence radar: filtered discovery, not a forecast or risk score. */
(()=>{"use strict";
const TOPICS={
 politics:{title:"سیاست و دیپلماسی",terms:["سیاست","انتخابات","پارلمان","مجلس","دولت","وزیر","احزاب","ائتلاف","دیپلماسی","رئیس جمهور","مذاکرات","قانون","کابینه","روابط بین الملل"]},
 economy:{title:"اقتصاد و معیشت",terms:["اقتصاد","تورم","ارز","بازار","بودجه","انرژی","تجارت","صادرات","واردات","بانک","نفت","مسکن","سرمایه"]},
 technology:{title:"فناوری و هوش مصنوعی",terms:["فناوری","هوش مصنوعی","اینترنت","دیجیتال","ربات","تراشه","فضا","ماهواره","استارتاپ","تکنولوژی"]},
 environment:{title:"محیط زیست و اقلیم",terms:["اقلیم","محیط زیست","آب","خشکسالی","آلودگی هوا","جنگل","بارندگی","سیل","گرمایش زمین","انرژی پاک"]},
 health:{title:"سلامت و جامعه",terms:["سلامت","بهداشت","درمان","دارو","بیمارستان","آموزش","جمعیت","دانشگاه","پژوهش پزشکی"]},
 region:{title:"منطقه و جهان",terms:["دیپلماسی","مذاکرات","توافق","منطقه","خاورمیانه","اروپا","آمریکا","چین","روسیه","سازمان ملل","تجارت جهانی"]}
};
const norm=x=>String(x||"").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\u200c/g," ").replace(/\s+/g," ").trim();
// Conservative exclusion for this particular editorial view only, not the original archive.
const excludeNames=/خامنه\s*ای|خامنه\s*ئي|khamene[iy]|khamenei/i;
// Page-specific editorial exclusions; no general ban on political news.
const excludeContent=/سرنگونی\s+جمهوری\s+اسلامی|براندازی\s+(?:جمهوری\s+اسلامی|نظام)|سقوط\s+(?:جمهوری\s+اسلامی|نظام)|علیه\s+جمهوری\s+اسلامی|ضد\s+جمهوری\s+اسلامی|اعتراضات\s+ضد\s+حکومتی|anti[- ]islamic\s+republic|overthrow\s+(?:the\s+)?islamic\s+republic/i;
const validId=id=>/^[a-z0-9_-]{8,100}$/i.test(String(id||""));
const safe=x=>String(x||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let news=[],topic="all";
const period=document.getElementById("period"),out=document.getElementById("results"),status=document.getElementById("summary");
function dated(s){const d=new Date(s?.published_at||"");return Number.isNaN(+d)?0:+d}
function categorize(s){const t=norm([s.headline_fa,s.summary_fa,s.category].join(" "));return Object.entries(TOPICS).filter(([,v])=>v.terms.some(term=>t.includes(norm(term)))).map(([k])=>k)}
function allowed(s){const fields=[s.headline_fa,s.summary_fa,s.what_happened_fa,s.why_it_matters_fa,s.category,...(s.entities||[]).map(e=>e.name_fa||e.name||""),...(s.topics||[]).map(t=>t.name_fa||t.name||"")];const t=norm(fields.join(" "));return !excludeNames.test(t)&&!excludeContent.test(t)}
function render(){
 const cutoff=Date.now()-Number(period.value)*86400000,groups={};
 for(const s of news){if(!validId(s.id)||!allowed(s)||dated(s)<cutoff)continue;
  for(const t of categorize(s)){if(topic!=="all"&&topic!==t)continue;(groups[t]??=[]).push(s)}
 }
 out.replaceChildren();let count=0;
 for(const [key,rows] of Object.entries(groups)){
  rows.sort((a,b)=>dated(b)-dated(a));
  const section=document.createElement("section");section.className="card";
  const head=document.createElement("div");head.className="section-head";
  const h=document.createElement("h2");h.textContent=TOPICS[key].title;
  const n=document.createElement("small");n.textContent=rows.length+" خبر مرتبط";head.append(h,n);section.append(head);
  const grid=document.createElement("div");grid.className="story-grid";
  for(const story of rows.slice(0,9)){
   const a=document.createElement("a");a.className="visual-story";a.href="/#/story/"+encodeURIComponent(story.id);
   const media=document.createElement("div");media.className="story-media";
   const src=String(story.image_url||"");
   if(/^https:\/\//i.test(src)){const img=document.createElement("img");img.src=src;img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";img.onerror=()=>{img.remove();media.classList.add("no-image")};media.append(img)}
   else media.classList.add("no-image");
   const mark=document.createElement("span");mark.className="image-fallback";mark.textContent="پندار";media.append(mark);
   const body=document.createElement("div");body.className="story-copy";
   const title=document.createElement("strong");title.textContent=story.headline_fa||"خبر";
   const sub=document.createElement("small");sub.textContent=(story.source_count||0)+" منبع · "+(story.published_at?new Date(story.published_at).toLocaleDateString("fa-IR"):"تاریخ نامشخص");
   body.append(title,sub);a.append(media,body);grid.append(a);count++;
  }
  section.append(grid);out.append(section);
 }
 status.textContent=count+" کارت خبری در "+Object.keys(groups).length+" محور";
 if(!count){const msg=document.createElement("div");msg.className="empty";msg.textContent="در این بازه خبر منطبق با معیارهای انتخاب پیدا نشد.";out.append(msg)}
}

document.getElementById("filters").addEventListener("click",e=>{const b=e.target.closest("button[data-topic]");if(!b)return;topic=b.dataset.topic;for(const btn of document.querySelectorAll("[data-topic]"))btn.setAttribute("aria-pressed",String(btn===b));render()});period.addEventListener("change",render);
fetch("/data/stories.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(data=>{news=Array.isArray(data)?data:[];render()}).catch(()=>{status.textContent="داده‌های خبر در حال حاضر در دسترس نیستند.";out.textContent=""});
})();
