# Cushman & Wakefield Canada — Greater Edmonton Lease Scraper

Two-pass scraper for
`https://www.cushmanwakefield.com/en/canada/properties/lease/search`,
filtered server-side to Greater Edmonton via `state`/`city` query params,
producing a single `.xlsx` of listings.

## Important: selectors are placeholders, not yet verified

This was built in a sandboxed environment with **no outbound internet
access** (confirmed by testing against a neutral control domain, not just
the target site — every external host returned a proxy-level 403). That
means the things the task explicitly asked for first — confirming the
`state`/`city` params actually filter, and reading real HTML before writing
selectors — could not be done here.

Everything below is built and tested (with synthetic HTML fixtures standing
in for the real site) so the *mechanics* are verified: URL construction,
pagination/result-count detection, caching, retries, resumable pass 2, the
Greater Edmonton safety-net check, and the Excel export all work correctly.
The only unverified parts are `scraper/config.py`'s `LIST_SELECTORS` /
`DETAIL_SELECTORS` (literal `"TODO"` placeholders) and `CITY_SLUGS` (a
12-item candidate list that needs confirming against the live site). **Do
not run this at scale until you've completed Steps 0-1 below.**

## Setup

```bash
pip install -r requirements.txt
```

## Step 0 — inspect real markup (do this first, from a machine with internet access)

```bash
python -m scraper.check_robots      # note any Disallow rules / crawl-delay
python -m scraper.inspect_html      # fetches the filtered page 1 + a detail page, prints structure
```

`inspect_html.py` fetches page 1 of the *filtered* search
(`state=alberta&city=<all candidate slugs>&sort=relevance&page=1`) and
prints:
- the site's detected total-result count
- repeated `(tag, class)` combos that are likely the listing-card container
  (their count on page 1 should be close to the number of cards per page —
  12, per the task)
- candidate detail-page links found on the search page
- any `<script>` tags that might carry embedded JSON (sometimes easier to
  parse than the rendered HTML, if the site hydrates from a data blob)
- for the detail page: `<table>` candidates for the unit/space breakdown,
  PDF links (brochures), and a body excerpt

Use that output to fill in every `"TODO"` in `scraper/config.py`
(`LIST_SELECTORS`, `DETAIL_SELECTORS`). Full raw HTML is also cached under
`data/cache/misc/` for closer inspection in an editor or browser devtools.

**Note on rendering:** if `inspect_html.py`'s output looks like an empty
shell with no card content (common on JS-heavy sites where results load via
client-side fetch/XHR rather than being present in the initial HTML), the
selectors will need to target either an embedded JSON blob in a `<script>`
tag, or you'll need to find the underlying data API the page calls (check
the Network tab in devtools) and hit that directly instead of scraping
rendered HTML. `parsing.py` is structured so swapping the extraction
strategy only requires changing `parse_listing_cards`/`parse_detail_page`,
not the rest of the pipeline.

## Step 1 — confirm state/city filtering and validate city slugs

```bash
python -m scraper.check_filter_params
```

This does two things:
1. Compares the detected total-result count for the bare search URL vs
   `state=alberta&city=<all candidate slugs>&sort=relevance` — if the
   counts differ, the server is genuinely filtering server-side.
2. Fetches each of the 12 candidate `CITY_SLUGS` individually
   (`edmonton`, `st-albert`, `sherwood-park`, `spruce-grove`,
   `stony-plain`, `fort-saskatchewan`, `leduc`, `beaumont`, `devon`,
   `morinville`, `nisku`, `acheson`) and prints a `slug -> result count`
   table, flagging any that return 0 as possibly wrong (wrong spelling, or
   the site just uses a different slug for that municipality).

**I could not run this against the live site.** Run it yourself, prune
`config.CITY_SLUGS` based on the report (drop/fix any 0-result slugs), and
only then move on to a real scrape.

## Step 2 — smoke test against 2-3 pages

```bash
python -m scraper.run_pipeline --max-pages 3
```

Inspect `data/cushman_wakefield_greater_edmonton.xlsx` and the intermediate
CSVs in `data/` before running at full scale. If something looks wrong,
adjust `config.py` selectors and re-run — cached pages mean this is cheap.

## Step 3 — full run

```bash
python -m scraper.run_pipeline
```

Or run stages individually (useful once you're only iterating on one part):

```bash
python -m scraper.scrape_list                # pass 1: list pages -> data/pass1_list.csv
python -m scraper.scrape_detail               # pass 2: detail pages -> data/pass2_detail.csv (resumable)
python -m scraper.merge                       # join pass 1 + pass 2 -> data/superset_full.csv
python -m scraper.city_safety_check           # annotate + report -> data/listings_annotated.csv
python -m scraper.export_excel                # -> data/cushman_wakefield_greater_edmonton.xlsx
```

## The Greater Edmonton check is a safety net, not the filter

Filtering happens server-side (`state=alberta&city=<slugs>` in the request
URL itself), so `city_safety_check.py` does **not** drop any rows. It
normalizes each row's `city` (lowercase, strip, drop trailing `", Alberta"`,
collapse internal spaces — falling back to substring-matching the address
if `city` is blank) and adds two columns, `city_normalized` and
`city_whitelist_match`, flagging (not removing) any row whose city lands
outside `config.GREATER_EDMONTON`. It prints:
- a count of flagged rows and a `value_counts()` of their raw city values,
  so spelling variants or surprises are easy to spot
- which whitelist entries matched zero rows in this scrape (a
  cross-check against `check_filter_params.py`'s per-slug report)

It's re-runnable: edit `GREATER_EDMONTON` in `scraper/config.py` and re-run
just this stage against the cached `data/superset_full.csv` — no
re-scraping needed.

## Robustness features

- **User-Agent**: descriptive, includes contact info
  (`scraper/config.py:USER_AGENT`).
- **Delay**: randomized 1-2s between network requests
  (`MIN_DELAY_SECONDS`/`MAX_DELAY_SECONDS`); cache hits skip the delay
  entirely.
- **Retries**: failed requests retry up to `MAX_ATTEMPTS` (default 4) with
  exponential backoff; 401/403/404 don't retry (won't fix themselves).
- **Caching**: every fetched URL is cached to disk under `data/cache/`
  (list pages, detail pages, and misc/inspection fetches kept separate).
  Re-running any stage never re-downloads a page already on disk.
- **Resumable pass 2**: `scrape_detail.py` appends to its output CSV as it
  goes (flushing after every row) and skips URLs already present on
  restart — killing it partway through and re-running picks up where it
  left off, with `--limit N` to test on a subset first.
- **Logging**: progress logs for "page X of Y" (pass 1) and "listing X of N"
  (pass 2), plus warnings for failed fetches / empty pages / unconfigured
  selectors.

## Output

`data/cushman_wakefield_greater_edmonton.xlsx` — one sheet, **Listings**:
every scraped row, all fields from both passes, plus `city_normalized` and
`city_whitelist_match` from the safety-net check.

## File layout

```
scraper/
  config.py             # URLs, state/city/sort params + build_search_url(), selectors (TODO), delay/retry, GREATER_EDMONTON
  http_client.py         # cached, rate-limited, retrying fetch()
  parsing.py               # HTML -> rows; generic fallbacks + configured-selector extraction
  logging_setup.py
  check_robots.py          # Step 0a
  inspect_html.py           # Step 0b — run before trusting any selector
  check_filter_params.py     # Step 1 — confirm state/city filtering + validate CITY_SLUGS
  scrape_list.py               # Pass 1
  scrape_detail.py               # Pass 2 (resumable)
  merge.py                         # join pass 1 + pass 2
  city_safety_check.py               # re-runnable Greater Edmonton flag/report (no drops)
  export_excel.py                      # final .xlsx (single sheet)
  run_pipeline.py                        # orchestrates all of the above
data/                                     # generated; gitignored except .gitkeep
```
