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
        time.sleep(settings.request_delay_seconds)
        r = self.client.get(url)
        if r.status_code in (401, 403, 429):
            raise AccessBlockedError(f"Access blocked for {url} (status={r.status_code})")
        r.raise_for_status()
        return r.text
