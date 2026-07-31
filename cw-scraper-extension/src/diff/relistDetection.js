// STUB — no logic yet, see docs/SCHEMA.md §6.
// Pairs REMOVED and NEW rows sharing a normalized address, annotating both
// with a "possible re-list" note rather than reporting them as unrelated.
// Called after diffRuns() — mutates/returns the same Changes-row array.

/**
 * @param {Array} changeRows output of changeDetection.diffRuns()
 * @returns {Array} same rows, with `notes` populated on matched pairs
 */
export function annotatePossibleRelists(changeRows) {
  throw new Error("annotatePossibleRelists: not implemented");
}
