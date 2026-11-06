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
assert(official.speakers.length>=17);
assert.equal(radar.items.length,index.counts.automatic_unverified);
assert.deepEqual(new Set(radar.items.map(x=>x.id)),new Set(Object.keys(checks.observations)));
assert.equal(Object.keys(checks.official_due_review).length,official.claims.length);
for(const feature of [
  'tab:"all"',
  'person:["پروندهٔ سخنان"',
  'function renderPersonList()',
  'function renderPersonDetail()',
  'function karnameAutoLink(p)',
  'function karnameOfficialLink(s)',
  'function karnameMatch(item)',
  'void loadSourceChecks()',
  'source-verification.json',
  'const requestedSpeaker=personParams.get(',
  'const requestedMention=personParams.get(',
  'if(autoRows[i])mixed.push(autoRows[i])',
  'if(officialRows[i])mixed.push(officialRows[i])'
]) assert(js.includes(feature),"Missing routing/evidence behavior: "+feature);
assert(html.includes('data-tab="people"'));
assert(html.includes("همهٔ چهره‌ها و گفته‌ها"));
assert(checks.summary.outcomes_automatically_scored===0);
assert(radar.items.every(x=>x.evaluation===null));
console.log("Karname person routing and mixed main feed OK:",official.speakers.length,
            "historical speakers;",radar.items.length,"machine observations");
