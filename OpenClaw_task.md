# OpenClaw Task Tracker

## In Progress / Next
- [ ] Verify Kleinanzeigen scan quality after next live scan run (price coverage + district extraction on fresh data)
- [ ] Add one-click "Run source now" action on Sources page for `kleinanzeigen` with status feedback

## Completed
- [x] Fix Wohnungsboerse metric parsing bug (identical wrong values across listings)
- [x] Filter Kleinanzeigen non-buy/no-price pages from ingestion
- [x] Improve Kleinanzeigen price extraction from listing text (Euro/Kaufpreis patterns)
- [x] Improve Kleinanzeigen district extraction from body text pattern (`in München - <district>`)
