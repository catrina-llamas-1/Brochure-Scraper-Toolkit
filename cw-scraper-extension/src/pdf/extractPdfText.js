// pdf.js integration. `pdfjsLib` is a GLOBAL, loaded via a <script> tag in
// worker.html from the vendored vendor/pdf.js — not npm-imported at
// runtime (see vendor/README.md). Same pattern as DOMParser in
// parseDetailPage.js: this file references the global directly rather than
// importing a module, since there's no build step to bundle one.
//
// Caller (worker.js, not yet implemented) is responsible for setting
// pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.js')
// ONCE at startup, not per-call.
//
// Per page: get text items -> groupTextItemsIntoLines() for the structured
// version, plus a plain concatenation for the audit trail. Both are
// prefixed with a "[page N]" marker so a human reading the flat Raw Text
// sheet (docs/SCHEMA.md §3) can tell which PDF page a snippet came from —
// the structured `pages` metadata array alone doesn't help with that once
// the text is flattened into one string per listing.
//
// A page with zero text items is marked image_only: true rather than
// treated as an error — pre-construction brochures are often image-only
// and that's an expected, not exceptional, case (per the brief). A page
// that throws while being processed (corrupt page data, etc.) is marked
// the same way with an additional `error` field, rather than aborting
// extraction of the rest of an otherwise-good document.
//
// OCR extension point (NOT implemented by default — see README for the
// ~10MB bundle / speed tradeoff): if image_only pages should be OCR'd, add
// that call in the `if (imageOnly)` branch below, before pushing to
// plainParts/lineParts, gated behind a settings flag. Nothing downstream
// needs to change — it would just mean image_only pages sometimes have
// real text after all.

import { groupTextItemsIntoLines } from "./lineGrouping.js";

/**
 * @param {ArrayBuffer} pdfArrayBuffer
 * @returns {Promise<{
 *   plain: string,               // audit trail: concatenated per-page text, "[page N]" markers
 *   lines: string,                // structured: concatenated line-grouped per-page text, same markers
 *   pages: Array<{page: number, item_count: number, image_only: boolean, error?: string}>,
 * }>}
 */
export async function extractPdfText(pdfArrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
  const pdfDocument = await loadingTask.promise;

  const pages = [];
  const plainParts = [];
  const lineParts = [];

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items || [];
      const imageOnly = items.length === 0;

      pages.push({ page: pageNum, item_count: items.length, image_only: imageOnly });

      if (imageOnly) {
        plainParts.push(`[page ${pageNum}] (image_only — no extractable text)`);
        lineParts.push(`[page ${pageNum}] (image_only — no extractable text)`);
      } else {
        plainParts.push(`[page ${pageNum}]\n${items.map((item) => item.str).join(" ")}`);
        lineParts.push(`[page ${pageNum}]\n${groupTextItemsIntoLines(items)}`);
      }
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      pages.push({ page: pageNum, item_count: 0, image_only: true, error: message });
      plainParts.push(`[page ${pageNum}] (failed to process: ${message})`);
      lineParts.push(`[page ${pageNum}] (failed to process: ${message})`);
    }
  }

  return {
    plain: plainParts.join("\n\n"),
    lines: lineParts.join("\n\n"),
    pages,
  };
}
