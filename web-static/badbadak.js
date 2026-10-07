/* Badbadak: an editorial lens over Pendar's existing datasets. */
const BB_CATEGORIES = [ ['all','همه'], ['celeb','سلبریتی'], ['beauty','آرایش و زیبایی'], ['health','سلامت'], ['style','مُد و استایل'], ['food','خوراکی'], ['buzz','جنجال و حوادث'], ['tech','تکنولوژی'], ['travel','سفر'] ];
let _badbadakLoaded=false, _bbLoading=null, _bbStories=[], _bbPeople=[], _bbTrends=[], _bbCategory='all';
function bbCategory(s){
 const t=s.headline_fa||s.title_fa||s.title||'';
 if(/نفتکش|سپاه|موشک|حمله نظامی|تنگه هرمز|غزه|جنگ|سفیر|دیپلمات|وزیر|رئیس‌جمهور|جاسوسی|تروریست|پایگاه نظامی|ناتو/.test(t)&&!/بازیگر|خواننده|هنرمند/.test(t))return null;
 for(const [key,re] of [['celeb',/بازیگر|خواننده|سینما|سریال|هنرمند|کنسرت|سلبریتی|جشنواره.*فیلم|منوچهر هادی|یکتا ناصر/],['beauty',/آرایش|زیبایی|پوست(?:\s|$)|موهای|مراقبت.*مو/],['food',/خوراک|غذا|رستوران|آشپزی|تغذیه|قهوه|شیرینی/],['style',/پوشاک|لباس|استایل|فشن|طراح.*مد/],['health',/سلامت|پزشکی|بیماری|درمان|بهداشت|طاعون/],['travel',/گردشگری|هتل|مقصد.*سفر/],['tech',/فناوری|هوش مصنوعی|تکنولوژی|گجت|آیفون/],['buzz',/حادثه|تصادف|آتش.سوزی|جنجال|حاشیه|قتل|شهربازی/]])if(re.test(t))return key;
 return null;
}
function bbLabel(k){return BB_CATEGORIES.find(c=>c[0]===k)?.[1]||'تازه‌ها';}
function bbSafeImage(u){return typeof u==='string'&&(/^(https?:\/\/|assets\/)/.test(u))?u:'';}
function bbStoryURL(s){return routeURL('#/story/'+encodeURIComponent(s.id));}
function bbCard(s,hero=false){
 const img=bbSafeImage(s.image_url),category=bbCategory(s);
 return `<a class="${hero?'bb-hero':'bb-card'}" href="${esc(bbStoryURL(s))}">${img?`<img src="${esc(img)}" alt="" ${hero?'fetchpriority="high"':'loading="lazy"'} onerror="this.hidden=true">`:''}<div class="bb-card-copy"><span class="bb-category cat-${category}">${esc(bbLabel(category))}</span><${hero?'h2':'h3'}>${esc(s.headline_fa||'خبر تازه')}</${hero?'h2':'h3'}>${hero&&s.summary_fa?`<p>${esc(s.summary_fa.slice(0,240))}</p>`:''}<span class="bb-meta">${faN(s.source_count||1)} منبع${s.published_at?' · '+esc(relTime(s.published_at)):''}</span></div></a>`;
}
function showBadbadak(){show('badbadak');setTab('');setHash('#/badbadak');document.title='بادبادک | چهره‌ها، سبک زندگی و سرگرمی | پندار';return renderBadbadak();}
async function renderBadbadak(){
 if(_badbadakLoaded){bbRender();return;}
 if(_bbLoading)return _bbLoading;
 const el=document.getElementById('badbadak-content');el.innerHTML='<div class="state" role="status">در حال آوردن تازه‌های بادبادک…</div>';
 _bbLoading=(async()=>{
 try{
 const results=await Promise.allSettled([ALL.length?Promise.resolve(ALL):getJSON(`${DATA}/stories.json`),getJSON(`${DATA}/figures.json`),getJSON(`${DATA}/entities.json`),getJSON(`${DATA}/trends.json`)]);
 if(results[0].status!=='fulfilled')throw new Error('stories');
 const data=results[0].value;const stories=Array.isArray(data)?data:data.stories||[];
 const now=Date.now();const age=s=>Math.max(0,(now-Date.parse(s.last_seen||s.published_at||s.first_seen||''))/86400000)||0;
 _bbStories=stories.filter(s=>s.id&&bbCategory(s)).sort((a,b)=>(Math.log2(1+(b.source_count||1))*3-age(b)+(bbCategory(b)==='celeb'?5:0))-(Math.log2(1+(a.source_count||1))*3-age(a)+(bbCategory(a)==='celeb'?5:0))).slice(0,120);
 const figures=results[1].status==='fulfilled'?results[1].value:{};
 const registry=results[2].status==='fulfilled'?results[2].value:{};
 const entities=Array.isArray(registry)?registry:Array.isArray(registry.entities)?registry.entities:Object.values(registry.entities||{});
 const names=_bbStories.map(s=>s.headline_fa||'').join(' ');
 _bbPeople=[...(figures.figures||[]).map(f=>({...f,bbURL:routeURL('#/figure/'+encodeURIComponent(f.handle))})),...entities.filter(e=>e.type==='person'||e.kind==='person').map(e=>({...e,name_fa:e.name_fa||e.title,avatar:e.image_url||e.avatar||e.image?.path,bbURL:routeURL('#/entity/'+encodeURIComponent(e.id))}))].filter(p=>p.name_fa&&bbSafeImage(p.avatar)&&names.includes(p.name_fa)).filter((p,i,arr)=>arr.findIndex(x=>x.name_fa===p.name_fa)===i).slice(0,14);
 const trends=results[3].status==='fulfilled'?results[3].value:[];_bbTrends=(Array.isArray(trends)?trends:trends.trends||[]).filter(t=>t.id&&bbCategory(t)).slice(0,4);
 _badbadakLoaded=true;bbRender();
 }catch(e){el.innerHTML='<div class="state"><h2>تازه‌ها هنوز نرسیده‌اند</h2><p>دریافت خبرها انجام نشد.</p><button type="button" onclick="renderBadbadak()">تلاش دوباره</button></div>';}
 finally{_bbLoading=null;}
 })();return _bbLoading;
}
function bbFilter(k){_bbCategory=k;bbRender();}
function bbRender(){
 const stories=_bbStories.filter(s=>_bbCategory==='all'||bbCategory(s)===_bbCategory),hero=stories[0];
 const popular=[...stories].sort((a,b)=>(b.source_count||0)-(a.source_count||0)).slice(0,5);
 document.getElementById('badbadak-content').innerHTML=`
 <div class="bb-pills" role="group" aria-label="موضوع خبرها">${BB_CATEGORIES.map(([k,label])=>`<button type="button" aria-pressed="${k===_bbCategory}" onclick="bbFilter('${k}')">${label}</button>`).join('')}</div>
 ${hero?`<div class="bb-breaking"><b>روی موج</b><a href="${esc(bbStoryURL(hero))}">${esc(hero.headline_fa)}</a></div>`:''}
 ${_bbPeople.length?`<section><h2 class="bb-section-head">چهره‌های روی موج</h2><div class="bb-celeb-strip">${_bbPeople.map(p=>`<a href="${esc(p.bbURL)}"><img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.hidden=true"><span>${esc(p.name_fa)}</span></a>`).join('')}</div></section>`:''}
 <div class="bb-layout"><div>${hero?bbCard(hero,true):'<div class="state">فعلاً خبری در این موضوع نداریم؛ موضوع دیگری را انتخاب کن.</div>'}<div class="bb-grid">${stories.slice(1,25).map(s=>bbCard(s)).join('')}</div></div><aside class="bb-aside">
 <section class="bb-panel"><h2 class="bb-section-head">پربازتاب‌ترین‌ها</h2><p class="bb-meta">بر اساس تعداد منابع پوشش‌دهنده</p><ol class="bb-listicle">${popular.map(s=>`<li><a href="${esc(bbStoryURL(s))}">${esc(s.headline_fa)}</a><small>${faN(s.source_count||1)} منبع</small></li>`).join('')}</ol></section>
 ${_bbTrends.length?`<section class="bb-panel"><h2 class="bb-section-head">موضوعات روی موج</h2>${_bbTrends.map(t=>`<p><a href="${esc(routeURL('#/trend/'+encodeURIComponent(t.id)))}">${esc(t.title_fa||t.title||t.label||'موضوع روز')}</a></p>`).join('')}</section>`:''}
 <section class="bb-panel bb-poll"><h2 class="bb-section-head">انتخاب تو</h2><p>دوست داری در بادبادک بیشتر چه بخوانی؟</p><div id="bb-poll-options"></div><p class="bb-meta">انتخابت فقط در همین مرورگر ذخیره می‌شود.</p></section>
 <section class="bb-panel"><h2 class="bb-section-head">وقت تماشا و خواندن</h2><a class="bb-shortcut" href="/movies/">جان فیلم</a><a class="bb-shortcut" href="/tv/">راهنمای تماشا</a><a class="bb-shortcut" href="/books/">پیشخوان کتاب</a></section></aside></div>
 <section class="bb-panel bb-horoscope"><h2 class="bb-section-head">فال امروز، برای سرگرمی</h2><p class="bb-meta">یک جملهٔ بازیگوشانه برای روزت؛ صرفاً سرگرمی.</p><div class="bb-horo-strip">${['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((m,i)=>`<button type="button" onclick="bbHoroscope(${i},this)" aria-pressed="false"><span>${['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'][i]}</span>${m}</button>`).join('')}</div><p id="bb-horo-result" aria-live="polite">ماه تولدت را انتخاب کن.</p></section>`;bbPollRender();
}
function bbPollRender(){let choice='';try{choice=localStorage.getItem('bb-poll-v1')||'';}catch(_){}document.getElementById('bb-poll-options').innerHTML=['چهره‌ها و سرگرمی','خوراکی و سفر','زیبایی و استایل','سلامت و تکنولوژی'].map((s,i)=>`<button type="button" aria-pressed="${choice===String(i)}" onclick="bbVote(${i})">${choice===String(i)?'✓ ':''}${s}</button>`).join('');}
function bbVote(i){try{localStorage.setItem('bb-poll-v1',String(i));}catch(_){}bbPollRender();}
function bbHoroscope(i,button){const lines=['یک گفت‌وگوی عقب‌افتاده را شروع کن.','امروز برای یک خوشی کوچک وقت بگذار.','یک ایده را یادداشت کن؛ شاید فردا به کارت بیاید.','به کسی که دلت برایش تنگ شده پیام بده.','کاری را که دوست داری از قدم کوچک شروع کن.','جای یک چیز اضافه را خالی کن.','برای خودت هم به اندازه دیگران وقت بگذار.','امروز یک مسیر تازه را امتحان کن.','یک کتاب یا فیلم تازه کشف کن.','برنامه‌ات را کمی سبک‌تر بچین.','یک آهنگ قدیمی را دوباره گوش کن.','برای یک دیدار دوستانه وقت پیدا کن.'];const day=new Intl.DateTimeFormat('en',{timeZone:'Asia/Tehran',day:'numeric'}).format(new Date());document.querySelectorAll('.bb-horo-strip button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.getElementById('bb-horo-result').textContent=lines[(i+Number(day))%12];}
