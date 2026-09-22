/**
 * Cushman & Wakefield — Address extractor (paste into DevTools Console)
 *
 * WHAT THIS DOES
 * Run this on a search-results page, e.g.
 *   https://www.cushmanwakefield.com/en/canada/properties/lease/search/industrial?bbox=53.113470,-113.949008,53.873248,-113.141513&zoom=10
 * It:
 *   1. Starts from the current page's own filters (property type, bbox,
 *      zoom, or whatever else is in the URL) with any existing `page`
 *      param stripped, so it always collects from the true first page
 *      regardless of which page you happened to be looking at.
 *   2. Fetches page 1, 2, 3, ... (appending `?page=N` on top of your
 *      existing filters) and collects each listing card's address/title/
 *      price/etc.
 *   3. Stops once a page contributes zero listings not already seen —
 *      not zero listings outright, specifically zero NEW ones, since an
 *      out-of-range page number on this site can silently re-serve an
 *      earlier page's content instead of an empty one.
 *   4. Prints a table in the console and gives you `downloadCsv()` /
 *      `downloadJson()` helpers to save the results.
 *
 * HOW TO USE
 *   1. Open the search-results page in Chrome (any filter combination —
 *      bbox/zoom map search, city path search, whatever you're viewing).
 *   2. Open DevTools (F12 or Cmd+Opt+I) -> Console tab.
 *   3. Paste this whole file in and press Enter.
 *   4. Wait for it to finish (it logs progress + a final console.table).
 *   5. Run `downloadCsv()` in the console to save a spreadsheet, or
 *      `downloadJson()` for the raw data.
 *
 * A NOTE ON PAGINATION SAFETY
 * Appending `?page=N` to some filter combinations on this site has been
 * observed to silently drop the filter and reset to page 1 instead of
 * genuinely paginating (confirmed for the multi-city query-string search
 * form; unconfirmed either way for bbox/zoom map searches). The
 * dedup-based stop condition above makes this safe either way: if a page
 * turns out to be a repeat of page 1, it contributes zero NEW listings
 * and the script stops there with a specific warning, rather than
 * silently double-counting or looping. If you see that warning, you have
 * everything the automatic pagination could safely collect — anything
 * beyond it would need manual per-page verification.
 *
 * WHAT IT EXTRACTS
 * title, street_address, city, province, listing_type (e.g. "For Lease"),
 * property_type (e.g. "Industrial"), price, detail_url — one row per
 * listing card.
 *
 * Selectors match what was confirmed live against this site's search-card
 * markup (a.cw-search-card.js-property-card and its child
 * p.cw-search-card__* elements) — carried over from confirmed markup on
 * other filter forms of this same search page (city path-form, state
 * query-form), not independently re-verified for the exact bbox/zoom
 * query form specifically. If the console.table below comes back empty,
 * this selector is the first thing to check — the site's markup may
 * differ for this filter form, or may have changed since.
 */
window.__cwAddressExtractorPromise = (async function extractAddressesFromSearchResults() {
  const CARD_SELECTOR = "a.cw-search-card.js-property-card";
  const DELAY_MS = 1000; // be polite between page fetches
  const MAX_PAGES = 50; // safety net only — the dedup stop condition should trigger well before this

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function absUrl(href, baseUrl) {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return null;
    }
  }

  // Reconstructs the <br>-separated lines of an address block as an array
  // of trimmed strings, e.g. "123 Main St<br>Edmonton, Alberta<br>Canada"
  // -> ["123 Main St", "Edmonton, Alberta", "Canada"].
  function getBrSeparatedLines(el) {
    if (!el) return [];
    const lines = [];
    let current = "";
    el.childNodes.forEach((node) => {
      if (node.nodeName === "BR") {
        if (current.trim()) lines.push(current.trim());
        current = "";
      } else {
        current += node.textContent;
      }
    });
    if (current.trim()) lines.push(current.trim());
    return lines;
  }

  function parseCard(card, pageUrl) {
    const href = card.getAttribute("href");
    const detail_url = href ? absUrl(href, pageUrl) : null;

    const title = card.querySelector("p.cw-search-card__title")?.textContent.trim() || "";

    const addressLines = getBrSeparatedLines(card.querySelector("p.cw-search-card__address"));
    const street_address = addressLines[0] || "";
    let city = "";
    let province = "";
    if (addressLines[1]) {
      const parts = addressLines[1].split(",").map((s) => s.trim());
      city = parts[0] || "";
      province = parts[1] || "";
    }

    const metaText = (card.querySelector("p.cw-search-card__meta")?.textContent || "").trim();
    let listing_type = metaText;
    let property_type = metaText;
    if (metaText.includes("•")) {
      const [left, right] = metaText.split("•").map((s) => s.trim());
      listing_type = left;
      property_type = right;
    }

    const priceText = (card.querySelector("p.cw-search-card__price")?.textContent || "").trim();
    const price = priceText.replace(/^rental price\s*:\s*/i, "").trim();

    return { title, street_address, city, province, listing_type, property_type, price, detail_url };
  }

  function buildPageUrl(baseUrlNoPage, page) {
    const u = new URL(baseUrlNoPage);
    if (page > 1) u.searchParams.set("page", String(page));
    return u.href;
  }

  const baseUrl = new URL(location.href);
  baseUrl.searchParams.delete("page");
  const baseUrlStr = baseUrl.href;

  console.log(`[cw-address-extractor] Starting from: ${baseUrlStr}`);

  const seen = new Set();
  const results = [];
  let page1Urls = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = buildPageUrl(baseUrlStr, page);
    console.log(`[cw-address-extractor] Fetching page ${page}: ${pageUrl}`);

    let doc;
    try {
      const resp = await fetch(pageUrl, { credentials: "include" });
      if (!resp.ok) {
        console.warn(`[cw-address-extractor] page ${page} -> HTTP ${resp.status}, stopping.`);
        break;
      }
      const html = await resp.text();
      doc = new DOMParser().parseFromString(html, "text/html");
    } catch (err) {
      console.warn(`[cw-address-extractor] page ${page} fetch failed:`, err, "-- stopping.");
      break;
    }

    const cards = [...doc.querySelectorAll(CARD_SELECTOR)];
    if (cards.length === 0) {
      console.log(`[cw-address-extractor] page ${page} had no listing cards -- stopping (${results.length} total).`);
      break;
    }

    const pageResults = cards.map((c) => parseCard(c, pageUrl));
    const pageUrls = new Set(pageResults.map((r) => r.detail_url).filter(Boolean));
    if (page === 1) page1Urls = pageUrls;

    const newOnes = pageResults.filter((r) => r.detail_url && !seen.has(r.detail_url));

    if (newOnes.length === 0) {
      const isPage1Repeat = page > 1 && pageUrls.size > 0 && [...pageUrls].every((u) => page1Urls.has(u));
      if (isPage1Repeat) {
        console.warn(
          `[cw-address-extractor] page ${page} returned the SAME listings as page 1 -- this usually ` +
            "means the site dropped a filter and reset to page 1, not that there are no more results. " +
            `Stopping with ${results.length} listing(s) collected; treat this as a lower bound, not necessarily everything.`
        );
      } else {
        console.log(`[cw-address-extractor] page ${page} had no NEW listings -- stopping (${results.length} total).`);
      }
      break;
    }

    newOnes.forEach((r) => {
      seen.add(r.detail_url);
      results.push(r);
    });
    console.log(`[cw-address-extractor] page ${page}: +${newOnes.length} new (${results.length} total so far)`);

    if (page < MAX_PAGES) await sleep(DELAY_MS);
  }

  console.log(`[cw-address-extractor] Done. ${results.length} unique listing(s) collected.`);
  console.table(results);

  window.__cwAddressResults = results;

  window.downloadCsv = function downloadCsv(filename) {
    filename = filename || `cw_addresses_${new Date().toISOString().slice(0, 10)}.csv`;
    const escapeCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["title", "street_address", "city", "province", "listing_type", "property_type", "price", "detail_url"];
    const rows = results.map((r) => header.map((k) => escapeCell(r[k])).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.downloadJson = function downloadJson(filename) {
    filename = filename || `cw_addresses_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  console.log(
    "[cw-address-extractor] Results stored in window.__cwAddressResults. Run downloadCsv() to save a spreadsheet, or downloadJson() for the raw data."
  );

  return results;
})();
