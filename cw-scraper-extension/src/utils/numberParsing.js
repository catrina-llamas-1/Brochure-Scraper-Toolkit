// Shared numeric parsing for values pulled from HTML labelled fields and
// (later) brochure text. Both need to turn strings like "15,000 SF" or
// "$18.00 PSF Net" into actual numbers for the xlsx numeric columns
// (docs/SCHEMA.md §3 — sorting requires real numbers, not strings), while
// leaving genuinely non-numeric values (e.g. "Contact us for pricing") as
// null rather than 0 or NaN.

/**
 * "15,000 SF" -> 15000, "12,500" -> 12500, "Contact us" -> null
 * @param {string} text
 * @returns {number|null}
 */
export function parseSquareFootage(text) {
  if (!text) return null;
  const m = String(text).match(/[\d,]+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * "$18.00 PSF Net" -> 18, "$8.00 CAD" -> 8, "Contact us for pricing" -> null
 * @param {string} text
 * @returns {number|null}
 */
export function parseCurrencyValue(text) {
  if (!text) return null;
  const m = String(text).match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
