"""
Immobilienscout24 collector skeleton.

Important: run only in compliance with robots.txt and portal ToS.
No anti-bot bypassing, no captcha evasion.
"""

from collectors.base import SafeCollector, AccessBlockedError

SEARCH_URL = "https://www.immobilienscout24.de/Suche/de/bayern/muenchen/wohnung-kaufen"


def collect_is24_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://www.immobilienscout24.de/robots.txt", "/Suche/de/bayern/muenchen/wohnung-kaufen")

    # Placeholder for compliant parser implementation.
    # Keep conservative request cadence and parser-health monitoring.
    try:
        _ = c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN is24 blocked: {e}")
        return []
    return []
