<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account Deletion with 30-Day Retention

- **Plan**: context/changes/account-deletion-with-retention/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 2 warnings · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

All planned changes implemented as specified across all three phases (every file MATCH). Read-only is presence-based and fail-closed; delete never overwrites the window; cancel is idempotent; the guard sits after the 401 in all 7 mutating handlers; delete/cancel correctly skip the guard; the SECURITY DEFINER sweep is search-path pinned and execute-fenced. `npm run lint` and `npm run build` both green.

## Findings

### F1 — RLS UPDATE policy lets a user reset their own deletion window

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260527150510_cards_and_account_deletion.sql:72-75
- **Detail**: The plan's "window never resets" invariant is enforced in app code (delete.ts uses insert-or-select, never upsert). But the base schema defines `account_deletion_requests_update_own` (FOR UPDATE TO authenticated). The app issues no UPDATE to this table (confirmed by grep — no `.update()` against `account_deletion_requests` anywhere in src/). So any authenticated user can bypass the app and `PATCH .../account_deletion_requests?user_id=eq.<own>` via PostgREST to set `retention_until` to any value — postponing their own deletion indefinitely or shortening it. Only affects the attacker's own timer, not other users' data → WARNING not CRITICAL. The policy predates this change (F-01), but this feature is what gives it teeth.
- **Fix**: Add a migration dropping `account_deletion_requests_update_own`. The insert/select/delete policies fully cover request/cancel/sweep; removing UPDATE makes the immutable-window invariant real at the DB layer.
  - Strength: Zero functional impact — no app code path updates the row; closes the bypass entirely.
  - Tradeoff: One new migration to author + push to remote Supabase.
  - Confidence: HIGH — grep confirms no UPDATE usage; sweep/cancel use DELETE, request uses INSERT.
  - Blind spot: No planned feature edits the row in place; revisit if one ever does.
- **Decision**: PENDING

### F2 — Retention date rendered in runtime-local timezone, sweep runs in UTC

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/account-retention.ts:24-28
- **Detail**: `formatRetentionDate` uses `toLocaleDateString` with no `timeZone`, so it renders in the runtime's local zone. On Cloudflare Workers that's UTC today (consistent with the `0 3 * * *` UTC sweep), but it's implicit — a non-UTC runtime or local dev would show a date that can be off-by-one from when the row becomes sweep-eligible.
- **Fix**: Pass `{ timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }` so the displayed date deterministically matches the UTC sweep window.
- **Decision**: PENDING

### F3 — CancelDeletionButton skips the {code,message}+FALLBACK error pattern

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/settings/CancelDeletionButton.tsx:21
- **Detail**: Uses a hardcoded string error + plain `string` state instead of the `{code, message}` + `FALLBACK_MESSAGES`/`parseError` pattern in `CardRow.tsx` / `DeleteAccountButton.tsx`. Acceptable (cancel has one failure mode) but inconsistent with the codebase convention.
- **Fix**: Optional — adopt the parseError pattern for consistency, or leave as-is given the single failure mode.
- **Decision**: PENDING

### F4 — cron.schedule is not idempotent on migration replay

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: supabase/migrations/20260602120000_account_deletion_sweep.sql:51
- **Detail**: Re-applying the migration would error on the duplicate job name `account-deletion-sweep`. Migrations normally run once, so low risk; a `cron.unschedule` guard would make it replay-safe.
- **Fix**: Optional — prefix with a guarded `cron.unschedule('account-deletion-sweep')` before the schedule call.
- **Decision**: PENDING

### F5 — Delete confirm says "cancel by logging in" but the user stays logged in

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (UX wording)
- **Location**: src/components/settings/DeleteAccountButton.tsx:26-28
- **Detail**: The flow keeps the user signed in and they cancel from the banner/settings; "by logging in" is slightly misleading. NOTE: this is the plan's verbatim confirm string, so the implementation is faithful to the spec — this flags the spec wording, not a drift.
- **Fix**: Optional — reword to "…30 days to cancel from Settings, after which all your cards are permanently deleted." (update plan string too).
- **Decision**: PENDING

### F6 — EXTRA service_role EXECUTE grant on the sweep function

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20260602120000_account_deletion_sweep.sql:46
- **Detail**: Plan said "revoke from public/anon/authenticated"; the implementation also grants execute to `service_role`. Benign and sensible (service_role is server-only admin, already able to delete users), just beyond the literal instruction.
- **Fix**: None needed — accept as a reasonable addition.
- **Decision**: PENDING
