/* Pendar — entity QA / merge console (admin tool): a local-draft editor for
   proposing entity merges, keep-separate pairs, aliases and canonical-name
   overrides, plus the QA dashboard (duplicates, ambiguous aliases, orphans).
   Draft is kept in localStorage. Extracted from app.js; loaded as a classic
   script BEFORE app.js because route() reaches showEntityQA on a
   #/system/entities deep link. Uses entities.js helpers (loadCanonicalEntities,
   _entityTypeFa, openCanonicalEntity) at runtime. No behavior change. */

const ENTITY_QA_DRAFT_KEY="pendar_entity_override_draft_v1";
let _ENTITY_QA=null;
async function loadEntityQA(){
  if(_ENTITY_QA)return _ENTITY_QA;
  try{_ENTITY_QA=await getJSON(DATA+"/entity-qa.json?v="+Date.now(),12000)}
  catch(_){_ENTITY_QA=null}
  return _ENTITY_QA;
}
function _qaEmptyDraft(){return {version:1,merges:[],keep_separate:[],aliases:[],canonical_names:[]}}
function _qaDraft(){
  try{
    const x=JSON.parse(localStorage.getItem(ENTITY_QA_DRAFT_KEY)||"null");
    return x&&x.version===1?{..._qaEmptyDraft(),...x}:_qaEmptyDraft();
  }catch(_){return _qaEmptyDraft()}
}
function _qaSave(x){localStorage.setItem(ENTITY_QA_DRAFT_KEY,JSON.stringify(x));renderEntityQA()}
function _qaPair(a,b){return [String(a),String(b)].sort()}
function qaMerge(from,into){
  const d=_qaDraft();
  d.merges=d.merges.filter(x=>x.from!==from);
  d.merges.push({from:from,into:into});
  const pk=_qaPair(from,into).join("|");
  d.keep_separate=d.keep_separate.filter(x=>_qaPair(x[0],x[1]).join("|")!==pk);
  _qaSave(d);
}
function qaKeepSeparate(a,b){
  const d=_qaDraft(),p=_qaPair(a,b),pk=p.join("|");
  d.merges=d.merges.filter(x=>_qaPair(x.from,x.into).join("|")!==pk);
  if(!d.keep_separate.some(x=>_qaPair(x[0],x[1]).join("|")===pk))d.keep_separate.push(p);
  _qaSave(d);
}
function qaAlias(entity){
  const alias=prompt("Alias جدید برای این هویت:");
  if(!alias||!alias.trim())return;
  const d=_qaDraft(),row={entity:entity,alias:alias.trim()};
  if(!d.aliases.some(x=>x.entity===row.entity&&_canonicalNorm(x.alias)===_canonicalNorm(row.alias)))d.aliases.push(row);
  _qaSave(d);
}
function qaCanonicalName(entity,current){
  const name=prompt("نام canonical:",current||"");
  if(!name||!name.trim())return;
  const d=_qaDraft();
  d.canonical_names=d.canonical_names.filter(x=>x.entity!==entity);
  d.canonical_names.push({entity:entity,name_fa:name.trim()});
  _qaSave(d);
}
function qaClearDraft(){
  if(!confirm("Draft تصمیم‌های Entity QA پاک شود؟"))return;
  localStorage.removeItem(ENTITY_QA_DRAFT_KEY);renderEntityQA();
}
async function qaCopyDraft(){
  const txt=JSON.stringify(_qaDraft(),null,2);
  try{await navigator.clipboard.writeText(txt);document.getElementById("entity-qa-note").textContent="JSON override کپی شد."}
  catch(_){document.getElementById("entity-qa-note").textContent="کپی خودکار ممکن نبود؛ JSON پایین صفحه را کپی کن."}
}
function _qaEntity(ent){
  if(!ent)return '<span class="qa-missing">هویت ناموجود</span>';
  return '<button class="qa-entity" onclick="openCanonicalEntity(\''+esc(ent.id)+'\')"><b>'+esc(ent.name_fa||ent.id)+'</b><small>'+esc(_entityTypeFa(ent.type))+' · '+esc(ent.id)+'</small></button>';
}
function showEntityQA(){show("entityqa");setTab("");setHash("#/system/entities");renderEntityQA()}
async function renderEntityQA(){
  const el=document.getElementById("entity-qa-content");
  if(!el)return;
  el.innerHTML='<div class="spinner"></div>';
  const [qa,reg]=await Promise.all([loadEntityQA(),loadCanonicalEntities()]);
  if(!qa){el.innerHTML='<div class="state"><div class="big">گزارش Entity QA هنوز در این deploy ساخته نشده</div></div>';return}
  const entities=new Map((reg.entities||[]).map(x=>[x.id,x])),s=qa.stats||{},draft=_qaDraft(),applied=qa.applied_overrides||{};
  const candidates=(qa.duplicate_candidates||[]).slice(0,100).map(x=>{
    const a=entities.get(x.a),b=entities.get(x.b);
    return '<article class="qa-candidate"><div class="qa-pair">'+_qaEntity(a)+'<span class="qa-vs">'+faN(Math.round((x.score||0)*100))+'٪</span>'+_qaEntity(b)+'</div><div class="qa-actions"><button onclick="qaMerge(\''+esc(x.b)+'\',\''+esc(x.a)+'\')">ادغام B ← A</button><button onclick="qaMerge(\''+esc(x.a)+'\',\''+esc(x.b)+'\')">ادغام A → B</button><button onclick="qaKeepSeparate(\''+esc(x.a)+'\',\''+esc(x.b)+'\')">جدا بمانند</button></div></article>';
  }).join("");
  const ambiguous=(qa.ambiguous_aliases||[]).slice(0,100).map(x=>'<article class="qa-row"><div><b>'+esc(x.alias)+'</b><small>'+esc(x.type)+' · '+faN((x.entity_ids||[]).length)+' هویت</small></div><div class="qa-inline-entities">'+(x.entity_ids||[]).map(id=>_qaEntity(entities.get(id))).join("")+'</div></article>').join("");
  const orphans=(qa.orphans||[]).slice(0,120).map(x=>'<article class="qa-row"><div>'+_qaEntity(entities.get(x.id))+'</div><div class="qa-actions"><button onclick="qaAlias(\''+esc(x.id)+'\')">Alias</button><button onclick="qaCanonicalName(\''+esc(x.id)+'\',\''+esc(x.name_fa||"")+'\')">نام مرجع</button></div></article>').join("");
  const broken=(qa.broken_edges||[]).map(x=>'<code class="qa-error">'+esc(JSON.stringify(x))+'</code>').join("");
  const invalid=(qa.invalid_overrides||[]).map(x=>'<div class="qa-error">'+esc(x)+'</div>').join("");
  const draftCount=draft.merges.length+draft.keep_separate.length+draft.aliases.length+draft.canonical_names.length;
  el.innerHTML=
    '<button class="back" onclick="showSystem()">بازگشت به سلامت سیستم</button>'+
    '<section class="qa-hero"><div><span class="press-kicker">Entity QA / Merge Console</span><h1>کنترل هویت‌های پندار</h1><p>تشخیص هویت‌های تکراری، aliasهای مبهم، orphanها و تصمیم‌های پایدار برای build بعدی.</p></div><div class="qa-health '+((s.broken_edges||s.invalid_overrides)?"bad":"ok")+'"><b>'+((s.broken_edges||s.invalid_overrides)?"نیازمند اصلاح":"ساختار سالم")+'</b><small>'+faN(s.entities||0)+' هویت · '+faN(s.edges||0)+' رابطه</small></div></section>'+
    '<div class="qa-stats"><span><b>'+faN(s.duplicate_candidates||0)+'</b> duplicate candidate</span><span><b>'+faN(s.ambiguous_aliases||0)+'</b> alias مبهم</span><span><b>'+faN(s.orphans||0)+'</b> orphan</span><span><b>'+faN(s.no_routes||0)+'</b> بدون route</span><span><b>'+faN(s.broken_edges||0)+'</b> edge شکسته</span></div>'+
    '<section class="qa-draft"><div><h2>Draft تصمیم‌ها</h2><p>این Draft در مرورگر نگه داشته می‌شود. JSON آن دقیقاً با <code>backend/data/entity-overrides.json</code> سازگار است.</p><small>اعمال‌شده در build فعلی: '+faN(applied.merges||0)+' merge · '+faN(applied.keep_separate||0)+' keep · '+faN(applied.aliases||0)+' alias · '+faN(applied.canonical_names||0)+' نام مرجع</small></div><div class="qa-draft-actions"><button onclick="qaCopyDraft()">کپی JSON ('+faN(draftCount)+')</button><button onclick="qaClearDraft()">پاک کردن Draft</button></div><span id="entity-qa-note"></span><pre>'+esc(JSON.stringify(draft,null,2))+'</pre></section>'+
    (invalid||broken?'<section class="qa-section qa-danger"><h2>خطاهای مسدودکننده Deploy</h2>'+invalid+broken+'</section>':'')+
    '<details class="qa-section" open><summary>Duplicate candidates <b>'+faN(s.duplicate_candidates||0)+'</b></summary>'+(candidates||'<div class="sys-empty">موردی پیدا نشده.</div>')+'</details>'+
    '<details class="qa-section"><summary>Aliasهای مبهم <b>'+faN(s.ambiguous_aliases||0)+'</b></summary>'+(ambiguous||'<div class="sys-empty">موردی پیدا نشده.</div>')+'</details>'+
    '<details class="qa-section"><summary>Orphan entities <b>'+faN(s.orphans||0)+'</b></summary>'+(orphans||'<div class="sys-empty">موردی پیدا نشده.</div>')+'</details>';
}
