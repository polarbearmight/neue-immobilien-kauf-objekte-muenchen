from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from difflib import SequenceMatcher
from app.models import Listing

_non_alnum = re.compile(r"[^a-z0-9 ]+")
_postal_re = re.compile(r"\b(8\d{4})\b")


def _norm(text: str | None) -> str:
    if not text:
        return ""
    t = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    t = _non_alnum.sub(" ", t)
    return " ".join(t.split())


def _postal(text: str | None) -> str | None:
    m = _postal_re.search(text or "")
    return m.group(1) if m else None


def _title_similarity(a: Listing, b: Listing) -> float:
    ta = _norm(a.title)
    tb = _norm(b.title)
    if not ta or not tb:
        return 0.0
    return SequenceMatcher(None, ta, tb).ratio()


def _rel_diff(a: float | None, b: float | None) -> float | None:
    if a is None or b is None:
        return None
    den = max(abs(a), abs(b), 1.0)
    return abs(a - b) / den


def _geo_close(a: Listing, b: Listing) -> bool:
    if a.latitude is None or a.longitude is None or b.latitude is None or b.longitude is None:
        return False
    # rough threshold suitable for same property block (about <= ~180m)
    return abs(float(a.latitude) - float(b.latitude)) <= 0.0016 and abs(float(a.longitude) - float(b.longitude)) <= 0.0022


def _duplicate_score(a: Listing, b: Listing) -> float:
    score = 0.0

    aa = _norm(a.address)
    ba = _norm(b.address)
    if aa and ba:
        if aa == ba:
            score += 4.0
        elif aa in ba or ba in aa:
            score += 2.4

    pa = a.postal_code or _postal(a.address or a.district)
    pb = b.postal_code or _postal(b.address or b.district)
    if pa and pb:
        if pa == pb:
            score += 1.2
        else:
            return -1.0

    da = _norm(a.district)
    db = _norm(b.district)
    if da and db:
        if da == db:
            score += 0.8
        elif not (pa and pb and pa == pb):
            return -1.0

    if _geo_close(a, b):
        score += 3.0

    rd_price = _rel_diff(float(a.price_eur) if a.price_eur is not None else None, float(b.price_eur) if b.price_eur is not None else None)
    if rd_price is not None:
        if rd_price <= 0.07:
            score += 1.5
        elif rd_price <= 0.14:
            score += 0.8
        elif rd_price >= 0.35:
            score -= 1.0

    rd_area = _rel_diff(float(a.area_sqm) if a.area_sqm is not None else None, float(b.area_sqm) if b.area_sqm is not None else None)
    if rd_area is not None:
        if rd_area <= 0.06:
            score += 1.2
        elif rd_area <= 0.14:
            score += 0.6
        elif rd_area >= 0.3:
            score -= 0.8

    rd_rooms = _rel_diff(float(a.rooms) if a.rooms is not None else None, float(b.rooms) if b.rooms is not None else None)
    if rd_rooms is not None and rd_rooms <= 0.2:
        score += 0.4

    ts = _title_similarity(a, b)
    if ts >= 0.8:
        score += 1.6
    elif ts >= 0.65:
        score += 0.9

    # image hash overlap is a strong signal when available
    if a.image_hash and b.image_hash and a.image_hash == b.image_hash:
        score += 2.0

    return score


def _is_probable_duplicate(a: Listing, b: Listing) -> bool:
    # must support same-source duplicates too (relists/reposts)
    score = _duplicate_score(a, b)
    if score < 0:
        return False

    # strong rules, independent from title-only matches
    if _geo_close(a, b) and score >= 3.5:
        return True
    if score >= 5.2:
        return True

    return False


def _cluster_sig(items: list[Listing]) -> str:
    c = sorted(
        items,
        key=lambda x: (
            x.price_eur is None,
            x.price_eur or 0,
            x.area_sqm is None,
            x.area_sqm or 0,
            x.first_seen_at,
        ),
    )[0]
    seeds = [
        _norm(c.address) or _norm(c.district),
        c.postal_code or _postal(c.address or c.district) or "",
        str(int(round((c.area_sqm or 0) / 5.0) * 5)),
        str(int(round((c.price_eur or 0) / 10000.0) * 10000)),
    ]
    raw = "|".join(seeds)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


def assign_clusters(rows: list[Listing]) -> int:
    # clear stale cluster ids first; rebuild from scratch for consistency
    for r in rows:
        r.cluster_id = None

    by_bucket: dict[str, list[Listing]] = defaultdict(list)
    for r in rows:
        postal = r.postal_code or _postal(r.address or r.district)
        district = _norm(r.district) or "unknown"
        key = postal or district
        by_bucket[key].append(r)

    parent = {id(r): id(r) for r in rows}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for group in by_bucket.values():
        s = sorted(group, key=lambda x: (x.price_eur or 0, x.area_sqm or 0))
        n = len(s)
        for i in range(n):
            a = s[i]
            for j in range(i + 1, n):
                b = s[j]
                if a.price_eur is not None and b.price_eur is not None and (b.price_eur - a.price_eur) > 200000:
                    break
                if _is_probable_duplicate(a, b):
                    union(id(a), id(b))

    comps: dict[int, list[Listing]] = defaultdict(list)
    for r in rows:
        comps[find(id(r))].append(r)

    changed = 0
    for items in comps.values():
        if len(items) < 2:
            continue
        cid = f"cl-{_cluster_sig(items)}"
        for it in items:
            if it.cluster_id != cid:
                it.cluster_id = cid
                changed += 1
    return changed
