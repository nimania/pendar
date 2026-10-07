/* Pendar — US Radar 2026. Editorial snapshot: 2026-10-07. */
const USR={
 updated:"۷ اکتبر ۲۰۲۶",
 election:"۳ نوامبر ۲۰۲۶",
 house:{r:220,d:215,need:"دموکرات‌ها برای اکثریت به خالص ۳ کرسی نیاز دارند",outlook:"Inside Elections: دموکرات‌ها +۲ تا +۱۰"},
 senate:{r:53,d:47,need:"دموکرات‌ها برای اکثریت به خالص ۴ کرسی نیاز دارند",outlook:"Inside Elections: دموکرات‌ها +۲ تا +۴"},
 generic:{d:44,r:37,label:"Reuters/Ipsos · ۶ اکتبر"},
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
function usDays(){return Math.max(0,Math.ceil((Date.parse("2026-11-03T05:00:00Z")-Date.now())/86400000));}
function usGauge(){
 const total=USR.generic.d+USR.generic.r,dp=Math.round(USR.generic.d/total*100);
 return `<div class="usr-gauge"><div class="usr-gauge-bar"><span class="usr-d" style="width:${dp}%"></span><span class="usr-r" style="width:${100-dp}%"></span></div><div class="usr-gauge-labels"><b>دموکرات ${faN(USR.generic.d)}٪</b><b>جمهوری‌خواه ${faN(USR.generic.r)}٪</b></div><small>${USR.generic.label} · رأی عمومی کنگره، نه پیش‌بینی کرسی‌ها</small></div>`;
}
function usRace(x){return `<article class="usr-race"><div class="usr-state"><span>${x.code}</span><div><h3>${x.state}</h3><small>سنا ۲۰۲۶</small></div></div><div class="usr-rating">${x.fa}<small>${x.rating} ${x.shift}</small></div><p>${x.note}</p><div class="usr-iran"><b>چرا برای ایران مهم است؟</b>${x.iran}</div></article>`;}
function renderUSRadar(){
 const root=document.getElementById("us-radar-content"); if(!root)return;
 root.innerHTML=`<header class="usr-hero"><div class="usr-kicker">PENDAR · US RADAR 2026</div><h1>رادار آمریکا</h1><p>انتخابات میان‌دوره‌ای آمریکا، برای کسی که از ایران دنبال می‌کند.</p><div class="usr-count"><b>${faN(usDays())}</b><span>روز تا انتخابات<br><small>${USR.election}</small></span></div><div class="usr-fresh">آخرین بازبینی: ${USR.updated}</div></header>
 <section class="usr-now"><div class="usr-section-head"><div><small>تصویر سریع</small><h2>اگر امروز نگاه کنیم، چه می‌بینیم؟</h2></div></div>
 <div class="usr-chambers"><article><span>مجلس نمایندگان</span><div class="usr-seatline"><b class="dem">${faN(USR.house.d)} D</b><i></i><b class="rep">${faN(USR.house.r)} R</b></div><p>${USR.house.need}</p><strong>${USR.house.outlook}</strong></article><article><span>سنا</span><div class="usr-seatline"><b class="dem">${faN(USR.senate.d)} D</b><i></i><b class="rep">${faN(USR.senate.r)} R</b></div><p>${USR.senate.need}</p><strong>${USR.senate.outlook}</strong></article></div>
 ${usGauge()}<div class="usr-take"><b>جانِ وضعیت</b><p>مجلس نمایندگان در حال حاضر هدف آسان‌تر دموکرات‌هاست. سنا دشوارتر است، اما تغییر رتبه‌بندی‌های اوایل اکتبر مسیر تصاحب آن را واقعی‌تر کرده است. این صفحه «پیش‌بینی قطعی» نیست؛ تغییر جهت رقابت را نشان می‌دهد.</p></div></section>
 <section><div class="usr-section-head"><div><small>میدان نبرد</small><h2>رقابت‌هایی که باید نگاه کرد</h2></div><span>رتبه‌بندی و نظرسنجی‌ها ممکن است تغییر کنند</span></div><div class="usr-races">${USR.races.map(usRace).join("")}</div></section>
 <section class="usr-iran-panel"><div class="usr-section-head"><div><small>لنز پندار</small><h2>این انتخابات چه ربطی به ایران دارد؟</h2></div></div><div class="usr-impact"><article><b>کنترل کنگره</b><p>اکثریت مجلس و سنا بر بودجه، نظارت بر دولت و فضای سیاسی سیاست خارجی اثر می‌گذارد.</p></article><article><b>جنگ و اختیارات رئیس‌جمهور</b><p>در رقابت‌های نزدیک، موضع نامزدها درباره درگیری ایران و اختیارات جنگی به موضوع انتخاباتی تبدیل شده است.</p></article><article><b>تحریم و انتصاب‌ها</b><p>سنا در تأیید مقام‌های ارشد و قضات نقش دارد؛ ترکیب آن می‌تواند میدان مانور دولت را تغییر دهد.</p></article><article><b>سیگنال ۲۰۲۸</b><p>میان‌دوره‌ای میزان محبوبیت دولت ترامپ و جهت افکار عمومی را پیش از رقابت ریاست‌جمهوری بعدی اندازه می‌گیرد.</p></article></div></section>
 <section><div class="usr-section-head"><div><small>راهنمای سریع</small><h2>اصطلاحات را بلد نیستی؟</h2></div></div><div class="usr-glossary">${USR.glossary.map(g=>`<details><summary>${g[0]}</summary><p>${g[1]}</p></details>`).join("")}</div></section>
 <section class="usr-sources"><b>روش و منابع داده</b><p>Snapshot این نسخه بر پایه رتبه‌بندی‌های Cook Political Report و Inside Elections و نظرسنجی‌های منتشرشده تا ۷ اکتبر ۲۰۲۶ ساخته شده است. رتبه‌بندی رقابت با نتیجه انتخابات یکی نیست و نظرسنجی منفرد نیز پیش‌بینی قطعی محسوب نمی‌شود.</p><div>Cook Political Report · Inside Elections · Reuters/Ipsos · YouGov · CBS News</div></section>`;
}
function showUSRadar(){show("usradar");setTab("");setHash("#/us-radar");document.title="رادار آمریکا ۲۰۲۶ | پندار";renderUSRadar();}
