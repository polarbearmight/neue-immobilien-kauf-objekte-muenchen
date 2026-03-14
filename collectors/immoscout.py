from __future__ import annotations

import json
import os
import re
from pathlib import Path
from urllib.parse import urljoin

from collectors.base import SafeCollector, AccessBlockedError
from app.time_utils import utc_now

SEARCH_URL = "https://www.immobilienscout24.de/Suche/de/bayern/muenchen/provisionsfreie-wohnung-kaufen"
SEARCH_PATH = "/Suche/de/bayern/muenchen/provisionsfreie-wohnung-kaufen"
_EXPORT_ENV = "IMMOSCOUT_HTML_EXPORT_PATH"
_DEFAULT_EXPORT_PATH = Path("tmp/immoscout_export.html")


def _anti_bot_detected(html: str | None) -> bool:
    txt = (html or "").lower()
    return any(marker in txt for marker in (
        "ich bin kein roboter",
        "captcha",
        "anti-bot",
        "access denied",
        "security check",
        "/captcha/",
    ))


def _iter_embedded_objects(html: str) -> list[dict]:
    out: list[dict] = []

    for m in re.finditer(r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', html, flags=re.I | re.S):
        try:
            out.append(json.loads(m.group(1)))
        except Exception:
            pass

    for m in re.finditer(r'key=\"resultListEntries\"[^\{\[]*([\[{].*?[\]}])', html, flags=re.I | re.S):
        try:
            out.append(json.loads(m.group(1)))
        except Exception:
            pass

    for m in re.finditer(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});', html, flags=re.I | re.S):
        try:
            out.append(json.loads(m.group(1)))
        except Exception:
            pass

    return out


def _find_candidate_listings(node):
    if isinstance(node, dict):
        lower_keys = {str(k).lower() for k in node.keys()}
        if any(k in lower_keys for k in {"resultlistentry", "resultlistentries", "listingid", "realestatetype", "calculatedprice"}):
            yield node
        for value in node.values():
            yield from _find_candidate_listings(value)
    elif isinstance(node, list):
        for item in node:
            yield from _find_candidate_listings(item)


def _first(*values):
    for value in values:
        if value not in (None, "", [], {}):
            return value
    return None


def _to_num(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace("€", "").replace("EUR", "").replace("\xa0", "").replace(" ", "")
    if not s:
        return None
    m = re.search(r'\d[\d\.,]*', s)
    if not m:
        return None
    s = m.group(0)
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        parts = s.split(".")
        if len(parts) > 1 and all(p.isdigit() for p in parts) and len(parts[-1]) == 3:
            s = "".join(parts)
    try:
        return float(s)
    except Exception:
        return None


def _extract_row(entry: dict) -> dict | None:
    sid = str(_first(entry.get("@id"), entry.get("id"), entry.get("listingId"), entry.get("resultlist.realEstateId")) or "").strip()
    if not sid or not sid.isdigit():
        sid_match = re.search(r'\b(\d{5,})\b', json.dumps(entry, ensure_ascii=False))
        sid = sid_match.group(1) if sid_match else sid
    if not sid:
        return None

    title = _first(entry.get("title"), entry.get("headline"), entry.get("realEstateTitle"), entry.get("exposeTitle"))
    if not title:
        return None

    address_block = entry.get("address") if isinstance(entry.get("address"), dict) else {}
    real_estate = entry.get("realEstate") if isinstance(entry.get("realEstate"), dict) else {}
    if not address_block and isinstance(real_estate.get("address"), dict):
        address_block = real_estate.get("address")

    postal = _first(address_block.get("postcode"), address_block.get("zipCode"), entry.get("postcode"), entry.get("zipCode"))
    city = _first(address_block.get("city"), entry.get("city"), "München")
    quarter = _first(address_block.get("quarter"), address_block.get("district"), entry.get("quarter"), entry.get("district"))
    street = _first(address_block.get("street"), entry.get("street"))
    house = _first(address_block.get("houseNumber"), entry.get("houseNumber"))

    price = _to_num(_first(
        (entry.get("price") or {}).get("value") if isinstance(entry.get("price"), dict) else None,
        (entry.get("calculatedPrice") or {}).get("value") if isinstance(entry.get("calculatedPrice"), dict) else None,
        (real_estate.get("price") or {}).get("value") if isinstance(real_estate.get("price"), dict) else None,
        entry.get("price"),
        entry.get("calculatedPrice"),
    ))
    area = _to_num(_first(
        (real_estate.get("livingSpace") or {}).get("value") if isinstance(real_estate.get("livingSpace"), dict) else None,
        real_estate.get("livingSpace"),
        entry.get("livingSpace"),
        entry.get("area"),
    ))
    rooms = _to_num(_first(real_estate.get("numberOfRooms"), entry.get("numberOfRooms"), entry.get("rooms")))
    ppsqm = round(price / area, 2) if price and area else None

    photo = _first(
        (entry.get("galleryAttachment") or {}).get("thumbnailUrl") if isinstance(entry.get("galleryAttachment"), dict) else None,
        (entry.get("galleryAttachment") or {}).get("attachmentUrl") if isinstance(entry.get("galleryAttachment"), dict) else None,
        (real_estate.get("galleryAttachment") or {}).get("thumbnailUrl") if isinstance(real_estate.get("galleryAttachment"), dict) else None,
        entry.get("thumbnail"),
    )
    image_url = urljoin("https://www.immobilienscout24.de", str(photo)) if photo else None

    expose_path = _first(entry.get("resultlistEntryPath"), entry.get("url"), entry.get("href"), real_estate.get("url"))
    if not expose_path:
        expose_path = f"/expose/{sid}"
    url = urljoin("https://www.immobilienscout24.de", str(expose_path))

    address_parts = [x for x in [street, house, postal, city] if x]
    address = " ".join(str(x) for x in address_parts) if address_parts else None

    if city and "münchen" not in str(city).lower() and "muenchen" not in str(city).lower():
        return None

    now = utc_now()
    return {
        "source": "immoscout_private_filtered",
        "source_listing_id": sid,
        "url": url,
        "title": str(title)[:300],
        "description": str(_first(entry.get("description"), real_estate.get("description"), title))[:1200],
        "image_url": image_url,
        "price_eur": price,
        "area_sqm": area,
        "rooms": rooms,
        "price_per_sqm": ppsqm,
        "address": address[:500] if address else None,
        "city": "München",
        "district": str(quarter)[:120] if quarter else "München",
        "raw_district_text": quarter,
        "postal_code": str(postal) if postal else None,
        "first_seen_at": now,
        "last_seen_at": now,
        "source_payload_debug": {
            "fetch_mode": "browser_export_html",
            "anti_bot_fallback": True,
        },
    }


def _parse_html(html: str) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    for doc in _iter_embedded_objects(html):
        for candidate in _find_candidate_listings(doc):
            row = _extract_row(candidate)
            if not row:
                continue
            key = row["source_listing_id"]
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows


def get_export_path() -> Path:
    export_path = os.getenv(_EXPORT_ENV, "").strip()
    return Path(export_path) if export_path else _DEFAULT_EXPORT_PATH


def export_status() -> dict:
    p = get_export_path()
    exists = p.exists()
    stat = p.stat() if exists else None
    return {
        "path": str(p),
        "exists": exists,
        "size_bytes": stat.st_size if stat else 0,
        "updated_at": stat.st_mtime if stat else None,
    }


def save_export_html(html: str) -> Path:
    p = get_export_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(html or "", encoding="utf-8")
    return p


def _load_export_html() -> str | None:
    p = get_export_path()
    if not p.exists():
        print(f"WARN immoscout_private_filtered export missing: {p}")
        return None
    return p.read_text(encoding="utf-8", errors="ignore")


def collect_immoscout_private_filtered_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://www.immobilienscout24.de/robots.txt", SEARCH_PATH)

    html = None
    try:
        html = c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN immoscout_private_filtered blocked: {e}")

    if html and not _anti_bot_detected(html):
        rows = _parse_html(html)
        if rows:
            print(f"INFO immoscout_private_filtered live_html rows={len(rows)}")
            return rows

    export_html = _load_export_html()
    if export_html:
        rows = _parse_html(export_html)
        print(f"INFO immoscout_private_filtered export_html rows={len(rows)}")
        return rows

    if html and _anti_bot_detected(html):
        print("WARN immoscout_private_filtered anti-bot challenge; waiting for browser export html")
    return []
