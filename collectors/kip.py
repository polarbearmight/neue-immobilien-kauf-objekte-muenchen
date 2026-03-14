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


def _extract_numbers(text: str):
    price = _to_num(re.search(r"Kaufpreis\s*([\d\.,]+)", text, flags=re.I).group(1) if re.search(r"Kaufpreis\s*([\d\.,]+)", text, flags=re.I) else None)
    area = _to_num(re.search(r"Wohnfl[äa]che.*?([\d\.,]+)\s*m²", text, flags=re.I | re.S).group(1) if re.search(r"Wohnfl[äa]che.*?([\d\.,]+)\s*m²", text, flags=re.I | re.S) else None)
    rooms = _to_num(re.search(r"Zimmer\s*([\d\.,]+)", text, flags=re.I).group(1) if re.search(r"Zimmer\s*([\d\.,]+)", text, flags=re.I) else None)
    ppsqm = round(price / area, 2) if price and area else None
    return price, area, rooms, ppsqm


def _provider_is_private_like(text: str) -> bool:
    t = (text or "").lower()
    hints = [
        "ohne-makler",
        "von privat",
        "privat",
        "angebot von",
    ]
    return any(h in t for h in hints) and "immobilienmakler" not in t


def _collect_detail(url: str, session: requests.Session):
    r = session.get(url, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    text = soup.get_text("\n", strip=True)

    provider_text = ""
    m_provider = re.search(r"Anbieter\s+(.*?)\s+Ansprechpartner", text, flags=re.S | re.I)
    if m_provider:
        provider_text = re.sub(r"\s+", " ", m_provider.group(1)).strip()
    if not provider_text:
        provider_text = "KIP München"

    title = None
    if soup.title:
        title = soup.title.get_text(" ", strip=True).split("(")[0].strip()
    if not title:
        h1 = soup.find(["h1", "h2"])
        title = h1.get_text(" ", strip=True)[:300] if h1 else None

    address_match = re.search(r"(8\d{4}\s+München[^\n]*)", text)
    address = address_match.group(1).strip() if address_match else None
    if not address:
        addr_el = soup.find(string=re.compile(r"München", re.I))
        address = str(addr_el).strip()[:200] if addr_el else None
    if not address or "München" not in address:
        return None

    sid_match = re.search(r"Objekt-ID:\s*([A-Z]\d+)", text)
    sid = sid_match.group(1) if sid_match else url.rstrip("/").split("_")[-1]

    price, area, rooms, ppsqm = _extract_numbers(text)

    image = None
    og = soup.select_one("meta[property='og:image']")
    if og and og.get("content"):
        image = urljoin(url, og.get("content"))

    district = None
    m = re.search(r"München\s*\(([^\)]+)\)", text)
    if m:
        district = m.group(1).strip()

    now = utc_now()
    return {
        "source": "kip_muenchen",
        "source_listing_id": sid,
        "url": url,
        "title": title[:300] if title else None,
        "description": text[:800],
        "image_url": image,
        "price_eur": price,
        "area_sqm": area,
        "rooms": rooms,
        "price_per_sqm": ppsqm,
        "address": address[:500] if address else None,
        "city": "München",
        "district": district or "München",
        "raw_district_text": district,
        "postal_code": re.search(r"\b(8\d{4})\b", address or "").group(1) if re.search(r"\b(8\d{4})\b", address or "") else None,
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
        for path in re.findall(r'/bayern/muenchen/kaufen/[A-Za-zÄÖÜäöü]+_[A-Z]\d+|/bayern/muenchen/bauen/[A-Za-zÄÖÜäöü]+_[A-Z]\d+', html):
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
