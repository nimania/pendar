export const FAMILIES = ["deal","regroup","war","transition","attrition","recovery"];
const TAGS = [
  ["deal", /مذاکر|توافق|دیپلماسی|آتش\s*بس|ترک\s*مخاصمه/u],
  ["regroup", /سرکوب|بازداشت|اقتدارگرا|قلعه\s*خاموش/u],
  ["war", /جنگ|بمباران|حمله\s*(نظامی|هوایی|موشکی)|درگیری\s*نظامی|موشک/u],
  ["transition", /سرنگونی|گذار\s*(سیاسی|قدرت|از|حکومت)|فروپاشی|تغییر\s*نظام|دولت\s*موقت/u],
  ["attrition", /تورم|تحریم|ارزش\s*ریال|بحران\s*اقتصادی|فرسایش|محاصره\s*دریایی/u],
  ["recovery", /چرخش\s*به\s*شرق|پساترامپ|بازسازی\s*اقتصاد|وام\s*روسیه|تفاهم\s*با\s*چین/u],
];
const IRAN = /ایران|ایرانی|جمهوری\s*اسلامی|تهران|ریال|سپاه/u;
export function normalize(value) { return String(value || "").replace(/[يك]/g, v => v === "ي" ? "ی" : "ک").replace(/\u200c/g," ").replace(/\s+/g," ").trim(); }
export function classifyHeadline(text) {
  const value = normalize(text);
  if (!IRAN.test(value)) return null;
  const matches = TAGS.filter(([,re])=>re.test(value));
  return matches.length === 1 ? matches[0][0] : null;
}
export function xmlText(value) {
  return String(value||"").replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,"$1")
    .replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();
}
export function parseRss(xml, max=15) {
  if (typeof xml !== "string" || xml.length > 500000) return [];
  const result = [];
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  for (const item of blocks.slice(0,max)) {
    const extract = tag => {
      const m = item.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","i"));
      return m ? xmlText(m[1]) : "";
    };
    let title=extract("title"), url=extract("link"), published=extract("pubDate");
    if (!title || !/^https:\/\/[^\s/]+\//i.test(url)) continue;
    let t=Date.parse(published);
    if(!Number.isFinite(t))continue;
    result.push({title:normalize(title).slice(0,300),url:url.slice(0,1300),ts:t});
  }
  return result;
}
export function sanitizeSignal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id=String(value.id||"");
  const family=String(value.family||"");
  const ts=Number(value.ts);
  if (!/^[A-Za-z0-9_-]{5,90}$/.test(id) || !FAMILIES.includes(family) ||
      !Number.isFinite(ts) || ts < 1600000000000 || ts > Date.now()+3600000) return null;
  const safeURL = raw => {
    const value=String(raw||"");
    if (/^\/story\/[0-9a-fA-F-]{8,64}\/$/.test(value)||/^\/@[A-Za-z0-9_-]{2,80}\/?$/.test(value))return value;
    try {const u=new URL(value);if(u.protocol==="https:" && !u.username && !u.password && u.hostname && value.length<1400)return value;} catch(_){}
    return "";
  };
  const sourceLinks=(Array.isArray(value.source_links)?value.source_links:[]).slice(0,8)
    .map(r=>({label:String(r.label||"منبع").slice(0,100),url:safeURL(r.url),kind:String(r.kind||"original").slice(0,20)}))
    .filter(r=>r.url);
  const direction=[-1,0,1].includes(Number(value.direction))?Number(value.direction):0;
  const weight=Math.min(2,Math.max(1,Math.trunc(Number(value.weight)||1)));
  const kind=["story","figure","statement","feed"].includes(value.source_type)?value.source_type:"feed";
  const trustedDirection=(kind!=="feed" && sourceLinks.some(r=>r.kind==="original"))?direction:0;
  return {
    id, family, ts, date:new Date(ts).toISOString().slice(0,10),
    direction:trustedDirection, weight:trustedDirection?weight:1,
    by:"pendar-auto", source_type:kind,
    score_kind:trustedDirection?(kind==="story"?"reported_event":"analyst_view"):"unscored",
    review_status:"auto_unverified",
    text:normalize(value.text).slice(0,500),
    source:normalize(value.source).slice(0,180),
    source_links:sourceLinks,
    source_url:safeURL(value.source_url) || sourceLinks[0]?.url || "",
    speaker:normalize(value.speaker).slice(0,160),
    speaker_role:normalize(value.speaker_role).slice(0,100),
    speaker_url:safeURL(value.speaker_url),
    score_reason:normalize(value.score_reason).slice(0,400),
    review_note:normalize(value.review_note||"گزارش اولیه؛ تأیید مستقل نشده").slice(0,400),
    evidence_phrase:normalize(value.evidence_phrase).slice(0,120),
    uncertainty:normalize(value.uncertainty).slice(0,260),
  };
}
export function mergeSignals(existing, incoming) {
  const map=new Map(existing.map(x=>[x.id,x]));
  let changed=0;
  for (const s of incoming) {
    if (!s) continue;
    if (JSON.stringify(map.get(s.id)) !== JSON.stringify(s)){map.set(s.id,s);changed++;}
  }
  return {signals:[...map.values()].sort((a,b)=>b.ts-a.ts),changed};
}
