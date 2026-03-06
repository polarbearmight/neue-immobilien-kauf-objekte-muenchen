Extend the project with location intelligence and a manual scan trigger in the GUI.

GOALS

1. Add location intelligence to listings:
- geocoding / district intelligence
- commute and location context
- rent benchmark integration where legally and technically possible
- better deal scoring using location-based signals

2. Add a GUI button:
- "Scan all sources now"
- this triggers a local collection run
- new listings are stored in the database
- the dashboard refreshes after completion

IMPORTANT RULES

- The UI must remain responsive while scanning

LOCATION INTELLIGENCE ARCHITECTURE

Create a new enrichment layer after collection:

collector
↓
normalized listings
↓
location enrichment
↓
rent benchmark enrichment
↓
deal scoring
↓
api
↓
dashboard

NEW MODULES

Create these modules:

app/location_enrichment.py
app/rent_benchmark.py
app/geo_utils.py
app/scan_service.py

LOCATION ENRICHMENT

For each listing, enrich these fields if possible:

- normalized district
- postal code
- latitude
- longitude
- geocode_confidence
- district_score
- centrality_score
- commute proxy
- location_explain

If exact address is missing:
- use district or postal code fallback
- never fail because of missing geodata

COMMUTE / CENTRALITY LOGIC

Implement simple local scoring first.

Examples:
- if district is central Munich -> higher centrality score
- if district is peripheral -> lower centrality score
- if only postal code is known -> estimate from lookup table
- if no exact geocode exists -> set lower confidence

Store:
- centrality_score (0..100)
- geocode_confidence (0..100)

Do not block listings without location data.
Missing data should reduce certainty, not break the pipeline.

DISTRICT INTELLIGENCE

Create a district reference dataset for Munich.

For each district store:
- district name
- typical median €/m²
- centrality band
- optional rent benchmark
- optional popularity score

Use this for:
- deal scoring improvements
- district stats page
- top district charts

RENT BENCHMARK INTEGRATION

Add a rent benchmark layer for investment analysis.

Goal:
Estimate whether a listing could be attractive from a rental perspective.

Store:
- estimated_rent_per_sqm
- estimated_monthly_rent
- gross_yield_estimate
- benchmark_confidence
- rent_explain

Rules:
- If only district-level benchmark exists, use district average
- If better data exists later, make the system pluggable
- Keep this as a heuristic, clearly labeled as estimate

INVESTMENT ENRICHMENT

Add these derived fields:

- estimated_rent_monthly
- gross_yield_percent
- price_to_rent_ratio
- investment_score
- investment_explain

These should appear in the listing detail drawer.

DEAL SCORE IMPROVEMENTS

Update deal scoring to include:
- price per sqm vs district median
- centrality/location score
- rent benchmark / yield signal
- data completeness
- freshness
- price drops
- suspiciousness penalty

Example final scoring components:
- statistical price advantage
- location bonus
- investment bonus
- freshness bonus
- source reliability bonus
- suspicious penalty

Store explainability JSON.

NEW DATABASE FIELDS

Add fields to listings:
- postal_code
- latitude
- longitude
- geocode_confidence
- centrality_score
- district_median_ppsm
- estimated_rent_per_sqm
- estimated_monthly_rent
- gross_yield_percent
- investment_score
- location_explain
- investment_explain

MANUAL SCAN BUTTON

Add a GUI button in the dashboard top bar:

Label:
- "Scan all sources now"

Behaviour:
1. user clicks button
2. frontend calls backend endpoint
3. backend starts a local scan job
4. scan runs in background
5. UI shows progress state
6. when finished, refresh dashboard data

API ENDPOINTS

Add endpoints:

POST /api/scan/run
- starts a local collection run
- returns job id or status

GET /api/scan/status
- returns:
  - running true/false
  - started_at
  - current_source
  - finished_sources
  - new_listings_count
  - updated_count
  - errors

Optional:
GET /api/scan/history
- previous scan runs

SCAN SERVICE

Implement scan orchestration in:
app/scan_service.py

Requirements:
- only one scan at a time
- if a scan is already running, return current status
- run in background so UI stays responsive
- record progress per source
- store scan summary in DB or memory

SCAN BUTTON UI

Top bar button requirements:
- visible near Refresh button
- states:
  - idle: "Scan all sources now"
  - running: "Scanning..."
  - done: "Scan completed"
  - error: "Scan failed"

Add a progress component:
- current source
- sources completed / total
- new listings found
- errors count

Optional:
- toast notification after completion

SOURCES PAGE IMPROVEMENT

Add a secondary action on the Sources page:
- "Test source"
- "Run source now"

Per-source controls:
- enabled / disabled
- last success
- blocked reason
- reliability score

DETAIL DRAWER IMPROVEMENTS

In listing drawer add new sections:
- location intelligence
- estimated rent
- gross yield
- investment score
- map preview placeholder
- score explanation

MAP / GEO UI

Do not make this dependent on external live maps at first.

Start with:
- district label
- postal code
- centrality score
- coordinate display if available

Optional later:
- static local map preview
- district-based visual heatmap

NEW PAGES

Add or improve these pages:

/market
- district trends
- median €/m² over time
- yield estimates by district

/deals
- top deals only
- sortable by deal score or investment score

/brand-new
- just listed and brand new

/investments
- best gross yield candidates
- strongest price-to-rent ratios

PERFORMANCE REQUIREMENTS

The manual scan must not freeze the UI.

Use:
- background task or worker thread/process
- API polling from frontend every few seconds
- cached dashboard queries

SCANNING FLOW

The scan button should trigger this sequence:

manual scan request
↓
backend background scan
↓
run enabled source collectors
↓
upsert listings
↓
snapshots
↓
location enrichment
↓
rent benchmark enrichment
↓
dedup
↓
scoring
↓
scan summary saved
↓
frontend refreshes data

TESTING REQUIREMENTS

Add tests for:
- scan endpoint
- single scan lock
- scan status reporting
- location enrichment fallback behavior
- rent benchmark calculation
- investment score calculation
- frontend scan button states

DEFINITION OF DONE

This feature is complete when:

1. There is a working "Scan all sources now" button in the GUI
2. Clicking the button starts a local background scan
3. The UI shows scan progress and completion
4. New listings are inserted into the DB
5. Listings receive location and investment enrichment
6. Score explanation includes location and investment signals
7. The dashboard refreshes after scan completion
8. The system stays local-only and compliant
