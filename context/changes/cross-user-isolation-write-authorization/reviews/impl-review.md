<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cross-User Isolation + Write Authorization

- **Plan**: context/changes/cross-user-isolation-write-authorization/plan.md
- **Scope**: Full plan — Phases 1–6 of 6
- **Date**: 2026-06-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Summary

Both review agents independently concluded the suite is ship-ready. Security — the focus axis of
this change — is clean: `service_role` never reaches `src/**`, the static guardrail is non-vacuous,
isolation tests are load-bearing ("owner row unchanged", not status-only), and hermetic oracles
derive from PRD/domain rules (FR-009, Leitner `BOX_INTERVALS_DAYS`, server-authority), not mirrored
implementation logic. All planned files present; no DRIFT/MISSING. Automated gates: `npm test`
(63 pass, no integration tests executed), `npm run build` (clean), `npm run lint` (clean).
`npm run test:integration` is the opt-in real-DB gate (not run in this review).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — teardown() lets one deleteUser failure strand the other user

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: test/integration/two-user-fixture.ts:123-127
- **Detail**: `teardown()` awaits `deleteUser(a.id)` then `deleteUser(b.id)` with no error isolation. The inline comment says "Delete both regardless of one failing" — but the code does not implement that: if deleting A rejects (transient admin-API error), B is never deleted and an orphan user + its seeded card persist on the live project. Code contradicts its own stated intent.
- **Fix**: Run both deletes through `Promise.allSettled` (or wrap each in its own try/catch) so one failure cannot strand the other user.
- **Decision**: PENDING

### F2 — Partial-setup orphan if user B provisioning fails

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: test/integration/two-user-fixture.ts:113-121
- **Detail**: `setupTwoUsers` creates A, then B. If B's create/seed/sign-in throws, the function rejects before returning a `teardown` handle, so the caller's `afterAll` never runs and A is left orphaned on the remote project. Inherent to non-transactional admin provisioning, but currently unmitigated.
- **Fix**: On failure after A is created, best-effort delete already-created users before rethrowing (try/catch around B's creation that cleans up A).
- **Decision**: PENDING

### F3 — Phase-6 commit carries two unplanned files

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — already decided; recorded for the audit trail
- **Dimension**: Scope Discipline
- **Location**: commit 6a7c3dd (rafals-notes.md, .claude/settings.local.json)
- **Detail**: Commit 6a7c3dd bundled `rafals-notes.md` (591-line personal lesson notes) and a `settings.local.json` permission entry — neither in the phase's staging set; both swept in during the commit. The user explicitly chose to keep them when prompted, so this is logged for the record, not re-litigated.
- **Fix**: None required — accepted by decision. (If a clean history is later desired, `rafals-notes.md` could move to its own docs commit.)
- **Decision**: ACCEPTED — kept by user decision during the phase-6 commit ritual.
