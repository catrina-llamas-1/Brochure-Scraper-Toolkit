// MV3 service worker — deliberately minimal. All real work happens in the
// worker tab (see manifest architecture note): DOMParser, pdf.js, and
// SheetJS either don't exist or aren't safely usable in this context, so
// nothing here should ever grow HTML/PDF-parsing logic.
//
// Resolved: no chrome.alarms-based monthly reminder — out of scope. This
// file stays as small as onInstalled requires and should stay that way.

chrome.runtime.onInstalled.addListener(() => {
  // Placeholder — no storage defaults are written yet; src/storage/settings.js
  // (still a stub) is the intended owner of "fill in defaults if missing"
  // once it exists, so onInstalled doesn't duplicate that logic here.
});
