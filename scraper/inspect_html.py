"""
STEP 0 — run this before writing/trusting any selector in config.py.

Fetches page 1 of the search results and one listing detail page, then
prints the parts of the HTML structure you need to hand-pick selectors from:
  - repeated container (tag, class) combos that look like listing cards
    (count close to the number of cards actually on the page)
  - candidate detail-page links found on the search page
  - <script> tags that might carry embedded JSON (often more robust to
    scrape than CSS, if the page hydrates from a data blob)
  - the detail page's <table> elements (candidate unit/space breakdowns)
  - any PDF links found on the detail page (brochures)
  - raw HTML is also saved in full under data/cache/misc/ for manual
    inspection in an editor/browser devtools.

Usage:
    python -m scraper.inspect_html
    python -m scraper.inspect_html --detail-url "https://www.cushmanwakefield.com/en/canada/properties/lease/...."
"""

from __future__ import annotations

import argparse
import logging

from . import config, http_client, parsing
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.inspect")


def _print_section(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def inspect_search_page() -> list[str]:
    url = config.build_search_url(config.PAGE_START_INDEX)
    logger.info("fetching search page 1: %s", url)
    html = http_client.fetch(url, config.MISC_CACHE_DIR)
    soup = parsing.make_soup(html)

    _print_section(f"SEARCH PAGE — {url}")
    print(f"Page <title>: {soup.title.get_text(strip=True) if soup.title else '(none)'}")

    total = parsing.parse_total_results(soup)
    print(f"Detected total-result count (regex fallback): {total}")

    _print_section("Repeated (tag, class) combos — candidate listing-card containers")
    for tag, cls, n in parsing.guess_repeated_container_classes(soup):
        print(f"  count={n:<4} <{tag} class=\"{cls}\">")

    detail_links = parsing.guess_detail_links(soup, url)
    _print_section(f"Candidate detail-page links found on search page ({len(detail_links)})")
    for link in detail_links[:20]:
        print(f"  {link}")

    script_blobs = soup.find_all("script")
    json_ish = [
        s for s in script_blobs
        if s.get("type") in ("application/json", "application/ld+json")
        or (s.get("id") or "").lower() in ("__next_data__", "__nuxt__", "initial-state")
    ]
    _print_section(f"<script> tags that might carry embedded JSON data ({len(json_ish)})")
    for s in json_ish[:10]:
        label = s.get("id") or s.get("type") or "script"
        content = (s.string or "")[:200].replace("\n", " ")
        print(f"  [{label}] {content}...")

    _print_section("First 4000 chars of <body> (prettified) — skim for the card structure")
    body = soup.body
    print(body.prettify()[:4000] if body else "(no <body>)")

    return detail_links


def inspect_detail_page(detail_url: str) -> None:
    logger.info("fetching detail page: %s", detail_url)
    html = http_client.fetch(detail_url, config.MISC_CACHE_DIR)
    soup = parsing.make_soup(html)

    _print_section(f"DETAIL PAGE — {detail_url}")
    print(f"Page <title>: {soup.title.get_text(strip=True) if soup.title else '(none)'}")

    tables = soup.find_all("table")
    _print_section(f"<table> elements found ({len(tables)}) — candidate unit/space breakdown")
    for i, t in enumerate(tables[:5]):
        print(f"\n  Table #{i}:")
        print("  " + t.prettify()[:1000].replace("\n", "\n  "))

    pdfs = parsing.extract_pdf_links(soup, detail_url)
    _print_section(f"PDF links found ({len(pdfs)}) — candidate brochures")
    for p in pdfs:
        print(f"  {p}")

    _print_section("Repeated (tag, class) combos on detail page")
    for tag, cls, n in parsing.guess_repeated_container_classes(soup, low=2, high=15):
        print(f"  count={n:<4} <{tag} class=\"{cls}\">")

    _print_section("First 4000 chars of <body> (prettified) — skim for description/broker/sqft")
    body = soup.body
    print(body.prettify()[:4000] if body else "(no <body>)")


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--detail-url",
        default=None,
        help="Specific listing detail URL to inspect. If omitted, the first "
        "candidate link auto-detected on the search page is used.",
    )
    args = parser.parse_args()

    detail_links = inspect_search_page()

    detail_url = args.detail_url or (detail_links[0] if detail_links else None)
    if not detail_url:
        print(
            "\nNo detail-page URL was found automatically and none was passed "
            "with --detail-url. Open the search page in a browser, copy a "
            "listing's URL, and re-run with --detail-url."
        )
        return

    inspect_detail_page(detail_url)

    print(
        "\n\nNEXT STEP: use everything printed above to fill in "
        "LIST_SELECTORS and DETAIL_SELECTORS in scraper/config.py. "
        "Full raw HTML for both pages is cached under "
        f"{config.MISC_CACHE_DIR} for closer inspection."
    )


if __name__ == "__main__":
    main()
