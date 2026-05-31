<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: SRS Review Session (S-04)

- **Plan**: context/changes/srs-review-session/plan.md
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-05-31
- **Verdict**: APPROVED (with one reliability nit worth fixing)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Drift sweep: all 7 implementation files MATCH the plan; no missing items, no scope
creep; every "What We're NOT Doing" guardrail respected (no SM-2/efactor, no FSRS,
no RPC for the rating write, no same-session re-surfacing, no retired/suspended
state, no zod/CSRF, no generated-types step, fixed 24h intervals).

Note: the safety sub-agent raised an "unbounded currentBox → uncaught RangeError"
observation; this was verified to be a **false positive** and dropped — `schedule()`
clamps `nextBox = Math.min(box + 1, MAX_BOX)`, so `BOX_INTERVALS_DAYS[nextBox]` is
never undefined regardless of the incoming box, and a large box also no-ops on the
`.eq("repetition_count", box)` guard.

## Findings

### F1 — Client double-click can skip a card (index advances by 2)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/review/ReviewSession.tsx:81-119
- **Detail**: The plan's success criterion 3.8 ("double-submit does not double-advance
  the box") holds — the server box guard (`.eq("repetition_count", currentBox)`) makes
  the DB write idempotent, so a replay returns `applied:false` and the box is never
  double-promoted (manually confirmed). BUT the client cursor is not equally protected.
  `submitting` is async React state; `disabled={submitting}` only applies on the next
  render. Two clicks in the same frame both enter `handleRate` before the button
  disables, firing two POSTs. Both return 200 (first `applied:true`, second
  `applied:false`), and BOTH run `setIndex(prev => prev + 1)` — so the index jumps by 2
  and the next card is silently skipped (it reappears next session, unrated). DB safe;
  UX skips a card.
- **Fix**: Add a synchronous re-entrancy guard with `useRef` at the top of `handleRate`
  (e.g. `if (lockRef.current) return; lockRef.current = true;` released in a `finally`),
  instead of relying on the async `submitting` state to block the second invocation.
  ~4 lines, no behavior change for the normal path.
- **Decision**: FIXED — added `lockRef` (useRef) synchronous re-entrancy guard in
  `handleRate`, with `submitting`/lock reset moved to a `finally`. Lint + build pass.

### F2 — Supabase-unconfigured UX is less precise than the sibling page

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/review.astro:26-27
- **Detail**: generate.astro renders a distinct "Supabase is not configured" banner
  separate from its load-error banner. review.astro collapses the `!supabase` case into
  `loadError=true`, showing the generic "couldn't load your review session" message.
  Fails closed and safe — just a vaguer diagnostic. The plan said "mirror generate.astro";
  this is a minor, benign simplification.
- **Fix**: (optional) split the `!supabase` case into its own message for parity.
- **Decision**: PENDING

### F3 — Non-concurrent CREATE INDEX takes a brief SHARE lock

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (Data safety)
- **Location**: supabase/migrations/20260531120000_cards_due_index_and_interval_check.sql:12
- **Detail**: Plain `CREATE INDEX` briefly locks `cards` against writes. Negligible for
  MVP table sizes, and the migration is already applied remotely — noted only for
  awareness if `cards` ever becomes a large hot table.
- **Fix**: none needed for MVP.
- **Decision**: PENDING
