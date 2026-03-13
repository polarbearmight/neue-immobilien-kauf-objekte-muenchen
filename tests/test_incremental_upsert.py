from datetime import datetime, timezone

from sqlalchemy import func, select

from app.db import Base, SessionLocal, engine, ensure_schema
from app.models import Listing, ListingSnapshot
from collectors.run_collect import upsert_rows


def _row(price: float, title: str = "Test Listing"):
    now = datetime.now(timezone.utc)
    return {
        "source": "test_inc",
        "source_listing_id": "abc-1",
        "url": "https://example.com/abc-1",
        "title": title,
        "description": "desc",
        "district": "muenchen",
        "price_eur": price,
        "area_sqm": 50.0,
        "rooms": 2.0,
        "price_per_sqm": round(price / 50.0, 2),
        "first_seen_at": now,
        "last_seen_at": now,
    }


def test_incremental_upsert_skips_unchanged_and_snapshots_only_on_change():
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    db = SessionLocal()
    try:
        db.execute(select(Listing).where(Listing.source == "test_inc")).scalars().all()
        # cleanup from previous runs
        rows = db.execute(select(Listing).where(Listing.source == "test_inc")).scalars().all()
        for r in rows:
            db.execute(select(ListingSnapshot).where(ListingSnapshot.listing_id == r.id))
            snaps = db.execute(select(ListingSnapshot).where(ListingSnapshot.listing_id == r.id)).scalars().all()
            for s in snaps:
                db.delete(s)
            db.delete(r)
        db.commit()

        new_count, updated_count, skipped = upsert_rows(db, [_row(500000)], source_name="test_inc")
        assert new_count == 1
        assert updated_count == 0
        assert skipped == 0

        new_count, updated_count, skipped = upsert_rows(db, [_row(500000)], source_name="test_inc")
        assert new_count == 0
        assert updated_count == 0
        assert skipped == 1

        new_count, updated_count, skipped = upsert_rows(db, [_row(520000)], source_name="test_inc")
        assert new_count == 0
        assert updated_count == 1
        assert skipped == 0

        listing = db.execute(select(Listing).where(Listing.source == "test_inc", Listing.source_listing_id == "abc-1")).scalar_one()
        snap_count = db.scalar(select(func.count()).select_from(ListingSnapshot).where(ListingSnapshot.listing_id == listing.id))
        assert int(snap_count or 0) == 2
    finally:
        db.close()
