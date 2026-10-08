/* Pendar — press/periodicals (مطبوعات): the PRESS_SOURCES directory, press
   state + caches, scope/kind/language filters, source pages, health/stats,
   event cards and the press-article reader. Extracted from app.js; loaded as
   a classic script BEFORE app.js because a deep-link boot can route() into
   showPress/openPressArticle, and entity/search code calls them too. All
   app.js helpers it uses (show, setTab, avatar, openFigure) run at runtime,
   after every script has loaded. No behavior change. */

let periodicalRows = [];
let pressScope = "all";
let pressLanguage = "all";
let pressKind = "all";
let pressSourceTab = "latest";
let pressSourceCurrent = "";
let pressStatsCache = null;
let pressHealthCache = null;
let pressDirectoryCache = null;

const PRESS_SOURCES = [
  // خبرگزاری‌ها و رسانه‌های خبری داخل ایران
  {name:"ایرنا", aliases:["خبرگزاری ایرنا (IRNA)"], domain:"irna.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"ایسنا", aliases:["خبرگزاری ایسنا (ISNA)"], domain:"isna.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"مهر", aliases:["خبرگزاری مهر (Mehr)"], domain:"mehrnews.com", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"فارس", aliases:["خبرگزاری فارس (Fars)"], domain:"farsnews.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"خبرگزاری صداوسیما", domain:"iribnews.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"باشگاه خبرنگاران جوان", domain:"yjc.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"خبرآنلاین", domain:"khabaronline.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"تابناک", domain:"tabnak.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"فرارو", domain:"fararu.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"انتخاب", domain:"entekhab.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"عصر ایران", domain:"asriran.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"فردانیوز", domain:"fardanews.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"رویداد۲۴", domain:"rouydad24.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"آفتاب‌نیوز", domain:"aftabnews.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"مشرق نیوز", domain:"mashreghnews.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"انصاف نیوز", domain:"ensafnews.com", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},

  // کانال‌ها و پادکست‌های ویدئویی
  {name:"Chanteh Podcast", aliases:["چنته پادکست"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"پادکست ویدئویی"},
  {name:"Zabane.z", domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال ویدئویی"},
  {name:"۷ آبان", aliases:["7Aban_h","7Aban"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال ویدئویی"},
  {name:"Ivar Farhadi", aliases:["ایوار فرهادی"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال شخصی"},
  {name:"فرهیختگان آنلاین", aliases:["Farhikhtegan Online"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه ویدئویی", description:"بخش آنلاین و ویدئویی روزنامهٔ فرهیختگان."},
  {name:"Manoto TV", aliases:["من‌وتو","من و تو"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"شبکه ویدئویی"},
  {name:"سیمرغ فیوچرز", aliases:["Cimorg Futures"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه آینده‌پژوهی", description:"رسانهٔ ویدئویی با تمرکز بر آینده‌پژوهی و گفت‌وگو."},
  {name:"Persian Clubhouse", domain:"youtube.com", scope:"youtube", lang:"fa", type:"گفت‌وگو و کلاب‌هاوس"},
  {name:"Baziya (Ali Zia)", aliases:["Baziya","بازیا","علی ضیا"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"تاک‌شو ویدئویی"},
  {name:"Rok Show", domain:"youtube.com", scope:"youtube", lang:"fa", type:"برنامه ویدئویی"},
  {name:"Pump VOD", domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه ویدئویی"},
  {name:"استودیو پات", aliases:["Studio Patt"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"استودیو و رسانهٔ ویدئویی با گفت‌وگوها و مهمانان متعدد."},
  {name:"فیوز پادکست", aliases:["Fuse Podcast"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"پادکست گفت‌وگومحور", description:"پادکست ویدئویی به میزبانی آرش نعل‌چگر با مهمانان مختلف."},
  {name:"افق فردا", aliases:["Tomorrow’s Horizon","Tomorrow's Horizon"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"رسانهٔ ویدئویی با گفت‌وگوها و حاضرین متعدد."},
  {name:"فیلم سجاد نی", aliases:["Sajadni Movies"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"کانال سینمایی", description:"کانال ویدئویی سجاد نی دربارهٔ سینما و موضوعات مرتبط."},
  {name:"خیابان جمهوری", aliases:["Jomhouri Street"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"کانال گفت‌وگومحور با مهمانان مختلف."},
  {name:"جدال", aliases:["Jedaal","Jedaal Farsi"], domain:"jedaal.tv", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"رسانهٔ علی علیزاده؛ شامل برنامه‌های تحلیلی و گفت‌وگو با مهمانان."},
  {name:"سیمرغ طلایی", aliases:["Golden Simorgh","GoldenSimorgh"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه گفت‌وگومحور", description:"کانال ویدئویی گفت‌وگو و تحلیل با مهمانان و صاحب‌نظران."},
  {name:"تلویزیون هوش مصنوعی سیمرغ", aliases:["Simorgh AI TV"], domain:"youtube.com", scope:"youtube", lang:"fa", type:"رسانه فناوری و ویدئویی", description:"کانال ویدئویی جامعهٔ هوش مصنوعی ایران."},

  // روزنامه‌ها و مطبوعات داخل ایران
  {name:"همشهری", aliases:["همشهری آنلاین"], domain:"hamshahrionline.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"پیام ما", aliases:["روزنامه پیام‌ما"], domain:"payamema.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"شرق", domain:"sharghdaily.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"اعتماد", domain:"etemadonline.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"دنیای اقتصاد", domain:"donya-e-eqtesad.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"اطلاعات", domain:"ettelaat.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"کیهان", domain:"kayhan.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"جمهوری اسلامی", domain:"jomhourieslami.net", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"هم‌میهن", domain:"hammihanonline.ir", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  {name:"سازندگی", domain:"sazandeginews.com", scope:"iran-paper", lang:"fa", type:"روزنامه"},
  // مجلات و فصلنامه‌های ایرانی
  {name:"تجربه", aliases:["مجله تجربه","ماهنامه تجربه"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"ماهنامه فرهنگی و هنری"},
  {name:"آنگاه", aliases:["مجله آنگاه","فصلنامه آنگاه"], domain:"angahmag.com", scope:"iran-magazine", lang:"fa", type:"فصلنامه فرهنگی و هنری"},
  {name:"تراژدی", aliases:["مجله تراژدی"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"روزآروز", aliases:["مجله روزآروز","روز آ روز"], domain:"roozarooz.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"بخارا", aliases:["مجله بخارا"], domain:"bukharamag.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"تنور", aliases:["مجله تنور"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"ناداستان", aliases:["مجله ناداستان"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله روایت و ادبیات غیرداستانی"},
  {name:"عصر اندیشه", aliases:["مجله عصر اندیشه"], domain:"asreandisheh.ir", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه و علوم انسانی"},
  {name:"شهریور", aliases:["مجله شهریور"], domain:"shahrivar.org", scope:"diaspora", lang:"fa", type:"مجله فارسی‌زبان خارج از ایران"},
  {name:"اندیشه پویا", aliases:["مجله اندیشه پویا"], domain:"andishepooya.ir", scope:"iran-magazine", lang:"fa", type:"ماهنامه فرهنگی و سیاسی"},
  {name:"مروارید", aliases:["مجله مروارید"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"غروب", aliases:["مجله غروب"], domain:"goroobonline.ir", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و تاریخی"},
  {name:"تجربه و شهر", aliases:["مجله تجربه و شهر"], domain:"goroobonline.ir", scope:"iran-magazine", lang:"fa", type:"مجله شهر و فرهنگ"},
  {name:"هنر و جامعه", aliases:["مجله هنر و جامعه"], domain:"goroobonline.ir", scope:"iran-magazine", lang:"fa", type:"مجله هنر و جامعه"},
  {name:"روزنامک", aliases:["ماهنامه روزنامک"], domain:"rooznamak-magazine.com", scope:"iran-magazine", lang:"fa", type:"ماهنامه فرهنگی و تاریخی"},
  {name:"فیلم", aliases:["مجله فیلم"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله سینمایی"},
  {name:"فیلم امروز", aliases:["مجله فیلم امروز"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله سینمایی"},
  {name:"شبکه آفتاب", aliases:["مجله شبکه آفتاب"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و اجتماعی"},
  {name:"سان", aliases:["مجله سان"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"معمار", aliases:["مجله معمار"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله معماری"},
  {name:"چشم‌انداز ایران", aliases:["چشم انداز ایران","مجله چشم انداز ایران"], domain:"meisami.net", scope:"iran-magazine", lang:"fa", type:"دوماهنامه سیاسی و راهبردی"},
  {name:"آزما", aliases:["مجله آزما"], domain:"azmaonline.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"کتاب‌نامه", aliases:["کتابنامه","مجله کتاب نامه"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله کتاب و نشر"},
  {name:"نگاه نو", aliases:["مجله نگاه نو"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و اجتماعی"},
  {name:"مدام", aliases:["مجله مدام"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"سیاست‌نامه", aliases:["سیاست نامه","مجله سیاست نامه"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه و سیاست"},
  {name:"خردورزی", aliases:["مجله خردورزی"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه"},
  {name:"دوباره", aliases:["مجله دوباره"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"صنوبر", aliases:["مجله صنوبر"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"آگاهی نو", aliases:["مجله آگاهی نو"], domain:"agahino.com", scope:"iran-magazine", lang:"fa", type:"مجله علوم انسانی و اندیشه"},
  {name:"مترجم", aliases:["مجله مترجم"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله ترجمه"},
  {name:"پوشه", aliases:["مجله پوشه"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"فردان", aliases:["مجله فردان"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"سخن سیاووشان", aliases:["مجله سخن سیاووشان"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"زنده‌رود", aliases:["زنده رود","مجله زنده رود"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله ادبی و فرهنگی"},
  {name:"خاطرات سیاسی", aliases:["مجله خاطرات سیاسی"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله تاریخ و سیاست"},
  {name:"سمرقند", aliases:["مجله سمرقند"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"سیزده", aliases:["مجله سیزده"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"حوالی", aliases:["مجله حوالی"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"قلم یاران", aliases:["مجله قلم یاران"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و اندیشه"},
  {name:"نقد اندیشه", aliases:["مجله نقد اندیشه"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله اندیشه"},
  {name:"چارسو", aliases:["مجله چارسو"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},
  {name:"کتابنامه آگاهی نو", aliases:["کتاب‌نامه آگاهی نو","کتاب نامه آگاهی نو"], domain:"agahino.com", scope:"iran-magazine", lang:"fa", type:"مجله کتاب و اندیشه"},
  {name:"گواه", aliases:["مجله گواه"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"رود", aliases:["مجله رود"], domain:"taaghche.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و ادبی"},
  {name:"وزن دنیا", aliases:["مجله وزن دنیا"], domain:"vaznedonya.com", scope:"iran-magazine", lang:"fa", type:"مجله شعر"},
  {name:"سپیده دانایی", aliases:["ماهنامه سپیده دانایی","مجله سپیده دانایی"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"ماهنامه روان‌شناسی و خانواده"},
  {name:"نقطه‌بند", aliases:["نقطه بند","مجله نقطه بند"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"ترجمان", aliases:["ترجمان علوم انسانی","فصلنامه ترجمان"], domain:"tarjomaan.com", scope:"iran-magazine", lang:"fa", type:"فصلنامه علوم انسانی"},
  {name:"انگار", aliases:["مجله انگار"], domain:"magiran.com", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی"},
  {name:"مهرنامه", aliases:["مجله مهرنامه","ماهنامه مهرنامه"], domain:"mehrnameh.ir", scope:"iran-magazine", lang:"fa", type:"ماهنامه علوم انسانی · متوقف‌شده"},
  {name:"دالان", aliases:["مجله دالان","Dalan Magazine"], domain:"dalan.media", scope:"iran-magazine", lang:"fa", type:"مجله فرهنگی و هنری"},

  // رسانه‌های ایرانی غیرفارسی‌زبان؛ در دستهٔ داخل ایران، نه رسانه‌های جهان
  {name:"Press TV", domain:"presstv.ir", scope:"iran-agency", lang:"en", type:"تلویزیون/رسانه خبری"},
  {name:"Tehran Times", domain:"tehrantimes.com", scope:"iran-paper", lang:"en", type:"روزنامه"},
  {name:"Al-Alam", aliases:["العالم"], domain:"alalam.ir", scope:"iran-agency", lang:"ar", type:"تلویزیون/رسانه خبری"},

  // مجلات فارسی‌زبان خارج از ایران
  {name:"فریدون", aliases:["مجله فریدون"], domain:"fereydoun.org", scope:"diaspora", lang:"fa", type:"مجله فارسی‌زبان خارج از ایران"},
  {name:"ایران‌نامه", aliases:["ایران نامه","Iran Namag"], domain:"irannamag.com", scope:"diaspora", lang:"fa", type:"فصلنامه ایران‌شناسی خارج از ایران"},
  {name:"ایران‌شناسی", aliases:["ایران شناسی"], domain:"fis-iran.org", scope:"diaspora", lang:"fa", type:"فصلنامه ایران‌شناسی خارج از ایران"},

  // فارسی‌زبان خارج از ایران
  {name:"خبرگزاری ایرانشهر", domain:"iranshahrnewsagency.com", scope:"diaspora", lang:"fa", type:"خبرگزاری"},
  {name:"استکهلمیان", domain:"stockholmian.com", scope:"diaspora", lang:"fa", type:"رسانه ایرانیان سوئد"},
  {name:"پرژن میرور", domain:"persianmirror.ca", scope:"diaspora", lang:"fa", type:"رسانه ایرانیان کانادا"},
  {name:"مجله جوانان", domain:"javanan.com", scope:"diaspora", lang:"fa", type:"مجله فارسی‌زبان خارج از ایران"},
  {name:"بی‌بی‌سی فارسی", aliases:["بی‌بی‌سی فارسی (BBC Persian)"], domain:"bbc.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"رادیو فردا", domain:"radiofarda.com", scope:"diaspora", lang:"fa", type:"رادیو/آنلاین"},
  {name:"ایران اینترنشنال", aliases:["ایران اینترنشنال (Iran International)"], domain:"iranintl.com", scope:"diaspora", lang:"fa", type:"تلویزیون/آنلاین"},
  {name:"دویچه‌وله فارسی", aliases:["دویچه‌وله فارسی (DW Persian)"], domain:"dw.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"یورونیوز فارسی", domain:"parsi.euronews.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"ایران‌وایر", domain:"iranwire.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"کیهان لندن", domain:"kayhan.london", scope:"diaspora", lang:"fa", type:"روزنامه/آنلاین"},
  {name:"رادیو زمانه", domain:"radiozamaneh.com", scope:"diaspora", lang:"fa", type:"رادیو/آنلاین"},
  {name:"ایندیپندنت فارسی", domain:"independentpersian.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"اخبار روز", domain:"akhbar-rooz.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},

  {name:"ایلنا", domain:"ilna.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"تسنیم", domain:"tasnimnews.com", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"آنا", domain:"ana.ir", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"اقتصادنیوز", domain:"eghtesadnews.com", scope:"iran-agency", lang:"fa", type:"اقتصادی"},
  {name:"اکوایران", domain:"ecoiran.com", scope:"iran-agency", lang:"fa", type:"اقتصادی"},
  {name:"دیپلماسی ایرانی", domain:"irdiplomacy.ir", scope:"iran-agency", lang:"fa", type:"تحلیلی"},
  {name:"جماران", domain:"jamaran.ir", scope:"iran-agency", lang:"fa", type:"رسانه خبری"},
  {name:"میزان", domain:"mizan.news", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"شفقنا فارسی", domain:"fa.shafaqna.com", scope:"iran-agency", lang:"fa", type:"خبرگزاری"},
  {name:"هرانا", domain:"hra-news.org", scope:"iran-agency", lang:"fa", type:"حقوق بشر"},
  {name:"هەنگاو", domain:"hengaw.net", scope:"iran-agency", lang:"fa", type:"حقوق بشر"},
  {name:"گویا نیوز", domain:"news.gooya.com", scope:"diaspora", lang:"fa", type:"رسانه خبری"},
  {name:"ایران امروز", domain:"iran-emrooz.net", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"ایران پرس نیوز", domain:"iranpressnews.com", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"ایران گلوبال", domain:"iranglobal.info", scope:"diaspora", lang:"fa", type:"رسانه آنلاین"},
  {name:"فریدون", domain:"fereydoun.org", scope:"diaspora", lang:"fa", type:"تحلیلی"},
  {name:"ملی-مذهبی", domain:"melimazhabi.com", scope:"diaspora", lang:"fa", type:"تحلیلی"},
  {name:"صدای آمریکا فارسی", domain:"ir.voanews.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"العربیه فارسی", domain:"farsi.alarabiya.net", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"شرق‌الاوسط فارسی", domain:"persian.aawsat.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"اِپُک تایمز فارسی", domain:"persianepochtimes.com", scope:"diaspora", lang:"fa", type:"رسانه بین‌المللی"},
  {name:"آسو", domain:"aasoo.org", scope:"diaspora", lang:"fa", type:"محتوایی/تحلیلی"},
  {name:"Al-Monitor", domain:"al-monitor.com", scope:"world", lang:"en", type:"تحلیلی"},
  {name:"Axios", domain:"axios.com", scope:"world", lang:"en", type:"رسانه خبری"},
  {name:"Bloomberg", domain:"bloomberg.com", scope:"world", lang:"en", type:"خبرگزاری/اقتصادی"},
  {name:"CNBC", domain:"cnbc.com", scope:"world", lang:"en", type:"اقتصادی"},
  {name:"Foreign Affairs", domain:"foreignaffairs.com", scope:"world", lang:"en", type:"مجله تحلیلی"},
  {name:"Foreign Policy", domain:"foreignpolicy.com", scope:"world", lang:"en", type:"مجله تحلیلی"},
  {name:"NPR", domain:"npr.org", scope:"world", lang:"en", type:"رادیو/آنلاین"},
  {name:"Newsweek", domain:"newsweek.com", scope:"world", lang:"en", type:"مجله"},
  {name:"Sky News", domain:"news.sky.com", scope:"world", lang:"en", type:"تلویزیون/آنلاین"},
  {name:"Time", aliases:["تایم"], domain:"time.com", scope:"world", lang:"en", type:"مجله"},
  // رسانه‌های جهان
  {name:"Reuters", domain:"reuters.com", scope:"world", lang:"en", type:"خبرگزاری"},
  {name:"Associated Press", domain:"apnews.com", scope:"world", lang:"en", type:"خبرگزاری"},
  {name:"BBC", domain:"bbc.com", scope:"world", lang:"en", type:"رسانه عمومی"},
  {name:"The Guardian", domain:"theguardian.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"Guardian Weekly", aliases:["هفته‌نامه گاردین"], domain:"theguardian.com", scope:"world", lang:"en", type:"هفته‌نامه"},
  {name:"Financial Times", domain:"ft.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"The Economist", aliases:["اکونومیست"], domain:"economist.com", scope:"world", lang:"en", type:"هفته‌نامه"},
  {name:"The New York Times", domain:"nytimes.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"The Wall Street Journal", aliases:["وال‌استریت ژورنال"], domain:"wsj.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"The Washington Post", domain:"washingtonpost.com", scope:"world", lang:"en", type:"روزنامه"},
  {name:"CNN", domain:"cnn.com", scope:"world", lang:"en", type:"تلویزیون/آنلاین"},
  {name:"Al Jazeera English", aliases:["Al Jazeera"], domain:"aljazeera.com", scope:"world", lang:"en", type:"تلویزیون/آنلاین"},
  // جهان — اسپانیایی
  {name:"El País", domain:"elpais.com", scope:"world", lang:"es", type:"روزنامه"},
  {name:"Agencia EFE", domain:"efe.com", scope:"world", lang:"es", type:"خبرگزاری"},
  {name:"RTVE Noticias", domain:"rtve.es", scope:"world", lang:"es", type:"رسانه عمومی"},
  {name:"BBC Mundo", domain:"bbc.com", scope:"world", lang:"es", type:"رسانه بین‌المللی"},
  {name:"CNN en Español", domain:"cnnespanol.cnn.com", scope:"world", lang:"es", type:"تلویزیون/آنلاین"},
  {name:"DW Español", domain:"dw.com", scope:"world", lang:"es", type:"رسانه بین‌المللی"},
  {name:"France 24 Español", domain:"france24.com", scope:"world", lang:"es", type:"تلویزیون/آنلاین"},
  {name:"El Mundo", domain:"elmundo.es", scope:"world", lang:"es", type:"روزنامه"},
  {name:"La Vanguardia", domain:"lavanguardia.com", scope:"world", lang:"es", type:"روزنامه"},
  {name:"ABC España", domain:"abc.es", scope:"world", lang:"es", type:"روزنامه"},
  {name:"El Confidencial", domain:"elconfidencial.com", scope:"world", lang:"es", type:"رسانه آنلاین"},
  {name:"Clarín", domain:"clarin.com", scope:"world", lang:"es", type:"روزنامه"},
  {name:"La Nación", domain:"lanacion.com.ar", scope:"world", lang:"es", type:"روزنامه"},
  {name:"El Universal México", domain:"eluniversal.com.mx", scope:"world", lang:"es", type:"روزنامه"},
  {name:"NTN24", domain:"ntn24.com", scope:"world", lang:"es", type:"تلویزیون/آنلاین"},
  {name:"Le Monde", domain:"lemonde.fr", scope:"world", lang:"fr", type:"روزنامه"},
  {name:"France 24", domain:"france24.com", scope:"world", lang:"fr", type:"تلویزیون/آنلاین"},
  {name:"RFI", domain:"rfi.fr", scope:"world", lang:"fr", type:"رادیو/آنلاین"},
  {name:"Le Figaro", domain:"lefigaro.fr", scope:"world", lang:"fr", type:"روزنامه"},
  {name:"Libération", domain:"liberation.fr", scope:"world", lang:"fr", type:"روزنامه"},
  {name:"Anadolu Ajansı", domain:"aa.com.tr", scope:"world", lang:"tr", type:"خبرگزاری"},
  {name:"TRT Haber", domain:"trthaber.com", scope:"world", lang:"tr", type:"تلویزیون/آنلاین"},
  {name:"Hürriyet", domain:"hurriyet.com.tr", scope:"world", lang:"tr", type:"روزنامه"},
  {name:"Cumhuriyet", domain:"cumhuriyet.com.tr", scope:"world", lang:"tr", type:"روزنامه"},
  {name:"الجزيرة", domain:"aljazeera.net", scope:"world", lang:"ar", type:"تلویزیون/آنلاین"},
  {name:"العربية", domain:"alarabiya.net", scope:"world", lang:"ar", type:"تلویزیون/آنلاین"},
  {name:"الشرق الأوسط", domain:"aawsat.com", scope:"world", lang:"ar", type:"روزنامه"},
  {name:"Der Spiegel", domain:"spiegel.de", scope:"world", lang:"de", type:"مجله"},
  {name:"Frankfurter Allgemeine", domain:"faz.net", scope:"world", lang:"de", type:"روزنامه"},
  {name:"Süddeutsche Zeitung", domain:"sueddeutsche.de", scope:"world", lang:"de", type:"روزنامه"}
]

const PRESS_SCOPE_FA = {all:"همه", "iran-agency":"رسانه‌های خبری ایران", "iran-paper":"مطبوعات ایران", "iran-magazine":"مجلات ایران", youtube:"ویدئو و پادکست", diaspora:"رسانه‌های فارسی بیرون ایران", world:"رسانه‌های جهان", magazine:"مجلات"};
const PRESS_KIND_FA = {all:"همه", newspaper:"روزنامه‌ها", agency:"خبرگزاری‌ها", magazine:"مجلات", podcast:"پادکست‌ها", youtube:"کانال‌های یوتیوب", talk:"گفت‌وگومحور", broadcast:"تلویزیون و رادیو", online:"رسانه‌های آنلاین"};
function pressKindOf(s){
  const t=String(s?.type||"");
  if(/پادکست/.test(t)) return "podcast";
  if(/گفت[‌ -]?وگو|تاک[‌ -]?شو|کلاب/.test(t)) return "talk";
  if(/روزنامه/.test(t)) return "newspaper";
  if(/خبرگزاری/.test(t)) return "agency";
  if(/مجله|ماهنامه|فصلنامه|هفته[‌ -]?نامه|دوماهنامه/.test(t)) return "magazine";
  if(/تلویزیون|رادیو|شبکه/.test(t)) return "broadcast";
  if(s?.scope==="youtube") return "youtube";
  return "online";
}
function pressMatchesScope(s, scope){
  if(scope==="all") return true;
  if(scope==="magazine") return pressKindOf(s)==="magazine";
  if(scope==="iran-magazine") return s.scope==="iran-magazine";
  return s.scope===scope;
}
const PRESS_LANG_FA = {all:"همه زبان‌ها", fa:"فارسی", en:"انگلیسی", es:"اسپانیایی", fr:"فرانسوی", tr:"ترکی", ar:"عربی", de:"آلمانی"};

function pressLogo(s) {
  const src = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(s.domain) + "&sz=128";
  return `<span class="press-logo"><img src="${src}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><b style="display:none">${esc((s.name||"ج").slice(0,1))}</b></span>`;
}
function setPressScope(v){ pressScope=v; renderPress(""); }
function setPressKind(v){ pressKind=v; renderPress(""); }
function setPressLanguage(v){ pressLanguage=v; renderPress(""); }
function setPressSourceTab(sourceName, tab){ pressSourceTab=tab; renderPress(sourceName); }
function _pressFindSource(name){
  const n=_canonicalNorm(name||"");
  return PRESS_SOURCES.find(s=>[s.name,...(s.aliases||[])].some(x=>_canonicalNorm(x)===n))||null;
}
function _pressMediaData(meta, figureData){
  if(!meta||!figureData)return {adapter:null,videos:[],people:[]};
  const names=new Set([meta.name,...(meta.aliases||[])].map(_canonicalNorm));
  const figures=figureData.figures||[];
  const adapter=figures.find(f=>f.directory===false && [f.name_fa,...(f.aliases||[])].map(_canonicalNorm).some(x=>names.has(x)))||null;
  const videos=(adapter?.youtube_videos||[]).slice().sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  const ids=new Set(videos.map(v=>String(v.id||"")).filter(Boolean));
  const people=figures.filter(f=>f.directory!==false && (f.youtube_videos||[]).some(v=>ids.has(String(v.id||""))))
    .map(f=>({handle:f.handle,name_fa:f.name_fa,role_fa:f.role_fa,avatar:f.avatar,count:(f.youtube_videos||[]).filter(v=>ids.has(String(v.id||""))).length}))
    .sort((a,b)=>b.count-a.count||String(a.name_fa||"").localeCompare(String(b.name_fa||""),"fa"));
  return {adapter,videos,people};
}

async function showPress(sourceName, canonicalId=null) {
  if((sourceName||"")!==pressSourceCurrent){ pressSourceCurrent=sourceName||""; pressSourceTab="latest"; }
  let canonicalSource=sourceName?(canonicalId?await canonicalEntityById(canonicalId):await canonicalEntityByName("source",sourceName)):null;
  if(sourceName&&!canonicalSource){
    const meta=_pressFindSource(sourceName);
    for(const alias of (meta?.aliases||[])){
      canonicalSource=await canonicalEntityByName("source",alias);
      if(canonicalSource)break;
    }
  }
  show("press"); setTab("press");
  renderPress(sourceName || "", canonicalSource);
  // Source pages keep their own stable route even when a canonical entity exists.
  setHash(sourceName ? "#/press-source/" + encodeURIComponent(sourceName) : "#/press");
}
async function loadPeriodicals() {
  if (periodicalRows.length) return periodicalRows;
  let rows=[]; try { rows=await getJSON(`${DATA}/periodicals.json?v=${Date.now()}`); } catch (_) {}
  periodicalRows=Array.isArray(rows)?rows:((rows && Array.isArray(rows.articles))?rows.articles:[]);
  return periodicalRows;
}
async function loadPressDirectory(){
  if(pressDirectoryCache!==null) return pressDirectoryCache;
  if(Array.isArray(window.__PRESS_DIRECTORY__)){
    pressDirectoryCache=window.__PRESS_DIRECTORY__;
    return pressDirectoryCache;
  }
  let rows=[];
  try{rows=await getJSON(`${DATA}/press-directory.json?v=${Date.now()}`,5000);}catch(_){}
  pressDirectoryCache=Array.isArray(rows)?rows:[];
  return pressDirectoryCache;
}
async function loadPressStats(){
  if(pressStatsCache) return pressStatsCache;
  let rows=[]; try{rows=await getJSON(`${DATA}/press-stats.json`);}catch(_){}
  pressStatsCache=Array.isArray(rows)?rows:[];
  return pressStatsCache;
}
async function loadPressHealth(){
  if(pressHealthCache) return pressHealthCache;
  let rows=[], registry=[];
  try{rows=await getJSON(`${DATA}/press-source-health.json`);}catch(_){}
  try{registry=await getJSON(`${DATA}/press-registry-health.json`);}catch(_){}
  rows=Array.isArray(rows)?rows:[];
  registry=Array.isArray(registry)?registry:[];
  const operational=new Set(rows.map(x=>x.source_name));
  pressHealthCache=rows.concat(registry.filter(x=>!operational.has(x.source_name)));
  return pressHealthCache;
}
function pressSourceHealth(s, rows){
  const names=[s.name,...(s.aliases||[])];
  const matches=(rows||[]).filter(x=>names.includes(x.source_name));
  if(!matches.length) return null;
  return matches.sort((a,b)=>String(b.last_run||"").localeCompare(String(a.last_run||"")))[0];
}
function pressHealthBadge(h){
  if(!h) return '<span class="press-health ph-pending">پایش در انتظار</span>';
  const map={
    active:["ph-active","فعال"],
    empty:["ph-empty","متصل · بدون آیتم"],
    error:["ph-error","خطای دریافت"],
    disabled:["ph-disabled","غیرفعال"],
    pending:["ph-pending","در انتظار"]
  };
  const x=map[h.state]||map.pending;
  return `<span class="press-health ${x[0]}" title="${esc(h.last_error||"")}">${x[1]}</span>`;
}
function pressSourceStats(s, stats){
  const names=[s.name,...(s.aliases||[])];
  const rows=stats.filter(x=>names.includes(x.source_name));
  return rows.reduce((a,x)=>({story_count:a.story_count+(x.story_count||0),iran_story_count:a.iran_story_count+(x.iran_story_count||0),latest_at:(!a.latest_at||((x.latest_at||"")>a.latest_at))?(x.latest_at||a.latest_at):a.latest_at}),{story_count:0,iran_story_count:0,latest_at:null});
}
async function renderPress(sourceName, canonicalSource=null) {
  if(sourceName && !canonicalSource) canonicalSource=await canonicalEntityByName("source",sourceName);
  const el=document.getElementById("press-content");
  if(sourceName){
    // Only article data is required to render a source page. Stats/health are
    // optional decoration and must never hold the page on a spinner.
    if(!periodicalRows.length){
      el.innerHTML='<div class="spinner"></div>';
      await loadPeriodicals();
    }
    if(pressStatsCache===null || pressHealthCache===null){
      Promise.allSettled([loadPressStats(),loadPressHealth()]).then(()=>{
        if(document.getElementById("press-content")===el &&
           decodeURIComponent(location.hash||"").includes("/press-source/")) renderPress(sourceName);
      });
    }
  }else{
    // The directory needs only the tiny synchronous manifest. Health status is
    // loaded in the background and may enhance badges later.
    if(pressDirectoryCache===null){
      el.innerHTML='<div class="spinner"></div>';
      await loadPressDirectory();
    }
    if(pressHealthCache===null){
      loadPressHealth().then(()=>{
        if(document.getElementById("press-content")===el && location.hash==="#/press") renderPress("");
      }).catch(()=>{});
    }
  }
  const rows=periodicalRows||[];
  const stats=pressStatsCache||[];
  const health=pressHealthCache||[];
  const manifest=pressDirectoryCache||[];
  const directoryMap=new Map(manifest.filter(x=>x&&x.source_name&&Number(x.count||0)>0).map(x=>[String(x.source_name),x]));
  const groups=new Map(); rows.forEach(x=>{const n=x.publisher||"نشریه";if(!groups.has(n))groups.set(n,[]);groups.get(n).push(x);});

  if(!sourceName){
    const sourceDirRow=s=>{
      const names=[s.name,...(s.aliases||[])];
      const matches=names.map(n=>directoryMap.get(n)).filter(Boolean);
      if(!matches.length) return {count:0,latest_at:null};
      return matches.reduce((a,x)=>({
        count:a.count+Number(x.count||0),
        latest_at:(!a.latest_at||String(x.latest_at||"")>String(a.latest_at||""))?(x.latest_at||a.latest_at):a.latest_at
      }),{count:0,latest_at:null});
    };
    const allSources=PRESS_SOURCES.filter(s=>pressLanguage==="all"||s.lang===pressLanguage);
    const sources=allSources.filter(s=>pressKind==="all"||pressKindOf(s)===pressKind)
      .sort((a,b)=>{
        const ad=sourceDirRow(a),bd=sourceDirRow(b);
        return Number(bd.count>0)-Number(ad.count>0)||bd.count-ad.count||String(a.name||"").localeCompare(String(b.name||""),"fa");
      });
    const kindCounts={};
    for(const s of PRESS_SOURCES) kindCounts[pressKindOf(s)]=(kindCounts[pressKindOf(s)]||0)+1;
    const kindControls=Object.entries(PRESS_KIND_FA).map(([k,v])=>`<button class="press-kind-chip ${pressKind===k?"on":""}" onclick="setPressKind('${k}')"><span>${v}</span><b>${faN(k==="all"?PRESS_SOURCES.length:(kindCounts[k]||0))}</b></button>`).join("");
    const langs=[...new Set(PRESS_SOURCES.filter(s=>pressKind==="all"||pressKindOf(s)===pressKind).map(s=>s.lang))];
    const langControls=["all",...langs].map(k=>`<button class="fchip ${pressLanguage===k?"on":""}" onclick="setPressLanguage('${k}')">${PRESS_LANG_FA[k]||k}</button>`).join("");
    const cards=sources.map(s=>{
      const dr=sourceDirRow(s), h=pressSourceHealth(s,health), kind=PRESS_KIND_FA[pressKindOf(s)]||s.type;
      const active=dr.count>0;
      return `<button class="press-source press-source-rich press-directory-card ${active?"has-content":"no-content"}" onclick="showPress('${esc(s.name)}')">
        ${pressLogo(s)}
        <span class="press-source-copy">
          <span class="press-source-title"><strong>${esc(s.name)}</strong>${pressHealthBadge(h)}</span>
          <small>${esc(s.type)} · ${PRESS_LANG_FA[s.lang]||s.lang}</small>
          ${s.description?`<p>${esc(s.description)}</p>`:""}
          <em>${active?faN(dr.count)+" مطلب":(s.scope==="youtube"?"منبع ویدئویی ثبت‌شده":"در انتظار نخستین محتوای پردازش‌شده")}${dr.latest_at?" · آخرین: "+relTime(dr.latest_at):""}</em>
        </span><span class="press-kind-label">${esc(kind)}</span>
      </button>`;
    }).join("");
    const known=new Set(PRESS_SOURCES.flatMap(s=>[s.name,...(s.aliases||[])]));
    const extra=manifest.filter(x=>x&&x.source_name&&Number(x.count||0)>0&&!known.has(String(x.source_name))).map(x=>[String(x.source_name),Number(x.count||0)]);
    const activeCount=PRESS_SOURCES.filter(s=>sourceDirRow(s).count>0).length;
    el.innerHTML=`<section class="press-directory-hero"><span class="press-kicker">دایرکتوری منابع پندار</span><h1>منابع</h1><p>روزنامه‌ها، خبرگزاری‌ها، مجلات، پادکست‌ها و رسانه‌های ویدئویی در یک فهرست واحد؛ هر منبع صفحهٔ مستقل خودش را دارد.</p><div class="press-directory-stats"><span><b>${faN(PRESS_SOURCES.length)}</b> منبع ثبت‌شده</span><span><b>${faN(activeCount)}</b> دارای محتوای پردازش‌شده</span><span><b>${faN(PRESS_SOURCES.filter(s=>s.scope==="youtube").length)}</b> منبع ویدئویی</span></div></section>
      <div class="press-kind-filter">${kindControls}</div>
      <div class="press-filter-row press-langs">${langControls}</div>
      ${cards?`<div class="press-grid press-directory-grid">${cards}</div>`:`<div class="state"><div class="big">منبعی با این فیلتر پیدا نشد</div></div>`}
      ${extra.length?`<div class="rule"><span>منابع تازهٔ پردازش‌شده</span><span class="l"></span></div><div class="press-grid">${extra.map(([name,count])=>`<button class="press-source" onclick="showPress('${esc(name)}')"><span class="press-mark">ج</span><strong>${esc(name)}</strong><small>${faN(count)} مطلب</small></button>`).join("")}</div>`:""}`;

    return;
  }

  const meta=_pressFindSource(sourceName);
  let mediaData={adapter:null,videos:[],people:[]};
  if(meta?.scope==="youtube"){
    try{ mediaData=_pressMediaData(meta,await loadFigures()); }catch(_){}
  }
  const items=meta ? [meta.name,...(meta.aliases||[])].flatMap(n=>groups.get(n)||[]) : (groups.get(sourceName)||[]);
  const st=meta?pressSourceStats(meta,stats):{story_count:0,iran_story_count:0,latest_at:null};
  const h=meta?pressSourceHealth(meta,health):null;
  // Source pages render periodical items immediately. Ordinary news-feed
  // stories are an optional enhancement loaded afterwards, never a blocker.
  const names=meta?[meta.name,...(meta.aliases||[])]:[sourceName];
  const sourceStoryCard=x=>{
    const metaBits=[];
    if(x.published_at) metaBits.push(relTime(x.published_at));
    if(x.category) metaBits.push(CAT_FA[x.category]||x.category);
    if(x.source_count>1) metaBits.push(faN(x.source_count)+" منبع");
    const relevance=IRAN_FA[x.iran_relevance]||"";
    if(relevance) metaBits.push(relevance);
    return `<article class="press-article press-click press-news-full" onclick="openStory('${esc(x.id)}')">
      <div class="press-news-meta"><span class="chip">${esc(sourceName)}</span>${metaBits.length?`<span>${metaBits.map(esc).join(" · ")}</span>`:""}</div>
      <h2>${esc(x.headline_fa||x.title_fa||"")}</h2>
      ${x.summary_fa?`<p>${esc(x.summary_fa)}</p>`:""}
      ${x.image_url?`<img class="press-news-thumb" src="${esc(x.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:""}
      <div class="press-read">پروندهٔ کامل خبر ←</div>
    </article>`;
  };
  const renderSourcePage=(feedItems=[])=>{
    const isVideo=meta?.scope==="youtube";
    const latestHtml=(items.length||feedItems.length)?`<div class="press-source-count">${faN(feedItems.length + items.length)} مطلب موجود از این منبع</div><div class="press-list">${feedItems.map(sourceStoryCard).join("")}${items.map(x=>`<article class="press-article press-click" onclick="openPressArticle('${esc(x.id)}')"><span class="chip">${esc(meta?.name||sourceName)}</span><h2>${esc(x.headline_fa||x.title_fa||x.title_original||"")}</h2>${x.summary_fa?`<p>${esc(x.summary_fa)}</p>`:""}<div class="press-read">خواندن بازگویی تفصیلی ←</div></article>`).join("")}</div>`:`<div class="state press-empty"><div class="big">هنوز مطلبی از این رسانه پردازش نشده</div><p class="muted">خود منبع در دایرکتوری ثبت شده است و محتوای تازه پس از دریافت در همین صفحه ظاهر می‌شود.</p></div>`;
    const videosHtml=mediaData.videos.length?`<div class="press-video-grid">${mediaData.videos.slice(0,60).map(v=>`<article class="press-video-card"><a href="${esc(v.url)}" target="_blank" rel="noopener"><span class="press-video-thumb">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy">`:""}<i>▶</i></span><b>${esc(v.title||"ویدئو")}</b><small>${v.published_at?relTime(v.published_at):"YouTube"}</small></a>${v.recap_fa?`<button onclick="openStatement('youtube-${String(v.id||"").replace(/'/g,"\\'")}')">جان کلام این ویدئو</button>`:""}</article>`).join("")}</div>`:`<div class="state press-empty"><div class="big">هنوز ویدئویی در خروجی ثبت نشده</div><p class="muted">کانال منبع ثبت شده و با اجرای گردآورنده، ویدئوهای تازه اینجا قرار می‌گیرند.</p></div>`;
    const peopleHtml=mediaData.people.length?`<div class="press-source-people">${mediaData.people.map(p=>`<button onclick="openFigure('${String(p.handle||"").replace(/'/g,"\\'")}')">${p.avatar?`<img src="${esc(p.avatar)}" alt="" loading="lazy">`:`<span class="press-person-fallback">${esc((p.name_fa||"?").slice(0,1))}</span>`}<span><b>${esc(p.name_fa||"")}</b><small>${esc(p.role_fa||"")} · ${faN(p.count)} ویدئو</small></span></button>`).join("")}</div>`:`<div class="state press-empty"><div class="big">هنوز چهره‌ای به این منبع متصل نشده</div><p class="muted">با شناسایی نام مهمان‌ها در ویدئوها، پروفایل چهره‌ها به این صفحه متصل می‌شود.</p></div>`;
    const aboutHtml=`<section class="press-source-about"><h2>دربارهٔ ${esc(meta?.name||sourceName)}</h2><p>${esc(meta?.description||((meta?.type||"رسانه")+" در دایرکتوری منابع پندار."))}</p><div class="press-source-facts"><span><b>نوع</b>${esc(meta?.type||"رسانه")}</span><span><b>زبان</b>${esc(PRESS_LANG_FA[meta?.lang]||meta?.lang||"—")}</span><span><b>حوزه</b>${esc(PRESS_SCOPE_FA[meta?.scope]||meta?.scope||"—")}</span>${h?`<span><b>وضعیت پایش</b>${esc(h.state||"—")}</span>`:""}</div></section>`;
    const tabs=[["latest","آخرین مطالب"],...(isVideo?[["videos","ویدئوها"],["people","چهره‌های حاضر"]]:[]),["about","دربارهٔ منبع"]];
    const tabsHtml=`<div class="press-source-tabs">${tabs.map(([k,label])=>`<button class="${pressSourceTab===k?"on":""}" onclick="setPressSourceTab('${esc(meta?.name||sourceName)}','${k}')">${label}${k==="videos"&&mediaData.videos.length?` <b>${faN(mediaData.videos.length)}</b>`:""}${k==="people"&&mediaData.people.length?` <b>${faN(mediaData.people.length)}</b>`:""}</button>`).join("")}</div>`;
    const body=pressSourceTab==="videos"?videosHtml:pressSourceTab==="people"?peopleHtml:pressSourceTab==="about"?aboutHtml:latestHtml;
    el.innerHTML=`<div class="press-source-head"><button class="back" onclick="showPress()">همهٔ منابع</button>${meta?pressLogo(meta):""}<div><span class="press-kicker">${esc(meta?.type||"رسانه")}</span><h2>${esc(meta?.name||sourceName)} ${pressHealthBadge(h)}</h2>${meta?`<p>${PRESS_LANG_FA[meta.lang]||meta.lang}${st.iran_story_count?` · ${faN(st.iran_story_count)} خبر مرتبط با ایران`:""}${st.latest_at?` · آخرین خبر: ${relTime(st.latest_at)}`:""}${h&&h.last_run?` · آخرین پایش: ${relTime(h.last_run)}`:""}</p>`:""}</div></div>
      ${canonicalSource?canonicalStrip(canonicalSource):""}
      ${tabsHtml}
      <div class="press-source-tab-body">${body}</div>`;
  };
  renderSourcePage([]);

  (async()=>{
    let feedItems=[];
    try{
      const archive=await getJSON(`${DATA}/press-source-stories.json`,5000);
      feedItems=names.flatMap(n => Array.isArray(archive && archive[n]) ? archive[n] : []);
      const seen=new Set();
      feedItems=feedItems.filter(x=>x && x.id && !seen.has(String(x.id)) && seen.add(String(x.id)))
        .sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
    }catch(_){
      try{
        const feed=await getJSON(`${DATA}/stories.json`,5000);
        feedItems=(Array.isArray(feed)?feed:[]).filter(x=>(x.source_names||[]).some(n=>names.includes(n)));
      }catch(__){}
    }
    if(document.getElementById("press-content")===el && pressSourceCurrent===sourceName) renderSourcePage(feedItems);
  })();
}

function _pressNormText(s){
  return String(s||"").replace(/[\s\u200c]+/g," ").replace(/[،؛:,.!?؟"'«»()\[\]{}]/g,"").trim();
}
function _pressNearDuplicate(a,b){
  const x=_pressNormText(a), y=_pressNormText(b);
  if(!x||!y) return false;
  if(x===y) return true;
  const shorter=x.length<=y.length?x:y, longer=x.length>y.length?x:y;
  return shorter.length>=70 && longer.includes(shorter) && shorter.length/longer.length>.5;
}
function _gcalStamp(iso){
  const d=new Date(iso||"");
  if(Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
}
function pressEventCard(x){
  const e=x.event||{};
  const has=!!(e.is_event||e.date_fa||e.time_fa||e.start_iso||e.location_fa||e.address_fa);
  if(!has) return "";
  const where=[e.location_fa,e.address_fa].filter(Boolean).join("، ");
  const rows=[
    e.date_fa?`<div class="press-event-item"><span>تاریخ</span><b>${esc(e.date_fa)}</b></div>`:"",
    e.time_fa?`<div class="press-event-item"><span>ساعت</span><b>${esc(e.time_fa)}</b></div>`:"",
    where?`<div class="press-event-item press-event-place"><span>مکان</span><b>${esc(where)}</b></div>`:""
  ].join("");
  const actions=[];
  const start=_gcalStamp(e.start_iso);
  let end=_gcalStamp(e.end_iso);
  if(start&&!end){
    const d=new Date(e.start_iso); d.setHours(d.getHours()+2); end=_gcalStamp(d.toISOString());
  }
  if(start&&end){
    const original=x.source_url||x.article_url||x.telegram_post_url||"";
    const details=[x.summary_fa||"",original?("منبع: "+original):""].filter(Boolean).join("\n\n");
    const cal="https://calendar.google.com/calendar/render?action=TEMPLATE"
      +"&text="+encodeURIComponent(x.headline_fa||x.title_original||"رویداد")
      +"&dates="+encodeURIComponent(start+"/"+end)
      +"&details="+encodeURIComponent(details)
      +(where?"&location="+encodeURIComponent(where):"");
    actions.push(`<a class="press-event-action" href="${cal}" target="_blank" rel="noopener">افزودن به Google Calendar ↗</a>`);
  }
  if(where){
    const maps="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(where);
    actions.push(`<a class="press-event-action" href="${maps}" target="_blank" rel="noopener">مشاهده در Google Maps ↗</a>`);
  }
  return `<section class="press-event-card"><div class="press-event-kicker">اطلاعات رویداد</div><div class="press-event-grid">${rows}</div>${actions.length?`<div class="press-event-actions">${actions.join("")}</div>`:""}</section>`;
}

async function openPressArticle(id) {
  show("press"); setTab("press"); const el=document.getElementById("press-content"); el.innerHTML='<div class="spinner"></div>';
  const [rows,bookData]=await Promise.all([loadPeriodicals(),loadBooks()]);
  const x=rows.find(r=>String(r.id)===String(id));
  if(!x){el.innerHTML='<div class="state"><div class="big">مطلب پیدا نشد</div></div>';return;}
  setArticleSeo(x);
  const summary=x.summary_fa||"";
  let body=x.body_fa||x.longform_fa||"";
  if(_pressNearDuplicate(summary,body)) body="";
  const points=(x.key_points_fa||[]).map(p=>`<li>${esc(p)}</li>`).join("");
  const hero=x.image_url||x.hero_image_url||x.source_image_url||x.og_image||"";
  const originalUrl=x.source_url||x.article_url||x.telegram_post_url||"";
  const isFallback=x.enrichment_state==="metadata_fallback";
  const note=isFallback
    ?"این صفحه بر پایهٔ توضیح منتشرشده در خوراک رسمی منبع ساخته شده است؛ برای متن کامل به منبع اصلی مراجعه کنید."
    :"این متن بازنویسی مستقل و وفادارانه‌ای بر پایهٔ محتوای منبع است و جایگزین متن اصلی نیست.";
  const eventCard=pressEventCard(x);
  const relatedBooks=(bookData.books||[]).filter(b=>(b.mentions||[]).some(m=>String(m.article_id||"")===String(id)));
  const bookStrip=relatedBooks.length?`<section class="press-books"><div class="press-box-label">کتاب‌های این مطلب</div><div class="press-book-links">${relatedBooks.map(b=>`<button onclick="openBook('${esc(b.slug)}')"><span>کتاب</span><b>${esc(b.title_fa||"")}</b></button>`).join("")}</div></section>`:"";
  el.innerHTML=`<article class="press-detail press-longread">
    <button class="back press-article-back" onclick="showPress('${esc(x.publisher||"")}')">بازگشت به ${esc(x.publisher||"نشریه")}</button>
    <header class="press-longread-head">
      <div class="press-kicker-row"><span class="press-kicker">پیشخوان جراید</span><span class="press-source-name">${esc(x.publisher||"نشریه")}</span>${x.section_fa?`<span class="press-section-dot">•</span><span class="press-section-name">${esc(x.section_fa)}</span>`:""}</div>
      <h1>${esc(x.headline_fa||x.title_original||"")}</h1>
      ${x.title_original && x.title_original!==(x.headline_fa||"")?`<div class="press-original">${esc(x.title_original)}</div>`:""}
      ${summary?`<p class="press-deck">${esc(summary)}</p>`:""}
      <div class="press-article-meta">${x.source_published_at?`<span>انتشار منبع: ${esc(String(x.source_published_at).slice(0,10))}</span>`:""}<span>منبع: ${esc(x.publisher||"")}</span></div>
    </header>
    ${eventCard}
    ${hero?`<figure class="press-hero"><img src="${esc(hero)}" alt="" loading="eager" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()"></figure>`:""}
    ${points?`<section class="press-points"><div class="press-box-label">جانِ مطلب</div><ul>${points}</ul></section>`:""}
    ${bookStrip}
    ${body?`<section class="press-body">${body.split(/\\n{2,}/).map(p=>`<p>${esc(p)}</p>`).join("")}</section>`:""}
    <footer class="press-longread-foot">
      <div class="press-copyright-note">${esc(note)}</div>
      ${originalUrl?`<a class="press-source-link" href="${esc(originalUrl)}" target="_blank" rel="noopener">مشاهدهٔ منبع اصلی ↗</a>`:""}
    </footer>
  </article>`;
  setHash("#/press-article/"+encodeURIComponent(id));
}
