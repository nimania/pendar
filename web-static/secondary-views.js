/* Pendar — secondary views: trends (بورس اخبار), fact-checks, topics and
   the FAQ. Extracted from app.js: renderTrends (+ _trendsLoaded), fcCard,
   renderFactchecks, setFactTab, renderFaq, renderTopics. Loaded as a classic
   script BEFORE app.js; the show* wrappers in app.js (showTrends,
   showFactchecks, showTopics, showFaq) call these at runtime, as does the
   router. Uses app.js/other-module helpers (ALL, groupedFeed, svgSpark,
   openTrendDossier, followBtn, grp now in core.js) at runtime. No behavior
   change. */

/* ---- بورس اخبار ---- */
let _trendsLoaded = false;
async function renderTrends() {
  renderEventTrends();
  if (_trendsLoaded) return;
  const el = document.getElementById("trends");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const [t, st, ents] = await Promise.all([
      getJSON(`${DATA}/trends.json`),
      getJSON(`${DATA}/stats.json`).catch(() => null),
      getJSON(`${DATA}/entities.json`).catch(() => []),
    ]);
    const peopleChips = (ents || []).slice(0, 24).map(x =>
      `<span class="person-chip" data-slug="${esc(x.slug)}" onclick="openEntity(this.dataset.slug)">${esc(x.name_fa)} <span class="chip-n">${faN(x.count)}</span></span>`).join("");
    const peopleSection = peopleChips
      ? `<div class="rule" style="margin-top:22px"><span>چهره‌ها در خبرها</span><span class="l"></span></div>
         <div class="people-strip">${peopleChips}</div>` : "";
    const topics = (t.topics || []);
    const g = t.google || {};
    const googleOn = Object.keys(g).length > 0;
    const rows = topics.map(tp => {
      const series = tp.series || [];
      const cmp = g[tp.slug];
      const chart = cmp
        ? `<div class="tp-chart cmp">${svgCompare(series, cmp.points.map(p => p.v))}</div>
           <div class="cmp-legend"><span class="lg a">جان‌کلام</span><span class="lg b">گوگل ترندز</span></div>`
        : `<div class="tp-chart">${svgSpark(series, { w: 150, h: 34 })}</div>`;
      return `<button class="tp-row" onclick="openTrendDossier('${tp.slug}')">
        <div class="tp-head"><span class="tp-name">${esc(tp.name_fa)}</span>${growthTag(tp.growth)}
          <span class="tp-n">${faN(tp.story_count)} خبر · هفته: ${faN(tp.last7 == null ? tp.story_count : tp.last7)}</span></div>
        ${chart}</button>`;
    }).join("");
    const hot = (t.hottest || []).map(h => `<div class="ticker" onclick="openStory('${h.id}')" style="cursor:pointer">
      <span class="t-name">${esc(h.headline_fa)}<span class="t-cat">${CAT_FA[h.category] || ""}</span></span>
      <span class="t-val">${faN(h.source_count)}</span>
      <span class="t-chg tx-up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>منبع</span></div>`).join("");
    const statsSection = st ? `<div class="rule" style="margin-top:2px"><span>نبض خبری</span><span class="l"></span></div>${statsBlock(st)}` : "";
    el.innerHTML = `
      ${statsSection}
      <div class="tx-hero"><span class="val">${faN(t.story_total || 0)}</span><span class="lbl">خبرِ فعال روی تخته</span>
        <span class="spacer" style="flex:1"></span><span class="lbl">${faN(topics.length)} موضوع فعال</span></div>
      ${peopleSection}
      <div class="rule"><span>رشدِ موضوع‌ها <span class="n">۱۴ روزِ اخیر</span></span><span class="l"></span></div>
      <div class="tp-board">${rows || '<p class="muted">—</p>'}</div>
      ${googleOn ? '' : '<p class="muted" style="margin:8px 0 0">مقایسه با گوگل ترندز فعلاً در دسترس نیست (آزمایشی).</p>'}
      <div class="rule" style="margin-top:26px"><span>پرپوشش‌ترین خبرها</span><span class="l"></span></div>
      <div class="tickers">${hot || '<p class="muted">—</p>'}</div>
      <p class="muted" style="margin-top:18px">«رشد» = مقایسهٔ خبرهای این هفته با هفتهٔ پیش. «پوشش» = چند منبعِ مستقل یک خبر را گفته‌اند.</p>`;
    _trendsLoaded = true;
  } catch (e) {
    el.innerHTML = `<div class="state"><div class="big">بورس اخبار بارگذاری نشد</div></div>`;
  }
}

/* ---- فکت — hub with sub-tabs: needs-verification / disagreement / Factnameh ---- */
function fcCard(f) {
  return `<a class="card fc-card" href="${f.url}" target="_blank" rel="noopener">
    <div class="meta"><span class="chip">فکت‌نامه</span><span class="dot"></span><span class="muted">${esc((f.published || "").slice(0, 10))}</span>
      <span class="ext" style="margin-inline-start:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg></span></div>
    <h2>${esc(f.title)}</h2>${f.summary ? `<p class="kalam">${esc(f.summary)}</p>` : ""}</a>`;
}
let _factData = { needs: [], disp: [], fn: [] };
async function renderFactchecks() {
  const el = document.getElementById("factchecks");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const fn = await getJSON(`${DATA}/factchecks.json`).catch(() => []);
    const needs = ALL.filter(s => s.credibility && s.credibility.needs_verification);
    const disp = ALL.filter(s => s.credibility && (s.credibility.disagreements || 0) > 0);
    _factData = { needs, disp, fn };
    const tabs = [["needs", "نیازمندِ راستی‌آزمایی", needs.length],
                  ["disp", "اختلافِ منابع", disp.length],
                  ["fn", "فکت‌نامه", fn.length]];
    const first = (tabs.find(t => t[2] > 0) || tabs[0])[0];
    el.innerHTML = `<div class="fact-note">این سنجه‌ها <b>خودکار</b>ند و از روی منابعِ هر خبر ساخته می‌شوند — نه حکمِ نهایی. راستی‌آزماییِ قطعی کارِ فکت‌نامه است.</div>
      <div class="imp-filter" id="fact-tabs">${tabs.map(t => `<button class="fchip" data-k="${t[0]}" onclick="setFactTab('${t[0]}')">${t[1]}${t[2] ? ` <span class="chip-n">${faN(t[2])}</span>` : ""}</button>`).join("")}</div>
      <div id="fact-body"></div>`;
    setFactTab(first);
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">بارگذاری نشد</div></div>`; }
}
function setFactTab(k) {
  document.querySelectorAll("#fact-tabs .fchip").forEach(c => c.classList.toggle("on", c.dataset.k === k));
  const d = _factData;
  const b = document.getElementById("fact-body");
  const empty = `<div class="state"><div class="big">موردی نیست</div></div>`;
  if (k === "needs")
    b.innerHTML = d.needs.length ? `<p class="muted" style="margin:0 0 12px">خبرهای تک‌منبع که هنوز منبعِ مستقلِ دیگری تأییدشان نکرده.</p><div class="feed">${d.needs.map(feedCard).join("")}</div>` : empty;
  else if (k === "disp")
    b.innerHTML = d.disp.length ? `<p class="muted" style="margin:0 0 12px">خبرهایی که منابع در جزئیاتشان با هم اختلاف دارند.</p><div class="feed">${d.disp.map(feedCard).join("")}</div>` : empty;
  else
    b.innerHTML = d.fn.length ? `<p class="muted" style="margin:0 0 12px">راستی‌آزماییِ مستقل و حرفه‌ای (شریکِ برنامهٔ متا). روی هر مورد بزن.</p><div class="feed">${d.fn.map(fcCard).join("")}</div>` : empty;
}

/* ---- راهنما / FAQ ---- */
let _faqLoaded = false;
const FAQ = [
  ["خبرها از کجا می‌آیند؟",
    "پندار به‌طور خودکار از فیدِ (RSS) ده‌ها خبرگزاری می‌خواند: منابعِ جهانی (رویترز، AP، بی‌بی‌سی، گاردین، الجزیره)، منابعِ داخلیِ فارسی (ایرنا، ایسنا، تسنیم) و منابعِ فارسیِ برون‌مرزی (بی‌بی‌سی فارسی، ایران اینترنشنال، رادیو فردا، دویچه‌وله). هدف این است که هم روایتِ داخلی و هم روایتِ خارجی کنارِ هم دیده شوند."],
  ["چطور از چند منبع یک خبر می‌سازد؟",
    "سیستم خبرهایی که دربارهٔ یک رویدادِ واحد هستند را «خوشه‌بندی» می‌کند: عنوان‌ها و متن‌ها را مقایسه می‌کند و گزارش‌های مربوط به یک اتفاق را در یک خبرِ واحد کنار هم می‌گذارد. برای همین زیرِ هر خبر می‌بینی «۳ منبع» یا «۵ منبع»."],
  ["منظور از تفکیکِ «واقعیت / دیدگاه / جان‌کلام / ابهام» چیست؟",
    "هر خبر چهار لایه دارد که عمداً از هم جدا نگه داشته شده‌اند: <b>واقعیت</b> (آنچه معلوم است)، <b>دیدگاهِ هر منبع</b> (هر خبرگزاری چه می‌گوید، جدا از بقیه)، <b>جان‌کلام</b> (خلاصهٔ کوتاهِ ترکیبی)، و <b>ابهام</b> (آنچه هنوز روشن نیست). این‌طوری تحلیل با واقعیت قاطی نمی‌شود."],
  ["برچسبِ «مهم / بسیار مهم» چطور حساب می‌شود؟",
    "یک امتیازِ شفاف از ۱۰۰ که از پنج عامل ساخته می‌شود: تعدادِ منابعِ مستقل (تا ۳۵)، اعتبارِ منابع (تا ۲۰)، سرعتِ پوشش/تعدادِ گزارش‌ها (تا ۱۵)، تازگیِ خبر (تا ۲۰)، و میزانِ ارتباط با ایران (تا ۱۰). امتیازِ ۷۵ به بالا «بسیار مهم»، ۵۰ تا ۷۵ «مهم»، و پایین‌تر «متوسط» است. هیچ‌چیزِ آن جعبهٔ سیاه نیست."],
  ["«اعتبارِ خبر» با فکت‌نامه چه فرقی دارد؟",
    "«اعتبارِ خبر» یک سنجهٔ <b>خودکارِ</b> ماست که فقط به دو چیز نگاه می‌کند: چند منبعِ مستقل خبر را گفته‌اند و آیا با هم توافق دارند یا اختلاف. خبرِ تک‌منبعی برچسبِ «نیازمند راستی‌آزمایی» می‌گیرد. این «حکمِ درست/غلط» نیست — فقط نشان می‌دهد یک ادعا چقدر پشتوانهٔ چندمنبعی دارد. راستی‌آزماییِ واقعی و انسانی کارِ نهادهایی مثلِ فکت‌نامه است."],
  ["فکت‌نامه چیست و کِی برچسبش را می‌بینم؟",
    "فکت‌نامه یک نهادِ مستقل و حرفه‌ایِ راستی‌آزمایی به فارسی است (شریکِ برنامهٔ راستی‌آزماییِ متا). آخرین گزارش‌هایش را در بخشِ «فکت‌نامه» می‌بینی، و اگر یکی از خبرهای ما با یک گزارشِ فکت‌نامه هم‌موضوع باشد، رویِ آن خبر برچسبِ «راستی‌آزمایی‌شده در فکت‌نامه» با لینک ظاهر می‌شود."],
  ["ارتباط با ایران چطور تعیین می‌شود؟",
    "بر اساسِ واژه‌های کلیدیِ مرتبط با ایران در متنِ خبر. اگر ربطی نباشد، سیستم به‌زور ربطی نمی‌سازد — خبر بی‌ارتباط صریحاً «بدون ارتباط مستقیم با ایران» علامت می‌خورد."],
  ["کپی‌رایت چه می‌شود؟ آیا متنِ کاملِ خبرها را می‌آورید؟",
    "نه. پندار هیچ‌وقت متنِ کاملِ مقاله‌ها را بازنشر نمی‌کند. فقط خلاصهٔ کوتاه می‌سازد و به منبعِ اصلی لینک می‌دهد تا خودت آنجا کامل بخوانی."],
  ["هوش مصنوعی دقیقاً چه‌کار می‌کند؟",
    "خلاصه و تفکیکِ چهارلایه را یک مدلِ هوش مصنوعی (جمینای) می‌سازد، اما خروجی‌اش پیش از انتشار اعتبارسنجیِ ساختاری می‌شود و همیشه به منابعِ واقعی گره خورده است. متنِ منابع دست‌نخورده و لینک‌دار می‌ماند."],
  ["هر چند وقت به‌روز می‌شود؟",
    "هر یک ساعت، به‌صورتِ خودکار. زمانِ آخرین به‌روزرسانی بالای «سرخط» نوشته شده است."],
];
function renderFaq() {
  if (_faqLoaded) return;
  document.getElementById("faq").innerHTML = FAQ.map(([q, a]) =>
    `<details class="faq-item"><summary>${esc(q)}</summary><div class="faq-a">${a}</div></details>`).join("")
    + `<p class="muted" style="margin-top:18px;text-align:center">پندار — خبر، دیدگاه و زمینه در یک شبکهٔ واحد.</p>`;
  _faqLoaded = true;
}

async function renderTopics() {
  const el = document.getElementById("topic-grid");
  try {
    if (!ALL.length) { try { ALL = await getJSON(`${DATA}/stories.json`); } catch (e) {} }
    const topics = await getJSON(`${DATA}/topics.json`);
    const counted = topics
      .map(t => ({ ...t, n: ALL.filter(s => (s.topics || []).some(x => x.slug === t.slug)).length }))
      .filter(t => t.n > 0)
      .sort((a, b) => b.n - a.n);
    if (!counted.length) {
      el.innerHTML = `<div class="state"><div class="big">هنوز موضوعی دسته‌بندی نشده</div><p class="muted">با به‌روزرسانیِ بعدی پر می‌شود.</p></div>`;
      return;
    }
    el.innerHTML = counted.map(t => `<div class="topic" role="button" tabindex="0" onclick="openTopic('${t.slug}')">
      <div class="t-body"><div class="t-fa">${esc(t.name_fa)}</div><div class="t-count">${faN(t.n)} خبر</div></div>
      ${followBtn("topics", t.slug, "دنبال", "دنبال کن")}</div>`).join("");
  } catch (e) { el.innerHTML = `<div class="state"><div class="big">موضوعات بارگذاری نشد</div></div>`; }
}
