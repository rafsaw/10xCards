<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Account Deletion with 30-Day Retention

- **Plan**: context/changes/account-deletion-with-retention/plan.md
- **Mode**: Deep
- **Date**: 2026-06-02
- **Verdict**: REVISE
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

13/13 existing paths confirmed; 7 planned-new paths are correctly absent. Symbols confirmed: 7/7 mutating handlers (`cards` POST, `cards/[id]` PATCH+DELETE, `generations` POST, `generations/save` POST, `generations/discard` POST, `reviews` POST), `account_deletion_requests` schema + cascade, `App.Locals`, `Banner.astro`, and the referenced UI write surfaces. Brief<->plan consistent. Progress<->Phase consistent: one `## Progress` block at the bottom, each phase has a matching progress subsection, and every success-criteria bullet is represented by a checkbox item.

## Findings

### F1 — Upsert wording can reset the retention window

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Request-deletion endpoint
- **Detail**: The endpoint contract says to "Upsert into `account_deletion_requests`" with `requested_at: now()` and `retention_until: now() + 30 days`, then says "On conflict (already pending) keep the existing row — do not reset the window." Those two instructions pull in opposite directions in Supabase JS: a normal `.upsert()` updates the conflicting row, which would move `retention_until` on every re-request and fail success criterion 2.5. The plan names the required behavior, but the implementation instruction is ambiguous enough to invite the exact bug the success criterion is trying to prevent.
- **Fix**: Replace "Upsert" with an explicit insert-or-select flow: insert the row; if the insert hits duplicate-key/409/23505, select and return the existing `retention_until`; never update `requested_at` or `retention_until` for an existing pending request.
- **Decision**: FIXED (Phase 2 request endpoint Contract now specifies insert-or-select, not upsert; explicitly forbids overwriting the window on re-request)
