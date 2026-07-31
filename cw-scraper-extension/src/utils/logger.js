// STUB — no logic yet.
// Backs the worker tab's error-log pane and the end-of-run summary (N
// scraped, N without brochures, N image-only, N failed — WITH titles, not
// just counts, per the brief).

export class RunLogger {
  constructor() {
    throw new Error("RunLogger: not implemented");
  }

  /** @param {string} level "info"|"warn"|"error" @param {string} message @param {object} [context] */
  log(level, message, context) {
    throw new Error("not implemented");
  }

  /** @returns {{scraped: number, noBrochure: number, imageOnly: number, failed: number, entries: Array}} */
  summarize() {
    throw new Error("not implemented");
  }
}
