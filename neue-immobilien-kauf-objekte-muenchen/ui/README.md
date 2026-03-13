# ui/ (legacy / ops)

Dieses Verzeichnis ist **nicht** das Haupt-Frontend der SaaS-Anwendung.

## Zweck
- `ui/streamlit_app.py` ist ein älteres / internes Streamlit-Ops-Interface
- das eigentliche Produkt-Frontend liegt in **`frontend/`** (Next.js)

## Aktueller Stand
Für Produktion und Live-Domain gilt:
- **Landingpage + Dashboard + Account + Auth + Contact** → `frontend/`
- **Backend API** → `app/`
- **Collector-/Source-Logik** → `collectors/`

## Empfehlung
- `frontend/` = primäres Web-Produkt
- `ui/` = optionales internes Legacy-/Ops-Tool

Wenn `ui/` später nicht mehr gebraucht wird, kann es kontrolliert entfernt oder in `ops/streamlit/` umbenannt werden.
