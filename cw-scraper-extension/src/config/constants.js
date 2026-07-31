// Shared constants. No logic — single source of truth for names other
// modules import, so field lists can't drift out of sync between the
// scraper, the diff engine, and the xlsx builder.

export const BASE_URL = "https://www.cushmanwakefield.com";

export const DEFAULT_DELAY_MS = 1500;

export const MAX_RETRIES = 2; // "retry twice with exponential backoff" — 3 attempts total per fetch

export const EXTRACTION_STATUS = Object.freeze({
  OK: "ok",
  NO_BROCHURE: "no_brochure",
  IMAGE_ONLY: "image_only",
  FAILED: "failed",
});

export const FIELD_SOURCE = Object.freeze({
  HTML: "html",
  PDF_REGEX: "pdf_regex",
  PDF_LLM: "pdf_llm",
  MISSING: "missing",
});

// 1-letter codes used in the Listings sheet's single `field_sources` summary
// column (resolved design question — not a column per field). Format:
// semicolon-separated "field=code" pairs, e.g. "net_rent=r;broker_name=h".
// Built by src/xlsx/buildWorkbook.js from each SOURCED_FIELDS entry's
// {value, source}; only non-html fields are worth calling out, but all are
// included for a complete audit trail.
export const FIELD_SOURCE_ABBREV = Object.freeze({
  [FIELD_SOURCE.HTML]: "h",
  [FIELD_SOURCE.PDF_REGEX]: "r",
  [FIELD_SOURCE.PDF_LLM]: "l",
  [FIELD_SOURCE.MISSING]: "m",
});

// Fields on the Listing object that are {value, source} pairs, extracted
// from the brochure/detail page rather than known outright (title, url).
export const SOURCED_FIELDS = [
  "available_sf",
  "max_contiguous_sf",
  "min_divisible_sf",
  "net_rent",
  "additional_rent",
  "gross_rent",
  "lease_term",
  "parking",
  "occupancy_date",
  "broker_name",
  "broker_phone",
  "broker_email",
];

// Fields compared run-over-run for the Changes sheet (docs/SCHEMA.md §5).
export const TRACKED_CHANGE_FIELDS = [
  "available_sf",
  "max_contiguous_sf",
  "min_divisible_sf",
  "net_rent",
  "additional_rent",
  "lease_term",
  "occupancy_date",
  "broker_name",
  "brochure_url",
];

export const MAX_RETAINED_RUNS = 12;

export const TREND_METRICS = Object.freeze({
  NET_RENT: "net_rent",
  AVAILABLE_SF: "available_sf",
});
