"""
Shared configuration for the Cushman & Wakefield Greater Edmonton scraper.

IMPORTANT — read this before running anything at scale:
The CSS selectors below (LIST_SELECTORS / DETAIL_SELECTORS) are PLACEHOLDERS.
They were never checked against live markup, because this scraper was built
in a sandboxed environment with no outbound internet access. Do not trust
them.

Before running scrape_list.py or scrape_detail.py for real:
  1. Run `python -m scraper.check_robots` and read its output.
  2. Run `python -m scraper.inspect_html` and read the printed HTML
     structure + "repeated container" candidates for both a search-results
     page and a listing detail page.
  3. Fill in every "TODO" value below using what you saw.
  4. Run `python -m scraper.check_filter_params` to confirm the site's
     `state`/`city` query params actually filter server-side, and to see
     which of the candidate CITY_SLUGS return results. Prune CITY_SLUGS
     below based on that report.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Target site
# ---------------------------------------------------------------------------

BASE_URL = "https://www.cushmanwakefield.com"
SEARCH_PATH = "/en/canada/properties/lease/search"
SEARCH_URL = BASE_URL + SEARCH_PATH

# Server-side region filter. The site supports narrowing results via
# `state=` and a comma-separated `city=` slug list, so no bbox/map handling
# is needed. check_filter_params.py confirms this actually filters and
# reports which of these slugs return results — prune the list below once
# you've read that report (a slug with 0 results may just be wrong/not a
# real slug the site recognizes).
STATE_PARAM = "alberta"
CITY_SLUGS = [
    "edmonton",
    "st-albert",
    "sherwood-park",
    "spruce-grove",
    "stony-plain",
    "fort-saskatchewan",
    "leduc",
    "beaumont",
    "devon",
    "morinville",
    "nisku",
    "acheson",
]

# Intentionally not set: leave `type=` off entirely to capture all property
# types. To restrict to e.g. office listings later, set this to a
# comma-separated string like "office,office-service" and build_search_url
# will include it.
TYPE_PARAM = None

SORT_PARAM = "relevance"

# Whether the `page` query param is 1-indexed or 0-indexed. Verify with
# inspect_html.py / check_robots.py output (e.g. does `page=1` show the same
# results as no page param at all, meaning page is 0-indexed?).
PAGE_START_INDEX = 1


def build_search_url(page: int, city_slugs: list[str] | None = None) -> str:
    """Build the filtered search URL: state + city + sort + page.

    Single place both check_filter_params.py and scrape_list.py call, so the
    query-string shape only needs to be right in one spot.
    """
    slugs = CITY_SLUGS if city_slugs is None else city_slugs
    params = [f"state={STATE_PARAM}"]
    if slugs:
        params.append(f"city={','.join(slugs)}")
    if TYPE_PARAM:
        params.append(f"type={TYPE_PARAM}")
    params.append(f"sort={SORT_PARAM}")
    params.append(f"page={page}")
    return f"{SEARCH_URL}?{'&'.join(params)}"


# ---------------------------------------------------------------------------
# HTTP behavior
# ---------------------------------------------------------------------------

USER_AGENT = (
    "CushmanWakefieldEdmontonResearchBot/1.0 "
    "(+contact: catrina.llamas01@gmail.com; non-commercial research scrape "
    "of publicly listed lease properties)"
)

# Delay range (seconds) between *network* requests. Cache hits skip this.
MIN_DELAY_SECONDS = 1.0
MAX_DELAY_SECONDS = 2.0

# Retry/backoff for failed requests (timeouts, 429, 5xx).
MAX_ATTEMPTS = 4
BACKOFF_BASE_SECONDS = 2.0  # attempt N waits BACKOFF_BASE_SECONDS * 2**(N-1)

REQUEST_TIMEOUT_SECONDS = 30

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
CACHE_DIR = DATA_DIR / "cache"
LIST_CACHE_DIR = CACHE_DIR / "list_pages"
DETAIL_CACHE_DIR = CACHE_DIR / "detail_pages"
MISC_CACHE_DIR = CACHE_DIR / "misc"

SUPERSET_LIST_CSV = DATA_DIR / "pass1_list.csv"
SUPERSET_DETAIL_CSV = DATA_DIR / "pass2_detail.csv"
SUPERSET_FULL_CSV = DATA_DIR / "superset_full.csv"
LISTINGS_ANNOTATED_CSV = DATA_DIR / "listings_annotated.csv"
OUTPUT_XLSX = DATA_DIR / "cushman_wakefield_greater_edmonton.xlsx"

# ---------------------------------------------------------------------------
# Selectors — PLACEHOLDERS, see module docstring.
# ---------------------------------------------------------------------------

LIST_SELECTORS = {
    # Confirmed 2026-07-30 against live HTML (see inspect_html.py output).
    # The card *is* the <a> — it carries its own href, so detail_link is the
    # sentinel "self" rather than a child-element selector.
    "card": "a.cw-search-card.js-property-card",
    "title": "p.cw-search-card__title",
    # One <p> with <br/>-separated lines: street / "City, Province" / country.
    # Split into street_address/city/province by parsing.split_address_block().
    "address_block": "p.cw-search-card__address",
    # "For Lease • Retail" -> property type is the text after the bullet,
    # cleaned by parsing.clean_property_type().
    "property_type": "p.cw-search-card__meta",
    # "Rental Price: Contact us for pricing" -> label stripped by
    # parsing.clean_price().
    "price": "p.cw-search-card__price",
    "detail_link": "self",
    # Confirmed: "Results 1-12 of 168" — parse_total_results() extracts the
    # number after "of".
    "result_count_text": "div.cw-search__page-info",
}

DETAIL_SELECTORS = {
    # Confirmed: <dd data-available-space="4100" data-available-space-unit="SF"
    # id="AvailableSpace">4,100 SF</dd> — has a stable id, very robust.
    "square_footage": "dd#AvailableSpace",
    # Not yet located — see parsing.extract_dt_dd_pairs(), used unconditionally
    # (no selector needed) to capture whatever <dt>/<dd> spec pairs exist on
    # the page (Available Space and likely others) into the unit_breakdown
    # field, since this site doesn't use a literal <table> for this.
    "description": "TODO",
    # The "Contact for Details" modal body is EMPTY in the static HTML
    # (JS-populated on click) — broker_name/broker_contact may not be
    # scrapable via plain HTTP requests at all. See inspect_html.py's
    # data-attribute scan and modal dump for a second look before giving up.
    "broker_name": "TODO",
    "broker_contact": "TODO",
    # Brochure/PDF links are found generically (any <a href> ending in
    # .pdf), no selector needed — see parsing.extract_pdf_links().
}

# ---------------------------------------------------------------------------
# Greater Edmonton safety-net whitelist
# ---------------------------------------------------------------------------
#
# The server-side state/city filter above is the primary filtering
# mechanism now. This whitelist is only a safety net: city_safety_check.py
# uses it to FLAG rows that land outside Greater Edmonton despite the
# server-side filter — it never drops rows. Derived from CITY_SLUGS
# (hyphens -> spaces) plus the spelling variants a city field might
# realistically use.

GREATER_EDMONTON = {
    "edmonton",
    "st albert", "st. albert", "saint albert",
    "sherwood park",
    "spruce grove",
    "stony plain",
    "fort saskatchewan",
    "leduc",
    "beaumont",
    "devon",
    "morinville",
    "nisku",
    "acheson",
}
