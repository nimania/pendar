/* Pendar — dependency-free inline-SVG charts, the follow/save store, and
   the home stats block. Extracted from app.js; loaded as a classic script
   BEFORE app.js because app.js's boot code calls updateMineBadge() and
   renderHomeStats() synchronously at load. The chart helpers (svgSpark,
   svgBars, _pts) are used by trends/feed code in app.js at runtime, and
   these functions call app.js helpers (utcDayISO, openDay, card renderers)
   only at runtime, by which point every script has loaded. No behavior
   change. */

/* ============================================================
   Charts (dependency-free inline SVG), follow store, and stats
   ============================================================ */

function _pts(vals, w, h, pad) {
  pad = pad == null ? 2 : pad;
  const n = vals.length; if (!n) return [];
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0), rng = (mx - mn) || 1;
  return vals.map((v, i) => {
    const x = n === 1 ? w / 2 : pad + i * (w - 2 * pad) / (n - 1);
    const y = h - pad - ((v - mn) / rng) * (h - 2 * pad);
    return [x, y];
  });
}
// sparkline (area + line), scales to container width
function svgSpark(vals, o) {
  o = o || {}; const w = o.w || 120, h = o.h || 30;
  const p = _pts(vals, w, h, 2); if (!p.length) return "";
  const line = p.map(a => a[0].toFixed(1) + "," + a[1].toFixed(1)).join(" ");
  const area = p[0][0].toFixed(1) + "," + (h - 2) + " " + line + " " + p[p.length - 1][0].toFixed(1) + "," + (h - 2);
  const cls = o.cls || "a";
  return `<svg class="spark s-${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon class="sp-area" points="${area}"/><polyline class="sp-line" points="${line}"/></svg>`;
}
// vertical bars (activity)
function svgBars(vals, o) {
  o = o || {}; const w = o.w || 300, h = o.h || 64, n = vals.length, gap = o.gap || 2;
  const mx = Math.max(...vals, 1), bw = (w - gap * (n - 1)) / n;
  let r = "";
  for (let i = 0; i < n; i++) {
    const bh = Math.max(1.5, (vals[i] / mx) * (h - 2)), x = i * (bw + gap), y = h - bh;
    const lbl = (o.labels && o.labels[i]) ? esc(o.labels[i]) + " — " : "";
    // optional per-bar click handler + slight cursor hint via class="bar-click"
    const click = (o.onclick && o.onclick[i]) ? ` class="bar bar-click" onclick="${o.onclick[i]}"` : ' class="bar"';
    r += `<rect${click} x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5"><title>${lbl}${faN(vals[i])} خبر</title></rect>`;
  }
  return `<svg class="bars-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${r}</svg>`;
}
// two-series comparison, each normalized to its own max (shape compare, one axis)
function svgCompare(a, b, o) {
  o = o || {}; const w = o.w || 260, h = o.h || 64;
  const norm = v => { const m = Math.max(...v, 1); return v.map(x => x / m * 100); };
  const mk = (vals, cls) => {
    const p = _pts(norm(vals), w, h, 3); if (!p.length) return "";
    return `<polyline class="cmp-line c-${cls}" points="${p.map(a => a[0].toFixed(1) + "," + a[1].toFixed(1)).join(" ")}"/>` +
      `<circle class="cmp-dot c-${cls}" cx="${p[p.length - 1][0].toFixed(1)}" cy="${p[p.length - 1][1].toFixed(1)}" r="2.6"/>`;
  };
  return `<svg class="cmp-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${mk(a, "a")}${b && b.length ? mk(b, "b") : ""}</svg>`;
}
function growthTag(g) {
  if (g == null) return "";
  if (g > 0) return `<span class="gtag up">▲ ${faN(g)}٪</span>`;
  if (g < 0) return `<span class="gtag down">▼ ${faN(Math.abs(g))}٪</span>`;
  return `<span class="gtag flat">—</span>`;
}
function trendBadge(t) {
  if (!t) return "";
  if (t.hot) return `<span class="tbadge hot">🔥 داغ</span>`;
  if (t.rising) return `<span class="tbadge rise">در حال رشد</span>`;
  return "";
}

/* ----- follow / saved store (per-device, localStorage) ----- */
const FKEY = "jk_follow_v1";
function loadF() { try { return JSON.parse(localStorage.getItem(FKEY)) || {}; } catch (e) { return {}; } }
function saveF() { try { localStorage.setItem(FKEY, JSON.stringify(FOLLOW)); } catch (e) {} }
let FOLLOW = Object.assign({ topics: [], provinces: [], sources: [], entities: [], saved: [] }, loadF());
function isF(kind, id) { return (FOLLOW[kind] || []).includes(id); }
function toggleF(kind, id) {
  const a = FOLLOW[kind] || (FOLLOW[kind] = []);
  const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id);
  saveF();
}
function followCount() {
  return (FOLLOW.topics.length + FOLLOW.provinces.length + FOLLOW.sources.length
    + (FOLLOW.entities ? FOLLOW.entities.length : 0));
}
// a reusable follow/save button
function followBtn(kind, id, labelOn, labelOff) {
  const on = isF(kind, id);
  return `<button class="follow-btn ${on ? "on" : ""}" onclick="event.stopPropagation();hitFollow('${kind}','${String(id).replace(/'/g, "\\'")}',this)">
    <svg viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z" stroke-linejoin="round"/></svg>
    <span class="fb-t">${on ? (labelOn || "دنبال می‌کنی") : (labelOff || "دنبال کن")}</span></button>`;
}
function hitFollow(kind, id, btn) {
  toggleF(kind, id);
  const on = isF(kind, id);
  btn.classList.toggle("on", on);
  const t = btn.querySelector(".fb-t"); if (t) t.textContent = on ? "دنبال می‌کنی" : "دنبال کن";
  const svg = btn.querySelector("svg"); if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
  updateMineBadge();
}
function saveBtn(id) {
  const on = isF("saved", id);
  return `<button class="save-btn ${on ? "on" : ""}" title="ذخیره" aria-label="ذخیره" onclick="event.stopPropagation();hitSave('${id}',this)">
    <svg viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" stroke-linejoin="round"/></svg></button>`;
}
function hitSave(id, btn) {
  toggleF("saved", id);
  const on = isF("saved", id);
  btn.classList.toggle("on", on);
  const svg = btn.querySelector("svg"); if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
  updateMineBadge();
}
function updateMineBadge() {
  const b = document.getElementById("mine-badge");
  if (!b) return;
  const n = followCount() + (FOLLOW.saved ? FOLLOW.saved.length : 0);
  b.textContent = n ? faN(n) : "";
  b.style.display = n ? "inline-flex" : "none";
}

/* ----- personalized feed ("سرخط من") ----- */
function mineFeed() {
  return ALL.filter(s =>
    (s.topics || []).some(t => isF("topics", t.slug)) ||
    (s.geo && (s.geo.provinces || []).some(p => isF("provinces", p.slug))) ||
    (s.source_names || []).some(n => isF("sources", n)) ||
    (s.entities || []).some(e => isF("entities", e.slug)) ||
    isF("saved", s.id));
}

/* ----- home stats strip ("نبض خبری") ----- */
async function renderHomeStats() {
  const el = document.getElementById("home-stats");
  if (!el) return;
  try {
    const [st, figs] = await Promise.all([
      getJSON(`${DATA}/stats.json`),
      getJSON(`${DATA}/figures.json`).catch(() => ({ figures: [] }))
    ]);
    STATS = st;
    const roll = liveRolling(st);
    const people = (figs.figures || []);
    const allPosts = people.flatMap(f => (f.posts || []).map(p => ({...p, _person:f})));
    const now = Date.now(), countPosts = h => allPosts.filter(p => p.published_at && new Date(p.published_at).getTime() >= now-h*3600e3).length;
    const activePeople = h => new Set(allPosts.filter(p => p.published_at && new Date(p.published_at).getTime() >= now-h*3600e3).map(p => p._person.handle || p._person.name_fa)).size;
    const opinionCount = allPosts.length;
    const daily = (st.activity_daily || []).map(x => x.n);
    const figDaily = Array.from({length:7},(_,i)=>{
      const a=now-(6-i)*86400e3, b=a+86400e3;
      return allPosts.filter(p=>{const t=p.published_at?new Date(p.published_at).getTime():0;return t>=a&&t<b}).length;
    });
    const today = utcDayISO(0), yday = utcDayISO(-1);
    el.innerHTML = `<div class="statbar statbar-rich">
      <div class="sb-metrics">
        <span class="sb-item sb-click" onclick="showTrends()"><b>${faN(st.total || 0)}</b><span>کل خبرها</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click" onclick="showFigures()"><b>${faN(people.length)}</b><span>چهره‌ها</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click sb-opinions" onclick="showFigures()"><b>${faN(opinionCount)}</b><span>کل اظهارنظرها</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click" onclick="showFigures()"><b>${faN(countPosts(24))}</b><span>نظر · ۲۴ساعت</span></span>
        <span class="sb-item sb-click" onclick="showFigures()"><b>${faN(activePeople(24))}</b><span>چهرهٔ فعال · ۲۴ساعت</span></span>
        <span class="sb-sep"></span>
        <span class="sb-item sb-click" onclick="openDay('${today}')"><b>${faN(st.calendar ? st.calendar.today : 0)}</b><span>خبر امروز ›</span></span>
        <span class="sb-item sb-click" onclick="showTrends()"><b>${faN(roll.h24)}</b><span>خبر · ۲۴ساعت</span></span>
      </div>
      <div class="sb-charts">
        <div class="sb-mini sb-click" onclick="showTrends()"><span>خبر · ۱۴ روز</span>${svgSpark(daily, { w: 150, h: 34 })}</div>
        <div class="sb-mini sb-click" onclick="showFigures()"><span>اظهارنظر · ۷ روز</span>${svgSpark(figDaily, { w: 120, h: 34, cls:"b" })}</div>
      </div>
    </div>`;
  } catch (e) {}
}
let STATS = null;
// recompute rolling windows live from the timeline so 4h/8h/12h stay fresh
function liveRolling(st) {
  const tl = (st && st.timeline) || [];
  const now = Date.now();
  const c = h => tl.filter(ms => ms >= now - h * 3600e3).length;
  return { h4: c(4), h8: c(8), h12: c(12), h24: c(24) };
}
function statsBlock(st) {
  const roll = liveRolling(st), cal = st.calendar || {};
  const daily = (st.activity_daily || []);
  const today = utcDayISO(0), yday = utcDayISO(-1);
  // rolling windows (not tied to a single day) are non-clickable; day tiles link.
  const tiles = [
    ["۴ ساعت", roll.h4, null], ["۸ ساعت", roll.h8, null],
    ["۱۲ ساعت", roll.h12, null], ["۲۴ ساعت", roll.h24, null],
    ["امروز ›", cal.today || 0, today], ["دیروز ›", cal.yesterday || 0, yday],
    ["این هفته", cal.this_week || 0, null], ["هفتهٔ پیش", cal.last_week || 0, null],
  ];
  const labels = daily.map(d => d.d.slice(5));
  // bars: each day-bar becomes a button that jumps to that day's archive
  const barsSvg = svgBars(daily.map(d => d.n), {
    labels, w: 320, h: 70,
    onclick: daily.map(d => `openDay('${d.d}')`),
  });
  return `
    <div class="stat-hero"><span class="val">${faN(st.total || 0)}</span><span class="lbl">کل خبرهای سیستم</span></div>
    <div class="stat-tiles">${tiles.map(t => {
      const cls = t[2] ? "stile stile-click" : "stile";
      const onc = t[2] ? ` onclick="openDay('${t[2]}')"` : "";
      return `<div class="${cls}"${onc}><b>${faN(t[1])}</b><span>${t[0]}</span></div>`;
    }).join("")}</div>
    <div class="rule"><span>فعالیتِ ۱۴ روزِ گذشته <span class="n">— روی هر روز بزن</span></span><span class="l"></span></div>
    <div class="chart-wrap">${barsSvg}</div>
    <p class="muted" style="margin:6px 0 4px">شمارِ خبرهای تازه در هر روز. روی «امروز/دیروز» یا هر میله بزن تا خبرهای همان روز را با تفکیک دسته ببینی.</p>`;
}
