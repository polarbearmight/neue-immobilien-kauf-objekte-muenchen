from pathlib import Path


TEMPLATE = '''"""Auto-generated collector skeleton for {name}."""

from dataclasses import dataclass


@dataclass
class Candidate:
    url: str
    source_listing_id: str


def fetch_candidates() -> list[Candidate]:
    return []


def fetch_detail(candidate: Candidate) -> dict:
    return {{}}


def normalize(parsed: dict) -> dict:
    return {{
        "source": "{slug}",
        "source_listing_id": parsed.get("source_listing_id"),
        "url": parsed.get("url"),
        "title": parsed.get("title"),
        "description": parsed.get("description"),
        "image_url": parsed.get("image_url"),
        "address": parsed.get("address"),
        "district": parsed.get("district"),
        "price_eur": parsed.get("price_eur"),
        "area_sqm": parsed.get("area_sqm"),
        "rooms": parsed.get("rooms"),
        "price_per_sqm": parsed.get("price_per_sqm"),
        "posted_at": parsed.get("posted_at"),
    }}


def self_test() -> dict:
    return {{"ok": True, "message": "skeleton collector"}}
'''


def generate_adapter(name: str, out_dir: str = "collectors/sources") -> str:
    slug = name.lower().replace(" ", "_").replace("-", "_")
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{slug}.py"
    path.write_text(TEMPLATE.format(name=name, slug=slug), encoding="utf-8")
    return str(path)
