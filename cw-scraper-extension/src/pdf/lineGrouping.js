// STUB — no logic yet, see docs/SCHEMA.md and the brief's "PDF text
// extraction — do this properly" section.
//
// Algorithm (given, not to be reinvented):
//   1. Take pdf.js text items (each has str + transform matrix -> x, y).
//   2. Sort by y descending, then x ascending.
//   3. Group into lines using a y-tolerance (~3px); within a line, join
//      with a space where the x-gap exceeds roughly one space-width.
//   4. Preserve large x-gaps as column separators (tab or "|") — rent
//      tables and availability schedules depend on this surviving.
//
// Isolated from pdf.js itself so it's unit-testable against fixture
// item arrays without needing a real PDF or the pdf.js worker.

/**
 * @param {Array<{str: string, transform: number[], width: number, height: number}>} textItems
 *   raw items from a single page's getTextContent()
 * @param {object} [opts]
 * @param {number} [opts.yTolerance=3]
 * @param {number} [opts.columnGapMultiplier=1.0] gap-vs-space-width ratio
 *   beyond which a gap becomes a column separator instead of a plain space
 * @returns {string} the page's line-grouped text, one line per \n,
 *   columns within a line separated by " | "
 */
export function groupTextItemsIntoLines(textItems, opts = {}) {
  throw new Error("groupTextItemsIntoLines: not implemented");
}
