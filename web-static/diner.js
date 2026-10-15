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

const DINER_NEWS_FILTERS=[['all','همهٔ خبرها'],['restaurant','رستوران‌داری'],['cafe','کافه و نوشیدنی'],['menu','منو و مهندسی منو'],['ai','هوش مصنوعی و فناوری'],['operations','عملیات و مدیریت']];
const DINER_NEWS_TOPICS=new Set(['qsr_fast_food','fast_casual','restaurant_operations','restaurant_industry','menu_product_innovation','restaurant_technology_ai','equipment_automation','food_cost_pricing','supply_chain','food_safety','labor_management','franchising','delivery_drive_thru','consumer_behavior','marketing_branding','restaurant_design_decor','beverage','ingredients_rd']);
let _dinerNewsRows=[],_dinerNewsFilter='all',_dinerNewsLimit=12;
function dinerNewsMatches(row,filter='all') {
  const cats=new Set(row.categories||[]),text=[row.title_fa,row.title_en,row.title,row.summary_fa,row.summary].filter(x=>typeof x==='string').join(' ');
  const has=values=>values.some(c=>cats.has(c));
  const cafe=/کافه|کافی.?شاپ|قهوه|باریستا|اسپرسو|\b(caf[eé]|coffee|barista|espresso)\b/i.test(text);
  const menu=/مهندسی.?منو|\bmenu\b|منو|بهای.?تمام|حاشیه.?سود|food.?cost/i.test(text);
  const ai=cats.has('restaurant_technology_ai')||/هوش.?مصنوعی|\bAI\b|artificial intelligence|machine learning/i.test(text);
  const relevant=has([...DINER_NEWS_TOPICS])||cafe||menu||ai;
  if(!relevant)return false;
  if(filter==='all')return true;
  if(filter==='cafe')return cafe||cats.has('beverage');
  if(filter==='menu')return menu||has(['menu_product_innovation','food_cost_pricing']);
  if(filter==='ai')return ai||cats.has('equipment_automation');
  if(filter==='restaurant')return has(['qsr_fast_food','fast_casual','restaurant_operations','restaurant_industry','franchising','delivery_drive_thru']);
  if(filter==='operations')return has(['restaurant_operations','labor_management','food_safety','equipment_automation','supply_chain','food_cost_pricing']);
  return false;
}
function dinerNewsCard(row) {
  const story=MARKET_FOOD_BASE+'story.html?id='+encodeURIComponent(row.id),original=mfUrl(row.url);
  const topics=(row.categories||[]).filter(c=>MARKET_FOOD_LABELS[c]).slice(0,3);
  return `<article class="diner-news-card"><div class="diner-news-meta"><span>${esc(row.source?.name||'نام رسانه در خوراک مشخص نیست')}</span><time datetime="${esc(row.published_at)}">${esc(new Date(row.published_at).toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'}))}</time></div><h3><a href="${esc(story)}" target="_blank" rel="noopener noreferrer">${esc(row.title_fa)}</a></h3><div class="diner-news-topics">${topics.map(c=>`<span>${esc(MARKET_FOOD_LABELS[c])}</span>`).join('')}</div><div class="diner-news-links"><a href="${esc(story)}" target="_blank" rel="noopener noreferrer">مشاهدهٔ خبر و ترجمه ↗</a>${original?`<a href="${esc(original)}" target="_blank" rel="noopener noreferrer">خبر اصلی ↗</a>`:''}</div></article>`;
}
function renderDinerNewsList() {
  const host=document.getElementById('diner-news');if(!host)return;
  const rows=_dinerNewsRows.filter(r=>dinerNewsMatches(r,_dinerNewsFilter));
  host.innerHTML=`<div class="diner-news-head"><div><span class="retro-eyebrow-dark">رادار خبرهای صنعت</span><h2 class="retro-h2">خبرهای رستوران، کافه، منو و فناوری</h2><p>خبرهای قابل انتشار در ۳۰ روز اخیر · ${esc(faN(rows.length))} خبر در این فهرست</p></div><a href="${MARKET_FOOD_BASE}explore.html#feed" target="_blank" rel="noopener noreferrer">رادار کامل Food Intel ↗</a></div><nav class="diner-news-filters" aria-label="موضوع خبرهای داینر">${DINER_NEWS_FILTERS.map(([id,label])=>`<button type="button" aria-pressed="${id===_dinerNewsFilter}" onclick="setDinerNewsFilter('${id}')">${esc(label)}</button>`).join('')}</nav><div class="diner-news-list">${rows.slice(0,_dinerNewsLimit).map(dinerNewsCard).join('')||'<p class="muted">در این موضوع خبر تازهٔ قابل انتشار ثبت نشده است.</p>'}</div>${rows.length>_dinerNewsLimit?'<button type="button" class="diner-news-more" onclick="showMoreDinerNews()">نمایش خبرهای بیشتر</button>':''}<p class="diner-news-credit">گردآوری و ترجمه: <a href="${MARKET_FOOD_BASE}" target="_blank" rel="noopener noreferrer">Food Intel</a> · <a href="${MARKET_FOOD_BASE}data/news.json" target="_blank" rel="noopener noreferrer">خوراک JSON</a>. نام رسانه، تاریخ و لینک خبر اصلی همراه هر خبر آمده است.</p>`;
}
function setDinerNewsFilter(filter) {
  if(!DINER_NEWS_FILTERS.some(([id])=>id===filter))return;
  _dinerNewsFilter=filter;_dinerNewsLimit=12;renderDinerNewsList();
}
function showMoreDinerNews() { _dinerNewsLimit+=12;renderDinerNewsList(); }
async function renderDinerNews() {
  const host=document.getElementById('diner-news');if(!host)return;
  try {
    const data=await loadMarketFoodData();if(!host.isConnected)return;
    _dinerNewsRows=mfPublishedNews(data,30).filter(r=>dinerNewsMatches(r));
    renderDinerNewsList();
  } catch {
    if(host.isConnected)host.innerHTML=`<h2 class="retro-h2">خبرهای رستوران و کافه</h2><p>خبرها فعلاً دریافت نشدند.</p><button type="button" class="diner-news-more" onclick="renderDinerNews()">تلاش دوباره</button> <a href="${MARKET_FOOD_BASE}explore.html#feed" target="_blank" rel="noopener noreferrer">مشاهدهٔ رادار خبرها ↗</a>`;
  }
}

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
  {
    "src": "assets/retro/01-construction.jpg",
    "caption": "آغاز بازسازی و آماده‌سازی سالن",
    "phase": "ساخت"
  },
  {
    "src": "assets/retro/02-counter.jpg",
    "caption": "ساخت کانتر چوبی و کاشی‌کاری دیوار",
    "phase": "ساخت"
  },
  {
    "src": "assets/retro/03-neon-sign.jpg",
    "caption": "تابلوی نئون قرمز و فیروزه‌ای نمای رترو",
    "phase": "هویت بصری"
  },
  {
    "src": "assets/retro/04-counter-finished.jpg",
    "caption": "کانتر و نورپردازی داخلی پس از تکمیل",
    "phase": "فضای نهایی"
  },
  {
    "src": "assets/retro/05-diner-interior.jpg",
    "caption": "سالن با کف شطرنجی و صندلی‌های قرمز",
    "phase": "فضای نهایی"
  },
  {
    "src": "assets/retro/06-red-seating.jpg",
    "caption": "نشیمن قرمز و دیوار فیروزه‌ای",
    "phase": "فضای نهایی"
  },
  {
    "src": "assets/retro/07-storefront.jpg",
    "caption": "نمای شب و سردر هات‌داگ رترو",
    "phase": "افتتاح"
  },
  {
    "src": "assets/retro/08-glass-door.jpg",
    "caption": "هویت بصری روی شیشهٔ ورودی",
    "phase": "هویت بصری"
  },
  {
    "src": "assets/retro/09-packaging.jpg",
    "caption": "جعبه‌های بسته‌بندی و نان‌های آمادهٔ سرو",
    "phase": "عملیات"
  },
  {
    "src": "assets/retro/10-artwork.jpg",
    "caption": "نقاشی دست‌ساز با حال‌وهوای رترو",
    "phase": "جزئیات"
  },
  {
    "src": "assets/retro/11-menu.jpg",
    "caption": "منوی تصویری هات‌داگ، برگر و سیب‌زمینی",
    "phase": "منو"
  }
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
          <img src="${esc(p.src)}" alt="${esc(p.caption || "هات‌داگ رترو")}" loading="lazy" onerror="this.closest(\'figure\').remove()">
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
        <a class="diner-profile-feature" href="/@soufia-abdollahi/"><span>صوفیا عبداللهی در پندار</span><strong>پروفایل، فعالیت‌ها و مطالب صوفیا ←</strong></a>
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
  if (sub === "recipes") return showDinerRecipes();
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
        <h1 class="diner-title">🍽 داینر نیما</h1><p><a class="diner-social-btn diner-contact" href="/diner/recipes/" onclick="event.preventDefault();showDinerRecipes()">📖 کتابخانه رسپی داینر ←</a></p>
        <p class="diner-subtitle">نکته‌های کاربردی رستوران‌داری و کافه‌داری — از تجربه واقعی</p>
        <a class="diner-profile-feature" href="/@nima-afshar-naderi/"><span>نیما افشارنادری در پندار</span><strong>پروفایل، فعالیت‌ها و مطالب نیما ←</strong></a>
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

    <section class="diner-reel" aria-labelledby="diner-reel-h">
      <div class="diner-reel-video">
        <video controls playsinline preload="none" poster="assets/diner/foodcost-pizza.jpg" width="720" height="1280">
          <source src="assets/diner/foodcost-pizza.mp4" type="video/mp4">
        </video>
      </div>
      <div class="diner-reel-text">
        <span class="diner-reel-tag">ویدئوی تازهٔ داینر</span>
        <h2 id="diner-reel-h" class="retro-h2">پیتزای ۱٬۱۵۰٬۰۰۰ تومنی، چقدر سود داره؟</h2>
        <p>پیتزا رو ۱٬۱۵۰٬۰۰۰ تومن می‌فروشی و مواد اولیه‌ش ۴۰۰ هزار تومن درمیاد. اون ۷۵۰ هزار تومن سود خالص نیست؛ هنوز اجاره، حقوق و بیمه، آب و برق و گاز، بسته‌بندی، ضایعات، استهلاک و کمیسیون پلتفرم‌های آنلاین مونده.</p>
        <p class="diner-reel-formula"><span style="white-space:nowrap">فودکاست٪ =</span> هزینه مواد اولیه ÷ <span style="white-space:nowrap">قیمت فروش × ۱۰۰</span><br>۴۰۰٬۰۰۰ ÷ ۱٬۱۵۰٬۰۰۰ ≈ ۳۵٪</p>
        <p>فودکاست پایین به‌تنهایی سود نمیاره: یه رستوران با فودکاست ۳۰٪ ممکنه ضرر بده و یکی دیگه با ۴۰٪ سودآور باشه. <strong>فروش بالا لزوماً یعنی سود بالا نیست.</strong></p>
        <a href="${DINER_IG}" target="_blank" rel="noopener" class="diner-social-btn diner-ig">ویدئوهای بیشتر در اینستاگرام</a>
      </div>
    </section>

    <section class="diner-news" id="diner-news" aria-live="polite"><h2 class="retro-h2">خبرهای رستوران، کافه، منو و فناوری</h2><p class="muted">در حال دریافت خبرها…</p></section>

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
    <section class="diner-soufia-credit"><h2 class="retro-h2">سس‌های صوفیا</h2><p>محصولات تخمیری، سس‌های اختصاصی و رلیش‌های ویژهٔ صوفیا عبداللهی؛ همکار طعم هات‌داگ رترو.</p><a class="diner-profile-feature" href="/@soufia-abdollahi/"><span>صوفیا عبداللهی در پندار</span><strong>پروفایل، فعالیت‌ها و مطالب صوفیا ←</strong></a></section>

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
  renderDinerNews();
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

/* Public, integrated recipe catalog — intentionally separate from private source PDFs. */
async function showDinerRecipes(){
  setHash("#/diner/recipes");
  show("diner");
  setTab("");
  document.title="کتابخانه رسپی داینر | پندار";
  const root=document.getElementById("diner-content");
  root.replaceChildren();
  const wrap=document.createElement("div");wrap.className="diner-recipe-lab";
  const heading=document.createElement("h1");heading.textContent="کتابخانه رسپی داینر";
  const description=document.createElement("p");description.textContent="دستورهای پژوهشی همراه منابع، مواد اولیه و توضیح وضعیت اعتبارسنجی؛ هنوز آزمون آشپزخانه نشده‌اند.";
  const link=document.createElement("a");link.href="/diner/";link.textContent="← بازگشت به داینر نیما";
  const input=document.createElement("input");input.type="search";input.placeholder="جست‌وجوی غذا و مواد اولیه…";input.setAttribute("aria-label","جست‌وجوی رسپی");
  const panels=document.createElement("div");panels.className="diner-recipes-grid";
  const list=document.createElement("nav");list.className="diner-recipes-list";list.setAttribute("aria-label","فهرست غذاها");
  const detail=document.createElement("article");detail.className="diner-recipes-detail";
  const stats=document.createElement("p");stats.className="diner-recipes-note";stats.textContent="در حال بارگذاری…";
  const filters=document.createElement("div");filters.className="diner-recipe-filters";
  const categoryFilter=document.createElement("select"),sourceFilter=document.createElement("select"),regionFilter=document.createElement("select");
  for(const [control,label] of [[categoryFilter,"همه انواع غذا"],[sourceFilter,"همه منابع"],[regionFilter,"همه مناطق منبع"]]){control.setAttribute("aria-label",label);const opt=document.createElement("option");opt.value="";opt.textContent=label;control.append(opt);filters.append(control)}
  panels.append(list,detail);wrap.append(link,heading,description,stats,input,filters,panels);root.append(wrap);
  const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n};
  try {
    // Public data is updated independently; the bundled fallback keeps the view usable.
    const fallback={"sources":[{"id":"S001","title":"کتاب مستطاب آشپزی از سیر تا پیاز، جلد دوم","author":"نجف دریابندری؛ فهیمه راستکار","pages":981},{"id":"S002","title":"سانازسانیا: دایرةالمعارف ابزار و مواد اولیه","author":"ساناز مینایی و همکاران","pages":418},{"id":"S003","title":"هنر آشپزی","author":"رزا منتظمی","pages":842},{"id":"S004","title":"آشپزی کردستان","author":"گروه نویسندگان","pages":594},{"id":"S005","title":"آشپزی دوره صفوی: متن دو رساله","author":"به کوشش ایرج افشار","pages":283},{"id":"S006","title":"آشپزی گیاهی","author":"روحینی قیصری","pages":225},{"id":"S007","title":"مبانی آشپزی","author":"حسن شاهی‌آذر","pages":403},{"id":"S008","title":"آشپزی با مایکروفر","author":"مهری رازی","pages":471},{"id":"S009","title":"ماهنامه آشپزباشی: ویژه شب یلدا","author":"ماهنامه آشپزباشی","pages":22},{"id":"S010","title":"سفره اطعمه","author":"میرزا علی‌اکبرخان آشپزباشی","pages":127},{"id":"S011","title":"آموزش آشپزی غذاهای آماده و فوری","author":"نامشخص","pages":352},{"id":"S012","title":"شربت‌ها از دیدگاه طب ایرانی سنتی","author":"سیدمحمد موسوی","pages":71},{"id":"S013","title":"شربت‌های ایرانی و نوشیدنی‌های سنتی","author":"فاطمه ماهوان","pages":119}],"recipes":[{"name":"خوراک ماهیچه","source":"S001","pages":"صفحات PDF ۱۱ و ۱۲؛ چاپی ۹۹۵ و ۹۹۶","status":"پژوهشی · آزمون‌نشده","ingredients":[["ماهیچه با استخوان","۵۰۰ گرم"],["پیاز","۱ عدد"],["جعفری","۱ دسته"],["زردچوبه","۱ تا ۲ قاشق چای‌خوری"],["نمک و فلفل","به میزان لازم"],["آب","۲ لیتر"]],"method":"ماهیچه با پیاز و جعفری در دو لیتر آب به جوش می‌آید و سپس با حرارت کم پخته می‌شود. حدود سه ساعت بعد، استخوان جدا می‌شود و گوشت همراه با نمک، فلفل و زردچوبه کمی بیشتر می‌پزد تا عصاره کاهش یابد؛ آب گوشت کنار ماهیچه سرو می‌شود.","notes":"زمان پخت، افت وزن، دمای نهایی و بازده در آشپزخانه آزمایش نشده‌اند."},{"name":"دست‌پیچ با سس پرتقال (انگلستان)","source":"S001","pages":"صفحه PDF ۱۲؛ چاپی ۹۹۶","status":"استخراج ناقص · آزمون‌نشده","ingredients":[["سینه گوساله بی‌استخوان","۲ کیلوگرم"],["گرد نان","۱ پیمانه"],["کشمش بی‌دانه","۱ پیمانه"],["مغز گردوی نیم‌کوب","نصف پیمانه"],["تخم‌مرغ سفت خردشده","۲ عدد"],["پیاز رنده‌شده","۱ عدد"],["پرتقال پوست‌گرفته","۲ عدد"],["آرد","۲ قاشق غذاخوری"],["کره","۱ تا ۲ تکه به اندازه گردو"]],"method":"مواد میانی در گوشت قرار می‌گیرند، گوشت پیچیده و پخته می‌شود؛ سس پرتقال جداگانه آماده می‌شود. ادامه دستور هنوز از صفحات بعدی استخراج نشده است.","notes":"دستور ناقص است و برای پخت عملی یا قیمت‌گذاری قابل اتکا نیست."},{"name":"اردور ژامبون اسلامی با اسفناج","source":"S003","pages":"صفحه PDF ۱۷؛ چاپی ۱۹","status":"پژوهشی · آزمون‌نشده","ingredients":[["ورقه ژامبون نازک","۶ ورقه"],["اسفناج","۲ کیلوگرم"],["تخم‌مرغ سفت","۴ عدد"],["سیر","۲ تا ۳ حبه"],["کره","۱۰۰ گرم"],["پیاز خلال‌شده","۳ تا ۴ قاشق غذاخوری"],["آرد گندم","۱ قاشق غذاخوری"],["نمک و فلفل","به میزان لازم"]],"method":"اسفناج شسته و آماده می‌شود و با پیاز، سیر و کره ترکیب می‌شود. بخشی با آرد به‌عنوان پایه سرو استفاده می‌شود و باقی همراه تخم‌مرغ در ورقه‌های ژامبون رول می‌شود. منبع گرم‌کردن کوتاه در فر ملایم را هم مطرح می‌کند.","notes":"زمان و دمای فر، وزن پرس و استاندارد اجرایی هنوز مشخص و آزموده نشده‌اند."}]};
    let db=fallback;
    try {
      const response=await fetch("/data/recipe-lab-public.json",{cache:"no-store"});
      if(response.ok){
        const loaded=await response.json();
        if(Array.isArray(loaded.sources)&&Array.isArray(loaded.recipes)&&loaded.recipes.length>0)db=loaded;
      }
    } catch(error){console.warn("Recipe Lab using local fallback",error)}

    if(!Array.isArray(db.sources)||!Array.isArray(db.recipes))throw new Error("Invalid catalog");
    const source=id=>db.sources.find(s=>s.id===id)?.title||id;
    stats.textContent=db.sources.length.toLocaleString("fa-IR")+" منبع · "+db.recipes.length.toLocaleString("fa-IR")+" دستور پژوهشی · صفر دستور آزمون‌شده";
    const addOptions=(control,values)=>{for(const value of [...new Set(values)].sort((a,b)=>a.localeCompare(b,"fa"))){const opt=document.createElement("option");opt.value=value;opt.textContent=value;control.append(opt)}};
    addOptions(categoryFilter,db.recipes.map(r=>r.category||"سایر / نیازمند بررسی"));
    addOptions(sourceFilter,db.recipes.map(r=>r.source));
    for(const opt of sourceFilter.options){if(opt.value)opt.textContent=source(opt.value)}
    addOptions(regionFilter,db.recipes.map(r=>r.source_region||"منبع نامشخص"));
    categoryFilter.onchange=sourceFilter.onchange=regionFilter.onchange=renderList;
    let selected=0;
    function showRecipe(i){
      selected=i;const r=db.recipes[i];if(!r)return;
      detail.replaceChildren();
      const label=make("span",r.status);label.className="diner-recipe-pill";
      detail.append(label,make("h2",r.name),make("p",(r.category||"سایر / نیازمند بررسی")+" · "+(r.source_region||"منبع نامشخص")+" · "+source(r.source)+" — "+r.pages));
      const portionPanel=document.createElement("div");portionPanel.className="diner-recipe-portions";
      let ratio=1;
      const documented=Number.isInteger(r.yield_portions)&&r.yield_portions>0;
      if(documented){
        const portionsLabel=make("label","تعداد پرس موردنظر (مبنای منبع: "+r.yield_portions.toLocaleString("fa-IR")+" پرس)");
        const portionsInput=document.createElement("input");portionsInput.type="number";portionsInput.min="1";portionsInput.max="100";portionsInput.step="1";portionsInput.value=String(r.yield_portions);
        portionsInput.setAttribute("aria-label","تعداد پرس");
        portionPanel.append(portionsLabel,portionsInput);
        portionsInput.oninput=()=>{const n=Number(portionsInput.value);ratio=Number.isInteger(n)&&n>=1&&n<=100?n/r.yield_portions:1;updateIngredients();recalcCost()};
      }else{
        portionPanel.append(make("p",r.yield_range?"منبع تعداد پرس را به‌صورت بازه بیان کرده است؛ تبدیل خودکار فعال نیست.":r.yield_volume_l?"خروجی برحسب حجم است، نه پرس؛ تبدیل خودکار فعال نیست.":"تعداد پرس در منبع مشخص نیست؛ تبدیل خودکار فعال نیست."));
      }
      detail.append(portionPanel,make("h3","مواد اولیه"));
      const table=make("table");const tbody=make("tbody");
      const normaliseDigits=text=>String(text).replace(/[۰-۹]/g,c=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٠-٩]/g,c=>String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
      const scaledAmount=(raw)=>{
        // Only convert exact weights and volumes; never guess counts, ranges, cups or "as needed".
        const m=normaliseDigits(raw).trim().match(/^(\d+(?:[.,]\d+)?)\s*(گرم|کیلوگرم|لیتر|میلی‌لیتر)$/);
        if(!m)return null;
        const quantity=Number(m[1].replace(",","."));
        if(!Number.isFinite(quantity))return null;
        const value=Math.round(quantity*ratio*100)/100;
        return value.toLocaleString("fa-IR",{maximumFractionDigits:2})+" "+m[2];
      };
      function updateIngredients(){
        tbody.replaceChildren();
        for(const ing of r.ingredients){
          const tr=make("tr"),changed=documented&&ratio!==1?scaledAmount(ing[1]):null;
          tr.append(make("td",ing[0]),make("td",changed||ing[1]+(documented&&ratio!==1?" (بدون تبدیل)":"")));
          tbody.append(tr);
        }
      }
      updateIngredients();table.append(tbody);
      detail.append(table);
      // Optional manual costing: no external prices, no persistence and no guessed costs.
      const costBox=make("section");costBox.className="diner-recipe-cost";
      costBox.append(make("h3","برآورد اختیاری بهای مواد"));
      costBox.append(make("p","قیمت هر کیلوگرم را به تومان وارد کنید. فقط مواد دارای وزن دقیق و قیمت واردشده محاسبه می‌شوند؛ این جمع، بهای تمام‌شده کامل غذا نیست."));
      const costRows=[],costTable=make("table"),costBody=make("tbody");
      const total=make("p","هنوز قیمتی وارد نشده است.");total.className="diner-recipe-cost-total";
      for(const ing of r.ingredients){
        const amount=normaliseDigits(ing[1]).trim().match(/^(\\d+(?:[.,]\\d+)?)\\s*(گرم|کیلوگرم)$/);
        if(!amount)continue;
        const quantityKg=Number(amount[1].replace(",","."))*(amount[2]==="گرم"?0.001:1);
        if(!Number.isFinite(quantityKg)||quantityKg<=0)continue;
        const tr=make("tr"),cell=make("td",ing[0]+" ("+ing[1]+")"),priceCell=make("td");
        const price=document.createElement("input");price.type="number";price.min="0";price.step="any";price.placeholder="تومان / کیلو";price.setAttribute("aria-label","قیمت هر کیلو "+ing[0]);
        priceCell.append(price);tr.append(cell,priceCell);costBody.append(tr);costRows.push({price,quantityKg});
      }
      function recalcCost(){
        let sum=0,count=0;
        for(const row of costRows){
          const raw=row.price.value.trim();if(!raw)continue;
          const val=Number(raw);if(!Number.isFinite(val)||val<0)continue;
          sum+=val*row.quantityKg*ratio;count++;
        }
        const fmt=n=>Math.round(n).toLocaleString("fa-IR");
        if(!count){total.textContent="هنوز قیمتی وارد نشده است.";return}
        const partial=count<r.ingredients.length;
        total.textContent="جمع مواد قیمت‌گذاری‌شده: "+fmt(sum)+" تومان"+(documented?" · به‌ازای هر پرس: "+fmt(sum/(r.yield_portions*ratio))+" تومان":"")+(partial?" · محاسبه ناقص است.":"");
      }
      costRows.forEach(x=>x.price.oninput=recalcCost);
      if(costRows.length){costTable.append(costBody);costBox.append(costTable,total)}
      else costBox.append(make("p","این رسپی مقدار وزنی دقیق قابل قیمت‌گذاری ندارد."));
      detail.append(costBox,make("h3","خلاصه روش تهیه"),make("p",r.method),make("h3","نکته پژوهشی"),make("p",r.notes));
      const btn=make("button","چاپ رسپی‌کارت");btn.type="button";btn.onclick=()=>window.print();detail.append(btn);
      renderList();
    }
    function renderList(){
      list.replaceChildren();const q=input.value.trim();
      db.recipes.forEach((r,i)=>{
        const match=[r.name,r.method,source(r.source),...r.ingredients.map(x=>x[0])].join(" ");
        if(q&&!match.includes(q))return;
        if(categoryFilter.value&&(r.category||"سایر / نیازمند بررسی")!==categoryFilter.value)return;
        if(sourceFilter.value&&r.source!==sourceFilter.value)return;
        if(regionFilter.value&&(r.source_region||"منبع نامشخص")!==regionFilter.value)return;
        const btn=make("button",r.name);btn.type="button";btn.className=i===selected?"selected":"";
        const subtitle=make("small",source(r.source));btn.append(subtitle);btn.onclick=()=>showRecipe(i);list.append(btn);
      });
      if(!list.children.length)list.append(make("p","نتیجه‌ای یافت نشد."));
    }
    input.oninput=renderList;showRecipe(0);
  } catch(e){stats.textContent="بارگذاری رسپی‌ها انجام نشد. لطفاً دوباره تلاش کنید.";console.warn("Recipe Lab:",e)}
  window.scrollTo(0,0);
}
