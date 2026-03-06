from __future__ import annotations

import json
from datetime import timedelta
from sqlalchemy import select, func

from app.models import Listing, ListingSnapshot
from app.time_utils import ensure_utc, utc_now


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def compute_score(listing: Listing, city_median: float | None, has_price_drop: bool = False, district_median: float | None = None) -> tuple[float | None, list[str], dict]:
    if not listing.price_per_sqm or not city_median or city_median <= 0:
        return None, [], {"reason": "missing_median_or_ppsqm"}

    now = utc_now()
    listing_ts = ensure_utc(listing.posted_at or listing.first_seen_at)
    age_h = (now - listing_ts).total_seconds() / 3600.0

    median_used = district_median if district_median and district_median > 0 else city_median
    price_advantage = (median_used - listing.price_per_sqm) / median_used
    price_component = 60 * _clamp(price_advantage / 0.35, -1, 1)  # [-60,+60]

    size = listing.area_sqm or 0
    size_component = 0.0
    if 45 <= size <= 120:
        size_component = 8
    elif size > 0 and (size < 25 or size > 180):
        size_component = -6

    freshness_component = 0.0
    badges: list[str] = []
    if age_h <= 2:
        freshness_component = 10
        badges.append("JUST_LISTED")
    elif age_h <= 6:
        freshness_component = 6
        badges.append("BRAND_NEW")
    elif age_h <= 24:
        freshness_component = 3
        badges.append("NEW_TODAY")

    liquidity_component = 0.0
    if has_price_drop:
        liquidity_component += 8
        badges.append("PRICE_DROP")

    risk_penalty = 0.0
    if (listing.area_sqm or 0) < 20:
        risk_penalty += 18
    if (listing.price_per_sqm or 0) < 2000:
        risk_penalty += 20
    if listing.price_eur and listing.price_eur < 50000:
        risk_penalty += 16

    location_conf = float(getattr(listing, "location_confidence", 0) or 0)
    district_val = (getattr(listing, "district", None) or "").strip().lower()
    if location_conf < 50:
        risk_penalty += 12
    if district_val in ("", "münchen", "munchen"):
        risk_penalty += 6

    title_val = (getattr(listing, "title", None) or "").strip().lower()
    generic_titles = {"wohnung zum kauf", "haus zum kauf", "penthouse zum kauf"}
    if title_val in generic_titles:
        risk_penalty += 8

    if risk_penalty > 0:
        badges.append("CHECK")

    raw = 50 + price_component + size_component + freshness_component + liquidity_component - risk_penalty
    score = round(_clamp(raw, 0, 100), 2)

    if "CHECK" in badges and score > 84:
        score = 84.0

    if listing.price_per_sqm <= 9000:
        badges.append("UNDER_9000")
    elif listing.price_per_sqm <= 12000:
        badges.append("UNDER_12000")

    if score >= 92:
        badges.append("ULTRA_DEAL")
    elif score >= 85:
        badges.append("TOP_DEAL")

    if district_median and district_median > 0 and listing.price_per_sqm < district_median * 0.9:
        raw += 4
        score = round(_clamp(raw, 0, 100), 2)

    if district_median and district_median > 0 and district_median > city_median * 1.15 and listing.price_per_sqm > district_median * 0.97:
        score = min(score, 82.0)

    explain = {
        "median_used": median_used,
        "weights": {
            "price_component": round(price_component, 2),
            "size_component": round(size_component, 2),
            "freshness_component": round(freshness_component, 2),
            "liquidity_component": round(liquidity_component, 2),
            "risk_penalty": round(risk_penalty, 2),
        },
        "price_advantage": round(price_advantage, 4),
        "age_hours": round(age_h, 2),
        "final": score,
    }
    return score, sorted(set(badges)), explain


def recompute_scores(db, window_days: int = 14) -> int:
    since = utc_now() - timedelta(days=window_days)
    city_median = db.scalar(select(func.avg(Listing.price_per_sqm)).where(Listing.first_seen_at >= since, Listing.price_per_sqm.is_not(None)))
    rows = db.execute(select(Listing).where(Listing.price_per_sqm.is_not(None))).scalars().all()
    district_rows = db.execute(
        select(Listing.district, func.avg(Listing.price_per_sqm))
        .where(Listing.price_per_sqm.is_not(None), Listing.district.is_not(None))
        .group_by(Listing.district)
    ).all()
    district_medians = {d: float(v) for d, v in district_rows if d and v}

    count = 0
    for row in rows:
        snaps = db.execute(
            select(ListingSnapshot)
            .where(ListingSnapshot.listing_id == row.id, ListingSnapshot.price_eur.is_not(None))
            .order_by(ListingSnapshot.captured_at.desc())
            .limit(2)
        ).scalars().all()
        has_price_drop = False
        if len(snaps) >= 2 and snaps[0].price_eur and snaps[1].price_eur and snaps[1].price_eur > 0:
            drop_ratio = (snaps[1].price_eur - snaps[0].price_eur) / snaps[1].price_eur
            has_price_drop = drop_ratio >= 0.05

        score, badges, explain = compute_score(
            row,
            city_median,
            has_price_drop=has_price_drop,
            district_median=district_medians.get(row.district),
        )
        row.deal_score = score
        row.badges = json.dumps(badges, ensure_ascii=False)
        row.score_explain = json.dumps(explain, ensure_ascii=False)
        count += 1
    db.commit()
    return count
