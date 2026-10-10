/* Pendar — system dashboard + tech/credits page. Extracted from app.js: the
   _sys* metric formatters, the system health dashboard (showSystem,
   renderSystem) and the tech/design-system page (showTech). Loaded as a
   classic script BEFORE app.js because route() reaches showSystem/showTech on
   deep links. Uses the shared dataset loaders (loadFigures, loadStudioRecaps,
   loadProjectFinance, loadNewsPeople — which stay in app.js) and showEntityQA
   (entity-qa.js) at runtime. No behavior change. */

function _sysNum(v) {
  return Number.isFinite(Number(v)) ? faN(Number(v).toLocaleString("en-US")) : "—";
}
function _sysTime(iso) {
  if (!iso) return "نامشخص";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "نامشخص";
    return d.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
  } catch (_) { return "نامشخص"; }
}
function _sysState(state) {
  const s = String(state || "").toLowerCase();
  if (["active","ok","success","healthy"].includes(s)) return ["سالم","ok"];
  if (["error","failed","failure"].includes(s)) return ["خطا","bad"];
  if (["empty","warning","warn"].includes(s)) return ["هشدار","warn"];
  if (["pending","unknown"].includes(s)) return ["در انتظار","muted"];
  return [state || "نامشخص","muted"];
}
function _sysMetric(label, value, sub, cls) {
  return '<article class="sys-metric '+(cls||'')+'"><span>'+esc(label)+'</span><b>'+_sysNum(value)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</article>';
}

// Entity QA / merge console (loadEntityQA, the _qa*/qa* draft editor,
// showEntityQA, renderEntityQA) now lives in entity-qa.js, loaded before
// this file.

function showSystem() {
  show("system"); setTab(""); setHash("#/system"); renderSystem();
}
async function renderSystem() {
  const el = document.getElementById("system-content");
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';
  const safe = async (name, fallback) => {
    try { return await getJSON(`${DATA}/${name}`, 20000); } catch (_) { return fallback; }
  };
  const [health, stats, meta, pressHealth, tv, weather, periodicals, entityRegistry, newsHealth] = await Promise.all([
    safe("system-health.json", null),
    safe("stats.json", {}),
    safe("meta.json", {}),
    safe("press-registry-health.json", []),
    safe("tv-guide.json", {}),
    safe("weather.json", []),
    safe("periodicals.json", []),
    safe("entity-registry.json", {}),
    safe("news-health.json", null)
  ]);

  const hc = (health && health.counts) || {};
  const thresholds = (health && health.thresholds) || {};
  const github = (health && health.github) || {};
  const total = hc.total_news ?? stats.total;
  const feedStories = hc.feed_stories ?? meta.count;
  const figures = hc.figures;
  const statements = hc.statements;
  const majra = hc.majra_topics;
  const books = hc.books;
  const h24 = stats?.rolling?.h24;
  const today = stats?.calendar?.today;
  const yesterday = stats?.calendar?.yesterday;

  const pressRows = Array.isArray(pressHealth) ? pressHealth : [];
  const pressCounts = pressRows.reduce((m, row) => {
    const k = String(row?.state || "unknown");
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});
  const pressIssues = pressRows
    .filter(x => !["active"].includes(String(x?.state || "")))
    .sort((a,b) => String(a?.state||"").localeCompare(String(b?.state||"")))
    .slice(0, 20);

  const tvSources = Array.isArray(tv?.sources) ? tv.sources.length : Object.keys(tv?.source_stats || {}).length;
  const tvChannels = Array.isArray(tv?.channels) ? tv.channels.length : 0;
  const tvPrograms = Array.isArray(tv?.programmes) ? tv.programmes.length : 0;
  const tvErrors = tv?.source_errors && typeof tv.source_errors === "object"
    ? Object.entries(tv.source_errors)
    : [];
  const periodicalCount = Array.isArray(periodicals) ? periodicals.length : (hc.periodicals_rows || 0);
  const weatherCount = Array.isArray(weather) ? weather.length : 0;
  const erCounts = entityRegistry?.counts || {};
  const canonicalEntities = hc.canonical_entities ?? erCounts.total;
  const canonicalPeople = hc.canonical_people ?? erCounts.person;
  const entityConflicts = hc.entity_conflicts ?? (Array.isArray(entityRegistry?.conflicts) ? entityRegistry.conflicts.length : 0);

  const gateOk = health ? health.ok === true : null;
  const gateLabel = gateOk === true ? "نسخهٔ منتشرشده سالم است" : gateOk === false ? "گیت انتشار خطا دارد" : "گزارش گیت پیدا نشد";
  const gateCls = gateOk === true ? "ok" : gateOk === false ? "bad" : "warn";
  const runUrl = github.repository && github.run_id
    ? `https://github.com/${github.repository}/actions/runs/${github.run_id}`
    : "";

  const metrics = [
    _sysMetric("کل خبرهای منتشرشده", total, "آرشیو اصلی", Number(total)>=10000?"ok":"bad"),
    _sysMetric("۲۴ ساعت اخیر", h24, "خبر", ""),
    _sysMetric("امروز", today, "خبر", ""),
    _sysMetric("دیروز", yesterday, "خبر", ""),
    _sysMetric("چهره‌ها", figures, "پروفایل canonical", ""),
    _sysMetric("گفته‌ها", statements, "پست و نقل‌قول", ""),
    _sysMetric("کتاب‌ها", books, "رکورد", ""),
    _sysMetric("هویت‌های canonical", canonicalEntities, `${canonicalPeople||0} نفر · ${entityConflicts||0} تعارض`, entityConflicts?"warn":"ok"),
    _sysMetric("جان ماجرا", majra, "داده محفوظ؛ فعلاً خارج از Home", ""),
    _sysMetric("جراید", periodicalCount, "مطلب", ""),
    _sysMetric("منابع جراید", pressRows.length, `${pressCounts.active||0} فعال`, ""),
    _sysMetric("شبکه‌های TV Guide", tvChannels, `${tvSources} منبع`, ""),
    _sysMetric("برنامه‌های TV Guide", tvPrograms, `${tvErrors.length} خطای منبع`, tvErrors.length?"warn":"")
  ].join("");

  const pressIssueHtml = pressIssues.length ? pressIssues.map(row => {
    const [lbl, cls] = _sysState(row.state);
    return `<div class="sys-source-row"><div><b>${esc(row.source_name||"منبع")}</b><small>${esc(row.last_error||row.method||"")}</small></div><span class="sys-pill ${cls}">${esc(lbl)}</span></div>`;
  }).join("") : '<div class="sys-empty">همهٔ منابع ثبت‌شده در وضعیت فعال‌اند.</div>';

  const tvErrorHtml = tvErrors.length ? tvErrors.slice(0,20).map(([name,msg]) =>
    `<div class="sys-source-row"><div><b>${esc(name)}</b><small>${esc(typeof msg==="string"?msg:JSON.stringify(msg))}</small></div><span class="sys-pill bad">خطا</span></div>`
  ).join("") : '<div class="sys-empty">خطای منبعی در خروجی فعلی TV Guide ثبت نشده است.</div>';

  const thresholdLabels = {
    total_news:"کل خبرها", feed_stories:"فید اصلی", figures:"چهره‌ها",
    statements:"گفته‌ها", majra_topics:"جان ماجرا", books:"کتاب‌ها"
  };
  const thresholdHtml = Object.entries(thresholds).map(([k,v]) => {
    const current = hc[k];
    const pass = Number(current) >= Number(v);
    return `<div class="sys-th-row"><span>${esc(thresholdLabels[k]||k)}</span><b>${_sysNum(current)}</b><small>حداقل ${_sysNum(v)}</small><span class="sys-pill ${pass?"ok":"bad"}">${pass?"قبول":"رد"}</span></div>`;
  }).join("") || '<div class="sys-empty">آستانه‌ها در این نسخه ثبت نشده‌اند.</div>';

  el.innerHTML = `
    <section class="sys-hero ${gateCls}">
      <div><span class="home-eyebrow">آخرین نسخهٔ منتشرشده</span><h2>${esc(gateLabel)}</h2>
        <p>این صفحه سلامت آخرین نسخه‌ای را نشان می‌دهد که اجازهٔ انتشار گرفته؛ build ردشده جای نسخهٔ سالم را نمی‌گیرد.</p></div>
      <div class="sys-gate"><span class="sys-dot"></span><b>${gateOk===true?"PASS":gateOk===false?"BLOCKED":"UNKNOWN"}</b></div>
    </section>
    <section class="sys-panel">
      <div class="sys-panel-head"><div><span class="home-eyebrow">News & Gemini</span><h3>سلامت پردازش خبر و هوش مصنوعی</h3></div><span class="sys-pill ${newsHealth?.status==="ok"?"ok":newsHealth?.status==="warning"?"warn":"muted"}">${newsHealth?.status==="ok"?"گزارش موجود":newsHealth?.status==="warning"?"خطای API ثبت شده":"داده موجود نیست"}</span></div>
      <div class="sys-detail-row"><span>آخرین گزارش سلامت</span><b>${_sysTime(newsHealth?.generated_at)}</b></div>
      <div class="sys-detail-row"><span>خبرهای منتشرشده در ۲۴ ساعت</span><b>${_sysNum(newsHealth?.news?.published_24h)}</b></div>
      <div class="sys-detail-row"><span>درخواست‌های موفق AI در ۲۴ ساعت</span><b>${_sysNum(newsHealth?.ai?.success)}</b></div>
      <div class="sys-detail-row"><span>خطاهای ارائه‌دهنده / سهمیه</span><b>${_sysNum(newsHealth?.ai?.provider_errors)} / ${_sysNum(newsHealth?.ai?.quota_errors)}</b></div>
      <div class="sys-detail-row"><span>خطاهای اعتبارسنجی پاسخ</span><b>${_sysNum(newsHealth?.ai?.validation_errors)}</b></div>
      <div class="sys-detail-row"><span>آخرین پردازش موفق AI</span><b>${_sysTime(newsHealth?.ai?.latest_success)}</b></div>
      <div class="sys-detail-row"><span>تأخیر بازبینی</span><b>${meta?.built_iso && Date.now()-new Date(meta.built_iso).getTime()>3600000?"بیش از یک ساعت":meta?.built_iso?"کمتر از یک ساعت":"نامشخص"}</b></div>
      <p>این آمار از پایگاه دادهٔ اجرا استخراج می‌شود. سبز بودن GitHub Actions به‌تنهایی نشانهٔ موفقیت Gemini نیست.</p>
    </section>
    <div class="sys-grid">${metrics}</div>\n    <div class="sys-admin-actions"><button onclick="showEntityQA()">Entity QA / Merge Console</button><span>بررسی duplicateها، aliasها و overrideهای canonical</span></div>

    <div class="sys-two">
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Freshness</span><h3>تازه‌بودن داده‌ها</h3></div></div>
        <div class="sys-detail-row"><span>آخرین گیت انتشار</span><b>${_sysTime(health?.checked_at)}</b></div>
        <div class="sys-detail-row"><span>آخرین تولید خبر</span><b>${_sysTime(meta?.built_iso)}</b></div>
        <div class="sys-detail-row"><span>آخرین TV Guide</span><b>${_sysTime(tv?.generated_at)}</b></div>
        <div class="sys-detail-row"><span>شهرهای آب‌وهوا</span><b>${_sysNum(weatherCount)}</b></div>
        <div class="sys-detail-row"><span>فید صفحهٔ اول</span><b>${_sysNum(feedStories)}</b></div>
      </section>
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Deploy</span><h3>نسخه و اجرای GitHub</h3></div></div>
        <div class="sys-detail-row"><span>Workflow</span><b>${esc(github.workflow||"—")}</b></div>
        <div class="sys-detail-row"><span>Run ID</span><b>${esc(github.run_id||"—")}</b></div>
        <div class="sys-detail-row"><span>Commit</span><code>${esc((github.sha||"—").slice(0,12))}</code></div>
        <div class="sys-detail-row"><span>Repository</span><b>${esc(github.repository||"—")}</b></div>
        ${runUrl?`<a class="sys-run-link" href="${esc(runUrl)}" target="_blank" rel="noopener">باز کردن GitHub Actions ↗</a>`:""}
      </section>
    </div>

    <div class="sys-two">
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">Press</span><h3>سلامت منابع جراید</h3></div>
          <span class="sys-mini">${_sysNum(pressCounts.active||0)} فعال · ${_sysNum(pressIssues.length)} نیازمند بررسی</span></div>
        <div class="sys-source-list">${pressIssueHtml}</div>
      </section>
      <section class="sys-panel">
        <div class="sys-panel-head"><div><span class="home-eyebrow">EPG</span><h3>سلامت TV Guide</h3></div>
          <span class="sys-mini">${_sysNum(tvChannels)} شبکه · ${_sysNum(tvPrograms)} برنامه</span></div>
        <div class="sys-source-list">${tvErrorHtml}</div>
      </section>
    </div>

    <section class="sys-panel">
      <div class="sys-panel-head"><div><span class="home-eyebrow">Integrity Gate</span><h3>آستانه‌های جلوگیری از انتشار خراب</h3></div>
        <span class="sys-mini">افت کل خبرها بیش از ${health?.max_total_drop!=null?faN(Math.round(health.max_total_drop*100))+"٪":"۲۰٪"} نیز deploy را می‌بندد</span></div>
      <div class="sys-thresholds">${thresholdHtml}</div>
      ${(health?.errors||[]).length?`<div class="sys-errors">${health.errors.map(e=>`<div>${esc(e)}</div>`).join("")}</div>`:""}
    </section>
  `;
}

function showTech() {
  show("tech"); setTab(""); setHash("#/tech");
  const el = document.getElementById("tech-content");
  el.innerHTML = `
    <div class="tech-grid">
      <article class="tech-card"><h2>رابط فارسی و RTL</h2><p>کامپوننت‌های رابط با الگوهای بومیِ راست‌چین طراحی شده‌اند؛ کارت، آمار، آواتار، تب‌ها، نشان‌ها، خط زمان، حالت خالی و بارگذاری.</p><div class="tech-tags"><span class="tech-tag">Card</span><span class="tech-tag">Stat</span><span class="tech-tag">Avatar</span><span class="tech-tag">Tabs</span><span class="tech-tag">Badge</span></div></article>
      <article class="tech-card"><h2>VibeFarsi UI</h2><p>برای زبان بصری و رفتار کامپوننت‌های فارسی از VibeFarsi الهام گرفته‌ایم. پندار فعلاً پروژهٔ React/Tailwind نیست؛ بنابراین الگوها در CSS/JavaScript موجود بازپیاده‌سازی شده‌اند و خود کتابخانه dependency اجرایی سایت نیست.</p><div class="tech-tags"><a class="tech-tag" href="https://vibefarsi.ir/" target="_blank" rel="noopener">vibefarsi.ir ↗</a></div></article>
      <article class="tech-card"><h2>خبر و تحلیل</h2><p>Backend پایتون خبرها را دریافت، خوشه‌بندی، رتبه‌بندی و برای خروجی استاتیک آماده می‌کند. واقعیت خبر، تحلیل رسانه و دیدگاه اشخاص در لایه‌های جدا نگهداری می‌شوند.</p><div class="tech-tags"><span class="tech-tag">Python</span><span class="tech-tag">SQLAlchemy</span><span class="tech-tag">JSON</span></div></article>
      <article class="tech-card"><h2>انتشار استاتیک</h2><p>خروجی نهایی HTML/CSS/JavaScript است و با GitHub Actions ساخته و روی GitHub Pages منتشر می‌شود؛ بنابراین خواندن سایت به سرور اپلیکیشن دائمی وابسته نیست.</p><div class="tech-tags"><span class="tech-tag">GitHub Actions</span><span class="tech-tag">GitHub Pages</span><span class="tech-tag">PWA</span></div></article>
    </div>
    <div class="rule"><span>نقشهٔ فناوری</span><span class="l"></span></div>
    <div class="tech-stack">
      <div class="tech-row"><b>جمع‌آوری</b><span>منابع خبری، منابع عمومی چهره‌ها و داده‌های مکمل</span></div>
      <div class="tech-row"><b>پردازش</b><span>Python · خوشه‌بندی خبر · استخراج گفته‌ها · رتبه‌بندی و synthesis</span></div>
      <div class="tech-row"><b>داده</b><span>SQLAlchemy و خروجی‌های JSON برای رابط استاتیک</span></div>
      <div class="tech-row"><b>رابط</b><span>HTML + Vanilla JavaScript + CSS؛ فارسی و RTL از ابتدا</span></div>
      <div class="tech-row"><b>طراحی</b><span>Design tokens داخلی پندار + الگوهای سازگارشده از VibeFarsi UI</span></div>
      <div class="tech-row"><b>انتشار</b><span>GitHub Actions → GitHub Pages</span></div>
    </div>
    <div class="rule"><span>VibeFarsi کجا اثر گذاشته؟</span><span class="l"></span></div>
    <div class="tech-card"><p>در بازطراحی تدریجی پندار، الگوهای Card و Stat برای خلاصه‌ها و اعداد، Avatar برای چهره‌ها، Segmented Control/Tabs برای فیلترها، Badge برای وضعیت‌ها، Timeline برای زنجیرهٔ رویداد و Skeleton/Empty State برای وضعیت‌های بارگذاری و نبود داده مبنا قرار می‌گیرند. این تطبیق مرحله‌ای است تا معماری سبک فعلی حفظ شود.</p></div>
  `;
}
