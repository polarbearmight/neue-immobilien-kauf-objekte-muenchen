from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings


engine = create_engine(settings.db_url, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def ensure_schema():
    # Lightweight migration helper for MVP (adds missing columns if table already exists)
    with engine.begin() as conn:
        insp = inspect(conn)
        if "listings" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("listings")}
        if "description" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN description VARCHAR(2048)"))
        if "image_url" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN image_url VARCHAR(1024)"))
        if "image_hash" not in cols:
            conn.execute(text("ALTER TABLE listings ADD COLUMN image_hash VARCHAR(64)"))
