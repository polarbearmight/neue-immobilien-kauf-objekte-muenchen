import os
import random
import time
import httpx
import urllib.robotparser
from app.config import settings


class AccessBlockedError(RuntimeError):
    pass


class SafeCollector:
    def __init__(self):
        # Conservative, browser-like base headers (no bypass/captcha tricks)
        self.client = httpx.Client(
            headers={
                "User-Agent": settings.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "de-DE,de;q=0.9,en;q=0.7",
                "DNT": "1",
                "Connection": "keep-alive",
            },
            timeout=30,
            follow_redirects=True,
        )

    def assert_allowed(self, robots_url: str, path: str):
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        if not rp.can_fetch(settings.user_agent, path) and not rp.can_fetch("*", path):
            raise RuntimeError(f"Blocked by robots.txt for path={path}")

    def get(self, url: str):
        base_delay = float(getattr(settings, "request_delay_seconds", 0.0) or 0.0)
        max_attempts = int(os.getenv("COLLECTOR_RETRY_ATTEMPTS", "3"))

        last_err = None
        for attempt in range(1, max_attempts + 1):
            # soft pacing + tiny jitter
            time.sleep(base_delay + random.uniform(0.0, 0.12))
            try:
                r = self.client.get(url)
                if r.status_code in (401, 403, 429):
                    # treat as blocked/rate-limited and allow caller to handle
                    raise AccessBlockedError(f"Access blocked for {url} (status={r.status_code})")
                if r.status_code >= 500:
                    raise httpx.HTTPStatusError(f"server error status={r.status_code}", request=r.request, response=r)
                r.raise_for_status()
                return r.text
            except AccessBlockedError:
                raise
            except Exception as e:
                last_err = e
                if attempt >= max_attempts:
                    break
                backoff = min(2.0, 0.35 * (2 ** (attempt - 1))) + random.uniform(0.0, 0.2)
                time.sleep(backoff)

        if last_err:
            raise last_err
        raise RuntimeError(f"GET failed for {url}")
