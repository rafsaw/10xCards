# Drop Dead RLS Policy `account_deletion_requests_update_own` (C3) — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Drop the unused `account_deletion_requests_update_own` RLS policy via one reversible migration. It's not just dead code: because the `FOR UPDATE` policy is live while no application code ever updates the table, any logged-in user can `PATCH .../account_deletion_requests?user_id=eq.<own>` through PostgREST and freely move their own `retention_until` — deferring or shortening their own account deletion outside the app. This is the impl-review **F1** finding (confidence HIGH, decision PENDING), ranked **#1** in research for highest value-to-cost.

## Starting Point

The table carries the default CRUD-RLS set from the base schema (`20260527150510_...sql:64-79`), including the UPDATE policy. Application access is insert (delete-request) / select (middleware, sweep) / delete (cancel) only — zero `.update()` (research T4). The UPDATE policy is an accidental remnant that predates the write-lock feature; the archived plan deliberately left existing RLS untouched, so keeping it was never a real decision.

## Desired End State

The table exposes only select/insert/delete to `authenticated`. A logged-in user's PATCH on their own `retention_until` returns 403 / permission denied with the value unchanged. The request → cancel → sweep lifecycle is unaffected. Reversible by re-creating the policy.

## Key Decisions Made

| Decision                  | Choice                                              | Why (1 sentence)                                                              | Source   |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| Scope                     | C3 only (drop the UPDATE policy)                    | Highest ROI, closes a real bypass, minimal blast radius, fully reversible.    | Plan     |
| C1 (centralize write-lock)| Excluded                                            | Reverses a documented deliberate decision; blast radius too large here.       | Plan     |
| N5 (FS-scan guard test)   | Deferred to a follow-up                             | Different risk than C3; keeping it out preserves a single-purpose plan.       | Plan     |
| C2 (error-copy registry)  | Excluded                                            | Lower-priority client-side cleanup, no security dimension.                    | Plan     |
| C4 (two "pending" defs)   | Excluded                                            | Product/domain decision, not a refactor (STOP at business boundary).         | Research |
| Acceptance test           | Empirical PostgREST PATCH probe (before & after)    | Proves the attack vector is closed, not just the schema; `pg_policies` supports. | Plan  |

## Scope

**In scope:** confirm policy active on remote → reproduce the bypass → drop migration → verify rejection + no data change → rollback note.

**Out of scope:** C1, C2, C4, N5; any other RLS policy; any app/UI/guardrail-test change.

## Architecture / Approach

Migration-only, driven by remote verification (Supabase is remote-only; no DB test harness; CI does not gate). Three phases, each ending in a manual checkpoint: (1) baseline + reproduce F1 — must run before the drop, since "before" evidence is unrecoverable afterward; (2) author + apply one `drop policy if exists` migration to remote; (3) confirm policy gone and re-run the PATCH to assert it's now rejected, plus a regression check that delete-request/cancel still work.

## Phases at a Glance

| Phase                              | What it delivers                                          | Key risk                                                              |
| ---------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Baseline & reproduce            | "Before" evidence: policy active, PATCH succeeds (F1)     | Probe setup — a missing target row reads as a false "closed."        |
| 2. Author & apply migration        | One `drop policy if exists` migration, applied to remote  | Remote-only apply; no local stack to dry-run against.                |
| 3. Verify closure & rollback note  | PATCH now 403, value unchanged; reversal documented       | Distinguishing policy-blocked from not-found in the response.        |

**Prerequisites:** remote Supabase access (ref `czpigaynwlnzzovxbrit`); service_role key to mint a test user + token for the authenticated probe.
**Estimated effort:** ~1 session, one migration + manual remote verification.

## Open Risks & Assumptions

- Applied state of the remote schema was an `[unknown]` in research — Phase 1 confirms the policy is actually live before anything is dropped.
- The empirical probe needs a real JWT and a pending-deletion target row; setup errors can masquerade as results — mitigated by reading the row back and checking for permission-denied vs not-found.
- No `.astro` form-action server mutation path was scanned; irrelevant to this DB-layer change but noted for the deferred C1/N5 follow-up.

## Success Criteria (Summary)

- A logged-in user can no longer change their own `retention_until` via PostgREST — the same PATCH that succeeded pre-migration is rejected (403 / permission denied) with the value unchanged.
- The UPDATE policy is absent from remote `pg_policies`; select/insert/delete remain.
- Account delete-request and cancel still work; the change is documented as reversible.
