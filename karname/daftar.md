# دفتر بازسازی‌شدهٔ کارنامهٔ پیش‌بینی‌ها

> **هشدار منشأ:** این فایل، بازسازیِ مستند از داده‌های موجود است و **نسخهٔ اصلی و کامل دفتر Claude نیست**. ادعاهای قدیمی از پروندهٔ سوری و نه مدخل تازه از گزارش‌های ثانویهٔ پندار ثبت شده‌اند. تا پیدا شدن دفتر کامل، هیچ نتیجه‌ای را نهایی یا مستقلاً تأییدشده تلقی نکنید.

این فایل **مرجع ویرایش** کارنامه در مخزن `nimania/pendar` است. قسمت JSON زیر دادهٔ ساختاریافتهٔ دفتر است. فایل `backend/data/karname.json` باید از این قسمت توسط `backend/scripts/build_karname.py` بازسازی شود و مستقلاً ویرایش نشود.

## پوشش و قواعد

- 18 مدخل ثبت‌شده از 9 گوینده؛ شامل یک پروندهٔ ثبت‌شده توسط کاربر و گزیده‌ای از ری‌کپ‌های پندار.
- گفتار یا گزارش ثانویه با برچسب منبع نگهداری می‌شود؛ تا وقتی ویدئوی اصلی احراز نشده، آن را **نقل‌قول مستقیم** ننامید.
- برآورد احتمال، سناریوی مشروط، پیش‌بینی زمان‌دار و نظر کلی از هم جدا هستند.
- نتیجه‌ای بدون مستندات مستقل و بررسی‌شده درج نمی‌شود؛ موارد «نقل گزارش» در درصد موفقیت نمی‌آیند.
- پروندهٔ کامل Claude که شامل شناسه‌های `K-...`، شش سناریو و روابط رودررو است **هنوز به این دفتر منتقل نشده است**؛ شناسه‌های موجود را تغییر ندهید و در ادغام آینده از تطبیق متن/گوینده/تاریخ برای جلوگیری از تکرار استفاده کنید.

## دادهٔ ساختاریافته (ویرایش فقط این بخش)

```json
{
  "as_of": "2026-11-05",
  "as_of_fa": "۱۴ آبان ۱۴۰۵",
  "dataset_scope": "reconstructed_partial_ledger",
  "is_complete": false,
  "provenance": {
    "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
    "source_type": "user_provided_transcript",
    "source_url": null,
    "source_registered_at": "2026-11-02",
    "source_path": "karname/imports/jan_kalam_souri_predictions_2026-11-01.json",
    "disclosure": "بانک بازسازی‌شدهٔ ناقص: 18 مدخل از پروندهٔ سوری و گزارش‌های ثانویهٔ پندار. دفتر جامع Claude هنوز دریافت نشده و پیوند مستقیم برخی ویدئوها موجود نیست؛ هیچ ادعا به‌طور مستقل نمره‌گذاری نشده است.",
    "attribution_correction": {
      "date": "2026-11-05",
      "speaker_key": "abbas-souri",
      "previous_label": "عباس (نام خانوادگی نامشخص)",
      "corrected_label": "عباس سوری",
      "basis": "تصحیح صریح نام گوینده توسط کاربر؛ فایل خام اولیه برای بررسی تاریخچه بدون تغییر نگه داشته شده است"
    },
    "additional_source_path": "backend/data/editorial-recaps.json",
    "reconstruction_note": "۹ مدخل دیگر از خلاصه‌های منتشرشدهٔ پندار با حفظ تاریخ، نام، مشروط‌بودن و مرز شواهد اضافه شده‌اند."
  },
  "scale": [
    {
      "key": "correct",
      "mark": "✅",
      "label": "درست",
      "score": 1
    },
    {
      "key": "partial",
      "mark": "🟡",
      "label": "نیمه‌درست",
      "score": 0.5
    },
    {
      "key": "incorrect",
      "mark": "❌",
      "label": "نادرست",
      "score": 0
    },
    {
      "key": "awaiting",
      "mark": "⏳",
      "label": "در انتظار ارزیابی",
      "score": null
    }
  ],
  "scenario_families": [],
  "buckets": [
    {
      "key": "b1",
      "label": "۳ نوامبر ۲۰۲۶ · انتخابات آمریکا",
      "date": "2026-11-03"
    },
    {
      "key": "b2",
      "label": "۱۵ نوامبر ۲۰۲۶",
      "date": "2026-11-15"
    },
    {
      "key": "b3",
      "label": "۲۰ مارس ۲۰۲۷",
      "date": "2027-03-20"
    },
    {
      "key": "b4",
      "label": "۳۱ مارس ۲۰۲۷",
      "date": "2027-03-31"
    },
    {
      "key": "b5",
      "label": "تا نوامبر ۲۰۳۰",
      "date": "2030-11-01"
    },
    {
      "key": "e1",
      "label": "بدون موعد قابل سنجش"
    },
    {
      "key": "e2",
      "label": "منوط به وقوع رویداد"
    },
    {
      "key": "b6",
      "label": "۵ آبان ۱۴۰۵ — انتخابات اسرائیل",
      "date": "2026-10-27"
    },
    {
      "key": "b7",
      "label": "تا ۳ ژانویهٔ ۲۰۲۷ — بازهٔ آمریکا",
      "date": "2027-01-03"
    },
    {
      "key": "b8",
      "label": "تا ۱۹ آوریل ۲۰۲۷ — شش ماه",
      "date": "2027-04-19"
    },
    {
      "key": "e3",
      "label": "رویدادمحور و بدون موعد قطعی"
    }
  ],
  "speakers": [
    {
      "key": "abbas-souri",
      "name": "عباس سوری",
      "handle": null
    },
    {
      "key": "benjamin-souri",
      "name": "بنیامین سوری، مجری",
      "handle": null
    },
    {
      "key": "scott-bessent-quoted",
      "name": "اسکات بسنت (نقل‌شده در گفت‌وگو)",
      "handle": null
    },
    {
      "key": "mehdi-motaharnia",
      "name": "مهدی مطهرنیا",
      "handle": "MehdiMotaharnia1344"
    },
    {
      "key": "farhang-holakouee",
      "name": "فرهنگ هلاکویی",
      "handle": "bahadaf"
    },
    {
      "key": "ahmad-zeidabadi",
      "name": "احمد زیدآبادی",
      "handle": "ahmadzeidabad"
    },
    {
      "key": "mohammad-marandi",
      "name": "سید محمد مرندی",
      "handle": "mohammad-marandi"
    },
    {
      "key": "foad-izadi",
      "name": "فؤاد ایزدی",
      "handle": "foad-izadi"
    },
    {
      "key": "yousef-azizi",
      "name": "یوسف عزیزی",
      "handle": "yousef-azizi"
    }
  ],
  "claims": [
    {
      "id": "SOURI-20261101-01",
      "kind": "K",
      "text": "وقوع جنگ تازه با ایران قطعی است",
      "speakers": [
        "abbas-souri"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: گزاره کلی؛ فاقد افق زمانی مشخص\nمعیار سنجش: وقوع حمله نظامی تازه و قابل تأیید به ایران\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "پیش‌بینی قطعی بدون موعد",
      "type_class": "پیش‌بینی",
      "scenarios": [],
      "scenario_label": "",
      "condition": "",
      "due_label": "بدون موعد دقیق",
      "bucket": "e1",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "وقوع حمله نظامی تازه و قابل تأیید به ایران",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-02",
      "kind": "K",
      "text": "احتمال وقوع جنگ پیش از نوروز ۱۴۰۶ نزدیک ۹۹.۹ درصد است",
      "speakers": [
        "benjamin-souri"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: عدد و موعد از بیان مجری؛ نه نقل مستقیم از مهمان\nمعیار سنجش: آغاز حمله نظامی تازه به ایران تا پایان ۲۰ مارس ۲۰۲۷\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "پیش‌بینی احتمالی",
      "type_class": "پیش‌بینی",
      "scenarios": [],
      "scenario_label": "",
      "condition": "",
      "due_label": "2027-03-20",
      "bucket": "b3",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "آغاز حمله نظامی تازه به ایران تا پایان ۲۰ مارس ۲۰۲۷",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-03",
      "kind": "K",
      "text": "جمهوری‌خواهان اکثریت سنا را در انتخابات میان‌دوره‌ای حفظ می‌کنند",
      "speakers": [
        "abbas-souri"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: نتیجه نهایی ممکن است پس از روز رأی‌گیری مشخص شود\nمعیار سنجش: اکثریت کرسی‌های سنای آمریکا پس از انتخابات و روشن شدن ترکیب\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "پیش‌بینی انتخاباتی",
      "type_class": "پیش‌بینی",
      "scenarios": [],
      "scenario_label": "",
      "condition": "",
      "due_label": "2026-11-03",
      "bucket": "b1",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "اکثریت کرسی‌های سنای آمریکا پس از انتخابات و روشن شدن ترکیب",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-04",
      "kind": "K",
      "text": "جمهوری‌خواهان احتمالاً کنترل مجلس نمایندگان را از دست می‌دهند",
      "speakers": [
        "abbas-souri"
      ],
      "speaker_note": "معیار سنجش: اکثریت کرسی‌های مجلس نمایندگان پس از انتخابات\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "پیش‌بینی احتمالی",
      "type_class": "پیش‌بینی",
      "scenarios": [],
      "scenario_label": "",
      "condition": "",
      "due_label": "2026-11-03",
      "bucket": "b1",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "اکثریت کرسی‌های مجلس نمایندگان پس از انتخابات",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-05",
      "kind": "K",
      "text": "حفظ سنا توسط جمهوری‌خواهان احتمال تعویق بیشتر جنگ را بالا می‌برد؛ شکست آنان ممکن است حمله را نزدیک کند",
      "speakers": [
        "abbas-souri"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: مشروط و فاقد بازه صریح برای دیرتر/زودتر\nمعیار سنجش: نتیجه سنا و فاصله زمانی وقوع یا عدم وقوع حمله؛ بدون معیار قطعی علیت\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "پیش‌بینی مشروط",
      "type_class": "پیش‌بینی",
      "scenarios": [],
      "scenario_label": "",
      "condition": "مشروط و فاقد بازه صریح برای دیرتر/زودتر",
      "due_label": "پس از 2026-11-03",
      "bucket": "e2",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "نتیجه سنا و فاصله زمانی وقوع یا عدم وقوع حمله؛ بدون معیار قطعی علیت",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-06",
      "kind": "K",
      "text": "حمله گسترده به زیرساخت‌های ایران به سود بلندمدت آمریکا نیست و احتمالاً انجام نمی‌شود",
      "speakers": [
        "abbas-souri"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: پیش‌بینی مشروط به وقوع جنگ\nمعیار سنجش: گزارش حملات و اهداف تأییدشده، به‌ویژه نیروگاه و زیرساخت انرژی\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "پیش‌بینی مشروط",
      "type_class": "پیش‌بینی",
      "scenarios": [],
      "scenario_label": "",
      "condition": "پیش‌بینی مشروط به وقوع جنگ",
      "due_label": "در جنگ احتمالی بعدی",
      "bucket": "e2",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "گزارش حملات و اهداف تأییدشده، به‌ویژه نیروگاه و زیرساخت انرژی",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-07",
      "kind": "L",
      "text": "راست‌گرایان در اروپا در سه تا چهار سال آینده تقویت می‌شوند",
      "speakers": [
        "abbas-souri"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: کشورها و سنجه دقیق در گفت‌وگو تعیین نشده\nمعیار سنجش: سهم آرا و کرسی احزاب راست در انتخابات منتخب اروپا نسبت به مبنا\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "پیش‌بینی بلندمدت",
      "type_class": "پیش‌بینی",
      "scenarios": [],
      "scenario_label": "",
      "condition": "",
      "due_label": "2029-11-01 تا 2030-11-01",
      "bucket": "b5",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "سهم آرا و کرسی احزاب راست در انتخابات منتخب اروپا نسبت به مبنا",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-08",
      "kind": "K",
      "text": "اقتصاد ایران از مارس ۲۰۲۶ تا مارس ۲۰۲۷ بیش از ۲۵٪ کوچک خواهد شد",
      "speakers": [
        "scott-bessent-quoted"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: پیش‌بینی مقام آمریکایی؛ نه پیش‌بینی اصیل عباس\nمعیار سنجش: تغییر GDP واقعی در بازه تعریف‌شده بر اساس منبع آماری معتبر\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "نقل گزارش",
      "type_class": "نقل گزارش",
      "scenarios": [],
      "scenario_label": "",
      "condition": "",
      "due_label": "2027-03-31",
      "bucket": "b4",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "تغییر GDP واقعی در بازه تعریف‌شده بر اساس منبع آماری معتبر",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "SOURI-20261101-09",
      "kind": "K",
      "text": "بازه ۴ تا ۱۵ نوامبر برای حمله به ایران در روایت رسانه‌ای مطرح است",
      "speakers": [
        "benjamin-souri"
      ],
      "speaker_note": "قید و احتیاط ثبت‌شده: مطرح‌شده به‌صورت نقل گمانه رسانه‌ای؛ نباید به مهمان نسبت داده شود\nمعیار سنجش: آغاز جنگ در بازه ۴–۱۵ نوامبر ۲۰۲۶\nوضعیت منبع: آزمون‌نشده",
      "said": "2026-11-01",
      "type": "نقل گزارش",
      "type_class": "نقل گزارش",
      "scenarios": [],
      "scenario_label": "",
      "condition": "",
      "due_label": "2026-11-15",
      "bucket": "b2",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_provided_transcript",
      "source_url": null,
      "evaluation_trigger": "آغاز جنگ در بازه ۴–۱۵ نوامبر ۲۰۲۶",
      "source_registration_date": "2026-11-02"
    },
    {
      "id": "PDR-MOT-20261008-01",
      "kind": "K",
      "speakers": [
        "mehdi-motaharnia"
      ],
      "text": "اگر فشارهای دیپلماتیک و اقتصادی به هدف مورد نظر نرسد، احتمال جنگی محدود اما پُرضربه مطرح است؛ گسترش جنگ هم منتفی نیست.",
      "said": "2026-10-08",
      "type": "سناریوی مشروط",
      "type_class": "پیش‌بینی مشروط",
      "condition": "شکست فشارهای دیپلماتیک و اقتصادی در دستیابی به هدف طرف مقابل",
      "due_label": "در صورت شکست فشارها؛ موعد ثابت ارائه نشده",
      "bucket": "e2",
      "evaluation_trigger": "برای ارزیابی باید تحقق شرط و نوع جنگ مستقل از روایت اولیه احراز شود.",
      "source_record_id": "editorial-motaharnia-golden-simorgh-qa-20261008",
      "source_title": "مهدی مطهرنیا | سیمرغ طلایی — پرسش‌وپاسخ",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": "https://www.youtube.com/@GoldenSimorgh-d4u",
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "اگر این فشارها به هدف مورد نظر طرف مقابل نرسند، احتمال جنگ محدود اما پرضربه را مطرح می‌کند",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-MOT-20261019-01",
      "kind": "K",
      "speakers": [
        "mehdi-motaharnia"
      ],
      "text": "در شش ماه آینده ضربات نظامی هوشیارانه‌ای رخ خواهد داد؛ رویدادهای کنونی مقدمهٔ ورود به منطق تسلیم یا جنگ گسترده‌ترند.",
      "said": "2026-10-19",
      "type": "پیش‌بینی زمان‌دار",
      "type_class": "پیش‌بینی",
      "due_label": "تا ۱۹ آوریل ۲۰۲۷ (شش ماه پس از ۱۹ اکتبر ۲۰۲۶)",
      "bucket": "b8",
      "evaluation_trigger": "بررسی وقوع حملات نظامی جدید و قابل تأیید در بازهٔ زمانی؛ عبارت «هوشیارانه» سنجهٔ مستقل دقیقی ندارد.",
      "source_record_id": "editorial-motaharnia-golden-simorgh-finale-20261019",
      "source_title": "مهدی مطهرنیا | سیمرغ طلایی",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": "https://www.youtube.com/@GoldenSimorgh-d4u",
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "در شش ماهِ آینده ضرباتِ نظامیِ هوشیارانه‌ای را شاهد خواهیم بود",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-HOL-20261008-01",
      "kind": "K",
      "speakers": [
        "farhang-holakouee"
      ],
      "text": "احتمال برخورد نظامی در فاصلهٔ پس از انتخابات میان‌دوره‌ای آمریکا تا آغاز کار کنگرهٔ جدید از نظر شخصی او بالاتر از ۶۰ تا ۷۰ درصد است.",
      "said": "2026-10-08",
      "type": "برآورد احتمال عددی",
      "type_class": "پیش‌بینی احتمالی",
      "due_label": "۳ نوامبر ۲۰۲۶ تا ۳ ژانویهٔ ۲۰۲۷",
      "bucket": "b7",
      "evaluation_trigger": "شروع درگیری نظامی تازهٔ قابل تأیید در بازهٔ ۳ نوامبر ۲۰۲۶ تا ۳ ژانویهٔ ۲۰۲۷؛ احتمال عددی پیش‌بینی قطعی نیست.",
      "source_record_id": "editorial-holakouee-meybodi-un-election-2026",
      "source_title": "فرهنگ هلاکویی | گفت‌وگو با علیرضا میبدی — برنامهٔ چهارشنبه",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": null,
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "احتمال برخورد نظامی را در ارزیابی شخصی خود بالاتر از ۶۰ تا ۷۰ درصد اعلام می‌کند",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-HOL-20261008-02",
      "kind": "K",
      "speakers": [
        "farhang-holakouee"
      ],
      "text": "اگر حمله‌ای انجام شود، موج نخست آن احتمالاً مراکز نظامی و موشکی ایران را هدف می‌گیرد.",
      "said": "2026-10-08",
      "type": "پیش‌بینی دربارهٔ اهداف جنگ",
      "type_class": "پیش‌بینی مشروط",
      "condition": "وقوع حملهٔ نظامی",
      "due_label": "موج نخست حملهٔ احتمالی؛ بدون تاریخ ثابت",
      "bucket": "e2",
      "evaluation_trigger": "مطابقت اهداف مرحلهٔ نخست حمله با مراکز نظامی و موشکی طبق منابع مستقل.",
      "source_record_id": "editorial-holakouee-meybodi-un-election-2026",
      "source_title": "فرهنگ هلاکویی | گفت‌وگو با علیرضا میبدی — برنامهٔ چهارشنبه",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": null,
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "پیش‌بینی‌اش این است که حملات نخست بر مراکز نظامی و موشکی متمرکز شود",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-ZEI-20261020-01",
      "kind": "K",
      "speakers": [
        "ahmad-zeidabadi"
      ],
      "text": "وقوع حملهٔ خارجی علیه ایران پیش از انتخابات پارلمانی اسرائیل در پنجم آبان بعید است، مگر در قالب ادعای حملهٔ پیش‌دستانه.",
      "said": "2026-10-20",
      "type": "پیش‌بینی احتمالی زمان‌دار",
      "type_class": "پیش‌بینی احتمالی",
      "condition": "جز در صورت ارائه و پذیرش ادعای اقدام پیش‌دستانه",
      "due_label": "تا ۵ آبان ۱۴۰۵ / ۲۷ اکتبر ۲۰۲۶",
      "bucket": "b6",
      "evaluation_trigger": "آیا پیش از ۲۷ اکتبر ۲۰۲۶ حملهٔ نظامی تازه علیه ایران رخ داد و استثنای ادعاشده چگونه صورت‌بندی شد؟",
      "source_record_id": "editorial-zeidabadi-shabehjang-eragh-20261020",
      "source_title": "احمد زیدآبادی | پیامِ ویدیویی",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": null,
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "بعید است پیش از پنجمِ آبان رخ دهد",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-ZEI-20261020-02",
      "kind": "K",
      "speakers": [
        "ahmad-zeidabadi"
      ],
      "text": "ائتلاف احزاب مخالف نتانیاهو در انتخابات پارلمانی اسرائیل در مجموع بیش از ۵۸ کرسی و شاید حد نصاب ۶۱ کرسی را به دست خواهد آورد.",
      "said": "2026-10-20",
      "type": "پیش‌بینی انتخاباتی احتمالی",
      "type_class": "پیش‌بینی احتمالی",
      "due_label": "پس از انتخابات ۵ آبان ۱۴۰۵ / تشکیل نتایج نهایی",
      "bucket": "b6",
      "evaluation_trigger": "سنجش کرسی‌های ائتلاف مدنظر در نتیجهٔ نهایی انتخابات؛ ترکیب دقیق احزاب باید از متن اصلی بازبینی شود.",
      "source_record_id": "editorial-zeidabadi-shabehjang-eragh-20261020",
      "source_title": "احمد زیدآبادی | پیامِ ویدیویی",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": null,
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "در مجموع بیش از پنجاه‌وهشت کرسی و شاید حدِ نصاب را به دست آورد",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-MAR-20261018-01",
      "kind": "K",
      "speakers": [
        "mohammad-marandi"
      ],
      "text": "در صورت حملهٔ محدودتر آمریکا به ایران، ایران واکنش سنگین نشان خواهد داد و تنگهٔ هرمز را می‌بندد.",
      "said": "2026-10-18",
      "type": "پیش‌بینی مشروط",
      "type_class": "پیش‌بینی مشروط",
      "condition": "وقوع حملهٔ نظامی محدودتر آمریکا به ایران",
      "due_label": "در صورت وقوع حملهٔ محدود آمریکا",
      "bucket": "e2",
      "evaluation_trigger": "ثبت حملهٔ محدود، واکنش نظامی ایران و هرگونه بسته‌شدن تأییدشدهٔ تنگهٔ هرمز.",
      "source_record_id": "editorial-marandi-yemen-saudi-20261018",
      "source_title": "سید محمد مرندی | گفت‌وگوی تحلیلی",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": null,
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "بازهم ایران محکم ضربه می‌زند، تنگه‌ی هرمز را می‌بندد",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-IZA-20261021-01",
      "kind": "K",
      "speakers": [
        "foad-izadi"
      ],
      "text": "در دو سال باقی‌مانده از دورهٔ ترامپ، جنگی با ایران رخ خواهد داد.",
      "said": "2026-10-21",
      "type": "پیش‌بینی زمان‌دار با افق تقریبی",
      "type_class": "پیش‌بینی",
      "due_label": "دو سال باقی‌ماندهٔ دورهٔ ترامپ (زمان دقیق بیان نیازمند بررسی نسخهٔ اصلی است)",
      "bucket": "e3",
      "evaluation_trigger": "احراز وقوع جنگ تازه در باقی‌ماندهٔ دورهٔ مورد اشاره؛ بازهٔ دقیق فقط با مراجعه به مصاحبهٔ اصلی تثبیت شود.",
      "source_record_id": "editorial-izadi-alizadeh-netanyahu-endorsement-2026",
      "source_title": "فؤاد ایزدی | گفت‌وگو با علی علیزاده",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": null,
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "در دو سالِ باقی‌مانده‌ی ترامپ جنگ خواهیم داشت",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    },
    {
      "id": "PDR-AZI-20261020-01",
      "kind": "L",
      "speakers": [
        "yousef-azizi"
      ],
      "text": "پس از انتخابات میان‌دوره‌ای آمریکا، خطر اقدام نظامی سنگین اما موقتی از سوی ترامپ برای اعلام پیروزی و سپس مذاکره وجود دارد.",
      "said": "2026-10-20",
      "type": "هشدار دربارهٔ سناریوی ممکن",
      "type_class": "سناریو، نه پیش‌بینی قطعی",
      "due_label": "پس از انتخابات ۳ نوامبر ۲۰۲۶؛ بدون موعد پایان",
      "bucket": "e3",
      "evaluation_trigger": "تا تعیین بازه و آستانهٔ وقوع از متن اصلی، ارزیابی کمی انجام نشود.",
      "source_record_id": "yousef-azizi-meydan-diplomasi-mehr1405",
      "source_title": "یوسف عزیزی | سیمرغ طلایی",
      "source_type": "secondary_editorial_recap",
      "source_ref_url": "https://github.com/nimania/pendar/blob/main/backend/data/editorial-recaps.json",
      "source_primary_url": null,
      "source_primary_unverified": true,
      "source_note": "بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "source_anchor": "پس از انتخابات دست به یک «حرکتِ نظامیِ سنگینِ موقت» بزند",
      "scenarios": [],
      "scenario_label": "",
      "speaker_note": "بازگویی از گزارش پندار با قیدها؛ نقل‌قول مستقیم محسوب نمی‌شود. بازگویی ثانویه از جان‌کلام پندار؛ تا بازیابی ویدئوی مستقیم، متنِ اصلی مستقلاً تطبیق داده نشده است.",
      "result": null,
      "result_source": null,
      "said_date_basis": "تاریخ ثبت یا انتشار ری‌کپ پندار است؛ روز دقیق بیان در ویدئوی اصلی مستقلاً تأیید نشده است.",
      "source_primary_verified": false
    }
  ],
  "pairs": [],
  "recaps": []
}
```

