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

const _US_RADAR_FIGURE_FALLBACKS = [
  {
    "handle": "adam-hamilton",
    "name_fa": "آدام همیلتون",
    "name": "Adam Hamilton",
    "role_fa": "نامزد دموکرات سنای کانزاس",
    "avatar": "https://www.pollsmax.com/images/ks-s-d.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Adam Hamilton"
    ],
    "us_radar": {
      "state": "KS",
      "party": "D",
      "race": "senate-2026"
    }
  },
  {
    "handle": "roger-marshall",
    "name_fa": "راجر مارشال",
    "name": "Roger Marshall",
    "role_fa": "سناتور جمهوری‌خواه کانزاس",
    "avatar": "https://npr.brightspotcdn.com/dims4/default/845620d/2147483647/strip/true/crop/2048x2048%2B0%2B0/resize/880x880%21/quality/90/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2F0f%2F07%2F0d8196124de29553c45165d8600f%2Fmarshall.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Roger Marshall"
    ],
    "us_radar": {
      "state": "KS",
      "party": "R",
      "race": "senate-2026"
    }
  },
  {
    "handle": "chris-pappas",
    "name_fa": "کریس پاپاس",
    "name": "Chris Pappas",
    "role_fa": "نماینده کنگره و نامزد دموکرات سنای نیوهمپشایر",
    "avatar": "https://snworksceo.imgix.net/tnh/cbab7fa1-f412-4d1e-8590-c950b58b00c8.sized-1000x1000.png?w=1000",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Chris Pappas"
    ],
    "us_radar": {
      "state": "NH",
      "party": "D",
      "race": "senate-2026"
    }
  },
  {
    "handle": "john-sununu",
    "name_fa": "جان ای. سانونو",
    "name": "John E. Sununu",
    "role_fa": "سناتور سابق و نامزد جمهوری‌خواه نیوهمپشایر",
    "avatar": "https://upload.wikimedia.org/wikipedia/commons/a/a3/John_E._Sununu.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "John E. Sununu"
    ],
    "us_radar": {
      "state": "NH",
      "party": "R",
      "race": "senate-2026"
    }
  },
  {
    "handle": "roy-cooper",
    "name_fa": "روی کوپر",
    "name": "Roy Cooper",
    "role_fa": "فرماندار سابق و نامزد دموکرات سنای کارولینای شمالی",
    "avatar": "https://cdnph.upi.com/sv/ph/og/upi_com/6301490975665/2017/1/33a9851c9e336d73651c41c3c4dbe7da/v1.5/NCAA-to-review-bathroom-bill-repeal-before-deciding-on-North-Carolina-return.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Roy Cooper"
    ],
    "us_radar": {
      "state": "NC",
      "party": "D",
      "race": "senate-2026"
    }
  },
  {
    "handle": "michael-whatley",
    "name_fa": "مایکل واتلی",
    "name": "Michael Whatley",
    "role_fa": "نامزد جمهوری‌خواه سنای کارولینای شمالی",
    "avatar": "https://pbs.twimg.com/profile_images/1952845503797846018/cEfkmtI5_400x400.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Michael Whatley"
    ],
    "us_radar": {
      "state": "NC",
      "party": "R",
      "race": "senate-2026"
    }
  },
  {
    "handle": "james-talarico",
    "name_fa": "جیمز تالاریکو",
    "name": "James Talarico",
    "role_fa": "نماینده ایالتی و نامزد دموکرات سنای تگزاس",
    "avatar": "https://commons.wikimedia.org/wiki/Special:Redirect/file/James_Talarico_Open_Congress_Austin_2023.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "James Talarico"
    ],
    "us_radar": {
      "state": "TX",
      "party": "D",
      "race": "senate-2026"
    }
  },
  {
    "handle": "ken-paxton",
    "name_fa": "کن پکستون",
    "name": "Ken Paxton",
    "role_fa": "دادستان کل و نامزد جمهوری‌خواه سنای تگزاس",
    "avatar": "https://polymarket-upload.s3.us-east-2.amazonaws.com/will-ken-paxton-drop-out-w53eq7Ql8un2.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Ken Paxton"
    ],
    "us_radar": {
      "state": "TX",
      "party": "R",
      "race": "senate-2026"
    }
  },
  {
    "handle": "abdul-el-sayed",
    "name_fa": "عبدال السید",
    "name": "Abdul El-Sayed",
    "role_fa": "نامزد دموکرات سنای میشیگان",
    "avatar": "https://www.thejerseycourier.com/_next/image?q=75&url=https%3A%2F%2Fbpuok1c1rkjq2y9e.public.blob.vercel-storage.com%2Fnewsroom%2Fcae9e4f5-eebf-479f-a1eb-fee66762aa5f-Mask-Group.png&w=750",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Abdul El-Sayed"
    ],
    "us_radar": {
      "state": "MI",
      "party": "D",
      "race": "senate-2026"
    }
  },
  {
    "handle": "mike-rogers",
    "name_fa": "مایک راجرز",
    "name": "Mike Rogers",
    "role_fa": "نماینده سابق و نامزد جمهوری‌خواه سنای میشیگان",
    "avatar": "https://library.oakland.edu/MikeRogers/images/Official%20MR%20photo.jpg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Mike Rogers"
    ],
    "us_radar": {
      "state": "MI",
      "party": "R",
      "race": "senate-2026"
    }
  },
  {
    "handle": "sherrod-brown",
    "name_fa": "شرود براون",
    "name": "Sherrod Brown",
    "role_fa": "سناتور سابق و نامزد دموکرات سنای اوهایو",
    "avatar": "https://iop.harvard.edu/sites/default/files/styles/1_1_540w/public/media/image/Sherrod%20Brown.jpeg?itok=dlFSA6Rg",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Sherrod Brown"
    ],
    "us_radar": {
      "state": "OH",
      "party": "D",
      "race": "senate-2026"
    }
  },
  {
    "handle": "jon-husted",
    "name_fa": "جان هاستد",
    "name": "Jon Husted",
    "role_fa": "سناتور جمهوری‌خواه اوهایو",
    "avatar": "https://files.constantcontact.com/6c8b7138001/1606641d-ba36-4616-b27a-06c0d4a7be9a.jpg?rdr=true",
    "field": "us-politics",
    "field_fa": "سیاست آمریکا",
    "gender": "",
    "external": true,
    "count": 0,
    "posts": [],
    "aliases": [
      "Jon Husted"
    ],
    "us_radar": {
      "state": "OH",
      "party": "R",
      "race": "senate-2026"
    }
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
  for (const fallback of _US_RADAR_FIGURE_FALLBACKS) {
    if (!_FIG.figures.some(f => String(f.handle||"").toLowerCase() === fallback.handle)) _FIG.figures.push(fallback);
  }
  // Keep the selected portrait visible until the next dataset rebuild.
  for (const figure of _FIG.figures) {
    if (String(figure.handle || "").toLowerCase() === "donald-trump") {
      figure.avatar = "https://encrypted-tbn0.gstatic.com/licensed-image?q=tbn:ANd9GcTZkCFGyioBQXspTYONjbClEc1qCWhVPg832Ivxb_UFqgEb5xhpb1zbzgSVGjwrMjw3kGtPVA7xMtYN7NOUJOoqDHwd9Fu0zAy7RYjui5MMEh-BAGlr94I4E8ESQBJ5VYD740kLc_Gg&s=19";
      for (const post of figure.posts || []) post.avatar = figure.avatar;
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
  return {...meta,...(base||{}),handle:base?.handle||handle,profile_handle:base?.handle||"",canonical_id:entity?.id,name_fa:base?.name_fa||entity?.name_fa||"",aliases:[...new Set([...(entity?.aliases||[]),...(base?.aliases||[])])],role_fa:base?.role_fa||meta.role_fa||(entity?.roles||[]).map(r=>({book_person:"پدیدآورندهٔ کتاب",actor:"بازیگر",director:"کارگردان"}[r]||(/[\u0600-\u06ff]/.test(r)?r:""))).filter(Boolean).join("، "),avatar:base?.avatar||meta.avatar||"",posts:base?.posts||[],social,directory:base?.directory!==false,verified:base?.verified||meta.verified||false,claimed:base?.claimed||meta.claimed||false};
}
