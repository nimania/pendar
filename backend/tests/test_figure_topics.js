// Run: node backend/tests/test_figure_topics.js
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync("web-static/figures-core.js", "utf8");
const start = source.indexOf("const FIGURE_TIMELINE_TOPICS =");
const end = source.indexOf("function setFigureTimelineTopic", start);
assert.ok(start >= 0 && end > start, "Topic functions must exist");
const context = vm.createContext({});
vm.runInContext(source.slice(start,end) + "\nthis.check=figureMatchesTopic;this.scores=figureTopicScores;", context);
const check = context.check;
assert.equal(check({topic_fa:"انتخابات مجلس ایران",summary_fa:"بررسی رقابت‌های انتخاباتی"}, {id:"ai"}), false, "Author expertise must not leak into topic selection");
assert.equal(check({field:"technology",topic_fa:"انتخابات مجلس ایران",summary_fa:"بررسی رقابت‌های انتخاباتی"}, {id:"politics"}), true);
assert.equal(check({field:"politics",topic_fa:"هوش مصنوعی و آیندهٔ جنگ",summary_fa:"نقش دولت در سیاست‌گذاری فناوری"}, {id:"ai"}), true);
assert.equal(check({field:"technology",topic_fa:"دستور پخت غذا",summary_fa:"طرز تهیهٔ نان"}, {id:"ai"}), false);
assert.equal(check({topic_ids:["ai","politics"],topic_fa:"موضوع متفاوت"}, {id:"politics"}), true);
assert.equal(check({topic_ids:["culture"],topic_fa:"هوش مصنوعی"}, {id:"ai"}), false, "Curated tags outrank heuristics");
console.log("Figure topic regression tests passed");
