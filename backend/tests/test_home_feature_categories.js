/* Regression guard for the default live front page, subject tabs and figure statements. */
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
  ["front","صفحهٔ اول"],["politics","سیاست"],["diplomacy","دیپلماسی"],["society","جامعه"],
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
assert(html.includes('data-feature-category="front" aria-controls="feature-politics-panel" aria-selected="true"'),
  "Front page must be the default tab");
assert(html.includes('role="tabpanel" aria-labelledby="feature-category-front"'));
assert(html.includes('id="feature-hero"'));
assert(html.includes('id="under-hero"'));
assert(html.includes('id="rail-headlines-trends"'),"Search trends must stay in their small rail");
assert(css.includes(".feature-category-tabs{display:flex;"));
assert(css.includes("overflow-x:auto;"),"Small screens need horizontally scrollable tabs");
assert(live.includes("heritage-preview.js?v=20261021-editorial-desk-2"),"Live site should refresh JavaScript");
assert(live.includes("heritage-preview.css?v=20261021-editorial-desk-2"),"Live site should refresh styles");
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

assert(html.includes('id="feature-front-page"'),"Default first-page container required");
assert(html.includes('id="feature-statements-edition"'),"Independent statements tab required");
assert(html.includes('id="feature-hero"'),"Specialist article cover must remain");
assert(css.includes(".fp-top{display:grid"),"First page needs a mixed editorial grid");
assert(css.includes(".fp-topic{"),"Related news and viewpoints need a shared module");
assert(css.includes(".fp-voice-grid{"),"Figure photographs need a featured module");
assert(css.includes("@media(max-width:560px)"),"Mixed front page must support mobile");
assert(js.includes('currentFeature="front"'),"First page must be selected initially");
assert(js.includes('isFront=currentFeature==="front"'),"Front page must toggle independently");
assert(js.includes('renderFrontPage();'),"Front page must update on new content");
assert(js.includes('figureFeatureItems.filter(function(item)'),"Figure claims must come from published statements");
assert(js.includes('item.portraitVerified&&validImage(item.portrait)'),"Only verified photographed speakers may be clustered");
assert(js.includes('frontConnection('),"Evidence-based links must guard grouping");
assert(js.includes('verifiedImage(photo(entry.row))'),"News photos must be verified");
assert(js.includes('lastHomeVisit'),"Updates since last visit need a real stored timestamp");
context.validImage=v=>String(v||"").startsWith("/")&&!String(v||"").startsWith("//")?v:"";
context.esc=v=>String(v==null?"":v).replace(/[&<>"']/g,
  ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
context.excerpt=(v,n)=>String(v||"").slice(0,n);
context.Intl=Intl;
vm.runInContext("this.edition=statementEditionHtml;",context);
const escaped={...statements[0],title:'<script>alert("x")</script>',
  portrait:"/assets/portrait.jpg",role:"خبرنگار"};
const paper=context.edition([escaped,statements[1]],false);
assert(paper.includes("paper-person-frame"),"Every promoted statement must show a portrait");
assert(!paper.includes("<script>"),"Statements must be escaped");
assert(paper.includes("&lt;script&gt;"),"Escaped text must remain visible");
assert(!paper.includes("paper-masthead"),"Old newspaper masthead must remain removed");
assert(!paper.includes("دیدگاه ۱"),"Artificial view numbers must remain removed");
assert(paper.includes('href="/@person-two/"'),"Statement cards must link to a real speaker");
assert(!paper.includes('href="/@person-one/"'),"Portraitless speakers are omitted");
const empty=context.edition([],true);
assert(empty.includes("در حال گردآوری"),"Loading status must be accurate");

// Shared desk relevance is not established by categories, rhetoric or generic words.
vm.runInContext("this.connected=frontConnection;this.editorialScore=frontEditorialScore;",context);
const promo={headline_fa:"وزیر: توسعه گردشگری و ثبت رویدادهای ملی را پیگیری می‌کنیم",
  summary_fa:"نشست وزارت میراث فرهنگی",published_at:new Date().toISOString()};
const border={headline_fa:"دستور نخست‌وزیر عراق برای بستن گذرگاه مرزی با ایران",
  published_at:new Date().toISOString()};
const warClaim={headline_fa:"ترامپ مدعی پایان جنگ شد",
  summary_fa:"در خصوص جنگ ایران و اسرائیل",published_at:new Date().toISOString()};
assert(context.editorialScore(promo,"culture")<context.editorialScore(border,"diplomacy"),
  "Routine government press releases must not outrank consequential border orders");
assert(context.connected(border,warClaim),
  "Independently related regional security news can share a dossier");
assert(!context.connected(border,{headline_fa:"وزارت آموزش و پرورش از تعطیلی مدارس خبر داد"}),
  "Unrelated stories cannot cluster on shared generic verbs");
assert(!context.connected(promo,{headline_fa:"کاروان ایران در بازی‌های آسیایی"}),
  "Official nationalism rhetoric must not imply a topic connection");
assert(css.includes(".fp-desk-layout{display:grid"),
  "Front page needs a dominant shared editorial desk");
console.log("Editorial tabs, news judgement and statement fixtures OK");
