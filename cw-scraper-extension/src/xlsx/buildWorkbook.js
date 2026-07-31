// STUB — no logic yet, see docs/SCHEMA.md §3.
// Assembles the SheetJS workbook: Changes (first), Listings, Spaces, Trend,
// Raw Text. Frozen header rows, autosized columns, numeric columns written
// as numbers, conditional fill on the Changes sheet (green NEW / red
// REMOVED / amber CHANGED).

/**
 * @param {object} data
 * @param {import('../config/constants.js').Listing[]} data.listings
 * @param {Array} data.spaces
 * @param {Array} [data.changes] omitted entirely (no sheet) on a search's first-ever run
 * @param {Array} [data.trend]
 * @param {string} data.trendMetricLabel
 * @returns {Uint8Array} the .xlsx file bytes, ready for chrome.downloads.download()
 */
export function buildWorkbook({ listings, spaces, changes, trend, trendMetricLabel }) {
  throw new Error("buildWorkbook: not implemented");
}

/** @returns {string} e.g. "cw-listings-2026-07-31-1430.xlsx" */
export function buildFilename(date = new Date()) {
  throw new Error("buildFilename: not implemented");
}
