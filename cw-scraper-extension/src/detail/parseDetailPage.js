// Pass 2: parse a single listing detail page. Only ever called from the
// worker tab — DOMParser doesn't exist in the background service worker.
//
// Selectors confirmed 2026-07-31 against a real live listing (see
// docs/SELECTORS.md for the full confirmed/carried-over breakdown — the
// dt/dd fields and broker card were independently re-confirmed for this
// project; a few (h1 class, address line, transaction-type tag) are
// carried over from the sibling Python-scraper project's confirmed markup
// on the same site/template, not independently re-verified here).
//
// Per the brief's robustness requirement: a MISSING FIELD on one listing
// (e.g. no Max Contiguous) is normal and expected — source stays
// FIELD_SOURCE.MISSING, no error. A MISSING STRUCTURE the brief guarantees
// exists on every listing (h1, og:image) is different — that means the
// site changed, and this throws loudly naming the selector, rather than
// silently writing an empty column.

import { FIELD_SOURCE } from "../config/constants.js";
import { parseSquareFootage, parseCurrencyValue } from "../utils/numberParsing.js";

const PMEDIA_ID_RE = /\/pmedia\/(\d+)\//;
const VCARD_PERSON_ID_RE = /personId=\{?([0-9A-Fa-f-]+)\}?/;
const PDF_HREF_RE = /assets\.cushmanwakefield\.com\/-\/pmedia\/\d+\/0\/[^"'?]+\.pdf/i;

function sourced(value, source) {
  return { value, source };
}

// IMPORTANT: a document built via `new DOMParser().parseFromString(...)` has
// its OWN base URL (the worker tab's own page, not the URL the HTML was
// fetched from) — so `anchor.href` silently resolves relative links against
// the wrong base. Every relative href must be resolved explicitly against
// the `url` parameter via this helper, never read off `.href` directly.
function resolveHref(el, baseUrl) {
  const raw = el && el.getAttribute("href");
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

function findDtDdValue(doc, keyMatchers) {
  for (const dt of doc.querySelectorAll("dt")) {
    const key = dt.textContent.trim().replace(/:$/, "").toLowerCase();
    if (keyMatchers.some((matcher) => key.includes(matcher))) {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") {
        return dd.textContent.trim();
      }
    }
  }
  return null;
}

function extractBrokers(doc, baseUrl) {
  const cards = doc.querySelectorAll("div.card.mix_person");
  const seenPersonIds = new Set();
  const formatted = [];
  let firstProfileUrl = null;

  for (const card of cards) {
    const vcardLink = card.querySelector('a[href*="GetVCard"]');
    const idMatch = vcardLink && vcardLink.getAttribute("href").match(VCARD_PERSON_ID_RE);
    const personId = idMatch ? idMatch[1] : null;

    // Both a desktop and mobile copy of the same card render on the page —
    // dedupe by the personId embedded in the VCard link so a listing with
    // one broker doesn't come out looking like it has two.
    if (personId) {
      if (seenPersonIds.has(personId)) continue;
      seenPersonIds.add(personId);
    }

    const nameLink = card.querySelector("h6.updatedCardPerson a");
    const name = nameLink ? nameLink.textContent.trim() : null;
    if (!name) continue;

    const locationSpans = Array.from(card.querySelectorAll("p.card-text span.updatedCardLocation")).map(
      (el) => el.textContent.trim()
    );
    // Resolved design decision: no separate broker_title/broker_office
    // columns in the Listings sheet — title/office/location fold into
    // broker_name instead.
    const detail = locationSpans.filter(Boolean).join("; ");
    formatted.push(detail ? `${name} (${detail})` : name);

    if (!firstProfileUrl) {
      const profileLink = card.querySelector('a[href*="/people/"]');
      firstProfileUrl = resolveHref(profileLink, baseUrl);
    }
  }

  return {
    broker_name: sourced(formatted.length ? formatted.join("; ") : null, formatted.length ? FIELD_SOURCE.HTML : FIELD_SOURCE.MISSING),
    // Resolved design decision: no VCard fetch — phone/email are not
    // present in the static HTML at all, so these stay MISSING rather
    // than making an extra request per listing.
    broker_phone: sourced(null, FIELD_SOURCE.MISSING),
    broker_email: sourced(null, FIELD_SOURCE.MISSING),
    broker_profile_url: firstProfileUrl,
  };
}

/**
 * @param {string} html raw detail-page HTML
 * @param {string} url the detail page's own URL (for resolving relative links)
 * @returns {object} everything sourced from the HTML — brochure/PDF fields
 *   are NOT populated here, that's the next pipeline stage
 */
export function parseDetailPage(html, url) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const h1 = doc.querySelector("h1");
  if (!h1) {
    throw new Error(
      `parseDetailPage: no <h1> found (selector "h1" matched nothing) on ${url} — ` +
        "the brief guarantees a title on every listing, so this means the site's markup changed, not that this listing lacks one."
    );
  }
  const title = h1.textContent.trim();

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (!ogImage) {
    throw new Error(
      `parseDetailPage: no <meta property="og:image"> found on ${url} — ` +
        "the brief guarantees this on every listing (it's the property_id source), so this means the site's markup changed."
    );
  }
  const ogImageContent = ogImage.getAttribute("content") || "";
  const idMatch = ogImageContent.match(PMEDIA_ID_RE);
  if (!idMatch) {
    throw new Error(
      `parseDetailPage: og:image content "${ogImageContent}" on ${url} doesn't contain "/pmedia/{id}/" — ` +
        "the property_id extraction pattern (PMEDIA_ID_RE) needs updating."
    );
  }
  const property_id = idMatch[1];

  // Carried over from the sibling project's confirmed markup on the same
  // site/template — NOT independently re-verified for this project (see
  // docs/SELECTORS.md). Lenient on purpose: unlike h1/og:image, the brief
  // doesn't explicitly guarantee this exact structure, so a miss here
  // warns instead of throwing.
  const addressEl = doc.querySelector("h5.updated-page-title-sub, .updated-page-title-sub");
  const address = addressEl ? addressEl.textContent.trim().replace(/\s+/g, " ") : "";
  if (!addressEl) {
    console.warn(`parseDetailPage: address selector matched nothing on ${url} — carried-over selector may need updating.`);
  }

  const transactionTagEl = doc.querySelector(".updated-page-title-tags");
  const transactionText = transactionTagEl ? transactionTagEl.textContent : "";
  const transaction_type = /sublease/i.test(transactionText) ? "Sublease" : "Lease";

  const brochure_urls = Array.from(new Set(
    Array.from(doc.querySelectorAll("a[href]"))
      .map((a) => resolveHref(a, url))
      .filter((href) => href && PDF_HREF_RE.test(href))
  ));
  // Per the brief: not every listing has a brochure (pre-construction /
  // "Future Build" often don't) — zero brochure_urls is a normal, expected
  // result, not an error. Caller sets extraction_status = "no_brochure".

  const availableSfText = findDtDdValue(doc, ["available space"]);
  const netRentText = findDtDdValue(doc, ["rental price", "net rent", "asking rate"]);
  const maxContiguousText = findDtDdValue(doc, ["max contiguous"]);
  const minDivisibleText = findDtDdValue(doc, ["min divisible"]);

  const brokers = extractBrokers(doc, url);

  return {
    property_id,
    title,
    address,
    transaction_type,
    listing_url: url,
    brochure_urls,

    available_sf: sourced(
      availableSfText ? parseSquareFootage(availableSfText) : null,
      availableSfText ? FIELD_SOURCE.HTML : FIELD_SOURCE.MISSING
    ),
    max_contiguous_sf: sourced(
      maxContiguousText ? parseSquareFootage(maxContiguousText) : null,
      maxContiguousText ? FIELD_SOURCE.HTML : FIELD_SOURCE.MISSING
    ),
    min_divisible_sf: sourced(
      minDivisibleText ? parseSquareFootage(minDivisibleText) : null,
      minDivisibleText ? FIELD_SOURCE.HTML : FIELD_SOURCE.MISSING
    ),
    // "Rental Price" is often non-numeric ("Contact us for pricing") — that
    // text is still useful context, so it's kept in `notes` rather than
    // silently dropped when it can't be parsed as a number.
    net_rent: sourced(
      netRentText ? parseCurrencyValue(netRentText) : null,
      netRentText ? FIELD_SOURCE.HTML : FIELD_SOURCE.MISSING
    ),

    broker_name: brokers.broker_name,
    broker_phone: brokers.broker_phone,
    broker_email: brokers.broker_email,
    broker_profile_url: brokers.broker_profile_url,

    notes: netRentText && parseCurrencyValue(netRentText) === null ? `Rental Price: ${netRentText}` : "",
  };
}
