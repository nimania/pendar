/* Regression fixtures for Pendar's consequence-led, mixed-topic front page. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const source=fs.readFileSync(path.join(root,"web-static/heritage-preview.js"),"utf8");
const markup=fs.readFileSync(path.join(root,"web-static/heritage-preview.html"),"utf8");
const css=fs.readFileSync(path.join(root,"web-static/heritage-preview.css"),"utf8");
const start=source.indexOf("  // Front-page prominence");
const finish=source.indexOf("  function figureStatementPortrait",start);
const renderStart=source.indexOf("    // The front page is an editorial desk");
const renderFinish=source.indexOf("    function renderCurrentFeature(){",renderStart);
assert(start>=0&&finish>start&&renderStart>finish&&renderFinish>renderStart,
  "Front-page ranking and renderer must remain available");
assert(markup.includes('data-feature-category="front" aria-controls="feature-politics-panel" aria-selected="true"'),
  "The front page must remain the default tab");
assert(css.includes(".fp-desk-layout{display:grid"),"Shared editorial desk must be responsive");
assert(css.includes(".fp-related-prominent"),"Related headlines need differential prominence");
assert(markup.includes('class="news-layout home-news-layout"'),
  "The news content must occupy the former combined columns");
assert(markup.includes('class="rail home-below-panels"'),
  "Old sidebar sections should follow the main reading flow");
assert(!markup.includes('id="culture"')&&!markup.includes('id="gallery"'),
  "Unrelated cultural cards and the photo-only gallery must not appear");
assert(css.includes('#home-page .home-news-layout{display:block!important'),
  "Homepage columns must form a single wide reading surface");
assert(css.includes('.home-below-panels'),
  "Supplementary feeds must use responsive bottom grids");

const now=new Date().toISOString();
const stories=[
  {id:"pr",headline_fa:"وزیر: توسعه گردشگری و ثبت رویدادهای ملی را پیگیری می‌کنیم",
    summary_fa:"درباره برنامه‌ریزی وزارت میراث فرهنگی",published_at:now,category:"culture",
    image_url:"/pr.jpg",rank:18},
  {id:"iraq",headline_fa:"نخست‌وزیر عراق دستور بستن گذرگاه مرزی با ایران را داد",
    summary_fa:"گزارش مرزهای ایران و عراق",published_at:now,category:"diplomacy",image_url:"/iraq.jpg"},
  {id:"trump",headline_fa:"ترامپ مدعی پایان جنگ شد",
    summary_fa:"ادعای او درباره جنگ ایران و اسرائیل مطرح شده است",
    published_at:now,category:"diplomacy",image_url:"/trump.jpg"},
  {id:"school",headline_fa:"آموزش و پرورش از تعطیلی مدارس خبر داد",
    published_at:now,category:"society",image_url:"/school.jpg"},
  {id:"sport",headline_fa:"کاروان ایران به مسابقات آسیایی رسید",
    published_at:now,category:"sport",image_url:"/sport.jpg"},
  {id:"weather",headline_fa:"هشدار هواشناسی برای بارندگی شدید و سیلاب",
    published_at:now,category:"environment",image_url:"/weather.jpg"},
  {id:"tech",headline_fa:"هوش مصنوعی و صنعت نرم‌افزار",
    published_at:now,category:"technology",image_url:"/tech.jpg"},
  {id:"econ",headline_fa:"کاهش قیمت دلار در بازار ارز",
    published_at:now,category:"economy",image_url:"/econ.jpg"}
];
const voices=[
  {name:"دیدگاه‌پرداز یک",handle:"figure-one",title:"ایران و پیامدهای جنگ با اسرائیل",
    stamp:Date.now(),portrait:"/figure-one.jpg",portraitVerified:true,url:"/@figure-one/"},
  {name:"دیدگاه‌پرداز دو",handle:"figure-two",title:"بسته‌شدن گذرگاه مرزی و جنگ در ایران",
    stamp:Date.now(),portrait:"/figure-two.jpg",portraitVerified:true,url:"/@figure-two/"},
  {name:"دیدگاه‌پرداز بدون عکس",handle:"missing-photo",title:"جنگ و پیامدها برای ایران",
    stamp:Date.now(),portrait:"",portraitVerified:false,url:"/@missing-photo/"},
  {name:"دیدگاه نامرتبط",handle:"unrelated",title:"درباره یک فیلم تازه",
    stamp:Date.now(),portrait:"/unrelated.jpg",portraitVerified:true,url:"/@unrelated/"}
];
const htmlTarget={innerHTML:""};
const context={
  Date,Math,Set,Map,Array,Number,Intl,
  norm:v=>String(v==null?"":v).replace(/\s+/g," ").trim(),
  featureNormalize:v=>String(v==null?"":v).replace(/\s+/g," ").replace(/ي/g,"ی")
    .replace(/ك/g,"ک").replace(/\u200c/g," ").toLowerCase(),
  headline:v=>String(v.headline_fa||v.title_fa||v.title||""),
  featureRank:v=>40+(v.rank||0),
  featureAge:v=>Date.now()-Date.parse(v.published_at||"2026-01-01"),
  featureCategory:v=>v.category||"",
  figureFeatureItems:voices,featureAllItems:stories,
  el:()=>htmlTarget,
  validImage:v=>typeof v==="string"&&/^\/(?!\/)/.test(v)?v:"",
  verifiedImage:()=>true,
  photo:v=>v.image_url||"",
  slugUrl:v=>"/story/"+v.id+"/",
  esc:v=>String(v==null?"":v).replace(/[&<>"']/g,
    c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),
  excerpt:(v,max)=>String(v).slice(0,max),
  hook:v=>String(v.summary_fa||""),
  lastHomeVisit:0,
  FEATURE_NAMES:{culture:"فرهنگ",diplomacy:"دیپلماسی",society:"جامعه",
    technology:"تکنولوژی",sport:"ورزش",environment:"محیط زیست",economy:"اقتصاد"}
};
vm.createContext(context);
vm.runInContext(source.slice(start,finish)+"\nthis.evaluate=frontEditorialScore;"+
  "this.connect=frontConnection;this.promo=frontRoutinePublicity;",context);
vm.runInContext("this.prioritySignals=frontPrioritySignals;",context);
const testSignals=context.prioritySignals;
const interest=[
  ["احتمال جنگ و مذاکرات صلح", "armed-conflict"],
  ["خبرهای تنگه هرمز", "sea-chokepoints"],
  ["پیمان ابراهیم در خاورمیانه", "negotiations"],
  ["انتخابات آمریکا و اسرائیل", "foreign-elections"],
  ["اعتراض صنفی دانشجویان", "strikes-protests"],
  ["احتمال تعطیلی دانشگاه‌ها", "school-closure"],
  ["اختلال و قطع اینترنت", "internet-shutdown"],
  ["ایلان ماسک از پروژه جدید خبر داد", "musk"],
  ["تیم ملی و علی دایی", "sports-iran"],
  ["تخریب میراث فرهنگی", "environment-harm"],
  ["شایعه درگذشت و تکذیب خبر فوت", "deaths-and-denials"],
  ["کنکور و سربازی", "education-exams"],
  ["قیمت نفت و قیمت سکه", "markets-energy"]
];
for(const [headline_fa,key] of interest){
  assert(testSignals({headline_fa}).some(r=>r.key===key),
    "Missing editorial public-interest signal: "+key);
}
assert(!testSignals({headline_fa:"تخریب جنگل‌های شمال ایران"})
  .some(r=>r.key==="armed-conflict"),
  "Forest destruction must not be misread as armed conflict");
assert(!testSignals({headline_fa:"ضرورت استقلال اقتصادی ایران"})
  .some(r=>r.key==="sports-iran"),
  "Economic independence must not be misread as a football club");
assert(context.promo(stories[0]),"Routine ministerial tourism publicity should be detected");
assert(context.evaluate(stories[0],"culture")<
  context.evaluate(stories[1],"diplomacy"),
  "A prominent institutional headline should lose to consequential border news");
assert(context.evaluate(stories[0],"culture")<
  context.evaluate(stories[2],"diplomacy"),
  "National rhetoric must not outrank a major war claim");
assert(context.connect(stories[1],stories[2]),
  "Iran-related security developments may form a thematic desk");
assert(!context.connect(stories[1],stories[3]),
  "Shared generic news verbs must not connect school closures to border orders");
assert(!context.connect(stories[0],stories[4]),
  "National tourism rhetoric is not related to the Iranian sports delegation");
assert(context.promo({headline_fa:"وزیر بر اهمیت وحدت ملی تأکید کرد"}),
  "Generic national rhetoric by an official must be treated as weak newsworthiness");
assert(!context.connect(
  {headline_fa:"امنیت غذایی ایران و بحران توزیع گندم"},
  {headline_fa:"جنگ ایران و اسرائیل در منطقه"}),
  "Food security must not be mistaken for military conflict");
assert(!context.connect(
  {headline_fa:"فوتبال ایران در بازی جهانی",summary_fa:""},
  {headline_fa:"تیم والیبال در بازی آسیایی",summary_fa:""}),
  "Sharing a category is not sufficient evidence of a related story");
vm.runInContext(source.slice(renderStart,renderFinish)+
  "\nthis.renderDesk=renderFrontPage;",context);
context.renderDesk();
const result=htmlTarget.innerHTML;
const main=result.match(/<section class="fp-desk"[^>]*>([\s\S]*?)<\/section>/);
assert(main,"A shared lead desk must be rendered");
assert(main[1].includes("<h2>"),"The real news headline, not an abstract topic, must head the desk");
assert(!result.includes("چند روایت از یک موضوع"),"Avoid proclaiming uncertain algorithmic relationships");
assert(!result.includes("دیدگاه ثبت‌شده"),"Figure attribution should not require editorial jargon");
assert(main[1].includes("می‌گوید:"),"Figure summaries must be explicitly attributed to their speaker");
assert(/href="\/story\/(iraq|trump)\/"/.test(main[1]),
  "A consequential item must lead the desk");
assert(main[1].includes('href="/story/trump/"')&&
  main[1].includes('href="/story/iraq/"'),
  "Iran-Iraq border news and the contextual Trump claim must appear together");
assert(main[1].includes('href="/@figure-one/"')&&
  main[1].includes('href="/@figure-two/"'),
  "Matching, photographed viewpoints should be part of the same desk");
assert(!main[1].includes('href="/story/pr/"'),
  "Ceremonial news cannot take the lead");
assert(!main[1].includes('href="/story/school/"'),
  "Unrelated school coverage must not be attached to a regional dossier");
assert(!main[1].includes('href="/@missing-photo/"'),
  "Portraitless figures must not be promoted to the main page");
assert(result.includes('href="/story/sport/"')&&result.includes('href="/story/weather/"'),
  "Sports and useful weather must remain discoverable outside the main desk");
// High editorial importance cannot be lost merely because an article photo fails.
context.verifiedImage=url=>url!=="/iraq.jpg";
context.renderDesk();
assert(htmlTarget.innerHTML.includes('href="/story/iraq/"'),
  "A consequential report must survive a missing article photo");
assert(htmlTarget.innerHTML.includes("fp-text-only"),
  "Missing article image must not produce a broken thumbnail");
console.log("Pendar mixed editorial desk regression fixtures OK");
