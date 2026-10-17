import { DurableObject } from "cloudflare:workers";
import { FAMILIES, classifyHeadline, parseRss, sanitizeSignal } from "./logic.mjs";

const VERIFIED_FEEDS = [
  {name:"ایرنا",url:"https://www.irna.ir/rss",host:"www.irna.ir"},
  {name:"ایسنا",url:"https://www.isna.ir/rss",host:"www.isna.ir"},
  {name:"مهر",url:"https://www.mehrnews.com/rss",host:"www.mehrnews.com"}
];
const json = (value,status=200,headers={}) => new Response(JSON.stringify(value),
  {status,headers:{"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",...headers}});
function cors(request,env){
  const origin=request.headers.get("origin")||"";
  const allowed=new Set([env.SITE_ORIGIN||"https://pendar.io","https://www.pendar.io"]);
  return allowed.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin",
    "access-control-allow-methods":"GET, POST, OPTIONS",
    "access-control-allow-headers":"Content-Type, Authorization"}:{};
}
function room(env){return env.RADAR_ROOM.get(env.RADAR_ROOM.idFromName("iran-scenarios-v1"));}
async function hash(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,24);
}
async function pollFeeds(env){
  const candidates=[];
  await Promise.all(VERIFIED_FEEDS.map(async feed=>{
    try {
      const response=await fetch(feed.url,{headers:{"User-Agent":"PendarScenarioRadar/1.0",
        "Accept":"application/rss+xml, application/xml, text/xml"},
        redirect:"follow",signal:AbortSignal.timeout(8000)});
      if(!response.ok || new URL(response.url).hostname!==feed.host ||
        Number(response.headers.get("content-length")||0)>500000)return;
      const xml=(await response.text()).slice(0,500001);
      for (const item of parseRss(xml,20)){
        if(Date.now()-item.ts>86400000 || item.ts>Date.now()+3600000)continue;
        const family=classifyHeadline(item.title);
        if(!family)continue;
        const id="rss-"+await hash(feed.name+"|"+item.url);
        candidates.push({
          id,ts:item.ts,family,source_type:"feed",direction:0,weight:1,
          text:item.title,source:feed.name,source_url:item.url,
          source_links:[{label:feed.name+" · مطلب اصلی",url:item.url,kind:"original"}],
          review_note:"شناسایی از خوراک RSS؛ بدون تأیید مستقل و بدون امتیاز"
        });
      }
    }catch(_){ /* One source must not disable other sources. */ }
  }));
  if(candidates.length)await room(env).fetch("https://internal/ingest",{
    method:"POST",body:JSON.stringify({signals:candidates}),headers:{"content-type":"application/json"}
  });
  return candidates.length;
}

export default {
  async fetch(request,env){
    const {pathname}=new URL(request.url), headers=cors(request,env);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(pathname==="/health")return json({service:"pendar-radar-live",active:true,upstream:"minute-rss-watch-plus-trusted-push"},200,headers);
    if(pathname==="/v1/ws"){
      const origin=request.headers.get("Origin")||"";
      if(![env.SITE_ORIGIN||"https://pendar.io","https://www.pendar.io"].includes(origin))return json({error:"forbidden origin"},403,headers);
      if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"upgrade required"},426,headers);
      return room(env).fetch("https://internal/ws",{headers:request.headers});
    }
    if(pathname==="/v1/state" && request.method==="GET"){
      const response=await room(env).fetch("https://internal/state");
      return new Response(response.body,{status:response.status,headers:{...headers,
        "content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
    }
    if(pathname==="/v1/ingest" && request.method==="POST"){
      if(!env.INGEST_TOKEN)return json({error:"not configured"},503,headers);
      const token=request.headers.get("Authorization")||"";
      if(token!=="Bearer "+env.INGEST_TOKEN)return json({error:"unauthorized"},401,headers);
      if(Number(request.headers.get("content-length")||0)>250000)return json({error:"payload too large"},413,headers);
      const body=await request.text();if(body.length>250000)return json({error:"payload too large"},413,headers);
      let payload;try{payload=JSON.parse(body);}catch(_){return json({error:"invalid JSON"},400,headers);}
      if(!payload||!Array.isArray(payload.signals)||payload.signals.length>150)
        return json({error:"invalid signal batch"},400,headers);
      const response=await room(env).fetch("https://internal/ingest",{method:"POST",body,
        headers:{"content-type":"application/json"}});
      return new Response(response.body,{status:response.status,headers:{...headers,
        "content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
    }
    return json({error:"not found"},404,headers);
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(pollFeeds(env));}
};

export class RadarRoom extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    this.ctx=ctx;
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS signals(id TEXT PRIMARY KEY,ts INTEGER NOT NULL,payload TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS ix_signals_ts ON signals(ts DESC)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS observations(version INTEGER PRIMARY KEY,at TEXT NOT NULL,changed INTEGER NOT NULL)");
  }
  currentVersion(){
    const row=this.ctx.storage.sql.exec("SELECT MAX(version) AS n FROM observations").one();
    return Number(row?.n||0);
  }
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==="/ws"){
      if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return new Response("Upgrade required",{status:426});
      const pair=new WebSocketPair();
      const [client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({type:"ready",version:this.currentVersion()}));
      return new Response(null,{status:101,webSocket:client});
    }
    if(path==="/state"){
      const rows=[...this.ctx.storage.sql.exec("SELECT payload FROM signals ORDER BY ts DESC LIMIT 1500")];
      const signals=rows.map(row=>JSON.parse(row.payload));
      const observations=[...this.ctx.storage.sql.exec(
        "SELECT version,at,changed FROM observations ORDER BY version DESC LIMIT 100")].reverse();
      return json({version:this.currentVersion(),generated_at:new Date().toISOString(),signals,
        observations,source_mode:"scheduled_rss_and_authenticated_ingest",score_is_probability:false});
    }
    if(path==="/ingest"&&request.method==="POST"){
      let body;try{body=await request.json();}catch(_){return json({error:"invalid JSON"},400);}
      if(!Array.isArray(body?.signals)||body.signals.length>150)return json({error:"bad signals"},400);
      const rows=body.signals.map(sanitizeSignal).filter(Boolean);
      let changed=0;
      for(const signal of rows){
        if(!signal.text||!signal.source_links.length)continue;
        const payload=JSON.stringify(signal);
        const existing=this.ctx.storage.sql.exec("SELECT payload FROM signals WHERE id=?",signal.id).one();
        if(existing?.payload===payload)continue;
        this.ctx.storage.sql.exec(
          "INSERT INTO signals(id,ts,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET ts=excluded.ts,payload=excluded.payload",
          signal.id,signal.ts,payload);
        changed++;
      }
      let version=this.currentVersion();
      if(changed){
        version++;
        const now=new Date().toISOString();
        this.ctx.storage.sql.exec("INSERT INTO observations(version,at,changed) VALUES(?,?,?)",
          version,now,changed);
        this.ctx.storage.sql.exec("DELETE FROM observations WHERE version < ?",Math.max(1,version-2000));
        this.ctx.storage.sql.exec("DELETE FROM signals WHERE id IN (SELECT id FROM signals ORDER BY ts DESC LIMIT -1 OFFSET 5000)");
        const message=JSON.stringify({type:"changed",version,at:now,changed});
        for(const ws of this.ctx.getWebSockets()){
          try{ws.send(message);}catch(_){try{ws.close(1011,"delivery error");}catch(_){}}
        }
      }
      return json({accepted:rows.length,changed,version});
    }
    return json({error:"not found"},404);
  }
  webSocketMessage(ws,message){
    if(String(message)==="ping")ws.send("pong");
  }
  webSocketClose(ws,code,reason,wasClean){try{ws.close(code,reason);}catch(_){}}
  webSocketError(ws){try{ws.close(1011,"socket error");}catch(_){}}
}
