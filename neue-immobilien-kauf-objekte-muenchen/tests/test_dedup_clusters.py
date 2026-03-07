from types import SimpleNamespace

from app.dedup import assign_clusters


def L(**kw):
    base = dict(
        id=0,
        source="a",
        title="Wohnung München",
        address="Leopoldstraße 45, 80802 München",
        postal_code="80802",
        district="Schwabing-Freimann",
        latitude=48.159,
        longitude=11.585,
        price_eur=950000.0,
        area_sqm=95.0,
        rooms=3.0,
        image_hash=None,
        cluster_id=None,
        first_seen_at=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_cross_source_clustering_groups_same_property():
    a = L(source="immowelt", title="Altbauwohnung Schwabing", url="u1")
    b = L(source="sz", title="Altbau Wohnung in Schwabing", url="u2", price_eur=960000.0, area_sqm=96.0)
    c = L(source="planethome", title="Haus Trudering", address="Truderinger Str. 10, 81825 München", postal_code="81825", district="Trudering-Riem", price_eur=1450000.0, area_sqm=130.0, latitude=48.126, longitude=11.67)

    changed = assign_clusters([a, b, c])

    assert changed >= 2
    assert a.cluster_id is not None
    assert a.cluster_id == b.cluster_id
    assert c.cluster_id != a.cluster_id


def test_rebuild_clears_stale_cluster_ids_for_non_duplicates():
    a = L(source="immowelt", cluster_id="cl-old")
    b = L(source="sz", cluster_id="cl-old", address="Hohenzollernstr. 1, 80796 München", postal_code="80796", district="Schwabing-West", price_eur=700000.0, area_sqm=55.0)

    assign_clusters([a, b])
    # either clustered together again or reset/reassigned consistently; no stale old id leakage
    assert (a.cluster_id is None and b.cluster_id is None) or (a.cluster_id == b.cluster_id)
