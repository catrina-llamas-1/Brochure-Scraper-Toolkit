// STUB — no extraction logic yet, see docs/SCHEMA.md.
//
// Pass 2: parse a single listing detail page with DOMParser (this file only
// ever runs in the worker tab, never the background service worker —
// DOMParser doesn't exist there).
//
// Fields to extract (per the brief — exact selectors NOT yet confirmed,
// only the field names are; see docs/SELECTORS.md):
//   - <h1> title
//   - labelled fields: Available Space, Rental Price, Max Contiguous, Min Divisible
//   - broker block: name, title, office, profile URL
//   - property_id: from <meta property="og:image"> content, URL contains
//     "/pmedia/{propertyId}/" — regex that out, it's the primary key
//   - brochure_urls: anchors matching
//     assets.cushmanwakefield.com/-/pmedia/{id}/0/{filename}.pdf?rev=...
//     (0 or more — not every listing has one, that's expected, not an error)

/**
 * @param {string} html raw detail-page HTML
 * @param {string} url the detail page's own URL (for resolving relative links)
 * @returns {Partial<import('../config/constants.js').Listing>} everything
 *   sourced from the HTML — sourced fields tagged FIELD_SOURCE.HTML, brochure
 *   extraction/PDF fields are NOT populated here (that's the next stage)
 */
export function parseDetailPage(html, url) {
  throw new Error("parseDetailPage: not implemented");
}
