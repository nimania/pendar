/* Pendar / Karname: public claims dashboard.
   All displayed claims and results come exclusively from /data/karname.json. */
(()=>{
"use strict";
const DATA_URL="/data/karname.json", $=id=>document.getElementById(id);
const state={data:null,claims:[],speakers:[],buckets:[],pairs:[],families:[],tab:"all",query:"",speaker:"",status:"",portraits:{},externalPortraits:{},figures:[],selectedScenario:null,autoItems:[],autoQuery:"",autoKind:"",autoPerson:"",autoLoadState:"loading",autoNotice:"",unifiedIndex:null,unifiedLoadState:"loading",unifiedFilter:"all",unifiedQuery:"",unifiedLimit:60,personSelection:null,sourceChecks:null};
const labels={
  highlights:["منتخب کارنامه","پیش‌بینی‌ها زیر ذره‌بین","تازه‌ترین پرونده‌ها، با متن اصلی و منابع."],
  auto:["رادار خودکار پندار","چه گفته‌هایی تازه رصد شده‌اند؟","متن‌های یافت‌شده از منابع عمومی؛ انتساب، نقل مستقیم و نتیجه هنوز تأیید نشده‌اند."],
  people:["فهرست همهٔ چهره‌ها","چه کسی چه گفته؟","موارد تاریخی و ماشینی جدا از هم."],
  person:["پروندهٔ سخنان","گفته‌های ثبت‌شده و رصدشده","این رصدها لزوماً نقل‌قول مستقیم نیستند."],
  duels:["دو تحلیل؛ یک آینده","دوئل پیش‌بینی‌ها","دیدگاه‌های متفاوت را کنار هم ببینید."],
  calendar:["زمان حسابرسی","موعد رسید!","سررسیدهای گذشته و پیش‌بینی‌های در انتظار."],
  scenarios:["نقشهٔ دیدگاه‌ها","چه کسی کدام آینده را می‌بیند؟","گرایش به یک سناریو، نمرهٔ عملکرد نیست."],
  all:["بانک یکپارچهٔ کارنامه","تمام رکوردها با سطح اعتبارشان","جست‌وجوی مشترک ادعاهای ثبت‌شده، رصدهای ماشینی و سوابق پالایش‌شده."]
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
  return '<a class="claim-person" href="'+esc(karnameOfficialLink(s))+'" aria-label="سخنان و رصدهای '+esc(s.name||s.key)+'">'+body+'</a>';
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
function machineSummary(){
 const n=state.unifiedIndex?.counts;
 if(!n)return "";
 return '<section class="unified-intro unified-banner"><strong>رصد مشترک پندار: '+fa(n.total)+' رکورد</strong>'
 +'<p>'+fa(n.documented)+' پروندهٔ تاریخی، '+fa(n.automatic_unverified)+' رصد خودکارِ بدون تأیید مستقل و '
 +fa(n.screened_from_public_claims+n.other_review_states)+' مدخل محفوظ برای ممیزی.</p>'
 +'<a href="/karname/#all" class="unified-href">جست‌وجوی تمام رکوردها ←</a></section>';
}
function renderObservedPeople(){
 const index=state.unifiedIndex;
 if(!index)return "";
 const provisional=index.entries.filter(x=>x.layer==="automatic_observation");
 const byName=new Map();
 for(const entry of provisional){
  const name=array(entry.speaker_labels)[0]||"نام نامشخص";
  const key=array(entry.speaker_keys)[0]||name;
  if(!byName.has(key))byName.set(key,{name,handle:array(entry.speaker_keys)[0]||null,count:0});
  byName.get(key).count++;
 }
 const groups=[...byName.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"fa"));
 const rows=groups.slice(0,30).map(x=>{
  const link=x.handle
   ?'/karname/?person='+encodeURIComponent(x.handle)+'#auto'
   :'/karname/?search='+encodeURIComponent(x.name)+'#auto';
  return '<a href="'+esc(link)+'" class="observed-person">'+esc(x.name)
    +'<span>'+fa(x.count)+' رصد · انتساب تأییدنشده</span></a>';
 }).join("");
 return '<section class="observed-people"><h3>نام‌های مرتبط با رصد خودکار</h3><p>این فهرست از متن خبرها و ری‌کپ‌ها به‌دست آمده و به معنای تأیید گویندهٔ جمله نیست. در محاسبهٔ امتیاز افراد وارد نمی‌شود.</p>'
   +'<div class="observed-person-grid">'+rows+'</div>'
   +(groups.length>30?'<a href="/karname/#all">مشاهدهٔ تمام نام‌ها و متن‌ها در بانک مشترک ←</a>':"")+'</section>';
}
function renderAutoTriggerHints(){
 const index=state.unifiedIndex;if(!index)return "";
 const list=index.entries.filter(x=>x.layer==="automatic_observation"
  &&["conditional","time_expression"].includes(x.trigger_kind));
 const timed=list.filter(x=>x.trigger_kind==="time_expression");
 const conditional=list.filter(x=>x.trigger_kind==="conditional");
 const links=list.slice(0,12).map(c=>{
  const signal=c.time_label||c.condition_mention||"تاریخ یا شرط نامشخص";
  return '<li><a href="/karname/?observation='+encodeURIComponent(c.id)+'#auto">'+esc(signal)
   +' <small dir="ltr">'+esc(c.id)+'</small></a></li>';
 }).join("");
 return '<section class="calendar-group auto-trigger-hints"><h3>سرنخ‌های زمانی و شرطی از رصد خودکار</h3>'
 +'<p class="muted">'+fa(timed.length)+' اشارهٔ زمانی و '+fa(conditional.length)
 +' شرط استخراج شده است. هیچ‌کدام هنوز موعد قطعیِ احرازشده نیستند و به جدول سررسیدهای رسمی اضافه نشده‌اند.</p>'
 +'<ul>'+links+'</ul><a href="/karname/#all">دیدن پرونده‌های ثبت‌شده و رصدهای جدید ←</a></section>';
}
function renderHighlights(){
 let ranked=[...state.claims].sort((a,b)=>{
   const rank=c=>{let s=status(c);return (s.key==="wait"?4:0)+(s.key==="good"||s.key==="bad"||s.key==="half"?3:0)+(c.kind==="K"?1:0)};
   return rank(b)-rank(a)||String(b.said||"").localeCompare(String(a.said||""));
 });
 return machineSummary()+showClaims(ranked.slice(0,12));
}

function karnameOfficialLink(s){return '/karname/?speaker='+encodeURIComponent(s.key)+'#person';}
function karnameMatch(item){
 const p=item?.person||item||{},h=String(p.profile_handle||"").toLowerCase();
 const found=state.speakers.filter(s=>(h&&[s.handle,profileHandle(s)].some(v=>v&&String(v).toLowerCase()===h))||personNorm(s.name)===personNorm(p.label));
 return found.length===1?found[0]:null;
}
function karnameAutoLink(p){
 const s=karnameMatch({person:p});
 return s?karnameOfficialLink(s):'/karname/?mention='+encodeURIComponent(String(p.label||"نامشخص"))+'#person';
}

function sourceBadge(id){
 const c=state.sourceChecks?.observations?.[id];
 const messages={source_text_found:"متن در صفحهٔ منبع یافت شد؛ گوینده و نتیجه هنوز احراز نشده",
 source_accessible:"صفحهٔ منبع در دسترس است؛ متن/انتساب تأیید نشده",
 source_unavailable:"دریافت منبع در این نوبت ممکن نشد",no_source_url:"بدون لینک قابل دریافت",
 pending_check:"در صف بررسی خودکار"};
 return '<span class="source-check">'+esc(messages[c?.status]||"تطبیق منبع هنوز گزارش نشده")+'</span>';
}
function renderVerificationOverview(){
 const d=state.sourceChecks?.summary;if(!d)return "";
 return '<section class="verification-overview"><strong>راستی‌آزمایی خودکار منابع</strong><p>'
  +fa(d.checked_this_run||0)+' منبع در آخرین نوبت بررسی شد؛ '+fa(d.exact_text_in_source_page||0)
  +' عبارت در صفحهٔ منبع یافت شد. '+fa(d.deadlines_requiring_evidence||0)
  +' سررسید گذشته هنوز شواهد نتیجه می‌خواهند.</p>'
  +'<small>یافتن متن در منبع، تأیید گوینده یا درست‌بودن پیش‌بینی نیست؛ نمرهٔ خودکار قطعی صادر نشده است.</small></section>';
}
function renderPersonList(){
 const map=new Map();
 for(const s of state.speakers){
  map.set('o:'+s.key,{s,name:s.name,official:state.claims.filter(c=>array(c.speakers).some(v=>speakerId(v)===s.key)).length,auto:0});
 }
 for(const o of state.autoItems){
  const s=karnameMatch(o),key=s?'o:'+s.key:'m:'+personNorm(o.person?.label);
  if(!map.has(key))map.set(key,{s:null,name:o.person?.label||"نامشخص",official:0,auto:0});
  map.get(key).auto++;
 }
 const rows=[...map.values()].sort((a,b)=>b.official+b.auto-a.official-a.auto||a.name.localeCompare(b.name,'fa'));
 return '<section class="person-directory-intro"><strong>'+fa(rows.length)+' نام و پرونده</strong><p>'+fa(state.speakers.length)+' گویندهٔ تاریخی و نام‌های مرتبط در خبرها؛ انتساب عبارت‌های ماشینی هنوز تأیید نشده است.</p></section>'
 +'<div class="person-directory">'+rows.map(p=>{
  const link=p.s?karnameOfficialLink(p.s):karnameAutoLink({label:p.name});
  return '<a class="person-directory-item" href="'+esc(link)+'">'+(p.s?avatarMarkup(p.s):'<span class="avatar avatar-pending">؟</span>')
   +'<span><b>'+esc(p.name)+'</b><small>'+fa(p.official)+' تاریخی · '+fa(p.auto)+' رصد خودکار</small></span></a>';
 }).join('')+'</div>';
}
function renderPersonDetail(){
 const select=state.personSelection;
 if(!select)return noData('شخصی انتخاب نشده','نامی را از فهرست افراد انتخاب کنید.');
 const s=select.key?state.speakers.find(p=>p.key===select.key):null;
 const name=s?.name||select.name||"نامشخص";
 const existing=s?state.claims.filter(c=>array(c.speakers).some(v=>speakerId(v)===s.key)):[];
 const observed=state.autoItems.filter(o=>s?karnameMatch(o)?.key===s.key:!karnameMatch(o)&&personNorm(o.person?.label)===personNorm(select.name));
 const portrait=s?avatarMarkup(s):'<span class="avatar avatar-pending">؟</span>';
 const home=s?personHref(s):"";
 const head='<nav class="person-breadcrumb"><a href="/karname/#people">همهٔ چهره‌ها</a> / '+esc(name)+'</nav>'
   +'<section class="person-page-head">'+portrait+'<div><h2>'+esc(name)+'</h2><p>'+fa(existing.length)+' ادعای تاریخی · '+fa(observed.length)+' رصد خودکار</p>'
   +(home?'<a href="'+esc(home)+'">پروندهٔ اصلی در پندار ←</a>':"")+'</div></section>';
 const official='<section class="person-claim-section"><h3>ادعاهای دفتر اصلی</h3>'
  +(existing.length?'<div class="person-claim-cards">'+existing.map((c,i)=>mini(c,i)).join('')+'</div>':'<p class="muted">مورد تاریخی ثبت نشده است.</p>')+'</section>';
 const cards=observed.map(o=>{
  const src=o.source||{},data=state.sourceChecks?.observations?.[o.id];
  const url=typeof src.link==="string"&&/^https:\/\//.test(src.link)?'<a href="'+esc(src.link)+'" target="_blank" rel="noopener noreferrer">منبع منتشرشده ←</a>':"";
  const text={source_text_found:"متن در صفحهٔ منبع یافته شد؛ اصالت و نتیجه تأیید نشده",source_accessible:"صفحه در دسترس؛ انتساب نامشخص",source_unavailable:"دریافت ناموفق؛ به معنی نادرستی نیست",pending_check:"در صف بررسی خودکار",no_source_url:"بدون لینک منبع"}[data?.status]||"تطبیق متن و منبع هنوز انجام نشده";
  return '<article class="person-auto-item"><b dir="ltr">'+esc(o.id)+'</b><p>'+esc(o.text_from_source||"")+'</p><small>'+esc(src.text_origin||"متن ثانویه")+'</small>'
  +'<span class="source-check">'+esc(text)+'</span><div class="person-evidence-actions">'+url
  +'<a href="/karname/?observation='+encodeURIComponent(o.id)+'#auto">جزئیات رصد ←</a></div></article>';
 }).join('');
 const auto='<section class="person-claim-section"><h3>رصدهای ماشینی مرتبط با این نام</h3>'
  +'<p class="person-trust-warning">متن‌های این بخش ممکن است خلاصهٔ خبر باشند، نه گفتهٔ مستقیم شخص. هیچ نتیجهٔ قطعی برای آن‌ها صادر نشده است.</p>'
  +(cards?'<div class="person-auto-grid">'+cards+'</div>':'<p class="muted">رصدی ثبت نشده است.</p>')+'</section>';
 return head+official+auto;
}
async function loadSourceChecks(){
 try{const r=await fetch('/karname/source-verification.json',{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();
  if(d?.schema_version!==1||d.scope!=='automatic_source_verification_not_outcome_scoring')throw Error('bad schema');
  state.sourceChecks=d;
 }catch(e){state.sourceChecks=null;}
 if(['person','auto','all'].includes(state.tab))render();
}
function renderPeople(){return renderPersonList();}
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
 if(!rows.length)return renderAutoTriggerHints()||noData("مورد بازی وجود ندارد","با ثبت پیش‌بینی‌های دارای مهلت، تقویم سررسیدها فعال می‌شود.");
 let buckets=new Map();
 for(const c of rows){const b=bucket(c),key=c.bucket||"other",label=b.label||b.title||c.due_label||"بدون سررسید مشخص";if(!buckets.has(key))buckets.set(key,{label,claims:[]});buckets.get(key).claims.push(c);}
 return [...buckets.values()].map(b=>'<section class="calendar-group"><h3>'+esc(b.label)+'</h3><div class="group-items">'+b.claims.map((c,i)=>mini(c,i)).join("")+'</div></section>').join("")+renderAutoTriggerHints();
}
function scenarioCategory(dir){
 const d=norm(dir);
 if(/^(?:له|مؤید|موافق|support)$/.test(d))return "support";
 if(/^(?:علیه|مخالف|against)$/.test(d))return "against";
 if(/^(?:امکان|احتمال|possible)$/.test(d))return "possible";
 if(/^(?:زمینه|شرایط|شرط|context|condition)$/.test(d))return "context";
 return "other"; // Do not count unknown labels as support.
}
function scenarioMatches(speakerKey,family,category){
 return state.claims.flatMap(claim=>{
  if(!array(claim.speakers).some(v=>speakerId(v)===speakerKey))return [];
  return array(claim.scenarios)
   .filter(x=>x.family===family&&(!category||scenarioCategory(x.dir)===category))
   .map(x=>({claim,tag:x}));
 });
}
function renderScenarios(){
 const families=state.families.filter(x=>x.key||x.id);
 if(!families.length)return noData("نقشهٔ سناریوها هنوز آماده نیست","سناریوهای دفتر کارنامه پس از اتصال داده در اینجا قابل مقایسه خواهند بود.");
 const active=state.speakers.filter(s=>state.claims.some(c=>array(c.speakers).some(v=>speakerId(v)===(s.key||s.name))));
 if(!active.length)return noData("تحلیلگری برای مقایسه نیست","نقشه پس از ورود پیش‌بینی‌های واقعی نمایش داده می‌شود.");
 const categories=[
  {key:"support",label:"مؤید",short:"+",className:"support"},
  {key:"against",label:"مخالف",short:"−",className:"against"},
  {key:"possible",label:"امکان",short:"؟",className:"possible"},
  {key:"context",label:"زمینه/شرط",short:"◌",className:"context"},
  {key:"other",label:"طبقه‌بندی‌نشده",short:"…",className:"other"}
 ];
 const th=families.map(f=>'<th>'+esc(f.label||f.name||f.title||f.key)+'</th>').join("");
 const rows=active.map(s=>{
  const speakerKey=s.key||s.name;
  const cells=families.map(f=>{
   const family=f.key||f.id;
   const matches=scenarioMatches(speakerKey,family);
   if(!matches.length)return '<td class="scenario-empty" aria-label="موضعی ثبت نشده">—</td>';
   const labels=categories.map(cat=>{
    const n=matches.filter(x=>scenarioCategory(x.tag.dir)===cat.key).length;
    return n?'<button type="button" class="scenario-chip '+cat.className+'" data-scenario-person="'+esc(speakerKey)+'" data-scenario-family="'+esc(family)+'" data-scenario-kind="'+cat.key+'" aria-label="'+esc(s.name||speakerKey)+'، '+esc(family)+'، '+cat.label+'، '+fa(n)+' مورد" title="'+cat.label+'، '+fa(n)+' مورد">'+cat.short+fa(n)+'</button>':"";
   }).join("");
   const all='<button type="button" class="scenario-total" data-scenario-person="'+esc(speakerKey)+'" data-scenario-family="'+esc(family)+'" data-scenario-kind="" aria-label="همهٔ '+fa(matches.length)+' موضع '+esc(s.name||speakerKey)+' دربارهٔ '+esc(family)+'">'+fa(matches.length)+'</button>';
   return '<td><div class="scenario-cell">'+all+'<span class="scenario-chips">'+labels+'</span></div></td>';
  }).join("");
  return '<tr><th scope="row">'+esc(s.name||speakerKey)+'</th>'+cells+'</tr>';
 }).join("");
 const heading='<div class="scenario-explainer"><strong>این جدول امتیاز موفقیت نیست.</strong> هر عدد، شمار برچسب‌های موضع ثبت‌شده دربارهٔ یک سناریو است. روی عدد کل یا هر علامت بزنید تا متن ادعا و نوع موضع را ببینید. <span class="scenario-legend">'+categories.map(x=>'<span class="scenario-legend-entry"><b class="'+x.className+'">'+x.short+'</b> '+x.label+'</span>').join("")+'</span></div>';
 let selected="";
 if(state.selectedScenario){
  const {speakerKey,family,category}=state.selectedScenario;
  const matches=scenarioMatches(speakerKey,family,category);
  const person=state.speakers.find(s=>(s.key||s.name)===speakerKey);
  const kind=categories.find(x=>x.key===category);
  const title=esc(person?.name||speakerKey)+' / '+esc(family)+(kind?' / '+kind.label:' / همهٔ مواضع');
  const unique=[];
  for(const item of matches)if(!unique.some(x=>x.claim.id===item.claim.id&&x.tag.dir===item.tag.dir))unique.push(item);
  const cards=unique.map(x=>'<li class="scenario-claim"><button type="button" data-claim="'+esc(x.claim.id)+'"><span class="pill open">'+esc(x.tag.dir||"نامشخص")+'</span><b dir="ltr">'+esc(x.claim.id)+'</b><span>'+esc(claimText(x.claim))+'</span></button></li>').join("");
  selected='<section id="scenario-detail" class="scenario-detail" aria-live="polite"><div class="scenario-detail-head"><h3>'+title+' · '+fa(matches.length)+' برچسب</h3><button type="button" class="scenario-close" data-scenario-clear="true" aria-label="بستن فهرست مواضع">بستن ✕</button></div><p class="muted">با انتخاب یک ادعا، متن، قیدها و منشأ آن باز می‌شود. چند موضع ممکن است به یک ادعا مربوط باشند.</p><ol>'+cards+'</ol></section>';
 }
 return heading+'<div class="matrix"><table><thead><tr><th scope="col">تحلیلگر</th>'+th+'</tr></thead><tbody>'+rows+'</tbody></table></div>'+selected+machineSummary();
}
function validAutoRadar(value){
 return value?.schema_version===1
  &&value.scope==="automatically_collected_observations_not_verified_predictions"
  &&value.is_editorially_approved===false
  &&Array.isArray(value.items)&&value.items.length<=5000
  &&value.items.every(x=>/^KC-[0-9a-f]{18}$/.test(String(x?.id||""))
    &&x.observation_status==="auto_collected_unverified"
    &&typeof x.text_from_source==="string"
    &&x.publication_approved===false&&x.evaluation===null
    &&typeof x.person?.label==="string"
    &&typeof x.source?.text_origin==="string");
}
async function loadAutoRadar(){
 try{
  const r=await fetch("/karname/auto-radar.json",{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const data=await r.json();
  if(!validAutoRadar(data))throw Error("auto-radar schema invalid");
  state.autoItems=data.items;
  state.autoNotice=String(data.notice_fa||"");
  state.autoLoadState="ready";
 }catch(err){
  state.autoLoadState="error";
  state.autoItems=[];
  console.warn("Karname automatic observations unavailable:",err.message);
 }
 if(["auto","people","person"].includes(state.tab))render();
}
function renderAuto(){
 if(state.autoLoadState==="loading")return noData("در حال دریافت رصدهای تازه","داده‌های خودکار مستقل از پرونده‌های اصلی دریافت می‌شوند.");
 if(state.autoLoadState==="error")return noData("رصد خودکار موقتاً در دسترس نیست","بانک رسمی کارنامه بدون تغییر باقی می‌ماند؛ وضعیت انتشار و استخراج را در GitHub بررسی کنید.");
 const kinds=[{key:"",label:"همهٔ منابع"},{key:"figure_post",label:"پست و خبر چهره‌ها"},{key:"editorial_recap",label:"ری‌کپ تحریریه"},{key:"editorial_view",label:"نقل‌قول ثبت‌شده"}];
 const choices=kinds.map(k=>'<option value="'+esc(k.key)+'"'+(state.autoKind===k.key?" selected":"")+'>'+esc(k.label)+'</option>').join("");
 const controls='<div class="tools auto-tools"><input id="auto-search" type="search" value="'+esc(state.autoQuery)+'" placeholder="جست‌وجو در متن، نامِ مرتبط یا نام منبع..." aria-label="جست‌وجوی خودکار"><select id="auto-kind" aria-label="نوع منبع">'+choices+'</select>'+(state.autoPerson?'<button type="button" class="auto-reset" data-auto-reset="true">حذف فیلتر چهره ✕</button>':"")+'</div>';
 const visible=state.autoItems.filter(c=>(!state.autoKind||c.source?.kind===state.autoKind)
  &&(!state.autoPerson||c.person?.profile_handle===state.autoPerson)
  &&(!state.autoQuery||norm([c.id,c.text_from_source,c.person?.label,c.source?.title].join(" ")).includes(norm(state.autoQuery))));
 const intro='<div class="auto-intro" role="status"><strong>انتشار ماشینیِ شفاف؛ نه داوری یا انتساب قطعی</strong><p>'+esc(state.autoNotice||"تمام موارد در این بخش هنوز نیازمند شواهد مستقل‌اند.")+'</p><p>'+fa(visible.length)+' مورد از '+fa(state.autoItems.length)+' رصد خودکار نمایش داده می‌شود؛ موارد پالایش‌شده در صف داخلی حفظ می‌شوند و در این صفحه نیستند.</p></div>';
 if(!visible.length)return intro+controls+noData("برای این فیلتر موردی نیست","فیلتر را پاک کنید یا جست‌وجو را تغییر دهید.");
 const cards=visible.map(c=>{
  const person=c.person||{},source=c.source||{},trigger=c.trigger||{};
  const link=typeof source.link==="string"&&/^https:\/\//.test(source.link)?'<a href="'+esc(source.link)+'" target="_blank" rel="noopener noreferrer">بازکردن منبع منتشرشده ←</a>':"";
  const handle=person.profile_handle&&/^[a-zA-Z0-9_-]{2,100}$/.test(person.profile_handle)?'/@'+encodeURIComponent(person.profile_handle)+'/':"";
  const name='<a href="'+esc(karnameAutoLink(person))+'" class="auto-profile">'+esc(person.label||"نامشخص")+'</a>';
  const cond=trigger.condition_mention?'شرطِ مطرح‌شده: '+trigger.condition_mention:trigger.time_mention?'اشارهٔ زمانی: '+trigger.time_mention:"موعد قطعی استخراج نشده";
  const sourceLabel=source.kind==="figure_post"?"خبر یا پست چهره":source.kind==="editorial_recap"?"بازگویی تحریریه":"متن نقل‌قول ثبت‌شده";
  return '<article class="tile auto-claim"><div class="auto-claim-head"><span class="auto-provisional">تأییدنشده · رصد خودکار</span><small dir="ltr">'+esc(c.id)+'</small></div>'
   +'<h3>'+name+'</h3><p class="auto-identity">'+esc(person.role||"انتساب نیازمند بررسی")+'</p>'
   +'<p class="auto-quote">'+esc(c.text_from_source)+'</p>'
   +'<p class="auto-evidence">'+esc(sourceLabel)+' · '+esc(source.title||"منبع در پندار")+'</p>'
   +'<p class="auto-explainer">'+esc(source.text_origin||"")+'</p>'
   +'<div class="auto-trigger">'+esc(cond)+'</div>'+sourceBadge(c.id)
   +'<div class="tile-foot">'+link+'<span>نتیجه: هنوز بررسی نشده</span></div></article>';
 }).join("");
 return intro+controls+cards;
}
function validUnifiedIndex(data){
 if(data?.schema_version!==1||data.scope!=="integrated_discovery_index_not_a_verdict_or_primary_source"||!Array.isArray(data.entries)||data.entries.length>15000)return false;
 const count=data.counts||{}, seen=new Set(),layer={historical_ledger:0,automatic_observation:0,quality_audit:0};
 for(const row of data.entries){
  if(!row||typeof row.id!=="string"||seen.has(row.id)||!(row.layer in layer))return false;
  seen.add(row.id);
  if(!["recorded","unverified","screened_out","other_not_publicly_attributed"].includes(row.status))return false;
  if(row.has_result_source===true&&row.layer!=="historical_ledger")return false;
  layer[row.layer]++;
 }
 return count.total===data.entries.length&&count.documented===layer.historical_ledger
  &&count.automatic_unverified===layer.automatic_observation
  &&count.screened_from_public_claims+count.other_review_states===layer.quality_audit;
}
async function loadUnifiedIndex(){
 try{
  const r=await fetch("/karname/unified-index.json",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);
  const d=await r.json();if(!validUnifiedIndex(d))throw Error("Integrated index invalid");
  state.unifiedIndex=d;state.unifiedLoadState="ready";
 }catch(err){state.unifiedIndex=null;state.unifiedLoadState="error";console.warn("Karname index unavailable",err.message);}
 if(["highlights","all","people","person","calendar","scenarios"].includes(state.tab))render();
}
function renderUnified(){
 if(state.unifiedLoadState==="loading")return noData("در حال دریافت بانک مشترک","همهٔ رکوردهای ثبت‌شده و رصدهای ماشینی در یک نمایه جست‌وجو می‌شوند.");
 if(state.unifiedLoadState==="error")return '<div class="unified-intro"><strong>نمایهٔ مشترک موقتاً در دسترس نیست.</strong><p>بانک رسمی همچنان قابل جست‌وجو است.</p></div>'+renderAll();
 const d=state.unifiedIndex,n=d.counts;
 const modes=[["all","همهٔ رکوردها"],["historical_ledger","پرونده‌های ثبت‌شده"],["automatic_observation","رصدهای تأییدنشده"],["quality_audit","ممیزی استخراج"]];
 const choices=modes.map(([k,t])=>'<button type="button" data-unified-filter="'+k+'" class="'+(state.unifiedFilter===k?"active":"")+'">'+t+'</button>').join("");
 const rows=d.entries.filter(r=>(state.unifiedFilter==="all"||r.layer===state.unifiedFilter)
  &&(!state.unifiedQuery||norm([r.id,r.title,array(r.speaker_labels).join(" "),r.screening_reason,r.time_label].join(" ")).includes(norm(state.unifiedQuery))));
 const listed=rows.slice(0,state.unifiedLimit);
 const intro='<div class="unified-intro"><strong>'+fa(n.total)+' رکورد در سامانهٔ یکپارچه</strong><p>'
  +fa(n.documented)+' پروندهٔ قبلی، '+fa(n.automatic_unverified)+' رصد ماشینی تأییدنشده، '
  +fa(n.screened_from_public_claims+n.other_review_states)+' مدخل ممیزی؛ هیچ‌کدام با نمرهٔ ساختگی جمع زده نمی‌شوند.</p></div>';
 const tools='<div class="unified-controls">'+choices+'</div><div class="tools unified-search"><input id="unified-search" type="search" value="'+esc(state.unifiedQuery)+'" placeholder="جست‌وجو در همهٔ نام‌ها، گفته‌ها و شناسه‌ها" aria-label="جست‌وجوی بانک یکپارچه"></div>';
 const cards=listed.map(r=>{
  if(r.layer==="historical_ledger"){
   const c=state.claims.find(x=>x.id===r.id);
   return c?mini(c,1):'<article class="tile unified-record"><h3>'+esc(r.title)+'</h3><p>منبع: بانک مستند</p></article>';
  }
  if(r.layer==="automatic_observation"){
   const target='/karname/?observation='+encodeURIComponent(r.id)+'#auto';
   const matches=array(r.linked_ledger_claim_ids_for_review);
   const similar=matches.length?'<p class="unified-related">شباهت نیازمند بررسی با: '+matches.map(esc).join("، ")+'</p>':"";
   return '<article class="tile unified-record"><span class="auto-provisional">رصد خودکار · انتساب و نتیجه تأییدنشده</span>'
    +'<small dir="ltr">'+esc(r.id)+'</small><h3><a href="'+esc(karnameAutoLink({label:array(r.speaker_labels)[0]||"نام مرتبط با خبر",profile_handle:array(r.speaker_keys)[0]||null}))+'">'+esc(array(r.speaker_labels)[0]||"نام مرتبط با خبر")+'</a></h3>'
    +'<p class="auto-quote">'+esc(r.title)+'</p>'
    +(r.time_label?'<p class="auto-trigger">اشارهٔ زمانی (تأییدنشده): '+esc(r.time_label)+'</p>':"")+similar
    ++sourceBadge(r.id)+'<div class="tile-foot"><a href="'+esc(target)+'">مشاهدهٔ منبع و شرایط ←</a></div></article>';
  }
  return '<article class="tile unified-record unified-screened"><span class="pill open">ممیزی · بدون انتساب قطعی</span>'
    +'<small dir="ltr">'+esc(r.id)+'</small><h3>کنارگذاشته‌شده از ادعاهای قابل‌سنجش</h3>'
    +'<p>'+esc(r.screening_reason||"مورد نیازمند ارزیابی کیفیت")+'</p>'
    +'<p class="muted">متن اولیه به‌عنوان گفتهٔ قطعی یک فرد بازنشر نشده است؛ اصل سند در صف ممیزی حفظ شده است.</p></article>';
 }).join("");
 const more=rows.length>listed.length?'<button type="button" class="unified-more" data-unified-more="true">نمایش '+fa(Math.min(60,rows.length-listed.length))+' مورد بعدی</button>':"";
 return renderVerificationOverview()+intro+tools+'<p class="unified-count">'+fa(listed.length)+' مورد از '+fa(rows.length)+' نتیجه</p>'
   +(rows.length?cards:noData("رکوردی برای این فیلتر نیست","جست‌وجو را تغییر دهید."))+more;
}
function renderAll(){
 const speakers=state.speakers.map(s=>'<option value="'+esc(s.key||s.name)+'" '+(state.speaker===(s.key||s.name)?"selected":"")+'>'+esc(s.name||s.key)+'</option>').join("");
 const controls='<div class="tools"><input id="claim-search" type="search" value="'+esc(state.query)+'" placeholder="جست‌وجو در گفته‌ها، شناسه و نام تحلیلگر…" aria-label="جست‌وجوی ادعاها"><select id="filter-speaker" aria-label="تحلیلگر"><option value="">همهٔ تحلیلگران</option>'+speakers+'</select><select id="filter-status" aria-label="نتیجه"><option value="">همهٔ نتیجه‌ها</option><option value="good" '+(state.status==="good"?"selected":"")+'>درست</option><option value="half" '+(state.status==="half"?"selected":"")+'>نیمه‌درست</option><option value="bad" '+(state.status==="bad"?"selected":"")+'>نادرست</option><option value="wait" '+(state.status==="wait"?"selected":"")+'>منتظر بررسی</option><option value="open" '+(state.status==="open"?"selected":"")+'>باز و بلندمدت</option></select></div>';
 let rows=state.claims.filter(c=>(!state.speaker||array(c.speakers).some(v=>speakerId(v)===state.speaker))&&(!state.status||status(c).key===state.status)&&(!state.query||norm([c.id,c.text,c.speaker_note,people(c).join(" ")].join(" ")).includes(norm(state.query))));
 return controls+showClaims(rows);
}
function render(){
 setHeading();if(!state.data&&state.tab!=="auto"&&state.tab!=="all"&&state.tab!=="people"&&state.tab!=="person"){$("cards").innerHTML=noData("هنوز دادهٔ کارنامه متصل نشده","صفحه ساخته شده است، اما بانک رسمی پیش‌بینی‌ها در مسیر عمومی انتشار موجود نیست. تا دریافت دادهٔ معتبر، هیچ آمار یا نتیجهٔ فرضی منتشر نمی‌کنیم.");return;}
 const views={highlights:renderHighlights,auto:renderAuto,people:renderPeople,person:renderPersonDetail,duels:renderDuels,calendar:renderCalendar,scenarios:renderScenarios,all:renderUnified};
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
  let uf=ev.target.closest("[data-unified-filter]");if(uf){state.unifiedFilter=uf.dataset.unifiedFilter;state.unifiedLimit=60;render();return;}
  if(ev.target.closest("[data-unified-more]")){state.unifiedLimit+=60;render();return;}
  let p=ev.target.closest("[data-person]");if(p){state.speaker=p.dataset.person;state.query="";state.status="";state.unifiedFilter="historical_ledger";state.unifiedQuery=speaker(state.speaker);state.unifiedLimit=60;setTab("all");return;}
  let auto=ev.target.closest("[data-auto-person]");if(auto){state.autoPerson=auto.dataset.autoPerson;state.autoQuery="";state.autoKind="";setTab("auto");return;}
  if(ev.target.closest("[data-auto-reset]")){state.autoPerson="";render();return;}
  let sc=ev.target.closest("[data-scenario-person]");if(sc){state.selectedScenario={speakerKey:sc.dataset.scenarioPerson,family:sc.dataset.scenarioFamily,category:sc.dataset.scenarioKind||""};render();$("scenario-detail")?.scrollIntoView({block:"nearest",behavior:"smooth"});return;}
  if(ev.target.closest("[data-scenario-clear]")){state.selectedScenario=null;render();return;}
 });
 $("cards").addEventListener("input",ev=>{if(ev.target.id==="unified-search"){const pos=ev.target.selectionStart;state.unifiedQuery=ev.target.value;state.unifiedLimit=60;render();let el=$("unified-search");if(el){el.focus();el.setSelectionRange(pos,pos);}return;}});
 $("cards").addEventListener("input",ev=>{if(ev.target.id==="auto-search"){let pos=ev.target.selectionStart;state.autoQuery=ev.target.value;render();let el=$("auto-search");if(el){el.focus();el.setSelectionRange(pos,pos);}return;}});
 $("cards").addEventListener("input",ev=>{if(ev.target.id==="claim-search"){let start=ev.target.selectionStart;state.query=ev.target.value;render();let inp=$("claim-search");if(inp){inp.focus();inp.setSelectionRange(start,start);}}});
 $("cards").addEventListener("change",ev=>{if(ev.target.id==="auto-kind"){state.autoKind=ev.target.value;render();return;} });
 $("cards").addEventListener("change",ev=>{if(ev.target.id==="filter-speaker"){state.speaker=ev.target.value;render();}if(ev.target.id==="filter-status"){state.status=ev.target.value;render();}});
 $("claim-dialog").addEventListener("click",ev=>{let btn=ev.target.closest("[data-share]");if(btn)shareClaim(btn.dataset.share);});
 $("claim-dialog").addEventListener("close",()=>{let url=new URL(location.href);url.searchParams.delete("claim");history.replaceState(null,"",url);});
 window.addEventListener("hashchange",()=>{let tab=location.hash.slice(1);if(labels[tab]){state.tab=tab;render();}});
}
function validIntakeStats(payload){
 if(payload?.schema_version!==1||payload.scope!=="public_aggregate_only")return false;
 const c=payload.counts||{};
 const names=["extracted_candidates","pending_review","screened_out","previously_reviewed","manual_review_requested"];
 if(!names.every(key=>Number.isSafeInteger(c[key])&&c[key]>=0))return false;
 return c.pending_review+c.screened_out+c.previously_reviewed===c.extracted_candidates
  &&c.manual_review_requested<=c.pending_review;
}
async function loadIntakeStats(){
 try{
  const response=await fetch("/karname/intake-stats.json",{cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status);
  const report=await response.json();
  if(!validIntakeStats(report))throw Error("Invalid aggregate schema");
  const c=report.counts,coverage=report.coverage||{};
  $("stat-extracted").textContent=fa(c.extracted_candidates);
  $("stat-pending").textContent=fa(c.pending_review);
  const coverageText=Number.isSafeInteger(coverage.figure_profiles_scanned)&&coverage.figure_profiles_scanned>0
   ?" آخرین پوشش ثبت‌شده: "+fa(coverage.figure_profiles_scanned)+" پروندهٔ چهره و "
    +fa(coverage.figure_posts_scanned||0)+" گفته/پست قابل اسکن.":"";
  $("intake-breakdown").textContent=fa(c.screened_out)+" مورد با حفظ سابقه از صف فعال کنار گذاشته شده؛ "
   +fa(c.manual_review_requested)+" مورد بازبینی ویژه لازم دارد. "
   +"هیچ یک از این آمارها به معنای تأیید نتیجه نیست."+coverageText;
 }catch(err){
  $("stat-extracted").textContent="—";
  $("stat-pending").textContent="—";
  $("intake-breakdown").textContent="آمار صف بررسی فعلاً در دسترس نیست؛ ارقام کارنامهٔ عمومی جداگانه و معتبر باقی می‌مانند.";
  console.warn("Karname aggregate unavailable:",err.message);
 }
}
async function load(){
 void loadIntakeStats();
 void loadAutoRadar();
 void loadUnifiedIndex();
 void loadSourceChecks();
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
const selectedParams=new URL(location.href).searchParams;
const selectedKey=selectedParams.get("speaker")||"";
const selectedMention=selectedParams.get("mention")||"";
if(selectedKey&&selectedKey.length<=110)state.personSelection={key:selectedKey};
else if(selectedMention&&selectedMention.length<=160)state.personSelection={name:selectedMention};
const personParams=new URL(location.href).searchParams;
const requestedSpeaker=personParams.get("speaker")||"";
const requestedMention=personParams.get("mention")||"";
if(requestedSpeaker&&requestedSpeaker.length<=110)state.personSelection={key:requestedSpeaker};
else if(requestedMention&&requestedMention.length<=160)state.personSelection={name:requestedMention};
const observedParam=new URL(location.href).searchParams.get("observation")||"";
if(/^KC-[0-9a-f]{18}$/.test(observedParam))state.autoQuery=observedParam;
const autoSearchParam=new URL(location.href).searchParams.get("search")||"";
if(autoSearchParam&&autoSearchParam.length<=120)state.autoQuery=autoSearchParam;
const autoPersonParam=new URL(location.href).searchParams.get("person")||"";
if(/^[A-Za-z0-9_-]{2,100}$/.test(autoPersonParam))state.autoPerson=autoPersonParam;
let initial=location.hash.slice(1);if(labels[initial])state.tab=initial;else if(state.personSelection)state.tab="person";
render();load();
})();