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


--------------------------------------------------
next one

Continue development and implement the next features in this exact order.

Goal:
Turn the local Munich Deal Engine into a stronger real estate intelligence tool with better scanning, better detail views, better investment analysis, duplicate detection, and an off-market detector.

Important rule:
- UI must stay responsive

IMPLEMENT THESE FEATURES IN THIS ORDER

1. Scan Sources Button
2. Listing Detail Drawer
3. Investment Score and Yield Estimation
4. Duplicate Detection Across Sources
5. Deal Highlighting
6. Off-Market Detector

--------------------------------------------------
FEATURE 1: SCAN SOURCES BUTTON
--------------------------------------------------

Add a button to the top bar of the GUI.

Label:
Scan Sources

Placement:
Next to the existing Refresh button

Behavior:
- when the user clicks the button, the frontend calls a backend endpoint
- the backend starts a local background scan
- only approved and enabled sources are scanned
- the UI must show progress while scanning
- after the scan finishes, refresh the dashboard data automatically

Backend requirements:
Add endpoints:
- POST /api/scan/run
- GET /api/scan/status

Scan status should include:
- running true or false
- started_at
- current_source
- completed_sources
- total_sources
- new_listings_count
- updated_count
- error_count

Rules:
- only one scan can run at a time
- if a scan is already running, return its current status
- scanning must not freeze the UI
- run the scan in a background task or worker thread/process

Frontend requirements:
Button states:
- idle: Scan Sources
- running: Scanning...
- done: Scan Complete
- error: Scan Failed

Also show a small progress area:
- current source
- completed / total
- new listings found
- errors

Add a success toast when the scan is complete.

Definition of done:
- clicking the button starts a local scan
- progress is visible in the UI
- new listings are stored in the database
- dashboard refreshes after scan completion

--------------------------------------------------
FEATURE 2: LISTING DETAIL DRAWER
--------------------------------------------------

Make every listing clickable.

When a user clicks a listing:
- open a side drawer or sheet
- show complete listing details

Drawer contents:
- title
- source
- link to original listing
- district
- address if available
- postal code if available
- rooms
- size
- price
- price per sqm
- score
- badges
- first_seen_at
- posted_at if available

Also include these sections:

A. Score Explanation
Show:
- district median used
- listing price per sqm
- freshness bonus
- investment bonus
- suspicious penalty
- final score

B. Source Information
Show:
- source name
- source reliability if available
- cluster members if duplicate detection exists

C. Price History
If snapshots exist:
- show simple mini chart
- show old price and current price
- show price drop badge if relevant

D. Investment Section
Show:
- estimated rent
- gross yield
- price to rent ratio
- investment score
- investment explanation

E. Off-Market Section
Show:
- off-market score
- exclusivity score
- why this listing may be special

Definition of done:
- clicking a listing opens the drawer
- data is readable and structured
- score and investment explanation are visible
- drawer improves usability significantly

--------------------------------------------------
FEATURE 3: INVESTMENT SCORE AND YIELD ESTIMATION
--------------------------------------------------

Add an investment analysis layer.

Create these derived fields:
- estimated_rent_per_sqm
- estimated_monthly_rent
- gross_yield_percent
- price_to_rent_ratio
- investment_score
- investment_explain

Estimation strategy:
- start with district-level rent benchmark
- if district benchmark is missing, use city-level fallback
- clearly label everything as estimate

Suggested formulas:
estimated_monthly_rent =
area_sqm * estimated_rent_per_sqm

gross_yield_percent =
(estimated_monthly_rent * 12) / price_eur * 100

price_to_rent_ratio =
price_eur / (estimated_monthly_rent * 12)

Investment score should consider:
- gross yield
- price per sqm vs district median
- data completeness
- source reliability
- freshness
- suspiciousness penalty

Store:
- investment_score
- investment_explain JSON or text

UI requirements:
- show investment score in listing drawer
- optionally add investment score as a sortable field later
- optionally create a future Investments page

Definition of done:
- listings receive investment metrics where possible
- calculations do not break if data is incomplete
- investment score is visible in the detail view

--------------------------------------------------
FEATURE 4: DUPLICATE DETECTION ACROSS SOURCES
--------------------------------------------------

Implement duplicate detection and clustering.

Goal:
Detect when the same property appears on multiple portals.

Create a centralized dedup pipeline after collection.

Matching logic:
Use combinations of:
- normalized address
- district
- rounded size
- rounded price
- title similarity
- postal code if available

If no address exists:
- use title similarity + district + price + size

Create:
- cluster_id
- canonical listing
- cluster members list

Show in the UI:
Seen on:
- Source A
- Source B
- Source C

Benefits:
- prevents misleading duplicate deals
- helps identify exclusive listings
- supports Off-Market Detector

Rules:
- do not remove duplicates from raw data
- keep source-level records
- use cluster view in UI for merged intelligence

Definition of done:
- duplicate listings are grouped
- listing drawer shows cluster members
- clusters page becomes more useful

--------------------------------------------------
FEATURE 5: DEAL HIGHLIGHTING
--------------------------------------------------

Improve visual deal visibility.

Add badges:
- TOP DEAL for score >= 85
- ULTRA DEAL for score >= 95
- BRAND NEW for first_seen <= 6 hours
- JUST LISTED for first_seen <= 2 hours
- PRICE DROP if price fell more than threshold
- CHECK if suspicious
- OFF MARKET if off-market score is high

UI rules:
- highlight strong deals with subtle background or left border
- ULTRA DEAL should stand out visually
- do not overuse aggressive colors
- keep design clean and premium

Deal Radar improvements:
- stronger card hierarchy
- better spacing
- better badge visibility
- optional sorting by score, investment score, or off-market score

Definition of done:
- top deals are immediately visible
- score 100 cards do not all look identical
- best listings are visually prioritized

--------------------------------------------------
FEATURE 6: OFF-MARKET DETECTOR
--------------------------------------------------

Build an Off-Market Detector.

Goal:
Find listings that are likely to be underexposed, less competitive, or only available on smaller / less common sources.

This does not mean true legal off-market listings.
It means:
- low visibility listings
- exclusive-looking listings
- listings not widely distributed
- listings that may have less buyer competition

Create these new derived fields:
- off_market_score
- off_market_flags
- off_market_explain
- exclusivity_score
- source_popularity_score

Off-Market Detector logic should consider:

1. Number of sources in cluster
- if listing appears in only one source, increase exclusivity
- if listing appears in many sources, reduce exclusivity

2. Source popularity
- if listing is only on a smaller or niche source, increase off-market score
- if listing is on all major sources, reduce off-market score

3. Freshness
- if newly uploaded and only seen once so far, increase off-market potential

4. Duplicate spread speed
- if a listing quickly spreads across many portals, reduce exclusivity
- if it remains isolated, increase exclusivity

5. Listing completeness and trust
- missing fields should lower confidence
- suspicious listings should not become top off-market opportunities
- apply CHECK penalty where needed

6. Deal quality
- if price per sqm is attractive and listing is low visibility, raise off-market score more strongly

Suggested outputs:
- OFF_MARKET
- EXCLUSIVE
- LOW_VISIBILITY
- SMALL_SOURCE_ONLY
- CHECK_CONFIDENCE

Suggested score components:
off_market_score based on:
- exclusivity score
- source popularity score
- freshness
- deal score
- suspiciousness penalty

Example heuristics:
- only 1 source in cluster: +25
- source is niche / lower popularity: +20
- first_seen <= 12h: +10
- strong deal score >= 85: +15
- suspicious listing: -20
- multi-source cluster >= 3: -25

Create a new page:
/off-market

Page contents:
- top off-market candidates
- sortable by off_market_score
- filters:
  - score
  - source
  - district
  - price range
  - size range
  - freshness

Each off-market card should show:
- title
- district
- size
- price
- price per sqm
- deal score
- off-market score
- source
- why it may be exclusive

In the listing drawer, add:
Off-Market Analysis
- exclusivity score
- source popularity
- number of matching sources
- why this may be underexposed

Definition of done:
- listings get off_market_score
- a new Off-Market page exists
- exclusive listings are surfaced
- suspicious listings are not incorrectly treated as top off-market opportunities

--------------------------------------------------
ARCHITECTURE REQUIREMENTS
--------------------------------------------------

Keep architecture clean.

Recommended pipeline:
collectors
↓
normalized listings
↓
snapshots
↓
dedup / clustering
↓
location enrichment
↓
rent benchmark enrichment
↓
deal scoring
↓
investment scoring
↓
off-market scoring
↓
api
↓
dashboard

Rules:
- collectors should only collect and normalize data
- expensive scoring and enrichment should happen after collection
- dashboard must only read from database
- no scraping inside frontend

--------------------------------------------------
NEW API ENDPOINTS TO CONSIDER
--------------------------------------------------

Add or extend endpoints:

- POST /api/scan/run
- GET /api/scan/status
- GET /api/listings/{id}
- GET /api/clusters
- GET /api/off-market
- GET /api/investments

--------------------------------------------------
NEW PAGES TO ADD OR IMPROVE
--------------------------------------------------

Improve or add:
- /deals
- /brand-new
- /price-drops
- /clusters
- /sources
- /off-market
- /market
- optional later: /investments

--------------------------------------------------
TESTING REQUIREMENTS
--------------------------------------------------

Add tests for:
- manual scan endpoint
- scan lock so only one scan runs at a time
- scan status updates
- investment score calculations
- duplicate detection
- off-market score logic
- listing detail drawer loading
- UI state for scan button

--------------------------------------------------
DEFINITION OF DONE FOR THE FULL TASK
--------------------------------------------------

This full task is complete when:

1. There is a working Scan Sources button in the GUI
2. Clicking it runs a local background scan and updates the DB
3. Listings can be opened in a detail drawer
4. Investment metrics are calculated and shown
5. Duplicate listings are clustered across sources
6. Deal highlighting is visually improved
7. There is a new Off-Market page
8. Off-market scoring surfaces low-visibility opportunities
9. The system remains local-only, responsive, and compliant
