<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: F-01 Cards Schema + RLS + Account Soft-Delete

- **Plan**: `context/changes/cards-schema-and-rls/plan.md`
- **Scope**: Phase 1–2 of 2 (full plan)
- **Date**: 2026-05-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations
- **Diff reviewed**: commits `9214f40` (p1), `c21106d` (p2), `40ffdf2` (epilogue)

> Note: supersedes the earlier built-in `/code-review` pass (committed at `d480835`);
> that content remains in git history. Findings are equivalent — the prior F2/F3
> (negative-value checks) are consolidated here into F3.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

All four findings are forward-looking hardenings on the migration SQL, not defects
in F-01's own contract. Each can only be applied as a NEW forward migration (the
original is already pushed to remote — per the plan's Migration Notes, applied files
must not be edited). Success criteria checked locally: `npm run lint` PASS,
`npm run build` PASS, placeholder check (`grep -c '<USER_._UUID>'` → 0) PASS.
Remote `db push` / `migration list` recorded as passed at `9214f40`; manual RLS
assertions documented in `verify-rls-results.md`.

## Findings

### F1 — set_updated_at() has a mutable search_path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260527150510_cards_and_account_deletion.sql:5-13
- **Detail**: The trigger function has no `set search_path`. Supabase's hosted security advisor flags every such function ("Function Search Path Mutable"). A role with CREATE on a schema earlier in the resolver path could shadow an unqualified identifier. The plan specified the function body verbatim without search-path hardening, so this is a plan gap, not implementation drift.
- **Fix**: New follow-up migration: recreate the function with `set search_path = ''` and fully-qualify `now()` as `pg_catalog.now()`.
- **Trigger to act**: When the Supabase advisor surfaces it, or before any second trigger function is added.
- **Decision**: PENDING

### F2 — account_deletion_requests.retention_until has no CHECK vs requested_at

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (data safety)
- **Location**: supabase/migrations/20260527150510_cards_and_account_deletion.sql:59
- **Detail**: S-05's submit path computes `retention_until = now() + 30 days`. A sign/timezone slip could store a past timestamp; the next cron sweep sees `now() > retention_until` and hard-deletes the user + all their cards via ON DELETE CASCADE, unrecoverably. The DB does not enforce the forward-in-time invariant today. Most consequential of the four, but only bites once S-05 ships cron logic.
- **Fix**: New follow-up migration adding `check (retention_until > requested_at)` to the table.
- **Trigger to act**: Before S-05 (`/10x-plan account-deletion-with-retention`) ships any cron logic.
- **Decision**: PENDING

### F3 — interval_days / repetition_count accept negative values

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (defense-in-depth)
- **Location**: supabase/migrations/20260527150510_cards_and_account_deletion.sql:23-24
- **Detail**: Both SR bookkeeping columns are plain `integer default 0` with no lower bound. S-04's scheduling algorithm treats them as non-negative magnitudes; an app-side sign flip could insert -1 and break interval monotonicity or fire a card every few seconds. No writer touches these until S-04.
- **Fix**: Add `check (interval_days >= 0)` and `check (repetition_count >= 0)` in a follow-up migration before S-04 writes these columns.
- **Trigger to act**: Before S-04 (`/10x-plan srs-review-session`) starts writing these columns.
- **Decision**: PENDING

### F4 — length(front) > 0 accepts whitespace-only content

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (intent gap)
- **Location**: supabase/migrations/20260527150510_cards_and_account_deletion.sql:19-20
- **Detail**: PRD US-03 requires "both non-empty", but `front = '   '` passes the current CHECK while being functionally empty. App-layer trim covers the same ground, so this is an intent gap rather than a correctness bug.
- **Fix**: Tighten to `check (length(trim(front)) > 0)` (and same for back) in a follow-up migration, or enforce trim in the S-01/S-03 form handler.
- **Trigger to act**: When S-01 or S-03 writes the create-card UI.
- **Decision**: PENDING
