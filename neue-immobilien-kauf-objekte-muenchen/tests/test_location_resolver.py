from app.location_resolver import resolve_location


def test_postal_lookup():
    r = resolve_location({"postal_code": "80333", "city": "München"})
    assert r["district"] == "Maxvorstadt"
    assert r["district_source"] == "postal_code"
    assert r["location_confidence"] == 90


def test_address_parsing_examples():
    r1 = resolve_location({"address": "Leopoldstraße 45, 80802 München"})
    assert r1["district"] == "Schwabing-Freimann"

    r2 = resolve_location({"address": "Hohenzollernstraße 18, 80796 München"})
    assert r2["district"] == "Schwabing-West"


def test_alias_innenstadt():
    r = resolve_location({"title": "Neubau in der Innenstadt"})
    assert r["district"] == "Altstadt-Lehel"


def test_unknown_fallback():
    r = resolve_location({"title": "Objekt in Bayern"})
    assert r["district"] == "München"
    assert r["district_source"] == "unknown"
