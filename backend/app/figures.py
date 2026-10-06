"""جان‌کلام چهره‌ها — public commentators followed via their Telegram channels.

Figures are DATA, not code: add, remove or edit people here and the next build
picks it up (scripts/seed.py syncs this list into the `sources` table, marked
with region = FIGURE_REGION).

Editorial rules this list must keep:
  • Mix of viewpoints — the section is only fair if no single camp dominates.
  • `role_fa` is a neutral job description (historian, economist…), never a
    political label. Readers judge viewpoints from the posts themselves.
  • A figure's posts are OPINION. They never enter the news "facts" layer and
    never count as an independent news source (see clustering).
"""
from __future__ import annotations

from dataclasses import dataclass

FIGURE_REGION = "figure"   # Source.region value that marks a figure's channel


@dataclass(frozen=True, slots=True)
class Figure:
    handle: str        # Telegram channel username (without @)
    name_fa: str
    role_fa: str       # neutral description shown on the figure's page
    field: str         # must be a key of FIELD_FA (see figure_posts.py)
    # Their other public presence, as (kind, url). kind ∈ website|x|instagram|
    # youtube|facebook. The Telegram channel link is added automatically — don't
    # repeat it here. Only add links we have actually verified.
    social: tuple[tuple[str, str], ...] = ()
    gender: str = "m"  # "m" | "f" — used for balance / future comparison stats
    bale: str | None = None  # verified public Bale channel handle (without @)
    external: bool = False  # profile is fed by non-Telegram collectors (Truth Social, web, etc.)
    aliases: tuple[str, ...] = ()  # alternate public names matched into the same profile
    telegram_handle: str | None = None  # direct Telegram source when route handle is a stable slug
    verified: bool = False  # identity/account ownership has been verified
    claimed: bool = False  # profile is controlled by the person represented
    directory: bool = True  # false = media/source adapter for video ingestion; not a person-directory profile
    avatar: str | None = None  # optional verified profile image override


FIGURES: list[Figure] = [
    # ══════════════════════════════════════════════════════════════════════
    #  سیاست و جامعه
    # ══════════════════════════════════════════════════════════════════════
    Figure("Garajetadayoni", "مهدی تدینی", "مورخ و مترجم", "politics"),
    Figure("ahmadzeidabad", "احمد زیدآبادی", "روزنامه‌نگار و تحلیلگر سیاسی", "politics"),
    Figure("abbas-souri", "عباس سوری", "سردبیر رسانه پارسی", "media",
           (("x", "https://x.com/Abas_Suri"),), external=True,
           aliases=("عباس سوري", "Abbas Souri", "Abas Suri")),
    Figure("abdiabbas", "عباس عبدی", "روزنامه‌نگار و پژوهشگر اجتماعی", "politics", bale="ayandeha"),
    Figure("fazeli_mohammad", "محمد فاضلی", "جامعه‌شناس", "politics",
           (("website", "https://mohammadfazeli.ir"),)),
    Figure("miladdokhanchi", "میلاد دخانچی", "پژوهشگر مطالعات فرهنگی", "politics"),
    Figure("iranemana_official", "سجاد فتاحی", "پژوهشگر، کانال «ایرانِ مانا»", "politics",
           (("youtube", "https://youtube.com/@iran_mana"),)),
    Figure("iransocialproblems", "علی میرزامحمدی", "جامعه‌شناس", "politics"),
    Figure("rasaee", "حمید رسایی", "نماینده مجلس و مدیرمسئول هفته‌نامه ۹ دی", "politics"),
    Figure("sadeghzibakalam", "صادق زیباکلام", "استاد علوم سیاسی دانشگاه تهران", "politics",
           (("facebook", "https://facebook.com/SadeghZibakalam"),), bale="sadeghzibakalamofficial"),
    Figure("Parvanehsalahshouri", "پروانه سلحشوری", "جامعه‌شناس و نمایندهٔ سابق مجلس",
           "politics", (), "f"),
    Figure("SaeedHajarian", "سعید حجاریان", "نظریه‌پرداز سیاسی", "politics"),
    Figure("Mostafatajzadeh", "مصطفی تاجزاده", "فعال سیاسی اصلاح‌طلب", "politics"),
    Figure("Dr_hfalahatpisheh", "حشمت‌الله فلاحت‌پیشه",
           "نمایندهٔ سابق مجلس و تحلیلگر امنیت ملی", "politics"),
    Figure("emadbaghi", "عمادالدین باقی", "روزنامه‌نگار و فعال حقوق بشر", "law"),
    Figure("m_borhani57", "محسن برهانی", "حقوقدان و استاد حقوق جزا", "law"),
    Figure("Ghabl_enghelab", "وحید اشتری", "فعال اجتماعی و روزنامه‌نگار", "politics", bale="ghabl_enghelab"),
    Figure("sabety_ir", "امیرحسین ثابتی", "نماینده مجلس", "politics", bale="sabety_ir"),
    Figure("yaminpour", "وحید یامین‌پور", "نویسنده و پژوهشگر", "politics", bale="yaminpour"),
    Figure("ali_gholhaky", "علی قلهکی", "روزنامه‌نگار و تحلیلگر سیاسی", "politics", bale="ali_gholhaki"),
    Figure("MalekShariati_ir", "مالک شریعتی نیاسر", "نماینده مجلس", "politics", bale="malekshariati"),
    Figure("kasaeizade", "سید هادی کسایی‌زاده", "روزنامه‌نگار", "media",
           (("x", "https://x.com/seyedhadikasaei"),), bale="kasaeizade"),
    Figure("hasanabbasi_students", "حسن عباسی", "سخنران و پژوهشگر", "politics", bale="hasanabbasi_students"),

    # ══════════════════════════════════════════════════════════════════════
    #  چهره‌های تکمیلی — پروفایل واحد، منابع مستقیم و گفته در خبر
    # ══════════════════════════════════════════════════════════════════════
    Figure("ali-alizadeh", "علی علیزاده", "تحلیلگر سیاسی و مدیر رسانه", "media",
           (("youtube", "https://youtube.com/jedaaltv"),
            ("website", "https://jedaal.tv/")), external=True,
           aliases=("Ali Alizadeh", "جدال", "Jedaal", "Jedaal Farsi"),
           telegram_handle="jedaal"),
    Figure("ali-bandari", "علی بندری", "پادکستر و تولیدکننده محتوا", "media",
           (("youtube", "https://www.youtube.com/@BplusPodcast"),
            ("website", "https://bpluspodcast.com/")), external=True,
           aliases=("Ali Bandari", "بی‌پلاس", "بی پلاس", "Bplus", "BPLUS"),
           telegram_handle="podcastbplus"),
    Figure("jamshid-chalangi", "جمشید چالنگی", "روزنامه‌نگار و مجری", "media",
           (("youtube", "https://www.youtube.com/@JamshidChalangi1"),), external=True,
           aliases=("Jamshid Chalangi",)),
    Figure("bozorgmehr-sharafedin", "بزرگمهر شرف‌الدین", "روزنامه‌نگار و پادکستر", "media",
           (("youtube", "https://www.youtube.com/@BozorgmehrSharafedin"),), external=True,
           aliases=("Bozorgmehr Sharafedin",)),
    Figure("ehsan-mansoori", "احسان منصوری", "روزنامه‌نگار و تولیدکننده محتوا", "media",
           (("youtube", "https://www.youtube.com/@ehsanmansoori"),), external=True,
           aliases=("Ehsan Mansoori",)),
    Figure("ashkan-zare", "اشکان زارع", "تولیدکننده محتوا", "media",
           (("youtube", "https://www.youtube.com/@ashkan_zare"),), external=True,
           aliases=("Ashkan Zare",)),

    Figure("ali-abdi-jedaal", "علی عبدی", "تحلیلگر و مهمان رسانه‌ای", "politics",
           external=True, aliases=("Ali Abdi",)),

    Figure("arash-nalchegar", "آرش نعل‌چگر", "پادکستر و میزبان فیوز پادکست", "media",
           external=True, aliases=("Arash Nalchegar", "آرش نعل چگر", "آرش نعلچگر")),

    # YouTube/media sources below are ingestion adapters, not person profiles.
    Figure("source-jedaal", "جدال", "رسانهٔ تحلیلی و گفت‌وگومحور علی علیزاده", "media",
           (("youtube", "https://youtube.com/jedaaltv"),
            ("website", "https://jedaal.tv/")), external=True, directory=False,
           aliases=("Jedaal", "Jedaal Farsi")),
    Figure("source-golden-simorgh", "سیمرغ طلایی", "رسانهٔ گفت‌وگومحور و تحلیلی", "media",
           (("youtube", "https://www.youtube.com/@GoldenSimorgh-d4u"),), external=True, directory=False,
           aliases=("Golden Simorgh", "GoldenSimorgh")),
    Figure("source-simorgh-ai-tv", "تلویزیون هوش مصنوعی سیمرغ", "رسانهٔ ویدئویی جامعهٔ هوش مصنوعی ایران", "media",
           (("youtube", "https://www.youtube.com/channel/UCrdxqvmkMQrohT0Setx--pw"),), external=True, directory=False,
           aliases=("Simorgh AI TV",)),
    Figure("source-didarnews", "دیدارنیوز", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@didarnews"),), external=True, directory=False),
    Figure("source-hamshahritv", "همشهری تی‌وی", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@hamshahritv"),), external=True, directory=False),
    Figure("source-iranefarda-tv", "ایران فردا TV", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@Iranefarda_TV"),), external=True, directory=False),
    Figure("source-kargahnet", "کارگاه", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@Kargahnet"),), external=True, directory=False),
    Figure("source-dogm-nabash", "دگم نباش", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@DogmNabash"),), external=True, directory=False),
    Figure("source-7aban", "۷ آبان", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@7Aban_h"),), external=True, directory=False),
    Figure("source-channel-one-tv", "Channel One TV", "شبکه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@ChanelOneTVIranian"),), external=True, directory=False),
    Figure("source-zabane-z", "Zabane.z", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@Zabane.z"),), external=True, directory=False),
    Figure("source-resaneh-alternative", "رسانه آلترناتیو", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@ResanehAlternative"),), external=True, directory=False),
    Figure("source-persian-clubhouse", "Persian Clubhouse", "رسانه گفت‌وگومحور", "media",
           (("youtube", "https://www.youtube.com/@persianclubhouse113"),), external=True, directory=False),
    Figure("source-fuse-podcast", "فیوز پادکست", "پادکست گفت‌وگومحور به میزبانی آرش نعل‌چگر", "media",
           (("youtube", "https://www.youtube.com/@fusepodcast"),), external=True, directory=False),
    Figure("source-studio-patt", "استودیو پات", "استودیو و رسانهٔ گفت‌وگومحور با مهمانان متعدد", "media",
           (("youtube", "https://www.youtube.com/@Studio_patt"),), external=True, directory=False),
    Figure("source-nazdiktar-talk", "نزدیک‌تر تاک", "گفت‌وگو و پادکست ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@nazdiktar_talk"),), external=True, directory=False),
    Figure("source-cimorg-futures", "سیمرغ فیوچرز", "رسانهٔ آینده‌پژوهی و ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@CimorgFutures"),), external=True, directory=False),
    Figure("source-azad-social", "Azad Social", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@azadsocial"),), external=True, directory=False),
    Figure("source-khattefarzi", "خط فرضی", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@Khattefarzi"),), external=True, directory=False),
    Figure("source-kaghaze-siasat", "کاغذ سیاست", "رسانه سیاسی و ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@kaghazesiasat"),), external=True, directory=False),
    Figure("source-yazdan-talkshow", "Yazdan Talkshow", "تاک‌شو و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@yazdantalkshow"),), external=True, directory=False),
    Figure("source-jomhouri-street", "خیابان جمهوری", "رسانهٔ گفت‌وگومحور با مهمانان متعدد", "media",
           (("youtube", "https://www.youtube.com/@jomhouristreet"),), external=True, directory=False),
    Figure("source-tomorrows-horizon", "افق فردا", "رسانهٔ گفت‌وگومحور با حاضرین و مهمانان متعدد", "media",
           (("youtube", "https://www.youtube.com/@TomorrowsHorizon2024"),), external=True, directory=False),
    Figure("source-sajadni-movies", "فیلم سجاد نی", "کانال ویدئویی دربارهٔ سینما و موضوعات سینمایی", "media",
           (("youtube", "https://www.youtube.com/@sajadniMovies"),), external=True, directory=False),
    Figure("source-khashayar-stories", "Khashayar Stories", "کانال روایت و ویدئو", "media",
           (("youtube", "https://www.youtube.com/@Khashayarstories"),), external=True, directory=False),
    Figure("source-sepehris-cult", "Sepehris Cult", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/@SepehrisCult"),), external=True, directory=False),
    Figure("ivar-farhadi", "ایوار فرهادی", "تولیدکننده محتوا و مجری", "media",
           (("youtube", "https://www.youtube.com/channel/UCpKTQ7EgNIb5nMahQLdMthw"),), external=True,
           aliases=("Ivar Farhadi",)),
    Figure("ali-zia", "علی ضیا", "مجری و تهیه‌کننده", "media",
           (("youtube", "https://www.youtube.com/channel/UC8LVufbnNQkU20_fyycIL7A"),), external=True,
           aliases=("Ali Zia", "علی ضیاء", "Baziya", "بازیا")),
    Figure("source-chanteh-podcast", "Chanteh Podcast", "پادکست ویدئویی", "media",
           (("youtube", "https://www.youtube.com/channel/UCvCbxRVG7kyB0uwSOK0eLnQ"),), external=True, directory=False),
    Figure("source-farhikhtegan-online", "فرهیختگان آنلاین", "بخش آنلاین و ویدئویی روزنامهٔ فرهیختگان", "media",
           (("youtube", "https://www.youtube.com/channel/UCq05uUbwwT1YtxU26Cfwdfw"),), external=True, directory=False),
    Figure("source-manoto-tv", "من‌وتو", "شبکه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/channel/UCnUdm0u-2FRffBnxQYHuTHA"),), external=True, directory=False),
    Figure("source-rok-show", "Rok Show", "برنامه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/channel/UCeLPadoZ4vXAM13iyvivhBg"),), external=True, directory=False),
    Figure("source-pump-vod", "Pump VOD", "رسانه و کانال ویدئویی", "media",
           (("youtube", "https://www.youtube.com/channel/UCMPdfQnOy5Vu07j6C141FWQ"),), external=True, directory=False),
    Figure("reza-alijani", "رضا علیجانی", "روزنامه‌نگار و تحلیلگر سیاسی", "politics", external=True),
    Figure("mahmoud-farjami", "محمود فرجامی", "نویسنده و پژوهشگر رسانه", "media", external=True),
    Figure("rashid-kakavand", "رشید کاکاوند", "نویسنده و پژوهشگر ادبیات", "culture", external=True),
    Figure("mansour-zabetian", "منصور ضابطیان", "نویسنده و مجری", "media", external=True),
    Figure("nezameddin-mousavi", "نظام‌الدین موسوی", "فعال رسانه‌ای و سیاسی", "politics", external=True),
    Figure("jamshid-assadi", "جمشید اسدی", "اقتصاددان و استاد دانشگاه", "economy", external=True),
    Figure("reza-taghizadeh", "رضا تقی‌زاده", "روزنامه‌نگار و تحلیلگر", "foreign", external=True),
    Figure("asghar-sepehri", "اصغر سپهری", "فعال سیاسی", "politics",
           (("x", "https://x.com/AsgharSepehri"),), external=True),
    Figure("farzan-deljou", "فرزان دلجو", "هنرمند", "culture", external=True),
    Figure("shohreh-aghdashloo", "شهره آغداشلو", "بازیگر", "cinema", (), "f", external=True),
    Figure("mohsen-makhmalbaf", "محسن مخملباف", "فیلم‌ساز و نویسنده", "cinema", external=True),
    Figure("nader-fattourechi", "نادر فتوره‌چی", "نویسنده و روزنامه‌نگار", "media", external=True),
    Figure("hasan-shariatmadari", "حسن شریعتمداری", "فعال سیاسی", "politics", external=True),
    Figure("hossein-shariatmadari", "حسین شریعتمداری", "روزنامه‌نگار", "media", external=True),
    Figure("faraj-sarkouhi", "فرج سرکوهی", "نویسنده و روزنامه‌نگار", "media", external=True),
    Figure("fazel-nazari", "فاضل نظری", "شاعر و نویسنده", "culture", external=True),
    Figure("fardad-farahzad", "فرداد فرحزاد", "روزنامه‌نگار و مجری", "media", external=True),
    Figure("mirhossein-mousavi", "میرحسین موسوی", "فعال سیاسی", "politics", external=True),
    Figure("mehdi-karroubi", "مهدی کروبی", "فعال سیاسی", "politics", external=True),
    Figure("mohammad-khatami", "سیدمحمد خاتمی", "فعال سیاسی", "politics", external=True,
           aliases=("محمد خاتمی",)),
    Figure("hojat-kalashi", "حجت کلاشی", "پژوهشگر و فعال سیاسی", "politics", external=True),
    Figure("sepideh-gholian", "سپیده قلیان", "فعال مدنی", "law", (), "f", external=True),
    Figure("mazdak-bamdadan", "مزدک بامدادان (محسن بنایی)", "نویسنده و پژوهشگر تاریخ", "history",
           external=True, aliases=("مزدک بامدادان", "محسن بنایی", "محسن بنائی")),
    Figure("nasser-karami", "ناصر کرمی", "پژوهشگر محیط‌زیست", "environment", external=True),
    Figure("vahid-jalili", "وحید جلیلی", "فعال فرهنگی و رسانه‌ای", "media", external=True),
    Figure("mehdi-jamshidi", "مهدی جمشیدی", "پژوهشگر فرهنگ و اندیشه", "culture", external=True),
    Figure("saeed-laylaz", "سعید لیلاز", "اقتصاددان و روزنامه‌نگار", "economy", external=True),
    Figure("mashallah-shamsolvaezin", "ماشاءالله شمس‌الواعظین", "روزنامه‌نگار", "media", external=True, aliases=("ماشاالله شمس الواعظین",)),
    Figure("amirali-abolfath", "امیرعلی ابوالفتح", "تحلیلگر سیاست ایالات متحده", "foreign", external=True),
    Figure("nasser-hadian", "ناصر هادیان", "پژوهشگر روابط بین‌الملل", "foreign", external=True),
    Figure("rahman-ghahremanpour", "رحمان قهرمان‌پور", "پژوهشگر روابط بین‌الملل", "foreign", external=True),
    Figure("saber-golanbari", "صابر گل‌عنبری", "پژوهشگر و تحلیلگر روابط بین‌الملل", "foreign", external=True),
    Figure("hadi-khosroshahin", "هادی خسروشاهین", "روزنامه‌نگار و پژوهشگر روابط بین‌الملل", "foreign", external=True),
    Figure("mehdi-zakerian", "مهدی ذاکریان", "پژوهشگر روابط بین‌الملل و حقوق بشر", "foreign", external=True),
    Figure("abdolreza-davari", "عبدالرضا داوری", "تحلیلگر سیاسی", "politics", external=True),
    Figure("mohammad-marandi", "محمد مرندی", "استاد دانشگاه و تحلیلگر سیاسی", "foreign", external=True, aliases=("سیدمحمد مرندی", "سید محمد مرندی")),
    Figure("elaheh-koulaei", "الهه کولایی", "استاد علوم سیاسی و پژوهشگر روابط بین‌الملل", "foreign", (), "f", external=True),
    Figure("mohammadmehdi-mirbagheri", "محمدمهدی میرباقری", "پژوهشگر دینی و مدرس حوزه", "culture", external=True, aliases=("محمد مهدی میرباقری",)),
    Figure("alireza-eshraghi", "علیرضا اشراقی", "روزنامه‌نگار و پژوهشگر رسانه", "media", external=True),
    Figure("majid-shakeri", "مجید شاکری", "اقتصاددان و پژوهشگر مالی", "economy", external=True),
    Figure("mehdi-mohammadi", "مهدی محمدی", "روزنامه‌نگار و تحلیلگر سیاسی", "politics", external=True),
    Figure("hasan-rahimpour-azghadi", "حسن رحیم‌پور ازغدی", "پژوهشگر و سخنران حوزه اندیشه و فرهنگ", "culture", external=True,
           aliases=("حسن رحیم پور ازغدی",)),
    Figure("payam-fazlinejad", "پیام فضلی‌نژاد", "روزنامه‌نگار و پژوهشگر فرهنگی", "media", external=True,
           aliases=("پیام فضلی نژاد",)),
    Figure("majid-shahhosseini", "مجید شاه‌حسینی", "پژوهشگر و مدرس سینما و فرهنگ", "culture", external=True,
           aliases=("مجید شاه حسینی",)),
    Figure("seyed-abbas-nabavi", "سیدعباس نبوی", "پژوهشگر حوزه اندیشه و علوم انسانی", "culture", external=True,
           aliases=("سید عباس نبوی",)),
    Figure("mohammadreza-zaeri", "محمدرضا زائری", "نویسنده و فعال فرهنگی", "culture", external=True,
           aliases=("محمد رضا زائری",)),
    Figure("seyed-javad-miri", "سیدجواد میری", "جامعه‌شناس و پژوهشگر", "society", external=True,
           aliases=("سید جواد میری",)),
    Figure("ebrahim-fayyaz", "ابراهیم فیاض", "جامعه‌شناس و پژوهشگر", "society", external=True),
    Figure("emad-afrough", "عماد افروغ", "جامعه‌شناس و پژوهشگر", "society", external=True,
           aliases=("عماد افروغ",)),
    Figure("shahriar-zarshenas", "شهریار زرشناس", "نویسنده و پژوهشگر فلسفه و سیاست", "culture", external=True),
    Figure("mohammad-sadegh-kooshki", "محمدصادق کوشکی", "پژوهشگر و استاد علوم سیاسی", "politics", external=True, aliases=("صادق کوشکی",)),
    Figure("sajjad-saffar-harandi", "محمدسجاد صفار هرندی", "جامعه‌شناس و پژوهشگر فرهنگی", "society", external=True, aliases=("سجاد صفار هرندی", "محمد سجاد صفار هرندی")),
    Figure("hasan-shamaizadeh", "حسن شماعی‌زاده", "خواننده و آهنگساز", "culture", external=True),
    Figure("hila-sedighi", "هیلا صدیقی", "شاعر و هنرمند", "culture",
           (("website", "https://www.hilasedighi.com/"),), "f", external=True),
    Figure("fatemeh-ekhtesari", "فاطمه اختصاری", "شاعر و نویسنده", "culture", (), "f", external=True),
    Figure("seyed-mehdi-mousavi", "سید مهدی موسوی", "شاعر و نویسنده", "culture", external=True,
           aliases=("مهدی موسوی",)),
    Figure("maryam-hooleh", "مریم هوله", "شاعر و نویسنده", "culture", (), "f", external=True),
    Figure("granaz-moussavi", "گراناز موسوی", "شاعر و فیلم‌ساز", "culture", (), "f", external=True, aliases=("گراناز موسوی",)),
    Figure("roja-chamani", "رزا جمالی", "شاعر و مترجم", "culture", (), "f", external=True),
    Figure("ali-abdolrezaei", "علی عبدالرضایی", "شاعر و نویسنده", "culture", external=True, aliases=("علی عبدالرضایی",)),
    Figure("pegah-ahmadi", "پگاه احمدی", "شاعر، مترجم و منتقد ادبی", "culture", (), "f", external=True),
    Figure("azita-ghahreman", "آزیتا قهرمان", "شاعر و نویسنده", "culture", (), "f", external=True),
    Figure("mona-zendedel", "مونا زنده‌دل", "شاعر و نویسنده", "culture", (), "f", external=True),
    Figure("vahid-najafi", "وحید نجفی", "شاعر و نویسنده", "culture", external=True),
    Figure("mohammad-saeed-mirzaei", "محمد سعید میرزایی", "شاعر و نویسنده", "culture", external=True),
    Figure("andisheh-fouladvand", "اندیشه فولادوند", "شاعر و بازیگر", "culture", (), "f", external=True),
    Figure("reza-baraheni", "رضا براهنی", "شاعر، نویسنده و منتقد ادبی", "culture", external=True),
    Figure("yaghma-golrouee", "یغما گلرویی", "شاعر و ترانه‌سرا", "culture",
           (("telegram", "https://t.me/yaghmagolrouee"),), external=True),
    Figure("ebi-hamedi", "ابی (ابراهیم حامدی)", "خواننده", "culture",
           (("website", "https://ebihamedi.com/"),), external=True,
           aliases=("ابی", "ابراهیم حامدی")),
    Figure("dariush-eghbali", "داریوش اقبالی", "خواننده و فعال اجتماعی", "culture",
           (("website", "https://dariush2000.com/"),), external=True,
           aliases=("داریوش",)),
    Figure("leila-forouhar", "لیلا فروهر", "خواننده و بازیگر", "culture",
           (("telegram", "https://t.me/Leilaforouhar"),), "f", external=True),
    Figure("googoosh", "گوگوش", "خواننده و بازیگر", "culture",
           (("telegram", "https://t.me/Googoosh"),), "f", external=True,
           aliases=("فائقه آتشین", "فائقه آتشین گوگوش")),
    Figure("arash-azizi", "آرش عزیزی", "نویسنده و پژوهشگر تاریخ", "history", external=True),
    Figure("keyvan-abbassi", "کیوان عباسی", "مدیر رسانه", "media", external=True),
    Figure("javad-zarif", "محمدجواد ظریف", "دیپلمات", "foreign", external=True,
           aliases=("محمد جواد ظریف",)),
    Figure("masoud-behnoud", "مسعود بهنود", "روزنامه‌نگار و نویسنده", "media",
           (("youtube", "https://www.youtube.com/@mbehnoud"),), external=True),
    Figure("shirin-ebadi", "شیرین عبادی", "حقوقدان و فعال حقوق بشر", "law", (), "f", external=True),
    Figure("narges-mohammadi", "نرگس محمدی", "فعال حقوق بشر", "law", (), "f", external=True),
    Figure("elnaz-shakerdoost", "الناز شاکردوست", "بازیگر", "cinema", (), "f", external=True),
    Figure("zagros-rashidi", "زاگرس رشیدی", "پژوهشگر ژئوپلیتیک", "foreign", external=True),
    Figure("hossein-entezami", "حسین انتظامی", "مدیر فرهنگی و رسانه‌ای", "media", external=True),
    Figure("mahnaz-shirali", "مهناز شیرالی", "جامعه‌شناس و پژوهشگر", "society", (), "f", external=True),
    Figure("fayaz-zahed", "فیاض زاهد", "روزنامه‌نگار و تحلیلگر سیاسی", "politics", external=True),
    Figure("soufia-abdollahi", "صوفیا عبداللهی", "سردبیر پیشخوان کتاب · هم‌بنیان‌گذار پادکست سر و کله", "media",
           (("x", "https://twitter.com/soufelang"),
            ("podcast", "https://castbox.fm/channel/id4988561?utm_source=podcaster&utm_medium=dlink&utm_campaign=c_4988561&utm_content=%D9%BE%DB%8C%D8%B4%D8%AE%D9%88%D8%A7%D9%86%20%DA%A9%D8%AA%D8%A7%D8%A8-CastBox_FM")),
           aliases=("Soufia Abdollahi", "صوفیا عبدالهی"),
           avatar="assets/pendar/figures/soufia-abdollahi.jpg"),
    Figure("nima-afshar-naderi", "نیما افشارنادری", "تولیدکننده محتوا و میزبان «جان کلام»", "media",
           (("x", "https://x.com/nimania"),
            ("instagram", "https://www.instagram.com/nima.afsharnaderi/"),
            ("youtube", "https://www.youtube.com/channel/UCYDOVO7EpX3QNEf9Ddk1-AQ"),
            ("telegram", "https://t.me/nimaafsharnaderi"),
            ("website", "https://grokipedia.com/page/nima-afshar-naderi"),
            ("github", "https://nimania.github.io/"),
            ("diner", "https://www.instagram.com/nimasdiner/")), external=True,
           aliases=("نیما افشار نادری", "Nima Afshar Naderi")),

    # ══════════════════════════════════════════════════════════════════════
    #  چهره‌های بین‌المللی — منابع چندزبانه
    # ══════════════════════════════════════════════════════════════════════
    Figure("donald-trump", "دونالد ترامپ", "رئیس‌جمهور ایالات متحده", "foreign",
           (("website", "https://www.whitehouse.gov/administration/donald-j-trump/"),
            ("truthsocial", "https://truthsocial.com/@realDonaldTrump")), external=True,
           avatar="https://encrypted-tbn0.gstatic.com/licensed-image?q=tbn:ANd9GcTZkCFGyioBQXspTYONjbClEc1qCWhVPg832Ivxb_UFqgEb5xhpb1zbzgSVGjwrMjw3kGtPVA7xMtYN7NOUJOoqDHwd9Fu0zAy7RYjui5MMEh-BAGlr94I4E8ESQBJ5VYD740kLc_Gg&s=19"),

    # ══════════════════════════════════════════════════════════════════════
    #  سیاست خارجی
    # ══════════════════════════════════════════════════════════════════════
    Figure("sahandiranmehr", "سهند ایرانمهر", "پژوهشگر روابط بین‌الملل", "foreign",
           (("x", "https://x.com/sahandiranmehr"),
            ("youtube", "https://youtube.com/@sahandiranmehr"))),
    Figure("IzadiFoad", "فواد ایزدی", "استاد دانشکده مطالعات جهان دانشگاه تهران", "foreign",
           (("x", "https://x.com/IzadiFoad"),
            ("instagram", "https://instagram.com/izadifoad"))),
    Figure("rezanasrichannel", "رضا نصری", "حقوقدان بین‌المللی و تحلیلگر دیپلماسی", "foreign"),
    Figure("Karimipour_K", "یدالله کریمی‌پور", "پژوهشگر ژئوپلیتیک", "foreign"),
    Figure("MehdiMotaharnia1344", "مهدی مطهرنیا", "پژوهشگر آینده‌پژوهی و روابط بین‌الملل", "foreign"),
    Figure("majidtafreshi", "مجید تفرشی", "تاریخ‌نگار و پژوهشگر مسائل معاصر", "foreign",
           (("x", "https://x.com/majidtafreshi"),)),
    Figure("yekhezaran", "حسین جابری‌انصاری", "دیپلمات و پژوهشگر مسائل منطقه‌ای", "foreign",
           (("instagram", "https://instagram.com/jaberi_ansari"),)),
    Figure("covid_policy_dip", "کوروش احمدی", "دیپلمات بازنشسته و پژوهشگر روابط بین‌الملل", "foreign"),

    # ══════════════════════════════════════════════════════════════════════
    #  جامعه و اندیشهٔ اجتماعی
    # ══════════════════════════════════════════════════════════════════════
    Figure("mfarasatkhah", "مقصود فراستخواه", "جامعه‌شناس و استاد آموزش عالی", "society"),
    Figure("dr_bokharaei", "احمد بخارایی", "جامعه‌شناس", "society"),
    Figure("darwinsabouri", "داروین صبوری", "جامعه‌شناس", "society",
           (("youtube", "https://youtube.com/@darwinsabouri"),)),
    Figure("mostafadaneshgar", "مصطفی دانشگر", "نویسنده و پژوهشگر مسائل ایران", "society"),
    Figure("DrAzarakhshMokri", "آذرخش مکری", "روان‌پزشک و مدرس دانشگاه", "society",
           (("youtube", "https://youtube.com/@DrAzarakhshMokriOfficial"),
            ("instagram", "https://instagram.com/azarakhshmokri"))),
    Figure("bahadaf", "فرهنگ هلاکویی", "روان‌شناس و مدرس", "society",
           (("website", "https://bahadaf.ir"),
            ("instagram", "https://instagram.com/dr.f_holakouee"),
            ("youtube", "https://www.youtube.com/@dr.holakoueeofficialchannel"))),
    Figure("drsiminkazemi", "سیمین کاظمی", "پزشک و جامعه‌شناس", "society", (), "f"),
    Figure("hamidrezajalaeipour", "حمیدرضا جلایی‌پور", "جامعه‌شناس سیاسی", "society"),
    Figure("nasserfakouhi", "ناصر فکوهی", "انسان‌شناس و استاد دانشگاه", "society",
           (("website", "https://nasserfakouhi.com"),)),
    Figure("jalaeipour", "محمدرضا جلایی‌پور", "جامعه‌شناس و پژوهشگر سیاست‌گذاری اجتماعی", "society",
           (("instagram", "https://instagram.com/m.jalaeipour"),)),
    Figure("mostafamehraeen", "مصطفی مهرآیین", "جامعه‌شناس و پژوهشگر فرهنگ", "society"),
    Figure("DrNematallahFazeli", "نعمت‌الله فاضلی", "انسان‌شناس و پژوهشگر مطالعات فرهنگی", "society"),
    Figure("Renani_Mohsen", "محسن رنانی", "اقتصاددان و پژوهشگر توسعه", "society",
           (("website", "https://renani.net"),)),

    # ══════════════════════════════════════════════════════════════════════
    #  اقتصاد
    # ══════════════════════════════════════════════════════════════════════
    Figure("ghaninejad_mousa", "موسی غنی‌نژاد", "اقتصاددان", "economy"),
    Figure("HosseinRaghfar", "حسین راغفر", "اقتصاددان", "economy"),
    Figure("farshad_momeni", "فرشاد مومنی", "اقتصاددان", "economy"),
    Figure("masoudnili", "مسعود نیلی", "اقتصاددان و مشاور اقتصادی", "economy"),
    Figure("MohammadTabibian", "محمد طبیبیان", "اقتصاددان و استاد دانشگاه", "economy"),
    Figure("economics_and_finance", "پویا ناظران", "اقتصاددان", "economy"),
    Figure("ahemmati", "عبدالناصر همتی", "اقتصاددان و رئیس سابق بانک مرکزی", "economy"),
    Figure("mohsenjalalpour", "محسن جلال‌پور", "فعال بخش خصوصی و تحلیلگر اقتصادی", "economy"),
    Figure("Sadegh_Alhosseini", "صادق الحسینی", "پژوهشگر اقتصاد و سیاست‌گذاری", "economy",
           (("x", "https://x.com/alhosseini"),
            ("instagram", "https://instagram.com/sadegh_alhosseini"))),
    Figure("ali_sarzaeem", "علی سرزعیم", "اقتصاددان", "economy",
           (("website", "https://sarzaeem.ir"),)),

    # ══════════════════════════════════════════════════════════════════════
    #  محیط‌زیست
    # ══════════════════════════════════════════════════════════════════════
    Figure("KavehMadani", "کاوه مدنی", "پژوهشگر آب و محیط‌زیست", "environment"),
    Figure("darvishnameh", "محمد درویش", "فعال محیط‌زیست", "environment", bale="darvishnameh"),

    # ══════════════════════════════════════════════════════════════════════
    #  رسانه و تحلیل
    # ══════════════════════════════════════════════════════════════════════
    Figure("HosseinBastaniChannel", "حسین باستانی", "روزنامه‌نگار و تحلیلگر", "media"),
    Figure("mohajerimohamad", "محمد مهاجری", "روزنامه‌نگار", "media",
           (("x", "https://x.com/mohmohajeri"),)),
    Figure("NegarMim", "نگار مرتضوی", "روزنامه‌نگار و تحلیلگر سیاسی", "media", (), "f"),
    Figure("hoderestan", "حسین درخشان", "نویسنده و پژوهشگر رسانه", "media"),
    Figure("iraj_mesdaghi", "ایرج مصداقی", "نویسنده و تحلیلگر سیاسی", "media",
           (("website", "https://irajmesdaghi.com"),)),
    Figure("iranoralhistory", "حسین دهباشی", "تاریخ‌پژوه و مستندساز", "media",
           (("instagram", "https://instagram.com/hossein.dehbashi2020"),)),
    Figure("KGhafouri", "کامبیز غفوری", "روزنامه‌نگار", "media",
           (("x", "https://x.com/KambizGhafouri"),
            ("instagram", "https://instagram.com/kambiz.ghafouri.public"))),
    Figure("mohamadaliabtahi", "محمدعلی ابطحی", "روحانی و فعال سیاسی", "media"),
    Figure("DrMahdiKhazali", "مهدی خزعلی", "پزشک و فعال سیاسی", "politics",
           (("x", "https://twitter.com/mahdi_khazali"),
            ("instagram", "https://instagram.com/mahdikhazali"))),
    Figure("vahidBahman1", "وحید بهمن", "پژوهشگر و تحلیلگر مسائل ایران و منطقه", "politics"),
    Figure("shahinnajafimusic", "شاهین نجفی", "خواننده و ترانه‌سرا", "culture"),
    Figure("Imansoleymaniamiri", "ایمان سلیمانی امیری", "نویسنده و منتقد دین", "religion",
           (("instagram", "https://instagram.com/imansoleimaniamiri"),
            ("youtube", "https://www.youtube.com/channel/UCTeJ9xtTseVNYCRnmV7Mtdw"))),
    Figure("FahimehKhezr", "فهیمه خضر حیدری", "روزنامه‌نگار و مجری", "media", (), "f"),
    Figure("MoradVaisi_Live", "مراد ویسی", "روزنامه‌نگار و تحلیلگر", "media"),
    Figure("farhoodi", "بیژن فرهودی", "روزنامه‌نگار و مصاحبه‌گر", "media"),
    Figure("mahdiehgolroo", "مهدیه گلرو", "فعال سیاسی", "politics", (), "f"),
    Figure("masih_alinejad", "مسیح علینژاد", "روزنامه‌نگار و فعال سیاسی", "media",
           (("x", "https://twitter.com/AlinejadMasih"),
            ("instagram", "https://instagram.com/masih.alinejad")), "f"),

    # ══════════════════════════════════════════════════════════════════════
    #  دین و اندیشهٔ دینی
    # ══════════════════════════════════════════════════════════════════════
    Figure("Baznegari", "امیر ترکاشوند", "پژوهشگر تاریخ و متون دینی", "religion"),
    Figure("abolghasemfanaei", "ابوالقاسم فنائی", "پژوهشگر فلسفه اخلاق و دین", "religion",
           (("instagram", "https://instagram.com/Abolghasemfanaei"),)),
    Figure("Mohsen_Kadivar_Official", "محسن کدیور", "پژوهشگر دین و فلسفهٔ دین", "religion",
           (("website", "https://kadivar.com"),)),
    Figure("mohammadsorooshmahallati", "محمد سروش محلاتی", "پژوهشگر فقه و اندیشهٔ دینی",
           "religion"),
    Figure("NewHasanMohaddesi", "حسن محدثی", "جامعه‌شناس دین", "religion"),
    Figure("nasiri42", "مهدی نصیری", "نویسنده و تحلیلگر دین و سیاست", "religion"),

    # ══════════════════════════════════════════════════════════════════════
    #  فلسفه و اندیشه
    # ══════════════════════════════════════════════════════════════════════
    Figure("mostafamalekian", "مصطفی ملکیان", "پژوهشگر فلسفه و اخلاق", "philosophy"),
    Figure("Mardihamorteza", "مرتضی مردیها", "پژوهشگر فلسفه و علوم انسانی", "philosophy",
           (("instagram", "https://instagram.com/mardihamorteza"),
            ("youtube", "https://youtube.com/@MortazaMardiha"))),
    Figure("khalajich", "مهدی خلجی", "پژوهشگر علوم انسانی و اندیشه", "philosophy"),
    Figure("Soroushdabbagh_Official", "سروش دباغ", "پژوهشگر فلسفه", "philosophy",
           (("x", "https://x.com/dabbaghsoroush"),
            ("instagram", "https://instagram.com/soroush_dabbagh"))),
    Figure("bijanabdolkarimi", "بیژن عبدالکریمی", "فیلسوف و استاد فلسفه", "philosophy", bale="bijanabdolkarimi"),

    # ══════════════════════════════════════════════════════════════════════
    #  تاریخ
    # ══════════════════════════════════════════════════════════════════════
    Figure("abdollahshahbazi", "عبدالله شهبازی", "مورخ", "history",
           (("website", "https://shahbazi.org"),
            ("x", "https://twitter.com/ashahb"),
            ("facebook", "https://facebook.com/abdollah.shahbazi"))),

    # ══════════════════════════════════════════════════════════════════════
    #  علوم سیاسی و توسعه
    # ══════════════════════════════════════════════════════════════════════
    Figure("sariolghalam", "محمود سریع‌القلم", "استاد علوم سیاسی و روابط بین‌الملل",
           "development"),
    Figure("Dr_Lashkarbolouki", "مجتبی لشکربلوکی", "پژوهشگر استراتژی و توسعه",
           "development", (("website", "https://lashkarbolouki.com"),)),
    Figure("sharenovate", "امیر ناظمی", "پژوهشگر سیاست‌گذاری علم، فناوری و توسعه",
           "development"),
    Figure("taghirahmani", "تقی رحمانی", "نویسنده و فعال سیاسی", "opposition"),
    Figure("mojvahedi", "مجتبی واحدی", "روزنامه‌نگار و تحلیلگر سیاسی", "opposition"),
    Figure("Reasondoubt", "غزال مدیریان", "پژوهشگر و فعال سیاسی", "opposition"),
    Figure("mohsensazegara", "محسن سازگارا", "تحلیلگر سیاسی", "opposition",
           (("youtube", "https://youtube.com/@MohsenSazegara"),)),

    # ══════════════════════════════════════════════════════════════════════
    #  سینما و نقد
    # ══════════════════════════════════════════════════════════════════════
    Figure("massoud_farassatI", "مسعود فراستی", "منتقد سینما و ادبیات", "cinema"),

    # ══════════════════════════════════════════════════════════════════════
    #  فرهنگ و هنر
    # ══════════════════════════════════════════════════════════════════════
    Figure("asghari_weatherman", "محمد اصغری", "کارشناس هواشناسی", "environment",
           (("instagram", "https://www.instagram.com/asghari_weatherman"),),
           bale="asghari_weatherman"),
    Figure("bahman_babazadeh", "بهمن بابازاده", "خبرنگار موسیقی", "culture"),
    Figure("yarrahimehdi", "مهدی یراحی", "خواننده، آهنگساز و تهیه‌کننده موسیقی", "culture",
           (("x", "https://x.com/yarrahimehdi"),
            ("instagram", "https://instagram.com/mehdiyarrahi"),)),
    Figure("monaborzouei", "مونا برزویی", "شاعر و ترانه‌سرا", "culture",
           (("x", "https://x.com/monaborzouei"),
            ("instagram", "https://instagram.com/monaborzouei"),
            ("website", "https://borzouei.net")), external=True),
]


SOCIAL_FA = {"website": "وب‌سایت", "github": "گیت‌هاب", "diner": "Nima’s Diner", "x": "ایکس", "instagram": "اینستاگرام",
             "youtube": "یوتیوب", "facebook": "فیس‌بوک", "telegram": "تلگرام", "bale": "بله", "podcast": "پادکست",
             "truthsocial": "تروث سوشیال", "eitaa": "ایتا", "rubika": "روبیکا",
             "soroush": "سروش‌پلاس", "igap": "آی‌گپ"}


def figure_social(f: Figure) -> list[dict]:
    """Public links for a figure, Telegram channel first."""
    th = f.telegram_handle or (None if f.external else f.handle)
    links = [] if not th else [{"kind": "telegram", "label": SOCIAL_FA["telegram"],
              "url": f"https://t.me/{th}"}]
    if f.bale:
        links.append({"kind": "bale", "label": SOCIAL_FA["bale"], "url": f"https://ble.ir/{f.bale}"})
    for kind, url in f.social:
        label = "پادکست پیشخوان کتاب" if f.handle == "soufia-abdollahi" and kind == "podcast" else SOCIAL_FA.get(kind, kind)
        links.append({"kind": kind, "label": label, "url": url})
    return links


def figure_source_name(f: Figure) -> str:
    # Unique across `sources` (news outlets use their own names).
    return f"چهره: {f.name_fa}"


def figure_feed_url(f: Figure) -> str:
    th = f.telegram_handle or (None if f.external else f.handle)
    return f"https://t.me/s/{th}" if th else ""


def figure_home_url(f: Figure) -> str:
    th = f.telegram_handle or (None if f.external else f.handle)
    if th:
        return f"https://t.me/{th}"
    if f.external:
        return next((url for kind, url in f.social if kind in {"truthsocial", "website", "podcast"}), "")
    return f"https://t.me/{f.handle}"
