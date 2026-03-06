from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from sqlalchemy import select

from app.models import Listing
from app.time_utils import utc_now


def geo_cells(db, window: str = "30d", precision: int = 2):
    now = utc_now()
    since = None
    if window == "24h":
        since = now - timedelta(hours=24)
    elif window == "7d":
        since = now - timedelta(days=7)
    elif window == "30d":
        since = now - timedelta(days=30)

    q = select(Listing).where(Listing.is_active.is_(True), Listing.latitude.is_not(None), Listing.longitude.is_not(None))
    if since:
        q = q.where(Listing.first_seen_at >= since)

    rows = db.execute(q).scalars().all()
    buckets: dict[str, list[Listing]] = defaultdict(list)
    for r in rows:
        key = f"{round(float(r.latitude), precision)}:{round(float(r.longitude), precision)}"
        buckets[key].append(r)

    out = []
    for cell, items in buckets.items():
        lat, lon = cell.split(":")
        ppsqm_vals = [float(x.price_per_sqm) for x in items if x.price_per_sqm is not None]
        avg_ppsqm = (sum(ppsqm_vals) / len(ppsqm_vals)) if ppsqm_vals else None
        avg_deal = [float(x.deal_score) for x in items if x.deal_score is not None]
        avg_deal_score = (sum(avg_deal) / len(avg_deal)) if avg_deal else None
        top_deals = sum(1 for x in items if (x.deal_score or 0) >= 85)
        off_market = sum(1 for x in items if (x.off_market_score or 0) >= 72)
        out.append({
            "cell": cell,
            "lat": float(lat),
            "lon": float(lon),
            "listing_count": len(items),
            "median_price_per_sqm": round(avg_ppsqm, 2) if avg_ppsqm else None,
            "average_deal_score": round(avg_deal_score, 2) if avg_deal_score else None,
            "top_deal_count": int(top_deals),
            "off_market_count": int(off_market),
        })

    out.sort(key=lambda x: x["listing_count"], reverse=True)
    return out
