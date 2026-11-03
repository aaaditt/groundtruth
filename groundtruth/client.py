"""client.py -- one polite HTTP client for every public data service we use.

Rules (docs/12-master-plan.md):
  * identify ourselves with a generic User-Agent that points at the project
    (no personal e-mail address);
  * at most one request per second, per process;
  * retry gently on overload (HTTP 429 / 5xx) with growing pauses;
  * NEVER switch off certificate verification. Python ships its own list of trusted
    certificates (certifi), which can go stale; `truststore` makes Python use the
    operating system's list instead, which is what browsers and curl use.
"""
import time

import requests
import truststore

truststore.inject_into_ssl()   # use the OS certificate store (verification stays ON)

USER_AGENT = "groundtruth/1.0 (+https://github.com/aaaditt/groundtruth)"
MIN_INTERVAL = 1.0             # seconds between requests
_session = requests.Session()
_session.headers["User-Agent"] = USER_AGENT
_last = 0.0


def get(url, params=None, timeout=120, retries=4):
    """GET with rate limiting and retries. Returns the requests.Response.
    Status 204 / 404 (= "no data") are returned to the caller, not raised."""
    global _last
    for attempt in range(retries + 1):
        wait = MIN_INTERVAL - (time.monotonic() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.monotonic()
        try:
            r = _session.get(url, params=params, timeout=timeout)
        except (requests.ConnectionError, requests.Timeout):
            if attempt == retries:
                raise
            time.sleep(5 * 2 ** attempt)
            continue
        if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            time.sleep(int(r.headers.get("Retry-After", 5 * 2 ** attempt)))
            continue
        if r.status_code not in (200, 204, 404):
            r.raise_for_status()
        return r
