/* Badbadak: an editorial lens over Pendar's existing datasets. */
const BB_CATEGORIES = [ ['all','همه'], ['celeb','سلبریتی'], ['turkish','سریال‌های ترکی'], ['beauty','آرایش و زیبایی'], ['health','سلامت'], ['style','مُد و استایل'], ['food','خوراکی'], ['buzz','جنجال و حوادث'], ['tech','تکنولوژی'], ['travel','سفر'] ];
let _badbadakLoaded=false, _bbLoading=null, _bbStories=[], _bbPeople=[], _bbTrends=[], _bbCategory='all', _bbMeshkiNews=[], _bbSeries=[], _bbPage='home';
function bbCategory(s){
 if(s.bb_category)return s.bb_category;
 const t=s.headline_fa||s.title_fa||s.title||'';
 if(/نفتکش|سپاه|موشک|حمله نظامی|تنگه هرمز|غزه|جنگ|سفیر|دیپلمات|وزیر|رئیس‌جمهور|جاسوسی|تروریست|پایگاه نظامی|ناتو/.test(t)&&!/بازیگر|خواننده|هنرمند/.test(t))return null;
 for(const [key,re] of [['celeb',/بازیگر|خواننده|سینما|سریال|هنرمند|کنسرت|سلبریتی|جشنواره.*فیلم|منوچهر هادی|یکتا ناصر/],['beauty',/آرایش|زیبایی|پوست(?:\s|$)|موهای|مراقبت.*مو/],['food',/خوراک|غذا|رستوران|آشپزی|تغذیه|قهوه|شیرینی/],['style',/پوشاک|لباس|استایل|فشن|طراح.*مد/],['health',/سلامت|پزشکی|بیماری|درمان|بهداشت|طاعون/],['travel',/گردشگری|هتل|مقصد.*سفر/],['tech',/فناوری|هوش مصنوعی|تکنولوژی|گجت|آیفون/],['buzz',/حادثه|تصادف|آتش.سوزی|جنجال|حاشیه|قتل|شهربازی/]])if(re.test(t))return key;
 return null;
}
function bbLabel(k){return BB_CATEGORIES.find(c=>c[0]===k)?.[1]||'تازه‌ها';}
function bbSafeImage(u){return typeof u==='string'&&(/^(https?:\/\/|assets\/)/.test(u))?u:'';}
function bbStoryURL(s){return s.bb_url||routeURL('#/story/'+encodeURIComponent(s.id));}
function bbCard(s,hero=false){
 const img=bbStoryImage(s),category=bbCategory(s);
 return `<a class="${hero?'bb-hero':'bb-card'}" href="${esc(bbStoryURL(s))}"${s.bb_url?' target="_blank" rel="noopener"':''}>${img?`<img src="${esc(img)}" alt="" ${hero?'fetchpriority="high"':'loading="lazy"'} referrerpolicy="no-referrer" onerror="bbImageError(this)">`:''}<div class="bb-card-copy"><span class="bb-category cat-${category}">${esc(bbLabel(category))}</span><${hero?'h2':'h3'}>${esc(bbHeadline(s))}</${hero?'h2':'h3'}>${hero&&s.summary_fa?`<p>${esc(s.summary_fa.slice(0,240))}</p>`:''}<span class="bb-meta">${s.published_at?esc(relTime(s.published_at)):''}</span></div></a>`;
}
function showBadbadak(){_bbPage='home';show('badbadak');setTab('');setHash('#/badbadak');document.title='بادبادک | چهره‌ها، سبک زندگی و سرگرمی | پندار';return renderBadbadak();}
async function renderBadbadak(){
 if(_badbadakLoaded){bbRender();return;}
 if(_bbLoading)return _bbLoading;
 const el=document.getElementById('badbadak-content');el.innerHTML='<div class="state" role="status">در حال آوردن تازه‌های بادبادک…</div>';
 _bbLoading=(async()=>{
 try{
 const results=await Promise.allSettled([ALL.length?Promise.resolve(ALL):getJSON(`${DATA}/stories.json`),getJSON(`${DATA}/figures.json`),getJSON(`${DATA}/entity-registry.json`),getJSON(`${DATA}/trends.json`),getJSON(MESHKI_ROOT+"data/news-feed.json",8000),loadMeshkiSeries()]);
 if(results[0].status!=='fulfilled'&&results[4].status!=='fulfilled')throw new Error('stories');
 const data=results[0].status==='fulfilled'?results[0].value:[];const stories=Array.isArray(data)?data:data.stories||[];
 const now=Date.now();const age=s=>Math.max(0,(now-Date.parse(s.last_seen||s.published_at||s.first_seen||''))/86400000)||0;
 _bbStories=stories.filter(s=>s.id&&bbCategory(s)).sort((a,b)=>(Math.log2(1+(b.source_count||1))*3-age(b)+(bbCategory(b)==='celeb'?5:0))-(Math.log2(1+(a.source_count||1))*3-age(a)+(bbCategory(a)==='celeb'?5:0))).slice(0,120);
 const figures=results[1].status==='fulfilled'?results[1].value:{};
 const registry=results[2].status==='fulfilled'?results[2].value:{};
 const entities=Array.isArray(registry)?registry:Array.isArray(registry.entities)?registry.entities:Object.values(registry.entities||{});
 const meshki=results[4].status==='fulfilled'?results[4].value:{};
 const seen=new Set();
 _bbMeshkiNews=(meshki.items||[]).filter(n=>n.titleFa&&n.page&&bbSafeImage(n.image)&&!/[a-zA-Z]{3,}/.test(n.titleFa)).filter(n=>{const key=n.titleFa.replace(/[\s\u200c،؛«»]/g,'');if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>String(b.published||'').localeCompare(String(a.published||''))).slice(0,12).map(n=>({id:n.id,headline_fa:n.titleFa,summary_fa:n.summaryFa,image_url:n.image,published_at:n.published,source_count:(n.sources||[]).length||1,bb_category:'turkish',bb_url:MESHKI_ROOT+'haber/'+encodeURIComponent(n.id)+'/'})).filter((n,i,rows)=>rows.findIndex(x=>bbHeadline(x)===bbHeadline(n))===i);
 _bbSeries=(results[5].status==='fulfilled'?results[5].value.rows:[]).filter(r=>r.status==='در حال پخش'&&bbSafeImage(r.hero)).slice(0,10);
 for(const story of _bbStories){
  const names=(story.entities||[]).map(e=>e.name_fa).filter(Boolean);
  const person=entities.find(e=>e.type==='person'&&names.includes(e.name_fa)&&bbSafeImage(e.meta?.avatar));
  if(person)story.bb_fallback_image=person.meta.avatar;
 }
 const names=[..._bbStories,..._bbMeshkiNews].map(s=>s.headline_fa||'').join(' ');
 _bbPeople=[...(figures.figures||[]).map(f=>({...f,bbURL:routeURL('#/figure/'+encodeURIComponent(f.handle))})),...entities.filter(e=>e.type==='person'||e.kind==='person').map(e=>({...e,name_fa:e.name_fa||e.title,avatar:e.meta?.avatar||e.image_url||e.avatar||e.image?.path,bbURL:routeURL('#/entity/'+encodeURIComponent(e.id))}))].filter(p=>p.name_fa&&bbSafeImage(p.avatar)&&names.includes(p.name_fa)).filter((p,i,arr)=>arr.findIndex(x=>x.name_fa===p.name_fa)===i).slice(0,14);
 const trends=results[3].status==='fulfilled'?results[3].value:[];_bbTrends=(Array.isArray(trends)?trends:trends.trends||[]).filter(t=>t.id&&bbCategory(t)).slice(0,4);
 _badbadakLoaded=true;if(_bbPage==='home')bbRender();
 }catch(e){if(_bbPage!=='home')return;el.innerHTML='<div class="state"><h2>تازه‌ها هنوز نرسیده‌اند</h2><p>دریافت خبرها انجام نشد.</p><button type="button" onclick="renderBadbadak()">تلاش دوباره</button></div>';}
 finally{_bbLoading=null;}
 })();return _bbLoading;
}
function bbFilter(k){_bbCategory=k;bbRender();}
function bbRender(){
 if(_bbPage!=='home')return;
 const combined=_bbStories.flatMap((s,i)=>_bbMeshkiNews[i]?[s,_bbMeshkiNews[i]]:[s]).concat(_bbMeshkiNews.slice(_bbStories.length));
 const stories=combined.filter(s=>_bbCategory==='all'||bbCategory(s)===_bbCategory),hero=stories[0];
 const popular=[...stories].sort((a,b)=>(b.source_count||0)-(a.source_count||0)).slice(0,5);
 document.getElementById('badbadak-content').innerHTML=`
 <div class="bb-pills" role="group" aria-label="موضوع خبرها">${BB_CATEGORIES.map(([k,label])=>`<button type="button" aria-pressed="${k===_bbCategory}" onclick="bbFilter('${k}')">${label}</button>`).join('')}</div>
 ${hero?`<div class="bb-breaking"><b>روی موج</b><a href="${esc(bbStoryURL(hero))}">${esc(bbHeadline(hero))}</a></div>`:''}
 ${_bbPeople.length?`<section><h2 class="bb-section-head">چهره‌های روی موج</h2><div class="bb-celeb-strip">${_bbPeople.map(p=>`<a href="${esc(p.bbURL)}"><img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.hidden=true"><span>${esc(p.name_fa)}</span></a>`).join('')}</div></section>`:''}
 <div class="bb-layout"><div>${hero?bbCard(hero,true):'<div class="state">فعلاً خبری در این موضوع نداریم؛ موضوع دیگری را انتخاب کن.</div>'}<div class="bb-grid">${stories.slice(1,25).map(s=>bbCard(s)).join('')}</div></div><aside class="bb-aside">
 <section class="bb-panel"><h2 class="bb-section-head">پربازتاب‌ترین‌ها</h2><ol class="bb-listicle">${popular.map(s=>`<li><a href="${esc(bbStoryURL(s))}">${bbStoryImage(s)?`<img src="${esc(bbStoryImage(s))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="bbImageError(this)">`:''}<span>${esc(bbHeadline(s))}</span></a></li>`).join('')}</ol></section>
 ${_bbTrends.length?`<section class="bb-panel"><h2 class="bb-section-head">موضوعات روی موج</h2>${_bbTrends.map(t=>`<p><a href="${esc(routeURL('#/trend/'+encodeURIComponent(t.id)))}">${esc(bbHeadline({headline_fa:t.title_fa||t.title||t.label||'موضوع روز'}))}</a></p>`).join('')}</section>`:''}
 <section class="bb-panel bb-poll"><h2 class="bb-section-head">انتخاب تو</h2><p>دوست داری در بادبادک بیشتر چه بخوانی؟</p><div id="bb-poll-options"></div></section>
 <a class="bb-game-card" href="/badbadak/crossword/"><span class="bb-game-icon" aria-hidden="true">▦</span><strong>جدول کلمات متقاطع</strong><span>بازی کن، کلمه‌ها را پیدا کن</span></a>
 <section class="bb-panel"><h2 class="bb-section-head">وقت تماشا و خواندن</h2><a class="bb-shortcut" href="/movies/">جان فیلم</a><a class="bb-shortcut" href="/tv/">راهنمای تماشا</a><a class="bb-shortcut" href="/books/">پیشخوان کتاب</a></section></aside></div>
 ${bbSeriesSection()}
 <section class="bb-panel bb-horoscope"><h2 class="bb-section-head">فال امروز، برای سرگرمی</h2><div class="bb-horo-strip">${['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((m,i)=>`<button type="button" onclick="bbHoroscope(${i},this)" aria-pressed="false"><span>${['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'][i]}</span>${m}</button>`).join('')}</div><p id="bb-horo-result" aria-live="polite">ماه تولدت را انتخاب کن.</p></section>`;bbPollRender();
}
function bbPollRender(){let choice='';try{choice=localStorage.getItem('bb-poll-v1')||'';}catch(_){}document.getElementById('bb-poll-options').innerHTML=['چهره‌ها و سرگرمی','خوراکی و سفر','زیبایی و استایل','سلامت و تکنولوژی'].map((s,i)=>`<button type="button" aria-pressed="${choice===String(i)}" onclick="bbVote(${i})">${choice===String(i)?'✓ ':''}${s}</button>`).join('');}
function bbVote(i){try{localStorage.setItem('bb-poll-v1',String(i));}catch(_){}bbPollRender();}
function bbHoroscope(i,button){const lines=['یک گفت‌وگوی عقب‌افتاده را شروع کن.','امروز برای یک خوشی کوچک وقت بگذار.','یک ایده را یادداشت کن؛ شاید فردا به کارت بیاید.','به کسی که دلت برایش تنگ شده پیام بده.','کاری را که دوست داری از قدم کوچک شروع کن.','جای یک چیز اضافه را خالی کن.','برای خودت هم به اندازه دیگران وقت بگذار.','امروز یک مسیر تازه را امتحان کن.','یک کتاب یا فیلم تازه کشف کن.','برنامه‌ات را کمی سبک‌تر بچین.','یک آهنگ قدیمی را دوباره گوش کن.','برای یک دیدار دوستانه وقت پیدا کن.'];const day=new Intl.DateTimeFormat('en',{timeZone:'Asia/Tehran',day:'numeric'}).format(new Date());document.querySelectorAll('.bb-horo-strip button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.getElementById('bb-horo-result').textContent=lines[(i+Number(day))%12];}
const BB_HEADLINES={
 'aed86c62-6776-4969-933d-d5282283e40c':'گوشی سیاوش طهمورث به صاحبش برگشت',
 'dfe90678-c013-4669-b7ba-693accda0995':'یکتا ناصر و منوچهر هادی کنار هم',
 '3e7597d0-9ecb-44ee-9780-356a270a3133':'تازه‌های جشنواره‌های فیلم کودک و کوتاه',
 '60ad07b4-83ec-4f56-b908-c910c4ae9d0c':'ابهام درباره مرگ کارمند آزمایشگاه روسیه',
 '697815e5-7ef7-428d-a894-ec02a2cb0b26':'پنج شهربازی تهران به‌دلیل ناایمنی پلمب شدند',
 '64faa629-b111-4e2d-80a6-37c465380ce4':'خبری از طاعون در سیبری نیست',
 '31de2f51-892f-43e3-92ca-11235971914d':'قتل مرد سالخورده در آتش‌سوزی عمدی',
 '1bc87eda2eb8':'پست تازه جمره بایسل خبرساز شد',
 '9329ad9570e2':'مرگ عزیز، خانواده «حیثیت» را آشفت',
 '70a31f2a4a8d':'روایت اوزوناتاغان از عشقی ده‌ساله',
 '4e032ca43bce':'معرفی‌نامه تازه سریال «عشق احتمالی» منتشر شد',
 'dcaa785a08a2':'تصاویر عاشقانه مروه دینچکول و همسرش',
 '6e318a537fee':'جشن چهارسالگی دختر مورات ییلدیریم',
 '11296e08bb33':'واکنش تورکان شورای به درگذشت ارسوی',
 '04570dd9dbff':'عکس کودکی پلین کاراهان خبرساز شد',
 '709cfe7b7189':'جشن چهارسالگی دختر مورات ییلدیریم',
 '3ac621b46c9e':'رنگ موی تازه نیلپری شاهین‌کایا',
 '693020f42e63':'پیش‌نمایش قسمت پنجم «سِودان بیر آتش»',
 'e150ce5f4e9f':'داماد روز عروسی خانه را اشتباه رفت',
 'b7e23b1d2ac9':'دمی رز ناگهان ناپدید شد',
 'd938529a4313':'ویدیوی عاشقانه بانو آلکان در هلند',
 'b54e0a588663':'مهمانی نازلی صابانجی برای فرزندش',
 '1d37134e6f2c':'لحظات شاد عزیز پیش از مرگ',
 'c4c8143a7f0a':'تغییرات بزرگ در سوروایور ۲۰۲۷'
};
function bbHeadline(s){
 let title=BB_HEADLINES[s.id]||s.headline_fa||'تازه‌های امروز در بادبادک';
 title=title.replace(/^(?:گزارش‌هایی درباره|گزارش‌هایی از|گزارش درباره|انتشار گزارش|بر اساس گزارش‌ها|اعلام خبر)\s+/,'').replace(/\s+/g,' ').trim();
 const words=title.split(/\s+/);
 if(words.length<=7)return title;
 // Keep the main clause and its wording; the full headline remains on the article.
 const clause=title.split(/[؛؛:!?؟]/)[0].trim().split(/\s+/);
 let brief=(clause.length>=4?clause:words).slice(0,7);
 while(brief.length>4&&/^(و|از|به|با|در|برای|درباره|که|را)$/.test(brief.at(-1)))brief.pop();
 return brief.join(' ').replace(/[،؛:]$/,'')+'…';
}
function bbStoryImage(s){return bbSafeImage(s.image_url)||bbSafeImage(s.bb_fallback_image);}
function bbImageError(img){
 const story=[..._bbStories,..._bbMeshkiNews].find(s=>s.image_url===img.getAttribute('src'));
 const fallback=bbSafeImage(story?.bb_fallback_image);
 if(fallback&&img.getAttribute('src')!==fallback){img.src=fallback;return;}
 img.hidden=true;
}
function bbSeriesSection(){
 if(!_bbSeries.length||!['all','celeb','turkish'].includes(_bbCategory))return '';
 return `<section class="bb-series-section"><h2 class="bb-section-head">امشب با سریال‌های ترکی</h2><div class="bb-series-strip">${_bbSeries.map(r=>`<a class="bb-series-card" href="${esc(MESHKI_ROOT+'dizi/'+encodeURIComponent(r.slug)+'/')}" target="_blank" rel="noopener"><img src="${esc(r.hero)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true"><strong>${esc(r.titleFa||r.titleTr)}</strong><span>${esc(r.airing||r.day||'')}</span></a>`).join('')}</div><a class="bb-partner" href="${MESHKI_ROOT}" target="_blank" rel="noopener">مشکی‌مدیا</a></section>`;
}
function showBadbadakCrossword(){
 _bbPage='crossword';show('badbadak');setTab('');setHash('#/badbadak/crossword');document.title='جدول کلمات متقاطع | بادبادک | پندار';
 document.getElementById('badbadak-content').innerHTML='<section class="bb-crossword"><div class="bb-game-heading"><div><h2>جدول کلمات متقاطع</h2><p>یک جدول انتخاب کن و شروع کن.</p></div><a href="/badbadak/">بادبادک</a></div><iframe title="بازی جدول کلمات فارسی" src="https://blankuapp.github.io/PersianCrossword/" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer"></iframe><p class="bb-partner"><a href="https://blankuapp.github.io/PersianCrossword/" target="_blank" rel="noopener">نمای تمام‌صفحه</a> · جدول کلمات فارسی</p></section>';
}
