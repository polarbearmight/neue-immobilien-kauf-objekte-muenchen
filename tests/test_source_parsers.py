from collectors import sz, immowelt, ohne_makler, wohnungsboerse, sis, planethome, immoscout, kip


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
    assert rows[0]["district"] == "München"
    assert_source_shape(rows[0])


def test_immowelt_filters_surrounding_municipalities(monkeypatch):
    html = """
    <a data-testid='card-mfe-covering-link-testid' href='/expose/123' title='Wohnung zum Kauf - Garching bei München - 900.000 € - 3 Zimmer, 80 m²'></a>
    """
    monkeypatch.setattr(immowelt.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(immowelt.SafeCollector, "get", lambda *a, **k: html)
    monkeypatch.setattr(immowelt, "is_probable_property_photo", lambda *_: True)
    rows = immowelt.collect_immowelt_listings()
    assert rows == []


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


def test_wohnungsboerse_prefers_title_numbers_over_parent_teaser(monkeypatch):
    html = """
    <div>
      <span>Teaser: 550.000 € 77 m² 3 Zi</span>
      <a href='/immodetail-k/123/88888'>
        NEU Penthouse Kaufpreis 2.980.000 € Zimmer 5 Zi. Fläche 254 m²
      </a>
    </div>
    """
    monkeypatch.setattr(wohnungsboerse.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(wohnungsboerse.SafeCollector, "get", lambda *a, **k: html)
    rows = wohnungsboerse.collect_wohnungsboerse_listings()
    assert len(rows) == 1
    assert rows[0]["price_eur"] == 2980000.0
    assert rows[0]["area_sqm"] == 254.0
    assert rows[0]["rooms"] == 5.0


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
    assert rows[0]["postal_code"] == "80331"
    assert rows[0]["address"] == "80331 München"
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
                    },
                    {
                        "id": "2",
                        "providerPropertyId": "p2",
                        "title": "Nicht München",
                        "description": "desc",
                        "tradeType": "PURCHASE",
                        "usageType": "LIVING",
                        "sold": False,
                        "hide": False,
                        "price": {"totalPurchasePrice": 500000, "purchasePricePerSqm": 8000},
                        "property": {
                            "mainImagePublicUrl": "https://img2",
                            "area": {"livingArea": 60},
                            "premises": {"roomNumbers": {"numberOfRooms": 2}},
                            "address": {"zipcode": "85748", "city": "Garching bei München"},
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


def test_immoscout_parses_exported_next_data_when_live_is_blocked(monkeypatch, tmp_path):
    html = """
    <html><body>
      <script id='__NEXT_DATA__' type='application/json'>
      {
        "props": {
          "pageProps": {
            "entries": [
              {
                "listingId": 123456789,
                "title": "Provisionsfreie Wohnung in Harlaching",
                "resultlistEntryPath": "/expose/123456789",
                "address": {"postcode": "81545", "city": "München", "quarter": "Harlaching"},
                "price": {"value": 995000},
                "realEstate": {"livingSpace": {"value": 95}, "numberOfRooms": 3}
              }
            ]
          }
        }
      }
      </script>
    </body></html>
    """
    export_path = tmp_path / "immoscout_export.html"
    export_path.write_text(html, encoding="utf-8")

    monkeypatch.setattr(immoscout.SafeCollector, "assert_allowed", lambda *a, **k: None)
    monkeypatch.setattr(immoscout.SafeCollector, "get", lambda *a, **k: "Ich bin kein Roboter")
    monkeypatch.setenv("IMMOSCOUT_HTML_EXPORT_PATH", str(export_path))

    rows = immoscout.collect_immoscout_private_filtered_listings()
    assert len(rows) == 1
    assert rows[0]["source_listing_id"] == "123456789"
    assert rows[0]["district"] == "Harlaching"
    assert rows[0]["price_eur"] == 995000.0
    assert_source_shape(rows[0])


def test_kip_collect_detail_extracts_postal_and_private_hint(monkeypatch):
    detail_html = """
    <html>
      <head>
        <title>Familienwohnung in Harlaching</title>
        <meta property='og:image' content='/image.jpg' />
      </head>
      <body>
        <h1>Familienwohnung in Harlaching</h1>
        <div>Anbieter Von Privat Ansprechpartner Max Mustermann</div>
        <div>Adresse Candidplatz 5, 81543 München (Untergiesing)</div>
        <div>Objekt-ID: H8925077</div>
        <div>Kaufpreis 1.250.000</div>
        <div>Wohnfläche 125 m²</div>
        <div>Zimmer 4</div>
      </body>
    </html>
    """

    class DummyRespText:
        def __init__(self, text):
            self.text = text

        def raise_for_status(self):
            return None

    class DummySession:
        def get(self, url, timeout=30):
            return DummyRespText(detail_html)

    row = kip._collect_detail("https://www.kip.net/bayern/muenchen/kaufen/wohnung_H8925077", DummySession())
    assert row is not None
    assert row["source_listing_id"] == "H8925077"
    assert row["postal_code"] == "81543"
    assert row["district"] == "Untergiesing"
    assert row["source_payload_debug"]["provider_private_like"] is True
