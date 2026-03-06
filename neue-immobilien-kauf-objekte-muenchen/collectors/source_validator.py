from __future__ import annotations

from dataclasses import dataclass
import requests


@dataclass
class ValidationResult:
    status: str  # healthy|degraded|blocked
    notes: str
    robots: str = "ok"
    http_status: int | None = None


def validate_source(base_url: str, sample_url: str | None = None) -> ValidationResult:
    """Lightweight, compliant source check.

    - robots.txt reachable
    - one optional sample request
    - 401/403/429/captcha -> blocked
    """
    robots_url = f"{base_url.rstrip('/')}/robots.txt"

    try:
        rr = requests.get(robots_url, timeout=12, headers={"User-Agent": "Mozilla/5.0"})
        if rr.status_code in (401, 403, 429):
            return ValidationResult("blocked", f"robots blocked ({rr.status_code})", robots="blocked", http_status=rr.status_code)
    except Exception as e:
        return ValidationResult("degraded", f"robots check failed: {e}", robots="unknown")

    if sample_url:
        try:
            r = requests.get(sample_url, timeout=12, headers={"User-Agent": "Mozilla/5.0"})
            body = (r.text or "")[:2000].lower()
            if r.status_code in (401, 403, 429) or "captcha" in body:
                return ValidationResult("blocked", f"sample blocked ({r.status_code})", robots="ok", http_status=r.status_code)
            if r.status_code >= 500:
                return ValidationResult("degraded", f"sample server error ({r.status_code})", robots="ok", http_status=r.status_code)
        except Exception as e:
            return ValidationResult("degraded", f"sample check failed: {e}", robots="ok")

    return ValidationResult("healthy", "validation ok", robots="ok", http_status=200)
