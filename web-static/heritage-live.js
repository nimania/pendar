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
    if(!active)document.documentElement.classList.remove("heritage-booting");
    if(active&&!isReady&&!starting)mount();
  }
  function currentHome(){
    var path=location.pathname.replace(/\/+$/,"")||"/";
    var hash=location.hash;
    return path==="/" && (!hash || hash==="#" || hash==="#/");
  }
  function fail(error){
    starting=false;
    // On any network or rendering failure restore the existing functional home.
    document.documentElement.classList.remove("heritage-booting","heritage-live-active");
    host.classList.remove("heritage-ready");
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
      if(!header||!main||!footer||!main.querySelector("#feature-hero")){
        throw new Error("Heritage template is incomplete");
      }
      shadow=host.shadowRoot||host.attachShadow({mode:"open"});
      // A shadow root otherwise hides its host's light-DOM children. Project the
      // magazine-shaped first-paint shell into the new isolated root while data loads.
      if(!shadow.querySelector("slot")){
        shadow.appendChild(document.createElement("slot"));
      }
      // Keep the new DOM invisible until data and its own stylesheet are ready.
      // The matching magazine-shaped first-paint shell stays visible meanwhile.
      var pendingStyle=document.createElement("style");
      pendingStyle.textContent=".heritage-root{display:none!important}";
      shadow.appendChild(pendingStyle);
      var css=document.createElement("link");
      css.rel="stylesheet";
      css.href="/heritage-preview.css?v=20261019-rail-tabs-2";
      var cssReady=new Promise(function(resolve,reject){
        css.addEventListener("load",resolve,{once:true});
        css.addEventListener("error",function(){reject(new Error("Heritage stylesheet did not load"));},{once:true});
      });
      shadow.appendChild(css);
      // Global Pendar header supplies the shared logo, navigation and controls.
      // Hide the magazine's duplicate chrome; keep its content and footer.
      var sharedHeaderStyle=document.createElement("style");
      sharedHeaderStyle.textContent=".site-nav{display:none!important}";
      shadow.appendChild(sharedHeaderStyle);
      var shell=document.createElement("div");
      shell.className="heritage-root";
      shell.append(header);if(navigation)shell.append(navigation);shell.append(main,footer);
      // A generic cover headline with no article photo is not a homepage item.
      // Let the fast picture-selection pass insert the actual cover.
      var pendingFeature=shell.querySelector(".feature-block");
      if(pendingFeature)pendingFeature.hidden=true;
      var demoNote=shell.querySelector(".edition");
      if(demoNote)demoNote.remove();
      var exit=shell.querySelector(".exit-preview");
      if(exit)exit.remove();
      var brand=shell.querySelector(".brand");
      if(brand)brand.href="/";
      // Keep the hidden article shell: the shared preview boot checks its ID.
      // It remains hidden on the production homepage and costs no API requests.
      var searchLink=shell.querySelector(".nav-search");
      if(searchLink){
        searchLink.href="/headlines/";
        searchLink.setAttribute("aria-label","جست‌وجوی خبرها در پندار");
        var searchBox=document.createElement("div");
        searchBox.className="heritage-search-box";
        searchBox.hidden=true;
        searchBox.innerHTML='<label for="heritage-search-query">جست‌وجوی خبرها</label><input id="heritage-search-query" type="search" autocomplete="off" placeholder="عنوان یا موضوع خبر…"><div id="heritage-search-results" role="status"></div>';
        navigation.appendChild(searchBox);
        var searchData=null;
        searchLink.addEventListener("click",async function(event){
          event.preventDefault();
          searchBox.hidden=!searchBox.hidden;
          if(searchBox.hidden)return;
          var input=searchBox.querySelector("input");
          input.focus();
          if(!searchData){
            try{var response=await fetch("/data/stories.json",{credentials:"same-origin"});searchData=response.ok?await response.json():[];}
            catch(_){searchData=[];}
          }
        });
        searchBox.querySelector("input").addEventListener("input",function(event){
          var query=event.target.value.trim().toLocaleLowerCase("fa-IR");
          var results=searchBox.querySelector("#heritage-search-results");
          if(query.length<2){results.textContent="حداقل دو حرف وارد کنید.";return;}
          var matches=(Array.isArray(searchData)?searchData:[]).filter(function(row){
            return String(row.headline_fa||"").toLocaleLowerCase("fa-IR").includes(query);
          }).slice(0,8);
          results.replaceChildren();
          if(!matches.length){results.textContent="خبری با این عبارت در سرخط‌های اخیر پیدا نشد.";return;}
          matches.forEach(function(row){
            if(!/^[0-9a-f-]{36}$/i.test(String(row.id||"")))return;
            var a=document.createElement("a");
            a.href="/story/"+encodeURIComponent(row.id)+"/";
            a.textContent=String(row.headline_fa||"");
            results.appendChild(a);
          });
        });
      }
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
        script.src="/heritage-preview.js?v=20261019-rail-tabs-2";
        script.onload=resolve;
        script.onerror=function(){reject(new Error("Heritage feed script did not load"));};
        document.body.appendChild(script);
      });
      if(!window.PendarHeritage||typeof window.PendarHeritage.mount!=="function"){
        throw new Error("Magazine renderer is not available");
      }
      // Start real data loading concurrently with CSS. Reveal the actual
      // magazine chrome as soon as styles are ready, instead of waiting for
      // third-party thumbnails and detail feeds to finish.
      var contentReady=window.PendarHeritage.mount(shadow);
      await cssReady;
      pendingStyle.remove();
      host.classList.add("heritage-ready");
      document.documentElement.classList.remove("heritage-booting");
      await contentReady;
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