// STUB — no logic yet, see docs/SCHEMA.md §4.
// Archive/prune/export for run history, keyed "runHistory:{searchId}".
// Keeps the last MAX_RETAINED_RUNS (constants.js), newest first.

/**
 * @param {string} searchId
 * @param {object} runRecord {timestamp, searchId, searchName, summary, listings}
 *   NOTE: listings here should already have raw_text stripped — see
 *   docs/SCHEMA.md OPEN QUESTION 2. Stripping happens in worker.js before
 *   calling this, not inside it, so this module stays a dumb store.
 */
export async function archiveRun(searchId, runRecord) {
  throw new Error("archiveRun: not implemented");
}

/**
 * @param {string} searchId
 * @returns {Promise<object[]>} runs, newest first
 */
export async function getRunHistory(searchId) {
  throw new Error("getRunHistory: not implemented");
}

/** @returns {Promise<object>} the entire runHistory namespace, for JSON export */
export async function exportAllHistoryAsJson() {
  throw new Error("exportAllHistoryAsJson: not implemented");
}
