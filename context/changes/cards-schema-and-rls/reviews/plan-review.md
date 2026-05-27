<!-- PLAN-REVIEW-REPORT -->
# Plan Review: F-01 Cards Schema + RLS + Account Soft-Delete

- **Plan**: `context/changes/cards-schema-and-rls/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-27
- **Verdict**: SOUND (after triage; was REVISE pre-triage)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | WARNING (pre-triage) → PASS after F4 applied |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING (pre-triage) → PASS after F1 applied |
| Plan Completeness     | WARNING (pre-triage) → PASS after F2 + F5 applied |

## Grounding

7/7 paths ✓, brief↔plan ✓, Progress↔Phase mechanical contract ✓

## Findings

### F1 — Studio role-impersonation is a load-bearing assumption with no fallback

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Manual RLS verification
- **Detail**: Phase 2's verification depends on the remote Studio SQL editor's role/user selector. If missing or differently shaped, verification stalls and the ship-blocker guardrail goes unverified.
- **Fix**: Add a precondition (verify the selector is present) and a psql fallback (direct connection on port 5432, NOT the pooler — pgbouncer transaction-mode strips SET LOCAL); keep verify-rls.sql format identical.
- **Decision**: FIXED (Fix in plan applied; Phase 2 "Precondition" subsection added with Studio + psql paths)

### F2 — Trigger function for `updated_at` not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Migration file Contract, trigger bullet
- **Detail**: Contract named the trigger but never named the trigger function (a Postgres trigger needs both).
- **Fix**: Added `public.set_updated_at()` function definition and the full `create trigger ... execute function public.set_updated_at()` statement to the Contract.
- **Decision**: FIXED (Fix in plan applied)

### F3 — `auth.uid() = user_id` ignores Supabase's documented initplan optimization

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — RLS policies
- **Detail**: Supabase docs recommend wrapping `auth.uid()` in a subquery so Postgres caches the result as an InitPlan across the whole query.
- **Fix**: Rewrote all eight policy predicates to `(select auth.uid()) = user_id` (USING and WITH CHECK). Brief's Desired End State updated to match.
- **Decision**: FIXED (Fix in plan applied)

### F4 — Both `cards` indexes are speculative for unwritten features

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 1 — Migration file Contract, index bullets
- **Detail**: The composite `(user_id, status)` index helps S-01 (very next slice). The partial `(user_id, next_due_at) where status='saved'` index targets S-04, which is research-pending and may not need this column shape.
- **Fix A ⭐ Recommended**: Drop the partial index; keep the composite; S-04 adds the partial later via `CREATE INDEX CONCURRENTLY`.
- **Fix B**: Keep both indexes.
- **Decision**: FIXED via Fix A (composite-only index in Phase 1; partial index deferred to S-04 with explicit note in Performance Considerations and brief)

### F5 — "Record password in SQL header as comment" creates an unnecessary credential surface

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Two test users contract
- **Detail**: For Studio/psql SQL impersonation, only the UUID is needed — not the password. Putting a password in a committed SQL comment is a credential in git history for no benefit.
- **Fix**: Reworded to make explicit that the password is irrelevant (let Studio auto-generate, discard) and that the SQL file only records UUIDs.
- **Decision**: FIXED (Fix in plan applied)
