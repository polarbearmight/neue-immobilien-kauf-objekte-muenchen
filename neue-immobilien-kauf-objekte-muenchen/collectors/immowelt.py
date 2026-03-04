from datetime import datetime
from bs4 import BeautifulSoup
from collectors.base import SafeCollector, AccessBlockedError

SEARCH_URL = "https://www.immowelt.de/suche/muenchen/wohnungen/kaufen"


def collect_immowelt_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://www.immowelt.de/robots.txt", "/suche/muenchen/wohnungen/kaufen")
    try:
        html = c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN immowelt blocked: {e}")
        return []

    soup = BeautifulSoup(html, "html.parser")
    rows = []
    seen = set()

    for a in soup.select("a[href*='/expose/'], a[href*='/immobilie/']")[:120]:
        href = a.get("href")
        if not href:
            continue
        url = href if href.startswith("http") else f"https://www.immowelt.de{href}"
        source_id = url.rstrip("/").split("/")[-1]
        if not source_id or source_id in seen:
            continue
        seen.add(source_id)

        title = a.get_text(" ", strip=True)[:300] or None
        parent = a.parent
        img = None
        desc = None
        if parent:
            img_tag = parent.find("img")
            if img_tag:
                img = img_tag.get("src") or img_tag.get("data-src")
                if img and img.startswith("/"):
                    img = f"https://www.immowelt.de{img}"
            desc = parent.get_text(" ", strip=True)[:500] or None

        rows.append(
            {
                "source": "immowelt",
                "source_listing_id": source_id,
                "url": url,
                "title": title,
                "description": desc,
                "image_url": img,
                "first_seen_at": datetime.utcnow(),
                "last_seen_at": datetime.utcnow(),
            }
        )

    print(f"INFO immowelt parser: rows={len(rows)}")
    return rows
