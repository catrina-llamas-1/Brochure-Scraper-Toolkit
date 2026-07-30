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
        detail_url = _href(card, sel["detail_link"], page_url)
        rows.append(
            {
                "title": _text(card, sel["title"]),
                "street_address": _text(card, sel["street_address"]),
                "city": _text(card, sel["city"]),
                "province": _text(card, sel["province"]),
                "property_type": _text(card, sel["property_type"]),
                "price": _text(card, sel["price"]),
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
