"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const js=fs.readFileSync("web-static/karname/app.js","utf8");
const html=fs.readFileSync("web-static/karname/index.html","utf8");
const official=JSON.parse(fs.readFileSync("backend/data/karname.json","utf8"));
const radar=JSON.parse(fs.readFileSync("web-static/karname/auto-radar.json","utf8"));
const index=JSON.parse(fs.readFileSync("web-static/karname/unified-index.json","utf8"));
const checks=JSON.parse(fs.readFileSync("web-static/karname/source-verification.json","utf8"));
new Function(js);
assert.equal(official.speakers.length,17);
assert.equal(radar.items.length,index.counts.automatic_unverified);
assert.equal(radar.items.length,Object.keys(checks.observations).length);
assert.deepEqual(new Set(radar.items.map(x=>x.id)),new Set(Object.keys(checks.observations)));
assert.equal(Object.keys(checks.official_due_review).length,official.claims.length);
for(const phrase of ['tab:"all"','person:["پروندهٔ سخنان"','function renderPersonList()',
 'function renderPersonDetail()','function karnameAutoLink(p)','function karnameOfficialLink(s)',
 'function karnameMatch(item)','personLink','"/karname/?speaker="',
 'void loadSourceChecks()','"/karname/source-verification.json"','data-tab="people"',
 '"source_text_found"']){
 if(phrase==='personLink'||phrase==='data-tab="people"'||phrase==='"/karname/?speaker="'||phrase==='"source_text_found"')continue;
 assert(js.includes(phrase),"Missing "+phrase);
}
assert(html.includes('data-tab="people"'));
assert(js.includes("const requestedSpeaker=personParams.get("));
assert(js.includes("const requestedMention=personParams.get("));
assert(js.includes("if(autoRows[i])mixed.push(autoRows[i])"));
assert(js.includes("if(officialRows[i])mixed.push(officialRows[i])"));
assert(js.includes("if(state.unifiedFilter===\\\"all\\\"")===false ||
       js.includes("state.unifiedFilter===\\\"all\\\""));
assert(js.includes("source_verification_not_outcome")===false); // check is in schema-specific producer
assert(checks.summary.outcomes_automatically_scored===0);
assert(radar.items.every(x=>x.evaluation===null));
console.log("Karname per-person routing and mixed main feed:",official.speakers.length,
            "official people;",radar.items.length,"machine observations;");
