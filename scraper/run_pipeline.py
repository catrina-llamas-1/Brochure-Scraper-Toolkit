"""
Run the whole pipeline end to end: pass 1 (list) -> pass 2 (detail) -> merge
-> Greater Edmonton safety-net check -> Excel export.

Each stage is also runnable standalone (see the other scraper/*.py files),
which is the better choice once you're iterating on just one part (e.g.
re-running only city_safety_check.py after editing config.GREATER_EDMONTON).

Usage:
    # Smoke test against the first 3 list pages (~36 listings) first:
    python -m scraper.run_pipeline --max-pages 3

    # Full run once the smoke test output looks right:
    python -m scraper.run_pipeline
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from . import city_safety_check, config, export_excel, merge, scrape_detail, scrape_list
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.pipeline")


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-pages", type=int, default=None, help="Pass 1: stop after N list pages.")
    parser.add_argument("--max-listings", type=int, default=None, help="Pass 2: stop after N detail pages.")
    args = parser.parse_args()

    logger.info("=== PASS 1: list pages ===")
    rows = scrape_list.run(max_pages=args.max_pages)
    scrape_list.save_csv(rows, config.SUPERSET_LIST_CSV)

    logger.info("=== PASS 2: detail pages ===")
    scrape_detail.run(config.SUPERSET_LIST_CSV, config.SUPERSET_DETAIL_CSV, limit=args.max_listings)

    logger.info("=== MERGE ===")
    merge.run(config.SUPERSET_LIST_CSV, config.SUPERSET_DETAIL_CSV, config.SUPERSET_FULL_CSV)

    logger.info("=== SAFETY-NET CHECK: Greater Edmonton ===")
    city_safety_check.run(config.SUPERSET_FULL_CSV, config.LISTINGS_ANNOTATED_CSV)

    logger.info("=== EXPORT: Excel ===")
    export_excel.run(config.LISTINGS_ANNOTATED_CSV, config.OUTPUT_XLSX)

    logger.info("Done. Output: %s", config.OUTPUT_XLSX)


if __name__ == "__main__":
    main()
