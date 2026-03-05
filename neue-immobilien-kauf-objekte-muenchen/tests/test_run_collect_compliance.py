from app.db import Base, engine, SessionLocal
from sqlalchemy import select

from app.models import Source
from collectors.run_collect import run_one_source


def test_run_collect_skips_unapproved_disabled_source(monkeypatch):
    monkeypatch.setenv("ALLOW_UNAPPROVED_SOURCES", "false")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        src = db.execute(select(Source).where(Source.name == "immowelt")).scalar_one_or_none()
        if not src:
            src = Source(
                name="immowelt",
                base_url="https://www.immowelt.de",
                kind="html",
                approved=False,
                enabled=False,
                health_status="disabled",
                rate_limit_seconds=8,
            )
            db.add(src)
        else:
            src.approved = False
            src.enabled = False
            src.health_status = "disabled"
        db.commit()

        out = run_one_source(db, "immowelt", dry_run=True, force=False, capture_fixture=False)
        assert out["status"] == "skipped"
    finally:
        db.close()
