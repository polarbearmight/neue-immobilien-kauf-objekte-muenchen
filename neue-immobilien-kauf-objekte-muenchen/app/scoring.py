from __future__ import annotations

import json
from datetime import datetime, timedelta
from sqlalchemy import select, func

from app.models import Listing, ListingSnapshot


def compute_score(listing: Listing, city_median: float | None, has_price_drop: bool = False) -> tuple[float | None, list[str], dict]:
    if not listing.price_per_sqm or not city_median or city_median <= 0:
        return None, [], {"reason": "missing_median_or_ppsqm"}

    now = datetime.utcnow()
    age_h = (now - (listing.posted_at or listing.first_seen_at)).total_seconds() / 3600.0
    price_advantage = (city_median - listing.price_per_sqm) / city_median
    base = 50 + 50 * max(-1, min(1, price_advantage / 0.25))

    bonuses: list[tuple[str, float]] = []
    penalties: list[tuple[str, float]] = []
    badges: list[str] = []

    if age_h <= 2:
        bonuses.append(("just_listed", 10))
        badges.append("JUST_LISTED")
    elif age_h <= 6:
        bonuses.append(("brand_new", 6))
        badges.append("BRAND_NEW")
    elif age_h <= 24:
        bonuses.append(("new_today", 3))
        badges.append("NEW_TODAY")

    if listing.price_per_sqm <= 9000:
        badges.append("UNDER_9000")
    elif listing.price_per_sqm <= 12000:
        badges.append("UNDER_12000")

    if has_price_drop:
        bonuses.append(("price_drop", 8))
        badges.append("PRICE_DROP")

    if (listing.area_sqm or 0) < 20 or (listing.price_per_sqm or 0) < 2000:
        penalties.append(("suspicious", 20))
        badges.append("CHECK")

    score = base + sum(v for _, v in bonuses) - sum(v for _, v in penalties)
    score = max(0, min(100, score))

    if score >= 92:
        badges.append("ULTRA_DEAL")
    elif score >= 85:
        badges.append("TOP_DEAL")

    explain = {
        "median_used": city_median,
        "price_advantage": round(price_advantage, 4),
        "base": round(base, 2),
        "bonuses": bonuses,
        "penalties": penalties,
        "final": round(score, 2),
    }
    return round(score, 2), sorted(set(badges)), explain


def recompute_scores(db, window_days: int = 14) -> int:
    since = datetime.utcnow() - timedelta(days=window_days)
    city_median = db.scalar(select(func.avg(Listing.price_per_sqm)).where(Listing.first_seen_at >= since, Listing.price_per_sqm != None))
    rows = db.execute(select(Listing).where(Listing.price_per_sqm != None)).scalars().all()
    count = 0
    for row in rows:
        snaps = db.execute(
            select(ListingSnapshot)
            .where(ListingSnapshot.listing_id == row.id, ListingSnapshot.price_eur != None)
            .order_by(ListingSnapshot.captured_at.desc())
            .limit(2)
        ).scalars().all()
        has_price_drop = False
        if len(snaps) >= 2 and snaps[0].price_eur and snaps[1].price_eur and snaps[1].price_eur > 0:
            drop_ratio = (snaps[1].price_eur - snaps[0].price_eur) / snaps[1].price_eur
            has_price_drop = drop_ratio >= 0.05

        score, badges, explain = compute_score(row, city_median, has_price_drop=has_price_drop)
        row.deal_score = score
        row.badges = json.dumps(badges, ensure_ascii=False)
        row.score_explain = json.dumps(explain, ensure_ascii=False)
        count += 1
    db.commit()
    return count
