import os
from sqlalchemy import select
from app.db import SessionLocal, Base, engine, ensure_schema
from app.models import Listing
from collectors.sz import collect_sz_listings
from collectors.is24 import collect_is24_listings
from collectors.immowelt import collect_immowelt_listings
from datetime import datetime


def ensure_seed_row(rows: list[dict]) -> list[dict]:
    enable_seed = os.getenv("ENABLE_FALLBACK_SEED", "true").lower() in ("1", "true", "yes")
    if rows or not enable_seed:
        return rows

    now = datetime.utcnow()
    seed = {
        "source": "seed",
        "source_listing_id": f"seed-{now.strftime('%Y%m%d')}",
        "url": "https://example.com/seed-listing",
        "title": "Seed-Datensatz (Collector lieferte aktuell keine Treffer)",
        "description": "Beispielobjekt zur UI-Demo, bis Live-Daten geladen sind.",
        "image_url": "https://placehold.co/420x260?text=Objektbild",
        "district": "München",
        "area_sqm": 65.0,
        "price_eur": 650000.0,
        "rooms": 2.0,
        "price_per_sqm": 10000.0,
        "first_seen_at": now,
        "last_seen_at": now,
    }
    print("WARN no live listings found; injecting fallback seed row")
    return [seed]


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
                existing.description = row.get("description") or existing.description
                existing.image_url = row.get("image_url") or existing.image_url
                existing.address = row.get("address") or existing.address
                existing.district = row.get("district") or existing.district
                existing.price_eur = row.get("price_eur") if row.get("price_eur") is not None else existing.price_eur
                existing.area_sqm = row.get("area_sqm") if row.get("area_sqm") is not None else existing.area_sqm
                existing.rooms = row.get("rooms") if row.get("rooms") is not None else existing.rooms
                existing.price_per_sqm = row.get("price_per_sqm") if row.get("price_per_sqm") is not None else existing.price_per_sqm
                existing.posted_at = row.get("posted_at") or existing.posted_at
                existing.url = row.get("url") or existing.url
            else:
                db.add(Listing(**row))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    rows = []

    try:
        rows.extend(collect_sz_listings())
    except Exception as e:
        print(f"WARN sz collector failed: {e}")

    try:
        rows.extend(collect_is24_listings())
    except Exception as e:
        print(f"WARN is24 collector failed: {e}")

    try:
        rows.extend(collect_immowelt_listings())
    except Exception as e:
        print(f"WARN immowelt collector failed: {e}")

    rows = ensure_seed_row(rows)
    upsert(rows)
    print(f"upserted_rows={len(rows)}")
