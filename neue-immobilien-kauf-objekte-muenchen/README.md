# Neue Immobilien Kauf Objekte Muenchen

MVP Dashboard für neue Kaufwohnungen in München.

## Enthalten
- FastAPI Backend (`/api/listings`, `/api/stats`, `/api/sources`, `/api/discovery/run`)
- SQLAlchemy Datenmodell (`listings`, `sources`, `source_runs`)
- Collector-Runner für SZ + IS24 + Immowelt (mit Source-Validation + SourceRun-Logging)
- Source Validator (`collectors/source_validator.py`)
- Adapter Generator Skeleton (`collectors/adapter_generator.py`)
- Streamlit Dashboard
- Next.js + shadcn/ui Frontend (`frontend/`)
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
# optional:
python -m collectors.run_collect --source immowelt --dry-run
uvicorn app.main:app --reload
streamlit run ui/streamlit_app.py
```

## Neues Frontend (shadcn/ui)
```bash
cd frontend
npm install
# optional: export NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
npm run dev
```
Dann öffnen: `http://localhost:3000`

## API
- `GET /api/listings?bucket=9000&sort=newest&limit=200`
- `GET /api/stats?days=7`
- `GET /api/sources`
- `POST /api/discovery/run` (erzeugt Source Cards in `reports/source_cards/*.md`)

## Nächste Features
1. IS24 Detailparser + Feldextraktion (preis, m², zimmer, posted_at)
2. Snapshot-Historie für Preisänderungen
3. Monitoring/Alarm bei Parser-Ausfall
4. Dedizierte PostgreSQL Migrationen (Alembic)
