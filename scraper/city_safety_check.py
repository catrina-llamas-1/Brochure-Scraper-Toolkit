"""
Safety-net check, not a primary filter: the server-side state/city params
(scrape_list.py) already scope the scrape to Greater Edmonton, so this step
never drops rows. It normalizes each row's city and FLAGS any row that
falls outside the Greater Edmonton whitelist, so you can spot anything the
server let through unexpectedly.

Normalization: lowercase, strip whitespace, drop trailing ", Alberta",
collapse internal spaces. If `city` is blank but `street_address` isn't,
falls back to substring-matching the whitelist against the address.

Re-runnable: edit config.GREATER_EDMONTON and re-run this alone as many
times as needed, against the cached data/superset_full.csv — no
re-scraping required.

Usage:
    python -m scraper.city_safety_check
"""

from __future__ import annotations

import argparse
import logging
import re
from pathlib import Path

import pandas as pd

from . import config
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.safety_check")

_TRAILING_ALBERTA_RE = re.compile(r",\s*alberta\s*$", re.I)
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_city(city) -> str:
    if not isinstance(city, str):
        return ""
    c = city.strip().lower()
    c = _TRAILING_ALBERTA_RE.sub("", c)
    c = _WHITESPACE_RE.sub(" ", c).strip()
    return c


def _whitelist_match(row) -> bool:
    city_norm = row["city_normalized"]
    if city_norm:
        return city_norm in config.GREATER_EDMONTON
    address = row.get("street_address", "")
    if isinstance(address, str) and address.strip():
        addr_lower = address.lower()
        return any(muni in addr_lower for muni in config.GREATER_EDMONTON)
    return False


def run(superset_csv: Path, out_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(superset_csv, dtype=str)
    logger.info("loaded %d rows from %s", len(df), superset_csv)

    df["city_normalized"] = df.get("city", pd.Series(dtype=str)).apply(normalize_city)
    df["city_whitelist_match"] = df.apply(_whitelist_match, axis=1)

    flagged = df[~df["city_whitelist_match"]]

    print("\n" + "=" * 70)
    print(f"{len(df)} total rows, {len(flagged)} flagged as outside Greater Edmonton")
    print("=" * 70)
    if len(flagged):
        display = flagged["city"].fillna("").apply(lambda c: c.strip() or "(blank)")
        print("Flagged rows by (raw) city value:")
        print(display.value_counts().to_string())
    else:
        print("No rows flagged — every row's city matched the whitelist.")

    matched_norms = set(df.loc[df["city_whitelist_match"], "city_normalized"])
    dead_entries = sorted(config.GREATER_EDMONTON - matched_norms)
    if dead_entries:
        print(
            f"\nWhitelist entries with zero matching rows in this scrape: "
            f"{dead_entries} (expected if that municipality has no active "
            "listings right now; cross-check against check_filter_params.py)."
        )

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False)
    logger.info("wrote %d annotated rows to %s", len(df), out_csv)

    return df


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--superset-csv", default=str(config.SUPERSET_FULL_CSV))
    parser.add_argument("--out", default=str(config.LISTINGS_ANNOTATED_CSV))
    args = parser.parse_args()

    run(Path(args.superset_csv), Path(args.out))


if __name__ == "__main__":
    main()
