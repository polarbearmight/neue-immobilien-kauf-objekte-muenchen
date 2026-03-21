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
        if "display_title" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN display_title VARCHAR(512)"))
        if "raw_title" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN raw_title VARCHAR(512)"))
        if "raw_description" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN raw_description VARCHAR(2048)"))
        if "postal_code" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN postal_code VARCHAR(16)"))
        if "raw_district_text" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN raw_district_text VARCHAR(256)"))
        if "city" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN city VARCHAR(128)"))
        if "latitude" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN latitude FLOAT"))
        if "longitude" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN longitude FLOAT"))
        if "location_confidence" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN location_confidence FLOAT"))
        if "district_source" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN district_source VARCHAR(64)"))
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
        if "off_market_score" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN off_market_score FLOAT"))
        if "off_market_flags" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN off_market_flags VARCHAR(1024)"))
        if "off_market_explain" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN off_market_explain VARCHAR(2048)"))
        if "exclusivity_score" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN exclusivity_score FLOAT"))
        if "source_popularity_score" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN source_popularity_score FLOAT"))
        if "badges" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN badges VARCHAR(1024)"))
        if "score_explain" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN score_explain VARCHAR(2048)"))
        if "ai_flags" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN ai_flags VARCHAR(1024)"))
        if "quality_flags" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN quality_flags VARCHAR(1024)"))
        if "source_payload_debug" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN source_payload_debug VARCHAR(4096)"))
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
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_postal_code ON listings(postal_code)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_location_confidence ON listings(location_confidence)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_ppsqm_first_seen ON listings(price_per_sqm, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_score_first_seen ON listings(deal_score, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_investment_score ON listings(investment_score)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_off_market_score ON listings(off_market_score)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_cluster_first_seen ON listings(cluster_id, first_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_last_seen_at ON listings(last_seen_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_is_active ON listings(is_active)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_listings_raw_hash ON listings(raw_hash)"))

        if "users" in table_names:
            user_cols = {c["name"] for c in insp.get_columns("users")}
            if "role" not in user_cols:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(16) DEFAULT 'free'"))
                except Exception:
                    pass
            if "license_until" not in user_cols:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN license_until DATETIME"))
                except Exception:
                    pass
            try:
                conn.execute(text("UPDATE users SET role = 'admin' WHERE username = (SELECT username FROM users ORDER BY id LIMIT 1)"))
                conn.execute(text("UPDATE users SET role = 'free' WHERE role IS NULL OR role = ''"))
            except Exception:
                pass

        if "listing_snapshots" in table_names:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_snapshots_listing_captured ON listing_snapshots(listing_id, captured_at)"))
        if "watchlist" in table_names:
            watch_cols = {c["name"] for c in insp.get_columns("watchlist")}
            if "user_id" not in watch_cols:
                try:
                    conn.execute(text("ALTER TABLE watchlist ADD COLUMN user_id INTEGER"))
                except Exception:
                    pass
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_watchlist_created_at ON watchlist(created_at)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_watchlist_user_id ON watchlist(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_watchlist_listing_id ON watchlist(listing_id)"))

            try:
                watch_sql = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='watchlist'"))
                watch_schema = watch_sql.scalar_one_or_none() or ""
            except Exception:
                watch_schema = ""
            if "listing_id INTEGER NOT NULL UNIQUE" in watch_schema or "UNIQUE (listing_id)" in watch_schema:
                conn.execute(text("ALTER TABLE watchlist RENAME TO watchlist_legacy"))
                conn.execute(text("CREATE TABLE watchlist (id INTEGER NOT NULL PRIMARY KEY, listing_id INTEGER NOT NULL, user_id INTEGER, created_at DATETIME NOT NULL, notes VARCHAR(512), FOREIGN KEY(listing_id) REFERENCES listings (id), FOREIGN KEY(user_id) REFERENCES users (id))"))
                conn.execute(text("INSERT INTO watchlist (id, listing_id, user_id, created_at, notes) SELECT id, listing_id, user_id, created_at, notes FROM watchlist_legacy"))
                conn.execute(text("DROP TABLE watchlist_legacy"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_watchlist_created_at ON watchlist(created_at)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_watchlist_user_id ON watchlist(user_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_watchlist_listing_id ON watchlist(listing_id)"))
        if "source_runs" in table_names:
            source_run_cols = {c["name"] for c in insp.get_columns("source_runs")}
            if "skipped_known_count" not in source_run_cols:
                conn.execute(text("ALTER TABLE source_runs ADD COLUMN skipped_known_count INTEGER DEFAULT 0"))
            if "parse_errors" not in source_run_cols:
                conn.execute(text("ALTER TABLE source_runs ADD COLUMN parse_errors INTEGER DEFAULT 0"))
            if "http_errors" not in source_run_cols:
                conn.execute(text("ALTER TABLE source_runs ADD COLUMN http_errors INTEGER DEFAULT 0"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_source_runs_source_started ON source_runs(source_id, started_at)"))
