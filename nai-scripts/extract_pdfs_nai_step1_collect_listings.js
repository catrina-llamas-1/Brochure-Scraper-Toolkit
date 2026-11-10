/**
 * NAI Edmonton — Step 1: collect listing links (paste into DevTools Console)
 *
 * NAI Edmonton is a genuinely different case from the other four sites:
 * the search-results widget renders directly into naiedmonton.com's own
 * DOM (confirmed - no iframe, no Shadow DOM holds it), but each listing
 * card's <a href> points to a COMPLETELY DIFFERENT ORIGIN:
 *   https://e85.spacelist.ca/listings/<id>/...
 * (SpaceList, a third-party commercial listing platform NAI Edmonton's
 * site embeds data from). Confirmed via a real card's outerHTML:
 *   <a href="https://e85.spacelist.ca/listings/945907/..."
 *      class="listing-card listing-945907" data-listing="945907">...</a>
 *
 * That means a single script can't do this end-to-end the way the other
 * four variants do: fetching a spacelist.ca URL FROM naiedmonton.com's
 * console is a genuine cross-origin request and gets CORS-blocked, the
 * same class of problem that blocked downloadAllPdfs() on other sites,
 * except here it blocks reading the detail page's HTML at all, not just
 * downloading a file. There is no origin-agnostic workaround for that -
 * it has to be done from a page that IS on spacelist.ca.
 *
 * WORKFLOW (two steps, two tabs):
 *   STEP 1 (this file) - run on the NAI Edmonton search-results page.
 *     Collects every listing card's spacelist.ca URL and lets you export
 *     the list.
 *   STEP 2 (extract_pdfs_nai_step2_extract_docs.js) - open any ONE of
 *     those listing URLs directly in its own tab (now same-origin with
 *     every other listing, since they're all under spacelist.ca), paste
 *     the exported list into that script's LISTING_URLS placeholder, and
 *     run it there. It fetches each listing and extracts brochure links.
 *
 * HOW TO USE (this file)
 *   1. Open the NAI Edmonton search-results page, with results visibly
 *      loaded (wait for listing cards to actually render).
 *   2. Open DevTools -> Console tab.
 *   3. Paste this whole file in and press Enter.
 *   4. Run `downloadListingUrls()` to save the list as JSON.
 *   5. Open one of the printed URLs in a new tab, and move on to Step 2.
 */
(function collectNaiListingLinks() {
  const cards = [...document.querySelectorAll("a.listing-card[href]")];
  const urls = [...new Set(cards.map((a) => a.href))];

  console.log(`[nai-step1] Found ${urls.length} listing link(s).`);
  if (urls.length === 0) {
    console.warn(
      "[nai-step1] 0 listing cards found — make sure results have visibly finished loading (this widget renders client-side), then re-run."
    );
  }
  console.table(urls);

  window.__naiListingUrls = urls;

  window.downloadListingUrls = function downloadListingUrls(filename = "nai_listing_urls.json") {
    const blob = new Blob([JSON.stringify(urls, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  console.log(
    "[nai-step1] Results stored in window.__naiListingUrls. Run downloadListingUrls() to save, then open any ONE of these URLs in a new tab and continue with extract_pdfs_nai_step2_extract_docs.js there."
  );
})();
