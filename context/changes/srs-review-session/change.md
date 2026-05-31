---
change_id: srs-review-session
title: SRS review session — review due cards and persist next-review dates
status: preparing
created: 2026-05-30
updated: 2026-05-30
archived_at: null
---

## Notes

Implements roadmap **S-04** (`context/foundation/roadmap.md` → §Slices → S-04: Sesja powtórek SRS). Tracker mirrors: GitHub [#10](https://github.com/rafsaw/10xCards/issues/10), Linear RAF-14 (`stream:c-review`) — see `context/foundation/tasks-github.md`.

- **Outcome:** logged-in user starts a review session, sees due cards (`status=saved` + `next_due ≤ now`) one at a time, reveals the back, rates recall binary right/wrong (FR-014); next-review date updates per a simple SR model and persists across sessions. Closes PRD Secondary Success Criterion.
- **PRD refs:** US-02, FR-013, FR-014, FR-015.
- **Prerequisites:** F-01 (`cards-schema-and-rls`) and S-02 (`atomic-save-to-deck`) — both **done**, so this slice is unblocked.
- **Key unknown (resolve before/with planning):** the exact "simple model" scheduling formula — Leitner boxes vs fixed multipliers vs simple Anki-like — and how binary right/wrong maps to interval change. PRD §Non-Goals forbids advanced SR optimization (over-engineering is the risk, not under). Roadmap deliberately defers this to `/10x-research`.
- **Fallback contract (PRD Guardrails):** if due-card selection logic fails for any reason, fall back to "oldest due-card first".
