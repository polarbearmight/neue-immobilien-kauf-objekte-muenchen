from __future__ import annotations

import json
from app.models import Listing

NEG = ["sanierungsbedürftig", "erbbaurecht", "zwangsversteigerung", "teileigentum"]
POS = ["saniert", "renoviert", "erstbezug", "aufzug", "balkon", "hell", "ruhig", "tg"]
SPAM = ["nur heute", "sofort zuschlagen", "whatsapp"]


def analyze_listing(listing: Listing, district_median: float | None = None) -> tuple[list[str], dict]:
    text = f"{listing.title or ''} {listing.description or ''}".lower()
    flags: list[str] = []
    explain = {"positive": [], "negative": [], "risk": []}

    for w in POS:
        if w in text:
            explain["positive"].append(w)
    for w in NEG:
        if w in text:
            flags.append("FLAG_RENOVATION" if "sanierung" in w else "FLAG_RISK")
            explain["negative"].append(w)
    for w in SPAM:
        if w in text:
            flags.append("FLAG_MARKETING_SPAM")
            explain["risk"].append(w)

    if district_median and listing.price_per_sqm and listing.price_per_sqm < district_median * 0.6:
        flags.append("FLAG_TOO_CHEAP")

    return sorted(set(flags)), explain


def serialize_flags(flags: list[str]) -> str:
    return json.dumps(flags, ensure_ascii=False)
