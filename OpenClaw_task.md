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
- [ ] Build or improve property listing page
- [ ] Build or improve property detail page
- [ ] 

### Bug Fixes
- [ ] Identify and fix UI bugs
- [ ] Identify and fix API or data loading issues
- [ ] Fix mobile responsiveness issues
- [ ] Fix broken navigation or routing problems

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
- [ ] Improve homepage layout
- [ ] Improve search experience
- [ ] Improve listing card design
- [ ] Improve detail page usability
- [ ] Improve empty states and feedback messages

### Future Ideas
- [ ] Add favorites or saved properties

## In Progress / Next
- [ ] Verify Kleinanzeigen scan quality after next live scan run (price coverage + district extraction on fresh data)
- [ ] Add one-click "Run source now" action on Sources page for `kleinanzeigen` with status feedback

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
Status: [ ]
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

---

## Discovered Issues / New Tasks
- Add new tasks here when discovered during development

---

## Completed Tasks
- Move completed tasks here if the file becomes too long
