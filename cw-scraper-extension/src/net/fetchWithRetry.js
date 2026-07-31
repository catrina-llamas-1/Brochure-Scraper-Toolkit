// STUB — no logic yet, see docs/SCHEMA.md.
//
// Shared fetch wrapper for every network call in the pipeline (search
// pages, detail pages, brochure PDFs). Sequential by design — the caller
// awaits each call, this module does not parallelize internally either.
//
// Behavior: retry failed fetches twice with exponential backoff, then
// return a typed failure (never throw past this function for a plain
// fetch failure — one bad listing must not abort the run). A delayMs wait
// happens BEFORE each attempt (including the first), so callers don't need
// their own throttling.

/**
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.delayMs=1500]
 * @param {"text"|"arraybuffer"} [opts.responseType="text"]
 * @param {number} [opts.maxRetries=2]
 * @returns {Promise<{ok: true, data: string|ArrayBuffer} | {ok: false, error: string, attempts: number}>}
 */
export async function fetchWithRetry(url, opts = {}) {
  throw new Error("fetchWithRetry: not implemented");
}
