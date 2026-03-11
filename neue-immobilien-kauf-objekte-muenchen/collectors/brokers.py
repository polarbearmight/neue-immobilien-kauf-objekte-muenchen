from __future__ import annotations

import hashlib
import json
import os
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

# Source fetch profiles: html first, optional script-json fallback for dynamic pages
SOURCE_FETCH_MODE: dict[str, str] = {
    "kleinanzeigen": "html+script_json+browser",
}

SOURCE_BROWSER_PROFILE: dict[str, dict] = {
    "kleinanzeigen": {
        "scroll_rounds": 6,
        "scroll_px": 5000,
        "scroll_wait_ms": 850,
    },
}

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


def _extract_price_from_text(text: str) -> float | None:
    if not text:
        return None
    patterns = [
        r"kaufpreis\s*[:]?\s*([\d\.,]{3,})\s*(?:€|eur)",
        r"([\d\.,]{3,})\s*(?:€|eur)",
    ]
    for p in patterns:
        m = re.search(p, text, flags=re.IGNORECASE)
        if m:
            return _to_num(m.group(1))
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


def _extract_kleinanzeigen_district(text: str) -> str | None:
    if not text:
        return None
    # Examples:
    # "... in München - Trudering-Riem | ..."
    # "... in München - Thalk.Obersendl.-Forsten-Fürstenr.-Solln | ..."
    m = re.search(r"in\s+m[üu]nchen\s*-\s*([^|\n]+)", text, flags=re.IGNORECASE)
    if not m:
        return None
    raw = m.group(1).strip(" -\t")
    raw = re.sub(r"\s{2,}", " ", raw)
    return raw or None


def _extract_links_from_script_json(base_url: str, html: str, source_name: str | None = None, limit: int = 180) -> list[str]:
    source_name_l = (source_name or "").lower()
    out: list[str] = []
    seen: set[str] = set()

    # pull candidate hrefs from hydration/inline JSON blobs
    raw_hrefs = re.findall(r'"(/s-anzeige/[^"]+)"', html)
    raw_hrefs += re.findall(r'"(https?://[^"\s]+/s-anzeige/[^"\s]+)"', html)

    for href in raw_hrefs:
        u = urljoin(base_url, href)
        parsed = urlparse(u)
        if not parsed.scheme.startswith("http"):
            continue
        if parsed.netloc != urlparse(base_url).netloc:
            continue
        l = u.lower()
        if source_name_l == "kleinanzeigen":
            if "/s-anzeige/" not in l:
                continue
            if not re.search(r"/s-anzeige/.+/\d+-(196|207|208)-\d+", l):
                continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= limit:
            break

    return out


def _extract_links_from_browser_render(base_url: str, source_name: str | None = None, limit: int = 180) -> list[str]:
    """Optional browser-render fallback for heavily dynamic pages.

    Requires:
    - ENABLE_BROWSER_RENDER_FALLBACK=1
    - playwright installed + browser binaries
    """
    if os.getenv("ENABLE_BROWSER_RENDER_FALLBACK", "0").lower() not in ("1", "true", "yes"):
        return []

    try:
        from playwright.sync_api import sync_playwright  # type: ignore
    except Exception:
        return []

    source_name_l = (source_name or "").lower()
    out: list[str] = []
    seen: set[str] = set()

    profile = SOURCE_BROWSER_PROFILE.get(source_name_l, {})
    scroll_rounds = int(profile.get("scroll_rounds", 4))
    scroll_px = int(profile.get("scroll_px", 4000))
    scroll_wait_ms = int(profile.get("scroll_wait_ms", 700))

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(base_url, wait_until="domcontentloaded", timeout=45000)

            # soft infinite-scroll attempt (source-profiled)
            for _ in range(scroll_rounds):
                page.mouse.wheel(0, scroll_px)
                page.wait_for_timeout(scroll_wait_ms)

            html = page.content()
            browser.close()

        candidates = _extract_links_from_script_json(base_url, html, source_name=source_name, limit=limit)
        if not candidates:
            # generic anchor fallback from rendered dom (html-only pass)
            soup = BeautifulSoup(html, "html.parser")
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
                candidates.append(u)
                if len(candidates) >= limit:
                    break

        for u in candidates:
            if u in seen:
                continue
            l = u.lower()
            if source_name_l == "kleinanzeigen" and not re.search(r"/s-anzeige/.+/\d+-(196|207|208)-\d+", l):
                continue
            seen.add(u)
            out.append(u)
            if len(out) >= limit:
                break
    except Exception:
        return []

    return out


def _extract_listing_links(base_url: str, html: str, max_links: int = 120, source_name: str | None = None) -> list[str]:
    # backward compatible signature for tests/older calls
    source_name = source_name or ""
    source_name_l = source_name.lower()
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
        if source_name_l == "kleinanzeigen":
            # keep only detail pages from buy categories to avoid category hubs/rentals/noise
            if "/s-anzeige/" not in l:
                continue
            if not re.search(r"/s-anzeige/.+/\d+-(196|207|208)-\d+", l):
                continue
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

    mode = SOURCE_FETCH_MODE.get(source_name_l, "html")
    if "script_json" in mode and len(out) < max_links:
        for u in _extract_links_from_script_json(base_url, html, source_name=source_name, limit=max_links):
            if u in seen:
                continue
            seen.add(u)
            out.append(u)
            if len(out) >= max_links:
                break

    if "browser" in mode and len(out) < max_links:
        for u in _extract_links_from_browser_render(base_url, source_name=source_name, limit=max_links):
            if u in seen:
                continue
            seen.add(u)
            out.append(u)
            if len(out) >= max_links:
                break

    return out


def _is_probable_listing_detail(source_name: str, detail_url: str, title: str | None, body_text: str, has_offer_like_ld: bool, price: float | None = None) -> bool:
    l = (detail_url or "").lower()
    if any(x in l for x in SOURCE_DENY_URL_PATTERNS.get(source_name, ())):
        return False

    t = (title or "").lower().strip()
    if t in {"error", "404", "403", "seite nicht gefunden"}:
        return False
    if any(h in t for h in _NOISE_TITLE_HINTS):
        return False

    if source_name == "kleinanzeigen":
        if "/s-anzeige/" not in l:
            return False
        # keep only buy categories; exclude rent/WG/holiday/etc.
        if not re.search(r"/s-anzeige/.+/\d+-(196|207|208)-\d+", l):
            return False
        if t.startswith("kleinanzeigen für immobilien"):
            return False
        # For dashboard quality we skip entries without a numeric sale price.
        if price is None:
            return False

    if has_offer_like_ld:
        return True

    # fallback heuristic: must look like an exposé/detail page, not generic landing content
    if not any(k in (t + " " + l) for k in ("immobil", "objekt", "expose", "wohnung", "haus", "kaufen")):
        return False
    return True


def _extract_source_listing_id(final_url: str, body_text: str, ld: dict | None) -> str:
    # Prefer stable source-native ids over URL hash when possible.
    # 1) JSON-LD identifiers
    if isinstance(ld, dict):
        for key in ("@id", "identifier", "sku", "productID", "propertyID"):
            v = ld.get(key)
            if isinstance(v, (str, int, float)):
                s = str(v).strip()
                if len(s) >= 5 and len(s) <= 80:
                    return s
            if isinstance(v, dict) and v.get("value"):
                s = str(v.get("value")).strip()
                if len(s) >= 5 and len(s) <= 80:
                    return s

    # 2) URL trailing numeric token
    m = re.search(r"/(\d{5,})(?:[/?#-]|$)", final_url)
    if m:
        return m.group(1)

    # 3) Text hints like Objekt-ID
    m = re.search(r"objekt(?:-|\s)?id\s*[:#]?\s*([A-Za-z0-9-]{5,50})", body_text, flags=re.IGNORECASE)
    if m:
        return m.group(1)

    # 4) fallback: stable URL hash
    return hashlib.sha1(final_url.encode("utf-8")).hexdigest()[:20]


def _parse_detail(source_name: str, detail_url: str, html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    ld = _extract_json_ld(soup)

    canonical_href = None
    canon = soup.select_one('link[rel="canonical"]')
    if canon and canon.get("href"):
        canonical_href = canon.get("href").strip()

    title = (
        (ld.get("name") if isinstance(ld, dict) else None)
        or (soup.select_one('meta[property="og:title"]') or {}).get("content")
        or (soup.title.get_text(strip=True) if soup.title else None)
    )

    body_text = soup.get_text(" ", strip=True)

    price = None
    area = None
    rooms = None
    address = None
    district = None
    postal = None
    city = None
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
        city = locality
        address = " ".join([x for x in [street, postal, locality] if x]) or None
        district = _guess_district_from_text(" ".join([str(street or ""), str(locality or "")]))
        geo = ld.get("geo") if isinstance(ld.get("geo"), dict) else {}
        lat = _to_num(geo.get("latitude"))
        lon = _to_num(geo.get("longitude"))

    if source_name == "kleinanzeigen" and district is None:
        district = _extract_kleinanzeigen_district(body_text)

    if price is None:
        price = _extract_price_from_text(body_text)
    if area is None:
        m = re.search(r"(\d+[\.,]?\d*)\s*(m²|qm)", body_text, flags=re.IGNORECASE)
        area = _to_num(m.group(1)) if m else None
    if rooms is None:
        m = re.search(r"(\d+[\.,]?\d*)\s*(Zimmer)", body_text, flags=re.IGNORECASE)
        rooms = _to_num(m.group(1)) if m else None

    if title:
        title = re.sub(r"\s*[|\-–:]\s*(Immobilien|Makler|München|Munich).*$", "", title, flags=re.IGNORECASE).strip()

    final_url = detail_url
    if canonical_href:
        final_url = urljoin(detail_url, canonical_href)

    if not title:
        return None
    if not _is_probable_listing_detail(source_name, final_url, title, body_text, has_offer_like_ld, price=price):
        return None

    sid = _extract_source_listing_id(final_url, body_text, ld if isinstance(ld, dict) else None)
    ppsqm = round(price / area, 2) if price and area and area > 0 else None
    now = utc_now()

    return {
        "source": source_name,
        "source_listing_id": sid,
        "url": final_url,
        "raw_title": title[:300],
        "title": title[:300],
        "raw_description": body_text[:1200],
        "description": body_text[:800],
        "raw_address": address,
        "address": address,
        "city": city,
        "postal_code": postal,
        "raw_district_text": district,
        "district": district or "München",
        "price_eur": price,
        "area_sqm": area,
        "rooms": rooms,
        "price_per_sqm": ppsqm,
        "latitude": lat,
        "longitude": lon,
        "structured_data_json": ld if isinstance(ld, dict) else None,
        "json_ld": ld if isinstance(ld, dict) else None,
        "source_payload_debug": {"detail_url": detail_url, "canonical_url": final_url},
        "first_seen_at": now,
        "last_seen_at": now,
    }


def _extract_pagination_links(base_url: str, html: str, source_name: str | None = None) -> list[str]:
    source_name = source_name or ""
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

        text = (a.get_text(" ", strip=True) or "").lower()
        l = u.lower()
        rel = " ".join((a.get("rel") or [])).lower()
        if any(x in l for x in ("impressum", "datenschutz", "kontakt")):
            continue

        is_pagination = (
            ("next" in rel)
            or bool(re.search(r"([?&](page|p|seite)=\d+)|(/page/\d+)|(/seite/\d+)", l))
            or text in {"next", "weiter", ">", "»"}
            or bool(re.fullmatch(r"\d{1,3}", text))
        )
        if not is_pagination:
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)

    return out


def collect_broker_listings(source_name: str, base_url: str) -> list[dict]:
    c = SafeCollector()
    domain = urlparse(base_url).scheme + "://" + urlparse(base_url).netloc
    robots = f"{domain}/robots.txt"
    try:
        c.assert_allowed(robots, urlparse(base_url).path or "/")
    except Exception:
        # do not hard-fail broker sources on robots parser issues
        pass

    rows: list[dict] = []
    max_detail = 120
    max_pages = 6
    pages_to_visit = [base_url]
    seen_pages: set[str] = set()
    detail_links: list[str] = []
    seen_links: set[str] = set()

    pages_without_new_links = 0
    while pages_to_visit and len(seen_pages) < max_pages and len(detail_links) < 300:
        page_url = pages_to_visit.pop(0)
        if page_url in seen_pages:
            continue
        seen_pages.add(page_url)

        try:
            html = c.get(page_url)
        except AccessBlockedError as e:
            print(f"WARN {source_name} blocked: {e}")
            break
        except Exception as e:
            print(f"WARN {source_name} overview error: {e}")
            continue

        links = _extract_listing_links(page_url, html, max_links=180, source_name=source_name)
        before_count = len(detail_links)
        for u in links:
            if u in seen_links:
                continue
            seen_links.add(u)
            detail_links.append(u)
            if len(detail_links) >= 300:
                break

        if len(detail_links) == before_count:
            pages_without_new_links += 1
        else:
            pages_without_new_links = 0

        for p in _extract_pagination_links(page_url, html, source_name=source_name):
            if p not in seen_pages and p not in pages_to_visit and len(seen_pages) + len(pages_to_visit) < max_pages:
                pages_to_visit.append(p)

        # stop early when additional pagination no longer yields new listing links
        if pages_without_new_links >= 2:
            break

    for url in detail_links[:max_detail]:
        try:
            detail_html = c.get(url)
        except Exception:
            continue
        item = _parse_detail(source_name, url, detail_html)
        if item:
            rows.append(item)

    print(f"INFO {source_name} parser: pages={len(seen_pages)} links={len(detail_links)} rows={len(rows)}")
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
