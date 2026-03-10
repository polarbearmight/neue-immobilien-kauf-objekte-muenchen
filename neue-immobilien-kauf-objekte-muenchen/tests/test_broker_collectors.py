from collectors.brokers import _extract_listing_links, _parse_detail


def test_extract_broker_links_filters_noise():
    html = """
    <html><body>
      <a href='/immobilien/wohnung-maxvorstadt'>Wohnung Maxvorstadt</a>
      <a href='/impressum'>Impressum</a>
      <a href='/kontakt'>Kontakt</a>
    </body></html>
    """
    links = _extract_listing_links("https://example.com/immobilien/", html)
    assert any("wohnung-maxvorstadt" in x for x in links)
    assert not any("impressum" in x for x in links)


def test_extract_kleinanzeigen_links_only_keeps_detail_buy_urls():
    html = """
    <html><body>
      <a href='/s-immobilien/muenchen/c195l6411'>Hub</a>
      <a href='/s-anzeige/top-wohnung/12345-196-6411'>Buy Wohnung</a>
      <a href='/s-anzeige/wg-zimmer/77777-199-6411'>WG</a>
    </body></html>
    """
    links = _extract_listing_links("https://www.kleinanzeigen.de/s-immobilien/muenchen/c195l6411", html, source_name="kleinanzeigen")
    assert len(links) == 1
    assert links[0].endswith('/s-anzeige/top-wohnung/12345-196-6411')


def test_parse_detail_prefers_json_ld():
    html = """
    <html><head><title>Objekt</title>
    <script type='application/ld+json'>
    {"@type":"Offer","name":"Top Wohnung in München-Maxvorstadt","price":"990000","floorSize":{"value":"89"},"numberOfRooms":"3","address":{"streetAddress":"Teststr. 1","postalCode":"80333","addressLocality":"München"},"geo":{"latitude":48.15,"longitude":11.57}}
    </script>
    </head><body></body></html>
    """
    row = _parse_detail("broker_test", "https://example.com/objekt/1", html)
    assert row is not None
    assert row["title"]
    assert row["price_eur"] == 990000.0
    assert row["area_sqm"] == 89.0
    assert row["rooms"] == 3.0


def test_parse_detail_kleinanzeigen_requires_price():
    html = """
    <html><head><title>Kleinanzeigen für Immobilien | kleinanzeigen.de</title></head>
    <body>Kleinanzeigen für Immobilien in München</body></html>
    """
    row = _parse_detail("kleinanzeigen", "https://www.kleinanzeigen.de/s-anzeige/hub/111-196-6411", html)
    assert row is None


def test_parse_detail_kleinanzeigen_extracts_district_from_body():
    html = """
    <html><head><title>Hochwertige DHH mit KfW-40-Effizienzhaus und Erstbezug!</title></head>
    <body>
      Hochwertige DHH mit KfW-40-Effizienzhaus und Erstbezug! in München - Trudering-Riem |
      Doppelhaushälfte kaufen | kleinanzeigen.de Kaufpreis 1.234.000 €
    </body></html>
    """
    row = _parse_detail("kleinanzeigen", "https://www.kleinanzeigen.de/s-anzeige/foo/3222576545-208-16390", html)
    assert row is not None
    assert row["district"] == "Trudering-Riem"
    assert row["price_eur"] == 1234000.0
