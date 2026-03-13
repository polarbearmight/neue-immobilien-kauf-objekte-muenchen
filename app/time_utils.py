from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(UTC)


def ensure_utc(dt: datetime) -> datetime:
    """Normalize datetime to timezone-aware UTC.

    SQLite rows can come back as naive datetimes even when columns were declared
    timezone-aware. Treat naive values as UTC for internal scoring math.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)
