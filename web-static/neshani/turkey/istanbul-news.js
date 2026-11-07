(()=>{"use strict";
const area=document.getElementById("istanbul-news-items"),status=document.getElementById("istanbul-news-status");
if(!area)return;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateText=d=>{try{return new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeZone:"Europe/Istanbul"}).format(new Date(d+"T12:00:00+03:00"))}catch{return d}};
(async()=>{
 try {
  const res=await fetch("./istanbul-news.json",{cache:"no-store"});
  if(!res.ok)throw Error("HTTP "+res.status);
  const doc=await res.json();
  const records=Array.isArray(doc.entries)?doc.entries:[];
  if(!records.length){status.textContent="فعلاً خبر تأییدشده‌ای ثبت نشده است.";return;}
  area.innerHTML=records.map(x=>{
   const expired=x.valid_until&&Date.parse(x.valid_until)<Date.now();
   const label=expired?"اطلاعیه آرشیوی":esc(x.category||"خبر");
   return '<article class="card"><span class="kicker">'+label+' · '+esc(dateText(x.published_date))+'</span><b>'+esc(x.title)+'</b><p>'+esc(x.summary)+'</p><p style="margin-top:12px"><a target="_blank" rel="noopener noreferrer" href="'+esc(x.source_url)+'">منبع رسمی: '+esc(x.source_name)+' ↗</a></p></article>';
  }).join("");
  status.textContent="گزارش‌های انتخابی استانبول؛ تاریخ و منبع در هر خبر مشخص است. اطلاعیه‌های تاریخ‌گذشته در آرشیو مشخص می‌شوند.";
 }catch(e){status.textContent="بارگذاری خبرهای استانبول موقتاً ممکن نیست.";}
})();
})();