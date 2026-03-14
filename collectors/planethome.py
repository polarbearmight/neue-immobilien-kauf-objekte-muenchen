import json
import re
from bs4 import BeautifulSoup

from app.time_utils import utc_now
import httpx

from collectors.base import AccessBlockedError, SafeCollector

SEARCH_URL = "https://planethome.de/immobiliensuche"
API_URL = "https://api.planethome.com/property-search-index-service/graphql"


def _to_num(val) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return None
    try:
        # de-DE formatted strings like "1.234.567,89"
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
        return float(s)
    except Exception:
        return None


def _extract_detail_fields(client: httpx.Client, url: str) -> dict:
    try:
        html = client.get(url).text
    except Exception:
        return {"price": None, "district": None, "postal_code": None, "address": None, "structured_data_json": None}
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    m = re.search(r"([\d\.,]{3,})\s*€", text)
    price = _to_num(m.group(1)) if m else None

    district = None
    title = (soup.title.get_text(" ", strip=True) if soup.title else "") or text[:300]
    for pattern in (
        r"München[-\s/]([A-ZÄÖÜa-zäöüß\-]+)",
        r"in\s+München[-\s/]([A-ZÄÖÜa-zäöüß\-]+)",
        r"\b(Glockenbach|Neuperlach|Fröttmaning|Bogenhausen|Schwabing|Hadern|Pasing|Sendling|Laim|Solln|Harlaching|Giesing|Perlach|Riem|Trudering|Nymphenburg|Neuhausen)\b",
    ):
        mm = re.search(pattern, title, flags=re.I)
        if mm:
            district = mm.group(1)
            break

    postal_match = re.search(r"\b(8\d{4})\b", text)
    postal = postal_match.group(1) if postal_match else None
    address = f"{postal} München" if postal else None

    structured = None
    for sc in soup.select("script[type='application/ld+json']"):
        raw = (sc.string or sc.get_text() or "").strip()
        if not raw:
            continue
        try:
            structured = json.loads(raw)
            break
        except Exception:
            continue

    return {"price": price, "district": district, "postal_code": postal, "address": address, "structured_data_json": structured}


def collect_planethome_listings() -> list[dict]:
    c = SafeCollector()
    c.assert_allowed("https://planethome.de/robots.txt", "/immobiliensuche")
    try:
        # warmup/canonical availability check
        c.get(SEARCH_URL)
    except AccessBlockedError as e:
        print(f"WARN planethome blocked: {e}")
        return []

    query = """
    query searchPublicPropertySales($propertySearchInput: PropertySearchInput!, $paging: Pagination!) {
      searchPublicPropertySales(propertySearchInput: $propertySearchInput, paging: $paging) {
        totalCount
        hasNextPage
        items {
          id
          providerPropertyId
          portal
          uuid
          title
          description
          tradeType
          usageType
          sold
          hide
          price {
            totalPurchasePrice
            purchasePricePerSqm
          }
          property {
            mainImagePublicUrl
            area {
              livingArea
              totalArea
            }
            premises {
              roomNumbers {
                numberOfRooms
              }
            }
            address {
              zipcode
              city
            }
          }
        }
      }
    }
    """

    rows = []
    seen = set()
    limit = 60
    offset = 0

    with httpx.Client(timeout=30) as client:
        while len(rows) < 120:
            payload = {
                "query": query,
                "variables": {
                    "propertySearchInput": {"portal": "ph-de"},
                    "paging": {"offset": offset, "limit": limit},
                },
            }
            resp = client.post(API_URL, json=payload, headers={"tenant": "ph-de"})
            resp.raise_for_status()
            data = resp.json().get("data", {}).get("searchPublicPropertySales", {})
            items = data.get("items") or []
            if not items:
                break

            for it in items:
                if it.get("hide") or it.get("sold"):
                    continue
                if it.get("tradeType") != "PURCHASE":
                    continue
                if it.get("usageType") not in ("LIVING", "INVESTMENT"):
                    continue

                prop = it.get("property") or {}
                addr = prop.get("address") or {}
                city = (addr.get("city") or "").strip()
                city_low = city.lower()
                # keep dataset focused on the city of Munich, not surrounding municipalities like Garching bei München
                if city_low not in {"münchen", "muenchen"}:
                    continue

                provider_id = str(it.get("providerPropertyId") or it.get("id") or "")
                if not provider_id or provider_id in seen:
                    continue
                seen.add(provider_id)

                price = _to_num((it.get("price") or {}).get("totalPurchasePrice"))
                ppsqm = _to_num((it.get("price") or {}).get("purchasePricePerSqm"))
                area_raw = (prop.get("area") or {}).get("livingArea") or (prop.get("area") or {}).get("totalArea")
                area = _to_num(area_raw)
                rooms = _to_num((((prop.get("premises") or {}).get("roomNumbers") or {}).get("numberOfRooms")))

                if (ppsqm is None or ppsqm <= 0) and price and area:
                    ppsqm = round(price / area, 2)

                detail_url = f"https://planethome.de/objekt-detailseite?propertyId={provider_id}&portal=ph-de"
                title = (it.get("title") or "").strip()[:300] or None
                needs_detail = price is None or not addr.get("zipcode") or (title and "münchen-" in title.lower()) or (title and "/münchen" in title.lower())
                detail = _extract_detail_fields(client, detail_url) if needs_detail else {"price": None, "district": None, "postal_code": None, "address": None, "structured_data_json": None}
                if price is None:
                    price = detail.get("price")
                    if (ppsqm is None or ppsqm <= 0) and price and area:
                        ppsqm = round(price / area, 2)

                district = detail.get("district") or city or None
                postal_code = detail.get("postal_code") or (addr.get("zipcode") or None)
                address = detail.get("address")

                rows.append(
                    {
                        "source": "planethome",
                        "source_listing_id": provider_id,
                        "url": detail_url,
                        "title": title,
                        "description": (it.get("description") or "")[:500] or None,
                        "image_url": prop.get("mainImagePublicUrl"),
                        "district": district,
                        "raw_district_text": district,
                        "postal_code": postal_code,
                        "address": address,
                        "city": city or None,
                        "price_eur": price,
                        "area_sqm": area,
                        "rooms": rooms,
                        "price_per_sqm": ppsqm,
                        "source_payload_debug": {"structured_data_json": detail.get("structured_data_json"), "raw_address": address, "raw_district_text": district, "city": city or None},
                        "first_seen_at": utc_now(),
                        "last_seen_at": utc_now(),
                    }
                )
                if len(rows) >= 120:
                    break

            if not data.get("hasNextPage"):
                break
            offset += limit

    print(f"INFO planethome parser(graphql): rows={len(rows)}")
    return rows
