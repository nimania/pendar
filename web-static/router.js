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
  raw=raw.replace(/^dinr(?=\/|$)/,"diner");
  const entityPath=window.PENDAR_HANDLES?.entities?.[decodeURIComponent(raw)];
  if(entityPath)return entityPath;
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
    // Carefully curated non-person handles. Existing person handles always win.
    // Static mapping: no new registry queries, collectors or database joins.
    const aliases={
      "irna":{kind:"press",name:"ایرنا"},
      "isna":{kind:"press",name:"ایسنا"},
      "filimo":{kind:"tv",channel:"stream-filimo"},
      "mehr-news":{kind:"press",name:"مهر"},
      "fars-news":{kind:"press",name:"فارس"},
      "khabaronline":{kind:"press",name:"خبرآنلاین"},
      "radio-farda":{kind:"press",name:"رادیو فردا"},
      "bbc-persian":{kind:"press",name:"بی‌بی‌سی فارسی"},
      "iran-international":{kind:"press",name:"ایران اینترنشنال"},
      "euronews-persian":{kind:"press",name:"یورونیوز فارسی"},
      "kayhan-london":{kind:"press",name:"کیهان لندن"},
      "independent-persian":{kind:"press",name:"ایندیپندنت فارسی"},
      "radio-zamaneh":{kind:"press",name:"رادیو زمانه"}
    };
    const slug=decodeURIComponent(raw.slice(1)).toLowerCase();
    const alias=aliases[slug];
    if(slug==="bbc-persian")return showBBCPersianIdentity();
    if(slug==="iran-international")return showMediaIdentity_iran_international();
    if(slug==="radio-farda")return showMediaIdentity_radio_farda();
    if(alias?.kind==="press"&&typeof PENDAR_MEDIA_PROFILES!=="undefined"&&PENDAR_MEDIA_PROFILES[slug])return showPendarMediaIdentity(slug);
    if(alias?.kind==="press"){
      await showPress(alias.name);
      history.replaceState(null,"","/@"+slug+"/"+location.search);
      return;
    }
    if(alias?.kind==="tv"){
      await openTVChannel(alias.channel);
      history.replaceState(null,"","/@"+slug+"/"+location.search);
      return;
    }
    if(typeof openCinemaHandle==="function" && await openCinemaHandle(slug))return;
    show("entity");setTab("");document.getElementById("entity-content").textContent="این هویت پیدا نشد";return;
  }
  const i = raw.indexOf("/");
  const kind = i < 0 ? raw : raw.slice(0, i);
  let arg = i < 0 ? "" : decodeURIComponent(raw.slice(i + 1));
  if(["entity","profile","graph"].includes(kind)&&arg.includes("/")&&!arg.includes(":"))arg=arg.replace("/",":");
  if (kind === "future") return showFuture(arg);
  if (kind === "headlines" || kind === "feed" || kind === "news") return showFeed();
  if (kind === "home") return showHome();
  if (kind === "editorial-author" && arg) return showPendarEditorialAuthor(arg);
  if (kind === "story" && arg) return openStory(arg);
  if (kind === "person" && arg) return openEntity(arg);
  if (kind === "topic" && arg) return openTopic(arg);
  if (kind === "event" && arg) return openEventDossier(arg);
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
  if (kind === "movie-credit" && arg) {
    const parts=arg.split("/");
    if(parts.length===3&&["director","cast"].includes(parts[1])&&/^\d+$/.test(parts[2]))
      return openLegacyMovieCredit(parts[0],parts[1],Number(parts[2]));
  }
  if (kind === "master-movie" && arg) return openMasterMovie(arg);
  if (kind === "tv" && arg.startsWith("channel/")) return openTVChannel(arg.slice(8));
  if (kind === "tv" && arg.startsWith("program/")) return openTVProgramme(arg.slice(8));
  if (kind === "tv") return showTVGuide(arg || "now");
  if (kind === "knowledge") return showKnowledge(arg || "home");
  if (kind === "entity" && arg) return openCanonicalEntity(arg);
  if (kind === "graph" && arg) return openEntityGraph(arg);
  if (kind === "profile" && arg) return openEntityProfile(arg);
  if (kind === "system" && arg === "entities") return showEntityQA();
  if (kind === "system") return showSystem();
  if (kind === "publisher" && arg) return openPublisher(arg);
  if (kind === "book-person" && arg) return openBookPerson(arg);
  if (kind === "badbadak") return arg === "crossword" ? showBadbadakCrossword() : showBadbadak();
  if (kind === "us-radar") return showUSRadar();
  if (kind === "israel-radar") return showIsraelRadar();
  if (kind === "radar") return showRadarHub();
  if (kind === "tech") return showTech();
  if (kind === "diner" || kind === "dinr") return showDiner(arg);
  if (kind === "figure" && arg) return openFigure(arg);
  if (kind === "news-person" && arg) return openNewsPerson(arg);
  if (kind === "statement" && arg) return openStatement(arg);
  return showHome();
}


window.addEventListener("hashchange",()=>{if(!_navLock){const h=location.hash;history.replaceState(null,"",routeURL(h)+location.search);route();updateRouteSeo(location.pathname);}});
window.addEventListener("popstate",()=>{window.__PENDAR_ROUTE="";route();updateRouteSeo(location.pathname);});
// Existing hash URLs remain valid, but acquire a real canonical path.
if(location.hash||routeURL(location.pathname)!==location.pathname){const path=routeURL(location.hash||location.pathname);history.replaceState(null,"",path+location.search);updateRouteSeo(path);}
const PUBLIC_ROUTES=new Set(["headlines","home","story","editorial-author","person","topic","trend","event","source","province","day","trends","fact","iran","topics","market","weather","faq","figures","videos","studio-recaps","finance","studio-recap","press","press-source","press-article","books","book","movies","movie","master-movie","tv","knowledge","entity","graph","profile","system","publisher","book-person","tech","figure","news-person","statement","badbadak","us-radar","israel-radar","radar","diner","dinr","future"]);
function cleanInternalLinks(root){
  const links=root.matches?.("a[href]")?[root]:[...root.querySelectorAll?.("a[href]")||[]];
  for(const a of links){const h=a.getAttribute("href");if(h?.startsWith("#/"))a.setAttribute("href",routeURL(h));else if(h?.startsWith("/")&&!h.startsWith("//")){const clean=routeURL(h);if(clean!==h&&(window.PENDAR_HANDLES?.routes?.[decodeURIComponent(h.replace(/^\/+|\/+$/g,""))]||window.PENDAR_HANDLES?.entities?.[decodeURIComponent(h.replace(/^\/+|\/+$/g,""))]))a.setAttribute("href",clean);}}
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

