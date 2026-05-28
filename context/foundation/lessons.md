# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Make route placement a deliberate choice; don't silently pile actions onto /dashboard

- **Context**: Any /10x-plan or /10x-implement work that adds a new user-facing action or feature surface to the web app — routing / information-architecture decisions. Especially when a PRD user story is phrased "on the dashboard".
- **Problem**: The first take of S-01 (first-gated-generation) silently crammed the AI paste form + draft list onto /dashboard because PRD US-01 says "on the dashboard", without surfacing the choice. With S-02/S-03/S-04 all slated for the same page, /dashboard would have become a crowded, hard-to-evolve hub. Needed a planning round-trip to correct.
- **Rule**: When adding a new user-facing action, treat "dedicated route vs. co-locate on an existing page" as an explicit decision and raise it with the user during planning (e.g. an AskUserQuestion) — do not silently default either way. A PRD story phrased "on the dashboard" is not a mandate to put it there; it can be satisfied by a dashboard CTA that links to a dedicated page. Lean toward a dedicated route when the action is substantial or /dashboard is already accreting surfaces; small, tightly-related actions may reasonably live on an existing page. Goal: keep /dashboard from becoming a catch-all. When a new protected page is added, wire it into PROTECTED_ROUTES in src/middleware.ts.
- **Applies to**: plan, plan-review, implement
