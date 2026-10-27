/* Pishkhan is an independently deployed Pendar subproject. */
(()=>{
 const base='https://nimania.github.io/pishkhan/';
 const go=(kind,arg,replace=false)=>{
  const url=base+'#/'+kind+(arg?'/'+encodeURIComponent(arg):'');
  if(replace)location.replace(url);else location.assign(url);
 };
 window.showBooks=(mode='books')=>go('books',mode==='books'?'':mode);
 window.openBook=slug=>go('book',slug);
 window.openPublisher=slug=>go('publisher',slug);
 window.openBookPerson=slug=>go('book-person',slug);
 const path=location.hash?location.hash.replace(/^#\/?/,''):location.pathname.replace(/^\/(?:pendar\/)?/,'');
 const [kind,arg]=path.split('/').map(decodeURIComponent);
 if(['books','book','publisher','book-person'].includes(kind))go(kind,arg,true);
 document.querySelectorAll('a[href="/books/"]').forEach(a=>a.href=base);
})();
