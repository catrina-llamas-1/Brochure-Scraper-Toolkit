# Selector reference / brittle points

Where to look first if the site changes and something starts failing.

## Confirmed by the brief (do not re-derive)

| What | Rule |
|---|---|
| Listing card link | `<a href>` containing `/properties/for-lease/` |
| Pagination | append `?page=N` to the **path-form** URL only — see `src/discover/discoverListings.js` header comment for why the query-string multi-city form can't paginate |
| `property_id` | from `<meta property="og:image">`, URL contains `/pmedia/{id}/` |
| Brochure link | `<a href>` matching `assets.cushmanwakefield.com/-/pmedia/{id}/0/{filename}.pdf?rev=...` |

## Confirmed 2026-07-31 against a live listing (office sublease, Edmonton)

Independently re-confirmed for THIS project via `scripts/inspect_detail_page.console.js` +
`scripts/inspect_broker_block.console.js` output — not carried over from
the sibling project.

| What | Selector / rule |
|---|---|
| `available_sf` | `dt` text containing "available space" → value in the next-sibling `dd` |
| `net_rent` (Rental Price) | `dt` text containing "rental price"/"net rent"/"asking rate" → next-sibling `dd`. Often non-numeric ("Contact us for pricing") — `parseDetailPage.js` keeps that text in `notes` rather than dropping it when it can't parse as a number. |
| `max_contiguous_sf`, `min_divisible_sf` | Same `dt`/`dd` pattern, but **absent on many listings** (confirmed: the test listing had no Max Contiguous/Min Divisible at all) — this is normal, not an extraction failure. |
| Broker card | `div.card.mix_person` — name is `h6.updatedCardPerson a` text; title/office/location are two `span.updatedCardLocation` inside `p.card-text.mt-1`; profile link is any `a[href*="/people/"]` inside the card. |
| Broker card dedup | **The card renders twice in the DOM** (desktop + mobile copy, same person) — dedupe by the `personId` GUID embedded in the `a[href*="GetVCard"]` link (`/api/GetVCard?personId={...}&vcn=...`), not just by name (a coincidental same-name-different-person case, while unlikely, would be silently merged if deduped by name instead). |
| Broker phone/email | **Not present anywhere in the static HTML.** Only lead is the `GetVCard` API link, which we deliberately don't fetch (resolved design decision — see `docs/SCHEMA.md`). These fields are always `FIELD_SOURCE.MISSING` by design, not a bug. |
| Transaction type (Lease/Sublease) | `.updated-page-title-tags` element text, checked for "sublease" (case-insensitive) — **carried over from the sibling project's confirmed markup on the same site/template, not independently re-verified for this listing** (the console output that would confirm it got cut off in the pasted transcript). First thing to check if `transaction_type` comes out wrong. |
| `<h1>` title | `h1` (any — see robustness note below, this one's strict) |
| Address | `h5.updated-page-title-sub` / `.updated-page-title-sub` — **same carried-over caveat as transaction type above**, not independently re-verified for this project. |

## Robustness: strict vs. lenient selectors in `parseDetailPage.js`

Per the brief: "if a selector matches nothing, fail loudly... rather than
silently writing empty columns" — but that only makes sense for structure
the brief *guarantees* exists on every listing. Implemented as two tiers:

- **Strict (throws, names the selector)**: `<h1>`, `<meta property="og:image">`.
  The brief explicitly says every listing's HTML contains these — a miss
  means the site changed, not that this listing is unusual.
- **Lenient (source = MISSING, no error)**: the four labelled fields,
  broker card, brochure links, address, transaction-type tag. All
  confirmed to vary listing-to-listing in real data (e.g. no brochure on
  pre-construction listings, no Max Contiguous on smaller spaces) — a miss
  here is normal, not a broken selector, and throwing would abort otherwise
  healthy listings.

## Property type / city slugs — partially unverified

See `src/config/propertyTypes.js` — only `office` is confirmed (it's the
brief's own example URL, and the one used for all live inspection so far).
`retail` and `industrial` are unverified guesses. Confirm each resolves to
a real filtered results page (not a 404, not a silent fallback to "all
types") before using it in a saved search.

## `discoverListings.js` — implemented from the brief's own confirmed facts, not independently re-derived

Unlike the detail-page fields, this module's rules came directly from the
brief itself ("already verified — do not re-derive"): the card-link rule
(`a[href]` containing `/properties/for-lease/`) and the pagination shape
(page 1 = bare path-form URL, page 2+ appends `?page=N`). Implementation
went straight from those stated facts to `scripts/test-discoverListings.mjs`
(mocked `fetch`, real `jsdom` DOM parsing) rather than another live-console
round. **Still genuinely untested against the live site** — the tests prove
the logic is internally correct against fixtures shaped like what the
brief describes, not that the live site actually behaves that way. If a
real run comes back empty or short, this is the first place to check with
a live console dump (same pattern as `scripts/inspect_detail_page.console.js`,
just pointed at a search results page instead of a detail page).

## `src/pdf/*` — algorithm implemented and tested, never run against a real PDF

`lineGrouping.js` and `extractPdfText.js` are implemented and pass
fixture-based tests (`scripts/test-lineGrouping.mjs`,
`scripts/test-extractPdfText.mjs`), but "fixture" is doing real work in
that sentence: the fixtures are hand-built text-item arrays shaped like
what pdf.js's API contract says it returns, not extracted from a real
Cushman & Wakefield brochure. Two specific unknowns that only a real
brochure can answer:
- Whether the space-width estimation heuristic (`spaceWidthToHeightRatio`,
  default 0.3 — see `lineGrouping.js` header comment) actually produces
  readable output on real brochure fonts/layouts, especially dense rent
  tables. The thresholds are tunable (`opts` on `groupTextItemsIntoLines`)
  precisely because this is a heuristic that may need adjusting once real
  output can be eyeballed.
- Whether real brochures hit the `image_only` path often (scanned pages,
  logos-as-images-with-no-text-layer) or rarely — affects whether the
  README's OCR-tradeoff note needs to move from "extension point" to
  "actually worth building."

Next real validation step: fetch one live brochure PDF (a listing's
`brochure_urls[0]` from `parseDetailPage.js` output) and run it through
`extractPdfText.js` for real — needs pdf.js actually vendored first (not
yet done, see `vendor/README.md`), so this is blocked on that setup step,
not on more code.

## `src/extraction/regexExtract.js` — not started

No live brochure text has been read yet, so no regex patterns have been
written or confirmed against real formatting (e.g. how this site's
brochures actually phrase "$X.XX per SF" vs "PSF" vs "net", how
suite/unit numbers are formatted, etc.). Same "needs a real brochure"
blocker as above.
