/**
 * NAI Edmonton — Step 1: collect listing links (paste into DevTools Console)
 *
 * WHERE TO RUN IT
 *   naiedmonton.com's listings page is just a frame around SpaceList:
 *   its widget (www.spacelist.ca/engines/85.js) builds an <iframe> whose
 *   src is "https://e85.spacelist.ca" + the ?epath= value in NAI's URL.
 *   The listing cards and brochure links live INSIDE that frame, so this
 *   script finds nothing if you run it in the naiedmonton.com page itself.
 *
 *   Either:
 *     a) open the SpaceList page directly, e.g. for
 *          naiedmonton.com/nai-listings/?epath=/listings/ab/edmonton/office/sort/sort_score
 *        go to
 *          https://e85.spacelist.ca/listings/ab/edmonton/office/sort/sort_score
 *     or
 *     b) stay on naiedmonton.com and switch the DevTools Console's context
 *        dropdown (top-left of the Console, says "top") to the
 *        e85.spacelist.ca frame.
 *
 * HOW TO USE
 *   1. Open the search results (see above) and let them load.
 *   2. DevTools -> Console, paste this whole file, press Enter.
 *   3. The script scrolls the results to load lazy-loaded cards, then
 *      collects every listing link. If results are split across pages,
 *      go to the next page and run it again - links accumulate across
 *      runs in the same tab (window.__naiListingUrls).
 *   4. Then paste Step 2 in the SAME tab - it picks up
 *      window.__naiListingUrls automatically. (Or run downloadListingUrls()
 *      to save the list as JSON.)
 */
(async function collectNaiListingLinks() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  if (/naiedmonton\.com$/.test(location.hostname)) {
    console.warn(
      "[nai-step1] You're running this on naiedmonton.com, but the listings are inside an e85.spacelist.ca frame. Switch the Console context dropdown from 'top' to the e85.spacelist.ca frame, or open the SpaceList page directly, then re-run."
    );
  }

  const LISTING_RE = /\/listings\/(\d+)\//;

  const collect = () => {
    const found = new Map(); // listingId -> url
    document.querySelectorAll("a[href]").forEach((a) => {
      const m = a.href.match(LISTING_RE);
      if (m && /spacelist\.ca$/.test(new URL(a.href).hostname)) {
        if (!found.has(m[1])) found.set(m[1], a.href.split("#")[0]);
      }
    });
    return found;
  };

  // Scroll every scrollable element (and the window) to the bottom until
  // the number of listing links stops growing, to load lazy cards.
  const scrollables = () =>
    [document.scrollingElement, ...document.querySelectorAll("*")].filter(
      (el) =>
        el &&
        (el === document.scrollingElement ||
          (el.scrollHeight > el.clientHeight + 50 &&
            /(auto|scroll)/.test(getComputedStyle(el).overflowY || "")))
    );

  let last = -1;
  let stable = 0;
  for (let i = 0; i < 40 && stable < 3; i++) {
    scrollables().forEach((el) => (el.scrollTop = el.scrollHeight));
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1200);
    const n = collect().size;
    if (n === last) stable++;
    else stable = 0;
    last = n;
  }

  const prev = new Set(window.__naiListingUrls || []);
  const before = prev.size;
  collect().forEach((url) => prev.add(url));
  const urls = [...prev];
  window.__naiListingUrls = urls;

  console.log(
    `[nai-step1] ${urls.length} listing link(s) collected (${urls.length - before} new this run).`
  );
  if (urls.length === 0) {
    console.warn(
      "[nai-step1] 0 listings found - make sure results have visibly loaded and you're in the e85.spacelist.ca frame/page, then re-run."
    );
  }
  console.table(urls);

  const pager = [...document.querySelectorAll("a[href], button")].filter((el) =>
    /^(next|›|»|>|\d+)$/i.test((el.textContent || "").trim()) && el.closest("nav, .pagination, [class*=pag]")
  );
  if (pager.length) {
    console.log(
      "[nai-step1] Pagination controls detected - go to each further page and paste/run this script again; links accumulate."
    );
  }

  window.downloadListingUrls = function downloadListingUrls(filename = "nai_listing_urls.json") {
    const blob = new Blob([JSON.stringify(window.__naiListingUrls, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  console.log(
    "[nai-step1] Stored in window.__naiListingUrls. Now paste Step 2 in this same tab (or run downloadListingUrls() to save the list)."
  );
})();
