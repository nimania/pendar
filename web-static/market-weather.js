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
      (priceRows ? `<div class="rule"><span>ارز و طلا</span><span class="l"></span></div><div class="price-grid">${priceRows}</div>` : "") +
      `<div class="rule"><span>تبدیل واحد مالی</span><span class="l"></span></div>
       <div class="money-converter">
         <div class="mc-field"><label>مقدار</label><input id="mc-amount" type="number" inputmode="decimal" min="0" step="any" value="1" oninput="convertMarketUnit()"></div>
         <div class="mc-field"><label>از</label><select id="mc-from" onchange="convertMarketUnit()"></select></div>
         <button class="mc-swap" onclick="swapMarketUnits()" aria-label="جابه‌جایی واحدها">⇄</button>
         <div class="mc-field"><label>به</label><select id="mc-to" onchange="convertMarketUnit()"></select></div>
         <div class="mc-result" id="mc-result">—</div>
       </div>` +
      (cryptoRows ? `<div class="rule" style="margin-top:26px"><span>رمزارزها</span><span class="l"></span></div><div class="price-grid crypto-grid">${cryptoRows}</div>` : "") +
      `<p class="muted" style="margin-top:14px">ارز و طلا: TGJU · رمزارزها: CoinGecko. تبدیل‌ها تقریبی و بر اساس همین آخرین نرخ‌های ذخیره‌شده‌اند.</p><div id="market-food"><p class="muted">در حال دریافت نبض بازار غذا…</p></div>`;
  setupMarketConverter();
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
    const topics=new Map(),brands=new Map();
    for(const x of rows){
      for(const c of new Set(x.categories||[])){
        if(!MARKET_FOOD_LABELS[c]||['food_industry','restaurant_industry'].includes(c))continue;
        const t=topics.get(c)||{id:c,rows:[],brands:new Set(),sources:new Set()};t.rows.push(x);
        for(const b of x.brands||[])if(b.id)t.brands.add(b.id);
        if(x.source?.id)t.sources.add(x.source.id);topics.set(c,t);
      }
      for(const b of x.brands||[]){if(!b.id)continue;const v=brands.get(b.id)||{...b,rows:[]};v.rows.push(x);brands.set(b.id,v);}
    }
    const ranked=[...topics.values()].sort((a,b)=>b.rows.length-a.rows.length);
    const section=(title,content)=>`<section class="mf-section"><div class="rule"><span>${title}</span><span class="l"></span></div>${content}</section>`;
    const story=x=>`<a class="mf-story" href="${esc(link(x))}" target="_blank" rel="noopener noreferrer">${mfUrl(x.image_url)?`<img class="mf-thumb" src="${esc(mfUrl(x.image_url))}" alt="" loading="lazy" onerror="this.remove()">`:mfLogo((x.brands||[])[0]||{name:"خبر"})}<strong>${esc(x.title_fa)}</strong><small>${esc(x.source?.name||'Food Intel')} · ${esc(new Date(x.published_at).toLocaleDateString('fa-IR'))}</small></a>`;
    const market=x=>x.market==='turkey'||x.country==='TR'||x.geo?.primary_country?.code==='TR'||x.source?.market==='turkey'?'turkey':x.market==='iran'||x.country==='IR'||x.geo?.primary_country?.code==='IR'||x.source?.market==='iran'||(x.iran_relevance_score||0)>=70?'iran':'world';
    host.innerHTML=`<style>
      .mf-logo{position:relative;display:inline-grid;place-items:center;width:58px;height:58px;background:#fff;color:#634432;border-radius:14px;font-size:28px;flex-shrink:0}.mf-logo img{position:absolute;width:44px;height:44px;object-fit:contain;background:#fff}.mf-chart{width:100%;height:64px;color:#bc7946;display:block}.mf-topic-icon{font-size:36px;display:block;margin-bottom:12px}.mf-thumb{width:86px;height:68px;object-fit:cover;float:right;margin:0 0 8px 12px;border-radius:9px}.mf-story{display:flow-root!important}.mf-story .mf-logo{float:right;margin:0 0 8px 12px}.mf-card{background:linear-gradient(135deg,#b8753212,transparent)}.mf-brand:hover,.mf-card:hover{border-color:#ba7949}.mf-intro{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:22px 0}.mf-intro h2{margin:0 0 8px}.mf-intro p,.mf-section p{line-height:1.9}.mf-intro small,.mf-story small,.mf-brand small{display:block;opacity:.65;font-size:12px}.mf-chips{display:flex;flex-wrap:wrap;gap:10px}.mf-chips a{border:1px solid currentColor;border-radius:24px;padding:8px 14px;text-decoration:none}.mf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.mf-card,.mf-brand,.mf-region{padding:18px;border:1px solid #8884;border-radius:14px}.mf-card h3{margin:0 0 10px}.mf-card a{font-size:12px}.mf-brands{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.mf-brand{text-decoration:none;display:flex;flex-direction:column;gap:10px}.mf-brand b{font-size:17px}.mf-region-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.mf-story{display:block;padding:14px 0;text-decoration:none;border-bottom:1px solid #8883}.mf-story strong{line-height:1.9;display:block}.mf-section{margin-bottom:25px}.mf-note{font-size:12px;opacity:.7;line-height:1.9}@media(max-width:760px){.mf-grid{grid-template-columns:1fr}.mf-brands{grid-template-columns:repeat(2,minmax(0,1fr))}.mf-region-grid{grid-template-columns:1fr}.mf-intro{align-items:start;flex-direction:column}}
    </style><div class="mf-intro"><div><h2>نبض بازار غذا</h2><p class="muted">چه موضوع‌هایی خبرساز شده‌اند و کدام برندها در حرکت‌اند؟</p><small>آخرین پایش: ${esc(data.generated_at?new Date(data.generated_at).toLocaleString('fa-IR'):'نامشخص')}${now-Date.parse(data.generated_at)>2*day?' · داده‌ها نیاز به به‌روزرسانی دارند':''}</small></div><a href="${MARKET_FOOD_BASE}" target="_blank" rel="noopener noreferrer">رادار کامل Food Intel ↗</a></div>`+
    section('نبض بازار',`<div class="mf-chips">${ranked.slice(0,6).map(t=>`<a href="${MARKET_FOOD_BASE}explore.html?category=${encodeURIComponent(t.id)}#feed" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">${MF_categoryIcons[t.id]||"◉"}</span> ${esc(MARKET_FOOD_LABELS[t.id])} · ${faN(t.rows.length)} اشاره</a>`).join('')||empty}</div>`)+
    section('سیگنال بازار',`<div class="mf-grid">${ranked.filter(t=>t.sources.size>=2).slice(0,3).map(t=>`<article class="mf-card"><span class="mf-topic-icon" aria-hidden="true">${MF_categoryIcons[t.id]||"◉"}</span><h3>${esc(MARKET_FOOD_LABELS[t.id])} در کانون توجه</h3>${mfChart(t.rows)}<p>در هفت روز اخیر ${faN(t.rows.length)} خبر از ${faN(t.sources.size)} منبع${t.brands.size?' با اشاره به '+faN(t.brands.size)+' برند':''} ثبت شده است.</p>${story(t.rows[0])}<a href="${MARKET_FOOD_BASE}explore.html?category=${encodeURIComponent(t.id)}#feed" target="_blank" rel="noopener noreferrer">شواهد این سیگنال ↗</a></article>`).join('')||empty}</div>`)+
    section('برندهای در حرکت',`<div class="mf-brands">${[...brands.values()].sort((a,b)=>b.rows.length-a.rows.length).slice(0,6).map(b=>`<a class="mf-brand" href="${MARKET_FOOD_BASE}brand.html?id=${encodeURIComponent(b.id)}" target="_blank" rel="noopener noreferrer">${mfLogo(b)}<b>${esc(b.fa||b.name||b.id)}</b>${mfChart(b.rows)}<small>${faN(b.rows.length)} اشاره در هفت روز</small><span>${esc(b.rows[0].title_fa)}</span></a>`).join('')||empty}</div>`)+
    `<div class="mf-region-grid">${[['iran','بازار ایران'],['turkey','آن‌طرف مرز · ترکیه']].map(([id,title])=>`<div class="mf-region">${section(title,rows.filter(x=>market(x)===id).slice(0,3).map(story).join('')||empty)}<a href="${MARKET_FOOD_BASE}${id}.html" target="_blank" rel="noopener noreferrer">همهٔ خبرهای ${id==='iran'?'ایران':'ترکیه'} ↗</a></div>`).join('')}</div><p class="mf-note">مبنای این ویترین، خبرهای فارسیِ قابل انتشار در هفت روز گذشته و شمارش اشاره‌ها در منابع Food Intel است؛ شاخص فروش یا رشد واقعی بازار نیست. سیگنال‌ها خلاصهٔ آماری موضوعات چندمنبعی‌اند.</p>`;
  } catch(e) {
    if(host.isConnected)host.innerHTML=`<div class="mf-intro"><div><h2>نبض بازار غذا</h2><p class="muted">داده‌های رادار غذا فعلاً دریافت نشد.</p><button onclick="renderMarketFood()">تلاش دوباره</button></div><a href="${MARKET_FOOD_BASE}" target="_blank" rel="noopener noreferrer">مشاهدهٔ Food Intel ↗</a></div>`;
  }
}

const MF_brandLogoSlugs={mcdonalds:'mcdonalds',starbucks:'starbucks',coca_cola:'cocacola',pepsico:'pepsi',kfc:'kfc',taco_bell:'tacobell',pizza_hut:'pizzahut',burger_king:'burgerking',wendys:'wendys',chipotle:'chipotle',doordash:'doordash',uber_eats:'ubereats',dominos:'dominos',sweetgreen:'sweetgreen',subway:'subway',chickfila:'chickfila',popeyes:'popeyes',dunkin:'dunkin',wingstop:'wingstop',grubhub:'grubhub',toast:'toast',nestle:'nestle',kraft_heinz:'kraftheinz',general_mills:'generalmills'};

const MF_brandLogoDomains={kalleh:'kalleh.com',solico:'solico-group.com',mihan_dairy:'mihan-food.com',snappfood:'snappfood.ir',sunich:'sunich.org',mahram:'mahramco.com',mazmaz:'mazmazgroup.com'};

const MF_categoryIcons={qsr_fast_food:'🍔',fast_casual:'🥗',restaurant_operations:'🍽️',menu_product_innovation:'🧪',restaurant_technology_ai:'✦',equipment_automation:'⚙️',food_cost_pricing:'₿',supply_chain:'🚚',food_safety:'🛡️',labor_management:'👥',franchising:'◫',delivery_drive_thru:'🛵',consumer_behavior:'◉',marketing_branding:'✺',restaurant_design_decor:'◈',packaging_design:'📦',beverage:'🥤',food_manufacturing:'🏭',ingredients_rd:'🌾',retail_food:'🛒',regulation:'§',sustainability:'🌱',restaurant_industry:'🍴',food_industry:'◌'};
