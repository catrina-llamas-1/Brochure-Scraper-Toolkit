/**
 * NAI Edmonton — Step 2: extract documents (paste into DevTools Console)
 *
 * Run this AFTER Step 1 (extract_pdfs_nai_step1_collect_listings.js) —
 * see that file's header comment for why this is a two-step, two-tab
 * process (listing links point to a different origin, spacelist.ca,
 * that naiedmonton.com's own page can't fetch() across).
 *
 * HOW TO USE
 *   1. From Step 1, run `downloadListingUrls()` and open the saved
 *      nai_listing_urls.json in a text editor - it's just a JSON array
 *      of URLs.
 *   2. Open any ONE of those listing URLs directly in a new browser tab
 *      (this puts you on spacelist.ca, same-origin with every other
 *      listing).
 *   3. Paste the JSON array's contents into LISTING_URLS below, replacing
 *      the empty array.
 *   4. Open DevTools -> Console tab on that spacelist.ca tab.
 *   5. Paste this whole (edited) file in and press Enter.
 *   6. Wait for it to finish, then run `downloadCsv()`, `downloadJson()`,
 *      or `downloadAllPdfs()`.
 *
 * Document detection: brochure links are real <a> elements tagged with
 * data-engagement-type="brochure", e.g.
 *   <a href="https://d2wsxqxx9m1aa9.cloudfront.net/..."
 *      data-engagement-type="brochure" data-listing-id="945907">Brochure 1</a>
 * confirmed via a real listing page's markup - a purpose-built semantic
 * attribute, more reliable than guessing at link text or file extensions
 * (the CloudFront URL itself has no .pdf extension, same situation as
 * Colliers' blob storage links).
 */
(async function extractNaiDocs() {
  // PASTE the array from nai_listing_urls.json here, replacing [].
  const LISTING_URLS = [
  "https://e85.spacelist.ca/listings/943505/ab/edmonton/for-lease/office/202-10112_124_street",
  "https://e85.spacelist.ca/listings/963468/ab/edmonton/for-lease/office/240-4936_87_street_northwest",
  "https://e85.spacelist.ca/listings/965940/ab/edmonton/for-lease/office/49840-9840_47_avenue_northwest",
  "https://e85.spacelist.ca/listings/982903/ab/edmonton/for-lease/office/3118-3118_parsons_road_northwest",
  "https://e85.spacelist.ca/listings/966209/ab/edmonton/for-lease/office/204-17205_106a_avenue_northwest",
  "https://e85.spacelist.ca/listings/966208/ab/edmonton/for-lease/office/101-17205_106a_avenue_northwest",
  "https://e85.spacelist.ca/listings/980885/ab/edmonton/for-lease/office-retail/9225_28_avenue_northwest",
  "https://e85.spacelist.ca/listings/978965/ab/edmonton/for-sale/office-industrial/9021_46_street_northwest",
  "https://e85.spacelist.ca/listings/965543/ab/edmonton/for-sale/office/6912-6904_roper_rd_nw",
  "https://e85.spacelist.ca/listings/970034/ab/edmonton/for-lease/office/103a-9636_51_ave_nw",
  "https://e85.spacelist.ca/listings/931714/ab/edmonton/for-sale/office-retail/7505-7505_104_street_northwest",
  "https://e85.spacelist.ca/listings/973591/ab/sherwood_park/for-sale/office-retail-other/101_broadway_boulevard",
  "https://e85.spacelist.ca/listings/981430/ab/edmonton/for-sale/office-industrial/10710-10710_181_street_northwest",
  "https://e85.spacelist.ca/listings/970388/ab/edmonton/for-sale/office/210-11520_100_avenue_northwest",
  "https://e85.spacelist.ca/listings/927367/ab/edmonton/for-lease/office/2-6025_86_street_northwest",
  "https://e85.spacelist.ca/listings/965539/ab/edmonton/for-sale/office/6920-6904_roper_road_northwest",
  "https://e85.spacelist.ca/listings/853582/ab/edmonton/for-lease/office/202-205-10470_176_street_northwest",
  "https://e85.spacelist.ca/listings/981135/ab/edmonton/for-lease/office-retail-medical/12006-12006_111_avenue_northwest",
  "https://e85.spacelist.ca/listings/920222/ab/edmonton/for-lease/office-retail-medical/12004-12006_111_avenue_northwest",
  "https://e85.spacelist.ca/listings/926117/ab/edmonton/for-sale/office-retail/13163-13163_156_st_nw"
];

  const DELAY_MS = 800; // be polite between listing fetches

  if (LISTING_URLS.length === 0) {
    console.error(
      "[nai-step2] LISTING_URLS is empty - paste the array from nai_listing_urls.json (Step 1's downloadListingUrls() output) into this script before running."
    );
    return;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const getTitle = (doc) => {
    const h1 = doc.querySelector("h1");
    if (h1) return h1.textContent.trim();
    const titleTag = doc.querySelector("title");
    return titleTag ? titleTag.textContent.trim() : "";
  };

  const results = [];

  for (let i = 0; i < LISTING_URLS.length; i++) {
    const url = LISTING_URLS[i];
    console.log(`[nai-step2] (${i + 1}/${LISTING_URLS.length}) Fetching ${url}`);
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        console.warn(`[nai-step2] ${url} -> HTTP ${resp.status}, skipping`);
        continue;
      }
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const title = getTitle(doc);
      const docLinks = [...doc.querySelectorAll('a[data-engagement-type="brochure"][href]')];

      if (docLinks.length === 0) {
        console.log(`[nai-step2]   no brochures found on ${url}`);
      }
      docLinks.forEach((a) => {
        results.push({ listingUrl: url, listingTitle: title, pdfUrl: a.href });
      });
    } catch (err) {
      console.warn(`[nai-step2] failed to fetch ${url}:`, err);
    }
    if (i < LISTING_URLS.length - 1) await sleep(DELAY_MS);
  }

  // Dedupe by pdfUrl
  const seen = new Set();
  const deduped = results.filter((r) => {
    if (seen.has(r.pdfUrl)) return false;
    seen.add(r.pdfUrl);
    return true;
  });

  console.log(
    `[nai-step2] Done. ${deduped.length} unique document(s) found across ${LISTING_URLS.length} listing(s).`
  );
  console.table(deduped);

  window.__naiPdfResults = deduped;

  window.downloadJson = function downloadJson(filename = "nai_pdf_links.json") {
    const blob = new Blob([JSON.stringify(deduped, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.downloadCsv = function downloadCsv(filename = "nai_pdf_links.csv") {
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
      `[nai-step2] Downloading ${deduped.length} document(s)... your browser will likely ask you to allow multiple downloads — click "Allow".`
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
          console.warn(`[nai-step2] (${i + 1}/${deduped.length}) HTTP ${resp.status} for ${pdfUrl}, skipping`);
          continue;
        }
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        console.log(`[nai-step2] (${i + 1}/${deduped.length}) saved ${filename}`);
      } catch (err) {
        // pdfUrl here is on cloudfront.net - a third origin, different
        // again from both naiedmonton.com and spacelist.ca. Same CORS
        // story as every other site's file host: fall back to opening a
        // tab, since a plain navigation isn't subject to CORS.
        corsBlocked++;
        console.warn(
          `[nai-step2] (${i + 1}/${deduped.length}) fetch blocked (likely cross-origin/CORS) for ${pdfUrl} — opening in a new tab instead. Use the download icon in the viewer to save it.`
        );
        window.open(pdfUrl, "_blank", "noopener");
      }
      if (i < deduped.length - 1) await sleep(DELAY_MS);
    }
    if (corsBlocked > 0) {
      console.log(
        `[nai-step2] ${corsBlocked} document(s) couldn't be fetched directly and were opened in new tabs instead. If tabs didn't open, allow pop-ups for this site and run downloadAllPdfs() again. For no-tabs mass download, use download_pdfs.sh / download_pdfs.ps1 / download_pdfs_from_csv.py against the CSV from downloadCsv().`
      );
    }
    console.log("[nai-step2] All downloads triggered.");
  };

  console.log(
    "[nai-step2] Results stored in window.__naiPdfResults. Run downloadCsv(), downloadJson(), or downloadAllPdfs() to save."
  );
})();
