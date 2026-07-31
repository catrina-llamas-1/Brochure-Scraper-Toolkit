// Throwaway test runner, not part of the extension or CI.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<html><body></body></html>");
global.DOMParser = dom.window.DOMParser;

const { discoverListingsForCity, discoverAllListings } = await import("../src/discover/discoverListings.js");

function cardsPage(hrefs) {
  const cards = hrefs
    .map((h) => `<a class="cw-search-card js-property-card" href="${h}">card</a>`)
    .join("\n");
  // include a nav link that must NOT be picked up by the card selector
  return `<html><body>
    <nav><a href="/en/canada/properties/lease/search">All properties for lease</a></nav>
    ${cards}
  </body></html>`;
}

// --- Test 1: URL construction (page 1 bare, page 2+ has ?page=N) + dedup-based stop ---
{
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url);
    if (url.includes("city-edmonton") && !url.includes("?page=")) {
      // page 1
      return {
        ok: true,
        text: async () =>
          cardsPage([
            "/en/canada/properties/for-lease/office/ab/edmonton/listing-1/x-l",
            "/en/canada/properties/for-lease/office/ab/edmonton/listing-2/x-l",
          ]),
      };
    }
    if (url.includes("?page=2")) {
      return {
        ok: true,
        text: async () =>
          cardsPage([
            "/en/canada/properties/for-lease/office/ab/edmonton/listing-3/x-l",
          ]),
      };
    }
    if (url.includes("?page=3")) {
      // site loops back to page-2 content for an out-of-range page number
      return {
        ok: true,
        text: async () =>
          cardsPage([
            "/en/canada/properties/for-lease/office/ab/edmonton/listing-3/x-l",
          ]),
      };
    }
    throw new Error(`unexpected URL in test: ${url}`);
  };

  const progressLog = [];
  const urls = await discoverListingsForCity({
    citySlug: "edmonton",
    propertyTypeSlug: "office",
    delayMs: 1,
    onProgress: (msg) => progressLog.push(msg),
  });

  assert.deepEqual(urls, [
    "https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/edmonton/listing-1/x-l",
    "https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/edmonton/listing-2/x-l",
    "https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/edmonton/listing-3/x-l",
  ]);

  // page 1 request must be bare (no ?page=), confirming the brief's rule
  assert.equal(
    requestedUrls[0],
    "https://www.cushmanwakefield.com/en/canada/properties/lease/search/office/alberta/city-edmonton"
  );
  assert.ok(requestedUrls[1].endsWith("?page=2"));
  assert.ok(requestedUrls[2].endsWith("?page=3"));
  // stopped after page 3 (0 new) rather than continuing to MAX_PAGES_PER_CITY
  assert.equal(requestedUrls.length, 3);
  assert.ok(progressLog.some((m) => m.includes("no new listings")));
  console.log("Test 1 (URL construction, cross-page dedup, stop-on-no-new-URLs) PASSED");
}

// --- Test 2: page fetch fails after retries -> stop pagination, don't crash, return what we have ---
{
  global.fetch = async (url) => {
    if (!url.includes("?page=")) {
      return {
        ok: true,
        text: async () =>
          cardsPage(["/en/canada/properties/for-lease/office/ab/leduc/listing-1/x-l"]),
      };
    }
    throw new Error("simulated network failure");
  };

  const urls = await discoverListingsForCity({
    citySlug: "leduc",
    propertyTypeSlug: "office",
    delayMs: 1,
    maxRetries: 0,
  });
  assert.deepEqual(urls, ["https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/leduc/listing-1/x-l"]);
  console.log("Test 2 (page fetch failure stops pagination gracefully, no crash) PASSED");
}

// --- Test 3: discoverAllListings dedupes across cities ---
{
  global.fetch = async (url) => {
    if (url.includes("city-edmonton")) {
      return {
        ok: true,
        text: async () =>
          cardsPage([
            "/en/canada/properties/for-lease/office/ab/edmonton/shared-listing/x-l",
            "/en/canada/properties/for-lease/office/ab/edmonton/only-edmonton/x-l",
          ]),
      };
    }
    if (url.includes("city-leduc")) {
      return {
        ok: true,
        text: async () =>
          // same "shared-listing" URL also appears under leduc's search (edge case: overlapping region tagging)
          cardsPage([
            "/en/canada/properties/for-lease/office/ab/edmonton/shared-listing/x-l",
            "/en/canada/properties/for-lease/office/ab/leduc/only-leduc/x-l",
          ]),
      };
    }
    throw new Error(`unexpected URL: ${url}`);
  };

  const urls = await discoverAllListings({
    citySlugs: ["edmonton", "leduc"],
    propertyTypeSlug: "office",
    delayMs: 1,
  });

  assert.equal(urls.length, 3, `expected 3 unique URLs, got ${urls.length}: ${JSON.stringify(urls)}`);
  assert.ok(urls.includes("https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/edmonton/shared-listing/x-l"));
  assert.ok(urls.includes("https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/edmonton/only-edmonton/x-l"));
  assert.ok(urls.includes("https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/leduc/only-leduc/x-l"));
  console.log("Test 3 (discoverAllListings dedupes across cities) PASSED");
}

// --- Test 4: nav/non-card links are never picked up ---
{
  global.fetch = async () => ({
    ok: true,
    text: async () => cardsPage(["/en/canada/properties/for-lease/office/ab/edmonton/only-real-one/x-l"]),
  });
  const urls = await discoverListingsForCity({ citySlug: "edmonton", propertyTypeSlug: "office", delayMs: 1 });
  assert.equal(urls.length, 1);
  assert.ok(!urls.some((u) => u.includes("/lease/search")));
  console.log("Test 4 (nav links excluded, only real card hrefs collected) PASSED");
}

console.log("\nALL discoverListings.js TESTS PASSED");
