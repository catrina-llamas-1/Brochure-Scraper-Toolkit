// STUB — no extraction logic yet, see docs/SCHEMA.md.
//
// Pass 1: for a single city, walk paginated search results and collect
// deduped detail-page URLs. Called once per city in the saved search; the
// caller (worker.js) is responsible for merging/deduping across cities.
//
// IMPORTANT (per the brief): use the PATH-form URL
//   /en/canada/properties/lease/search/{type}/alberta/city-{citySlug}?page=N
// NEVER the query-string multi-city form — appending &page=N to that
// silently drops extra cities and resets to page 1. Do not "simplify" this
// back to a single multi-city query URL; it's a deliberate workaround for
// confirmed site behavior, not an oversight.
//
// Card selector: anchors whose href contains "/properties/for-lease/"
// (confirmed in the brief). Stop paginating when a page yields zero URLs
// not already seen.

/**
 * @param {object} params
 * @param {string} params.citySlug
 * @param {string} params.propertyTypeSlug
 * @param {number} params.delayMs
 * @param {(msg: string) => void} [params.onProgress]
 * @returns {Promise<string[]>} deduped absolute detail-page URLs for this city
 */
export async function discoverListingsForCity({ citySlug, propertyTypeSlug, delayMs, onProgress }) {
  throw new Error("discoverListingsForCity: not implemented");
}

/**
 * Runs discoverListingsForCity for every configured city and returns the
 * union, deduped by URL.
 * @param {object} params
 * @param {string[]} params.citySlugs
 * @param {string} params.propertyTypeSlug
 * @param {number} params.delayMs
 * @param {(msg: string) => void} [params.onProgress]
 * @returns {Promise<string[]>}
 */
export async function discoverAllListings({ citySlugs, propertyTypeSlug, delayMs, onProgress }) {
  throw new Error("discoverAllListings: not implemented");
}
