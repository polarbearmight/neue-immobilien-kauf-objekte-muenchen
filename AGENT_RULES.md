OpenClaw Operating Rules for the neue-immobilien-kauf-objekte-muenchen Project

## Purpose
This file defines how OpenClaw should operate inside this repository.

OpenClaw must work autonomously, safely, and iteratively to improve the Real Estate project.

---

## Primary Objective
Continuously improve the Real Estate project by:
- implementing tasks
- fixing bugs
- improving code quality
- improving user experience
- maintaining a stable and clean codebase

---

## Primary Task Source
There is a file called `OpenClaw_task.md`.

Rules:
- Always read `OpenClaw_task.md` before starting work.
- Always prioritize unfinished tasks from `OpenClaw_task.md`.
- Only start self-discovered improvements if no defined task remains or if a better prerequisite task is needed.
- If new work is discovered, add it to `OpenClaw_task.md`.

---

## Autonomous Work Loop

OpenClaw should repeat this process continuously:

1. Read `OpenClaw_task.md`
2. Select the highest-priority unfinished task
3. Analyze the codebase and understand the relevant files
4. Create an implementation plan
5. Implement the task
6. Test or verify that the change works
7. Refactor if needed
8. Update `OpenClaw_task.md`
9. Commit the work using the required Git workflow
10. Continue with the next task

---

## Task Execution Rules
- Work on one focused task at a time
- Keep changes small and well-structured
- Do not make unrelated changes in the same task unless necessary
- If a task is too large, split it into smaller tasks in `OpenClaw_task.md`
- If blocked, document the blocker clearly in `OpenClaw_task.md`

---

## Code Quality Rules
- Never break existing working functionality intentionally
- Keep the code modular, readable, and maintainable
- Reuse existing components and patterns where reasonable
- Avoid unnecessary complexity
- Remove dead or unused code when safe
- Improve naming clarity when needed
- Prefer consistent architecture over quick hacks

---

## Testing and Verification Rules
Before finalizing any task:
- Check whether the code builds successfully
- Check whether the changed feature works as intended
- Check for obvious regressions
- Verify UI changes visually if applicable
- Verify mobile behavior if relevant
- Ensure no avoidable errors were introduced

If tests exist:
- Run relevant tests
- Fix failing tests related to the task when possible

If no tests exist:
- Perform practical verification through the app structure and affected files

---

## Git Workflow Rules
OpenClaw must follow this workflow for every task.

### Branching
- Never commit directly to `main`
- Always create a new branch from the latest `main`

Allowed branch prefixes:
- `feature/`
- `fix/`
- `refactor/`
- `improvement/`

Examples:
- `feature/property-search`
- `fix/mobile-navbar`
- `refactor/api-service`
- `improvement/listing-cards`

### Commits
- Use clear and specific commit messages
- Each commit must describe what changed
- Prefer atomic commits for focused changes

Examples:
- `Add property search by location`
- `Fix broken image loading on listing page`
- `Refactor property card component for reuse`

### Push and Merge
For each finished task:
1. Push the branch to GitHub
2. Create a pull request
3. Merge the pull request into `main` immediately
4. Delete the branch after merge
5. Pull the latest `main`
6. Continue with the next task

---

## Task File Update Rules
Whenever work is completed:
- Mark the task as completed in `OpenClaw_task.md`
- If partial progress was made, mark it as in progress
- If blocked, mark it as blocked and explain why
- Add any newly discovered follow-up tasks
- Keep the task file organized and readable

---

## Priority Rules
When deciding what to do next, use this order:

1. High-priority tasks in `OpenClaw_task.md`
2. Bugs affecting core functionality
3. Missing core user features
4. Stability and performance improvements
5. Code quality and refactoring
6. Nice-to-have UX improvements

---

## Project Focus
The Real Estate project should evolve into a reliable and useful real estate platform.

Typical areas of focus:
- property listings
- property details
- search and filters
- image galleries
- location details
- inquiry/contact features
- responsive UI
- stable data loading
- scalable architecture

---

## Self-Review Rules
Before closing a task, OpenClaw should ask internally:
- Does this change solve the intended task?
- Is the implementation clean?
- Is the code consistent with the repository style?
- Did I introduce unnecessary complexity?
- Is there any obvious bug or missing edge case?
- Should I add a follow-up task to `OpenClaw_task.md`?

---

## Safety Rules
- Do not delete major functionality unless explicitly required
- Do not overwrite unrelated work without reason
- Do not expose secrets or credentials
- Do not hardcode sensitive values
- Be careful with config files, auth logic, and production-critical code
- Preserve existing project structure unless restructuring is clearly beneficial

---

## Behavior When No Tasks Exist
If there are no unfinished tasks in `OpenClaw_task.md`:
1. Analyze the repository
2. Identify missing features, bugs, refactoring opportunities, or UX problems
3. Add them as new tasks to `OpenClaw_task.md`
4. Start working on the highest-value task

---

## Expected Behavior Summary
OpenClaw should behave like an autonomous software developer that
- reads tasks
- executes them carefully
- verifies results
- updates task tracking
- uses structured Git workflow
- merges finished work into `main`
- repeats the cycle continuously
