/* Pendar — hash routing: shareable URLs + working Back button.
   Loaded as a classic script after core.js and before the view scripts, so
   setHash()/route() are on the global scope for every module (several view
   scripts call setHash at click time). The route() table dispatches to the
   show.../open... view functions defined in app.js and the other view scripts;
   those run only at navigation time, by which point every script has loaded.
   _navLock stops our own setHash() from re-triggering the router. */

let _navLock = false;

function currentRoute(){
  return (location.hash || window.__PENDAR_ROUTE || location.pathname).replace(/^#\/?/,"").replace(/^\/+|\/+$/g,"");
}
function routeURL(h){
  let raw=String(h||"").replace(/^#\/?/,"").replace(/^\/+|\/+$/g,"");
  const handle=window.PENDAR_HANDLES?.routes?.[decodeURIComponent(raw)];
  if(handle)raw="@"+handle;
  return raw?"/"+raw+"/":"/";
}
let _seoRequest=0;
async function updateRouteSeo(path){
  const request=++_seoRequest;
  try{
    const response=await fetch(path+"seo.json");
    if(!response.ok)return;
    const meta=await response.json();
    if(request!==_seoRequest)return;
    document.title=meta.title;
    for(const [name,value] of Object.entries(meta.tags)){
      const property=name.startsWith("og:");
      let el=document.head.querySelector('meta['+(property?"property":"name")+'="'+name+'"]');
      if(!el){el=document.createElement("meta");el.setAttribute(property?"property":"name",name);document.head.appendChild(el);}
      el.content=value;
    }
    let canonical=document.querySelector('link[rel="canonical"]');
    if(!canonical){canonical=document.createElement("link");canonical.rel="canonical";document.head.appendChild(canonical);}
    canonical.href=meta.canonical;
    let schema=document.getElementById("seo-schema");
    if(!schema){schema=document.createElement("script");schema.id="seo-schema";schema.type="application/ld+json";document.head.appendChild(schema);}
    schema.textContent=JSON.stringify(meta.schema);
  }catch(_){}
}
function setHash(h){
  let path=routeURL(h);
  if(location.pathname===path&&!location.hash)return;
  window.__PENDAR_ROUTE="";
  history.pushState(null,"",path+location.search);
  updateRouteSeo(path);
}
async function route() {
  if (location.hash === "#/" || location.hash === "#") {
    history.replaceState(null, "", location.pathname + location.search);
  }
  const raw = currentRoute();
  if(raw.startsWith("@")){
    const person=window.PENDAR_HANDLES?.people?.[decodeURIComponent(raw.slice(1)).toLowerCase()];
    if(person?.id)return openCanonicalEntity(person.id);
    if(person?.figure)return openFigure(person.figure);
    show("entity");setTab("");document.getElementById("entity-content").textContent="این چهره پیدا نشد";return;
  }
  const i = raw.indexOf("/");
  const kind = i < 0 ? raw : raw.slice(0, i);
  const arg = i < 0 ? "" : decodeURIComponent(raw.slice(i + 1));
  if (kind === "headlines" || kind === "feed" || kind === "news") return showFeed();
  if (kind === "home") return showHome();
  if (kind === "story" && arg) return openStory(arg);
  if (kind === "person" && arg) return openEntity(arg);
  if (kind === "topic" && arg) return openTopic(arg);
  if (kind === "trend" && arg) return openTrendDossier(arg);
  if (kind === "source" && arg) return openSource(arg);
  if (kind === "province" && arg) return openProvince(arg);
  if (kind === "day" && arg) return openDay(arg);
  if (kind === "trends") return showTrends();
  if (kind === "fact") return showFactchecks();
  if (kind === "iran") return showIran();
  if (kind === "topics") return showTopics();
  if (kind === "market") return showMarket();
  if (kind === "weather") return showWeather();
  if (kind === "faq") return showFaq();
  if (kind === "figures") return arg==="directory"?showPersonDirectory():showFigures();
  if (kind === "videos") return showLatestVideos(arg === "recaps" ? "recaps" : "all");
  if (kind === "studio-recaps") return showStudioRecaps();
  if (kind === "finance") return showProjectFinance();
  if (kind === "studio-recap" && arg) return openStudioRecap(arg);
  if (kind === "press") return showPress();
  if (kind === "press-source" && arg) return showPress(arg);
  if (kind === "press-article" && arg) return openPressArticle(arg);
  if (kind === "books") return showBooks(["publishers","people","new","all","used","reviews"].includes(arg) ? arg : "books");
  if (kind === "book" && arg) return openBook(arg);
  if (kind === "movies") return showMovies();
  if (kind === "movie" && arg) return openMovie(arg);
  if (kind === "master-movie" && arg) return openMasterMovie(arg);
  if (kind === "tv") return showTVGuide(arg || "now");
  if (kind === "knowledge") return showKnowledge(arg || "home");
  if (kind === "entity" && arg) return openCanonicalEntity(arg);
  if (kind === "graph" && arg) return openEntityGraph(arg);
  if (kind === "profile" && arg) return openEntityProfile(arg);
  if (kind === "system" && arg === "entities") return showEntityQA();
  if (kind === "system") return showSystem();
  if (kind === "publisher" && arg) return openPublisher(arg);
  if (kind === "book-person" && arg) return openBookPerson(arg);
  if (kind === "tech") return showTech();
  if (kind === "figure" && arg) return openFigure(arg);
  if (kind === "news-person" && arg) return openNewsPerson(arg);
  if (kind === "statement" && arg) return openStatement(arg);
  return showHome();
}


window.addEventListener("hashchange",()=>{if(!_navLock){const h=location.hash;history.replaceState(null,"",routeURL(h)+location.search);route();updateRouteSeo(location.pathname);}});
window.addEventListener("popstate",()=>{window.__PENDAR_ROUTE="";route();updateRouteSeo(location.pathname);});
// Existing hash URLs remain valid, but acquire a real canonical path.
if(location.hash||routeURL(location.pathname)!==location.pathname){const path=routeURL(location.hash||location.pathname);history.replaceState(null,"",path+location.search);updateRouteSeo(path);}
const PUBLIC_ROUTES=new Set(["headlines","home","story","person","topic","trend","source","province","day","trends","fact","iran","topics","market","weather","faq","figures","videos","studio-recaps","finance","studio-recap","press","press-source","press-article","books","book","movies","movie","master-movie","tv","knowledge","entity","graph","profile","system","publisher","book-person","tech","figure","news-person","statement"]);
function cleanInternalLinks(root){
  const links=root.matches?.("a[href]")?[root]:[...root.querySelectorAll?.("a[href]")||[]];
  for(const a of links){const h=a.getAttribute("href");if(h?.startsWith("#/"))a.setAttribute("href",routeURL(h));else if(h?.startsWith("/")&&!h.startsWith("//")){const clean=routeURL(h);if(clean!==h&&window.PENDAR_HANDLES?.routes?.[decodeURIComponent(h.replace(/^\/+|\/+$/g,""))])a.setAttribute("href",clean);}}
}
cleanInternalLinks(document);
new MutationObserver(mutations=>{for(const m of mutations){if(m.type==="attributes")cleanInternalLinks(m.target);for(const n of m.addedNodes||[])if(n.nodeType===1)cleanInternalLinks(n);}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["href"]});
document.addEventListener("click",event=>{
 const a=event.target.closest?.("a[href]");
 if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||a.target||a.hasAttribute("download")||a.hasAttribute("onclick"))return;
 const url=new URL(a.href,location.href);
 if(url.origin!==location.origin)return;
 if(url.pathname!=="/"&&!url.pathname.startsWith("/@")&&!PUBLIC_ROUTES.has(url.pathname.split("/")[1]))return;
 event.preventDefault();window.__PENDAR_ROUTE="";
 history.pushState(null,"",url.pathname+url.search);route();updateRouteSeo(url.pathname);
});

