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
