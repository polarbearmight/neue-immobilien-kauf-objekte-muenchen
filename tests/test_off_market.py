from types import SimpleNamespace

from app.off_market import recompute_off_market
from app.time_utils import utc_now


class DummyDB:
    def __init__(self, rows):
        self._rows = rows

    def execute(self, _q):
        class R:
            def __init__(self, rows):
                self._rows = rows

            def scalars(self):
                class S:
                    def __init__(self, rows):
                        self._rows = rows

                    def all(self):
                        return self._rows

                return S(self._rows)

        return R(self._rows)

    def commit(self):
        return None


def test_recompute_off_market_marks_exclusive_single_cluster():
    row = SimpleNamespace(
        source="smallsource",
        cluster_id=None,
        first_seen_at=utc_now(),
        deal_score=90,
        badges="[]",
        is_active=True,
        off_market_score=None,
        off_market_flags=None,
        off_market_explain=None,
        exclusivity_score=None,
        source_popularity_score=None,
    )
    db = DummyDB([row])
    changed = recompute_off_market(db)
    assert changed == 1
    assert row.off_market_score is not None
    assert row.off_market_flags is not None
