# دفترِ اصلی کارنامه در پندار — بازگردانی از فایل Claude

> منبع حقیقت این مخزن از این پس بلوک JSON همین فایل است. این بلوک بر اساس خروجی کاملِ ارسالی کاربر از Claude (۸۰ مدخل)، ۹ مدخل گفت‌وگوی سوری و شش مدخل تکمیلی استخراج‌شده از ری‌کپ‌های پندار ساخته شده است. **سه مدخل با هم‌پوشانی احتمالی فقط آرشیو شده‌اند، نه حذف.** تعداد کل مدخل‌های فعال: ۹۵.

## مرزبندی منابع

- نسخهٔ اولیهٔ ۸۰ مدخلی، بدون تغییر در متن و شناسه‌ها: `karname/imports/claude-original-80-20261105.json`
- نسخهٔ پیشین ۱۸ مدخلی پندار و ارزیابی‌هایش، بدون حذف: `karname/imports/pendar-reconstructed-18-20261105.json`
- پروندهٔ خام سوری: `karname/imports/jan_kalam_souri_predictions_2026-11-01.json`
- هیچ یک از نتیجه‌ها با این انتقال راستی‌آزمایی نشده‌اند. در صورت نیاز به داوری باید مدرک مستقل ثبت شود.
- شناسه‌های `K-001` تا `K-055` و `L-001` تا `L-025` محفوظ‌اند. روابط `pairs` و فهرست `recaps` از فایل اصلی آمده‌اند.
- بروزرسانی: `python backend/scripts/build_karname.py` پس از هر تغییر در این دفتر؛ خروجی `backend/data/karname.json` دستی ویرایش نشود.

## دادهٔ ساختاریافته

```json
{
  "id": "karname-data",
  "source": "karname/daftar.md",
  "as_of": "2026-11-05",
  "as_of_fa": "۱۴ آبان ۱۴۰۵",
  "dataset_scope": "uploaded_claude_snapshot_and_supplements",
  "is_complete": false,
  "provenance": {
    "title": "کارنامهٔ پیش‌بینی‌ها؛ بازگردانی از فایل اصلی ارسالی",
    "source_uploaded": "karname/imports/claude-original-80-20261105.json",
    "supplementary_archive": "karname/imports/pendar-reconstructed-18-20261105.json",
    "souri_source": "karname/imports/jan_kalam_souri_predictions_2026-11-01.json",
    "primary_claims": 80,
    "primary_measurable": 55,
    "primary_long_term": 25,
    "added_souri": 9,
    "added_unique_editorial": 6,
    "archived_potential_overlaps": [
      {
        "legacy": "PDR-MOT-20261008-01",
        "closest": "K-008",
        "review": "overlapping theme; source may be a separate earlier formulation"
      },
      {
        "legacy": "PDR-HOL-20261008-01",
        "closest": "K-004",
        "review": "comparable probability-window claim"
      },
      {
        "legacy": "PDR-AZI-20261020-01",
        "closest": "K-003",
        "review": "same post-election heavy temporary strike scenario"
      }
    ],
    "note": "Snapshot imported as supplied; provenance of individual statements must still be checked against original videos before scoring.",
    "disclosure": "۸۰ مدخل فایل اصلی Claude (۵۵ سنجیدنی، ۲۵ بلندمدت)، ۹ مدخل پروندهٔ سوری و ۶ مدخل تکمیلی پندار در این صفحه نمایش داده می‌شوند. سه مدخلِ دارای هم‌پوشانی احتمالی در آرشیو حفظ شده‌اند. نتایج هنوز ارزیابی مستقل نشده‌اند."
  },
  "scale": [
    {
      "symbol": "✅",
      "key": "correct",
      "fa": "درست",
      "score": 1,
      "label": "درست",
      "mark": "✅"
    },
    {
      "symbol": "◐",
      "key": "half",
      "fa": "نیمه‌درست",
      "score": 0.5,
      "label": "نیمه‌درست",
      "mark": "◐"
    },
    {
      "symbol": "❌",
      "key": "wrong",
      "fa": "نادرست",
      "score": 0,
      "label": "نادرست",
      "mark": "❌"
    },
    {
      "symbol": "⊘",
      "key": "void",
      "fa": "شرط رخ نداد",
      "score": null,
      "label": "شرط رخ نداد",
      "mark": "⊘"
    },
    {
      "symbol": "⏳",
      "key": "pending",
      "fa": "در انتظارِ نتیجه‌ی نهایی",
      "score": null,
      "label": "در انتظارِ نتیجه‌ی نهایی",
      "mark": "⏳"
    },
    {
      "symbol": "…",
      "key": "open",
      "fa": "سررسید نشده",
      "score": null,
      "label": "سررسید نشده",
      "mark": "…"
    }
  ],
  "scenario_families": [
    {
      "key": "جنگ",
      "label": "جنگ"
    },
    {
      "key": "فرسایش",
      "label": "فرسایش"
    },
    {
      "key": "توافق",
      "label": "توافق"
    },
    {
      "key": "بازآرایی اقتدارگرایانه",
      "label": "بازآرایی اقتدارگرایانه"
    },
    {
      "key": "گذار",
      "label": "گذار"
    },
    {
      "key": "بازیابی",
      "label": "بازیابی"
    },
    {
      "key": "زمینه",
      "label": "زمینه"
    }
  ],
  "buckets": [
    {
      "key": "b1",
      "label": "۱۳–۱۴ آبان ۱۴۰۵",
      "date": "2026-11-05"
    },
    {
      "key": "b2",
      "label": "۲۱ آبان ۱۴۰۵",
      "date": "2026-11-12"
    },
    {
      "key": "b3",
      "label": "۳۰ آبان ۱۴۰۵",
      "date": "2026-11-21"
    },
    {
      "key": "b4",
      "label": "پایانِ آذر ۱۴۰۵",
      "date": "2026-12-21"
    },
    {
      "key": "b5",
      "label": "۱۳ دی ۱۴۰۵",
      "date": "2027-01-03"
    },
    {
      "key": "b6",
      "label": "۱۰ بهمن ۱۴۰۵",
      "date": "2027-01-30"
    },
    {
      "key": "b7",
      "label": "پایانِ اسفند ۱۴۰۵",
      "date": "2027-03-20"
    },
    {
      "key": "b8",
      "label": "دی ۱۴۰۶",
      "date": "2027-12-31"
    },
    {
      "key": "b9",
      "label": "آبان ۱۴۰۷",
      "date": "2028-11-07"
    },
    {
      "key": "e1",
      "label": "با تشکیلِ دولتِ اسرائیل",
      "date": null
    },
    {
      "key": "e2",
      "label": "اگر جنگ شود",
      "date": null
    },
    {
      "key": "e3",
      "label": "اگر شرط محقق شود",
      "date": null
    },
    {
      "key": "souri-e1",
      "label": "بدون موعد قابل سنجش"
    },
    {
      "key": "souri-b3",
      "label": "۲۰ مارس ۲۰۲۷",
      "date": "2027-03-20"
    },
    {
      "key": "souri-b1",
      "label": "۳ نوامبر ۲۰۲۶ · انتخابات آمریکا",
      "date": "2026-11-03"
    },
    {
      "key": "souri-e2",
      "label": "منوط به وقوع رویداد"
    },
    {
      "key": "souri-b5",
      "label": "تا نوامبر ۲۰۳۰",
      "date": "2030-11-01"
    },
    {
      "key": "souri-b4",
      "label": "۳۱ مارس ۲۰۲۷",
      "date": "2027-03-31"
    },
    {
      "key": "souri-b2",
      "label": "۱۵ نوامبر ۲۰۲۶",
      "date": "2026-11-15"
    },
    {
      "key": "legacy-b8",
      "label": "تا ۱۹ آوریل ۲۰۲۷ — شش ماه",
      "date": "2027-04-19"
    },
    {
      "key": "legacy-e2",
      "label": "منوط به وقوع رویداد"
    },
    {
      "key": "legacy-b6",
      "label": "۵ آبان ۱۴۰۵ — انتخابات اسرائیل",
      "date": "2026-10-27"
    },
    {
      "key": "legacy-e3",
      "label": "رویدادمحور و بدون موعد قطعی"
    }
  ],
  "speakers": [
    {
      "key": "مطهرنیا",
      "name": "مهدی مطهرنیا",
      "handle": "MehdiMotaharnia1344"
    },
    {
      "key": "زیدآبادی",
      "name": "احمد زیدآبادی",
      "handle": "ahmadzeidabad"
    },
    {
      "key": "عزیزی",
      "name": "یوسف عزیزی",
      "handle": "yousef-azizi"
    },
    {
      "key": "هلاکویی",
      "name": "فرهنگ هلاکویی",
      "handle": "bahadaf"
    },
    {
      "key": "رشیدی",
      "name": "زاگرس رشیدی",
      "handle": "zagros-rashidi"
    },
    {
      "key": "قهرمان‌پور",
      "name": "رحمن قهرمان‌پور",
      "handle": "rahman-ghahremanpour"
    },
    {
      "key": "خراتیان",
      "name": "مهدی خراتیان",
      "handle": "mahdi-kharatian"
    },
    {
      "key": "زئوس",
      "name": "زئوس",
      "handle": "zeus-zaman"
    },
    {
      "key": "ایزدی",
      "name": "فواد ایزدی",
      "handle": "foad-izadi"
    },
    {
      "key": "قاضی‌زاده",
      "name": "علی‌حسین قاضی‌زاده",
      "handle": "alihossein-ghazizadeh"
    },
    {
      "key": "بخشی‌پور",
      "name": "امیررضا بخشی‌پور",
      "handle": "amirreza-bakhshipour"
    },
    {
      "key": "صوفیامهر",
      "name": "امین صوفیامهر",
      "handle": "amin-sofiamehr"
    },
    {
      "key": "علیزاده",
      "name": "علی علیزاده",
      "handle": "ali-alizadeh"
    },
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
      "key": "mohammad-marandi",
      "name": "سید محمد مرندی",
      "handle": "mohammad-marandi"
    }
  ],
  "claims": [
    {
      "id": "K-001",
      "kind": "K",
      "text": "حمله پیش از ۱۳ آبان ممکن و برای ترامپ منطقی‌تر است",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۹ آبان",
      "type": "پیش‌بینی با قیدِ احتمال",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۱۳ آبان ۱۴۰۵",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-002",
      "kind": "K",
      "text": "آمریکا برای فردای انتخابات ضرب‌الاجل داده است",
      "speakers": [
        "زیدآبادی"
      ],
      "speaker_note": "زیدآبادی",
      "said": "۹ آبان",
      "type": "نقلِ گزارش",
      "type_class": "نقلِ گزارش",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۱۴ آبان ۱۴۰۵",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-003",
      "kind": "K",
      "text": "حمله‌ای سنگین اما موقت پس از انتخابات",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "گفتگو",
      "type": "نقلِ تحلیل‌ها، با تأییدِ احتمال",
      "type_class": "نقلِ گزارش",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "پایانِ آذر ۱۴۰۵",
      "bucket": "b4",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-004",
      "kind": "K",
      "text": "احتمالِ جنگ در فاصله‌ی ۳ نوامبر تا ژانویه بالاست",
      "speakers": [
        "هلاکویی"
      ],
      "speaker_note": "هلاکویی (۱۳ آبان با میبدی: «مثال عرض می‌کنم، ۵۰ بوده، الان ۷۰»؛ به خاطرِ «لجبازیِ» ترامپ پس از شکست)",
      "said": "حدودِ ۶ آبان",
      "type": "پیش‌بینی با قیدِ احتمال",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۱۰ بهمن ۱۴۰۵",
      "bucket": "b6",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-005",
      "kind": "K",
      "text": "آمریکا تا روزِ انتخابات از تنش پرهیز می‌کند",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "۸ آبان",
      "type": "تحلیلِ رفتار",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        }
      ],
      "scenario_label": "فرسایش / له (کوتاه‌مدت)",
      "condition": "",
      "due_label": "۱۳ آبان ۱۴۰۵",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-006",
      "kind": "K",
      "text": "جنگی گسترده‌تر و سنگین‌تر از دو جنگِ قبلی",
      "speakers": [
        "هلاکویی"
      ],
      "speaker_note": "هلاکویی",
      "said": "حدودِ ۶ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "وقوعِ جنگ",
      "due_label": "با وقوعِ جنگ",
      "bucket": "e2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-007",
      "kind": "K",
      "text": "آغاز با زدنِ توزیعِ انرژی، نه تولید",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "۸ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "وقوعِ جنگ",
      "due_label": "با وقوعِ جنگ",
      "bucket": "e2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-008",
      "kind": "K",
      "text": "ضربه‌ی مهلک و محدود، سپس گسترش در صورتِ ناکامی",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۹ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "وقوعِ جنگ",
      "due_label": "با وقوعِ جنگ",
      "bucket": "e2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-009",
      "kind": "K",
      "text": "جمهوری‌خواهان با خطای نظرسنجی‌ها ممکن است سنا را نگه دارند",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "۸ آبان",
      "type": "سناریو با قیدِ احتمال",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "اعلامِ نتیجه‌ی سنا",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-010",
      "kind": "K",
      "text": "جمهوری‌خواهان مجلسِ نمایندگان را از دست می‌دهند",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "گفتگو",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "اعلامِ نتیجه‌ی مجلس",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-011",
      "kind": "K",
      "text": "سنا هم ممکن است از دست برود",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "گفتگو",
      "type": "پیش‌بینی با قیدِ احتمال",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "اعلامِ نتیجه‌ی سنا",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-012",
      "kind": "K",
      "text": "دموکرات‌ها به دوسومِ لازم برای مهارِ وتوی ترامپ نمی‌رسند",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "۸ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "اعلامِ نتایجِ کنگره",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-013",
      "kind": "K",
      "text": "بن‌بستِ ۶۱ و ادامه‌ی دولتِ موقت، محتمل‌ترین حالت",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۶ آبان",
      "type": "پیش‌بینی با قیدِ احتمال",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "پایانِ مهلتِ تشکیلِ کابینه در اسرائیل",
      "bucket": "e1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-014",
      "kind": "K",
      "text": "تشکیلِ دولتِ وحدتِ ملی در اسرائیل در صورتِ جنگ",
      "speakers": [
        "مطهرنیا",
        "هلاکویی"
      ],
      "speaker_note": "مطهرنیا، هلاکویی",
      "said": "۶ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "وقوعِ جنگ",
      "due_label": "با وقوعِ جنگ",
      "bucket": "e2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-015",
      "kind": "K",
      "text": "آیزنکوت در مقامِ نخست‌وزیر به نتانیاهو نزدیک می‌شود",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۶ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "نخست‌وزیریِ آیزنکوت",
      "due_label": "با تحققِ شرط",
      "bucket": "e3",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-016",
      "kind": "K",
      "text": "مذاکراتِ قطر به توافقِ پایدار نمی‌رسد",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۹ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "توافق / علیه",
      "condition": "",
      "due_label": "پایانِ آذر ۱۴۰۵",
      "bucket": "b4",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-017",
      "kind": "K",
      "text": "توافقی با انتقال یا رقیق‌سازیِ اورانیوم و تضمینِ چین و روسیه",
      "speakers": [
        "زیدآبادی"
      ],
      "speaker_note": "زیدآبادی",
      "said": "۹ آبان",
      "type": "احتمال (نه پیش‌بینیِ قطعی)",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "له"
        }
      ],
      "scenario_label": "توافق / له",
      "condition": "",
      "due_label": "پایانِ آذر ۱۴۰۵",
      "bucket": "b4",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-018",
      "kind": "K",
      "text": "تهران پیش از انتخاباتِ آمریکا توافق نمی‌کند",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "گفتگو",
      "type": "توصیه",
      "type_class": "توصیه",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "توافق / علیه (تا ۱۳ آبان)",
      "condition": "",
      "due_label": "۱۳ آبان ۱۴۰۵",
      "bucket": "b1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-019",
      "kind": "K",
      "text": "احتمالِ جنگی مانندِ جنگ‌های ۴۰روزه یا ۱۲روزه تا آغازِ کارِ کنگره‌ی جدید «حداقل بالای ۵۰ درصد» است",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی با قیدِ احتمال",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵ (۳ ژانویه ۲۰۲۷)",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-020",
      "kind": "K",
      "text": "ترامپ به‌زودی خود را بازیابی می‌کند؛ ونس و تیمش به حاشیه می‌روند و نقشِ روبیو سنگین‌تر می‌شود (سنجه: کنار رفتنِ ونس از پرونده‌ی ایران و رهبریِ روبیو بر آن)",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "پایانِ آذر ۱۴۰۵",
      "bucket": "b4",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-021",
      "kind": "K",
      "text": "تهدیدها علیهِ تهران از فردای انتخابات افزایش می‌یابد",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۱۲ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۳۰ آبان ۱۴۰۵",
      "bucket": "b3",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-022",
      "kind": "K",
      "text": "آیزنکوت مأمورِ تشکیلِ دولتِ اسرائیل می‌شود",
      "speakers": [
        "مطهرنیا",
        "زیدآبادی"
      ],
      "speaker_note": "مطهرنیا («به احتمالِ زیاد»)، زیدآبادی («مسلم است»)",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی (مطهرنیا با قیدِ احتمال)",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "اعلامِ مأموریتِ تشکیلِ دولت",
      "bucket": "e1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-023",
      "kind": "K",
      "text": "دولتِ بعدیِ اسرائیل به رهبریِ نتانیاهو تشکیل نمی‌شود",
      "speakers": [
        "زیدآبادی",
        "ایزدی"
      ],
      "speaker_note": "زیدآبادی؛ ایزدی (۱۴ آبان، «جدال»: «یک دولتِ ائتلافیِ بدونِ نتانیاهو»)",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی («تقریباً از واضحات»)",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "تشکیلِ دولتِ جدید یا پایانِ مهلت‌ها (در تقابل با K-013)",
      "bucket": "e1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-024",
      "kind": "K",
      "text": "در جنگِ بعدی، بمبارانی بی‌سابقه با هدفِ نابودیِ دست‌کم ۸۰ درصدِ توانِ آفندیِ جمهوری اسلامی در ساعت‌های نخست",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "حدودِ ۱۲ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "وقوعِ جنگ",
      "due_label": "با وقوعِ جنگ",
      "bucket": "e2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-025",
      "kind": "K",
      "text": "اسرائیل در جنگِ بعدی مشارکت می‌کند؛ بدونِ اسرائیل جنگ به نتیجه‌ی سیاسی نمی‌رسد",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "حدودِ ۱۲ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "وقوعِ جنگ",
      "due_label": "با وقوعِ جنگ",
      "bucket": "e2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-026",
      "kind": "K",
      "text": "اروپا در جنگِ بعدی «درگیرِ مستقیم» خواهد بود",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "حدودِ ۱۲ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "وقوعِ جنگ",
      "due_label": "با وقوعِ جنگ",
      "bucket": "e2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-027",
      "kind": "K",
      "text": "اگر جمهوری اسلامی زیرساخت‌های انرژیِ خلیج فارس را بزند، کشورهای عربی مستقل یا دسته‌جمعی به زیرساخت‌های انرژیِ ایران حمله می‌کنند",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "حدودِ ۱۲ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "حمله‌ی ایران به زیرساخت‌های خلیج فارس",
      "due_label": "با تحققِ شرط",
      "bucket": "e3",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-028",
      "kind": "K",
      "text": "اگر آیزنکوت دولت تشکیل دهد، سیاست در کرانه‌ی باختری تعدیل می‌شود و راهِ عادی‌سازیِ عرب‌ها هموارتر می‌شود",
      "speakers": [
        "زیدآبادی"
      ],
      "speaker_note": "زیدآبادی",
      "said": "۱۳ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "نخست‌وزیریِ آیزنکوت",
      "due_label": "شش ماه پس از تشکیلِ دولت",
      "bucket": "e1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-029",
      "kind": "K",
      "text": "فاصله‌ی تا استقرارِ کنگره‌ی جدید خطرناک‌ترین دوره است و خطرِ حمله‌ی تازه جدی است (هم‌موضوع با K-019)",
      "speakers": [
        "قهرمان‌پور"
      ],
      "speaker_note": "قهرمان‌پور (در ایران تاک تکرار شد: «این فاصله فاصله‌ی خطرناکی است»)",
      "said": "حدودِ ۱۴ آبان",
      "type": "پیش‌بینی با قیدِ احتمال",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵ (۳ ژانویه ۲۰۲۷)",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-030",
      "kind": "K",
      "text": "هر توافقی میانِ ایران و آمریکا «شکننده، موقت و محدود» خواهد بود و توافقِ جامعی شکل نمی‌گیرد",
      "speakers": [
        "قهرمان‌پور"
      ],
      "speaker_note": "قهرمان‌پور",
      "said": "حدودِ ۱۴ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "توافق / علیه (توافقِ جامع)",
      "condition": "",
      "due_label": "پایانِ اسفند ۱۴۰۵",
      "bucket": "b7",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-031",
      "kind": "K",
      "text": "مجلسِ نمایندگانِ جدید روندِ استیضاحِ ترامپ را آغاز می‌کند",
      "speakers": [
        "عزیزی",
        "هلاکویی",
        "قهرمان‌پور",
        "خراتیان",
        "بخشی‌پور",
        "علیزاده"
      ],
      "speaker_note": "خراتیان (له: «ابایی ندارند»)، قهرمان‌پور (علیه: به جای استیضاح سراغِ ۲۰۲۸ می‌روند؛ در ایران تاک هم: «استیضاح هم بکنند، برکنار نمی‌شود»)، علیزاده (له، به نقل از تد کروز: «چندین بار» استیضاح)، بخشی‌پور (له، «من‌باب نمادین بودن»؛ عزیزی: به برکناری نمی‌رسد)، هلاکویی (له، با قیدِ امکان: «اینکه مفید باشد یا نه یک مسئله است، ولی دردسرساز است»)",
      "said": "حدودِ ۱۴ آبان",
      "type": "پیش‌بینیِ متقابل",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "پایانِ ۲۰۲۷ (دی ۱۴۰۶)",
      "bucket": "b8",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-032",
      "kind": "K",
      "text": "کنگره‌ی جدید نمی‌تواند وتوی ترامپ را با اکثریتِ دوسوم خنثی کند («خیلی بعید است»)",
      "speakers": [
        "عزیزی",
        "صوفیامهر"
      ],
      "speaker_note": "عزیزی؛ صوفیامهر (۱۳ آبان: دوسوم ندارند، «تغییراتِ جدی» صورت نمی‌گیرد)",
      "said": "حدودِ ۱۳ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "پایانِ ۲۰۲۷ (دی ۱۴۰۶)",
      "bucket": "b8",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-033",
      "kind": "K",
      "text": "ترامپ در دو ماهِ پیش از استقرارِ کنگره‌ی جدید ممکن است برای «خالی کردنِ دقِ دلش» عملیاتی نظامی کند، اما امتیاز نمی‌گیرد",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "حدودِ ۱۳ آبان",
      "type": "امکان (نه پیش‌بینیِ قطعی)",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له (محدود)",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-034",
      "kind": "K",
      "text": "کنگره ممکن است بسته‌ای دوحزبی از تحریم‌ها، شبیهِ «کاتسا»ی ۲۰۱۷، با رأیِ بالای دوسوم تصویب کند که ایران را هم در بر بگیرد",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "حدودِ ۱۳ آبان",
      "type": "امکان",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "پایانِ ۲۰۲۷ (دی ۱۴۰۶)",
      "bucket": "b8",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-035",
      "kind": "K",
      "text": "حتی با توافق و بازگشتِ ترددِ هرمز، فشار بر زنجیره‌ی تأمین و قیمت‌های حمل و بیمه‌ی انرژی تا چندین ماه ادامه می‌یابد",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "حدودِ ۱۳ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "توافق یا بازگشاییِ هرمز",
      "due_label": "شش ماه پس از تحققِ شرط",
      "bucket": "e3",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-036",
      "kind": "K",
      "text": "در فاصله‌ی تا استقرارِ کنگره‌ی جدید، احتمالِ جنگ «کمی بیشتر از توافق» است؛ آرایشِ نظامیِ آمریکا (رهگیرها به اسرائیل، سوخت‌رسان‌ها) «جنگ‌انگیز» است",
      "speakers": [
        "قهرمان‌پور"
      ],
      "speaker_note": "قهرمان‌پور",
      "said": "۱۴ آبان (ایران تاک)",
      "type": "پیش‌بینیِ احتمالی (مقایسه‌ای)",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵ (۳ ژانویه ۲۰۲۷)",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-037",
      "kind": "K",
      "text": "جنگِ سوم (حمله‌ی آمریکا و اسرائیل به ایران) «احتمالاً در همین هفته‌ی آینده» آغاز می‌شود",
      "speakers": [
        "زئوس"
      ],
      "speaker_note": "زئوس",
      "said": "حدودِ ۱۴ آبان",
      "type": "پیش‌بینی با قیدِ «احتمالاً»",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۲۱ آبان ۱۴۰۵ (۱۲ نوامبر ۲۰۲۶)",
      "bucket": "b2",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-038",
      "kind": "K",
      "text": "ترامپ پیش از استقرارِ کنگره‌ی جدید حمله می‌کند و می‌کوشد جنگ را با «پیروزی» تمام کند؛ «اگر حمله نکند در واقع شکست خورده» (هم‌موضوع با K-019، K-029، K-033، K-036)",
      "speakers": [
        "زئوس"
      ],
      "speaker_note": "زئوس",
      "said": "حدودِ ۱۴ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵ (۳ ژانویه ۲۰۲۷)",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-039",
      "kind": "K",
      "text": "پیت هگست، وزیرِ دفاع، برکنار می‌شود و مسئولیتِ جنگ به گردنِ او انداخته می‌شود",
      "speakers": [
        "زئوس",
        "ایزدی"
      ],
      "speaker_note": "زئوس؛ ایزدی (۱۴ آبان: یکی از دو انتخابِ ترامپ، «زیرِ اتوبوس انداختنِ» هگست)",
      "said": "حدودِ ۱۴ آبان",
      "type": "امکان («صحبت از برکناری شده»، «مثلِ اینکه»)",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-040",
      "kind": "K",
      "text": "کشمکشِ وتو و لایحه‌ها میانِ ترامپ و کنگره‌ی دموکرات به تعطیلیِ دوباره‌ی دولتِ فدرال می‌انجامد",
      "speakers": [
        "هلاکویی"
      ],
      "speaker_note": "هلاکویی",
      "said": "۱۳ آبان",
      "type": "امکان («ممکن است… دولت تعطیل شود»)",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "پایانِ ۲۰۲۷ (دی ۱۴۰۶)",
      "bucket": "b8",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-041",
      "kind": "K",
      "text": "کنگره‌ی جدید با محدود کردنِ اختیارات و تصویب نکردنِ بودجه‌های نظامی، ادامه‌ی جنگ با ایران را برای ترامپ «بسیار بسیار مشکل» می‌کند",
      "speakers": [
        "هلاکویی",
        "ایزدی"
      ],
      "speaker_note": "هلاکویی؛ ایزدی (شرطی: «اگر واقعاً بخواهند، ابزار دارند»)",
      "said": "۱۳ آبان",
      "type": "امکان",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "علیه"
        }
      ],
      "scenario_label": "جنگ / علیه",
      "condition": "",
      "due_label": "پایانِ ۲۰۲۷ (دی ۱۴۰۶)",
      "bucket": "b8",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-042",
      "kind": "K",
      "text": "دوشاخه: اگر مسئولانِ ایران راهِ پیامِ ۱۳ آبانِ رهبری را بروند، «دو ماهِ دیگر حمله ندارید»؛ اگر نهادهای اطلاعاتیِ آمریکا آن را «بلف» بدانند (ادامه‌ی «تئاترِ مذاکره»)، «قطعاً حمله می‌کنند»",
      "speakers": [
        "ایزدی"
      ],
      "speaker_note": "ایزدی",
      "said": "۱۴ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له (شرطی)",
      "condition": "تشخیصِ آمریکا از جدیتِ موضعِ تهران",
      "due_label": "۱۳ دی ۱۴۰۵",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-043",
      "kind": "K",
      "text": "آمریکا در حمله‌ی بعدی ممکن است از بمبِ اتم (به‌طورِ «نمادین») استفاده کند و زیرساخت‌ها را بزند",
      "speakers": [
        "ایزدی"
      ],
      "speaker_note": "ایزدی",
      "said": "۱۴ آبان",
      "type": "امکان (ذیلِ شاخه‌ی دومِ K-042)",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "وقوعِ حمله",
      "due_label": "۱۳ دی ۱۴۰۵",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-044",
      "kind": "K",
      "text": "در اسرائیل ائتلافی رئیسِ لیکودیِ کنست را عوض می‌کند و قانونی برای بازداشتنِ نتانیاهو از نخست‌وزیری می‌گذراند؛ دولتِ ائتلافیِ بدونِ نتانیاهو شکل می‌گیرد (هم‌موضوع با K-023)",
      "speakers": [
        "ایزدی"
      ],
      "speaker_note": "ایزدی",
      "said": "۱۴ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "تشکیلِ دولتِ جدیدِ اسرائیل",
      "bucket": "e1",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-045",
      "kind": "K",
      "text": "اگر ترامپ در زمانی کوتاه «کارِ جمهوری اسلامی را تمام نکند» و به وضعِ موجود (تحریم و نفتِ ۹۰–۱۲۰ دلاری) بسنده کند، جمهوری‌خواهان «قطعاً» انتخاباتِ ریاست‌جمهوریِ بعدی را می‌بازند",
      "speakers": [
        "قاضی‌زاده"
      ],
      "speaker_note": "قاضی‌زاده",
      "said": "حدودِ ۱۴ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "ادامه‌ی وضعِ موجود",
      "due_label": "آبان ۱۴۰۷ (نوامبر ۲۰۲۸)",
      "bucket": "b9",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-046",
      "kind": "K",
      "text": "دموکرات‌ها در ۲۰۲۸ اکثریتِ سنا را حفظ می‌کنند، حتی اگر ریاست‌جمهوری و مجلسِ نمایندگان را ببازند («در بدترین حالت پنج کرسی از دست می‌دهند»)",
      "speakers": [
        "قاضی‌زاده"
      ],
      "speaker_note": "قاضی‌زاده",
      "said": "حدودِ ۱۴ آبان",
      "type": "پیش‌بینی («همین الان می‌شود حدس زد»)",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "آبان ۱۴۰۷ (نوامبر ۲۰۲۸)",
      "bucket": "b9",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-047",
      "kind": "K",
      "text": "اگر جمهوری اسلامی بفهمد رئیس‌جمهورِ آمریکا از رویاروییِ نظامی می‌ترسد، برای برداشتنِ محاصره به پایگاه‌ها و ناوهای آمریکا حمله می‌کند و سربازانِ آمریکایی را می‌کشد",
      "speakers": [
        "قاضی‌زاده"
      ],
      "speaker_note": "قاضی‌زاده",
      "said": "حدودِ ۱۴ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "بی‌عملیِ آمریکا و ادامه‌ی محاصره",
      "due_label": "پایانِ اسفند ۱۴۰۵",
      "bucket": "b7",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-048",
      "kind": "K",
      "text": "هر توافقی برای خروجِ آمریکا ناچار غنی‌سازی را می‌پذیرد، اورانیوم تحویل گرفته نمی‌شود و کنترل و عوارضِ هرمز در دستِ جمهوری اسلامی می‌ماند («باید همه‌ی این‌ها را بدهد»)",
      "speakers": [
        "قاضی‌زاده"
      ],
      "speaker_note": "قاضی‌زاده",
      "said": "حدودِ ۱۴ آبان",
      "type": "شرطی",
      "type_class": "شرطی",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "شرایط"
        }
      ],
      "scenario_label": "توافق / شرایط",
      "condition": "وقوعِ توافقِ ایران و آمریکا",
      "due_label": "با تحققِ شرط",
      "bucket": "e3",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-049",
      "kind": "K",
      "text": "ترامپ به ایران حمله‌ی هسته‌ای (حتی تاکتیکی، مثلاً به کوه‌کلنگ) نمی‌کند («خیلی بعید»)؛ در تقابل با ادعای تاکر کارلسون (تا ۷ نوامبر) و K-043",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "علیه"
        }
      ],
      "scenario_label": "جنگ / علیه (هسته‌ای)",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-050",
      "kind": "K",
      "text": "ایران نمی‌تواند محاصره‌ی دریاییِ آمریکا را از راهِ نظامی بشکند («خیلی بعید»)",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        }
      ],
      "scenario_label": "فرسایش / له",
      "condition": "",
      "due_label": "پایانِ اسفند ۱۴۰۵",
      "bucket": "b7",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-051",
      "kind": "K",
      "text": "مسئولانِ ایران به سمتِ توافقی می‌روند که در آن در ازای رفعِ محاصره و آزادیِ دارایی‌ها در هسته‌ای کوتاه می‌آیند (شاید با نظمِ امنیتیِ منطقه‌ای و خروجِ نیروهای آمریکا)",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی («بعید نیست»؛ خود مخالفِ آن)",
      "said": "۱۳ آبان",
      "type": "امکان",
      "type_class": "امکان",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "له"
        }
      ],
      "scenario_label": "توافق / له",
      "condition": "",
      "due_label": "پایانِ اسفند ۱۴۰۵",
      "bucket": "b7",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-052",
      "kind": "K",
      "text": "در ماه‌های پیش رو توافقی میانِ ایران و آمریکا شکل نمی‌گیرد؛ ترامپ «هفت شرطِ» ایران را نمی‌پذیرد (در تقابل با K-051)",
      "speakers": [
        "بخشی‌پور"
      ],
      "speaker_note": "بخشی‌پور",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی («احتمالِ توافق خیلی کم»)",
      "type_class": "پیش‌بینی با قید",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "توافق / علیه",
      "condition": "",
      "due_label": "پایانِ اسفند ۱۴۰۵",
      "bucket": "b7",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-053",
      "kind": "K",
      "text": "کنگره‌ی جدید «به احتمالِ خیلی زیاد بلافاصله» پرونده‌ی فعالیت‌های تجاریِ خانواده‌ی ترامپ را باز می‌کند",
      "speakers": [
        "بخشی‌پور"
      ],
      "speaker_note": "بخشی‌پور",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "پایانِ اسفند ۱۴۰۵",
      "bucket": "b7",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-054",
      "kind": "K",
      "text": "در دو ماهِ پیش از استقرارِ کنگره، جمهوری اسلامی «به احتمالِ زیاد» تن به توافق نمی‌دهد و «شرایط به سمتِ جنگ می‌رود» (هم‌موضوع با K-019، K-029، K-036، K-038)",
      "speakers": [
        "صوفیامهر"
      ],
      "speaker_note": "صوفیامهر",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        },
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "جنگ / له؛ توافق / علیه",
      "condition": "",
      "due_label": "۱۳ دی ۱۴۰۵",
      "bucket": "b5",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "K-055",
      "kind": "K",
      "text": "حتی پس از ژانویه، کنگره‌ی دموکرات «کارِ زیادی» برای توقفِ عملیاتِ نظامیِ زیرِ ۶۰ روزه‌ی ترامپ علیه ایران نمی‌تواند بکند (در تقابل با K-041)",
      "speakers": [
        "صوفیامهر"
      ],
      "speaker_note": "صوفیامهر",
      "said": "۱۳ آبان",
      "type": "پیش‌بینی",
      "type_class": "پیش‌بینی",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "له"
        }
      ],
      "scenario_label": "جنگ / له",
      "condition": "",
      "due_label": "پایانِ ۲۰۲۷ (دی ۱۴۰۶)",
      "bucket": "b8",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-001",
      "kind": "L",
      "text": "تلاطم‌ها از ۱۴۰۴ تا ۱۴۰۸ ادامه دارد",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۶ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        }
      ],
      "scenario_label": "فرسایش / له",
      "condition": "",
      "due_label": "۱۴۰۸",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-002",
      "kind": "L",
      "text": "آمریکا از راهِ «تبدیلِ لایه‌لایه» تا حدودِ ۱۴۰۷–۱۴۰۸ به تغییر در تهران می‌رسد",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۹ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "گذار",
          "dir": "له"
        }
      ],
      "scenario_label": "گذار / له",
      "condition": "",
      "due_label": "۱۴۰۸",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-003",
      "kind": "L",
      "text": "آمریکا نمی‌تواند بیش از ۲۰۳۰ درباره‌ی ایران صبر کند",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۶ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "گذار",
          "dir": "له"
        }
      ],
      "scenario_label": "گذار / له",
      "condition": "",
      "due_label": "۲۰۳۰",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-004",
      "kind": "L",
      "text": "وضعِ کنونیِ رهبری، با پذیرشِ موقتِ جناح‌ها، دیرپا نیست",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۹ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "گذار",
          "dir": "له"
        }
      ],
      "scenario_label": "گذار / له",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-005",
      "kind": "L",
      "text": "در دو سالِ باقی‌مانده‌ی ترامپ، جمهوری اسلامی به این شکل باقی نمی‌ماند",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "۸ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "گذار",
          "dir": "له"
        }
      ],
      "scenario_label": "گذار / له",
      "condition": "",
      "due_label": "دی ۱۴۰۷",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-006",
      "kind": "L",
      "text": "هیچ قدرتی (چین، روسیه، پاکستان) به اتمی شدنِ جمهوری اسلامی کمک نمی‌کند",
      "speakers": [
        "رشیدی"
      ],
      "speaker_note": "رشیدی",
      "said": "۸ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-007",
      "kind": "L",
      "text": "پس از پرونده‌ی ایران، نوبتِ تنش در شرقِ آسیا و کشمیر است",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۹ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-008",
      "kind": "L",
      "text": "پس از حلِ ماجرای ایران، آمریکا «حتماً» به سراغِ کره‌ی شمالی و چین می‌رود (مکملِ L-007)",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۱۳ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-009",
      "kind": "L",
      "text": "با وجودِ گفتمانِ انقلابی در تهران، هیچ توافقی میانِ تهران و واشنگتن در چشم‌انداز نیست؛ با رهبریِ مجتبی خامنه‌ای تغییرِ این پارادایم «هر روز غیرممکن‌تر» می‌شود (سویه‌ی کوتاه‌مدتش در K-016)",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۴، ۱۲ و ۱۳ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "توافق / علیه",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-010",
      "kind": "L",
      "text": "در پرونده‌ی ایران سیاستی دوحزبی شکل می‌گیرد: دموکرات‌ها «همراهیِ مشروط» با ترامپ و حمایت از تحریم‌های بیشتر",
      "speakers": [
        "مطهرنیا",
        "زیدآبادی"
      ],
      "speaker_note": "مطهرنیا؛ زیدآبادی (در صورتِ زیاده‌خواهیِ تهران)",
      "said": "۱۳ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "پایانِ ۲۰۲۷",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-011",
      "kind": "L",
      "text": "جمهوری اسلامی «کره‌ی شمالیِ دوم» نمی‌شود",
      "speakers": [
        "مطهرنیا",
        "رشیدی"
      ],
      "speaker_note": "رشیدی؛ مطهرنیا («ایران هم کره‌ی شمالی نیست»)",
      "said": "۱۲ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "بازآرایی اقتدارگرایانه",
          "dir": "علیه"
        }
      ],
      "scenario_label": "بازآرایی اقتدارگرایانه / علیه",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-012",
      "kind": "L",
      "text": "تا نتانیاهو در قدرت است، هیچ توافقی میانِ ایران و آمریکا بدونِ «پارافِ» او بسته نمی‌شود",
      "speakers": [
        "ایزدی"
      ],
      "speaker_note": "ایزدی",
      "said": "۲۹ مهر",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "توافق / علیه",
      "condition": "",
      "due_label": "تا پایانِ دوره‌ی نتانیاهو",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-013",
      "kind": "L",
      "text": "ایران تجزیه نمی‌شود",
      "speakers": [
        "مطهرنیا"
      ],
      "speaker_note": "مطهرنیا",
      "said": "۳۰ مهر",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-014",
      "kind": "L",
      "text": "«سناریوی سوئز» (خروجِ آمریکا از بحران به‌خاطرِ هزینه) رخ نمی‌دهد؛ چیزی شبیهِ «صربستانِ ۱۹۹۹» محتمل‌تر است",
      "speakers": [
        "قهرمان‌پور"
      ],
      "speaker_note": "قهرمان‌پور",
      "said": "حدودِ ۱۴ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        }
      ],
      "scenario_label": "فرسایش / له",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-015",
      "kind": "L",
      "text": "دموکرات‌ها ترجیح می‌دهند جمهوری‌خواهان و ترامپ را تا ۲۰۲۸ در «باتلاقِ جنگِ ایران» نگه دارند",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "حدودِ ۱۳ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        }
      ],
      "scenario_label": "فرسایش / له",
      "condition": "",
      "due_label": "۲۰۲۸",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-016",
      "kind": "L",
      "text": "ترامپ از نظرِ نظامی در ایران به «میراث» نمی‌رسد و کار را تمام نمی‌کند؛ ناچار به میزِ دیپلماسی می‌آید",
      "speakers": [
        "عزیزی"
      ],
      "speaker_note": "عزیزی",
      "said": "حدودِ ۱۳ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "جنگ",
          "dir": "علیه"
        }
      ],
      "scenario_label": "جنگ / علیه",
      "condition": "",
      "due_label": "دی ۱۴۰۷ (پایانِ دوره‌ی ترامپ)",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-017",
      "kind": "L",
      "text": "ترامپ برای میراث سراغِ دو دستاوردِ اوباما می‌رود: توافق یا عادی‌سازی با کوبا، و پرونده‌ی ایران (توافق یا جنگ)",
      "speakers": [
        "قهرمان‌پور"
      ],
      "speaker_note": "قهرمان‌پور",
      "said": "۱۴ آبان (ایران تاک)",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "دی ۱۴۰۷ (پایانِ دوره‌ی ترامپ)",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-018",
      "kind": "L",
      "text": "آمریکا «به هر قیمتی» از جنگ با ایران خارج نمی‌شود؛ برای خروج با حفظِ اعتبار «۱۰۰، ۲۰۰، ۳۰۰ میلیارد» دلارِ دیگر هم خرج می‌کند",
      "speakers": [
        "قهرمان‌پور"
      ],
      "speaker_note": "قهرمان‌پور",
      "said": "۱۴ آبان (ایران تاک)",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        },
        {
          "family": "توافق",
          "dir": "علیه"
        }
      ],
      "scenario_label": "فرسایش / له؛ توافقِ ارزان / علیه",
      "condition": "",
      "due_label": "دی ۱۴۰۷",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-019",
      "kind": "L",
      "text": "اگر در کوتاه‌مدت حمله‌ی نظامی رخ ندهد، آمریکا از راهِ محاصره‌ی اقتصادی و دریایی (و «یک مقدار محاصره‌ی زمینی») مسیرِ «فروپاشی» را دنبال می‌کند؛ «شش ماه، یک سال» زمان می‌برد و براندازیِ نظامی «اگر غیرممکن نباشد بسیار بسیار مشکل است»",
      "speakers": [
        "هلاکویی"
      ],
      "speaker_note": "هلاکویی",
      "said": "۱۳ آبان (با میبدی)",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        },
        {
          "family": "گذار",
          "dir": "امکان"
        }
      ],
      "scenario_label": "فرسایش / له؛ گذار / امکان",
      "condition": "",
      "due_label": "دی ۱۴۰۶",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-020",
      "kind": "L",
      "text": "افولِ آمریکا «۱۵ تا ۲۰ سالِ دیگر» کامل می‌شود و آمریکا «یک کشورِ عادی» مثلِ برزیل می‌شود",
      "speakers": [
        "ایزدی"
      ],
      "speaker_note": "ایزدی",
      "said": "۱۴ آبان («جدال»)",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "۱۴۲۰ تا ۱۴۲۵",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-021",
      "kind": "L",
      "text": "عبدالسید (یا یکی از نسلِ دانشجویانِ حامیِ فلسطین) حدودِ ۲۰ سالِ دیگر رئیس‌جمهورِ آمریکا می‌شود",
      "speakers": [
        "ایزدی"
      ],
      "speaker_note": "ایزدی",
      "said": "۱۴ آبان («جدال»)",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "حدودِ ۱۴۲۵",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-022",
      "kind": "L",
      "text": "شکستِ میان‌دوره‌ای «نه فقط به پایانِ ترامپ، بلکه به پایانِ ترامپیسم» می‌انجامد",
      "speakers": [
        "علیزاده"
      ],
      "speaker_note": "علیزاده (مجریِ «جدال»)",
      "said": "۱۴ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "زمینه",
          "dir": "زمینه"
        }
      ],
      "scenario_label": "زمینه",
      "condition": "",
      "due_label": "انتخاباتِ ۲۰۲۸ (آبان ۱۴۰۷)",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-023",
      "kind": "L",
      "text": "«چه ترامپ بیاید چه نیاید» جمهوری اسلامی به ثبات بازنمی‌گردد و مردمِ ایران «با رهبریِ شاهزاده رضا پهلوی» کارش را تمام می‌کنند؛ با کمکِ آمریکا و اسرائیل کم‌هزینه‌تر",
      "speakers": [
        "قاضی‌زاده"
      ],
      "speaker_note": "قاضی‌زاده",
      "said": "حدودِ ۱۴ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "گذار",
          "dir": "له"
        }
      ],
      "scenario_label": "گذار / له",
      "condition": "",
      "due_label": "نامشخص",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-024",
      "kind": "L",
      "text": "اگر ایران بازدارندگی (هسته‌ای) را تکمیل نکند، وضع یا به «زد و خوردهایی چند بار در طولِ سال» همراه با محاصره می‌رسد یا به «نه جنگ، نه صلحِ» چندساله",
      "speakers": [
        "بخشی‌پور"
      ],
      "speaker_note": "بخشی‌پور",
      "said": "۱۳ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "فرسایش",
          "dir": "له"
        }
      ],
      "scenario_label": "فرسایش / له",
      "condition": "",
      "due_label": "دی ۱۴۰۶",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
    {
      "id": "L-025",
      "kind": "L",
      "text": "اگر جمهوری اسلامی پس از پایانِ دوره‌ی ترامپ سرِ پا بماند، با لغوِ تحریم یا دستیابی به پول توانش را بازسازی می‌کند و «سمتِ اتمی شدن» می‌رود",
      "speakers": [
        "صوفیامهر"
      ],
      "speaker_note": "صوفیامهر",
      "said": "۱۳ آبان",
      "type": "بلندمدت",
      "type_class": "بلندمدت",
      "scenarios": [
        {
          "family": "بازیابی",
          "dir": "له"
        }
      ],
      "scenario_label": "بازیابی / له (شرطی)",
      "condition": "",
      "due_label": "پس از دی ۱۴۰۷",
      "bucket": "L",
      "result": "",
      "result_source": "",
      "source_title": "دفتر اصلی Claude — نسخهٔ ارسالی کاربر",
      "source_type": "claude_snapshot",
      "import_status": "original_id_preserved"
    },
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
      "bucket": "souri-e1",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "وقوع حمله نظامی تازه و قابل تأیید به ایران",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-b3",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "آغاز حمله نظامی تازه به ایران تا پایان ۲۰ مارس ۲۰۲۷",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-b1",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "اکثریت کرسی‌های سنای آمریکا پس از انتخابات و روشن شدن ترکیب",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-b1",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "اکثریت کرسی‌های مجلس نمایندگان پس از انتخابات",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-e2",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "نتیجه سنا و فاصله زمانی وقوع یا عدم وقوع حمله؛ بدون معیار قطعی علیت",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-e2",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "گزارش حملات و اهداف تأییدشده، به‌ویژه نیروگاه و زیرساخت انرژی",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-b5",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "سهم آرا و کرسی احزاب راست در انتخابات منتخب اروپا نسبت به مبنا",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-b4",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "تغییر GDP واقعی در بازه تعریف‌شده بر اساس منبع آماری معتبر",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
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
      "bucket": "souri-b2",
      "result": null,
      "result_source": null,
      "source_title": "گفت‌وگوی بنیامین سوری با عباس سوری در رسانه پارسی",
      "source_type": "user_supplied_souri_record",
      "source_url": null,
      "evaluation_trigger": "آغاز جنگ در بازه ۴–۱۵ نوامبر ۲۰۲۶",
      "source_registration_date": "2026-11-02",
      "import_status": "direct_user_register"
    },
    {
      "id": "PDR-MOT-20261019-01",
      "kind": "K",
      "speakers": [
        "مطهرنیا"
      ],
      "text": "در شش ماه آینده ضربات نظامی هوشیارانه‌ای رخ خواهد داد؛ رویدادهای کنونی مقدمهٔ ورود به منطق تسلیم یا جنگ گسترده‌ترند.",
      "said": "2026-10-19",
      "type": "پیش‌بینی زمان‌دار",
      "type_class": "پیش‌بینی",
      "due_label": "تا ۱۹ آوریل ۲۰۲۷ (شش ماه پس از ۱۹ اکتبر ۲۰۲۶)",
      "bucket": "legacy-b8",
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
      "source_primary_verified": false,
      "import_status": "separate_supported_claim_pending_primary_verification"
    },
    {
      "id": "PDR-HOL-20261008-02",
      "kind": "K",
      "speakers": [
        "هلاکویی"
      ],
      "text": "اگر حمله‌ای انجام شود، موج نخست آن احتمالاً مراکز نظامی و موشکی ایران را هدف می‌گیرد.",
      "said": "2026-10-08",
      "type": "پیش‌بینی دربارهٔ اهداف جنگ",
      "type_class": "پیش‌بینی مشروط",
      "condition": "وقوع حملهٔ نظامی",
      "due_label": "موج نخست حملهٔ احتمالی؛ بدون تاریخ ثابت",
      "bucket": "legacy-e2",
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
      "source_primary_verified": false,
      "import_status": "separate_supported_claim_pending_primary_verification"
    },
    {
      "id": "PDR-ZEI-20261020-01",
      "kind": "K",
      "speakers": [
        "زیدآبادی"
      ],
      "text": "وقوع حملهٔ خارجی علیه ایران پیش از انتخابات پارلمانی اسرائیل در پنجم آبان بعید است، مگر در قالب ادعای حملهٔ پیش‌دستانه.",
      "said": "2026-10-20",
      "type": "پیش‌بینی احتمالی زمان‌دار",
      "type_class": "پیش‌بینی احتمالی",
      "condition": "جز در صورت ارائه و پذیرش ادعای اقدام پیش‌دستانه",
      "due_label": "تا ۵ آبان ۱۴۰۵ / ۲۷ اکتبر ۲۰۲۶",
      "bucket": "legacy-b6",
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
      "source_primary_verified": false,
      "import_status": "separate_supported_claim_pending_primary_verification"
    },
    {
      "id": "PDR-ZEI-20261020-02",
      "kind": "K",
      "speakers": [
        "زیدآبادی"
      ],
      "text": "ائتلاف احزاب مخالف نتانیاهو در انتخابات پارلمانی اسرائیل در مجموع بیش از ۵۸ کرسی و شاید حد نصاب ۶۱ کرسی را به دست خواهد آورد.",
      "said": "2026-10-20",
      "type": "پیش‌بینی انتخاباتی احتمالی",
      "type_class": "پیش‌بینی احتمالی",
      "due_label": "پس از انتخابات ۵ آبان ۱۴۰۵ / تشکیل نتایج نهایی",
      "bucket": "legacy-b6",
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
      "source_primary_verified": false,
      "import_status": "separate_supported_claim_pending_primary_verification"
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
      "bucket": "legacy-e2",
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
      "source_primary_verified": false,
      "import_status": "separate_supported_claim_pending_primary_verification"
    },
    {
      "id": "PDR-IZA-20261021-01",
      "kind": "K",
      "speakers": [
        "ایزدی"
      ],
      "text": "در دو سال باقی‌مانده از دورهٔ ترامپ، جنگی با ایران رخ خواهد داد.",
      "said": "2026-10-21",
      "type": "پیش‌بینی زمان‌دار با افق تقریبی",
      "type_class": "پیش‌بینی",
      "due_label": "دو سال باقی‌ماندهٔ دورهٔ ترامپ (زمان دقیق بیان نیازمند بررسی نسخهٔ اصلی است)",
      "bucket": "legacy-e3",
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
      "source_primary_verified": false,
      "import_status": "separate_supported_claim_pending_primary_verification"
    }
  ],
  "pairs": [
    {
      "a": "K-009",
      "b": "K-011",
      "q": "آیا جمهوری‌خواهان سنا را نگه می‌دارند؟"
    },
    {
      "a": "K-013",
      "b": "K-022",
      "q": "بن‌بست در اسرائیل یا مأموریتِ آیزنکوت؟"
    },
    {
      "a": "K-016",
      "b": "K-017",
      "q": "آیا تا پایانِ آذر توافقی بسته می‌شود؟"
    },
    {
      "a": "K-043",
      "b": "K-049",
      "q": "آیا آمریکا از سلاحِ هسته‌ای علیه ایران استفاده می‌کند؟"
    },
    {
      "a": "K-051",
      "b": "K-052",
      "q": "آیا تا پایانِ اسفند توافقی شکل می‌گیرد؟"
    },
    {
      "a": "K-041",
      "b": "K-055",
      "q": "آیا کنگره‌ی دموکرات می‌تواند جلوی جنگ را بگیرد؟"
    },
    {
      "a": "K-031",
      "b": "K-031",
      "q": "آیا مجلسِ نمایندگان روندِ استیضاحِ ترامپ را آغاز می‌کند؟",
      "side_a": "خراتیان، علیزاده، بخشی‌پور، هلاکویی (له)",
      "side_b": "قهرمان‌پور (علیه)؛ عزیزی: به برکناری نمی‌رسد"
    }
  ],
  "recaps": [
    {
      "id": "yousef-azizi-meydan-diplomasi-mehr1405",
      "speaker": "یوسف عزیزی",
      "date": "۲۸ مهر",
      "claims": [
        "K-003",
        "K-010",
        "K-011",
        "K-018"
      ]
    },
    {
      "id": "editorial-izadi-alizadeh-netanyahu-endorsement-2026",
      "speaker": "فؤاد ایزدی",
      "date": "۲۹ مهر",
      "claims": [
        "L-012"
      ]
    },
    {
      "id": "editorial-motaharnia-golden-simorgh-sokoot-20261022",
      "speaker": "مهدی مطهرنیا",
      "date": "۳۰ مهر",
      "claims": [
        "L-013"
      ]
    },
    {
      "id": "motaharnia-janeshini-baqa-4aban1405",
      "speaker": "مهدی مطهرنیا",
      "date": "۴ آبان",
      "claims": [
        "L-009"
      ]
    },
    {
      "id": "abrahamian-amanat-28mordad-1405",
      "speaker": "یرواند آبراهامیان و عباس امانت",
      "date": "۵ آبان",
      "claims": []
    },
    {
      "id": "motaharnia-entekhabat-esraeil-6aban1405",
      "speaker": "مهدی مطهرنیا",
      "date": "۶ آبان",
      "claims": [
        "K-013",
        "K-014",
        "K-015",
        "L-001",
        "L-003"
      ]
    },
    {
      "id": "holakouee-hoosh-masnooi-entekhabat-esraeil-oct2026",
      "speaker": "فرهنگ هلاکویی",
      "date": "حدودِ ۶ آبان",
      "claims": [
        "K-004",
        "K-006",
        "K-014"
      ]
    },
    {
      "id": "saboori-motaharnia-jomhouri-padeshahi-7aban1405",
      "speaker": "داروین صبوری و مهدی مطهرنیا",
      "date": "۷ آبان",
      "claims": []
    },
    {
      "id": "zagros-rashidi-jazayer-sena-8aban1405",
      "speaker": "زاگرس رشیدی",
      "date": "۸ آبان",
      "claims": [
        "K-005",
        "K-007",
        "K-009",
        "K-012",
        "L-005",
        "L-006"
      ]
    },
    {
      "id": "motaharnia-miyanjigari-ghatar-9aban1405",
      "speaker": "مهدی مطهرنیا",
      "date": "۹ آبان",
      "claims": [
        "K-001",
        "K-008",
        "K-016",
        "L-002",
        "L-004",
        "L-007"
      ]
    },
    {
      "id": "zeidabadi-name-vance-9aban1405",
      "speaker": "احمد زیدآبادی",
      "date": "۹ آبان",
      "claims": [
        "K-002",
        "K-017"
      ]
    },
    {
      "id": "moghayese-zeidabadi-motaharnia-9aban1405",
      "speaker": "زیدآبادی و مطهرنیا (مقایسه)",
      "date": "۹ آبان",
      "claims": []
    },
    {
      "id": "name-akhoundi-se-khanesh-10aban1405",
      "speaker": "تحلیلِ پندار",
      "date": "۱۰ آبان",
      "claims": []
    },
    {
      "id": "karname-pishbiniha-entekhabat-amrika-1405",
      "speaker": "کارنامه‌ی پیش‌بینی‌ها",
      "date": "۱۰ آبان",
      "claims": []
    },
    {
      "id": "motaharnia-roz-entekhabat-12aban1405",
      "speaker": "مهدی مطهرنیا",
      "date": "۱۲ آبان",
      "claims": [
        "K-021",
        "L-009",
        "L-011"
      ]
    },
    {
      "id": "safavi-masoumi-hozoor-mantaghei-1405",
      "speaker": "دکتر صفوی و دکتر معصومی‌زارع",
      "date": "حدودِ ۱۲ آبان",
      "claims": []
    },
    {
      "id": "dars-jensiat-pahlavi-aval-1405",
      "speaker": "داروین صبوری",
      "date": "حدودِ ۱۲ آبان",
      "claims": []
    },
    {
      "id": "zagros-rashidi-marshal-khalij-fars-aban1405",
      "speaker": "زاگرس رشیدی",
      "date": "حدودِ ۱۲ آبان",
      "claims": [
        "K-024",
        "K-025",
        "K-026",
        "K-027",
        "L-011"
      ]
    },
    {
      "id": "motaharnia-porsesh-pasokh-13aban1405",
      "speaker": "مهدی مطهرنیا",
      "date": "۱۳ آبان",
      "claims": [
        "K-019",
        "K-020",
        "K-022",
        "L-008",
        "L-009",
        "L-010"
      ]
    },
    {
      "id": "zeidabadi-entekhabat-amrika-13aban1405",
      "speaker": "احمد زیدآبادی",
      "date": "۱۳ آبان",
      "claims": [
        "K-022",
        "K-023",
        "K-028",
        "L-010"
      ]
    },
    {
      "id": "yousef-azizi-pas-az-entekhabat-13aban1405",
      "speaker": "یوسف عزیزی",
      "date": "حدودِ ۱۳ آبان",
      "claims": [
        "K-032",
        "K-033",
        "K-034",
        "K-035",
        "L-015",
        "L-016"
      ]
    },
    {
      "id": "kharatian-ghahremanpour-pas-az-entekhabat-aban1405",
      "speaker": "مهدی خراتیان و رحمن قهرمان‌پور",
      "date": "حدودِ ۱۴ آبان",
      "claims": [
        "K-029",
        "K-030",
        "K-031",
        "L-014"
      ]
    },
    {
      "id": "ghahremanpour-irantalk-entekhabat-14aban1405",
      "speaker": "رحمان قهرمان‌پور (ایران تاک)",
      "date": "۱۴ آبان",
      "claims": [
        "K-029",
        "K-031",
        "K-036",
        "L-017",
        "L-018"
      ]
    },
    {
      "id": "zeus-pas-az-entekhabat-14aban1405",
      "speaker": "زئوس",
      "date": "حدودِ ۱۴ آبان",
      "claims": [
        "K-037",
        "K-038",
        "K-039"
      ]
    },
    {
      "id": "holakouee-meybodi-pas-az-entekhabat-13aban1405",
      "speaker": "فرهنگ هلاکویی (با علیرضا میبدی)",
      "date": "۱۳ آبان",
      "claims": [
        "K-004",
        "K-031",
        "K-040",
        "K-041",
        "L-019"
      ]
    },
    {
      "id": "ashouri-shafiq-baroo-didar-pahlavi-1405",
      "speaker": "داریوش آشوری و شهلا شفیق (مجله‌ی بارو)",
      "date": "تاریخِ انتشار نامعلوم",
      "claims": []
    },
    {
      "id": "izadi-alizadeh-jedal-pas-az-entekhabat-14aban1405",
      "speaker": "فواد ایزدی (میهمانِ علی علیزاده، «جدال»)",
      "date": "۱۴ آبان",
      "claims": [
        "K-023",
        "K-031",
        "K-039",
        "K-041",
        "K-042",
        "K-043",
        "K-044",
        "L-020",
        "L-021",
        "L-022"
      ]
    },
    {
      "id": "ghazizadeh-pas-az-entekhabat-14aban1405",
      "speaker": "علی‌حسین قاضی‌زاده",
      "date": "حدودِ ۱۴ آبان",
      "claims": [
        "K-045",
        "K-046",
        "K-047",
        "K-048",
        "L-023"
      ]
    },
    {
      "id": "azizi-bakhshipour-zelzele-siasi-13aban1405",
      "speaker": "یوسف عزیزی و امیررضا بخشی‌پور",
      "date": "۱۳ آبان",
      "claims": [
        "K-031",
        "K-049",
        "K-050",
        "K-051",
        "K-052",
        "K-053",
        "L-024"
      ]
    },
    {
      "id": "sofiamehr-epochtimes-negah-sevom-13aban1405",
      "speaker": "امین صوفیامهر (اپوک‌تایمز فارسی)",
      "date": "۱۳ آبان",
      "claims": [
        "K-032",
        "K-054",
        "K-055",
        "L-025"
      ]
    }
  ]
}
```
