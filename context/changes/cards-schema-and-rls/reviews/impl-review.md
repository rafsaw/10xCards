# Implementation Review: F-01 Cards Schema + RLS + Account Soft-Delete

- **Plan**: `context/changes/cards-schema-and-rls/plan.md`
- **Diff reviewed**: commits `9214f40` (p1) + `c21106d` (p2) + `40ffdf2` (epilogue)
- **Date**: 2026-05-27
- **Tool**: built-in `/code-review` skill (substitute for `/10x-impl-review`, which arrives in Lesson 3)
- **Mode**: high-effort, recall-biased
- **Status**: 5 findings, all DEFERRED — F-01 ships as-is. Revisit before related downstream slices land.

## Summary

All five findings are **hardenings** on the migration SQL. None are correctness bugs against F-01's own contract — the schema, policies, and verified isolation match the plan. The findings flag defense-in-depth gaps and one Supabase-linter security warning that future slices (S-01, S-04, S-05) will be at higher risk of hitting if left unaddressed.

No findings on `verify-rls.sql`, `verify-rls-results.md`, or the documentation diff.

## Findings (deferred)

### F1 — Function `public.set_updated_at()` has a mutable search_path

- **File:** `supabase/migrations/20260527150510_cards_and_account_deletion.sql:5–13`
- **Severity:** WARNING (security)
- **Why it matters:** Supabase's hosted security advisor flags every SECURITY INVOKER function without an explicit `set search_path` as a real warning ("Function Search Path Mutable"). A role with `CREATE` on any schema earlier in the resolver's search_path can shadow `now()` (or any unqualified identifier the trigger gains over time) and execute arbitrary code in the trigger context.
- **Fix when revisiting:** Add `set search_path = ''` (or `set search_path = pg_catalog, public`) to the function declaration, and fully-qualify `now()` as `pg_catalog.now()` inside the body. One-line follow-up migration.
- **Trigger to act:** When the Supabase advisor surfaces it, or before any second trigger function is added to the project (one warning is acceptable, a class of warnings is not).

### F2 — `cards.interval_days` allows negative values

- **File:** `supabase/migrations/20260527150510_cards_and_account_deletion.sql:22`
- **Severity:** OBSERVATION (defense-in-depth)
- **Why it matters:** S-04's SR algorithm uses `interval_days` as a non-negative magnitude. A sign-flip or off-by-one in app code can insert `-1`, breaking monotonic-interval assumptions or scheduling cards into impossibility.
- **Fix when revisiting:** Add `check (interval_days >= 0)` to the column.
- **Trigger to act:** Before S-04 (`/10x-plan srs-review-session`) starts writing this column.

### F3 — `cards.repetition_count` allows negative values

- **File:** `supabase/migrations/20260527150510_cards_and_account_deletion.sql:23`
- **Severity:** OBSERVATION (defense-in-depth)
- **Why it matters:** Same class as F2. A Leitner-box-index lookup against `repetition_count = -1` crashes or wraps around. An exponential-interval formula returns a tiny fraction and the card fires every few seconds.
- **Fix when revisiting:** Add `check (repetition_count >= 0)` to the column.
- **Trigger to act:** Same gate as F2 — before S-04 writes this column.

### F4 — `account_deletion_requests.retention_until` has no CHECK against `requested_at`

- **File:** `supabase/migrations/20260527150510_cards_and_account_deletion.sql:58`
- **Severity:** WARNING (silent data loss path)
- **Why it matters:** S-05's submit endpoint computes `retention_until = now() + interval '30 days'`. A sign typo or timezone glitch could pass a value in the past; the very next cron sweep sees `now() > retention_until` and cascades the user + all their cards via `ON DELETE CASCADE` with no recovery. The DB does not currently enforce the invariant.
- **Fix when revisiting:** Add `check (retention_until > requested_at)` to the table.
- **Trigger to act:** Before S-05 (`/10x-plan account-deletion-with-retention`) ships any cron logic. This is the most consequential of the five to land before downstream code.

### F5 — `check (length(front) > 0)` accepts whitespace-only content

- **File:** `supabase/migrations/20260527150510_cards_and_account_deletion.sql:20–21`
- **Severity:** OBSERVATION (intent gap, not a correctness bug)
- **Why it matters:** PRD US-03 acceptance criteria says "both non-empty"; a card with `front = '   '` (three spaces) passes the constraint but is functionally empty. App-layer trim-before-insert covers the same ground.
- **Fix when revisiting:** Tighten to `check (length(trim(front)) > 0)` and the same for `back`.
- **Trigger to act:** When S-01 or S-03 writes the create-card UI; either trim in the form handler or tighten the schema CHECK.

## What's NOT here (positive findings)

- RLS policy shape (`(select auth.uid()) = user_id`, both USING and WITH CHECK) is correct and Supabase-best-practice — verified by the 14 assertions in `verify-rls-results.md`.
- `ON DELETE CASCADE` is the right choice for the deletion path S-05 needs.
- The composite `(user_id, status)` index covers S-01/S-02/S-03's read patterns; the partial S-04 index is correctly deferred.
- The migration is forward-only, idempotent for its own creation (it doesn't reset state), and replayable in a fresh project.
- Documentation (plan.md, plan-brief.md, change.md, verify-rls-results.md) accurately matches what was implemented.
- No cleanup, simplification, efficiency, or altitude findings — the migration is minimal and uniform.
