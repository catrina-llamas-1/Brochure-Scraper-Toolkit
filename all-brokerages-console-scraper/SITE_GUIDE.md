# Brochure Scraper — Site Guide

Reference for all five brokerage scrapers in this folder: what's
structurally different about each site, and how to run each one.

## Quick reference

| Brokerage | Script(s) | Listing link pattern | Document detection | Special step |
|---|---|---|---|---|
| Cushman & Wakefield | `extract_pdfs_cushman.js` | `/properties/for-lease/...` | `.pdf` in URL | none |
| Avison Young | `extract_pdfs_avisonyoung.js` | `/properties/<slug>` | `.pdf` in URL | none |
| Colliers Canada | `extract_pdfs_colliers.js` | `/properties/<title>/<address>/can<id>` | blob-storage host + link text (no `.pdf`) | none |
| CBRE Canada | `extract_pdfs_cbre.js` | `/properties/<type>/details/CA-Plus-<id>/<slug>` | same-origin JSON API, not HTML | none |
| NAI Edmonton | `extract_pdfs_nai_step1_collect_listings.js` + `extract_pdfs_nai_step2_extract_docs.js` | `.listing-card` links → different domain (`spacelist.ca`) | `data-engagement-type="brochure"` attribute | two scripts, two tabs |

All five produce the same output shape — `{ listingUrl, listingTitle, pdfUrl }` rows — with `downloadCsv()`, `downloadJson()`, and `downloadAllPdfs()` helpers in the console once a script finishes.

---

## 1. Cushman & Wakefield

**Site structure**: straightforward. Listing links are plain `<a href>` tags matching `/properties/for-lease/...` on the search page. Each detail page is server-rendered — fetching it returns real HTML containing the brochure's `<a href="...pdf">` directly.

**Usage**:
1. Open the CW search-results page.
2. DevTools → Console → paste `extract_pdfs_cushman.js` → Enter.
3. `downloadCsv()`, `downloadJson()`, or `downloadAllPdfs()`.

**Known quirk**: brochure PDFs live on `assets.cushmanwakefield.com`, a different origin from the page. `downloadAllPdfs()` will likely hit a CORS block and fall back to opening each PDF in a new tab automatically.

---

## 2. Avison Young

**Site structure**: listing links are `/properties/<slug>` (single path segment — the search page itself is `/properties#/?...`, which doesn't collide). Each detail page is proxied server-side from a third-party "SharpLaunch" microsite, but appears same-origin, so fetching it returns real HTML with a static brochure `<a href="...pdf">`.

**Usage**: identical to Cushman & Wakefield — paste `extract_pdfs_avisonyoung.js`, run the download helpers.

**Known quirk**: brochure PDFs live on `cdn.sharplaunch.com`, a different origin. Same CORS-fallback-to-tabs behavior as CW.

**Site-specific note**: results may load via infinite scroll rather than pagination — scroll to load everything before running the script.

---

## 3. Colliers Canada

**Site structure**: listing links are `/properties/<title-slug>/<address-slug>/can<digits>`. The tricky part: the brochure link is **not a real HTML element**. It's a JS variable (`listDataRelatedDocs`) embedded in a `<script>` tag, whose value is itself an HTML string (single-quoted attributes) that only becomes a real DOM element after the page's own JavaScript runs. A plain `DOMParser` never executes scripts, so normal DOM-based extraction finds nothing even though the text is technically present in the response.

**How the script works around it**: instead of parsing the DOM, it regexes the raw HTML/JS **text** for `<a href='...'>...</a>`-shaped patterns, then filters to real documents by checking both the link's host (`listingsprod.blob.core.windows.net`) and its visible text (must contain "Brochure", "Floor Plan", etc.) — since that same host also serves non-document assets like photos.

**Usage**: paste `extract_pdfs_colliers.js` on the search page, run the download helpers as usual.

**Site-specific note**: this is a faceted-search UI — results may load asynchronously. If 0 listing links are found, wait for the results grid to visibly populate first.

---

## 4. CBRE Canada

**Site structure**: listing links are `/properties/<type>/details/CA-Plus-<id>/<slug>`. This site goes a step further than Colliers: the brochure link doesn't exist in any HTML response at all, not even hidden in embedded JS. The "Download Brochures" button just applies an already-loaded JavaScript object's `.brochureUrl` onto an `<a>` element — and that object is populated from a same-origin JSON API called when the page first loads:

```
GET /property-api/propertylisting/<listingId>?CurrencyCode=CAD&Unit=sqft&Interval=Annually&Site=ca-comm
```

The brochure array lives at `response.Document["Common.Brochures"]` (nested under `Document`, not top-level).

**How the script works around it**: skips HTML scraping for documents entirely. Since the listing ID is already visible in the listing URL, it calls that API directly per listing and reads the brochure array straight from the JSON. It still fetches each listing's HTML once, only to read the page `<title>`.

**Usage**: paste `extract_pdfs_cbre.js` on the search page, run the download helpers.

**Known quirk**: brochure files are same-origin (`www.cbre.ca`), so `downloadAllPdfs()` usually works via direct fetch rather than falling back to tabs — but the file server may still 403 requests from external download scripts (see Troubleshooting below).

---

## 5. NAI Edmonton

**Site structure**: the most structurally different of the five. Listing cards (`<a class="listing-card" href="...">`) render directly into `naiedmonton.com`'s own page — not inside an iframe, not inside Shadow DOM (both were tested and ruled out) — but each card's `href` points to a **completely different domain**: `https://e85.spacelist.ca/listings/<id>/...` (SpaceList, a third-party listing platform).

Reading the `href` off the card works fine (it's just a DOM attribute on the current page). But fetching that URL's HTML from `naiedmonton.com`'s console is a genuine cross-origin request and gets CORS-blocked — this time blocking the detail page's *HTML itself*, not just a file download like every other site's CORS issue. There's no single-script fix for that.

**How the workflow works around it — two scripts, two tabs**:
1. **Step 1**, run on `naiedmonton.com`: collects every listing card's `spacelist.ca` URL.
2. **Step 2**, run on `spacelist.ca` (same-origin with every listing once you're there): fetches each listing and extracts brochure links via `a[data-engagement-type="brochure"]`, a purpose-built semantic attribute.

**Usage**:
1. Open the NAI Edmonton search page, with results visibly loaded.
2. DevTools → Console → paste `extract_pdfs_nai_step1_collect_listings.js` → Enter.
3. Run `downloadListingUrls()` → saves `nai_listing_urls.json`.
4. Open **any one** of the printed listing URLs directly in a new tab (now on `spacelist.ca`).
5. Open `extract_pdfs_nai_step2_extract_docs.js`, paste the contents of `nai_listing_urls.json` into the `LISTING_URLS = []` placeholder near the top of the file.
6. DevTools → Console (on the `spacelist.ca` tab) → paste the edited script → Enter.
7. Run `downloadCsv()`, `downloadJson()`, or `downloadAllPdfs()`.

**Known quirk**: brochure files live on yet a third origin (`cloudfront.net`) — expect the same CORS-fallback-to-tabs behavior as CW/Avison Young/Colliers.

---

## Downloading the actual files

Once you have a CSV (`downloadCsv()`), you don't have to rely on the browser at all:

- **Have Python**: `python console-scraper/download_pdfs_from_csv.py your_file.csv brochures/`
- **No Python, macOS/Linux**: `./console-scraper/download_pdfs.sh your_file.csv brochures/`
- **No Python, Windows**: `.\console-scraper\download_pdfs.ps1 -CsvPath your_file.csv -OutDir brochures`

These run outside the browser, so they aren't subject to the CORS restrictions that force `downloadAllPdfs()` to fall back to opening tabs on four of the five sites.

## Troubleshooting

- **0 listing links found**: the search page's results probably hadn't finished rendering yet (Avison Young, Colliers, NAI Edmonton all load results client-side). Wait for cards to visibly appear, then re-run.
- **"No documents/brochures found" for every listing, despite the site clearly having them**: you're very likely running a stale copy of the script pasted before a fix — re-copy the current file fresh and re-paste.
- **`TypeError: Failed to fetch` in `downloadAllPdfs()`**: expected on CW, Avison Young, Colliers, and NAI Edmonton — the PDF host is a different origin and blocks cross-origin `fetch()` reads. The script automatically falls back to opening a tab per file; allow pop-ups if they don't open.
- **`403 Forbidden` from an external download script (Python/bash/PowerShell)**: some file hosts (seen on CBRE) block requests that don't look like a real browser (missing cookies/Referer, or Cloudflare bot protection). Try `downloadAllPdfs()` in-browser instead — a real browser `fetch()` carries your session and passes checks a plain script can't replicate.
