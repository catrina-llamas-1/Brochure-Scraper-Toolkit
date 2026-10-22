"""
Mass-download brochures from the CSV produced by extract_pdfs.js's
downloadCsv() — no browser tab required.

Runs as a plain script outside the browser, so it isn't subject to CORS
(that's a browser-JS-only restriction) — a normal HTTP GET works fine even
against assets.cushmanwakefield.com.

Usage:
    pip install requests
    python download_pdfs_from_csv.py cw_pdf_links.csv [output_dir]

Reads the "pdfUrl" and "listingTitle" columns (as written by
extract_pdfs.js's downloadCsv()), downloads each PDF, skips files already
downloaded (safe to re-run/resume), and adds a small delay between
requests.
"""

from __future__ import annotations

import csv
import sys
import time
import random
from pathlib import Path
from urllib.parse import urlparse, unquote

import requests

USER_AGENT = (
    "Mozilla/5.0 (compatible; brochure-downloader/1.0; "
    "run manually by a human for personal research)"
)
MIN_DELAY_SECONDS = 1.0
MAX_DELAY_SECONDS = 2.0
MAX_ATTEMPTS = 4
BACKOFF_BASE_SECONDS = 2.0
TIMEOUT_SECONDS = 30


def sanitize(name: str) -> str:
    safe = "".join(c if c not in '\\/:*?"<>|' else "_" for c in name)
    return safe.strip()[:150] or "document"


def filename_for(pdf_url: str, listing_title: str) -> str:
    url_name = unquote(Path(urlparse(pdf_url).path).name) or "document.pdf"
    if not url_name.lower().endswith(".pdf"):
        url_name += ".pdf"
    if listing_title:
        return sanitize(f"{listing_title}__{url_name}")
    return sanitize(url_name)


def download_one(session: requests.Session, url: str, dest: Path) -> bool:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            resp = session.get(url, timeout=TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            print(f"  attempt {attempt}/{MAX_ATTEMPTS} error: {exc}")
        else:
            if resp.status_code == 200:
                dest.write_bytes(resp.content)
                return True
            print(f"  attempt {attempt}/{MAX_ATTEMPTS} HTTP {resp.status_code}")
            if resp.status_code in (401, 403, 404):
                break
        if attempt < MAX_ATTEMPTS:
            time.sleep(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))
    return False


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python download_pdfs_from_csv.py cw_pdf_links.csv [output_dir]")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("brochures")
    out_dir.mkdir(parents=True, exist_ok=True)

    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows or "pdfUrl" not in rows[0]:
        print(f"No 'pdfUrl' column found in {csv_path}")
        sys.exit(1)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    total = len(rows)
    downloaded = skipped = failed = 0

    for i, row in enumerate(rows, start=1):
        pdf_url = row.get("pdfUrl", "").strip()
        if not pdf_url:
            continue
        listing_title = row.get("listingTitle", "").strip()
        dest = out_dir / filename_for(pdf_url, listing_title)

        if dest.exists():
            print(f"[{i}/{total}] already downloaded: {dest.name}")
            skipped += 1
            continue

        print(f"[{i}/{total}] downloading: {pdf_url}")
        if download_one(session, pdf_url, dest):
            print(f"  saved -> {dest}")
            downloaded += 1
        else:
            print(f"  FAILED after {MAX_ATTEMPTS} attempts: {pdf_url}")
            failed += 1

        if i < total:
            time.sleep(random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS))

    print(
        f"\nDone. {downloaded} downloaded, {skipped} already present, "
        f"{failed} failed. Saved to {out_dir.resolve()}"
    )


if __name__ == "__main__":
    main()
