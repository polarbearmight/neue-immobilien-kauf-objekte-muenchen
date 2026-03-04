import os
from datetime import datetime
import math
import pandas as pd
import requests
import streamlit as st

API = os.getenv("API_URL", "http://localhost:8000")
try:
    if "api_url" in st.secrets:
        API = st.secrets["api_url"]
except Exception:
    pass


def fmt_eur(v):
    if v is None or pd.isna(v):
        return "-"
    return f"{v:,.0f} €".replace(",", ".")


def fmt_num(v, suffix=""):
    if v is None or pd.isna(v):
        return "-"
    return f"{v:,.2f}{suffix}".replace(",", "X").replace(".", ",").replace("X", ".")


def parse_dt(v):
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except Exception:
        return None


def calc_score(item, median_ppsqm):
    score = 50
    ppsqm = item.get("price_per_sqm")
    rooms = item.get("rooms")
    area = item.get("area_sqm")
    if median_ppsqm and ppsqm:
        if ppsqm <= median_ppsqm * 0.9:
            score += 20
        elif ppsqm <= median_ppsqm:
            score += 10
        elif ppsqm > median_ppsqm * 1.2:
            score -= 15
    if rooms and rooms >= 3:
        score += 10
    if area and area >= 70:
        score += 10
    return max(0, min(100, int(score)))


st.set_page_config(page_title="Neue Kauf Objekte München", layout="wide")
st.title("🏙️ Neue Kauf Objekte München")

main_col, side_col = st.columns([4, 1])

with side_col:
    st.subheader("Sortierung")
    sort_mode = st.selectbox(
        "Sortieren nach",
        ["Neueste", "Älteste", "Score ↓", "Preis ↑", "Preis ↓", "€/m² ↑", "€/m² ↓"],
        index=0,
    )
    bucket = st.selectbox("Preis/m² Bucket", ["all", "9000", "12000", "unknown"], index=0)
    limit = st.selectbox("Pro Seite", [20, 40, 60], index=0)
    min_score = st.slider("Min. Score", 0, 100, 0)

try:
    stats = requests.get(f"{API}/stats", params={"days": 7}, timeout=10).json()
except Exception as e:
    st.error(f"API /stats Fehler: {e}")
    stats = {"new_listings": 0, "avg_price_per_sqm": None}

k1, k2 = st.columns(2)
k1.metric("Neue 7 Tage", stats.get("new_listings", 0))
k2.metric("Ø €/m² (7 Tage)", stats.get("avg_price_per_sqm") or "-")

try:
    items = requests.get(
        f"{API}/listings", params={"bucket": bucket, "limit": 300, "sort": "newest"}, timeout=20
    ).json()
except Exception as e:
    st.error(f"API /listings Fehler: {e}")
    items = []

if not items:
    st.info("Noch keine Daten vorhanden.")
    st.stop()

median_ppsqm = stats.get("avg_price_per_sqm")
for x in items:
    x["posted_dt"] = parse_dt(x.get("posted_at")) or parse_dt(x.get("first_seen_at"))
    x["score"] = calc_score(x, median_ppsqm)

items = [x for x in items if x.get("score", 0) >= min_score]

if sort_mode == "Älteste":
    items.sort(key=lambda x: x.get("posted_dt") or datetime.min)
elif sort_mode == "Score ↓":
    items.sort(key=lambda x: x.get("score", 0), reverse=True)
elif sort_mode == "Preis ↑":
    items.sort(key=lambda x: (x.get("price_eur") is None, x.get("price_eur") or 0))
elif sort_mode == "Preis ↓":
    items.sort(key=lambda x: (x.get("price_eur") is None, -(x.get("price_eur") or 0)))
elif sort_mode == "€/m² ↑":
    items.sort(key=lambda x: (x.get("price_per_sqm") is None, x.get("price_per_sqm") or 0))
elif sort_mode == "€/m² ↓":
    items.sort(key=lambda x: (x.get("price_per_sqm") is None, -(x.get("price_per_sqm") or 0)))
else:
    items.sort(key=lambda x: x.get("posted_dt") or datetime.min, reverse=True)

pages = max(1, math.ceil(len(items) / limit))
with side_col:
    page = st.number_input("Seite", min_value=1, max_value=pages, value=1, step=1)

start = (page - 1) * limit
end = start + limit
page_items = items[start:end]

with main_col:
    st.caption(f"Zeige {len(page_items)} von {len(items)} Treffern · Seite {page}/{pages}")
    for item in page_items:
        img = item.get("image_url") or "https://placehold.co/420x260?text=Kein+Bild"
        title = item.get("title") or "Ohne Titel"
        district = item.get("district") or item.get("address") or "München"
        desc = item.get("description") or f"{district} · {fmt_num(item.get('rooms'), ' Zi')} · {fmt_num(item.get('area_sqm'), ' m²')}"
        posted = item.get("posted_at") or item.get("first_seen_at") or "-"

        c1, c2 = st.columns([1.2, 2.8])
        with c1:
            st.image(img, use_column_width=True)
        with c2:
            st.markdown(f"### [{title}]({item.get('url')})")
            st.caption(f"Quelle: {str(item.get('source', '-')).upper()} · Online seit: {posted} · Score: {item.get('score', 0)}/100")
            st.markdown(
                f"**Kaufpreis:** {fmt_eur(item.get('price_eur'))}  \\n**€/m²:** {fmt_eur(item.get('price_per_sqm'))}  \\n**Fläche:** {fmt_num(item.get('area_sqm'), ' m²')}  \\n**Zimmer:** {fmt_num(item.get('rooms'))}"
            )
            st.write(desc)
        st.divider()
