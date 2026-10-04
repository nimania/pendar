/* Book discovery and commerce: edition-aware, with honest dated snapshots. */
const BOOK_FORMATS = {print:'چاپی',ebook:'الکترونیکی',audio:'صوتی',multi:'نسخه‌های مختلف'};
let bookLibraryState = {query:'',category:'',format:'',sort:'recent',saved:false};
function _bookNorm(v){return String(v||'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ').replace(/\s+/g,' ').trim().toLowerCase()}
function _bookUrl(v){try{const u=new URL(v,location.href);return u.protocol==='https:'?u.href:''}catch(_){return ''}}
function _bookDate(v){if(!v)return null;const s=String(v);const d=new Date(/(Z|[+-]\d\d:?\d\d)$/.test(s)||/^\d{4}-\d{2}-\d{2}$/.test(s)?s:s+'Z');return Number.isFinite(+d)?d:null}
function _bookChecked(v){const d=_bookDate(v);return d?d.toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran',year:'numeric',month:'short',day:'numeric'}):'ثبت نشده'}
function _bookAction(fn,slug){return `onclick="${esc(fn+'('+JSON.stringify(slug)+')')}"`}
function _bookDiscovery(b){
  const english=String(b.language||b.source_lang||'fa').startsWith('en');
  const title=english?(b.title_en||b.original_title||b.title_fa):b.title_fa;
  const q=encodeURIComponent([title,!english?(b.creators||[])[0]?.name_fa:''].filter(Boolean).join(' '));
  const stores=english?[['Amazon','https://www.amazon.com/s?k=','multi'],['Google Books','https://books.google.com/books?q=','ebook'],['Kobo','https://www.kobo.com/search?query=','multi'],['Barnes & Noble','https://www.barnesandnoble.com/s/','multi']]:[['دیجی‌کالا','https://www.digikala.com/search/?q=','print'],['ایران‌کتاب','https://www.iranketab.ir/result/','print'],['۳۰بوک','https://www.30book.com/search?q=','print'],['شهر کتاب آنلاین','https://shahreketabonline.com/all-products?name=','print'],['طاقچه','https://taaghche.com/search?q=','multi'],['فیدیبو','https://fidibo.com/search?q=','multi'],['کتابراه','https://www.ketabrah.ir/search?q=','multi']];
  return stores.map(([store,url,format])=>({store,url:url+q,format,exact:false}));
}
function _bookFormat(l){return l.format||(/الکترونیک/.test(l.format_fa||'')?'ebook':/صوتی/.test(l.format_fa||'')?'audio':'print')}
function _curateBookData(data){
  const registry=window.__BOOK_CURATION__?.books||{};
  for(const b of data.books||[]){
    const c=registry[b.slug]||{};
    for(const k of ['cover_url','cover','isbn','publisher_url'])if(k in c)b[k]=c[k];
    const map=new Map();
    for(const l of [...(b.purchase_links||[]),...(c.purchase_links||[])])if(l.exact&&_bookUrl(l.url))map.set(l.url,l);
    b.purchase_links=[...map.values()];
    b.discovery_links=_bookDiscovery(b);
  }
  return data;
}
function _bookSaved(){try{const d=JSON.parse(localStorage.getItem('jankalam-reading-list')||'[]');return Array.isArray(d)?d.filter(x=>typeof x==='string'):[]}catch(_){return []}}
function toggleBookSaved(slug){
  const saved=new Set(_bookSaved());saved.has(slug)?saved.delete(slug):saved.add(slug);
  try{localStorage.setItem('jankalam-reading-list',JSON.stringify([...saved]));}catch(_){const notice=document.getElementById('book-action-note');if(notice)notice.textContent='ذخیره روی این مرورگر در دسترس نیست.';return}
  document.querySelectorAll('[data-save-book]').forEach(el=>{const on=saved.has(el.dataset.saveBook);el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on));el.textContent=on?'✓ در فهرست مطالعه':'＋ برای بعد'});
  if(bookLibraryState.saved&&document.getElementById('book-library-grid'))renderBookLibrary();
}
function _bookSaveButton(b){return `<button class="book-save ${_bookSaved().includes(b.slug)?'on':''}" data-save-book="${esc(b.slug)}" aria-pressed="${_bookSaved().includes(b.slug)}" ${_bookAction('toggleBookSaved',b.slug)}>${_bookSaved().includes(b.slug)?'✓ در فهرست مطالعه':'＋ برای بعد'}</button>`}
function _bookStats(b,now=Date.now()){
  const dates=(b.mentions||[]).map(m=>_bookDate(m.published_at)).filter(d=>d&&+d<=now);
  const recent=dates.filter(d=>now-d<=30*864e5).length,previous=dates.filter(d=>now-d>30*864e5&&now-d<=60*864e5).length;
  return {recent,previous,sources:new Set((b.mentions||[]).map(m=>_bookNorm(m.source_name)).filter(Boolean)).size,latest:Math.max(0,...dates.map(Number))};
}
function _bookQuote(b){
  const t=b.torob?.matched?b.torob:null;if(!t)return null;
  const offers=(t.offers||[]).filter(o=>o.available===true&&!o.price_unreliable&&Number(o.price_toman)>0&&_bookUrl(o.url));
  const min=offers.length?Math.min(...offers.map(o=>Number(o.price_toman))):t.available===true&&Number(t.price_toman)>0?Number(t.price_toman):null;
  const checked=offers.length?(t.offers_checked_at||t.checked_at):t.checked_at;
  const date=_bookDate(checked),stale=!date||Date.now()-date>48*36e5;
  return {price:min,offers,checked,stale};
}
function _bookLinks(b){return [...(b.purchase_links||[]),...(b.editions||[]).flatMap(e=>(e.purchase_links||[]).map(l=>({...l,edition_label_fa:e.label_fa})))] .filter(l=>l.exact&&_bookUrl(l.url))}
function _bookHasFormat(b,fmt){return !fmt||_bookLinks(b).some(l=>_bookFormat(l)===fmt)||(fmt==='print'&&b.torob?.matched)}
function _bookCover(b,detail=false){
  const source=String(b.cover_url||'');const safe=/^assets\/books\/[\w.-]+$/.test(source)||_bookUrl(source);
  return `<span class="book-cover-placeholder">${esc(b.title_fa||'کتاب')}</span>${safe?`<img class="book-cover" src="${esc(source)}" alt="جلد ${esc(b.title_fa||'کتاب')}" ${detail?'':'loading="lazy"'} referrerpolicy="no-referrer" onerror="this.remove()">`:''}`;
}
function _bookCard(b){
  const quote=_bookQuote(b),stats=_bookStats(b),creator=(b.creators||[]).find(c=>c.role_fa!=='مترجم')||(b.creators||[])[0];
  return `<article class="book-card hub-book-card"><button class="hub-book-open" ${_bookAction('openBook',b.slug)}><span class="book-cover-wrap">${_bookCover(b)}</span><span class="book-card-copy"><small class="book-topic">${esc(b.category_fa||'کتاب')}</small><strong>${esc(b.title_fa||'')}</strong>${creator?`<small>${esc(creator.name_fa)}</small>`:''}<span class="book-card-price">${quote?.price?`${quote.stale?'آخرین قیمت ثبت‌شده':'از'} ${_toman(quote.price)}`:_bookLinks(b).length?'خرید و مطالعه ↗':'کشف در فروشگاه‌ها ↗'}</span><em>${faN(b.mention_count||0)} اشاره · ${faN(stats.sources)} منبع</em></span></button>${_bookSaveButton(b)}</article>`;
}
function filterBookLibrary(q){bookLibraryState.query=q;renderBookLibrary()}
function setBookFilter(key,value){bookLibraryState[key]=value;renderBookLibrary()}
function renderBookLibrary(){
  const grid=document.getElementById('book-library-grid');if(!grid||!booksCache)return;
  const s=bookLibraryState,saved=new Set(_bookSaved());
  let books=(booksCache.books||[]).filter(b=>(b.mention_count||0)>0).filter(b=>!s.saved||saved.has(b.slug)).filter(b=>!s.category||b.category_fa===s.category).filter(b=>_bookHasFormat(b,s.format));
  const tokens=_bookNorm(s.query).split(' ').filter(Boolean);
  books=books.filter(b=>{const hay=_bookNorm([b.title_fa,b.subtitle_fa,b.original_title,b.category_fa,b.isbn,(b.creators||[]).map(c=>c.name_fa).join(' '),(b.editions||[]).flatMap(e=>(e.creators||[]).map(c=>c.name_fa)).join(' '),b.publisher?.name_fa].join(' '));return tokens.every(t=>hay.includes(t))});
  books.sort((a,b)=>s.sort==='mentions'?(b.mention_count||0)-(a.mention_count||0):s.sort==='price'?(_bookQuote(a)?.price??Infinity)-(_bookQuote(b)?.price??Infinity):s.sort==='title'?String(a.title_fa).localeCompare(String(b.title_fa),'fa'):_bookStats(b).latest-_bookStats(a).latest);
  grid.innerHTML=books.length?books.map(_bookCard).join(''):'<div class="state book-empty"><div class="big">کتابی با این انتخاب پیدا نشد</div><p>عبارت کوتاه‌تری بنویس یا فیلترها را تغییر بده.</p></div>';
  const count=document.getElementById('book-result-count');if(count)count.textContent=faN(books.length)+' کتاب';
  document.querySelectorAll('[data-library-saved]').forEach(el=>{el.classList.toggle('on',s.saved=== (el.dataset.librarySaved==='true'));el.setAttribute('aria-pressed',String(s.saved===(el.dataset.librarySaved==='true')))});
}
async function showBooks(mode='books'){
  show('books');setTab('');const lede=document.getElementById('books-lede');if(lede)lede.style.display='none';
  const el=document.getElementById('books-content');el.innerHTML='<div class="spinner"></div>';const d=await loadBooks();
  const tabs=`<div class="books-tabs"><button class="fchip ${mode==='books'?'on':''}" onclick="showBooks('books')">کتاب‌ها</button><button class="fchip ${mode==='people'?'on':''}" onclick="showBooks('people')">پدیدآورندگان</button><button class="fchip ${mode==='publishers'?'on':''}" onclick="showBooks('publishers')">ناشرها</button></div>`;
  if(mode!=='books'){
    const people=mode==='people',rows=(people?d.people:d.publishers)||[];
    el.innerHTML=`<div class="book-person-head"><span class="press-kicker">شبکهٔ کتاب</span><h1>${people?'پدیدآورندگان و مترجمان':'ناشرهای کتابخانه'}</h1></div>`+tabs+`<div class="publisher-grid">${rows.map(p=>`<button class="publisher-card" ${_bookAction(people?'openBookPerson':'openPublisher',p.slug)}><strong>${esc(p.name_fa)}</strong><small>${faN((p.book_slugs||[]).length)} کتاب</small><em>${esc((people?p.roles_fa:p.categories_fa||[]).join(' · '))}</em></button>`).join('')}</div>`;
  }else{
    const books=(d.books||[]).filter(b=>(b.mention_count||0)>0),mentions=books.reduce((n,b)=>n+(b.mention_count||0),0),ranked=books.filter(b=>_bookStats(b).recent>0).sort((a,b)=>_bookStats(b).recent-_bookStats(a).recent||_bookStats(b).sources-_bookStats(a).sources).slice(0,3);
    const options=[...new Set(books.map(b=>b.category_fa).filter(Boolean))];
    el.innerHTML=`<section class="book-hub-hero"><span class="press-kicker">از خبر و گفت‌وگو، تا قفسهٔ تو</span><h1>جانِ کتاب</h1><p>کتاب‌ها را کشف کن، ببین کجا درباره‌شان حرف زده‌اند و راه خرید یا خواندنشان را پیدا کن.</p><div class="book-library-stats"><span><b>${faN(books.length)}</b> کتاب</span><span><b>${faN(mentions)}</b> اشاره</span><span><b>${faN((d.people||[]).length)}</b> پدیدآورنده</span><span><b>${faN((d.publishers||[]).length)}</b> ناشر</span></div></section>${tabs}
    ${ranked.length?`<section class="book-trending"><div class="book-section-title"><h2>پربحث در ۳۰ روز اخیر</h2><span>در منابع پایش‌شدهٔ جان‌کلام</span></div><div class="book-trend-grid">${ranked.map((b,i)=>`<button class="book-trend" ${_bookAction('openBook',b.slug)}><span class="book-trend-rank">${faN(i+1)}</span><div><strong>${esc(b.title_fa)}</strong><small>${faN(_bookStats(b).recent)} اشاره در ۳۰ روز · ${faN(_bookStats(b).sources)} منبع در مجموع</small></div><span>↗</span></button>`).join('')}</div><p class="book-method">این فهرست میزان اشاره در جان‌کلام را نشان می‌دهد؛ دادهٔ فروش بازار نیست.</p></section>`:''}
    <section class="book-library-panel"><div class="book-section-title"><h2>قفسهٔ کتاب‌ها</h2><div class="book-list-tabs"><button data-library-saved="false" onclick="setBookFilter('saved',false)">همه</button><button data-library-saved="true" onclick="setBookFilter('saved',true)">فهرست مطالعهٔ من</button></div></div><div class="book-library-controls"><input type="search" placeholder="عنوان، نویسنده، مترجم یا شابک…" aria-label="جست‌وجوی کتابخانه" value="${esc(bookLibraryState.query)}" oninput="filterBookLibrary(this.value)"><select aria-label="موضوع کتاب" onchange="setBookFilter('category',this.value)"><option value="">همهٔ موضوع‌ها</option>${options.map(o=>`<option ${o===bookLibraryState.category?'selected':''} value="${esc(o)}">${esc(o)}</option>`).join('')}</select><select aria-label="نوع نسخه" onchange="setBookFilter('format',this.value)"><option value="">همهٔ نسخه‌ها</option>${['print','ebook','audio'].map(f=>`<option value="${f}" ${bookLibraryState.format===f?'selected':''}>${BOOK_FORMATS[f]}</option>`).join('')}</select><select aria-label="ترتیب کتاب‌ها" onchange="setBookFilter('sort',this.value)">${[['recent','آخرین اشاره'],['mentions','بیشترین اشاره'],['price','کمترین قیمت ثبت‌شده'],['title','الفبایی']].map(([v,t])=>`<option value="${v}" ${bookLibraryState.sort===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="book-results-line"><span id="book-result-count"></span><span>فهرست مطالعه روی همین مرورگر ذخیره می‌شود.</span></div><div class="books-grid" id="book-library-grid"></div><p id="book-action-note" role="status"></p></section>`;
    renderBookLibrary();
  }
  setHash(mode==='publishers'?'#/books/publishers':mode==='people'?'#/books/people':'#/books');
}
function _bookCommerceRow(l){
  const price=Number(l.price),currency=l.currency||'',available=l.availability;
  const value=Number.isFinite(price)&&price>0?(currency==='IRT'?_toman(price):price.toLocaleString('fa-IR')+' '+esc(currency)):'';
  return `<a class="book-store-row" href="${esc(_bookUrl(l.url))}" target="_blank" rel="noopener noreferrer"><span class="book-store-icon">${esc(String(l.store||'ف')[0])}</span><span class="book-store-copy"><b>${esc(l.store||'فروشگاه')}</b><small>${esc(l.edition_label_fa||l.format_fa||BOOK_FORMATS[_bookFormat(l)])}</small>${l.last_checked?`<small>بررسی لینک: ${_bookChecked(l.last_checked)}</small>`:''}</span><span class="book-store-end"><b>${value||'دیدن قیمت ↗'}</b><small>${available==='out_of_stock'?'ناموجود':available==='in_stock'?'موجود':available==='available'?'موجود':'صفحهٔ تأییدشدهٔ کتاب'}</small></span></a>`;
}
function _bookCommerce(b){
  const links=[...new Map(_bookLinks(b).map(l=>[l.url,l])).values()],t=b.torob?.matched?b.torob:null,q=_bookQuote(b);
  const offers=(t?.offers||[]).filter(o=>_bookUrl(o.url)).slice().sort((a,b)=>Number(a.available!==true)-Number(b.available!==true)||Number(!!a.price_unreliable)-Number(!!b.price_unreliable)||(Number(a.price_toman)||Infinity)-(Number(b.price_toman)||Infinity));
  return `<section class="book-commerce" id="book-commerce"><div class="book-section-title"><h2>خرید و مطالعه</h2><span>چاپی، الکترونیکی و صوتی</span></div><div class="book-commerce-tabs" role="group" aria-label="فیلتر نسخه‌های کتاب"><button class="on" data-commerce-format="all" onclick="filterBookCommerce('all')">همه</button>${['print','ebook','audio'].map(f=>`<button data-commerce-format="${f}" onclick="filterBookCommerce('${f}')">${BOOK_FORMATS[f]}</button>`).join('')}</div>
    ${links.length?['print','ebook','audio'].map(f=>{const rows=links.filter(l=>_bookFormat(l)===f);return rows.length?`<div class="book-commerce-group" data-offer-format="${f}"><h3>${BOOK_FORMATS[f]}</h3>${rows.map(_bookCommerceRow).join('')}</div>`:''}).join(''):''}
    ${t?`<div class="book-commerce-group torob-box" data-offer-format="print"><div class="torob-summary"><div><span class="press-kicker">${q?.stale?'آخرین قیمت ثبت‌شده در ترب':'کمترین قیمت ثبت‌شده در ترب'}</span><strong>${q?.price?_toman(q.price):'قیمت قابل اتکا ثبت نشده'}</strong><small>${offers.length?faN(offers.length)+' فروشگاه با لینک خرید':''}</small></div>${_bookUrl(t.product_url)?`<a href="${esc(_bookUrl(t.product_url))}" target="_blank" rel="noopener noreferrer">مقایسه در ترب ↗</a>`:''}</div>${offers.map((o,i)=>`<a class="book-store-row ${o.available===true?'':'soldout'}" href="${esc(_bookUrl(o.url))}" target="_blank" rel="noopener noreferrer"><span class="book-store-icon">${faN(i+1)}</span><span class="book-store-copy"><b>${esc(o.shop_name||'فروشگاه')}</b><small>${esc([o.shop_city,o.free_shipping?'ارسال رایگان':'',o.same_day_delivery?'ارسال امروز':''].filter(Boolean).join(' · '))}</small><small>${esc(o.postage_text||'هزینهٔ ارسال را در فروشگاه بررسی کن')}</small></span><span class="book-store-end"><b>${Number(o.price_toman)>0?_toman(o.price_toman):'دیدن قیمت ↗'}</b><small>${o.available===true?(o.price_unreliable?'قیمت نامطمئن':'موجود هنگام بررسی'):'ناموجود / موجودی تأیید نشده'}</small>${Number(o.delivered_price_toman)>0?`<small>با ارسال: ${_toman(o.delivered_price_toman)}</small>`:''}</span></a>`).join('')}${!offers.length?'<p class="book-method">فهرست فروشگاه‌ها در این بررسی دریافت نشد؛ صفحهٔ ترب را ببین.</p>':''}<p class="book-method">بررسی قیمت: ${_bookChecked(q?.checked)}${q?.stale?' · این قیمت قدیمی است.':''} · قیمت نهایی و موجودی در فروشگاه مشخص می‌شود.</p><p class="book-method">${t.edition_verified?'':'ترجمه و نوبت چاپ پیشنهادهای ترب را با نسخهٔ مورد نظرت تطبیق بده.'}</p></div>`:''}
    <p id="book-commerce-empty" class="book-method" hidden>هنوز لینک مستقیمِ تأییدشده‌ای برای این نسخه ثبت نشده؛ در فروشگاه‌های زیر جست‌وجو کن.</p>
    <details class="book-discovery" ${links.length||t?'':'open'}><summary>جست‌وجو در فروشگاه‌های بیشتر <span>${faN((b.discovery_links||[]).length)} فروشگاه</span></summary><p class="book-method">این‌ها نتیجهٔ جست‌وجو هستند؛ وجود نسخهٔ چاپی، صوتی یا الکترونیکی را تضمین نمی‌کنند.</p><div class="book-buy-grid">${(b.discovery_links||[]).filter(l=>_bookUrl(l.url)).map(l=>`<a class="book-buy search" href="${esc(_bookUrl(l.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(l.store)}</b><span>جست‌وجوی عنوان و نویسنده ↗</span></a>`).join('')}</div></details></section>`;
}
function filterBookCommerce(format){
  let visible=0;document.querySelectorAll('#book-commerce [data-offer-format]').forEach(el=>{const on=format==='all'||el.dataset.offerFormat===format;el.hidden=!on;if(on)visible++});
  document.querySelectorAll('[data-commerce-format]').forEach(el=>{el.classList.toggle('on',el.dataset.commerceFormat===format);el.setAttribute('aria-pressed',String(el.dataset.commerceFormat===format))});
  const empty=document.getElementById('book-commerce-empty');if(empty)empty.hidden=visible>0;
}
function _bookActivity(b){
  const now=Date.now(),counts=Array(8).fill(0);
  for(const m of b.mentions||[]){const d=_bookDate(m.published_at);if(!d)continue;const age=now-d;if(age>=0&&age<56*864e5)counts[7-Math.floor(age/(7*864e5))]++}
  const max=Math.max(1,...counts);
  return `<div class="book-activity"><div><h3>ردّ کتاب در جان‌کلام</h3><p>${faN(b.mention_count||0)} اشاره · ${faN(_bookStats(b).sources)} منبع</p></div><div class="book-activity-bars" role="img" aria-label="اشاره‌های ثبت‌شده در هشت هفته، از قدیمی به تازه: ${counts.map(faN).join('،')}">${counts.map((n,i)=>`<span title="${faN(8-i)} هفته تا امروز: ${faN(n)} اشاره"><i style="height:${Math.max(4,n/max*100)}%"></i><small>${faN(n)}</small></span>`).join('')}</div><small>۸ هفتهٔ اخیر · قدیمی ← تازه</small></div>`;
}
function _bookRelated(b,books){
  const names=new Set((b.creators||[]).map(c=>_bookNorm(c.name_fa)));
  const sources=new Set((b.mentions||[]).map(m=>_bookNorm(m.source_name)).filter(Boolean));
  return books.filter(x=>x.slug!==b.slug).map(x=>({book:x,score:(x.creators||[]).some(c=>names.has(_bookNorm(c.name_fa)))?4:b.publisher?.slug&&x.publisher?.slug===b.publisher.slug?3:x.category_fa&&x.category_fa===b.category_fa?2:(x.mentions||[]).some(m=>sources.has(_bookNorm(m.source_name)))?1:0})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.book);
}
async function shareBook(slug){const url=location.origin+location.pathname+'#/book/'+encodeURIComponent(slug);try{await navigator.clipboard.writeText(url);document.getElementById('book-action-note').textContent='لینک کتاب کپی شد.'}catch(_){document.getElementById('book-action-note').textContent=url}}
async function openBook(slug){
  show('books');setTab('');document.getElementById('books-lede').style.display='none';const el=document.getElementById('books-content');el.innerHTML='<div class="spinner"></div>';const d=await loadBooks(),b=_bookBySlug(d,slug);
  if(!b){el.innerHTML='<div class="state"><div class="big">کتاب پیدا نشد</div></div>';return}
  const entity=(c,fn,role)=>`<button class="book-entity-link" ${_bookAction(fn,c.slug)}><span>${esc(role)}</span><b>${esc(c.name_fa||'')}</b></button>`;
  const related=_bookRelated(b,d.books||[]),stats=_bookStats(b),q=_bookQuote(b);
  const editions=(b.editions||[]).map(e=>`<article class="book-edition"><span class="press-kicker">نسخه / ترجمه</span><h3>${esc(e.label_fa||'نسخهٔ شناخته‌شده')}</h3><div class="book-facts">${e.pages?`<span>${faN(e.pages)} صفحه</span>`:''}${e.publication_year_fa?`<span>سال ${esc(e.publication_year_fa)}</span>`:''}${e.isbn?`<span>شابک <b dir="ltr">${esc(e.isbn)}</b></span>`:''}</div><div class="book-entities">${(e.creators||[]).map(c=>entity(c,'openBookPerson',c.role_fa||'پدیدآورنده')).join('')}${e.publisher?entity(e.publisher,'openPublisher','ناشر'):''}</div></article>`).join('');
  const mentions=(b.mentions||[]).slice().sort((a,b)=>(_bookDate(b.published_at)||0)-(_bookDate(a.published_at)||0)).map(m=>{
    const copy=`<span class="book-mention-source">${esc(m.source_name||'منبع')} · ${m.kind==='figure'?'چهره':m.kind==='news'?'خبر':'جریده'}${m.published_at?' · '+_bookChecked(m.published_at):''}</span><strong>${esc(m.headline_fa||'اشاره به کتاب')}</strong>${m.summary_fa?`<p>${esc(m.summary_fa)}</p>`:''}`;
    const fn=m.article_id?'openPressArticle':m.story_id?'openStory':m.post_id?'openStatement':null,id=m.article_id||m.story_id||m.post_id;
    return fn?`<button class="book-mention" ${_bookAction(fn,id)}>${copy}</button>`:_bookUrl(m.url)?`<a class="book-mention" href="${esc(_bookUrl(m.url))}" target="_blank" rel="noopener noreferrer">${copy}</a>`:`<div class="book-mention">${copy}</div>`;
  }).join('');
  el.innerHTML=`<button class="back" onclick="showBooks()">بازگشت به جانِ کتاب</button><article class="book-detail hub-book-detail"><div class="book-hero"><div><div class="book-detail-cover">${_bookCover(b,true)}</div>${b.cover?.edition_label_fa?`<p class="book-cover-caption">جلدِ ${esc(b.cover.edition_label_fa)}</p>`:''}</div><div class="book-detail-copy"><span class="press-kicker">${esc(b.category_fa||'کتاب')}</span><h1>${esc(b.title_fa||'')}</h1>${b.subtitle_fa?`<p class="book-subtitle">${esc(b.subtitle_fa)}</p>`:''}<p class="book-desc">${esc(b.description_fa||'')}</p><div class="book-facts">${b.pages?`<span>صفحه <b>${faN(b.pages)}</b></span>`:''}${b.publication_year_fa?`<span>انتشار <b>${esc(b.publication_year_fa)}</b></span>`:''}${b.original_year?`<span>اثر اصلی <b>${faN(b.original_year)}</b></span>`:''}${b.isbn?`<span>شابک <b dir="ltr">${esc(b.isbn)}</b></span>`:''}</div>${b.original_title?`<p class="book-original-title">عنوان اصلی: <b dir="ltr">${esc(b.original_title)}</b></p>`:''}<div class="book-detail-actions"><a class="book-primary-action" href="#book-commerce" onclick="event.preventDefault();document.getElementById('book-commerce').scrollIntoView({behavior:'smooth'})">${q?.price?'خرید · از '+_toman(q.price):'خرید و مطالعه'} ↓</a>${_bookSaveButton(b)}<button class="book-share" ${_bookAction('shareBook',b.slug)}>کپی لینک</button></div><p id="book-action-note" role="status"></p></div></div><div class="book-entities">${(b.creators||[]).map(c=>entity(c,'openBookPerson',c.role_fa||'پدیدآورنده')).join('')}${b.publisher?entity(b.publisher,'openPublisher','ناشر'):''}</div><nav class="book-detail-nav"><a href="#book-commerce" onclick="event.preventDefault();document.getElementById('book-commerce').scrollIntoView({behavior:'smooth'})">خرید و مطالعه</a><a href="#book-evidence" onclick="event.preventDefault();document.getElementById('book-evidence').scrollIntoView({behavior:'smooth'})">${faN(b.mention_count||0)} اشاره در منابع</a></nav>${_bookCommerce(b)}${editions?`<div class="rule"><span>نسخه‌ها و ترجمه‌های شناخته‌شده</span><span class="l"></span></div><div class="book-editions">${editions}</div>`:''}<section id="book-evidence">${_bookActivity(b)}<div class="book-section-title"><h2>چرا این کتاب اینجاست؟</h2><span>${faN(stats.sources)} منبع</span></div><p class="book-method">از این کتاب در مطالب زیر نام برده شده؛ هر اشاره را باز کن و متن منبع را ببین.</p><div class="book-mentions">${mentions||'<p>هنوز اشاره‌ای ثبت نشده.</p>'}</div></section>${related.length?`<section class="book-related"><div class="book-section-title"><h2>در همین مسیر</h2><span>پدیدآورنده، موضوع، ناشر یا منبع مشترک</span></div><div class="books-grid">${related.map(_bookCard).join('')}</div></section>`:''}</article>`;
  filterBookCommerce('all');setHash('#/book/'+encodeURIComponent(slug));
}
