/* Pendar live heritage skin. Keep the original SPA and all non-home routes intact.
   The legacy home remains as an automatic fallback if loading fails. */
(function(){
  "use strict";
  var host=document.getElementById("heritage-live-host");
  if(!host)return;
  var isReady=false,starting=false,shadow=null;
  function toggle(active){
    host.hidden=!active;
    document.documentElement.classList.toggle("heritage-live-active",active);
    if(active&&!isReady&&!starting)mount();
  }
  function currentHome(){
    var path=location.pathname.replace(/\/+$/,"")||"/";
    var hash=location.hash;
    return path==="/" && (!hash || hash==="#" || hash==="#/");
  }
  function fail(error){
    starting=false;
    document.documentElement.classList.remove("heritage-live-active");
    host.hidden=true;
    if(typeof console!=="undefined")console.error("Pendar heritage live: loading failed; the original homepage is preserved.",error);
  }
  async function mount(){
    starting=true;
    try{
      var response=await fetch("/heritage-preview.html",{credentials:"same-origin"});
      if(!response.ok)throw new Error("Heritage template missing: "+response.status);
      var html=await response.text();
      var doc=new DOMParser().parseFromString(html,"text/html");
      var header=doc.querySelector("header.masthead");
      var navigation=doc.querySelector("nav.site-nav");
      var main=doc.querySelector("main#content");
      var footer=doc.querySelector("footer.footer");
      if(!header||!navigation||!main||!footer||!main.querySelector("#feature-hero")){
        throw new Error("Heritage template is incomplete");
      }
      shadow=host.shadowRoot||host.attachShadow({mode:"open"});
      var css=document.createElement("link");
      css.rel="stylesheet";
      css.href="/heritage-preview.css?v=20261018-live-1";
      shadow.appendChild(css);
      var shell=document.createElement("div");
      shell.className="heritage-root";
      shell.append(header, navigation, main, footer);
      var demoNote=shell.querySelector(".edition");
      if(demoNote)demoNote.remove();
      var exit=shell.querySelector(".exit-preview");
      if(exit)exit.remove();
      var brand=shell.querySelector(".brand");
      if(brand)brand.href="/";
      var demoArticle=shell.querySelector("#article-page");
      if(demoArticle)demoArticle.remove();
      var searchLink=shell.querySelector(".nav-search");
      if(searchLink)searchLink.href="/headlines/";
      // In-page section anchors stay local. Do not activate SPA hash routing.
      shell.addEventListener("click",function(event){
        var node=event.target;
        if(!(node instanceof Element))node=node.parentElement;
        var link=node&&node.closest("a[href^='#']");
        if(link){
          var target=shadow.getElementById(link.getAttribute("href").slice(1));
          if(target){event.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});}
        }
      });
      shadow.appendChild(shell);
      await new Promise(function(resolve,reject){
        window.PENDAR_HERITAGE_EMBED=true;
        var script=document.createElement("script");
        script.src="/heritage-preview.js?v=20261018-live-1";
        script.onload=resolve;
        script.onerror=function(){reject(new Error("Heritage feed script did not load"));};
        document.body.appendChild(script);
      });
      if(!window.PendarHeritage||typeof window.PendarHeritage.mount!=="function"){
        throw new Error("Magazine renderer is not available");
      }
      await window.PendarHeritage.mount(shadow);
      isReady=true;
      starting=false;
    }catch(error){fail(error);}
  }
  var originalShow=window.show;
  if(typeof originalShow==="function"){
    window.show=function(view){
      var result=originalShow.apply(this,arguments);
      toggle(view==="home");
      return result;
    };
  }
  // The original app may have completed its first home render before this
  // script starts. Respect an initial deep-link rather than flashing home.
  toggle(currentHome() && document.getElementById("home-view")?.style.display!=="none");
})();