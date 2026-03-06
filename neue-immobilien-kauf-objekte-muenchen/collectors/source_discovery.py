from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET


SEED_SOURCES = [
    {"name": "Immowelt", "base_url": "https://www.immowelt.de", "kind": "html"},
    {"name": "Immonet", "base_url": "https://www.immonet.de", "kind": "html"},
    {"name": "Kleinanzeigen Immobilien", "base_url": "https://www.kleinanzeigen.de", "kind": "html"},
    {"name": "Ohne Makler", "base_url": "https://www.ohne-makler.net", "kind": "html"},
    {"name": "Wohnungsboerse", "base_url": "https://www.wohnungsboerse.net", "kind": "html"},
    {"name": "SIS Immobilien", "base_url": "https://www.sis.de", "kind": "html"},
    {"name": "PlanetHome", "base_url": "https://planethome.de", "kind": "html"},
    {"name": "SZ Immobilien", "base_url": "https://immobilienmarkt.sueddeutsche.de", "kind": "html"},
]

BROKER_CURATED_SOURCES = [
    {"name": "Aigner Immobilien", "base_url": "https://www.aigner-immobilien.de/immobilien/", "kind": "broker"},
    {"name": "Riedel Immobilien", "base_url": "https://www.riedel-immobilien.de/immobilien/", "kind": "broker"},
    {"name": "Duken & v. Wangenheim", "base_url": "https://www.duken-wangenheim.de/immobilien/", "kind": "broker"},
    {"name": "Graf Immobilien", "base_url": "https://www.grafimmo.de/immobilien/", "kind": "broker"},
    {"name": "Dahler & Company München", "base_url": "https://www.dahlercompany.com/de/immobilien/muenchen/", "kind": "broker"},
    {"name": "Engel & Völkers München", "base_url": "https://www.engelvoelkers.com/de-de/muenchen/immobilien/", "kind": "broker"},
]


@dataclass
class SourceCard:
    name: str
    base_url: str
    kind: str
    robots_status: str
    sample_urls: list[str]
    sitemap_urls: list[str]
    structured_data_detected: bool
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


def _find_sitemap_urls(base_url: str, limit: int = 20) -> list[str]:
    out: list[str] = []
    sitemap_url = f"{base_url.rstrip('/')}/sitemap.xml"
    xml = _fetch(sitemap_url)
    if not xml:
        return out
    try:
        root = ET.fromstring(xml)
    except Exception:
        return out

    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    loc_nodes = root.findall(f".//{ns}loc") or root.findall(".//loc")
    for node in loc_nodes:
        u = (node.text or "").strip()
        if not u:
            continue
        if u.endswith(".xml") and len(out) < limit:
            sub = _fetch(u)
            if sub:
                try:
                    sub_root = ET.fromstring(sub)
                    sub_nodes = sub_root.findall(f".//{ns}loc") or sub_root.findall(".//loc")
                    for sn in sub_nodes:
                        su = (sn.text or "").strip()
                        if any(k in su.lower() for k in ("immobil", "objekt", "projekt", "angebot")):
                            out.append(su)
                            if len(out) >= limit:
                                break
                except Exception:
                    pass
        else:
            if any(k in u.lower() for k in ("immobil", "objekt", "projekt", "angebot")):
                out.append(u)
        if len(out) >= limit:
            break
    return list(dict.fromkeys(out))[:limit]


def discover_source_card(name: str, base_url: str, kind: str = "unknown") -> SourceCard:
    host = urlparse(base_url).netloc
    robots = _fetch(f"{base_url.rstrip('/')}/robots.txt")
    robots_status = "unknown" if robots is None else "allowed"

    sample_urls: list[str] = []
    sitemap_urls = _find_sitemap_urls(base_url)
    html = _fetch(base_url)
    structured_data_detected = False
    if html:
        soup = BeautifulSoup(html, "html.parser")
        structured_data_detected = bool(soup.find("script", attrs={"type": "application/ld+json"}))
        for a in soup.select("a[href]")[:80]:
            href = a.get("href") or ""
            if "wohnung" in href.lower() or "immobil" in href.lower() or "kaufen" in href.lower() or "projekt" in href.lower():
                if href.startswith("/"):
                    href = f"https://{host}{href}"
                if href.startswith("http") and href not in sample_urls:
                    sample_urls.append(href)
            if len(sample_urls) >= 5:
                break

    if sitemap_urls:
        sample_urls = list(dict.fromkeys((sample_urls + sitemap_urls)))[:10]
    if not sample_urls:
        sample_urls = [base_url]

    risk = "low" if robots_status == "allowed" else "medium"
    recommended_rate = 7200 if kind == "broker" else 8
    return SourceCard(
        name=name,
        base_url=base_url,
        kind=kind,
        robots_status=robots_status,
        sample_urls=sample_urls,
        sitemap_urls=sitemap_urls,
        structured_data_detected=structured_data_detected,
        recommended_rate_limit_seconds=recommended_rate,
        risk_rating=risk,
    )


def discovery_queries_for_munich() -> list[str]:
    return [
        'immobilien münchen makler angebot',
        'neubau projekt münchen immobilien',
        'eigentumswohnung münchen makler',
        'haus kaufen münchen makler',
    ]


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
        f"- structured_data_detected: {card.structured_data_detected}",
        f"- sitemap_candidates: {len(card.sitemap_urls)}",
        "- recommended_mechanism: API > RSS > JSON-LD > Sitemap > HTML",
        "- approve_recommendation: no (manual review required)",
        "",
        "## Sample URLs",
    ]
    lines.extend([f"- {u}" for u in card.sample_urls[:5]])
    out.write_text("\n".join(lines), encoding="utf-8")
    return out
