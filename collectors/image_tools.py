from io import BytesIO
import requests
from PIL import Image
import imagehash


def _download_image(url: str, timeout: int = 15) -> Image.Image | None:
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGB")
    except Exception:
        return None


def compute_phash_from_url(url: str, timeout: int = 15) -> str | None:
    if not url:
        return None
    img = _download_image(url, timeout=timeout)
    if img is None:
        return None
    try:
        return str(imagehash.phash(img))
    except Exception:
        return None


def is_probable_property_photo(url: str, timeout: int = 15) -> bool:
    """Heuristic to filter out broker logos/avatars and keep real property photos."""
    if not url:
        return False
    low = url.lower()
    if any(t in low for t in ["logo", "avatar", "profile", "icon", "badge", "makler", "agentur"]):
        return False

    img = _download_image(url, timeout=timeout)
    if img is None:
        return False

    w, h = img.size
    if w < 320 or h < 200:
        return False

    # Logos tend to be very low-entropy/simple; real photos usually higher.
    entropy = img.convert("L").entropy()
    if entropy < 3.2:
        return False

    return True


def hash_distance(h1: str | None, h2: str | None) -> int | None:
    if not h1 or not h2:
        return None
    try:
        return imagehash.hex_to_hash(h1) - imagehash.hex_to_hash(h2)
    except Exception:
        return None
