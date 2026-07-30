"""
Confirm the site's `state`/`city` query params actually filter results
server-side, and check which of the candidate CITY_SLUGS return results.

Step A: compare the detected total-result count for the bare search URL vs
the filtered URL (state=alberta&city=<all candidate slugs>). If the counts
differ, the server honors the filter.

Step B: fetch each candidate slug individually (state=alberta&city=<slug>)
and print a slug -> result-count table, flagging any slug that returns 0
results as possibly wrong/not a real slug the site recognizes.

Usage:
    python -m scraper.check_filter_params
"""

from __future__ import annotations

import logging

from . import config, http_client, parsing
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.filter_params")


def _count_for_url(url: str) -> int | None:
    html = http_client.fetch(url, config.MISC_CACHE_DIR)
    soup = parsing.make_soup(html)
    return parsing.parse_total_results(soup)


def check_state_city_filter() -> None:
    bare_url = f"{config.SEARCH_URL}?sort={config.SORT_PARAM}&page={config.PAGE_START_INDEX}"
    filtered_url = config.build_search_url(config.PAGE_START_INDEX)

    bare_count = _count_for_url(bare_url)
    filtered_count = _count_for_url(filtered_url)

    print("=" * 70)
    print("STATE/CITY FILTER CHECK")
    print("=" * 70)
    print(f"Bare search URL:     {bare_url}")
    print(f"  detected total results: {bare_count}")
    print(f"Filtered search URL: {filtered_url}")
    print(f"  detected total results: {filtered_count}")

    print("\n" + "-" * 70)
    if bare_count is None or filtered_count is None:
        print(
            "Could not detect a total-result count on one or both pages. "
            "Fill in config.LIST_SELECTORS['result_count_text'] after "
            "running inspect_html.py, then re-run this check."
        )
        return

    if bare_count == filtered_count:
        print(
            f"VERDICT: identical result counts ({bare_count}) with and "
            "without state/city params — the server does NOT appear to be "
            "filtering. Double check the param names/values against what "
            "inspect_html.py / the site's own filter UI actually sends "
            "(open browser devtools -> Network tab and use the on-page "
            "filter controls to see the real request)."
        )
    else:
        print(
            f"VERDICT: result counts differ ({bare_count} bare vs "
            f"{filtered_count} filtered) — the server DOES filter by "
            "state/city. Proceed to Step B below for per-slug validity."
        )


def check_each_slug() -> None:
    print("\n" + "=" * 70)
    print("PER-SLUG RESULT COUNTS")
    print("=" * 70)
    results = []
    for slug in config.CITY_SLUGS:
        url = config.build_search_url(config.PAGE_START_INDEX, city_slugs=[slug])
        count = _count_for_url(url)
        results.append((slug, count))
        flag = ""
        if count is None:
            flag = "  <- could not detect a count"
        elif count == 0:
            flag = "  <- 0 results, verify slug or drop from config.CITY_SLUGS"
        print(f"  {slug:<20} {count}{flag}")

    zero_or_unknown = [slug for slug, count in results if not count]
    if zero_or_unknown:
        print(
            f"\n{len(zero_or_unknown)} slug(s) returned 0/unknown results: "
            f"{zero_or_unknown}. Review these before the full scrape — "
            "either they're spelled differently on the site, or that "
            "municipality genuinely has no active listings right now."
        )
    else:
        print("\nAll candidate slugs returned at least one result.")


def main() -> None:
    setup_logging()
    check_state_city_filter()
    check_each_slug()


if __name__ == "__main__":
    main()
