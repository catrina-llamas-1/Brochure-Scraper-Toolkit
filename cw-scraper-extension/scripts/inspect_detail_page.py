"""
One-off diagnostic script — NOT part of the shipped extension. Run this
from a machine with real internet access to confirm the selectors
src/detail/parseDetailPage.js needs, before writing any of its logic.

This is Python + BeautifulSoup rather than JS on purpose: it's a throwaway
inspection tool, and the sibling Python-scraper project in this repo
(../../scraper/) already proved this exact fetch-and-inspect approach works
against this site from this kind of environment (e.g. Google Colab). It
does NOT import from that project — kept standalone since these are two
separate deliverables that happen to share a repo.

Usage:
    pip install requests beautifulsoup4 lxml
    python inspect_detail_page.py
    python inspect_detail_page.py --url "https://www.cushmanwakefield.com/en/canada/properties/for-lease/..."

Default URL is a real office listing already confirmed live in the sibling
project's own inspection run — override with --url for a different one
(ideally pick one that has both a broker and a brochure, since some listings
are missing one or the other and you want a "full" example first).
"""

from __future__ import annotations

import argparse
import re
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

DEFAULT_URL = (
    "https://www.cushmanwakefield.com/en/canada/properties/for-lease/office/ab/"
    "edmonton/6766-75-street-nw/6766-75-street-edmonton-office-space-for-sublease-l"
)

USER_AGENT = (
    "CushmanWakefieldExtensionResearchBot/1.0 "
    "(+contact: catrina.llamas01@gmail.com; non-commercial research)"
)

PMEDIA_ID_RE = re.compile(r"/pmedia/(\d+)/")
BROCHURE_RE = re.compile(r"assets\.cushmanwakefield\.com/-/pmedia/\d+/0/[^\"'?]+\.pdf", re.I)


def fetch(url: str) -> str:
    last_exc = None
    for attempt in range(1, 4):
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
            if resp.status_code == 200:
                return resp.text
            print(f"HTTP {resp.status_code} (attempt {attempt}/3)")
            last_exc = RuntimeError(f"HTTP {resp.status_code}")
        except requests.RequestException as exc:
            print(f"request error (attempt {attempt}/3): {exc}")
            last_exc = exc
        time.sleep(2 * attempt)
    raise last_exc


def _print_section(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def strip_boilerplate(soup: BeautifulSoup) -> BeautifulSoup:
    clone = BeautifulSoup(str(soup), "lxml")
    for tag_name in ("header", "nav", "footer", "script", "style", "noscript"):
        for el in clone.find_all(tag_name):
            el.decompose()
    return clone


def find_elements_with_keywords(soup, keywords, max_text_len=300, limit=8):
    keywords_lower = [k.lower() for k in keywords]
    matches = []
    for el in soup.find_all(True):
        text = el.get_text(" ", strip=True)
        if not text or len(text) > max_text_len:
            continue
        if any(k in text.lower() for k in keywords_lower):
            matches.append(el)
        if len(matches) >= limit * 3:
            break
    filtered = [el for el in matches if not any(child in matches for child in el.find_all(True))]
    return filtered[:limit]


def extract_dt_dd_pairs(soup) -> dict:
    pairs = {}
    for dt in soup.find_all("dt"):
        dd = dt.find_next_sibling("dd")
        if dd is None:
            continue
        key = dt.get_text(" ", strip=True).rstrip(":").strip()
        if key:
            pairs[key] = dd.get_text(" ", strip=True)
    return pairs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL)
    args = parser.parse_args()

    print(f"Fetching: {args.url}")
    html = fetch(args.url)
    soup = BeautifulSoup(html, "lxml")

    _print_section("PAGE <title> and <h1>")
    print(f"<title>: {soup.title.get_text(strip=True) if soup.title else '(none)'}")
    h1 = soup.find("h1")
    print(f"<h1>: {h1.get_text(' ', strip=True) if h1 else '(none found)'}")
    if h1:
        print(f"  selector hint: {h1.name}" + (f".{'.'.join(h1.get('class'))}" if h1.get("class") else "") + (f"#{h1.get('id')}" if h1.get("id") else ""))

    _print_section("og:image meta tag -> property_id")
    og_image = soup.find("meta", property="og:image")
    if og_image:
        content = og_image.get("content", "")
        print(f"content: {content}")
        m = PMEDIA_ID_RE.search(content)
        print(f"extracted property_id: {m.group(1) if m else '(regex did not match — check PMEDIA_ID_RE)'}")
    else:
        print("(no og:image meta tag found — check property/name attribute spelling)")

    _print_section("Brochure link candidates (assets.cushmanwakefield.com/.../pmedia/{id}/0/*.pdf)")
    pdf_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if BROCHURE_RE.search(href) or href.lower().split("?")[0].endswith(".pdf"):
            pdf_links.append(urljoin(args.url, href))
    if pdf_links:
        for link in dict.fromkeys(pdf_links):
            print(f"  {link}")
    else:
        print("  (none found — this listing may not have a brochure, expected/handled case per the brief)")

    clean = strip_boilerplate(soup)

    _print_section("All <dt>/<dd> pairs (sibling project found CW uses these instead of <table>)")
    pairs = extract_dt_dd_pairs(soup)
    if pairs:
        for k, v in pairs.items():
            print(f"  {k!r}: {v!r}")
    else:
        print("  (none found)")

    field_groups = {
        "Available Space": ["available space"],
        "Rental Price": ["rental price", "net rent", "asking rate"],
        "Max Contiguous": ["max contiguous", "maximum contiguous"],
        "Min Divisible": ["min divisible", "minimum divisible"],
    }
    for label, keywords in field_groups.items():
        matches = find_elements_with_keywords(clean, keywords, max_text_len=200, limit=4)
        _print_section(f"Candidates for '{label}' (keywords: {keywords})")
        if matches:
            for el in matches:
                cls_attr = " ".join(el.get("class") or [])
                print(f"\n  <{el.name} class=\"{cls_attr}\" id=\"{el.get('id', '')}\">")
                print("  " + el.prettify()[:600].replace("\n", "\n  "))
        else:
            print("  (none found by keyword — may be covered by the dt/dd dump above instead)")

    _print_section("Broker / listing agent candidates")
    broker_matches = find_elements_with_keywords(
        clean, ["broker", "listing agent", "leasing agent", "listed by"], max_text_len=400, limit=6
    )
    if broker_matches:
        for el in broker_matches:
            cls_attr = " ".join(el.get("class") or [])
            print(f"\n  <{el.name} class=\"{cls_attr}\">")
            print("  " + el.prettify()[:1200].replace("\n", "\n  "))
    else:
        print("  (none found)")

    _print_section("Links that look like broker/people profile pages")
    profile_links = [
        urljoin(args.url, a["href"])
        for a in soup.find_all("a", href=True)
        if re.search(r"/(people|broker|agent|team)/", a["href"], re.I)
    ]
    if profile_links:
        for link in dict.fromkeys(profile_links):
            print(f"  {link}")
    else:
        print("  (none found by URL pattern — broker name may link elsewhere, or not link at all)")

    _print_section("Repeated (tag, class) combos (header/nav/footer stripped) — in case fields are card-based, not dt/dd")
    from collections import Counter
    counter = Counter()
    for tag in clean.find_all(class_=True):
        classes = tag.get("class") or []
        if classes:
            counter[(tag.name, " ".join(classes))] += 1
    for (tag, cls), n in sorted(counter.items(), key=lambda kv: -kv[1])[:20]:
        if 2 <= n <= 20:
            print(f"  count={n:<4} <{tag} class=\"{cls}\">")

    _print_section("First 8000 chars of boilerplate-stripped <body> (prettified) — skim for anything missed above")
    body = clean.body
    print(body.prettify()[:8000] if body else "(no <body>)")


if __name__ == "__main__":
    main()
