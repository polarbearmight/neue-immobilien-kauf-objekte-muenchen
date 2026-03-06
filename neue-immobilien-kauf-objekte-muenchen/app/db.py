from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings


engine = create_engine(settings.db_url, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def ensure_schema():
    # Lightweight migration helper for MVP (adds missing columns + helpful indexes)
    with engine.begin() as conn:
        insp = inspect(conn)
        table_names = set(insp.get_table_names())
        if "listings" not in table_names:
            return

        cols = {c["name"] for c in insp.get_columns("listings")}
        if "description" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN description VARCHAR(2048)"))
        if "image_url" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN image_url VARCHAR(1024)"))
        if "image_hash" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN image_hash VARCHAR(64)"))
        if "deal_score" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN deal_score FLOAT"))
        if "estimated_rent_per_sqm" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN estimated_rent_per_sqm FLOAT"))
        if "estimated_monthly_rent" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN estimated_monthly_rent FLOAT"))
        if "gross_yield_percent" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN gross_yield_percent FLOAT"))
        if "price_to_rent_ratio" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN price_to_rent_ratio FLOAT"))
        if "investment_score" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN investment_score FLOAT"))
        if "investment_explain" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN investment_explain VARCHAR(2048)"))
        if "badges" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN badges VARCHAR(1024)"))
        if "score_explain" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN score_explain VARCHAR(2048)"))
        if "ai_flags" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN ai_flags VARCHAR(1024)"))
        if "cluster_id" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN cluster_id VARCHAR(64)"))
        if "raw_hash" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN raw_hash VARCHAR(64)"))
        if "is_active" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN is_active BOOLEAN DEFAULT 1"))
        if "last_seen_at" in cols:
            conn.execute(text("UPDATE listings SET is_active = 1 WHERE is_active IS NULL"))

        # Query-speed indexes for common dashboard/API filters
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_first_seen_at ON listings(first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_source_first_seen ON listings(source, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_district_first_seen ON listings(district, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_ppsqm_first_seen ON listings(price_per_sqm, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_score_first_seen ON listings(deal_score, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_investment_score ON listings(investment_score)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_cluster_first_seen ON listings(cluster_id, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_last_seen_at ON listings(last_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_is_active ON listings(is_active)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_raw_hash ON listings(raw_hash)"))

        if "listing_snapshots" in table_names:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_snapshots_listing_captured ON listing_snapshots(listing_id, captured_at)"))
        if "watchlist" in table_names:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_watchlist_created_at ON watchlist(created_at)"))
        if "source_runs" in table_names:
            source_run_cols = {c["name"] for c in insp.get_columns("source_runs")}
            if "skipped_known_count" not in source_run_cols:
                conn.execute(text("ALTER TABLE source_runs ADD COLUMN skipped_known_count INTEGER DEFAULT 0"))
            if "parse_errors" not in source_run_cols:
                conn.execute(text("ALTER TABLE source_runs ADD COLUMN parse_errors INTEGER DEFAULT 0"))
            if "http_errors" not in source_run_cols:
                conn.execute(text("ALTER TABLE source_runs ADD COLUMN http_errors INTEGER DEFAULT 0"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_source_runs_source_started ON source_runs(source_id, started_at)"))
