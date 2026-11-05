"use strict";
/* Validate rendered scenario direction semantics without a browser or extra deps. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const code = fs.readFileSync("web-static/karname/app.js", "utf8");
const ledger = JSON.parse(fs.readFileSync("backend/data/karname.json", "utf8"));
const begin = code.indexOf("function scenarioCategory(dir){");
const end = code.indexOf("function scenarioMatches(", begin);
assert.ok(begin >= 0 && end > begin, "Scenario category function exists");
const norm = v => String(v||"").replace(/[\u200c\u200e\u200f]/g, "").toLowerCase().trim();
const category = new Function("norm", code.slice(begin, end) + "return scenarioCategory;")(norm);

for (const [input, expected] of [
  ["له","support"], ["علیه","against"], ["امکان","possible"],
  ["شرایط","context"], ["زمینه","context"], ["نامعلوم","other"], ["توافق","other"],
]) assert.equal(category(input), expected, input);

const claims = ledger.claims;
const tagged = claims.flatMap(c => (c.scenarios||[]).map(tag => ({c,tag})));
for (const x of tagged) assert.ok(
  ["support","against","possible","context","other"].includes(category(x.tag.dir)));
assert.ok(tagged.some(x=>category(x.tag.dir)==="context"), "Context tags exist");
assert.ok(tagged.some(x=>category(x.tag.dir)==="possible"), "Possibility tags exist");
const count = (person,family,cat)=>tagged.filter(x=>x.c.speakers.includes(person)
  && x.tag.family===family && category(x.tag.dir)===cat).length;
assert.equal(count("مطهرنیا","جنگ","support"),5);
assert.equal(count("مطهرنیا","زمینه","context"),8);
assert.equal(count("مطهرنیا","زمینه","support"),0,
  "Context must never count as support");
assert.equal(count("عزیزی","جنگ","support"),2);
assert.equal(count("عزیزی","جنگ","against"),2);

for(const required of [
  "data-scenario-person", "data-scenario-family", "data-scenario-kind",
  "data-scenario-clear", "scenario-detail", "data-claim", "این جدول امتیاز موفقیت نیست",
]) assert.ok(code.includes(required), required);
console.log("Karname scenario directions and click-to-evidence regression passed:",tagged.length,"tags");
