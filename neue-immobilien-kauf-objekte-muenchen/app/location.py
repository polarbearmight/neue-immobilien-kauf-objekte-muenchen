from __future__ import annotations

import re
from typing import Any

MUNICH_UNKNOWN_DISTRICT = "München"

POSTAL_CODE_DISTRICTS: dict[str, tuple[str, int]] = {
    "80331": ("Altstadt-Lehel", 90),
    "80333": ("Maxvorstadt", 90),
    "80335": ("Maxvorstadt", 90),
    "80336": ("Ludwigsvorstadt-Isarvorstadt", 90),
    "80337": ("Ludwigsvorstadt-Isarvorstadt", 90),
    "80339": ("Schwanthalerhöhe", 90),
    "80469": ("Ludwigsvorstadt-Isarvorstadt", 90),
    "80538": ("Altstadt-Lehel", 90),
    "80539": ("Altstadt-Lehel", 90),
    "80634": ("Neuhausen-Nymphenburg", 90),
    "80636": ("Neuhausen-Nymphenburg", 90),
    "80637": ("Neuhausen-Nymphenburg", 90),
    "80638": ("Neuhausen-Nymphenburg", 90),
    "80639": ("Neuhausen-Nymphenburg", 90),
    "80686": ("Laim", 90),
    "80687": ("Laim", 90),
    "80689": ("Laim", 90),
    "80796": ("Schwabing-West", 90),
    "80797": ("Schwabing-West", 90),
    "80798": ("Maxvorstadt", 90),
    "80799": ("Maxvorstadt", 90),
    "80801": ("Schwabing-West", 90),
    "80802": ("Schwabing-Freimann", 90),
    "80803": ("Schwabing-West", 90),
    "80804": ("Schwabing-West", 90),
    "80805": ("Schwabing-Freimann", 90),
    "80807": ("Milbertshofen-Am Hart", 90),
    "80809": ("Milbertshofen-Am Hart", 90),
    "80933": ("Feldmoching-Hasenbergl", 90),
    "80935": ("Feldmoching-Hasenbergl", 90),
    "80937": ("Feldmoching-Hasenbergl", 90),
    "80939": ("Schwabing-Freimann", 90),
    "80992": ("Moosach", 90),
    "80993": ("Moosach", 90),
    "80995": ("Feldmoching-Hasenbergl", 90),
    "80997": ("Allach-Untermenzing", 90),
    "80999": ("Allach-Untermenzing", 90),
    "81241": ("Pasing-Obermenzing", 90),
    "81243": ("Pasing-Obermenzing", 90),
    "81245": ("Pasing-Obermenzing", 90),
    "81247": ("Pasing-Obermenzing", 90),
    "81249": ("Aubing-Lochhausen-Langwied", 90),
    "81369": ("Sendling", 90),
    "81371": ("Sendling", 90),
    "81373": ("Sendling-Westpark", 90),
    "81375": ("Hadern", 90),
    "81377": ("Hadern", 90),
    "81379": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90),
    "81475": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90),
    "81476": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90),
    "81477": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90),
    "81479": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90),
    "81539": ("Obergiesing-Fasangarten", 90),
    "81541": ("Obergiesing-Fasangarten", 90),
    "81543": ("Untergiesing-Harlaching", 90),
    "81545": ("Untergiesing-Harlaching", 90),
    "81547": ("Untergiesing-Harlaching", 90),
    "81549": ("Obergiesing-Fasangarten", 90),
    "81667": ("Au-Haidhausen", 90),
    "81669": ("Au-Haidhausen", 90),
    "81671": ("Berg am Laim", 90),
    "81673": ("Berg am Laim", 90),
    "81675": ("Bogenhausen", 90),
    "81677": ("Bogenhausen", 90),
    "81679": ("Bogenhausen", 90),
    "81735": ("Ramersdorf-Perlach", 90),
    "81737": ("Ramersdorf-Perlach", 90),
    "81739": ("Ramersdorf-Perlach", 90),
    "81825": ("Trudering-Riem", 90),
    "81827": ("Trudering-Riem", 90),
    "81829": ("Trudering-Riem", 90),
    "81925": ("Bogenhausen", 90),
    "81927": ("Bogenhausen", 90),
    "81929": ("Bogenhausen", 90),
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

    postal = _extract_postal(row.get("postal_code"), str(ld_postal) if ld_postal else None, address, ld_addr, district_raw, title, description)
    if postal and postal in POSTAL_CODE_DISTRICTS:
        d, conf = POSTAL_CODE_DISTRICTS[postal]
        has_address = bool((address and address.strip()) or (ld_addr and str(ld_addr).strip()))
        boosted = min(100, conf + (5 if has_address else 0))
        return {"district": d, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": boosted, "district_source": "postal_code"}
    if postal and postal.startswith("80"):
        return {"district": MUNICH_UNKNOWN_DISTRICT, "postal_code": postal, "latitude": lat, "longitude": lon, "location_confidence": 20, "district_source": "postal_inference"}

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


def recompute_locations(db) -> int:
    from sqlalchemy import select
    from app.models import Listing

    rows = db.execute(select(Listing)).scalars().all()
    changed = 0
    for r in rows:
        loc = resolve_location(
            {
                "title": r.title,
                "description": r.description,
                "district": r.district,
                "address": r.address,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "postal_code": r.postal_code,
            }
        )
        r.district = loc.get("district") or r.district or MUNICH_UNKNOWN_DISTRICT
        r.postal_code = loc.get("postal_code") or r.postal_code
        r.latitude = loc.get("latitude") if loc.get("latitude") is not None else r.latitude
        r.longitude = loc.get("longitude") if loc.get("longitude") is not None else r.longitude
        r.location_confidence = loc.get("location_confidence") if loc.get("location_confidence") is not None else r.location_confidence
        r.district_source = loc.get("district_source") or r.district_source
        changed += 1
    db.commit()
    return changed
