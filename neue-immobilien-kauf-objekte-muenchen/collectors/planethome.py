import re
from datetime import datetime

import httpx

from collectors.base import AccessBlockedError, SafeCollector

SEARCH_URL = "https://planethome.de/immobiliensuche"
API_URL = "https://api.planethome.com/property-search-index-service/graphql"


def _to_num(val: str | None) -> float | None:
    if not val:
        return None
    try:
        return float(str(val).replace(".", "").replace(",", "."))
    except Exception:
        return None


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
                # keep dataset focused on Munich listings
                if "münchen" not in city.lower() and "muenchen" not in city.lower():
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

                if ppsqm is None and price and area:
                    ppsqm = round(price / area, 2)

                detail_url = f"https://planethome.de/objekt-detailseite?propertyId={provider_id}&portal=ph-de"

                rows.append(
                    {
                        "source": "planethome",
                        "source_listing_id": provider_id,
                        "url": detail_url,
                        "title": (it.get("title") or "").strip()[:300] or None,
                        "description": (it.get("description") or "")[:500] or None,
                        "image_url": prop.get("mainImagePublicUrl"),
                        "district": city or None,
                        "price_eur": price,
                        "area_sqm": area,
                        "rooms": rooms,
                        "price_per_sqm": ppsqm,
                        "first_seen_at": datetime.utcnow(),
                        "last_seen_at": datetime.utcnow(),
                    }
                )
                if len(rows) >= 120:
                    break

            if not data.get("hasNextPage"):
                break
            offset += limit

    print(f"INFO planethome parser(graphql): rows={len(rows)}")
    return rows
