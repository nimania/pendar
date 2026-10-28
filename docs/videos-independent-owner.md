# ویدئوها — قرارداد استقلال و مسیر داده

از ۲۸ اکتبر ۲۰۲۶، **مالک کشف ویدئوهای YouTube مخزن مستقل [nimania/videos](https://github.com/nimania/videos)** است. پندار کشف/گردآوری موازی را انجام نمی‌دهد.

## جریان واقعی

1. `nimania/videos/data/sources.json` فهرست منابع مجاز و رسانه‌های میزبان را نگه می‌دارد.
2. `nimania/videos/scripts/collect_videos.py` خوراک‌های یوتیوب را در GitHub Actions می‌خواند و آخرین آرشیو سالم **خود سایت ویدئوها** را با تازه‌ها ادغام می‌کند.
3. `https://nimania.github.io/videos/data/pendar-youtube-videos.json` نسخهٔ ماشین‌خوانی برای پندار است.
4. `backend/scripts/collect_external_figures.py::load_videos_catalog()` دادهٔ انتشارشده را وارد `backend/data/youtube-videos.json` می‌کند؛ اگر منبع مستقل پاسخ ندهد، نسخهٔ کش‌شده حفظ می‌شود.
5. گردآورندهٔ پندار فقط مطالب و گفته‌ها، رونوشت‌ها و جان کلام را طبق تنظیمات خودش ایجاد/منتشر می‌کند؛ `collect_youtube_catalog()` حذف شده است.
6. `backend/scripts/export_static.py`، مانند گذشته، ویدئوهای مصرف‌شده را به `figures.json` اضافه می‌کند تا کارت ویدئو و پیوند در پروفایل اشخاص کار کند. **صفحهٔ یکتای هر ویدئو فقط روی Videos است**.

## نقش‌ها و لینک‌ها

- شبکه و رسانه (`source-*`) هویت حقوقی/رسانه‌ای است، نه شخص.
- میزبان و مهمان فقط با شناسهٔ معتبر هر ویدئو در `nimania/videos/data/credits.json` ثبت می‌شوند.
- `https://nimania.github.io/videos/video/{youtube-id}/` لینک ثابت ویدئو است.
- `https://nimania.github.io/videos/media/{media-handle}/` پروندهٔ رسانه است.
- `https://pendar.io/@{handle}/` صفحهٔ شخص و `https://pendar.io/statement/{id}/` صفحهٔ متن جان کلام است.

## عملیاتی و خطایابی

- تست مصرف‌کنندهٔ پندار: `python -m unittest discover -s backend/tests -p test_videos_consumer.py -v`
- اولین نتیجهٔ مثبت واقعی: [اجرای موفق Pendar Figures](https://github.com/nimania/pendar/actions/runs/40707213043)؛ دریافت **۶۹۰ ردیف** از خروجی مستقل Videos.
- وضعیت انتقال در [issue شمارهٔ ۲۰۸](https://github.com/nimania/pendar/issues/208) ثبت شده است.
- اگر `backend/data/videos-feed-import-status.json` نشان دهد `fresh=false`، اطلاعات جدید دریافت نشده؛ تنها cache قبلی استفاده می‌شود و نباید ادعای تازه‌بودن کرد.
- برای افزودن رسانه/منبع ویدئو، `nimania/videos/data/sources.json` را تغییر دهید، نه فهرست گردآورندهٔ پندار.
- مسیرها و مستندات مالکیت محصول باید از تکثیر صفحهٔ ویدئو در پندار جلوگیری کنند؛ متن ویدئو و جان کلام همچنان در پندار هستند.
