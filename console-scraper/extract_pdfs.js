/**
 * Cushman & Wakefield — PDF extractor (paste into DevTools Console)
 *
 * WHAT THIS DOES
 * Run this on a search-results page, e.g.
 *   https://www.cushmanwakefield.com/en/canada/properties/lease/search?...
 * It:
 *   1. Collects every listing link on the current results page.
 *   2. Grabs any PDF links already present on the page itself.
 *   3. Visits each listing's detail page (via fetch, using your logged-in
 *      session/cookies) and pulls out brochure/document PDF links + the
 *      listing title.
 *   4. Prints a table in the console and gives you `downloadCsv()` /
 *      `downloadJson()` helpers to save the results.
 *
 * HOW TO USE
 *   1. Open the search-results page in Chrome.
 *   2. Open DevTools (F12 or Cmd+Opt+I) -> Console tab.
 *   3. Paste this whole file in and press Enter.
 *   4. Wait for it to finish (it logs progress + a final console.table).
 *   5. Run `downloadCsv()` or `downloadJson()` in the console to save the
 *      results to a file.
 *
 * If you're already on a single listing/detail page instead of a search
 * page, it still works — it'll just extract PDFs from that one page.
 *
 * Selectors below match what's documented in
 * cw-scraper-extension/docs/SELECTORS.md. If the site's markup has
 * changed, tweak LISTING_LINK_PATTERN / PDF_LINK_PATTERN below.
 */
(async function extractPdfsFromSearchResults() {
  const LISTING_LINK_PATTERN = /\/properties\/for-lease\//i;
  const PDF_LINK_PATTERN = /\.pdf(\?|$)/i;
  const DELAY_MS = 800; // be polite between detail-page fetches

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const absUrl = (href) => {
    try {
      return new URL(href, location.href).href;
    } catch {
      return null;
    }
  };

  const extractPdfLinksFromDoc = (doc, baseUrl) => {
    const pdfs = new Set();
    doc.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      const full = absUrl(href) || href;
      if (PDF_LINK_PATTERN.test(full)) pdfs.add(full);
    });
    return [...pdfs];
  };

  const getTitle = (doc) => {
    const h1 = doc.querySelector("h1");
    return h1 ? h1.textContent.trim() : "";
  };

  console.log("[cw-pdf-extractor] Scanning current page for listing links...");

  const listingLinks = new Set();
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && LISTING_LINK_PATTERN.test(href)) {
      const full = absUrl(href);
      if (full) listingLinks.add(full.split("#")[0]);
    }
  });

  console.log(
    `[cw-pdf-extractor] Found ${listingLinks.size} listing link(s) on this page.`
  );

  const results = [];

  // PDFs already on the current page (covers the case where you're on a
  // detail page, or the search page itself embeds brochure links).
  const pageOwnPdfs = extractPdfLinksFromDoc(document, location.href);
  pageOwnPdfs.forEach((pdfUrl) => {
    results.push({
      listingUrl: location.href,
      listingTitle: getTitle(document),
      pdfUrl,
    });
  });

  const listingUrls = [...listingLinks];
  for (let i = 0; i < listingUrls.length; i++) {
    const url = listingUrls[i];
    console.log(
      `[cw-pdf-extractor] (${i + 1}/${listingUrls.length}) Fetching ${url}`
    );
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        console.warn(`[cw-pdf-extractor] ${url} -> HTTP ${resp.status}, skipping`);
        continue;
      }
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const title = getTitle(doc);
      const pdfLinks = extractPdfLinksFromDoc(doc, url);

      if (pdfLinks.length === 0) {
        console.log(`[cw-pdf-extractor]   no PDFs found on ${url}`);
      }
      pdfLinks.forEach((pdfUrl) => {
        results.push({ listingUrl: url, listingTitle: title, pdfUrl });
      });
    } catch (err) {
      console.warn(`[cw-pdf-extractor] failed to fetch ${url}:`, err);
    }
    if (i < listingUrls.length - 1) await sleep(DELAY_MS);
  }

  // Dedupe by pdfUrl
  const seen = new Set();
  const deduped = results.filter((r) => {
    if (seen.has(r.pdfUrl)) return false;
    seen.add(r.pdfUrl);
    return true;
  });

  console.log(
    `[cw-pdf-extractor] Done. ${deduped.length} unique PDF(s) found across ${listingUrls.length} listing page(s).`
  );
  console.table(deduped);

  // Expose results + download helpers on window for follow-up use.
  window.__cwPdfResults = deduped;

  window.downloadJson = function downloadJson(filename = "cw_pdf_links.json") {
    const blob = new Blob([JSON.stringify(deduped, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.downloadCsv = function downloadCsv(filename = "cw_pdf_links.csv") {
    const escapeCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["listingUrl", "listingTitle", "pdfUrl"];
    const rows = deduped.map((r) => header.map((k) => escapeCell(r[k])).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  console.log(
    "[cw-pdf-extractor] Results stored in window.__cwPdfResults. Run downloadCsv() or downloadJson() to save."
  );
})();
