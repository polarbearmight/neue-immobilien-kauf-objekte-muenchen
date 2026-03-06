from __future__ import annotations

import re
from typing import Any

MUNICH_UNKNOWN_DISTRICT = "München"

POSTAL_CODE_DISTRICTS: dict[str, tuple[str, int]] = {
    "80331": ("Altstadt-Lehel", 90),
    "80333": ("Maxvorstadt", 90),
    "80799": ("Maxvorstadt", 90),
    "80802": ("Schwabing", 90),
    "80803": ("Schwabing", 90),
    "80804": ("Schwabing-West", 90),
    "81675": ("Bogenhausen", 90),
    "81667": ("Au-Haidhausen", 90),
    "81539": ("Giesing", 90),
    "81369": ("Sendling", 90),
}

DISTRICT_ALIASES: dict[str, str] = {
    "maxvorstadt": "Maxvorstadt",
    "schwabing": "Schwabing",
    "schwabing nord": "Schwabing",
    "schwabing-west": "Schwabing-West",
    "schwabing west": "Schwabing-West",
    "schwabing freimann": "Schwabing-Freimann",
    "schwabing-freimann": "Schwabing-Freimann",
    "bogenhausen": "Bogenhausen",
    "au-haidhausen": "Au-Haidhausen",
    "haidhausen": "Au-Haidhausen",
    "ludwigsvorstadt": "Ludwigsvorstadt-Isarvorstadt",
    "isarvorstadt": "Ludwigsvorstadt-Isarvorstadt",
    "altstadt": "Altstadt-Lehel",
    "innenstadt": "Altstadt-Lehel",
    "sendling": "Sendling",
    "sendling-westpark": "Sendling-Westpark",
    "hadern": "Hadern",
    "pasing": "Pasing",
    "neuhausen": "Neuhausen-Nymphenburg",
    "nymphenburg": "Neuhausen-Nymphenburg",
    "moosach": "Moosach",
    "milbertshofen": "Milbertshofen-Am Hart",
    "freimann": "Schwabing-Freimann",
    "giesing": "Giesing",
    "obergiesing": "Obergiesing-Fasangarten",
    "untergiesing": "Untergiesing-Harlaching",
    "ramersdorf": "Ramersdorf-Perlach",
    "perlach": "Ramersdorf-Perlach",
    "trudering": "Trudering-Riem",
    "riem": "Trudering-Riem",
    "feldmoching": "Feldmoching-Hasenbergl",
    "hasenbergl": "Feldmoching-Hasenbergl",
    "allach": "Allach-Untermenzing",
    "untermenzing": "Allach-Untermenzing",
    "obermenzing": "Pasing-Obermenzing",
    "solln": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln",
    "thalkirchen": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln",
    "forstenried": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln",
}

ZIP_RE = re.compile(r"\b(8\d{4})\b")
COORD_RE = re.compile(r"(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)")


def _norm(s: str | None) -> str:
    if not s:
        return ""
    x = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return " ".join(re.sub(r"[^a-z0-9\- ]+", " ", x).split())


def _parse_float(v: Any) -> float | None:
    try:
        return float(v)
    except Exception:
        return None


def _extract_postal(*texts: str | None) -> str | None:
    for t in texts:
        if not t:
            continue
        m = ZIP_RE.search(t)
        if m:
            return m.group(1)
    return None


def _district_from_text(*texts: str | None) -> str | None:
    hay = " | ".join(_norm(t) for t in texts if t)
    if not hay:
        return None
    for alias, canonical in DISTRICT_ALIASES.items():
        if alias in hay:
            return canonical
    return None


def _district_from_coords(lat: float | None, lon: float | None) -> str | None:
    if lat is None or lon is None:
        return None
    # coarse Munich sub-areas (lightweight fallback before real polygon dataset)
    if 48.17 <= lat <= 48.19 and 11.56 <= lon <= 11.60:
        return "Maxvorstadt"
    if 48.16 <= lat <= 48.19 and 11.60 < lon <= 11.64:
        return "Schwabing"
    if 48.13 <= lat <= 48.16 and 11.62 <= lon <= 11.68:
        return "Bogenhausen"
    return None


def resolve_location(row: dict) -> dict:
    title = row.get("title")
    description = row.get("description")
    district_raw = row.get("district")
    address = row.get("address")

    json_ld = row.get("json_ld") if isinstance(row.get("json_ld"), dict) else {}
    ld_addr = json_ld.get("streetAddress") or json_ld.get("address")
    ld_postal = json_ld.get("postalCode")

    lat = _parse_float(row.get("latitude") or json_ld.get("latitude"))
    lon = _parse_float(row.get("longitude") or json_ld.get("longitude"))
    if lat is None or lon is None:
        c = row.get("coordinates")
        if isinstance(c, str):
            m = COORD_RE.search(c)
            if m:
                lat = _parse_float(m.group(1))
                lon = _parse_float(m.group(2))

    postal = _extract_postal(str(ld_postal) if ld_postal else None, address, ld_addr, district_raw, title, description)
    if postal and postal in POSTAL_CODE_DISTRICTS:
        d, conf = POSTAL_CODE_DISTRICTS[postal]
        return {"district": d, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": conf, "district_source": "postal_code"}

    if ld_addr or ld_postal:
        d = _district_from_text(ld_addr, district_raw, title, description)
        if d:
            return {"district": d, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": 70, "district_source": "structured_data"}

    d = _district_from_text(address, district_raw)
    if d:
        return {"district": d, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": 70, "district_source": "address"}

    d = _district_from_text(title, description)
    if d:
        return {"district": d, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": 50, "district_source": "title_detection"}

    d = _district_from_coords(lat, lon)
    if d:
        return {"district": d, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": 100, "district_source": "coordinates"}

    return {"district": MUNICH_UNKNOWN_DISTRICT, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": 0, "district_source": "fallback"}
