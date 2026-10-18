/* Verify visible, clearly labelled Pendar reports and unchanged news routing. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"../..");
const index=fs.readFileSync(path.join(root,"web-static/index.html"),"utf8");
const pilot=fs.readFileSync(path.join(root,"web-static/story-editorial-pilots.js"),"utf8");
const detail=fs.readFileSync(path.join(root,"web-static/story-detail.js"),"utf8");
const home=fs.readFileSync(path.join(root,"web-static/home.js"),"utf8");
assert(index.includes('story-editorial.css?v='));
assert(index.includes('id="story-editorial-critical"'),"inline report style fallback must be in the SPA shell");
const critical=index.match(/<style id="story-editorial-critical">([\s\S]*?)<\/style>/);
assert(critical,"critical report style block must be present");
for(const selector of ["#detail-view .story-editorial{","#detail-view .story-report-cites{","#detail-view .story-history{"]){
  assert(critical[1].includes(selector),"missing critical CSS "+selector);
}
assert(index.indexOf('story-editorial-critical')<index.indexOf('</head>'));

assert(index.indexOf('story-editorial-pilots.js')>=0);
assert(index.indexOf('story-editorial-pilots.js')<index.indexOf('story-detail.js'));
assert(detail.includes('${pendarEditorialReport(s)}'));
assert(detail.includes('${pendarHistoricalContext(s)}'));
assert(home.includes('s.has_editorial_report'));
new Function(detail);
new Function(home);
const win={};
vm.runInNewContext(pilot,{window:win});
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const start=detail.indexOf("function pendarEditorialReport(s){");
const end=detail.indexOf("function pendarHistoricalContext(s){",start);
assert(start>=0&&end>start);
const render=new Function("window","esc",detail.slice(start,end)+"return pendarEditorialReport;")(win,esc);
const id="b4efb62f-9240-4e90-ba4f-4664e608fa97";
const sample=render({id});
assert(sample.includes('class="story-editorial"'));
assert(sample.includes("نسخهٔ آزمایشی"));
assert(sample.includes("نیازمند تأیید"));
assert(sample.includes("سپاه از برخورد"));
assert(sample.includes("story-report-cite"));
assert.equal(render({id:"11111111-1111-4111-8111-111111111111"}),"");
const generated=render({id,editorial_report:{status:"ai_draft",title_fa:"گزارش تازه",lead_fa:"مقدمهٔ مستند",paragraphs:Array.from({length:3},()=>({text_fa:"متن گزارش",citations:[{id:"s1",url:"https://example.com"}]}))}});
assert(generated.includes("گزارش تازه"),"real report must supersede sample");
assert(!generated.includes("نسخهٔ آزمایشی"),"valid generated report overrides pilot");
console.log("PASS: editorial article, marked preview, citations, order, generated override, badge, fallback");
