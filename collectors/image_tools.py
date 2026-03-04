from io import BytesIO
import requests
from PIL import Image
import imagehash


def compute_phash_from_url(url: str, timeout: int = 15) -> str | None:
    if not url:
        return None
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        img = Image.open(BytesIO(r.content)).convert("RGB")
        return str(imagehash.phash(img))
    except Exception:
        return None


def hash_distance(h1: str | None, h2: str | None) -> int | None:
    if not h1 or not h2:
        return None
    try:
        return imagehash.hex_to_hash(h1) - imagehash.hex_to_hash(h2)
    except Exception:
        return None
