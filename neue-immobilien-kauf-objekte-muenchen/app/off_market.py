from __future__ import annotations

import json
from collections import Counter
from sqlalchemy import select

from app.models import Listing
from app.time_utils import ensure_utc, utc_now


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def recompute_off_market(db) -> int:
    rows = db.execute(select(Listing).where(Listing.is_active.is_(True))).scalars().all()
    if not rows:
        return 0

    source_counts = Counter([r.source for r in rows if r.source])
    max_source = max(source_counts.values()) if source_counts else 1

    cluster_counts = Counter([r.cluster_id for r in rows if r.cluster_id])
    district_counts = Counter([getattr(r, "district", None) for r in rows if getattr(r, "district", None)])
    now = utc_now()
    changed = 0

    for r in rows:
        cluster_size = cluster_counts.get(r.cluster_id, 1) if r.cluster_id else 1
        source_popularity = (source_counts.get(r.source, 1) / max_source) * 100.0
        source_popularity_score = _clamp(100.0 - source_popularity)

        exclusivity_score = 60.0
        if cluster_size <= 1:
            exclusivity_score += 25
        elif cluster_size >= 3:
            exclusivity_score -= 25
        else:
            exclusivity_score += 8

        age_h = (now - ensure_utc(r.first_seen_at)).total_seconds() / 3600.0
        freshness_boost = 10.0 if age_h <= 12 else (4.0 if age_h <= 24 else 0.0)
        deal_boost = 15.0 if (r.deal_score or 0) >= 85 else 0.0

        suspicious_penalty = 0.0
        badges = []
        try:
            badges = json.loads(r.badges) if r.badges else []
            if not isinstance(badges, list):
                badges = []
        except Exception:
            badges = []
        if "CHECK" in badges:
            suspicious_penalty = 20.0

        district_single_bonus = 0.0
        district_val = getattr(r, "district", None)
        if district_val and district_counts.get(district_val, 0) <= 3 and cluster_size <= 1:
            district_single_bonus = 6.0

        expensive_district_bonus = 0.0
        if (getattr(r, "price_per_sqm", 0) or 0) >= 12000 and cluster_size <= 1 and source_popularity_score >= 65:
            expensive_district_bonus = 4.0

        off_market_score = _clamp(
            exclusivity_score * 0.45
            + source_popularity_score * 0.25
            + freshness_boost
            + deal_boost
            + district_single_bonus
            + expensive_district_bonus
            - suspicious_penalty
        )

        flags: list[str] = []
        if cluster_size <= 1:
            flags.append("EXCLUSIVE")
            flags.append("LOW_VISIBILITY")
        if source_popularity_score >= 65:
            flags.append("SMALL_SOURCE_ONLY")
        if suspicious_penalty > 0:
            flags.append("CHECK_CONFIDENCE")
        if off_market_score >= 72:
            flags.append("OFF_MARKET")

        if off_market_score >= 72 and "OFF_MARKET" not in badges:
            badges.append("OFF_MARKET")

        explain = {
            "cluster_size": cluster_size,
            "exclusivity_score": round(_clamp(exclusivity_score), 2),
            "source_popularity_score": round(source_popularity_score, 2),
            "freshness_hours": round(age_h, 2),
            "deal_score": r.deal_score,
            "suspicious_penalty": suspicious_penalty,
            "district_single_bonus": district_single_bonus,
            "expensive_district_bonus": expensive_district_bonus,
            "final": round(off_market_score, 2),
        }

        r.off_market_score = round(off_market_score, 2)
        r.off_market_flags = json.dumps(sorted(set(flags)), ensure_ascii=False)
        r.off_market_explain = json.dumps(explain, ensure_ascii=False)
        r.exclusivity_score = round(_clamp(exclusivity_score), 2)
        r.source_popularity_score = round(source_popularity_score, 2)
        r.badges = json.dumps(sorted(set(badges)), ensure_ascii=False)
        changed += 1

    db.commit()
    return changed
