/* Pendar — US Radar 2026. Editorial snapshot: 2026-10-07. */
const USR_FALLBACK={
 updated:"۷ اکتبر ۲۰۲۶",
 election:"۳ نوامبر ۲۰۲۶",
 house:{r:220,d:215,need:"دموکرات‌ها برای اکثریت به خالص ۳ کرسی نیاز دارند",outlook:"Inside Elections: دموکرات‌ها +۲ تا +۱۰"},
 senate:{r:53,d:47,need:"دموکرات‌ها برای اکثریت به خالص ۴ کرسی نیاز دارند",outlook:"Inside Elections: دموکرات‌ها +۲ تا +۴"},
 generic:{d:44,r:37,label:"Reuters/Ipsos · ۶ اکتبر"},
 map:[
  {code:"AK",state:"آلاسکا",rating:"Toss Up",poll:"رقابت باز"},
  {code:"IA",state:"آیووا",rating:"Toss Up",poll:"رقابت باز"},
  {code:"KS",state:"کانزاس",rating:"Toss Up",poll:"Hamilton +3"},
  {code:"ME",state:"مین",rating:"Toss Up",poll:"Jackson +4"},
  {code:"MI",state:"میشیگان",rating:"Toss Up",poll:"El-Sayed +1"},
  {code:"OH",state:"اوهایو",rating:"Toss Up",poll:"Brown +4"},
  {code:"TX",state:"تگزاس",rating:"Toss Up",poll:"Talarico +6"},
  {code:"NH",state:"نیوهمپشایر",rating:"Lean D",poll:"Pappas +8"},
  {code:"NC",state:"کارولینای شمالی",rating:"Likely D",poll:"Cooper ahead"},
  {code:"GA",state:"جورجیا",rating:"Likely D",poll:"Ossoff ahead"},
  {code:"NE",state:"نبراسکا",rating:"Likely R",poll:"Osborn +1 vs Ricketts"},
  {code:"SC",state:"کارولینای جنوبی",rating:"Likely R",poll:"Graham favored"}
 ],
 candidates:[
  {name:"آدام همیلتون",en:"Adam Hamilton",party:"D",state:"KS",role:"نامزد سنا",handle:"adam-hamilton",iran:"کشیش متدیست؛ چالشگر راجر مارشال در کانزاس."},
  {name:"راجر مارشال",en:"Roger Marshall",party:"R",state:"KS",role:"سناتور",handle:"roger-marshall",iran:"سناتور جمهوری‌خواه کانزاس و مدافع کرسی."},
  {name:"کریس پاپاس",en:"Chris Pappas",party:"D",state:"NH",role:"نامزد سنا",handle:"chris-pappas",iran:"نماینده کنگره؛ نامزد دموکرات کرسی باز نیوهمپشایر."},
  {name:"جان ای. سانونو",en:"John E. Sununu",party:"R",state:"NH",role:"نامزد سنا",handle:"john-sununu",iran:"سناتور سابق؛ نامزد جمهوری‌خواه نیوهمپشایر."},
  {name:"روی کوپر",en:"Roy Cooper",party:"D",state:"NC",role:"نامزد سنا",handle:"roy-cooper",iran:"فرماندار سابق؛ دموکرات پیشتاز در کارولینای شمالی."},
  {name:"مایکل واتلی",en:"Michael Whatley",party:"R",state:"NC",role:"نامزد سنا",handle:"michael-whatley",iran:"رئیس سابق RNC؛ نامزد جمهوری‌خواه."},
  {name:"جیمز تالاریکو",en:"James Talarico",party:"D",state:"TX",role:"نامزد سنا",handle:"james-talarico",iran:"دموکرات تگزاس؛ در نظرسنجی تازه YouGov جلوتر است."},
  {name:"کن پکستون",en:"Ken Paxton",party:"R",state:"TX",role:"نامزد سنا",handle:"ken-paxton",iran:"دادستان کل تگزاس؛ نامزد جمهوری‌خواه."},
  {name:"عبدال السید",en:"Abdul El-Sayed",party:"D",state:"MI",role:"نامزد سنا",handle:"abdul-el-sayed",iran:"نامزد دموکرات میشیگان؛ رقابت بسیار نزدیک."},
  {name:"مایک راجرز",en:"Mike Rogers",party:"R",state:"MI",role:"نامزد سنا",handle:"mike-rogers",iran:"نامزد جمهوری‌خواه میشیگان."},
  {name:"شرود براون",en:"Sherrod Brown",party:"D",state:"OH",role:"نامزد سنا",handle:"sherrod-brown",iran:"سناتور سابق؛ برای بازگشت در انتخابات ویژه تلاش می‌کند."},
  {name:"جان هاستد",en:"Jon Husted",party:"R",state:"OH",role:"سناتور",handle:"jon-husted",iran:"سناتور جمهوری‌خواه و مدافع کرسی ویژه اوهایو."}
 ],
 races:[
  {state:"کانزاس",code:"KS",rating:"Toss Up",fa:"کاملاً رقابتی",shift:"← Lean R",note:"راجر مارشال (جمهوری‌خواه) در برابر آدام همیلتون (دموکرات). Cook در ۶ اکتبر رقابت را یک درجه به سوی دموکرات‌ها جابه‌جا کرد.",iran:"نمونه مهمی از فرسایش جمهوری‌خواهان حتی در ایالت‌های سنتاً قرمز؛ برای سنجش اندازه موج انتخاباتی مهم است."},
  {state:"نیوهمپشایر",code:"NH",rating:"Lean D",fa:"تمایل به دموکرات",shift:"← Toss Up",note:"کریس پاپاس (دموکرات) در برابر جان ای. سانونو (جمهوری‌خواه).",iran:"اگر دموکرات‌ها این کرسی را نگه دارند، مسیر جمهوری‌خواهان برای حفظ حاشیه امن سنا سخت‌تر می‌شود."},
  {state:"کارولینای شمالی",code:"NC",rating:"Likely D",fa:"احتمالاً دموکرات",shift:"← Lean D",note:"روی کوپر (دموکرات) در برابر مایکل واتلی (جمهوری‌خواه).",iran:"یکی از فرصت‌های اصلی تغییر توازن سنا؛ توازن سنا مستقیماً بر انتصاب‌ها، بودجه و فضای سیاست خارجی اثر می‌گذارد."},
  {state:"تگزاس",code:"TX",rating:"رقابتی",fa:"زیر نظر",shift:"",note:"نظرسنجی YouGov در ۵ اکتبر جیمز تالاریکو را ۵۰٪ در برابر کن پکستون ۴۴٪ نشان داد.",iran:"رقابتی شدن تگزاس نشانه‌ای از بزرگی احتمالی تغییر ملی است، اما یک نظرسنجی به‌تنهایی پیش‌بینی نتیجه نیست."},
  {state:"میشیگان",code:"MI",rating:"رقابتی",fa:"لب مرز",shift:"",note:"YouGov در ۶ اکتبر: عبدال السید ۴۹٪، مایک راجرز ۴۸٪.",iran:"کرسی‌ای حساس برای محاسبه اکثریت سنا و سنجش رأی ایالت‌های صنعتی."},
  {state:"اوهایو",code:"OH",rating:"رقابتی",fa:"انتخابات ویژه",shift:"",note:"YouGov در ۶ اکتبر: شرود براون ۴۹٪، جان هاستد ۴۵٪.",iran:"یک pickup احتمالی دیگر برای دموکرات‌ها و بخشی از مسیر چهار کرسی مورد نیاز آنها."}
 ],
 glossary:[
  ["Toss Up","هیچ حزب برتری معناداری ندارد؛ نتیجه واقعاً باز است."],
  ["Lean","یک حزب جلوتر است، اما رقابت همچنان می‌تواند برگردد."],
  ["Likely","یک حزب برتری روشن دارد، ولی نتیجه قطعی تلقی نمی‌شود."],
  ["Solid","رقابت در شرایط عادی غیررقابتی محسوب می‌شود."],
  ["Generic ballot","از رأی‌دهنده می‌پرسد در انتخابات کنگره دموکرات را ترجیح می‌دهد یا جمهوری‌خواه؛ نام نامزد خاصی مطرح نیست."],
  ["Midterm","انتخابات میان‌دوره‌ای؛ وسط دوره چهار ساله رئیس‌جمهور برگزار می‌شود."]
 ]
};
let USR=USR_FALLBACK;
let USR_CANDIDATE_FEEDS={};
async function loadUSRData(){try{const fresh=await getJSON(`${DATA}/us-radar.json?ts=${Date.now()}`);if(fresh&&fresh.updated)USR={...USR_FALLBACK,...fresh};}catch(_){USR=USR_FALLBACK;}}
function usDays(){return Math.max(0,Math.ceil((Date.parse("2026-11-03T05:00:00Z")-Date.now())/86400000));}
function usRatingFa(value){return ({"Toss Up":"رقابت برابر","Lean D":"تمایل به دموکرات‌ها","Lean R":"تمایل به جمهوری‌خواهان","Likely D":"احتمالاً دموکرات","Likely R":"احتمالاً جمهوری‌خواه","Solid D":"برتری قاطع دموکرات‌ها","Solid R":"برتری قاطع جمهوری‌خواهان"})[value]||value;}
function usHouse(){
 const h=USR.house_races||[];return `<div class="usr-house-grid">${h.map(x=>`<article><div><b>${x.district}</b><span class="usr-house-rate ${x.rating.includes("D")?"d":x.rating.includes("R")?"r":"t"}">${usRatingFa(x.rating)}</span></div><h3>${x.name_fa}</h3><p>${x.note_fa}</p><small>${x.why_fa}</small></article>`).join("")}</div>`;
}
function usHistory(){
 const hs=USR.history||[]; if(!hs.length)return "";
 const max=Math.max(...hs.map(x=>Math.abs(x.generic_d||0)),10);
 return `<div class="usr-history"><div class="usr-history-chart">${hs.map(x=>`<div class="usr-hcol" title="${x.date}"><span style="height:${Math.max(8,Math.abs(x.generic_d||0)/max*100)}%"></span><b>${x.generic_d>0?"+":""}${faN(x.generic_d)} D</b><small>${x.label_fa}</small></div>`).join("")}</div><div class="usr-change-log">${hs.slice().reverse().map(x=>`<div><time>${x.date_fa||x.date}</time><p>${x.change_fa}</p></div>`).join("")}</div></div>`;
}
function usGauge(){
 const total=USR.generic.d+USR.generic.r,dp=Math.round(USR.generic.d/total*100);
 return `<div class="usr-gauge"><div class="usr-gauge-bar"><span class="usr-d" style="width:${dp}%"></span><span class="usr-r" style="width:${100-dp}%"></span></div><div class="usr-gauge-labels"><b>دموکرات ${faN(USR.generic.d)}٪</b><b>جمهوری‌خواه ${faN(USR.generic.r)}٪</b></div><small>${USR.generic.label} · رأی عمومی کنگره، نه پیش‌بینی کرسی‌ها</small></div>`;
}
function usCandidateByHandle(h){return (USR.candidates||[]).find(x=>x.handle===h)||null;}
function usRaceHub(x){
 const cs=(x.candidates||[]).map(usCandidateByHandle).filter(Boolean);
 return `<article class="usr-race-hub" id="usr-hub-${x.code}"><header><div><small>${x.race}</small><h3>${x.state} · ${x.code}</h3></div><span class="usr-hub-rating">${usRatingFa(x.rating)}</span></header><p class="usr-hub-why">${x.why}</p>${cs.length?`<div class="usr-matchup">${cs.map(c=>`<button onclick="openFigure('${c.handle}')"><span class="usr-party ${c.party.toLowerCase()}">${c.party}</span><b>${c.name}</b><small>${c.en}</small></button>`).join('<i>VS</i>')}</div>`:""}<div class="usr-hub-stats"><div><small>آخرین نظرسنجی</small><b>${x.poll}</b></div><div><small>ایران‌متر رقابت</small><span>${x.iran}</span></div></div><footer>${x.changed}</footer></article>`;
}
function usRaceHubs(){return `<div class="usr-race-hubs">${(USR.race_hubs||[]).map(usRaceHub).join("")}</div>`;}
function usCandidateNews(){
 const rows=Object.entries(USR_CANDIDATE_FEEDS).flatMap(([handle,p])=>(p.news||[]).map(n=>({...n,handle}))).sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));
 const seen=new Set();const unique=rows.filter(n=>{if(seen.has(n.id))return false;seen.add(n.id);return true}).slice(0,8);
 if(!unique.length)return "";
 return `<section><div class="usr-section-head"><div><h2>تازه‌ترین خبرهای نامزدها</h2></div></div><div class="usr-radar-news">${unique.map(n=>`<article><div><button onclick="openFigure('${n.handle}')">${esc(usCandidateByHandle(n.handle)?.name||n.handle)}</button><time>${esc(relTime(n.published_at))}</time></div><h3><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title_fa||n.title)}</a></h3><small>${esc(n.source)}</small></article>`).join("")}</div></section>`;
}
function usRadarNews(){return `<div class="usr-radar-news">${(USR.radar_news||[]).map(n=>`<article><div><span>${n.tag}</span><time>${n.date}</time></div><h3>${n.headline}</h3><p>${n.summary}</p><small>${n.source}</small></article>`).join("")}</div>`;}
function usMap(){
 const order=["AK","WA","OR","CA","ID","NV","AZ","UT","MT","WY","CO","NM","ND","SD","NE","KS","OK","TX","MN","IA","MO","AR","LA","WI","IL","MI","IN","OH","KY","TN","MS","AL","GA","FL","SC","NC","VA","WV","PA","NY","VT","NH","ME","MA","RI","CT","NJ","DE","MD"];
 const data=new Map(USR.map.map(x=>[x.code,x]));
 return `<div class="usr-map-tools"><button class="on" onclick="usFilter('all',this)">همه</button><button onclick="usFilter('Toss Up',this)">Toss Up</button><button onclick="usFilter('D',this)">متمایل D</button><button onclick="usFilter('R',this)">متمایل R</button></div><div class="usr-map" aria-label="نقشه رقابت‌های سنای آمریکا">${order.map(code=>{const x=data.get(code),cl=x?x.rating.includes("D")?"d":x.rating.includes("R")?"r":"t":"quiet";return `<button class="${cl}" data-code="${code}" data-rating="${x?.rating||""}" onclick="usPickState('${code}')" title="${x?x.state+" · "+x.rating:""}"><b>${code}</b>${x?`<small>${usRatingFa(x.rating)}</small>`:""}</button>`}).join("")}</div><div id="usr-map-detail" class="usr-map-detail">روی یک ایالت رنگی بزن تا وضعیتش را ببینی.</div>`;
}
function usPickState(code){const x=USR.map.find(y=>y.code===code);if(!x)return;document.getElementById("usr-map-detail").innerHTML=`<b>${x.state} · ${x.code}</b><span>${usRatingFa(x.rating)}</span><strong>${x.poll}</strong>`;const hub=document.getElementById('usr-hub-'+code);const card=hub||document.querySelector('[data-race="'+code+'"]');if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.classList.add('pulse');setTimeout(()=>card.classList.remove('pulse'),1200);}}
function usFilter(kind,btn){document.querySelectorAll(".usr-map-tools button").forEach(x=>x.classList.toggle("on",x===btn));document.querySelectorAll(".usr-map button").forEach(el=>{const r=el.dataset.rating;el.classList.toggle("dim",kind!=="all" && (kind==="D"?!r.includes("D"):kind==="R"?!r.includes("R"):r!==kind));});}
function usIranMeter(){
 const ms=USR.iran_meter||[], sig=USR.iran_signals||[];
 return `<div class="usr-signal-strip">${sig.map(x=>`<article><b>${x.value}</b><strong>${x.label_fa}</strong><p>${x.note_fa}</p></article>`).join("")}</div>
 <div class="usr-meter-grid">${ms.map(x=>`<article class="usr-meter-card"><header><span class="usr-party ${x.party.toLowerCase()}">${x.party}</span><div><h3>${x.name_fa}</h3><small>${x.state} · اطمینان داده: ${x.confidence}</small></div></header><div class="usr-meter-row"><b>جنگ ایران</b><span>${x.war}</span></div><div class="usr-meter-row"><b>اختیارات جنگی</b><span>${x.war_power}</span></div><div class="usr-meter-row"><b>تحریم/دیپلماسی</b><span>${x.sanctions}</span></div><div class="usr-meter-row"><b>اسرائیل</b><span>${x.israel}</span></div><div class="usr-meter-row"><b>نسبت با ترامپ</b><span>${x.trump}</span></div><p class="usr-meter-summary">${x.summary_fa}</p><footer>${x.source} · تا ${x.asof}</footer></article>`).join("")}</div>`;
}
function usCandidate(c){return `<article class="usr-person usr-person-link" id="usr-person-${c.handle}" role="link" tabindex="0" onclick="openFigure(\'${c.handle}\')" onkeydown="if(event.key===\'Enter\')openFigure(\'${c.handle}\')"><span class="usr-party ${c.party.toLowerCase()}">${c.party}</span><div><h3>${c.name}</h3><small>${c.en} · ${c.state} · ${c.role}</small><p>${c.iran}</p><b class="usr-open-person">صفحه چهره ←</b></div></article>`;}
function usRace(x){return `<article class="usr-race" data-race="${x.code}"><div class="usr-state"><span>${x.code}</span><div><h3>${x.state}</h3><small>سنا ۲۰۲۶</small></div></div><div class="usr-rating">${x.fa}<small>${usRatingFa(x.rating)} ${x.shift}</small></div><p>${x.note}</p><div class="usr-iran"><b>چرا برای ایران مهم است؟</b>${x.iran}</div></article>`;}
function renderUSRadar(){
 const root=document.getElementById("us-radar-content"); if(!root)return;
 root.innerHTML=`<header class="usr-hero"><div class="usr-kicker">PENDAR · US RADAR 2026</div><h1>رادار آمریکا</h1><p>انتخابات میان‌دوره‌ای آمریکا، برای کسی که از ایران دنبال می‌کند.</p><div class="usr-count"><b>${faN(usDays())}</b><span>روز تا انتخابات<br><small>${USR.election}</small></span></div><div class="usr-fresh">آخرین بازبینی: ${USR.updated}</div></header>
 <section class="usr-now"><div class="usr-section-head"><div><small>تصویر سریع</small><h2>اگر امروز نگاه کنیم، چه می‌بینیم؟</h2></div></div>
 <div class="usr-chambers"><article><span>مجلس نمایندگان</span><div class="usr-seatline"><b class="dem">${faN(USR.house.d)} D</b><i></i><b class="rep">${faN(USR.house.r)} R</b></div><p>${USR.house.need}</p><strong>${USR.house.outlook}</strong></article><article><span>سنا</span><div class="usr-seatline"><b class="dem">${faN(USR.senate.d)} D</b><i></i><b class="rep">${faN(USR.senate.r)} R</b></div><p>${USR.senate.need}</p><strong>${USR.senate.outlook}</strong></article></div>
 ${usGauge()}<div class="usr-take"><b>جانِ وضعیت</b><p>مجلس نمایندگان در حال حاضر هدف آسان‌تر دموکرات‌هاست. سنا دشوارتر است، اما تغییر رتبه‌بندی‌های اوایل اکتبر مسیر تصاحب آن را واقعی‌تر کرده است. این صفحه «پیش‌بینی قطعی» نیست؛ تغییر جهت رقابت را نشان می‌دهد.</p></div></section>
 <section><div class="usr-section-head"><div><small>نقشه رقابت</small><h2>کدام ایالت‌ها تعیین‌کننده‌اند؟</h2></div><span>Cook Political Report · ۶ اکتبر</span></div>${usMap()}</section>
 <section><div class="usr-section-head"><div><small>رقابت‌های حساس</small><h2>از نقشه تا خود رقابت</h2></div><span>ایالت → نامزدها → نظرسنجی → ایران‌متر → تغییر</span></div>${usRaceHubs()}</section>${usCandidateNews()}
 <section><div class="usr-section-head"><div><small>امروز چه تغییر کرد؟</small><h2>خبرهای رادار</h2></div><span>فقط تغییراتی که روی نقشه اثر دارند</span></div>${usRadarNews()}</section>
 <section><div class="usr-section-head"><div><small>میدان نبرد</small><h2>رقابت‌هایی که باید نگاه کرد</h2></div><span>رتبه‌بندی و نظرسنجی‌ها ممکن است تغییر کنند</span></div><div class="usr-races">${USR.races.map(usRace).join("")}</div></section>
 <section><div class="usr-section-head"><div><small>چهره‌ها</small><h2>نام‌هایی که باید بشناسی</h2></div><span>کارت‌های داخلی رادار؛ آماده اتصال به هویت‌های سراسری پندار</span></div><div class="usr-people">${USR.candidates.map(usCandidate).join("")}</div></section>
 <section><div class="usr-section-head"><div><small>مجلس نمایندگان</small><h2>کرسی‌هایی که اکثریت را تعیین می‌کنند</h2></div><span>دموکرات‌ها فقط خالص ۳ کرسی نیاز دارند</span></div>${usHouse()}</section>
 <section><div class="usr-section-head"><div><small>مسیر حرکت</small><h2>رادار نسبت به قبل کجا رفته؟</h2></div><span>تاریخچه snapshotها</span></div>${usHistory()}</section>
 <section class="usr-iran-meter"><div class="usr-section-head"><div><small>مواضع دربارهٔ ایران</small><h2>ایران‌متر نامزدها</h2></div><span>موضع مستند، نه امتیاز سلیقه‌ای</span></div><p class="usr-meter-intro">هر محور جداگانه ثبت می‌شود. «نامشخص» یعنی هنوز شاهد مستقیم و کافی برای نسبت‌دادن موضع نداریم؛ نبود داده با موضع سیاسی اشتباه گرفته نمی‌شود.</p>${usIranMeter()}</section>
 <section class="usr-iran-panel"><div class="usr-section-head"><div><small>لنز پندار</small><h2>این انتخابات چه ربطی به ایران دارد؟</h2></div></div><div class="usr-impact"><article><b>کنترل کنگره</b><p>اکثریت مجلس و سنا بر بودجه، نظارت بر دولت و فضای سیاسی سیاست خارجی اثر می‌گذارد.</p></article><article><b>جنگ و اختیارات رئیس‌جمهور</b><p>در رقابت‌های نزدیک، موضع نامزدها درباره درگیری ایران و اختیارات جنگی به موضوع انتخاباتی تبدیل شده است.</p></article><article><b>تحریم و انتصاب‌ها</b><p>سنا در تأیید مقام‌های ارشد و قضات نقش دارد؛ ترکیب آن می‌تواند میدان مانور دولت را تغییر دهد.</p></article><article><b>سیگنال ۲۰۲۸</b><p>میان‌دوره‌ای میزان محبوبیت دولت ترامپ و جهت افکار عمومی را پیش از رقابت ریاست‌جمهوری بعدی اندازه می‌گیرد.</p></article></div></section>
 <section><div class="usr-section-head"><div><small>راهنمای سریع</small><h2>اصطلاحات را بلد نیستی؟</h2></div></div><div class="usr-glossary">${USR.glossary.map(g=>`<details><summary>${g[0]}</summary><p>${g[1]}</p></details>`).join("")}</div></section>
 <section class="usr-sources"><b>روش و منابع داده</b><p>Snapshot این نسخه بر پایه رتبه‌بندی‌های Cook Political Report و Inside Elections و نظرسنجی‌های منتشرشده تا ۷ اکتبر ۲۰۲۶ ساخته شده است. رتبه‌بندی رقابت با نتیجه انتخابات یکی نیست و نظرسنجی منفرد نیز پیش‌بینی قطعی محسوب نمی‌شود.</p><div>Cook Political Report · Inside Elections · Reuters/Ipsos · YouGov · CBS News</div></section>`;
}
async function showUSRadar(){show("usradar");setTab("");setHash("#/us-radar");document.title="رادار آمریکا ۲۰۲۶ | پندار";await loadUSRData();try{USR_CANDIDATE_FEEDS=(await getJSON(DATA+"/candidate-feeds.json?v="+Date.now())).people||{};}catch(_){}renderUSRadar();}
