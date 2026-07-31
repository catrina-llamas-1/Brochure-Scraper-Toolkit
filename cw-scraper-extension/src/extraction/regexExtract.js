// STUB — no logic yet, see docs/SCHEMA.md.
//
// Layer 1: heuristic regex extraction from line-grouped brochure text.
// Must handle, per the brief: net rent / asking rate ($X.XX per SF, PSF,
// net), operating costs / additional rent / TMI, suite/unit numbers,
// floor, rentable SF, lease term, parking (stall count, ratio, monthly
// rate), occupancy/possession date, zoning, year built.
//
// This is the layer that MUST work standalone — Layer 2 (llmExtract.js) is
// optional and only ever merges OVER this output, never replaces it as the
// baseline.

/**
 * @param {string} lineGroupedText from extractPdfText().lines
 * @returns {object} partial Listing fields, each as {value, source: "pdf_regex"},
 *   only for fields actually found — caller merges this over defaults
 */
export function regexExtractFields(lineGroupedText) {
  throw new Error("regexExtractFields: not implemented");
}
