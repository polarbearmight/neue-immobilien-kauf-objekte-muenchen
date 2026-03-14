from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))
from app.main import app


client = TestClient(app)


def test_immoscout_export_status_endpoint():
    r = client.get("/api/sources/immoscout/export-status")
    assert r.status_code == 200
    payload = r.json()
    assert payload["ok"] is True
    assert "path" in payload
    assert "exists" in payload


def test_immoscout_import_html_rejects_short_payload():
    r = client.post("/api/sources/immoscout/import-html", json={"html": "too short", "run_import": False})
    assert r.status_code == 400
    assert r.json()["error"] == "html_too_short"


def test_immoscout_import_html_runs_collector(monkeypatch):
    called = {}

    def fake_run(source_name: str, dry_run: bool = False, force: bool = False, capture_fixture: bool = False):
        called["source_name"] = source_name
        called["dry_run"] = dry_run
        called["force"] = force
        return {"source": source_name, "status": "ok", "new": 1, "updated": 0, "normalized": 1}

    monkeypatch.setattr("app.main.run_one_source_isolated", fake_run)

    html = "<html>" + ("x" * 300) + "</html>"
    r = client.post(
        "/api/sources/immoscout/import-html",
        json={"html": html, "run_import": True, "dry_run": True},
    )
    assert r.status_code == 200
    payload = r.json()
    assert payload["ok"] is True
    assert payload["collector_result"]["status"] == "ok"
    assert called["source_name"] == "immoscout_private_filtered"
    assert called["dry_run"] is True
    assert called["force"] is True
