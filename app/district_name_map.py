from __future__ import annotations


def canonicalize_district_name(name: str | None) -> str | None:
    if not name:
        return None
    x = name.strip()
    low = x.lower()

    aliases = {
        "altstadt": "Altstadt-Lehel",
        "schwabing": "Schwabing-Freimann",
        "schwabing west": "Schwabing-West",
        "schwabing-west": "Schwabing-West",
        "ludwigsvorstadt": "Ludwigsvorstadt-Isarvorstadt",
        "isarvorstadt": "Ludwigsvorstadt-Isarvorstadt",
        "berg am laim": "Berg am Laim",
    }
    if low in aliases:
        return aliases[low]
    return x
