// Throwaway test runner, not part of the extension or CI. Confirms
// parseDetailPage.js against fixtures shaped like the real confirmed
// markup before trusting it.
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";

const dom = new JSDOM("<html><body></body></html>");
global.DOMParser = dom.window.DOMParser;

const { parseDetailPage } = await import("../src/detail/parseDetailPage.js");

const REAL_URL =
  "https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/edmonton/14710-112-avenue/test-l";

function brokerCard(name, personId, title = "Partner - CW Edmonton", location = "Edmonton, Canada") {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  return `
    <div class="card mix_person mix_small_updated">
      <a href="/en/canada/people/${slug}"><img class="card-img-top" src="x.jpg"></a>
      <div class="card-body">
        <h6 class="font-weight-bold updatedCardPerson"><a href="/en/canada/people/${slug}">${name}</a></h6>
        <p class="card-text mt-1">
          <span class="updatedCardLocation">${title}</span><br>
          <span class="updatedCardLocation">${location}</span><br>
        </p>
        <hr>
        <p class="updatedCardVcard font-weight-bold">
          <a href="/api/GetVCard?personId={${personId}}&vcn=${slug}"><i class="far fa-id-card"></i> Download VCard</a>
        </p>
      </div>
    </div>`;
}

function fullPage({ dtDdHtml, brokerHtml, brochureHtml = "" }) {
  return `<!doctype html><html><body>
    <meta property="og:image" content="https://assets.cushmanwakefield.com/-/pmedia/271234/p/img.webp?rev=abc">
    <h1 class="updated-page-title-main">Office Space for Sublease #100 14710 112 Avenue Edmonton</h1>
    <div class="updated-page-title-tags text-uppercase d-flex"><span>For Sublease</span><span class="mr-2">Office</span></div>
    <h5 class="updated-page-title-sub mt-2 font-weight-normal mb-3">100 14710 112 Avenue NW, Edmonton, AB Canada</h5>
    <dl>${dtDdHtml}</dl>
    ${brokerHtml}
    ${brochureHtml}
  </body></html>`;
}

// --- Test 1: full real-shaped listing, numeric rent, one broker rendered twice (dedup) ---
{
  const html = fullPage({
    dtDdHtml: `
      <dt>Available Space:</dt><dd>15,000 SF</dd>
      <dt>Rental Price:</dt><dd>$18.00 PSF Net</dd>`,
    brokerHtml: brokerCard("Dustin Bateyko", "43DDB8A8-C0AC-491A-876D-2453B9E214AF") +
                brokerCard("Dustin Bateyko", "43DDB8A8-C0AC-491A-876D-2453B9E214AF"), // duplicate render
    brochureHtml: `<a href="https://assets.cushmanwakefield.com/-/pmedia/271234/0/brochure.pdf?rev=xyz">Brochure</a>`,
  });

  const result = parseDetailPage(html, REAL_URL);

  assert.equal(result.property_id, "271234");
  assert.equal(result.title, "Office Space for Sublease #100 14710 112 Avenue Edmonton");
  assert.equal(result.address, "100 14710 112 Avenue NW, Edmonton, AB Canada");
  assert.equal(result.transaction_type, "Sublease");
  assert.deepEqual(result.available_sf, { value: 15000, source: "html" });
  assert.deepEqual(result.net_rent, { value: 18, source: "html" });
  assert.deepEqual(result.max_contiguous_sf, { value: null, source: "missing" });
  assert.deepEqual(result.min_divisible_sf, { value: null, source: "missing" });
  assert.equal(result.broker_name.value, "Dustin Bateyko (Partner - CW Edmonton; Edmonton, Canada)");
  assert.equal(result.broker_name.source, "html");
  assert.deepEqual(result.broker_phone, { value: null, source: "missing" });
  assert.deepEqual(result.broker_email, { value: null, source: "missing" });
  assert.equal(result.broker_profile_url, "https://www.cushmanwakefield.com/en/canada/people/dustin-bateyko");
  assert.equal(result.brochure_urls.length, 1);
  assert.equal(result.notes, "");
  console.log("Test 1 (full listing, numeric rent, duplicate broker dedup) PASSED");
}

// --- Test 2: non-numeric rental price, no brochure, no broker ---
{
  const html = fullPage({
    dtDdHtml: `<dt>Available Space:</dt><dd>4,100 SF</dd><dt>Rental Price:</dt><dd>Contact us for pricing</dd>`,
    brokerHtml: "",
  });

  const result = parseDetailPage(html, REAL_URL);
  assert.deepEqual(result.net_rent, { value: null, source: "html" }); // found, just non-numeric
  assert.equal(result.notes, "Rental Price: Contact us for pricing");
  assert.equal(result.brochure_urls.length, 0);
  assert.deepEqual(result.broker_name, { value: null, source: "missing" });
  assert.equal(result.broker_profile_url, null);
  console.log("Test 2 (non-numeric rent, no brochure, no broker) PASSED");
}

// --- Test 3: two distinct brokers ---
{
  const html = fullPage({
    dtDdHtml: `<dt>Available Space:</dt><dd>1,000 SF</dd>`,
    brokerHtml: brokerCard("Dustin Bateyko", "AAAA") + brokerCard("Jane Smith", "BBBB", "Associate - CW Edmonton"),
  });
  const result = parseDetailPage(html, REAL_URL);
  assert.equal(
    result.broker_name.value,
    "Dustin Bateyko (Partner - CW Edmonton; Edmonton, Canada); Jane Smith (Associate - CW Edmonton; Edmonton, Canada)"
  );
  console.log("Test 3 (two distinct brokers) PASSED");
}

// --- Test 4: missing <h1> throws loudly, names the selector ---
{
  const html = `<html><body><meta property="og:image" content="https://assets.cushmanwakefield.com/-/pmedia/1/p/x.jpg"></body></html>`;
  assert.throws(() => parseDetailPage(html, REAL_URL), /no <h1> found \(selector "h1" matched nothing\)/);
  console.log("Test 4 (missing h1 throws loudly) PASSED");
}

// --- Test 5: missing og:image throws loudly ---
{
  const html = `<html><body><h1>Some Title</h1></body></html>`;
  assert.throws(() => parseDetailPage(html, REAL_URL), /no <meta property="og:image"> found/);
  console.log("Test 5 (missing og:image throws loudly) PASSED");
}

console.log("\nALL parseDetailPage.js TESTS PASSED");
