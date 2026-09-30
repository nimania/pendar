# پندار — Alpha 0.2

پرتال فارسی برای کشف ایران، اندیشه و فرهنگ آن.

## بخش‌ها
خانه، پندار امروز، کتابخانه، نویسندگان، موضوعات، تقویم ایران، پرونده‌ها، مسیرهای مطالعه، نهادها، جستجو، منابع و وضعیت پایش.

داده اولیه: ۱۰ کتاب، ۱۰ موضوع، ۳ پرونده، ۴ آیین، ۲ مسیر، ۸ نهاد. صفحات اختصاصی و پیوندهای موضوعی از JSON ساخته می‌شوند. مشخصات چاپ و گرایش‌های تأییدنشده حدس زده نمی‌شوند.

## ساخت
نیازمند Python 3.10 یا جدیدتر؛ بدون وابستگی اضافی.

```sh
python scripts/ingest.py
python scripts/build.py
python scripts/check.py
python -m http.server 8000 --directory dist
```

## انتشار
workflow اصلی سایت را روی https://nimania.github.io/pendar/ منتشر می‌کند و هر شش ساعت خوراک‌های بخارا و بنیاد میراث ایران را دریافت می‌کند. اجراهای زمان‌بندی GitHub ممکن است با تأخیر انجام شوند. GitHub Pages باید برای این مخزن فعال و منبع انتشار GitHub Actions باشد؛ workflow تلاش می‌کند آن را فعال کند. در صورت منع تنظیم خودکار، Settings → Pages → Source: GitHub Actions.

## محدودیت‌های آلفا
گزیده‌های کوتاه با انتساب به خوراک منبع؛ بدون بازنویسی AI یا API key. خبر جدید ساخته نمی‌شود. منابع فعلی ممکن است دیر به‌روز شوند. خطاها در صفحه منابع ثبت و داده قبلی حفظ می‌شود. آرشیو داده حداکثر ۸۰ مطلب است. رویدادهای محلی، نقشه، حساب کاربری و پرسش AI هنوز پیاده نشده‌اند.

## تصویر و فونت
نگاره جشن سده از شاهنامه شاه‌تهماسب، موزه متروپولیتن، شیء 452111؛ تصویر مالکیت عمومی از API رسمی. فونت Vazirmatn؛ مجوز SIL Open Font License در assets/OFL.txt.

## معماری
JSON مرتبط + مولد Python + جستجوی مرورگر + GitHub Actions + GitHub Pages. این اولین آلفا از Astro استفاده نمی‌کند؛ برای این حجم داده ساخت بدون بسته‌های اضافی کافی است و داده‌ها برای انتقال بعدی مستقل‌اند.

## Visual library update

Ten books have individual reading guides and visual cards. Nine author pages include sourced biographies; eight include attributed historical photos, artworks or a statue. Artistic depictions are labelled. Nazem al-Islam has no verified portrait yet.

Two actual book covers are used, with their sources on the detail page. Other jackets are Pendar typographic designs and explicitly labelled as such. Three edition records are sourced separately; a pictured cover is not assumed to depict that edition. Image source, creator and license are recorded in data/people.json and rendered on author pages.

## چهره‌های مشروطه
بخش `/figures/` با ۸ پروفایل مرجع اولیه، خط زمان میلادی، نام‌های دیگر، منابع ایرانیکا، پیوند چهره‌های مرتبط و کتاب‌های مطالعه. داده‌ها در `data/figures.json` نگهداری می‌شوند. عکس‌های مستند دارای انتساب و مجوز هستند؛ مدخل‌های بدون تصویر تأییدشده با جای‌نگهدار متنی نمایش داده می‌شوند. فهرست کامل فعالان مشروطه نیست.
