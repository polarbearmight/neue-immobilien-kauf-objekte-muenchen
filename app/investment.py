from __future__ import annotations

import json
from dataclasses import dataclass
from sqlalchemy import func, select

from app.models import Listing


@dataclass
class InvestmentMetrics:
    estimated_rent_per_sqm: float | None
    estimated_monthly_rent: float | None
    gross_yield_percent: float | None
    price_to_rent_ratio: float | None
    investment_score: float | None
    investment_explain: str


def _district_price_medians(db) -> tuple[dict[str, float], float | None]:
    rows = db.execute(
        select(Listing.district, func.avg(Listing.price_per_sqm))
        .where(Listing.price_per_sqm.is_not(None), Listing.is_active.is_(True), Listing.district.is_not(None))
        .group_by(Listing.district)
    ).all()
    med = {str(d): float(v) for d, v in rows if d and v}
    city = None
    if med:
        city = sum(med.values()) / len(med)
    return med, city


def compute_investment_metrics(
    area_sqm: float | None,
    price_eur: float | None,
    price_per_sqm: float | None,
    district: str | None,
    deal_score: float | None,
    reliability_score: int | None,
    district_price_medians: dict[str, float],
    city_price_median: float | None,
) -> InvestmentMetrics:
    if not area_sqm or not price_eur or area_sqm <= 0 or price_eur <= 0:
        return InvestmentMetrics(None, None, None, None, None, json.dumps({"reason": "missing_area_or_price"}))

    district_ppsqm = district_price_medians.get(district or "")
    city_ppsqm = city_price_median or district_ppsqm or price_per_sqm or (price_eur / area_sqm)

    # base annual yield assumption tuned for Munich buy-to-let estimates
    base_yield = 0.033
    if district_ppsqm and city_ppsqm and city_ppsqm > 0:
        district_factor = max(0.75, min(1.35, district_ppsqm / city_ppsqm))
    else:
        district_factor = 1.0

    effective_yield = base_yield / district_factor
    ref_ppsqm = price_per_sqm or (price_eur / area_sqm)
    estimated_rent_per_sqm = max(6.0, (ref_ppsqm * effective_yield) / 12.0)
    estimated_monthly_rent = area_sqm * estimated_rent_per_sqm
    gross_yield_percent = (estimated_monthly_rent * 12.0 / price_eur) * 100.0
    price_to_rent_ratio = price_eur / (estimated_monthly_rent * 12.0) if estimated_monthly_rent > 0 else None

    score = 50.0
    score += max(-12.0, min(20.0, (gross_yield_percent - 3.0) * 9.0))

    if price_per_sqm and district_ppsqm and district_ppsqm > 0:
        discount_pct = (district_ppsqm - price_per_sqm) / district_ppsqm
        score += max(-12.0, min(18.0, discount_pct * 120.0))

    completeness = 0
    completeness += 1 if area_sqm else 0
    completeness += 1 if price_eur else 0
    completeness += 1 if district else 0
    completeness += 1 if price_per_sqm else 0
    score += (completeness - 2) * 2

    if reliability_score is not None:
        score += (reliability_score - 50) / 10.0

    if deal_score is not None:
        score += (deal_score - 50) / 8.0

    score = max(0.0, min(100.0, score))

    explain = {
        "estimated": True,
        "district": district,
        "district_price_per_sqm": district_ppsqm,
        "city_price_per_sqm": city_ppsqm,
        "effective_yield_assumption": round(effective_yield * 100, 2),
        "gross_yield_percent": round(gross_yield_percent, 2),
        "price_to_rent_ratio": round(price_to_rent_ratio, 2) if price_to_rent_ratio else None,
        "reliability_score": reliability_score,
        "deal_score": deal_score,
        "completeness": completeness,
        "final": round(score, 2),
    }

    return InvestmentMetrics(
        estimated_rent_per_sqm=round(estimated_rent_per_sqm, 2),
        estimated_monthly_rent=round(estimated_monthly_rent, 2),
        gross_yield_percent=round(gross_yield_percent, 2),
        price_to_rent_ratio=round(price_to_rent_ratio, 2) if price_to_rent_ratio else None,
        investment_score=round(score, 2),
        investment_explain=json.dumps(explain, ensure_ascii=False),
    )


def recompute_investments(db, reliability_by_source: dict[str, int] | None = None) -> int:
    reliability_by_source = reliability_by_source or {}
    district_medians, city_median = _district_price_medians(db)
    rows = db.execute(select(Listing)).scalars().all()

    changed = 0
    for r in rows:
        metrics = compute_investment_metrics(
            area_sqm=r.area_sqm,
            price_eur=r.price_eur,
            price_per_sqm=r.price_per_sqm,
            district=r.district,
            deal_score=r.deal_score,
            reliability_score=reliability_by_source.get(r.source),
            district_price_medians=district_medians,
            city_price_median=city_median,
        )

        r.estimated_rent_per_sqm = metrics.estimated_rent_per_sqm
        r.estimated_monthly_rent = metrics.estimated_monthly_rent
        r.gross_yield_percent = metrics.gross_yield_percent
        r.price_to_rent_ratio = metrics.price_to_rent_ratio
        r.investment_score = metrics.investment_score
        r.investment_explain = metrics.investment_explain
        changed += 1

    db.commit()
    return changed
