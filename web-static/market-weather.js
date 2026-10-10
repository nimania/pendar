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
    const [prices, crypto, nabzesh] = await Promise.all([
      getJSON(`${DATA}/prices.json`).catch(() => []),
      getJSON(`${DATA}/crypto.json`).catch(() => []),
      getJSON(`${DATA}/market-nabzesh.json`).catch(() => null),
    ]);
    const richMarket = typeof marketNabzeshBoard === "function" ? marketNabzeshBoard(nabzesh) : "";

    const MARKET_ASSET_META={
      "دلار آمریکا":{icon:"🇺🇸",short:"دلار"},
      "یورو":{icon:"🇪🇺",short:"یورو"},
      "پوند":{icon:"🇬🇧",short:"پوند"},
      "لیر ترکیه":{icon:"🇹🇷",short:"لیر"},
      "درهم امارات":{icon:"🇦🇪",short:"درهم"},
      "سکه امامی":{icon:"🪙",short:"سکه امامی"},
      "نیم سکه":{icon:"◐",short:"نیم‌سکه"},
      "ربع سکه":{icon:"◔",short:"ربع‌سکه"},
      "طلای ۱۸ عیار":{icon:"◆",short:"طلای ۱۸"},
      "طلای 24 عیار":{icon:"◆",short:"طلای ۲۴"},
      "طلای ۲۴ عیار":{icon:"◆",short:"طلای ۲۴"}
    };
    const priority=["دلار آمریکا","سکه امامی","طلای ۱۸ عیار","یورو","درهم امارات","لیر ترکیه","پوند","نیم سکه","ربع سکه"];
    const ordered=(prices||[]).slice().sort((a,b)=>{
      const ai=priority.indexOf(a.label_fa),bi=priority.indexOf(b.label_fa);
      return (ai<0?999:ai)-(bi<0?999:bi);
    });
    const priceRows = ordered.map((p,i) => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      const meta=MARKET_ASSET_META[p.label_fa]||{icon:"◈",short:p.label_fa};
      const delta=Math.abs(Number(p.dp||0)),width=Math.min(100,Math.max(5,delta*12));
      return `<article class="market-asset ${i<5?"market-asset-primary":""}">
        <div class="market-asset-head"><span class="market-asset-icon">${meta.icon}</span><span><b>${esc(meta.short)}</b><small>${esc(p.label_fa)}</small></span></div>
        <div class="market-asset-value">${faN(grp(p.value))}<small>${esc(p.unit_fa||"")}</small></div>
        <div class="market-asset-change ${cls}"><span>${arrow} ${faN(delta)}٪</span><i><em style="width:${width}%"></em></i></div>
      </article>`;
    }).join("");

    const cryptoRows = (crypto || []).map(p => {
      const cls = p.dir === "up" ? "up" : p.dir === "down" ? "down" : "flat";
      const arrow = p.dir === "up" ? "▲" : p.dir === "down" ? "▼" : "—";
      const value = p.value >= 1000 ? grp(Math.round(p.value)) : Number(p.value).toLocaleString("en-US", {maximumFractionDigits: p.value < 1 ? 4 : 2});
      const icon={BTC:"₿",ETH:"Ξ",USDT:"₮",BNB:"B",SOL:"◎",XRP:"X"}[String(p.symbol||"").toUpperCase()]||"◈";
      return `<article class="market-crypto-card"><span class="market-crypto-icon">${icon}</span><div><b>${esc(p.label_fa)}</b><small>${esc(p.symbol||"")}</small></div><strong>$ ${faN(value)}</strong><span class="${cls}">${arrow} ${faN(Math.abs(p.dp||0))}٪</span></article>`;
    }).join("");

    const fiatUnits = (prices || []).filter(p => ["دلار آمریکا","یورو","پوند","لیر ترکیه","درهم امارات"].includes(p.label_fa))
      .map(p => ({ id: "fiat:" + p.label_fa, label: p.label_fa, toman: Number(p.value) }));
    const usdToman = (fiatUnits.find(x => x.label === "دلار آمریکا") || {}).toman || 0;
    const cryptoUnits = (crypto || []).filter(p => Number(p.value) > 0 && usdToman > 0)
      .map(p => ({ id: "crypto:" + p.symbol, label: p.label_fa + " (" + p.symbol + ")", toman: Number(p.value) * usdToman }));
    window.JK_MARKET_UNITS = [{id:"toman",label:"تومان",toman:1}, ...fiatUnits, ...cryptoUnits];
    if (richMarket) {
      window.JK_MARKET_UNITS = [{id:"toman",label:"تومان",toman:1}, ...pendarMarketSnapshot.rows
        .filter(p => ["currency","crypto"].includes(p.group) && p.quote === "IRT" && p.value > 0 && !p.is_stale)
        .map(p => ({id:p.ticker,label:p.label_fa,toman:p.value}))];
    }

    el.innerHTML = `<style>
      .market-hero{padding:4px 0 8px}.market-hero-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:6px 0 14px}.market-hero-head h1{font-family:"Noto Naskh Arabic",serif;font-size:clamp(30px,5vw,48px);margin:0}.market-hero-head p{margin:3px 0 0;color:var(--muted);font-size:.72rem}
      .market-assets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.market-asset{border:1px solid var(--line);border-radius:15px;background:var(--surface);padding:13px;min-width:0}.market-asset-primary{background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 8%,var(--surface)),var(--surface))}
      .market-asset-head{display:flex;align-items:center;gap:8px}.market-asset-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:var(--surface-2);font-size:19px}.market-asset-head span:last-child{min-width:0;display:flex;flex-direction:column}.market-asset-head b{font-size:.72rem}.market-asset-head small{font-size:.55rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .market-asset-value{font-size:1.05rem;font-weight:800;margin:12px 0 9px;white-space:nowrap}.market-asset-value small{font-size:.53rem;font-weight:500;color:var(--muted);margin-inline-start:4px}.market-asset-change{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px;font-size:.62rem}.market-asset-change i{height:3px;border-radius:99px;background:var(--line);overflow:hidden}.market-asset-change i em{display:block;height:100%;background:currentColor;border-radius:99px}
      .market-crypto-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}.market-crypto-card{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.market-crypto-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--surface-2);font-weight:800}.market-crypto-card div{display:flex;flex-direction:column;min-width:0}.market-crypto-card b{font-size:.66rem}.market-crypto-card small{font-size:.52rem;color:var(--muted)}.market-crypto-card strong{font-size:.7rem}.market-crypto-card>span:last-child{grid-column:3;font-size:.57rem}
      .market-tools{margin:20px 0 26px}.market-source-note{font-size:.61rem;color:var(--muted);margin:10px 0 26px}
      @media(max-width:980px){.market-assets{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.market-assets{grid-template-columns:repeat(2,minmax(0,1fr))}.market-hero-head{align-items:flex-start;flex-direction:column}.market-asset{padding:11px}}
    </style>
    <section class="market-hero">
      <div class="market-hero-head"><div><span class="press-kicker">پنداربازار</span><h1>بازار در یک نگاه</h1><p>ارز، طلا، سکه و سپس رادار صنعت غذا</p></div></div>
      ${richMarket || (priceRows?`<div class="market-assets">${priceRows}</div>`:"")}
    </section>
    <section class="market-tools">
      <div class="rule"><span>تبدیل واحد مالی</span><span class="l"></span></div>
      <div class="money-converter">
        <div class="mc-field"><label>مقدار</label><input id="mc-amount" type="number" inputmode="decimal" min="0" step="any" value="1" oninput="convertMarketUnit()"></div>
        <div class="mc-field"><label>از</label><select id="mc-from" onchange="convertMarketUnit()"></select></div>
        <button class="mc-swap" onclick="swapMarketUnits()" aria-label="جابه‌جایی واحدها">⇄</button>
        <div class="mc-field"><label>به</label><select id="mc-to" onchange="convertMarketUnit()"></select></div>
        <div class="mc-result" id="mc-result">—</div>
      </div>
    </section>
    ${!richMarket && cryptoRows?`<section><div class="rule"><span>رمزارزها</span><span class="l"></span></div><div class="market-crypto-strip">${cryptoRows}</div></section>`:""}
    <p class="market-source-note">${richMarket?"منبع: نبضش · قیمت‌های مرجع و زمان ثبت منابع؛ تبدیل مالی بر پایهٔ همین نرخ‌هاست.":"ارز و طلا: TGJU · رمزارزها: CoinGecko. تغییرات نمایش‌داده‌شده مطابق آخرین دادهٔ ذخیره‌شده‌اند."}</p>
    <div id="market-food"><p class="muted">در حال دریافت رادار بازار غذا…</p></div>`;

    setupMarketConverter();
    if (richMarket) selectMarketGroup(nabzesh.groups.find(g => nabzesh.rows.some(r => r.group === g.id)).id);
    renderMarketFood();
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

const MARKET_FOOD_LABELS={qsr_fast_food:'فست‌فود و سرویس سریع',fast_casual:'فست‌کژوال',restaurant_operations:'عملیات رستوران',menu_product_innovation:'نوآوری منو و محصول',restaurant_technology_ai:'فناوری رستوران و هوش مصنوعی',equipment_automation:'تجهیزات و اتوماسیون',food_cost_pricing:'هزینه غذا و قیمت‌گذاری',supply_chain:'زنجیره تأمین',food_safety:'ایمنی غذا',labor_management:'نیروی انسانی و مدیریت',franchising:'فرنچایز',delivery_drive_thru:'دلیوری و درایو‌ثرو',consumer_behavior:'رفتار مصرف‌کننده',marketing_branding:'بازاریابی و برندینگ',restaurant_design_decor:'طراحی و دکور رستوران',packaging_design:'بسته‌بندی',beverage:'نوشیدنی',food_manufacturing:'تولید صنایع غذایی',ingredients_rd:'مواد اولیه و تحقیق‌وتوسعه',retail_food:'خرده‌فروشی غذا',regulation:'قانون‌گذاری و مقررات',sustainability:'پایداری',restaurant_industry:'صنعت رستوران',food_industry:'صنعت غذا'};

const MARKET_FOOD_BASE='https://nimania.github.io/restaurant-intelligence/food-intel/';
let marketFoodCache;
function mfUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function mfLogo(b){const url=mfUrl(b.logo_url)||(MF_brandLogoSlugs[b.id]?'https://cdn.simpleicons.org/'+MF_brandLogoSlugs[b.id]:MF_brandLogoDomains[b.id]?'https://www.google.com/s2/favicons?domain='+encodeURIComponent(MF_brandLogoDomains[b.id])+'&sz=128':'');return `<span class="mf-logo"><span aria-hidden="true">${esc((b.fa||b.name||'?').slice(0,1))}</span>${url?`<img src="${esc(url)}" alt="لوگوی ${esc(b.fa||b.name||'برند')}" loading="lazy" onerror="this.remove()">`:''}</span>`}
function mfChart(rows){const values=Array(7).fill(0),end=new Date();end.setHours(0,0,0,0);for(const x of rows){const d=new Date(x.published_at);d.setHours(0,0,0,0);const age=Math.round((end-d)/86400000);if(age>=0&&age<7)values[6-age]++}const max=Math.max(1,...values);return `<svg class="mf-chart" viewBox="0 0 210 62" role="img" aria-label="تعداد خبرها در هفت روز، از قدیم به جدید: ${esc(values.join('، '))}"><path d="M 0 57 H 210" stroke="currentColor" opacity=".2"/>${values.map((v,i)=>`<rect x="${i*30+5}" y="${57-v/max*48}" width="20" height="${v/max*48}" rx="4" fill="currentColor" opacity="${.35+i*.1}"/>`).join('')}</svg><small>فعالیت خبری ۷روزه · قدیم ← جدید</small>`}
function mfDailyCounts(rows,days=7){const out=Array(days).fill(0),end=new Date();end.setHours(0,0,0,0);for(const x of rows){const d=new Date(x.published_at);d.setHours(0,0,0,0);const age=Math.round((end-d)/86400000);if(age>=0&&age<days)out[days-1-age]++}return out}
function mfSpark(rows){const v=mfDailyCounts(rows,7),max=Math.max(1,...v),pts=v.map((n,i)=>`${i*18},${30-(n/max)*24}`).join(" ");return `<svg class="mf-spark" viewBox="0 0 108 34" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${v.map((n,i)=>`<circle cx="${i*18}" cy="${30-(n/max)*24}" r="1.8" fill="currentColor"/>`).join("")}</svg>`}
function mfActivityChart(rows){const v=mfDailyCounts(rows,7),max=Math.max(1,...v);return `<div class="mf-activity-bars">${v.map((n,i)=>`<span title="${faN(n)} سیگنال"><i style="height:${Math.max(8,n/max*100)}%"></i><small>${faN(n)}</small></span>`).join("")}</div><div class="mf-axis"><span>۷ روز قبل</span><span>امروز</span></div>`}
function mfMover(rows){const v=mfDailyCounts(rows,7),recent=v.slice(4).reduce((a,b)=>a+b,0)/3,prior=v.slice(0,4).reduce((a,b)=>a+b,0)/4;if(!prior)return recent>0?100:0;return Math.round((recent-prior)/prior*100)}
function mfTopicBars(ranked,total){return `<div class="mf-topic-bars">${ranked.slice(0,7).map(t=>{const pct=total?Math.round(t.rows.length/total*100):0;return `<a href="${MARKET_FOOD_BASE}explore.html?category=${encodeURIComponent(t.id)}#feed" target="_blank" rel="noopener noreferrer"><span class="mf-topic-label"><b>${MF_categoryIcons[t.id]||"◉"} ${esc(MARKET_FOOD_LABELS[t.id])}</b><em>${faN(t.rows.length)}</em></span><i><span style="width:${Math.max(4,pct)}%"></span></i></a>`}).join("")}</div>`}
async function renderMarketFood() {
  const host=document.getElementById('market-food'); if(!host)return;
  const link=x=>MARKET_FOOD_BASE+'story.html?id='+encodeURIComponent(x.id);
  const empty='<p class="muted">در هفت روز اخیر دادهٔ کافی ثبت نشده است.</p>';
  try {
    const data=marketFoodCache || await (async()=>{const r=await fetch(MARKET_FOOD_BASE+'data/news.json',{signal:AbortSignal.timeout(15000),cache:'no-cache'});if(!r.ok)throw Error('food');return r.json()})();
    marketFoodCache=data;
    if(!host.isConnected)return;
    const now=Date.now(),day=86400000, seen=new Set();
    const rows=(data.items||[]).filter(x=>{
      const t=Date.parse(x.published_at),key=x.url||x.id;
      if(!x.title_fa||['retry','block'].includes(x.translation_quality?.status)||!Number.isFinite(t)||t>now||now-t>7*day||seen.has(key))return false;
      seen.add(key);return true;
    }).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));

    const topics=new Map(),brands=new Map(),sources=new Set();
    for(const x of rows){
      if(x.source?.id)sources.add(x.source.id);
      for(const c of new Set(x.categories||[])){
        if(!MARKET_FOOD_LABELS[c]||['food_industry','restaurant_industry'].includes(c))continue;
        const t=topics.get(c)||{id:c,rows:[],brands:new Set(),sources:new Set()};t.rows.push(x);
        for(const b of x.brands||[])if(b.id)t.brands.add(b.id);
        if(x.source?.id)t.sources.add(x.source.id);topics.set(c,t);
      }
      for(const b of x.brands||[]){if(!b.id)continue;const v=brands.get(b.id)||{...b,rows:[]};v.rows.push(x);brands.set(b.id,v);}
    }
    const ranked=[...topics.values()].sort((a,b)=>b.rows.length-a.rows.length);
    const brandRank=[...brands.values()].sort((a,b)=>b.rows.length-a.rows.length);
    const movers=brandRank.map(b=>({...b,_move:mfMover(b.rows)})).filter(b=>b.rows.length>=2).sort((a,b)=>b._move-a._move).slice(0,5);
    const market=x=>x.market==='turkey'||x.country==='TR'||x.geo?.primary_country?.code==='TR'||x.source?.market==='turkey'?'turkey':x.market==='iran'||x.country==='IR'||x.geo?.primary_country?.code==='IR'||x.source?.market==='iran'||(x.iran_relevance_score||0)>=70?'iran':'world';
    const regionCounts={iran:rows.filter(x=>market(x)==='iran').length,turkey:rows.filter(x=>market(x)==='turkey').length,world:rows.filter(x=>market(x)==='world').length};
    const section=(title,sub,content)=>`<section class="mf-section"><div class="mf-section-head"><div><h3>${title}</h3>${sub?`<p>${sub}</p>`:""}</div></div>${content}</section>`;
    const story=x=>`<a class="mf-story-card" href="${esc(link(x))}" target="_blank" rel="noopener noreferrer"><span class="mf-story-media">${mfUrl(x.image_url)?`<img src="${esc(mfUrl(x.image_url))}" alt="" loading="lazy" onerror="this.remove()">`:mfLogo((x.brands||[])[0]||{name:"خبر"})}</span><span class="mf-story-copy"><small>${esc(x.source?.name||'Food Intel')} · ${esc(new Date(x.published_at).toLocaleDateString('fa-IR'))}</small><strong>${esc(x.title_fa)}</strong><span>${(x.categories||[]).slice(0,2).map(c=>MARKET_FOOD_LABELS[c]?`<em>${esc(MARKET_FOOD_LABELS[c])}</em>`:"").join("")}</span></span></a>`;
    const lead=rows[0], topTopic=ranked[0];

    host.innerHTML=`<style>
      .mf-dashboard{margin-top:34px;border-top:1px solid var(--line);padding-top:26px}.mf-hero{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:18px;align-items:stretch;margin-bottom:14px}.mf-hero-main{border:1px solid var(--line);border-radius:20px;padding:22px;background:linear-gradient(145deg,color-mix(in srgb,#b97945 10%,var(--surface)),var(--surface))}.mf-eyebrow{font-size:.62rem;color:var(--accent);font-weight:800}.mf-hero h2{font-family:"Noto Naskh Arabic",serif;font-size:clamp(28px,4vw,42px);margin:4px 0 8px}.mf-hero p{color:var(--muted);line-height:1.9;margin:0 0 13px}.mf-hero-actions{display:flex;gap:8px;flex-wrap:wrap}.mf-hero-actions a{border:1px solid var(--line);border-radius:999px;padding:7px 11px;text-decoration:none;font-size:.64rem}.mf-hero-side{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mf-kpi{border:1px solid var(--line);border-radius:15px;padding:14px;background:var(--surface);display:flex;flex-direction:column;justify-content:center}.mf-kpi b{font-size:1.45rem}.mf-kpi span{font-size:.61rem;color:var(--muted)}.mf-kpi small{font-size:.53rem;color:var(--ink-faint);margin-top:3px}
      .mf-visual-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;margin-bottom:14px}.mf-chart-card{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:16px}.mf-chart-card h3,.mf-section-head h3{margin:0;font-size:.88rem}.mf-chart-card>p,.mf-section-head p{margin:3px 0 0;color:var(--muted);font-size:.62rem}.mf-activity-bars{height:170px;display:grid;grid-template-columns:repeat(7,1fr);align-items:end;gap:8px;padding-top:16px}.mf-activity-bars>span{height:100%;display:flex;flex-direction:column;justify-content:end;align-items:center;gap:5px}.mf-activity-bars i{width:min(34px,72%);display:block;border-radius:8px 8px 3px 3px;background:linear-gradient(to top,color-mix(in srgb,var(--accent) 68%,#8f5c39),var(--accent));min-height:8px}.mf-activity-bars small{font-size:.54rem;color:var(--muted)}.mf-axis{display:flex;justify-content:space-between;color:var(--ink-faint);font-size:.52rem;margin-top:6px}
      .mf-topic-bars{display:flex;flex-direction:column;gap:9px;margin-top:15px}.mf-topic-bars a{text-decoration:none;color:inherit}.mf-topic-label{display:flex;justify-content:space-between;gap:8px;font-size:.61rem;margin-bottom:4px}.mf-topic-label b{font-weight:650}.mf-topic-label em{font-style:normal;color:var(--muted)}.mf-topic-bars i{height:6px;border-radius:99px;background:var(--surface-2);display:block;overflow:hidden}.mf-topic-bars i span{height:100%;display:block;border-radius:99px;background:var(--accent)}
      .mf-section{margin:22px 0}.mf-section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:10px}.mf-brand-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.mf-brand-card{border:1px solid var(--line);border-radius:15px;background:var(--surface);padding:12px;text-decoration:none;color:inherit;min-width:0;display:flex;flex-direction:column;gap:7px}.mf-brand-card:hover,.mf-mover:hover,.mf-story-card:hover{border-color:var(--accent)}.mf-brand-top{display:flex;align-items:center;gap:8px}.mf-logo{position:relative;display:inline-grid;place-items:center;width:46px;height:46px;background:#fff;color:#634432;border-radius:12px;font-size:22px;flex-shrink:0;border:1px solid #0001}.mf-logo img{position:absolute;width:36px;height:36px;object-fit:contain;background:#fff}.mf-brand-name{min-width:0}.mf-brand-name b{display:block;font-size:.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mf-brand-name small{font-size:.52rem;color:var(--muted)}.mf-spark{width:100%;height:34px;color:var(--accent);overflow:visible}.mf-brand-headline{font-size:.57rem;color:var(--muted);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .mf-movers{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.mf-mover{border:1px solid var(--line);border-radius:13px;padding:10px;background:var(--surface);display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit}.mf-mover .mf-logo{width:38px;height:38px;border-radius:10px}.mf-mover .mf-logo img{width:30px;height:30px}.mf-mover-copy{min-width:0;flex:1}.mf-mover-copy b{font-size:.62rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mf-mover-copy small{font-size:.52rem;color:var(--muted)}.mf-move{font-size:.66rem;font-weight:800}.mf-move.up{color:#258a61}.mf-move.down{color:#b33b35}
      .mf-story-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.mf-story-card{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column}.mf-story-media{aspect-ratio:16/9;background:var(--surface-2);display:grid;place-items:center;overflow:hidden}.mf-story-media>img{width:100%;height:100%;object-fit:cover}.mf-story-copy{padding:11px 12px}.mf-story-copy>small{display:block;font-size:.52rem;color:var(--muted);margin-bottom:5px}.mf-story-copy strong{display:block;font-size:.7rem;line-height:1.75}.mf-story-copy>span{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}.mf-story-copy em{font-style:normal;font-size:.5rem;background:var(--surface-2);border-radius:999px;padding:3px 6px}
      .mf-regions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.mf-region-card{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:13px}.mf-region-card b{font-size:1.2rem;display:block}.mf-region-card span{font-size:.61rem;color:var(--muted)}.mf-note{font-size:.58rem;color:var(--ink-faint);line-height:1.8;margin-top:18px}
      @media(max-width:980px){.mf-brand-grid{grid-template-columns:repeat(3,1fr)}.mf-movers{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.mf-hero,.mf-visual-grid{grid-template-columns:1fr}.mf-brand-grid{grid-template-columns:repeat(2,1fr)}.mf-movers{grid-template-columns:repeat(2,1fr)}.mf-story-grid{grid-template-columns:1fr}.mf-regions{grid-template-columns:1fr 1fr}}
    </style>
    <div class="mf-dashboard">
      <section class="mf-hero">
        <div class="mf-hero-main">
          <span class="mf-eyebrow">FOOD INTELLIGENCE · ۷ روز اخیر</span>
          <h2>بازار غذا</h2>
          <p>${topTopic?`پررنگ‌ترین موضوع این هفته «${esc(MARKET_FOOD_LABELS[topTopic.id])}» بوده و ${faN(topTopic.rows.length)} سیگنال برای آن ثبت شده است.`:"رادار خبری صنعت غذا، رستوران، برندها، قیمت‌گذاری و فناوری."}</p>
          <div class="mf-hero-actions"><a href="${MARKET_FOOD_BASE}" target="_blank" rel="noopener noreferrer">رادار کامل Food Intel ↗</a>${topTopic?`<a href="${MARKET_FOOD_BASE}explore.html?category=${encodeURIComponent(topTopic.id)}#feed" target="_blank" rel="noopener noreferrer">موضوع داغ: ${esc(MARKET_FOOD_LABELS[topTopic.id])}</a>`:""}</div>
        </div>
        <div class="mf-hero-side">
          <div class="mf-kpi"><b>${faN(rows.length)}</b><span>سیگنال خبری</span><small>۷ روز اخیر</small></div>
          <div class="mf-kpi"><b>${faN(brands.size)}</b><span>برند رصدشده</span><small>دارای اشارهٔ خبری</small></div>
          <div class="mf-kpi"><b>${faN(topics.size)}</b><span>موضوع فعال</span><small>در طبقه‌بندی صنعت</small></div>
          <div class="mf-kpi"><b>${faN(sources.size)}</b><span>منبع خبری</span><small>در این ویترین</small></div>
        </div>
      </section>

      <div class="mf-visual-grid">
        <section class="mf-chart-card"><h3>شدت فعالیت بازار غذا</h3><p>تعداد سیگنال‌های قابل انتشار در هر روز</p>${mfActivityChart(rows)}</section>
        <section class="mf-chart-card"><h3>موضوعات داغ</h3><p>سهم نسبی موضوع‌ها از کل سیگنال‌ها</p>${mfTopicBars(ranked,rows.length)}</section>
      </div>

      ${section('برندهای داغ','بیشترین تعداد اشاره در رادار خبری',`<div class="mf-brand-grid">${brandRank.slice(0,12).map(b=>`<a class="mf-brand-card" href="${MARKET_FOOD_BASE}brand.html?id=${encodeURIComponent(b.id)}" target="_blank" rel="noopener noreferrer"><div class="mf-brand-top">${mfLogo(b)}<span class="mf-brand-name"><b>${esc(b.fa||b.name||b.id)}</b><small>${faN(b.rows.length)} اشاره</small></span></div>${mfSpark(b.rows)}<span class="mf-brand-headline">${esc(b.rows[0]?.title_fa||"")}</span></a>`).join("")||empty}</div>`)}

      ${section('Top Movers','برندهایی که نرخ اشاره به آن‌ها در سه روز اخیر نسبت به چهار روز قبل بیشتر شده است',`<div class="mf-movers">${movers.map(b=>`<a class="mf-mover" href="${MARKET_FOOD_BASE}brand.html?id=${encodeURIComponent(b.id)}" target="_blank" rel="noopener noreferrer">${mfLogo(b)}<span class="mf-mover-copy"><b>${esc(b.fa||b.name||b.id)}</b><small>${faN(b.rows.length)} اشاره</small></span><span class="mf-move ${b._move>=0?"up":"down"}">${b._move>=0?"▲":"▼"} ${faN(Math.abs(b._move))}٪</span></a>`).join("")||empty}</div>`)}

      ${section('تازه‌ترین اتفاقات','خبرهای تازه با تصویر، منبع و موضوع',`<div class="mf-story-grid">${rows.slice(0,9).map(story).join("")||empty}</div>`)}

      ${section('نقشهٔ جغرافیایی رادار','توزیع سیگنال‌های این ویترین بر اساس بازار هدف',`<div class="mf-regions"><div class="mf-region-card"><b>${faN(regionCounts.iran)}</b><span>ایران</span></div><div class="mf-region-card"><b>${faN(regionCounts.turkey)}</b><span>ترکیه</span></div><div class="mf-region-card"><b>${faN(regionCounts.world)}</b><span>جهان</span></div></div>`)}

      ${lead?section('آخرین سیگنال','تازه‌ترین مورد ثبت‌شده در Food Intel',story(lead)):""}
      <p class="mf-note">این بخش شاخص فروش یا سهم بازار نیست؛ یک رادار خبری است. اعداد بر پایهٔ تعداد خبرها و اشاره‌های قابل انتشار در Food Intel طی هفت روز اخیر محاسبه می‌شوند. «Top Movers» تغییر نرخ اشارهٔ خبری را نشان می‌دهد، نه رشد فروش.</p>
    </div>`;
  } catch(e) {
    if(host.isConnected)host.innerHTML=`<div class="mf-dashboard"><div class="mf-hero-main"><h2>بازار غذا</h2><p class="muted">داده‌های Food Intel فعلاً دریافت نشد.</p><button onclick="renderMarketFood()">تلاش دوباره</button> <a href="${MARKET_FOOD_BASE}" target="_blank" rel="noopener noreferrer">مشاهدهٔ Food Intel ↗</a></div></div>`;
  }
}
const MF_brandLogoSlugs={mcdonalds:'mcdonalds',starbucks:'starbucks',coca_cola:'cocacola',pepsico:'pepsi',kfc:'kfc',taco_bell:'tacobell',pizza_hut:'pizzahut',burger_king:'burgerking',wendys:'wendys',chipotle:'chipotle',doordash:'doordash',uber_eats:'ubereats',dominos:'dominos',sweetgreen:'sweetgreen',subway:'subway',chickfila:'chickfila',popeyes:'popeyes',dunkin:'dunkin',wingstop:'wingstop',grubhub:'grubhub',toast:'toast',nestle:'nestle',kraft_heinz:'kraftheinz',general_mills:'generalmills'};

const MF_brandLogoDomains={kalleh:'kalleh.com',solico:'solico-group.com',mihan_dairy:'mihan-food.com',snappfood:'snappfood.ir',sunich:'sunich.org',mahram:'mahramco.com',mazmaz:'mazmazgroup.com'};

const MF_categoryIcons={qsr_fast_food:'🍔',fast_casual:'🥗',restaurant_operations:'🍽️',menu_product_innovation:'🧪',restaurant_technology_ai:'✦',equipment_automation:'⚙️',food_cost_pricing:'₿',supply_chain:'🚚',food_safety:'🛡️',labor_management:'👥',franchising:'◫',delivery_drive_thru:'🛵',consumer_behavior:'◉',marketing_branding:'✺',restaurant_design_decor:'◈',packaging_design:'📦',beverage:'🥤',food_manufacturing:'🏭',ingredients_rd:'🌾',retail_food:'🛒',regulation:'§',sustainability:'🌱',restaurant_industry:'🍴',food_industry:'◌'};
