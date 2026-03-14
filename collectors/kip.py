from __future__ import annotations

import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.time_utils import utc_now

BASE = "https://www.kip.net"
SEARCH_URLS = [
    "https://www.kip.net/bayern/muenchen/kaufen/haeuser",
    "https://www.kip.net/bayern/muenchen/kaufen/eigentumswohnungen",
    "https://www.kip.net/bayern/muenchen/bauen/grundstuecke",
]
_DETAIL_PATH_RE = re.compile(r'/bayern/muenchen/(?:kaufen|bauen)/[^\"\'\s<>]+_[A-Z]\d+', re.I)


def _to_num(val: str | None) -> float | None:
    if not val:
        return None
    s = str(val).strip().replace("€", "").replace(" ", "").replace("\xa0", "")
    m = re.search(r"\d[\d\.,]*", s)
    if not m:
        return None
    s = m.group(0)
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except Exception:
        return None


def _search(pattern: str, text: str, flags: int = 0) -> str | None:
    m = re.search(pattern, text, flags=flags)
    return m.group(1) if m else None


def _extract_numbers(text: str):
    price = _to_num(_search(r"Kaufpreis\s*[:]?\s*([\d\.,]+)", text, flags=re.I))
    area = _to_num(_search(r"(?:Wohnfl[äa]che|Fl[äa]che)\s*[:]?\s*([\d\.,]+)\s*m²", text, flags=re.I | re.S))
    rooms = _to_num(_search(r"Zimmer\s*[:]?\s*([\d\.,]+)", text, flags=re.I))
    ppsqm = round(price / area, 2) if price and area else None
    return price, area, rooms, ppsqm


def _provider_is_private_like(text: str) -> bool:
    t = (text or "").lower()
    hints = [
        "ohne-makler",
        "von privat",
        "privat",
        "angebot von",
        "eigentümer",
        "eigentumer",
    ]
    return any(h in t for h in hints) and "immobilienmakler" not in t and "makler" not in t


def _extract_provider_text(text: str) -> str:
    for pattern in (
        r"Anbieter\s+(.*?)\s+Ansprechpartner",
        r"Anbieter\s+(.*?)\s+Objektbeschreibung",
        r"Anbieter\s+(.*?)\s+Kosten",
    ):
        m = re.search(pattern, text, flags=re.S | re.I)
        if m:
            return re.sub(r"\s+", " ", m.group(1)).strip()
    return "KIP München"


def _extract_address(text: str, soup: BeautifulSoup) -> str | None:
    match = re.search(r"([A-Za-zÄÖÜäöüß\-\. ]+,\s*8\d{4}\s+München(?:\s*\([^\)]+\))?)", text)
    if match:
        return match.group(1).strip()

    match = re.search(r"(8\d{4}\s+München(?:\s*\([^\)]+\))?)", text)
    if match:
        return match.group(1).strip()

    addr_el = soup.find(string=re.compile(r"8\d{4}\s+München|München", re.I))
    if addr_el:
        return str(addr_el).strip()[:200]
    return None


def _extract_district(text: str, address: str | None) -> str | None:
    for hay in filter(None, [text, address]):
        m = re.search(r"München\s*\(([^\)]+)\)", hay)
        if m:
            return m.group(1).strip()
    return None


def _collect_detail(url: str, session: requests.Session):
    r = session.get(url, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    text = soup.get_text("\n", strip=True)

    provider_text = _extract_provider_text(text)

    title = None
    if soup.title:
        title = soup.title.get_text(" ", strip=True).split("(")[0].strip()
    if not title:
        h1 = soup.find(["h1", "h2"])
        title = h1.get_text(" ", strip=True)[:300] if h1 else None

    address = _extract_address(text, soup)
    if not address or "München" not in address:
        return None

    sid_match = re.search(r"Objekt-ID:\s*([A-Z]\d+)", text)
    sid = sid_match.group(1) if sid_match else url.rstrip("/").split("_")[-1]

    price, area, rooms, ppsqm = _extract_numbers(text)

    image = None
    og = soup.select_one("meta[property='og:image']")
    if og and og.get("content"):
        image = urljoin(url, og.get("content"))

    district = _extract_district(text, address)
    postal_match = re.search(r"\b(8\d{4})\b", address or "")
    postal = postal_match.group(1) if postal_match else None

    now = utc_now()
    return {
        "source": "kip_muenchen",
        "source_listing_id": sid,
        "url": url,
        "title": title[:300] if title else None,
        "description": text[:1200],
        "image_url": image,
        "price_eur": price,
        "area_sqm": area,
        "rooms": rooms,
        "price_per_sqm": ppsqm,
        "address": address[:500] if address else None,
        "city": "München",
        "district": district or (f"{postal} München" if postal else "München"),
        "raw_district_text": district,
        "postal_code": postal,
        "source_payload_debug": {
            "provider_text": provider_text[:1000],
            "provider_private_like": _provider_is_private_like(provider_text),
            "source_kind": "kommunales_portal",
        },
        "first_seen_at": now,
        "last_seen_at": now,
    }


def collect_kip_munich_listings() -> list[dict]:
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0", "Accept-Language": "de-DE,de;q=0.9"})
    rows = []
    seen = set()
    detail_paths: list[str] = []

    for page in SEARCH_URLS:
        r = session.get(page, timeout=30)
        r.raise_for_status()
        html = r.text
        for path in _DETAIL_PATH_RE.findall(html):
            if path not in seen:
                seen.add(path)
                detail_paths.append(path)

    for path in detail_paths[:60]:
        try:
            item = _collect_detail(urljoin(BASE, path), session)
        except Exception:
            item = None
        if item:
            rows.append(item)

    print(f"INFO kip_muenchen parser: detail_paths={len(detail_paths)} rows={len(rows)}")
    return rows
