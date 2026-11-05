/* Figure profiles must reuse the current automatic Karname observation feed
   without treating machine-extracted news summaries as verified quotations. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const figures=fs.readFileSync("web-static/figures-profile.js","utf8");
const karname=fs.readFileSync("web-static/karname/app.js","utf8");
const html=fs.readFileSync("web-static/karname/index.html","utf8");
const css=fs.readFileSync("web-static/styles.css","utf8");
const auto=JSON.parse(fs.readFileSync("web-static/karname/auto-radar.json","utf8"));

assert(figures.includes("function renderFigureKarnameAutomaticPreview("));
assert(figures.includes('fetch("/karname/auto-radar.json"'));
assert(figures.includes("item.person.profile_handle.toLowerCase()===exact"));
assert(figures.includes('data-karname-auto-preview'));
assert(figures.includes("void renderFigureKarnameAutomaticPreview(el,x.handle)"));
assert(figures.includes("انتساب و متن اصلی مستقلاً تأیید نشده"));
assert(figures.includes("/karname/?person="));
assert(karname.includes('searchParams.get("person")'));
assert(karname.includes("state.autoPerson=autoPersonParam"));
assert(karname.includes('c.person?.profile_handle===state.autoPerson'));
assert(html.includes('data-tab="auto"'));
assert(css.includes(".figure-karname-preview"));
assert(auto.scope==="automatically_collected_observations_not_verified_predictions");
assert(auto.items.every(x=>x.observation_status==="auto_collected_unverified"));
assert(auto.items.every(x=>x.publication_approved===false&&x.evaluation===null));
console.log("Pendar figure-to-Karname automatic and explicitly provisional linking passed.",
            auto.items.length,"radar observations");
