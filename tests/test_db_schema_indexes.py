from pathlib import Path
import sys

from sqlalchemy import inspect

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db import engine, ensure_schema  # noqa: E402


def test_ensure_schema_creates_performance_indexes():
    ensure_schema()
    insp = inspect(engine)

    listing_indexes = {idx["name"] for idx in insp.get_indexes("listings")}
    assert "ix_listings_first_seen_at" in listing_indexes
    assert "ix_listings_source_first_seen" in listing_indexes
    assert "ix_listings_district_first_seen" in listing_indexes

    snapshot_indexes = {idx["name"] for idx in insp.get_indexes("listing_snapshots")}
    assert "ix_snapshots_listing_captured" in snapshot_indexes
