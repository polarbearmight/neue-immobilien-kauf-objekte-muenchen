from __future__ import annotations


def quality_flags(row: dict) -> list[str]:
    flags: list[str] = []
    if not row.get("title"):
        flags.append("missing_title")
    if not row.get("url"):
        flags.append("missing_url")
    if not row.get("district"):
        flags.append("missing_district")
    if not row.get("postal_code"):
        flags.append("missing_postal_code")
    if row.get("price_eur") is None:
        flags.append("missing_price")
    if row.get("area_sqm") is None:
        flags.append("missing_area")
    if row.get("rooms") is None:
        flags.append("missing_rooms")
    if row.get("latitude") is None or row.get("longitude") is None:
        flags.append("missing_coords")
    return flags
