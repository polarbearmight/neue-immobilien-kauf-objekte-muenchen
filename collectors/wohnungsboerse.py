import re

from app.time_utils import utc_now
from bs4 import BeautifulSoup

from collectors.base import AccessBlockedError, SafeCollector

SEARCH_URL = "https://www.wohnungsboerse.net/Bayern/Muenchen/Eigentumswohnung"

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


def _extract_best_numbers(title_text: str, context_text: str):
    # Prefer title-level parsing first: card/container text can contain repeated teaser values
    # from unrelated modules and would otherwise poison all listings with identical numbers.
    p_title, a_title, r_title, pp_title = _extract_numbers(title_text)
    p_ctx, a_ctx, r_ctx, pp_ctx = _extract_numbers(context_text)

    price = p_title if p_title is not None else p_ctx
    area = a_title if a_title is not None else a_ctx
    rooms = r_title if r_title is not None else r_ctx
    ppsqm = pp_title if pp_title is not None else pp_ctx
    return price, area, rooms, ppsqm


def collect_wohnungsboerse_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://www.wohnungsboerse.net/robots.txt", "/Bayern/Muenchen/Eigentumswohnung")
    try:
        html = c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN wohnungsboerse blocked: {e}")
        return []

    soup = BeautifulSoup(html, "html.parser")
    rows = []
    seen = set()

    anchors = soup.select("a[href*='/immodetail-k/']")
    if not anchors:
        anchors = soup.select("a[href*='wohnungen-kaufen-'], a[href*='immobilien']")
    for a in anchors[:120]:
        href = a.get("href")
        if not href:
            continue
        url = href if href.startswith("http") else f"https://www.wohnungsboerse.net{href}"
        low = url.lower()
        if not re.search(r"/immodetail-k/\d+", low):
            continue
        if any(t in low for t in ("impressum", "datenschutz", "facebook", "instagram")):
            continue
        sid = url.rstrip("/").split("/")[-1]
        if not sid or sid in seen:
            continue
        seen.add(sid)

        parent = a.parent
        text = (parent.get_text(" ", strip=True) if parent else a.get_text(" ", strip=True))[:2000]
        title = a.get_text(" ", strip=True)[:300] or None

        price, area, rooms, ppsqm = _extract_best_numbers(title or "", text)

        img = None
        if parent:
            img_tag = parent.find("img")
            if img_tag:
                img = img_tag.get("src") or img_tag.get("data-src")
                if img and img.startswith("/"):
                    img = f"https://www.wohnungsboerse.net{img}"

        rows.append(
            {
                "source": "wohnungsboerse",
                "source_listing_id": sid,
                "url": url,
                "title": title,
                "description": text[:500],
                "image_url": img,
                "price_eur": price,
                "area_sqm": area,
                "rooms": rooms,
                "price_per_sqm": ppsqm,
                "first_seen_at": utc_now(),
                "last_seen_at": utc_now(),
            }
        )

    print(f"INFO wohnungsboerse parser: anchors={len(anchors)} rows={len(rows)}")
    return rows
