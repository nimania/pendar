/* Offline regression test for packed movie detail loading, including gzip decode. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const zlib = require('zlib');

const source = fs.readFileSync(path.resolve(__dirname, '../../web-static/movies-hub.js'), 'utf8');
const film = {pendar_id:'pm_testid', credits:[{id:123,person_id:'person:tmdb-123',name_fa:'بازیگر'}], overview_fa:'متن کامل'};
const bytes = zlib.gzipSync(Buffer.from(JSON.stringify({'pm_testid':film}), 'utf8'));
const requested=[];
const ctx = {
  Map, Set, console, Response, Blob, DecompressionStream, TextDecoder,
  DATA:'/data',
  fetch:async (url)=>{
    requested.push(url);
    return new Response(bytes, {status:200});
  },
  getJSON:async()=>{throw new Error('Legacy endpoint should not be requested')},
};
vm.createContext(ctx);
vm.runInContext(source,ctx);
(async()=>{
  const first=await vm.runInContext('_movieLoadDetail({pendar_id:"pm_testid",tmdb_id:1})',ctx);
  assert.equal(first.overview_fa,film.overview_fa);
  assert.equal(first.credits[0].person_id,film.credits[0].person_id);
  const second=await vm.runInContext('_movieLoadDetail({pendar_id:"pm_testid",tmdb_id:1})',ctx);
  assert.equal(second.credits[0].name_fa,film.credits[0].name_fa);
  assert.equal(requested.length,1,'Compressed movie bucket must be reused');
  assert.ok(/\/movie-detail-shards\/\d+\.json\.gz/.test(requested[0]));

  ctx.fetch=async()=>new Response('',{status:404});
  ctx.getJSON=async()=>film;
  const legacy=await vm.runInContext('_movieLoadDetail({pendar_id:"pm_different",tmdb_id:2})',ctx);
  assert.equal(legacy.overview_fa,film.overview_fa, 'Old deployments must still work');
  console.log('Movie detail gzip shard and legacy fallback tests: PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
