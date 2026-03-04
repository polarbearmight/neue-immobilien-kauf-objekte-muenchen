from __future__ import annotations

from datetime import datetime, timedelta
from sqlalchemy import select
from app.models import Source, SourceRun


def compute_reliability(db, days: int = 30) -> dict[int, int]:
    since = datetime.utcnow() - timedelta(days=days)
    runs = db.execute(select(SourceRun).where(SourceRun.started_at >= since)).scalars().all()

    bucket: dict[int, list[SourceRun]] = {}
    for r in runs:
        bucket.setdefault(r.source_id, []).append(r)

    scores: dict[int, int] = {}
    for sid, rr in bucket.items():
        total = len(rr)
        if total == 0:
            scores[sid] = 0
            continue
        ok = len([x for x in rr if x.status == "ok"])
        degraded = len([x for x in rr if x.status == "degraded"])
        score = int((ok / total) * 100 - (degraded / total) * 20)
        scores[sid] = max(0, min(100, score))
    return scores


def attach_reliability(db, sources: list[Source]) -> list[dict]:
    rel = compute_reliability(db)
    out = []
    for s in sources:
        out.append({
            "id": s.id,
            "name": s.name,
            "base_url": s.base_url,
            "kind": s.kind,
            "discovery_method": s.discovery_method,
            "robots_status": s.robots_status,
            "approved": s.approved,
            "enabled": s.enabled,
            "health_status": s.health_status,
            "last_error": s.last_error,
            "reliability_score": rel.get(s.id, 0),
        })
    return out
