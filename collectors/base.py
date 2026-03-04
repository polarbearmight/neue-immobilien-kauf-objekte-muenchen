import time
import httpx
import urllib.robotparser
from app.config import settings


class SafeCollector:
    def __init__(self):
        self.client = httpx.Client(headers={"User-Agent": settings.user_agent}, timeout=30)

    def assert_allowed(self, robots_url: str, path: str):
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        if not rp.can_fetch(settings.user_agent, path) and not rp.can_fetch("*", path):
            raise RuntimeError(f"Blocked by robots.txt for path={path}")

    def get(self, url: str):
        time.sleep(settings.request_delay_seconds)
        r = self.client.get(url)
        r.raise_for_status()
        return r.text
