from datetime import timedelta
from types import SimpleNamespace

from app.scoring import compute_score
from app.ai_deal_analyzer import analyze_listing
from app.dedup import assign_clusters
from app.time_utils import utc_now


def mk_listing(**kw):
    base = dict(
        price_per_sqm=9000,
        posted_at=utc_now() - timedelta(hours=1),
        first_seen_at=utc_now() - timedelta(hours=1),
        area_sqm=65,
        price_eur=585000,
        title="Helle Wohnung mit Balkon",
        description="renoviert und ruhig",
        district="schwabing",
        badges=None,
        deal_score=None,
        cluster_id=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_compute_score_has_freshness_and_bucket_badges():
    l = mk_listing(price_per_sqm=8500)
    score, badges, explain = compute_score(l, city_median=11000, has_price_drop=True)
    assert score is not None and score > 0
    assert "JUST_LISTED" in badges
    assert "UNDER_9000" in badges
    assert "PRICE_DROP" in badges
    assert "final" in explain


def test_ai_analyzer_flags_spam_and_risk():
    l = mk_listing(title="Nur heute sofort zuschlagen", description="sanierungsbedürftig whatsapp")
    flags, explain = analyze_listing(l, district_median=13000)
    assert "FLAG_MARKETING_SPAM" in flags
    assert any(k in flags for k in ["FLAG_RENOVATION", "FLAG_RISK"])
    assert "negative" in explain


def test_dedup_assigns_same_cluster_for_similar_rows():
    a = mk_listing(district="maxvorstadt", area_sqm=61, price_eur=720000)
    b = mk_listing(district="maxvorstadt", area_sqm=62, price_eur=719000)
    c = mk_listing(district="haaidhausen", area_sqm=120, price_eur=1500000)
    changed = assign_clusters([a, b, c])
    assert changed >= 2
    assert a.cluster_id is not None
    assert a.cluster_id == b.cluster_id
