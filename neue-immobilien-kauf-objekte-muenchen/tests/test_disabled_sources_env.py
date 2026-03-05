from collectors.run_collect import _disabled_sources


def test_disabled_sources_env_parsing(monkeypatch):
    monkeypatch.setenv("DISABLED_SOURCES", "is24,  planethome ,, sis")
    assert _disabled_sources() == {"is24", "planethome", "sis"}
