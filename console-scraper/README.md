# Console PDF extractor

A single self-contained script you paste directly into the browser
DevTools console — no build step, no extension install. Use this for a
quick one-off pull of brochure/document PDFs from a brokerage
search-results page.

Four ready-to-use variants, differing in listing-link URL pattern and how
documents are detected (see "Adapting to another site" below):

- `extract_pdfs.js` — Cushman & Wakefield (`cushmanwakefield.com`)
- `extract_pdfs_avisonyoung.js` — Avison Young (`avisonyoung.ca`)
- `extract_pdfs_colliers.js` — Colliers Canada (`collierscanada.com`)
- `extract_pdfs_cbre.js` — CBRE Canada (`cbre.ca`)

## Usage

1. Open the search-results page in Chrome, e.g.
   `https://www.cushmanwakefield.com/en/canada/properties/lease/search?...`
   or `https://www.avisonyoung.ca/properties#/?type=...&location=Alberta...`
2. Open DevTools: **right-click → Inspect**, then click the **Console** tab
   (or `F12` / `Cmd+Opt+I` then Console).
3. Open the matching script for the site you're on, copy the whole file,
   paste it into the console, press Enter.
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

### No Python allowed on your machine? Use what's already installed

If you can't install Python (locked-down work laptop, etc.), use one of
these instead — both rely only on tools that ship with the OS already, no
install required:

**macOS / Linux** (uses `curl` + `grep`, both pre-installed):
```bash
chmod +x console-scraper/download_pdfs.sh
./console-scraper/download_pdfs.sh cw_pdf_links.csv brochures/
```

**Windows** (uses PowerShell's built-in `Invoke-WebRequest`):
```powershell
.\console-scraper\download_pdfs.ps1 -CsvPath cw_pdf_links.csv -OutDir brochures
```
If PowerShell blocks running the script (`running scripts is disabled`),
run this once first: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

Both do the same thing as `download_pdfs_from_csv.py`: read every `pdfUrl`
from the CSV, download it, skip files already downloaded, retry failures,
and print a summary — no tabs, no Python.

## Notes

- Runs in your existing logged-in session (same cookies as your browser
  tab) — no separate auth needed.
- Only scrapes listings **linked from the current page**. If results are
  paginated, run it again on each page (`?page=2`, `?page=3`, ...). If
  results instead load via infinite scroll (as on Avison Young's list),
  scroll down to load everything you want before running the script.
- Adds an ~800ms delay between listing fetches to avoid hammering the
  server; a page with many results will take a bit to finish.
- If the site's markup changes and links stop matching, adjust
  `LISTING_LINK_PATTERN` / `PDF_LINK_PATTERN` at the top of the script.
  Selectors in `extract_pdfs.js` match what's already confirmed in
  `cw-scraper-extension/docs/SELECTORS.md`.

## Adapting to another brokerage site

Nothing about `download_pdfs_from_csv.py` / `.sh` / `.ps1` is
site-specific — they just process whatever CSV you give them. The only
thing that varies per site is `LISTING_LINK_PATTERN` in the extractor
script: the regex that tells it which `<a href>`s on the search page are
individual listings (as opposed to nav links, category filters, etc).

To add a new site:
1. Open its search-results page, run this in the console to see every
   unique link pattern on the page, and find the one that looks like
   individual listings:
   ```js
   [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))].forEach(h => console.log(h));
   ```
2. Copy `extract_pdfs.js` (or `extract_pdfs_avisonyoung.js`) to a new
   `extract_pdfs_<brokerage>.js`, and update `LISTING_LINK_PATTERN` to
   match that URL shape.
3. `PDF_LINK_PATTERN` (anything ending in `.pdf`) is generic and usually
   doesn't need to change.

### When the document URL has no `.pdf` in it at all

Colliers serves brochures from Azure Blob Storage
(`listingsprod.blob.core.windows.net/.../<uuid>/<uuid>`) with **no file
extension anywhere in the URL** — matching on `.pdf` finds nothing there.
`extract_pdfs_colliers.js` instead detects documents by combining the
link's **host** (the blob storage domain) with its **visible text**
("Brochure", "Floor Plan", etc. — see `DOC_TEXT_PATTERN`), since that same
host can also serve non-document assets like photos via `<a href>`
lightbox wrappers that must not be swept in. If a future site does this
too, use `extract_pdfs_colliers.js`'s `isDocumentLink()` as the template
instead of a plain `PDF_LINK_PATTERN` regex.

### When the document URL isn't in any HTML at all — call the API directly

CBRE's brochure link doesn't exist anywhere in the page — not
server-rendered, not embedded as JS-string markup like Colliers. The
"Download Brochures" button just applies an already-loaded JS object's
`.brochureUrl` to an `<a>` element; that object comes from a same-origin
JSON API called on page load:
`/property-api/propertylisting/<listingId>?CurrencyCode=CAD&Unit=sqft&Interval=Annually&Site=ca-comm`,
found by watching the Network tab (Fetch/XHR filter) during a page
*load*, not a button click — clicking only fired analytics beacons, since
the data was already loaded earlier.

`extract_pdfs_cbre.js` skips HTML scraping for documents entirely: since
the listing ID is already visible in the listing URL itself
(`/properties/office/details/CA-Plus-4511/...`), it calls that API
directly per listing and reads brochure URLs out of the JSON response's
`"Common.Brochures"` array. It still fetches each listing's HTML once,
only to read the page `<title>`.

If a future site's documents aren't discoverable in any HTML response,
this is the pattern to reach for: open DevTools → Network → Fetch/XHR →
Clear → hard-reload the page (not just click around) → look for a
same-origin request returning JSON with the listing/property data, and
call that endpoint directly instead of scraping markup.
