from app.investment import compute_investment_metrics


def test_investment_metrics_computed_with_complete_data():
    m = compute_investment_metrics(
        area_sqm=70,
        price_eur=700000,
        price_per_sqm=10000,
        district="schwabing",
        deal_score=80,
        reliability_score=75,
        district_price_medians={"schwabing": 12000},
        city_price_median=11000,
    )
    assert m.estimated_monthly_rent is not None
    assert m.gross_yield_percent is not None
    assert m.investment_score is not None
    assert 0 <= m.investment_score <= 100


def test_investment_metrics_handles_missing_price_or_area():
    m = compute_investment_metrics(
        area_sqm=None,
        price_eur=700000,
        price_per_sqm=10000,
        district="schwabing",
        deal_score=80,
        reliability_score=75,
        district_price_medians={"schwabing": 12000},
        city_price_median=11000,
    )
    assert m.investment_score is None
