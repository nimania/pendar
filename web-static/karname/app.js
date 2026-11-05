/* Pendar / Karname: public claims dashboard.
   All displayed claims and results come exclusively from /data/karname.json. */
(()=>{
"use strict";
const DATA_URL="/data/karname.json", $=id=>document.getElementById(id);
const state={data:null,claims:[],speakers:[],buckets:[],pairs:[],families:[],tab:"highlights",query:"",speaker:"",status:"",portraits:{},externalPortraits:{},figures:[]};
const labels={
  highlights:["منتخب کارنامه","پیش‌بینی‌ها زیر ذره‌بین","تازه‌ترین پرونده‌ها، با متن اصلی و منابع."],
  people:["کارنامهٔ چهره‌ها","چه کسی چه گفته؟","امتیاز فقط برای پیش‌بینی‌های ارزیابی‌شده است."],
  duels:["دو تحلیل؛ یک آینده","دوئل پیش‌بینی‌ها","دیدگاه‌های متفاوت را کنار هم ببینید."],
  calendar:["زمان حسابرسی","موعد رسید!","سررسیدهای گذشته و پیش‌بینی‌های در انتظار."],
  scenarios:["نقشهٔ دیدگاه‌ها","چه کسی کدام آینده را می‌بیند؟","گرایش به یک سناریو، نمرهٔ عملکرد نیست."],
  all:["بانک پیش‌بینی‌ها","همهٔ پیش‌بینی‌ها","جست‌وجو و فیلتر در پرونده‌های مستند."]
};
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function fa(v){return new Intl.NumberFormat("fa-IR",{maximumFractionDigits:1}).format(Number(v)||0);}
function array(v){return Array.isArray(v)?v:[];}
function objects(v){return Array.isArray(v)?v:Object.entries(v||{}).map(([key,val])=>typeof val==="object"&&val?{key,...val}:{key,label:String(val)});}
function norm(v){return String(v??"").replace(/[\u200c\u200e\u200f]/g,"").toLowerCase().trim();}
function speakerId(v){return typeof v==="object"&&v?(v.key||v.handle||v.name||""):String(v??"");}
function speaker(v){let id=speakerId(v),s=state.speakers.find(x=>[x.key,x.handle,x.name].includes(id));return s?.name||id;}
function people(c){return array(c.speakers).map(speaker).filter(Boolean);}
function personNorm(v){
 return String(v||"").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/ؤ/g,"و")
 .replace(/[\u200c\u200e\u200f]/g," ").replace(/[\u064b-\u065f]/g,"")
 .replace(/\s*\([^)]*\)/g,"").replace(/^سید\s+/g,"").replace(/[،,]/g," ")
 .toLowerCase().replace(/\s+/g," ").trim();
}
function matchedFigure(s){
 const list=state.figures,requested=String(s?.handle||s?.key||"").toLowerCase();
 const exact=list.filter(f=>String(f.handle||"").toLowerCase()===requested);
 if(exact.length===1)return exact[0];
 const byName=list.filter(f=>personNorm(f.name_fa)===personNorm(s?.name));
 return byName.length===1?byName[0]:null;
}
function profileHandle(s){
 const found=matchedFigure(s);
 if(found&&/^[A-Za-z0-9_-]{2,80}$/.test(String(found.handle)))return found.handle;
 // Existing verified local portrait / identity, even when figures.json is unreachable.
 if(s?.key==="abbas-souri")return "abbas-souri";
 return "";
}
function personRecord(v){
 const id=speakerId(v);
 return state.speakers.find(x=>[x.key,x.handle,x.name].includes(id))||{key:id,name:id};
}
function safePhotoURL(src){
 if(typeof src!=="string")return "";
 if(/^\/?figures\/[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp)$/i.test(src))
   return src[0]==="/"?src:"/"+src;
 if(/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]+$/i.test(src))
   return src;
 return "";
}
function portraitPath(s){
 const found=matchedFigure(s),handle=found?.handle||profileHandle(s);
 const local=handle?state.portraits[handle]:"";
 if(safePhotoURL(local))return safePhotoURL(local);
 // Use the actual Pendar figure portrait, not a guessed search result.
 const existing=safePhotoURL(found?.avatar);
 if(existing)return existing;
 const fallback=state.externalPortraits[s?.key];
 return fallback?.verified_identity_match===true?safePhotoURL(fallback.image_url):"";
}
function avatarMarkup(s){
 const photo=portraitPath(s),initial=esc(String(s?.name||s?.key||"?").slice(0,1));
 return '<span class="avatar" aria-hidden="true"><span class="avatar-initial">'+initial+'</span>'
 +(photo?'<img src="'+esc(photo)+'" loading="lazy" decoding="async" alt="">':"")+'</span>';
}
function personHref(s){const h=profileHandle(s);return h?'/@'+encodeURIComponent(h)+'/':"";}
function contributorLinks(c){
 const people=array(c.speakers).map(personRecord),top=people.slice(0,2);
 const links=top.map(s=>{
  const href=personHref(s),body=avatarMarkup(s)+'<span>'+esc(s.name||s.key)+'</span>';
  return href?'<a class="claim-person" href="'+esc(href)+'" aria-label="پروندهٔ '+esc(s.name||s.key)+' در پندار">'+body+'</a>':'<span class="claim-person">'+body+'</span>';
 }).join("");
 return '<div class="claim-contributors" aria-label="گویندگان این ادعا">'+links+(people.length>top.length?'<span class="claim-extra">و '+fa(people.length-top.length)+' نفر دیگر</span>':"")+'</div>';
}
function excluded(c){let t=norm(c.type||"")+" "+norm(c.type_class||"");return /نقل[\s\u064B-\u065F‌]*گزارش|توصیه|reported|recommendation/.test(t);}
function bucket(c){return state.buckets.find(x=>x.key===c.bucket||x.id===c.bucket)||{};}
function due(c){let b=bucket(c),raw=b.date||b.date_iso||b.due||b.deadline||b.iso||"";if(!/^\d{4}-\d\d-\d\d$/.test(String(raw)))return null;let d=new Date(raw+"T23:59:59Z");return Number.isNaN(d.getTime())?null:d;}
function result(c){
  if(c.result===null||c.result===undefined||c.result==="")return null;
  let r=typeof c.result==="object"?(c.result.key||c.result.label||c.result.status||""):String(c.result);
  let scale=objects(state.data?.scale);
  let s=scale.find(x=>[x.key,x.mark,x.symbol,x.icon,x.label].filter(Boolean).includes(r));
  let t=norm([r,s?.label,s?.key].filter(Boolean).join(" "));
  let pts=s?.score??s?.points;
  if(/نیمه.?درست|نسبتا.?درست|partial|half/.test(t)||pts===0.5)return {key:"half",label:"نیمه‌درست",points:.5};
  if(/نادرست|غلط|incorrect|false|wrong|❌|🔴/.test(t)||pts===0)return {key:"bad",label:"نادرست",points:0};
  if(/شرط.*رخ نداد|شرط.*محقق نشد|condition.*not|void|⊘/.test(t))return {key:"open",label:"شرط رخ نداد",points:null};
  if(/در انتظار|معلق|نامشخص|pending|final/.test(t))return {key:"wait",label:"منتظر نتیجهٔ نهایی",points:null};
  if(/درست|صحیح|correct|true|✅|🟢/.test(t)||pts===1)return {key:"good",label:"درست",points:1};
  return {key:"wait",label:String(s?.label||r),points:null};
}
function status(c){
  if(c.kind==="L")return {key:"open",label:"بلندمدت",points:null};
  let r=result(c);if(r)return r;
  let d=due(c);if(d&&d.getTime()<Date.now())return {key:"wait",label:"موعد گذشته؛ منتظر بررسی",points:null};
  if(/(?:^|-)e[23]$/.test(c.bucket||""))return {key:"open",label:"منتظر شرط",points:null};
  return {key:"open",label:"هنوز باز است",points:null};
}
function scorable(c){return c.kind!=="L"&&!excluded(c)&&result(c)?.points!=null;}
function score(list){
 const graded=list.filter(scorable),n=graded.length;
 return {n,percent:n?fa(100*graded.reduce((total,c)=>total+result(c).points,0)/n)+"٪":"هنوز نمره‌ای نیست",number:n?100*graded.reduce((total,c)=>total+result(c).points,0)/n:null};
}
function pills(c){let s=status(c);return '<span class="pill '+s.key+'">'+esc(s.label)+'</span>';}
function claimText(c){return String(c.text||c.speaker_note||"بدون شرح").trim();}
function titleText(c){return claimText(c).slice(0,135);}
function mini(c,index){
 return '<article class="tile '+(index===0&&state.tab==="highlights"?"tile-hero":"")+'">'
 +contributorLinks(c)
 +'<button class="open-card" type="button" data-claim="'+esc(c.id)+'" aria-label="مشاهدهٔ پروندهٔ '+esc(c.id)+'">'
 +'<div class="meta-line">'+pills(c)+'<span dir="ltr">'+esc(c.id||"")+'</span></div>'
 +'<h3 class="tile-title">'+esc(titleText(c))+'</h3>'
 +'<p class="tile-copy">'+esc(c.said||bucket(c).label||"تاریخ نامشخص")+'</p>'
 +'<div class="tile-foot"><span>متن، شرط و شواهد</span><strong>مشاهده ←</strong></div></button></article>';
}
function noData(title,txt){return '<div class="empty"><h3>'+esc(title)+'</h3><p>'+esc(txt)+'</p></div>';}
function setHeading(){
 let l=labels[state.tab],heading=$("panel-title");
 heading.innerHTML='<div><p class="eyebrow">'+esc(l[0])+'</p><h2>'+esc(l[1])+'</h2></div><p>'+esc(l[2])+'</p>';
 document.querySelectorAll(".tabs [data-tab]").forEach(btn=>{let active=btn.dataset.tab===state.tab;btn.classList.toggle("active",active);btn.setAttribute("aria-selected",String(active));});
}
function showClaims(filtered){
 if(!filtered.length)return noData("پرونده‌ای برای نمایش پیدا نشد","فیلترها را تغییر دهید یا منتظر ورود داده‌های مستند کارنامه باشید.");
 return filtered.map(mini).join("");
}
function renderHighlights(){
 let ranked=[...state.claims].sort((a,b)=>{
   const rank=c=>{let s=status(c);return (s.key==="wait"?4:0)+(s.key==="good"||s.key==="bad"||s.key==="half"?3:0)+(c.kind==="K"?1:0)};
   return rank(b)-rank(a)||String(b.said||"").localeCompare(String(a.said||""));
 });
 return showClaims(ranked.slice(0,12));
}
function renderPeople(){
 let rows=state.speakers.map(s=>{let claims=state.claims.filter(c=>array(c.speakers).some(v=>speakerId(v)===(s.key||s.name)));return {s,claims,score:score(claims)};}).filter(x=>x.claims.length).sort((a,b)=>b.claims.length-a.claims.length);
 if(!rows.length)return noData("هنوز کارنامه‌ای ثبت نشده","نام تحلیلگران پس از اتصال بانک داده در این قسمت ظاهر می‌شود.");
 return rows.map(x=>{
  let {s,claims}=x,good=claims.filter(c=>status(c).key==="good").length,half=claims.filter(c=>status(c).key==="half").length,bad=claims.filter(c=>status(c).key==="bad").length,other=claims.length-good-half-bad;
  let total=claims.length;let parts=[["good",good],["half",half],["bad",bad],["open",other]].map(([k,n])=>n?'<span class="'+k+'" style="flex:'+n+'" title="'+fa(n)+'"></span>':"").join("");
  let handle=personHref(s);
  const personTitle=handle?'<a class="profile-name" href="'+esc(handle)+'">'+esc(s.name||s.key||"گوینده")+'</a>':esc(s.name||s.key||"گوینده");
  return '<article class="tile person"><div class="person-head">'+avatarMarkup(s)+'<div><h3>'+personTitle+'</h3><span class="muted">'+fa(total)+' ادعا</span></div></div><div class="score">'+esc(x.score.percent)+'</div><span class="muted">از '+fa(x.score.n)+' پیش‌بینی ارزیابی‌شده</span><div class="bar" aria-label="نتایج ثبت‌شده">'+parts+'</div><div class="tile-foot"><button class="open-card" type="button" data-person="'+esc(s.key||s.name)+'">دیدن پیش‌بینی‌ها ←</button>'+(handle?'<a href="'+esc(handle)+'">همهٔ سخنان این چهره در پندار</a>':"")+'</div></article>';
 }).join("");
}
function renderDuels(){
 let map=new Map(state.claims.map(c=>[c.id,c]));
 let pairs=state.pairs.filter(p=>map.has(p.a)&&map.has(p.b));
 if(!pairs.length)return noData("هنوز دوئلی ثبت نشده","وقتی دو پیش‌بینی قابل مقایسه دربارهٔ یک پرسش ثبت شوند، کنار هم نمایش داده می‌شوند.");
 return pairs.map(p=>{
  const a=map.get(p.a),b=map.get(p.b);
  return '<article class="tile duel"><p class="eyebrow">دو روایت از یک آینده</p><h3 class="tile-title">'+esc(p.q||"اختلاف در پیش‌بینی")+'</h3><div class="duel-cols"><div class="duel-side"><b>'+esc(p.side_a||people(a).join("، ")||a.id)+'</b>'+pills(a)+'<p class="tile-copy">'+esc(titleText(a))+'</p><button class="open-card" data-claim="'+esc(a.id)+'" type="button">متن اصلی ←</button></div><span class="vs">VS</span><div class="duel-side"><b>'+esc(p.side_b||people(b).join("، ")||b.id)+'</b>'+pills(b)+'<p class="tile-copy">'+esc(titleText(b))+'</p><button class="open-card" data-claim="'+esc(b.id)+'" type="button">متن اصلی ←</button></div></div></article>';
 }).join("");
}
function renderCalendar(){
 let rows=[...state.claims].filter(c=>c.kind!=="L"&&!scorable(c));
 rows.sort((a,b)=>{let ad=due(a)?.getTime()??Infinity,bd=due(b)?.getTime()??Infinity;return ad-bd;});
 if(!rows.length)return noData("مورد بازی وجود ندارد","با ثبت پیش‌بینی‌های دارای مهلت، تقویم سررسیدها فعال می‌شود.");
 let buckets=new Map();
 for(const c of rows){const b=bucket(c),key=c.bucket||"other",label=b.label||b.title||c.due_label||"بدون سررسید مشخص";if(!buckets.has(key))buckets.set(key,{label,claims:[]});buckets.get(key).claims.push(c);}
 return [...buckets.values()].map(b=>'<section class="calendar-group"><h3>'+esc(b.label)+'</h3><div class="group-items">'+b.claims.map((c,i)=>mini(c,i)).join("")+'</div></section>').join("");
}
function renderScenarios(){
 let families=state.families.filter(x=>x.key||x.id);
 if(!families.length)return noData("نقشهٔ سناریوها هنوز آماده نیست","سناریوهای دفتر کارنامه پس از اتصال داده در اینجا قابل مقایسه خواهند بود.");
 let active=state.speakers.filter(s=>state.claims.some(c=>array(c.speakers).some(v=>speakerId(v)===(s.key||s.name))));
 if(!active.length)return noData("تحلیلگری برای مقایسه نیست","نقشه پس از ورود پیش‌بینی‌های واقعی نمایش داده می‌شود.");
 let th=families.map(f=>'<th>'+esc(f.label||f.name||f.title||f.key)+'</th>').join("");
 let rows=active.map(s=>{
  let claims=state.claims.filter(c=>array(c.speakers).some(v=>speakerId(v)===(s.key||s.name)));
  let cells=families.map(f=>{let matches=claims.flatMap(c=>array(c.scenarios).filter(sc=>sc.family===(f.key||f.id)));let n=matches.length;let against=matches.filter(x=>/علیه|against/.test(norm(x.dir))).length;let possible=matches.filter(x=>/امکان|possible/.test(norm(x.dir))).length;let support=n-against-possible;return '<td title="له: '+support+' / علیه: '+against+' / امکان: '+possible+'">'+(n?'<span class="count">'+fa(n)+'</span><small class="muted">  +'+fa(support)+' / −'+fa(against)+'</small>':'—')+'</td>';}).join("");
  return '<tr><td>'+esc(s.name||s.key)+'</td>'+cells+'</tr>';
 }).join("");
 return '<div class="matrix"><table><thead><tr><th>تحلیلگر</th>'+th+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function renderAll(){
 const speakers=state.speakers.map(s=>'<option value="'+esc(s.key||s.name)+'" '+(state.speaker===(s.key||s.name)?"selected":"")+'>'+esc(s.name||s.key)+'</option>').join("");
 const controls='<div class="tools"><input id="claim-search" type="search" value="'+esc(state.query)+'" placeholder="جست‌وجو در گفته‌ها، شناسه و نام تحلیلگر…" aria-label="جست‌وجوی ادعاها"><select id="filter-speaker" aria-label="تحلیلگر"><option value="">همهٔ تحلیلگران</option>'+speakers+'</select><select id="filter-status" aria-label="نتیجه"><option value="">همهٔ نتیجه‌ها</option><option value="good" '+(state.status==="good"?"selected":"")+'>درست</option><option value="half" '+(state.status==="half"?"selected":"")+'>نیمه‌درست</option><option value="bad" '+(state.status==="bad"?"selected":"")+'>نادرست</option><option value="wait" '+(state.status==="wait"?"selected":"")+'>منتظر بررسی</option><option value="open" '+(state.status==="open"?"selected":"")+'>باز و بلندمدت</option></select></div>';
 let rows=state.claims.filter(c=>(!state.speaker||array(c.speakers).some(v=>speakerId(v)===state.speaker))&&(!state.status||status(c).key===state.status)&&(!state.query||norm([c.id,c.text,c.speaker_note,people(c).join(" ")].join(" ")).includes(norm(state.query))));
 return controls+showClaims(rows);
}
function render(){
 setHeading();if(!state.data){$("cards").innerHTML=noData("هنوز دادهٔ کارنامه متصل نشده","صفحه ساخته شده است، اما بانک رسمی پیش‌بینی‌ها در مسیر عمومی انتشار موجود نیست. تا دریافت دادهٔ معتبر، هیچ آمار یا نتیجهٔ فرضی منتشر نمی‌کنیم.");return;}
 const views={highlights:renderHighlights,people:renderPeople,duels:renderDuels,calendar:renderCalendar,scenarios:renderScenarios,all:renderAll};
 $("cards").innerHTML=(views[state.tab]||renderHighlights)();
}
function detail(c){
 const s=status(c),b=bucket(c),names=people(c).join("، ")||"نامشخص";
 const resultSource=String(c.result_source||""),url=resultSource.match(/https?:\/\/[^\s<>)]+/)?.[0]||"";
 const safeURL=url&&/^https?:\/\//i.test(url)?url:"";
 const recap=array(state.data?.recaps).find(r=>array(r.claims||r.claim_ids).includes(c.id));
 const recapLink=recap&&(recap.url||recap.link),validRecap=typeof recapLink==="string"&&/^https?:\/\//i.test(recapLink);
 let html='<div class="meta-line">'+pills(c)+'<span dir="ltr">'+esc(c.id)+'</span></div><h2 id="dialog-title">'+esc(claimText(c))+'</h2><div class="detail-grid"><div><strong>چه کسی گفته؟</strong>'+esc(names)+'</div><div><strong>چه زمانی؟</strong>'+esc(c.said||"تاریخ ذکر نشده")+'</div><div><strong>موعد بررسی</strong>'+esc(c.due_label||b.label||"مشخص نشده")+'</div><div><strong>نوع ادعا</strong>'+esc(c.type||c.type_class||"پیش‌بینی")+'</div></div>';
 html+=contributorLinks(c);
 if(c.said_date_basis)html+='<p class="muted" style="font-size:12px;margin:10px 0">'+esc(c.said_date_basis)+'</p>';
 if(c.source_title){
  const secondary=c.source_type==="secondary_editorial_recap";
  const documentUrl=typeof c.source_ref_url==="string"&&/^https:\/\//.test(c.source_ref_url)?c.source_ref_url:null;
  const link=documentUrl?'<p><a href="'+esc(documentUrl)+'" target="_blank" rel="noopener noreferrer">مشاهدهٔ سند مبنا در مخزن پندار ↗</a></p>':"";
  const origin=secondary?"استخراج از ری‌کپ ثانویهٔ پندار؛ متن ویدئوی اصلی هنوز مستقلاً تطبیق داده نشده است.":(c.source_type==="claude_snapshot"?"این ادعا با شناسه و قیدهای ثبت‌شده از فایل اصلی ارسالیِ Claude وارد شده است؛ نتیجهٔ آن هنوز راستی‌آزمایی نشده است.":"ثبت بر مبنای پروندهٔ ارائه‌شده؛ لینک منبع مستقیم هنوز ثبت نشده است.");
  html+='<div class="detail-source"><strong>منشأ این ثبت:</strong> '+esc(c.source_title)
     +'<p class="muted">'+origin+'</p>'
     +(c.source_record_id?'<p class="muted">شناسهٔ گزارش: '+esc(c.source_record_id)+'</p>':"")
     +(c.source_anchor?'<p>عبارت مبنای استخراج: '+esc(c.source_anchor)+'</p>':"")
     +link+'</div>';
 }
 if(c.evaluation_trigger)html+='<div class="detail-source"><strong>معیار پیشنهادی سنجش:</strong><p>'+esc(c.evaluation_trigger)+'</p></div>';
 if(c.condition)html+='<div class="detail-source"><strong>شرط تحقق:</strong><p>'+esc(c.condition)+'</p></div>';
 if(c.speaker_note&&norm(c.speaker_note)!==norm(c.text))html+='<div class="detail-source"><strong>شرح و قیدهای اصلی:</strong><p>'+esc(c.speaker_note)+'</p></div>';
 html+='<div class="detail-source"><strong>وضعیت:</strong> '+esc(s.label)+(safeURL?'<p><a href="'+esc(safeURL)+'" target="_blank" rel="noopener noreferrer">مشاهدهٔ سند نتیجه ↗</a></p>':resultSource?'<p>'+esc(resultSource)+'</p>':'<p class="muted">سند نتیجه هنوز ثبت نشده است.</p>')+'</div>';
 if(recap)html+='<div class="detail-source"><strong>پیوند دفتر با جان‌کلام:</strong> '+esc(recap.id||"")+(recap.date?' · '+esc(recap.date):"")+'</div>';
 if(validRecap)html+='<p><a href="'+esc(recapLink)+'" target="_blank" rel="noopener noreferrer">جان‌کلام منبع ↗</a></p>';
 html+='<button class="share" type="button" data-share="'+esc(c.id)+'">اشتراک‌گذاری در تلگرام ↗</button>';
 return html;
}
function openClaim(id){
 let c=state.claims.find(c=>c.id===id);if(!c)return;
 $("dialog-body").innerHTML=detail(c);$("claim-dialog").showModal();
 let url=new URL(location.href);url.searchParams.set("claim",id);history.replaceState(null,"",url);
}
function shareClaim(id){
 let c=state.claims.find(c=>c.id===id);if(!c)return;
 let url="https://pendar.io/karname/?claim="+encodeURIComponent(id);
 let text="گفت؛ چه شد؟ | پندار\n"+people(c).join("، ")+"\n"+claimText(c).slice(0,240)+"\nوضعیت: "+status(c).label;
 window.open("https://t.me/share/url?url="+encodeURIComponent(url)+"&text="+encodeURIComponent(text),"_blank","noopener,noreferrer");
}
function setTab(name){if(!labels[name])return;state.tab=name;render();history.replaceState(null,"",name==="highlights"?"/karname/":"/karname/#"+name);}
function eventHandlers(){
 document.querySelectorAll(".tabs button").forEach(btn=>btn.addEventListener("click",()=>setTab(btn.dataset.tab)));
 $("cards").addEventListener("click",ev=>{
  let c=ev.target.closest("[data-claim]");if(c)return openClaim(c.dataset.claim);
  let p=ev.target.closest("[data-person]");if(p){state.speaker=p.dataset.person;state.query="";state.status="";setTab("all");}
 });
 $("cards").addEventListener("input",ev=>{if(ev.target.id==="claim-search"){let start=ev.target.selectionStart;state.query=ev.target.value;render();let inp=$("claim-search");if(inp){inp.focus();inp.setSelectionRange(start,start);}}});
 $("cards").addEventListener("change",ev=>{if(ev.target.id==="filter-speaker"){state.speaker=ev.target.value;render();}if(ev.target.id==="filter-status"){state.status=ev.target.value;render();}});
 $("claim-dialog").addEventListener("click",ev=>{let btn=ev.target.closest("[data-share]");if(btn)shareClaim(btn.dataset.share);});
 $("claim-dialog").addEventListener("close",()=>{let url=new URL(location.href);url.searchParams.delete("claim");history.replaceState(null,"",url);});
 window.addEventListener("hashchange",()=>{let tab=location.hash.slice(1);if(labels[tab]){state.tab=tab;render();}});
}
async function load(){
 // Portrait lookup is best-effort. No invented images or name-only photo searches.
 const resource=(url,fallback)=>fetch(url,{cache:"no-cache"})
  .then(r=>r.ok?r.json():fallback).catch(()=>fallback);
 const portraitPromise=resource("/data/pendar-figure-portraits.json",{});
 const externalPromise=resource("/data/karname-portrait-sources.json",{portraits:{}});
 const figurePromise=resource("/data/figures.json",{figures:[]});
 try{
  const response=await fetch(DATA_URL,{cache:"no-cache"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const data=await response.json();
  if(!data||!Array.isArray(data.claims)||!Array.isArray(data.speakers))throw new Error("ساختار داده نامعتبر");
  state.data=data;state.claims=data.claims.filter(c=>c&&typeof c.id==="string");state.speakers=data.speakers;
  state.portraits=await portraitPromise;
  state.buckets=objects(data.buckets);state.pairs=array(data.pairs);state.families=objects(data.scenario_families);
  $("stat-claims").textContent=fa(state.claims.length);
  $("stat-graded").textContent=fa(state.claims.filter(scorable).length);
  $("stat-due").textContent=fa(state.claims.filter(c=>c.kind!=="L"&&!c.result&&due(c)&&due(c)<new Date()).length);
  $("stat-speakers").textContent=fa(state.speakers.filter(s=>state.claims.some(c=>array(c.speakers).some(p=>speakerId(p)===(s.key||s.name)))).length);
  $("asof").textContent="آخرین به‌روزرسانی: "+(data.as_of_fa||data.as_of||"تاریخ نامشخص");
  if(data.is_complete===false||data.dataset_scope==="initial_partial_import"){$("feed-notice").hidden=false;$("feed-notice").textContent=data.provenance?.disclosure||"این داده‌ها فقط بخشی از دفتر کارنامه هستند و هنوز ارزیابی نهایی ندارند.";}else if(state.claims.length===0){$("feed-notice").hidden=false;$("feed-notice").textContent="بانک کارنامه متصل است، اما هنوز ادعای منتشرشده‌ای ندارد.";}
  render();
  // Secondary images load independently and never prevent the claims dashboard.
  Promise.all([figurePromise,externalPromise]).then(([directory,external])=>{
   state.figures=Array.isArray(directory?.figures)?directory.figures:[];
   state.externalPortraits=external?.portraits||{};
   render();
  }).catch(()=>{});
  let requested=new URL(location.href).searchParams.get("claim");if(requested)openClaim(requested);
 }catch(err){
  $("asof").textContent="بانک داده هنوز برای انتشار آماده نیست";
  $("feed-notice").hidden=false;
  $("feed-notice").textContent="اتصال دادهٔ کارنامه برقرار نیست. صفحه بدون اطلاعات ساختگی نمایش داده می‌شود.";
  render();console.warn("Karname data unavailable:",err.message);
 }
}
eventHandlers();
document.addEventListener("error",ev=>{
 if(ev.target instanceof HTMLImageElement&&ev.target.closest(".avatar")){
  ev.target.remove(); // visible initial remains when the verified photo fails to load
 }
},true);
let initial=location.hash.slice(1);if(labels[initial])state.tab=initial;
render();load();
})();