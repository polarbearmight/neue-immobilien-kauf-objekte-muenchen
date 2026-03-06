from __future__ import annotations

from app.district_analytics import district_metrics


def geo_summary(db, window: str = "30d", min_score: float = 0, source: str | None = None, district: str | None = None):
    rows = district_metrics(db, window=window, min_score=min_score, source=source, district_filter=district)
    total_listings = sum(r["listing_count"] for r in rows)
    top_deals = sum(r["top_deal_count"] for r in rows)
    off_market = sum(1 for r in rows if (r.get("average_off_market_score") or 0) >= 72)
    return {
        "window": window,
        "districts": len(rows),
        "total_listings": total_listings,
        "top_deals": top_deals,
        "hotspots": sorted(rows, key=lambda x: x["hotspot_score"], reverse=True)[:5],
        "off_market_districts": off_market,
    }


def geo_hotspots(db, window: str = "30d", min_score: float = 0, source: str | None = None, district: str | None = None):
    rows = district_metrics(db, window=window, min_score=min_score, source=source, district_filter=district)
    return sorted(rows, key=lambda x: x["hotspot_score"], reverse=True)[:5]
