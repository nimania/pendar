(() => {
'use strict';
const script = document.currentScript || Array.from(document.scripts).find(s => s.src.endsWith('/app.js'));
const root = new URL('../', script.src);
const fa = n => new Intl.NumberFormat('fa-IR').format(n);
const dayFormat = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',year:'numeric',month:'long',day:'numeric'});
const timeFormat = new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
const norm = s => String(s).normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[\s\u200c]+/g,' ').trim().toLowerCase();
const today = document.getElementById('today-date');
if(today) today.textContent=dayFormat.format(new Date());
document.querySelectorAll('[data-date],[data-datetime]').forEach(el=>{
 const date=new Date(el.dataset.date || el.dataset.datetime);
 if(!isNaN(date)) el.textContent=(el.dataset.datetime?timeFormat:dayFormat).format(date);
});
const filterQ=document.getElementById('filter-q');
if(filterQ){
 const cat=document.getElementById('filter-category');
 const cards=Array.from(document.querySelectorAll('.card'));
 const run=()=>{let n=0;const q=norm(filterQ.value);cards.forEach(c=>{const show=norm(c.dataset.search).includes(q)&&(!cat.value||c.dataset.category===cat.value);c.hidden=!show;if(show)n++;});document.getElementById('result-count').textContent=fa(n)+' نتیجه';document.getElementById('empty-results').hidden=n>0;};
 filterQ.addEventListener('input',run);cat.addEventListener('change',run);run();
}
const searchPage=document.getElementById('search-page');
if(searchPage){
 const q=document.getElementById('search-q'),kind=document.getElementById('search-kind'),status=document.getElementById('search-status'),results=document.getElementById('search-results');
 q.value=new URLSearchParams(location.search).get('q')||'';
 fetch(new URL('assets/search-index.json',root)).then(r=>{if(!r.ok)throw Error('index');return r.json();}).then(index=>{
  const run=()=>{let words=norm(q.value).split(' ').filter(Boolean);let list=index.filter(x=>(!kind.value||x.kind===kind.value)&&words.every(w=>norm([x.title,x.summary,x.extra,...x.topics].join(' ')).includes(w)));
  list.sort((a,b)=>(norm(b.title).includes(norm(q.value))?1:0)-(norm(a.title).includes(norm(q.value))?1:0));
  results.replaceChildren();status.textContent=list.length?fa(list.length)+' نتیجه'+(q.value?' برای «'+q.value+'»':' در پندار'):'نتیجه‌ای پیدا نشد. عبارت کوتاه‌تر یا نوع دیگری را امتحان کنید.';
  list.forEach(x=>{const article=document.createElement('article');article.className='card kind-'+x.kind;const meta=document.createElement('div');meta.className='meta';meta.textContent=x.label+(x.extra?' · '+x.extra:'');const h=document.createElement('h3');const a=document.createElement('a');a.href=new URL(x.url,root);a.textContent=x.title;h.append(a);const p=document.createElement('p');p.textContent=x.summary;article.append(meta,h,p);results.append(article);});
  const url=new URL(location.href);if(q.value)url.searchParams.set('q',q.value);else url.searchParams.delete('q');history.replaceState(null,'',url);
  };q.addEventListener('input',run);kind.addEventListener('change',run);run();
 }).catch(()=>{status.textContent='فهرست جستجو دریافت نشد. صفحه را دوباره بارگذاری کنید یا از منوی بخش‌ها استفاده کنید.';});
}
// Next recurrence: Persian calendar days, normalized to Tehran midnight.
const persian=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric',day:'numeric'});
const offset=3.5*3600000;
const shifted=new Date(Date.now()+offset);
const midnight=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())-offset;
function recurrence(month,day){for(let i=0;i<380;i++){const d=new Date(midnight+i*86400000);const parts=Object.fromEntries(persian.formatToParts(d).map(x=>[x.type,x.value]));if(Number(parts.month)===month&&Number(parts.day)===day)return {days:i,date:d};}return null;}
const festivalCards=Array.from(document.querySelectorAll('[data-festival]'));
festivalCards.forEach(el=>{const next=recurrence(Number(el.dataset.month),Number(el.dataset.day));if(next){el.dataset.order=String(next.days);el.querySelector('.countdown').textContent=(next.days===0?'امروز':fa(next.days)+' روز دیگر')+' · '+dayFormat.format(next.date);}});
if(festivalCards.length)festivalCards.sort((a,b)=>Number(a.dataset.order)-Number(b.dataset.order)).forEach(el=>el.parentNode.append(el));
const nextFestival=document.getElementById('next-festival');
if(nextFestival)fetch(new URL('assets/festivals.json',root)).then(r=>r.json()).then(items=>{const next=items.map(x=>({...x,next:recurrence(x.month,x.day)})).filter(x=>x.next).sort((a,b)=>a.next.days-b.next.days)[0];if(next){nextFestival.textContent=next.title;nextFestival.href=new URL('calendar/'+next.id+'/',root);document.getElementById('festival-countdown').textContent=next.next.days===0?'امروز':fa(next.next.days)+' روز دیگر';}}).catch(()=>{document.getElementById('festival-countdown').textContent='مرور تاریخ آیین‌ها';});
})();
