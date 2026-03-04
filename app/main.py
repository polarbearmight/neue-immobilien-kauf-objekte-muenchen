from fastapi import FastAPI, Query, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db import SessionLocal, engine, Base, ensure_schema
from app.models import Listing
from app.schemas import ListingOut
from collectors.image_tools import hash_distance

app = FastAPI(title="Neue Kauf Objekte München API")
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
        "endpoints": ["/health", "/docs", "/listings", "/duplicates", "/stats"],
    }


@app.get("/favicon.ico")
def favicon():
    return JSONResponse(status_code=204, content=None)


@app.get("/health")
def health():
    return {"ok": True, "ts": datetime.utcnow().isoformat()}


@app.get("/listings", response_model=list[ListingOut])
def listings(
    bucket: str = Query("all", pattern="^(9000|12000|all|unknown)$"),
    sort: str = Query("newest", pattern="^(newest|oldest)$"),
    limit: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = select(Listing)

    if bucket == "9000":
        q = q.where(Listing.price_per_sqm != None, Listing.price_per_sqm <= 9000)
    elif bucket == "12000":
        q = q.where(Listing.price_per_sqm != None, Listing.price_per_sqm <= 12000)
    elif bucket == "unknown":
        q = q.where(Listing.price_per_sqm == None)

    order = desc(Listing.posted_at.is_(None)), desc(Listing.posted_at), desc(Listing.first_seen_at)
    if sort == "oldest":
        order = (Listing.posted_at.asc().nulls_last(), Listing.first_seen_at.asc())

    q = q.order_by(*order).limit(limit)
    return db.execute(q).scalars().all()


@app.get("/duplicates")
def duplicates(limit: int = Query(100, ge=10, le=500), max_distance: int = Query(8, ge=0, le=32), db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.image_hash != None).order_by(desc(Listing.first_seen_at)).limit(limit)).scalars().all()
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


@app.get("/stats")
def stats(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    new_count = db.scalar(select(func.count()).select_from(Listing).where(Listing.first_seen_at >= since))
    median_proxy = db.scalar(select(func.avg(Listing.price_per_sqm)).where(Listing.first_seen_at >= since, Listing.price_per_sqm != None))
    return {
        "days": days,
        "new_listings": int(new_count or 0),
        "avg_price_per_sqm": round(float(median_proxy), 2) if median_proxy else None,
    }
