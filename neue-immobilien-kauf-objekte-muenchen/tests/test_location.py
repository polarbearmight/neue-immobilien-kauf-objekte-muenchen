from app.location import resolve_location


def test_postal_code_to_district_mapping():
    loc = resolve_location({"address": "Leopoldstraße 45, 80802 München"})
    assert loc["district"] == "Schwabing-Freimann"
    assert loc["district_source"] == "postal_code"
    assert loc["location_confidence"] >= 90


def test_district_alias_detection_from_title():
    loc = resolve_location({"title": "Helle Wohnung in Schwabing Nord"})
    assert loc["district"] == "Schwabing"
    assert loc["district_source"] == "title_detection"


def test_coordinate_based_detection():
    loc = resolve_location({"latitude": 48.175, "longitude": 11.585})
    assert loc["district"] in ("Maxvorstadt", "Schwabing", "Bogenhausen")
    assert loc["district_source"] == "coordinates"


def test_fallback_unknown_munich():
    loc = resolve_location({"title": "Wohnung in München"})
    assert loc["district"] == "München"
    assert loc["location_confidence"] == 0
