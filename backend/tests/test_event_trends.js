const assert=require('node:assert/strict');
const {build,same,isIranStory}=require('../../web-static/event-trends.js');
const now=Date.parse('2026-10-07T10:00:00Z');
function story(id,headline,extra={}) {return {id,headline_fa:headline,published_at:'2026-10-07T08:00:00Z',source_names:['رسانه یک','رسانه دو'],entities:[{slug:'iran'}],importance_score:70,...extra};}
const a=story('a','اصابت پرتابه به نفتکش در تنگه هرمز');
const b=story('b','گزارش اصابت پرتابه ناشناس به نفتکش در تنگه هرمز',{source_names:['رسانه دو','رسانه سه']});
const c=story('c','سفر وزیر کشور ایران به قطر و دیدار با امیر قطر');
assert.equal(same(a,b),true);
assert.equal(same(a,c),false,'shared entity must not merge unrelated events');
const groups=build([a,b,c,a],now);
assert.equal(groups.length,2);const merged=groups.find(g=>g.items.length===2);
assert.equal(merged.sources.length,3,'count unique sources, not copied coverage');
assert.equal(build([story('old','خبر قدیمی',{published_at:'2026-09-01T08:00:00Z'})],now).length,0);
assert.equal(build([story('one','خبر تک منبع',{source_names:['رسانه یک']})],now).length,0);
assert.equal(build([story('roundup','اخبار گوناگون ایران و جهان')],now).length,0);
assert.equal(same(a,{...b,published_at:'2026-10-05T08:00:00Z'}),false);
console.log('Event grouping: 7 checks passed.');

assert.equal(isIranStory({headline_fa:'بازداشت رئیس اطلاعات آلمان',iran_relevance:'high',countries:[{code:'DE'}]}),false);
assert.equal(isIranStory({headline_fa:'خبر داخلی',countries:[{code:'IR'}]}),true);
assert.equal(isIranStory({headline_fa:'حادثه برای نفتکش در تنگه هرمز'}),true);
assert.equal(isIranStory({headline_fa:'احضار سفیر در تهران'}),true);
assert.equal(isIranStory({headline_fa:'اعطای جایزه نوبل فیزیک',iran_relevance:'none'}),false);
console.log('Homepage Iran relevance: 5 checks passed.');
