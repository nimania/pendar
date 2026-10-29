/* Neshani Turkey: independent, lightweight news module. No homepage scripts. */
(()=>{"use strict";
const container=document.getElementById("neshani-news-items"),status=document.getElementById("neshani-news-status");
if(!container)return;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const turkey=/ترکیه|استانبول|آنکارا|آنتالیا|ازمیر|اردوغان|ترکیش|لیر(?:ِ| |$)|turkey|türkiye|istanbul|ankara|antalya|erdogan/i;
const other=/\b(?:US|IL|RU)\b/;
const arr=x=>Array.isArray(x)?x:Array.isArray(x?.stories)?x.stories:Array.isArray(x?.items)?x.items:[];
const country=s=>(Array.isArray(s.countries)?s.countries:[]).some(c=>/^(TR|turkey|türkiye|ترکیه)$/i.test(String(c?.code||c?.name_fa||c?.name_en||c)));
const sortTime=s=>Date.parse(s.published_at||s.created_at||s.updated_at||"")||0;
async function render(){
try{
 const response=await fetch("/data/stories.json",{cache:"no-store"});
 if(!response.ok)throw new Error("HTTP "+response.status);
 const stories=arr(await response.json());
 const matches=stories.filter(s=>{
   const name=String(s.headline_fa||s.title_fa||s.title||"");
   const summary=String(s.summary_fa||"");
   return (country(s)||turkey.test(name))&&name.length>12&&!other.test(name.slice(0,30));
 }).sort((a,b)=>sortTime(b)-sortTime(a)).slice(0,8);
 if(!matches.length){status.textContent="فعلاً خبر منطبق با ترکیه پیدا نشد.";return;}
 container.innerHTML=matches.map(s=>{
   const title=String(s.headline_fa||s.title_fa||s.title||"");
   const link=/^[0-9a-f-]{36}$/i.test(String(s.id||""))?"/story/"+encodeURIComponent(s.id)+"/":"https://nimania.github.io/jan-kalam/";
   const date=sortTime(s)?new Intl.DateTimeFormat("fa-IR",{day:"numeric",month:"short",timeZone:"Europe/Istanbul"}).format(new Date(sortTime(s))):"";
   return '<article class="card neshani-news-card"><span class="kicker">خبر مرتبط با ترکیه'+(date?" · "+esc(date):"")+'</span><b><a href="'+link+'">'+esc(title)+'</a></b><p>'+esc(String(s.summary_fa||"").slice(0,190))+'</p></article>';
 }).join("");
 status.textContent="گزیدهٔ خودکار خبرهای مرتبط با ترکیه؛ برای جزئیات و منابع، تیتر را باز کنید. آرشیو عمومی خبرها در جان‌کلام است.";
}catch(e){status.textContent="دریافت خبرهای ترکیه فعلاً ممکن نیست. آرشیو عمومی خبرها را در جان‌کلام ببینید.";}
}
render();
})();