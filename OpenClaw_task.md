# OpenClaw Task Tracker

## Instructions for OpenClaw
- Always read this file before starting work.
- Always select the next unfinished task from this file first.
- Do not skip unfinished tasks unless they are blocked.
- When a task is completed, mark it as done.
- If a task is blocked, mark it as blocked and explain why.
- If new bugs, missing features, or improvements are discovered, add them to this file.
- Keep tasks small, clear, and actionable.

---

## Task Status Legend
- [ ] Not started
- [x] Completed
- [~] In progress
- [!] Blocked

---

## Current Priority Tasks

### Task: Add role and license fields to User model
Status: [x]
Priority: High
Type: Feature
Description:
- Add `role` (`VARCHAR(16)`, default `"free"`) and `license_until` (`DATETIME`, nullable) to the `users` table.
- Add `effective_role` property to the `User` model that auto-downgrades expired PRO licenses to `free`.
- Run a lightweight startup migration for existing SQLite/Postgres DBs via `ensure_schema()`.

Acceptance Criteria:
- `users` table has `role` and `license_until` columns after startup
- `effective_role` returns `admin`, `pro`, or `free` correctly
- Existing admin user gets `role = "admin"` automatically
- No existing functionality broken

### Task: Add require_role() FastAPI dependency
Status: [x]
Priority: High
Type: Feature
Description:
- Add reusable `get_current_user()` and `require_role(*roles)` helpers to `app/auth.py`.
- Read authenticated user from `X-Auth-User` header forwarded by Next.js.

Acceptance Criteria:
- `require_role("admin")` blocks non-admins with 403
- `require_role("admin", "pro")` allows both roles
- Unauthenticated requests return 401
- `get_current_user()` is reusable across protected endpoints

### Task: Protect existing API endpoints with role checks
Status: [ ]
Priority: High
Type: Feature
Description:
- Apply role checks to scan/source-management/admin endpoints.
- Limit free users on listings and block premium-only routes.

Acceptance Criteria:
- Free users see max 20 listings
- Free users get 403 on premium/protected endpoints like `/api/off-market` and geo premium routes
- Admin-only routes reject non-admin users

### Task: Add per-user watchlist for multi-user accounts
Status: [ ]
Priority: High
Type: Feature
Description:
- Extend watchlist entries with `user_id` so each authenticated user has an isolated watchlist.
- Remove global uniqueness on `listing_id`.

Acceptance Criteria:
- Different users can save the same listing independently
- Each user sees only their own watchlist
- Existing rows remain compatible during migration

### Task: Forward authenticated username through Next.js proxy routes
Status: [x]
Priority: High
Type: Feature
Description:
- Forward the authenticated username to backend routes using `X-Auth-User` after cookie validation.
- Update `/api/auth/me` and relevant Next.js API proxy routes.

Acceptance Criteria:
- Backend can resolve current user from proxied requests
- No username spoofing via raw browser calls to protected frontend routes

### Task: Add admin UI for managing users and roles
Status: [ ]
Priority: High
Type: Feature
Description:
- Build an admin-facing UI to create users, view users, and manage `free` / `pro` / `admin` roles and license expiry.

Acceptance Criteria:
- Admin can create new users with username/password
- Admin can change user role and `license_until`
- Non-admin users cannot access the admin UI

### Task: Verify multi-user role system end-to-end
Status: [ ]
Priority: High
Type: Feature
Description:
- Validate login, role gating, watchlist isolation, and license expiration behavior end-to-end.

Acceptance Criteria:
- Admin/pro/free behavior matches requirements
- Expired pro licenses downgrade to free behavior automatically
- No obvious regressions in auth or existing UI flows

### Core Features
- [~] Build or improve property listing page
- [ ] Build or improve property detail page
- [ ] 

### Bug Fixes
- [ ] Identify and fix UI bugs
- [ ] Identify and fix API or data loading issues
- [~] Fix mobile responsiveness issues
- [~] Fix broken navigation or routing problems

### Code Quality
- [ ] Refactor duplicated code
- [ ] Improve component structure
- [ ] Improve error handling
- [ ] Improve loading states
- [ ] Improve form validation
- [ ] Clean up unused code

### Performance
- [ ] Improve page load speed
- [ ] Optimize images and assets
- [ ] Reduce unnecessary API calls
- [ ] Improve rendering performance

### UX Improvements
- [x] Improve homepage layout
- [~] Improve search experience
- [ ] Improve listing card design
- [ ] Improve detail page usability
- [ ] Improve empty states and feedback messages

### Future Ideas
- [ ] Add favorites or saved properties

## In Progress / Next
- [x] Verify Kleinanzeigen scan quality after next live scan run (price coverage + district extraction on fresh data)
- [x] Add one-click "Run source now" action on Sources page for `kleinanzeigen` with status feedback
- [x] alle aktiven Quellen prüfen
- [x] schauen, wo Datenqualität schlecht ist:
- [x] fehlende Preise
- [x] fehlende Fläche/Zimmer
- [x] falsche Districts
- [x] kaputte/rauscharme Listings
- [x] schwache Coverage
- [x] dann die Top 3 Probleme priorisieren
- [x] und wieder sauber über:
- [x] eigenen Branch
- [x] Fix
- [x] Merge in main
- [x] GitHub sync

---

## Task Format

Use this format for every task:

### Task: <short task title>
Status: [ ] / [x] / [~] / [!]
Priority: High / Medium / Low
Type: Feature / Fix / Refactor / Improvement
Description:
- Clear explanation of what should be done

Acceptance Criteria:
- Specific result 1
- Specific result 2
- Specific result 3

Notes:
- Optional implementation notes, dependencies, or blockers

---

## Example Task

### Task: Add property price filter
Status: [x]
Priority: High
Type: Feature
Description:
- Add a filter that allows users to filter property listings by minimum and maximum price.

Acceptance Criteria:
- User can enter or select min price
- User can enter or select max price
- Listings update correctly based on selected range
- Filter works on desktop and mobile

Notes:
- Reuse existing filter UI if available
- Bereits umgesetzt im Dashboard via `price_min` / `price_max` Filter mit UI-Feldern und API-Unterstützung.

---


- [x] Top-3 priorisiert: 1) Kleinanzeigen Preis/Zimmer-Coverage, 2) SIS District/Zimmer, 3) Immowelt generische Titel/District
- [x] Erste Fixes umgesetzt für Immowelt, SIS und Planethome
- [x] Kleinanzeigen Preis-Coverage auf frischen Listings verbessern
- [x] Broker_riedel / Engel-Völkers District-Extraktion prüfen und ggf. verbessern

## Discovered Issues / New Tasks
- [x] Improve Kleinanzeigen price coverage on fresh listings (fresh live rerun on 2026-03-13 now keeps active Kleinanzeigen rows at 45/45 with `price_eur`)
- [ ] Improve district extraction coverage on live broker_riedel / broker_engel_voelkers_muenchen listings (live rerun on 2026-03-13 still leaves many rows on fallback district `München`)

---

## Completed Tasks
- Move completed tasks here if the file becomes too long

- [x] Re-run fresh source scans to verify improved Kleinanzeigen price coverage on live data

- [x] Recreate landing page from ZIP and connect auth flow to dashboard
- [x] Protect dashboard routes behind login modal flow

- [x] Polish landing page visual fidelity, login modal, auth signing, and mobile animation behavior
- [x] Investigate Next.js `next start` runtime issue: production start works when run after a fresh build in the same shell/session

- [ ] Refine landing page motion/pixel polish further if needed

- [x] Polish landing page login flow and verify dashboard data freshness

- [x] Improve logout/session UX for protected dashboard flow

- [x] Add /impressum, /privacy and /contact public pages
- [x] Add contact sales form connected to backend
- [x] Fix production dashboard data loading after login by keeping backend on stable internal service
- [x] Remove demo credential autofill and demo hint from login modal
- [x] Add /account page
- [x] Add forgot/reset password flow
- [x] Add onboarding after first login
- [x] Polish dashboard SaaS UX with responsive shell, loading, empty and error states
- [x] Improve deals, watchlist and settings states and UX consistency
- [x] Replace local password reset with backend user/password management
- [x] Add legal contact data endpoint and real legal page structure
- [x] Make contact-sales flow production-ready with persisted leads and admin overview
- [x] Add basic login/form rate limiting and tighten auth cookie handling
- [x] Add mobile filter bottom sheet for iPhone-first dashboard UX
- [x] Add mobile listing card view alongside desktop table
- [x] Add sticky mobile action bar for filters and refresh
- [x] Improve landing page and dashboard spacing/scrolling for mobile devices
- [x] Add premium mobile dashboard IA with sticky actions and bottom-sheet filters
- [x] Add Apple-style landing motion with smooth reveal and subtle parallax
- [x] Add iOS-style bottom tab bar and segmented KPI controls on mobile
- [x] Extend landing page with stronger premium motion and product-page storytelling
- [x] Redesign listing details drawer into premium structured sections
- [x] Add stronger product-storytelling section to the landing page
- [x] Update homepage rank-copy to separate good chances from bad deals
- [x] Polish details drawer seen-on section into premium cards