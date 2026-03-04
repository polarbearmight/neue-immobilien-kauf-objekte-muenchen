from fastapi import FastAPI, Query, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db import SessionLocal, engine, Base
from app.models import Listing
from app.schemas import ListingOut

app = FastAPI(title="Neue Kauf Objekte München API")
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"ok": True, "ts": datetime.utcnow().isoformat()}


@app.get("/listings", response_model=list[ListingOut])
def listings(
    bucket: str = Query("all", pattern="^(9000|12000|all|unknown)$"),
    sort: str = Query("newest", pattern="^(newest|oldest)$"),
    limit: int = Query(200, ge=1, le=1000),
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
