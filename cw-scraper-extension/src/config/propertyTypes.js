// Property type -> URL path slug, for:
//   .../lease/search/{type}/alberta/city-{slug}
//
// Only "office" is confirmed against the live site (it's the brief's own
// example URL). The rest are reasonable guesses based on common CW
// category names — NOT verified. Flagged in docs/SELECTORS.md: check each
// of these resolves to a real filtered page (not a 404 or a silent
// fallback to "all types") before shipping a saved search that uses it.

export const PROPERTY_TYPES = [
  { label: "Office", slug: "office", verified: true },
  { label: "Retail", slug: "retail", verified: false },
  { label: "Industrial", slug: "industrial", verified: false },
];

export const TRANSACTION_TYPES = [
  { label: "Lease", value: "lease" },
  { label: "Sublease", value: "sublease" },
];
