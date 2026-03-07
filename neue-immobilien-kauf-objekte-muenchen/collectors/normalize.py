from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.location_resolver import resolve_location

REAL_ESTATE_HINTS = (
    "wohnung",
    "haus",
    "immobil",
    "kauf",
    "zimmer",
    "m²",
    "qm",
    "expose",
    "objekt",
)

NOISE_HINTS = (
    "facebook",
    "instagram",
    "linkedin",
    "twitter",
    "youtube",
    "tiktok",
    "kontakt",
    "impressum",
    "datenschutz",
    "agb",
    "newsletter",
    "about",
)


def normalize_source_name(source: str | None) -> str | None:
    if not source:
        return None
    return source.strip().lower().replace("-", "_")


def to_num(val) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return None
    s = s.replace("€", "").replace("EUR", "").replace(" ", "")
    s = s.replace("\u00a0", "")
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


_zip_munich_re = re.compile(r"\b(8\d{4})\s*(m[üu]nchen)\b", re.IGNORECASE)
_object_id_re = re.compile(r"\bobjekt(?:-|\s)?id\b.*$", re.IGNORECASE)


def normalize_location(text: str | None) -> str | None:
    if not text:
        return None
    t = " ".join(text.split()).strip(" ,;-")
    if not t:
        return None

    # Remove noisy suffixes often seen in scraped locations
    t = _object_id_re.sub("", t).strip(" ,;-")

    # Canonicalize Munich zip+city strings like "81545 München"
    m = _zip_munich_re.search(t)
    if m:
        t = f"{m.group(1)} München"

    if len(t) > 128:
        t = t[:128]
    return t or None


def is_probable_listing_url(url: str | None) -> bool:
    if not url:
        return False
    lower = url.lower()
    if any(x in lower for x in ("/impressum", "/datenschutz", "mailto:", "javascript:")):
        return False
    return True


def is_real_estate_text(title: str | None, description: str | None, url: str | None = None) -> bool:
    text = " ".join([title or "", description or "", url or ""]).lower()
    if any(h in text for h in REAL_ESTATE_HINTS):
        return True
    if any(h in text for h in NOISE_HINTS):
        return False
    return False


def normalize_listing_row(row: dict) -> dict | None:
    source = normalize_source_name(row.get("source"))
    url = (row.get("url") or "").strip()
    sid = (row.get("source_listing_id") or "").strip()
    if not source or not url or not sid or not is_probable_listing_url(url):
        return None

    title = (row.get("title") or "").strip()[:512] or None
    description = (row.get("description") or "").strip()[:2048] or None
    if not is_real_estate_text(title, description, url):
        return None

    price = to_num(row.get("price_eur"))
    area = to_num(row.get("area_sqm"))
    rooms = to_num(row.get("rooms"))
    ppsqm = to_num(row.get("price_per_sqm"))

    if ppsqm is None and price and area and area > 0:
        ppsqm = round(price / area, 2)

    # guard rails against nav/noise rows with absurd values
    if price is not None and (price < 50000 or price > 20000000):
        return None
    if area is not None and (area < 15 or area > 1000):
        return None
    if rooms is not None and (rooms < 0.5 or rooms > 20):
        return None

    district = normalize_location(row.get("district"))
    address = normalize_location(row.get("address"))
    city = normalize_location(row.get("city"))
    image_url = (row.get("image_url") or "").strip() or None

    loc = resolve_location({
        "title": title,
        "description": description,
        "address": address,
        "postal_code": row.get("postal_code"),
        "city": city,
        "district_raw": district,
        "latitude": row.get("latitude"),
        "longitude": row.get("longitude"),
        "coordinates": row.get("coordinates"),
        "structured_data_json": row.get("structured_data_json") or row.get("json_ld"),
    })

    now = datetime.now(timezone.utc)
    return {
        "source": source,
        "source_listing_id": sid,
        "url": url,
        "title": title,
        "description": description,
        "image_url": image_url,
        "image_hash": row.get("image_hash"),
        "address": address,
        "district": loc.get("district") or district,
        "postal_code": loc.get("postal_code"),
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
        "location_confidence": loc.get("location_confidence"),
        "district_source": loc.get("district_source"),
        "price_eur": price,
        "area_sqm": area,
        "rooms": rooms,
        "price_per_sqm": ppsqm,
        "posted_at": row.get("posted_at"),
        "first_seen_at": row.get("first_seen_at") or now,
        "last_seen_at": row.get("last_seen_at") or now,
    }


def _secondary_key(row: dict) -> tuple:
    source = (row.get("source") or "").strip().lower()
    title = (row.get("title") or "").strip().lower()
    district = (row.get("district") or "").strip().lower()
    price = round(float(row.get("price_eur") or 0) / 1000.0) * 1000
    area = round(float(row.get("area_sqm") or 0), 1)
    rooms = round(float(row.get("rooms") or 0), 1)
    return source, title, district, price, area, rooms


def dedupe_rows(rows: list[dict]) -> list[dict]:
    out = []
    seen_primary = set()
    seen_secondary = set()
    for row in rows:
        primary = (row.get("source"), row.get("source_listing_id"))
        secondary = _secondary_key(row)
        if primary in seen_primary:
            continue
        if secondary in seen_secondary:
            continue
        seen_primary.add(primary)
        seen_secondary.add(secondary)
        out.append(row)
    return out
