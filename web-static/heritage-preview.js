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
      var timer=setTimeout(function(){done(false);},4800);
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
  var data={stories:[],reports:[],authors:[],homeSnapshot:null};
  var redrawHome=null;
  function put(id,html){var x=el(id);if(x)x.innerHTML=html;}
  function railPublisher(item){
    // Only credit a publisher explicitly attached to this story. No category
    // badge or invented logo if the source cannot be established.
    var source=Array.isArray(item.sources)&&item.sources.length?item.sources[0]:null;
    var obj=source&&typeof source==="object"?source:{};
    var publisher=item.publisher&&typeof item.publisher==="object"?item.publisher:{};
    var name=norm(obj.name_fa||obj.name||publisher.name_fa||publisher.name||
      item.source_name_fa||item.source_name||item.publisher_name_fa||
      item.publisher_name||(typeof item.source==="string"?item.source:""));
    var logo=validImage(obj.logo_url||obj.logo||publisher.logo_url||publisher.logo||
      item.source_logo_url||item.source_logo||item.publisher_logo_url||"");
    var sourceUrl=validLink(obj.url||obj.article_url||item.source_url||item.original_url||
      item.article_url||item.url||"");
    var domain="";
    if(sourceUrl){try{domain=new URL(sourceUrl,location.origin).hostname.toLowerCase();}catch(_){}}
    // Domain-derived favicons are used only for attributable external media.
    if(!name&&domain&&domain!==location.hostname)name=domain.replace(/^www\./,"");
    if(!name)return "";
    if(!logo&&domain&&domain!==location.hostname){
      logo="https://www.google.com/s2/favicons?domain="+encodeURIComponent(domain)+"&sz=32";
    }
    return '<span class="rail-publisher">'
      +(logo?'<img class="rail-publisher-logo" src="'+esc(logo)+'" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">':"")
      +'<span>'+esc(name.slice(0,52))+'</span></span>';
  }
  function railRow(item){
    var title=headline(item),url=validImage(photo(item));
    var image=url?'<img class="rail-thumb" src="'+esc(url)+'" alt="" loading="lazy" decoding="async">':'<span class="rail-thumb rail-thumb-placeholder" aria-hidden="true">▤</span>';
    return '<a class="rail-row" href="'+esc(slugUrl(item))+'">'
      +'<span class="rail-thumb-frame">'+image+'</span>'
      +'<span><span class="rail-title">'+esc(title)+'</span>'
      +railPublisher(item)
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
    if(img.closest(".rail-row")){img.style.visibility="hidden";return;}
    var tile=img.closest(".ticker-story,.feature-hero,.mini-feature,.story-card,.visual-card");
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
    function personPhoto(p){
      var raw=[p.avatar,p.avatar_url,p.image_url,p.photo_url,p.image&&p.image.url,p.image&&p.image.path].filter(Boolean);
      for(var x of raw){
        var url=String(x).trim();
        if(!/^https?:\/\//.test(url)&&/^\/?[a-zA-Z0-9][a-zA-Z0-9_./%-]*$/.test(url)&&!url.includes(".."))url="/"+url.replace(/^\/+/, "");
        if(validImage(url))return url;
      }
      return "";
    }
    var records=people.filter(function(p){return p&&p.handle&&p.name_fa;}).map(function(p){
      var posts=Array.isArray(p.posts)?p.posts:[];
      var dates=posts.map(function(post){return String(post.published_at||"");}).filter(Boolean);
      return {person:p,count:posts.length,latest:dates.sort().reverse()[0]||"",
        added:String(p.created_at||p.added_at||p.first_seen_at||p.profile_created_at||""),
        engagement:posts.reduce(function(v,post){return v+(Number(post.engagement_score||post.score||post.view_count||0)||0);},0),
        image:personPhoto(p)};
    });
    var byLatest=function(a,b){return b.latest.localeCompare(a.latest);};
    var buckets={
      // "تازه" means recently ADDED profiles, not recently active ones.
      fresh:records.filter(function(r){return r.added;}).sort(function(a,b){return b.added.localeCompare(a.added);}),
      updated:records.slice().sort(byLatest),
      talkative:records.slice().sort(function(a,b){return b.count-a.count||byLatest(a,b);}),
      hot:records.slice().sort(function(a,b){return b.engagement-a.engagement||b.count-a.count||byLatest(a,b);})
    };
    Object.keys(buckets).forEach(function(key){
      var rows=buckets[key].slice(0,5).map(function(r){
        var image=r.image?'<img class="rail-thumb" src="'+esc(r.image)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="rail-thumb rail-thumb-placeholder" aria-hidden="true">◉</span>';
        return '<a class="rail-row" href="/@'+encodeURIComponent(r.person.handle)+'/"><span class="rail-thumb-frame">'+image+'</span><span><span class="rail-title">'+esc(r.person.name_fa)+'</span><span class="rail-kicker">'+esc(r.person.role_fa||"")+'</span></span></a>';
      });
      put("rail-figures-"+key,rows.join("")||'<p class="empty-state">'+(key==="fresh"?"تاریخ اضافه‌شدن چهره‌ها هنوز در داده‌های فعلی ثبت نشده است.":"چهره‌ای برای نمایش موجود نیست.")+'</p>');
    });
  }
  function initializeRailTabs(){
    mountRoot.querySelectorAll(".rail-tabs-box").forEach(function(box){
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
  // Search-led trends belong to the compact headlines rail, not the editorial cover.
  // Keep the separate /trends/ archive and the trending-figures rail intact.
  function renderSearchTrendsInRail(){
    var target=el("rail-headlines-trends");
    if(!target)return;
    fetchJson("/data/google-trends-iran.json").then(function(payload){
      var people=Array.isArray(payload&&payload.trending_figures)?payload.trending_figures.filter(function(p){
        return p&&new RegExp("^/@[a-z0-9_.-]+/$","i").test(p.url||"")&&norm(p.name);
      }).slice(0,5):[];
      put("rail-figures-trends",people.length?people.map(function(person){
        var avatar=validImage(person.avatar);
        return '<a class="rail-row" href="'+esc(person.url)+'"><span class="rail-thumb-frame">'
          +(avatar?'<img class="rail-thumb" src="'+esc(avatar)+'" loading="lazy" alt="" onerror="this.remove()">':'<span class="rail-thumb rail-thumb-placeholder" aria-hidden="true">◉</span>')
          +'</span><span><span class="rail-title">'+esc(person.name)+'</span><span class="rail-kicker">'+esc(person.role||"صفحهٔ چهره در پندار")+'</span></span></a>';
      }).join(""):'<p class="empty-state">در این نوبت چهرهٔ ترند دارای پروفایل شناسایی نشده است.</p>');
      var reports=Array.isArray(payload&&payload.reports)?payload.reports:[];
      var topics=Array.isArray(payload&&payload.briefs)?payload.briefs:[];
      var seen=new Set(),selected=[];
      reports.concat(topics).forEach(function(row){
        if(!row||selected.length>=5)return;
        var url=validLink(row.url),title=norm(row.title);
        // Only already published Pendar destinations are eligible for the rail.
        if(!title||!url||!(/^\/(?!\/)/.test(url)||/^https:\/\/pendar\.io\//i.test(url)))return;
        if(seen.has(url))return;
        seen.add(url);selected.push({url:url,title:title});
      });
      put("rail-headlines-trends",selected.length?selected.map(function(row){
        return '<a class="rail-trend-row" href="'+esc(row.url)+'"><span class="rail-trend-marker" aria-hidden="true">↗</span><span class="rail-title">'+esc(row.title)+'</span></a>';
      }).join(""):'<p class="empty-state">در این نوبت ترند تأییدشده‌ای برای نمایش نداریم.</p>');
    }).catch(function(){
      put("rail-headlines-trends",'<p class="empty-state">دریافت ترندها موقتاً ممکن نیست. <a href="/trends/">آرشیو ترندها ←</a></p>');
    });
  }

  // The feature is a reading destination: classify from reported subject, never
  // from search popularity, a country's mere mention, or unrelated recommendations.
  var FEATURE_CATEGORIES=["politics","diplomacy","society","technology","statements","sport","environment","culture"];
  var FEATURE_NAMES={politics:"سیاست",diplomacy:"دیپلماسی",society:"جامعه",technology:"تکنولوژی",
    statements:"گفته‌ها",sport:"ورزشی",environment:"محیط زیست",culture:"فرهنگ"};
  var FEATURE_PATTERNS={
    politics:/سیاست|حکومت|حکمرانی|انتخاب|مجلس|دولت|رئیس.?جمهور|رییس.?جمهور|قوه قضاییه|شورای نگهبان|اعتراض|اپوزیسیون|قانون اساسی|قدرت سیاسی|نخست وزیر|نخست‌وزیر|شهرداری|پارلمان/,
    diplomacy:/دیپلماسی|مذاکر|توافق|تحریم|سفیر|سفارت|روابط خارجی|وزارت خارجه|سازمان ملل|بین.?الملل|آتش.?بس|سفر رسمی|دیدار رسمی|ناتو|پاکستان|آمریکا|روسیه|اسرائیل|جنگ|موشک/,
    society:/جامعه|اجتماع|آموزش|دانشگاه|دانشجو|مدرسه|معلم|سلامت|بیمارستان|درمان|حقوق شهروندی|کودک|زنان|کارگر|بازنشسته|مسکن|مهاجرت|جمعیت|بیمه|زندگی روزمره/,
    technology:/تکنولوژی|فناوری|هوش مصنوعی|اینترنت|استارتاپ|استارت‌آپ|اپلیکیشن|نرم.?افزار|سایبری|تراشه|هوشمند|دیجیتال|ربات|ماهواره|پژوهش علمی|گجت/,
    sport:/ورزش|فوتبال|فوتبالیست|لیگ برتر|لیگ قهرمانان|جام جهانی|تیم ملی|المپیک|والیبال|بسکتبال|کشتی گیر|کشتی‌گیر|مسابقه|قهرمانی|استقلال تهران|پرسپولیس|تراکتور|سپاهان|داور فوتبال|گلزن|مربی فوتبال/,
    environment:/محیط.?زیست|اقلیم|خشکسالی|آلودگی هوا|آلودگی آب|هواشناسی|گرمایش زمین|جنگل|منابع طبیعی|تالاب|فرونشست|حیات وحش|حیات.?وحش|بارندگی|سیلاب|بارش|ریزگرد|آب و هوا|آب‌وهوا/,
    culture:/فرهنگ|هنر|سینما|فیلم|سریال|تئاتر|موسیقی|کنسرت|ادبیات|رمان|کتاب|شعر|نویسنده|کارگردان|بازیگر|میراث فرهنگی|موزه|جشنواره|نمایشگاه|شاهنامه/
  };
  var FEATURE_META={
    politics:/politic|government|governance|سیاست|حکمرانی/,
    diplomacy:/diplomac|foreign|international|دیپلماسی|روابط خارجی/,
    society:/societ|social|education|health|جامعه|اجتماع|آموزش|سلامت/,
    technology:/technolog|science|digital|فناوری|تکنولوژی|دانش/,
    sport:/sport|football|ورزش|فوتبال/,
    environment:/environment|climate|nature|محیط زیست|اقلیم/,
    culture:/cultur|art|entertainment|فرهنگ|هنر/
  };
  function featureNormalize(value){
    return norm(value).replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\u200c/g," ").toLowerCase();
  }
  function featureCategory(row){
    var author=featureNormalize(row.editorial_author_id||row.editorial_report&&row.editorial_report.author_id||row.author_id||"");
    var metadata=[row.category,row.section,row.section_fa,row.category_fa,row.topic,row.topic_fa,row.beat]
      .concat(Array.isArray(row.tags)?row.tags:[],Array.isArray(row.topics)?row.topics:[])
      .map(function(item){return featureNormalize(typeof item==="string"?item:item&&(item.name_fa||item.label||item.name)||"");}).join(" ");
    var title=featureNormalize(headline(row));
    var summary=featureNormalize(row.summary_fa||row.lead_fa||"");
    var best="",points=0;
    Object.keys(FEATURE_PATTERNS).forEach(function(key){
      var score=(author===key?12:0)+(FEATURE_META[key].test(metadata)?10:0)
        +(FEATURE_PATTERNS[key].test(title)?15:0)+(FEATURE_PATTERNS[key].test(summary)?2:0);
      if(score>points){points=score;best=key;}
    });
    return best;
  }
  function featureAge(row){
    var stamp=Date.parse(row.published_at||row.updated_at||row.created_at||"");
    return Number.isFinite(stamp)?Math.max(0,Date.now()-stamp):Infinity;
  }
  function featureRank(row,category){
    var age=featureAge(row),hour=3600000;
    var recency=age<6*hour?32:age<24*hour?27:age<48*hour?21:age<7*24*hour?12:age<30*24*hour?5:0;
    var raw=Number(row.importance_score||row.score||row.source_count||0);
    var importance=Number.isFinite(raw)&&raw>0?Math.min(20,Math.log1p(raw)*5):0;
    var editorial=Number(Boolean(row.editorial_report||row.editorial_author_id))*4;
    var iran=category==="politics"&&/ایران|تهران|مجلس|دولت/.test(headline(row))?3:0;
    return recency+importance+editorial+iran;
  }
  function featureStatementsFromFigures(payload){
    var people=Array.isArray(payload&&payload.figures)?payload.figures:[];
    var found=[];
    people.forEach(function(person){
      var handle=String(person&&person.handle||"");
      if(!/^[a-z0-9_.-]{2,90}$/i.test(handle))return;
      var name=norm(person.name_fa||person.name||person.display_name_fa||handle);
      (Array.isArray(person.posts)?person.posts:[]).slice(0,7).forEach(function(post){
        var title=norm(post&&(
          post.headline_fa||post.title_fa||post.statement_fa||post.text_fa||
          post.text||post.title||post.recap_fa||post.summary_fa)||"");
        var date=Date.parse(post&&post.published_at||"");
        if(!title||!Number.isFinite(date))return;
        found.push({title:title,name:name,handle:handle,stamp:date,url:"/@"+encodeURIComponent(handle)+"/"});
      });
    });
    found.sort(function(a,b){return b.stamp-a.stamp;});
    var seen=new Set();
    return found.filter(function(item){
      if(seen.has(item.handle))return false;
      seen.add(item.handle);return true;
    }).slice(0,8);
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
    var currentFeature="politics",featureBucketData={},figureFeatureItems=[],figuresReady=false;
    var heroBox=el("feature-hero"),featureSection=heroBox.closest(".feature-block");
    var featureButtons=Array.from(mountRoot.querySelectorAll("[data-feature-category]"));
    var featurePanel=el("feature-politics-panel");
    var featureMore=el("feature-heading-more");
    function renderCurrentFeature(){
      if(!featureSection||!heroBox)return;
      featureSection.hidden=false;
      var isStatement=currentFeature==="statements";
      var moreUrl=isStatement?"/figures/":"/reports/";
      featureMore.href=moreUrl;
      featureMore.textContent=isStatement?"همهٔ گفته‌ها ←":"همهٔ گزارش‌ها ←";
      var items=isStatement?figureFeatureItems:(featureBucketData[currentFeature]||[]);
      if(!items.length){
        heroBox.hidden=true;
        put("under-hero",'<p class="feature-topic-empty">'+
          (isStatement&&!figuresReady?"در حال دریافت تازه‌ترین گفته‌ها…":"هنوز مطلب تأییدشده‌ای در این بخش موجود نیست.")+
          ' <a href="'+moreUrl+'">آرشیو پندار ←</a></p>');
        return;
      }
      heroBox.hidden=false;
      heroBox.classList.toggle("feature-statement-hero",isStatement);
      heroBox.classList.toggle("feature-text-hero",false);
      if(isStatement){
        var saying=items[0];
        heroBox.href=saying.url;
        heroBox.setAttribute("aria-label",saying.name+": "+saying.title);
        heroBox.innerHTML='<span class="feature-caption feature-saying-copy"><span class="category-flag orange">گفته‌ها</span>'
          +'<strong>'+esc(excerpt(saying.title,270))+'</strong>'
          +'<span class="feature-saying-person">'+esc(saying.name)+'</span></span>';
        put("under-hero",items.slice(1,5).map(function(item){
          return '<a class="mini-feature feature-statement-mini" href="'+esc(item.url)+'"><span class="caption">'
            +'<small>'+esc(item.name)+'</small><strong>'+esc(excerpt(item.title,110))+'</strong></span></a>';
        }).join(""));
        return;
      }
      // A cover gets a real, tested photo from a high-ranking item, or text.
      // Do not let an old photograph outrank every current important report.
      var rows=items.slice(0,12);
      var lead=rows.slice(0,6).find(function(item){
        return verifiedImage(photo(item))&&(item._imageWidth||imageDimensions.get(photo(item))?.width||0)>=900&&featureRank(item,currentFeature)>=featureRank(rows[0],currentFeature)-10;
      })||rows[0];
      var withPicture=verifiedImage(photo(lead));
      heroBox.classList.toggle("feature-text-hero",!withPicture);
      heroBox.href=slugUrl(lead);
      heroBox.setAttribute("aria-label",headline(lead));
      heroBox.innerHTML=(withPicture?'<span class="feature-picture">'+thumb(lead,"")+'</span>':"")
        +'<span class="feature-caption"><span class="category-flag orange">'+esc(FEATURE_NAMES[currentFeature])+'</span>'
        +'<strong>'+esc(headline(lead))+'</strong><span>'+esc(hook(lead))+'</span></span>';
      var others=rows.filter(function(item){return item.id!==lead.id;}).slice(0,4);
      put("under-hero",others.map(function(item){
        var image=verifiedImage(photo(item))?thumb(item,""):"";
        return '<a class="mini-feature'+(image?"":" feature-mini-text")+'" href="'+esc(slugUrl(item))+'">'
          +image+'<span class="caption"><strong>'+esc(headline(item))+'</strong>'
          +'<span>'+esc(hook(item))+'</span></span></a>';
      }).join(""));
    }
    function selectFeature(key){
      if(!FEATURE_CATEGORIES.includes(key))return;
      currentFeature=key;
      featureButtons.forEach(function(tab){
        var on=tab.dataset.featureCategory===key;
        tab.classList.toggle("on",on);
        tab.setAttribute("aria-selected",String(on));
        tab.tabIndex=on?0:-1;
      });
      featurePanel.setAttribute("aria-labelledby","feature-category-"+key);
      renderCurrentFeature();
    }
    featureButtons.forEach(function(button,index){
      button.addEventListener("click",function(){selectFeature(button.dataset.featureCategory);});
      button.addEventListener("keydown",function(event){
        if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
        event.preventDefault();
        var next=event.key==="Home"?0:event.key==="End"?featureButtons.length-1:
          (index+(event.key==="ArrowLeft"?1:featureButtons.length-1))%featureButtons.length;
        selectFeature(featureButtons[next].dataset.featureCategory);
        featureButtons[next].focus();
      });
    });
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
      // Category tabs own the cover and its related cards. All items must
      // match the selected category; an unrelated cover is never a fallback.
      var featurePool=limitUnique(reports.concat(stories),400);
      var featureBuckets={};
      FEATURE_CATEGORIES.forEach(function(key){featureBuckets[key]=[];});
      featurePool.forEach(function(row){
        var category=featureCategory(row);
        if(category&&featureBuckets[category])featureBuckets[category].push(row);
      });
      FEATURE_CATEGORIES.forEach(function(key){
        featureBuckets[key].sort(function(a,b){
          return featureRank(b,key)-featureRank(a,key)||featureAge(a)-featureAge(b);
        });
      });
      featureBucketData=featureBuckets;
      renderCurrentFeature();
      // Permanent editorial reports; not gated by photograph availability.
      var latestReports=reports.slice(0,4);
      put("home-editorial-report-list",latestReports.length?latestReports.map(function(r){
        var picture=verifiedImage(photo(r))?'<span class="home-editorial-report-photo">'+thumb(r,"")+'</span>':'';
        return '<a class="home-editorial-report-row" href="'+esc(slugUrl(r))+'">'
          +picture+'<span class="home-editorial-report-copy"><strong>'+esc(headline(r))+'</strong>'
          +'<small>'+esc(excerpt(hook(r),125))+'</small></span></a>';
      }).join(""):'<a class="home-editorial-report-row" href="/reports/">دیدن آرشیو گزارش‌های تحریریه ←</a>');
      // Each tab contains at most five actual records, ranked independently.
      function timeOf(r){return Date.parse(r.published_at||r.updated_at||"")||0;}
      function signal(r,keys){for(var k of keys){var n=Number(r[k]);if(Number.isFinite(n)&&n>0)return n;}return 0;}
      function engagement(r){return signal(r,["viral_score","share_count","engagement_score","view_count"]);}
      function importance(r){return signal(r,["importance_score","score","source_count"]);}
      function trend(r){return signal(r,["trend_score","momentum_score","velocity_score"]);}
      var sorted=stories.slice().sort(function(a,b){return timeOf(b)-timeOf(a);});
      function fillFive(id,rows){
        var seen=new Set(),picked=[];
        rows.forEach(function(r){var key=String(r.id||"");if(key&&!seen.has(key)&&picked.length<5){seen.add(key);picked.push(r);}});
        put(id,picked.map(railRow).join("")||'<p class="empty-state">برای این دسته هنوز دادهٔ کافی نداریم.</p>');
      }
      function rankedWithSignal(score){
        return stories.filter(function(r){return score(r)>0;})
          .sort(function(a,b){return score(b)-score(a)||timeOf(b)-timeOf(a);});
      }
      fillFive("rail-headlines-fresh",sorted);
      fillFive("rail-headlines-viral",rankedWithSignal(engagement));
      fillFive("rail-headlines-trend",rankedWithSignal(trend));
      fillFive("rail-headlines-hot",rankedWithSignal(importance));
      var reportFilters={
        politics:/سیاس|ایران|دیپلماس|حکومت|انتخاب|جنگ|امنیت|تحریم/,
        society:/جامع|آموزش|زندگی|شهر|سلامت|محیط|کارگر|زنان|اجتماع/,
        culture:/فرهنگ|هنر|کتاب|سینما|فیلم|ادبی|موسیقی|میراث|تئاتر/,
        sport:/ورزش|فوتبال|والیبال|کشتی|المپیک|قهرمان|مسابقه/
      };
      // Enrich sparse editorial categories with genuinely relevant published
      // stories. Do not label a regular news item an editorial report.
      var reportPool=limitUnique(reports.concat(stories),300);
      Object.keys(reportFilters).forEach(function(mode){
        var matches=reportPool.filter(function(r){return reportFilters[mode].test(headline(r)+" "+(r.category||""));});
        fillFive("rail-reports-"+mode,matches.sort(function(a,b){return timeOf(b)-timeOf(a);}));
      });
      var today=sorted.filter(function(r){var dt=timeOf(r);return dt>0&&Date.now()-dt<36*60*60*1000;});
      fillFive("rail-today-latest",today);
      fillFive("rail-today-big",today.filter(function(r){return importance(r)>0;}).sort(function(a,b){return importance(b)-importance(a)||timeOf(b)-timeOf(a);}));
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
    renderSearchTrendsInRail();
    redrawHome=draw;
    draw();
    renderHomepageBriefs();
    fetchJson("/data/figures.json").then(function(payload){
      figureFeatureItems=featureStatementsFromFigures(payload);
      figuresReady=true;
      if(currentFeature==="statements")renderCurrentFeature();
      renderFigureStrip(payload);renderRailFigureFive(payload);
    }).catch(function(){
      figuresReady=true;
      if(currentFeature==="statements")renderCurrentFeature();
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
    put("article-byline",portrait+'<a class="author-link" href="/@'+encodeURIComponent(({"diplomacy":"arman-shayegan","politics":"bahar-dadfar","economy":"saman-farhamand","society":"taraneh-nikrosh","environment":"mahtab-sarvestani","culture":"mana-radfar","technology":"parsa-mehrayin"})[authorId]||authorId||"desk")+'/"><strong>'+esc(authorName(detail))+'</strong><span>تحریریهٔ پندار</span></a>');
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
    articleParagraphs.splice(Math.min(2,articleParagraphs.length),0,'<aside class="pendar-telegram-promo telegram-prominent"><span class="telegram-mark" aria-hidden="true">➤</span><span class="telegram-copy"><strong>پندار در تلگرام</strong><p>خبرها و گزارش‌های منتخب را مستقیم در کانال دنبال کنید.</p></span><a href="https://t.me/pendario" target="_blank" rel="noopener noreferrer">عضویت در کانال ←</a></aside>');
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
        fetchJson("/data/pendar-editorial-authors.json").catch(function(){return {};}),
        fetchJson("/data/homepage-snapshot.json").catch(function(){return null;})
      ]);
      data.homeSnapshot=result[3]&&result[3].version===1?result[3]:null;
      data.stories=Array.isArray(result[0])?result[0]:[];
      if(data.homeSnapshot&&Array.isArray(data.homeSnapshot.story_ids)){
        var positions=new Map(data.homeSnapshot.story_ids.map(function(id,i){return [String(id),i];}));
        data.stories.sort(function(a,b){return (positions.get(String(a.id))??99999)-(positions.get(String(b.id))??99999);});
      }
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