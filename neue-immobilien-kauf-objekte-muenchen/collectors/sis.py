import re
from datetime import datetime

from bs4 import BeautifulSoup

from collectors.base import AccessBlockedError, SafeCollector

SEARCH_URL = "https://www.sis.de/immobilienangebote/?mt=buy"

_price_re = re.compile(r"([\d\.,]{3,})\s*€")
_area_re = re.compile(r"([\d\.,]{1,6})\s*m²")
_rooms_re = re.compile(r"(\d+[\.,]?\d*)\s*(?:Zimmer|Zi)")
_detail_link_re = re.compile(r"https://www\.sis\.de/immobilie/[^\"'\s<]+")


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


def _collect_detail_links(html: str) -> list[str]:
    links = []
    seen = set()
    for m in _detail_link_re.finditer(html):
        url = m.group(0)
        if url not in seen:
            seen.add(url)
            links.append(url)
    return links


def collect_sis_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://www.sis.de/robots.txt", "/immobilienangebote/")
    try:
        html = c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN sis blocked: {e}")
        return []

    detail_links = _collect_detail_links(html)

    rows = []
    seen = set()
    for url in detail_links[:80]:
        sid = url.rstrip("/").split("/")[-1]
        if not sid or sid in seen:
            continue
        seen.add(sid)

        try:
            detail_html = c.get(url)
        except Exception:
            continue

        soup = BeautifulSoup(detail_html, "html.parser")
        full_text = soup.get_text(" ", strip=True)[:20000]

        title = None
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(" ", strip=True)[:300] or None

        price, area, rooms, ppsqm = _extract_numbers(full_text)

        district = None
        loc = soup.select_one("[class*='location'], [class*='city'], [itemprop='addressLocality']")
        if loc:
            district = loc.get_text(" ", strip=True)[:120] or None

        img = None
        og = soup.select_one("meta[property='og:image']")
        if og and og.get("content"):
            img = og.get("content")

        rows.append(
            {
                "source": "sis",
                "source_listing_id": sid,
                "url": url,
                "title": title,
                "description": full_text[:500],
                "image_url": img,
                "district": district,
                "price_eur": price,
                "area_sqm": area,
                "rooms": rooms,
                "price_per_sqm": ppsqm,
                "first_seen_at": datetime.utcnow(),
                "last_seen_at": datetime.utcnow(),
            }
        )

    print(f"INFO sis parser(detail-pages): links={len(detail_links)} rows={len(rows)}")
    return rows
