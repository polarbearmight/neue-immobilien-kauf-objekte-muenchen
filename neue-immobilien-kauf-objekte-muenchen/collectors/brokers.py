from __future__ import annotations

import hashlib
import json
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.time_utils import utc_now
from collectors.base import AccessBlockedError, SafeCollector

BROKER_SOURCES: dict[str, str] = {
    "broker_aigner": "https://www.aigner-immobilien.de/immobilien/",
    "broker_riedel": "https://www.riedel-immobilien.de/immobilien/",
    "broker_duken_wangenheim": "https://www.duken-wangenheim.de/immobilien/",
    "broker_graf": "https://www.grafimmo.de/immobilien/",
    "broker_dahler_muenchen": "https://www.dahlercompany.com/de/immobilien/muenchen/",
    "broker_engel_voelkers_muenchen": "https://www.engelvoelkers.com/de-de/muenchen/immobilien/",
    "broker_knight_frank_muenchen": "https://www.knightfrank.de/immobilien/muenchen",
    "broker_von_poll_muenchen": "https://www.von-poll.com/de/immobilien/muenchen",
    "broker_citigrund": "https://www.citigrund.de/immobilienangebote/",
    "broker_walser": "https://www.walser-immobiliengruppe.de/immobilien/",
    "broker_rohrer": "https://www.rohrer-immobilien.de/immobilien/",
    "broker_bayerische_hausbau": "https://www.bayerischehausbau.de/immobilien/",
    "broker_isaria": "https://www.isaria.ag/projekte/",
    "broker_bauwerk": "https://www.bauwerk.de/projekte/",
    "broker_pandion": "https://www.pandion.de/projekte/",
    "broker_ehret_klein": "https://ehret-klein.de/projekte/",
    # additional small/early-discovery broker sources
    "broker_immosmart_muenchen": "https://www.immosmart.de/immobilienangebote/",
    "broker_immo_muenchen": "https://www.immo-muenchen.de/",
    "broker_sis_immobilien": "https://www.sis-immobilien.de/immobilien/",
    "broker_veltrup": "https://www.veltrup.de/immobilien/",
    "broker_heinlein": "https://www.heinlein-immobilien.de/",
    "broker_immobilientreff": "https://www.immobilientreff.de/",
    "broker_pienzenauer": "https://www.pienzenauer.de/immobilien/",
    "broker_schneider_prell": "https://www.schneider-prell.de/immobilien/",
    "broker_immoquartier": "https://www.immoquartier.de/angebote/",
    "broker_immoconcept_muenchen": "https://www.immoconcept-muenchen.de/",
}

_LINK_HINTS = ("immobil", "objekt", "projekt", "expose", "angebot", "wohnung", "haus", "kaufen")
_NOISE_TITLE_HINTS = ("bewertung", "webinar", "ratgeber", "karriere", "service", "kontakt", "impressum", "datenschutz")

SOURCE_DENY_URL_PATTERNS: dict[str, tuple[str, ...]] = {
    "broker_immobilientreff": ("/service", "/kontakt", "/impressum", "/datenschutz", "/ueber-uns"),
    "broker_sis_immobilien": ("/ratgeber", "/aktuelles", "/service", "/karriere", "/unternehmen"),
    "broker_engel_voelkers_muenchen": ("/webinar", "/immobilienbewertung", "/karriere", "/ueber", "/blog"),
    "broker_immo_muenchen": ("/immobilienzentrum", "/service", "/kontakt", "/impressum", "/datenschutz"),
    "broker_rohrer": ("/stadtteil/", "/immobilien-vermarktung", "/service", "/kontakt", "/impressum", "/datenschutz"),
}

CLASSIFIED_DISCOVERY_SOURCES: dict[str, list[str]] = {
    "kleinanzeigen": [
        # Eigentumswohnung kaufen (München + Umland)
        "https://www.kleinanzeigen.de/s-wohnung-kaufen/muenchen/c196l6411",
        # Haus kaufen
        "https://www.kleinanzeigen.de/s-haus-kaufen/muenchen/c208l6411",
        # Grundstücke
        "https://www.kleinanzeigen.de/s-grundstueck/muenchen/c207l6411",
        # Fallback real estate root category
        "https://www.kleinanzeigen.de/s-immobilien/muenchen/c195l6411",
    ]
}

AUCTION_DISCOVERY_SOURCES: dict[str, list[str]] = {
    "auction_zvg_portal": [
        "https://www.zvg-portal.de/",
    ]
}


def _to_num(val) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return None
    s = s.replace("€", "").replace("EUR", "").replace(" ", "").replace("\u00a0", "")
    s = s.replace("m²", "").replace("qm", "")
    m = re.search(r"-?\d+[\d\.,]*", s)
    if not m:
        return None
    s = m.group(0)
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        parts = s.split(".")
        if len(parts) > 1 and len(parts[-1]) == 3:
            s = "".join(parts)
    try:
        return float(s)
    except Exception:
        return None


def _flatten_json_ld(obj) -> list[dict]:
    out: list[dict] = []
    if isinstance(obj, dict):
        out.append(obj)
        for v in obj.values():
            out.extend(_flatten_json_ld(v))
    elif isinstance(obj, list):
        for x in obj:
            out.extend(_flatten_json_ld(x))
    return out


def _extract_json_ld(soup: BeautifulSoup) -> dict:
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    for sc in scripts:
        txt = (sc.string or sc.get_text() or "").strip()
        if not txt:
            continue
        try:
            data = json.loads(txt)
        except Exception:
            continue
        for item in _flatten_json_ld(data):
            t = str(item.get("@type", "")).lower()
            if t in ("offer", "product", "residence", "house", "apartment") or "offer" in item:
                return item
    return {}


def _guess_district_from_text(text: str) -> str | None:
    if not text:
        return None
    t = text.lower()
    for d in (
        "maxvorstadt", "schwabing", "bogenhausen", "au-haidhausen", "sendling", "neuhausen",
        "nymphenburg", "moosach", "ramersdorf", "perlach", "trudering", "riem", "pasing",
    ):
        if d in t:
            return d.title().replace("-", "-")
    return None


def _extract_listing_links(source_name: str, base_url: str, html: str, max_links: int = 120) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[str] = []
    seen: set[str] = set()

    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip()
        if not href:
            continue
        u = urljoin(base_url, href)
        parsed = urlparse(u)
        if not parsed.scheme.startswith("http"):
            continue
        if parsed.netloc != urlparse(base_url).netloc:
            continue
        l = u.lower()
        if any(x in l for x in ("impressum", "datenschutz", "kontakt", "karriere", "jobs", "news")):
            continue
        if any(x in l for x in SOURCE_DENY_URL_PATTERNS.get(source_name, ())):
            continue
        text = f"{a.get_text(' ', strip=True)} {l}".lower()
        if not any(h in text for h in _LINK_HINTS):
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= max_links:
            break
    return out


def _is_probable_listing_detail(source_name: str, detail_url: str, title: str | None, body_text: str, has_offer_like_ld: bool) -> bool:
    l = (detail_url or "").lower()
    if any(x in l for x in SOURCE_DENY_URL_PATTERNS.get(source_name, ())):
        return False

    t = (title or "").lower().strip()
    if t in {"error", "404", "403", "seite nicht gefunden"}:
        return False
    if any(h in t for h in _NOISE_TITLE_HINTS):
        return False

    if has_offer_like_ld:
        return True

    # fallback heuristic: must look like an exposé/detail page, not generic landing content
    if not any(k in (t + " " + l) for k in ("immobil", "objekt", "expose", "wohnung", "haus", "kaufen")):
        return False
    return True


def _parse_detail(source_name: str, detail_url: str, html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    ld = _extract_json_ld(soup)

    title = (ld.get("name") if isinstance(ld, dict) else None) or (soup.title.get_text(strip=True) if soup.title else None)

    body_text = soup.get_text(" ", strip=True)

    price = None
    area = None
    rooms = None
    address = None
    district = None
    lat = None
    lon = None

    has_offer_like_ld = bool(ld)

    if ld:
        offer = ld.get("offers") if isinstance(ld.get("offers"), dict) else ld
        price = _to_num((offer or {}).get("price") if isinstance(offer, dict) else None)
        area = _to_num((ld.get("floorSize") or {}).get("value") if isinstance(ld.get("floorSize"), dict) else ld.get("floorSize"))
        rooms = _to_num(ld.get("numberOfRooms") or ld.get("numberOfBedrooms"))
        addr = ld.get("address") if isinstance(ld.get("address"), dict) else {}
        street = addr.get("streetAddress") if isinstance(addr, dict) else None
        postal = addr.get("postalCode") if isinstance(addr, dict) else None
        locality = addr.get("addressLocality") if isinstance(addr, dict) else None
        address = " ".join([x for x in [street, postal, locality] if x]) or None
        district = _guess_district_from_text(" ".join([str(street or ""), str(locality or ""), str(title or "")]))
        geo = ld.get("geo") if isinstance(ld.get("geo"), dict) else {}
        lat = _to_num(geo.get("latitude"))
        lon = _to_num(geo.get("longitude"))

    if price is None:
        price = _to_num(body_text)
    if area is None:
        m = re.search(r"(\d+[\.,]?\d*)\s*(m²|qm)", body_text, flags=re.IGNORECASE)
        area = _to_num(m.group(1)) if m else None
    if rooms is None:
        m = re.search(r"(\d+[\.,]?\d*)\s*(Zimmer)", body_text, flags=re.IGNORECASE)
        rooms = _to_num(m.group(1)) if m else None

    if not title:
        return None
    if not _is_probable_listing_detail(source_name, detail_url, title, body_text, has_offer_like_ld):
        return None

    sid = hashlib.sha1(detail_url.encode("utf-8")).hexdigest()[:20]
    ppsqm = round(price / area, 2) if price and area and area > 0 else None
    now = utc_now()

    return {
        "source": source_name,
        "source_listing_id": sid,
        "url": detail_url,
        "title": title[:300],
        "description": body_text[:800],
        "address": address,
        "district": district or "München",
        "price_eur": price,
        "area_sqm": area,
        "rooms": rooms,
        "price_per_sqm": ppsqm,
        "latitude": lat,
        "longitude": lon,
        "json_ld": ld if isinstance(ld, dict) else None,
        "first_seen_at": now,
        "last_seen_at": now,
    }


def collect_broker_listings(source_name: str, base_url: str) -> list[dict]:
    c = SafeCollector()
    domain = urlparse(base_url).scheme + "://" + urlparse(base_url).netloc
    robots = f"{domain}/robots.txt"
    try:
        c.assert_allowed(robots, urlparse(base_url).path or "/")
    except Exception:
        # do not hard-fail broker sources on robots parser issues
        pass

    try:
        html = c.get(base_url)
    except AccessBlockedError as e:
        print(f"WARN {source_name} blocked: {e}")
        return []
    except Exception as e:
        print(f"WARN {source_name} overview error: {e}")
        return []

    links = _extract_listing_links(source_name, base_url, html, max_links=150)
    rows: list[dict] = []
    max_detail = 60

    for url in links[:max_detail]:
        try:
            detail_html = c.get(url)
        except Exception:
            continue
        item = _parse_detail(source_name, url, detail_html)
        if item:
            rows.append(item)

    print(f"INFO {source_name} parser: links={len(links)} rows={len(rows)}")
    return rows


def collect_multi_seed_listings(source_name: str, seed_urls: list[str], max_total: int = 220) -> list[dict]:
    rows: list[dict] = []
    seen_keys: set[tuple[str, str]] = set()

    for url in seed_urls:
        try:
            current = collect_broker_listings(source_name, url)
        except Exception:
            current = []

        for r in current:
            key = (r.get("source_listing_id") or "", r.get("url") or "")
            if key in seen_keys:
                continue
            seen_keys.add(key)
            rows.append(r)
            if len(rows) >= max_total:
                return rows
    return rows


def make_broker_collector(source_name: str, base_url: str):
    def _collector() -> list[dict]:
        return collect_broker_listings(source_name, base_url)

    return _collector


def make_multi_seed_collector(source_name: str, seed_urls: list[str]):
    def _collector() -> list[dict]:
        return collect_multi_seed_listings(source_name, seed_urls)

    return _collector
