"""
Join pass-1 (list) and pass-2 (detail) CSVs into one superset, keyed on
detail_url. This is the "full scraped superset on disk" referenced by the
filter step — regenerate it any time pass 1 or pass 2 output changes.

Usage:
    python -m scraper.merge
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import pandas as pd

from . import config
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.merge")


def run(list_csv: Path, detail_csv: Path, out_csv: Path) -> pd.DataFrame:
    list_df = pd.read_csv(list_csv, dtype=str)
    logger.info("loaded %d rows from %s", len(list_df), list_csv)

    if detail_csv.exists():
        detail_df = pd.read_csv(detail_csv, dtype=str)
        logger.info("loaded %d rows from %s", len(detail_df), detail_csv)
    else:
        logger.warning("%s does not exist yet — merging list-only data", detail_csv)
        detail_df = pd.DataFrame(columns=["detail_url"])

    merged = list_df.merge(detail_df, on="detail_url", how="left", suffixes=("", "_detail"))
    merged = merged.drop_duplicates(subset=["detail_url"], keep="first")

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(out_csv, index=False)
    logger.info("wrote %d merged rows to %s", len(merged), out_csv)
    return merged


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-csv", default=str(config.SUPERSET_LIST_CSV))
    parser.add_argument("--detail-csv", default=str(config.SUPERSET_DETAIL_CSV))
    parser.add_argument("--out", default=str(config.SUPERSET_FULL_CSV))
    args = parser.parse_args()

    run(Path(args.list_csv), Path(args.detail_csv), Path(args.out))


if __name__ == "__main__":
    main()
