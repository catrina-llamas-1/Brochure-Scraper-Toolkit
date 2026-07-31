/**
 * Follow-up diagnostic — NOT part of the shipped extension.
 * Paste into DevTools Console on the SAME listing detail page you just ran
 * inspect_detail_page.console.js on.
 *
 * Purpose: the first pass found a broker profile link
 * (/en/canada/people/{slug}) but no nearby text matched broker/agent
 * keywords — likely because the real container's text is longer than that
 * script's 400-char cap, or uses different wording. This walks up from
 * every matching profile link and prints the actual outerHTML of a few
 * ancestor levels as plain text (console.table/live-element refs don't
 * copy-paste cleanly — this does).
 *
 * Also re-dumps <dt>/<dd> pairs as plain text for the same copy-paste
 * reason.
 */
(function () {
  function section(title) {
    console.log(
      "%c" + "=".repeat(70) + "\n" + title + "\n" + "=".repeat(70),
      "color:#1a5fb4;font-weight:bold"
    );
  }

  section("All <dt>/<dd> pairs (plain text)");
  document.querySelectorAll("dt").forEach((dt) => {
    const dd = dt.nextElementSibling;
    if (dd && dd.tagName === "DD") {
      const key = dt.textContent.trim().replace(/:$/, "");
      if (key) console.log(`${key}: ${dd.textContent.trim()}`);
    }
  });

  section("Ancestor HTML around every /people/ profile link");
  const profileLinks = document.querySelectorAll('a[href*="/people/"]');
  if (!profileLinks.length) {
    console.log("(no /people/ links found on this page)");
  }
  profileLinks.forEach((link, i) => {
    console.log(`\n--- profile link #${i}: ${link.href} ---`);
    console.log("link's own text:", JSON.stringify(link.textContent.trim()));

    let el = link;
    for (let level = 1; level <= 4; level++) {
      el = el.parentElement;
      if (!el) break;
      const html = el.outerHTML;
      console.log(`\n[ancestor level ${level}, tag=${el.tagName.toLowerCase()}, class="${el.getAttribute("class") || ""}", ${html.length} chars]`);
      console.log(html.length > 2500 ? html.slice(0, 2500) + "\n...(truncated)" : html);
      // Stop early once we hit a reasonably-sized, clearly-bounded card container.
      if (html.length > 300 && html.length < 2500) break;
    }
  });

  section("Done");
})();
