// STUB — no logic yet, see docs/SCHEMA.md §4.
// In-progress run state, keyed "inProgressRun:{searchId}" — persisted after
// EVERY listing (not batched) so a crash/closed tab loses at most one
// listing's work. worker.js checks for this on launch and offers to resume.

/** @param {string} searchId @param {object} partialState */
export async function saveRunState(searchId, partialState) {
  throw new Error("saveRunState: not implemented");
}

/** @param {string} searchId @returns {Promise<object|null>} */
export async function loadRunState(searchId) {
  throw new Error("loadRunState: not implemented");
}

/** @param {string} searchId */
export async function clearRunState(searchId) {
  throw new Error("clearRunState: not implemented");
}
