from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup


SEED_SOURCES = [
    {"name": "Immowelt", "base_url": "https://www.immowelt.de", "kind": "html"},
    {"name": "Immonet", "base_url": "https://www.immonet.de", "kind": "html"},
    {"name": "Kleinanzeigen Immobilien", "base_url": "https://www.kleinanzeigen.de", "kind": "html"},
    {"name": "Ohne Makler", "base_url": "https://www.ohne-makler.net", "kind": "html"},
    {"name": "Wohnungsboerse", "base_url": "https://www.wohnungsboerse.net", "kind": "html"},
    {"name": "SIS Immobilien", "base_url": "https://www.sis.de", "kind": "html"},
    {"name": "SZ Immobilien", "base_url": "https://immobilienmarkt.sueddeutsche.de", "kind": "html"},
]


@dataclass
class SourceCard:
    name: str
    base_url: str
    kind: str
    robots_status: str
    sample_urls: list[str]
    recommended_rate_limit_seconds: int
    risk_rating: str


def _fetch(url: str) -> str | None:
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code >= 400:
            return None
        return r.text
    except Exception:
        return None


def discover_source_card(name: str, base_url: str, kind: str = "unknown") -> SourceCard:
    host = urlparse(base_url).netloc
    robots = _fetch(f"{base_url.rstrip('/')}/robots.txt")
    robots_status = "unknown" if robots is None else "allowed"

    sample_urls: list[str] = []
    html = _fetch(base_url)
    if html:
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.select("a[href]")[:80]:
            href = a.get("href") or ""
            if "wohnung" in href.lower() or "immobil" in href.lower() or "kaufen" in href.lower():
                if href.startswith("/"):
                    href = f"https://{host}{href}"
                if href.startswith("http") and href not in sample_urls:
                    sample_urls.append(href)
            if len(sample_urls) >= 5:
                break

    if not sample_urls:
        sample_urls = [base_url]

    risk = "low" if robots_status == "allowed" else "medium"
    return SourceCard(
        name=name,
        base_url=base_url,
        kind=kind,
        robots_status=robots_status,
        sample_urls=sample_urls,
        recommended_rate_limit_seconds=8,
        risk_rating=risk,
    )


def write_source_report(card: SourceCard, report_root: str | Path) -> Path:
    report_root = Path(report_root)
    report_root.mkdir(parents=True, exist_ok=True)
    slug = card.name.lower().replace(" ", "-")
    out = report_root / f"{slug}.md"
    lines = [
        f"# Source Card: {card.name}",
        "",
        f"- base_url: {card.base_url}",
        f"- kind: {card.kind}",
        f"- robots_status: {card.robots_status}",
        f"- risk_rating: {card.risk_rating}",
        f"- recommended_rate_limit_seconds: {card.recommended_rate_limit_seconds}",
        "- recommended_mechanism: API > RSS > JSON-LD > Sitemap > HTML",
        "- approve_recommendation: no (manual review required)",
        "",
        "## Sample URLs",
    ]
    lines.extend([f"- {u}" for u in card.sample_urls[:5]])
    out.write_text("\n".join(lines), encoding="utf-8")
    return out
