// Shared fetch wrapper for every network call in the pipeline (search
// pages, detail pages, brochure PDFs). Sequential by design — the caller
// awaits each call, this module does not parallelize internally either.
//
// A delayMs wait happens BEFORE every attempt, including the first — this
// is the mechanism that enforces the "1-2s between requests" requirement,
// not something callers implement separately. Failed requests are never
// thrown past this function for a plain fetch/HTTP failure: it returns a
// typed {ok: false} result instead, so one bad listing/page never aborts
// the run (only genuinely unexpected errors, like an invalid URL, throw).

import { DEFAULT_DELAY_MS, MAX_RETRIES } from "../config/constants.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.delayMs]
 * @param {"text"|"arraybuffer"} [opts.responseType]
 * @param {number} [opts.maxRetries]
 * @returns {Promise<{ok: true, data: string|ArrayBuffer} | {ok: false, error: string, attempts: number}>}
 */
export async function fetchWithRetry(url, opts = {}) {
  const { delayMs = DEFAULT_DELAY_MS, responseType = "text", maxRetries = MAX_RETRIES } = opts;

  let lastError = "unknown error";
  const totalAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    // Exponential backoff on retries (attempt 2 waits 2x, attempt 3 waits
    // 4x, ...), on top of the base delay every attempt pays regardless.
    const backoff = attempt === 1 ? 0 : delayMs * 2 ** (attempt - 2);
    await sleep(delayMs + backoff);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const data = responseType === "arraybuffer" ? await response.arrayBuffer() : await response.text();
      return { ok: true, data };
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
  }

  return { ok: false, error: lastError, attempts: totalAttempts };
}
