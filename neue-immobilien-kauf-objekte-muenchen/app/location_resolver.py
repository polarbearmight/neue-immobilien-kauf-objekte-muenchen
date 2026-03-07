from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

MUNICH_UNKNOWN_DISTRICT = "München"

POSTAL_CODE_DISTRICTS: dict[str, tuple[str, int]] = {
    "80331": ("Altstadt-Lehel", 90), "80333": ("Maxvorstadt", 90), "80335": ("Maxvorstadt", 90),
    "80336": ("Ludwigsvorstadt-Isarvorstadt", 90), "80337": ("Ludwigsvorstadt-Isarvorstadt", 90), "80339": ("Schwanthalerhöhe", 90),
    "80469": ("Ludwigsvorstadt-Isarvorstadt", 90), "80538": ("Altstadt-Lehel", 90), "80539": ("Altstadt-Lehel", 90),
    "80634": ("Neuhausen-Nymphenburg", 90), "80636": ("Neuhausen-Nymphenburg", 90), "80637": ("Neuhausen-Nymphenburg", 90),
    "80638": ("Neuhausen-Nymphenburg", 90), "80639": ("Neuhausen-Nymphenburg", 90), "80686": ("Laim", 90),
    "80687": ("Laim", 90), "80689": ("Laim", 90), "80796": ("Schwabing-West", 90), "80797": ("Schwabing-West", 90),
    "80798": ("Maxvorstadt", 90), "80799": ("Maxvorstadt", 90), "80801": ("Schwabing-West", 90),
    "80802": ("Schwabing-Freimann", 90), "80803": ("Schwabing-West", 90), "80804": ("Schwabing-West", 90),
    "80805": ("Schwabing-Freimann", 90), "80807": ("Milbertshofen-Am Hart", 90), "80809": ("Milbertshofen-Am Hart", 90),
    "80933": ("Feldmoching-Hasenbergl", 90), "80935": ("Feldmoching-Hasenbergl", 90), "80937": ("Feldmoching-Hasenbergl", 90),
    "80939": ("Schwabing-Freimann", 90), "80992": ("Moosach", 90), "80993": ("Moosach", 90),
    "80995": ("Feldmoching-Hasenbergl", 90), "80997": ("Allach-Untermenzing", 90), "80999": ("Allach-Untermenzing", 90),
    "81241": ("Pasing-Obermenzing", 90), "81243": ("Pasing-Obermenzing", 90), "81245": ("Pasing-Obermenzing", 90),
    "81247": ("Pasing-Obermenzing", 90), "81249": ("Aubing-Lochhausen-Langwied", 90), "81369": ("Sendling", 90),
    "81371": ("Sendling", 90), "81373": ("Sendling-Westpark", 90), "81375": ("Hadern", 90), "81377": ("Hadern", 90),
    "81379": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90), "81475": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90),
    "81476": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90), "81477": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90),
    "81479": ("Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", 90), "81539": ("Obergiesing-Fasangarten", 90),
    "81541": ("Obergiesing-Fasangarten", 90), "81543": ("Untergiesing-Harlaching", 90), "81545": ("Untergiesing-Harlaching", 90),
    "81547": ("Untergiesing-Harlaching", 90), "81549": ("Obergiesing-Fasangarten", 90), "81667": ("Au-Haidhausen", 90),
    "81669": ("Au-Haidhausen", 90), "81671": ("Berg am Laim", 90), "81673": ("Berg am Laim", 90),
    "81675": ("Bogenhausen", 90), "81677": ("Bogenhausen", 90), "81679": ("Bogenhausen", 90),
    "81735": ("Ramersdorf-Perlach", 90), "81737": ("Ramersdorf-Perlach", 90), "81739": ("Ramersdorf-Perlach", 90),
    "81825": ("Trudering-Riem", 90), "81827": ("Trudering-Riem", 90), "81829": ("Trudering-Riem", 90),
    "81925": ("Bogenhausen", 90), "81927": ("Bogenhausen", 90), "81929": ("Bogenhausen", 90),
}

DISTRICT_ALIASES: dict[str, str] = {
    "altstadt": "Altstadt-Lehel", "lehel": "Altstadt-Lehel", "maxvorstadt": "Maxvorstadt",
    "ludwigsvorstadt": "Ludwigsvorstadt-Isarvorstadt", "isarvorstadt": "Ludwigsvorstadt-Isarvorstadt",
    "schwanthalerhoehe": "Schwanthalerhöhe", "schwanthalerhöhe": "Schwanthalerhöhe",
    "au haidhausen": "Au-Haidhausen", "au-haidhausen": "Au-Haidhausen", "haidhausen": "Au-Haidhausen",
    "sendling": "Sendling", "sendling westpark": "Sendling-Westpark", "sendling-westpark": "Sendling-Westpark",
    "hadern": "Hadern", "laim": "Laim", "schwabing": "Schwabing-Freimann", "schwabing west": "Schwabing-West",
    "schwabing-west": "Schwabing-West", "freimann": "Schwabing-Freimann", "schwabing freimann": "Schwabing-Freimann",
    "schwabing-freimann": "Schwabing-Freimann", "milbertshofen": "Milbertshofen-Am Hart", "am hart": "Milbertshofen-Am Hart",
    "feldmoching": "Feldmoching-Hasenbergl", "hasenbergl": "Feldmoching-Hasenbergl", "moosach": "Moosach",
    "allach": "Allach-Untermenzing", "untermenzing": "Allach-Untermenzing",
    "pasing": "Pasing-Obermenzing", "obermenzing": "Pasing-Obermenzing",
    "aubing": "Aubing-Lochhausen-Langwied", "lochhausen": "Aubing-Lochhausen-Langwied", "langwied": "Aubing-Lochhausen-Langwied",
    "thalkirchen": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", "obersendling": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln",
    "forstenried": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", "fuerstenried": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln",
    "fürstenried": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", "solln": "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln",
    "untergiesing": "Untergiesing-Harlaching", "harlaching": "Untergiesing-Harlaching", "obergiesing": "Obergiesing-Fasangarten",
    "fasangarten": "Obergiesing-Fasangarten", "berg am laim": "Berg am Laim", "bogenhausen": "Bogenhausen",
    "ramersdorf": "Ramersdorf-Perlach", "perlach": "Ramersdorf-Perlach", "trudering": "Trudering-Riem", "riem": "Trudering-Riem",
    "neuhausen": "Neuhausen-Nymphenburg", "nymphenburg": "Neuhausen-Nymphenburg",
}

ZIP_RE = re.compile(r"\b(8\d{4})\b")
COORD_RE = re.compile(r"(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)")


def _norm(s: str | None) -> str:
    if not s:
        return ""
    x = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    x = re.sub(r"[^a-z0-9\- ]+", " ", x)
    return " ".join(x.split())


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


def _extract_address_parts(address: str | None) -> dict[str, str | None]:
    txt = (address or "").strip()
    if not txt:
        return {"street": None, "postal": None, "city": None, "district_alias": None}

    postal = _extract_postal(txt)
    city = "München" if "münchen" in txt.lower() or "munchen" in txt.lower() else None
    district_alias = _find_alias_in_text(txt)

    # lightweight street extraction for patterns like "Leopoldstraße 45, 80802 München"
    street = None
    m = re.search(r"([A-Za-zÄÖÜäöüß\-\. ]+\s+\d+[a-zA-Z]?)", txt)
    if m:
        street = " ".join(m.group(1).split())

    return {
        "street": street,
        "postal": postal,
        "city": city,
        "district_alias": district_alias,
    }


def _is_munich_context(postal: str | None, city: str | None, district: str | None) -> bool:
    city_norm = _norm(city)
    if postal in POSTAL_CODE_DISTRICTS:
        return True
    if city_norm in {"muenchen", "munchen"}:
        return True
    if district and district in DISTRICT_ALIASES.values():
        return True
    return False


def _find_alias_in_text(*texts: str | None) -> str | None:
    hay = " | ".join(_norm(t) for t in texts if t)
    if not hay:
        return None
    for alias, canonical in DISTRICT_ALIASES.items():
        if alias in hay:
            return canonical
    return None


def _flatten_json_ld(obj: Any) -> list[dict]:
    out: list[dict] = []
    if isinstance(obj, dict):
        out.append(obj)
        for v in obj.values():
            out.extend(_flatten_json_ld(v))
    elif isinstance(obj, list):
        for x in obj:
            out.extend(_flatten_json_ld(x))
    return out


def _extract_jsonld_fields(structured_data_json: Any) -> dict[str, Any]:
    if isinstance(structured_data_json, str):
        try:
            structured_data_json = json.loads(structured_data_json)
        except Exception:
            structured_data_json = None

    out = {"street": None, "postal": None, "city": None, "district_raw": None, "lat": None, "lon": None}
    if not structured_data_json:
        return out

    for node in _flatten_json_ld(structured_data_json):
        addr = node.get("address") if isinstance(node.get("address"), dict) else {}
        geo = node.get("geo") if isinstance(node.get("geo"), dict) else {}

        out["street"] = out["street"] or addr.get("streetAddress") or node.get("streetAddress")
        out["postal"] = out["postal"] or addr.get("postalCode") or node.get("postalCode")
        out["city"] = out["city"] or addr.get("addressLocality") or node.get("addressLocality")
        out["district_raw"] = out["district_raw"] or addr.get("addressRegion") or node.get("addressRegion")
        out["lat"] = out["lat"] if out["lat"] is not None else _parse_float(geo.get("latitude") or node.get("latitude"))
        out["lon"] = out["lon"] if out["lon"] is not None else _parse_float(geo.get("longitude") or node.get("longitude"))
    return out


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersects = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


def _point_in_polygon(lon: float, lat: float, polygon: list[list[list[float]]]) -> bool:
    if not polygon:
        return False
    if not _point_in_ring(lon, lat, polygon[0]):
        return False
    for hole in polygon[1:]:
        if _point_in_ring(lon, lat, hole):
            return False
    return True


@lru_cache(maxsize=1)
def _load_munich_district_polygons() -> list[tuple[str, Any]]:
    root = Path(__file__).resolve().parents[1]
    geo = root / "frontend" / "public" / "data" / "munich_districts.geojson"
    if not geo.exists():
        return []
    doc = json.loads(geo.read_text(encoding="utf-8"))
    out: list[tuple[str, Any]] = []
    for f in doc.get("features", []):
        name = (f.get("properties") or {}).get("name")
        geom = f.get("geometry") or {}
        if not name or not geom.get("type"):
            continue
        out.append((name, geom))
    return out


def _district_from_coordinates(lat: float | None, lon: float | None) -> str | None:
    if lat is None or lon is None:
        return None
    for name, geom in _load_munich_district_polygons():
        t = geom.get("type")
        coords = geom.get("coordinates") or []
        if t == "Polygon":
            if _point_in_polygon(lon, lat, coords):
                return name
        elif t == "MultiPolygon":
            for poly in coords:
                if _point_in_polygon(lon, lat, poly):
                    return name
    return None


def resolve_location(fields: dict[str, Any]) -> dict[str, Any]:
    title = fields.get("title")
    description = fields.get("description")
    address = fields.get("address")
    postal_code = fields.get("postal_code")
    city = fields.get("city")
    district_raw = fields.get("district_raw")

    addr_parts = _extract_address_parts(address)
    ld_fields = _extract_jsonld_fields(fields.get("structured_data_json") or fields.get("json_ld"))

    lat = _parse_float(fields.get("latitude"))
    lon = _parse_float(fields.get("longitude"))
    if lat is None or lon is None:
        lat = _parse_float(ld_fields.get("lat")) if lat is None else lat
        lon = _parse_float(ld_fields.get("lon")) if lon is None else lon

    if lat is None or lon is None:
        c = fields.get("coordinates")
        if isinstance(c, str):
            m = COORD_RE.search(c)
            if m:
                lat = _parse_float(m.group(1))
                lon = _parse_float(m.group(2))

    # 1) coordinates -> polygon lookup
    by_coords = _district_from_coordinates(lat, lon)
    if by_coords:
        return {
            "district": by_coords,
            "postal_code": _extract_postal(postal_code, str(ld_fields.get("postal") or ""), address),
            "latitude": lat,
            "longitude": lon,
            "location_confidence": 100,
            "district_source": "coordinates",
        }

    # 2) postal code -> district lookup
    postal = _extract_postal(postal_code, str(ld_fields.get("postal") or ""), addr_parts.get("postal"), address)
    if postal and postal in POSTAL_CODE_DISTRICTS:
        d, conf = POSTAL_CODE_DISTRICTS[postal]
        return {
            "district": d,
            "postal_code": postal,
            "latitude": lat,
            "longitude": lon,
            "location_confidence": conf,
            "district_source": "postal_code",
        }

    # 3) structured data address fields
    ld_postal = _extract_postal(str(ld_fields.get("postal") or ""))
    ld_city = ld_fields.get("city")
    by_ld = _find_alias_in_text(ld_fields.get("district_raw"), ld_fields.get("street"), ld_city, str(ld_fields.get("postal") or ""))
    if _is_munich_context(ld_postal, ld_city, by_ld):
        if ld_postal and ld_postal in POSTAL_CODE_DISTRICTS:
            d, conf = POSTAL_CODE_DISTRICTS[ld_postal]
            return {
                "district": d,
                "postal_code": ld_postal,
                "latitude": lat,
                "longitude": lon,
                "location_confidence": conf,
                "district_source": "structured_data_postal_code",
            }
        if by_ld:
            return {
                "district": by_ld,
                "postal_code": postal,
                "latitude": lat,
                "longitude": lon,
                "location_confidence": 78,
                "district_source": "structured_data",
            }

    # 4) explicit address fields
    by_addr = _find_alias_in_text(address, district_raw, city, addr_parts.get("street"), addr_parts.get("district_alias"))
    if by_addr:
        return {
            "district": by_addr,
            "postal_code": postal,
            "latitude": lat,
            "longitude": lon,
            "location_confidence": 65 if not postal else 72,
            "district_source": "address",
        }

    # 5) title mention
    by_title = _find_alias_in_text(title)
    if by_title:
        return {
            "district": by_title,
            "postal_code": postal,
            "latitude": lat,
            "longitude": lon,
            "location_confidence": 45,
            "district_source": "title",
        }

    # 6) description mention
    by_description = _find_alias_in_text(description)
    if by_description:
        return {
            "district": by_description,
            "postal_code": postal,
            "latitude": lat,
            "longitude": lon,
            "location_confidence": 40,
            "district_source": "description",
        }

    # 7) fallback
    return {
        "district": MUNICH_UNKNOWN_DISTRICT,
        "postal_code": postal,
        "latitude": lat,
        "longitude": lon,
        "location_confidence": 10,
        "district_source": "fallback",
    }
