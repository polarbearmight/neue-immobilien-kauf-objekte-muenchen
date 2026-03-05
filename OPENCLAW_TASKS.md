# OpenClaw Autonomous Development Mode

You are allowed to:

• refactor code
• create new modules
• improve UI
• add features
• test new sources
• write tests
• iterate continuously

Goal:
Build the best Munich real estate deal finder dashboard.



```markdown
# OpenClaw Mighty Mode — Munich Real Estate Deal Engine (Local-Only)
UI: shadcn/ui + Next.js + Tailwind
Goal: OpenClaw arbeitet autonom mehrere Stunden an einem lokal laufenden System, das neue Kaufwohnungen in München aus vielen Quellen aggregiert (inkl. weniger bekannter), Quellen regelkonform entdeckt/validiert, ein Deal-Scoring berechnet, “brandneu” markiert, Preisdrops erkennt, Duplicate-Clustering macht, und ein modernes Dashboard (shadcn) baut.

---

## 0) NON-NEGOTIABLE GUARDRAILS (Compliance + Stability)
1) **Kein Umgehen** von Bot-Schutz
2) **Human-in-the-loop** für neue Quellen:
   - Discovery erzeugt “Source Cards”
   - Nur bei `APPROVED=true` + `enabled=true` wird eine Quelle aktiv gesammelt.
3) Rate Limits: konservativ (z. B. 1 Request/5–10s pro Source; Backoff bei Fehlern).
4) **Local-only**: SQLite + localhost. Keine Cloud, keine Remote Deploys.

---

## 1) Ziel-Funktionen
### Core
- Neue Listings (München, Kaufwohnung) mit **neueste oben**
- Buckets: `<= 9000 €/m²`, `<= 12000 €/m²`, `unknown`
- “brandneu” Markierung (z. B. <= 6h), “just listed” (<= 2h)
- Deal Score (0..100) + Badges (TOP_DEAL, ULTRA, PRICE_DROP, CHECK, …)
- Quellenmonitor: health, letzte Runs, Fehlerquote, Blocked/Disabled Gründe

### Mighty Add-ons
- **Source Discovery Engine** (findet Kandidatenquellen + Mechanismen)
- Adapter Generator (Skeleton pro Source: RSS/API/JSON-LD/Sitemap/HTML)
- Dedup/Clustering über mehrere Quellen (“Seen on …”)
- Snapshots & Preis-Drops
- AI Deal Analyzer (heuristisch + optional local LLM hooks; explainable)

---

## 2) Datenmodell (SQLite)
### Table: `sources`
- id (pk)
- name
- base_url
- kind: `api|rss|sitemap|jsonld|html|mixed|unknown`
- discovery_method: `seed|directory|manual`
- robots_status: `allowed|disallowed|unknown`
- tos_status: `allowed|disallowed|unknown`
- auth_required: bool
- approved: bool default false
- enabled: bool default false
- tier: 1|2|3|4
- rate_limit_seconds: int
- last_validated_at
- health_status: `healthy|degraded|blocked|disabled`
- last_success_at
- last_error
- notes

### Table: `listings`
- id (pk)
- source_id (fk)
- source_listing_id (text)  # unique within source
- url
- title
- district (nullable)
- address (nullable)
- rooms (float nullable)
- area_sqm (float nullable)
- price_eur (int nullable)
- price_per_sqm (float nullable)
- posted_at (datetime nullable)      # wenn Quelle liefert
- first_seen_at (datetime required)  # immer
- last_seen_at (datetime required)
- is_active (bool default true)
- raw_json (text nullable)           # JSON-LD/API excerpt
- raw_html_hash (text nullable)
- deal_score (float nullable)
- badges (json/text)
- score_explain (json/text)          # explainability
- ai_flags (json/text)               # AI Deal Analyzer flags
- cluster_id (nullable)

### Table: `listing_snapshots`
- id (pk)
- listing_id (fk)
- captured_at
- price_eur
- price_per_sqm
- is_active
- raw_excerpt (text)

### Table: `source_runs`
- id (pk)
- source_id
- started_at
- finished_at
- status: `ok|degraded|fail`
- http_errors
- parse_errors
- new_count
- updated_count
- notes

### Optional: `clusters`
- id (pk)
- canonical_listing_id
- created_at
- updated_at
- members_count

---

## 3) Config
`app/config.py` + `.env`
- CITY="Muenchen"
- BRAND_NEW_HOURS=6
- JUST_LISTED_HOURS=2
- NEW_TODAY_HOURS=24
- BUCKET_9000=9000
- BUCKET_12000=12000
- SCORE_WINDOW_DAYS=14
- SCORE_TOP_DEAL=85
- SCORE_ULTRA=92
- MAX_LISTINGS_RETURN=2000
- SUSPICIOUS_PPSM_LOW=2000
- SUSPICIOUS_SQM_LOW=20
- PRICE_DROP_THRESHOLD=0.05
- APPROVAL_REQUIRED=true

---

## 4) Quellenstrategie: bekannte + weniger bekannte + lokal
### Seed-Liste (Kandidaten; standardmäßig disabled)
**Große Portale**
- ImmobilienScout24 (API bevorzugt; HTML kann blocken)
- Immowelt
- Immonet

**Kleinere / unterschätzte**
- Kleinanzeigen (Immobilien)
- Ohne-Makler
- Wohnungsboerse
- lokale/bayerische Kleinportale (Discovery findet die)

**Zeitungs-/Regionalportale**
- regionale Immobilienmärkte / Zeitungsportale (nur wenn erlaubt)

**Neubau / Projektentwickler**
- Neubauplattformen (sitemap/rss/jsonld)

**Makler in München**
- Discovery via “Broker Directory List” (statisch + manuell pflegbar)
- bevorzugt: sitemap/rss/jsonld; HTML nur wenn stabil & erlaubt

> Wichtig: OpenClaw darf Quellen **nicht** automatisch aktivieren, sondern nur Source Cards erzeugen.

---

## 5) Source Discovery Engine (Mighty)
Module: `collectors/source_discovery.py`

### Discovery Methoden (safe)
1) **Sitemap Discovery**
   - Versuche: `/sitemap.xml`, `/sitemap_index.xml`, gängige Varianten
   - Parse URLs, erkenne Muster (“wohnung”, “kaufen”, “muenchen”, “expose”, “listing”)
   - Speichere Sample URLs (max 5)

2) **RSS/Atom Discovery**
   - `<link rel="alternate" type="application/rss+xml">`
   - gängige endpoints `/rss`, `/feed`, `/atom`

3) **JSON-LD Discovery**
   - Auf Sample-Seiten JSON-LD Blöcke prüfen:
     - `schema.org/Offer`, `Apartment`, `Residence`, `Place`, `PostalAddress`
   - Wenn vorhanden: `kind=jsonld` und Mapping vorschlagen

4) **Directory / Curated Lists**
   - lokale “Immobilienportale Deutschland” Listen als statische repo-Datei
   - keine aggressive Websuche, nur curated seeds + user additions

5) **Local Broker Finder (minimal)**
   - curated Liste bekannter Münchner Makler + manuelle Erweiterung
   - check: sitemap/rss/jsonld vorhanden?

### Output: Source Card Report (Human approval)
Pfad: `reports/source_cards/<slug>.md`
Inhalt:
- base_url, kind (predicted)
- robots_status (best effort)
- auth_required
- sample urls
- recommended mechanism: `API > RSS > JSON-LD > Sitemap > HTML (last)`
- risk rating: low/medium/high
- suggested rate_limit_seconds
- recommended: approve? yes/no + reasons

---

## 6) Source Validator
Module: `collectors/source_validator.py`
- Prüft nur, wenn `approved && enabled`
- Minimal checks:
  - robots.txt fetch (same domain)
  - 1–2 sample requests
  - erkennt 401/403/captcha patterns → `health_status=blocked`
- schreibt `source_runs` + updates in `sources`

---

## 7) Adapter Generator (Skeleton)
Module: `collectors/adapter_generator.py`

Input: validated source (kind in {api,rss,jsonld,sitemap,html})
Output: erstellt `collectors/sources/<slug>.py` mit:

Interface:
- `fetch_candidates() -> list[Candidate]`
- `fetch_detail(candidate) -> ParsedListing`
- `normalize(parsed) -> ListingModel`
- `self_test() -> TestResult`

Rules:
- JSON-LD parser bevorzugen
- RSS parser bevorzugen
- Sitemap als URL Quelle + Detail fetch
- HTML parser nur “last resort” und robust
- optional `--capture-fixture` speichert fixture für tests

---

## 8) Collector Orchestrator
Module: `collectors/run_collect.py`

Behaviour:
- lädt `enabled sources`
- pro source:
  - `self_test` → ok/degraded/blocked
  - `fetch_candidates`
  - details nur für neue/changed
  - upsert listings
  - write snapshots
- **niemals crashen** wegen einer Quelle
- summary output am Ende (table in console)

CLI Flags:
- `--source <name>`
- `--dry-run`
- `--capture-fixture`
- `--max-detail N`

---

## 9) Normalization
Module: `app/normalize.py`
- parse Preis, m², Zimmer
- compute `price_per_sqm`
- district normalization (mapping + heuristics)
- url canonicalization
- missing fields OK (no crash)

---

## 10) Deal Scoring Engine (Explainable)
Module: `app/scoring.py`

Baseline:
- rolling median €/m² über `SCORE_WINDOW_DAYS`
- district median wenn >= 20 samples sonst citywide

Score:
- `price_advantage = (median - ppsm)/median`
- `score_base = 50 + 50 * clamp(price_advantage / 0.25, -1, 1)`

Bonuses:
- freshness:
  - <= 2h: +10 (JUST_LISTED)
  - <= 6h: +6 (BRAND_NEW)
  - <= 24h: +3 (NEW_TODAY)
- rarity:
  - only 1 source in cluster: +4
  - 3+ sources: -2
- price drop:
  - drop >= 5%: +8 (PRICE_DROP)

Penalties:
- suspicious:
  - sqm < 20 OR ppsm < 2000 OR scam keywords → -20 + badge CHECK

Badges:
- UNDER_9000, UNDER_12000
- JUST_LISTED, BRAND_NEW, NEW_TODAY
- TOP_DEAL (>=85), ULTRA_DEAL (>=92)
- PRICE_DROP, CHECK, MULTI_SOURCE

Explainability:
- store JSON: `{median_used, price_advantage, bonuses, penalties, final}`

---

## 11) Dedup / Clustering (Multi-Source)
Module: `app/dedup.py`
- signature: normalized_address + rounded sqm + rounded price
- fallback: title tokens + district + sqm + price
- fuzzy threshold (rapidfuzz >= 85)
- set `cluster_id`, choose canonical listing (newest active + most complete)

UI:
- “Seen on: …” list of sources

---

## 12) AI Deal Analyzer (neu hinzufügen)
Module: `app/ai_deal_analyzer.py`

### Ziel
Erweitert Score um **qualitative Bewertung**, erkennt “zu gut um wahr zu sein”, Renovierungsindikatoren, Lage-Proxy, und gibt **explainable Flags** aus.

### Input
- title, (optional) description (falls legal verfügbar), district, price, sqm, rooms, source reliability, price history, completeness score

### Output (nur Flags + heuristische Scores; keine Blackbox)
- `ai_quality_score` (0..100, optional)
- `ai_flags`: list of strings
- `ai_explain`: JSON (rules fired)

### Heuristik-Regeln (Startset)
**A) “Deal Quality”**
- + if keywords: “saniert”, “renoviert”, “erstbezug”, “aufzug”, “balkon”, “tg”, “ruhig”, “hell”
- - if keywords: “sanierungsbedürftig”, “erbbaurecht”, “teileigentum”, “zwangsversteigerung” (nicht automatisch schlecht, aber warnen)
- - if missing key fields (sqm, price) → completeness penalty

**B) “Scam / Risk Flags”**
- ppsm extrem unter district median (z. B. >40% unter median) → `FLAG_TOO_CHEAP`
- title contains: “sofort zuschlagen”, “nur heute”, “whatsapp” → `FLAG_MARKETING_SPAM`
- no address + too cheap + new source → `FLAG_LOW_TRUST`

**C) “Renovation Indicator”**
- if “sanierungsbedürftig” etc. → `FLAG_RENOVATION`
- if “kernsanierung” → stronger flag

**D) “Liquidity / Competition Proxy”**
- if source shows multi-source duplicates quickly (cluster in 3 sources within 24h) → `FLAG_HIGH_COMPETITION`
- if only in 1 source and great score → `FLAG_EXCLUSIVE`

**E) “Explain Score”**
- Provide a combined explanation panel:
  - statistical score (median-based)
  - AI flags (rules)
  - source reliability

### Optional: Local LLM Hook (keine Pflicht)
- If user config provides local model endpoint, analyze descriptions for feature extraction.
- MUST remain optional and local-only; fallback to rules.

### Integration
- ai flags do NOT override compliance; only annotate.
- final “deal_score” can incorporate a small bounded AI modifier (±5) if desired, always explainable.

---

## 13) Source Reliability Score
Module: `app/source_reliability.py`
- Compute per source last 30 runs:
  - success rate
  - avg parse errors
  - blocked occurrences
- Expose `reliability_score` (0..100)
- UI shows reliability badge next to source

---

## 14) API (FastAPI)
- `GET /api/listings`
  - bucket=9000|12000|all|unknown
  - brand_new=true|false
  - just_listed=true|false
  - min_score=0..100
  - district=...
  - source=...
  - active_only=true|false
  - sort=newest|score|ppsm|price
  - limit, offset
- `GET /api/listings/{id}`
- `GET /api/stats?days=7|30`
- `GET /api/sources`
- `GET /api/clusters`
- `POST /api/collect/run` (local only)

---

## 15) UI (shadcn/ui) — Seiten + Styling Vorgaben (präzise)
Stack:
- Next.js 14 (App Router)
- Tailwind
- shadcn/ui
- TanStack Table (+ optional tanstack/virtual)
- Recharts
- lucide-react
- next-themes (Dark Mode)
- react-query oder SWR (Data fetching)

### 15.1 App Struktur
```

ui/
app/
layout.tsx
page.tsx                      # Dashboard
deals/page.tsx
brand-new/page.tsx
price-drops/page.tsx
clusters/page.tsx
sources/page.tsx
settings/page.tsx
components/
layout/
sidebar.tsx
topbar.tsx
listings/
listing-table.tsx
listing-drawer.tsx
filters.tsx
badges.tsx
score-explain.tsx
cards/
stats-cards.tsx
deal-card.tsx
source-health-card.tsx
charts/
listings-per-day.tsx
median-ppsm.tsx
score-distribution.tsx
lib/
api.ts
format.ts
utils.ts

```

### 15.2 Global Layout (Design)
- Sidebar links (lucide icons):
  - Dashboard (/)
  - Deal Radar (/deals)
  - Brand New (/brand-new)
  - Price Drops (/price-drops)
  - Clusters (/clusters)
  - Sources (/sources)
  - Settings (/settings)
- Topbar:
  - Search input (title/district)
  - Refresh button
  - Theme toggle (light/dark/system)
  - “Last updated: X min ago”

**Styling**
- Container max width: `max-w-[1400px]`
- Page padding: `px-6 py-6` desktop, `px-4 py-4` mobile
- Cards: `rounded-2xl`, `shadow-sm`, `border`
- Typography:
  - Page title: `text-2xl font-semibold tracking-tight`
  - Section title: `text-lg font-semibold`
  - Table text: `text-sm`

### 15.3 Dashboard (/)
Layout:
1) KPI Cards row (4 cards)
2) Filters panel (left) + Table (right) in responsive grid
3) Charts row (optional): listings/day + median €/m²

**KPI Cards**
- New today
- New last 7d
- Median €/m² (7d)
- Top deals (score>=85)

Components: `Card`, `CardHeader`, `CardContent`

### 15.4 Filters
Controls:
- Bucket select: All / <=9000 / <=12000 / Unknown
- Score slider (min_score)
- Toggles: Just Listed, Brand New, Active only
- Multi-select: Districts, Sources
- Range: Price min/max, sqm min/max, rooms min/max
- Sort select: newest (default), score, ppsm, price

**Styling**
- Filters in `Card` sticky on desktop:
  - `lg:sticky lg:top-6`
- Inputs full width, comfortable spacing:
  - `space-y-4`

### 15.5 Listings Table
Columns:
- Badges
- Title (click opens Drawer)
- District
- Rooms
- Size
- Price
- €/m²
- Score
- Source
- First Seen

Badges:
- 🔥 JUST LISTED (<=2h)
- 🟢 BRAND NEW (<=6h)
- ⭐ TOP DEAL (>=85)
- 💎 ULTRA (>=92)
- ⬇ PRICE DROP
- ⚠ CHECK (suspicious)
- 🧩 MULTI_SOURCE (cluster)

Row highlighting:
- score>=92: subtle glow (no neon): `bg-muted/60` + left border `border-l-4`
- score>=85: `bg-muted/30`
- CHECK: `bg-destructive/5` + badge red outline

Table performance:
- If >1000 rows: enable virtualization (tanstack/virtual)

### 15.6 Listing Drawer (Side panel)
Triggered by row click.
Content:
- Title + badges
- Key facts grid (price, sqm, €/m², rooms, district, source)
- Buttons:
  - Open listing (new tab)
  - Save to Watchlist
- Score Explain accordion:
  - median used
  - bonuses/penalties
  - AI flags + explanation
- Price history mini-chart (if snapshots exist)
- “Seen on” sources list (cluster members)

shadcn components:
- `Sheet`, `Accordion`, `Badge`, `Button`, `Separator`

### 15.7 Deal Radar (/deals)
- Query: `min_score=85`
- Layout: grid of `DealCard` (2–3 columns desktop)
DealCard shows:
- score badge large
- district, sqm, €/m²
- top badges
- primary CTA “Open”
- secondary “Details”

### 15.8 Brand New (/brand-new)
- Query: brand_new=true
- Timeline style list:
  - group by “minutes ago”, “hours ago”
  - compact cards

### 15.9 Price Drops (/price-drops)
- Filter: PRICE_DROP badge
- Show old vs new price in card, drop % prominently

### 15.10 Sources (/sources)
- SourceHealthCard grid:
  - Health badge (healthy/degraded/blocked/disabled)
  - reliability score
  - last run
  - avg listings
  - error rate
  - “Why blocked?” details
- Actions (local only):
  - Enable/Disable (only if approved)
  - Run self-test

### 15.11 Clusters (/clusters)
- List clusters with canonical listing + members
- Member list shows sources + links
- Optional: “merge” / “split” manual override (local)

### 15.12 Settings (/settings)
- Threshold sliders:
  - BRAND_NEW_HOURS, JUST_LISTED_HOURS
  - PRICE_DROP_THRESHOLD
  - SCORE_TOP_DEAL, SCORE_ULTRA
- Watchlist rules (see below)
- Toggle: “AI Deal Analyzer modifier on/off”

---

## 16) Watchlist + Rules (local)
Tables:
- `watchlist(listing_id, created_at, notes)`
- `alert_rules(id, name, district[], max_price, min_sqm, min_score, bucket, enabled)`

UI:
- Save listing to watchlist
- Alert rules builder form
- Banner “X new matches since last refresh”

---

## 17) Testing
- fixtures per source (search + detail) saved via `--capture-fixture`
- unit tests:
  - scoring: medians, bonuses, clamp
  - ai analyzer: keyword rules, suspicious triggers
  - dedup: fuzzy match thresholds
- integration smoke:
  - collector dry-run on fixtures
  - api endpoints respond

Quality gates:
- `pytest -q` passes
- `run_collect` exit code 0 even if sources blocked
- UI loads <2s for 500 listings (virtualize for >1000)

---

## 18) Runbook (Local)
1) venv:
   - `source .venv/bin/activate`
2) deps:
   - `pip install -r requirements.txt`
3) collect:
   - `python -m collectors.run_collect`
4) api:
   - `python -m uvicorn app.main:app --reload --port 8001`
5) ui:
   - `cd ui && npm install && npm run dev` (port 3000)
6) open:
   - API: `http://127.0.0.1:8001/docs`
   - UI:  `http://127.0.0.1:3000`

---

# ACP PLANNER AGENT — Backlog (stundenlang, geordnet)
## Phase 1: Stabilität + Daten
1) [DONE] DB migrations + new tables/columns
2) [DONE] collector robust (no crash), source_runs logging
3) [DONE] snapshots + price drops
4) [DONE] scoring + badges + explainability
5) [DONE] sources endpoint + health logic

## Phase 2: Multi-source + Discovery
6) [DONE] source discovery engine + source cards reports
7) [DONE] validator + approval/enabling flow
8) [DONE] adapter generator skeleton
9) [PARTIAL DONE] 3–5 erste approved sources integrieren (API/RSS/JSON-LD bevorzugt) — seed collectors vorhanden, produktive Aktivierung bleibt manuell (approval-gated)

## Phase 3: Dedup + Intelligence
10) [DONE] clustering + “Seen on …”
11) [DONE] source reliability scoring
12) [DONE] AI Deal Analyzer + explain panel
13) [DONE] watchlist + alert rules

## Phase 4: shadcn UI polish
14) [DONE] Next.js app structure + global layout
15) [DONE] dashboard page + filters + table + drawer
16) [DONE] pages: deals, brand-new, price-drops, clusters, sources, settings
17) [DONE] charts + exports + virtualization
18) [DONE] final UX passes (spacing, typography, dark mode)

---

# ACP ANTIGRAVITY AGENT — Implementation Plan
- Keep local SQLite `local.db`
- Never attempt bypass of blocked sources; treat as blocked
- Prefer API/RSS/JSON-LD/sitemap sources
- UI: Next.js + shadcn + Tailwind; data via API
- Add caching on API for heavy queries; server-side filtering & pagination

---

# ACP BUILDER AGENT — Deliverables Checklist
- [DONE] `collectors/source_discovery.py` + source cards generation
- [DONE] `collectors/source_validator.py`
- [DONE] `collectors/adapter_generator.py`
- [DONE] `collectors/run_collect.py` hardened
- [DONE] `app/scoring.py`, `app/ai_deal_analyzer.py`, `app/dedup.py`, `app/source_reliability.py`
- [DONE] FastAPI endpoints `/api/*`
- [DONE] UI Next.js app with pages/components per spec
- [DONE] tests + fixtures tooling
- [DONE] README local run + troubleshooting

---

# ACP REVIEWER AGENT — Acceptance Criteria
- Collector runs end-to-end without crashing on blocked sources
- Sources Monitor shows correct health + reasons
- Listings have score + badges (or null with explain why)
- Brand New / Just Listed logic correct
- Dedup clusters visible with “Seen on”
- AI flags explainable and non-destructive
- UI meets shadcn styling guidelines & feels polished
- Performance acceptable (virtualization when needed)
```
