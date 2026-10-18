/* Pendar Heritage Preview: isolated reader and magazine frontend.
   No production app state changes. Only public, existing Pendar data is used. */
(function(){
  "use strict";
  var UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  var mountRoot=document;
  var el=function(id){return mountRoot.getElementById(id);};
  var esc=function(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});};
  var norm=function(value){return String(value==null?"":value).replace(/\s+/g," ").trim();};
  var excerpt=function(value,limit){
    var text=norm(value), n=limit||145;
    if(text.length<=n)return text;
    var clip=text.slice(0,n),stop=Math.max(clip.lastIndexOf("،"),clip.lastIndexOf("؛"),clip.lastIndexOf(" "),clip.lastIndexOf("."));
    return clip.slice(0,stop>n*.58?stop:n).replace(/[\s،؛.]+$/,"")+"…";
  };
  var validImage=function(url){
    var s=String(url||"").trim();
    return (/^https?:\/\/[^\s"<>]+$/i.test(s)||/^\/(?!\/)[^\s"<>]+$/.test(s)||/^assets\/[^\s"<>]+$/.test(s))?s:"";
  };
  var validLink=function(url){
    var s=String(url||"").trim();
    return (/^https?:\/\/[^\s"<>]+$/i.test(s)||/^\/(?!\/)[^\s"<>]+$/.test(s))?s:"";
  };
  var slugUrl=function(r){return r&&UUID.test(String(r.id||""))?(window.PENDAR_HERITAGE_EMBED?"/story/"+encodeURIComponent(r.id)+"/":"/heritage-preview.html?story="+encodeURIComponent(r.id)):"/reports/";};
  var finalStoryUrl=function(id){return UUID.test(String(id||""))?"/story/"+id+"/":"/reports/";};
  var fetchJson=async function(path){
    var response=await fetch(path,{credentials:"same-origin"});
    if(!response.ok)throw new Error("HTTP "+response.status+" "+path);
    return response.json();
  };
  var limitUnique=function(items,max){
    var seen=new Set();
    return items.filter(function(item){var id=String(item.id||"");if(!id||seen.has(id))return false;seen.add(id);return true;}).slice(0,max);
  };
  var headline=function(r){return norm(r.title_fa||r.editorial_report_title_fa||r.headline_fa||"");};
  var photo=function(r){return validImage(r.image_url||"");};
  var hook=function(r){return excerpt(r.lead_fa||r.editorial_report&&r.editorial_report.lead_fa||r.summary_fa||"",155);};
  var thumb=function(r,alt,cls){
    var url=photo(r);
    return url?'<img class="'+esc(cls||"")+'" src="'+esc(url)+'" alt="'+esc(alt||headline(r))+'" loading="lazy" referrerpolicy="no-referrer">':'<span class="empty-thumb" aria-hidden="true"></span>';
  };
  var data={stories:[],reports:[],authors:[]};
  function put(id,html){var x=el(id);if(x)x.innerHTML=html;}
  function readCard(item){
    return '<a class="story-card" href="'+esc(slugUrl(item))+'">'
      +'<span class="image-frame">'+thumb(item,headline(item),"")+'</span>'
      +'<span class="story-info"><b>'+esc(headline(item))+'</b><p>'+esc(hook(item))+'</p></span></a>';
  }
  function railRow(item,withImage){
    var h=headline(item);
    return '<a class="rail-row'+(withImage?"":" no-image")+'" href="'+esc(slugUrl(item))+'">'
      +(withImage?'<span>'+thumb(item,h,"rail-thumb")+'</span>':"")
      +'<span><span class="rail-title">'+esc(h)+'</span>'
      +(item.category?'<span class="rail-kicker">'+esc(String(item.category).slice(0,34))+'</span>':"")
      +'</span></a>';
  }
  function fallback(id,message){
    put(id,'<p class="empty-state">'+esc(message)+' <a href="/reports/" style="color:#178e99">آرشیو پندار ←</a></p>');
  }
  // The visual ticker revives the 2013 picture-and-headline rhythm without
  // inventing imagery, changing original headlines, or modifying canonical URLs.
  function shortTickerTitle(value){
    var full=norm(value).replace(/\s*[|؛]\s*.*$/,"");
    if(!full) return "";
    var words=full.split(/\s+/);
    if(words.length<=9&&full.length<=66) return full;
    var chosen=words.slice(0,9).join(" ");
    if(chosen.length>66){
      chosen=chosen.slice(0,66);
      var lastSpace=chosen.lastIndexOf(" ");
      if(lastSpace>=37) chosen=chosen.slice(0,lastSpace);
    }
    return chosen.replace(/[،:؛\s]+$/,"")+(chosen!==full?"…":"");
  }
  async function renderVisualTicker(stories){
    var candidates=stories.slice(0,16).map(function(row){return Object.assign({},row);});
    var numberOfPhotos=candidates.filter(function(r){return Boolean(photo(r));}).length;
    if(numberOfPhotos<5){
      // Some lightweight feed records omit a photograph even though their
      // full story JSON includes an image. Check only a bounded shortlist.
      var missing=candidates.filter(function(r){return !photo(r);}).slice(0,Math.min(10,5-numberOfPhotos+4));
      await Promise.all(missing.map(async function(row){
        try{
          var detail=await fetchJson("/data/story/"+encodeURIComponent(row.id)+".json");
          if(validImage(detail.image_url))row.image_url=detail.image_url;
        }catch(_){}
      }));
    }
    var illustrated=candidates.filter(function(r){return Boolean(photo(r));}).slice(0,5);
    var chosen=illustrated.concat(candidates.filter(function(r){return !illustrated.some(function(x){return x.id===r.id;});})).slice(0,5);
    chosen.sort(function(a,b){return candidates.findIndex(function(r){return r.id===a.id;})-candidates.findIndex(function(r){return r.id===b.id;});});
    put("ticker",chosen.map(function(r){
      var original=headline(r), image=photo(r), display=shortTickerTitle(original);
      return '<a class="ticker-story" href="'+esc(finalStoryUrl(r.id))+'" title="'+esc(original)+'" aria-label="'+esc(original)+'">'
        +'<span class="ticker-thumb">'+(image?'<img src="'+esc(image)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true">':'<span class="ticker-thumb-empty" aria-hidden="true">پندار</span>')+'</span>'
        +'<span class="ticker-headline">'+esc(display)+'</span></a>';
    }).join("")||'<span class="loading">فعلاً خبری برای نمایش در دسترس نیست.</span>');
  }
  function renderHome(){
    var stories=data.stories.filter(function(r){return r&&UUID.test(String(r.id||""))&&headline(r);});
    var reports=data.reports.filter(function(r){return r&&UUID.test(String(r.id||""))&&headline(r);});
    renderVisualTicker(stories);
    put("rail-news",stories.slice(0,7).map(function(r){return railRow(Object.assign({},r,{title_fa:r.headline_fa}),Boolean(photo(r)));}).join("")||'<p class="empty-state">سرخط‌ها فعلاً دریافت نشدند.</p>');
    if(!reports.length){
      put("feature-hero",'<span class="feature-picture"><span class="image-wait">پندار</span></span><span class="feature-caption"><span class="category-flag orange">گزارش‌ها</span><strong>گزارش‌های تحریریهٔ پندار</strong><span>برای خواندن گزارش‌های کامل وارد آرشیو شوید.</span></span>');
      fallback("under-hero","گزارشی برای این ویترین پیدا نشد.");
      fallback("rail-reports","آرشیو گزارش‌ها فعلاً دریافت نشد.");
    }else{
      var ranked=reports.slice().sort(function(a,b){return String(b.published_at||"").localeCompare(String(a.published_at||""));});
      var feature=ranked.slice(0,6).find(function(r){return Boolean(photo(r));})||ranked[0];
      var featured=el("feature-hero");
      featured.href=slugUrl(feature);
      featured.setAttribute("aria-label",headline(feature));
      featured.innerHTML='<span class="feature-picture">'+(photo(feature)?'<img src="'+esc(photo(feature))+'" alt="'+esc(headline(feature))+'" referrerpolicy="no-referrer">':'<span class="image-wait">پندار</span>')+'</span>'
        +'<span class="feature-caption"><span class="category-flag orange">گزارش ویژه</span><strong>'+esc(headline(feature))+'</strong><span>'+esc(hook(feature))+'</span></span>';
      var more=reports.filter(function(r){return r.id!==feature.id;});
      put("under-hero",more.slice(0,2).map(function(r){return '<a class="mini-feature" href="'+esc(slugUrl(r))+'">'+thumb(r,headline(r),"")+'<span class="caption"><strong>'+esc(headline(r))+'</strong><span>'+esc(hook(r))+'</span></span></a>';}).join("")||'<div class="empty-state">مطالب بیشتر در آرشیو گزارش‌ها</div>');
      put("rail-reports",more.slice(0,7).map(function(r){return railRow(r,Boolean(photo(r)));}).join(""));
    }
    var all=limitUnique(stories.concat(reports),80);
    var cultureWords=/فرهنگ|موسیقی|کتاب|فیلم|سریال|سینما|هنر|عکاس|معمار|تئاتر|زندگی|گردش|غذا|آشپزی|ادبی|دانش|محیط زیست|طبیعت|سلامت|ورزش/;
    var culture=all.filter(function(r){return cultureWords.test(norm(headline(r)+" "+(r.category||"")))&&photo(r);});
    if(!culture.length)culture=all.filter(function(r){return cultureWords.test(norm(headline(r)+" "+(r.category||"")));});
    put("culture-grid",culture.slice(0,6).map(readCard).join("")||'<div class="empty-state">مطالب مرتبط پس از دریافت از آرشیو نمایش داده می‌شوند. <a href="/badbadak/">دیدن بادبادک ←</a></div>');
    var visual=limitUnique(all.filter(function(r){return Boolean(photo(r));}),6);
    put("visual-grid",visual.map(function(r){
      return '<a class="visual-card" href="'+esc(slugUrl(r))+'">'+thumb(r,headline(r),"")+'<span>'+esc(excerpt(headline(r),70))+'</span></a>';
    }).join("")||'<div class="empty-state">هنوز تصویری برای نمایش دریافت نشده است.</div>');
  }
  function authorName(record){
    var key=String(record.editorial_author_id||record.editorial_report&&record.editorial_report.author_id||record.author_id||"");
    var person=data.authors.find(function(a){return a.id===key;});
    return person?String(person.display_name_fa||"تحریریهٔ پندار"):"تحریریهٔ پندار";
  }
  function renderArticle(id,detail){
    var report=detail.editorial_report||{};
    var title=headline(Object.assign({},detail,{title_fa:report.title_fa||detail.headline_fa}));
    var lead=norm(report.lead_fa||detail.summary_fa||"");
    document.title=title+" | پندار — پیش‌نمایش";
    put("article-title",esc(title));
    put("article-deck",esc(lead));
    var authorId=String(detail.editorial_author_id||report.author_id||"");
    var author=data.authors.find(function(a){return a.id===authorId;});
    var portrait="";
    if(author&&Number.isInteger(author.portrait_index)&&author.portrait_index>=0&&author.portrait_index<=6&&author.portrait_status==="installed"){
      var position=(author.portrait_index*100/6).toFixed(4);
      portrait='<span class="author-avatar" aria-hidden="true" style="background-image:url(/assets/editorial/pendar-authors-sprite.avif);background-size:700% 100%;background-position:'+position+'% center"></span>';
    }
    put("article-byline",portrait+'<a class="author-link" href="/editorial-author/'+encodeURIComponent(authorId||"desk")+'/"><strong>'+esc(authorName(detail))+'</strong><span>تحریریهٔ پندار</span></a>');
    var img=validImage(detail.image_url);
    if(img){
      el("article-image").hidden=false;
      el("article-photo").src=img;
      el("article-photo").alt=title;
      put("article-photo-credit",detail.image_credit?'تصویر: '+esc(detail.image_credit):'');
    }else el("article-image").hidden=true;
    var paras=Array.isArray(report.paragraphs)?report.paragraphs.map(function(p){return norm(p&&p.text_fa||"");}).filter(Boolean):[];
    if(!paras.length){
      paras=[detail.what_happened_fa,detail.why_it_matters_fa,detail.summary_fa].map(norm).filter(Boolean);
    }
    put("article-text",paras.length?paras.map(function(p){return '<p>'+esc(p)+'</p>';}).join(""):'<p>متن کامل این مطلب در نمای اصلی پندار در دسترس است. <a href="'+esc(finalStoryUrl(id))+'">مشاهدهٔ مطلب ←</a></p>');
    var research="";
    var sources=Array.isArray(detail.sources)?detail.sources.filter(function(s){return s&&validLink(s.article_url);}):[];
    if(sources.length)research+='<h3>منابع و مستندات</h3><ul>'+sources.slice(0,18).map(function(s){return '<li><a href="'+esc(validLink(s.article_url))+'" target="_blank" rel="noopener noreferrer">'+esc(s.original_headline||s.source_name||"مشاهدهٔ منبع")+'</a></li>';}).join("")+'</ul>';
    var uncertain=Array.isArray(detail.uncertainties)?detail.uncertainties.filter(Boolean):[];
    if(uncertain.length)research+='<h3>آنچه هنوز روشن نیست</h3><ul>'+uncertain.slice(0,7).map(function(t){return '<li>'+esc(t)+'</li>';}).join("")+'</ul>';
    var views=Array.isArray(detail.source_views)?detail.source_views.filter(Boolean):[];
    if(views.length)research+='<h3>دیدگاه‌های ثبت‌شده</h3><ul>'+views.slice(0,6).map(function(v){return '<li><strong>'+esc(v.source_name||"منبع")+'</strong> — '+esc(v.viewpoint_fa||"")+'</li>';}).join("")+'</ul>';
    put("article-research",research||'<p>منابع و جزئیات تکمیلی این گزارش در <a href="'+esc(finalStoryUrl(id))+'">صفحهٔ اصلی پندار</a> در دسترس‌اند.</p>');
    el("canonical-story").href=finalStoryUrl(id);
    var related=data.reports.filter(function(r){return r.id!==id;}).slice(0,6);
    put("related-reports",related.map(function(r){return railRow(r,Boolean(photo(r)));}).join("")||'<p class="empty-state">گزارش دیگری برای نمایش یافت نشد.</p>');
  }
  async function boot(options){
    options=options||{};
    mountRoot=options.root||document;
    var params=new URLSearchParams(location.search), storyId=options.homeOnly?"":params.get("story")||"";
    var storyMode=UUID.test(storyId);
    el("home-page").hidden=storyMode;el("article-page").hidden=!storyMode;
    try{
      var result=await Promise.all([
        fetchJson("/data/stories.json").catch(function(){return [];}),
        fetchJson("/data/editorial-archive.json").catch(function(){return {};}),
        fetchJson("/data/pendar-editorial-authors.json").catch(function(){return {};})
      ]);
      data.stories=Array.isArray(result[0])?result[0]:[];
      data.authors=Array.isArray(result[2].authors)?result[2].authors:[];
      var archived=Array.isArray(result[1].reports)?result[1].reports.filter(function(r){return r&&r.status==="ai_draft";}):[];
      var backup=data.stories.filter(function(r){return r.has_editorial_report;}).map(function(r){return Object.assign({},r,{title_fa:r.editorial_report_title_fa||r.headline_fa});});
      var byId=new Map(data.stories.filter(function(r){return r&&r.id;}).map(function(r){return [String(r.id),r];}));
      data.reports=limitUnique(archived.concat(backup).map(function(r){var story=byId.get(String(r.id))||{};return Object.assign({},story,r,{image_url:r.image_url||story.image_url||"",lead_fa:r.lead_fa||story.summary_fa||""});}),30);
      // Older archive entries sometimes lack an image or lead. Resolve a
      // bounded number from existing story details before building the cover.
      if(!storyMode){
        var incomplete=data.reports.slice(0,12).filter(function(r){return !photo(r)||!norm(r.lead_fa);});
        await Promise.all(incomplete.map(async function(row){
          try{
            var detail=await fetchJson("/data/story/"+encodeURIComponent(row.id)+".json");
            if(!photo(row)&&validImage(detail.image_url))row.image_url=detail.image_url;
            if(!norm(row.lead_fa)&&detail.editorial_report&&detail.editorial_report.lead_fa)
              row.lead_fa=detail.editorial_report.lead_fa;
            if(!norm(row.lead_fa)&&detail.summary_fa)row.lead_fa=detail.summary_fa;
          }catch(_){}
        }));
      }
      if(storyMode){
        var detail=await fetchJson("/data/story/"+encodeURIComponent(storyId)+".json");
        renderArticle(storyId,detail);
      }else renderHome();
    }catch(err){
      if(storyMode){
        put("article-title","نمایش این مطلب فعلاً ممکن نیست");
        put("article-text",'<p>متن گزارش در <a href="'+esc(finalStoryUrl(storyId))+'">نسخهٔ اصلی پندار</a> قابل بررسی است.</p>');
      }else{
        fallback("under-hero","دریافت گزارش‌ها موقتاً ممکن نیست.");
        fallback("rail-reports","دریافت داده‌ها موقتاً ممکن نیست.");
      }
      if(typeof console!=="undefined")console.warn("Pendar heritage preview:",err);
    }
  }
  if(window.PENDAR_HERITAGE_EMBED){
    // Production homepage can mount this renderer inside an isolated root.
    // The standalone preview still works unmodified at its own URL.
    window.PendarHeritage={
      mount:function(root){return boot({root:root,homeOnly:true});}
    };
  }else{
    boot();
  }
})();