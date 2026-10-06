/* Pendar — hash routing: shareable URLs + working Back button.
   Loaded as a classic script after core.js and before the view scripts, so
   setHash()/route() are on the global scope for every module (several view
   scripts call setHash at click time). The route() table dispatches to the
   show.../open... view functions defined in app.js and the other view scripts;
   those run only at navigation time, by which point every script has loaded.
   _navLock stops our own setHash() from re-triggering the router. */

let _navLock = false;

function setHash(h) {
  // The homepage uses the bare URL, never the legacy #/ sentinel.
  if (!h || h === "#" || h === "#/") {
    if (location.hash) history.pushState(null, "", location.pathname + location.search);
    return;
  }
  if (location.hash === h) return;
  _navLock = true;
  location.hash = h;
  setTimeout(() => { _navLock = false; }, 0);
}

async function route() {
  if (location.hash === "#/" || location.hash === "#") {
    history.replaceState(null, "", location.pathname + location.search);
  }
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const i = raw.indexOf("/");
  const kind = i < 0 ? raw : raw.slice(0, i);
  const arg = i < 0 ? "" : decodeURIComponent(raw.slice(i + 1));
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
  return showFeed();
}

window.addEventListener("hashchange", () => { if (!_navLock) route(); });



// pushState removes the hash without a hashchange event. Restore the home view
// when browser Back/Forward lands on a clean homepage entry.
window.addEventListener("popstate", () => { if (!location.hash) route(); });
// Normalize bookmarked legacy home links as soon as the router loads.
if (location.hash === "#/" || location.hash === "#") {
  history.replaceState(null, "", location.pathname + location.search);
}
