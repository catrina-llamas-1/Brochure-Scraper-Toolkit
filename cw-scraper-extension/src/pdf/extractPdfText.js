// STUB — no logic yet, see docs/SCHEMA.md.
//
// pdf.js integration. Vendored, not npm-installed at runtime — see
// vendor/README.md. Caller is responsible for setting
// pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.js')
// once, at worker.html startup, not per-call.
//
// Per page: get text items -> groupTextItemsIntoLines() (pdf/lineGrouping.js)
// for the structured version, plus a plain concatenation for the audit
// trail. A page with zero text items is marked image_only: true rather
// than treated as an error — pre-construction brochures are often
// image-only and that's an expected, not exceptional, case.
//
// OCR extension point (not implemented by default — see README for the
// ~10MB bundle / speed tradeoff): if image_only pages should be OCR'd,
// that hook goes here, gated behind a settings flag, before this function
// returns — NOT bolted on downstream.

/**
 * @param {ArrayBuffer} pdfArrayBuffer
 * @returns {Promise<{
 *   plain: string,               // audit trail: concatenated raw per-page text
 *   lines: string,                // structured: concatenated line-grouped per-page text
 *   pages: Array<{page: number, item_count: number, image_only: boolean}>,
 * }>}
 */
export async function extractPdfText(pdfArrayBuffer) {
  throw new Error("extractPdfText: not implemented");
}
