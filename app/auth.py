import hashlib
import hmac
import os
import secrets
from datetime import timedelta
from pathlib import Path

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.time_utils import utc_now

PBKDF2_ROUNDS = 120_000


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt, digest = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(rounds)).hex()
        return hmac.compare_digest(computed, digest)
    except Exception:
        return False


def issue_reset_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(24)
    hashed = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, hashed


def hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def reset_token_expiry(hours: int = 1):
    return utc_now() + timedelta(hours=hours)


def read_frontend_env_password(default: str = "admin123") -> str:
    env_path = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("MDF_PASSWORD="):
                return line.split("=", 1)[1].strip() or default
    return os.getenv("MDF_PASSWORD", default)


def legal_contact_payload() -> dict:
    return {
        "brand": os.getenv("MDF_LEGAL_BRAND", "ImmoDealFinder"),
        "owner": os.getenv("MDF_LEGAL_OWNER", "Marius"),
        "email": os.getenv("MDF_LEGAL_EMAIL", "admin@immodealfinder.de"),
        "street": os.getenv("MDF_LEGAL_STREET", "Bitte Straße ergänzen"),
        "city": os.getenv("MDF_LEGAL_CITY", "Bitte Ort ergänzen"),
        "postal_code": os.getenv("MDF_LEGAL_POSTAL_CODE", "Bitte PLZ ergänzen"),
        "country": os.getenv("MDF_LEGAL_COUNTRY", "Deutschland"),
        "phone": os.getenv("MDF_LEGAL_PHONE", "Bitte Telefonnummer ergänzen"),
    }


def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _extract_username(request: Request) -> str | None:
    return request.headers.get("x-auth-user") or request.headers.get("X-Auth-User")


def get_current_user(request: Request, db: Session = Depends(get_db_session)):
    from app.models import User

    username = _extract_username(request)
    if not username:
        raise HTTPException(status_code=401, detail="Nicht eingeloggt")
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User nicht gefunden")
    return user


def require_role(*roles: str):
    def check(user=Depends(get_current_user)):
        if user.effective_role not in roles:
            raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Funktion")
        return user

    return check
