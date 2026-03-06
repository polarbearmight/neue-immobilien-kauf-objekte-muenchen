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


def _is_probable_duplicate(a: Listing, b: Listing) -> bool:
    if a.source == b.source:
        return False

    aa = _norm(a.address)
    ba = _norm(b.address)
    if aa and ba and aa == ba:
        return True

    da = _norm(a.district)
    db = _norm(b.district)
    pa = _postal(a.address or a.district)
    pb = _postal(b.address or b.district)
    if pa and pb and pa != pb:
        return False

    if da and db and da != db and not (pa and pb and pa == pb):
        return False

    area_ok = (a.area_sqm is not None and b.area_sqm is not None and abs(a.area_sqm - b.area_sqm) <= 7.5)
    price_ok = (a.price_eur is not None and b.price_eur is not None and abs(a.price_eur - b.price_eur) <= 50000)
    title_ok = _title_similarity(a, b) >= 0.62

    if area_ok and price_ok and title_ok:
        return True

    return False


def _cluster_sig(items: list[Listing]) -> str:
    seeds = sorted([
        _norm(items[0].district),
        str(int(round((items[0].area_sqm or 0) / 5.0) * 5)),
        str(int(round((items[0].price_eur or 0) / 10000.0) * 10000)),
    ])
    raw = "|".join(seeds)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


def assign_clusters(rows: list[Listing]) -> int:
    by_district = defaultdict(list)
    for r in rows:
        by_district[_norm(r.district) or "unknown"].append(r)

    parent = {id(r): id(r) for r in rows}
    ref = {id(r): r for r in rows}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for group in by_district.values():
        s = sorted(group, key=lambda x: (x.price_eur or 0))
        n = len(s)
        for i in range(n):
            a = s[i]
            for j in range(i + 1, n):
                b = s[j]
                if a.price_eur is not None and b.price_eur is not None and (b.price_eur - a.price_eur) > 120000:
                    break
                if _is_probable_duplicate(a, b):
                    union(id(a), id(b))

    comps = defaultdict(list)
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
