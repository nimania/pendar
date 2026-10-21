/* Pendar — core utilities shared across all modules.
   Loaded as a classic script BEFORE app.js and the other view scripts, so
   everything defined here stays on the global scope exactly as before.
   This file holds the primitives with no dependencies: the data path,
   label dictionaries, number/HTML helpers, time formatting, and the
   JSON fetch layer. */

const DATA = "data";

const CAT_FA = { iran: "ایران", world: "جهان", politics: "سیاست", economy: "اقتصاد",
  technology: "فناوری", ai: "هوش مصنوعی", culture: "فرهنگ", sport: "ورزش", science: "علم", environment: "محیط‌زیست", entertainment: "سرگرمی", health: "سلامت" };
const IRAN_FA = { high: "ارتباط بالا با ایران", medium: "ارتباط با ایران",
  low: "ارتباط کم با ایران", none: "بدون ارتباط مستقیم با ایران" };
const CRED_FA = { high: "اعتبار بالا", medium: "چند منبع", low: "تک‌منبع" };
const CRED_CLS = { high: "st-ok", medium: "st-neutral", low: "st-warn" };

const faN = s => String(s).replace(".", "٫").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const grp = n => Number(n).toLocaleString("en-US");  // group digits with thousands separators
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Homepage editorial wording: use neutral/national terminology in the public
// front page without mutating the underlying archived/source text.
function homeEditorialText(v) {
  return String(v ?? "")
    .replace(/صهیونیست(?:‌|\s)?های/g, "اسرائیلی‌های")
    .replace(/صهیونیست(?:‌|\s)?ها/g, "اسرائیلی‌ها")
    .replace(/صهیونیستی/g, "اسرائیلی")
    .replace(/صهیونیست/g, "اسرائیلی");
}

function impInfo(v) {
  if (v >= 75) return { cls: "high", lbl: "بسیار مهم" };
  if (v >= 50) return { cls: "mid", lbl: "مهم" };
  return { cls: "low", lbl: "متوسط" };
}

function relTime(iso) {
  if (!iso) return "";
  // Build timestamps are UTC but may omit the timezone suffix. Without one,
  // new Date() parses them as the viewer's LOCAL time (e.g. +3:30 in Tehran),
  // so every item looked ~3.5h old. Force UTC when no offset is present.
  if (typeof iso === "string" && !/(Z|[+-]\d\d:?\d\d)$/.test(iso)) iso += "Z";
  const mins = Math.floor((Date.now() - new Date(iso)) / 6e4);
  if (mins < 1) return "همین حالا";
  if (mins < 60) return faN(mins) + " دقیقه پیش";
  const h = Math.floor(mins / 60);
  if (h < 24) return faN(h) + " ساعت پیش";
  const d = Math.floor(h / 24);
  return d === 1 ? "دیروز" : faN(d) + " روز پیش";
}

// Share overlapping reads of the same dataset across independent views.
const _pendingJSON = new Map();
function getJSON(path, timeoutMs = 12000) {
  const key = String(path);
  if (_pendingJSON.has(key)) return _pendingJSON.get(key);
  const promise = _fetchJSON(path, timeoutMs);
  _pendingJSON.set(key, promise);
  // A finished read never stays cached in memory: subsequent visits can see fresh data.
  promise.then(
    () => { if (_pendingJSON.get(key) === promise) _pendingJSON.delete(key); },
    () => { if (_pendingJSON.get(key) === promise) _pendingJSON.delete(key); }
  );
  return promise;
}
async function _fetchJSON(path, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    // Large person partitions retain every field, stored losslessly as gzip.
    // Fall back to plain JSON for earlier deployments during a rollout.
    const partition = /(?:^|\/)(people|person-aliases)\/\d+\.json(?:[?#]|$)/.test(path);
    if (partition && typeof DecompressionStream !== "undefined") {
      const compressed = path.replace(/\.json(?=[?#]|$)/, ".json.gz");
      const response = await fetch(compressed, {cache: "default", signal: ctl.signal});
      if (response.ok) {
        const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
        return await new Response(stream).json();
      }
      if (response.status !== 404) throw new Error("HTTP " + response.status);
    }
    // News and figure feeds are live datasets, not immutable browser assets.
    const isFreshFeed = /(?:^|\/)(?:stories|figures|editorial-archive|trends|meta|news-health|figures-health)\.json(?:[?#]|$)/.test(path);
    const r = await fetch(path, { cache: isFreshFeed ? "no-store" : "default", signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
