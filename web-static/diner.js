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

async function showDiner(sub) {
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
