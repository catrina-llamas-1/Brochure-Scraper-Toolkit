#!/usr/bin/env bash
# Mass-download brochures from the CSV produced by extract_pdfs.js's
# downloadCsv() — uses only curl + grep, both pre-installed on macOS/Linux.
# No Python, no extra installs.
#
# Usage:
#   ./download_pdfs.sh cw_pdf_links.csv [output_dir]

set -euo pipefail

CSV="${1:?Usage: $0 cw_pdf_links.csv [output_dir]}"
OUT_DIR="${2:-brochures}"

mkdir -p "$OUT_DIR"

# Pull every quoted https://...pdf... URL out of the CSV directly, rather
# than splitting on commas — listingTitle may itself contain commas, which
# would throw off naive column-splitting.
grep -oE '"https://[^"]+\.pdf[^"]*"' "$CSV" | tr -d '"' | sort -u > "$OUT_DIR/.urls.txt"

total=$(wc -l < "$OUT_DIR/.urls.txt" | tr -d ' ')
echo "Found $total PDF URL(s) in $CSV"

i=0
while IFS= read -r url; do
  i=$((i + 1))
  fname=$(basename "${url%%\?*}")
  dest="$OUT_DIR/$fname"
  if [ -f "$dest" ]; then
    echo "[$i/$total] already downloaded: $fname"
    continue
  fi
  echo "[$i/$total] downloading: $fname"
  if curl -sL --fail --retry 3 --retry-delay 2 "$url" -o "$dest"; then
    echo "  saved -> $dest"
  else
    echo "  FAILED: $url"
    rm -f "$dest"
  fi
  sleep 1
done < "$OUT_DIR/.urls.txt"

rm -f "$OUT_DIR/.urls.txt"
echo "Done. Files saved in $OUT_DIR"
