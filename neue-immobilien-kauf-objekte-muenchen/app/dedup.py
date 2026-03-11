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
    alat = getattr(a, "latitude", None)
    alon = getattr(a, "longitude", None)
    blat = getattr(b, "latitude", None)
    blon = getattr(b, "longitude", None)
    if alat is None or alon is None or blat is None or blon is None:
        return False
    # rough threshold suitable for same property block (about <= ~180m)
    return abs(float(alat) - float(blat)) <= 0.0016 and abs(float(alon) - float(blon)) <= 0.0022


def _duplicate_score(a: Listing, b: Listing) -> float:
    score = 0.0

    aa = _norm(a.address)
    ba = _norm(b.address)
    if aa and ba:
        if aa == ba:
            score += 4.0
        elif aa in ba or ba in aa:
            score += 2.4

    pa = getattr(a, "postal_code", None) or _postal(getattr(a, "address", None) or getattr(a, "district", None))
    pb = getattr(b, "postal_code", None) or _postal(getattr(b, "address", None) or getattr(b, "district", None))
    if pa and pb:
        if pa == pb:
            score += 1.2
        else:
            # hard postal mismatch usually means different object,
            # but allow a tiny chance for extraction noise if geo is very close
            if not _geo_close(a, b):
                return -1.0

    da = _norm(a.district)
    db = _norm(b.district)
    if da and db:
        if da == db:
            score += 0.8
        elif not (pa and pb and pa == pb):
            # different district strings are common across portals;
            # do not immediately reject when we have other strong signals
            score -= 0.2

    if _geo_close(a, b):
        score += 3.0

    a_price = getattr(a, "price_eur", None)
    b_price = getattr(b, "price_eur", None)
    rd_price = _rel_diff(float(a_price) if a_price is not None else None, float(b_price) if b_price is not None else None)
    if rd_price is not None:
        if rd_price <= 0.07:
            score += 1.5
        elif rd_price <= 0.14:
            score += 0.8
        elif rd_price >= 0.35:
            score -= 1.0

    a_area = getattr(a, "area_sqm", None)
    b_area = getattr(b, "area_sqm", None)
    rd_area = _rel_diff(float(a_area) if a_area is not None else None, float(b_area) if b_area is not None else None)
    if rd_area is not None:
        if rd_area <= 0.06:
            score += 1.2
        elif rd_area <= 0.14:
            score += 0.6
        elif rd_area >= 0.3:
            score -= 0.8

    a_rooms = getattr(a, "rooms", None)
    b_rooms = getattr(b, "rooms", None)
    rd_rooms = _rel_diff(float(a_rooms) if a_rooms is not None else None, float(b_rooms) if b_rooms is not None else None)
    if rd_rooms is not None and rd_rooms <= 0.2:
        score += 0.4

    ts = _title_similarity(a, b)
    if ts >= 0.8:
        score += 1.6
    elif ts >= 0.65:
        score += 0.9

    # image hash overlap is a strong signal when available
    a_img = getattr(a, "image_hash", None)
    b_img = getattr(b, "image_hash", None)
    if a_img and b_img and a_img == b_img:
        score += 2.0

    return score


def _is_probable_duplicate(a: Listing, b: Listing) -> bool:
    # keep clusters cross-source to avoid over-merging reposts from same source
    if getattr(a, "source", None) == getattr(b, "source", None):
        return False
    score = _duplicate_score(a, b)
    if score < 0:
        return False

    # strong rules, independent from title-only matches
    if _geo_close(a, b) and score >= 3.5:
        return True
    if score >= 4.8:
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
    c_address = getattr(c, "address", None)
    c_district = getattr(c, "district", None)
    c_postal = getattr(c, "postal_code", None)
    c_area = getattr(c, "area_sqm", None) or 0
    c_price = getattr(c, "price_eur", None) or 0
    seeds = [
        _norm(c_address) or _norm(c_district),
        c_postal or _postal(c_address or c_district) or "",
        str(int(round((c_area) / 5.0) * 5)),
        str(int(round((c_price) / 10000.0) * 10000)),
    ]
    raw = "|".join(seeds)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


def assign_clusters(rows: list[Listing]) -> int:
    # clear stale cluster ids first; rebuild from scratch for consistency
    for r in rows:
        r.cluster_id = None

    by_bucket: dict[str, list[Listing]] = defaultdict(list)
    for r in rows:
        postal = getattr(r, "postal_code", None) or _postal(getattr(r, "address", None) or getattr(r, "district", None))
        district = _norm(getattr(r, "district", None)) or "unknown"
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
