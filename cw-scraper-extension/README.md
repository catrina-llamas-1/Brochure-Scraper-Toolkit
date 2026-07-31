# CW Listing Scraper (Chrome extension)

Scrapes Cushman & Wakefield lease listings and their brochure PDFs into a
tracked Excel export. Runs entirely client-side — no server.

**Status: scaffold only.** File structure and data schema are laid out (see
`docs/SCHEMA.md`); every module under `src/` is currently a stub (JSDoc +
throws `not implemented`) pending confirmation of the schema. Nothing here
scrapes anything yet.

## Personal research use only

This tool automates requests against `cushmanwakefield.com`. Review the
site's terms of use before running it, keep the request delay reasonable,
and don't redistribute scraped data in ways that would violate those terms.
This was built for personal research/tracking, not resale or bulk
redistribution of listing data.

## Install (once implemented)

1. `npm install` in this directory, then follow `vendor/README.md` to copy
   `pdf.js`/`pdf.worker.min.js`/`xlsx.full.min.js` into `vendor/`.
2. `chrome://extensions` → enable Developer mode → "Load unpacked" → select
   this directory.
3. Pin the extension, open the popup, configure a search, Start Scrape.

## Architecture notes

- **Popup is a thin launcher only.** It calls `chrome.tabs.create()` on
  `worker/worker.html`, which does the entire job. This is not optional
  polish — an MV3 background service worker has no `DOMParser`, and a
  popup closes the moment it loses focus, which would kill a multi-minute
  run. The worker tab survives both.
- **No remote scripts.** Extension CSP forbids them anyway. `pdf.js` and
  `SheetJS` are vendored as local files, not CDN-loaded.
- **Sequential, throttled requests.** No parallelization — this hits a
  real public website and the whole job is under ~40 listings. See
  `src/net/fetchWithRetry.js`.
- **Path-form URLs only for pagination.** The query-string multi-city
  search form silently drops cities and resets to page 1 when you append
  `&page=N`. Don't "fix" `discoverListings.js` to use it — see that file's
  header comment.

## Brittle selectors

See `docs/SELECTORS.md` for what's confirmed vs. still needs a live-HTML
check, and where to look first if the site's markup changes.

## OCR (not implemented)

Image-only brochure pages are flagged (`image_only: true`) rather than
OCR'd. `src/pdf/extractPdfText.js` has a marked extension point for
`tesseract.js` if you want to add it — tradeoff is roughly a 10MB bundle
increase and much slower per-page processing, so it's off by default.

## LLM extraction (optional, off by default)

Settings lets you paste an Anthropic API key to enable a second extraction
pass over brochure text. Two things to know before turning it on:
1. The key lives in `chrome.storage.local`, which is readable by anyone
   with access to this browser profile — it is not encrypted at rest.
2. Enabling it sends brochure text to Anthropic's API on every run.

The extension is fully functional without this — Layer 1 (regex) always
runs regardless.
