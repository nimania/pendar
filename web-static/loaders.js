/* Pendar — shared dataset loaders + their caches. Extracted from app.js:
   the module-level caches (_FIG, _NEWS_PEOPLE, _CURATED_POEMS, _STUDIO_RECAPS,
   _PROJECT_FINANCE) and the lazy loaders that populate them
   (loadCuratedPoems, loadFigures [+ _LOCAL_FIGURE_FALLBACKS], loadStudioRecaps,
   loadProjectFinance, loadNewsPeople). Loaded as a classic script BEFORE app.js
   and before the view modules that read these caches / call these loaders at
   runtime (figures-*, studio-videos, nav, story-detail...). Uses getJSON/DATA
   from core.js. No behavior change. */

// Shared data caches must exist before startup renderers run.
let _FIG = null, _NEWS_PEOPLE = null, _CURATED_POEMS = null, _STUDIO_RECAPS = null, _PROJECT_FINANCE = null;

async function loadCuratedPoems(){ if(_CURATED_POEMS) return _CURATED_POEMS; try{_CURATED_POEMS=await getJSON(`${DATA}/curated-figure-poems.json`);}catch(_){_CURATED_POEMS={};} return _CURATED_POEMS||{}; }
const _LOCAL_FIGURE_FALLBACKS = [
  {
    handle: "nima-afshar-naderi",
    name_fa: "نیما افشارنادری",
    role_fa: "تولیدکننده محتوا و میزبان «جان کلام»",
    field: "media",
    field_fa: "رسانه و تحلیل",
    gender: "m",
    external: true,
    verified: true,
    claimed: true,
    avatar: "https://pbs.twimg.com/profile_images/2094137144591933440/SIBK8HjF_400x400.jpg",
    channel_url: "",
    count: 0,
    posts: [],
    social: [
      {kind:"x", label:"ایکس", url:"https://x.com/nimania"},
      {kind:"instagram", label:"اینستاگرام", url:"https://www.instagram.com/nima.afsharnaderi/"},
      {kind:"youtube", label:"یوتیوب", url:"https://www.youtube.com/channel/UCYDOVO7EpX3QNEf9Ddk1-AQ"},
      {kind:"telegram", label:"تلگرام", url:"https://t.me/nimaafsharnaderi"},
      {kind:"website", label:"گروکی‌پدیا", url:"https://grokipedia.com/page/nima-afshar-naderi"}
    ]
  }
];
async function loadFigures() {
  if (_FIG) return _FIG;
  try { _FIG = await getJSON(`${DATA}/figures.json`); } catch (e) { _FIG = { figures: [], fields: {} }; }
  _FIG.figures = Array.isArray(_FIG.figures) ? _FIG.figures : [];
  for (const fallback of _LOCAL_FIGURE_FALLBACKS) {
    if (!_FIG.figures.some(f => String(f.handle||"").toLowerCase() === fallback.handle)) {
      _FIG.figures.push(fallback);
    }
  }
  return _FIG;
}
async function loadStudioRecaps() {
  if (_STUDIO_RECAPS) return _STUDIO_RECAPS;
  try {
    const rows = await getJSON(`${DATA}/studio-recaps.json`);
    _STUDIO_RECAPS = Array.isArray(rows) ? rows : [];
  } catch (_) {
    _STUDIO_RECAPS = [];
  }
  return _STUDIO_RECAPS;
}

async function loadProjectFinance() {
  try {
    _PROJECT_FINANCE = await getJSON(`${DATA}/project-finance.json?v=${Date.now()}`);
    return (_PROJECT_FINANCE && typeof _PROJECT_FINANCE === "object") ? _PROJECT_FINANCE : {};
  } catch (_) {
    return {};
  }
}

async function loadNewsPeople() {
  if (_NEWS_PEOPLE) return _NEWS_PEOPLE;
  try { _NEWS_PEOPLE = await getJSON(`${DATA}/news-people.json`); } catch (e) { _NEWS_PEOPLE = { figures: [], fields: {} }; }
  return _NEWS_PEOPLE;
}



let _PERSON_DIRECTORY_PROMISE=null;
async function loadPersonDirectory(){
  if(_PERSON_DIRECTORY_PROMISE)return _PERSON_DIRECTORY_PROMISE;
  _PERSON_DIRECTORY_PROMISE=Promise.all([loadFigures(),loadCanonicalEntities(),getJSON(DATA+"/people-index.json?v=person1",30000).catch(()=>({people:[]}))]).then(([figures,registry,index])=>{
    const rows=new Map(),handles=new Map();
    for(const entity of registry.entities||[]){
      if(entity.type!=="person")continue;
      const stub=_personFigureRecord(entity,null);rows.set(entity.id,stub);handles.set(stub.handle,entity.id);
      for(const ref of entity.refs||[])if(ref.dataset==="figures")handles.set(String(ref.key),entity.id);
    }
    for(const row of index.people||[]){
      const old=rows.get(row.id)||{};
      rows.set(row.id,{...old,...row,canonical_id:row.id,field:"culture",field_fa:"فرهنگ و هنر",posts:old.posts||[],social:old.social||[],directory:old.directory!==false});
      handles.set(row.handle,row.id);
    }
    for(const figure of figures.figures||[]){
      const id=handles.get(figure.handle)||figure.canonical_id||"figure:"+figure.handle;
      const old=rows.get(id)||{};rows.set(id,{...old,...figure,canonical_id:id.startsWith("figure:")?null:id,aliases:[...new Set([...(old.aliases||[]),...(figure.aliases||[])])]});
    }
    return [...rows.values()].filter(x=>x.directory!==false);
  });
  return _PERSON_DIRECTORY_PROMISE;
}
function _personFigureRecord(entity,base){
  const meta=entity?.meta||{},handle=entity?.routes?.figure||String(entity?.id||"").replace(/^person:/,"");
  const social=[...(base?.social||[])];
  for(const link of meta.social||[])if(!social.some(x=>x.url===link.url))social.push(link);
  if(meta.tmdb_id&&!social.some(x=>String(x.url).includes("themoviedb.org/person/")))social.push({kind:"website",label:"TMDB",url:"https://www.themoviedb.org/person/"+meta.tmdb_id});
  return {...meta,...(base||{}),handle:base?.handle||handle,profile_handle:base?.handle||"",canonical_id:entity?.id,name_fa:base?.name_fa||entity?.name_fa||"",aliases:[...new Set([...(entity?.aliases||[]),...(base?.aliases||[])])],role_fa:base?.role_fa||meta.role_fa||"",avatar:base?.avatar||meta.avatar||"",posts:base?.posts||[],social,directory:base?.directory!==false,verified:base?.verified||meta.verified||false,claimed:base?.claimed||meta.claimed||false};
}
