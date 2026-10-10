/* Diner — Nima's Diner: restaurant & café tips inside Pendar.
   A curated collection of restaurant-industry tips (the online version
   of the nimasdiner Instagram reels) plus CTAs for Telegram, email and
   Instagram. Content is loaded from data/diner-tips.json when available,
   with a handful of seed tips baked in for the initial launch. */

let _dinerLoaded = false;

/* ── Seed tips (launch batch — replaced by diner-tips.json when the
      build pipeline generates it) ─────────────────────────────── */
const DINER_SEED = [
  {
    id: "d001",
    title: "فودکاست چیست و چرا رستوران شما بهش نیاز داره؟",
    body: "فودکاست یعنی محاسبه دقیق هزینه هر بشقاب غذایی که سرو می‌کنید — از مواد اولیه تا گاز و برق. بدون این عدد، قیمت‌گذاری منو حدسی‌ست و سود واقعی معلوم نیست. یه فرمول ساده: هزینه مواد اولیه تقسیم بر قیمت فروش، ضربدر ۱۰۰. اگه جواب بالای ۳۵٪ بود، باید بشینی و منو رو بازنگری کنی.",
    category: "مهندسی منو",
    icon: "📊"
  },
  {
    id: "d002",
    title: "سه اشتباه رایج در چیدمان منو",
    body: "۱) همه غذاها رو توی یه صفحه نریزید — دسته‌بندی کنید. ۲) غذای پرسود رو گوشه بالا سمت راست بذارید — اولین جایی که چشم می‌ره. ۳) قیمت رو بدون «تومان» یا خط‌چین بنویسید — مشتری کمتر روی عدد تمرکز می‌کنه.",
    category: "مهندسی منو",
    icon: "📋"
  },
  {
    id: "d003",
    title: "چطور گارسون خوب استخدام کنیم؟",
    body: "گارسون خوب لزوماً باتجربه نیست — آدمی‌ه که گوش می‌ده، لبخند طبیعی داره و زیر فشار خونسرد می‌مونه. توی مصاحبه یه سناریوی واقعی بهش بده: «مشتری از غذا شکایت کرده، چیکار می‌کنی؟» جوابش بیشتر از رزومه‌اش حرف می‌زنه.",
    category: "مدیریت تیم",
    icon: "👥"
  },
  {
    id: "d004",
    title: "ساعت طلایی سرو قهوه",
    body: "اگه کافه دارید، بدونید که ۷۰٪ فروش قهوه بین ۷ صبح تا ۱۰ صبح اتفاق می‌افته. اگه توی این ساعت آماده نباشید — اسپرسو گرم نباشه، شیر کم بیاد، صف طولانی بشه — مشتری رو از دست دادید. برنامه‌ریزی شیفت صبح مهم‌ترین تصمیم روزانه‌تونه.",
    category: "عملیات",
    icon: "☕"
  },
  {
    id: "d005",
    title: "بهداشت آشپزخانه: چک‌لیست روزانه",
    body: "هر روز صبح قبل از شروع کار: دمای یخچال رو چک کنید (زیر ۴ درجه)، سطوح کار رو ضدعفونی کنید، تاریخ مصرف مواد اولیه رو بررسی کنید و دستکش و کلاه رو آماده بذارید. این چهار مورد ساده جلوی ۸۰٪ مشکلات بهداشتی رو می‌گیره.",
    category: "بهداشت",
    icon: "🧤"
  },
  {
    id: "d006",
    title: "چطور با اینستاگرام مشتری جذب کنیم؟",
    body: "عکس غذا فقط کافی نیست. پشت‌صحنه آشپزخانه، معرفی تیم، داستان یه بشقاب از مزرعه تا میز — اینا چیزاییه که فالوور رو تبدیل به مشتری می‌کنه. هفته‌ای حداقل ۳ استوری و ۲ ریلز بذارید. ریلز ۱۵ ثانیه‌ای با یه نکته کاربردی بهتر از یه ویدیوی ۳ دقیقه‌ای بدون هدفه.",
    category: "بازاریابی",
    icon: "📱"
  },
  {
    id: "d007",
    title: "قانون ۳۰-۳۰-۳۰ در قیمت‌گذاری",
    body: "یه قاعده سرانگشتی برای رستوران سنتی: ۳۰٪ هزینه مواد اولیه، ۳۰٪ هزینه نیروی انسانی، ۳۰٪ هزینه‌های سربار (اجاره، قبوض، بیمه). ۱۰٪ باقی‌مانده سود شماست. اگه هر کدوم از این سه عدد بالاتر بره، سود ناپدید می‌شه.",
    category: "مهندسی منو",
    icon: "💰"
  },
  {
    id: "d008",
    title: "تفاوت کافه نسل سوم با سنتی",
    body: "کافه نسل سوم روی کیفیت دانه، روش دم‌آوری و تجربه مشتری تمرکز داره — نه فقط فضا و دکور. اگه می‌خوای کافه نسل سومی باز کنی، باید باریستای آموزش‌دیده داشته باشی، منشأ قهوه رو بدونی و حداقل ۳ روش دم‌آوری (V60، کمکس، ایروپرس) ارائه بدی.",
    category: "کافه‌داری",
    icon: "☕"
  },
  {
    id: "d009",
    title: "مدیریت ضایعات: پول‌هایی که دور می‌ریزید",
    body: "یه رستوران متوسط ماهانه ۱۵ تا ۲۰ درصد مواد اولیه‌اش رو ضایع می‌کنه. سه قدم ساده: ۱) هر روز موجودی یخچال رو چک کنید و FIFO رعایت کنید. ۲) از پوست سبزیجات استاک بگیرید. ۳) پرشن‌ها (portion) رو استاندارد کنید — حدس نزنید، ترازو بذارید.",
    category: "عملیات",
    icon: "♻️"
  },
  {
    id: "d010",
    title: "چرا نظرات گوگل مهم‌تر از تبلیغاته؟",
    body: "۸۸٪ مشتری‌ها قبل از رفتن به رستوران نظرات گوگل رو می‌خونن. یه امتیاز ۴.۲ به بالا یعنی اعتماد. بعد از هر سرویس خوب، از مشتری بخواید نظر بذاره. جواب دادن به نظرات منفی هم مهمه — نشون‌دهنده حرفه‌ای بودنه.",
    category: "بازاریابی",
    icon: "⭐"
  },
  {
    id: "d011",
    title: "شیفت‌بندی هوشمند: کی بیشتر آدم لازمه؟",
    body: "داده‌های فروش هفتگی رو نگاه کنید. معمولاً پنج‌شنبه و جمعه شب ۴۰٪ بیشتر از روزهای عادی ترافیک دارید. ولی خیلی از رستوران‌ها همه روزها یه تعداد پرسنل دارن. نتیجه: روزهای خلوت هزینه اضافه، روزهای شلوغ خدمات ضعیف. شیفت رو با داده بچینید، نه با عادت.",
    category: "مدیریت تیم",
    icon: "📅"
  },
  {
    id: "d012",
    title: "اولین ۳۰ ثانیه مشتری",
    body: "مشتری تا ۳۰ ثانیه بعد از ورود تصمیم می‌گیره که تجربه‌اش خوبه یا بد. خوش‌آمدگویی، راهنمایی به میز، و اولین تماس چشمی — اینا همون لحظه‌های طلایی‌ان. اگه گارسون ۳ دقیقه بعد بیاد و بگه «بفرمایید»، دیر شده.",
    category: "عملیات",
    icon: "🚪"
  }
];

const DINER_CATEGORIES = [
  ["all", "همه"],
  ["مهندسی منو", "مهندسی منو"],
  ["مدیریت تیم", "مدیریت تیم"],
  ["عملیات", "عملیات"],
  ["بهداشت", "بهداشت"],
  ["بازاریابی", "بازاریابی"],
  ["کافه‌داری", "کافه‌داری"]
];

const DINER_TG_GROUP = "https://t.me/+sNV4qZCjSOQyMzc0";
const DINER_CONTACT = "https://t.me/nimaafsharnaderiir";
const DINER_IG = "https://www.instagram.com/nimasdiner";

let _dinerTips = [];
let _dinerCategory = "all";

async function loadDinerTips() {
  if (_dinerLoaded) return _dinerTips;
  try {
    const remote = await getJSON(`${DATA}/diner-tips.json`);
    _dinerTips = Array.isArray(remote) ? remote : (remote.tips || []);
  } catch (_) {
    _dinerTips = DINER_SEED;
  }
  _dinerLoaded = true;
  return _dinerTips;
}

function dinerTipCard(tip) {
  return `<article class="diner-card">
    <div class="diner-card-head">
      <span class="diner-icon">${esc(tip.icon || "💡")}</span>
      <span class="diner-cat">${esc(tip.category || "")}</span>
    </div>
    <h3 class="diner-card-title">${esc(tip.title)}</h3>
    <p class="diner-card-body">${esc(tip.body)}</p>
  </article>`;
}

function renderDinerTips(tips) {
  const filtered = _dinerCategory === "all"
    ? tips
    : tips.filter(t => t.category === _dinerCategory);

  if (!filtered.length)
    return `<div class="state"><div class="big">نکته‌ای در این دسته نیست</div></div>`;

  /* Insert a Telegram CTA after every 4 tips */
  const cards = [];
  filtered.forEach((tip, i) => {
    cards.push(dinerTipCard(tip));
    if (i === 3 && filtered.length > 4) {
      cards.push(`<a class="diner-tg-cta" href="${DINER_TG_GROUP}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="var(--diner-tg)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.57 7.41c-.12.53-.43.66-.87.41l-2.4-1.77-1.16 1.12c-.13.13-.24.24-.49.24l.17-2.44 4.44-4.01c.19-.17-.04-.27-.3-.1l-5.49 3.46-2.37-.74c-.51-.16-.52-.51.11-.76l9.25-3.56c.43-.16.8.1.66.75z"/></svg>
        <div class="diner-tg-cta-text">عضو گروه تلگرام داینر نیما شوید<span class="diner-tg-cta-sub">پرسش و پاسخ، بحث با همکاران صنعت</span></div>
      </a>`);
    }
  });

  return cards.join("");
}

function dinerCategoryBar() {
  return `<div class="diner-cats">${DINER_CATEGORIES.map(([k, label]) =>
    `<button class="fchip${_dinerCategory === k ? " on" : ""}" onclick="setDinerCategory('${k}')">${esc(label)}</button>`
  ).join("")}</div>`;
}

function setDinerCategory(cat) {
  _dinerCategory = cat;
  document.getElementById("diner-tips-area").innerHTML = renderDinerTips(_dinerTips);
  document.getElementById("diner-cats").innerHTML = dinerCategoryBar();
}

/* ── Portfolio: Hot Dog Retro ─────────────────────────────────
   Case study of a casual fast-food project, served at /diner/retro/.
   Photos live in assets/retro/ and are listed in RETRO_PHOTOS; the
   gallery stays hidden until at least one photo is listed. */

const RETRO_PHOTOS = [
  /* { src: "assets/retro/01.jpg", caption: "روز اول — تخریب و زیرسازی", phase: "ساخت" }, */
];

const RETRO_STATS = [
  ["۸۵", "متر مربع", "سالن و آشپزخانه صنعتی"],
  ["۳۵", "نفر", "ظرفیت هم‌زمان پذیرایی"],
  ["۱۸", "آیتم منو", "هات‌داگ، برگر، سیب‌زمینی و رترو کیدز"],
  ["۶", "سس امضادار", "سس‌های صوفیا، تولید روزانه"],
  ["۲–۳", "ماه", "از تخریب تا آخرین لوله نئون"],
];

const RETRO_PHASES = [
  {
    when: "اواخر ۱۴۰۱",
    title: "ایده‌پردازی",
    body: "ایده از عشق مشترک به حال‌وهوای دهه‌های ۵۰ و ۶۰ میلادی آمد: دوران طلایی داینرها، راک‌اندرول، کاپشن چرمی و نور نئون. هدف، پیوند طعم‌های اصیل و خیابانی هات‌داگ با یک اتمسفر نوستالژیک بود، بومی‌شده برای ذائقه و خاطرهٔ مخاطب ایرانی؛ یعنی زنده کردن فرهنگ «کژوالِ باکیفیت» در قالب برندی با داستان خودش.",
  },
  {
    when: "پیش از ساخت",
    title: "سرمایه‌گذاری شعبهٔ نخست",
    body: "با همراهی مهدی محمدی به‌عنوان سرمایه‌گذار شعبهٔ نخست، ایده وارد مسیر اجرا شد.",
  },
  {
    when: "برندینگ",
    title: "هویت بصری و کاراکترها",
    body: "طراحی لوگوی اصلی با فونت سرخ و خامه‌ای رترو و فلش‌های کلاسیک، و خلق دو مسکات اختصاصی: «پسرِ باحالِ گریزر» با موی پمپادور و کاپشن چرمی و «دخترِ رترو» با پیش‌بند فست‌کژوال. چاپ و بسته‌بندی با همکاری آژانس وینگ استودیو انجام شد.",
  },
  {
    when: "منو و طعم",
    title: "مهندسی منو و دستور پخت",
    body: "تک‌تک آیتم‌های منو مهندسی شد و سس‌های امضادار صوفیا به شناسنامهٔ طعم رترو تبدیل شدند؛ از سس کاری‌وورست تا رلیش‌های ویژه و ساورکرات هات‌داگ نیویورکی که از برند Soufia's Secret Recipe عرضه شدند.",
  },
  {
    when: "ساخت",
    title: "فضا، دکور و نئون",
    body: "کاشی شطرنجی قرمز و سفید، مبل‌های دورهمی (Booth)، صندلی‌های بارِ کروم و زرد، تابلوی نئونی بزرگ و سرخ «هات‌داگ رترو» در نما و تابلوهای داخلی. بخش بزرگی از اجرا با کار شبانه‌روزی موحد شکیبا و ابراهیم گرانپایه به ثمر نشست، با راهنمایی‌های ارزشمند عیسی بهزادی، بنیان‌گذار برگر و کافه باروک نوشهر.",
  },
  {
    when: "تجهیز",
    title: "آشپزخانه و تجهیزات",
    body: "طراحی صنعتی و جانمایی آشپزخانه برای سرعت بالای سرویس فست‌کژوال؛ انتخاب گریل، فر و سرخ‌کن‌هایی که نان برشته و سوسیس آبدار تحویل بدهند.",
  },
  {
    when: "پیش از افتتاح",
    title: "آموزش پرسنل و استانداردسازی",
    body: "تدوین دستورالعمل‌های استاندارد (SOP) آماده‌سازی، پخت و سرویس، همراه با آموزش حضوری پرسنل برای سرعت، کیفیت و انرژیِ رترویی در برخورد با مشتری.",
  },
  {
    when: "مهر ۱۴۰۳",
    title: "افتتاح و اجرا",
    body: "رترو در خیابان قدرتی نوشهر افتتاح شد و دکور زنده و تنوع هات‌داگ‌های تخصصی‌اش با استقبال گسترده روبه‌رو شد. امروز یکی از پرطرفدارترین پاتوق‌های فست‌کژوال منطقه است؛ پر از موسیقی قدیمی و بوی هات‌داگ گریل‌شده.",
  },
];

const RETRO_FIRSTS = [
  ["🌶", "هات‌داگ بندری", "طعم و امضای بندری روی هات‌داگ، برای پیوند با ذائقهٔ ایرانی."],
  ["🌭", "کاری‌وورست", "بشقاب سوسیس محبوب آلمانی، با سس‌های امضادار صوفیا."],
  ["☕", "قهوهٔ دمی", "قهوهٔ دمیِ نسل سوم به‌جای قهوه‌های رایج اسپرسوپایه، در فضای فست‌کژوال."],
];

const RETRO_TEAM = [
  { name: "نیما افشارنادری", role: "ایده‌پردازی، طراحی و راه‌اندازی", href: "/@nima-afshar-naderi/" },
  { name: "صوفیا عبداللهی", role: "ایده‌پردازی و سس‌های امضادار", href: "/@soufia-abdollahi/" },
  { name: "مهدی محمدی", role: "سرمایه‌گذار شعبهٔ نخست" },
  { name: "موحد شکیبا", role: "اجرای فضا و دکور" },
  { name: "ابراهیم گرانپایه", role: "اجرای فضا و دکور" },
  { name: "عیسی بهزادی", role: "مشاور؛ بنیان‌گذار برگر و کافه باروک نوشهر" },
  { name: "وینگ استودیو", role: "چاپ و بسته‌بندی", href: "https://www.instagram.com/wingstudio.ca/" },
  { name: "Soufia's Secret Recipe", role: "محصولات تخمیری، سس‌های اختصاصی و رلیش‌ها", href: "https://www.instagram.com/soufia.recipe/" },
];

const RETRO_LINKS = [
  ["یوتیوب هات‌داگ رترو", "https://www.youtube.com/@HotdogRetro"],
  ["اینستاگرام hotdog.retro", "https://www.instagram.com/hotdog.retro"],
  ["اینستاگرام retro_hotdog_", "https://www.instagram.com/retro_hotdog_"],
];

function dinerPortfolioCard() {
  return `<a class="retro-card" href="/diner/retro/">
    <span class="retro-card-tag">نمونه‌کار</span>
    <span class="retro-card-title">هات‌داگ رترو</span>
    <span class="retro-card-sub">از ایده تا افتتاح یک فست‌کژوال نوستالژیک در نوشهر — ۸۵ متر، ۱۸ آیتم منو، ۶ سس امضادار</span>
    <span class="retro-card-go">دیدن پرونده ←</span>
  </a>`;
}

function retroPersonLink(p) {
  const ext = /^https?:/.test(p.href || "");
  const name = p.href
    ? `<a href="${esc(p.href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(p.name)}</a>`
    : esc(p.name);
  return `<li><strong>${name}</strong><span>${esc(p.role)}</span></li>`;
}

function renderRetro() {
  const gallery = RETRO_PHOTOS.length ? `
    <section class="retro-block">
      <h2 class="retro-h2">از روز اول تا افتتاح</h2>
      <div class="retro-gallery">${RETRO_PHOTOS.map(p => `
        <figure>
          <img src="${esc(p.src)}" alt="${esc(p.caption || "هات‌داگ رترو")}" loading="lazy">
          ${p.caption ? `<figcaption>${p.phase ? `<b>${esc(p.phase)}</b> ` : ""}${esc(p.caption)}</figcaption>` : ""}
        </figure>`).join("")}
      </div>
    </section>` : "";

  return `
    <a class="retro-back" href="/diner/">→ بازگشت به داینر نیما</a>

    <header class="retro-hero">
      <span class="retro-eyebrow">نمونه‌کار داینر نیما · ایده‌پردازی، راه‌اندازی و اجرا</span>
      <h1 class="retro-neon">هات‌داگ رترو</h1>
      <p class="retro-lead">یک ماشین زمان به دهه‌های ۵۰ و ۶۰ میلادی: فست‌کژوالی با هات‌داگ‌های تخصصی، سس‌های امضادار و نئون سرخ، در قلب نوشهر.</p>
      <p class="retro-meta">نوشهر، خیابان قدرتی، بعد از میدان دهخدا · افتتاح مهر ۱۴۰۳</p>
    </header>

    <div class="retro-stats">${RETRO_STATS.map(([n, unit, note]) => `
      <div class="retro-stat"><b>${n}</b><span>${esc(unit)}</span><small>${esc(note)}</small></div>`).join("")}
    </div>

    ${gallery}

    <section class="retro-block retro-video-block">
      <h2 class="retro-h2">رترو در قاب ویدئو</h2>
      <p class="retro-note">دو روایت ویدئویی از هات‌داگ رترو؛ بدون خروج از صفحه تماشا کنید.</p>
      <div class="retro-video-grid">
        <figure class="retro-video-item">
          <div class="retro-video-frame">
            <iframe src="https://www.youtube-nocookie.com/embed/g0H4SjlYFGs" title="ویدئوی هات‌داگ رترو ـ شمارهٔ یک" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
          </div>
          <figcaption>ویدئوی اول · <a href="https://www.youtube.com/shorts/g0H4SjlYFGs" target="_blank" rel="noopener noreferrer">تماشا در یوتیوب ↗</a></figcaption>
        </figure>
        <figure class="retro-video-item">
          <div class="retro-video-frame">
            <iframe src="https://www.youtube-nocookie.com/embed/6c6k_pMvneM" title="ویدئوی هات‌داگ رترو ـ شمارهٔ دو" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
          </div>
          <figcaption>ویدئوی دوم · <a href="https://www.youtube.com/shorts/6c6k_pMvneM" target="_blank" rel="noopener noreferrer">تماشا در یوتیوب ↗</a></figcaption>
        </figure>
      </div>
    </section>

    <section class="retro-block">
      <h2 class="retro-h2">مسیر پروژه</h2>
      <ol class="retro-timeline">${RETRO_PHASES.map(ph => `
        <li><span class="retro-when">${esc(ph.when)}</span><h3>${esc(ph.title)}</h3><p>${esc(ph.body)}</p></li>`).join("")}
      </ol>
    </section>

    <section class="retro-block">
      <h2 class="retro-h2">نوآوری‌های منو</h2>
      <p class="retro-note">به روایت تیم رترو، این سه طعم برای نخستین بار در ایران عرضه شدند.</p>
      <div class="retro-firsts">${RETRO_FIRSTS.map(([icon, t, d]) => `
        <div class="retro-first"><span>${icon}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}
      </div>
      <p class="retro-note">ترکیب منو: ۴ مدل سیب‌زمینی خاص، ۷ مدل هات‌داگ معمولی و ایالتی، ۳ مدل برگر نوستالژیک، بشقاب‌های ویژهٔ سوخاری و چوریتسو، سالاد و منوی کودکان «رترو کیدز».</p>
    </section>

    <section class="retro-block retro-soufia">
      <img src="assets/retro/soufia-logo.jpg" alt="لوگوی Soufia's Secret Recipe" width="120" height="120" loading="lazy">
      <div>
        <span class="retro-eyebrow-dark">همکار طعم رترو</span>
        <h2 class="retro-h2">سس‌های صوفیا · Soufia's Secret Recipe</h2>
        <p>برندی که کارش تهیهٔ محصولات تخمیری، سس‌های اختصاصی و رلیش‌های ویژه است. از ابتدای فعالیت هات‌داگ رترو، ساورکراتِ هات‌داگ نیویورکی، سس کاری‌وورست و رلیش‌های منو از سس‌های صوفیا عرضه شد.</p>
        <a class="diner-social-btn diner-ig" href="https://www.instagram.com/soufia.recipe" target="_blank" rel="noopener">اینستاگرام soufia.recipe</a>
      </div>
    </section>

    <section class="retro-block">
      <h2 class="retro-h2">تیم و همکاران</h2>
      <ul class="retro-team">${RETRO_TEAM.map(retroPersonLink).join("")}</ul>
    </section>

    <section class="retro-block retro-links">
      <h2 class="retro-h2">رترو را دنبال کنید</h2>
      <div class="diner-social-row">${RETRO_LINKS.map(([label, url]) =>
        `<a class="diner-social-btn diner-ig" href="${url}" target="_blank" rel="noopener">${esc(label)}</a>`).join("")}
      </div>
    </section>

    <div class="diner-footer-cta">
      <p>برای ایده‌پردازی، راه‌اندازی یا بازطراحی رستوران و فست‌فود خودتان مشاوره می‌خواهید؟</p>
      <a href="${DINER_CONTACT}" target="_blank" rel="noopener" class="diner-social-btn diner-contact">تماس مستقیم با نیما افشارنادری</a>
    </div>
  `;
}

async function showDiner(sub) {
  if (sub === "retro") {
    setHash("#/diner/retro");
    show("diner");
    setTab("");
    document.getElementById("diner-content").innerHTML = renderRetro();
    document.title = "هات‌داگ رترو؛ نمونه‌کار ایده‌پردازی تا اجرا | داینر نیما";
    window.scrollTo(0, 0);
    return;
  }
  setHash("#/diner");
  show("diner");
  setTab("");

  const tips = await loadDinerTips();

  const el = document.getElementById("diner-content");
  el.innerHTML = `
    <div class="diner-hero">
      <div class="diner-hero-text">
        <h1 class="diner-title">🍽 داینر نیما</h1>
        <p class="diner-subtitle">نکته‌های کاربردی رستوران‌داری و کافه‌داری — از تجربه واقعی</p>
        <div class="diner-social-row">
          <a href="${DINER_IG}" target="_blank" rel="noopener" class="diner-social-btn diner-ig">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>
            اینستاگرام
          </a>
          <a href="${DINER_TG_GROUP}" target="_blank" rel="noopener" class="diner-social-btn diner-tg">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.57 7.41c-.12.53-.43.66-.87.41l-2.4-1.77-1.16 1.12c-.13.13-.24.24-.49.24l.17-2.44 4.44-4.01c.19-.17-.04-.27-.3-.1l-5.49 3.46-2.37-.74c-.51-.16-.52-.51.11-.76l9.25-3.56c.43-.16.8.1.66.75z"/></svg>
            عضویت در گروه تلگرام
          </a>
          <a href="${DINER_CONTACT}" target="_blank" rel="noopener" class="diner-social-btn diner-contact">تماس مستقیم با نیما افشارنادری</a>
        </div>
      </div>
    </div>

    <div class="diner-email-box" id="diner-email-box">
      <h3>📬 عضو خبرنامه داینر شوید</h3>
      <p>هر هفته یه نکته طلایی رستوران‌داری مستقیم توی ایمیل‌تون.</p>
      <form class="diner-email-form" onsubmit="return submitDinerEmail(event)">
        <input type="email" id="diner-email-input" placeholder="ایمیل شما" required autocomplete="email" dir="ltr">
        <button type="submit">عضویت</button>
      </form>
      <div id="diner-email-msg" class="diner-email-msg"></div>
    </div>

    <h2 class="retro-h2 diner-portfolio-h">نمونه‌کارها</h2>
    ${dinerPortfolioCard()}

    <div id="diner-cats">${dinerCategoryBar()}</div>
    <div class="diner-tips" id="diner-tips-area">
      ${renderDinerTips(tips)}
    </div>

    <div class="diner-footer-cta">
      <p>این نکات بر اساس ویدئوهای <a href="${DINER_IG}" target="_blank" rel="noopener">داینر نیما</a> در اینستاگرام تهیه شده.</p>
      <p>سوالی دارید؟ <a href="${DINER_TG_GROUP}" target="_blank" rel="noopener">توی گروه تلگرام بپرسید</a>.</p>
      <a href="${DINER_CONTACT}" target="_blank" rel="noopener" class="diner-social-btn diner-contact">تماس مستقیم با نیما افشارنادری</a>
    </div>
  `;
  document.title = "داینر نیما | پندار";
}

function submitDinerEmail(e) {
  e.preventDefault();
  const input = document.getElementById("diner-email-input");
  const msg = document.getElementById("diner-email-msg");
  const email = (input.value || "").trim();
  if (!email) return false;

  // Store locally (localStorage) until a real backend endpoint exists.
  try {
    const stored = JSON.parse(localStorage.getItem("dinr_emails") || "[]");
    if (!stored.includes(email)) {
      stored.push(email);
      localStorage.setItem("dinr_emails", JSON.stringify(stored));
    }
  } catch (_) {}

  msg.textContent = "✅ ممنون! ایمیل شما ثبت شد.";
  msg.classList.add("ok");
  input.value = "";
  return false;
}
