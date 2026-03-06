from sqlalchemy import String, Integer, Float, DateTime, UniqueConstraint, Boolean, ForeignKey
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
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), unique=True, index=True)
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


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (UniqueConstraint("source", "source_listing_id", name="uq_source_listing_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(64), index=True)
    source_listing_id: Mapped[str] = mapped_column(String(128), index=True)
    url: Mapped[str] = mapped_column(String(1024), unique=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    image_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    district: Mapped[str | None] = mapped_column(String(128), nullable=True)
    price_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    rooms: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_sqm: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    deal_score: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    badges: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    score_explain: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    ai_flags: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    cluster_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
