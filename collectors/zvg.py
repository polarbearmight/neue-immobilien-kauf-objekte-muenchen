from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.time_utils import utc_now

SEARCH_URL = "https://www.zvg-portal.de/index.php?button=Suchen"
BASE_URL = "https://www.zvg-portal.de/"
MUNICH_COURT_ID = "D2601"
MUNICH_COURT_NAME = "München"
MUNICH_OBJECT_TYPES = ["3", "4", "5", "6", "7", "15", "16"]


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


def _parse_german_dt(text: str) -> datetime | None:
    if not text:
        return None
    months = {
        "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4, "mai": 5, "juni": 6,
        "juli": 7, "august": 8, "september": 9, "oktober": 10, "november": 11, "dezember": 12,
    }
    m = re.search(r"(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4}),\s*(\d{1,2}):(\d{2})", text)
    if not m:
        return None
    month = months.get(m.group(2).lower())
    if not month:
        return None
    return datetime(int(m.group(3)), month, int(m.group(1)), int(m.group(4)), int(m.group(5)), tzinfo=timezone.utc)


def _extract_district(address: str) -> str | None:
    if not address:
        return None
    m = re.search(r"\(([^\)]+)\)", address)
    return m.group(1).strip() if m else None


def _extract_postal_code(address: str) -> str | None:
    m = re.search(r"\b(8\d{4})\b", address or "")
    return m.group(1) if m else None


def _is_munich_address(address: str) -> bool:
    a = (address or "").lower()
    if "münchen" in a or "muenchen" in a:
        return True
    plz = _extract_postal_code(address)
    if plz and (plz.startswith("80") or plz.startswith("81")):  # München core postal ranges
        return True
    return False


def _fetch_results_page(session: requests.Session) -> str:
    payload = {
        "ger_name": MUNICH_COURT_NAME,
        "order_by": "2",
        "land_abk": "by",
        "ger_id": MUNICH_COURT_ID,
        "az1": "", "az2": "", "az3": "", "az4": "",
        "art": "",
        "obj": "",
        "obj_arr[]": MUNICH_OBJECT_TYPES,
        "obj_liste": "5",
        "str": "", "hnr": "", "plz": "", "ort": "", "ortsteil": "",
        "hinweis": "", "vtermin": "", "btermin": "",
    }
    r = session.post(SEARCH_URL, data=payload, timeout=30)
    r.raise_for_status()
    return r.text


def _parse_entry(entry: dict, now: datetime) -> dict | None:
    docket = (entry.get("aktenzeichen") or "").replace("(Detailansicht)", "").strip()
    if not docket or not entry.get("detail_url") or not entry.get("object_type") or not entry.get("address"):
        return None

    value_text = entry.get("verkehrswert_text") or ""
    numeric_candidates = [_to_num(x) for x in re.findall(r"\d[\d\.,]*", value_text)]
    numeric_candidates = [x for x in numeric_candidates if x]
    price_eur = max(numeric_candidates) if numeric_candidates else None

    address = entry["address"].strip()
    if not _is_munich_address(address):
        return None
    object_type = entry["object_type"].strip()
    district = _extract_district(address)
    term_text = (entry.get("termin_text") or "").strip()
    title = f"ZVG {object_type} · {address}"

    return {
        "source": "auction_zvg_portal",
        "source_listing_id": entry["zvg_id"],
        "url": entry["detail_url"],
        "title": title[:300],
        "raw_title": title[:300],
        "description": f"{object_type} · {address} · Termin: {term_text}"[:800],
        "raw_description": f"Aktenzeichen: {docket} · Verkehrswert: {value_text} · Termin: {term_text}"[:1800],
        "address": address[:500],
        "city": "München",
        "district": district or "München",
        "raw_district_text": district,
        "postal_code": _extract_postal_code(address),
        "price_eur": price_eur,
        "area_sqm": None,
        "rooms": None,
        "price_per_sqm": None,
        "posted_at": _parse_german_dt(term_text),
        "first_seen_at": now,
        "last_seen_at": now,
        "source_payload_debug": {
            "aktenzeichen": docket,
            "gericht": entry.get("gericht") or "München in Bayern",
            "verkehrswert_text": value_text,
            "termin_text": term_text,
            "attachment_pdf_url": entry.get("pdf_url"),
            "updated_text": entry.get("updated_text"),
            "object_type": object_type,
        },
        "quality_flags": "auction,zvg,munich",
    }


def collect_zvg_munich_listings() -> list[dict]:
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0", "Accept-Language": "de-DE,de;q=0.9"})
    html = _fetch_results_page(session)
    soup = BeautifulSoup(html, "html.parser")
    trs = soup.find_all("tr")

    rows: list[dict] = []
    now = utc_now()
    current: dict = {}

    for tr in trs:
        cells = tr.find_all("td")
        if not cells:
            continue
        label = cells[0].get_text(" ", strip=True)
        text = tr.get_text(" | ", strip=True)

        if label == "Aktenzeichen":
            if current:
                item = _parse_entry(current, now)
                if item:
                    rows.append(item)
            current = {}
            current["aktenzeichen"] = cells[1].get_text(" ", strip=True) if len(cells) > 1 else text
            current["updated_text"] = re.search(r"letzte Aktualisierung\s*(\d{2}-\d{2}-\d{4}\s*\d{2}:\d{2})", text).group(1) if re.search(r"letzte Aktualisierung\s*(\d{2}-\d{2}-\d{4}\s*\d{2}:\d{2})", text) else None
            a = tr.find("a", href=True)
            href = a.get("href") if a else None
            m = re.search(r"button=showZvg(?:&|&amp;)zvg_id=(\d+)(?:&|&amp;)land_abk=([a-z]+)", href or "")
            if m:
                current["zvg_id"] = m.group(1)
                current["detail_url"] = f"https://www.zvg-portal.de/index.php?button=showZvg&zvg_id={m.group(1)}&land_abk={m.group(2)}"
            else:
                current["zvg_id"] = None
                current["detail_url"] = None
            continue

        if not current:
            continue

        if label == "Amtsgericht":
            current["gericht"] = cells[1].get_text(" ", strip=True) if len(cells) > 1 else text
        elif label == "Objekt/Lage":
            combined = " ".join(td.get_text(" ", strip=True) for td in cells[1:]).strip()
            if " : " in combined:
                object_type, address = combined.split(" : ", 1)
                current["object_type"] = object_type.strip()
                current["address"] = address.strip()
            else:
                current["object_type"] = combined.strip()
        elif label.startswith("Verkehrswert"):
            current["verkehrswert_text"] = " ".join(td.get_text(" ", strip=True) for td in cells[1:]).strip()
        elif label == "Termin":
            current["termin_text"] = " ".join(td.get_text(" ", strip=True) for td in cells[1:]).strip()
        elif label == "Amtliche Bekanntmachung":
            link = tr.find("a", href=True)
            if link:
                current["pdf_url"] = urljoin(BASE_URL, link.get("href"))

    if current:
        item = _parse_entry(current, now)
        if item:
            rows.append(item)

    return [r for r in rows if r.get("source_listing_id") and r.get("price_eur")]
