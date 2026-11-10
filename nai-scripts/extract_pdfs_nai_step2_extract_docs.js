/**
 * NAI Edmonton — Step 2: extract brochure/document links (paste into DevTools Console)
 *
 * Run this in the SAME e85.spacelist.ca tab/frame you ran Step 1 in
 * (see Step 1's header for why everything happens on e85.spacelist.ca,
 * not naiedmonton.com). It uses window.__naiListingUrls from Step 1
 * automatically; or paste a JSON array of listing URLs into LISTING_URLS.
 *
 * For each listing it:
 *   1. fetch()es the listing page and looks for document links in the
 *      raw HTML (fast), retrying on 403/429/5xx with backoff;
 *   2. if none are found, loads the listing in a hidden same-origin
 *      <iframe>, lets the page's own JavaScript run, and looks again in
 *      the live DOM - this catches links that are added client-side and
 *      therefore never appear in the fetched HTML.
 *
 * Document detection: real <a> elements tagged with data-engagement-type,
 * e.g.
 *   <a data-engagement-type="brochure" data-listing-id="997104"
 *      href="https://d2wsxqxx9m1aa9.cloudfront.net/2oy4e8tmd6p2dxapuqrcq5rw2t7t">
 *     Brochure 1</a>
 * Any engagement type that looks like a document (brochure, floor plan,
 * ...) or any link to the cloudfront.net file host is kept.
 *
 * When it finishes it prints a summary, including which listings had no
 * documents and which failed to load (window.__naiNoDocs, window.__naiFailed).
 * Then run downloadCsv(), downloadJson(), or downloadAllPdfs().
 */
(async function extractNaiDocs() {
  // Optional: paste a JSON array of listing URLs here. Leave empty to use
  // window.__naiListingUrls from Step 1 (same tab).
  const LISTING_URLS_PASTED = [];

  const DELAY_MS = 1000; // pause between listings
  const MAX_RETRIES = 3;
  const IFRAME_WAIT_MS = 15000; // max time to wait for a listing to render

  const LISTING_URLS = (LISTING_URLS_PASTED.length ? LISTING_URLS_PASTED : window.__naiListingUrls || [])
    .map((u) => String(u).split("#")[0]);

  if (LISTING_URLS.length === 0) {
    console.error(
      "[nai-step2] No listing URLs - run Step 1 in this tab first, or paste an array into LISTING_URLS_PASTED."
    );
    return;
  }
  if (!/spacelist\.ca$/.test(location.hostname)) {
    console.warn(
      `[nai-step2] You're on ${location.hostname}, not e85.spacelist.ca - listing fetches will be blocked cross-origin. Switch the Console context to the e85.spacelist.ca frame or open that page directly.`
    );
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const DOC_TYPE_RE = /brochure|floor|plan|document|pdf|flyer|sheet|package/i;
  const findDocs = (root) =>
    [...root.querySelectorAll("a[href]")]
      .filter((a) => {
        const type = a.getAttribute("data-engagement-type") || "";
        const href = a.getAttribute("href") || "";
        return (type && DOC_TYPE_RE.test(type)) || /cloudfront\.net\//i.test(href) || /\.pdf(\?|$)/i.test(href);
      })
      .map((a) => ({
        docType: a.getAttribute("data-engagement-type") || "",
        docLabel: (a.textContent || "").trim().replace(/\s+/g, " "),
        pdfUrl: new URL(a.getAttribute("href"), location.href).href,
        listingIdAttr: a.getAttribute("data-listing-id") || "",
      }));

  const getTitle = (root) => {
    const h1 = root.querySelector("h1");
    if (h1 && h1.textContent.trim()) return h1.textContent.trim().replace(/\s+/g, " ");
    const t = root.querySelector("title");
    return t ? t.textContent.trim() : "";
  };

  async function fetchHtml(url) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(url, { credentials: "include" });
        if (resp.ok) return await resp.text();
        if ([403, 429, 500, 502, 503, 504].includes(resp.status) && attempt < MAX_RETRIES) {
          const wait = 2000 * 2 ** attempt;
          console.warn(`[nai-step2]   HTTP ${resp.status}, retrying in ${wait / 1000}s`);
          await sleep(wait);
          continue;
        }
        throw new Error(`HTTP ${resp.status}`);
      } catch (err) {
        if (attempt >= MAX_RETRIES) throw err;
        await sleep(2000 * 2 ** attempt);
      }
    }
  }

  function renderInIframe(url) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:900px;visibility:hidden;";
      iframe.src = url;
      let done = false;
      const finish = (fn, val) => {
        if (done) return;
        done = true;
        clearInterval(poll);
        clearTimeout(timer);
        iframe.remove();
        fn(val);
      };
      const read = () => {
        try {
          const d = iframe.contentDocument;
          if (!d || !d.body) return null;
          return { title: getTitle(d), docs: findDocs(d) };
        } catch (e) {
          finish(reject, e);
          return null;
        }
      };
      let loaded = false;
      iframe.onload = () => (loaded = true);
      const poll = setInterval(() => {
        if (!loaded) return;
        const r = read();
        if (r && r.docs.length) finish(resolve, r);
      }, 500);
      const timer = setTimeout(() => finish(resolve, read() || { title: "", docs: [] }), IFRAME_WAIT_MS);
      document.body.appendChild(iframe);
    });
  }

  const results = [];
  const noDocs = [];
  const failed = [];

  for (let i = 0; i < LISTING_URLS.length; i++) {
    const url = LISTING_URLS[i];
    const listingId = (url.match(/\/listings\/(\d+)/) || [])[1] || "";
    console.log(`[nai-step2] (${i + 1}/${LISTING_URLS.length}) ${url}`);
    let title = "";
    let docs = [];
    let method = "fetch";
    try {
      const html = await fetchHtml(url);
      const doc = new DOMParser().parseFromString(html, "text/html");
      title = getTitle(doc);
      docs = findDocs(doc);
    } catch (err) {
      console.warn(`[nai-step2]   fetch failed (${err.message || err}) - trying rendered page`);
    }
    if (docs.length === 0) {
      method = "rendered";
      try {
        const r = await renderInIframe(url);
        title = r.title || title;
        docs = r.docs;
      } catch (err) {
        console.warn(`[nai-step2]   could not render ${url}:`, err);
        failed.push(url);
        if (i < LISTING_URLS.length - 1) await sleep(DELAY_MS);
        continue;
      }
    }
    if (docs.length === 0) {
      console.log(`[nai-step2]   no documents found`);
      noDocs.push(url);
    } else {
      console.log(`[nai-step2]   ${docs.length} document(s) via ${method}`);
    }
    docs.forEach((d) =>
      results.push({
        listingId: d.listingIdAttr || listingId,
        listingUrl: url,
        listingTitle: title,
        docType: d.docType,
        docLabel: d.docLabel,
        pdfUrl: d.pdfUrl,
      })
    );
    if (i < LISTING_URLS.length - 1) await sleep(DELAY_MS);
  }

  // Dedupe per listing + document (two listings sharing one brochure keep a row each)
  const seen = new Set();
  const deduped = results.filter((r) => {
    const key = `${r.listingUrl}|${r.pdfUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `[nai-step2] Done. ${deduped.length} document link(s) from ${LISTING_URLS.length - noDocs.length - failed.length}/${LISTING_URLS.length} listing(s). ` +
      `${noDocs.length} listing(s) had no documents, ${failed.length} failed to load.`
  );
  console.table(deduped);
  if (noDocs.length) {
    console.log("[nai-step2] Listings with no documents (window.__naiNoDocs):");
    console.table(noDocs);
  }
  if (failed.length) {
    console.log("[nai-step2] Listings that failed to load (window.__naiFailed) - re-run later for these:");
    console.table(failed);
  }

  window.__naiPdfResults = deduped;
  window.__naiNoDocs = noDocs;
  window.__naiFailed = failed;

  const save = (content, type, filename) => {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.downloadJson = function downloadJson(filename = "nai_pdf_links.json") {
    save(JSON.stringify(deduped, null, 2), "application/json", filename);
  };

  window.downloadCsv = function downloadCsv(filename = "nai_pdf_links.csv") {
    const escapeCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["listingId", "listingUrl", "listingTitle", "docType", "docLabel", "pdfUrl"];
    const rows = deduped.map((r) => header.map((k) => escapeCell(r[k])).join(","));
    save([header.join(","), ...rows].join("\n"), "text/csv", filename);
  };

  window.downloadAllPdfs = async function downloadAllPdfs() {
    console.log(
      `[nai-step2] Downloading ${deduped.length} document(s)... allow multiple downloads if the browser asks.`
    );
    let corsBlocked = 0;
    for (let i = 0; i < deduped.length; i++) {
      const { pdfUrl, listingTitle, listingId, docLabel } = deduped[i];
      const base = [listingId, listingTitle, docLabel].filter(Boolean).join("__") || "document";
      const filename = `${base.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 150)}.pdf`;
      try {
        const resp = await fetch(pdfUrl);
        if (!resp.ok) {
          console.warn(`[nai-step2] (${i + 1}/${deduped.length}) HTTP ${resp.status} for ${pdfUrl}, skipping`);
          continue;
        }
        save(await resp.blob(), "application/pdf", filename);
        console.log(`[nai-step2] (${i + 1}/${deduped.length}) saved ${filename}`);
      } catch (err) {
        // cloudfront.net is a different origin; if it blocks fetch(),
        // fall back to opening a tab (navigation isn't subject to CORS).
        corsBlocked++;
        console.warn(`[nai-step2] (${i + 1}/${deduped.length}) fetch blocked for ${pdfUrl} - opening in a new tab instead.`);
        window.open(pdfUrl, "_blank", "noopener");
      }
      if (i < deduped.length - 1) await sleep(DELAY_MS);
    }
    if (corsBlocked > 0) {
      console.log(
        `[nai-step2] ${corsBlocked} document(s) opened in tabs instead (allow pop-ups if none opened). For tab-free downloads, use downloadCsv() with download_pdfs_from_csv.py / download_pdfs.sh / download_pdfs.ps1.`
      );
    }
    console.log("[nai-step2] All downloads triggered.");
  };

  console.log(
    "[nai-step2] Results in window.__naiPdfResults. Run downloadCsv(), downloadJson(), or downloadAllPdfs()."
  );
})();
