# Drop Dead RLS Policy `account_deletion_requests_update_own` (C3) — Implementation Plan

## Overview

Drop the dead Row-Level-Security policy `account_deletion_requests_update_own` via a single, reversible migration. This is candidate **C3**, ranked **#1** in `context/changes/refactor-opportunities/research.md` for highest value-to-cost: it closes a **real authorization bypass** (impl-review F1) rather than merely removing dead code, and costs ~3 lines of SQL with a DB/RLS-only blast radius.

The bypass: the table has full default CRUD RLS, including `FOR UPDATE TO authenticated USING auth.uid() = user_id`. No application code ever issues `.update()` on this table (verified: 1 INSERT, 2 SELECT, 1 DELETE, zero UPDATE — research T4). But because the UPDATE policy is live, any logged-in user can `PATCH .../account_deletion_requests?user_id=eq.<own>` directly through PostgREST and freely move their own `retention_until` — deferring or shortening their own account deletion, bypassing the application entirely and defeating the immutable-retention-window invariant.

The plan brackets the drop with **empirical before/after probes** so the acceptance test proves the attack vector is closed, not just that the schema changed.

## Current State Analysis

- **Policy is live**: `supabase/migrations/20260527150510_cards_and_account_deletion.sql:72-75` creates `account_deletion_requests_update_own` (`for update to authenticated`, `using/with check ((select auth.uid()) = user_id)`). No later migration drops it (the sweep `20260602120000` only reads the table in a subquery). Verified `829ea88` (research T5, grep — ast-grep `--lang sql` unsupported).
- **No code path uses UPDATE**: all accesses are `middleware.ts:23` (select), `account/delete.ts:34` (insert) + `:45` (select), `account/cancel.ts:27` (delete). Zero `.update()`. Verified (research T4).
- **The bypass is already vectored, not theoretical**: `context/archive/2026-06-01-account-deletion-with-retention/reviews/impl-review.md:25-37` (F1, ⚠️ WARNING, confidence HIGH) documents the PostgREST PATCH attack and recommends exactly this drop. **Decision: PENDING** — never executed.
- **Intentionality**: the policy *predates* the write-lock feature — it's the default CRUD-RLS set from the base schema. The archived plan (`plan.md:13,44`) treats existing RLS as given and deliberately does *not* rewrite policies. So leaving the UPDATE policy was never a deliberate decision — it's an accidental remnant (research §2.3).
- **Supabase is remote-only** (no local stack): `supabase db push` / `migration list --linked` hit the live project (ref `czpigaynwlnzzovxbrit`). Manual SQL/role verification runs in remote Studio. There is **no DB test harness** and **CI does not gate** (`ci.yml` triggers on `master`; working branch is `main`; no test step) — the safety net here is disciplined manual remote verification.

## Desired End State

The `account_deletion_requests` table exposes only `select` / `insert` / `delete` policies to `authenticated`; no `for update` policy exists. A logged-in user attempting `PATCH .../account_deletion_requests?user_id=eq.<own>` to change `retention_until` receives **403 / permission denied**, and the row's `retention_until` is unchanged. The application's request → cancel → sweep lifecycle (insert / select / delete) is fully unaffected. The change is reversible by re-creating the policy.

### Key Discoveries:

- Policy definition to remove: `supabase/migrations/20260527150510_cards_and_account_deletion.sql:72-75`.
- The full insert/select/delete policy set covers request/cancel/sweep; UPDATE is genuinely unused (research T4).
- Migration naming convention: `YYYYMMDDHHMMSS_<snake_description>.sql` in `supabase/migrations/` (4 existing files follow this).
- Verifying an authenticated PostgREST call requires a real JWT: mint a test user via the **service_role** admin API (`admin.auth.admin.createUser({ email_confirm: true })` bypasses the GoTrue domain block), then call PostgREST with `Authorization: Bearer <access_token>` + `apikey: <anon>`. The user must first **have a pending-deletion row** for the PATCH to target. (`verification-and-deploy-workflow` memory.)

## What We're NOT Doing

- **C1** (centralize write-lock enforcement into a middleware write-gate) — out of scope. It reverses a documented deliberate decision (26c850a / archived `plan.md` "the auditable pattern") and carries a large blast radius (guardrail rewrite + new middleware tests). Not in this change.
- **N5** (FS-scan "forgotten guard" test) — **deferred to a follow-up change**. It targets a different risk (app-layer forgotten guard) than C3 (DB RLS bypass); keeping it out preserves a minimal, single-purpose, fully-reversible plan.
- **C2** (consolidate the 6 `FALLBACK_MESSAGES` maps + add an `account_read_only` client key) — out of scope; lower-priority client-side cleanup.
- **C4** (two "pending" definitions: middleware row-exists vs sweep `retention_until < now()`) — out of scope; a product/domain decision (does read-only end at `retention_until`?), not a refactor (research §2.4).
- No rewrite of any other RLS policy on this or any other table.
- No application code, UI, or guardrail-test changes.

## Implementation Approach

A migration-only change driven by remote verification, in three phases that each end in a manual checkpoint (there is no automated DB test harness, and the DB is remote-only):

1. **Establish the "before" evidence** — confirm the policy is live and empirically reproduce the bypass (the PATCH currently succeeds). Without this, "after" proves nothing.
2. **Author and apply the drop migration** — one new timestamped migration, applied to remote.
3. **Verify closure and document reversal** — confirm the policy is gone (supporting) and that the same PATCH is now rejected with no data change (primary acceptance).

Reversibility is structural: a follow-up migration re-creating the policy restores the prior state, so the change is safe to apply and trivial to roll back.

## Critical Implementation Details

- **Timing & prerequisite ordering**: the empirical reproduction in Phase 1 MUST run before the migration is applied — once the policy is dropped, the "before" evidence can no longer be captured. Do not write/apply the migration until the baseline PATCH has been observed to succeed.
- **Probe setup requirement**: the PATCH target row must exist first. The test user needs a pending-deletion row (via the app's `POST /api/account/delete` while signed in, or a direct insert) before the PATCH has anything to update. Clean the test user up afterward (`admin.auth.admin.deleteUser`).
- **Debug & observability**: distinguish a *policy-blocked* PATCH (PostgREST `401/403` + `permission denied` / empty result set with `Prefer: return=representation`) from a *not-found* (no matching row) — otherwise a missing-row setup error reads as a false "bypass closed." Confirm closure by reading the row back afterward and asserting `retention_until` is unchanged.

---

## Phase 1: Baseline & Reproduce the Bypass

### Overview

Capture "before" evidence on the remote project: the UPDATE policy is active, and a logged-in user can in fact move their own `retention_until` through PostgREST (reproduce impl-review F1).

### Changes Required:

#### 1. Confirm policy presence on remote

**File**: none (remote verification only)

**Intent**: Establish that the dead UPDATE policy is actually active on the remote schema (research left the applied state as an `[unknown]`), so the drop is justified and the "after" comparison is meaningful.

**Contract**: Query remote `pg_catalog.pg_policies` (or Studio) for `tablename = 'account_deletion_requests'`; assert a row with `cmd = 'UPDATE'` named `account_deletion_requests_update_own` exists.

#### 2. Reproduce the bypass with a real authenticated request

**File**: none (throwaway script / manual REST call; do not commit)

**Intent**: Prove the attack vector is live before changing anything — a logged-in user mutating their own `retention_until` via PostgREST.

**Contract**: Mint a test user via service_role admin API (`email_confirm: true`); give the user a pending-deletion row (`POST /api/account/delete` with a valid session, or direct insert); obtain the user's access token; issue `PATCH <SUPABASE_URL>/rest/v1/account_deletion_requests?user_id=eq.<own>` with `Authorization: Bearer <token>`, `apikey: <anon>`, body `{ "retention_until": "<shifted date>" }`. Assert the PATCH **succeeds** and the row's `retention_until` changed. Record the result as the F1 baseline. Tear down the test user.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Remote `pg_policies` shows `account_deletion_requests_update_own` (cmd UPDATE) is active.
- The authenticated PostgREST PATCH on own `retention_until` **succeeds** pre-migration (F1 reproduced); the changed value is read back to confirm.
- Test user and any test rows are cleaned up.

**Implementation Note**: After this phase, pause for manual confirmation that the bypass was reproduced before authoring the migration.

---

## Phase 2: Author & Apply the Drop Migration

### Overview

Add one timestamped migration that drops the policy, and apply it to the remote project.

### Changes Required:

#### 1. New drop migration

**File**: `supabase/migrations/<YYYYMMDDHHMMSS>_drop_account_deletion_requests_update_policy.sql`

**Intent**: Remove the unused UPDATE policy so the immutable-retention-window invariant holds at the DB layer.

**Contract**: A single statement — `drop policy if exists account_deletion_requests_update_own on public.account_deletion_requests;`. Use a timestamp strictly greater than `20260602120000` so it orders last. No other statements.

#### 2. Apply to remote

**File**: none (remote apply)

**Intent**: Land the migration on the live project (remote-only workflow — no local stack).

**Contract**: Apply via the project's standard remote push (`supabase db push` / linked migration apply) against ref `czpigaynwlnzzovxbrit`; confirm the migration appears as applied in `supabase migration list --linked`.

### Success Criteria:

#### Automated Verification:

- Migration file exists and is the latest by timestamp in `supabase/migrations/`.
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Migration applies cleanly to remote with no error.
- `supabase migration list --linked` shows the new migration as applied.

**Implementation Note**: After this phase, pause for manual confirmation that the migration applied cleanly before running closure verification.

---

## Phase 3: Verify Closure & Document Reversal

### Overview

Prove the bypass is closed — the policy is gone and the same PATCH is now rejected with no data change — and record how to reverse the migration.

### Changes Required:

#### 1. Confirm policy removed (supporting evidence)

**File**: none (remote verification)

**Intent**: Schema-level confirmation that the policy no longer exists.

**Contract**: Re-query remote `pg_policies` for `account_deletion_requests`; assert **no** `cmd = 'UPDATE'` policy remains; select/insert/delete policies still present.

#### 2. Re-run the empirical PATCH probe (primary acceptance)

**File**: none (throwaway script / manual REST call; do not commit)

**Intent**: Prove the real attack vector is closed, identically to the Phase 1 reproduction.

**Contract**: Repeat the Phase 1 PATCH as the same kind of logged-in test user (fresh test user + pending-deletion row). Assert the PATCH is **rejected (403 / permission denied)** and that reading the row back shows `retention_until` **unchanged**. Confirm the app lifecycle still works: `POST /api/account/delete` (insert) and `POST /api/account/cancel` (delete) succeed for the test user. Tear down the test user.

#### 3. Record reversal notes

**File**: this plan's References / change.md notes

**Intent**: Make rollback explicit and trivial.

**Contract**: Document that reversal is a follow-up migration re-creating the policy — `create policy account_deletion_requests_update_own on public.account_deletion_requests for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);` (the exact definition from `20260527150510_...sql:72-75`).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Remote `pg_policies` shows the UPDATE policy is gone; select/insert/delete remain.
- The authenticated PostgREST PATCH on own `retention_until` is **rejected (403 / permission denied)** post-migration, and the row value is unchanged.
- Application lifecycle unaffected: account delete-request and cancel still succeed for a test user.
- Reversal note recorded.
- Test users/rows cleaned up.

**Implementation Note**: This phase completes the change. After manual confirmation, the change is ready to archive.

---

## Testing Strategy

There is no DB test harness and Supabase is remote-only, so verification is manual against the remote project. The acceptance evidence is the empirical PostgREST probe (Phases 1 and 3), with `pg_policies` inspection as supporting evidence.

### Manual Testing Steps:

1. **Before**: confirm UPDATE policy active (`pg_policies`); reproduce F1 — authenticated PATCH on own `retention_until` succeeds.
2. Apply the drop migration to remote; confirm it lists as applied.
3. **After**: confirm UPDATE policy gone; repeat the PATCH — assert 403/permission denied and unchanged `retention_until`.
4. Regression: confirm `POST /api/account/delete` and `POST /api/account/cancel` still work for a test user.
5. Clean up all test users/rows.

## Migration Notes

- Single forward migration: `drop policy if exists`. Idempotent (`if exists`) and safe to re-run.
- **Rollback**: a follow-up migration re-creating the policy (exact definition in Phase 3 §3) fully restores prior state. No data migration involved.
- Remote-only: there is no local DB to migrate; apply directly to ref `czpigaynwlnzzovxbrit`.

## References

- Research: `context/changes/refactor-opportunities/research.md` (§2.3, §3 #1, T4/T5 verification)
- Source policy: `supabase/migrations/20260527150510_cards_and_account_deletion.sql:72-75`
- Origin finding (F1): `context/archive/2026-06-01-account-deletion-with-retention/reviews/impl-review.md:25-37`
- Remote verification mechanics: `verification-and-deploy-workflow` memory (service_role test users, GoTrue domain block, PostgREST auth)
- Deferred follow-up: N5 FS-scan guard test (research §3 #2, pattern `test/no-service-role-in-src.test.ts:21-54`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baseline & Reproduce the Bypass

#### Automated

- [ ] 1.1 Lint passes: `npm run lint`
- [ ] 1.2 Build passes: `npm run build`

#### Manual

- [ ] 1.3 Remote `pg_policies` shows `account_deletion_requests_update_own` (cmd UPDATE) is active
- [ ] 1.4 Authenticated PostgREST PATCH on own `retention_until` succeeds pre-migration (F1 reproduced); changed value read back
- [ ] 1.5 Test user and test rows cleaned up

### Phase 2: Author & Apply the Drop Migration

#### Automated

- [ ] 2.1 Migration file exists and is the latest by timestamp in `supabase/migrations/`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Build passes: `npm run build`

#### Manual

- [ ] 2.4 Migration applies cleanly to remote with no error
- [ ] 2.5 `supabase migration list --linked` shows the new migration as applied

### Phase 3: Verify Closure & Document Reversal

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Remote `pg_policies` shows the UPDATE policy is gone; select/insert/delete remain
- [ ] 3.4 Authenticated PostgREST PATCH on own `retention_until` is rejected (403 / permission denied), row value unchanged
- [ ] 3.5 Application lifecycle unaffected: account delete-request and cancel still succeed for a test user
- [ ] 3.6 Reversal note recorded
- [ ] 3.7 Test users/rows cleaned up
