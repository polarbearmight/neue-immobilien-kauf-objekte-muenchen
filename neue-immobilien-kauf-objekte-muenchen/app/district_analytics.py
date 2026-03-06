from __future__ import annotations

from datetime import timedelta
from statistics import median
from sqlalchemy import select

from app.models import Listing
from app.time_utils import ensure_utc, utc_now


def _since_for_window(window: str):
    now = utc_now()
    if window == "24h":
        return now - timedelta(hours=24)
    if window == "7d":
        return now - timedelta(days=7)
    if window == "30d":
        return now - timedelta(days=30)
    return None


def district_metrics(db, window: str = "30d", min_score: float = 0, source: str | None = None, district_filter: str | None = None):
    since = _since_for_window(window)
    q = select(Listing).where(Listing.is_active.is_(True), Listing.district.is_not(None))
    if since:
        q = q.where(Listing.first_seen_at >= since)
    if min_score > 0:
        q = q.where(Listing.deal_score.is_not(None), Listing.deal_score >= min_score)
    if source and source != "all":
        q = q.where(Listing.source == source)
    if district_filter and district_filter != "all":
        q = q.where(Listing.district == district_filter)

    rows = db.execute(q).scalars().all()

    bucket: dict[str, list[Listing]] = {}
    for r in rows:
        bucket.setdefault(r.district or "München", []).append(r)

    out = []
    now = utc_now()
    for d, items in bucket.items():
        ppsqm = [float(x.price_per_sqm) for x in items if x.price_per_sqm is not None]
        median_ppsqm = median(ppsqm) if ppsqm else None
        avg_ppsqm = (sum(ppsqm) / len(ppsqm)) if ppsqm else None

        deal_scores = [float(x.deal_score) for x in items if x.deal_score is not None]
        avg_deal = (sum(deal_scores) / len(deal_scores)) if deal_scores else None

        off_scores = [float(x.off_market_score) for x in items if x.off_market_score is not None]
        avg_off = (sum(off_scores) / len(off_scores)) if off_scores else None

        top_deals = sum(1 for x in items if (x.deal_score or 0) >= 85)
        just_listed = sum(1 for x in items if (now - ensure_utc(x.first_seen_at)).total_seconds() <= 24 * 3600)

        price_drops = 0
        for x in items:
            b = (x.badges or "")
            if "PRICE_DROP" in b:
                price_drops += 1

        under_median = 0
        if median_ppsqm:
            for x in items:
                if x.price_per_sqm is not None and x.price_per_sqm < median_ppsqm:
                    under_median += 1

        deal_density_score = min(
            100.0,
            top_deals * 6.0
            + under_median * 2.5
            + just_listed * 2.0
            + sum(1 for x in items if (x.off_market_score or 0) >= 72) * 2.2,
        )

        hotspot_score = min(
            100.0,
            deal_density_score
            + ((avg_off or 0) * 0.2)
            + just_listed * 1.2
            - ((avg_ppsqm or 0) / 1500.0),
        )

        trend = "flat"
        if median_ppsqm and avg_ppsqm:
            if avg_ppsqm < median_ppsqm * 0.97:
                trend = "down"
            elif avg_ppsqm > median_ppsqm * 1.03:
                trend = "up"

        out.append(
            {
                "district": d,
                "listing_count": len(items),
                "active_listing_count": len(items),
                "median_price_per_sqm": round(median_ppsqm, 2) if median_ppsqm else None,
                "average_price_per_sqm": round(avg_ppsqm, 2) if avg_ppsqm else None,
                "average_deal_score": round(avg_deal, 2) if avg_deal else None,
                "average_off_market_score": round(avg_off, 2) if avg_off else None,
                "top_deal_count": int(top_deals),
                "just_listed_count": int(just_listed),
                "price_drop_count": int(price_drops),
                "under_median_count": int(under_median),
                "deal_density_score": round(deal_density_score, 2),
                "hotspot_score": round(max(0.0, hotspot_score), 2),
                "trend": trend,
            }
        )

    out.sort(key=lambda x: (x["hotspot_score"], x["listing_count"]), reverse=True)
    return out
