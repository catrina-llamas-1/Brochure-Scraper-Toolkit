// STUB — no logic yet, see docs/SCHEMA.md §5.
// Diffs the current run's listings against the most recent prior run for
// the same searchId, keyed on property_id, over TRACKED_CHANGE_FIELDS.

/**
 * @param {import('../config/constants.js').Listing[]} currentListings
 * @param {import('../config/constants.js').Listing[]} previousListings
 * @returns {Array<{status: "NEW"|"REMOVED"|"CHANGED", property_id: string,
 *   title: string, field_changed: string, previous_value: any,
 *   current_value: any, listing_url: string, notes: string}>}
 *   one row per changed field (see docs/SCHEMA.md §3 Changes sheet) —
 *   UNCHANGED listings produce no rows at all
 */
export function diffRuns(currentListings, previousListings) {
  throw new Error("diffRuns: not implemented");
}
