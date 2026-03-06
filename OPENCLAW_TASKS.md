Build the scraper architecture so that data collection becomes incremental, cached, and much faster.

Goal:
Do not fetch all listings every run.
Store already seen listings locally in the database.
Only fetch new or changed listings.
The dashboard must only read from the database and never trigger scraping directly.

ARCHITECTURE GOAL

Current problem:
The scraper is too slow because it likely re-fetches too many pages and too many detail pages on every run.

Target architecture:
Scheduler
↓
Collector Orchestrator
↓
Per-source incremental collectors
↓
Database upsert + snapshot storage
↓
Scoring / dedup / enrichment
↓
API
↓
Dashboard

MAIN PRINCIPLES

1. Incremental scraping
Each source collector should only look for new listings, not scrape the whole source every time.

2. Stop early
Search result pages are usually sorted by newest first.
Collectors should stop pagination once already known listings are found.

3. Detail pages only for new or changed listings
Do not fetch detail pages for listings that already exist and have not changed.

4. Store first_seen_at and last_seen_at
Every listing should have:
- first_seen_at
- last_seen_at
- is_active

5. Use unique constraints
Each listing must be uniquely identified by:
- source
- source_listing_id

6. Use snapshots
Store price snapshots so price changes can be tracked without reprocessing everything.

7. Dashboard reads only from DB
The UI must never directly scrape sources.
Scraping and displaying must be separated.

DATABASE CHANGES

Use these tables or extend existing ones.

TABLE listings
Fields:
- id
- source
- source_listing_id
- url
- title
- district
- address
- rooms
- area_sqm
- price_eur
- price_per_sqm
- posted_at
- first_seen_at
- last_seen_at
- is_active
- raw_hash
- cluster_id
- deal_score
- badges
- score_explain

Constraint:
UNIQUE(source, source_listing_id)

Purpose:
- main canonical listing record
- used by API and dashboard

TABLE listing_snapshots
Fields:
- id
- listing_id
- captured_at
- price_eur
- price_per_sqm
- is_active
- raw_excerpt

Purpose:
- track price changes
- allow price drop detection
- avoid recomputing historic changes

TABLE source_runs
Fields:
- id
- source
- started_at
- finished_at
- status
- new_count
- updated_count
- skipped_known_count
- parse_errors
- http_errors
- notes

Purpose:
- source monitoring
- health dashboard
- debugging

TABLE source_state
Fields:
- source
- last_successful_run
- last_scan_page
- last_known_listing_id
- last_etag
- last_modified
- notes

Purpose:
- source-specific incremental state
- caching metadata
- resume support

INCREMENTAL COLLECTION STRATEGY

For each source, implement this algorithm:

Step 1:
Fetch only the first few search result pages.
For example:
- page 1
- page 2
- page 3
Configurable by source.

Step 2:
Parse the listing cards from the search result page.

Step 3:
For each listing card:
- extract source_listing_id
- check whether it already exists in the database

Step 4:
If the listing already exists:
- increment skipped_known_count
- optionally update last_seen_at
- if a stopping threshold is reached, stop pagination early

Stopping rule:
If a page contains mostly known listings, stop scanning deeper pages.

Example stopping rules:
- stop after first page with 80 percent already known listings
or
- stop after 20 consecutive already known listings

This makes the collector fast because new listings are usually near the top.

DETAIL PAGE STRATEGY

Do not fetch detail pages for everything.

Only fetch a detail page when:
- the listing is new
- the listing summary changed
- the raw_hash changed
- a scheduled refresh interval is reached

Example:
If listing exists and summary fields are unchanged, skip detail fetch.

If listing is new:
- fetch detail page
- parse full fields
- upsert listing
- create snapshot

CHANGE DETECTION

Implement raw change detection.

For every listing result card or detail page:
- compute a normalized hash
- save it in raw_hash

If the hash is unchanged:
- skip expensive parsing
- just update last_seen_at

This prevents repeated work.

HTTP CACHING

Implement per-source HTTP caching support where possible.

Use:
- ETag
- If-Modified-Since
- Last-Modified

Store this in source_state.

If the server returns 304 Not Modified:
- skip parsing
- continue

Even if not all sources support this, build the abstraction.

SOURCE ADAPTER INTERFACE

Each source adapter should implement:

- fetch_search_page(page_number)
- parse_search_results(html)
- fetch_detail(url)
- parse_detail(html)
- normalize_listing(parsed)
- self_test()

All collectors must follow the same contract.

ORCHESTRATOR

Create a central run_collect orchestrator.

Responsibilities:
- iterate over enabled sources
- run each source collector independently
- catch errors per source
- never crash the whole run because one source fails
- write source_runs records
- run scoring and dedup after collection

Flow:
1. start source run
2. collect search pages
3. stop early if known listings found
4. fetch details only for new or changed listings
5. upsert records
6. create snapshots if needed
7. update source health
8. continue with next source

UPSERT LOGIC

When a listing is found:
- if not in DB:
  - insert listing
  - set first_seen_at = now
  - set last_seen_at = now
  - is_active = true
  - create snapshot
- if already in DB:
  - update last_seen_at = now
  - update changed fields if necessary
  - if price changed:
    - create snapshot
  - keep first_seen_at unchanged

INACTIVE LISTINGS

Implement disappearing listing handling.

If a listing has not been seen for N runs or N days:
- set is_active = false

This allows the dashboard to separate active and inactive listings.

PARALLELIZATION

Improve speed with controlled concurrency.

Use async HTTP clients where possible.
Run source collectors concurrently with a small concurrency limit.

Example:
- run 3 to 5 sources in parallel
- per source, detail pages can be fetched with a semaphore
- do not overload any source

Important:
Concurrency must be rate-limited and configurable per source.

ASYNC PATTERN

Use:
- httpx.AsyncClient
- asyncio.gather
- asyncio.Semaphore

Do not use unbounded parallelism.

Example design:
- one orchestrator task per source
- each source uses its own semaphore
- detail page fetches are limited

PERFORMANCE RULES

1. Search pages are cheap, detail pages are expensive
Optimize detail page fetching first.

2. Prefer structured data
If a source exposes JSON-LD or embedded JSON on result pages, parse that instead of loading detail pages.

3. Parse only what is needed
Do not store massive raw HTML unless needed for fixtures or debugging.

4. Add indexes
Use DB indexes for:
- source + source_listing_id
- first_seen_at
- last_seen_at
- is_active
- price_per_sqm
- district

SCORING PIPELINE

Do not calculate score during every small parsing step.

Use a separate enrichment step:
1. collect/update listings
2. run dedup
3. run deal scoring
4. run AI analyzer
5. update cached scoring fields

This keeps collectors simpler and faster.

DEDUP PIPELINE

After collection:
- cluster similar listings across sources
- update cluster_id
- preserve canonical listing

Do not do expensive dedup matching inside every source adapter.
Keep dedup centralized.

API DESIGN

The API should read only from the database.

Endpoints:
- /api/listings
- /api/stats
- /api/sources
- /api/clusters

The API must not trigger source scraping.

DASHBOARD DESIGN RULE

The dashboard must be a pure read layer:
- fast
- local
- DB-driven

When user opens the dashboard:
- it shows current DB state
- it does not wait for scraping

OPTIONAL FAST MODES

Implement these optional optimizations:

1. Fast summary mode
Only collect summary fields from result cards first.
Fetch details later in background for new listings.

2. Deferred enrichment mode
New listings appear quickly in the dashboard with minimal fields.
Additional details, score, and AI analysis are filled in after.

3. Replay mode
Allow UI testing from DB without re-running collectors.

SOURCE PRIORITY STRATEGY

Define source tiers:
- Tier 1: most useful / stable sources
- Tier 2: medium-value sources
- Tier 3: slow / low-yield sources

Run schedule:
- Tier 1 every 30 minutes
- Tier 2 every 60 minutes
- Tier 3 every 120 minutes

This makes the system much faster overall.

TESTING REQUIREMENTS

Add tests for:
- upsert logic
- stop-early pagination logic
- price change snapshot creation
- inactive listing handling
- source adapter parsing using fixtures
- orchestrator resilience when one source fails

Add fixture-based parsing tests:
tests/fixtures/<source>/
- search page html
- detail page html
- optional json samples

DEFINITION OF DONE

The new architecture is complete when:

1. Existing listings are stored and reused
2. Repeated runs fetch only new or changed listings
3. Collectors stop early when known listings are encountered
4. Detail pages are fetched only for new or changed listings
5. Price changes create snapshots
6. API and dashboard read only from DB
7. Source runs and source health are logged
8. The system is significantly faster on the second and third run than on the first run

IMPLEMENTATION ORDER

OpenClaw should implement in this order:

1. Add DB fields and indexes
2. Implement upsert logic with UNIQUE(source, source_listing_id)
3. Add source_state table
4. Refactor collectors to use incremental logic
5. Add stop-early pagination
6. Add detail-fetch-only-for-new-items rule
7. Add listing_snapshots
8. Add async HTTP collection with rate-limited concurrency
9. Add source_runs logging
10. Move scoring/dedup to post-collection enrichment
11. Add tests and fixtures
12. Optimize API queries and dashboard loading

FINAL OBJECTIVE

Turn the scraper into an incremental data pipeline:
- first run may be slower
- every later run should be much faster
- dashboard should feel instant because it uses stored local data
