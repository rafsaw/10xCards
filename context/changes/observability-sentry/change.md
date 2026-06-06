---
change_id: observability-sentry
title: Observability seam + Sentry — fix swallowed-exception convention
status: implementing
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

## Notes

Promotes the M3L5 audit into executable work. Source of truth:
`context/foundation/swallowed-exceptions-audit.md` (audit + Phases A–D + tracker).

Locked pre-execution decisions:

- **DEC-2 — specimen:** `src/components/library/CardRow.tsx` → `parseError`
  (already an extracted pure `(Response) => Promise<RowError>`; cleanest TDB
  walkthrough). The origin `PasteAndGenerateForm.tsx` is fixed in Phase C.
- **DEC-1 — Phase C scope: extract early.** Phase B does the one full
  red→green→refactor on the specimen; Phase C lifts it into a shared
  `parseErrorBody` (tested once for the swallow) and migrates the other 4 sites
  to it as behavior-preserving refactors. The specimen graduates into the shared
  helper — one artifact, one test, whole convention killed.

Shape of the work (see audit for full reasoning):

- **Phase A** — characterization test of existing `parseError` (GREEN). `/10x-implement` (TDD refuses existing code).
- **Phase B** — TDB the specimen: RED (non-JSON body ⇒ `reportError` called) → GREEN (`catch (err)` + minimal `reportError` seam) → REFACTOR. `/10x-tdd`.
- **Phase C** — extract shared `parseErrorBody` + migrate the 4 other swallow sites. `/10x-tdd` + `/10x-implement`.
- **Phase D** — wire `reportError` → Sentry at the edge (env-gated; pull current Sentry-for-Astro/Workers setup via Context7) + verify lint/build/manual. `/10x-implement`.

Next: `/10x-plan observability-sentry` — turn Phases A–D into a phased `plan.md`
whose `## Progress` becomes the authoritative execution tracker.
