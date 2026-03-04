# Neue Immobilien Kauf Objekte Muenchen

MVP Dashboard für neue Kaufwohnungen in München.

## Enthalten
- FastAPI Backend (`/listings`, `/stats`)
- SQLAlchemy Datenmodell (`listings`)
- Collector-Runner für SZ + IS24 (IS24 aktuell als compliant Skeleton, block-tolerant bei 401/403/429)
- Streamlit Dashboard
- Bucket-Filter: `<=9000`, `<=12000`, `all`, `unknown`
- Sortierung: neueste oben

## Wichtiger Compliance-Hinweis
Dieses Projekt ist auf **regelkonformes Crawling** ausgelegt:
- robots.txt Prüfung
- konservatives Rate-Limit (Default 8s)
- **kein** Bot-Bypass, keine Captcha-Umgehung, keine ToS-Umgehung

## Start (lokal)
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# optional
export DB_URL='sqlite:///./local.db'  # oder postgres+psycopg://...
export REQUEST_DELAY_SECONDS=8
# optional (default true): falls keine Live-Treffer, Demo-Seed-Datensatz anlegen
export ENABLE_FALLBACK_SEED=true

python -m collectors.run_collect
uvicorn app.main:app --reload
streamlit run ui/streamlit_app.py
```

## API
- `GET /listings?bucket=9000&sort=newest&limit=200`
- `GET /stats?days=7`

## Nächste Features
1. IS24 Detailparser + Feldextraktion (preis, m², zimmer, posted_at)
2. Snapshot-Historie für Preisänderungen
3. Monitoring/Alarm bei Parser-Ausfall
4. Dedizierte PostgreSQL Migrationen (Alembic)
