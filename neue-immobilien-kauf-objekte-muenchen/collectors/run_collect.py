import argparse
import os
from datetime import datetime
from sqlalchemy import select

from app.db import SessionLocal, Base, engine, ensure_schema
from app.models import Listing, Source, SourceRun
from collectors.image_tools import compute_phash_from_url
from collectors.sz import collect_sz_listings
from collectors.is24 import collect_is24_listings
from collectors.immowelt import collect_immowelt_listings
from collectors.source_validator import validate_source
from app.scoring import recompute_scores
from app.ai_deal_analyzer import analyze_listing, serialize_flags
from app.dedup import assign_clusters

COLLECTOR_MAP = {
    "sz": (collect_sz_listings, "https://immobilienmarkt.sueddeutsche.de"),
    "is24": (collect_is24_listings, "https://www.immobilienscout24.de"),
    "immowelt": (collect_immowelt_listings, "https://www.immowelt.de"),
}


def ensure_seed_row(rows: list[dict]) -> list[dict]:
    enable_seed = os.getenv("ENABLE_FALLBACK_SEED", "true").lower() in ("1", "true", "yes")
    if rows or not enable_seed:
        return rows
    now = datetime.utcnow()
    return [{
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
    }]


def get_or_create_source(db, name: str, base_url: str) -> Source:
    src = db.execute(select(Source).where(Source.name == name)).scalar_one_or_none()
    if not src:
        src = db.execute(select(Source).where(Source.base_url == base_url)).scalar_one_or_none()
    if src:
        if src.name != name:
            src.name = name
            src.updated_at = datetime.utcnow()
            db.commit()
        return src
    src = Source(
        name=name,
        base_url=base_url,
        kind="html",
        discovery_method="seed",
        robots_status="unknown",
        approved=True,
        enabled=True,
        health_status="healthy",
        rate_limit_seconds=8,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


def upsert_rows(db, rows: list[dict]) -> tuple[int, int]:
    new_count = 0
    updated_count = 0
    for row in rows:
        if row.get("image_url") and not row.get("image_hash"):
            row["image_hash"] = compute_phash_from_url(row.get("image_url"))

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
            existing.image_hash = row.get("image_hash") or existing.image_hash
            existing.address = row.get("address") or existing.address
            existing.district = row.get("district") or existing.district
            existing.price_eur = row.get("price_eur") if row.get("price_eur") is not None else existing.price_eur
            existing.area_sqm = row.get("area_sqm") if row.get("area_sqm") is not None else existing.area_sqm
            existing.rooms = row.get("rooms") if row.get("rooms") is not None else existing.rooms
            existing.price_per_sqm = row.get("price_per_sqm") if row.get("price_per_sqm") is not None else existing.price_per_sqm
            existing.posted_at = row.get("posted_at") or existing.posted_at
            existing.url = row.get("url") or existing.url
            updated_count += 1
        else:
            db.add(Listing(**row))
            new_count += 1
    db.commit()
    return new_count, updated_count


def run_one_source(db, source_name: str, dry_run: bool = False) -> dict:
    collector, base_url = COLLECTOR_MAP[source_name]
    src = get_or_create_source(db, source_name, base_url)

    started = datetime.utcnow()
    run = SourceRun(source_id=src.id, started_at=started, status="ok", new_count=0, updated_count=0)
    db.add(run)
    db.commit()
    db.refresh(run)

    validation = validate_source(base_url)
    src.health_status = validation.status if src.enabled else "disabled"
    src.last_error = validation.notes if validation.status != "healthy" else None

    if validation.status == "blocked":
        run.status = "degraded"
        run.notes = f"validation blocked: {validation.notes}"
        run.finished_at = datetime.utcnow()
        db.commit()
        return {"source": source_name, "status": "blocked", "new": 0, "updated": 0}

    try:
        rows = collector()
    except Exception as e:
        rows = []
        run.status = "fail"
        run.notes = f"collector error: {e}"

    if source_name == "sz" and not rows:
        rows = ensure_seed_row(rows)

    if not dry_run:
        new_count, updated_count = upsert_rows(db, rows)
    else:
        new_count, updated_count = len(rows), 0

    run.new_count = new_count
    run.updated_count = updated_count
    run.finished_at = datetime.utcnow()
    if run.status == "ok":
        run.notes = validation.notes
    src.last_success_at = datetime.utcnow() if run.status == "ok" else src.last_success_at
    src.updated_at = datetime.utcnow()
    db.commit()

    return {"source": source_name, "status": run.status, "new": new_count, "updated": updated_count}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="all", help="one source or all")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_schema()

    db = SessionLocal()
    try:
        targets = [args.source] if args.source != "all" else list(COLLECTOR_MAP.keys())
        summary = []
        for name in targets:
            if name not in COLLECTOR_MAP:
                print(f"WARN unknown source: {name}")
                continue
            summary.append(run_one_source(db, name, dry_run=args.dry_run))

        # scoring + ai flags refresh after collection
        scored = recompute_scores(db)
        rows = db.execute(select(Listing).where(Listing.deal_score != None)).scalars().all()
        for r in rows:
            flags, _explain = analyze_listing(r)
            r.ai_flags = serialize_flags(flags)
        clustered = assign_clusters(rows)
        db.commit()

        print("collector_summary")
        for row in summary:
            print(row)
        print({"scored": scored, "ai_flagged": len(rows), "clustered": clustered})
    finally:
        db.close()


if __name__ == "__main__":
    main()
