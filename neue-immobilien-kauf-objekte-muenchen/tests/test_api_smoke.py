from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))
from app.main import app


client = TestClient(app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_listings_endpoint_works():
    r = client.get("/api/listings?limit=5")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_stats_endpoint_works():
    r = client.get("/api/stats?days=7")
    assert r.status_code == 200
    payload = r.json()
    assert "new_listings" in payload


def test_sources_endpoint_works():
    r = client.get("/api/sources")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_analytics_endpoint_works():
    r = client.get("/api/analytics?days=30")
    assert r.status_code == 200
    payload = r.json()
    assert "source_distribution" in payload
    assert "price_bands" in payload


def test_source_approve_not_found():
    r = client.post("/api/sources/999999/approve?approved=true")
    assert r.status_code == 404


def test_source_runs_not_found():
    r = client.get("/api/sources/999999/runs")
    assert r.status_code == 404
