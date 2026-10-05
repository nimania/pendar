/* Pendar — market (پنداربازار) + weather & air-quality views.
   Extracted from app.js; loaded as a classic script BEFORE app.js because
   app.js's boot code calls renderHomeWeather() (and route() may dispatch to
   showMarket/showWeather) synchronously at load, so these must already be
   defined. The helpers these functions call at runtime (show, setTab, grp,
   openFigure) live in app.js but run only after every script has loaded.
   No behavior change. */

// پنداربازار — dedicated market page (full price board)
function showMarket() { show("market"); setTab("feed"); renderMarket(); setHash("#/market"); }
async function renderMarket() {
  const el = document.getElementById("market");
  try {
    const [prices, crypto] = await Promise.all([
      getJSON(`${DATA}/prices.json`).catch(() => []),
      getJSON(`${DATA}/crypto.json`).catch(() => []),
    ]);
    if ((!prices || !prices.length) && (!crypto || !crypto.length)) {
      el.innerHTML = `<div class="state"><div class="big">نرخ‌ها در دسترس نیست</div></div>`;return;
    }
    const priceRows = (prices || []).map(p => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      return `<div class="price"><div class="p-label">${esc(p.label_fa)}</div>
        <div class="p-val">${faN(grp(p.value))} <span class="p-unit">${esc(p.unit_fa)}</span></div>
        <div class="p-chg ${cls}">${arrow} ${faN(Math.abs(p.dp || 0))}٪</div></div>`;
    }).join("");
    const cryptoRows = (crypto || []).map(p => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      const value = p.value >= 1000 ? grp(Math.round(p.value)) : Number(p.value).toLocaleString("en-US", {maximumFractionDigits: p.value < 1 ? 4 : 2});
      return `<div class="price crypto-price"><div class="p-label">${esc(p.label_fa)} <span class="p-symbol">${esc(p.symbol || "")}</span></div>
        <div class="p-val">$ ${faN(value)}</div>
        <div class="p-chg ${cls}">${arrow} ${faN(Math.abs(p.dp || 0))}٪ <span class="p-unit">۲۴ساعت</span></div></div>`;
    }).join("");
    const fiatUnits = (prices || []).filter(p => ["دلار آمریکا","یورو","پوند","لیر ترکیه","درهم امارات"].includes(p.label_fa))
      .map(p => ({ id: "fiat:" + p.label_fa, label: p.label_fa, toman: Number(p.value) }));
    const usdToman = (fiatUnits.find(x => x.label === "دلار آمریکا") || {}).toman || 0;
    const cryptoUnits = (crypto || []).filter(p => Number(p.value) > 0 && usdToman > 0)
      .map(p => ({ id: "crypto:" + p.symbol, label: p.label_fa + " (" + p.symbol + ")", toman: Number(p.value) * usdToman }));
    window.JK_MARKET_UNITS = [{id:"toman",label:"تومان",toman:1}, ...fiatUnits, ...cryptoUnits];

    el.innerHTML =
      `<div class="rule"><span>تبدیل واحد مالی</span><span class="l"></span></div>
       <div class="money-converter">
         <div class="mc-field"><label>مقدار</label><input id="mc-amount" type="number" inputmode="decimal" min="0" step="any" value="1" oninput="convertMarketUnit()"></div>
         <div class="mc-field"><label>از</label><select id="mc-from" onchange="convertMarketUnit()"></select></div>
         <button class="mc-swap" onclick="swapMarketUnits()" aria-label="جابه‌جایی واحدها">⇄</button>
         <div class="mc-field"><label>به</label><select id="mc-to" onchange="convertMarketUnit()"></select></div>
         <div class="mc-result" id="mc-result">—</div>
       </div>` +
      (priceRows ? `<div class="rule"><span>ارز و طلا</span><span class="l"></span></div><div class="price-grid">${priceRows}</div>` : "") +
      (cryptoRows ? `<div class="rule" style="margin-top:26px"><span>رمزارزها</span><span class="l"></span></div><div class="price-grid crypto-grid">${cryptoRows}</div>` : "") +
      `<p class="muted" style="margin-top:14px">ارز و طلا: TGJU · رمزارزها: CoinGecko. تبدیل‌ها تقریبی و بر اساس همین آخرین نرخ‌های ذخیره‌شده‌اند.</p>`;
  setupMarketConverter();
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">پنداربازار بارگذاری نشد</div></div>`; }
}

function setupMarketConverter() {
  const units = window.JK_MARKET_UNITS || [], from = document.getElementById("mc-from"), to = document.getElementById("mc-to");
  if (!from || !to || !units.length) return;
  const opts = units.map(u => `<option value="${esc(u.id)}">${esc(u.label)}</option>`).join("");
  from.innerHTML = opts; to.innerHTML = opts;
  const usd = units.findIndex(u => u.label === "دلار آمریکا");
  from.selectedIndex = usd >= 0 ? usd : 0; to.selectedIndex = 0;
  convertMarketUnit();
}
function convertMarketUnit() {
  const units = window.JK_MARKET_UNITS || [], amount = Number(document.getElementById("mc-amount")?.value || 0);
  const from = units.find(u => u.id === document.getElementById("mc-from")?.value);
  const to = units.find(u => u.id === document.getElementById("mc-to")?.value);
  const out = document.getElementById("mc-result");
  if (!out || !from || !to || !Number.isFinite(amount) || !to.toman) return;
  const result = amount * from.toman / to.toman;
  const digits = result < 0.01 ? 8 : result < 1 ? 6 : result < 100 ? 4 : 2;
  out.innerHTML = `<b>${faN(amount.toLocaleString("en-US"))}</b> ${esc(from.label)} = <strong>${faN(result.toLocaleString("en-US",{maximumFractionDigits:digits}))}</strong> ${esc(to.label)}`;
}
function swapMarketUnits() {
  const a=document.getElementById("mc-from"), b=document.getElementById("mc-to"); if(!a||!b)return;
  const v=a.value; a.value=b.value; b.value=v; convertMarketUnit();
}

// weather + AirCheck-style air quality
function showWeather() { show("weather"); setTab("feed"); renderWeather(); setHash("#/weather"); }
const AQI_FA={good:"خوب",moderate:"قابل قبول",sensitive:"ناسالم برای گروه‌های حساس",unhealthy:"ناسالم","very-unhealthy":"بسیار ناسالم",hazardous:"خطرناک",unknown:"نامشخص"};
const POLLUTANT_FA={pm25:"PM2.5",pm10:"PM10",o3:"O₃",no2:"NO₂",so2:"SO₂",co:"CO"};
function _wxNum(v,suffix=""){return v===null||v===undefined||Number.isNaN(Number(v))?"—":faN(v)+suffix}
function _airBadge(c){
  if(c.aqi===null||c.aqi===undefined)return "";
  const est=c.air_estimated?" estimate":"";
  return `<span class="aqi-chip aqi-${esc(c.aqi_class||"unknown")}${est}"><b>AQI ${faN(c.aqi)}</b><span>${esc(c.aqi_label||AQI_FA[c.aqi_class]||"")}</span></span>`;
}
function _pollutants(c){
  const p=c.pollutants||{}, dom=new Set(c.dominant||[]);
  const rows=Object.entries(POLLUTANT_FA).map(([k,label])=>{
    const v=p[k], hit=dom.has(label);
    return `<div class="pollutant ${hit?"dominant":""}"><span>${label}</span><b>${v===null||v===undefined?"—":faN(v)}</b></div>`;
  }).join("");
  return `<div class="pollutants">${rows}</div>`;
}
function _airForecast(c){
  const rows=(c.air_forecast||[]).filter(x=>x&&x.aqi!==null&&x.aqi!==undefined);
  if(!rows.length)return "";
  return `<div class="air-forecast"><span>برآورد آینده</span>${rows.map(x=>`<em>+${faN(x.hours)}ساعت <b>AQI ${faN(x.aqi)}</b></em>`).join("")}</div>`;
}
async function renderHomeWeather() {
  const el = document.getElementById("home-weather");
  if (!el) return;
  try {
    const w = await getJSON(`${DATA}/weather.json?v=${Date.now()}`);
    if (!w || !w.length) return;
    el.innerHTML = w.slice(0, 4).map(c => `<div class="hp"><span class="hp-label">${c.icon || ""} ${esc(c.city_fa)}</span>
      <span class="hp-val">${_wxNum(c.temp,"°")}</span>
      <span class="hp-chg flat">${_wxNum(c.min,"°")} / ${_wxNum(c.max,"°")}${c.aqi!==undefined?` · AQI ${faN(c.aqi)}`:""}</span></div>`).join("")
      + `<button class="hp-more" onclick="showWeather()">هوا و آلودگی ›</button>`;
  } catch (e) {}
}
async function renderWeather() {
  const el = document.getElementById("weather");
  try {
    const w = await getJSON(`${DATA}/weather.json?v=${Date.now()}`);
    if (!w || !w.length) { el.innerHTML = `<div class="state"><div class="big">آب‌وهوا در دسترس نیست</div></div>`; return; }
    const polluted=w.filter(x=>Number.isFinite(Number(x.aqi))).sort((a,b)=>Number(b.aqi)-Number(a.aqi));
    const top=polluted.slice(0,3);
    const official=polluted.filter(x=>!x.air_estimated).length;
    const estimated=polluted.filter(x=>x.air_estimated).length;
    const overview=top.length?`<section class="air-overview">
      <div class="air-overview-head"><div><span class="press-kicker">کیفیت هوای فعلی</span><h2>آلوده‌ترین‌های این فهرست</h2></div><div class="air-source-count">${official?faN(official)+" شهر رسمی":""}${official&&estimated?" · ":""}${estimated?faN(estimated)+" شهر برآوردی":""}</div></div>
      <div class="air-rank">${top.map((c,i)=>`<div class="air-rank-row"><span class="air-rank-no">${faN(i+1)}</span><strong>${esc(c.city_fa)}</strong>${_airBadge(c)}</div>`).join("")}</div>
      <div class="aqi-legend"><span class="aqi-good">۰–۵۰ خوب</span><span class="aqi-moderate">۵۱–۱۰۰ قابل قبول</span><span class="aqi-sensitive">۱۰۱–۱۵۰ حساس</span><span class="aqi-unhealthy">۱۵۱–۲۰۰ ناسالم</span><span class="aqi-very-unhealthy">۲۰۱–۳۰۰ بسیار ناسالم</span><span class="aqi-hazardous">+۳۰۰ خطرناک</span></div>
    </section>`:"";
    const cards=w.map(c=>`<article class="wx wx-rich">
      <div class="wx-weather-row"><div class="wx-ic">${c.icon || "🌡️"}</div><div class="wx-weather-copy"><div class="wx-city">${esc(c.city_fa)}</div><div class="wx-cond">${esc(c.cond_fa || "")}</div></div><div class="wx-temp">${_wxNum(c.temp,"°")}</div></div>
      <div class="wx-mm"><span class="wx-min">کمینه ${_wxNum(c.min,"°")}</span><span class="wx-max">بیشینه ${_wxNum(c.max,"°")}</span></div>
      ${c.aqi!==undefined&&c.aqi!==null?`<div class="air-card-head">${_airBadge(c)}<span class="air-source ${c.air_estimated?"estimate":"official"}">${c.air_estimated?"برآورد مدل":"دادهٔ رسمی"}</span></div>
        ${(c.dominant||[]).length?`<div class="dominant-copy">آلایندهٔ غالب: <b>${esc((c.dominant||[]).join("، "))}</b></div>`:""}
        ${_pollutants(c)}
        ${_airForecast(c)}
        <div class="air-source-line">${esc(c.air_source_fa||"")}</div>`:`<div class="air-no-data">دادهٔ آلودگی در دسترس نیست</div>`}
    </article>`).join("");
    el.innerHTML = overview+`<div class="wx-grid wx-air-grid">${cards}</div>
      <aside class="weather-expert"><div><span class="weather-expert-kicker">کارشناس مرتبط</span><strong>محمد اصغری</strong><p>پیش‌بینی، تحلیل سامانه‌های بارشی، هشدارهای جوی و هواشناسی کشاورزی</p></div><button onclick="openFigure('asghari_weatherman')">صفحهٔ محمد اصغری ←</button></aside>
      <div class="weather-sources"><p><b>دما و شرایط جوی:</b> Open-Meteo.</p><p><b>آلودگی هوا:</b> ابتدا شبکهٔ ملی پایش کیفیت هوای سازمان حفاظت محیط‌زیست با همان endpointها و منطق منبعی که پروژهٔ متن‌باز AirCheck استفاده می‌کند. اگر دسترسی رسمی از سرور GitHub ممکن نباشد، Open-Meteo / Copernicus CAMS با برچسب «برآورد مدل» جایگزین می‌شود.</p><a href="https://github.com/ZethRise/AirCheck" target="_blank" rel="noopener">AirCheck روی GitHub ↗</a></div>`;
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">آب‌وهوا بارگذاری نشد</div></div>`; }
}
