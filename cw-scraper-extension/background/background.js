// MV3 service worker — deliberately minimal. All real work happens in the
// worker tab (see manifest architecture note): DOMParser, pdf.js, and
// SheetJS either don't exist or aren't safely usable in this context, so
// nothing here should ever grow HTML/PDF-parsing logic.
//
// OPEN QUESTION 3 (see chat): whether this needs anything beyond an
// onInstalled hook at all — e.g. a chrome.alarms-based monthly reminder to
// re-run saved searches. Not in the brief as a requirement; flagged as an
// easy add if wanted, left out until confirmed.

chrome.runtime.onInstalled.addListener(() => {
  // Placeholder — no storage defaults are written yet; src/storage/settings.js
  // (still a stub) is the intended owner of "fill in defaults if missing"
  // once it exists, so onInstalled doesn't duplicate that logic here.
});
