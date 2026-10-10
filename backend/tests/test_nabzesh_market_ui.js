const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:''});return elements.get(id)}
const ctx={console,window:{},Date,Number,Promise,document:{getElementById:el,querySelectorAll:()=>[]},DATA:'data',esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),faN:String,grp:String};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web-static/market-nabzesh.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('web-static/market-weather.js','utf8'),ctx);
vm.runInContext('renderMarketFood=()=>{}',ctx);
const rows=[{ticker:'USD',group:'currency',label_fa:'دلار آمریکا',quote:'IRT',unit_fa:'تومان',value:266200,dp:null,is_stale:false,updated_at:new Date().toISOString(),sources:['one']},
 {ticker:'USDT',group:'crypto',label_fa:'تتر',quote:'IRT',value:270000,is_stale:true},
 {ticker:'BUBBLE_COIN_EMAMI',group:'indicators',label_fa:'حباب',quote:'IRT',value:1000},
 {ticker:'TEDPIX',group:'indexes',label_fa:'شاخص',quote:'POINT',value:8000000},
 {ticker:'COFFEE_US',group:'food',label_fa:'قهوه · پوند',quote:'USD',unit_fa:'دلار',value:2.8517}];
const groups=[{id:'currency',label_fa:'ارزها'},{id:'food',label_fa:'غذا'},{id:'indexes',label_fa:'شاخص'}];
let snapshot={rows,groups,generated_at:new Date().toISOString()};
ctx.getJSON=async url=>url.includes('market-nabzesh')?snapshot:[];
(async()=>{
 assert.match(ctx.marketMove(null),/نامشخص/);
 assert.match(ctx.marketMove(0),/flat/);
 await ctx.renderMarket();
 assert.match(el('market').innerHTML,/market-nb-tabs/);
 assert.deepEqual(Array.from(ctx.window.JK_MARKET_UNITS,u=>u.id),['toman','USD']);
 ctx.selectMarketGroup('food');assert.match(el('market-nb-group-note').textContent,/قیمت خرید مواد اولیه در ایران نیستند/);
 ctx.selectMarketAsset('USD');assert.match(el('market-nb-detail').innerHTML,/تغییر نامشخص/);
 const chart=ctx.marketChart({label_fa:'دلار',unit_fa:'تومان',chart:{points:[{time:'2026-10-01T00:00:00Z',close:'1'},{time:'2026-10-02T00:00:00Z',close:'2'},{time:'2026-10-09T00:00:00Z',close:'3'}]}});
 assert.match(chart,/L/);assert.equal((chart.match(/M[\d.]+,/g)||[]).length,2);
 snapshot={...snapshot,generated_at:'2000-01-01T00:00:00Z'};await ctx.renderMarket();
 assert.deepEqual(Array.from(ctx.window.JK_MARKET_UNITS,u=>u.id),['toman']);
 assert.match(el('market').innerHTML,/دادهٔ قدیمی/);
 snapshot=null;await ctx.renderMarket();assert.doesNotMatch(el('market').innerHTML,/market-nb-tabs/);
 console.log('Market units, unknown changes, data aging, gaps and fallback checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
