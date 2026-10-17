/* Pendar Iran scenario dossier: linked evidence, attributed opinions, chronological archive.
   A topic match is not corroboration. Never synthesize statements absent from sources. */
(function () {
  "use strict";
  const familyKey=document.body.dataset.family||"";
  const subKey=document.body.dataset.scenario||"";
  const root=document.getElementById("scenario-content");
  const status=document.getElementById("status");
  let catalog=null,base=[],edge=[],news=[],figures=[],meta={},filterText="",limit=35,lastVersion="";
  let family=null,sub=null;
  const safePath=/^\/(?:story\/[a-zA-Z0-9-]+\/|@[a-zA-Z0-9_-]+\/?|radar\/iran-scenarios\/[a-zA-Z0-9_-]+\/(?:[a-zA-Z0-9_-]+\/)?)$/;
  const norm=s=>String(s||"").replace(/[ي]/g,"ی").replace(/[ك]/g,"ک").replace(/[\u200c\u200f]/g," ").replace(/\s+/g," ").trim().toLowerCase();
  const has=(hay,needle)=>norm(hay).includes(norm(needle));
  const node=(tag,className,txt)=>{
    const e=document.createElement(tag);
    if(className)e.className=className;
    if(txt!==undefined&&txt!==null)e.textContent=String(txt);
    return e;
  };
  const link=(text,href,className)=>{
    const url=String(href||"");
    const safe=(url.startsWith("https://")&&/^https:\/\/[^\/\s@]+(?:\/[^\s]*)?$/.test(url))||safePath.test(url);
    if(!safe)return node("span",className||"",text);
    const a=node("a",className||"",text);a.href=url;
    if(url.startsWith("https://")){a.target="_blank";a.rel="noopener noreferrer";}
    return a;
  };
  const section=(parent,title,subtitle)=>{
    const s=node("section","panel");s.append(node("h2","",title));
    if(subtitle)s.append(node("p","muted",subtitle));
    parent.append(s);return s;
  };
  const fmt=d=>{
    if(!d)return "بدون تاریخ";
    try{let t=new Date(d);return isNaN(t.getTime())?String(d).slice(0,10):t.toLocaleDateString("fa-IR",{year:"numeric",month:"long",day:"numeric"});}
    catch(_){return String(d).slice(0,10);}
  };
  const fmKey=f=>"/radar/iran-scenarios/"+f+"/";
  const subUrl=s=>fmKey(s.family)+s.slug+"/";
  const profile=name=>{
    const key=norm(name);
    if(!key)return "";
    const curated=(catalog?.people||[]).find(x=>norm(x.name)===key);
    if(curated)return "/@"+curated.handle+"/";
    const stored=figures.find(x=>norm(x.name_fa)===key);
    return stored?.handle?"/@"+stored.handle+"/":"";
  };
  const speakerHref=row=>{
    const direct=String(row.speaker_url||"");
    if(direct&&safePath.test(direct))return direct;
    return profile(row.speaker);
  };
  const signalId=x=>String(x.id||"").replace(/[^A-Za-z0-9_-]/g,"");
  const matchesSub=(row,s)=>{
    const text=[row.text,row.summary_fa,row.headline_fa,row.title_fa,row.title,row.topic_fa].join(" ");
    return s.match_terms.some(t=>has(text,t));
  };
  const candidates=()=>{
    const map=new Map();
    base.concat(edge).forEach(x=>{if(x&&x.id&&x.family===familyKey)map.set(String(x.id),x);});
    return [...map.values()].sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  };
  const sameTopic=row=>!sub||matchesSub(row,sub);
  const citeBox=(parent,refs)=>{
    const box=node("div","links"),seen=new Set();
    (refs||[]).forEach(r=>{
      const url=r.url||"";
      if(!url||seen.has(url))return;
      seen.add(url);const a=link((r.label||"مشاهدهٔ سند")+" ↗",url);
      if(a.tagName==="A")box.append(a);
    });
    if(box.children.length)parent.append(box);
  };
  const rowCard=(parent,row,bucket)=>{
    const x=node("article","entry");x.id="signal-"+signalId(row);
    const head=node("div","row");
    head.append(node("span","pill",row.date||fmt(row.published_at)));
    if(row.source_type)head.append(node("span","pill",row.source_type==="story"?"خبر":"دیدگاه / گفته"));
    const pts=(Number(row.direction)||0)*(Number(row.weight)||1);
    if(row.by==="pendar-auto")head.append(node("span","pill",pts>0?"تقویت +"+pts:pts<0?"تضعیف "+pts:"بدون امتیاز"));
    if(bucket)head.append(node("span","pill",bucket));
    x.append(head);
    const speaker=row.speaker||"";
    if(speaker){const by=node("div","row");by.append(node("span","muted","گوینده: "),link(speaker,speakerHref(row),"person"));
      if(row.speaker_role)by.append(node("small","",row.speaker_role));x.append(by);}
    const p=node("p","",row.text||"");x.append(p);
    if(Array.isArray(row.related_people)&&row.related_people.length){
      const people=node("div","");
      row.related_people.forEach(person=>{
        const q=node("div","note");q.append(link(person.name,profile(person.name),"person"));
        q.append(node("span","",": "+(person.statement||"دیدگاه در این خبر ثبت شده")));
        if(person.source_url)q.append(node("span","", " · "),link("استناد ↗",person.source_url));
        people.append(q);
      });
      x.append(people);
    }
    if(row.evidence_phrase)x.append(node("p","muted","عبارت تشخیص‌داده‌شده: «"+row.evidence_phrase+"»"));
    if(row.score_kind==="capped")x.append(node("p","muted","بدون امتیاز به‌علت سقف روزانه؛ مشاهده همچنان در آرشیو حفظ شده است."));
    else if(row.score_reason)x.append(node("p","muted","دلیل امتیازدهی: "+row.score_reason));
    if(row.uncertainty)x.append(node("p","muted","ابهام ثبت‌شده: "+row.uncertainty));
    if(row.source)x.append(node("p","muted","ثبت/ناشر: "+row.source));
    const refs=(Array.isArray(row.source_links)?row.source_links:[]).slice();
    if(!refs.length&&row.source_url)refs.push({label:"منبع ثبت‌شده",url:row.source_url});
    citeBox(x,refs);
    if(!refs.length)x.append(node("small","","پیوند سند اصلی در دادهٔ تاریخی ثبت نشده؛ از این مدخل نمی‌توان تأیید مستقل برداشت کرد."));
    parent.append(x);
  };
  const showRows=(parent,rows,tag)=>{
    if(!rows.length){parent.append(node("div","empty","هنوز مورد مستند مرتبطی در دادهٔ منتشرشده ثبت نشده است."));return;}
    const list=node("div","");
    const subset=rows.filter(x=>!filterText||has([x.text,x.speaker,x.source,x.score_reason].join(" "),filterText));
    subset.slice(0,limit).forEach(x=>rowCard(list,x,tag));parent.append(list);
    if(subset.length>limit){const b=node("button","","نمایش موارد بیشتر ("+(subset.length-limit)+")");b.addEventListener("click",()=>{limit+=40;render();});parent.append(b);}
  };
  const figureArchive=()=>{
    const seen=new Set();
    const items=[];
    figures.forEach(f=>{
      if(!f||!Array.isArray(f.posts))return;
      f.posts.forEach(p=>{
        if(!p||!["analysis","party_claim"].includes(p.kind||""))return;
        const url=String(p.url||p.article_url||"");
        const text=[p.topic_fa,p.summary_fa,p.quote_fa,p.statement_fa].join(" ");
        if(!text.trim())return;
        if(sub&&!matchesSub({text:text},sub))return;
        if(!sub){
          const re={
            deal:/مذاکر|آتش.?بس|توافق|دیپلماسی/,
            regroup:/بازداشت|سرکوب|انقباض|قلعه خاموش/,
            war:/جنگ|بمباران|حمله|درگیری|موشک/,
            transition:/گذار|سقوط|فروپاشی|انتقال قدرت/,
            attrition:/تحریم|تورم|ریال|فرسایش|بن بست/,
            recovery:/چین|روسیه|وام|پساترامپ|بازیابی/
          }[familyKey];
          if(!re||!re.test(norm(text))||!has(text,"ایران")&&!has(text,"تهران")&&!sub) return;
        }
        const id=url||String(p.id||"");
        if(!id||seen.has(id))return;
        seen.add(id);
        items.push({speaker:f.name_fa||p.name_fa||"",handle:f.handle||"",
          role:f.role_fa||"",text:p.summary_fa||p.statement_fa||p.topic_fa||"",
          title:p.topic_fa||"",published:p.published_at||p.recorded_at||"",
          url:url,source:p.source_name||p.platform||"چهره‌های پندار"});
      });
    });
    return items.sort((a,b)=>String(b.published||"").localeCompare(String(a.published||"")));
  };
  const drawFigurePost=(container,item)=>{
    const e=node("article","entry");
    e.append(node("small","",fmt(item.published)));
    const h=node("div","row");
    h.append(link(item.speaker,"/@" + item.handle+"/","person"));
    if(item.title)h.append(node("span","pill",item.title));
    e.append(h);
    e.append(node("p","",String(item.text).slice(0,1200)));
    e.append(node("small","", "منبع درج‌شده: "+item.source+" · تطبیق موضوعی؛ نه الزاماً تأیید سناریو"));
    if(item.url)e.append(node("div","links")).append(link("مشاهدهٔ متن یا ویدئوی اصلی ↗",item.url));
    else e.append(node("small","","لینک مدرک اولیه ثبت نشده؛ انتساب نیازمند بررسی است."));
    container.append(e);
  };
  const newsUrl=item=>{
    const id=String(item.id||"");
    return /^[a-f0-9-]{8,64}$/i.test(id)?"/story/"+id+"/":"";
  };
  const relatedNews=()=>{
    const savedIds=new Set(candidates().map(x=>String(x.source_doc_id||"")));
    return news.filter(n=>{
      if(!n||savedIds.has(String(n.id||"")))return false;
      const summary=[n.headline_fa,n.summary_fa,n.title,n.title_fa].join(" ");
      if(!has(summary,"ایران")&&!has(summary,"تهران")&&!has(summary,"جمهوری اسلامی"))return false;
      if(sub)return matchesSub({text:summary},sub);
      const re={
        deal:/مذاکر|آتش.?بس|توافق|دیپلماسی|ترک مخاصمه/,
        regroup:/بازداشت|سرکوب|انقباض|محدودیت|تصفیه/,
        war:/جنگ|بمباران|حمله|درگیری|موشک/,
        transition:/گذار|سقوط|فروپاشی|انتقال قدرت|دولت موقت/,
        attrition:/تحریم|تورم|ریال|فرسایش|رکود|بحران اقتصاد/,
        recovery:/چین|روسیه|وام|سرمایه.?گذاری|بازیابی/
      }[familyKey];
      return re&&re.test(norm(summary));
    }).sort((a,b)=>String(b.published_at||"").localeCompare(String(a.published_at||"")));
  };
  function render(){
    if(!catalog||!family)return;
    root.replaceChildren();
    const records=candidates(),target=records.filter(sameTopic);
    const metrics=section(root,"رصد و امتیازهای ثبت‌شده","شاخص‌ها حاصل جمع سیگنال‌اند، نه احتمال وقوع. برای پروندهٔ جزئی، امتیاز خانواده به آن زیرسناریو تعمیم داده نمی‌شود.");
    const m=node("div","row");
    const allVal=records.reduce((n,x)=>n+(Number(x.direction)||0)*(Number(x.weight)||1),0);
    const value=(v,t)=>m.append(node("div","stat",t+": "+v));
    if(sub){value(target.length,"سیگنالِ منطبق با موضوع");value(records.length,"آرشیو خانواده");}
    else{value(records.length,"سیگنال ثبت‌شده");value((allVal>0?"+":"")+allVal,"شاخص تجمعی خانواده");}
    if(meta.generated_at)m.append(node("small","", "آخرین تولید داده: "+fmt(meta.generated_at)));
    metrics.append(m);
    if(sub){
      const about=section(root,"مطرح‌کنندهٔ ثبت‌شده در طبقه‌بندی اولیه","این انتساب، برچسب نقشهٔ سناریوهاست؛ تنها گفته‌های تاریخ‌دار و مستند پایین، مدرک مستقیم اظهارنظر محسوب می‌شوند.");
      const p=node("div","tile");p.append(link(sub.proponent.name,"/@" + sub.proponent.handle+"/","person"));
      p.append(node("p","",sub.description));p.append(node("small","",sub.attribution_note));about.append(p);
    }
    const children=section(root,sub?"زیرسناریوهای دیگر این خانواده":"سناریوهای جزئی و صاحبان دیدگاه",
      "هر نامِ چهره به پروفایل او و هر عنوان به پروندهٔ همان سناریو می‌رود.");
    const grid=node("div","grid");
    catalog.scenarios.filter(s=>s.family===familyKey&&(!sub||s.slug!==sub.slug)).forEach(s=>{
      const card=node("article","tile");const h=node("h3","");h.append(link(s.title,subUrl(s)));card.append(h);
      card.append(node("p","",s.description));card.append(node("div","row"));
      card.lastChild.append(node("span","muted","مطرح‌کننده: "),link(s.proponent.name,"/@" + s.proponent.handle+"/","person"));
      grid.append(card);
    });children.append(grid);
    if(sub){
      const primary=target.filter(x=>norm(x.speaker)===norm(sub.proponent.name));
      const other=target.filter(x=>x.speaker&&norm(x.speaker)!==norm(sub.proponent.name));
      const statements=section(root,"گفته‌های مرتبطِ مطرح‌کننده","فقط مدخل‌های موجود در آرشیو که با موضوع زیرسناریو تطبیق دارند؛ تاریخ و استناد هر مورد مشخص است.");
      showRows(statements,primary,"دیدگاه مرتبط");
      const comparable=section(root,"دیدگاه‌های مشابه یا متفاوتِ دیگران","ارتباط واژگانی یا موضوعی است؛ موافقت، مخالفت یا تأیید مستقل از این ارتباط نتیجه نمی‌شود.");
      showRows(comparable,other,"نظر دیگران");
    }else{
      const voices=section(root,"دیدگاه‌های منتسب به تحلیل‌گران","اظهارنظرها با لینک فرد و سند اصلی از وقایع خبری جدا نگهداری می‌شوند.");
      showRows(voices,target.filter(x=>x.speaker),"دیدگاه");
    }
    const archive=section(root,sub?"آرشیو سیگنال‌های منطبق با زیرسناریو":"آرشیو تازه‌ترین خبرها و سیگنال‌های سناریو",
      "به‌ترتیب زمان؛ موارد خنثی یا راستی‌آزمایی‌نشده نیز با همان برچسب حفظ شده‌اند.");
    const control=node("div","row");const input=node("input");
    input.type="search";input.placeholder="جست‌وجو در متن، نام شخص، منبع…";input.value=filterText;
    input.addEventListener("change",()=>{filterText=input.value;limit=35;render();});
    const search=node("button","","جست‌وجو");search.addEventListener("click",()=>{filterText=input.value;limit=35;render();});
    control.append(input,search);archive.append(control);
    showRows(archive,target,"سیگنال");
    if(sub){
      const broader=section(root,"سایر شواهد و رخدادهای خانوادهٔ سناریو","این مطالب مربوط به خانوادهٔ کلان‌اند و به‌تنهایی شاهد اختصاصی تأیید زیرسناریوی انتخاب‌شده نیستند.");
      showRows(broader,records.filter(x=>!sameTopic(x)).slice(0,70),"زمینهٔ مرتبط");
    }
    const posts=figureArchive();
    const authorPosts=sub?posts.filter(p=>norm(p.speaker)===norm(sub.proponent.name)):posts;
    const archived=section(root,sub?"آرشیو گفتار و ویدئوهای مرتبطِ مطرح‌کننده":"آرشیو موضوعی گفته‌های چهره‌ها",
      "مطالب مستقیماً از پروفایل‌های منتشرشدهٔ پندار استخراج می‌شوند. شباهت موضوعی به معنی تأیید یا پیش‌بینی وقوع نیست.");
    if(!authorPosts.length)archived.append(node("div","empty","گفته یا ویدئوی منطبق با این موضوع در آرشیو پروفایل‌ها پیدا نشد."));
    authorPosts.slice(0,35).forEach(p=>drawFigurePost(archived,p));
    if(sub){
      const peerPosts=posts.filter(p=>norm(p.speaker)!==norm(sub.proponent.name));
      const peers=section(root,"گفتار موضوعاً مشابهِ دیگر تحلیل‌گران","این افراد الزاماً موافق مطرح‌کننده نیستند؛ متن و استناد هر شخص را جداگانه بررسی کنید.");
      if(!peerPosts.length)peers.append(node("div","empty","گفتار دیگری با تطبیق متنی مشخص پیدا نشد."));
      peerPosts.slice(0,35).forEach(p=>drawFigurePost(peers,p));
    }
    const headlines=relatedNews();
    const newsSection=section(root,"آخرین خبرهای مرتبط از سرخط پندار",
      "فقط پیوند موضوعیِ عنوان و خلاصه؛ برای مشاهدهٔ منابع و شواهد اصلی، پروندهٔ هر خبر را باز کنید.");
    if(!headlines.length)newsSection.append(node("div","empty","خبر دیگری با تطبیق موضوعی در فهرست موجود پیدا نشد."));
    headlines.slice(0,45).forEach(article=>{
      const e=node("article","entry");
      e.append(node("small","",fmt(article.published_at)));
      const h=node("h3","");h.append(link(article.headline_fa||article.title_fa||article.title||"خبر",newsUrl(article)));
      e.append(h);
      const p=node("p","",String(article.summary_fa||"").slice(0,260));e.append(p);
      e.append(node("small","","ارتباط موضوعی؛ نه تأیید وقوع سناریو"));
      newsSection.append(e);
    });
    const all=section(root,"رفتن به سناریوهای دیگر","فهرست همهٔ خانواده‌ها، با پرونده‌های مستقل و آرشیوهای قابل مشاهده.");
    const nav=node("div","row");
    catalog.families.forEach(f=>nav.append(link(f.title+" ↗",fmKey(f.key),"pill")));
    all.append(nav);
    status.textContent="نمایش "+target.length+" مدخل منطبق از "+records.length+" مدخل خانواده · به‌روزرسانی دوره‌ای از دادهٔ منتشرشده";
  }
  async function getJSON(path){
    const r=await fetch(path+(path.includes("?")?"&":"?")+"v="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw Error("HTTP "+r.status);
    return r.json();
  }
  async function refresh(){
    if(!catalog){
      catalog=await getJSON("/data/iran-scenario-catalog.json");
      family=(catalog.families||[]).find(x=>x.key===familyKey);
      sub=(catalog.scenarios||[]).find(x=>x.family===familyKey&&x.slug===subKey);
      if(!family||(subKey&&!sub))throw Error("پروندهٔ درخواستی یافت نشد");
    }
    const results=await Promise.allSettled([
      getJSON("/data/iran-scenario-signals.json"),
      getJSON("/data/iran-scenario-meta.json"),
      getJSON("/data/stories.json"),
      getJSON("/data/figures.json")
    ]);
    if(results[0].status==="fulfilled"&&Array.isArray(results[0].value))base=results[0].value;
    if(results[1].status==="fulfilled")meta=results[1].value||{};
    if(results[2].status==="fulfilled"&&Array.isArray(results[2].value))news=results[2].value;
    if(results[3].status==="fulfilled")figures=results[3].value?.figures||[];
    // Optional event-driven edge uses the same upstream state as the radar.
    // Missing edge or invalid configuration keeps published evidence visible.
    try{
      if(!window._scenarioEdgeOrigin){
        const config=await getJSON("/data/iran-scenario-live-config.json");
        const u=new URL(String(config.origin||""));
        if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/")throw Error("edge unavailable");
        window._scenarioEdgeOrigin=u.origin;
      }
      const state=await getJSON(window._scenarioEdgeOrigin+"/v1/state");
      if(Array.isArray(state.signals))edge=state.signals;
    }catch(_){}
    render();
  }
  async function start(){
    try{await refresh();}
    catch(e){status.textContent="داده‌های آنلاین فعلاً قابل بارگذاری نیستند؛ توضیح سناریو و لینک‌های ثابت همچنان در دسترس‌اند.";}
  }
  start();
  setInterval(()=>{if(document.visibilityState!=="hidden")refresh().catch(()=>{});},60000);
})();
