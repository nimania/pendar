/* Future evidence radar: filtered discovery, not a forecast or risk score. */
(()=>{"use strict";
const TOPICS={
 economy:{title:"اقتصاد و معیشت",terms:["اقتصاد","تورم","ارز","بازار","بودجه","انرژی","تجارت","صادرات","واردات","بانک","نفت","مسکن","سرمایه"]},
 technology:{title:"فناوری و هوش مصنوعی",terms:["فناوری","هوش مصنوعی","اینترنت","دیجیتال","ربات","تراشه","فضا","ماهواره","استارتاپ","تکنولوژی"]},
 environment:{title:"محیط زیست و اقلیم",terms:["اقلیم","محیط زیست","آب","خشکسالی","آلودگی هوا","جنگل","بارندگی","سیل","گرمایش زمین","انرژی پاک"]},
 health:{title:"سلامت و جامعه",terms:["سلامت","بهداشت","درمان","دارو","بیمارستان","آموزش","جمعیت","دانشگاه","پژوهش پزشکی"]},
 region:{title:"منطقه و جهان",terms:["دیپلماسی","مذاکرات","توافق","منطقه","خاورمیانه","اروپا","آمریکا","چین","روسیه","سازمان ملل","تجارت جهانی"]}
};
const norm=x=>String(x||"").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\u200c/g," ").replace(/\s+/g," ").trim();
// Conservative exclusion for this particular editorial view only, not the original archive.
const excludeNames=/خامنه\\s*ای|خامنه\\s*ئي|khamenei|khamene[iy]|mojtaba\\s+khamenei|ali\\s+khamenei/i;
// Conservative editorial filtering for this radar. Filtering is confined to this view.
const excludeContent=/جمهوری\\s+اسلامی|سرنگونی|براندازی|ضد\\s*(?:حکومت|حکومتی|نظام|جمهوری)|اعتراضات\\s+ضد\\s+حکومتی|مخالفان\\s+حکومت|رژیم\\s+ایران|دیکتاتوری\\s+مذهبی|سقوط\\s+حکومت|تغییر\\s+رژیم|islamic\\s+republic|regime\\s+change|anti[- ]regime/i;
const excludedCategories=/^(politics|political|سیاست|سیاسی)$/i;
const validId=id=>/^[a-z0-9_-]{8,100}$/i.test(String(id||""));
const safe=x=>String(x||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let news=[],topic="all";
const period=document.getElementById("period"),out=document.getElementById("results"),status=document.getElementById("summary");
function dated(s){const d=new Date(s?.published_at||"");return Number.isNaN(+d)?0:+d}
function categorize(s){const t=norm([s.headline_fa,s.summary_fa,s.category].join(" "));return Object.entries(TOPICS).filter(([,v])=>v.terms.some(term=>t.includes(norm(term)))).map(([k])=>k)}
function allowed(s){const fields=[s.headline_fa,s.summary_fa,s.what_happened_fa,s.why_it_matters_fa,s.category,...(s.entities||[]).map(e=>e.name_fa||e.name||""),...(s.topics||[]).map(t=>t.name_fa||t.name||"")];const t=norm(fields.join(" "));return !excludedCategories.test(norm(s.category))&&!excludeNames.test(t)&&!excludeContent.test(t)}
function render(){const cutoff=Date.now()-Number(period.value)*86400000;const groups={};for(const s of news){if(!validId(s.id)||!allowed(s)||dated(s)<cutoff)continue;for(const t of categorize(s)){if(topic!=="all"&&topic!==t)continue;(groups[t]??=[]).push(s)}}out.replaceChildren();let count=0;for(const [key,rows] of Object.entries(groups)){rows.sort((a,b)=>dated(b)-dated(a));const card=document.createElement("section");card.className="card";const h=document.createElement("h2");h.textContent=TOPICS[key].title;card.append(h);for(const s of rows.slice(0,12)){const row=document.createElement("div");row.className="story";const a=document.createElement("a");a.href="/#/story/"+encodeURIComponent(s.id);a.textContent=s.headline_fa||"خبر";const sub=document.createElement("small");sub.textContent=(s.source_count||0)+" منبع · "+(s.published_at?new Date(s.published_at).toLocaleDateString("fa-IR"):"تاریخ نامشخص");row.append(a,sub);card.append(row);count++}out.append(card)}status.textContent=count+" پیوند خبری در "+Object.keys(groups).length+" محور؛ خبرهای تکراری میان محورها ممکن است ظاهر شوند.";if(!count){const msg=document.createElement("div");msg.className="empty";msg.textContent="در این بازه و با این معیارهای گزینش، خبر مناسبی پیدا نشد.";out.append(msg)}}
document.getElementById("filters").addEventListener("click",e=>{const b=e.target.closest("button[data-topic]");if(!b)return;topic=b.dataset.topic;for(const btn of document.querySelectorAll("[data-topic]"))btn.setAttribute("aria-pressed",String(btn===b));render()});period.addEventListener("change",render);
fetch("/data/stories.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(data=>{news=Array.isArray(data)?data:[];render()}).catch(()=>{status.textContent="داده‌های خبر در حال حاضر در دسترس نیستند.";out.textContent=""});
})();
