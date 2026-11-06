"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const script=fs.readFileSync("web-static/karname/app.js","utf8");
const index=JSON.parse(fs.readFileSync("web-static/karname/unified-index.json","utf8"));
const ledger=JSON.parse(fs.readFileSync("backend/data/karname.json","utf8"));
const queue=JSON.parse(fs.readFileSync("backend/data/karname-candidates.json","utf8"));

new Function(script); // Browser JS must parse.
const start=script.indexOf("function validUnifiedIndex(data){");
const end=script.indexOf("async function loadUnifiedIndex()",start);
assert(start>=0&&end>start,"index validator exists");
const validate=new Function(script.slice(start,end)+"return validUnifiedIndex;")();
assert(validate(index),"indexed source must match accepted client schema");
const broken=structuredClone(index);broken.counts.total++;
assert(!validate(broken),"client rejects incorrect aggregate");
assert.equal(index.counts.documented,ledger.claims.length);
assert.equal(index.counts.total,ledger.claims.length+queue.candidates.length);
assert.equal(index.counts.automatic_unverified,queue.candidates.filter(c=>c.status==="pending_editorial_review").length);
for (const phrase of ["function renderUnified()","function renderObservedPeople()",
 "function renderAutoTriggerHints()","function machineSummary()",
 "data-unified-filter","data-unified-more","unified-index.json","نتیجه تأییدنشده",
 "ممیزی · بدون انتساب قطعی"]) assert(script.includes(phrase),phrase);
for(const entry of index.entries){
 if(entry.layer==="automatic_observation"){
  assert.equal(entry.status,"unverified");
  assert.equal(entry.has_result_source,false);
  assert.equal(entry.time_is_verified_deadline,false);
 }
 if(entry.layer==="quality_audit"){
  assert.deepEqual(entry.speaker_keys,[]);
  assert.deepEqual(entry.speaker_labels,[]);
 }
}
console.log("Unified Karname source and UI contract passed",index.counts);
