from app.title_normalization import normalize_title, make_display_title
from app.field_normalization import normalize_price, normalize_area, normalize_rooms, compute_ppsqm


def test_title_cleaner_and_display_title():
    assert normalize_title("Top Wohnung | Immobilien München") == "Top Wohnung"
    assert make_display_title(None, "Schwabing-West", 64, 2) == "Objekt in Schwabing-West · 64 m² · 2 Zi"


def test_numeric_field_normalization():
    assert normalize_price(600000) == 600000
    assert normalize_price(-1) is None
    assert normalize_area(60) == 60
    assert normalize_area(0) is None
    assert normalize_rooms(2.5) == 2.5
    assert normalize_rooms(0) is None
    assert compute_ppsqm(600000, 60) == 10000
