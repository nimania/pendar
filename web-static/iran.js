/* Pendar — Iran / provinces view: the national vs provincial scope toggle
   (_iranScope, setIranScope), the Iran page (showIran, renderIran), the
   per-province page (openProvince) and province follow (hitProvFollow).
   Extracted from app.js; loaded as a classic script BEFORE app.js because
   route() reaches showIran/openProvince on deep links. Uses app.js helpers
   (show, setTab, feedCard, groupedFeed, miniMap, the feed ALL cache) and the
   follow store (charts-social.js) at runtime. No behavior change. */

let _iranScope = "all";
function showIran() { show("iran"); setTab("iran"); renderIran(); setHash("#/iran"); }
async function renderIran() {
  const el = document.getElementById("iran");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const geo = await getJSON(`${DATA}/geo.json`).catch(() => ({ provinces: {}, scope: {} }));
    const pc = geo.provinces || {};
    const max = Math.max(1, ...Object.values(pc));
    const paths = Object.entries(PATHS).map(([slug, p]) => {
      const n = pc[slug] || 0;
      const alpha = n ? (0.30 + 0.70 * (n / max)) : 0;
      const fill = n ? ` fill="rgba(26,157,126,${alpha.toFixed(3)})"` : "";
      const cls = "prov" + (n ? " has" : "");
      const tip = esc(p.fa) + (n ? ` — ${faN(n)} خبر` : "");
      return `<path d="${p.d}" class="${cls}"${fill} onclick="openProvince('${slug}')"><title>${tip}</title></path>`;
    }).join("");
    const sc = geo.scope || {};
    const total = (sc.local || 0) + (sc.national || 0) + (sc.international || 0);
    const scopes = [["all", "همه", total], ["local", "استانی", sc.local || 0],
      ["national", "کشوری", sc.national || 0], ["international", "بین‌المللی", sc.international || 0]];
    const provChips = Object.entries(PATHS).map(([slug, p]) => {
      const n = pc[slug] || 0, on = isF("provinces", slug);
      return `<button class="pfollow ${on ? "on" : ""}" onclick="hitProvFollow('${slug}',this)"><span class="pf-star">★</span>${esc(p.fa)}${n ? ` <span class="chip-n">${faN(n)}</span>` : ""}</button>`;
    }).join("");
    el.innerHTML = `
      <div class="iran-map">
        <svg viewBox="${VIEWBOX}" class="iran-svg" role="img" aria-label="نقشهٔ استان‌های ایران">${paths}</svg>
      </div>
      <p class="muted" style="text-align:center;margin:2px 0 12px">روی هر استان بزن تا خبرهایش را ببینی — رنگِ پررنگ‌تر یعنی خبرِ بیشتر.</p>
      <details class="prov-follow"><summary>دنبال‌کردنِ استان‌ها ★</summary>
        <p class="muted" style="margin:8px 0">استان‌هایی که دنبال کنی، خبرهایشان در «سرخط من» می‌آید (روی این دستگاه ذخیره می‌شود).</p>
        <div class="pfollow-grid">${provChips}</div></details>
      <div class="imp-filter" id="iran-scopes">${scopes.map(s => `<button class="fchip" data-s="${s[0]}" onclick="setIranScope('${s[0]}')">${s[1]}${s[2] ? ` <span class="chip-n">${faN(s[2])}</span>` : ""}</button>`).join("")}</div>
      <div id="iran-body"></div>`;
    setIranScope(_iranScope);
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">صفحهٔ ایران بارگذاری نشد</div></div>`; }
}
function setIranScope(s) {
  _iranScope = s;
  document.querySelectorAll("#iran-scopes .fchip").forEach(c => c.classList.toggle("on", c.dataset.s === s));
  const items = s === "all" ? ALL : ALL.filter(x => x.geo && x.geo.scope === s);
  document.getElementById("iran-body").innerHTML = groupedFeed(items);
}
function openProvince(slug) {
  if (!ALL.length) return;
  setHash("#/province/" + slug);
  show("topicarchive"); setTab("iran");
  document.getElementById("ta-back-t").textContent = "بازگشت به ایران";
  document.getElementById("ta-back").onclick = showIran;
  const items = ALL.filter(s => s.geo && (s.geo.provinces || []).some(p => p.slug === slug));
  const name = (PATHS[slug] || {}).fa || slug;
  document.getElementById("ta-title").textContent = "استان: " + name;
  document.getElementById("ta-sub").textContent = faN(items.length) + " خبر در این استان";
  document.getElementById("ta-feed").innerHTML = followBar("provinces", slug, "خبرهای این استان در «سرخط من» بیاید") + groupedFeed(items);
}
function hitProvFollow(slug, btn) {
  toggleF("provinces", slug);
  btn.classList.toggle("on", isF("provinces", slug));
  updateMineBadge();
}
