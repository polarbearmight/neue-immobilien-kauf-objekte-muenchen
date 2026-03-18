from datetime import timedelta
import csv
import io
import os
import re
import threading
import time

from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import desc, func, select, case
from collections import defaultdict
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine, ensure_schema
from app.models import AlertRule, ContactLead, Listing, ListingSnapshot, PasswordResetToken, Source, SourceRun, User, Watchlist
from app.schemas import AlertRuleIn, ChangePasswordIn, ContactSalesIn, ForgotPasswordIn, ListingOut, LoginIn, ProfileUpdateIn, ResetPasswordIn, SourceOut
from app.source_reliability import attach_reliability, compute_reliability
from app.time_utils import utc_now
from app.investment import recompute_investments
from app.off_market import recompute_off_market
from app.location import recompute_locations
from app.district_analytics import district_metrics
from app.geo_clusters import geo_cells
from app.geo_heatmap import geo_hotspots, geo_summary
from app.district_name_map import canonicalize_district_name
from collectors.image_tools import hash_distance
from collectors.run_collect import COLLECTOR_MAP, run_one_source_isolated
from app.scoring import recompute_scores
from app.ai_deal_analyzer import analyze_listing, serialize_flags
from app.dedup import assign_clusters
from collectors.source_discovery import SEED_SOURCES, discover_source_card, write_source_report
from collectors.source_validator import validate_source
from app.auth import hash_password, hash_reset_token, issue_reset_token, legal_contact_payload, read_frontend_env_password, reset_token_expiry, verify_password

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

login_attempts: dict[str, list[float]] = defaultdict(list)
contact_attempts: dict[str, list[float]] = defaultdict(list)


def _client_key(request: Request, fallback: str = "unknown") -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else fallback)


def _rate_limited(bucket: dict[str, list[float]], key: str, window_seconds: int, limit: int) -> bool:
    now = time.time()
    bucket[key] = [ts for ts in bucket.get(key, []) if now - ts < window_seconds]
    if len(bucket[key]) >= limit:
        return True
    bucket[key].append(now)
    return False


def _seed_default_user():
    db = SessionLocal()
    try:
        seed_username = os.getenv("MDF_USERNAME", "admin")
        seed_password = read_frontend_env_password("admin123")
        existing = db.execute(select(User).where(User.username == seed_username)).scalar_one_or_none()
        if existing:
            if not verify_password(seed_password, existing.password_hash):
                existing.password_hash = hash_password(seed_password)
                existing.updated_at = utc_now()
                db.commit()
            return
        user = User(
            username=seed_username,
            email=os.getenv("MDF_USER_EMAIL", "admin@immodealfinder.de"),
            display_name=os.getenv("MDF_USER_DISPLAY_NAME", "Marius"),
            company=os.getenv("MDF_USER_COMPANY", "ImmoDealFinder"),
            password_hash=hash_password(seed_password),
            is_active=True,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def _startup_scheduler():
    _seed_default_user()
    if scheduler_state.get("enabled", True):
        t = threading.Thread(target=_auto_scan_loop, daemon=True)
        t.start()

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
    "coverage": [],
    "scan_type": None,
}

scheduler_state = {
    "major_last_run_ts": 0.0,
    "secondary_last_run_ts": 0.0,
    "enabled": os.getenv("AUTO_SCAN_ENABLED", "true").lower() in ("1", "true", "yes"),
    "major_interval_seconds": int(os.getenv("AUTO_SCAN_MAJOR_INTERVAL_SECONDS", str(2 * 3600))),
    "secondary_interval_seconds": int(os.getenv("AUTO_SCAN_SECONDARY_INTERVAL_SECONDS", str(4 * 3600))),
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
        "coverage": list(scan_state["coverage"]),
        "scan_type": scan_state.get("scan_type"),
    }


SECONDARY_EXACT = {"kleinanzeigen"}


def _is_secondary(name: str) -> bool:
    return name.startswith("broker_") or name.startswith("auction_") or name in SECONDARY_EXACT


def _broker_targets() -> list[str]:
    return [x for x in COLLECTOR_MAP.keys() if x.startswith("broker_")]


def _secondary_targets() -> list[str]:
    return [x for x in COLLECTOR_MAP.keys() if _is_secondary(x)]


def _major_targets() -> list[str]:
    return [x for x in COLLECTOR_MAP.keys() if not _is_secondary(x)]


def _start_scan_thread(targets: list[str], scan_type: str, force: bool = False) -> bool:
    with scan_lock:
        if scan_state["running"]:
            return False
    t = threading.Thread(target=_run_scan_background, args=(targets, scan_type, force), daemon=True)
    t.start()
    return True


def _auto_scan_loop():
    # background scheduler: major every 2h, secondary every 4h (configurable via env)
    while True:
        try:
            if scheduler_state.get("enabled", True):
                now = time.time()
                with scan_lock:
                    busy = scan_state["running"]

                if not busy:
                    major_due = now - scheduler_state["major_last_run_ts"] >= scheduler_state["major_interval_seconds"]
                    secondary_due = now - scheduler_state["secondary_last_run_ts"] >= scheduler_state["secondary_interval_seconds"]

                    if major_due:
                        if _start_scan_thread(_major_targets(), "major-auto", force=False):
                            scheduler_state["major_last_run_ts"] = now
                    elif secondary_due:
                        if _start_scan_thread(_secondary_targets(), "secondary-auto", force=False):
                            scheduler_state["secondary_last_run_ts"] = now
        except Exception:
            pass

        time.sleep(30)


def _run_scan_background(targets: list[str], scan_type: str = "custom", force: bool = False):
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
        scan_state["coverage"] = []
        scan_state["scan_type"] = scan_type

    successful_sources = 0
    try:
        for name in targets:
            with scan_lock:
                scan_state["current_source"] = name
            try:
                result = run_one_source_isolated(name, dry_run=False, force=force, capture_fixture=False)
                if result.get("status") == "ok":
                    successful_sources += 1
                with scan_lock:
                    scan_state["completed_sources"] += 1
                    scan_state["new_listings_count"] += int(result.get("new", 0) or 0)
                    scan_state["updated_count"] += int(result.get("updated", 0) or 0)
                    scan_state["coverage"].append(result)
                    if result.get("status") in ("fail", "blocked"):
                        scan_state["error_count"] += 1
            except Exception as e:
                with scan_lock:
                    scan_state["completed_sources"] += 1
                    scan_state["error_count"] += 1
                    scan_state["coverage"].append({"source": name, "status": "fail", "error": str(e), "new": 0, "updated": 0})

        db = SessionLocal()
        try:
            recompute_locations(db)
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
            # "skipped" runs (e.g. rate-limited) are not failures.
            # Mark error only when we had hard errors and no successful source.
            had_errors = scan_state["error_count"] > 0
            scan_state["status"] = "error" if (had_errors and successful_sources == 0) else "done"
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

    low = x.lower()
    if not x:
        return None
    if "objekt-id" in low or low in {"objekt", "id", "objekt id", "objekt-id"}:
        return None
    if len(x) <= 2:
        return None
    return x


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
            "/api/districts",
            "/api/geo/districts",
            "/api/geo/hotspots",
            "/api/geo/cells",
            "/api/geo/summary",
            "/api/geo/listings",
            "/api/location/coverage",
            "/api/source-review",
            "/api/source-quality",
            "/api/source-debug",
            "/api/sources/stale-audit",
            "/api/sources/prune-zero-coverage",
            "/api/duplicate-debug",
            "/api/geo-debug",
            "/api/collect/run",
            "/api/scan/run",
            "/api/scan/run-major",
            "/api/scan/run-secondary",
            "/api/scan/run-all",
            "/api/scan/run-brokers",
            "/api/scan/status",
            "/api/scan/coverage",
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
    sort: str = Query("newest", pattern="^(newest|oldest|score|investment|ppsm|price)$"),
    limit: int = Query(20, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    min_score: float = Query(0, ge=0, le=100),
    district: str | None = None,
    districts: str | None = None,
    postal_code: str | None = None,
    source: str | None = None,
    first_seen_date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
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
    if districts:
        district_list = [x.strip() for x in districts.split(",") if x.strip()]
        if district_list:
            q = q.where(Listing.district.in_(district_list))
    if postal_code:
        q = q.where(Listing.postal_code == postal_code.strip())
    if source:
        q = q.where(Listing.source == source.strip().lower())
    if first_seen_date:
        q = q.where(func.date(Listing.first_seen_at) == first_seen_date)

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

    order = (Listing.posted_at.desc().nulls_last(), Listing.first_seen_at.desc())
    if sort == "oldest":
        order = (Listing.posted_at.asc().nulls_last(), Listing.first_seen_at.asc())
    elif sort == "score":
        order = (Listing.deal_score.desc().nulls_last(), Listing.first_seen_at.desc(), Listing.posted_at.desc().nulls_last())
    elif sort == "investment":
        order = (Listing.investment_score.desc().nulls_last(), Listing.deal_score.desc().nulls_last(), Listing.first_seen_at.desc())
    elif sort == "ppsm":
        order = (Listing.price_per_sqm.asc().nulls_last(), Listing.first_seen_at.desc())
    elif sort == "price":
        order = (Listing.price_eur.asc().nulls_last(), Listing.first_seen_at.desc())

    return db.execute(q.order_by(*order).offset(offset).limit(limit)).scalars().all()


@app.get("/api/export.csv")
def export_csv(
    sort: str = Query("newest", pattern="^(newest|oldest|score|investment|ppsm|price)$"),
    min_score: float = Query(0, ge=0, le=100),
    district: str | None = None,
    districts: str | None = None,
    postal_code: str | None = None,
    source: str | None = None,
    first_seen_date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    price_min: float | None = Query(None, ge=0),
    price_max: float | None = Query(None, ge=0),
    limit: int = Query(5000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    rows = listings(
        bucket="all",
        sort=sort,
        limit=limit,
        offset=0,
        min_score=min_score,
        district=district,
        districts=districts,
        postal_code=postal_code,
        source=source,
        first_seen_date=first_seen_date,
        brand_new=False,
        just_listed=False,
        price_min=price_min,
        price_max=price_max,
        sqm_min=None,
        sqm_max=None,
        rooms_min=None,
        rooms_max=None,
        include_inactive=False,
        db=db,
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "id", "source", "source_listing_id", "title", "district", "postal_code", "price_eur",
        "area_sqm", "rooms", "price_per_sqm", "deal_score", "investment_score", "off_market_score",
        "first_seen_at", "posted_at", "url",
    ])
    for r in rows:
        writer.writerow([
            r.id,
            r.source,
            r.source_listing_id,
            r.title,
            r.district,
            r.postal_code,
            r.price_eur,
            r.area_sqm,
            r.rooms,
            r.price_per_sqm,
            r.deal_score,
            r.investment_score,
            r.off_market_score,
            r.first_seen_at.isoformat() if r.first_seen_at else None,
            r.posted_at.isoformat() if r.posted_at else None,
            r.url,
        ])

    filename = f"listings-export-{utc_now().strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
            "postal_code": listing.postal_code,
            "latitude": listing.latitude,
            "longitude": listing.longitude,
            "location_confidence": listing.location_confidence,
            "district_source": listing.district_source,
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


@app.post("/api/auth/login")
def api_auth_login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    if _rate_limited(login_attempts, _client_key(request, payload.username), window_seconds=300, limit=10):
        return JSONResponse(status_code=429, content={"ok": False, "error": "too_many_login_attempts"})
    user = db.execute(select(User).where(User.username == payload.username, User.is_active == True)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        return JSONResponse(status_code=401, content={"ok": False, "error": "invalid_credentials"})
    return {"ok": True, "user": {"username": user.username, "email": user.email, "display_name": user.display_name, "company": user.company}}


@app.get("/api/auth/users/{username}")
def api_auth_user(username: str, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.username == username, User.is_active == True)).scalar_one_or_none()
    if not user:
        return JSONResponse(status_code=404, content={"ok": False, "error": "user_not_found"})
    return {"ok": True, "user": {"username": user.username, "email": user.email, "display_name": user.display_name, "company": user.company}}


@app.post("/api/auth/change-password")
def api_auth_change_password(username: str, payload: ChangePasswordIn, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.username == username, User.is_active == True)).scalar_one_or_none()
    if not user:
        return JSONResponse(status_code=404, content={"ok": False, "error": "user_not_found"})
    if not verify_password(payload.current_password, user.password_hash):
        return JSONResponse(status_code=401, content={"ok": False, "error": "invalid_current_password"})
    if len(payload.new_password) < 8:
        return JSONResponse(status_code=400, content={"ok": False, "error": "password_too_short"})
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = utc_now()
    db.commit()
    return {"ok": True}


@app.put("/api/auth/profile")
def api_auth_profile(username: str, payload: ProfileUpdateIn, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.username == username, User.is_active == True)).scalar_one_or_none()
    if not user:
        return JSONResponse(status_code=404, content={"ok": False, "error": "user_not_found"})
    user.display_name = payload.display_name or user.display_name
    user.email = payload.email
    user.company = payload.company
    user.updated_at = utc_now()
    db.commit()
    return {"ok": True, "user": {"username": user.username, "email": user.email, "display_name": user.display_name, "company": user.company}}


@app.post("/api/auth/forgot-password")
def api_auth_forgot_password(payload: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    if _rate_limited(contact_attempts, f"forgot:{_client_key(request, payload.email)}", window_seconds=3600, limit=5):
        return JSONResponse(status_code=429, content={"ok": False, "error": "too_many_requests"})
    user = db.execute(select(User).where(User.email == payload.email, User.is_active == True)).scalar_one_or_none()
    if not user:
        return {"ok": True, "message": "Wenn ein Konto mit dieser E-Mail existiert, wurde ein Reset vorbereitet."}
    raw_token, token_hash = issue_reset_token()
    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=reset_token_expiry()))
    db.commit()
    return {"ok": True, "message": "Reset vorbereitet.", "reset_token": raw_token}


@app.post("/api/auth/reset-password")
def api_auth_reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    if len(payload.new_password) < 8:
        return JSONResponse(status_code=400, content={"ok": False, "error": "password_too_short"})
    token = db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_reset_token(payload.token))).scalar_one_or_none()
    expires_at = token.expires_at.replace(tzinfo=utc_now().tzinfo) if token and token.expires_at.tzinfo is None else (token.expires_at if token else None)
    if not token or token.used_at is not None or expires_at < utc_now():
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_or_expired_token"})
    user = db.execute(select(User).where(User.id == token.user_id, User.is_active == True)).scalar_one_or_none()
    if not user:
        return JSONResponse(status_code=404, content={"ok": False, "error": "user_not_found"})
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = utc_now()
    token.used_at = utc_now()
    db.commit()
    return {"ok": True}


@app.get("/api/legal/contact")
def api_legal_contact():
    return {"ok": True, "legal": legal_contact_payload()}


@app.post("/api/contact-sales")
def api_contact_sales(payload: ContactSalesIn, request: Request, db: Session = Depends(get_db)):
    if _rate_limited(contact_attempts, f"lead:{_client_key(request, payload.email)}", window_seconds=3600, limit=6):
        return JSONResponse(status_code=429, content={"ok": False, "error": "too_many_requests"})
    lead = ContactLead(
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        company=(payload.company or "").strip() or None,
        message=payload.message.strip(),
        status="new",
        source="website",
    )
    db.add(lead)
    db.commit()

    target_path = os.path.join(os.path.dirname(__file__), "..", "reports", "contact-sales-leads.jsonl")
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    record = {
        "received_at": utc_now().isoformat(),
        "id": lead.id,
        "name": lead.name,
        "email": lead.email,
        "company": lead.company,
        "message": lead.message,
        "status": lead.status,
    }
    with open(target_path, "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {"ok": True, "message": "Vielen Dank. Wir melden uns zeitnah.", "lead_id": lead.id}


@app.get("/api/admin/contact-leads")
def api_admin_contact_leads(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.execute(select(ContactLead).order_by(desc(ContactLead.created_at)).limit(limit)).scalars().all()
    return {"ok": True, "items": [{"id": x.id, "name": x.name, "email": x.email, "company": x.company, "message": x.message, "status": x.status, "created_at": x.created_at.isoformat()} for x in rows]}


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
    """Default scan: major sources only (fast primary sweep)."""
    with scan_lock:
        if scan_state["running"]:
            return {"ok": True, "already_running": True, "scan": _scan_status_payload()}

    targets = _major_targets()
    if not targets:
        return JSONResponse(status_code=400, content={"ok": False, "error": "no_major_collectors_registered"})

    _start_scan_thread(targets, "major-manual", force=True)
    scheduler_state["major_last_run_ts"] = time.time()
    return {"ok": True, "already_running": False, "targets": targets, "scan": _scan_status_payload()}


@app.post("/api/scan/run-all")
def api_scan_run_all(db: Session = Depends(get_db)):
    """Full scan across all registered collectors (explicitly requested only)."""
    with scan_lock:
        if scan_state["running"]:
            return {"ok": True, "already_running": True, "scan": _scan_status_payload()}

    targets = list(COLLECTOR_MAP.keys())
    if not targets:
        return JSONResponse(status_code=400, content={"ok": False, "error": "no_collectors_registered"})

    _start_scan_thread(targets, "all-manual", force=True)
    return {"ok": True, "already_running": False, "targets": targets, "scan": _scan_status_payload()}


@app.post("/api/scan/run-major")
def api_scan_run_major(db: Session = Depends(get_db)):
    with scan_lock:
        if scan_state["running"]:
            return {"ok": True, "already_running": True, "scan": _scan_status_payload()}

    targets = _major_targets()
    if not targets:
        return JSONResponse(status_code=400, content={"ok": False, "error": "no_major_collectors_registered"})

    _start_scan_thread(targets, "major-manual", force=True)
    scheduler_state["major_last_run_ts"] = time.time()
    return {"ok": True, "already_running": False, "targets": targets, "scan": _scan_status_payload()}


@app.post("/api/scan/run-secondary")
def api_scan_run_secondary(db: Session = Depends(get_db)):
    with scan_lock:
        if scan_state["running"]:
            return {"ok": True, "already_running": True, "scan": _scan_status_payload()}

    targets = _secondary_targets()
    if not targets:
        return JSONResponse(status_code=400, content={"ok": False, "error": "no_secondary_collectors_registered"})

    _start_scan_thread(targets, "secondary-manual", force=True)
    scheduler_state["secondary_last_run_ts"] = time.time()
    return {"ok": True, "already_running": False, "targets": targets, "scan": _scan_status_payload()}


@app.post("/api/scan/run-brokers")
def api_scan_run_brokers(db: Session = Depends(get_db)):
    with scan_lock:
        if scan_state["running"]:
            return {"ok": True, "already_running": True, "scan": _scan_status_payload()}

    targets = _broker_targets()
    if not targets:
        return JSONResponse(status_code=400, content={"ok": False, "error": "no_broker_collectors_registered"})

    _start_scan_thread(targets, "brokers-manual", force=True)
    return {"ok": True, "already_running": False, "targets": targets, "scan": _scan_status_payload()}


@app.get("/api/scan/status")
def api_scan_status():
    with scan_lock:
        return {
            "ok": True,
            "scan": _scan_status_payload(),
            "scheduler": {
                "enabled": scheduler_state["enabled"],
                "major_interval_seconds": scheduler_state["major_interval_seconds"],
                "secondary_interval_seconds": scheduler_state["secondary_interval_seconds"],
                "major_last_run_ts": scheduler_state["major_last_run_ts"],
                "secondary_last_run_ts": scheduler_state["secondary_last_run_ts"],
            },
        }


@app.get("/api/scan/coverage")
def api_scan_coverage():
    with scan_lock:
        scan = _scan_status_payload()
        return {"ok": True, "running": scan.get("running"), "status": scan.get("status"), "coverage": scan.get("coverage", [])}


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


@app.get("/api/sources/stale-audit")
def api_sources_stale_audit(
    apply_disable: bool = False,
    only_secondary: bool = True,
    fail_streak_threshold: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
):
    """Detect stale/broken sources (404, DNS/SSL issues, repeated fail streaks) and optionally disable them."""
    rows = db.execute(select(Source).order_by(Source.name.asc())).scalars().all()
    audited = []
    disabled_count = 0

    for s in rows:
        if only_secondary and not _is_secondary(s.name):
            continue

        runs = db.execute(
            select(SourceRun)
            .where(SourceRun.source_id == s.id)
            .order_by(desc(SourceRun.started_at))
            .limit(6)
        ).scalars().all()

        fail_streak = 0
        for r in runs:
            if r.status == "ok":
                break
            fail_streak += 1

        reason = None
        status = "ok"
        last_note = (runs[0].notes if runs else "") or (s.last_error or "")
        note_low = last_note.lower()

        if "404" in note_low or "not found" in note_low:
            status = "stale_url"
            reason = "404/not_found"
        elif "name or service not known" in note_low or "dns" in note_low:
            status = "stale_dns"
            reason = "dns_resolution_failed"
        elif "certificate verify failed" in note_low or "hostname mismatch" in note_low:
            status = "stale_ssl"
            reason = "ssl_hostname_mismatch"
        elif fail_streak >= fail_streak_threshold:
            status = "unstable"
            reason = f"fail_streak_{fail_streak}"

        changed = False
        if apply_disable and status in {"stale_url", "stale_dns", "stale_ssl", "unstable"} and s.enabled:
            s.enabled = False
            s.health_status = "disabled"
            s.updated_at = utc_now()
            changed = True
            disabled_count += 1

        audited.append(
            {
                "id": s.id,
                "name": s.name,
                "enabled": s.enabled,
                "health_status": s.health_status,
                "status": status,
                "reason": reason,
                "fail_streak": fail_streak,
                "last_note": last_note[:240] if last_note else None,
                "changed": changed,
            }
        )

    if apply_disable:
        db.commit()

    return {
        "ok": True,
        "apply_disable": apply_disable,
        "only_secondary": only_secondary,
        "disabled_count": disabled_count,
        "rows": audited,
    }


@app.get("/api/sources/prune-zero-coverage")
def api_sources_prune_zero_coverage(
    apply_disable: bool = False,
    only_secondary: bool = True,
    min_runs: int = Query(4, ge=2, le=20),
    db: Session = Depends(get_db),
):
    """Find sources with persistent zero coverage (raw_found/new/updated all zero) and optionally disable them."""
    rows = db.execute(select(Source).order_by(Source.name.asc())).scalars().all()
    out = []
    disabled_count = 0

    for s in rows:
        if only_secondary and not _is_secondary(s.name):
            continue

        runs = db.execute(
            select(SourceRun)
            .where(SourceRun.source_id == s.id)
            .order_by(desc(SourceRun.started_at))
            .limit(min_runs)
        ).scalars().all()

        if len(runs) < min_runs:
            continue

        persistent_zero = True
        for r in runs:
            note = (r.notes or "").lower()
            has_raw = "raw=0" not in note and "raw_found': 0" not in note
            had_changes = (r.new_count or 0) > 0 or (r.updated_count or 0) > 0
            if has_raw or had_changes:
                persistent_zero = False
                break

        changed = False
        if apply_disable and persistent_zero and s.enabled:
            s.enabled = False
            s.health_status = "disabled"
            s.last_error = f"auto-pruned: zero coverage in last {min_runs} runs"
            s.updated_at = utc_now()
            changed = True
            disabled_count += 1

        out.append(
            {
                "id": s.id,
                "name": s.name,
                "enabled": s.enabled,
                "health_status": s.health_status,
                "persistent_zero": persistent_zero,
                "runs_checked": len(runs),
                "changed": changed,
            }
        )

    if apply_disable:
        db.commit()

    return {
        "ok": True,
        "apply_disable": apply_disable,
        "only_secondary": only_secondary,
        "min_runs": min_runs,
        "disabled_count": disabled_count,
        "rows": out,
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


@app.post("/api/clusters/rebuild")
def api_clusters_rebuild(include_inactive: bool = False, db: Session = Depends(get_db)):
    q = select(Listing)
    if not include_inactive:
        q = q.where(Listing.is_active.is_(True))
    rows = db.execute(q).scalars().all()
    changed = assign_clusters(rows)
    db.commit()

    clustered_rows = [r for r in rows if r.cluster_id]
    clusters = len({r.cluster_id for r in clustered_rows})
    return {
        "ok": True,
        "rows_processed": len(rows),
        "listings_clustered": len(clustered_rows),
        "clusters": clusters,
        "cluster_members_changed": changed,
    }


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


@app.get("/api/districts")
def api_districts(db: Session = Depends(get_db)):
    rows = district_metrics(db, window="all")
    return [
        {
            "district": r["district"],
            "listing_count": r["listing_count"],
            "median_or_avg_ppsqm": r["median_price_per_sqm"] or r["average_price_per_sqm"],
            "top_deals": r["top_deal_count"],
            "avg_score": r["average_deal_score"],
        }
        for r in rows
    ]


@app.get("/api/district-debug")
def api_district_debug(limit: int = Query(200, ge=1, le=2000), source: str | None = None, db: Session = Depends(get_db)):
    q = select(Listing).where(Listing.is_active.is_(True)).order_by(desc(Listing.first_seen_at)).limit(limit)
    if source:
        q = select(Listing).where(Listing.is_active.is_(True), Listing.source == source.strip().lower()).order_by(desc(Listing.first_seen_at)).limit(limit)
    rows = db.execute(q).scalars().all()
    return [
        {
            "id": r.id,
            "source": r.source,
            "title": r.title,
            "raw_address": r.address,
            "postal_code": r.postal_code,
            "raw_district_text": r.raw_district_text,
            "district": r.district,
            "district_source": r.district_source,
            "location_confidence": r.location_confidence,
        }
        for r in rows
    ]


@app.get("/api/source-review")
def api_source_review(db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.is_active.is_(True))).scalars().all()
    by_source: dict[str, dict] = {}

    for r in rows:
        s = r.source or "unknown"
        b = by_source.setdefault(
            s,
            {
                "count": 0,
                "title_ok": 0,
                "address_ok": 0,
                "postal_ok": 0,
                "district_ok": 0,
                "coords_ok": 0,
                "rooms_ok": 0,
                "area_ok": 0,
                "price_ok": 0,
                "stable_id_ok": 0,
                "posted_at_ok": 0,
                "structured_data_present": 0,
                "link_ok": 0,
            },
        )
        b["count"] += 1
        b["title_ok"] += 1 if (r.title and r.title.strip()) else 0
        b["address_ok"] += 1 if (r.address and r.address.strip()) else 0
        b["postal_ok"] += 1 if (r.postal_code and str(r.postal_code).strip()) else 0
        b["district_ok"] += 1 if (r.district and r.district.strip()) else 0
        b["coords_ok"] += 1 if (r.latitude is not None and r.longitude is not None) else 0
        b["rooms_ok"] += 1 if (r.rooms is not None) else 0
        b["area_ok"] += 1 if (r.area_sqm is not None) else 0
        b["price_ok"] += 1 if (r.price_eur is not None) else 0
        b["stable_id_ok"] += 1 if (r.source_listing_id and len(str(r.source_listing_id)) >= 8) else 0
        b["posted_at_ok"] += 1 if (r.posted_at is not None) else 0
        b["structured_data_present"] += 1 if (r.source_payload_debug and "structured_data_json" in r.source_payload_debug) else 0
        b["link_ok"] += 1 if (r.url and (r.url.startswith("http://") or r.url.startswith("https://"))) else 0

    # percentages
    out = {}
    for s, v in by_source.items():
        c = max(1, v["count"])
        out[s] = {
            **v,
            "title_ok_pct": round(v["title_ok"] * 100.0 / c, 2),
            "address_ok_pct": round(v["address_ok"] * 100.0 / c, 2),
            "postal_ok_pct": round(v["postal_ok"] * 100.0 / c, 2),
            "district_ok_pct": round(v["district_ok"] * 100.0 / c, 2),
            "coords_ok_pct": round(v["coords_ok"] * 100.0 / c, 2),
            "rooms_ok_pct": round(v["rooms_ok"] * 100.0 / c, 2),
            "area_ok_pct": round(v["area_ok"] * 100.0 / c, 2),
            "price_ok_pct": round(v["price_ok"] * 100.0 / c, 2),
            "posted_at_ok_pct": round(v["posted_at_ok"] * 100.0 / c, 2),
            "structured_data_present_pct": round(v["structured_data_present"] * 100.0 / c, 2),
            "link_ok_pct": round(v["link_ok"] * 100.0 / c, 2),
        }
    return {"total_active": len(rows), "by_source": out}


@app.get("/api/source-debug")
def api_source_debug(limit: int = Query(300, ge=1, le=2000), source: str | None = None, db: Session = Depends(get_db)):
    q = select(Listing).where(Listing.is_active.is_(True)).order_by(desc(Listing.first_seen_at)).limit(limit)
    if source:
        q = select(Listing).where(Listing.is_active.is_(True), Listing.source == source.strip().lower()).order_by(desc(Listing.first_seen_at)).limit(limit)
    rows = db.execute(q).scalars().all()
    return [
        {
            "id": r.id,
            "source": r.source,
            "raw_title": r.raw_title,
            "display_title": r.display_title,
            "raw_address": r.address,
            "raw_district_text": r.raw_district_text,
            "postal_code": r.postal_code,
            "district": r.district,
            "district_source": r.district_source,
            "location_confidence": r.location_confidence,
            "price_eur": r.price_eur,
            "area_sqm": r.area_sqm,
            "rooms": r.rooms,
            "price_per_sqm": r.price_per_sqm,
            "cluster_id": r.cluster_id,
            "geo_status": r.geo_status,
            "quality_flags": r.quality_flags,
            "url": r.url,
        }
        for r in rows
    ]


@app.get("/api/duplicate-debug")
def api_duplicate_debug(limit: int = Query(300, ge=1, le=3000), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Listing)
        .where(Listing.is_active.is_(True), Listing.cluster_id.is_not(None))
        .order_by(desc(Listing.first_seen_at))
        .limit(limit)
    ).scalars().all()
    out: dict[str, list] = defaultdict(list)
    for r in rows:
        out[r.cluster_id].append(
            {
                "id": r.id,
                "source": r.source,
                "display_title": r.display_title,
                "price_eur": r.price_eur,
                "area_sqm": r.area_sqm,
                "rooms": r.rooms,
                "district": r.district,
                "postal_code": r.postal_code,
                "url": r.url,
            }
        )
    return [{"cluster_id": cid, "members_count": len(members), "members": members} for cid, members in out.items()]


@app.get("/api/geo-debug")
def api_geo_debug(limit: int = Query(500, ge=1, le=5000), db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.is_active.is_(True)).order_by(desc(Listing.first_seen_at)).limit(limit)).scalars().all()
    return [
        {
            "id": r.id,
            "source": r.source,
            "display_title": r.display_title,
            "district": r.district,
            "postal_code": r.postal_code,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "geo_status": r.geo_status,
            "map_mode_assignment": r.map_mode_assignment,
            "location_confidence": r.location_confidence,
            "district_source": r.district_source,
        }
        for r in rows
    ]


@app.get("/api/source-quality")
def api_source_quality(db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.is_active.is_(True))).scalars().all()
    by_source: dict[str, dict] = {}

    for r in rows:
        s = r.source or "unknown"
        b = by_source.setdefault(
            s,
            {
                "count": 0,
                "missing_title": 0,
                "missing_district": 0,
                "missing_postal_code": 0,
                "missing_address": 0,
                "missing_price": 0,
                "missing_area": 0,
                "missing_rooms": 0,
                "missing_coords": 0,
                "invalid_url": 0,
                "unknown_location": 0,
                "clustered": 0,
            },
        )
        b["count"] += 1
        if not (r.display_title and r.display_title.strip()):
            b["missing_title"] += 1
        if not (r.district and r.district.strip()):
            b["missing_district"] += 1
        if not (r.postal_code and str(r.postal_code).strip()):
            b["missing_postal_code"] += 1
        if not (r.address and r.address.strip()):
            b["missing_address"] += 1
        if r.price_eur is None:
            b["missing_price"] += 1
        if r.area_sqm is None:
            b["missing_area"] += 1
        if r.rooms is None:
            b["missing_rooms"] += 1
        if r.latitude is None or r.longitude is None:
            b["missing_coords"] += 1
        if not (r.url and (r.url.startswith("http://") or r.url.startswith("https://"))):
            b["invalid_url"] += 1
        if (r.district_source or "") in {"unknown", "fallback"}:
            b["unknown_location"] += 1
        if r.cluster_id:
            b["clustered"] += 1

    # attach parser error counts from recent runs
    source_rows = db.execute(select(Source)).scalars().all()
    id_to_name = {s.id: s.name for s in source_rows}
    run_rows = db.execute(select(SourceRun)).scalars().all()
    parse_by_name: dict[str, int] = {}
    for rr in run_rows:
        n = id_to_name.get(rr.source_id)
        if not n:
            continue
        parse_by_name[n] = parse_by_name.get(n, 0) + int(rr.parse_errors or 0)

    out = {}
    for s, v in by_source.items():
        c = max(1, v["count"])
        out[s] = {
            **v,
            "district_assigned_pct": round((v["count"] - v["missing_district"]) * 100.0 / c, 2),
            "postal_pct": round((v["count"] - v["missing_postal_code"]) * 100.0 / c, 2),
            "valid_coords_pct": round((v["count"] - v["missing_coords"]) * 100.0 / c, 2),
            "usable_title_pct": round((v["count"] - v["missing_title"]) * 100.0 / c, 2),
            "usable_price_pct": round((v["count"] - v["missing_price"]) * 100.0 / c, 2),
            "usable_sqm_pct": round((v["count"] - v["missing_area"]) * 100.0 / c, 2),
            "duplicate_clustered_pct": round(v["clustered"] * 100.0 / c, 2),
            "unmapped_pct": round(v["unknown_location"] * 100.0 / c, 2),
            "parse_error_count": int(parse_by_name.get(s, 0)),
        }
    return {"total_active": len(rows), "by_source": out}


@app.get("/api/district-quality")
def api_district_quality(db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.is_active.is_(True))).scalars().all()
    total = len(rows)
    if total == 0:
        return {"total": 0, "assigned_pct": 0, "coordinates_pct": 0, "postal_code_pct": 0, "title_only_pct": 0, "unknown_pct": 0, "by_source": {}}

    def pct(n: int) -> float:
        return round((n / total) * 100.0, 2)

    assigned = sum(1 for r in rows if (r.district and r.district != "München"))
    coordinates = sum(1 for r in rows if r.district_source == "coordinates")
    postal = sum(1 for r in rows if (r.district_source or "").startswith("postal_code") or (r.district_source or "").startswith("structured_data_postal_code"))
    title_only = sum(1 for r in rows if (r.district_source or "") in {"title", "title_alias"})
    unknown = sum(1 for r in rows if (r.district_source or "") in {"unknown", "fallback"} or not r.district)

    by_source: dict[str, dict] = {}
    for r in rows:
        s = r.source or "unknown"
        b = by_source.setdefault(s, {"count": 0, "unknown": 0, "title_only": 0, "postal": 0, "coordinates": 0})
        b["count"] += 1
        ds = r.district_source or ""
        if ds in {"unknown", "fallback"} or not r.district:
            b["unknown"] += 1
        if ds in {"title", "title_alias"}:
            b["title_only"] += 1
        if ds.startswith("postal_code") or ds.startswith("structured_data_postal_code"):
            b["postal"] += 1
        if ds == "coordinates":
            b["coordinates"] += 1

    return {
        "total": total,
        "assigned_pct": pct(assigned),
        "coordinates_pct": pct(coordinates),
        "postal_code_pct": pct(postal),
        "title_only_pct": pct(title_only),
        "unknown_pct": pct(unknown),
        "by_source": by_source,
    }


@app.get("/api/geo/districts")
def api_geo_districts(
    window: str = Query("30d"),
    min_score: float = Query(0, ge=0, le=100),
    source: str | None = None,
    district: str | None = None,
    db: Session = Depends(get_db),
):
    return {"ok": True, "window": window, "rows": district_metrics(db, window=window, min_score=min_score, source=source, district_filter=district)}


@app.get("/api/geo/hotspots")
def api_geo_hotspots(
    window: str = Query("30d"),
    min_score: float = Query(0, ge=0, le=100),
    source: str | None = None,
    district: str | None = None,
    db: Session = Depends(get_db),
):
    return {"ok": True, "window": window, "rows": geo_hotspots(db, window=window, min_score=min_score, source=source, district=district)}


@app.get("/api/geo/cells")
def api_geo_cells(window: str = Query("30d"), db: Session = Depends(get_db)):
    return {"ok": True, "window": window, "rows": geo_cells(db, window=window)}


@app.get("/api/location/coverage")
def api_location_coverage(db: Session = Depends(get_db)):
    rows = db.execute(select(Listing)).scalars().all()
    by_source: dict[str, dict] = {}
    for r in rows:
        s = r.source or "unknown"
        b = by_source.setdefault(
            s,
            {
                "source": s,
                "total": 0,
                "with_postal": 0,
                "with_address": 0,
                "district_generic_munich": 0,
                "district_known": 0,
                "confidence_ge_70": 0,
                "source_postal_code": 0,
                "source_title_detection": 0,
                "source_address": 0,
                "source_fallback": 0,
            },
        )
        b["total"] += 1
        if r.postal_code:
            b["with_postal"] += 1
        if r.address:
            b["with_address"] += 1
        if (r.district or "").strip().lower() in ("münchen", "munchen"):
            b["district_generic_munich"] += 1
        else:
            b["district_known"] += 1
        if (r.location_confidence or 0) >= 70:
            b["confidence_ge_70"] += 1
        src = (r.district_source or "fallback").strip().lower()
        key = f"source_{src}"
        if key in b:
            b[key] += 1
        else:
            b["source_fallback"] += 1

    out = sorted(by_source.values(), key=lambda x: x["total"], reverse=True)
    return {"ok": True, "rows": out}


@app.get("/api/geo/summary")
def api_geo_summary(
    window: str = Query("30d"),
    min_score: float = Query(0, ge=0, le=100),
    source: str | None = None,
    district: str | None = None,
    db: Session = Depends(get_db),
):
    return {"ok": True, **geo_summary(db, window=window, min_score=min_score, source=source, district=district)}


@app.get("/api/geo/listings")
def api_geo_listings(
    window: str = Query("30d"),
    min_score: float = Query(0, ge=0, le=100),
    source: str | None = None,
    district: str | None = None,
    limit: int = Query(1200, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    since = None
    now = utc_now()
    if window == "24h":
        since = now - timedelta(hours=24)
    elif window == "7d":
        since = now - timedelta(days=7)
    elif window == "30d":
        since = now - timedelta(days=30)

    q = select(Listing).where(Listing.is_active.is_(True))
    if since:
        q = q.where(Listing.first_seen_at >= since)
    if min_score > 0:
        q = q.where(Listing.deal_score.is_not(None), Listing.deal_score >= min_score)
    if source and source != "all":
        q = q.where(Listing.source == source)
    if district and district != "all":
        d = canonicalize_district_name(district)
        q = q.where(Listing.district == d)

    rows = db.execute(q.order_by(Listing.first_seen_at.desc()).limit(limit)).scalars().all()
    out = []
    for r in rows:
        out.append(
            {
                "id": r.id,
                "title": r.title,
                "district": r.district,
                "source": r.source,
                "url": r.url,
                "price_eur": r.price_eur,
                "rooms": r.rooms,
                "area_sqm": r.area_sqm,
                "price_per_sqm": r.price_per_sqm,
                "deal_score": r.deal_score,
                "off_market_score": r.off_market_score,
                "badges": r.badges,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "first_seen_at": r.first_seen_at,
            }
        )
    return {"ok": True, "rows": out}


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
