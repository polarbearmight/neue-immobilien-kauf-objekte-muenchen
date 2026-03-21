from sqlalchemy import String, Integer, Float, DateTime, UniqueConstraint, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.db import Base
from app.time_utils import utc_now


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    base_url: Mapped[str] = mapped_column(String(512), unique=True)
    kind: Mapped[str] = mapped_column(String(32), default="unknown")
    discovery_method: Mapped[str] = mapped_column(String(32), default="seed")
    robots_status: Mapped[str] = mapped_column(String(32), default="unknown")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    health_status: Mapped[str] = mapped_column(String(32), default="disabled")
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(512), nullable=True)
    rate_limit_seconds: Mapped[int] = mapped_column(Integer, default=8)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SourceRun(Base):
    __tablename__ = "source_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="ok")
    new_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_known_count: Mapped[int] = mapped_column(Integer, default=0)
    parse_errors: Mapped[int] = mapped_column(Integer, default=0)
    http_errors: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(String(512), nullable=True)


class ListingSnapshot(Base):
    __tablename__ = "listing_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    price_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    raw_excerpt: Mapped[str | None] = mapped_column(String(512), nullable=True)


class Watchlist(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    notes: Mapped[str | None] = mapped_column(String(512), nullable=True)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), index=True)
    district: Mapped[str | None] = mapped_column(String(128), nullable=True)
    max_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    bucket: Mapped[str | None] = mapped_column(String(16), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    display_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    company: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(String(16), default="free")
    license_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    @property
    def effective_role(self) -> str:
        if self.role == "admin":
            return "admin"
        if self.role == "pro":
            if self.license_until and self.license_until >= utc_now():
                return "pro"
            return "free"
        return "free"


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ContactLead(Base):
    __tablename__ = "contact_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    email: Mapped[str] = mapped_column(String(256), index=True)
    company: Mapped[str | None] = mapped_column(String(256), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    source: Mapped[str] = mapped_column(String(64), default="website")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (UniqueConstraint("source", "source_listing_id", name="uq_source_listing_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(64), index=True)
    source_listing_id: Mapped[str] = mapped_column(String(128), index=True)
    url: Mapped[str] = mapped_column(String(1024), unique=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    display_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    raw_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    raw_description: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    image_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    raw_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    district: Mapped[str | None] = mapped_column(String(128), nullable=True)
    raw_district_text: Mapped[str | None] = mapped_column(String(256), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_confidence: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    district_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    price_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    rooms: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_sqm: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    deal_score: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    estimated_rent_per_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_monthly_rent: Mapped[float | None] = mapped_column(Float, nullable=True)
    gross_yield_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_to_rent_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    investment_score: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    investment_explain: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    off_market_score: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    off_market_flags: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    off_market_explain: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    exclusivity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_popularity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    badges: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    score_explain: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    ai_flags: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    quality_flags: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    source_payload_debug: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    cluster_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    @property
    def source_url(self) -> str:
        return self.url

    @property
    def geo_status(self) -> str:
        if self.latitude is not None and self.longitude is not None:
            return "coordinates"
        if self.district and self.district != "München":
            return "district_only"
        return "unknown"

    @property
    def map_mode_assignment(self) -> str:
        return "point" if self.geo_status == "coordinates" else "district"


class SourceState(Base):
    __tablename__ = "source_state"

    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), primary_key=True)
    last_successful_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_scan_page: Mapped[int] = mapped_column(Integer, default=1)
    last_known_listing_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_etag: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_modified: Mapped[str | None] = mapped_column(String(256), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(512), nullable=True)
