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
  "https://e85.spacelist.ca/listings/966036/ab/edmonton/for-lease/office-medical/402-11044_82_ave_nw",
  "https://e85.spacelist.ca/listings/966034/ab/edmonton/for-lease/office-medical/260-11044_82_ave_nw",
  "https://e85.spacelist.ca/listings/946566/ab/edmonton/for-lease/office/109-9440_49_st_nw",
  "https://e85.spacelist.ca/listings/940074/ab/st_albert/for-lease/office-medical/321-7_saint_anne_street",
  "https://e85.spacelist.ca/listings/976721/ab/edmonton/for-lease/office/10441_124_street",
  "https://e85.spacelist.ca/listings/905762/ab/edmonton/for-lease/office/202-10132_124_street",
  "https://e85.spacelist.ca/listings/981934/ab/edmonton/for-lease/office-retail-medical/10118-10118_124_st",
  "https://e85.spacelist.ca/listings/976628/ab/edmonton/for-lease/office-industrial/15810_114_avenue_northwest",
  "https://e85.spacelist.ca/listings/966039/ab/edmonton/for-lease/office-medical/510-11044_82_ave_nw",
  "https://e85.spacelist.ca/listings/966037/ab/edmonton/for-lease/office-medical/320-11044_82_ave_nw",
  "https://e85.spacelist.ca/listings/966038/ab/edmonton/for-lease/office-medical/301-11044_82_ave_nw",
  "https://e85.spacelist.ca/listings/965794/ab/edmonton/for-lease/office/220-9440_49_st_nw",
  "https://e85.spacelist.ca/listings/928907/ab/edmonton/for-lease/office/3817-3817_98_street_northwest",
  "https://e85.spacelist.ca/listings/965445/ab/edmonton/for-lease/office/10123_99_st_nw",
  "https://e85.spacelist.ca/listings/901649/ab/edmonton/for-lease/office/100-9636_51_ave_nw",
  "https://e85.spacelist.ca/listings/983878/ab/vegreville/for-lease/office-retail/5127_50_street",
  "https://e85.spacelist.ca/listings/970389/ab/edmonton/for-lease/office/210-11520_100_avenue_northwest",
  "https://e85.spacelist.ca/listings/957659/ab/edmonton/for-lease/office/3219a-a-3219_97_street_northwest",
  "https://e85.spacelist.ca/listings/968010/ab/edmonton/for-lease/office/104bc-17704_103_avenue_northwest",
  "https://e85.spacelist.ca/listings/901653/ab/edmonton/for-lease/office/204-9636_51_ave_nw"
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
