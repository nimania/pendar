/* Test the production homepage renderer with real section assignment and image dimensions. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../../web-static/heritage-preview.js"),"utf8");
const id=n=>"12345678-1234-4123-8123-"+String(n).padStart(12,"0");
const nouns=["فولاد","دانشگاه","تئاتر","بندر","کتابخانه","کارگاه","محیط‌زیست","صنعت","فوتبال","رسانه","هنر","سینما","آموزش","کنسرت","فناوری","دریا","گفت‌وگو","سلامت","شهرداری","موسیقی"];
const stories=Array.from({length:60},(_,i)=>({
  id:id(i+1),headline_fa:"خبر مستقل "+nouns[i%20]+" و رویداد شماره "+i,
  summary_fa:"شرح مستند خبر "+i,image_url:"https://cdn.test/"+(i%11===0?"tiny-":"large-")+i+".jpg",
  category:i%3===0?"culture":"politics",
  published_at:new Date(Date.UTC(2026,9,18,15,0,0)-i*1800000).toISOString()
}));
const reports=Array.from({length:30},(_,i)=>({
  id:id(100+i),title_fa:"گزارش مستقل تحریریه درباره "+nouns[i%20]+" شماره "+i,
  lead_fa:"بررسی منابع درباره موضوع "+i, image_url:"https://cdn.test/"+(i%8===0?"tiny-report-":"large-report-")+i+".jpg",
  published_at:new Date(Date.UTC(2026,9,18,15,0,0)-i*2400000).toISOString(),
  status:"ai_draft"
}));
const payload={
 "/data/stories.json":stories,
 "/data/editorial-archive.json":{reports},
 "/data/pendar-editorial-authors.json":{authors:[]}
};
const dom={};
const root={
 getElementById(id){return dom[id]||(dom[id]={innerHTML:"",href:"",hidden:false,setAttribute(){},classList:{toggle(){}},closest(){return {hidden:false}},contains(){return true}});},
 addEventListener(){}
};
class FakeImage {
 set src(src) {
   this._src=src;
   Promise.resolve().then(()=>{
     this.naturalWidth=src.includes("tiny")?96:1200;
     this.naturalHeight=src.includes("tiny")?78:800;
     this.onload?.();
   });
 }
}
const ctx={
 window:{PENDAR_HERITAGE_EMBED:true},document:{title:""},
 location:{search:""},URLSearchParams,Image:FakeImage,
 fetch:async url=>({ok:!!payload[url],status:payload[url]?200:404,json:async()=>payload[url]}),
 setTimeout:(cb,ms)=>{if(ms===650)queueMicrotask(cb);return 1},
 clearTimeout:()=>{},console
};
vm.runInNewContext(source,ctx);
(async()=>{
 await ctx.window.PendarHeritage.mount(root);
 for(let i=0;i<500;i++)await Promise.resolve();
 const sections=["ticker","under-hero","rail-reports","rail-news","culture-grid","visual-grid"];
 const seen=new Set();
 for(const section of sections){
   const html=dom[section]?.innerHTML||"";
   assert(!html.includes("tiny-")&&!html.includes("tiny-report-"),
     "too-small image used: "+section);
   const ids=Array.from(html.matchAll(/\/story\/([0-9a-f-]{36})\//gi),m=>m[1]);
   for(const storyId of ids){
     assert(!seen.has(storyId),"duplicate story "+storyId+" in "+section);
     seen.add(storyId);
   }
 }
 const hero=dom["feature-hero"];
 assert(hero.href.includes("/story/"),"main cover must be a real article");
 const heroId=hero.href.match(/\/story\/([0-9a-f-]{36})\//)[1];
 assert(!seen.has(heroId),"cover duplicated in another module");
 assert(!hero.innerHTML.includes("tiny"),"low-quality cover displayed");
 assert((dom["visual-grid"].innerHTML.match(/<img /g)||[]).length>0,"gallery is empty");
 assert((dom["rail-news"].innerHTML.match(/<img /g)||[]).length>0,"news rail is empty");
 assert((dom["culture-grid"].innerHTML.match(/<img /g)||[]).length>0,"culture section is empty");
 console.log("PASS: unique source stories across all modules, measured hero/gallery images, accurate story links");
})().catch(e=>{console.error(e);process.exitCode=1});
