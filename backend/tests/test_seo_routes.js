const fs=require('fs'),vm=require('vm'),assert=require('assert');
const events={},history=[];
const ctx={location:{hash:'#/book/title%20one',pathname:'/',search:'',origin:'https://pendar.io',href:'https://pendar.io/'},window:{addEventListener:(k,v)=>events[k]=v},history:{pushState:(_,__,p)=>history.push(p),replaceState:(_,__,p)=>history.push(p)},document:{body:{},querySelectorAll:()=>[],addEventListener:()=>{}},MutationObserver:class{observe(){}},fetch:async()=>({ok:false}),URL};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.argv[2]||'router.js','utf8'),ctx);
assert.equal(history[0],'/book/title%20one/');
assert.equal(ctx.routeURL('#/entity/person%3Asomeone'),'/entity/person%3Asomeone/');
assert.equal(ctx.routeURL('#/'),'/');
ctx.location.hash='';ctx.location.pathname='/movie/yal-2026/';
assert.equal(ctx.currentRoute(),'movie/yal-2026');
ctx.setHash('#/books');assert.equal(history.at(-1),'/books/');
ctx.setHash('');assert.equal(history.at(-1),'/');
console.log('Legacy hash conversion, encoded IDs, clean deep routes and home navigation passed');


ctx.window.PENDAR_HANDLES={routes:{'entity/person:someone':'someone','figure/socialname':'someone'},people:{someone:{id:'person:someone'}}};
assert.equal(ctx.routeURL('#/entity/person%3Asomeone'),'/@someone/');
assert.equal(ctx.routeURL('/figure/socialname/'),'/@someone/');
assert.equal(ctx.routeURL('/@someone/'),'/@someone/');
let opened;ctx.openCanonicalEntity=id=>opened=id;
ctx.location.pathname='/@someone/';ctx.route();assert.equal(opened,'person:someone');
console.log('Canonical handles and legacy profile routes passed');

ctx.window.PENDAR_HANDLES.entities={'entity/book:a-book':'/book/a-book/','entity/organization:a-group':'/entity/organization/a-group/','graph/person:someone':'/graph/person/someone/'};
assert.equal(ctx.routeURL('#/entity/book%3Aa-book'),'/book/a-book/');
assert.equal(ctx.routeURL('/entity/organization%3Aa-group/'),'/entity/organization/a-group/');
ctx.location.pathname='/entity/organization/a-group/';ctx.route();assert.equal(opened,'organization:a-group');
assert.equal(ctx.routeURL('#/graph/person%3Asomeone'),'/graph/person/someone/');
console.log('Readable book, organization and graph identity routes passed');
