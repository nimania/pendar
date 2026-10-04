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
