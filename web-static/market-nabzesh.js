/* Rich static market snapshots. Prices are never fetched with a visitor's API key. */
let pendarMarketSnapshot;
function marketNumber(value, digits=4) {
  if(value===null||value===undefined||value===""||!Number.isFinite(Number(value)))return "—";
  return Number(value).toLocaleString("fa-IR",{maximumFractionDigits:digits});
}
function marketTime(value) {
  const date=new Date(value||"");
  return Number.isNaN(date.getTime())?"زمان نامشخص":date.toLocaleString("fa-IR",{timeZone:"Asia/Tehran",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function marketMove(value) {
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return '<span class="muted">تغییر نامشخص</span>';
  const n=Number(value),dir=n>0?"up":n<0?"down":"flat";
  return `<span class="${dir}">${n>0?"▲":n<0?"▼":"—"} ${marketNumber(Math.abs(n),2)}٪</span>`;
}
function marketAssetCard(row) {
  return `<button class="market-nb-card" type="button" onclick="selectMarketAsset('${esc(row.ticker)}')" aria-label="جزئیات ${esc(row.label_fa)}">
    <span class="market-nb-name">${esc(row.label_fa)}<small dir="ltr">${esc(row.ticker)}</small></span>
    <strong>${marketNumber(row.value,row.quote==="IRT"?0:4)} <small>${esc(row.unit_fa)}</small></strong>
    <span class="market-nb-move">${marketMove(row.dp)}${row.is_stale?'<em>دادهٔ قدیمی</em>':""}</span>
    <time>${esc(marketTime(row.updated_at))}</time>
  </button>`;
}
function marketNabzeshBoard(snapshot) {
  if(!snapshot?.rows?.length)return "";
  const captured=new Date(snapshot.generated_at||"").getTime();
  const expired=!Number.isFinite(captured)||Date.now()-captured>30*60*1000;
  snapshot={...snapshot,rows:snapshot.rows.map(r=>({...r,is_stale:r.is_stale||expired}))};
  pendarMarketSnapshot=snapshot;
  const featured=["USD","GOLD18","COIN_EMAMI","EUR","USDT"].map(t=>snapshot.rows.find(r=>r.ticker===t)).filter(Boolean);
  const groups=(snapshot.groups||[]).filter(g=>snapshot.rows.some(r=>r.group===g.id));
  return `<style>
    .market-nb-featured,.market-nb-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}
    .market-nb-featured{margin-bottom:22px}.market-nb-featured .market-nb-card{background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 8%,var(--surface)),var(--surface))}
    .market-nb-card{padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);font:inherit;text-align:right;display:flex;flex-direction:column;gap:10px;min-width:0;cursor:pointer}
    .market-nb-card:hover,.market-nb-card:focus-visible{border-color:var(--accent)}.market-nb-name{display:flex;justify-content:space-between;gap:5px;font-size:.72rem;font-weight:700}.market-nb-name small{font-size:.5rem;font-weight:400;color:var(--muted)}
    .market-nb-card strong{font-size:1.04rem}.market-nb-card strong small{font-size:.53rem;font-weight:400}.market-nb-move{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;font-size:.62rem}.market-nb-move em{font-style:normal;color:var(--muted);font-size:.53rem}.market-nb-card time{font-size:.51rem;color:var(--muted)}
    .market-nb-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.market-nb-tabs button{border:1px solid var(--line);border-radius:99px;padding:6px 12px;background:var(--surface);color:var(--ink);font:inherit;font-size:.65rem;cursor:pointer}.market-nb-tabs button[aria-pressed=true]{background:var(--ink);color:var(--surface)}
    .market-nb-note{font-size:.65rem;color:var(--muted);line-height:1.9}.market-nb-detail{margin:18px 0;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}.market-nb-detail h2{margin:0 0 6px;font-size:1.05rem}.market-nb-detail-head{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}.market-nb-detail-head strong{font-size:1.12rem}.market-nb-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:13px 0}.market-nb-stats>div{padding:9px;background:var(--surface-2);border-radius:9px;display:flex;flex-direction:column;gap:4px;font-size:.67rem}.market-nb-stats small{font-size:.53rem;color:var(--muted)}
    .market-nb-chart{width:100%;height:160px;color:var(--accent)}.market-nb-axis{direction:ltr;display:flex;justify-content:space-between;font-size:.57rem;color:var(--muted)}.market-nb-sources{margin:12px 0 0;font-size:.61rem;color:var(--muted);line-height:1.9}.market-nb-sources ul{padding:0;list-style:none}.market-nb-sources li{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line);padding:5px 0}
    @media(max-width:980px){.market-nb-featured,.market-nb-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.market-nb-featured,.market-nb-grid,.market-nb-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.market-nb-card{padding:11px}}
  </style>
  <div class="market-nb-featured">${featured.map(marketAssetCard).join("")}</div>
  <nav class="market-nb-tabs" aria-label="بازارها">${groups.map(g=>`<button type="button" data-market-group="${esc(g.id)}" aria-pressed="false" onclick="selectMarketGroup('${esc(g.id)}')">${esc(g.label_fa)}</button>`).join("")}</nav>
  <p id="market-nb-group-note" class="market-nb-note"></p><div class="market-nb-grid" id="market-nb-grid"></div>
  <section class="market-nb-detail" id="market-nb-detail" aria-live="polite"></section>
  <p class="market-nb-note">آخرین دریافت پندار: ${esc(marketTime(snapshot.generated_at))} · زمان هر قیمت روی کارت آمده است. «دادهٔ قدیمی» آخرین نرخ موجود در منبع است.</p>`;
}
function selectMarketGroup(group) {
  const rows=(pendarMarketSnapshot?.rows||[]).filter(r=>r.group===group);
  const grid=document.getElementById("market-nb-grid"),note=document.getElementById("market-nb-group-note");
  if(!grid||!rows.length)return;
  document.querySelectorAll("[data-market-group]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.marketGroup===group)));
  grid.innerHTML=rows.map(marketAssetCard).join("");
  if(note)note.textContent=group==="food"?"قیمت‌های جهانی برای واحد نوشته‌شده‌اند؛ قیمت خرید مواد اولیه در ایران نیستند. بوشل واحد پیمانهٔ غلات و هر پوند حدود ۴۵۴ گرم است.":group==="indicators"?"حباب سکه اختلاف قیمت بازار با ارزش طلای آن است. نرخ رسمیِ منبع با نرخ بازار آزاد و نرخ قابل خرید یکسان نیست.":group==="indexes"?"این ارقام واحد شاخص‌اند؛ در تبدیل ارز استفاده نمی‌شوند.":"برای دیدن زمان ثبت، منابع و روند، یک کارت را انتخاب کنید.";
  selectMarketAsset((rows.find(r=>r.chart?.points?.length)||rows[0]).ticker);
}
function marketChart(row) {
  const points=(row.chart?.points||[]).filter(p=>p.close!==null&&Number.isFinite(Number(p.close))&&Number.isFinite(new Date(p.time).getTime()));
  if(points.length<2)return '<p class="market-nb-note">تاریخچهٔ کافی برای نمودار در دسترس نیست.</p>';
  const values=points.map(p=>Number(p.close)),lo=Math.min(...values),hi=Math.max(...values),range=hi-lo||1;
  const start=new Date(points[0].time).getTime(),end=new Date(points[points.length-1].time).getTime(),span=end-start||1;
  let prev=0;
  const path=points.map((p,i)=>{const t=new Date(p.time).getTime(),x=12+(t-start)/span*616,y=138-(Number(p.close)-lo)/range*114;const cmd=!i||t-prev>3*86400000?"M":"L";prev=t;return `${cmd}${x.toFixed(2)},${y.toFixed(2)}`;}).join(" ");
  return `<svg class="market-nb-chart" viewBox="0 0 640 160" role="img" aria-label="نمودار قیمت پایانی ${esc(row.label_fa)} در تاریخچهٔ موجود؛ کمینه ${marketNumber(lo)} و بیشینه ${marketNumber(hi)} ${esc(row.unit_fa)}"><path d="M12 138 H628" stroke="currentColor" opacity=".15"/><path d="${path}" stroke="currentColor" stroke-width="2.5" fill="none"/><title>${esc(row.label_fa)}: ${marketNumber(lo)} تا ${marketNumber(hi)} ${esc(row.unit_fa)}</title></svg>
    <div class="market-nb-axis"><span>${esc(marketTime(points[0].time))}</span><span>${esc(marketTime(points[points.length-1].time))}</span></div>
    <p class="market-nb-note">روند روزانهٔ ۳۰ روز اخیر · ${marketNumber(points.length,0)} نقطهٔ موجود · کمینه ${marketNumber(lo)} و بیشینه ${marketNumber(hi)} ${esc(row.unit_fa)}. روزهای فاقد داده بازسازی نشده‌اند.</p>`;
}
function selectMarketAsset(ticker) {
  const row=(pendarMarketSnapshot?.rows||[]).find(r=>r.ticker===ticker),el=document.getElementById("market-nb-detail");
  if(!row||!el)return;
  const stats=row.stats,windows=stats?.windows||[],day=windows.find(w=>w.window==="24h");
  const changes=[['24h','۲۴ ساعت'],['7d','۷ روز'],['30d','۳۰ روز']].map(([w,label])=>{const window=windows.find(x=>x.window===w);return `<div><small>تغییر ${label}</small>${marketMove(window?.changePercent??(w==="24h"?row.dp:null))}</div>`;}).join("");
  const spread=row.spread,providers=spread?.providers||[];
  el.innerHTML=`<div class="market-nb-detail-head"><div><h2>${esc(row.label_fa)}</h2><span class="market-nb-note">ثبت قیمت: ${esc(marketTime(row.updated_at))}${row.is_stale?" · دادهٔ قدیمی":""}</span></div><strong>${marketNumber(row.value,row.quote==="IRT"?0:4)} <small>${esc(row.unit_fa)}</small></strong></div>
    <div class="market-nb-stats">${changes}<div><small>کمینه / بیشینهٔ ۲۴ ساعت</small><span>${marketNumber(day?.low,row.quote==="IRT"?0:4)} / ${marketNumber(day?.high,row.quote==="IRT"?0:4)}</span></div></div>
    ${stats?.isStale?'<p class="market-nb-note">آمار تغییرات منبع نیز قدیمی است.</p>':""}
    ${marketChart(row)}
    <details class="market-nb-sources"><summary>منابع قیمت و اختلاف نرخ</summary><p>منابع استفاده‌شده: ${esc((row.sources||[]).join("، ")||"نامشخص")} · نرخ نمایش‌داده‌شده: میانهٔ منابع نبضش.</p>
    ${providers.length?`<p>زمان مقایسهٔ منابع: ${esc(marketTime(spread.asOf))} · ${providers.length>1?`فاصلهٔ کمترین و بیشترین: ${marketNumber(spread.spread)} ${esc(row.unit_fa)} (${marketNumber(spread.spreadPercent,2)}٪)`:'فقط یک منبع برای مقایسه موجود است.'}</p><ul>${providers.map(p=>`<li><span>${esc(p.provider)}${p.isStale?' · قدیمی':''}<small> · ${esc(marketTime(p.time))}</small></span><b>${marketNumber(p.price,row.quote==="IRT"?0:4)} ${esc(row.unit_fa)}</b></li>`).join("")}</ul>`:'<p>جدول مقایسهٔ نرخ منابع در دسترس نیست.</p>'}</details>`;
}
