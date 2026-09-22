# Console scrapers

Self-contained scripts you paste directly into the browser DevTools
console — no build step, no extension install. Use these for quick
one-off pulls from a Cushman & Wakefield search-results page.

## `extract_addresses.js` — collect listing addresses into a spreadsheet

1. Open a search-results page in Chrome, e.g.
   `https://www.cushmanwakefield.com/en/canada/properties/lease/search/industrial?bbox=53.113470,-113.949008,53.873248,-113.141513&zoom=10`
   — any filter combination works (bbox/zoom map search, city path search,
   plain query search).
2. Open DevTools: **right-click → Inspect**, then the **Console** tab
   (or `F12` / `Cmd+Opt+I`).
3. Open `extract_addresses.js`, copy the whole file, paste it into the
   console, press Enter.
4. It auto-paginates from page 1 (using your current filters, ignoring
   whichever page you happened to be on), logging progress, then prints a
   `console.table` summary of every listing found.
5. Run `downloadCsv()` to save a spreadsheet, or `downloadJson()` for the
   raw data.

**What it extracts**: title, street address, city, province, listing type
("For Lease"/etc.), property type, price, and the listing's detail URL —
one row per listing card.

**Pagination safety**: appending `?page=N` to some filter combinations on
this site has been observed to silently drop the filter and re-serve page
1 instead of genuinely paginating (confirmed for the multi-city
query-string form used elsewhere in this repo; unconfirmed either way for
bbox/zoom map searches). The script detects this — if page N comes back
identical to page 1, it stops and prints a specific warning instead of
silently double-counting or looping forever. If you see that warning, treat
the result as a lower bound, not necessarily everything the map view shows.

## `extract_pdfs.js` — collect brochure PDF links

1. Open the search-results page in Chrome, e.g.
   `https://www.cushmanwakefield.com/en/canada/properties/lease/search?...`
2. Open DevTools: **right-click → Inspect**, then click the **Console** tab
   (or `F12` / `Cmd+Opt+I` then Console).
3. Open `extract_pdfs.js`, copy the whole file, paste it into the console,
   press Enter.
4. It logs progress as it visits each listing on the page, then prints a
   `console.table` summary of every PDF found.
5. Run `downloadCsv()` or `downloadJson()` in the console to save the
   results to a file, or `downloadAllPdfs()` to download every PDF found.

For every listing link on the page (`/properties/for-lease/...`), it
fetches the detail page and collects any `<a href>` ending in `.pdf`
(brochures, floor plans, etc.), plus the listing title and URL. It also
picks up any PDF links already present on the current page, so it works
whether you're on a search-results page or a single listing page.

`downloadAllPdfs()` fetches every PDF found and saves it to your browser's
default download folder (filenames prefixed with the listing title).
Chrome will prompt to allow multiple automatic downloads the first time —
click **Allow**.

Unlike `extract_addresses.js`, this one does **not** auto-paginate — it
only scrapes listings linked from the current page. If results are
paginated, run it again on each page (`?page=2`, `?page=3`, ...).

## Notes (both scripts)

- Run in your existing logged-in session (same cookies as your browser
  tab) — no separate auth needed.
- Add a delay between fetches to avoid hammering the server; a page with
  many results will take a bit to finish.
- If the site's markup changes and links/cards stop matching, the
  selector constants are at the top of each file
  (`LISTING_LINK_PATTERN`/`PDF_LINK_PATTERN` in `extract_pdfs.js`,
  `CARD_SELECTOR` in `extract_addresses.js`). Selectors match what's
  confirmed in `cw-scraper-extension/docs/SELECTORS.md` (as of when each
  script was written — that doc has had some churn from a branch-merge
  mishap, so treat it as a starting point, not gospel, if it looks thin).
