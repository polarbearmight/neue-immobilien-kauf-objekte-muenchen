from sqlalchemy import select
from app.db import SessionLocal, Base, engine
from app.models import Listing
from collectors.sz import collect_sz_listings
from collectors.is24 import collect_is24_listings
from datetime import datetime


def upsert(rows: list[dict]):
    db = SessionLocal()
    try:
        for row in rows:
            existing = db.execute(
                select(Listing).where(
                    Listing.source == row["source"],
                    Listing.source_listing_id == row["source_listing_id"],
                )
            ).scalar_one_or_none()
            if existing:
                existing.last_seen_at = datetime.utcnow()
                existing.title = row.get("title") or existing.title
                existing.url = row.get("url") or existing.url
            else:
                db.add(Listing(**row))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    rows = []

    try:
        rows.extend(collect_sz_listings())
    except Exception as e:
        print(f"WARN sz collector failed: {e}")

    try:
        rows.extend(collect_is24_listings())
    except Exception as e:
        print(f"WARN is24 collector failed: {e}")

    upsert(rows)
    print(f"upserted_rows={len(rows)}")
