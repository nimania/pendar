const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname,"../../web-static/core.js"),"utf8");
let calls=0;
const sandbox={
  AbortController,
  setTimeout,clearTimeout,
  fetch:async (path,opts)=>{
    calls++;
    assert.equal(opts.cache,"default");
    await new Promise(resolve=>setTimeout(resolve,5));
    return {ok:true,json:async()=>({path,calls})};
  }
};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
(async()=>{
  const [a,b,c]=await Promise.all([
    vm.runInContext('getJSON("data/stories.json")',sandbox),
    vm.runInContext('getJSON("data/stories.json")',sandbox),
    vm.runInContext('getJSON("data/figures.json")',sandbox),
  ]);
  assert.equal(calls,2,"simultaneous identical reads must share one request");
  assert.equal(a.path,b.path);
  assert.equal(c.path,"data/figures.json");
  await vm.runInContext('getJSON("data/stories.json")',sandbox);
  assert.equal(calls,3,"completed requests must not remain cached indefinitely");
  console.log("JSON in-flight deduplication and cache policy OK");
})().catch(e=>{console.error(e);process.exitCode=1;});
