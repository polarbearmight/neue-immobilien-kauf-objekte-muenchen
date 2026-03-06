from collectors import run_collect


def test_should_stop_early_by_ratio(monkeypatch):
    monkeypatch.setenv("STOP_EARLY_MIN_SCAN", "10")
    monkeypatch.setenv("STOP_EARLY_KNOWN_RATIO", "0.8")
    monkeypatch.setenv("STOP_EARLY_KNOWN_STREAK", "99")
    assert run_collect._should_stop_early(scanned=10, known_count=8, known_streak=1) is True


def test_should_stop_early_by_streak(monkeypatch):
    monkeypatch.setenv("STOP_EARLY_MIN_SCAN", "5")
    monkeypatch.setenv("STOP_EARLY_KNOWN_RATIO", "0.95")
    monkeypatch.setenv("STOP_EARLY_KNOWN_STREAK", "6")
    assert run_collect._should_stop_early(scanned=7, known_count=3, known_streak=6) is True


def test_run_targets_resilient_when_one_source_fails(monkeypatch):
    monkeypatch.setenv("COLLECTOR_MAX_WORKERS", "2")

    def ok_source(*_args, **_kwargs):
        return {"source": "ok", "status": "ok", "new": 1, "updated": 0}

    def fail_source(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(run_collect, "run_one_source_isolated", lambda name, dry_run=False, force=False, capture_fixture=False: ok_source() if name == "ok" else fail_source())
    monkeypatch.setattr(run_collect, "COLLECTOR_MAP", {"ok": (None, ""), "bad": (None, "")})

    summary = run_collect.run_targets(["ok", "bad"], disabled=set(), dry_run=True)
    by_source = {x["source"]: x for x in summary}

    assert by_source["ok"]["status"] == "ok"
    assert by_source["bad"]["status"] == "fail"
