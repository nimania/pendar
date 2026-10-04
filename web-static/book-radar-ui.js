/* Public evidence and source-aware discovery. No synthetic sales or reviews. */
// Editorial digests of source reviews read on 2026-10-04. Not full-book reviews.
const BOOK_READING_BRIEFS=[
  {title:'ده نفر قزلباش',reviewer:'بهاره ربیعی',summary:'رمان حسین مسرور، دربار، جنگ و روابط انسانیِ عصر صفوی را در روایتی حماسی کنار هم می‌گذارد. نقد منبع، فضاسازی و کشش داستان را از امتیازهای آن می‌داند.',caveat:'همان نقد به جانبداری از قهرمانان و طولانی‌شدن بعضی توصیف‌ها ایراد می‌گیرد. برای خوانندهٔ رمان تاریخی جذاب است؛ برداشت تاریخی‌اش را باید با پژوهش‌های مستقل سنجید.'},
  {title:'زنان زیرک',reviewer:'فاطمه فاطمی',summary:'کتاب شری آرگو دربارهٔ حفظ استقلال، عزت‌نفس و مرزهای شخصی در رابطه است. نقد منبع، مرز میان مراقبت از خود و تلاش افراطی برای راضی نگه‌داشتن طرف مقابل را بررسی می‌کند.',caveat:'پرسش محوری نقد این است که توصیه‌ها چه زمانی به رفتار حساب‌شده و بازی قدرت تبدیل می‌شوند. هنگام خواندن، میان مرزبندی سالم و کنترل رفتار شریک عاطفی تفاوت بگذار.'}
];
function _bookReadingBrief(r){const b=BOOK_READING_BRIEFS.find(b=>_bookNorm(r.title_fa).includes(_bookNorm(b.title)));return b?`<p>${esc(b.summary)}</p><p class="radar-brief-caveat">${esc(b.caveat)}</p><small>جمع‌بندیِ نقد ${esc(b.reviewer)} در ${esc(r.source_name)}</small>`:''}
function _bookPersonAllowed(name){return !/خمینی|خامنهای|پهلوی/.test(_bookNorm(name).replace(/[ ‌ـ‍]/g,''))}
function _bookOverlayRadar(data){
  const fallback=window.__BOOK_RADAR__;
  if(!fallback?.radar || String(data.radar?.updated_at||'')>=String(fallback.radar.updated_at||''))return data;
  const books=new Map((data.books||[]).map(b=>[b.slug,b]));
  for(const row of fallback.books||[]){const old=books.get(row.slug);books.set(row.slug,old?{...row,...old,radar:row.radar}:structuredClone(row))}
  data.books=[...books.values()];data.radar=structuredClone(fallback.radar);
  const people=new Map(),publishers=new Map();
  for(const b of data.books)for(const e of [b,...(b.editions||[])]){
    for(const c of e.creators||[]){if(!c.slug||!_bookPersonAllowed(c.name_fa))continue;let p=people.get(c.slug)||{slug:c.slug,name_fa:c.name_fa,roles_fa:[],book_slugs:[]};if(c.role_fa&&!p.roles_fa.includes(c.role_fa))p.roles_fa.push(c.role_fa);if(!p.book_slugs.includes(b.slug))p.book_slugs.push(b.slug);people.set(c.slug,p)}
    const c=e.publisher;if(c?.slug){let p=publishers.get(c.slug)||{slug:c.slug,name_fa:c.name_fa,categories_fa:[],book_slugs:[]};if(!p.book_slugs.includes(b.slug))p.book_slugs.push(b.slug);if(b.category_fa&&!p.categories_fa.includes(b.category_fa))p.categories_fa.push(b.category_fa);publishers.set(c.slug,p)}
  }
  data.people=[...people.values()];data.publishers=[...publishers.values()];return data;
}
function _bookRadarSignals(b){return (b.radar?.signals||[]).filter(r=>{const t=_bookDate(r.observed_at);return t&&Date.now()-t>=0&&Date.now()-t<=2*864e5})}
function _bookRadarScore(b){const scores=new Map();for(const r of _bookRadarSignals(b)){const n=(r.kind==='bestseller'?3:1)/(1+Math.max(0,r.position-1)/10);scores.set(r.source_id,Math.max(n,scores.get(r.source_id)||0))}return [...scores.values()].reduce((a,b)=>a+b,0)+Math.max(0,scores.size-1)}
function _bookRadarSources(b){return [...new Set(_bookRadarSignals(b).map(r=>r.source_id))]}
function _bookRadarChange(b){return _bookRadarSignals(b).length?Math.max(0,...(b.radar?.weekly_changes||[]).map(r=>r.change)):0}
function _bookRadarBadge(b){
  const rows=_bookRadarSignals(b),names=[...new Set(rows.map(r=>r.source_name))];
  return names.length?`${names.length>1?'چندمنبعی · ':''}${esc(names.join(' + '))}`:b.radar?'آخرین مشاهده: '+_bookChecked((b.radar.signals||[])[0]?.observed_at):`${faN(b.mention_count||0)} اشاره · ${faN(_bookStats(b).sources)} منبع`;
}
function _bookRadarMatches(b,state){
  const rows=_bookRadarSignals(b);
  if(state.source&&!rows.some(r=>r.source_id===state.source))return false;
  if(state.signal==='bestseller')return rows.some(r=>r.kind==='bestseller');
  if(state.signal==='new_to_store')return rows.some(r=>r.kind==='new_to_store');
  if(state.signal==='multi')return _bookRadarSources(b).length>1;
  if(state.signal==='rising')return _bookRadarChange(b)>0;
  if(state.signal==='news')return (b.mention_count||0)>0;
  return true;
}
function _bookRadarHome(data){
  if(!data.radar)return '';
  const ranked=(data.books||[]).filter(b=>_bookRadarScore(b)>0).sort((a,b)=>_bookRadarScore(b)-_bookRadarScore(a)||String(a.title_fa).localeCompare(String(b.title_fa),'fa')).slice(0,6);
  const fresh=(data.books||[]).filter(b=>_bookRadarSignals(b).some(r=>r.kind==='new_to_store')).sort((a,b)=>_bookRadarSources(b).length-_bookRadarSources(a).length).slice(0,6);
  const healthy=(data.radar.sources||[]).filter(s=>s.status==='ok');
  const shelves=(title,copy,books)=>books.length?`<section class="radar-shelf"><div class="book-section-title"><h2>${title}</h2><span>${copy}</span></div><div class="radar-cards">${books.map(b=>`<button class="radar-mini" ${_bookAction('openBook',b.slug)}><span class="radar-mini-cover">${_bookCover(b)}</span><strong>${esc(b.title_fa)}</strong><small>${esc((b.creators||[])[0]?.name_fa||'')}</small><em>${_bookRadarBadge(b)}</em></button>`).join('')}</div></section>`:'';
  return `<section class="radar-status"><span class="radar-live-dot"></span><strong>رادار مستقل کتاب</strong><span>آخرین پایش: ${_bookChecked(data.radar.updated_at)}</span><span>${faN(healthy.filter(s=>s.kind==='store').length)} فروشگاه · ${faN(healthy.filter(s=>['review_publication','store_editorial'].includes(s.kind)).length)} منبع معرفی و نقد${healthy.some(s=>s.kind==='classifieds')?' · بازار آگهی‌های دیوار':''}</span><details><summary>منابع و روش انتخاب</summary><p>این شاخص از حضور و جایگاه کتاب در فهرست‌های پرفروش و تازه‌های فروشگاه‌ها ساخته می‌شود. حضور در چند فروشگاه وزن بیشتری دارد؛ صوتی و متنی یک فروشگاه، دو منبع حساب نمی‌شوند. تخفیف و امتیاز کاربران وزن ترند نمی‌گیرند.</p><p>دیجی‌کالا: پرفروش‌ها و جدیدترین‌های نتیجهٔ جست‌وجوی «کتاب»، با حذف مجموعه‌ها. فیدیبو: قفسه‌های پرفروش و تازه‌های متنی، به‌علاوهٔ تازه‌های صفحهٔ اصلی در صورت دسترسی. آگهی‌های دیوار در امتیاز رادار وارد نمی‌شوند.</p><p>جایگاه، ترتیب نمایش در فهرست است؛ تعداد فروش در دسترس نیست. رشد هفتگی فقط بعد از ثبت مشاهدات قابل مقایسه در دو هفته نمایش داده می‌شود.</p><div class="radar-source-list">${(data.radar.sources||[]).map(s=>`<a href="${esc(_bookUrl(s.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(s.name_fa)}</b><span>${s.status==='ok'?'پایش موفق':'فعلاً دریافت نشد'} · ${s.last_success_at?_bookChecked(s.last_success_at):'بدون مشاهدهٔ موفق'}${s.note_fa?' · '+esc(s.note_fa):''}</span></a>`).join('')}</div></details></section>${shelves('اکنون در رادار','بر پایهٔ فهرست‌های فروشگاه‌های پایش‌شده',ranked)}${shelves('تازه روی قفسه‌ها','تازه در فهرستِ فروشگاه؛ تاریخ انتشارِ اثر نیست',fresh)}`;
}

const BOOK_USED_CITIES=[['tehran','تهران'],['karaj','کرج'],['mashhad','مشهد'],['isfahan','اصفهان'],['shiraz','شیراز']];
let bookUsedCity='',bookUsedQuery='رمان';
function _bookUsedRows(group){return (group?.items||[]).filter(r=>!bookUsedCity||r.city===BOOK_USED_CITIES.find(c=>c[0]===bookUsedCity)?.[1]).slice(0,6)}
function _bookUsedCards(rows){return rows.length?`<div class="book-used-grid">${rows.map(r=>`<a href="${esc(_bookUrl(r.url))}" target="_blank" rel="noopener noreferrer"><small>دیوار · ${esc(r.city||'شهر نامشخص')} · پایش ${_bookChecked(r.observed_at)}</small><strong>${esc(r.title_fa)}</strong><b>${r.asking_price_toman?_toman(r.asking_price_toman):esc(r.price_label_fa)}</b><span>دیدن و بررسی آگهی ↗</span></a>`).join('')}</div>`:'<p class="book-method">در نمونهٔ ثبت‌شده، آگهی‌ای برای این انتخاب پیدا نشد. جست‌وجوی مستقیم دیوار را بررسی کن.</p>'}
function _bookDivarSearch(query,city='iran'){return 'https://divar.ir/s/'+city+'/book-student-literature?q='+encodeURIComponent(query)}
function _bookUsedMarket(data){
  const market=data.radar?.classifieds;if(!market?.groups?.length)return '';
  const group=market.groups.find(g=>g.query===bookUsedQuery)||market.groups[0];
  const date=_bookDate(group.observed_at),stale=!date||Date.now()-date>48*36e5;
  return `<section class="book-used-market" id="book-used-market"><div class="book-section-title"><h2>بازار کتاب دست‌دوم</h2><span>نمونهٔ آگهی‌های دیوار · ۵ شهر</span></div><p class="book-method">قیمت‌ها، قیمت اعلامیِ آگهی‌اند. نو یا دست‌دوم بودن، نسخه و موجودبودن نیازمند بررسی است؛ آگهیِ مجموعه ممکن است قیمت چند کتاب را نشان دهد.${stale?' این نمونه قدیمی است؛ برای آگهی‌های فعلی جست‌وجوی مستقیم را باز کن.':''}</p><div class="book-used-controls"><select aria-label="شهر آگهی‌های کتاب" onchange="bookUsedCity=this.value;renderBookUsedMarket()"><option value="">همهٔ شهرهای نمونه</option>${BOOK_USED_CITIES.map(([v,t])=>`<option value="${v}" ${bookUsedCity===v?'selected':''}>${t}</option>`).join('')}</select><select aria-label="عنوان در بازار آگهی" onchange="bookUsedQuery=this.value;renderBookUsedMarket()">${market.groups.map(g=>`<option value="${esc(g.query)}" ${group.query===g.query?'selected':''}>${esc(g.query)}</option>`).join('')}</select><a href="${esc(_bookDivarSearch(group.query,bookUsedCity||'iran'))}" target="_blank" rel="noopener noreferrer">جست‌وجوی فعلی در دیوار ↗</a></div>${_bookUsedCards(_bookUsedRows(group))}</section>`;
}
function renderBookUsedMarket(){const el=document.getElementById('book-used-market');if(el&&booksCache)el.outerHTML=_bookUsedMarket(booksCache)}
function _bookUsedDossier(b,data){
  const group=data.radar?.classifieds?.groups?.find(g=>g.book_slug===b.slug);
  return `<section class="book-used-dossier"><div class="book-section-title"><h2>پیداکردن نسخهٔ دست‌دوم</h2><span>دیوار</span></div><p class="book-method">این‌ها نتایج جست‌وجوی عنوان‌اند؛ نویسنده، مترجم، ناشر، سلامت کتاب و قیمت را در آگهی بررسی کن.</p>${group?_bookUsedCards(group.items.slice(0,6)):''}<div class="book-used-searches">${BOOK_USED_CITIES.map(([city,label])=>`<a href="${esc(_bookDivarSearch(b.title_fa,city))}" target="_blank" rel="noopener noreferrer">جست‌وجو در ${label} ↗</a>`).join('')}</div></section>`;
}
function _bookRadarReading(data){
  const rows=(data.radar?.reading||[]).filter(r=>{const d=_bookDate(r.published_at);return d&&Date.now()-d>=0&&Date.now()-d<45*864e5}).sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at))).slice(0,6);
  return rows.length?`<section class="radar-reading"><div class="book-section-title"><h2>میز معرفی و نقد</h2><span>از رسانه‌های کتاب؛ با ذکر منبع</span></div><div class="radar-reading-grid">${rows.map(r=>`<a href="${esc(_bookUrl(r.url))}" target="_blank" rel="noopener noreferrer"><small>${esc(r.source_name)} · ${_bookChecked(r.published_at)}</small><strong>${esc(r.title_fa)}</strong>${_bookReadingBrief(r)}<span>${r.source_type==='store_editorial'?'مطلبِ مجلهٔ فروشگاه':'مطلبِ نشریه'} ↗</span></a>`).join('')}</div></section>`:'';
}
function _bookRadarDossier(b,data){
  if(!b.radar)return '';
  const rows=_bookRadarSignals(b),all=rows.length?rows:b.radar.signals||[];
  const reviews=(data.radar?.reading||[]).filter(r=>_bookNorm(b.title_fa).length>=8&&_bookNorm(r.title_fa).includes(_bookNorm(b.title_fa))&&!/فیلم/.test(r.title_fa));
  const editions=b.editions||[],translators=[...new Set(editions.flatMap(e=>(e.creators||[]).filter(c=>c.role_fa==='مترجم').map(c=>c.name_fa)))];
  return `<section class="radar-dossier"><div class="book-section-title"><h2>پروندهٔ بررسی اولیه</h2><span>شواهد توجه و انتخاب نسخه</span></div><div class="radar-dossier-intro"><p>${esc(b.title_fa)} اثر ${esc((b.creators||[]).map(c=>c.name_fa).join('، '))}${b.subtitle_fa?'؛ '+esc(b.subtitle_fa):''}.</p><p>${rows.length?`${faN(_bookRadarSources(b).length)} فروشگاه در آخرین پایش، این عنوان را در فهرست‌های زیر نشان داده‌اند.`:'این شواهد از پایش قبلی است و اکنون تازه محسوب نمی‌شود.'}</p></div><div class="radar-evidence">${all.map(r=>`<a href="${esc(_bookUrl(r.list_url))}" target="_blank" rel="noopener noreferrer"><div><b>${esc(r.source_name)}</b><strong>${esc(r.list_label)}</strong><small>${BOOK_FORMATS[r.format]} · جایگاه در فهرست: ${faN(r.position)} · ${_bookChecked(r.observed_at)}</small></div>${r.rating_count?`<span class="radar-rating">${Number(r.rating).toLocaleString('fa-IR',{maximumFractionDigits:1})} از ۵<small>${faN(r.rating_count)} رأی کاربرانِ این نسخه</small></span>`:''}<span>↗</span></a>`).join('')}</div>${(b.radar.weekly_changes||[]).length?`<p class="book-method">تغییر جایگاه نسبت به هفتهٔ قبل: ${(b.radar.weekly_changes||[]).map(r=>esc(r.source)+' ('+BOOK_FORMATS[r.format]+'): '+(r.change>0?'↑ '+faN(r.change):r.change<0?'↓ '+faN(-r.change):'بدون تغییر')).join(' · ')}</p>`:'<p class="book-method">برای مقایسهٔ هفتگی هنوز سابقهٔ کافی ثبت نشده است.</p>'}<div class="radar-version-note"><h3>پیش از انتخاب نسخه</h3><p>${faN(editions.length)} نسخه در فروشگاه‌ها پیدا شده است.${translators.length?' مترجم‌های ثبت‌شده: '+esc(translators.join('، '))+'.':' اطلاعات مترجم همهٔ نسخه‌ها هنوز کامل نیست.'} مترجم، ناشر، نمونهٔ متن یا صدای گوینده را در صفحهٔ همان نسخه بررسی کن.</p></div>${reviews.length?`<h3>معرفی و نقد مرتبط</h3>${reviews.map(r=>`<a class="book-store-row" href="${esc(_bookUrl(r.url))}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.title_fa)}</strong><small>${esc(r.source_name)}</small></a>`).join('')}`:'<p class="book-method">هنوز نقدِ مرتبط و تأییدشده‌ای برای این عنوان ثبت نشده است.</p>'}<p class="book-method">این بررسی بر پایهٔ داده‌های نسخه و فهرست‌های فروشگاه‌هاست. حضور در فهرست و رأی کاربران به‌تنهایی کیفیت محتوای کتاب را تأیید نمی‌کند.</p></section>`;
}
