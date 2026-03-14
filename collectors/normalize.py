from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.location_resolver import resolve_location
from app.title_normalization import make_display_title, normalize_title
from app.field_normalization import compute_ppsqm, normalize_area, normalize_posted_at, normalize_price, normalize_rooms
from app.listing_validator import quality_flags
from app.district_name_map import canonicalize_district_name

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

GENERIC_TITLE_HINTS = {
    "wohnung zum kauf",
    "haus zum kauf",
    "immobilie zum kauf",
    "kaufobjekt",
}

NON_MUNICH_PLACE_HINTS = {
    "karlsfeld", "maisach", "olching", "eichenau", "kirchheim", "taufkirchen", "riemerling",
    "unterhaching", "gruenwald", "grünwald", "garching", "unterfoehring", "unterföhring", "ismaning",
    "dachau", "germering", "fürstenfeldbruck", "fuerstenfeldbruck"
}


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
_zip_only_re = re.compile(r"\b(8\d{4})\b")
_district_in_parens_re = re.compile(r"m[üu]nchen\s*\(([^\)]+)\)", re.IGNORECASE)


def normalize_location(text: str | None) -> str | None:
    if not text:
        return None
    t = " ".join(text.split()).strip(" ,;-")
    if not t:
        return None

    # Remove noisy suffixes often seen in scraped locations
    t = _object_id_re.sub("", t).strip(" ,;-")

    # Prefer explicit district names over raw zip+city strings like "81545 München (Harlaching)"
    district_match = _district_in_parens_re.search(t)
    if district_match:
        t = district_match.group(1).strip(" ,;-")
    else:
        # Canonicalize Munich zip+city strings like "81545 München"
        m = _zip_munich_re.search(t)
        if m:
            t = f"{m.group(1)} München"
        else:
            zip_only = _zip_only_re.search(t)
            if zip_only and ("münchen" in t.lower() or "muenchen" in t.lower()):
                t = f"{zip_only.group(1)} München"

    if len(t) > 128:
        t = t[:128]
    return t or None


def is_probable_listing_url(url: str | None) -> bool:
    if not url:
        return False
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
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
    if url and not urlparse(url).scheme and "." in url and " " not in url:
        url = "https://" + url
    sid = (row.get("source_listing_id") or "").strip()
    if not source or not url or not sid or not is_probable_listing_url(url):
        return None

    raw_title = (row.get("raw_title") or row.get("title") or "").strip()[:512] or None
    raw_description = (row.get("raw_description") or row.get("description") or "").strip()[:2048] or None

    title = normalize_title(raw_title)
    description = raw_description
    if not is_real_estate_text(title or raw_title, description, url):
        return None

    price = normalize_price(to_num(row.get("price_eur")))
    area = normalize_area(to_num(row.get("area_sqm")))
    rooms = normalize_rooms(to_num(row.get("rooms")))
    ppsqm = to_num(row.get("price_per_sqm"))

    if source == "kleinanzeigen" and price is None:
        return None

    # If normalized price is missing/invalid, ignore upstream €/m² to avoid false ultra-deals.
    if price is None:
        ppsqm = None

    if ppsqm is None:
        ppsqm = compute_ppsqm(price, area)

    # sanity bounds for Munich buy-market ppsqm
    if ppsqm is not None and (ppsqm < 1000 or ppsqm > 100000):
        ppsqm = None

    district = normalize_location(row.get("district") or row.get("raw_district_text"))
    address = normalize_location(row.get("address") or row.get("raw_address"))
    city = normalize_location(row.get("city"))

    combined_location_text = " ".join(filter(None, [district, address, city, raw_title, raw_description])).lower()
    if any(place in combined_location_text for place in NON_MUNICH_PLACE_HINTS) and not any(m in combined_location_text for m in ["münchen", "muenchen"]):
        return None

    title_low = (title or "").lower().strip()
    if title_low in GENERIC_TITLE_HINTS and not (price or area or rooms or address):
        return None

    # require at least 2 quality signals to reduce noisy rows
    quality_signals = 0
    quality_signals += 1 if price is not None else 0
    quality_signals += 1 if area is not None else 0
    quality_signals += 1 if rooms is not None else 0
    quality_signals += 1 if (title and len(title) >= 12) else 0
    quality_signals += 1 if (description and len(description) >= 80) else 0
    if quality_signals < 2:
        return None

    # guard rails against nav/noise rows with absurd values
    if price is not None and (price < 50000 or price > 20000000):
        return None
    if area is not None and (area < 15 or area > 1000):
        return None
    if rooms is not None and (rooms < 0.5 or rooms > 20):
        return None

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
    final_district = canonicalize_district_name(loc.get("district") or district)
    display_title = make_display_title(title, final_district, area, rooms)

    normalized = {
        "source": source,
        "source_listing_id": sid,
        "url": url,
        "title": title,
        "display_title": display_title,
        "raw_title": raw_title,
        "description": description,
        "raw_description": raw_description,
        "image_url": image_url,
        "image_hash": row.get("image_hash"),
        "address": address,
        "city": city,
        "district": final_district,
        "raw_district_text": row.get("raw_district_text") or district,
        "postal_code": loc.get("postal_code"),
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
        "location_confidence": loc.get("location_confidence"),
        "district_source": loc.get("district_source"),
        "price_eur": price,
        "area_sqm": area,
        "rooms": rooms,
        "price_per_sqm": ppsqm,
        "posted_at": normalize_posted_at(row.get("posted_at")),
        "first_seen_at": row.get("first_seen_at") or now,
        "last_seen_at": row.get("last_seen_at") or now,
        "source_payload_debug": json.dumps({
            "structured_data_json": row.get("structured_data_json") or row.get("json_ld"),
            "raw_address": row.get("raw_address") or row.get("address"),
            "raw_district_text": row.get("raw_district_text") or row.get("district"),
            "city": row.get("city"),
        }, ensure_ascii=False)[:3900],
    }
    normalized["quality_flags"] = json.dumps(quality_flags(normalized), ensure_ascii=False)
    return normalized


def _secondary_key(row: dict) -> tuple:
    # cross-source duplicate guard (same object on multiple portals)
    title = (row.get("title") or "").strip().lower()
    district = (row.get("district") or "").strip().lower()
    postal = str(row.get("postal_code") or "").strip()
    price = round(float(row.get("price_eur") or 0) / 1000.0) * 1000
    area = round(float(row.get("area_sqm") or 0), 1)
    rooms = round(float(row.get("rooms") or 0), 1)
    return title, district, postal, price, area, rooms


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
