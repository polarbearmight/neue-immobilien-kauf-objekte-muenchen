from collectors.normalize import dedupe_rows, normalize_listing_row


def test_normalize_rejects_social_noise():
    row = {
        "source": "immowelt",
        "source_listing_id": "x1",
        "url": "https://example.com/facebook",
        "title": "Folge uns auf Facebook",
        "description": "social",
    }
    assert normalize_listing_row(row) is None


def test_normalize_builds_ppsqm_and_source_name():
    row = {
        "source": "Immowelt",
        "source_listing_id": "x2",
        "url": "https://example.com/expose/x2",
        "title": "Wohnung zum Kauf",
        "description": "München 600.000 € 60 m²",
        "price_eur": "600.000",
        "area_sqm": "60",
    }
    out = normalize_listing_row(row)
    assert out is not None
    assert out["source"] == "immowelt"
    assert out["price_per_sqm"] == 10000


def test_normalize_cleans_noisy_munich_district():
    row = {
        "source": "planethome",
        "source_listing_id": "p1",
        "url": "https://example.com/expose/p1",
        "title": "Wohnung München",
        "description": "Wohnung zum Kauf",
        "district": "81545 München Objekt-ID 12345",
        "price_eur": 500000,
        "area_sqm": 50,
    }
    out = normalize_listing_row(row)
    assert out is not None
    assert out["district"] == "81545 München"


def test_dedupe_rows_drops_secondary_duplicates_same_source():
    rows = [
        {
            "source": "planethome",
            "source_listing_id": "a1",
            "title": "Helle Wohnung",
            "district": "81545 München",
            "price_eur": 865000,
            "area_sqm": 105,
            "rooms": 3,
        },
        {
            "source": "planethome",
            "source_listing_id": "a2",
            "title": "Helle Wohnung",
            "district": "81545 München",
            "price_eur": 865000,
            "area_sqm": 105,
            "rooms": 3,
        },
    ]
    out = dedupe_rows(rows)
    assert len(out) == 1
