# Data model & schema

This is the contract every module is built against. Extraction logic doesn't
start until this is confirmed — field names, sheet layout, and storage shape
are all costly to change once several modules depend on them.

**Resolved (2026-07-31):** all three prior open questions are decided —
`_source` surfaces as a single summary column (§3), run history stores
structured fields only, never `raw_text` (§4), and `background.js` stays
minimal with no `chrome.alarms` reminder (§7). Details inline below.

## 1. Internal `Listing` object (in-memory / `runHistory` shape)

One object per property, built up across the pipeline (discover → detail →
brochure → extraction → diff).

```js
{
  property_id: "268032",              // from og:image pmedia/{id}/ — primary key
  title: "",
  address: "",
  city: "",                            // normalized (matches the saved-search city)
  transaction_type: "Lease",           // "Lease" | "Sublease"
  listing_url: "",
  brochure_urls: [],                   // 0+ — a listing can have more than one brochure

  // Every extracted field is {value, source}. Internally each field keeps
  // its own source; on export these collapse into a single `field_sources`
  // summary column on the Listings sheet (§3) rather than a column per
  // field — see FIELD_SOURCE_ABBREV in src/config/constants.js.
  available_sf:      { value: null, source: "missing" },
  max_contiguous_sf:  { value: null, source: "missing" },
  min_divisible_sf:    { value: null, source: "missing" },
  net_rent:             { value: null, source: "missing" },
  additional_rent:       { value: null, source: "missing" },
  gross_rent:              { value: null, source: "missing" },
  lease_term:               { value: null, source: "missing" },
  parking:                   { value: null, source: "missing" },
  occupancy_date:              { value: null, source: "missing" },

  // broker_name folds in title/office/location per resolved design decision
  // (no separate columns), e.g. "Dustin Bateyko (Partner - CW Edmonton;
  // Edmonton, Canada)". Multiple brokers on one listing join with "; ".
  broker_name:  { value: null, source: "missing" },
  // Resolved: never fetched (no VCard request) — confirmed NOT present
  // anywhere in the static HTML, only reachable via a same-origin
  // "Download VCard" API link. Always source: "missing" by design.
  broker_phone:  { value: null, source: "missing" },
  broker_email:   { value: null, source: "missing" },
  broker_profile_url: null,            // html-only, not a tracked/sourced field

  spaces: [],                          // Space[], see below — only when the brochure breaks out multiple suites/floors

  extraction_status: "ok",             // "ok" | "no_brochure" | "image_only" | "failed"
  notes: "",                            // free text: re-list suspicion, partial failures,
                                          // non-numeric Rental Price text ("Contact us for
                                          // pricing") that couldn't populate net_rent, etc.

  raw_text: {
    plain: "",                          // concatenated per-page getTextContent() blobs — audit trail
    lines: "",                           // line-grouped text — what regex/LLM extraction reads
    pages: [],                            // [{page: 1, item_count: 0, image_only: false}, ...]
  },
}
```

`source` is one of: `"html"` (scraped from the detail page DOM),
`"pdf_regex"` (Layer 1), `"pdf_llm"` (Layer 2, only present if it overrode
regex or filled a gap), `"missing"` (never found).

## 2. `Space` object (child rows, keyed by `property_id`)

```js
{
  property_id: "268032",
  suite: "",              // e.g. "Suite 200" — blank if the brochure doesn't break out suites
  floor: "",
  available_sf: null,
  rent: null,
  notes: "",
}
```

Only populated when a brochure lists more than one leasable space with its
own SF/rent. Single-space listings just get `available_sf`/`net_rent` on the
`Listing` itself and produce zero `Space` rows.

## 3. Excel workbook — sheet order and columns

Order matters: **Changes** sheet first (the thing read every month), then
Listings, Spaces, Trend, Raw Text.

### Changes (first sheet)
| status | property_id | title | field_changed | previous_value | current_value | listing_url | notes |
|---|---|---|---|---|---|---|---|

- One row per changed field — a listing with 2 changed fields = 2 rows.
- `status`: `NEW` / `REMOVED` / `CHANGED`. (`UNCHANGED` listings produce no
  rows here — no point printing rows nobody needs to read.)
- `NEW`/`REMOVED` rows: `field_changed` = `(listing)`, previous/current
  holds the whole prior or current record (title/address/rent summarized).
- `notes`: populated for the possible-re-list case (`REMOVED` + `NEW` at the
  same street address) — see §6.
- Conditional formatting: green fill `NEW`, red `REMOVED`, amber `CHANGED`.
- Only rendered when the search has ≥1 prior run; first-ever run has no
  Changes sheet (nothing to diff against).

### Listings
| property_id | title | address | city | transaction_type | available_sf | max_contiguous_sf | min_divisible_sf | net_rent | additional_rent | gross_rent | lease_term | parking | occupancy_date | broker_name | broker_phone | broker_email | listing_url | brochure_url | extraction_status | field_sources | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- All columns named in the brief, plus one addition: `field_sources` (a
  single summary column, not one column per field — resolved design
  question). Format: semicolon-separated `field=code` pairs using the
  1-letter codes in `FIELD_SOURCE_ABBREV` (`h`=html, `r`=pdf_regex,
  `l`=pdf_llm, `m`=missing), e.g. `net_rent=r;additional_rent=m;broker_name=h`.
  Only `SOURCED_FIELDS` (constants.js) appear here — the always-html fields
  (title, address, etc.) don't need calling out.
- `brochure_url` = first brochure URL if multiple (additional ones don't
  currently have a column — flagged below).
- Numeric columns (`*_sf`, `net_rent`, `additional_rent`, `gross_rent`)
  written as actual numbers, not strings — required for correct sorting.
  `lease_term`/`parking`/`occupancy_date` stay text (too variable in format
  to force numeric — e.g. "5 years", "2 stalls / 1,000 SF").
- Header row frozen, columns autosized.

### Spaces
| property_id | suite | floor | available_sf | rent | notes |
|---|---|---|---|---|---|

### Trend
| property_id | title | 2026-05-01 | 2026-06-01 | 2026-07-01 | ... |
|---|---|---|---|---|---|

- One column per run date (oldest → newest, left to right), values are
  whichever metric is selected in Settings (default `net_rent`; the other
  option is `available_sf`).
- Row set = union of every `property_id` seen across retained runs (so a
  since-removed listing still shows its trend line, just with blank cells
  after the run it disappeared).

### Raw Text
| property_id | brochure_url | full_text | notes |
|---|---|---|---|

- `full_text` = the `raw_text.plain` audit-trail blob (concatenated across
  pages), not the line-grouped version — this sheet is for a human to
  Ctrl+F against the original brochure wording.
- `notes` carries page-level flags, e.g. `"page 3: image_only"`.

## 4. `chrome.storage.local` layout

```
savedSearches: {
  [searchId]: {
    id, name,                       // e.g. "Edmonton Metro Office"
    cities: ["edmonton", "leduc"],   // slugs — see src/config/cities.js
    propertyType: "office",           // slug — see src/config/propertyTypes.js
    transactionType: "lease",          // "lease" | "sublease"
    delayMs: 1500,
    createdAt, updatedAt,
  }
}

runHistory:{searchId}: [              // newest first, max 12, oldest pruned
  {
    timestamp,                        // ISO string, also the Trend-sheet column label
    searchId, searchName,
    summary: { scraped, noBrochure, imageOnly, failed },
    listings: [ Listing, ... ],        // WITHOUT raw_text.plain/lines (resolved: structured fields only —
                                        // Raw Text sheet reflects the current export alone, not history)
  }
]

inProgressRun:{searchId}: {           // present only mid-run; deleted on completion/export
  startedAt, config,
  discoveredUrls: [...], completedUrls: [...],
  results: [ Listing, ... ], errors: [...],
}

settings: {
  anthropicApiKey: null,               // chrome.storage.local — see README security note
  llmExtractionEnabled: false,
  trendMetric: "net_rent",              // "net_rent" | "available_sf"
  defaultDelayMs: 1500,
}
```

## 5. Diff / change-detection rules (recap, for the code that implements §3's Changes sheet)

Compare newest run vs. next-newest run for the same `searchId`, keyed on
`property_id`. Tracked fields (a difference in ANY of these → `CHANGED`,
one Changes-sheet row per differing field):

`available_sf, max_contiguous_sf, min_divisible_sf, net_rent, additional_rent, lease_term, occupancy_date, broker_name, brochure_url`

(`brochure_url` compared even though it's not a "data" field — a changed
URL usually means re-issued marketing, worth a flag on its own.)

## 6. Re-list heuristic

After computing NEW and REMOVED sets: for every `(removed, new)` pair
sharing the same normalized `address`, don't report them as two unrelated
Changes rows — keep both rows (status stays `REMOVED`/`NEW`, we're not
inventing a new status) but set `notes` on both to something like
`"possible re-list — same address as property_id {other_id}"`.

## 7. File structure

```
cw-scraper-extension/
  manifest.json
  package.json                  # pdfjs-dist + xlsx as vendoring sources only
  popup/            popup.html / popup.css / popup.js         — thin launcher + saved-search list
  worker/           worker.html / worker.css / worker.js       — does the actual work, owns progress UI
  settings/         settings.html / settings.css / settings.js — API key, trend metric, defaults
  background/       background.js                               — MV3 service worker, intentionally minimal (no chrome.alarms — resolved, out of scope)
  src/
    config/         cities.js, propertyTypes.js, constants.js    — slug maps, tracked-field list, defaults
    discover/       discoverListings.js                           — pass 1: per-city pagination + dedupe
    detail/         parseDetailPage.js                             — pass 2: DOMParser field + brochure extraction
    pdf/            extractPdfText.js, lineGrouping.js               — pdf.js integration + line-grouping algorithm
    extraction/     regexExtract.js, llmExtract.js                    — Layer 1 / Layer 2
    net/            fetchWithRetry.js                                  — shared retry+backoff+delay fetch wrapper
    storage/        savedSearches.js, runHistory.js, state.js, settings.js — chrome.storage.local CRUD
    diff/           changeDetection.js, relistDetection.js               — §5 / §6
    xlsx/           buildWorkbook.js                                      — SheetJS assembly per §3
    utils/          logger.js                                             — error-log-pane data model
  vendor/           pdf.js, pdf.worker.min.js, xlsx.full.min.js (added during setup, not yet present)
  docs/             SCHEMA.md (this file), SELECTORS.md (brittle-selector map, filled in as selectors are confirmed)
```

**Implemented and tested** (each with its own `scripts/test-*.mjs`, run
via `node scripts/test-<name>.mjs` — throwaway fixture-based checks, not
part of the shipped extension):
- `src/detail/parseDetailPage.js` + `src/utils/numberParsing.js` — against
  markup confirmed live on a real listing.
- `src/net/fetchWithRetry.js` — retry/backoff/delay-before-every-attempt
  behavior, mocked `fetch`.
- `src/discover/discoverListings.js` — path-form URL construction
  (page 1 bare, page 2+ `?page=N`), cross-page and cross-city dedup, and
  the stop-on-zero-new-URLs pagination rule, all against mocked `fetch`.
  Unlike `parseDetailPage.js`, this one didn't need a fresh live-inspection
  round — the brief already confirmed the card selector and pagination
  rule directly ("do not re-derive"), so implementation went straight from
  the brief's stated facts to tests against fixtures matching them.
- `src/pdf/lineGrouping.js` — the y-tolerance/x-gap line-and-column
  reconstruction algorithm (§ brief's "PDF text extraction — do this
  properly"), pure function, tested against fixture text-item arrays: word
  spacing, kerning-split words (no separator), table rows (column
  separator, not a space), multi-line sorting, the y-tolerance boundary
  itself, and degenerate input.
- `src/pdf/extractPdfText.js` — the pdf.js integration wrapper (per-page
  iteration, image_only detection, per-page-failure isolation, the
  `plain`/`lines` audit-trail-vs-structured split with `[page N]`
  markers), tested against a mocked `pdfjsLib` (same dependency-injection
  approach as mocking `fetch`/`DOMParser` elsewhere) — no real PDF file or
  vendored pdf.js needed to validate this file's OWN logic, since pdf.js's
  job (actually parsing PDF bytes) is a separately battle-tested external
  library, not something this project needs to re-verify.

See `docs/SELECTORS.md` for exactly what's independently confirmed vs.
carried-over-but-unverified for each module. Every other `src/**` file is
still a stub. Next up: `src/extraction/regexExtract.js` (Layer 1 field
extraction from the line-grouped brochure text — the natural next step in
the PDF pipeline, but a big enough piece to treat as its own unit) or
`src/xlsx/buildWorkbook.js` (needs no live data, could go now against
synthetic Listing objects) — your call. Note also: `extractPdfText.js` is
logic-tested but has never run against a REAL PDF through the REAL
vendored pdf.js — that only becomes possible once pdf.js is actually
vendored into `vendor/` (still not done, see `vendor/README.md`) and this
runs in an actual worker tab.
