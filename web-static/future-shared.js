/* Unify standalone Future Observatory pages with Pendar's header and navigation. */
(function(){
  function boot(){
    if(document.querySelector(".pendar-future-header"))return;
    const head=document.createElement("header");head.className="pendar-future-header";
    head.innerHTML='<div class="inner"><a class="logo" href="/" aria-label="صفحهٔ اصلی پندار"><img src="/assets/pendar-logo.svg" alt="پندار"></a><nav class="links" aria-label="ناوبری اصلی"><a href="/">سرخط</a><a href="/figures/">چهره‌ها</a><a href="/books/">پیشخوان کتاب</a><a href="/radar/">رادارها</a><a href="/future/">آینده‌بان</a><a href="/future/evidence/">شواهد آینده</a></nav></div>';
    document.body.prepend(head);
    const crumb=document.createElement("div");crumb.className="pendar-future-breadcrumb";
    const home=document.createElement("a");home.href="/";home.textContent="پندار";
    const future=document.createElement("a");future.href="/future/";future.textContent="آینده‌بان";
    const current=document.createElement("span");current.textContent=document.title.replace(/\s*[|｜]\s*پندار\s*$/,"");
    crumb.append(home,document.createTextNode(" / "),future,document.createTextNode(" / "),current);
    head.after(crumb);
    const sections=[
      ["/future/","آینده‌بان"],
      ["/future/evidence/","رادار شواهد"],
      ["/future/transition/","اطلس گذار"],
      ["/future/transition/fattahi/","مدل فتاحی"],
      ["/future/transition/watch/","دیده‌بان گذار"]
    ];
    const path=location.pathname.replace(/\\/index\\.html$/,"").replace(/\\/?$/,"/");
    const sectionNav=document.createElement("nav");
    sectionNav.className="pendar-future-sections";
    sectionNav.setAttribute("aria-label","بخش‌های آینده‌بان");
    for(const [href,label] of sections){
      const a=document.createElement("a");a.href=href;a.textContent=label;
      if(path===href){a.setAttribute("aria-current","page");}
      sectionNav.append(a);
    }
    crumb.after(sectionNav);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
