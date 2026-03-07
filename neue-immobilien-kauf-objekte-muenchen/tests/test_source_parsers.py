from collectors import sz, immowelt, ohne_makler, wohnungsboerse, sis, planethome


REQUIRED_SOURCE_SHAPE_KEYS = {"source", "source_listing_id", "url", "title", "price_eur", "area_sqm", "rooms"}


def assert_source_shape(row: dict):
    for k in REQUIRED_SOURCE_SHAPE_KEYS:
        assert k in row


class DummyResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def test_sz_filters_non_listing_links(monkeypatch):
    html = """
    <a href='/impressum'>Impressum</a>
    <a href='/objekt/abc-1'>Wohnung kaufen 600.000 € 60 m² 2 Zimmer</a>
    """
    monkeypatch.setattr(sz.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(sz.SafeCollector, "get", lambda *a, **k: html)
    rows = sz.collect_sz_listings()
    assert len(rows) == 1
    assert rows[0]["url"].endswith("/objekt/abc-1")
    assert_source_shape(rows[0])


def test_immowelt_extracts_expose_only(monkeypatch):
    html = """
    <a data-testid='card-mfe-covering-link-testid' href='/expose/123' title='Wohnung zum Kauf - München - 900.000 € - 3 Zimmer, 80 m²'></a>
    <a href='/impressum'>x</a>
    """
    monkeypatch.setattr(immowelt.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(immowelt.SafeCollector, "get", lambda *a, **k: html)
    monkeypatch.setattr(immowelt, "is_probable_property_photo", lambda *_: True)
    rows = immowelt.collect_immowelt_listings()
    assert len(rows) == 1
    assert rows[0]["source_listing_id"] == "123"
    assert_source_shape(rows[0])


def test_ohne_makler_keeps_numeric_detail_urls(monkeypatch):
    html = """
    <a href='/immobilien/wohnung-kaufen'>list</a>
    <a href='/immobilie/123456/'>Wohnung 700.000 € 70 m² 3 Zi</a>
    """
    monkeypatch.setattr(ohne_makler.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(ohne_makler.SafeCollector, "get", lambda *a, **k: html)
    rows = ohne_makler.collect_ohne_makler_listings()
    assert len(rows) == 1
    assert rows[0]["source_listing_id"] == "123456"
    assert_source_shape(rows[0])


def test_wohnungsboerse_keeps_immodetail_only(monkeypatch):
    html = """
    <a href='/impressum'>foo</a>
    <a href='/immodetail-k/123/99999'>Wohnung 550.000 € 55 m² 2 Zi</a>
    """
    monkeypatch.setattr(wohnungsboerse.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(wohnungsboerse.SafeCollector, "get", lambda *a, **k: html)
    rows = wohnungsboerse.collect_wohnungsboerse_listings()
    assert len(rows) == 1
    assert_source_shape(rows[0])


def test_sis_collects_detail_pages(monkeypatch):
    list_html = "<a href='https://www.sis.de/immobilie/test-1'>x</a>"
    detail_html = "<h1>Wohnung München</h1><p>800.000 € 80 m² 3 Zimmer 80331 München</p>"

    monkeypatch.setattr(sis.SafeCollector, "assert_allowed", lambda *a, **k: None)

    def fake_get(self, url):
        return detail_html if "/immobilie/" in url else list_html

    monkeypatch.setattr(sis.SafeCollector, "get", fake_get)
    rows = sis.collect_sis_listings()
    assert len(rows) == 1
    assert rows[0]["district"] == "München"
    assert_source_shape(rows[0])


def test_planethome_graphql_parses_only_purchase_munich(monkeypatch):
    monkeypatch.setattr(planethome.SafeCollector, "__init__", lambda self: None)
    monkeypatch.setattr(planethome.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(planethome.SafeCollector, "get", lambda *a, **k: "ok")

    payload = {
        "data": {
            "searchPublicPropertySales": {
                "hasNextPage": False,
                "items": [
                    {
                        "id": "1",
                        "providerPropertyId": "p1",
                        "title": "Wohnung",
                        "description": "desc",
                        "tradeType": "PURCHASE",
                        "usageType": "LIVING",
                        "sold": False,
                        "hide": False,
                        "price": {"totalPurchasePrice": 600000, "purchasePricePerSqm": 10000},
                        "property": {
                            "mainImagePublicUrl": "https://img",
                            "area": {"livingArea": 60},
                            "premises": {"roomNumbers": {"numberOfRooms": 2}},
                            "address": {"zipcode": "80331", "city": "München"},
                        },
                    }
                ],
            }
        }
    }

    class DummyClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, *args, **kwargs):
            return DummyResp(payload)

    monkeypatch.setattr(planethome.httpx, "Client", lambda timeout=30: DummyClient())
    rows = planethome.collect_planethome_listings()
    assert len(rows) == 1
    assert rows[0]["district"] == "München"
    assert_source_shape(rows[0])
