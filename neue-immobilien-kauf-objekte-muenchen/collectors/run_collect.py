import argparse
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy import select

from app.db import SessionLocal, Base, engine, ensure_schema
from app.models import Listing, ListingSnapshot, Source, SourceRun, SourceState
from collectors.image_tools import compute_phash_from_url
from collectors.sz import collect_sz_listings
from collectors.immowelt import collect_immowelt_listings
from collectors.ohne_makler import collect_ohne_makler_listings
from collectors.wohnungsboerse import collect_wohnungsboerse_listings
from collectors.sis import collect_sis_listings
from collectors.planethome import collect_planethome_listings
from collectors.source_validator import validate_source
from collectors.normalize import normalize_listing_row, dedupe_rows
from app.scoring import recompute_scores
from app.ai_deal_analyzer import analyze_listing, serialize_flags
from app.dedup import assign_clusters

COLLECTOR_MAP = {
    "sz": (collect_sz_listings, "https://immobilienmarkt.sueddeutsche.de"),
    "immowelt": (collect_immowelt_listings, "https://www.immowelt.de"),
    "ohne_makler": (collect_ohne_makler_listings, "https://www.ohne-makler.net"),
    "wohnungsboerse": (collect_wohnungsboerse_listings, "https://www.wohnungsboerse.net"),
    "sis": (collect_sis_listings, "https://www.sis.de"),
    "planethome": (collect_planethome_listings, "https://planethome.de"),
}


def _row_hash(row: dict) -> str:
    payload = {
        "title": row.get("title") or "",
        "description": row.get("description") or "",
        "district": row.get("district") or "",
        "address": row.get("address") or "",
        "price_eur": row.get("price_eur"),
        "area_sqm": row.get("area_sqm"),
        "rooms": row.get("rooms"),
        "price_per_sqm": row.get("price_per_sqm"),
        "url": row.get("url") or "",
    }
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _is_inactive(last_seen_at: datetime | None) -> bool:
    if not last_seen_at:
        return False
    inactive_days = int(os.getenv("INACTIVE_AFTER_DAYS", "3"))
    return datetime.now(timezone.utc) - last_seen_at >= timedelta(days=inactive_days)


def _get_or_create_source_state(db, source_id: int) -> SourceState:
    state = db.execute(select(SourceState).where(SourceState.source_id == source_id)).scalar_one_or_none()
    if state:
        return state
    state = SourceState(source_id=source_id, last_scan_page=1)
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def ensure_seed_row(rows: list[dict]) -> list[dict]:
    enable_seed = os.getenv("ENABLE_FALLBACK_SEED", "true").lower() in ("1", "true", "yes")
    if rows or not enable_seed:
        return rows
    now = datetime.now(timezone.utc)
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


def _capture_fixture(source_name: str, rows: list[dict]):
    d = Path("tests/fixtures") / source_name
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"search-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    p.write_text(json.dumps(rows[:30], ensure_ascii=False, default=str, indent=2), encoding="utf-8")


def get_or_create_source(db, name: str, base_url: str) -> Source:
    src = db.execute(select(Source).where(Source.name == name)).scalar_one_or_none()
    if not src:
        src = db.execute(select(Source).where(Source.base_url == base_url)).scalar_one_or_none()
    if src:
        if src.name != name:
            src.name = name
            src.updated_at = datetime.now(timezone.utc)
            db.commit()
        return src

    approval_required = os.getenv("APPROVAL_REQUIRED", "true").lower() in ("1", "true", "yes")
    src = Source(
        name=name,
        base_url=base_url,
        kind="html",
        discovery_method="seed",
        robots_status="unknown",
        approved=(not approval_required),
        enabled=(not approval_required),
        health_status="disabled" if approval_required else "healthy",
        rate_limit_seconds=8,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


def upsert_rows(db, rows: list[dict], source_name: str) -> tuple[int, int, int]:
    new_count = 0
    updated_count = 0
    skipped_known_count = 0
    seen_ids: set[str] = set()
    now = datetime.now(timezone.utc)

    for row in rows:
        sid = row["source_listing_id"]
        seen_ids.add(sid)
        row_hash = _row_hash(row)

        existing = db.execute(
            select(Listing).where(
                Listing.source == row["source"],
                Listing.source_listing_id == sid,
            )
        ).scalar_one_or_none()

        if existing and existing.raw_hash == row_hash:
            existing.last_seen_at = now
            existing.is_active = True
            skipped_known_count += 1
            continue

        if row.get("image_url") and not row.get("image_hash"):
            row["image_hash"] = compute_phash_from_url(row.get("image_url"))

        if existing:
            old_price = existing.price_eur
            old_active = existing.is_active
            existing.last_seen_at = now
            existing.is_active = True
            existing.raw_hash = row_hash
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

            if old_price != existing.price_eur or old_active != existing.is_active:
                db.add(ListingSnapshot(
                    listing_id=existing.id,
                    price_eur=existing.price_eur,
                    price_per_sqm=existing.price_per_sqm,
                    is_active=True,
                    raw_excerpt=(existing.title or "")[:200],
                ))
            updated_count += 1
        else:
            row["raw_hash"] = row_hash
            row["is_active"] = True
            row["first_seen_at"] = row.get("first_seen_at") or now
            row["last_seen_at"] = now
            new_row = Listing(**row)
            db.add(new_row)
            db.flush()
            db.add(ListingSnapshot(
                listing_id=new_row.id,
                price_eur=new_row.price_eur,
                price_per_sqm=new_row.price_per_sqm,
                is_active=True,
                raw_excerpt=(new_row.title or "")[:200],
            ))
            new_count += 1

    stale_rows = db.execute(
        select(Listing).where(
            Listing.source == source_name,
            Listing.is_active.is_(True),
            Listing.last_seen_at < now - timedelta(hours=12),
        )
    ).scalars().all()
    for stale in stale_rows:
        if stale.source_listing_id in seen_ids:
            continue
        if _is_inactive(stale.last_seen_at):
            stale.is_active = False
            db.add(ListingSnapshot(
                listing_id=stale.id,
                price_eur=stale.price_eur,
                price_per_sqm=stale.price_per_sqm,
                is_active=False,
                raw_excerpt=(stale.title or "")[:200],
            ))

    db.commit()
    return new_count, updated_count, skipped_known_count


def _collect_with_timeout(collector, timeout_seconds: int) -> list[dict]:
    with ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(collector)
        return fut.result(timeout=timeout_seconds)


def run_one_source(db, source_name: str, dry_run: bool = False, force: bool = False, capture_fixture: bool = False) -> dict:
    collector, base_url = COLLECTOR_MAP[source_name]
    src = get_or_create_source(db, source_name, base_url)

    allow_unapproved = os.getenv("ALLOW_UNAPPROVED_SOURCES", "true").lower() in ("1", "true", "yes")
    effective_force = force or allow_unapproved

    if not effective_force and (not src.approved or not src.enabled):
        return {"source": source_name, "status": "skipped", "reason": "not_approved_or_disabled", "new": 0, "updated": 0}

    started = datetime.now(timezone.utc)
    run = SourceRun(
        source_id=src.id,
        started_at=started,
        status="ok",
        new_count=0,
        updated_count=0,
        skipped_known_count=0,
        parse_errors=0,
        http_errors=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    validation = validate_source(base_url)
    src.health_status = validation.status if (src.enabled or effective_force) else "disabled"
    src.last_error = validation.notes if validation.status != "healthy" else None

    if validation.status == "blocked":
        run.status = "degraded"
        run.notes = f"validation blocked: {validation.notes}"
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return {"source": source_name, "status": "blocked", "new": 0, "updated": 0}

    timeout_seconds = int(os.getenv("COLLECTOR_TIMEOUT_SECONDS", "120"))
    print(f"[collector:{source_name}] start (timeout={timeout_seconds}s)", flush=True)
    try:
        rows = _collect_with_timeout(collector, timeout_seconds=timeout_seconds)
    except FutureTimeoutError:
        rows = []
        run.status = "fail"
        run.http_errors += 1
        run.notes = f"collector timeout after {timeout_seconds}s"
    except Exception as e:
        rows = []
        run.status = "fail"
        run.parse_errors += 1
        run.notes = f"collector error: {e}"

    raw_count = len(rows)
    normalized = []
    for row in rows:
        n = normalize_listing_row(row)
        if n:
            normalized.append(n)
        else:
            run.parse_errors += 1
    rows = dedupe_rows(normalized)

    if source_name == "sz" and not rows:
        rows = ensure_seed_row(rows)

    print(f"[collector:{source_name}] fetched={raw_count} normalized={len(rows)}", flush=True)

    if capture_fixture:
        _capture_fixture(source_name, rows)

    if not dry_run:
        new_count, updated_count, skipped_known_count = upsert_rows(db, rows, source_name=source_name)
    else:
        new_count, updated_count, skipped_known_count = len(rows), 0, 0

    run.new_count = new_count
    run.updated_count = updated_count
    run.skipped_known_count = skipped_known_count
    run.finished_at = datetime.now(timezone.utc)
    if run.status == "ok":
        run.notes = validation.notes

    state = _get_or_create_source_state(db, src.id)
    if run.status == "ok":
        state.last_successful_run = run.finished_at
    state.last_scan_page = 1
    state.last_known_listing_id = rows[0]["source_listing_id"] if rows else state.last_known_listing_id
    state.notes = f"raw={raw_count} normalized={len(rows)} skipped_known={skipped_known_count}"

    src.last_success_at = datetime.now(timezone.utc) if run.status == "ok" else src.last_success_at
    src.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "source": source_name,
        "status": run.status,
        "new": new_count,
        "updated": updated_count,
        "skipped_known": skipped_known_count,
        "parse_errors": run.parse_errors,
        "http_errors": run.http_errors,
    }


def _disabled_sources() -> set[str]:
    raw = os.getenv("DISABLED_SOURCES", "")
    return {x.strip().lower() for x in raw.split(",") if x.strip()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="all", help="one source or all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--capture-fixture", action="store_true")
    parser.add_argument("--force", action="store_true", help="collect even if source not approved/enabled")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_schema()

    db = SessionLocal()
    try:
        targets = [args.source] if args.source != "all" else list(COLLECTOR_MAP.keys())
        disabled = _disabled_sources()
        summary = []
        for name in targets:
            if name not in COLLECTOR_MAP:
                print(f"WARN unknown source: {name}", flush=True)
                continue
            if name.lower() in disabled:
                summary.append({"source": name, "status": "skipped", "reason": "disabled_by_env", "new": 0, "updated": 0})
                continue
            print(f"running source: {name}", flush=True)
            result = run_one_source(db, name, dry_run=args.dry_run, force=args.force, capture_fixture=args.capture_fixture)
            summary.append(result)
            print(f"done source: {name} -> {result['status']} (new={result['new']}, updated={result['updated']})", flush=True)

        # scoring + ai flags refresh after collection
        scored = recompute_scores(db)
        rows = db.execute(select(Listing).where(Listing.deal_score.is_not(None))).scalars().all()
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
