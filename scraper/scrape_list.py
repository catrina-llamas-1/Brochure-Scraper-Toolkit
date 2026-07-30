"""
PASS 1 — paginate the search results and extract one row per listing card:
title, street address, city, province, property type, rental price, and the
detail-page URL.

The total result count / last page is detected dynamically from page 1
(regex over the page text, or config.LIST_SELECTORS['result_count_text'] if
set) — nothing is hardcoded. Pagination stops early if a page comes back
with zero cards, in case the detected page count was off.

Every fetched page is cached to disk, so re-running (e.g. after raising
--max-pages) never re-downloads pages you already have.

Usage:
    python -m scraper.scrape_list --max-pages 3          # smoke test
    python -m scraper.scrape_list                          # full run
"""

from __future__ import annotations

import argparse
import csv
import logging
import math

from . import config, http_client, parsing
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.list")

FIELDNAMES = [
    "title",
    "street_address",
    "city",
    "province",
    "property_type",
    "price",
    "detail_url",
    "source_page",
]


def build_page_url(page: int) -> str:
    return config.build_search_url(page)


def run(max_pages: int | None = None, start_page: int | None = None) -> list[dict]:
    start_page = start_page if start_page is not None else config.PAGE_START_INDEX

    first_url = build_page_url(start_page)
    logger.info("fetching page %d to detect total result count: %s", start_page, first_url)
    html = http_client.fetch(first_url, config.LIST_CACHE_DIR)
    soup = parsing.make_soup(html)

    total_results = parsing.parse_total_results(soup)
    first_page_rows = parsing.parse_listing_cards(soup, first_url)
    per_page = len(first_page_rows) or 12  # only used if count detection fails

    if total_results:
        last_page = start_page + math.ceil(total_results / per_page) - 1
        logger.info(
            "detected %d total results, %d per page -> %d pages (start_page=%d)",
            total_results, per_page, last_page - start_page + 1, start_page,
        )
    else:
        last_page = None
        logger.warning(
            "could not detect total result count; will paginate until an "
            "empty page is found (or --max-pages is hit)"
        )

    if max_pages is not None:
        capped_last = start_page + max_pages - 1
        last_page = capped_last if last_page is None else min(last_page, capped_last)

    all_rows: list[dict] = list(_tag_rows(first_page_rows, start_page))
    page = start_page + 1
    while last_page is None or page <= last_page:
        page_label = f"{page} of {last_page}" if last_page else f"{page} of ?"
        logger.info("fetching list page %s", page_label)
        url = build_page_url(page)
        html = http_client.fetch(url, config.LIST_CACHE_DIR)
        soup = parsing.make_soup(html)
        rows = parsing.parse_listing_cards(soup, url)
        if not rows:
            logger.info("page %d returned 0 cards — stopping pagination", page)
            break
        all_rows.extend(_tag_rows(rows, page))
        logger.info("page %s: %d listings (running total: %d)", page_label, len(rows), len(all_rows))
        page += 1
        if last_page is not None and page > last_page:
            break

    return all_rows


def _tag_rows(rows: list[dict], page: int):
    for row in rows:
        row = dict(row)
        row["source_page"] = page
        yield row


def save_csv(rows: list[dict], path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    logger.info("wrote %d rows to %s", len(rows), path)


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-pages", type=int, default=None, help="Stop after N pages (for smoke tests).")
    parser.add_argument("--start-page", type=int, default=None)
    parser.add_argument("--out", default=str(config.SUPERSET_LIST_CSV))
    args = parser.parse_args()

    rows = run(max_pages=args.max_pages, start_page=args.start_page)
    from pathlib import Path
    save_csv(rows, Path(args.out))


if __name__ == "__main__":
    main()
