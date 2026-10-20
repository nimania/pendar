/* Pendar Trends: compact other-trends rail + native figure follows.
   Shares the exact same localStorage key as the Pendar figures directory.
   No accounts, notifications or server-side following are implied. */
(function(){
"use strict";
var KEY="jankalam-figure-follows";
function escapeHtml(x){return String(x||"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function handle(x){return String(x||"").trim().toLowerCase();}
function follows(){try{
  var list=JSON.parse(window.localStorage.getItem(KEY)||"[]");
  return new Set(Array.isArray(list)?list.map(handle):[]);
}catch(_){return new Set();}}
function setFollows(all){try{window.localStorage.setItem(KEY,JSON.stringify(Array.from(all)));return true;}catch(_){return false;}}
function refreshButtons(){
  var active=follows();
  document.querySelectorAll("button[data-trend-figure-follow]").forEach(function(button){
    var key=handle(button.getAttribute("data-trend-figure-follow"));
    var on=active.has(key);
    button.setAttribute("aria-pressed",String(on));
    button.textContent=on?"✓ دنبال می‌کنم":"+ دنبال کن";
    button.setAttribute("aria-label",on?"لغو دنبال‌کردن این چهره":"دنبال‌کردن این چهره");
  });
}
document.addEventListener("click",function(ev){
  var button=ev.target.closest("button[data-trend-figure-follow]");
  if(!button)return;
  ev.preventDefault();
  var key=handle(button.getAttribute("data-trend-figure-follow"));
  if(!/^[a-z0-9_.-]{2,90}$/.test(key))return;
  var all=follows();
  if(all.has(key))all.delete(key);else all.add(key);
  if(!setFollows(all)){
    button.textContent="ذخیرهٔ دنبال‌کردن در این مرورگر امکان‌پذیر نیست";
    return;
  }
  refreshButtons();
});
window.addEventListener("storage",function(e){if(e.key===KEY)refreshButtons();});
function trendRail(){
  var target=document.querySelector("[data-trends-related-rail]");
  if(!target)return;
  var here=window.location.pathname;
  fetch("/data/google-trends-iran.json",{credentials:"same-origin",cache:"no-store"}).then(function(r){
    if(!r.ok)throw new Error("trends feed");
    return r.json();
  }).then(function(data){
    var all=[].concat(Array.isArray(data.reports)?data.reports:[],Array.isArray(data.briefs)?data.briefs:[]);
    var seen=new Set(), selected=[];
    all.forEach(function(item){
      if(!item||!item.title||!item.url||seen.has(item.url)||item.url===here)return;
      if(!/^\/(trends\/|@|events\/|places\/)/.test(item.url))return;
      if(item.title.indexOf("جست‌وجوی ")===0)return;
      seen.add(item.url);selected.push(item);
    });
    target.innerHTML=selected.slice(0,5).map(function(item){
      return '<a class="trend-side-link" href="'+escapeHtml(item.url)+'">'+escapeHtml(item.title)+'</a>';
    }).join("")+'<a class="trend-side-link trend-side-more" href="/trends/">آرشیو همهٔ ترندها ←</a>';
  }).catch(function(){
    target.innerHTML='<a class="trend-side-link trend-side-more" href="/trends/">دیدن ترندهای امروز ←</a>';
  });
}
document.addEventListener("DOMContentLoaded",function(){
  refreshButtons();
  document.querySelectorAll("button[data-trend-figure-follow]").forEach(function(b){b.hidden=false;});
  trendRail();
});
})();