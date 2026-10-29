const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../web-static');
const NEWS='11111111-1111-1111-1111-111111111111',REPORT='22222222-2222-2222-2222-222222222222';
const ctx={window:{PENDAR_NEWS_DESTINATIONS:{editorial:{[REPORT]:'https://pendar.io/story/'+REPORT+'/'}}},location:{assign:u=>ctx.target=u,replace:u=>ctx.target=u},encodeURIComponent};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'news-migration.js'),'utf8'),ctx);
assert.equal(ctx.pendarContentURL({id:NEWS}),'https://nimania.github.io/jan-kalam/?story='+NEWS);
assert.equal(ctx.pendarContentURL({id:REPORT}),'/story/'+REPORT+'/');
assert.equal(ctx.pendarContentURL({id:NEWS,has_editorial_report:true}),'/story/'+NEWS+'/');
for (const file of [
  "future-shared.js",
  "story-detail.js",
  "heritage-preview.js",
  "neshani/turkey/index.html",
  "neshani/turkey/news.js"
]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(!source.includes("/headlines/"), file + " still links to Pendar's retired headlines route");
  assert(source.includes("https://nimania.github.io/jan-kalam/"), file + " must link directly to Jan Kalam");
}
assert(!fs.readFileSync(path.join(root,"radar/iran-scenarios/scenario/reader.js"),"utf8").includes("سرخط پندار"));
ctx.goJanKalam('source','منبع یک');assert.equal(ctx.target,'https://nimania.github.io/jan-kalam/#/source/'+encodeURIComponent('منبع یک'));
// Authored trend reports must use their generated page, not the news router.
const router=fs.readFileSync(path.join(root,'router.js'),'utf8');
let clickHandler,prevented=false,routed=false;
const clicks={URL,location:{href:'https://pendar.io/',origin:'https://pendar.io'},window:{},
 document:{addEventListener:(name,handler)=>{clickHandler=handler;}},
 PUBLIC_ROUTES:new Set(['trends','headlines']),history:{pushState:()=>{}},route:()=>{routed=true;},updateRouteSeo:()=>{}};
vm.createContext(clicks);vm.runInContext(router.slice(router.lastIndexOf('document.addEventListener("click",event=>{')),clicks);
function clickURL(url){prevented=false;routed=false;clickHandler({button:0,target:{closest:()=>({href:url,hasAttribute:()=>false})},preventDefault:()=>{prevented=true;}});}
clickURL('https://pendar.io/trends/report/authored-example/');assert.equal(prevented,false);assert.equal(routed,false);
clickURL('https://pendar.io/headlines/');assert.equal(prevented,true);assert.equal(routed,true);
const detail=fs.readFileSync(path.join(root,'story-detail.js'),'utf8');
const open=detail.match(/^async function openStory\(id\) \{[\s\S]*?^\}/m)[0];
Object.assign(ctx,{DATA:'data',esc:String,setHash:()=>{},show:()=>{},setTab:()=>{},document:{getElementById:()=>({innerHTML:''})},getJSON:async()=>({id:NEWS}),impInfo:()=>{throw new Error('EDITORIAL_RENDER');}});
vm.runInContext(open,ctx);
(async()=>{
 ctx.target=null;await ctx.openStory(NEWS);assert.equal(ctx.target,'https://nimania.github.io/jan-kalam/?story='+NEWS);
 ctx.target=null;ctx.getJSON=async()=>({id:REPORT,editorial_report:{paragraphs:[]}});
 await assert.rejects(ctx.openStory(REPORT),/EDITORIAL_RENDER/);assert.equal(ctx.target,null,'authored reports never leave Pendar');
 console.log('PASS: news routes transfer to Jan Kalam; report metadata and bodies keep authored pages on Pendar');
})().catch(error=>{console.error(error);process.exitCode=1;});
