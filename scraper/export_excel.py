"""
Write the final .xlsx: one sheet, one row per scraped listing, with all
fields from both passes plus the city_normalized / city_whitelist_match
safety-net columns from city_safety_check.py.

Usage:
    python -m scraper.export_excel
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import pandas as pd

from . import config
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.export")


def run(annotated_csv: Path, out_xlsx: Path) -> None:
    df = pd.read_csv(annotated_csv, dtype=str)

    out_xlsx.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(out_xlsx, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Listings", index=False)

    flagged = int((df["city_whitelist_match"] == "False").sum()) if "city_whitelist_match" in df.columns else 0
    logger.info("wrote %s: %d rows (%d flagged outside Greater Edmonton)", out_xlsx, len(df), flagged)


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--annotated-csv", default=str(config.LISTINGS_ANNOTATED_CSV))
    parser.add_argument("--out", default=str(config.OUTPUT_XLSX))
    args = parser.parse_args()

    run(Path(args.annotated_csv), Path(args.out))


if __name__ == "__main__":
    main()
