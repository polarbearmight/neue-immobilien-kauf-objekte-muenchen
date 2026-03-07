from __future__ import annotations

import re

_NOISE_SUFFIX = re.compile(r"\s*[|\-–:]\s*(Immobilien|Makler|München|Munich).*$", re.IGNORECASE)


def normalize_title(raw_title: str | None) -> str | None:
    if not raw_title:
        return None
    t = " ".join(str(raw_title).split()).strip()
    if not t:
        return None
    t = _NOISE_SUFFIX.sub("", t).strip()
    t = re.sub(r"\s{2,}", " ", t)
    return t[:512] or None


def make_display_title(
    title: str | None,
    district: str | None,
    area_sqm: float | None,
    rooms: float | None,
) -> str:
    if title and title.strip():
        return title.strip()

    bits: list[str] = []
    bits.append(f"Objekt in {district}" if district else "Objekt in München")
    if area_sqm and area_sqm > 0:
        bits.append(f"{int(round(area_sqm))} m²")
    if rooms and rooms > 0:
        bits.append(f"{rooms:g} Zi")
    return " · ".join(bits)
