"""
PASS 2 — for every unique detail_url produced by pass 1, fetch the detail
page and extract: available square footage, unit/space breakdown,
description, listing broker/contact, and brochure/PDF links.

Resumable: the output CSV is appended to as each listing is processed, and
on start we load whatever's already there and skip those URLs. If this
script is killed halfway through 588 listings, re-running it picks up where
it left off — no re-fetching (cache) and no re-processing (resume-by-CSV).

Usage:
    python -m scraper.scrape_detail                          # full run
    python -m scraper.scrape_detail --limit 20                # smoke test
    python -m scraper.scrape_detail --force                    # reprocess all
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
from pathlib import Path

from . import config, http_client, parsing
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.detail")

FIELDNAMES = [
    "detail_url",
    "square_footage",
    "unit_breakdown",
    "description",
    "broker_name",
    "broker_contact",
    "brochure_links",
    "fetch_error",
]


def load_done_urls(out_path: Path) -> set[str]:
    if not out_path.exists():
        return set()
    with open(out_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {row["detail_url"] for row in reader if row.get("detail_url")}


def load_pending_urls(list_csv_path: Path) -> list[str]:
    with open(list_csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        urls = [row["detail_url"] for row in reader if row.get("detail_url")]
    # de-dup, preserve order
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def process_one(url: str) -> dict:
    row = {"detail_url": url, "fetch_error": ""}
    try:
        html = http_client.fetch(url, config.DETAIL_CACHE_DIR)
        soup = parsing.make_soup(html)
        parsed = parsing.parse_detail_page(soup, url)
        row["square_footage"] = parsed["square_footage"]
        row["description"] = parsed["description"]
        row["broker_name"] = parsed["broker_name"]
        row["broker_contact"] = parsed["broker_contact"]
        row["unit_breakdown"] = json.dumps(parsed["unit_breakdown"], ensure_ascii=False)
        row["brochure_links"] = json.dumps(parsed["brochure_links"], ensure_ascii=False)
    except parsing.NotConfiguredError:
        raise
    except http_client.FetchError as exc:
        logger.error("failed to fetch %s: %s", url, exc)
        for field in ("square_footage", "unit_breakdown", "description", "broker_name", "broker_contact", "brochure_links"):
            row[field] = ""
        row["fetch_error"] = str(exc)
    return row


def run(list_csv_path: Path, out_path: Path, limit: int | None = None, force: bool = False) -> None:
    urls = load_pending_urls(list_csv_path)
    done = set() if force else load_done_urls(out_path)
    todo = [u for u in urls if u not in done]

    if limit is not None:
        todo = todo[:limit]

    logger.info(
        "%d total listing URLs, %d already done, %d to process this run",
        len(urls), len(done), len(todo),
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = out_path.exists() and not force
    mode = "a" if file_exists else "w"
    with open(out_path, mode, newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if not file_exists:
            writer.writeheader()
            f.flush()

        for i, url in enumerate(todo, start=1):
            logger.info("listing %d of %d: %s", i, len(todo), url)
            row = process_one(url)
            writer.writerow(row)
            f.flush()  # resumability: survive a crash mid-run


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-csv", default=str(config.SUPERSET_LIST_CSV))
    parser.add_argument("--out", default=str(config.SUPERSET_DETAIL_CSV))
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N pending listings.")
    parser.add_argument("--force", action="store_true", help="Reprocess everything, ignoring existing output.")
    args = parser.parse_args()

    run(Path(args.list_csv), Path(args.out), limit=args.limit, force=args.force)


if __name__ == "__main__":
    main()
