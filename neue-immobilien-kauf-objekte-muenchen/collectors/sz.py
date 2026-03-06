import re
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin
from collectors.base import SafeCollector

SEARCH_URL = "https://immobilienmarkt.sueddeutsche.de/suche/kaufen-wohnung-in-muenchen"


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


def _enrich_from_detail(c: SafeCollector, url: str):
    try:
        html = c.get(url)
    except Exception:
        return None, None, None, None, None, None

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)[:12000]
    price, area, rooms, price_per_sqm = _extract_numbers(text)

    district = None
    district_el = soup.select_one("[class*='district'], [class*='location'], [itemprop='addressLocality']")
    if district_el:
        district = district_el.get_text(" ", strip=True)[:120]

    img = None
    og = soup.select_one("meta[property='og:image']")
    if og and og.get("content"):
        img = urljoin(url, og.get("content"))

    return price, area, rooms, price_per_sqm, district, img


def collect_sz_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://immobilienmarkt.sueddeutsche.de/robots.txt", "/suche/kaufen-wohnung-in-muenchen")
    html = c.get(SEARCH_URL)
    soup = BeautifulSoup(html, "html.parser")

    rows = []
    seen_ids = set()

    # More robust selector set; keep conservative cap
    anchors = soup.select("a[href*='expose'], a[href*='immobilie'], a[href*='/objekt/'], a[href*='/kaufen/']")

    for a in anchors[:200]:
        url = a.get("href", "")
        if not url:
            continue
        if url.startswith("/"):
            url = f"https://immobilienmarkt.sueddeutsche.de{url}"
        low = url.lower()
        if "immobilienmarkt.sueddeutsche.de" not in low:
            continue
        if not any(t in low for t in ("expose", "objekt", "immobilie", "kaufen")):
            continue
        if any(t in low for t in ("/anbieter/", "impressum", "datenschutz", "facebook", "instagram")):
            continue

        source_id = url.rstrip("/").split("/")[-1]
        if not source_id or source_id in seen_ids:
            continue
        seen_ids.add(source_id)

        card_text = a.get_text(" ", strip=True)
        parent = a.parent
        parent_text = parent.get_text(" ", strip=True) if parent else card_text
        full_text = f"{card_text} {parent_text}"[:3000]

        title = (card_text or parent_text)[:300] or None
        desc = parent_text[:500] if parent_text else None
        price, area, rooms, price_per_sqm = _extract_numbers(full_text)

        img = None
        if parent:
            img_tag = parent.find("img")
            if img_tag:
                img = img_tag.get("src") or img_tag.get("data-src")
                if img and img.startswith("/"):
                    img = f"https://immobilienmarkt.sueddeutsche.de{img}"

        district = None
        # Most SZ search cards are sparse. Enrich from detail page when key fields are missing.
        if (price is None or area is None or rooms is None) and len(rows) < 40:
            d_price, d_area, d_rooms, d_ppsqm, d_district, d_img = _enrich_from_detail(c, url)
            price = price if price is not None else d_price
            area = area if area is not None else d_area
            rooms = rooms if rooms is not None else d_rooms
            price_per_sqm = price_per_sqm if price_per_sqm is not None else d_ppsqm
            district = d_district
            if not img and d_img:
                img = d_img

        rows.append(
            {
                "source": "sz",
                "source_listing_id": source_id,
                "url": url,
                "title": title,
                "description": desc,
                "image_url": img,
                "district": district,
                "price_eur": price,
                "area_sqm": area,
                "rooms": rooms,
                "price_per_sqm": price_per_sqm,
                "first_seen_at": datetime.utcnow(),
                "last_seen_at": datetime.utcnow(),
            }
        )

    print(f"INFO sz parser: anchors={len(anchors)} rows={len(rows)}")
    return rows
