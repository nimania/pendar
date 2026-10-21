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
assert(pulse.includes("تتر")&&pulse.includes("طلای ۱۸"),"USDT and gold must have their own cards");
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
assert(pulse.includes("تتر")&&pulse.includes("—"),"No fake USDT fallback through USD conversion");
assert(!pulse.includes("NaN")&&!pulse.includes("undefined"),"Missing quote must stay missing");
draw({...rates,generated_at:new Date(Date.now()-5*3600000).toISOString()},[],weather);
assert(out.ticker.includes("قدیمی"),"Stale market snapshots must be labelled");
draw({generated_at:new Date().toISOString(),rows:[
  {ticker:"USDT",quote:"USD",value:1,dp:0}
]},[],[]);
assert(!out.ticker.includes("۱ تومان"),"A USD-quoted USDT rate must not masquerade as tomans");

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
assert(fallback.includes("نویسنده")&&!fallback.includes("<img"),
  "Author fallback must be clearly labelled as the writer, not the story subject");
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
console.log("Market pulse, Tehran weather, writer fallback and layout checks passed");
