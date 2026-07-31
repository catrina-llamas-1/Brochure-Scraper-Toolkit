// Pass 1: for a single city, walk paginated search results and collect
// deduped detail-page URLs. Called once per city; discoverAllListings()
// merges/dedupes across cities.
//
// IMPORTANT (per the brief, confirmed — do not re-derive): use the
// PATH-form URL
//   /en/canada/properties/lease/search/{type}/alberta/city-{citySlug}
// paginated by appending ?page=2, ?page=3, etc. (page 1 is the bare URL,
// no ?page= param at all). NEVER the query-string multi-city form —
// appending &page=N to that silently drops extra cities and resets to
// page 1. Do not "simplify" this back to a single multi-city query URL;
// it's a deliberate workaround for confirmed site behavior, not an
// oversight — see docs/SCHEMA.md and the "recurring monthly use" section
// of the brief for the full reasoning.
//
// Card selector: <a href> containing "/properties/for-lease/" (confirmed
// by the brief). Stop paginating a city once a page contributes zero URLs
// not already seen — not "zero cards", specifically zero NEW ones, since
// an out-of-range page number on a site like this often re-renders the
// last page's content rather than an empty page, and a naive "zero cards"
// check would loop forever in that case.

import { BASE_URL } from "../config/constants.js";
import { PROVINCE_SLUG } from "../config/cities.js";
import { fetchWithRetry } from "../net/fetchWithRetry.js";

const CARD_HREF_MARKER = "/properties/for-lease/";

// Safety net only — the dedup-based stop condition above should trigger
// long before this on any real search. Guards against an unforeseen case
// (e.g. a site bug that keeps yielding "new" URLs forever) turning into an
// unbounded loop against someone's public website.
const MAX_PAGES_PER_CITY = 50;

function buildCitySearchUrl(propertyTypeSlug, citySlug, page) {
  const path = `/en/canada/properties/lease/search/${propertyTypeSlug}/${PROVINCE_SLUG}/city-${citySlug}`;
  return page <= 1 ? `${BASE_URL}${path}` : `${BASE_URL}${path}?page=${page}`;
}

function extractCardHrefs(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const hrefs = [];
  for (const a of doc.querySelectorAll("a[href]")) {
    const raw = a.getAttribute("href");
    if (!raw || !raw.includes(CARD_HREF_MARKER)) continue;
    // Same base-URL trap as parseDetailPage.js: a DOMParser-parsed
    // document's base is NOT the fetched page's URL, so relative hrefs
    // must be resolved explicitly against pageUrl, never read via `.href`.
    try {
      hrefs.push(new URL(raw, pageUrl).href);
    } catch {
      // malformed href on one card shouldn't take down the whole page
    }
  }
  return hrefs;
}

/**
 * @param {object} params
 * @param {string} params.citySlug
 * @param {string} params.propertyTypeSlug
 * @param {number} params.delayMs
 * @param {(msg: string) => void} [params.onProgress]
 * @returns {Promise<string[]>} deduped absolute detail-page URLs for this city
 */
export async function discoverListingsForCity({ citySlug, propertyTypeSlug, delayMs, onProgress = () => {} }) {
  const seen = new Set();
  const ordered = [];

  for (let page = 1; page <= MAX_PAGES_PER_CITY; page++) {
    const pageUrl = buildCitySearchUrl(propertyTypeSlug, citySlug, page);
    onProgress(`[${citySlug}] fetching page ${page}: ${pageUrl}`);

    const result = await fetchWithRetry(pageUrl, { delayMs, responseType: "text" });
    if (!result.ok) {
      onProgress(
        `[${citySlug}] page ${page} failed after retries (${result.error}) — stopping pagination for this city with ${ordered.length} listing(s) found so far`
      );
      break;
    }

    const hrefs = extractCardHrefs(result.data, pageUrl);
    const newHrefs = hrefs.filter((href) => !seen.has(href));

    if (newHrefs.length === 0) {
      onProgress(`[${citySlug}] page ${page} had no new listings — stopping (${ordered.length} total for this city)`);
      break;
    }

    for (const href of newHrefs) {
      seen.add(href);
      ordered.push(href);
    }
    onProgress(`[${citySlug}] page ${page}: +${newHrefs.length} new (${ordered.length} total so far)`);
  }

  return ordered;
}

/**
 * Runs discoverListingsForCity for every configured city and returns the
 * union, deduped by URL.
 * @param {object} params
 * @param {string[]} params.citySlugs
 * @param {string} params.propertyTypeSlug
 * @param {number} params.delayMs
 * @param {(msg: string) => void} [params.onProgress]
 * @returns {Promise<string[]>}
 */
export async function discoverAllListings({ citySlugs, propertyTypeSlug, delayMs, onProgress = () => {} }) {
  const seen = new Set();
  const merged = [];
  for (const citySlug of citySlugs) {
    const cityUrls = await discoverListingsForCity({ citySlug, propertyTypeSlug, delayMs, onProgress });
    for (const url of cityUrls) {
      if (!seen.has(url)) {
        seen.add(url);
        merged.push(url);
      }
    }
  }
  return merged;
}
