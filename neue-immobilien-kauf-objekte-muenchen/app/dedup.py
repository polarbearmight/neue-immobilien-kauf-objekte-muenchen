from __future__ import annotations

import hashlib
from collections import defaultdict
from app.models import Listing


def _sig(l: Listing) -> str:
    district = (l.district or "unknown").strip().lower()
    sqm = int(round((l.area_sqm or 0) / 5.0) * 5)
    price = int(round((l.price_eur or 0) / 10000.0) * 10000)
    raw = f"{district}|{sqm}|{price}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


def assign_clusters(rows: list[Listing]) -> int:
    groups = defaultdict(list)
    for r in rows:
        groups[_sig(r)].append(r)

    changed = 0
    for _, items in groups.items():
        if len(items) < 2:
            continue
        cid = f"cl-{_sig(items[0])}"
        for it in items:
            if it.cluster_id != cid:
                it.cluster_id = cid
                changed += 1
    return changed
