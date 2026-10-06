const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const base=path.resolve(__dirname,'../..'),context={URL,Map,Set,console,esc:s=>String(s),relTime:s=>s,youtubeVideoId:()=>null};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(base,'web-static/figures-profile.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(base,'web-static/movies-hub.js'),'utf8'),context);
vm.runInContext(`
async function loadMovieMaster(){return {items:[]}}
async function _movieLoadDetail(seed){return seed.tmdb_id===12?{...seed,title_en:'Outside top',credits:[]}:{...seed,detail_unavailable:true}}
`,context);
(async()=>{
  const internal=context._figureWorkCard({title:'Film',kind:'movie',url:'https://example.com',internal_target:{kind:'movie',id:'pm_c'}});
  assert(internal.includes('href="#/master-movie/pm_c"'));assert(!internal.includes('target="_blank"'));
  assert(context._figureWorkCard({kind:'book',title:'Book',internal_target:{kind:'book',id:'a b'}}).includes('#/book/a%20b'));
  assert(context._figureWorkCard({title:'Pending',url:'https://example.com'}).includes('target="_blank"'));
  assert.equal(context._figureWorkKey({internal_target:{kind:'movie',id:'pm_c'}},'movie'),'pendar:movie:pm_c');
  assert.notEqual(context._figureWorkKey({tmdb_id:12},'movie'),context._figureWorkKey({tmdb_id:12},'tv'));
  assert.equal((await context._masterMovieById('pm_c')).media_type,'movie');
  assert.equal((await context._masterMovieById('pt_c')).media_type,'series');
  assert.equal(await context._masterMovieById('pm_d'),null);
  assert.equal(await context._masterMovieById('pm_0c'),null);
  assert.equal(await context._masterMovieById('../bad'),null);
  console.log('Creator work routes and typed identities passed');
})().catch(e=>{console.error(e);process.exitCode=1});
