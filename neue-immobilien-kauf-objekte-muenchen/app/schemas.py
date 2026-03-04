from pydantic import BaseModel
from datetime import datetime


class ListingOut(BaseModel):
    source: str
    source_listing_id: str
    url: str
    title: str | None = None
    district: str | None = None
    address: str | None = None
    area_sqm: float | None = None
    price_eur: float | None = None
    price_per_sqm: float | None = None
    rooms: float | None = None
    posted_at: datetime | None = None
    first_seen_at: datetime

    class Config:
        from_attributes = True
