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
  var slugUrl=function(r){return r&&UUID.test(String(r.id||""))?(window.PENDAR_HERITAGE_EMBED?(typeof window.pendarStoryURL==="function"?window.pendarStoryURL(r.id):"/story/"+encodeURIComponent(r.id)+"/"):"/heritage-preview.html?story="+encodeURIComponent(r.id)):"/reports/";};
  var finalStoryUrl=function(id){return UUID.test(String(id||""))?(typeof window.pendarStoryURL==="function"?window.pendarStoryURL(id):"/story/"+id+"/"):"/reports/";};
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
  // External publishers may return blocked, expired or tiny image URLs.
  // Check whether an image actually loads before promoting it to a visual slot.
  var imageChecks=new Map();
  var imageDimensions=new Map();
  function verifiedImage(url){
    return imageChecks.get(url)===true;
  }
  function checkImage(url){
    if(!url)return Promise.resolve(false);
    if(imageChecks.has(url)){
      var cached=imageChecks.get(url);
      return typeof cached==="boolean"?Promise.resolve(cached):cached;
    }
    var pending=new Promise(function(resolve){
      if(typeof Image==="undefined"){resolve(false);return;}
      var img=new Image(),finished=false;
      var done=function(ok){
        if(finished)return;finished=true;
        clearTimeout(timer);
        img.onload=img.onerror=null;
        imageChecks.set(url,Boolean(ok));
        resolve(Boolean(ok));
      };
      var timer=setTimeout(function(){done(false);},2600);
      img.onload=function(){if(img.naturalWidth>=280&&img.naturalHeight>=175){imageDimensions.set(url,{width:img.naturalWidth,height:img.naturalHeight});}done(img.naturalWidth>=280&&img.naturalHeight>=175);};
      img.onerror=function(){done(false);};
      img.src=url;
    });
    imageChecks.set(url,pending);
    return pending;
  }
  function thumb(item,cls){
    var url=photo(item);
    // A news tile may only exist when its picture has already loaded.
    if(!url||!verifiedImage(url))return "";
    return '<img class="'+esc(cls||"")+'" src="'+esc(url)+'" alt="" loading="lazy" decoding="async">';
  }
  var data={stories:[],reports:[],authors:[]};
  var redrawHome=null;
  function put(id,html){var x=el(id);if(x)x.innerHTML=html;}
  function railRow(item){
    if(!verifiedImage(photo(item)))return "";
    var title=headline(item);
    return '<a class="rail-row" href="'+esc(slugUrl(item))+'"><span>'+thumb(item,"rail-thumb")+'</span>'
      +'<span><span class="rail-title">'+esc(title)+'</span>'
      +(item.category?'<span class="rail-kicker">'+esc(String(item.category).slice(0,34))+'</span>':"")
      +'</span></a>';
  }
  function photoNotice(id,message,href){
    put(id,'<p class="empty-state">'+esc(message)+' <a href="'+esc(href)+'" style="color:#178e99">دیدن آرشیو ←</a></p>');
  }
  function shortTickerTitle(value){
    var full=norm(value).replace(/\s*[|؛]\s*.*$/,"");
    if(!full)return "";
    var words=full.split(/\s+/);
    if(words.length<=9&&full.length<=66)return full;
    var chosen=words.slice(0,9).join(" ");
    if(chosen.length>66){
      chosen=chosen.slice(0,66);
      var lastSpace=chosen.lastIndexOf(" ");
      if(lastSpace>=37)chosen=chosen.slice(0,lastSpace);
    }
    return chosen.replace(/[،:؛\s]+$/,"")+(chosen!==full?"…":"");
  }
  function imageFailure(event){
    var img=event.target;
    if(!img||img.tagName!=="IMG"||!el("home-page")||!el("home-page").contains(img))return;
    // An external host can fail even after a successful verification request.
    // Remove the entire article tile immediately; never leave a text-only card.
    var src=img.getAttribute("src");
    if(src)imageChecks.set(src,false);
    var tile=img.closest(".ticker-story,.feature-hero,.mini-feature,.rail-row,.story-card,.visual-card");
    if(tile)tile.remove();
    if(redrawHome)redrawHome();
  }
  async function hydrateMissingPhotos(items,maxDetails){
    var missing=items.filter(function(row){return !photo(row)||imageChecks.get(photo(row))===false;}).slice(0,maxDetails);
    await Promise.all(missing.map(async function(row){
      try{
        var detail=await fetchJson("/data/story/"+encodeURIComponent(row.id)+".json");
        var other=validImage(detail.image_url);
        if(other&&other!==photo(row))row.image_url=other;
        if(!norm(row.lead_fa)&&detail.editorial_report&&detail.editorial_report.lead_fa)row.lead_fa=detail.editorial_report.lead_fa;
        if(!norm(row.lead_fa)&&detail.summary_fa)row.lead_fa=detail.summary_fa;
      }catch(_){}
    }));
  }
  async function inspectPhotos(items){
    await Promise.all(items.map(async function(row){
      // Prefer the article image; try its matching news-feed image if the
      // archived report retained a stale URL. Never borrow another topic's photo.
      var choices=[photo(row)].concat(Array.isArray(row.photo_candidates)?row.photo_candidates:[])
        .map(validImage).filter(function(url,i,array){return url&&array.indexOf(url)===i;});
      if(!choices.length)return;
      var results=await Promise.all(choices.map(checkImage));
      var good=results.indexOf(true);
      if(good>=0){row.image_url=choices[good];row._imageWidth=imageDimensions.get(choices[good])?.width||0;}
    }));
  }
  function uniquePictured(items,max){
    return limitUnique(items.filter(function(row){return verifiedImage(photo(row));}),max);
  }
  function renderFigureStrip(figures) {
    var people=Array.isArray(figures?.figures)?figures.figures:[];
    var found=people.flatMap(function(person){
      var posts=Array.isArray(person.posts)?person.posts:[];
      return posts.slice(0,3).map(function(post){return {person:person,post:post};});
    }).filter(function(x){return x.post&&x.person&&x.person.handle;})
      .sort(function(a,b){return String(b.post.published_at||"").localeCompare(String(a.post.published_at||""));});
    var unique=new Set();
    var cards=found.filter(function(x){
      var handle=x.person.handle;
      if(unique.has(handle))return false;
      unique.add(handle);return true;
    }).slice(0,9).map(function(x){
      var person=x.person,post=x.post;
      var name=norm(person.name_fa||person.name||person.display_name_fa||person.handle);
      var title=norm(post.headline_fa||post.title_fa||post.statement_fa||post.text_fa||post.text||post.title||post.recap_fa||post.summary_fa||"");
      var avatar=validImage(person.avatar||person.image_url||person.photo_url||"");
      if(!title)return "";
      var href="/figure/"+encodeURIComponent(person.handle)+"/";
      return '<a class="ticker-story person-statement" href="'+esc(href)+'">'
        +(avatar?'<img class="ticker-person-photo" src="'+esc(avatar)+'" alt="" loading="lazy" decoding="async">':'<span class="ticker-thumb ticker-thumb-empty" aria-hidden="true">چهره</span>')
        +'<span><span class="ticker-person-name">'+esc(name)+'</span><span class="ticker-person-quote">'+esc(excerpt(title,110))+'</span></span></a>';
    }).filter(Boolean);
    put("ticker",cards.join("")||'<a href="/figures/">تازه‌ترین گفته‌های چهره‌ها را ببینید ←</a>');
  }
  function renderHomepageBriefs(){
    // Use only available published snapshot values; never invent rates or forecasts.
    Promise.all([
      fetchJson("/data/prices.json").catch(function(){return null;}),
      fetchJson("/data/weather.json").catch(function(){return null;})
    ]).then(function(result){
      var prices=result[0];
      var priceRows=Array.isArray(prices)?prices:Array.isArray(prices?.prices)?prices.prices:[];
      var market=priceRows.filter(function(x){return x&&typeof x==="object";}).slice(0,3).map(function(row){
        var label=norm(row.name_fa||row.name||row.symbol||row.title||"");
        var value=row.price??row.value??row.last_price;
        if(!label||value===null||value===undefined||value==="")return "";
        return '<div class="brief-item">'+esc(label)+' — '+esc(String(value))+'</div>';
      }).filter(Boolean);
      put("home-market-summary",market.join("")||'<a href="/market/">نرخ‌های به‌روز ارز، طلا و بازار را در پنداربازار ببینید ←</a>');
      var weather=result[1];
      var weatherRows=Array.isArray(weather)?weather:Array.isArray(weather?.cities)?weather.cities:[];
      var local=weatherRows.filter(function(x){return x&&typeof x==="object";}).slice(0,3).map(function(row){
        var name=norm(row.city_fa||row.city||row.name_fa||row.name||"");
        var temp=row.temperature_c??row.temp_c??row.temperature;
        if(!name||temp===undefined||temp===null||temp==="")return "";
        return '<div class="brief-item">'+esc(name)+' — '+esc(String(temp))+'°</div>';
      }).filter(Boolean);
      put("home-weather-summary",local.join("")||'<a href="/weather/">پیش‌بینی شهرها و وضعیت آب‌وهوا را ببینید ←</a>');
    }).catch(function(){
      put("home-market-summary",'<a href="/market/">مشاهدهٔ وضعیت بازار ←</a>');
      put("home-weather-summary",'<a href="/weather/">مشاهدهٔ وضعیت آب‌وهوا ←</a>');
    });
  }
  async function renderHome(){
    var stories=data.stories.filter(function(r){return r&&UUID.test(String(r.id||""))&&headline(r);});
    var reports=data.reports.filter(function(r){return r&&UUID.test(String(r.id||""))&&headline(r);})
      .sort(function(a,b){return String(b.published_at||"").localeCompare(String(a.published_at||""));});
    // First paint must not wait for dozens of third-party images or fallback
    // article requests. Check a small above-the-fold pool concurrently, then
    // show the verified images we already have within a short bounded window.
    var first=limitUnique(reports.slice(0,23).concat(stories.slice(0,38)),70);
    var priority=limitUnique(reports.slice(0,5).concat(stories.slice(0,7)),12);
    var good=0,signalFirst;
    var enoughPictures=new Promise(function(resolve){signalFirst=resolve;});
    var quickChecks=priority.map(function(row){
      return inspectPhotos([row]).then(function(){
        if(verifiedImage(photo(row))){row._imageWidth=imageDimensions.get(photo(row))?.width||0;if(++good>=3)signalFirst();}
      });
    });
    await Promise.race([
      enoughPictures,
      Promise.all(quickChecks),
      new Promise(function(resolve){setTimeout(resolve,250);})
    ]);
    // No item without a verified picture can enter ANY homepage news module.
    // The backend remains unchanged, and imageless reports still exist in the
    // searchable archive and on their original URL.
    function draw(){
      var news=uniquePictured(stories,65);
      var editorial=uniquePictured(reports,65);
      var all=limitUnique(news.concat(editorial),120);
      // Every module reserves its own story IDs. Editorial diversity is more
      // important than mechanically repeating the latest five headlines.
      var used=new Set();
      function take(rows,n){var result=[];for(var row of rows){if(result.length>=n)break;if(used.has(row.id))continue;used.add(row.id);result.push(row);}return result;}
      function topic(row){return norm(row.category||row.section||row.topic||"").toLowerCase();}
      function varied(rows,n){
        var picked=[],seen=new Set();
        for(var row of rows){if(picked.length>=n)break;var key=topic(row);if(used.has(row.id)||seen.has(key))continue;picked.push(row);seen.add(key);used.add(row.id);}
        for(var row of rows){if(picked.length>=n)break;if(used.has(row.id))continue;picked.push(row);used.add(row.id);}
        return picked;
      }
      var tickerRows=varied(news,5);
      var railNewsRows=varied(news,7);
      var cultureWords=/فرهنگ|موسیقی|کتاب|فیلم|سریال|سینما|هنر|عکاس|معمار|تئاتر|زندگی|گردش|غذا|آشپزی|ادبی|دانش|محیط زیست|طبیعت|سلامت|ورزش/;
      var culture=all.filter(function(r){return cultureWords.test(norm(headline(r)+" "+(r.category||"")));});
      // Figure statements are rendered independently of news-card photo gating.
      put("rail-news",railNewsRows.map(railRow).join("")||
        '<p class="empty-state">خبر تصویردار تازه‌ای برای نمایش پیدا نشد.</p>');
      var political=/سیاست|انتخابات|دولت|مجلس|دیپلماسی|تحریم|مذاکره|جنگ|اسرائیل|ایران|آمریکا|حکمرانی|امنیت|قدرت/;
      var politicalReports=editorial.filter(function(r){return political.test(norm((r.category||"")+" "+headline(r)));});
      var cover=politicalReports.find(function(r){return (r._imageWidth||0)>=900;})||politicalReports[0]||editorial[0]||news[0];
      var heroBox=el("feature-hero");
      var featureSection=heroBox.closest(".feature-block");
      if(featureSection)featureSection.hidden=!cover;
      if(cover){
        var report=editorial.some(function(r){return r.id===cover.id;});
        heroBox.href=slugUrl(cover);
        heroBox.setAttribute("aria-label",headline(cover));
        heroBox.innerHTML='<span class="feature-picture">'+thumb(cover,"")+'</span>'
          +'<span class="feature-caption"><span class="category-flag orange">'+(report?"گزارش ویژه":"خبر ویژه")+'</span>'
          +'<strong>'+esc(headline(cover))+'</strong><span>'+esc(hook(cover))+'</span></span>';
      }
      var more=varied(editorial.concat(news),9);
      put("under-hero",more.slice(0,2).map(function(r){
        return '<a class="mini-feature" href="'+esc(slugUrl(r))+'">'+thumb(r,"")
          +'<span class="caption"><strong>'+esc(headline(r))+'</strong><span>'+esc(hook(r))+'</span></span></a>';
      }).join(""));
      put("rail-reports",news.slice(0,7).map(railRow).join("")||
        '<p class="empty-state">گزارش تصویردار دیگری در دسترس نیست.</p>');
      var cultureSection=el("culture");
      if(cultureSection)cultureSection.hidden=!culture.length;
      put("culture-grid",varied(culture,6).map(function(r){
        return '<a class="story-card" href="'+esc(slugUrl(r))+'"><span class="image-frame">'+thumb(r,"")
          +'</span><span class="story-info"><b>'+esc(headline(r))+'</b><p>'+esc(hook(r))+'</p></span></a>';
      }).join(""));
      var gallery=varied(all.filter(function(r){return verifiedImage(photo(r))&&(r._imageWidth||0)>=700;}),6);
      var gallerySection=el("gallery");
      if(gallerySection)gallerySection.hidden=!gallery.length;
      put("visual-grid",gallery.map(function(r){
        return '<a class="visual-card" href="'+esc(slugUrl(r))+'">'+thumb(r,"")
          +'<span>'+esc(excerpt(headline(r),70))+'</span></a>';
      }).join(""));
    }
    redrawHome=draw;
    draw();
    renderHomepageBriefs();
    fetchJson("/data/figures.json").then(renderFigureStrip).catch(function(){
      put("ticker",'<a href="/figures/">آخرین سخنان و دیدگاه‌های چهره‌ها ←</a>');
    });
    // Fill the remaining modules without blocking the first meaningful paint.
    // Every subsequent draw still filters out images not verified by the browser.
    (async function(){
      await Promise.all(quickChecks);
      await inspectPhotos(first);
      await hydrateMissingPhotos(first,14);
      await inspectPhotos(first);
      if(uniquePictured(stories.slice(0,38),15).length<12||
         uniquePictured(reports.slice(0,23),5).length<4){
        var rest=limitUnique(reports.slice(23,65).concat(stories.slice(38,65)),70);
        await inspectPhotos(rest);
        await hydrateMissingPhotos(rest,12);
        await inspectPhotos(rest);
      }
      draw();
    })().catch(function(error){
      if(typeof console!=="undefined")console.warn("Pendar image enrichment:",error);
    });
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
    if(!storyMode)mountRoot.addEventListener("error",imageFailure,true);
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
      data.reports=limitUnique(archived.concat(backup).map(function(r){
        var story=byId.get(String(r.id))||{};
        return Object.assign({},story,r,{
          image_url:r.image_url||story.image_url||"",
          photo_candidates:[r.image_url,story.image_url].filter(Boolean),
          lead_fa:r.lead_fa||story.summary_fa||""
        });
      }),75);
      if(storyMode){
        var detail=await fetchJson("/data/story/"+encodeURIComponent(storyId)+".json");
        renderArticle(storyId,detail);
      }else await renderHome();
    }catch(err){
      if(storyMode){
        put("article-title","نمایش این مطلب فعلاً ممکن نیست");
        put("article-text",'<p>متن گزارش در <a href="'+esc(finalStoryUrl(storyId))+'">نسخهٔ اصلی پندار</a> قابل بررسی است.</p>');
      }else{
        el("feature-hero").closest(".feature-block").hidden=true;
        el("culture").hidden=true;
        el("gallery").hidden=true;
        photoNotice("rail-reports","دریافت تصاویر گزارش‌ها موقتاً ممکن نیست.","/reports/");
        photoNotice("rail-news","دریافت تصاویر خبرها موقتاً ممکن نیست.","/headlines/");
        put("ticker",'<span class="loading">در حال حاضر دریافت خبرها ممکن نیست.</span>');
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