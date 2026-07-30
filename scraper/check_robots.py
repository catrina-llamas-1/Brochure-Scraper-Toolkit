"""
Check robots.txt for cushmanwakefield.com and report anything relevant
before scraping at scale.

Usage:
    python -m scraper.check_robots
"""

from __future__ import annotations

import logging
import urllib.robotparser

from . import config, http_client
from .logging_setup import setup_logging

logger = logging.getLogger("cushman_scraper.robots")


def main() -> None:
    setup_logging()

    robots_url = config.BASE_URL + "/robots.txt"
    text = http_client.fetch(robots_url, config.MISC_CACHE_DIR)

    print("=" * 70)
    print(f"robots.txt from {robots_url}")
    print("=" * 70)
    print(text)
    print("=" * 70)

    rp = urllib.robotparser.RobotFileParser()
    rp.parse(text.splitlines())

    paths_to_check = [
        config.SEARCH_PATH,
        config.SEARCH_PATH + "?page=2&sort=relevance",
        "/en/canada/properties/lease/some-sample-listing-slug",
    ]

    for ua in (config.USER_AGENT, "*"):
        print(f"\nRules for User-Agent: {ua!r}")
        for path in paths_to_check:
            allowed = rp.can_fetch(ua, config.BASE_URL + path)
            print(f"  can_fetch({path!r}) = {allowed}")

    crawl_delay = rp.crawl_delay(config.USER_AGENT) or rp.crawl_delay("*")
    if crawl_delay:
        print(f"\nCrawl-delay directive found: {crawl_delay}s")
        if crawl_delay > config.MAX_DELAY_SECONDS:
            print(
                f"  NOTE: this exceeds config.MAX_DELAY_SECONDS "
                f"({config.MAX_DELAY_SECONDS}s) — bump MIN/MAX_DELAY_SECONDS "
                f"in config.py to respect it before scraping at scale."
            )
    else:
        print("\nNo Crawl-delay directive found.")

    try:
        site_maps = list(rp.site_maps() or [])
    except Exception:
        site_maps = []
    if site_maps:
        print(f"\nSitemaps declared: {site_maps}")

    print(
        "\nReminder: this only checks robots.txt rules. Also skim the raw "
        "text above for anything unusual (e.g. a Disallow covering the "
        "whole /en/canada/properties/ tree, or bot-specific blocks)."
    )


if __name__ == "__main__":
    main()
