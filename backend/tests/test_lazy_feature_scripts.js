/* Keep route-level lazy loading in sync with the HTML shell. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const html=fs.readFileSync(path.join(root,"web-static/index.html"),"utf8");
const router=fs.readFileSync(path.join(root,"web-static/router.js"),"utf8");
assert(!html.includes('<script defer src="diner.js'),"Diner should not block every initial route");
assert(!html.includes('<script defer src="future.js'),"Future should not block every initial route");
assert(router.includes('await loadPendarRouteScript("diner"); return showDiner(arg)'),"Diner route must await script");
assert(router.includes('await loadPendarRouteScript("future"); return showFuture(arg)'),"Future route must await script");
assert(router.includes('_pendarLazyRequests.has(kind)'),"Concurrent route loads should share request");
assert(router.includes('_pendarLazyRequests.delete(kind)'),"Failed script loads should be retryable");
assert(fs.existsSync(path.join(root,"web-static/diner.js")));
assert(fs.existsSync(path.join(root,"web-static/future.js")));
new Function(router);
console.log("Lazy feature script route contracts OK");
