from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db import Base, SessionLocal, engine, ensure_schema
from app.models import Listing, ListingSnapshot
from collectors.run_collect import upsert_rows


def _cleanup_source(db, source: str):
    rows = db.execute(select(Listing).where(Listing.source == source)).scalars().all()
    for r in rows:
        snaps = db.execute(select(ListingSnapshot).where(ListingSnapshot.listing_id == r.id)).scalars().all()
        for s in snaps:
            db.delete(s)
        db.delete(r)
    db.commit()


def _insert_listing(db, *, source: str, source_listing_id: str, url: str, title: str = "Noise Listing", price_eur=None):
    old = datetime.now(timezone.utc) - timedelta(hours=13)
    row = Listing(
        source=source,
        source_listing_id=source_listing_id,
        url=url,
        title=title,
        description="desc",
        district="München",
        price_eur=price_eur,
        area_sqm=80.0,
        rooms=3.0,
        first_seen_at=old,
        last_seen_at=old,
        is_active=True,
        raw_hash=f"hash-{source_listing_id}",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _fresh_row(source: str, sid: str = "fresh-1"):
    now = datetime.now(timezone.utc)
    return {
        "source": source,
        "source_listing_id": sid,
        "url": f"https://example.com/{sid}",
        "title": "Fresh Listing",
        "description": "desc",
        "district": "München",
        "price_eur": 500000.0,
        "area_sqm": 50.0,
        "rooms": 2.0,
        "price_per_sqm": 10000.0,
        "first_seen_at": now,
        "last_seen_at": now,
    }


def test_upsert_deactivates_legacy_riedel_overview_listing():
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    db = SessionLocal()
    try:
        _cleanup_source(db, "broker_riedel")
        legacy = _insert_listing(
            db,
            source="broker_riedel",
            source_listing_id="legacy-riedel",
            url="https://www.riedel-immobilien.de/angebote/kauf/",
            price_eur=None,
        )

        new_count, updated_count, skipped = upsert_rows(db, [_fresh_row("broker_riedel")], source_name="broker_riedel")
        assert (new_count, updated_count, skipped) == (1, 0, 0)

        db.refresh(legacy)
        assert legacy.is_active is False
    finally:
        _cleanup_source(db, "broker_riedel")
        db.close()


def test_upsert_deactivates_legacy_engel_category_listing():
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    db = SessionLocal()
    try:
        _cleanup_source(db, "broker_engel_voelkers_muenchen")
        legacy = _insert_listing(
            db,
            source="broker_engel_voelkers_muenchen",
            source_listing_id="legacy-engel",
            url="https://www.engelvoelkers.com/de/de/immobilien/res/kaufen/immobilien/bayern/muenchen/bogenhausen",
            title="Immobilie kaufen in Bogenhausen, München | Engel & Völkers",
            price_eur=1799000.0,
        )

        new_count, updated_count, skipped = upsert_rows(db, [_fresh_row("broker_engel_voelkers_muenchen")], source_name="broker_engel_voelkers_muenchen")
        assert (new_count, updated_count, skipped) == (1, 0, 0)

        db.refresh(legacy)
        assert legacy.is_active is False
    finally:
        _cleanup_source(db, "broker_engel_voelkers_muenchen")
        db.close()


def test_upsert_deactivates_legacy_kleinanzeigen_listing_without_price():
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    db = SessionLocal()
    try:
        _cleanup_source(db, "kleinanzeigen")
        legacy = _insert_listing(
            db,
            source="kleinanzeigen",
            source_listing_id="legacy-klein",
            url="https://www.kleinanzeigen.de/s-anzeige/no-price/1234567890-196-6411",
            title="No price listing",
            price_eur=None,
        )

        fresh = _fresh_row("kleinanzeigen")
        fresh["url"] = "https://www.kleinanzeigen.de/s-anzeige/fresh/9999999999-196-6411"
        new_count, updated_count, skipped = upsert_rows(db, [fresh], source_name="kleinanzeigen")
        assert (new_count, updated_count, skipped) == (1, 0, 0)

        db.refresh(legacy)
        assert legacy.is_active is False
    finally:
        _cleanup_source(db, "kleinanzeigen")
        db.close()
