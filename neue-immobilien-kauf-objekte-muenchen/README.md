# Munich Real Estate Deal Engine (Local)

Lokales System für neue Kaufwohnungen in München.

## Enthalten (aktueller Stand)
- FastAPI Backend mit:
  - `GET /api/listings` (+ Filter für bucket/score/district/source/ranges)
  - `GET /api/listings/{id}`
  - `GET /api/listings/{id}/snapshots`
  - `GET /api/stats`, `GET /api/sources`, `GET /api/clusters`, `GET /api/price-drops`
  - `POST /api/collect/run` (lokal)
  - `POST /api/discovery/run`
  - Watchlist + Alert Rules Endpoints
- SQLAlchemy Datenmodell inkl. snapshots/source_runs/watchlist/alert_rules
- Collector-Runner (SZ + Immowelt + Ohne-Makler + Wohnungsboerse + SIS + PlanetHome), source validation, scoring, ai-flags, dedup/clustering
- Next.js + shadcn UI mit Seiten:
  - Dashboard, Deal Radar, Brand New, Price Drops, Clusters, Sources, Settings

## Compliance
- Kein Bot-Bypass
- konservative Rate-Limits
- blocked sources werden nur als blocked behandelt
- local-only (SQLite + localhost)

## Runbook
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# optional
export DB_URL='sqlite:///./local.db'
export REQUEST_DELAY_SECONDS=8
export ENABLE_FALLBACK_SEED=true

python -m collectors.run_collect
# optional: fixture capture for tests
python -m collectors.run_collect --source immowelt --dry-run --capture-fixture
# optional: force (bypasses approval gate for one run)
python -m collectors.run_collect --source immowelt --force
# default behavior can bypass approval gate globally (recommended for local-only setup)
export ALLOW_UNAPPROVED_SOURCES=true
# optional hard skip list, comma-separated (e.g. block unstable sources)
export DISABLED_SOURCES=planethome

uvicorn app.main:app --reload --port 8001
```

UI:
```bash
cd frontend
npm install
# optional: export NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
npm run dev
```

One-command local run (collect all sources first, then start backend+frontend):
```bash
./start-all-sources.sh
```

Open:
- API docs: http://127.0.0.1:8001/docs
- UI: http://127.0.0.1:3000

## Tests
```bash
pytest -q
```

## Troubleshooting
- `ModuleNotFoundError: app` bei Tests:
  - im Projektordner starten: `cd neue-immobilien-kauf-objekte-muenchen`
- Keine Listings sichtbar:
  - `python -m collectors.run_collect`
  - dann `/api/listings?limit=20` prüfen
- CORS/URL-Fehler im Frontend:
  - `NEXT_PUBLIC_API_URL` auf laufende API setzen
