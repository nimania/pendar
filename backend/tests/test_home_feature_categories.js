/* Regression guard for eight editorial homepage tabs and real figure statements. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const html=fs.readFileSync(path.join(root,"web-static/heritage-preview.html"),"utf8");
const js=fs.readFileSync(path.join(root,"web-static/heritage-preview.js"),"utf8");
const css=fs.readFileSync(path.join(root,"web-static/heritage-preview.css"),"utf8");
const live=fs.readFileSync(path.join(root,"web-static/heritage-live.js"),"utf8");
const tabs=[
  ["politics","سیاست"],["diplomacy","دیپلماسی"],["society","جامعه"],
  ["technology","تکنولوژی"],["statements","گفته‌ها"],["sport","ورزشی"],
  ["environment","محیط زیست"],["culture","فرهنگ"]
];
const positions=tabs.map(([id,label])=>{
  const tag=new RegExp('<button[^>]*data-feature-category="'+id+'"[^>]*>'+label+'</button>');
  const match=html.match(tag);
  assert(match,"Missing accessible category "+label);
  return html.indexOf(match[0]);
});
assert(positions.every((p,i)=>i===0||p>positions[i-1]),"Tabs must preserve editorial order");
assert(html.includes('data-feature-category="politics" aria-controls="feature-politics-panel" aria-selected="true"'),
  "Politics must be the default tab");
assert(html.includes('role="tabpanel" aria-labelledby="feature-category-politics"'));
assert(html.includes('id="feature-hero"'));
assert(html.includes('id="under-hero"'));
assert(html.includes('id="rail-headlines-trends"'),"Search trends must stay in their small rail");
assert(css.includes(".feature-category-tabs{display:flex;"));
assert(css.includes("overflow-x:auto;"),"Small screens need horizontally scrollable tabs");
assert(live.includes("heritage-preview.js?v=20261021-quotes-newspaper-1"),"Live site should refresh JavaScript");
assert(live.includes("heritage-preview.css?v=20261021-quotes-newspaper-1"),"Live site should refresh styles");
assert(js.includes('button.addEventListener("click"'),"Tabs need working controls");
assert(js.includes('featurePanel.setAttribute("aria-labelledby"'),"Active tab must label panel");
assert(js.includes("featureBucketData=featureBuckets;"),"Each topic needs its own report selection");
assert(js.includes('featureBucketData[currentFeature]||[]'),"Never substitute an unrelated report");

const start=js.indexOf("  var FEATURE_CATEGORIES=");
const end=js.indexOf("  async function renderHome()",start);
assert(start>=0&&end>start,"Topic classification code not found");
const context={
  norm:v=>String(v==null?"":v).replace(/\s+/g," ").trim(),
  headline:r=>String(r.title_fa||r.editorial_report_title_fa||r.headline_fa||"").trim(),
  Date,Math,Set,Array,Number,encodeURIComponent
};
vm.createContext(context);
vm.runInContext(js.slice(start,end)+
  "\nthis.classify=featureCategory;this.extract=featureStatementsFromFigures;this.rank=featureRank;",context);
const cases=[
  [{headline_fa:"تیم ملی ایران برابر ژاپن پیروز شد"},"sport"],
  [{headline_fa:"آخرین اخبار فوتبال ایران",editorial_author_id:"politics"},"sport"],
  [{headline_fa:"سفر فرمانده ارتش پاکستان به تهران و شرط ایران برای مذاکره"},"diplomacy"],
  [{headline_fa:"انتخابات مجلس و تحولات دولت در تهران"},"politics"],
  [{headline_fa:"گسترش هوش مصنوعی در اینترنت",editorial_author_id:"technology"},"technology"],
  [{headline_fa:"آلودگی هوا و خشک شدن تالاب"},"environment"],
  [{headline_fa:"گزارش از مدرسه و وضعیت معلمان"},"society"],
  [{headline_fa:"جشنواره فیلم و برنامه‌های سینما"},"culture"],
  [{headline_fa:"خبرگزاری ایران امروز منتشر کرد"},""]
];
for(const [row,wanted] of cases){
  assert.equal(context.classify(row),wanted,"Wrong subject for "+row.headline_fa);
}
const figureData={figures:[
  {handle:"person-one",name_fa:"یک",posts:[
    {headline_fa:"نظر تازه درباره اقتصاد",published_at:"2026-10-21T06:00:00Z"},
    {headline_fa:"اظهارنظر قدیمی",published_at:"2026-10-18T05:00:00Z"}]},
  {handle:"person-two",name_fa:"دو",posts:[
    {statement_fa:"دیدگاه دوم",published_at:"2026-10-21T07:00:00Z"}]},
  {handle:"bad/handle",name_fa:"نامعتبر",posts:[
    {headline_fa:"نباید نمایش داده شود",published_at:"2026-10-21T08:00:00Z"}]}
]};
const statements=context.extract(figureData);
assert.equal(statements.length,2,"Show one recent entry per valid speaker");
assert.equal(statements[0].name,"دو");
assert.equal(statements[0].url,"/@person-two/");
assert.equal(statements[1].title,"نظر تازه درباره اقتصاد");
assert(context.rank({headline_fa:"انتخابات مجلس",published_at:new Date().toISOString()},"politics")>
       context.rank({headline_fa:"انتخابات مجلس",published_at:"2025-01-01T00:00:00Z"},"politics"),
       "Newer coverage should win when significance is equal");

assert(html.includes('id="feature-statements-edition"'),"Statement edition container required");
assert(css.includes(".paper-front-grid{display:grid;"),"Lead plus side columns required");
assert(css.includes(".paper-columns{display:grid;"),"Newspaper continuation columns required");
assert(css.includes("@media(max-width:480px)"),"Mobile newspaper needs responsive rules");
assert(js.includes("newspaper.hidden=!isStatement"),"Unselected newspaper must stay hidden");
assert(js.includes("if(underHero)underHero.hidden=false"),"Other tabs must restore their regular cards");
context.validImage=v=>/^\/(?!\/)/.test(v||"")?v:"";
context.esc=v=>String(v==null?"":v).replace(/[&<>"']/g,
  ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
context.excerpt=(v,n)=>String(v||"").slice(0,n);
context.Intl=Intl;
vm.runInContext("this.edition=statementEditionHtml;",context);
const escaped={...statements[0],title:'<script>alert("x")</script>',
  portrait:"/assets/portrait.jpg",role:"خبرنگار"};
const paper=context.edition([escaped,statements[1]],false);
assert(paper.includes("paper-nameplate"),"Old-paper masthead is required");
assert(paper.includes("paper-front-grid")&&paper.includes("paper-side"),"Newspaper lead and side items required");
assert(paper.includes("paper-person-frame"),"True figure portraits and fallback must be provided");
assert(paper.includes('filter')===false,"Never inject source descriptions as raw HTML");
assert(!paper.includes("<script>"),"Potentially unsafe figure statements must be escaped");
assert(paper.includes("&lt;script&gt;"),"Unsafe title must be escaped but remain legible");
assert(paper.includes("گفته‌ها"),"Visible newspaper title must be preserved");
assert(paper.includes('href="/@person-two/"'),"Cards should link to the speaker's own profile");
const moreFigures=Array.from({length:14},(_,i)=>({
 handle:"speaker-"+i,name_fa:"گوینده "+i,
 avatar:i===0?"/assets/portrait.jpg":undefined,
 posts:[{headline_fa:"دیدگاه شماره "+i,published_at:new Date(2026,9,21,i).toISOString()}]
}));
const many=context.extract({figures:moreFigures});
assert.equal(many.length,14,"The extended layout must keep more than eight speakers");
const whole=context.edition(many,false);
assert(whole.includes('paper-columns'),"The lower newspaper grid must render");
assert(whole.includes('paper-bottom-strip'),"The final dated viewpoints must be discoverable");
const empty=context.edition([],true);
assert(empty.includes("در حال گردآوری"),"The page should show accurate loading status");

console.log("Editorial feature tabs and statement fixtures OK");
