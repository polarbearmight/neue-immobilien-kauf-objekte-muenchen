import streamlit as st
import pandas as pd
import requests

API = st.secrets.get("api_url", "http://localhost:8000")

st.title("Neue Kauf Objekte München")

bucket = st.radio("Preis/m² Bucket", ["all", "9000", "12000", "unknown"], horizontal=True)
limit = st.slider("Limit", 20, 500, 200)

stats = requests.get(f"{API}/stats", params={"days": 7}, timeout=10).json()
st.metric("Neue 7 Tage", stats.get("new_listings", 0))
st.metric("Ø €/m² (7 Tage)", stats.get("avg_price_per_sqm") or "-")

items = requests.get(f"{API}/listings", params={"bucket": bucket, "limit": limit}, timeout=15).json()
if not items:
    st.info("Noch keine Daten vorhanden.")
else:
    df = pd.DataFrame(items)
    cols = ["title", "district", "area_sqm", "price_eur", "price_per_sqm", "rooms", "posted_at", "first_seen_at", "source", "url"]
    show = [c for c in cols if c in df.columns]
    st.dataframe(df[show], use_container_width=True)
