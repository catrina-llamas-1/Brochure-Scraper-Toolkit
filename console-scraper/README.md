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

**If you see `TypeError: Failed to fetch`:** the PDFs are hosted on a
different origin (`assets.cushmanwakefield.com`) than the page
(`www.cushmanwakefield.com`), and that CDN doesn't send CORS headers
allowing JavaScript to read the file — this is a browser security
restriction, not a bug in the script, and can't be fixed with `fetch()`.
`downloadAllPdfs()` detects this and automatically falls back to opening
each blocked PDF in a new tab instead, where you can click the download
icon in the browser's built-in PDF viewer to save it. If the tabs don't
open, Chrome's pop-up blocker likely caught them — click the blocked-popup
icon in the address bar, choose "Always allow pop-ups from this site", and
run `downloadAllPdfs()` again.

## Mass-downloading from the CSV (no browser tabs)

If `downloadAllPdfs()` keeps hitting the CORS fallback and opening tabs
one at a time, skip the browser entirely: run `downloadCsv()` to get
`cw_pdf_links.csv`, then download every PDF with a plain script instead.
CORS is a browser-JS-only restriction — a normal script's HTTP requests
aren't subject to it, so this works even when `fetch()` in the console
can't.

```bash
pip install requests
python console-scraper/download_pdfs_from_csv.py cw_pdf_links.csv brochures/
```

This downloads every `pdfUrl` in the CSV into `brochures/` (filenames
prefixed with the listing title), skips files it already downloaded so
it's safe to re-run/resume, retries failed requests with backoff, and
prints a summary (downloaded / skipped / failed) at the end.

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
