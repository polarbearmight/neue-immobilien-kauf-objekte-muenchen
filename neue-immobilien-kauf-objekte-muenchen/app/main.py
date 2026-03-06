from datetime import timedelta
import re
import threading

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import desc, func, select, case
from collections import defaultdict
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine, ensure_schema
from app.models import AlertRule, Listing, ListingSnapshot, Source, SourceRun, Watchlist
from app.schemas import AlertRuleIn, ListingOut, SourceOut
from app.source_reliability import attach_reliability, compute_reliability
from app.time_utils import utc_now
from app.investment import recompute_investments
from app.off_market import recompute_off_market
from collectors.image_tools import hash_distance
from collectors.run_collect import COLLECTOR_MAP, run_one_source_isolated
from app.scoring import recompute_scores
from app.ai_deal_analyzer import analyze_listing, serialize_flags
from app.dedup import assign_clusters
from collectors.source_discovery import SEED_SOURCES, discover_source_card, write_source_report
from collectors.source_validator import validate_source

app = FastAPI(title="Neue Kauf Objekte München API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(bind=engine)
ensure_schema()

scan_lock = threading.Lock()
scan_state = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "current_source": None,
    "completed_sources": 0,
    "total_sources": 0,
    "new_listings_count": 0,
    "updated_count": 0,
    "error_count": 0,
    "status": "idle",
}


def _scan_status_payload() -> dict:
    return {
        "running": scan_state["running"],
        "started_at": scan_state["started_at"],
        "finished_at": scan_state["finished_at"],
        "current_source": scan_state["current_source"],
        "completed_sources": scan_state["completed_sources"],
        "total_sources": scan_state["total_sources"],
        "new_listings_count": scan_state["new_listings_count"],
        "updated_count": scan_state["updated_count"],
        "error_count": scan_state["error_count"],
        "status": scan_state["status"],
    }


def _run_scan_background(targets: list[str]):
    with scan_lock:
        scan_state["running"] = True
        scan_state["started_at"] = utc_now().isoformat()
        scan_state["finished_at"] = None
        scan_state["current_source"] = None
        scan_state["completed_sources"] = 0
        scan_state["total_sources"] = len(targets)
        scan_state["new_listings_count"] = 0
        scan_state["updated_count"] = 0
        scan_state["error_count"] = 0
        scan_state["status"] = "running"

    try:
        for name in targets:
            with scan_lock:
                scan_state["current_source"] = name
            result = run_one_source_isolated(name, dry_run=False, force=False, capture_fixture=False)
            with scan_lock:
                scan_state["completed_sources"] += 1
                scan_state["new_listings_count"] += int(result.get("new", 0) or 0)
                scan_state["updated_count"] += int(result.get("updated", 0) or 0)
                if result.get("status") in ("fail", "blocked"):
                    scan_state["error_count"] += 1

        db = SessionLocal()
        try:
            recompute_scores(db)
            rows = db.execute(select(Listing).where(Listing.deal_score.is_not(None))).scalars().all()
            for r in rows:
                flags, _ = analyze_listing(r)
                r.ai_flags = serialize_flags(flags)
            assign_clusters(rows)
            rel = compute_reliability(db)
            sources = db.execute(select(Source)).scalars().all()
            rel_by_name = {s.name: rel.get(s.id, 0) for s in sources}
            recompute_investments(db, reliability_by_source=rel_by_name)
            recompute_off_market(db)
            db.commit()
        finally:
            db.close()

        with scan_lock:
            scan_state["status"] = "done"
    except Exception:
        with scan_lock:
            scan_state["status"] = "error"
            scan_state["error_count"] += 1
    finally:
        with scan_lock:
            scan_state["running"] = False
            scan_state["current_source"] = None
            scan_state["finished_at"] = utc_now().isoformat()


_district_object_id_re = re.compile(r"\bobjekt[- ]?id\b[:# ]*\w+", re.IGNORECASE)
_district_zip_city_re = re.compile(r"\b8\d{4}\s+m[üu]nchen\b", re.IGNORECASE)


def _normalize_district_name(raw: str | None) -> str | None:
    if not raw:
        return None
    x = raw.strip()
    x = _district_object_id_re.sub("", x)
    x = _district_zip_city_re.sub("", x)
    x = x.replace("München", "").replace("Munich", "")
    x = re.sub(r"\s{2,}", " ", x).strip(" ,.-")
    return x or None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "name": "Neue Kauf Objekte München API",
        "ok": True,
        "endpoints": [
            "/health",
            "/docs",
            "/api/listings",
            "/api/listings/{id}",
            "/api/stats",
            "/api/sources",
            "/api/clusters",
            "/api/off-market",
            "/api/collect/run",
            "/api/scan/run",
            "/api/scan/status",
            "/api/discovery/run",
            "/api/price-drops",
            "/api/watchlist",
            "/api/alert-rules",
        ],
    }


@app.get("/favicon.ico")
def favicon():
    return JSONResponse(status_code=204, content=None)


@app.get("/health")
def health():
    return {"ok": True, "ts": utc_now().isoformat()}


@app.get("/listings", response_model=list[ListingOut])
@app.get("/api/listings", response_model=list[ListingOut])
def listings(
    bucket: str = Query("all", pattern="^(9000|12000|all|unknown)$"),
    sort: str = Query("newest", pattern="^(newest|oldest|score|ppsm|price)$"),
    limit: int = Query(20, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    min_score: float = Query(0, ge=0, le=100),
    district: str | None = None,
    source: str | None = None,
    brand_new: bool = False,
    just_listed: bool = False,
    price_min: float | None = Query(None, ge=0),
    price_max: float | None = Query(None, ge=0),
    sqm_min: float | None = Query(None, ge=0),
    sqm_max: float | None = Query(None, ge=0),
    rooms_min: float | None = Query(None, ge=0),
    rooms_max: float | None = Query(None, ge=0),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    q = select(Listing)

    if not include_inactive:
        q = q.where(Listing.is_active.is_(True))

    if bucket == "9000":
        q = q.where(Listing.price_per_sqm.is_not(None), Listing.price_per_sqm <= 9000)
    elif bucket == "12000":
        q = q.where(Listing.price_per_sqm.is_not(None), Listing.price_per_sqm <= 12000)
    elif bucket == "unknown":
        q = q.where(Listing.price_per_sqm.is_(None))

    if min_score > 0:
        q = q.where(Listing.deal_score.is_not(None), Listing.deal_score >= min_score)
    if district:
        q = q.where(Listing.district.ilike(f"%{district.strip()}%"))
    if source:
        q = q.where(Listing.source == source.strip().lower())

    if price_min is not None:
        q = q.where(Listing.price_eur.is_not(None), Listing.price_eur >= price_min)
    if price_max is not None:
        q = q.where(Listing.price_eur.is_not(None), Listing.price_eur <= price_max)
    if sqm_min is not None:
        q = q.where(Listing.area_sqm.is_not(None), Listing.area_sqm >= sqm_min)
    if sqm_max is not None:
        q = q.where(Listing.area_sqm.is_not(None), Listing.area_sqm <= sqm_max)
    if rooms_min is not None:
        q = q.where(Listing.rooms.is_not(None), Listing.rooms >= rooms_min)
    if rooms_max is not None:
        q = q.where(Listing.rooms.is_not(None), Listing.rooms <= rooms_max)

    now = utc_now()
    if just_listed:
        q = q.where(Listing.first_seen_at >= now - timedelta(hours=2))
    elif brand_new:
        q = q.where(Listing.first_seen_at >= now - timedelta(hours=6))

    order = (desc(Listing.posted_at.is_(None)), desc(Listing.posted_at), desc(Listing.first_seen_at))
    if sort == "oldest":
        order = (Listing.posted_at.asc().nulls_last(), Listing.first_seen_at.asc())
    elif sort == "score":
        order = (Listing.deal_score.desc().nulls_last(), desc(Listing.first_seen_at))
    elif sort == "ppsm":
        order = (Listing.price_per_sqm.asc().nulls_last(), desc(Listing.first_seen_at))
    elif sort == "price":
        order = (Listing.price_eur.asc().nulls_last(), desc(Listing.first_seen_at))

    return db.execute(q.order_by(*order).offset(offset).limit(limit)).scalars().all()


@app.get("/api/listings/{listing_id}", response_model=ListingOut)
def listing_detail(listing_id: int, db: Session = Depends(get_db)):
    row = db.execute(select(Listing).where(Listing.id == listing_id)).scalar_one_or_none()
    if not row:
        return JSONResponse(status_code=404, content={"ok": False, "error": "listing_not_found"})
    return row


@app.get("/api/listings/{listing_id}/detail")
def listing_detail_expanded(listing_id: int, db: Session = Depends(get_db)):
    listing = db.execute(select(Listing).where(Listing.id == listing_id)).scalar_one_or_none()
    if not listing:
        return JSONResponse(status_code=404, content={"ok": False, "error": "listing_not_found"})

    src = db.execute(select(Source).where(Source.name == listing.source)).scalar_one_or_none()
    src_payload = None
    if src:
        src_payload = attach_reliability(db, [src])[0]

    cluster_members = []
    canonical_member_id = None
    cluster_sources = []
    if listing.cluster_id:
        members = db.execute(
            select(Listing)
            .where(Listing.cluster_id == listing.cluster_id)
            .order_by(Listing.first_seen_at.desc())
            .limit(30)
        ).scalars().all()
        if members:
            canonical = sorted(
                members,
                key=lambda x: (
                    x.price_eur is None,
                    x.price_eur or 0,
                    -(x.deal_score or 0),
                    x.first_seen_at,
                ),
            )[0]
            canonical_member_id = canonical.id
            cluster_sources = sorted({m.source for m in members})
        cluster_members = [
            {
                "id": m.id,
                "source": m.source,
                "title": m.title,
                "url": m.url,
                "price_eur": m.price_eur,
                "price_per_sqm": m.price_per_sqm,
                "first_seen_at": m.first_seen_at,
                "is_canonical": m.id == canonical_member_id,
            }
            for m in members
        ]

    snaps = db.execute(
        select(ListingSnapshot)
        .where(ListingSnapshot.listing_id == listing_id)
        .order_by(ListingSnapshot.captured_at.asc())
        .limit(120)
    ).scalars().all()

    old_price = snaps[0].price_eur if snaps else None
    current_price = snaps[-1].price_eur if snaps else listing.price_eur
    has_price_drop = bool(old_price is not None and current_price is not None and current_price < old_price)

    return {
        "ok": True,
        "listing": {
            "id": listing.id,
            "source": listing.source,
            "source_listing_id": listing.source_listing_id,
            "url": listing.url,
            "title": listing.title,
            "description": listing.description,
            "district": listing.district,
            "address": listing.address,
            "rooms": listing.rooms,
            "area_sqm": listing.area_sqm,
            "price_eur": listing.price_eur,
            "price_per_sqm": listing.price_per_sqm,
            "deal_score": listing.deal_score,
            "estimated_rent_per_sqm": listing.estimated_rent_per_sqm,
            "estimated_monthly_rent": listing.estimated_monthly_rent,
            "gross_yield_percent": listing.gross_yield_percent,
            "price_to_rent_ratio": listing.price_to_rent_ratio,
            "investment_score": listing.investment_score,
            "investment_explain": listing.investment_explain,
            "off_market_score": listing.off_market_score,
            "off_market_flags": listing.off_market_flags,
            "off_market_explain": listing.off_market_explain,
            "exclusivity_score": listing.exclusivity_score,
            "source_popularity_score": listing.source_popularity_score,
            "badges": listing.badges,
            "score_explain": listing.score_explain,
            "ai_flags": listing.ai_flags,
            "cluster_id": listing.cluster_id,
            "posted_at": listing.posted_at,
            "first_seen_at": listing.first_seen_at,
        },
        "source": src_payload,
        "cluster": {
            "cluster_id": listing.cluster_id,
            "members_count": len(cluster_members),
            "canonical_listing_id": canonical_member_id,
            "sources": cluster_sources,
            "members": cluster_members,
        },
        "price_history": {
            "old_price": old_price,
            "current_price": current_price,
            "has_price_drop": has_price_drop,
            "snapshots": [
                {
                    "id": s.id,
                    "captured_at": s.captured_at,
                    "price_eur": s.price_eur,
                    "price_per_sqm": s.price_per_sqm,
                    "is_active": s.is_active,
                }
                for s in snaps
            ],
        },
    }


@app.post("/api/collect/run")
def api_collect_run(source: str = Query("all"), dry_run: bool = Query(False)):
    targets = [source] if source != "all" else list(COLLECTOR_MAP.keys())
    summary = []
    for name in targets:
        if name not in COLLECTOR_MAP:
            summary.append({"source": name, "status": "unknown_source"})
            continue
        summary.append(run_one_source_isolated(name, dry_run=dry_run))
    return {"ok": True, "dry_run": dry_run, "summary": summary}


@app.post("/api/scan/run")
def api_scan_run(db: Session = Depends(get_db)):
    with scan_lock:
        if scan_state["running"]:
            return {"ok": True, "already_running": True, "scan": _scan_status_payload()}

    # Product decision: manual scan should run all built-in collectors regardless of source approval/enable flags.
    targets = list(COLLECTOR_MAP.keys())

    if not targets:
        return JSONResponse(status_code=400, content={"ok": False, "error": "no_collectors_registered"})

    t = threading.Thread(target=_run_scan_background, args=(targets,), daemon=True)
    t.start()
    return {"ok": True, "already_running": False, "scan": _scan_status_payload()}


@app.get("/api/scan/status")
def api_scan_status():
    with scan_lock:
        return {"ok": True, "scan": _scan_status_payload()}


@app.get("/duplicates")
@app.get("/api/duplicates")
def duplicates(limit: int = Query(100, ge=10, le=500), max_distance: int = Query(8, ge=0, le=32), db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.image_hash.is_not(None)).order_by(desc(Listing.first_seen_at)).limit(limit)).scalars().all()
    out = []
    for i in range(len(rows)):
        a = rows[i]
        for j in range(i + 1, len(rows)):
            b = rows[j]
            if a.source == b.source:
                continue
            d = hash_distance(a.image_hash, b.image_hash)
            if d is None or d > max_distance:
                continue
            out.append(
                {
                    "distance": d,
                    "a": {"id": a.id, "source": a.source, "title": a.title, "url": a.url, "price_eur": a.price_eur, "area_sqm": a.area_sqm},
                    "b": {"id": b.id, "source": b.source, "title": b.title, "url": b.url, "price_eur": b.price_eur, "area_sqm": b.area_sqm},
                }
            )
    out.sort(key=lambda x: x["distance"])
    return out[:200]


@app.get("/api/sources", response_model=list[SourceOut])
def api_sources(db: Session = Depends(get_db)):
    q = select(Source).order_by(Source.name.asc())
    rows = db.execute(q).scalars().all()
    return attach_reliability(db, rows)


@app.get("/api/sources/{source_id}/runs")
def api_source_runs(source_id: int, limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_db)):
    src = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not src:
        return JSONResponse(status_code=404, content={"ok": False, "error": "source_not_found"})
    rows = db.execute(
        select(SourceRun)
        .where(SourceRun.source_id == source_id)
        .order_by(desc(SourceRun.started_at))
        .limit(limit)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "started_at": r.started_at,
            "finished_at": r.finished_at,
            "status": r.status,
            "new_count": r.new_count,
            "updated_count": r.updated_count,
            "skipped_known_count": getattr(r, "skipped_known_count", 0),
            "parse_errors": getattr(r, "parse_errors", 0),
            "http_errors": getattr(r, "http_errors", 0),
            "notes": r.notes,
        }
        for r in rows
    ]


@app.get("/api/price-drops")
def api_price_drops(limit: int = Query(200, ge=1, le=2000), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Listing)
        .where(Listing.badges.is_not(None), Listing.badges.ilike("%PRICE_DROP%"))
        .order_by(desc(Listing.first_seen_at))
        .limit(limit)
    ).scalars().all()
    return rows


@app.post("/api/sources/{source_id}/approve")
def api_source_approve(source_id: int, approved: bool = True, db: Session = Depends(get_db)):
    row = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not row:
        return JSONResponse(status_code=404, content={"ok": False, "error": "source_not_found"})
    row.approved = approved
    if not approved:
        row.enabled = False
        row.health_status = "disabled"
    row.updated_at = utc_now()
    db.commit()
    return {"ok": True, "id": row.id, "approved": row.approved, "enabled": row.enabled}


@app.post("/api/sources/{source_id}/enable")
def api_source_enable(source_id: int, enabled: bool = True, db: Session = Depends(get_db)):
    row = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not row:
        return JSONResponse(status_code=404, content={"ok": False, "error": "source_not_found"})
    if enabled and not row.approved:
        return JSONResponse(status_code=400, content={"ok": False, "error": "source_not_approved"})
    row.enabled = enabled
    if not enabled:
        row.health_status = "disabled"
    row.updated_at = utc_now()
    db.commit()
    return {"ok": True, "id": row.id, "enabled": row.enabled, "health_status": row.health_status}


@app.post("/api/sources/{source_id}/self-test")
def api_source_self_test(source_id: int, db: Session = Depends(get_db)):
    row = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not row:
        return JSONResponse(status_code=404, content={"ok": False, "error": "source_not_found"})

    result = validate_source(row.base_url)
    row.health_status = result.status if row.enabled else "disabled"
    row.last_error = None if result.status == "healthy" else result.notes
    row.updated_at = utc_now()
    db.commit()
    return {
        "ok": True,
        "source": row.name,
        "status": row.health_status,
        "robots": result.robots,
        "http_status": result.http_status,
        "notes": result.notes,
    }


@app.post("/api/watchlist/{listing_id}")
def api_watchlist_add(listing_id: int, notes: str | None = None, db: Session = Depends(get_db)):
    listing = db.execute(select(Listing).where(Listing.id == listing_id)).scalar_one_or_none()
    if not listing:
        return JSONResponse(status_code=404, content={"ok": False, "error": "listing_not_found"})

    row = db.execute(select(Watchlist).where(Watchlist.listing_id == listing_id)).scalar_one_or_none()
    if row:
        if notes is not None:
            row.notes = notes
            db.commit()
        return {"ok": True, "id": row.id, "listing_id": listing_id, "updated": True}

    row = Watchlist(listing_id=listing_id, notes=notes)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "id": row.id, "listing_id": listing_id, "updated": False}


@app.get("/api/watchlist")
def api_watchlist(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Watchlist, Listing)
        .join(Listing, Listing.id == Watchlist.listing_id)
        .order_by(Watchlist.created_at.desc())
    ).all()
    return [
        {
            "id": w.id,
            "created_at": w.created_at,
            "notes": w.notes,
            "listing": {
                "id": l.id,
                "source": l.source,
                "title": l.title,
                "url": l.url,
                "price_eur": l.price_eur,
                "price_per_sqm": l.price_per_sqm,
                "deal_score": l.deal_score,
                "district": l.district,
            },
        }
        for w, l in rows
    ]


@app.post("/api/alert-rules")
def api_alert_rule_create(payload: AlertRuleIn, db: Session = Depends(get_db)):
    row = AlertRule(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "id": row.id}


@app.get("/api/alert-rules")
def api_alert_rule_list(db: Session = Depends(get_db)):
    return db.execute(select(AlertRule).order_by(AlertRule.created_at.desc())).scalars().all()


@app.get("/api/off-market")
def api_off_market(
    limit: int = Query(120, ge=1, le=1000),
    min_score: float = Query(0, ge=0, le=100),
    source: str | None = None,
    district: str | None = None,
    price_min: float | None = Query(None, ge=0),
    price_max: float | None = Query(None, ge=0),
    sqm_min: float | None = Query(None, ge=0),
    sqm_max: float | None = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    q = select(Listing).where(Listing.off_market_score.is_not(None))
    if min_score > 0:
        q = q.where(Listing.off_market_score >= min_score)
    if source:
        q = q.where(Listing.source == source.strip().lower())
    if district:
        q = q.where(Listing.district.ilike(f"%{district.strip()}%"))
    if price_min is not None:
        q = q.where(Listing.price_eur.is_not(None), Listing.price_eur >= price_min)
    if price_max is not None:
        q = q.where(Listing.price_eur.is_not(None), Listing.price_eur <= price_max)
    if sqm_min is not None:
        q = q.where(Listing.area_sqm.is_not(None), Listing.area_sqm >= sqm_min)
    if sqm_max is not None:
        q = q.where(Listing.area_sqm.is_not(None), Listing.area_sqm <= sqm_max)

    rows = db.execute(q.order_by(Listing.off_market_score.desc().nulls_last(), Listing.first_seen_at.desc()).limit(limit)).scalars().all()
    return rows


@app.get("/api/clusters")
def api_clusters(limit: int = Query(200, ge=1, le=2000), db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.cluster_id.is_not(None)).order_by(desc(Listing.first_seen_at)).limit(limit)).scalars().all()
    clusters = defaultdict(list)
    for r in rows:
        clusters[r.cluster_id].append(r)

    out = []
    for cid, members in clusters.items():
        canonical = sorted(
            members,
            key=lambda x: (
                x.price_eur is None,
                x.price_eur or 0,
                -(x.deal_score or 0),
                x.first_seen_at,
            ),
        )[0]
        payload_members = [
            {
                "id": r.id,
                "source": r.source,
                "source_listing_id": r.source_listing_id,
                "title": r.title,
                "url": r.url,
                "price_eur": r.price_eur,
                "price_per_sqm": r.price_per_sqm,
                "area_sqm": r.area_sqm,
                "district": r.district,
            }
            for r in sorted(members, key=lambda x: (x.source, x.price_eur or 0))
        ]
        sources = sorted({m.source for m in members})
        out.append(
            {
                "cluster_id": cid,
                "members_count": len(payload_members),
                "sources": sources,
                "canonical_listing_id": canonical.id,
                "canonical": {
                    "id": canonical.id,
                    "source": canonical.source,
                    "title": canonical.title,
                    "url": canonical.url,
                    "price_eur": canonical.price_eur,
                    "price_per_sqm": canonical.price_per_sqm,
                    "area_sqm": canonical.area_sqm,
                    "district": canonical.district,
                },
                "members": payload_members,
            }
        )

    out.sort(key=lambda x: x["members_count"], reverse=True)
    return out


@app.post("/api/discovery/run")
def api_discovery_run(db: Session = Depends(get_db)):
    report_dir = "reports/source_cards"
    created = []

    for s in SEED_SOURCES:
        card = discover_source_card(s["name"], s["base_url"], s.get("kind", "unknown"))
        report_path = write_source_report(card, report_dir)

        row = db.execute(select(Source).where(Source.base_url == s["base_url"])).scalar_one_or_none()
        if row:
            row.kind = card.kind
            row.robots_status = card.robots_status
            row.updated_at = utc_now()
        else:
            row = Source(
                name=card.name,
                base_url=card.base_url,
                kind=card.kind,
                discovery_method="seed",
                robots_status=card.robots_status,
                approved=False,
                enabled=False,
                health_status="disabled",
                rate_limit_seconds=card.recommended_rate_limit_seconds,
            )
            db.add(row)
        created.append({"name": card.name, "report": str(report_path)})

    db.commit()
    return {"ok": True, "sources": len(created), "reports": created}


@app.get("/api/analytics")
def api_analytics(days: int = Query(30, ge=1, le=180), db: Session = Depends(get_db)):
    since = utc_now() - timedelta(days=days)

    source_rows = db.execute(
        select(Listing.source, func.count().label("cnt"))
        .where(Listing.first_seen_at >= since)
        .group_by(Listing.source)
        .order_by(func.count().desc())
    ).all()

    price_band_expr = case(
        (Listing.price_per_sqm.is_(None), "unknown"),
        (Listing.price_per_sqm <= 9000, "<=9000"),
        (Listing.price_per_sqm <= 12000, "9001-12000"),
        else_=">12000",
    )
    price_band_rows = db.execute(
        select(price_band_expr.label("band"), func.count().label("cnt"))
        .where(Listing.first_seen_at >= since)
        .group_by("band")
    ).all()

    district_rows = db.execute(
        select(Listing.district, func.count().label("cnt"), func.avg(Listing.price_per_sqm).label("avg_ppsqm"))
        .where(Listing.first_seen_at >= since, Listing.district.is_not(None))
        .group_by(Listing.district)
        .order_by(func.count().desc())
        .limit(200)
    ).all()

    district_bucket: dict[str, dict[str, float]] = {}
    for d, c, a in district_rows:
        clean = _normalize_district_name(d)
        if not clean:
            continue
        b = district_bucket.setdefault(clean, {"count": 0, "ppsqm_sum": 0.0, "ppsqm_cnt": 0})
        b["count"] += int(c)
        if a is not None:
            b["ppsqm_sum"] += float(a) * int(c)
            b["ppsqm_cnt"] += int(c)

    district_stats = []
    for name, b in district_bucket.items():
        if b["count"] < 2:
            continue
        avg = (b["ppsqm_sum"] / b["ppsqm_cnt"]) if b["ppsqm_cnt"] else None
        district_stats.append({"district": name, "count": int(b["count"]), "avg_ppsqm": round(avg, 2) if avg else None})
    district_stats.sort(key=lambda x: x["count"], reverse=True)
    district_stats = district_stats[:15]

    trend_rows = db.execute(
        select(func.date(Listing.first_seen_at).label("d"), func.count().label("cnt"), func.avg(Listing.price_per_sqm).label("avg_ppsqm"))
        .where(Listing.first_seen_at >= since)
        .group_by("d")
        .order_by("d")
    ).all()

    return {
        "days": days,
        "source_distribution": [{"source": s, "count": int(c)} for s, c in source_rows],
        "price_bands": [{"band": b, "count": int(c)} for b, c in price_band_rows],
        "district_stats": district_stats,
        "trend_insights": [
            {"date": str(d), "count": int(c), "avg_ppsqm": round(float(a), 2) if a else None}
            for d, c, a in trend_rows
        ],
    }


@app.get("/stats")
@app.get("/api/stats")
def stats(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    since = utc_now() - timedelta(days=days)
    new_count = db.scalar(select(func.count()).select_from(Listing).where(Listing.first_seen_at >= since))
    avg_ppsqm = db.scalar(select(func.avg(Listing.price_per_sqm)).where(Listing.first_seen_at >= since, Listing.price_per_sqm.is_not(None)))
    top_deals = db.scalar(select(func.count()).select_from(Listing).where(Listing.first_seen_at >= since, Listing.deal_score.is_not(None), Listing.deal_score >= 85))

    rows = db.execute(select(Listing.first_seen_at, Listing.price_per_sqm).where(Listing.first_seen_at >= since)).all()
    counts = defaultdict(int)
    ppsm_sum = defaultdict(float)
    ppsm_cnt = defaultdict(int)
    for ts, ppsm in rows:
        d = ts.date().isoformat()
        counts[d] += 1
        if ppsm is not None:
            ppsm_sum[d] += float(ppsm)
            ppsm_cnt[d] += 1

    series = []
    base_now = utc_now()
    for i in range(days - 1, -1, -1):
        d = (base_now - timedelta(days=i)).date().isoformat()
        avg = (ppsm_sum[d] / ppsm_cnt[d]) if ppsm_cnt[d] else None
        series.append({"date": d, "count": counts[d], "avg_ppsqm": round(avg, 2) if avg else None})

    return {
        "days": days,
        "new_listings": int(new_count or 0),
        "avg_price_per_sqm": round(float(avg_ppsqm), 2) if avg_ppsqm else None,
        "top_deals": int(top_deals or 0),
        "series": series,
    }


@app.get("/api/listings/{listing_id}/snapshots")
def listing_snapshots(listing_id: int, limit: int = Query(50, ge=1, le=500), db: Session = Depends(get_db)):
    rows = db.execute(
        select(ListingSnapshot)
        .where(ListingSnapshot.listing_id == listing_id)
        .order_by(desc(ListingSnapshot.captured_at))
        .limit(limit)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "captured_at": r.captured_at,
            "price_eur": r.price_eur,
            "price_per_sqm": r.price_per_sqm,
            "is_active": r.is_active,
        }
        for r in rows
    ]
