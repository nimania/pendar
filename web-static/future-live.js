/* Future Observatory: client-side candidate discovery, not alerts or verification. */
(function(){
"use strict";
const TERMS={
authority:["مرجع عالی گذار","حکومت موقت","انتقال قدرت","ائتلاف سیاسی","تمرکز قدرت"],
executive:["خدمات عمومی","دولت موقت","اختلال خدمات","مدیریت بحران","دستگاه اجرایی"],
justice:["دادگستری","استقلال قضایی","عدالت انتقالی","دادگاه","قوه قضاییه"],
mahestan:["مجلس مؤسسان","قانون اساسی جدید","مجلس مهستان","تدوین قانون اساسی"],
security:["نیروهای مسلح","ارتش","فرماندهی نظامی","سپاه پاسداران","نیروهای امنیتی"],
economy:["بانک مرکزی","بحران اقتصادی","نظام بانکی","بودجه دولت","تورم"],
watch:["شفافیت","نظارت نهادی","پاسخگویی","تمرکز قدرت","سوءاستفاده از قدرت"],
assembly:["انتخابات","نمایندگی سیاسی","مجلس شورای ملی","مشارکت سیاسی"]
};
const TITLES={authority:"مرجع عالی گذار",executive:"دیوان گذار",justice:"دادگستری گذار",mahestan:"مجلس مهستان",security:"نیروهای نظامی و امنیتی",economy:"نهادهای اقتصادی",watch:"نهاد دیدبانی",assembly:"مجلس شورای ملی"};
const MAX_AGE=90*24*60*60*1000;
const norm=s=>String(s||"").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\u200c/g," ").replace(/\s+/g," ").trim();
const iso=s=>{const x=new Date(s||"");return Number.isNaN(+x)?null:x};
const safeId=id=>typeof id==="string" && /^[a-z0-9_-]{8,100}$/i.test(id)?id:null;
function candidate(s,axis){
 const title=String(s.headline_fa||s.title_fa||s.title||"").trim();
 const published=iso(s.published_at||s.date);
 if(!title||!published||+published>Date.now()+86400000||Date.now()-published>MAX_AGE)return null;
 const matched=(TERMS[axis]||[]).filter(t=>norm(title).includes(norm(t)));
 if(!matched.length)return null;
 const id=safeId(String(s.id||""));if(!id)return null;
 return {id,title,published:published.toISOString(),matched,source_count:Number(s.source_count)||0};
}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function setStatus(target,text){target.replaceChildren(el("p","future-live-status",text))}
async function render(target,axis,limit){
 if(!target)return;setStatus(target,"در حال دریافت خبرهای پندار…");
 try{
  const r=await fetch("/data/stories.json",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();const rows=Array.isArray(d)?d:Array.isArray(d.stories)?d.stories:null;
  if(!rows)throw Error("فرمت مجموعه خبرها شناخته نشد");
  const seen=new Set();const matched=rows.map(x=>candidate(x,axis)).filter(Boolean).sort((a,b)=>b.published.localeCompare(a.published)).filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true}).slice(0,limit);
  target.replaceChildren();
  const pre=el("p","future-live-disclaimer","موارد زیر فقط نامزد بررسی‌اند؛ با تطبیق عبارت در تیتر پیدا شده‌اند، نه با تأیید تحریریه. تعداد منابع، معیار مستقلی برای اعتبار نیست.");target.append(pre);
  if(!matched.length){target.append(el("p","future-live-status","در خبرهای ۹۰ روز اخیر این مجموعه، مورد منطبق یافت نشد. این به معنی نبود رویداد مرتبط نیست."));return}
  const ul=el("ul","future-live-list");for(const x of matched){
   const li=el("li","future-live-item");const a=el("a","",x.title);a.href="/s/"+encodeURIComponent(x.id)+"/";
   const stamp=el("small","",new Date(x.published).toLocaleDateString("fa-IR")+" · عبارت منطبق: "+x.matched.join("، ")+" · شمار منبع در پندار: "+x.source_count);
   li.append(a,stamp);ul.append(li)
  }target.append(ul);
 }catch(_){setStatus(target,"دریافت داده‌های خبری انجام نشد. شاخص‌ها و پرونده‌های پژوهشی همچنان مستقل از این اتصال قابل مشاهده‌اند.")}
}
function start(){document.querySelectorAll("[data-future-live-axis]").forEach(node=>render(node,node.dataset.futureLiveAxis||"authority",8));
const hub=document.querySelector("[data-future-live-hub]");if(hub){const select=el("select","future-live-select");select.setAttribute("aria-label","محور خبرهای نامزد بررسی");for(const [key,title] of Object.entries(TITLES)){const o=document.createElement("option");o.value=key;o.textContent=title;select.append(o)}const target=el("div","future-live-results");hub.append(select,target);select.addEventListener("change",()=>render(target,select.value,15));render(target,select.value,15)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();