# Pendar migration

## هدف

`nimania/jan-kalam` کدبیس فعال و بالغ محصول است و به پلتفرم اصلی **Pendar / پندار** تبدیل می‌شود.
`nimania/pendar` منبع legacy دانش و برند است و پس از انتقال کامل، باید از نقش production خارج شود.

## اصل معماری

**یک موجودیت = یک هویت = یک مرجع canonical**

- شخص معاصر: `#/figure/:handle`
- شخصی که از مسیر خبر `#/person/:slug` وارد شود، در صورت تطبیق به پروفایل figure هدایت می‌شود.
- پدیدآورنده کتاب در صورت تطبیق با figure به همان پروفایل هدایت می‌شود.
- رسانه ثبت‌شده از مسیر `#/source/:name` به `#/press-source/:name` resolve می‌شود.
- داده‌های تاریخی و فرهنگی در `#/knowledge/...` قرار می‌گیرند و در صورت وجود هویت فعال، به مرجع اصلی resolve می‌شوند.

## منتقل‌شده از repo قدیمی Pendar

این داده‌ها اکنون در `web-static/data` کدبیس اصلی وجود دارند:

- `pendar-people.json`
- `pendar-figures.json`
- `pendar-books.json`
- `pendar-organizations.json`
- `pendar-festivals.json`
- `pendar-collections.json`
- `pendar-topics.json`
- `pendar-paths.json`
- `pendar-articles.json`

## رابط جدید

`web-static/knowledge-hub.js` لایه «دانش پندار» را فراهم می‌کند:

- نمای کلی
- آدم‌ها و چهره‌های تاریخی
- موضوعات
- پرونده‌ها
- مسیرهای مطالعه
- آیین‌ها
- نهادها

## برند

پوسته اصلی، metadata و PWA به **Pendar / پندار** تغییر یافته‌اند.
«جان کلام» به‌عنوان vertical دیدگاه‌ها و گفته‌های افراد حفظ می‌شود، نه نام کل پلتفرم.

## باقی‌مانده پیش از آزاد کردن نام repo

1. انتقال assetهای باینری legacy که واقعاً در رابط جدید لازم شوند (تصاویر تاریخی/جلدها).
2. بررسی نهایی build و deep linkهای `#/knowledge`.
3. بررسی overlap داده‌های کتاب legacy با پیشخوان کتاب و merge موردبه‌مورد، نه ایجاد رکورد موازی.
4. تعیین تکلیف feed قدیمی `pendar/data/articles.json`: آرشیو دانش یا اتصال به pipeline جدید جراید.
5. پس از تأیید production:
   - rename `nimania/pendar` → `pendar-legacy` (یا archive)
   - rename `nimania/jan-kalam` → `pendar`
   - بررسی GitHub Pages/custom domain و redirectهای لازم.

## چیزی که نباید انجام شود

repo قدیمی Pendar پیش از تکمیل مراحل بالا delete نشود. تاریخچه، assetهای باینری و مرجع بازگشت مهاجرت تا پایان validation باید باقی بمانند.
