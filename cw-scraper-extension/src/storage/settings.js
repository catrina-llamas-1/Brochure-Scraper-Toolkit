// STUB — no logic yet, see docs/SCHEMA.md §4. get/set for the "settings" key
// (API key, llmExtractionEnabled, trendMetric, defaultDelayMs).

/** @returns {Promise<object>} settings, with defaults filled in for any missing key */
export async function getSettings() {
  throw new Error("getSettings: not implemented");
}

/** @param {Partial<object>} partialSettings merged over existing settings */
export async function saveSettings(partialSettings) {
  throw new Error("saveSettings: not implemented");
}
