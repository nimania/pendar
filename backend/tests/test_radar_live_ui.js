const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(root,'web-static/data/pendar-radar-status.json'),'utf8'));
const memory={};const context=vm.createContext({Date,Math,Map,esc:v=>String(v??''),faN:v=>String(v),localStorage:{getItem:k=>memory[k],setItem:(k,v)=>memory[k]=v}});
vm.runInContext(fs.readFileSync(path.join(root,'web-static/radar-live.js'),'utf8'),context);context.data=data;vm.runInContext('RADAR_STATUS=data',context);
assert.match(vm.runInContext("radarCrossCard('us')",context),/رفتن به رادار آمریکا/);
assert.match(vm.runInContext("radarHubCard('israel')",context),/زمان انتخابات/);
assert.match(vm.runInContext("radarHubCard('us')",context),/آخرین بازبینی داده/);
assert.match(vm.runInContext("radarTrend('us')",context),/polyline/);
assert.doesNotMatch(vm.runInContext("radarTrend('israel')",context),/polyline/);
assert.match(vm.runInContext("radarTrend('israel')",context),/فعلاً یک نظرسنجی/);
assert.match(vm.runInContext("radarTrend('israel')",context),/ذخیره‌ها–اقتصادی/); // table retains all parties
memory['pendar-radar-seen-us']='2026-09-01T00:00:00Z';
assert.match(vm.runInContext("radarActivity('us')",context),/از آخرین بازدید شما/);
assert.match(vm.runInContext("radarActivity('us')",context),/از آخرین بازدید شما/); // async rerender retains badge
console.log('Cross cards, live hub dates, comparable trend, single-point disclosure and visit changes passed');
