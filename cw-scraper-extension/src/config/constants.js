// Shared constants. No logic — single source of truth for names other
// modules import, so field lists can't drift out of sync between the
// scraper, the diff engine, and the xlsx builder.

export const DEFAULT_DELAY_MS = 1500;

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
