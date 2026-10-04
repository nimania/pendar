/* Public, stateless Divar preview. City IDs come from Divar's own directory. */
let bookMarketState={query:'رمان',place:'سراسر ایران',items:null,note:'',busy:false,generation:0,limit:12};
let bookMarketQueue=Promise.resolve(),bookMarketLast=0,bookAdGeneration=0;
const bookAdCache=new Map();
function _bookMarketCompact(v){return _bookNorm(v).replace(/[^\p{L}\p{N}]/gu,'').replace(/آ/g,'ا')}
function _bookMarketPlace(value){
 const d=window.__BOOK_PLACES__||{},key=_bookMarketCompact(value);
 if(!key||key===_bookMarketCompact('سراسر ایران'))return {name_fa:'سراسر ایران',cities:(d.provinces||[]).map(p=>p.id),slug:'iran'};
 const p=(d.provinces||[]).find(p=>['استان '+p.name_fa,p.slug,p.id].some(x=>_bookMarketCompact(x)===key));
 if(p)return {...p,cities:[p.id]};
 const c=(d.cities||[]).find(p=>[p.name_fa,p.slug,p.id].some(x=>_bookMarketCompact(x)===key));return c?{...c,cities:[c.id]}:null;
}
function _bookMarketDecode(raw){
 let message;try{message=JSON.parse(raw)}catch(_){for(const line of raw.split('\n'))if(line.startsWith('data:')){try{const m=JSON.parse(line.slice(5));if(m.result||m.error)message=m}catch(_){}}}
 if(!message||message.error||message.result?.isError)throw Error('پاسخ آگهی دریافت نشد');
 const blocks=message.result?.content||[];for(const b of blocks)if(b.type==='text'){try{const data=JSON.parse(b.text);if(data.error)throw Error('خطای سرویس آگهی');return data}catch(e){if(e.message==='خطای سرویس آگهی')throw e}}
 throw Error('پاسخ آگهی قابل خواندن نیست');
}
function _bookMarketRPC(name,args,stillWanted=()=>true){
 const work=async()=>{if(!stillWanted())throw Error('cancelled');const delay=Math.max(0,3200-(Date.now()-bookMarketLast));if(delay)await new Promise(r=>setTimeout(r,delay));if(!stillWanted())throw Error('cancelled');bookMarketLast=Date.now();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),28000);
 try{const r=await fetch('https://divar-mcp.mmdju2.workers.dev/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name,arguments:args}}),signal:controller.signal});if(!r.ok)throw Error('سرویس آگهی فعلاً در دسترس نیست');return _bookMarketDecode(await r.text())}finally{clearTimeout(timer)}};
 const job=bookMarketQueue.then(work,work);bookMarketQueue=job.catch(()=>{});return job;
}
function _bookAdPhoto(url){try{const u=new URL(url);return u.protocol==='https:'&&/^s\d+\.divarcdn\.com$/.test(u.hostname)?u.href:''}catch(_){return ''}}
function _bookAdURL(token){return /^[A-Za-z0-9_-]+$/.test(token||'')?'https://divar.ir/v/'+token:''}
function _bookDivarSearchUrl(query,placeValue='سراسر ایران'){
 const place=_bookMarketPlace(placeValue)||{slug:'iran'};
 const slug=place.slug&&place.slug!=='iran'?place.slug:'iran';
 return 'https://divar.ir/s/'+encodeURIComponent(slug)+'/book-student-literature?q='+encodeURIComponent(String(query||'').trim());
}
function _bookMarketNormalize(data,query){
 if(data.unknown_cities?.length||data.category_note||data.filters_not_applied?.category)throw Error('محدودهٔ جست‌وجو اعمال نشد');
 const now=new Date().toISOString();return (data.items||[]).filter(r=>_bookAdURL(r.token)===r.url&&_bookMarketCompact(r.title).includes(_bookMarketCompact(query))).map(r=>({token:r.token,title_fa:r.title,url:r.url,city:r.city,thumbnail:_bookAdPhoto(r.thumbnail),observed_at:now,asking_price_toman:!r.negotiable&&!r.price_is_placeholder&&Number(r.price_toman)>0?Number(r.price_toman):null,price_label_fa:'توافقی / نامشخص'}));
}
function _bookMarketRows(data){
 if(bookMarketState.items!==null)return bookMarketState.items;
 const g=data.radar?.classifieds?.groups?.find(g=>g.query===bookMarketState.query);return g?.items||[];
}
function _bookUsedCards(rows){return rows.length?`<div class="book-ad-grid">${rows.map(r=>`<article class="book-ad-card">${_bookAdPhoto(r.thumbnail)?`<img src="${esc(_bookAdPhoto(r.thumbnail))}" alt="" loading="lazy" onerror="this.remove()">`:'<span class="book-ad-placeholder">کتاب</span>'}<span class="book-ad-copy"><small>${esc(r.city||'شهر نامشخص')}</small><button class="book-ad-preview" ${_bookAction('openBookAd',r.token)}><strong>${esc(r.title_fa)}</strong><b>${r.asking_price_toman?_toman(r.asking_price_toman):esc(r.price_label_fa||'قیمت نامشخص')}</b></button><a href="${esc(_bookAdURL(r.token))}" target="_blank" rel="noopener noreferrer">باز کردن در دیوار ↗</a></span></article>`).join('')}</div>`:'<p class="book-method">آگهی‌ای در نمونهٔ فعلی پیدا نشد.</p>'}
function _bookUsedMarket(data){
 const places=window.__BOOK_PLACES__||{},s=bookMarketState;
 return `<section id="book-used-market" class="book-used-market"><div class="book-section-title"><h2>کتاب، از دستِ دیگر</h2><span>${_bookSourceIcon('divar')} ${faN((places.cities||[]).length)} شهر</span></div><form class="book-market-form" onsubmit="event.preventDefault();searchBookMarket()"><input id="book-market-query" aria-label="عنوان در بازار آگهی" placeholder="نام کتاب یا رمان…" maxlength="120" value="${esc(s.query)}"><input id="book-market-place" aria-label="شهر یا استان آگهی" list="book-market-places" placeholder="شهر یا استان" value="${esc(s.place)}" onfocus="this.select()"><datalist id="book-market-places"><option value="سراسر ایران"></option>${(places.provinces||[]).map(p=>`<option value="استان ${esc(p.name_fa)}"></option>`).join('')}${(places.cities||[]).map(p=>`<option value="${esc(p.name_fa)}"></option>`).join('')}</datalist><button class="book-primary-action" type="submit">به‌روزرسانی</button>${s.busy?'<button type="button" class="book-share" onclick="cancelBookMarket()">توقف</button>':''}</form><div class="book-used-shortcuts"><a id="book-market-direct" class="book-share" href="${esc(_bookDivarSearchUrl(s.query,s.place))}" target="_blank" rel="noopener noreferrer">جست‌وجوی همین عبارت در دیوار ↗</a></div><p id="book-market-note" class="book-method" role="status">${esc(s.note||'نمونهٔ آگهی‌ها از هر ۳۱ استان؛ برای نتیجهٔ تازه جست‌وجو کن.')}</p><div id="book-market-results">${_bookUsedCards(_bookMarketRows(data).slice(0,s.limit))}</div><button id="book-market-more" class="book-load-more" onclick="bookMarketState.limit+=12;renderBookMarketResults()" ${_bookMarketRows(data).length>s.limit?'':'hidden'}>آگهی‌های بیشتر</button><p class="book-method">قیمت، مبلغ اعلامی فروشنده است. سلامت کتاب، نسخه، نو یا دست‌دوم بودن و موجودی را در آگهی بررسی کن.</p></section>`;
}
function renderBookMarketResults(){const el=document.getElementById('book-market-results');if(!el||!booksCache)return;const rows=_bookMarketRows(booksCache);el.innerHTML=_bookUsedCards(rows.slice(0,bookMarketState.limit));const more=document.getElementById('book-market-more');if(more)more.hidden=rows.length<=bookMarketState.limit;const note=document.getElementById('book-market-note');if(note)note.textContent=bookMarketState.note;const direct=document.getElementById('book-market-direct');if(direct)direct.href=_bookDivarSearchUrl(bookMarketState.query,bookMarketState.place)}
function cancelBookMarket(){bookMarketState.generation++;bookMarketState.busy=false;bookMarketState.note='جست‌وجو متوقف شد؛ نتایج دریافت‌شده باقی مانده‌اند.';renderBookUsedMarket()}
function renderBookUsedMarket(){const el=document.getElementById('book-used-market');if(el&&booksCache)el.outerHTML=_bookUsedMarket(booksCache)}
async function searchBookMarket(){
 const s=bookMarketState,query=(document.getElementById('book-market-query')?.value||s.query).trim().slice(0,120),value=document.getElementById('book-market-place')?.value||s.place,place=_bookMarketPlace(value);
 if(!query||!place){s.note=!place?'شهر یا استان را از فهرست انتخاب کن.':'نام کتاب را بنویس.';renderBookMarketResults();return}
 const gen=++s.generation;s.query=query;s.place=value;s.items=[];s.limit=12;s.busy=true;s.note='در حال جست‌وجو…';renderBookUsedMarket();let failed=0;
 for(let i=0;i<place.cities.length;i+=5){if(gen!==s.generation)return;try{const raw=await _bookMarketRPC('search_ads',{query,category:'book-student-literature',cities:place.cities.slice(i,i+5),limit:30},()=>gen===s.generation);if(gen!==s.generation)return;const rows=_bookMarketNormalize(raw,query);s.items=[...new Map([...s.items,...rows].map(r=>[r.token,r])).values()]}catch(_){if(gen!==s.generation)return;failed++}s.note=`${faN(s.items.length)} آگهی · ${place.name_fa} · ${faN(Math.min(i+5,place.cities.length))} از ${faN(place.cities.length)} محدوده بررسی شد`;renderBookMarketResults()}
 if(gen!==s.generation)return;s.busy=false;s.note=`${faN(s.items.length)} آگهی · ${place.name_fa} · جست‌وجوی همین لحظه${failed?' · '+faN(failed)+' محدوده دریافت نشد':''}`;renderBookUsedMarket();
}
function _bookUsedDossier(b,data){
 const group=data.radar?.classifieds?.groups?.find(g=>g.book_slug===b.slug);
 const direct=_bookDivarSearchUrl(b.title_fa,'سراسر ایران');
 const rows=group?.items||[];
 return `<section class="book-used-dossier" id="book-used-${esc(b.slug)}" data-used-book-title="${esc(b.title_fa)}"><div class="book-section-title"><h2>نسخهٔ دست‌دوم ${_bookSourceIcon('divar')}</h2><a class="book-share" href="${esc(direct)}" target="_blank" rel="noopener noreferrer">جست‌وجو در دیوار ↗</a></div><p class="book-method" id="book-used-note-${esc(b.slug)}">${rows.length?faN(rows.length)+' آگهی ذخیره‌شده؛ جست‌وجوی تازه خودکار شروع می‌شود.':'جست‌وجوی تازهٔ این عنوان در دیوار خودکار شروع می‌شود.'}</p><div id="book-used-results-${esc(b.slug)}">${_bookUsedCards(rows.slice(0,6))}</div></section>`;
}
async function autoSearchUsedBook(title,slug){
 const s=bookMarketState;
 const gen=++s.generation;
 s.query=title;s.place='سراسر ایران';s.items=[];s.limit=6;s.busy=true;
 const place=_bookMarketPlace('سراسر ایران'),note=document.getElementById('book-used-note-'+slug),out=document.getElementById('book-used-results-'+slug);
 let failed=0;
 for(let i=0;i<place.cities.length;i+=5){
   if(gen!==s.generation||!document.getElementById('book-used-'+slug))return;
   try{
     const raw=await _bookMarketRPC('search_ads',{query:title,category:'book-student-literature',cities:place.cities.slice(i,i+5),limit:30},()=>gen===s.generation&&!!document.getElementById('book-used-'+slug));
     const rows=_bookMarketNormalize(raw,title);
     s.items=[...new Map([...s.items,...rows].map(r=>[r.token,r])).values()];
   }catch(_){failed++}
   if(out)out.innerHTML=_bookUsedCards(s.items.slice(0,6));
   if(note)note.textContent=`${faN(s.items.length)} آگهی تازه · ${faN(Math.min(i+5,place.cities.length))} از ${faN(place.cities.length)} محدوده بررسی شد`;
 }
 if(gen!==s.generation)return;
 s.busy=false;
 if(note)note.textContent=`${faN(s.items.length)} آگهی تازه از سراسر ایران${failed?' · '+faN(failed)+' محدوده دریافت نشد':''}`;
}

async function findUsedBook(title){bookMarketState.query=title;bookMarketState.items=null;bookMarketState.note='';await showBooks('used');await searchBookMarket()}
function closeBookAd(){bookAdGeneration++;const dialog=document.getElementById('book-ad-dialog');if(dialog?.open)dialog.close()}
function _bookAdBody(r,detail,note){const photos=(detail?.images||[r.thumbnail]).map(_bookAdPhoto).filter(Boolean),price=r.asking_price_toman;return `<button class="book-ad-close book-share" onclick="closeBookAd()" aria-label="بستن آگهی">بستن ×</button><div class="book-ad-gallery">${photos.map(p=>`<img src="${esc(p)}" alt="عکس آگهی ${esc(detail?.title||detail?.title_fa||r.title_fa||'کتاب')}" onerror="this.remove()">`).join('')}</div><div class="book-ad-content"><small>${_bookSourceIcon('divar')} ${esc([detail?.city||r.city,detail?.district].filter(Boolean).join(' · '))}</small><h2>${esc(detail?.title||detail?.title_fa||r.title_fa||'آگهی کتاب')}</h2><b>${price?_toman(price):esc(r.price_label_fa||'قیمت را در آگهی بررسی کن')}</b>${detail?.description?`<p class="book-ad-description">${esc(String(detail.description).slice(0,4000))}</p>`:''}${(detail?.specs||[]).length?`<dl class="book-ad-specs">${detail.specs.slice(0,12).map(x=>`<div><dt>${esc(x.title)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>`:''}<p class="book-method" role="status">${esc(note)}</p><a class="book-primary-action" href="${esc(_bookAdURL(r.token))}" target="_blank" rel="noopener noreferrer">تماس با فروشنده در دیوار ↗</a></div>`}
async function openBookAd(token){
 if(!_bookAdURL(token))return;let dialog=document.getElementById('book-ad-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='book-ad-dialog';dialog.className='book-ad-dialog';dialog.addEventListener('click',e=>{if(e.target===dialog)closeBookAd()});dialog.addEventListener('cancel',()=>{bookAdGeneration++});document.body.append(dialog)}
 const gen=++bookAdGeneration,r=(bookMarketState.items||[]).find(r=>r.token===token)||(booksCache?.radar?.classifieds?.groups||[]).flatMap(g=>g.items).find(r=>r.token===token)||{token};
 const cached=bookAdCache.get(token)||r.preview;dialog.innerHTML=_bookAdBody(r,cached,cached?'در حال بررسی آخرین وضعیت آگهی…':'در حال دریافت عکس و توضیح آگهی…');if(!dialog.open)dialog.showModal();
 try{const d=await _bookMarketRPC('ad_details',{token,detail:'full'},()=>gen===bookAdGeneration);if(gen!==bookAdGeneration||!dialog.open)return;if(d.url!==_bookAdURL(token)||!d.title)throw Error('آگهی در دسترس نیست');bookAdCache.set(token,d);const updated={...r,asking_price_toman:!d.negotiable&&!d.price_is_placeholder&&Number(d.price_toman)>0?Number(d.price_toman):null};dialog.innerHTML=_bookAdBody(updated,d,'وضعیت آگهی همین لحظه بررسی شد.')}catch(_){if(gen===bookAdGeneration&&dialog.open)dialog.innerHTML=_bookAdBody(r,cached,'جزئیات تازه دریافت نشد؛ برای وضعیت فعلی صفحهٔ دیوار را ببین.')}
}
