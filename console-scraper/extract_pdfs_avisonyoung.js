/**
 * Avison Young — PDF extractor (paste into DevTools Console)
 *
 * Same tool as extract_pdfs.js, adapted for avisonyoung.ca. The only
 * change is LISTING_LINK_PATTERN: Avison Young listing links look like
 * https://www.avisonyoung.ca/properties/<slug> (a single path segment
 * directly under /properties/, no "for-lease" segment like Cushman &
 * Wakefield uses, and no trailing slash after "properties" the way the
 * search page itself has: /properties#/?type=...).
 *
 * Each listing detail page is served through a proxy that embeds a
 * third-party SharpLaunch microsite's HTML directly into the page (same
 * origin as avisonyoung.ca), so fetching detail pages works the same way
 * as on CW. Brochure PDFs themselves are hosted on cdn.sharplaunch.com, a
 * different origin — expect downloadAllPdfs() to hit the same CORS
 * "Failed to fetch" case as CW's assets.cushmanwakefield.com and fall
 * back to opening tabs. See README.md's CSV + curl/PowerShell workaround
 * if you want the actual files without opening tabs.
 *
 * WHAT THIS DOES
 * Run this on a search-results page, e.g.
 *   https://www.avisonyoung.ca/properties#/?type=office...&location=Alberta...
 * It:
 *   1. Collects every listing link on the current results page.
 *   2. Grabs any PDF links already present on the page itself.
 *   3. Visits each listing's detail page (via fetch, using your logged-in
 *      session/cookies) and pulls out brochure/document PDF links + the
 *      listing title.
 *   4. Prints a table in the console and gives you `downloadCsv()` /
 *      `downloadJson()` / `downloadAllPdfs()` helpers to save the results.
 *
 * HOW TO USE
 *   1. Open the search-results page in Chrome.
 *   2. Open DevTools (F12 or Cmd+Opt+I) -> Console tab.
 *   3. Paste this whole file in and press Enter.
 *   4. Wait for it to finish (it logs progress + a final console.table).
 *   5. Run `downloadCsv()`, `downloadJson()`, or `downloadAllPdfs()`.
 *
 * If you're already on a single listing/detail page instead of a search
 * page, it still works — it'll just extract PDFs from that one page.
 *
 * NOTE: this list is hash-routed (#/?type=...) and may lazy-load results
 * (infinite scroll) rather than paginate with ?page=N. If you don't see
 * as many listing links as expected, scroll down to load more results
 * before running this script.
 */
(async function extractPdfsFromSearchResults() {
  const LISTING_LINK_PATTERN = /\/properties\/[^/?#]+\/?$/i;
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

  console.log("[ay-pdf-extractor] Scanning current page for listing links...");

  const listingLinks = new Set();
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && LISTING_LINK_PATTERN.test(href)) {
      const full = absUrl(href);
      if (full) listingLinks.add(full.split("#")[0]);
    }
  });

  console.log(
    `[ay-pdf-extractor] Found ${listingLinks.size} listing link(s) on this page.`
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
      `[ay-pdf-extractor] (${i + 1}/${listingUrls.length}) Fetching ${url}`
    );
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        console.warn(`[ay-pdf-extractor] ${url} -> HTTP ${resp.status}, skipping`);
        continue;
      }
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const title = getTitle(doc);
      const pdfLinks = extractPdfLinksFromDoc(doc, url);

      if (pdfLinks.length === 0) {
        console.log(`[ay-pdf-extractor]   no PDFs found on ${url}`);
      }
      pdfLinks.forEach((pdfUrl) => {
        results.push({ listingUrl: url, listingTitle: title, pdfUrl });
      });
    } catch (err) {
      console.warn(`[ay-pdf-extractor] failed to fetch ${url}:`, err);
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
    `[ay-pdf-extractor] Done. ${deduped.length} unique PDF(s) found across ${listingUrls.length} listing page(s).`
  );
  console.table(deduped);

  // Expose results + download helpers on window for follow-up use.
  window.__ayPdfResults = deduped;

  window.downloadJson = function downloadJson(filename = "ay_pdf_links.json") {
    const blob = new Blob([JSON.stringify(deduped, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.downloadCsv = function downloadCsv(filename = "ay_pdf_links.csv") {
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

  window.downloadAllPdfs = async function downloadAllPdfs() {
    console.log(
      `[ay-pdf-extractor] Downloading ${deduped.length} PDF(s)... your browser will likely ask you to allow multiple downloads — click "Allow".`
    );
    let corsBlocked = 0;
    for (let i = 0; i < deduped.length; i++) {
      const { pdfUrl, listingTitle } = deduped[i];
      const urlName = decodeURIComponent(pdfUrl.split("/").pop().split("?")[0]) || "document.pdf";
      const filename = listingTitle
        ? `${listingTitle.replace(/[\\/:*?"<>|]+/g, "_")}__${urlName}`
        : urlName;
      try {
        const resp = await fetch(pdfUrl, { credentials: "include" });
        if (!resp.ok) {
          console.warn(`[ay-pdf-extractor] (${i + 1}/${deduped.length}) HTTP ${resp.status} for ${pdfUrl}, skipping`);
          continue;
        }
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        console.log(`[ay-pdf-extractor] (${i + 1}/${deduped.length}) saved ${filename}`);
      } catch (err) {
        // "Failed to fetch" here almost always means the PDF is served
        // from a different origin (cdn.sharplaunch.com) that doesn't send
        // CORS headers letting JS read the response — fetch() can never
        // work around that. Fall back to a plain navigation, which isn't
        // subject to CORS: open the file in a new tab so it can be saved
        // from the browser's built-in PDF viewer instead.
        corsBlocked++;
        console.warn(
          `[ay-pdf-extractor] (${i + 1}/${deduped.length}) fetch blocked (likely cross-origin/CORS) for ${pdfUrl} — opening in a new tab instead. Use the download icon in the PDF viewer to save it.`
        );
        window.open(pdfUrl, "_blank", "noopener");
      }
      if (i < deduped.length - 1) await sleep(DELAY_MS);
    }
    if (corsBlocked > 0) {
      console.log(
        `[ay-pdf-extractor] ${corsBlocked} PDF(s) couldn't be fetched directly and were opened in new tabs instead. If tabs didn't open, your browser blocked the pop-ups — click the blocked-popup icon in the address bar, choose "Always allow", then run downloadAllPdfs() again. For no-tabs mass download, use download_pdfs.sh / download_pdfs.ps1 / download_pdfs_from_csv.py against the CSV from downloadCsv().`
      );
    }
    console.log("[ay-pdf-extractor] All downloads triggered.");
  };

  console.log(
    "[ay-pdf-extractor] Results stored in window.__ayPdfResults. Run downloadCsv(), downloadJson(), or downloadAllPdfs() to save."
  );
})();
