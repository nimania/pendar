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
    var title=headline(item),image=thumb(item,"rail-thumb");
    return '<a class="rail-row'+(image?'':' rail-row-text')+'" href="'+esc(slugUrl(item))+'">'
      +(image?'<span>'+image+'</span>':'')
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
  function setupTickerArrows(){
    var ticker=el("ticker");
    if(!ticker||ticker.dataset.arrowsReady)return;
    ticker.dataset.arrowsReady="1";
    var section=ticker.closest(".latest-ticker");
    if(!section)return;
    section.querySelectorAll("[data-ticker-direction]").forEach(function(button){
      button.addEventListener("click",function(){
        var item=ticker.querySelector(".ticker-story");
        var distance=item?item.getBoundingClientRect().width+19:Math.max(190,ticker.clientWidth*.75);
        ticker.scrollBy({left:button.dataset.tickerDirection==="next"?-distance:distance,behavior:"smooth"});
      });
    });
  }
  async function renderFigureStrip(figures) {
    setupTickerArrows();
    var people=Array.isArray(figures&&figures.figures)?figures.figures:[];
    var found=people.flatMap(function(person){
      var posts=Array.isArray(person.posts)?person.posts:[];
      return posts.slice(0,3).map(function(post){return {person:person,post:post};});
    }).filter(function(x){return x.post&&x.person&&x.person.handle;})
      .sort(function(a,b){return String(b.post.published_at||"").localeCompare(String(a.post.published_at||""));});
    var seen=new Set(),candidates=[];
    for(var entry of found){
      if(seen.has(entry.person.handle))continue;
      seen.add(entry.person.handle);
      var post=entry.post,person=entry.person;
      var title=norm(post.headline_fa||post.title_fa||post.statement_fa||post.text_fa||post.text||post.title||post.recap_fa||post.summary_fa||"");
      if(!title)continue;
      var paths=[person.avatar,person.avatar_url,person.image_url,person.photo_url,
        person.image&&person.image.url,person.image&&person.image.path,
        post.avatar,post.avatar_url,post.figure_avatar];
      var images=paths.filter(Boolean).map(function(value){
        var url=String(value).trim();
        if(/^https?:\/\//i.test(url))return url;
        if(/^\/?[a-zA-Z0-9][a-zA-Z0-9_./%-]*$/.test(url)&&!url.includes(".."))
          return "/"+url.replace(/^\/+/, "");
        return "";
      }).filter(Boolean);
      if(images.length)candidates.push({person:person,title:title,images:[...new Set(images)]});
      if(candidates.length>=25)break;
    }
    // The portrait must be a verified actual image from the corresponding figure.
    // Do not silently substitute a news thumbnail or generic placeholder.
    async function firstWorking(c){
      for(var url of c.images.slice(0,4)){
        var ok=await new Promise(function(resolve){
          var img=new Image(),done=false;
          var timer=setTimeout(function(){finish(false);},2000);
          function finish(value){if(done)return;done=true;clearTimeout(timer);img.onload=img.onerror=null;resolve(value);}
          img.onload=function(){finish(img.naturalWidth>=50&&img.naturalHeight>=50);};
          img.onerror=function(){finish(false);};
          img.src=url;
        });
        if(ok)return url;
      }
      return "";
    }
    var verified=await Promise.all(candidates.map(async function(c){return {c:c,url:await firstWorking(c)};}));
    var cards=verified.filter(function(r){return Boolean(r.url);}).slice(0,9).map(function(r){
      var person=r.c.person;
      var name=norm(person.name_fa||person.name||person.display_name_fa||person.handle);
      var href="/figure/"+encodeURIComponent(person.handle)+"/";
      return '<a class="ticker-story person-statement" href="'+esc(href)+'">'
        +'<img class="ticker-person-photo" src="'+esc(r.url)+'" alt="'+esc(name)+'" loading="lazy" decoding="async">'
        +'<span><span class="ticker-person-name">'+esc(name)+'</span><span class="ticker-person-quote">'+esc(excerpt(r.c.title,110))+'</span></span></a>';
    });
    var textOnly=candidates.slice(0,3).map(function(c){
      return '<a class="ticker-text-fallback" href="/@'+encodeURIComponent(c.person.handle)+'/"><strong>'
        +esc(c.person.name_fa||c.person.name||c.person.handle)+'</strong><span>'+esc(excerpt(c.title,65))+'</span></a>';
    });
    put("ticker",cards.join("")||textOnly.join("")||'<a href="/figures/">مشاهدهٔ تازه‌ترین گفته‌ها ←</a>');
  }
  function renderRailFigureFive(payload){
    var people=Array.isArray(payload&&payload.figures)?payload.figures:[];
    var records=people.filter(function(p){return p&&p.handle&&p.name_fa;}).map(function(p){
      var posts=Array.isArray(p.posts)?p.posts:[];
      return {person:p,count:posts.length,latest:posts.reduce(function(a,b){
        return String(b.published_at||"")>String(a||"")?b.published_at:a;
      },""),engagement:posts.reduce(function(v,post){return v+(Number(post.engagement_score||post.score||0)||0);},0)};
    });
    var buckets={
      fresh:records.slice().sort(function(a,b){return b.latest.localeCompare(a.latest);}),
      updated:records.slice().sort(function(a,b){return b.latest.localeCompare(a.latest);}),
      talkative:records.slice().sort(function(a,b){return b.count-a.count||b.latest.localeCompare(a.latest);}),
      hot:records.slice().sort(function(a,b){return b.engagement-a.engagement||b.count-a.count;})
    };
    Object.keys(buckets).forEach(function(key){
      var rows=buckets[key].slice(0,5).map(function(r){
        return '<a class="rail-row rail-row-text" href="/@'+encodeURIComponent(r.person.handle)+'/"><span><span class="rail-title">'+esc(r.person.name_fa)+'</span><span class="rail-kicker">'+esc(r.person.role_fa||"")+'</span></span></a>';
      });
      put("rail-figures-"+key,rows.join("")||'<p class="empty-state">چهره‌ای برای نمایش موجود نیست.</p>');
    });
  }
  function initializeRailTabs(){
    document.querySelectorAll(".rail-tabs-box").forEach(function(box){
      if(box.dataset.tabsReady)return;
      box.dataset.tabsReady="1";
      var tabs=Array.from(box.querySelectorAll("[data-rail-tab]"));
      var panels=Array.from(box.querySelectorAll("[data-rail-panel]"));
      function activate(name){
        tabs.forEach(function(tab){
          var selected=tab.dataset.railTab===name;
          tab.classList.toggle("on",selected);
          tab.setAttribute("aria-selected",String(selected));
          tab.tabIndex=selected?0:-1;
        });
        panels.forEach(function(panel){panel.hidden=panel.dataset.railPanel!==name;});
      }
      tabs.forEach(function(tab,index){
        tab.addEventListener("click",function(){activate(tab.dataset.railTab);});
        tab.addEventListener("keydown",function(e){
          if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
          e.preventDefault();
          var next=(index+(e.key==="ArrowLeft"?1:tabs.length-1))%tabs.length;
          activate(tabs[next].dataset.railTab);
          tabs[next].focus();
        });
      });
      activate(tabs.find(function(tab){return tab.classList.contains("on");})?.dataset.railTab||tabs[0]?.dataset.railTab);
    });
  }
  function renderHomepageBriefs(){
    var digits=function(value){return String(value).replace(/\\d/g,function(d){return "۰۱۲۳۴۵۶۷۸۹"[Number(d)];});};
    var number=function(value){var n=Number(value);return Number.isFinite(n)?digits(n.toLocaleString("en-US")):"";};
    var fallback=function(id,href,label){put(id,'<a class="brief-fallback" href="'+href+'">'+label+' ←</a>');};
    Promise.all([
      fetchJson("/data/prices.json").catch(function(){return null;}),
      fetchJson("/data/weather.json").catch(function(){return null;})
    ]).then(function(result){
      var prices=result[0];
      var priceRows=Array.isArray(prices)?prices:Array.isArray(prices&&prices.prices)?prices.prices:[];
      var targets=["دلار آمریکا","یورو","سکه امامی","لیر ترکیه"];
      var market=targets.map(function(name){return priceRows.find(function(r){return r&&r.label_fa===name;});}).filter(Boolean);
      if(market.length<3){
        priceRows.forEach(function(row){if(market.length>=4)return;if(row&&!market.includes(row)&&row.label_fa&&Number.isFinite(Number(row.value)))market.push(row);});
      }
      var marketHtml=market.slice(0,4).map(function(row){
        var value=number(row.value),change=Number(row.dp);
        if(!value)return "";
        var trend=Number.isFinite(change)&&change!==0
          ?'<span class="brief-delta '+(change>0?'up':'down')+'">'+(change>0?'▲ ':'▼ ')+number(Math.abs(change))+'٪</span>'
          :'<span class="brief-delta flat">—</span>';
        return '<a class="brief-cell" href="/market/"><span class="brief-label">'+esc(row.label_fa)+'</span><strong>'+value+'</strong>'+trend+'</a>';
      }).filter(Boolean);
      if(marketHtml.length)put("home-market-summary",'<div class="brief-mini-grid">'+marketHtml.join("")+'</div><div class="brief-unit">قیمت به تومان · نمایش داده‌های منتشرشدهٔ پندار</div>');
      else fallback("home-market-summary","/market/","مشاهدهٔ تازه‌ترین نرخ‌های بازار");

      var weather=result[1];
      var cities=Array.isArray(weather)?weather:Array.isArray(weather&&weather.cities)?weather.cities:[];
      var selected=["تهران","نوشهر","چالوس","کرمان"].map(function(n){return cities.find(function(r){return r&&r.city_fa===n;});}).filter(Boolean);
      if(selected.length<3)cities.forEach(function(r){if(selected.length<4&&r&&!selected.includes(r)&&r.city_fa)selected.push(r);});
      var cityHtml=selected.slice(0,4).map(function(row){
        var temp=number(row.temp);
        if(!temp)return "";
        var icon=typeof row.icon==="string"&&row.icon.length<=4?esc(row.icon):"🌡️";
        var condition=norm(row.cond_fa||"");
        return '<a class="brief-cell brief-weather-cell" href="/weather/"><span class="brief-label">'+icon+' '+esc(row.city_fa)+'</span><strong>'+temp+'°</strong><span class="brief-condition">'+esc(condition||"وضعیت هوا")+'</span></a>';
      }).filter(Boolean);
      if(cityHtml.length)put("home-weather-summary",'<div class="brief-mini-grid">'+cityHtml.join("")+'</div><div class="brief-unit">وضعیت شهرها بر اساس آخرین دادهٔ منتشرشده</div>');
      else fallback("home-weather-summary","/weather/","مشاهدهٔ پیش‌بینی شهرها");
    }).catch(function(){
      fallback("home-market-summary","/market/","مشاهدهٔ وضعیت بازار");
      fallback("home-weather-summary","/weather/","مشاهدهٔ وضعیت آب‌وهوا");
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
    initializeRailTabs();
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
      var railNewsRows=varied(stories,7);
      var cultureWords=/فرهنگ|موسیقی|کتاب|فیلم|سریال|سینما|هنر|عکاس|معمار|تئاتر|زندگی|گردش|غذا|آشپزی|ادبی|دانش|محیط زیست|طبیعت|سلامت|ورزش/;
      var culture=all.filter(function(r){return cultureWords.test(norm(headline(r)+" "+(r.category||"")));});
      // Figure statements are rendered independently of news-card photo gating.
      // Editorial lead: prefer independent Iran-focused political coverage.
      // Assess the *subject* of a report, never infer its political allegiance.
      var iranFocus=/ایران|ایرانی|ایرانگرایی|ایران‌گرایی|ایران دوستی|ایراندوستی|ملی‌گرایی|ملت ایران|هویت ملی|میراث ایران|تاریخ ایران|تمامیت ارضی|آینده ایران|مشروطه|قانون اساسی|گذار سیاسی|آزادی ایران/;
      var politics=/سیاست|انتخابات|دولت|مجلس|دیپلماسی|تحریم|مذاکره|جنگ|آمریکا|حکمرانی|امنیت|قدرت|حقوق شهروندی|جامعه مدنی|دموکراسی|استقلال/;
      function leadScore(r){
        var title=norm(headline(r)),section=norm(r.category||r.section||"");
        var score=(iranFocus.test(title)?12:0)+(iranFocus.test(section)?6:0)
          +(politics.test(title)?5:0)+(politics.test(section)?3:0)
          +(r._imageWidth>=900?2:0);
        return score;
      }
      var leadCandidates=limitUnique(editorial.concat(reports).concat(news).concat(stories),150);
      var prioritized=leadCandidates.filter(function(r){return leadScore(r)>=8;})
        .sort(function(a,b){return leadScore(b)-leadScore(a)||String(b.published_at||"").localeCompare(String(a.published_at||""));});
      var cover=prioritized[0]||editorial[0]||news[0]||reports[0]||stories[0];
      var heroBox=el("feature-hero");
      var featureSection=heroBox.closest(".feature-block");
      if(featureSection)featureSection.hidden=!cover;
      if(cover){
        var report=editorial.some(function(r){return r.id===cover.id;});
        heroBox.href=slugUrl(cover);
        heroBox.setAttribute("aria-label",headline(cover));
        heroBox.innerHTML=(verifiedImage(photo(cover))?'<span class="feature-picture">'+thumb(cover,"")+'</span>':'')
          +'<span class="feature-caption"><span class="category-flag orange">'+(report?"گزارش ویژه":"خبر ویژه")+'</span>'
          +'<strong>'+esc(headline(cover))+'</strong><span>'+esc(hook(cover))+'</span></span>';
      }
      var more=varied(editorial.concat(news).concat(reports).concat(stories),9);
      put("under-hero",more.slice(0,2).map(function(r){
        return '<a class="mini-feature" href="'+esc(slugUrl(r))+'">'+thumb(r,"")
          +'<span class="caption"><strong>'+esc(headline(r))+'</strong><span>'+esc(hook(r))+'</span></span></a>';
      }).join(""));
      // Each tab contains at most five actual records, ranked independently.
      var sourceRows=limitUnique(stories.concat(reports),300);
      function timeOf(r){return Date.parse(r.published_at||r.updated_at||"")||0;}
      function engagement(r){return Number(r.trend_score||r.viral_score||r.engagement_score||r.share_count||0)||0;}
      function importance(r){return Number(r.importance_score||r.score||0)||0;}
      function rankRows(rows,mode){
        return rows.slice().sort(function(a,b){
          function score(r){
            if(mode==="viral")return engagement(r)*10+importance(r);
            if(mode==="trend")return (Number(r.trend_score)||0)*10+importance(r);
            if(mode==="hot")return importance(r)*10+engagement(r);
            return timeOf(r);
          }
          return score(b)-score(a)||timeOf(b)-timeOf(a);
        });
      }
      function fillFive(id,rows){
        var seen=new Set(),picked=[];
        rows.forEach(function(r){var key=String(r.id||"");if(key&&!seen.has(key)&&picked.length<5){seen.add(key);picked.push(r);}});
        put(id,picked.map(railRow).join("")||'<p class="empty-state">هنوز مطلبی برای این بخش منتشر نشده است.</p>');
      }
      ["fresh","viral","trend","hot"].forEach(function(mode){
        fillFive("rail-headlines-"+mode,rankRows(stories,mode));
      });
      var reportFilters={
        politics:/سیاس|ایران|دیپلماس|حکومت|انتخاب|جنگ|امنیت|تحریم/,
        society:/جامع|آموزش|زندگی|شهر|سلامت|محیط|کارگر|زنان|اجتماع/,
        culture:/فرهنگ|هنر|کتاب|سینما|فیلم|ادبی|موسیقی|میراث|تئاتر/,
        sport:/ورزش|فوتبال|والیبال|کشتی|المپیک|قهرمان|مسابقه/
      };
      Object.keys(reportFilters).forEach(function(mode){
        var matches=reports.filter(function(r){return reportFilters[mode].test(headline(r)+" "+(r.category||""));});
        fillFive("rail-reports-"+mode,rankRows(matches,"fresh"));
      });
      fillFive("rail-today-latest",rankRows(stories,"fresh").filter(function(r){
        return Date.now()-timeOf(r)<36*60*60*1000;
      }));
      fillFive("rail-today-big",rankRows(stories,"hot").filter(function(r){
        return Date.now()-timeOf(r)<36*60*60*1000;
      }));
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
    fetchJson("/data/figures.json").then(function(payload){renderFigureStrip(payload);renderRailFigureFive(payload);}).catch(function(){
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
    var articleParagraphs=paras.map(function(p){return '<p>'+esc(p)+'</p>';});
    articleParagraphs.splice(Math.min(2,articleParagraphs.length),0,'<aside class="pendar-telegram-promo"><strong>پندار در تلگرام</strong><p>خبرها و گزارش‌های منتخب را در کانال دنبال کنید.</p><a href="https://t.me/pendario">عضویت در کانال پندار ←</a></aside>');
    put("article-text",paras.length?articleParagraphs.join(""):'<p>متن کامل این مطلب در نمای اصلی پندار در دسترس است. <a href="'+esc(finalStoryUrl(id))+'">مشاهدهٔ مطلب ←</a></p>');
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
  function newestTimestamp(rows){
    if(!Array.isArray(rows))return null;
    var valid=rows.map(function(row){return row&&typeof row==="object"?
      (row.published_at||row.updated_at||row.created_at||row.collected_at||row.timestamp||""):"";})
      .map(function(value){var d=new Date(value);return Number.isFinite(d.getTime())?d.getTime():0;})
      .filter(function(value){return value>0&&value<=Date.now()+86400000;});
    return valid.length?new Date(Math.max.apply(null,valid)):null;
  }
  function freshnessLabel(value){
    if(!value)return "نامشخص";
    var d=new Date(value);
    if(!Number.isFinite(d.getTime())||d.getTime()>Date.now()+86400000)return "نامشخص";
    return new Intl.DateTimeFormat("fa-IR",{timeZone:"Asia/Tehran",month:"short",day:"numeric",
      hour:"2-digit",minute:"2-digit",hour12:false}).format(d)+" (تهران)";
  }
  function stampBlock(name,date,description){
    return '<span title="'+esc(description)+'">'+esc(name)+': <time datetime="'+
      (date?esc(new Date(date).toISOString()):"")+'">'+esc(freshnessLabel(date))+'</time></span>';
  }
  function renderFreshness(){
    // Edition time belongs to deployment, whereas source timestamps belong to
    // each dataset. A fetch time is not misrepresented as a publication time.
    var dynamic=[
      ["انتشار سایت","/data/footer-status.json",function(v){return v&&v.published_at;}],
      ["چهره‌ها","/data/figures.json",function(v){
        return newestTimestamp((v.figures||[]).flatMap(function(person){return person.posts||[];}));}],
      ["بازار","/data/market-nabzesh.json",function(v){return v.updated_at||v.generated_at||v.as_of;}],
      ["آب‌وهوا","/data/weather.json",function(v){return v.updated_at||v.generated_at||v.as_of;}],
      ["کتاب","/data/book-curation.json",function(v){return v.updated_at||v.generated_at||v.as_of;}],
      ["جراید","/data/press-stats.json",function(v){return v.updated_at||v.generated_at||v.as_of;}]
    ];
    var items=[
      stampBlock("سرخط‌ها",newestTimestamp(data.stories),"تاریخ تازه‌ترین خبر در خروجی فعلی"),
      stampBlock("گزارش‌ها",newestTimestamp(data.reports),"تاریخ تازه‌ترین گزارش در خروجی فعلی")
    ];
    put("footer-freshness",items.join('<span aria-hidden="true">·</span>'));
    Promise.all(dynamic.map(function(entry){
      return fetchJson(entry[1]).then(function(value){return [entry[0],entry[2](value)];})
        .catch(function(){return [entry[0],null];});
    })).then(function(pairs){
      put("footer-freshness",[
        stampBlock("انتشار سایت",pairs[0][1],"زمان ساخته‌شدن نسخهٔ منتشرشده؛ نه زمان بازدید"),
        items[0],items[1]
      ].concat(pairs.slice(1).map(function(p){return stampBlock(p[0],p[1],"آخرین زمان ثبت‌شده در دادهٔ "+p[0]);})).join('<span aria-hidden="true">·</span>'));
    });
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
      renderFreshness();
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