"""
Cached, rate-limited, retrying HTTP fetcher shared by every scraper stage.

- Every successful response is cached to disk under a cache_dir, keyed by a
  sanitized version of the URL. Re-running any stage never re-downloads a
  page that's already on disk (pass `force_refresh=True` to override).
- A 1-2s randomized delay is applied before every *network* request (cache
  hits are instant).
- Failed requests (timeouts, connection errors, 429/5xx) are retried with
  exponential backoff.
"""

from __future__ import annotations

import hashlib
import logging
import random
import time
from pathlib import Path

import requests

from . import config

logger = logging.getLogger("cushman_scraper.http")

_session: requests.Session | None = None


class FetchError(Exception):
    pass


def _get_session() -> requests.Session:
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update(
            {
                "User-Agent": config.USER_AGENT,
                "Accept-Language": "en-CA,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        )
    return _session


def _cache_path(cache_dir: Path, url: str) -> Path:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
    tail = url.split("://", 1)[-1]
    safe = "".join(c if c.isalnum() else "_" for c in tail)[:100]
    return cache_dir / f"{safe}__{digest}.html"


def fetch(url: str, cache_dir: Path, *, force_refresh: bool = False) -> str:
    """Fetch `url` as text, using an on-disk cache under `cache_dir`."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = _cache_path(cache_dir, url)

    if path.exists() and not force_refresh:
        logger.debug("cache hit: %s -> %s", url, path.name)
        return path.read_text(encoding="utf-8")

    session = _get_session()
    delay = random.uniform(config.MIN_DELAY_SECONDS, config.MAX_DELAY_SECONDS)
    time.sleep(delay)

    last_exc: Exception | None = None
    for attempt in range(1, config.MAX_ATTEMPTS + 1):
        try:
            resp = session.get(url, timeout=config.REQUEST_TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            logger.warning(
                "request error fetching %s (attempt %d/%d): %s",
                url, attempt, config.MAX_ATTEMPTS, exc,
            )
            last_exc = exc
        else:
            if resp.status_code == 200:
                path.write_text(resp.text, encoding="utf-8")
                logger.debug("fetched %s (%d bytes)", url, len(resp.text))
                return resp.text
            logger.warning(
                "HTTP %s fetching %s (attempt %d/%d)",
                resp.status_code, url, attempt, config.MAX_ATTEMPTS,
            )
            last_exc = FetchError(f"HTTP {resp.status_code} for {url}")
            if resp.status_code in (401, 403, 404):
                # Not going to fix itself on retry.
                break

        if attempt < config.MAX_ATTEMPTS:
            backoff = config.BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
            logger.info("retrying %s in %.1fs", url, backoff)
            time.sleep(backoff)

    raise FetchError(f"Failed to fetch {url} after {config.MAX_ATTEMPTS} attempts") from last_exc
