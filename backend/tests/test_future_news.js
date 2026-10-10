/* Behavioral coverage for future context on all news and archive pages. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'web-static/core.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'web-static/feed.js'),'utf8'),ctx);
const run = code => vm.runInContext(code,ctx);
const cases = [
 ['security','آتش‌بس ایران'],['diplomacy','مذاکرات جدید'],['economy','قیمت نفت'],
 ['services','قطعی برق'],['politics','انتخابات مجلس'],['society','اعتصاب کارگران'],
 ['environment','جنگل'],['environment','خشکسالی'],['technology','هوش مصنوعی'],['health','واکسن جدید'],
 ['culture','جایزه ادبی'],['sport','فوتبال'],['general','رویدادی دیگر']
];
for(const [key,title] of cases){
 ctx.story={id:'archived-'+key,headline_fa:title,iran_relevance:'none'};
 assert.equal(run('futureNewsContext(story).primary.key'),key);
 assert.match(run('futureNewsBadge(story)'),/اثر بر آینده/);
 assert.match(run('futureNewsDetail(story)'),/چه چیزی را زیر نظر بگیریم/);
}
// There is no feed shortlist or ten-story cap, and no network dependency.
assert.equal(run('ALL.length'),0);
for(let i=0;i<35;i++)assert.match(run(`futureNewsDetail({id:'old-${i}',category:'culture'})`),/future-impact-panel/);
assert.equal(run('futureNewsDetail(null)'),'');
assert.equal(run('futureNewsDetail({})'),'');
ctx.story={id:'s',headline_fa:'خبر',category:'technology',iran_relevance:'none'};
assert.equal(run('futureNewsContext(story).primary.key'),'technology');
assert.match(run('futureNewsDetail(story)'),/future-impact-deep/);
ctx.story={id:'s',headline_fa:'جنگ ایران و اثر بر قیمت نفت',iran_relevance:'high'};
const before=JSON.stringify(ctx.story);
assert.match(run('futureNewsDetail(story)'),/institution\/security\//);
assert.match(run('futureNewsDetail(story)'),/توضیح رقیب/);
assert.equal(JSON.stringify(ctx.story),before);
ctx.story={id:'s',headline_fa:'آتش بس ايران',iran_relevance:'high'};
assert.equal(run('futureNewsContext(story).primary.key'),'security');
ctx.story={id:'s',headline_fa:'خبر',summary_fa:'<img src=x onerror=alert(1)>'};
assert(!run('futureNewsDetail(story)').includes('<img'));
assert.match(run('futureNewsDetail(story)'), /&lt;img/);
const detail=fs.readFileSync(path.join(root,'web-static/story-detail.js'),'utf8');
assert(detail.includes('${futureNewsDetail(s)}'));
assert(!detail.includes('loadFeed(false)')); // archived article never waits for the feed
console.log('PASS: all subjects and 35 archived stories, normalization, relevant internal links, no feed dependency or data mutation.');
