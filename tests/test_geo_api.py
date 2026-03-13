from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))
from app.main import app


client = TestClient(app)


def test_geo_summary_endpoint():
    r = client.get('/api/geo/summary?window=30d')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert 'total_listings' in payload


def test_geo_districts_endpoint():
    r = client.get('/api/geo/districts?window=7d')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert isinstance(payload.get('rows'), list)


def test_geo_hotspots_endpoint():
    r = client.get('/api/geo/hotspots?window=7d')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert isinstance(payload.get('rows'), list)


def test_geo_cells_endpoint_fallback_shape():
    r = client.get('/api/geo/cells?window=30d')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert isinstance(payload.get('rows'), list)


def test_location_coverage_endpoint_shape():
    r = client.get('/api/location/coverage')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert isinstance(payload.get('rows'), list)


def test_geo_listings_endpoint_shape():
    r = client.get('/api/geo/listings?window=30d')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert isinstance(payload.get('rows'), list)
