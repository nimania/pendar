# Jan-e Ketab

The catalog connects verified books, people, publishers and mentions in press,
news and figure posts. Purchases are separate from store discovery searches.

## Editorial images

`web-static/data/book-curation.json` is the editorial registry. Each pinned image
has `cover.verified_clean`, source URL/name, review date and optional edition label.
The unchanged original images live in `web-static/assets/books/*-clean.*`.
`web-static/book-curation.js` mirrors the registry for offline UI fallback.
Regenerate it after changing the registry:

```python
from pathlib import Path
p = Path('web-static/data/book-curation.json')
Path('web-static/book-curation.js').write_text('window.__BOOK_CURATION__=' + p.read_text().strip() + ';\n')
```

Inspect the full image before marking it clean. Check the title, author,
translator, publisher and edition where applicable. Merchant/Torob images are
discovery candidates only; commerce refreshes cannot overwrite reviewed covers.

## Commerce

Product links use `store`, `url`, `format` (`print`, `ebook`, `audio`), `exact`,
`price`, `currency`, `availability`, `last_checked` and optional edition label and
match basis. Unknown prices or inventory remain null/unknown. Search links are
stored separately under `discovery_links` and do not imply availability.

Torob products require a matching title plus an ISBN, creator/translator or
publisher hint. The UI asks readers to check the edition when edition identity
has not been verified. `checked_at` dates the product summary;
`offers_checked_at` independently dates the seller snapshot. A failed detail
refresh only retains offers for the same product identity, with the old date.
Prices older than 48 hours are labelled as old quotes. Unavailable or unreliable
offers are excluded from the advertised minimum.

Commerce refresh runs every six hours, processing up to six oldest entries.
The normal news and press pipelines keep matching mentions and rebuilding the
people/publisher graph. Editorial overlays are reapplied after cache merges.

## Discovery

The 30-day ranking counts dated mentions in monitored Jan Kalam sources, not
sales or total market popularity. The eight-week chart uses the same evidence.
Reading lists stay in localStorage on the reader's browser. Related books use
shared people, publisher, category or source and disclose those relationships.

## Checks

```sh
python -m unittest discover -s backend/tests -p test_book_catalog.py -v
node --check web-static/books-hub.js
node --check web-static/app.js
```

## Independent Book Radar

Public shelf discovery does not require a Jan Kalam news mention. The registry in
`backend/book-radar-sources.json` currently enables Taaghche and Ketabrah public
bestseller/new-to-store shelves, and Tarjomaan/Taaghche magazine review feeds.
Unrecognized page structures fail visibly in source health. Discounts, featured
marketing, and free-book shelves are excluded from scoring. The collector makes
small sequential public requests every six hours via books-commerce.yml.

Title + author identifies a work. Store product URLs identify editions; audio,
ebook, translators and publishers remain edition-specific. Clean pinned covers
are retained. Newly discovered covers only use canonical provider artwork,
without merchant thumbnails or promotional badges.

Each provider contributes its highest shelf weight at most once: bestseller
3/(1+(position-1)/10), new-to-store 1/(1+(position-1)/10). Each additional independent
provider adds one point. This is a visibility indicator, not units sold, quality,
or a comprehensive Persian-market rank. Positions are observed display positions
within the monitored shelf, not published numerical sales ranks. Ratings are
shown with their vote counts, without contributing to the trend score.

History is one latest snapshot per work/provider/shelf/format/day, retained for
90 days. Weekly changes require an observation of the same list 7–10 days ago;
repeated same-day runs cannot manufacture growth. Signals expire after 48 hours.
Failures retain old evidence with its old date. News/press and cached commerce
merges preserve independent discoveries and rebuild their people/publisher graph.
The reviewed fallback seed uses the same evidence model for reliable UI startup.

`پروندهٔ بررسی اولیه` currently describes evidence and edition selection. Related
review links are attributed to their publication and store editorial is labelled.
It does not claim to have read the full book. Full critical reviews require text
or a lawful sample and a separately attributed editorial record. Print publisher
new releases and English books about Iran are subsequent source adapters; they
are not claimed as currently monitored.

```sh
python backend/scripts/collect_book_radar.py --catalog web-static/data/books.json --out-js web-static/books-data.js
python -m unittest discover -s backend/tests -p 'test_book*.py' -v
```
