import re
from datetime import datetime

from bs4 import BeautifulSoup

from collectors.base import AccessBlockedError, SafeCollector

SEARCH_URL = "https://www.sis.de/immobilienangebote/?mt=buy"

_price_re = re.compile(r"([\d\.,]{3,})\s*€")
_area_re = re.compile(r"([\d\.,]{1,6})\s*m²")
_rooms_re = re.compile(r"(\d+[\.,]?\d*)\s*(?:Zimmer|Zi)")


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


def collect_sis_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://www.sis.de/robots.txt", "/immobilienangebote/")
    try:
        html = c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN sis blocked: {e}")
        return []

    soup = BeautifulSoup(html, "html.parser")
    rows = []
    seen = set()

    # SIS page contains many navigation links. Restrict to concrete expose/detail URLs only.
    anchors = soup.select("a[href]")
    for a in anchors[:300]:
        href = a.get("href")
        if not href:
            continue
        url = href if href.startswith("http") else f"https://www.sis.de{href}"
        low = url.lower()
        if not any(k in low for k in ["/immobilie/", "/objekt/", "/expose/"]):
            continue
        sid = url.rstrip("/").split("/")[-1]
        if not sid or sid in seen:
            continue
        seen.add(sid)

        parent = a.parent
        text = (parent.get_text(" ", strip=True) if parent else a.get_text(" ", strip=True))[:3000]
        title = a.get_text(" ", strip=True)[:300] or None

        price, area, rooms, ppsqm = _extract_numbers(text)

        img = None
        if parent:
            img_tag = parent.find("img")
            if img_tag:
                img = img_tag.get("src") or img_tag.get("data-src")
                if img and img.startswith("/"):
                    img = f"https://www.sis.de{img}"

        rows.append(
            {
                "source": "sis",
                "source_listing_id": sid,
                "url": url,
                "title": title,
                "description": text[:500],
                "image_url": img,
                "price_eur": price,
                "area_sqm": area,
                "rooms": rooms,
                "price_per_sqm": ppsqm,
                "first_seen_at": datetime.utcnow(),
                "last_seen_at": datetime.utcnow(),
            }
        )

    print(f"INFO sis parser: anchors={len(anchors)} rows={len(rows)}")
    return rows
