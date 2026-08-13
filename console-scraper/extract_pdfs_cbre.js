/**
 * CBRE Canada — PDF extractor (paste into DevTools Console)
 *
 * Structurally different from the other three variants: CBRE's brochure
 * links aren't discoverable in any HTML at all (not server-rendered, not
 * embedded as JS-string markup like Colliers) — the "Download Brochures"
 * button just sets an already-loaded JS object's .brochureUrl onto an
 * <a> element, and that object comes from a same-origin JSON API called
 * on page load:
 *
 *   GET /property-api/propertylisting/<listingId>?CurrencyCode=CAD&Unit=sqft&Interval=Annually&Site=ca-comm
 *
 * confirmed via the Network tab against a real listing page. The
 * response's "Common.Brochures" array holds one entry per document:
 *   { "Common.Uri": "/resources/fileassets/.../Name.pdf",
 *     "Common.UriExternal": false,
 *     "Common.BrochureName": "Brochure - Updated April 2026",
 *     "Common.CultureCode": "en-GB" }
 * Common.Uri is relative to the site origin when UriExternal is false.
 *
 * Because the listing ID is already visible in the listing URL itself
 * (/properties/office/details/CA-Plus-<id>/<slug>), this script calls the
 * API directly per listing instead of fetching + parsing each detail
 * page's HTML for links, unlike the CW/Avison Young/Colliers variants.
 * It does still fetch the HTML once per listing, only to read the page
 * <title> for a human-readable listingTitle.
 *
 * LISTING_LINK_PATTERN: /properties/<type>/details/<id>/<slug> - the
 * search page itself is at /properties/office?... (no /details/ segment),
 * so it doesn't collide.
 *
 * WHAT THIS DOES
 * Run this on a search-results page, e.g.
 *   https://www.cbre.ca/properties/office?...&location=Edmonton...
 * It:
 *   1. Collects every listing link on the current results page.
 *   2. For each listing, extracts the listing ID from its URL and calls
 *      the property-listing API directly for its brochure/document list.
 *   3. Prints a table in the console and gives you `downloadCsv()` /
 *      `downloadJson()` / `downloadAllPdfs()` helpers to save the results.
 *
 * HOW TO USE
 *   1. Open the search-results page in Chrome, with results loaded.
 *   2. Open DevTools (F12 or Cmd+Opt+I) -> Console tab.
 *   3. Paste this whole file in and press Enter.
 *   4. Wait for it to finish (it logs progress + a final console.table).
 *   5. Run `downloadCsv()`, `downloadJson()`, or `downloadAllPdfs()`.
 *
 * NOTE: brochure files here are served from the same origin as the page
 * (www.cbre.ca), so unlike the other three sites, downloadAllPdfs()
 * likely won't hit the CORS "Failed to fetch" fallback — but the
 * fallback code is left in place just in case.
 */
(async function extractPdfsFromSearchResults() {
  const LISTING_LINK_PATTERN = /\/properties\/[^/?#]+\/details\/[^/?#]+\/[^/?#]+\/?$/i;
  const LISTING_ID_PATTERN = /\/details\/([^/?#]+)\//i;
  const API_PARAMS = "CurrencyCode=CAD&Unit=sqft&Interval=Annually&Site=ca-comm";
  const DELAY_MS = 800; // be polite between API calls

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const absUrl = (href) => {
    try {
      return new URL(href, location.origin).href;
    } catch {
      return null;
    }
  };

  const getTitle = (doc) => {
    const h1 = doc.querySelector("h1");
    if (h1) return h1.textContent.trim();
    const titleTag = doc.querySelector("title");
    return titleTag ? titleTag.textContent.trim() : "";
  };

  console.log("[cbre-pdf-extractor] Scanning current page for listing links...");

  const listingLinks = new Set();
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && LISTING_LINK_PATTERN.test(href)) {
      const full = absUrl(href);
      if (full) listingLinks.add(full.split("#")[0]);
    }
  });

  console.log(
    `[cbre-pdf-extractor] Found ${listingLinks.size} listing link(s) on this page.`
  );
  if (listingLinks.size === 0) {
    console.warn(
      "[cbre-pdf-extractor] 0 listing links found — if results haven't visibly loaded yet, wait for the grid to populate and re-run."
    );
  }

  const results = [];
  const listingUrls = [...listingLinks];

  for (let i = 0; i < listingUrls.length; i++) {
    const url = listingUrls[i];
    const idMatch = url.match(LISTING_ID_PATTERN);
    if (!idMatch) {
      console.warn(`[cbre-pdf-extractor] (${i + 1}/${listingUrls.length}) couldn't extract listing ID from ${url}, skipping`);
      continue;
    }
    const listingId = idMatch[1];
    console.log(
      `[cbre-pdf-extractor] (${i + 1}/${listingUrls.length}) ${listingId}`
    );

    let title = "";
    try {
      const pageResp = await fetch(url, { credentials: "include" });
      if (pageResp.ok) {
        const html = await pageResp.text();
        title = getTitle(new DOMParser().parseFromString(html, "text/html"));
      }
    } catch (err) {
      console.warn(`[cbre-pdf-extractor]   failed to fetch page HTML for title: ${err}`);
    }

    try {
      const apiUrl = `${location.origin}/property-api/propertylisting/${listingId}?${API_PARAMS}`;
      const apiResp = await fetch(apiUrl, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!apiResp.ok) {
        console.warn(`[cbre-pdf-extractor]   API HTTP ${apiResp.status} for ${listingId}, skipping`);
        continue;
      }
      const data = await apiResp.json();
      const brochures = data["Common.Brochures"] || [];

      if (brochures.length === 0) {
        console.log(`[cbre-pdf-extractor]   no brochures found for ${listingId}`);
      }
      brochures.forEach((b) => {
        const rawUri = b["Common.Uri"];
        if (!rawUri) return;
        const pdfUrl = b["Common.UriExternal"] ? rawUri : absUrl(rawUri);
        if (!pdfUrl) return;
        const docName = b["Common.BrochureName"] || "";
        results.push({
          listingUrl: url,
          listingTitle: docName ? `${title} — ${docName}` : title,
          pdfUrl,
        });
      });
    } catch (err) {
      console.warn(`[cbre-pdf-extractor]   failed to fetch API for ${listingId}: ${err}`);
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
    `[cbre-pdf-extractor] Done. ${deduped.length} unique document(s) found across ${listingUrls.length} listing(s).`
  );
  console.table(deduped);

  // Expose results + download helpers on window for follow-up use.
  window.__cbrePdfResults = deduped;

  window.downloadJson = function downloadJson(filename = "cbre_pdf_links.json") {
    const blob = new Blob([JSON.stringify(deduped, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.downloadCsv = function downloadCsv(filename = "cbre_pdf_links.csv") {
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
      `[cbre-pdf-extractor] Downloading ${deduped.length} document(s)... your browser will likely ask you to allow multiple downloads — click "Allow".`
    );
    let corsBlocked = 0;
    for (let i = 0; i < deduped.length; i++) {
      const { pdfUrl, listingTitle } = deduped[i];
      const urlTail = decodeURIComponent(pdfUrl.split("/").pop().split("?")[0]);
      const urlName = urlTail && urlTail.includes(".") ? urlTail : "document.pdf";
      const filename = listingTitle
        ? `${listingTitle.replace(/[\\/:*?"<>|]+/g, "_")}__${urlName}`
        : urlName;
      try {
        const resp = await fetch(pdfUrl, { credentials: "include" });
        if (!resp.ok) {
          console.warn(`[cbre-pdf-extractor] (${i + 1}/${deduped.length}) HTTP ${resp.status} for ${pdfUrl}, skipping`);
          continue;
        }
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        console.log(`[cbre-pdf-extractor] (${i + 1}/${deduped.length}) saved ${filename}`);
      } catch (err) {
        // Brochures here are same-origin (www.cbre.ca), so this fallback
        // shouldn't normally trigger - kept for consistency/robustness.
        corsBlocked++;
        console.warn(
          `[cbre-pdf-extractor] (${i + 1}/${deduped.length}) fetch blocked for ${pdfUrl} — opening in a new tab instead.`
        );
        window.open(pdfUrl, "_blank", "noopener");
      }
      if (i < deduped.length - 1) await sleep(DELAY_MS);
    }
    if (corsBlocked > 0) {
      console.log(
        `[cbre-pdf-extractor] ${corsBlocked} document(s) opened in new tabs instead. If tabs didn't open, allow pop-ups for this site and run downloadAllPdfs() again. For no-tabs mass download, use download_pdfs.sh / download_pdfs.ps1 / download_pdfs_from_csv.py against the CSV from downloadCsv().`
      );
    }
    console.log("[cbre-pdf-extractor] All downloads triggered.");
  };

  console.log(
    "[cbre-pdf-extractor] Results stored in window.__cbrePdfResults. Run downloadCsv(), downloadJson(), or downloadAllPdfs() to save."
  );
})();
