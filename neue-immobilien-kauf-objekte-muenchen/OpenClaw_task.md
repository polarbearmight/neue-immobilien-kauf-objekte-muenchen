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
