/**
 * One-off diagnostic script — NOT part of the shipped extension.
 * Paste into Chrome DevTools Console while viewing a real listing DETAIL
 * page (not the search results page). Chrome may ask you to type
 * "allow pasting" first the first time you paste into console — that's
 * expected, it's Chrome's anti-self-XSS protection, not a warning about
 * this script.
 *
 * JS-console counterpart to inspect_detail_page.py — same sections, same
 * purpose (confirm real selectors for src/detail/parseDetailPage.js before
 * writing it), but runs against the already-rendered live DOM instead of a
 * fetched copy, so no network/hosting question at all.
 */
(function () {
  const PMEDIA_ID_RE = /\/pmedia\/(\d+)\//;
  const BROCHURE_RE = /assets\.cushmanwakefield\.com\/-\/pmedia\/\d+\/0\/[^"'?]+\.pdf/i;

  function section(title) {
    console.log(
      "%c" + "=".repeat(70) + "\n" + title + "\n" + "=".repeat(70),
      "color:#1a5fb4;font-weight:bold"
    );
  }

  function classOf(el) {
    return (el.getAttribute("class") || "").trim();
  }

  function selectorHint(el) {
    if (!el) return "(none)";
    let s = el.tagName.toLowerCase();
    const cls = classOf(el);
    if (cls) s += "." + cls.split(/\s+/).join(".");
    if (el.id) s += "#" + el.id;
    return s;
  }

  function stripBoilerplate() {
    const clone = document.body.cloneNode(true);
    ["header", "nav", "footer", "script", "style", "noscript"].forEach((tag) => {
      clone.querySelectorAll(tag).forEach((el) => el.remove());
    });
    return clone;
  }

  function findElementsWithKeywords(root, keywords, maxTextLen, limit) {
    const kws = keywords.map((k) => k.toLowerCase());
    const all = Array.from(root.querySelectorAll("*"));
    const matches = [];
    for (const el of all) {
      const text = el.textContent.trim().replace(/\s+/g, " ");
      if (!text || text.length > maxTextLen) continue;
      if (kws.some((k) => text.toLowerCase().includes(k))) matches.push(el);
      if (matches.length >= limit * 3) break;
    }
    return matches
      .filter((el) => !Array.from(el.querySelectorAll("*")).some((child) => matches.includes(child)))
      .slice(0, limit);
  }

  function extractDtDdPairs(root) {
    const pairs = {};
    root.querySelectorAll("dt").forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === "DD") {
        const key = dt.textContent.trim().replace(/:$/, "");
        if (key) pairs[key] = dd.textContent.trim();
      }
    });
    return pairs;
  }

  section("PAGE TITLE / <h1>");
  console.log("document.title:", document.title);
  const h1 = document.querySelector("h1");
  console.log("<h1> text:", h1 ? h1.textContent.trim() : "(none found)");
  console.log("selector hint:", selectorHint(h1));

  section("og:image meta -> property_id");
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute("content");
    console.log("content:", content);
    const m = content && content.match(PMEDIA_ID_RE);
    console.log("extracted property_id:", m ? m[1] : "(regex did not match — check PMEDIA_ID_RE)");
  } else {
    console.log("(no og:image meta tag found)");
  }

  section("Brochure link candidates");
  const pdfLinks = [
    ...new Set(
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => a.href)
        .filter((href) => BROCHURE_RE.test(href) || href.toLowerCase().split("?")[0].endsWith(".pdf"))
    ),
  ];
  if (pdfLinks.length) pdfLinks.forEach((l) => console.log(" ", l));
  else console.log("(none found — may be expected if this listing has no brochure)");

  const clean = stripBoilerplate();

  section("All <dt>/<dd> pairs");
  const pairs = extractDtDdPairs(document.body);
  if (Object.keys(pairs).length) console.table(pairs);
  else console.log("(none found)");

  const fieldGroups = {
    "Available Space": ["available space"],
    "Rental Price": ["rental price", "net rent", "asking rate"],
    "Max Contiguous": ["max contiguous", "maximum contiguous"],
    "Min Divisible": ["min divisible", "minimum divisible"],
  };
  for (const [label, keywords] of Object.entries(fieldGroups)) {
    section(`Candidates for '${label}' (keywords: ${keywords.join(", ")})`);
    const matches = findElementsWithKeywords(clean, keywords, 200, 4);
    if (matches.length) {
      matches.forEach((el) => {
        console.log(selectorHint(el) + ":", el.textContent.trim());
        console.log(el); // expandable live element reference
      });
    } else {
      console.log("(none found by keyword — check the dt/dd table above instead)");
    }
  }

  section("Broker / listing agent candidates");
  const brokerMatches = findElementsWithKeywords(
    clean,
    ["broker", "listing agent", "leasing agent", "listed by"],
    400,
    6
  );
  if (brokerMatches.length) {
    brokerMatches.forEach((el) => {
      console.log(selectorHint(el) + ":", el.textContent.trim());
      console.log(el);
    });
  } else {
    console.log("(none found)");
  }

  section("Links that look like broker/people profile pages");
  const profileLinks = [
    ...new Set(
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => a.href)
        .filter((href) => /\/(people|broker|agent|team)\//i.test(href))
    ),
  ];
  if (profileLinks.length) profileLinks.forEach((l) => console.log(" ", l));
  else console.log("(none found by URL pattern — broker name may link elsewhere, or not link at all)");

  section("Repeated (tag, class) combos — in case fields are card-based, not dt/dd");
  const counter = new Map();
  clean.querySelectorAll("[class]").forEach((el) => {
    const cls = classOf(el);
    if (!cls) return;
    const key = el.tagName.toLowerCase() + "." + cls.split(/\s+/).join(".");
    counter.set(key, (counter.get(key) || 0) + 1);
  });
  const sorted = [...counter.entries()]
    .filter(([, n]) => n >= 2 && n <= 20)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  console.table(Object.fromEntries(sorted));

  section("Done — expand any logged element above to inspect it live in the Elements panel");
})();
