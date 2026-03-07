from __future__ import annotations

from app.location_resolver import MUNICH_UNKNOWN_DISTRICT, resolve_location


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
                "district_raw": r.district,
                "address": r.address,
                "postal_code": r.postal_code,
                "latitude": r.latitude,
                "longitude": r.longitude,
                # retained for adapter parity; DB rows may not have it
                "city": None,
                "structured_data_json": None,
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
