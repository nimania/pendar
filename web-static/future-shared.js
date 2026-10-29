/* Unify standalone Future Observatory pages with Pendar's header and navigation. */
(function(){
  function boot(){
    if(document.querySelector(".pendar-future-header"))return;
    const head=document.createElement("header");head.className="pendar-future-header";
    head.innerHTML='<div class="inner"><a class="logo" href="/" aria-label="صفحهٔ اصلی پندار"><img src="/assets/pendar-logo.svg" alt="پندار"></a><span class="masthead-spacer"></span><nav class="masthead-actions" aria-label="دسترسی سریع"><a href="https://nimania.github.io/jan-kalam/" title="خبرخوان و آرشیو خبرها در جان‌کلام">جان‌کلام</a><a href="/figures/" title="چهره‌ها">چهره‌ها</a><a href="/press/" title="پیشخوان جراید">جراید</a><a href="/books/" title="پیشخوان کتاب">کتاب</a><a href="/future/" title="آینده‌بان"><img src="/assets/radar-logo.svg" alt="آینده‌بان"></a></nav></div>';
    document.body.prepend(head);
    const crumb=document.createElement("div");crumb.className="pendar-future-breadcrumb";
    const home=document.createElement("a");home.href="/";home.textContent="پندار";
    const future=document.createElement("a");future.href="/future/";future.textContent="آینده‌بان";
    const current=document.createElement("span");current.textContent=document.title.replace(/\s*[|｜]\s*پندار\s*$/,"");
    crumb.append(home,document.createTextNode(" / "),future,document.createTextNode(" / "),current);
    head.after(crumb);
    const sections=[
      ["/future/","آینده‌بان"],
      ["/future/evidence/","رادار زنده"],
      ["/radar/iran-scenarios/","سناریوهای ایران"],
      ["/radar/","رادار جهان"],
      ["/future/transition/watch/","چهره‌ها و نظریه‌ها"],
      ["/future/transition/","اطلس گذار"],
      ["/radar/iran-scenarios/#scenario-charts","شواهد و روندها"]
    ];
    const path=location.pathname.endsWith("index.html")?location.pathname.slice(0,-10):location.pathname;
    const normalized=path.endsWith("/")?path:path+"/";
    const sectionNav=document.createElement("nav");
    sectionNav.className="pendar-future-sections";
    sectionNav.setAttribute("aria-label","بخش‌های آینده‌بان");
    for(const [href,label] of sections){
      const a=document.createElement("a");a.href=href;a.textContent=label;
      if(normalized===href.split("#")[0]){a.setAttribute("aria-current","page");}
      sectionNav.append(a);
    }
    crumb.after(sectionNav);
    const identity=document.createElement("section");
    identity.className="pendar-future-identity";
    identity.innerHTML='<div><span class="eyebrow">پندار / پژوهش و آینده‌پژوهی</span><strong>آینده‌بان</strong><small>شواهد، سناریوها و مطالعات گذار</small></div><a href="/future/" aria-label="صفحهٔ نخست آینده‌بان">نمای کلی ←</a>';
    sectionNav.before(identity);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
