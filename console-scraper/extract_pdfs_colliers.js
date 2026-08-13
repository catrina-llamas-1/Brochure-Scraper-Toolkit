/**
 * Colliers Canada — PDF extractor (paste into DevTools Console)
 *
 * Same tool as extract_pdfs.js, adapted for collierscanada.com. Two
 * changes from the CW/Avison Young variants:
 *
 * 1. LISTING_LINK_PATTERN: Colliers listing links look like
 *    /en-ca/properties/<title-slug>/<address-slug>/<id>, where <id> is
 *    always "can" + digits, e.g.
 *    /en-ca/properties/atco-place/can-10303-jasper-avenue-edmonton-alberta-canada/can2007277
 *    The search page itself is at /en-ca/properties#sort=... (no slash
 *    after "properties"), so it doesn't collide.
 *
 * 2. Document detection can't rely on a ".pdf" URL at all. Colliers
 *    serves brochures from Azure Blob Storage
 *    (listingsprod.blob.core.windows.net/.../<uuid>/<uuid>) with no file
 *    extension in the URL whatsoever — the file type only shows up in
 *    the server's response headers. Detection here keys off the LINK
 *    TEXT instead ("Brochure", "Floor Plan", etc.) combined with the
 *    blob host, since that same host may also serve non-document assets
 *    (e.g. photos) via <a href> lightbox wrappers that we must NOT treat
 *    as documents. isDocumentLink() below still also matches plain
 *    ".pdf" links as a generic fallback.
 *
 * WHAT THIS DOES
 * Run this on a search-results page, e.g.
 *   https://www.collierscanada.com/en-ca/properties#sort=relevancy&f:location=Alberta...
 * It:
 *   1. Collects every listing link on the current results page.
 *   2. Grabs any document links already present on the page itself.
 *   3. Visits each listing's detail page (via fetch, using your logged-in
 *      session/cookies) and pulls out brochure/document links + the
 *      listing title.
 *   4. Prints a table in the console and gives you `downloadCsv()` /
 *      `downloadJson()` / `downloadAllPdfs()` helpers to save the results.
 *
 * HOW TO USE
 *   1. Open the search-results page in Chrome, with results loaded.
 *   2. Open DevTools (F12 or Cmd+Opt+I) -> Console tab.
 *   3. Paste this whole file in and press Enter.
 *   4. Wait for it to finish (it logs progress + a final console.table).
 *   5. Run `downloadCsv()`, `downloadJson()`, or `downloadAllPdfs()`.
 *
 * If you're already on a single listing/detail page instead of a search
 * page, it still works — it'll just extract documents from that one page.
 *
 * NOTE: this is a faceted-search UI (likely Coveo-based) — results may
 * load via API calls after the page shell renders. If the listing-link
 * count comes back as 0, wait for the results grid to visibly populate
 * (and/or apply filters) before running this script.
 */
(async function extractPdfsFromSearchResults() {
  const LISTING_LINK_PATTERN = /\/properties\/[^/?#]+\/[^/?#]+\/can\d+\/?$/i;
  const DOC_TEXT_PATTERN = /brochure|floor\s*plan|site\s*plan|fact\s*sheet|flyer|offering\s*memorandum|document/i;
  const DOC_BLOB_HOST = "listingsprod.blob.core.windows.net";
  const DELAY_MS = 800; // be polite between detail-page fetches

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const absUrl = (href) => {
    try {
      return new URL(href, location.href).href;
    } catch {
      return null;
    }
  };

  const isDocumentLink = (href, text) => {
    if (/\.pdf(\?|$)/i.test(href)) return true;
    try {
      const host = new URL(href).hostname;
      if (host === DOC_BLOB_HOST && DOC_TEXT_PATTERN.test(text || "")) return true;
    } catch {
      // relative/invalid URL - not a document link we can identify
    }
    return false;
  };

  const extractDocLinksFromDoc = (doc) => {
    const docs = new Set();
    doc.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      const full = absUrl(href) || href;
      if (isDocumentLink(full, a.textContent)) docs.add(full);
    });
    return [...docs];
  };

  const getTitle = (doc) => {
    const h1 = doc.querySelector("h1");
    return h1 ? h1.textContent.trim() : "";
  };

  console.log("[colliers-pdf-extractor] Scanning current page for listing links...");

  const listingLinks = new Set();
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && LISTING_LINK_PATTERN.test(href)) {
      const full = absUrl(href);
      if (full) listingLinks.add(full.split("#")[0]);
    }
  });

  console.log(
    `[colliers-pdf-extractor] Found ${listingLinks.size} listing link(s) on this page.`
  );
  if (listingLinks.size === 0) {
    console.warn(
      "[colliers-pdf-extractor] 0 listing links found — if results haven't visibly loaded yet (this site fetches them after page load), wait for the grid to populate and re-run."
    );
  }

  const results = [];

  // Documents already on the current page (covers being on a detail page,
  // or the search page itself embedding document links).
  const pageOwnDocs = extractDocLinksFromDoc(document);
  pageOwnDocs.forEach((pdfUrl) => {
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
      `[colliers-pdf-extractor] (${i + 1}/${listingUrls.length}) Fetching ${url}`
    );
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        console.warn(`[colliers-pdf-extractor] ${url} -> HTTP ${resp.status}, skipping`);
        continue;
      }
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const title = getTitle(doc);
      const docLinks = extractDocLinksFromDoc(doc);

      if (docLinks.length === 0) {
        console.log(`[colliers-pdf-extractor]   no documents found on ${url}`);
      }
      docLinks.forEach((pdfUrl) => {
        results.push({ listingUrl: url, listingTitle: title, pdfUrl });
      });
    } catch (err) {
      console.warn(`[colliers-pdf-extractor] failed to fetch ${url}:`, err);
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
    `[colliers-pdf-extractor] Done. ${deduped.length} unique document(s) found across ${listingUrls.length} listing page(s).`
  );
  console.table(deduped);

  // Expose results + download helpers on window for follow-up use.
  window.__colliersPdfResults = deduped;

  window.downloadJson = function downloadJson(filename = "colliers_pdf_links.json") {
    const blob = new Blob([JSON.stringify(deduped, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.downloadCsv = function downloadCsv(filename = "colliers_pdf_links.csv") {
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
      `[colliers-pdf-extractor] Downloading ${deduped.length} document(s)... your browser will likely ask you to allow multiple downloads — click "Allow".`
    );
    let corsBlocked = 0;
    for (let i = 0; i < deduped.length; i++) {
      const { pdfUrl, listingTitle } = deduped[i];
      // No file extension in the URL here, so just fall back to a plain
      // "document.pdf" filename when we can't infer one - the download
      // itself will still work; only the local filename is generic.
      const urlTail = decodeURIComponent(pdfUrl.split("/").pop().split("?")[0]);
      const urlName = urlTail && urlTail.includes(".") ? urlTail : "document.pdf";
      const filename = listingTitle
        ? `${listingTitle.replace(/[\\/:*?"<>|]+/g, "_")}__${urlName}`
        : urlName;
      try {
        const resp = await fetch(pdfUrl, { credentials: "include" });
        if (!resp.ok) {
          console.warn(`[colliers-pdf-extractor] (${i + 1}/${deduped.length}) HTTP ${resp.status} for ${pdfUrl}, skipping`);
          continue;
        }
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        console.log(`[colliers-pdf-extractor] (${i + 1}/${deduped.length}) saved ${filename}`);
      } catch (err) {
        // "Failed to fetch" here almost always means the file is served
        // from a different origin (listingsprod.blob.core.windows.net)
        // that doesn't send CORS headers letting JS read the response —
        // fetch() can never work around that. Fall back to a plain
        // navigation, which isn't subject to CORS: open the file in a
        // new tab so it can be saved from the browser's viewer instead.
        corsBlocked++;
        console.warn(
          `[colliers-pdf-extractor] (${i + 1}/${deduped.length}) fetch blocked (likely cross-origin/CORS) for ${pdfUrl} — opening in a new tab instead. Use the download icon in the viewer to save it.`
        );
        window.open(pdfUrl, "_blank", "noopener");
      }
      if (i < deduped.length - 1) await sleep(DELAY_MS);
    }
    if (corsBlocked > 0) {
      console.log(
        `[colliers-pdf-extractor] ${corsBlocked} document(s) couldn't be fetched directly and were opened in new tabs instead. If tabs didn't open, your browser blocked the pop-ups — click the blocked-popup icon in the address bar, choose "Always allow", then run downloadAllPdfs() again. For no-tabs mass download, use download_pdfs.sh / download_pdfs.ps1 / download_pdfs_from_csv.py against the CSV from downloadCsv().`
      );
    }
    console.log("[colliers-pdf-extractor] All downloads triggered.");
  };

  console.log(
    "[colliers-pdf-extractor] Results stored in window.__colliersPdfResults. Run downloadCsv(), downloadJson(), or downloadAllPdfs() to save."
  );
})();
