import test from "node:test";
import assert from "node:assert/strict";
import {classifyHeadline,parseRss,sanitizeSignal,mergeSignals} from "../src/logic.mjs";
test("RSS extracts actual links without representing unconfirmed claims as facts",()=>{
 const xml='<rss><channel><item><title>جنگ ایران آغاز خواهد شد</title>'+
 '<link>https://www.isna.ir/news/123</link><pubDate>Sat, 17 Oct 2026 10:10:00 GMT</pubDate></item></channel></rss>';
 const items=parseRss(xml);
 assert.equal(items.length,1);
 assert.equal(items[0].url,"https://www.isna.ir/news/123");
 assert.equal(classifyHeadline(items[0].title),"war");
 assert.equal(classifyHeadline("جنگ اوکراین ادامه دارد"),null);
 assert.equal(classifyHeadline("جنگ و توافق ایران"),null);
});
test("external RSS can never move an unverified score",()=>{
 const s=sanitizeSignal({id:"rss-12345",family:"war",ts:Date.now(),text:"جنگ ایران",
 source_type:"feed",direction:1,weight:2,
 source_links:[{label:"خبر",kind:"original",url:"https://www.isna.ir/news/123"}]});
 assert.equal(s.direction,0);
 assert.equal(s.score_kind,"unscored");
});
test("trusted scored events require a real original link and reject unsafe URLs",()=>{
 const base={id:"auto-abc456789",family:"war",ts:Date.now(),text:"ایران",
 source_type:"story",direction:1,weight:2};
 assert.equal(sanitizeSignal(base).direction,0);
 assert.equal(sanitizeSignal({...base,source_links:[{label:"original",kind:"original",url:"https://example.org/story"}]}).direction,1);
 assert.equal(sanitizeSignal({...base,source_links:[{label:"evil",kind:"original",url:"javascript:alert(1)"}]}).direction,0);
});
test("identical event IDs are idempotent in merged front-end state",()=>{
 const v={id:"auto-abc456789",ts:Date.now(),family:"war",direction:0};
 assert.equal(mergeSignals([v],[v]).changed,0);
 assert.equal(mergeSignals([v],[{...v,direction:1}]).changed,1);
 assert.equal(mergeSignals([v],[{...v,direction:1}]).signals.length,1);
});
