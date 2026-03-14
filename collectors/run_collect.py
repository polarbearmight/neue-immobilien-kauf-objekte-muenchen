import argparse
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from sqlalchemy import or_, select

from app.db import SessionLocal, Base, engine, ensure_schema
from app.models import Listing, ListingSnapshot, Source, SourceRun, SourceState
from collectors.image_tools import compute_phash_from_url
from collectors.sz import collect_sz_listings
from collectors.immowelt import collect_immowelt_listings
from collectors.immoscout import collect_immoscout_private_filtered_listings
from collectors.kip import collect_kip_munich_listings
from collectors.ohne_makler import collect_ohne_makler_listings
from collectors.wohnungsboerse import collect_wohnungsboerse_listings
from collectors.sis import collect_sis_listings
from collectors.planethome import collect_planethome_listings
from collectors.zvg import collect_zvg_munich_listings
from collectors.brokers import (
    AUCTION_DISCOVERY_SOURCES,
    BROKER_SOURCES,
    CLASSIFIED_DISCOVERY_SOURCES,
    SOURCE_FETCH_MODE,
    make_broker_collector,
    make_multi_seed_collector,
)
from collectors.source_validator import validate_source
from collectors.normalize import normalize_listing_row, dedupe_rows
from app.scoring import recompute_scores
from app.ai_deal_analyzer import analyze_listing, serialize_flags
from app.dedup import assign_clusters
from app.investment import recompute_investments
from app.source_reliability import compute_reliability
from app.off_market import recompute_off_market
from app.location import recompute_locations
from app.time_utils import ensure_utc

COLLECTOR_MAP = {
    "sz": (collect_sz_listings, "https://immobilienmarkt.sueddeutsche.de"),
    "immowelt_privat": (collect_immowelt_listings, "https://www.immowelt.de"),
    "immoscout_private_filtered": (collect_immoscout_private_filtered_listings, "https://www.immobilienscout24.de"),
    "kip_muenchen": (collect_kip_munich_listings, "https://www.kip.net/bayern/muenchen"),
    "ohne_makler_privat": (collect_ohne_makler_listings, "https://www.ohne-makler.net"),
    "wohnungsboerse": (collect_wohnungsboerse_listings, "https://www.wohnungsboerse.net"),
    "sis": (collect_sis_listings, "https://www.sis.de"),
    "planethome": (collect_planethome_listings, "https://planethome.de"),
    "auction_zvg_portal": (collect_zvg_munich_listings, "https://www.zvg-portal.de/"),
}

for _name, _url in BROKER_SOURCES.items():
    COLLECTOR_MAP[_name] = (make_broker_collector(_name, _url), _url)

def _canonical_base(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}" if p.scheme and p.netloc else url


for _name, _seed_urls in CLASSIFIED_DISCOVERY_SOURCES.items():
    if _name in COLLECTOR_MAP:
        continue
    # canonical base_url should stay on host root so existing seed rows are reused/migrated
    COLLECTOR_MAP[_name] = (make_multi_seed_collector(_name, _seed_urls), _canonical_base(_seed_urls[0]))

for _name, _seed_urls in AUCTION_DISCOVERY_SOURCES.items():
    if _name in COLLECTOR_MAP:
        continue
    COLLECTOR_MAP[_name] = (make_multi_seed_collector(_name, _seed_urls), _canonical_base(_seed_urls[0]))


DEVELOPER_PROJECT_SOURCES = {
    "broker_bayerische_hausbau",
    "broker_isaria",
    "broker_bauwerk",
    "broker_pandion",
    "broker_ehret_klein",
}

AUTO_APPROVED_SOURCES = {
    "kleinanzeigen",
    "auction_zvg_portal",
    "immowelt_privat",
    "ohne_makler_privat",
    "kip_muenchen",
}


def _source_profile(name: str) -> tuple[str, int]:
    """Returns (discovery_method, rate_limit_seconds)."""
    if name in DEVELOPER_PROJECT_SOURCES:
        return "secondary_discovery", 14400  # every 4 hours
    if name.startswith("auction_"):
        return "secondary_discovery", 21600  # every 6 hours
    if name in CLASSIFIED_DISCOVERY_SOURCES:
        return "secondary_discovery", 7200  # every 2 hours
    if name.startswith("broker_"):
        return "secondary_discovery", 7200  # every 2 hours
    return "seed", 1800  # major portals every 30 minutes


def _row_hash(row: dict) -> str:
    payload = {
        "title": row.get("title") or "",
        "description": row.get("description") or "",
        "district": row.get("district") or "",
        "address": row.get("address") or "",
        "postal_code": row.get("postal_code") or "",
        "latitude": row.get("latitude"),
        "longitude": row.get("longitude"),
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
    return datetime.now(timezone.utc) - ensure_utc(last_seen_at) >= timedelta(days=inactive_days)


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
    stamp = now.strftime('%Y%m%d-%H%M%S')
    return [{
        "source": "seed",
        "source_listing_id": f"seed-{stamp}",
        "url": f"https://example.com/seed-listing?seed={stamp}",
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
    discovery_method, rate_limit_seconds = _source_profile(name)
    src = db.execute(select(Source).where(Source.name == name)).scalar_one_or_none()
    if not src:
        src = db.execute(select(Source).where(Source.base_url == base_url)).scalar_one_or_none()
    auto_approved = name in AUTO_APPROVED_SOURCES
    if src:
        changed = False
        if src.name != name:
            src.name = name
            changed = True
        if src.base_url != base_url:
            src.base_url = base_url
            changed = True
        if src.discovery_method != discovery_method:
            src.discovery_method = discovery_method
            changed = True
        if int(src.rate_limit_seconds or 0) != int(rate_limit_seconds):
            src.rate_limit_seconds = int(rate_limit_seconds)
            changed = True
        if auto_approved and (not src.approved or not src.enabled or src.health_status != "healthy"):
            src.approved = True
            src.enabled = True
            src.health_status = "healthy"
            changed = True
        if changed:
            src.updated_at = datetime.now(timezone.utc)
            db.commit()
        return src

    approval_required = os.getenv("APPROVAL_REQUIRED", "true").lower() in ("1", "true", "yes")
    src = Source(
        name=name,
        base_url=base_url,
        kind="html",
        discovery_method=discovery_method,
        robots_status="unknown",
        approved=(auto_approved or not approval_required),
        enabled=(auto_approved or not approval_required),
        health_status="healthy" if (auto_approved or not approval_required) else "disabled",
        rate_limit_seconds=rate_limit_seconds,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


def _should_force_deactivate_legacy_listing(listing: Listing, source_name: str) -> bool:
    if listing.source != source_name:
        return False

    url = (listing.url or "").lower()
    title = (listing.title or "").lower()

    if source_name == "kleinanzeigen":
        if "/s-anzeige/" not in url:
            return True
        if listing.price_eur is None:
            return True
        return False

    if source_name == "broker_riedel":
        return "/objekte/" not in url

    if source_name == "broker_engel_voelkers_muenchen":
        if "/exposes/" not in url:
            return True
        if "engel & völkers" in title and "immobilie kaufen in" in title:
            return True
        return False

    return False


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
                or_(
                    (Listing.source == row["source"]) & (Listing.source_listing_id == sid),
                    Listing.url == row.get("url"),
                )
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
            existing.source = row.get("source") or existing.source
            existing.source_listing_id = row.get("source_listing_id") or existing.source_listing_id
            existing.title = row.get("title") or existing.title
            existing.display_title = row.get("display_title") or existing.display_title
            existing.raw_title = row.get("raw_title") or existing.raw_title
            existing.description = row.get("description") or existing.description
            existing.raw_description = row.get("raw_description") or existing.raw_description
            existing.image_url = row.get("image_url") or existing.image_url
            existing.image_hash = row.get("image_hash") or existing.image_hash
            existing.address = row.get("address") or existing.address
            existing.city = row.get("city") or existing.city
            existing.raw_district_text = row.get("raw_district_text") or existing.raw_district_text
            existing.district = row.get("district") or existing.district
            existing.postal_code = row.get("postal_code") or existing.postal_code
            existing.latitude = row.get("latitude") if row.get("latitude") is not None else existing.latitude
            existing.longitude = row.get("longitude") if row.get("longitude") is not None else existing.longitude
            existing.location_confidence = row.get("location_confidence") if row.get("location_confidence") is not None else existing.location_confidence
            existing.district_source = row.get("district_source") or existing.district_source
            existing.price_eur = row.get("price_eur") if row.get("price_eur") is not None else existing.price_eur
            existing.area_sqm = row.get("area_sqm") if row.get("area_sqm") is not None else existing.area_sqm
            existing.rooms = row.get("rooms") if row.get("rooms") is not None else existing.rooms
            # allow explicit reset to None when normalization removed implausible ppsqm
            if "price_per_sqm" in row:
                existing.price_per_sqm = row.get("price_per_sqm")
            # safety: without price we do not keep stale €/m²
            if existing.price_eur is None:
                existing.price_per_sqm = None
            existing.quality_flags = row.get("quality_flags") or existing.quality_flags
            existing.source_payload_debug = row.get("source_payload_debug") or existing.source_payload_debug
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

    active_rows = db.execute(
        select(Listing).where(
            Listing.source == source_name,
            Listing.is_active.is_(True),
        )
    ).scalars().all()
    for stale in active_rows:
        if stale.source_listing_id in seen_ids:
            continue
        should_force_deactivate = _should_force_deactivate_legacy_listing(stale, source_name)
        stale_last_seen = ensure_utc(stale.last_seen_at) if stale.last_seen_at else None
        is_stale_inactive = bool(stale_last_seen and stale_last_seen < now - timedelta(hours=12) and _is_inactive(stale.last_seen_at))
        if should_force_deactivate or is_stale_inactive:
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


def _collector_timeout_for_source(source_name: str) -> int:
    default_timeout = int(os.getenv("COLLECTOR_TIMEOUT_SECONDS", "120"))
    # heavier dynamic/classified sources typically need more wall time
    overrides = {
        "kleinanzeigen": int(os.getenv("COLLECTOR_TIMEOUT_KLEINANZEIGEN", "300")),
        "broker_engel_voelkers_muenchen": int(os.getenv("COLLECTOR_TIMEOUT_ENGEL", "240")),
        "broker_schneider_prell": int(os.getenv("COLLECTOR_TIMEOUT_SCHNEIDER_PRELL", "180")),
        "broker_riedel": int(os.getenv("COLLECTOR_TIMEOUT_RIEDEL", "240")),
    }
    return overrides.get(source_name, default_timeout)


def _should_stop_early(scanned: int, known_count: int, known_streak: int) -> bool:
    known_ratio_threshold = float(os.getenv("STOP_EARLY_KNOWN_RATIO", "0.8"))
    known_streak_threshold = int(os.getenv("STOP_EARLY_KNOWN_STREAK", "20"))
    min_scan = int(os.getenv("STOP_EARLY_MIN_SCAN", "25"))

    if scanned < min_scan:
        return False
    known_ratio = known_count / scanned if scanned else 0.0
    return known_streak >= known_streak_threshold or known_ratio >= known_ratio_threshold


def _apply_stop_early(db, source_name: str, rows: list[dict]) -> tuple[list[dict], int]:
    if not rows:
        return rows, 0

    kept: list[dict] = []
    known_count = 0
    known_streak = 0
    scanned = 0

    for row in rows:
        scanned += 1
        existing = db.execute(
            select(Listing.id).where(
                Listing.source == source_name,
                Listing.source_listing_id == row["source_listing_id"],
            )
        ).scalar_one_or_none()

        if existing:
            known_count += 1
            known_streak += 1
        else:
            known_streak = 0
            kept.append(row)

        if _should_stop_early(scanned=scanned, known_count=known_count, known_streak=known_streak):
            break

    return kept, known_count


def _coverage_warning(db, src: Source, raw_count: int, effective_normalized_count: int, total_volume: int) -> str | None:
    min_raw = int(os.getenv("COVERAGE_WARN_MIN_RAW", "20"))
    drop_ratio = float(os.getenv("COVERAGE_WARN_DROP_RATIO", "0.4"))
    min_norm_ratio = float(os.getenv("COVERAGE_WARN_MIN_NORM_RATIO", "0.35"))

    # basic quality warning for current run
    norm_ratio = (effective_normalized_count / raw_count) if raw_count else 1.0
    if raw_count >= min_raw and norm_ratio < min_norm_ratio:
        return f"coverage_warn: low_norm_ratio={norm_ratio:.2f} raw={raw_count} effective_normalized={effective_normalized_count}"

    # drop vs recent median volume (new+updated+skipped_known)
    prev = db.execute(
        select(SourceRun)
        .where(SourceRun.source_id == src.id)
        .order_by(SourceRun.started_at.desc())
        .limit(6)
    ).scalars().all()
    hist = [int((x.new_count or 0) + (x.updated_count or 0) + (x.skipped_known_count or 0)) for x in prev]
    hist = [x for x in hist if x > 0]
    if len(hist) >= 3 and total_volume > 0:
        s = sorted(hist)
        med = s[len(s) // 2]
        if med >= min_raw and total_volume < med * (1.0 - drop_ratio):
            return f"coverage_warn: volume_drop current={total_volume} median={med}"

    return None


def run_one_source(db, source_name: str, dry_run: bool = False, force: bool = False, capture_fixture: bool = False) -> dict:
    collector, base_url = COLLECTOR_MAP[source_name]
    src = get_or_create_source(db, source_name, base_url)

    allow_unapproved = os.getenv("ALLOW_UNAPPROVED_SOURCES", "true").lower() in ("1", "true", "yes")
    effective_force = force or allow_unapproved

    if not force and src.last_success_at and src.rate_limit_seconds:
        age_s = (datetime.now(timezone.utc) - ensure_utc(src.last_success_at)).total_seconds()
        if age_s < float(src.rate_limit_seconds):
            remaining = int(float(src.rate_limit_seconds) - age_s)
            return {
                "source": source_name,
                "status": "skipped",
                "reason": "rate_limited",
                "remaining_seconds": remaining,
                "new": 0,
                "updated": 0,
            }

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
        strict_validation = os.getenv("STRICT_SOURCE_VALIDATION", "false").lower() in ("1", "true", "yes")
        if strict_validation:
            run.status = "degraded"
            run.notes = f"validation blocked: {validation.notes}"
            run.finished_at = datetime.now(timezone.utc)
            db.commit()
            return {"source": source_name, "status": "blocked", "new": 0, "updated": 0}
        # best-effort mode: continue collection even when preflight validation is blocked
        run.status = "degraded"
        run.notes = f"validation blocked (best-effort continue): {validation.notes}"

    timeout_seconds = _collector_timeout_for_source(source_name)
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
    dropped_invalid = 0
    for row in rows:
        n = normalize_listing_row(row)
        if n:
            normalized.append(n)
        else:
            dropped_invalid += 1
            run.parse_errors += 1
    deduped = dedupe_rows(normalized)
    dedupe_removed = max(0, len(normalized) - len(deduped))
    rows = deduped
    rows, known_precheck_count = _apply_stop_early(db, source_name, rows)

    if source_name == "sz" and not rows:
        rows = ensure_seed_row(rows)

    print(f"[collector:{source_name}] fetched={raw_count} normalized={len(rows)} known_precheck={known_precheck_count}", flush=True)

    if capture_fixture:
        _capture_fixture(source_name, rows)

    if not dry_run:
        new_count, updated_count, skipped_known_count = upsert_rows(db, rows, source_name=source_name)
    else:
        new_count, updated_count, skipped_known_count = len(rows), 0, 0

    run.new_count = new_count
    run.updated_count = updated_count
    run.skipped_known_count = skipped_known_count + known_precheck_count
    run.finished_at = datetime.now(timezone.utc)
    total_volume = run.new_count + run.updated_count + run.skipped_known_count
    effective_normalized_count = len(rows) + known_precheck_count
    warn = _coverage_warning(
        db,
        src,
        raw_count=raw_count,
        effective_normalized_count=effective_normalized_count,
        total_volume=total_volume,
    )
    if run.status == "ok":
        run.notes = warn or validation.notes

    # Source health monitoring: mark unstable after repeated failures.
    recent = db.execute(
        select(SourceRun)
        .where(SourceRun.source_id == src.id)
        .order_by(SourceRun.started_at.desc())
        .limit(4)
    ).scalars().all()
    fail_streak = 0
    for r in recent:
        if r.status == "ok":
            break
        fail_streak += 1

    if run.status == "ok":
        src.health_status = "healthy"
        src.last_error = None
    elif fail_streak >= 3:
        src.health_status = "unstable"
        src.last_error = run.notes

    state = _get_or_create_source_state(db, src.id)
    if run.status == "ok":
        state.last_successful_run = run.finished_at
    state.last_scan_page = 1
    state.last_known_listing_id = rows[0]["source_listing_id"] if rows else state.last_known_listing_id
    total_skipped_known = skipped_known_count + known_precheck_count
    state.notes = f"raw={raw_count} normalized={len(rows)} skipped_known={total_skipped_known}"

    src.last_success_at = datetime.now(timezone.utc) if run.status == "ok" else src.last_success_at
    src.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "source": source_name,
        "status": run.status,
        "fetch_mode": SOURCE_FETCH_MODE.get(source_name, "html"),
        "new": new_count,
        "updated": updated_count,
        "raw_found": raw_count,
        "normalized": len(rows),
        "dropped_invalid": dropped_invalid,
        "dedupe_removed": dedupe_removed,
        "skipped_known": total_skipped_known,
        "parse_errors": run.parse_errors,
        "http_errors": run.http_errors,
        "coverage_warning": warn,
    }


def _disabled_sources() -> set[str]:
    raw = os.getenv("DISABLED_SOURCES", "")
    return {x.strip().lower() for x in raw.split(",") if x.strip()}


def run_one_source_isolated(source_name: str, dry_run: bool = False, force: bool = False, capture_fixture: bool = False) -> dict:
    db = SessionLocal()
    try:
        return run_one_source(db, source_name, dry_run=dry_run, force=force, capture_fixture=capture_fixture)
    finally:
        db.close()


def run_targets(targets: list[str], disabled: set[str], dry_run: bool = False, force: bool = False, capture_fixture: bool = False) -> list[dict]:
    summary: list[dict] = []
    valid_targets = []
    for name in targets:
        if name not in COLLECTOR_MAP:
            print(f"WARN unknown source: {name}", flush=True)
            continue
        if name.lower() in disabled:
            summary.append({"source": name, "status": "skipped", "reason": "disabled_by_env", "new": 0, "updated": 0})
            continue
        valid_targets.append(name)

    max_workers = int(os.getenv("COLLECTOR_MAX_WORKERS", "1"))
    max_workers = max(1, min(max_workers, len(valid_targets) or 1))

    if max_workers == 1:
        for name in valid_targets:
            print(f"running source: {name}", flush=True)
            result = run_one_source_isolated(name, dry_run=dry_run, force=force, capture_fixture=capture_fixture)
            summary.append(result)
            print(f"done source: {name} -> {result['status']} (new={result['new']}, updated={result['updated']})", flush=True)
        return summary

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(run_one_source_isolated, name, dry_run, force, capture_fixture): name
            for name in valid_targets
        }
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                result = fut.result()
            except Exception as e:
                result = {"source": name, "status": "fail", "reason": f"orchestrator_error: {e}", "new": 0, "updated": 0}
            summary.append(result)
            print(f"done source: {name} -> {result['status']} (new={result.get('new', 0)}, updated={result.get('updated', 0)})", flush=True)

    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="all", help="one source or all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--capture-fixture", action="store_true")
    parser.add_argument("--force", action="store_true", help="collect even if source not approved/enabled")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_schema()

    targets = [args.source] if args.source != "all" else list(COLLECTOR_MAP.keys())
    disabled = _disabled_sources()
    summary = run_targets(targets, disabled, dry_run=args.dry_run, force=args.force, capture_fixture=args.capture_fixture)

    # scoring + ai flags refresh after collection
    db = SessionLocal()
    try:
        located = recompute_locations(db)
        scored = recompute_scores(db)
        rows = db.execute(select(Listing).where(Listing.is_active.is_(True))).scalars().all()
        for r in rows:
            if r.deal_score is not None:
                flags, _explain = analyze_listing(r)
                r.ai_flags = serialize_flags(flags)
        clustered = assign_clusters(rows)
        rel = compute_reliability(db)
        sources = db.execute(select(Source)).scalars().all()
        rel_by_name = {s.name: rel.get(s.id, 0) for s in sources}
        invested = recompute_investments(db, reliability_by_source=rel_by_name)
        off_market = recompute_off_market(db)
        db.commit()

        print("collector_summary")
        for row in summary:
            print(row)
        print({"located": located, "scored": scored, "ai_flagged": len(rows), "clustered": clustered, "invested": invested, "off_market": off_market})
    finally:
        db.close()


if __name__ == "__main__":
    main()
