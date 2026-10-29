/* News reading lives in Jan Kalam; Pendar retains its authored reports. */
const JANKALAM_BASE = "https://nimania.github.io/jan-kalam/";
function pendarIsEditorialStory(story) {
  const id = String(story?.id || "");
  return !!(story?.editorial_report || story?.has_editorial_report ||
    window.PendarEditorialPilots?.[id] ||
    window.PENDAR_NEWS_DESTINATIONS?.editorial?.[id]);
}
function janKalamURL(kind = "", arg = "") {
  if (kind === "story") return JANKALAM_BASE + "?story=" + encodeURIComponent(arg);
  if (["", "headlines", "feed", "news"].includes(kind)) return JANKALAM_BASE;
  return JANKALAM_BASE + "#/" + kind + (arg ? "/" + encodeURIComponent(arg) : "");
}
function goJanKalam(kind = "", arg = "", replace = false) {
  const target = janKalamURL(kind, arg);
  if (replace) location.replace(target); else location.assign(target);
}
function pendarContentURL(story) {
  const id = String(story?.id || "");
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return "/reports/";
  if (pendarIsEditorialStory(story)) {
    return typeof window.pendarStoryURL === "function"
      ? window.pendarStoryURL(id) : "/story/" + encodeURIComponent(id) + "/";
  }
  return janKalamURL("story", id);
}
