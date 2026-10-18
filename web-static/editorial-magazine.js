/* Shared magazine chrome and visual cards for the editorial archive and author pages.
   Keeps the canonical story URLs, source records, and editorial attribution intact. */
function pendarMagazineCollectionFrame(content){
  return '<div class="magazine-collection">'
    +'<header class="magazine-collection-masthead"><div class="magazine-collection-container magazine-collection-masthead-inner">'
    +'<a href="/" class="magazine-collection-brand" aria-label="صفحهٔ اول پندار"><img src="/assets/pendar-logo.svg" alt="پندار"></a>'
    +'<span class="magazine-collection-tagline">خبر، اندیشه و فرهنگ</span>'
    +'<a class="magazine-collection-back" href="/">بازگشت به صفحهٔ اول ←</a>'
    +'</div></header>'
    +'<nav class="magazine-collection-nav" aria-label="بخش‌های پندار"><div class="magazine-collection-container">'
    +'<a href="/">خانه</a><a class="magazine-collection-nav-current" href="/reports/">گزارش‌ها</a>'
    +'<a href="/headlines/">سرخط</a><a href="/figures/">چهره‌ها</a>'
    +'<a href="/books/">کتاب</a><a href="/movies/">جان فیلم</a><a href="/press/">پیشخوان جراید</a>'
    +'</div></nav>'
    +'<div class="magazine-collection-container magazine-collection-content">'+content+'</div>'
    +'<footer class="magazine-collection-footer"><div class="magazine-collection-container">'
    +'<strong>پندار</strong><span>خبر، اندیشه و فرهنگ</span>'
    +'<nav aria-label="پایین صفحه"><a href="/reports/">گزارش‌ها</a><a href="/headlines/">سرخط</a>'
    +'<a href="/figures/">چهره‌ها</a><a href="/press/">جراید</a></nav>'
    +'</div></footer></div>';
}
function pendarMagazineReportCard(row,options){
  const id=String(row?.id||"");
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return "";
  const title=String(row.title_fa||row.editorial_report_title_fa||row.headline_fa||"").trim();
  if(!title)return "";
  const url=String(row.image_url||"").trim();
  const photo=/^(https?:\/\/|\/(?!\/))[^"'<> ]+$/i.test(url)?url:"";
  const short=String(row.lead_fa||"").replace(/\s+/g," ").trim();
  const teaser=short.length>172?short.slice(0,171).replace(/\s+\S*$/,"")+"…":short;
  const author=String(row.author_id||row.editorial_author_id||"desk");
  const published=String(row.published_at||"").slice(0,10);
  const showAuthor=options?.showAuthor!==false;
  const avatar=showAuthor&&typeof pendarAuthorPortraitCSS==="function"?pendarAuthorPortraitCSS(author):"";
  const name=typeof pendarAuthorName==="function"?pendarAuthorName(author):"تحریریه پندار";
  return '<article class="magazine-report-card'+(photo?"":" no-image")+'">'
    +'<a class="magazine-report-card-link" href="'+esc(typeof window!=="undefined"&&typeof window.pendarStoryURL==="function"?window.pendarStoryURL(id):"/story/"+id+"/")+'">'
    +(photo?'<span class="magazine-report-photo"><img src="'+esc(photo)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest(&quot;.magazine-report-card&quot;).classList.add(&quot;no-image&quot;);this.closest(&quot;.magazine-report-photo&quot;).remove()"></span>':"")
    +'<span class="magazine-report-card-content"><span class="magazine-report-kicker">گزارش پندار</span>'
    +'<span class="magazine-report-title">'+esc(title)+'</span>'
    +(teaser?'<span class="magazine-report-deck">'+esc(teaser)+'</span>':"")
    +'</span></a>'
    +'<div class="magazine-report-card-footer">'
    +(showAuthor?'<a class="magazine-report-author" href="/editorial-author/'+encodeURIComponent(author)+'/">'
        +'<span class="magazine-report-avatar" aria-hidden="true"'+(avatar?' style="'+avatar+'"':"")+'>'+(avatar?"":"پ")+'</span>'
        +esc(name)+'</a>':"")
    +(published?'<time datetime="'+esc(published)+'">'+esc(published)+'</time>':"")
    +'</div></article>';
}
