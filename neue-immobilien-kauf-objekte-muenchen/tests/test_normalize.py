from collectors.normalize import normalize_listing_row


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
