from collectors.run_collect import _disabled_sources


def test_disabled_sources_env_parsing(monkeypatch):
    monkeypatch.setenv("DISABLED_SOURCES", "planethome,  wohnungsboerse ,, sis")
    assert _disabled_sources() == {"planethome", "wohnungsboerse", "sis"}
