/* Pulse and sourced editorial-thumbnail regression tests. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const js=fs.readFileSync(path.join(root,"web-static/heritage-preview.js"),"utf8");
const css=fs.readFileSync(path.join(root,"web-static/heritage-preview.css"),"utf8");
const markup=fs.readFileSync(path.join(root,"web-static/heritage-preview.html"),"utf8");
const out={};
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,
  c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pulseA=js.indexOf("  function renderPulseMetrics(");
const pulseB=js.indexOf("  function renderHomepageBriefs(){",pulseA);
assert(pulseA>0&&pulseB>pulseA,"Price ticker must have isolated rendering logic");
const draw=new Function("put","esc","norm",
  js.slice(pulseA,pulseB)+"return renderPulseMetrics;")(
  (key,value)=>{out[key]=value;},esc,v=>String(v||"").trim());
const rates={
  generated_at:new Date().toISOString(),
  rows:[
    {ticker:"USD",quote:"IRT",value:110000,dp:1.4,updated_at:new Date().toISOString()},
    {ticker:"EUR",quote:"IRT",value:121000,dp:-.2,updated_at:new Date().toISOString()},
    {ticker:"TRY",quote:"IRT",value:3500,dp:0.5,updated_at:new Date().toISOString()},
    {ticker:"COIN_EMAMI",quote:"IRT",value:117000000,dp:0,updated_at:new Date().toISOString()},
    {ticker:"USDT",quote:"IRT",value:111100,dp:1.1,updated_at:new Date().toISOString()},
    {ticker:"GOLD18",quote:"IRT",value:10900000,dp:0.4,updated_at:new Date().toISOString()},
    {ticker:"USD",quote:"USD",value:1,dp:0,updated_at:new Date().toISOString()}
  ]
};
const weather=[{city_fa:"تهران",temp:0,cond_fa:"صاف",icon:"☀️"},
  {city_fa:"مشهد",temp:27,cond_fa:"ابری"}];
draw(rates,[],weather);
let pulse=out.ticker;
assert(pulse.includes("دلار")&&pulse.includes("یورو")&&pulse.includes("سکه"),"Major assets must be included");
assert(pulse.includes("لیر ترکیه")&&pulse.includes("۳٬۵۰۰"),
  "Turkish lira must be present as a correctly quoted IRT currency");
assert(pulse.includes("تتر")&&pulse.includes("طلای ۱۸"),
  "Tether and 18K gold appear only when real toman quotes exist");
assert(pulse.includes("۱۱۱٬۱۰۰"),"USDT/IRT must come from Nabzesh, in toman");
assert(!pulse.includes("دادهٔ قدیمی"),"Fresh source data must not be treated as old");
assert(pulse.includes("هوای تهران")&&pulse.includes("۰°"),"Tehran temperature of zero is valid");
assert(!pulse.includes("مشهد"),"Pulse weather is specific to Tehran");
assert(pulse.includes("pulse-change up")&&pulse.includes("pulse-change down"),"Moves are directional");
assert(pulse.includes('href="/market/"')&&pulse.includes('href="/weather/"'),"Items link to source sections");
const tgju=[
  {label_fa:"دلار آمریکا",value:108700,dp:0.7},
  {label_fa:"یورو",value:119900,dp:-0.1},
  {label_fa:"سکه امامی",value:114000000,dp:0}
];
draw(null,tgju,weather);
pulse=out.ticker;
assert(pulse.includes("۱۰۸٬۷۰۰"),"TGJU fallback must be shown only for supported values");
assert(!pulse.includes("تتر")&&!pulse.includes("طلای ۱۸"),
  "Missing optional prices must be omitted, not displayed with dashes");
assert(!pulse.includes("NaN")&&!pulse.includes("undefined"),"Missing quote must stay missing");
draw({...rates,generated_at:new Date(Date.now()-5*3600000).toISOString()},[],weather);
assert(out.ticker.includes("قدیمی"),"Stale market snapshots must be labelled");
assert(!out.ticker.includes("تتر")&&!out.ticker.includes("طلای ۱۸"),
  "Optional quotes must also disappear if the source snapshot is stale");
draw({generated_at:new Date().toISOString(),rows:[
  {ticker:"USDT",quote:"USD",value:1,dp:0}
]},[],[]);
assert(!out.ticker.includes("۱ تومان"),"A USD-quoted USDT rate must not masquerade as tomans");
assert(!out.ticker.includes("تتر"),"USD-only Tether quotes must be omitted");

const thumbsA=js.indexOf("  function authorPortraitThumb(");
const thumbsB=js.indexOf("  function put(id,html)",thumbsA);
assert(thumbsA>0&&thumbsB>thumbsA,"Known editorial author photo helper must exist");
const directory={authors:[{id:"diplomacy",portrait_status:"installed",
  portrait_index:0,portrait_url:"/assets/editorial/pendar-authors-sprite.avif",
  display_name_fa:"آرمان شایگان"}]};
let ok=false;
const authorPhoto=new Function("data","validImage","verifiedImage","photo","esc",
  js.slice(thumbsA,thumbsB)+"return newsMiniPhoto;")(
  directory,v=>typeof v==="string"&&v.startsWith("/")?v:"",
  ()=>ok,r=>r.image_url||"",esc);
const authored={editorial_author_id:"diplomacy",image_url:"/assets/report.jpg"};
const noImage={editorial_author_id:"diplomacy",image_url:""};
ok=false;
const fallback=authorPhoto(noImage,"fp-related-thumb");
assert(fallback.includes("news-author-photo")&&fallback.includes("آرمان شایگان"),
  "Missing article image must use only its installed writer's portrait");
assert(fallback.includes('aria-label="عکس نویسنده:')&&!fallback.includes("<img"),
  "A fallback portrait must identify its writer accessibly, without an unrelated news photograph");
assert(!fallback.includes("<small>نویسنده</small>"),
  "Circular Pendar staff photos must not have a text watermark");
ok=true;
const pictured=authorPhoto(authored,"fp-related-thumb");
assert(pictured.includes('<img src="/assets/report.jpg"')&&pictured.includes("news-author-photo"),
  "Verified story image is primary and writer avatar is the graceful fallback");
ok=false;
assert(authorPhoto({author_id:"unknown"},"fp-related-thumb")==="",
  "Unknown or unattributed authors must not get fabricated portraits");
assert(!markup.includes('class="feature-category-tabs"')&&
  !markup.includes('class="masthead-navigation"'),"Unneeded navigation must remain absent");
assert(markup.includes('class="footer-directory"')&&
  markup.includes('href="/market/"')&&markup.includes('href="/figures/"'),
  "All site sections need a minimal footer directory");
assert(css.includes("overflow-wrap:anywhere")&&
  css.includes("#home-page .feature-front-page .fp-desk .fp-lead .fp-copy h2"),
  "Long Persian headlines must wrap inside constrained columns");
assert(css.includes(".news-mini-photo")&&css.includes(".pulse-items"),
  "Native Pendar styles must cover thumbnails and pulse");
const system=css.slice(css.indexOf("/* PENDAR CANONICAL DESIGN SYSTEM"));
assert(system.length>10000,"Canonical theme layer must load after the legacy magazine rules");
assert(system.includes("--ph-paper:var(--paper,#f2f4f0)") &&
  system.includes("--ph-accent:var(--accent,#155a4f)") &&
  system.includes("--ph-line:var(--line,#e1e3dc)"),
  "Live homepage must inherit the original Pendar tokens, not invent another palette");
assert(system.includes("background:var(--ph-surface)!important") &&
  system.includes("border-top:3px solid var(--ph-accent)!important"),
  "Editorial desk must use original Pendar card surface and forest-green accent");
assert(system.includes("background:var(--ph-paper,var(--paper,#f2f4f0))!important") &&
  system.includes("color:var(--ph-muted,var(--ink-soft,#474d49))!important"),
  "Footer must use the Pendar paper and ink palette instead of a dark blue block");
assert(!/#(?:17283e|1e4869|eaf2ff|f5f7ff|162c49)/i.test(system),
  "Blue dashboard colors must not return in the canonical design layer");
assert(system.includes("@media(max-width:1150px)") &&
  system.includes("@media(max-width:650px)") &&
  system.includes("@media(max-width:540px)"),
  "Responsive editorial layout and market strip must be retained");

const articleSignature=css.slice(css.indexOf("/* PENDAR ARTICLE SIGNATURE 2026-10-21"));
assert(articleSignature.length>12000,"The article-matching visual layer is required");
assert(articleSignature.includes("background:#2a2928!important") &&
  articleSignature.includes("border-top:4px solid #dc651e!important"),
  "Home must reproduce the story reader's charcoal masthead and orange editorial rules");
assert(articleSignature.includes("font:850 clamp(26px,3vw,38px)/1.65") &&
  articleSignature.includes("color:#495a52!important"),
  "Front-page article heading and lead must follow the story-page hierarchy");
assert(articleSignature.includes("min-height:0!important;height:auto!important") &&
  articleSignature.includes("fp-lead.fp-text-only"),
  "Image-free leads must not become tall empty slabs");
assert(articleSignature.includes("fp-lead-writer") &&
  js.includes("authorPortraitThumb(entry.row)"),
  "A legitimate installed writer may be shown as a small article byline");
const indexMarkup=fs.readFileSync(path.join(root,"web-static/index.html"),"utf8");
assert(indexMarkup.includes('id="pendar-shared-top-header"') &&
  !indexMarkup.includes('id="pendar-magazine-header-final"'),
  "Single dark loading masthead avoids duplicate conflicting first-paint rules");
assert(markup.includes('masthead-tagline')&&markup.includes('/assets/pendar-logo.svg'),
  "Homepage masthead has its real brand and matching editorial tagline");
// Approved editorial identity must remain; the fixes are only hygiene.
assert(css.includes("APPROVED HOME EDITION"),"Visual approval must be retained as an explicit baseline");
assert(css.includes('[data-rail-group="figures"]{')&&
  css.includes('grid-column:1/-1'),
  "The final people panel must span the full row, not leave two empty columns");
assert(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))')&&
  css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),
  "The people strip must be responsive on large and small screens");
assert(js.includes('var belowVisibleIds=new Set(latestReports.map(')&&
  js.includes('!frontVisibleIds.has(row.id)&&!belowVisibleIds.has(row.id)'),
  "Default editorial panels must prefer stories not already shown above");
assert(js.includes('frontVisibleIds=new Set(usedNews)'),
  "Only displayed front-page records may be excluded from lower modules");
assert(js.includes('trends:records.slice().sort(') &&
  markup.includes('data-rail-tab="trends">پربحث‌ها'),
  "The engagement-driven people tab must render and must not claim measured search trends");
assert(js.includes('rail-row-text-only')&&js.includes('if(frame)frame.remove()'),
  "Missing article images must never leave empty grey thumbnail frames");
assert(markup.includes('class="home-destinations"') &&
  ['/radar/iran-scenarios/','/us-radar/','/israel-radar/','/diner/']
    .every(href=>markup.includes('href="'+href+'"')),
  "All three radar and Diner destination cards must appear below news panels");
assert(css.includes("fp-desk-bottom")&&js.includes('editorialStream(main)')&&
  js.includes('var sideCapacity=(layout==="breaking"||layout==="sparse")?0:')&&
  js.includes('var belowItems=stream.slice(sideCapacity);'),
  "The live news/quotes arrangement must flow beyond either fixed column");
assert(!js.includes('}).slice(0,4);\n        var issue='),
  "Related speakers must no longer have a fixed four-person quota");
assert(css.includes(':has(.news-author-photo):not(:has(img))')&&
  css.includes('border:2px solid #dc651e!important'),
  "Editorial writer portraits must be circular with Pendar-orange rings");
// A low-resolution photograph remains suitable as a tiny rail thumbnail, but
// should not be enlarged into a soft-focus editorial cover.
const thumbWithSizes=new Function("data","validImage","verifiedImage","photo","esc","imageDimensions",
  js.slice(thumbsA,thumbsB)+"return newsMiniPhoto;")(
  directory,v=>typeof v==="string"&&v.startsWith("/")?v:"",
  ()=>true,r=>r.image_url||"",esc,
  new Map([["/assets/report.jpg",{width:320,height:210}]])
);
const smallSlot=thumbWithSizes(authored,"fp-image");
const tinySlot=thumbWithSizes(authored,"rail-thumb");
assert(!smallSlot.includes("<img")&&smallSlot.includes("news-author-photo"),
  "Low-resolution image must be replaced by the actual writer on large cards");
assert(tinySlot.includes('<img src="/assets/report.jpg"'),
  "The same authentic article photo may remain in the small rail");
// A source-backed recent statement, not the person's job title, fills the
// figures strip. Fixture texts below are synthetic examples, not quotations.
const figA=js.indexOf("  // Statements, not professional titles");
const figB=js.indexOf("  function initializeRailTabs(){",figA);
assert(figA>0&&figB>figA,"Figure quote ranking and display must exist");
const figureNodes=js.slice(figA,figB);
const figureFrame={};
const figureFunctions=new Function("norm","validImage","esc","excerpt","put","el",
  figureNodes+"return {latest:latestFigureStatement,rank:figureQuoteProminence,render:renderRailFigureFive};")(
  v=>String(v==null?"":v).trim(),
  v=>typeof v==="string"&&v.startsWith("/"),
  esc,(v,max)=>String(v).slice(0,max),
  (key,value)=>{figureFrame[key]=value;},
  key=>({classList:{toggle:(cls,flag)=>{figureFrame[key+":feature"]=Boolean(flag);}}})
);
const today=new Date().toISOString();
const yesterday=new Date(Date.now()-28*3600000).toISOString();
const oldDate=new Date(Date.now()-20*86400000).toISOString();
const fakeRecent="ارزیابی تازه دربارهٔ مذاکرات و تحولات امنیتی منطقه منتشر شد و باید روند تصمیم‌ها را دید";
const fakePrevious="در خبر پیشین به روابط خارجی و تصمیم‌های سیاسی منطقه پرداخته شده بود";
const testFigure={
  handle:"test-observer",name_fa:"پژوهشگر آزمایشی",role_fa:"تحلیلگر",
  avatar:"/test-observer.jpg",
  posts:[
    {published_at:yesterday,summary_fa:fakePrevious,kind:"analysis"},
    {published_at:today,summary_fa:fakeRecent,kind:"analysis"}
  ]
};
let last=figureFunctions.latest(testFigure,Date.now());
assert(last&&last.text===fakeRecent,"Choose the most recent dated published statement, not an older popular one");
assert(last.direct===false,"An editorial summary must never masquerade as an exact quotation");
assert(figureFunctions.latest({posts:[{published_at:oldDate,summary_fa:fakeRecent}]},Date.now())===null,
  "A several-week-old quotation must not be labeled current");
assert(figureFunctions.latest({posts:[{published_at:today,topic_fa:"سیاست"}]},Date.now())===null,
  "A bare topic label is not a supported claim by a public figure");
const figures=[testFigure,...Array.from({length:4},(_,i)=>({
  handle:"figure-"+i,name_fa:"شخص آزمایشی "+i,role_fa:"سمت آزمایشی",
  avatar:"/figure-"+i+".jpg",posts:[]
}))];
figureFunctions.render({figures});
const figuresLine=figureFrame["rail-figures-updated"];
assert(figuresLine.includes("rail-figure-featured"),
  "A current source-backed statement should create one editorial feature");
assert(figuresLine.includes(esc(fakeRecent)),
  "The person's latest actual source summary, not their static biography, must be shown");
assert(!figuresLine.includes('title="گفتهٔ این چهره;'),
  "Source attribution must not imply a direct quotation");
assert(figuresLine.includes('href="/@test-observer/"'),
  "Readers must be able to check the figure's own profile");
assert(figureFrame["rail-figures-updated:feature"]===true,
  "Only a five-card row with a qualifying recent opinion receives a larger card");
assert(css.includes("rail-figures-has-lead")&&css.includes("grid-template-columns:repeat(6,minmax(0,1fr))"),
  "One double-width figure must fit exactly alongside four regular figures");
figureFunctions.render({figures:figures.slice(0,3)});
assert(figureFrame["rail-figures-updated:feature"]===false,
  "Sparse rows must not create blank layout columns");
figureFunctions.render({figures:figures.slice(1)});
assert(!figureFrame["rail-figures-updated"].includes("rail-figure-statement"),
  "Do not manufacture a statement for a figure with no reliable dated post");

console.log("Market pulse, Tehran weather, writer fallback and layout checks passed");
