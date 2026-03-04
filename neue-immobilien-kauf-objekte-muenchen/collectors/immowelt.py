import re
from datetime import datetime
from bs4 import BeautifulSoup
from collectors.base import SafeCollector, AccessBlockedError

SEARCH_URL = "https://www.immowelt.de/suche/muenchen/wohnungen/kaufen"

_price_re = re.compile(r"([\d\.,]{3,})\s*€")
_area_re = re.compile(r"([\d\.,]{1,6})\s*m²")
_rooms_re = re.compile(r"(\d+[\.,]?\d*)\s*Zimmer")


def _to_num(val: str | None) -> float | None:
    if not val:
        return None
    try:
        return float(val.replace(".", "").replace(",", "."))
    except Exception:
        return None


def _extract_numbers(text: str):
    price = _to_num(_price_re.search(text).group(1) if _price_re.search(text) else None)
    area = _to_num(_area_re.search(text).group(1) if _area_re.search(text) else None)
    rooms = _to_num(_rooms_re.search(text).group(1) if _rooms_re.search(text) else None)
    ppsqm = round(price / area, 2) if price and area else None
    return price, area, rooms, ppsqm


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

    # Use stable testid selector when available
    anchors = soup.select("a[data-testid='card-mfe-covering-link-testid'][href*='/expose/']")
    if not anchors:
        anchors = soup.select("a[href*='/expose/'], a[href*='/immobilie/']")

    for a in anchors[:120]:
        href = a.get("href")
        if not href:
            continue
        url = href if href.startswith("http") else f"https://www.immowelt.de{href}"
        source_id = url.rstrip("/").split("/")[-1]
        if not source_id or source_id in seen:
            continue
        seen.add(source_id)

        title_attr = a.get("title") or ""
        # Example: "Wohnung zum Kauf - München - 599.500 € - 2,5 Zimmer, 73 m², ..."
        title = None
        desc = None
        if title_attr:
            parts = [p.strip() for p in title_attr.split(" - ") if p.strip()]
            if parts:
                title = parts[0]
            if len(parts) > 1:
                desc = " - ".join(parts[1:])[:500]

        parent = a.parent
        if not desc and parent:
            desc = parent.get_text(" ", strip=True)[:500] or None

        img = None
        if parent:
            img_tag = parent.find("img")
            if img_tag:
                img = img_tag.get("src") or img_tag.get("data-src")
                if img and img.startswith("/"):
                    img = f"https://www.immowelt.de{img}"

        price, area, rooms, price_per_sqm = _extract_numbers(title_attr or desc or "")

        rows.append(
            {
                "source": "immowelt",
                "source_listing_id": source_id,
                "url": url,
                "title": title,
                "description": desc,
                "image_url": img,
                "price_eur": price,
                "area_sqm": area,
                "rooms": rooms,
                "price_per_sqm": price_per_sqm,
                "first_seen_at": datetime.utcnow(),
                "last_seen_at": datetime.utcnow(),
            }
        )

    print(f"INFO immowelt parser: anchors={len(anchors)} rows={len(rows)}")
    return rows
