# Console PDF extractor

A single self-contained script you paste directly into the browser
DevTools console — no build step, no extension install. Use this for a
quick one-off pull of brochure/document PDFs from a Cushman & Wakefield
search-results page.

## Usage

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

## What it extracts

For every listing link on the page (`/properties/for-lease/...`), it
fetches the detail page and collects any `<a href>` ending in `.pdf`
(brochures, floor plans, etc.), plus the listing title and URL. It also
picks up any PDF links already present on the current page, so it works
whether you're on a search-results page or a single listing page.

## Downloading the actual PDFs

`downloadAllPdfs()` fetches every PDF found and saves it to your browser's
default download folder (filenames prefixed with the listing title).
Chrome will prompt to allow multiple automatic downloads the first time —
click **Allow**. Files download one at a time with the same delay as the
scrape, so a large result set will take a bit.

## Notes

- Runs in your existing logged-in session (same cookies as your browser
  tab) — no separate auth needed.
- Only scrapes listings **linked from the current page**. If results are
  paginated, run it again on each page (`?page=2`, `?page=3`, ...).
- Adds an ~800ms delay between listing fetches to avoid hammering the
  server; a page with many results will take a bit to finish.
- If the site's markup changes and links stop matching, adjust
  `LISTING_LINK_PATTERN` / `PDF_LINK_PATTERN` at the top of
  `extract_pdfs.js`. Selectors here match what's already confirmed in
  `cw-scraper-extension/docs/SELECTORS.md`.
