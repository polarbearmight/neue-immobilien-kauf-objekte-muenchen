from pydantic import BaseModel
from datetime import datetime


class SourceOut(BaseModel):
    id: int
    name: str
    base_url: str
    kind: str
    discovery_method: str
    robots_status: str
    approved: bool
    enabled: bool
    health_status: str
    last_error: str | None = None
    reliability_score: int | None = None

    class Config:
        from_attributes = True


class ListingOut(BaseModel):
    source: str
    source_listing_id: str
    url: str
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    image_hash: str | None = None
    district: str | None = None
    address: str | None = None
    area_sqm: float | None = None
    price_eur: float | None = None
    price_per_sqm: float | None = None
    deal_score: float | None = None
    badges: str | None = None
    score_explain: str | None = None
    ai_flags: str | None = None
    cluster_id: str | None = None
    rooms: float | None = None
    posted_at: datetime | None = None
    first_seen_at: datetime

    class Config:
        from_attributes = True
