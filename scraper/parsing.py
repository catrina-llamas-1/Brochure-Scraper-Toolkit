"""
HTML parsing shared by check_filter_params.py, inspect_html.py,
scrape_list.py and scrape_detail.py.

Two layers, deliberately kept separate:
  - "Configured" extraction uses the CSS selectors in config.LIST_SELECTORS /
    config.DETAIL_SELECTORS. This is what you fill in after inspect_html.py.
  - A handful of generic, selector-free fallbacks (result-count regex,
    PDF-link discovery, repeated-container guessing) that work reasonably
    well without knowing the real markup, used by inspect_html.py and as a
    safety net elsewhere.
"""

from __future__ import annotations

import re
from collections import Counter
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from . import config


class NotConfiguredError(Exception):
    """Raised when a selector is still the "TODO" placeholder."""


def make_soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


# ---------------------------------------------------------------------------
# Generic (selector-free) helpers
# ---------------------------------------------------------------------------

_RESULT_COUNT_PATTERNS = [
    re.compile(r"of\s+([\d,]+)\s+results", re.I),
    re.compile(r"([\d,]+)\s+results\s+found", re.I),
    re.compile(r"([\d,]+)\s+results\b", re.I),
    re.compile(r"([\d,]+)\s+properties\b", re.I),
    re.compile(r"([\d,]+)\s+listings\b", re.I),
]


def parse_total_results(soup: BeautifulSoup) -> int | None:
    """Best-effort total-result-count detection.

    Tries the configured selector first, then falls back to scanning the
    page's visible text for a "N results" / "of N results" style phrase, so
    pagination doesn't rely on a hardcoded page count.
    """
    sel = config.LIST_SELECTORS.get("result_count_text")
    if sel and sel != "TODO":
        el = soup.select_one(sel)
        if el:
            m = re.search(r"\d[\d,]*", el.get_text())
            if m:
                return int(m.group().replace(",", ""))

    text = soup.get_text(" ", strip=True)
    for pattern in _RESULT_COUNT_PATTERNS:
        m = pattern.search(text)
        if m:
            return int(m.group(1).replace(",", ""))
    return None


def extract_pdf_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Any <a href> pointing at a PDF — no selector needed."""
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().split("?")[0].endswith(".pdf"):
            links.append(urljoin(base_url, href))
    # de-dup, keep order
    seen = set()
    out = []
    for link in links:
        if link not in seen:
            seen.add(link)
            out.append(link)
    return out


def guess_repeated_container_classes(
    soup: BeautifulSoup, low: int = 6, high: int = 30
) -> list[tuple[str, str, int]]:
    """Find (tag, class) combos that repeat a card-like number of times.

    Useful in inspect_html.py to spot the listing-card container without
    having pre-existing knowledge of the markup: on a search-results page
    with ~12 cards, whatever container each card shares will show up here
    with a count close to 12.
    """
    counter: Counter[tuple[str, str]] = Counter()
    for tag in soup.find_all(class_=True):
        classes = tag.get("class") or []
        if not classes:
            continue
        counter[(tag.name, " ".join(classes))] += 1
    candidates = [
        (tag, cls, n) for (tag, cls), n in counter.items() if low <= n <= high
    ]
    candidates.sort(key=lambda item: -item[2])
    return candidates[:25]


_DETAIL_LINK_RE = re.compile(r"/en/canada/properties/lease/[^\s\"'?#]+")


def guess_best_card_selector(
    candidates: list[tuple[str, str, int]], expected_count: int = 12, tolerance: int = 4
) -> str | None:
    """Pick the most plausible listing-card selector out of
    guess_repeated_container_classes() output: closest count to
    expected_count, excluding obvious nav/menu/footer clutter."""
    scored = []
    for tag, cls, n in candidates:
        cls_lower = cls.lower()
        if any(bad in cls_lower for bad in ("submenu", "nav", "menu", "header", "footer", "breadcrumb")):
            continue
        if abs(n - expected_count) <= tolerance:
            scored.append((abs(n - expected_count), tag, cls))
    if not scored:
        return None
    scored.sort(key=lambda item: item[0])
    _, tag, cls = scored[0]
    class_selector = "." + ".".join(cls.split())
    return f"{tag}{class_selector}"


def all_hrefs_within(soup: BeautifulSoup, selector: str, base_url: str, limit_elements: int = 3) -> list[str]:
    """All <a href> (including the element itself, if it's an <a>) found
    within/at the first `limit_elements` matches of `selector` — no URL
    pattern assumed, since the real detail-link pattern is unknown."""
    hrefs = []
    seen = set()
    for el in soup.select(selector)[:limit_elements]:
        candidates = [el] if el.name == "a" and el.get("href") else []
        candidates += el.find_all("a", href=True)
        for a in candidates:
            href = a.get("href")
            if not href:
                continue
            full = urljoin(base_url, href)
            if full not in seen:
                seen.add(full)
                hrefs.append(full)
    return hrefs


_BOILERPLATE_TAGS = ("header", "nav", "footer", "script", "style", "noscript")


def strip_boilerplate(soup: BeautifulSoup) -> BeautifulSoup:
    """A copy of `soup` with header/nav/footer/script/style removed, so
    dumps of "the rest of the page" aren't dominated by the same repeated
    site chrome on every page."""
    clone = BeautifulSoup(str(soup), "lxml")
    for tag_name in _BOILERPLATE_TAGS:
        for el in clone.find_all(tag_name):
            el.decompose()
    return clone


def find_elements_with_keywords(
    soup: BeautifulSoup, keywords: list[str], max_text_len: int = 400, limit: int = 8
) -> list:
    """Smallest elements whose own text (not descendants') contains any of
    `keywords` (case-insensitive) and isn't huge — useful for locating a
    field (e.g. "square footage", "broker") by content when its class names
    are unknown and its position on the page is unpredictable."""
    keywords_lower = [k.lower() for k in keywords]
    matches = []
    for el in soup.find_all(True):
        text = el.get_text(" ", strip=True)
        if not text or len(text) > max_text_len:
            continue
        text_lower = text.lower()
        if any(k in text_lower for k in keywords_lower):
            matches.append(el)
        if len(matches) >= limit * 3:
            break
    # Prefer the innermost matching elements (skip ones whose child already matched).
    filtered = []
    for el in matches:
        if any(child in matches for child in el.find_all(True)):
            continue
        filtered.append(el)
    return filtered[:limit]


def guess_detail_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Any <a href> that looks like a specific listing detail page (i.e.
    under the lease properties path but not the bare /search page)."""
    out = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if _DETAIL_LINK_RE.search(href) and "/search" not in href.split("?")[0]:
            full = urljoin(base_url, href)
            if full not in seen:
                seen.add(full)
                out.append(full)
    return out


def _text(el, selector: str) -> str:
    if not selector or selector == "TODO":
        return ""
    found = el.select_one(selector)
    return found.get_text(" ", strip=True) if found else ""


def _href(el, selector: str, base_url: str) -> str:
    if not selector or selector == "TODO":
        return ""
    found = el.select_one(selector)
    if not found:
        return ""
    href = found.get("href", "")
    return urljoin(base_url, href) if href else ""


# Site-specific cleanup for cushmanwakefield.com's card markup, confirmed
# against live HTML (see inspect_html.py output):
#   __address: "123 Main St<br>Edmonton, Alberta<br>Canada" -> street/city/prov
#   __meta:    "For Lease • Retail" -> property type is the part after "•"
#   __price:   "Rental Price: Contact us for pricing" -> strip the label
_META_TYPE_RE = re.compile(r"[•·]\s*(.+)$")
_PRICE_PREFIX_RE = re.compile(r"^\s*rental\s*price\s*:\s*", re.I)


def split_address_block(el) -> tuple[str, str, str]:
    """(street_address, city, province) from a <br/>-separated address
    block. Assumes line 0 = street, line 1 = "City, Province", further
    lines (e.g. "Canada") ignored."""
    if el is None:
        return "", "", ""
    lines = [s.strip() for s in el.stripped_strings if s.strip()]
    street = lines[0] if lines else ""
    city, province = "", ""
    if len(lines) > 1:
        parts = [p.strip() for p in lines[1].split(",")]
        city = parts[0] if parts else ""
        province = parts[1] if len(parts) > 1 else ""
    return street, city, province


def clean_property_type(text: str) -> str:
    m = _META_TYPE_RE.search(text)
    return m.group(1).strip() if m else text.strip()


def clean_price(text: str) -> str:
    return _PRICE_PREFIX_RE.sub("", text).strip()


# ---------------------------------------------------------------------------
# Configured extraction — requires config.py selectors to be filled in.
# ---------------------------------------------------------------------------


def parse_listing_cards(soup: BeautifulSoup, page_url: str) -> list[dict]:
    sel = config.LIST_SELECTORS
    if sel["card"] == "TODO":
        raise NotConfiguredError(
            "config.LIST_SELECTORS['card'] is still a TODO placeholder. "
            "Run `python -m scraper.inspect_html` against a live search page "
            "and fill in scraper/config.py before scraping."
        )

    cards = soup.select(sel["card"])
    rows = []
    for card in cards:
        detail_link_sel = sel.get("detail_link", "TODO")
        if detail_link_sel.strip().lower() == "self":
            href = card.get("href", "")
            detail_url = urljoin(page_url, href) if href else ""
        else:
            detail_url = _href(card, detail_link_sel, page_url)

        address_sel = sel.get("address_block", "TODO")
        address_el = card.select_one(address_sel) if address_sel and address_sel != "TODO" else None
        street, city, province = split_address_block(address_el)

        rows.append(
            {
                "title": _text(card, sel["title"]),
                "street_address": street,
                "city": city,
                "province": province,
                "property_type": clean_property_type(_text(card, sel["property_type"])),
                "price": clean_price(_text(card, sel["price"])),
                "detail_url": detail_url,
            }
        )
    return rows


def parse_detail_page(soup: BeautifulSoup, page_url: str) -> dict:
    sel = config.DETAIL_SELECTORS
    if sel["square_footage"] == "TODO":
        raise NotConfiguredError(
            "config.DETAIL_SELECTORS are still TODO placeholders. "
            "Run `python -m scraper.inspect_html` against a live listing "
            "detail page and fill in scraper/config.py before scraping."
        )

    result = {
        "square_footage": _text(soup, sel["square_footage"]),
        "description": _text(soup, sel["description"]),
        "broker_name": _text(soup, sel["broker_name"]),
        "broker_contact": _text(soup, sel["broker_contact"]),
    }

    breakdown_sel = sel.get("unit_breakdown_table", "TODO")
    breakdown_rows: list[dict] = []
    if breakdown_sel and breakdown_sel != "TODO":
        table = soup.select_one(breakdown_sel)
        if table:
            headers = [th.get_text(" ", strip=True) for th in table.select("th")]
            for tr in table.select("tr"):
                cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
                if not cells:
                    continue
                if headers and len(headers) == len(cells):
                    breakdown_rows.append(dict(zip(headers, cells)))
                else:
                    breakdown_rows.append({"cells": cells})
    result["unit_breakdown"] = breakdown_rows

    result["brochure_links"] = extract_pdf_links(soup, page_url)
    return result
