from __future__ import annotations

from collectors.base import SafeCollector, AccessBlockedError

SEARCH_URL = "https://www.immobilienscout24.de/Suche/de/bayern/muenchen/provisionsfreie-wohnung-kaufen"


def collect_immoscout_private_filtered_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://www.immobilienscout24.de/robots.txt", "/Suche/de/bayern/muenchen/provisionsfreie-wohnung-kaufen")
    try:
        html = c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN immoscout_private_filtered blocked: {e}")
        return []

    if "Ich bin kein Roboter" in html or "captcha" in html.lower():
        print("WARN immoscout_private_filtered anti-bot challenge")
        return []

    # live parsing is intentionally conservative here because IS24 currently challenges headless/server access.
    return []
