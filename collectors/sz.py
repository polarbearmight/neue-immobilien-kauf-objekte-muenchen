from bs4 import BeautifulSoup
from datetime import datetime
from collectors.base import SafeCollector

SEARCH_URL = "https://immobilienmarkt.sueddeutsche.de/suche/kaufen-wohnung-in-muenchen"


def collect_sz_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://immobilienmarkt.sueddeutsche.de/robots.txt", "/suche/kaufen-wohnung-in-muenchen")
    html = c.get(SEARCH_URL)
    soup = BeautifulSoup(html, "html.parser")

    rows = []
    # MVP parser: resilient fallback, selectors may need tuning over time
    for a in soup.select("a[href*='expose'], a[href*='immobilie']")[:100]:
        url = a.get("href", "")
        if not url:
            continue
        if url.startswith("/"):
            url = f"https://immobilienmarkt.sueddeutsche.de{url}"
        title = a.get_text(" ", strip=True)[:300] or None
        source_id = url.rstrip("/").split("/")[-1]
        rows.append(
            {
                "source": "sz",
                "source_listing_id": source_id,
                "url": url,
                "title": title,
                "first_seen_at": datetime.utcnow(),
                "last_seen_at": datetime.utcnow(),
            }
        )
    return rows
