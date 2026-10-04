/* An older news payload must retain new store editions from the radar seed. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},structuredClone,_bookNorm:v=>String(v).replace(/‌/g,' ').trim()};
vm.createContext(context);
vm.runInContext(fs.readFileSync('web-static/book-radar-ui.js','utf8'),context);
const oldEdition={label_fa:'طاقچه',purchase_links:[{url:'https://taaghche.com/book/1',format:'ebook'}]};
const newEdition={label_fa:'دیجی‌کالا',purchase_links:[{url:'https://www.digikala.com/product/dkp-1',format:'print'}]};
const creator={slug:'a',name_fa:'نویسنده',role_fa:'نویسنده'};
context.window.__BOOK_RADAR__={radar:{updated_at:'2026-10-04'},books:[{slug:'b',creators:[creator],cover_url:'https://img.taaghche.com/frontCover/1.jpg',editions:[oldEdition,newEdition],radar:{score:7}}]};
const data={radar:{updated_at:'2026-10-03'},books:[{slug:'b',creators:[creator],cover_url:'assets/books/pinned.jpg',mentions:[{headline_fa:'خبر تازه'}],editions:[oldEdition]}]};
context._bookOverlayRadar(data);
assert.equal(data.books[0].editions.length,2);
assert.equal(data.books[0].editions[1].purchase_links[0].format,'print');
assert.equal(data.books[0].cover_url,'assets/books/pinned.jpg');
assert.equal(data.books[0].mentions.length,1);
context._bookOverlayRadar(data);
assert.equal(data.books[0].editions.length,2);
console.log('Radar edition overlay regression passed');
