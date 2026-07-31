// STUB — no logic yet, see docs/SCHEMA.md §4.
// CRUD for named search configs in chrome.storage.local under "savedSearches".

/** @returns {Promise<object>} { [searchId]: SavedSearch } */
export async function listSavedSearches() {
  throw new Error("listSavedSearches: not implemented");
}

/**
 * @param {{name: string, cities: string[], propertyType: string, transactionType: string, delayMs: number}} config
 * @returns {Promise<string>} the new searchId
 */
export async function saveSearch(config) {
  throw new Error("saveSearch: not implemented");
}

/** @param {string} searchId */
export async function deleteSearch(searchId) {
  throw new Error("deleteSearch: not implemented");
}
