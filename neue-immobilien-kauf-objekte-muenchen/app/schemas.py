from datetime import datetime

from pydantic import BaseModel, ConfigDict


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

    model_config = ConfigDict(from_attributes=True)


class AlertRuleIn(BaseModel):
    name: str
    district: str | None = None
    max_price: float | None = None
    min_sqm: float | None = None
    min_score: float | None = None
    bucket: str | None = None
    enabled: bool = True


class ListingOut(BaseModel):
    source: str
    source_listing_id: str
    url: str
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    image_hash: str | None = None
    district: str | None = None
    raw_district_text: str | None = None
    address: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_confidence: float | None = None
    district_source: str | None = None
    area_sqm: float | None = None
    price_eur: float | None = None
    price_per_sqm: float | None = None
    deal_score: float | None = None
    estimated_rent_per_sqm: float | None = None
    estimated_monthly_rent: float | None = None
    gross_yield_percent: float | None = None
    price_to_rent_ratio: float | None = None
    investment_score: float | None = None
    investment_explain: str | None = None
    off_market_score: float | None = None
    off_market_flags: str | None = None
    off_market_explain: str | None = None
    exclusivity_score: float | None = None
    source_popularity_score: float | None = None
    badges: str | None = None
    score_explain: str | None = None
    ai_flags: str | None = None
    cluster_id: str | None = None
    rooms: float | None = None
    posted_at: datetime | None = None
    first_seen_at: datetime

    model_config = ConfigDict(from_attributes=True)
