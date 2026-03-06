from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))
from app.main import app, scan_lock, scan_state


client = TestClient(app)


def test_scan_status_endpoint_shape():
    r = client.get('/api/scan/status')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert 'scan' in payload
    assert 'running' in payload['scan']


def test_scan_coverage_endpoint_shape():
    r = client.get('/api/scan/coverage')
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('ok') is True
    assert 'coverage' in payload
    assert isinstance(payload['coverage'], list)


def test_scan_run_respects_single_running_lock():
    with scan_lock:
        scan_state['running'] = True
        scan_state['status'] = 'running'

    try:
        r = client.post('/api/scan/run')
        assert r.status_code == 200
        payload = r.json()
        assert payload.get('already_running') is True
        assert payload.get('scan', {}).get('running') is True
    finally:
        with scan_lock:
            scan_state['running'] = False
            scan_state['status'] = 'idle'
