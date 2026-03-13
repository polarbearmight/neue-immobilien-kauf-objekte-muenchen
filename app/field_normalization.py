from __future__ import annotations

from datetime import datetime


def normalize_price(price: float | None) -> float | None:
    if price is None:
        return None
    p = float(price)
    if p <= 0 or p < 50000 or p > 20000000:
        return None
    return p


def normalize_area(area: float | None) -> float | None:
    if area is None:
        return None
    a = float(area)
    if a <= 0 or a < 15 or a > 1000:
        return None
    return a


def normalize_rooms(rooms: float | None) -> float | None:
    if rooms is None:
        return None
    r = float(rooms)
    if r <= 0 or r < 0.5 or r > 20:
        return None
    return r


def normalize_posted_at(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    if not s:
        return None
    # best effort: keep as-is if parsing fails in DB layer
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def compute_ppsqm(price: float | None, area: float | None) -> float | None:
    if price is None or area is None or area <= 0:
        return None
    return round(float(price) / float(area), 2)
