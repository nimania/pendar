/* Central Pendar reports library: sourced published article records only. */
let _pendarReports=[];
let _pendarReportFilter="all";
let _pendarReportQuery="";
let _pendarReportCatalog=null;
const PENDAR_REPORT_UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function pendarEditorialArchiveItem(row){
  return pendarMagazineReportCard(row,{showAuthor:true});
}
async function loadPendarEditorialArchive(){
  try{
    const data=await getJSON(DATA+"/editorial-archive.json");
    if(Array.isArray(data?.reports)){
      return data.reports.filter(row=>PENDAR_REPORT_UUID.test(String(row?.id||""))&&row.status==="ai_draft");
    }
  }catch(_){}
  // Backward compatibility before the next validated archive export.
  const [cards,groups]=await Promise.all([
    getJSON(DATA+"/stories.json").catch(()=>[]),
    getJSON(DATA+"/press-source-stories.json").catch(()=>({}))
  ]);
  const result=new Map();
  for(const row of [...(Array.isArray(cards)?cards:[]),...Object.values(groups||{}).flatMap(x=>Array.isArray(x)?x:[])]){
    if(!row?.has_editorial_report||!PENDAR_REPORT_UUID.test(String(row.id)))continue;
    result.set(row.id,{id:row.id,author_id:pendarEditorialAuthorId(row),
      title_fa:row.editorial_report_title_fa||row.headline_fa,
      headline_fa:row.headline_fa,published_at:row.published_at,
      status:"ai_draft"});
  }
  return [...result.values()];
}
function filterPendarEditorialArchive(authorId){
  _pendarReportFilter=authorId;
  document.querySelectorAll("#editorial-archive-view [data-report-author]").forEach(button=>{
    const active=button.dataset.reportAuthor===authorId;
    button.classList.toggle("on",active);
    button.setAttribute("aria-pressed",String(active));
  });
  renderPendarEditorialArchiveItems();
}
function searchPendarEditorialArchive(text){
  _pendarReportQuery=String(text||"").trim().toLocaleLowerCase("fa");
  renderPendarEditorialArchiveItems();
}
function renderPendarEditorialArchiveItems(){
  const host=document.getElementById("editorial-library-list");
  if(!host)return;
  const visible=_pendarReports.filter(row=>{
    const author=row.author_id||pendarEditorialAuthorId(row);
    const matchAuthor=_pendarReportFilter==="all"||author===_pendarReportFilter;
    const blob=[row.title_fa,row.headline_fa,row.lead_fa,pendarAuthorName(author)].join(" ").toLocaleLowerCase("fa");
    return matchAuthor && (!_pendarReportQuery||blob.includes(_pendarReportQuery));
  });
  host.innerHTML=visible.map(pendarEditorialArchiveItem).join("")
    || '<div class="editorial-library-empty">برای این فیلتر هنوز گزارش منتشرشده‌ای وجود ندارد.</div>';
  const counter=document.getElementById("editorial-library-count");
  if(counter)counter.textContent=faN(visible.length)+" گزارش";
}
async function showPendarEditorialArchive(){
  show("editorialarchive");setTab("");setHash("#/reports");
  const host=document.getElementById("editorial-archive-view");
  host.innerHTML='<div class="spinner"></div>';
  try{
    const [directory,reports,news]=await Promise.all([
      loadPendarEditorialAuthors(),loadPendarEditorialArchive(),
      getJSON(DATA+"/stories.json").catch(()=>[])
    ]);
    // Prefer photographs attached to the SAME report, never a stock image.
    const newsImages=new Map((Array.isArray(news)?news:[])
      .filter(x=>x?.id&&x?.image_url).map(x=>[x.id,x.image_url]));
    for(const row of reports){
      if(!row.image_url&&newsImages.has(row.id))row.image_url=newsImages.get(row.id);
    }
    _pendarReportCatalog=directory;
    _pendarReports=reports.sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
    const counts=Object.fromEntries(directory.authors.map(a=>[a.id,0]));
    for(const item of reports)if(item.author_id in counts)counts[item.author_id]++;
    _pendarReportFilter="all";_pendarReportQuery="";
    const chips=directory.authors.map(a=>{
      return '<button type="button" class="editorial-library-filter" data-report-author="'+esc(a.id)+'" aria-pressed="false" onclick="filterPendarEditorialArchive(\''+esc(a.id)+'\')">'
        +esc(a.display_name_fa)+' <small>'+faN(counts[a.id])+'</small></button>';
    }).join("");
    host.innerHTML=pendarMagazineCollectionFrame(
      '<header class="editorial-library-header">'
      +'<div class="editorial-library-eyebrow">تحریریهٔ پندار / آرشیو</div>'
      +'<h1>گزارش‌های پندار</h1>'
      +'<p>روایت‌های مستند و گزارش‌های تحریریه؛ بخوانید، جست‌وجو کنید و نویسنده‌های هر مطلب را دنبال کنید.</p>'
      +'</header><div class="editorial-library-controls">'
      +'<div class="editorial-library-filters" aria-label="فیلتر نویسنده"><button type="button" class="editorial-library-filter on" aria-pressed="true" data-report-author="all" onclick="filterPendarEditorialArchive(\'all\')">همه <small>'+faN(reports.length)+'</small></button>'
      +chips+'</div>'
      +'<div class="editorial-library-search-row"><label for="editorial-library-search">جست‌وجو در گزارش‌ها</label>'
      +'<input id="editorial-library-search" type="search" placeholder="عنوان، موضوع یا نویسنده" oninput="searchPendarEditorialArchive(this.value)">'
      +'<span id="editorial-library-count" aria-live="polite"></span></div></div>'
      +'<section id="editorial-library-list" class="editorial-library-list" aria-label="آرشیو گزارش‌ها"></section>'
    );
    renderPendarEditorialArchiveItems();
    document.title="گزارش‌های پندار | آرشیو تحریریه";
  }catch(_){
    host.innerHTML='<p class="editorial-library-empty">در حال حاضر آرشیو گزارش‌ها در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.</p>';
  }
}
