from datetime import timedelta

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import desc, func, select, case
from collections import defaultdict
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine, ensure_schema
from app.models import AlertRule, Listing, ListingSnapshot, Source, SourceRun, Watchlist
from app.schemas import AlertRuleIn, ListingOut, SourceOut
from app.source_reliability import attach_reliability
from app.time_utils import utc_now
from collectors.image_tools import hash_distance
from collectors.run_collect import COLLECTOR_MAP, run_one_source
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
            "/api/collect/run",
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
    db: Session = Depends(get_db),
):
    q = select(Listing)

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


@app.post("/api/collect/run")
def api_collect_run(source: str = Query("all"), dry_run: bool = Query(False), db: Session = Depends(get_db)):
    targets = [source] if source != "all" else list(COLLECTOR_MAP.keys())
    summary = []
    for name in targets:
        if name not in COLLECTOR_MAP:
            summary.append({"source": name, "status": "unknown_source"})
            continue
        summary.append(run_one_source(db, name, dry_run=dry_run))
    return {"ok": True, "dry_run": dry_run, "summary": summary}


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


@app.get("/api/clusters")
def api_clusters(limit: int = Query(200, ge=1, le=2000), db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.cluster_id.is_not(None)).order_by(desc(Listing.first_seen_at)).limit(limit)).scalars().all()
    clusters = {}
    for r in rows:
        clusters.setdefault(r.cluster_id, []).append(
            {
                "id": r.id,
                "source": r.source,
                "title": r.title,
                "url": r.url,
                "price_eur": r.price_eur,
                "area_sqm": r.area_sqm,
            }
        )
    return [{"cluster_id": cid, "members": members, "members_count": len(members)} for cid, members in clusters.items()]


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
        .having(func.count() >= 2)
        .order_by(func.count().desc())
        .limit(15)
    ).all()

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
        "district_stats": [
            {"district": d, "count": int(c), "avg_ppsqm": round(float(a), 2) if a else None}
            for d, c, a in district_rows
        ],
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
