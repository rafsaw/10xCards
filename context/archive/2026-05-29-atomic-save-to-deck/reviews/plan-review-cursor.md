<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-02 Atomic Save to Deck (north star)

- **Plan**: `context/changes/atomic-save-to-deck/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: REVISE
- **Findings**: 0 critical · 3 warnings · 1 observation
- **Reviewer**: Cursor Agent (Composer) — code verification sub-agent: `fast` (`composer-2.5-fast`)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

6/6 paths ✓, 5/5 symbols ✓ (`cards_update_own`, `cards_delete_own`, `createClient`, `PasteAndGenerateForm`, `PROTECTED_ROUTES`), brief↔plan ✓. Progress↔Phase: 4/4 phases mapped; 32/32 criteria items present. Code verification: no `.rpc()` in `src/` yet (expected); RLS policies and index confirmed in F-01 migration; S-01 append-all-drafts behavior confirmed.

## Findings

### F1 — Server does not enforce “resolve entire batch”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — Save endpoint; Desired End State
- **Detail**: The plan promises “Save resolves the entire current batch; zero drafts remain afterward.” Phase 2 only validates array shape and a 100-id cap — it does not require `accept ∪ reject` to equal the caller’s current `status='draft'` set. `finalize_drafts` only touches ids in the arrays. A partial or crafted body leaves orphan `draft` rows while the UI may still redirect on `response.ok`. S-01 explicitly allows multiple generates to append drafts.
- **Fix A ⭐ Recommended**: Add server-side completeness in Phase 2 — before rpc, fetch draft ids for `auth.uid()`, require disjoint accept/reject, and reject with `400 incomplete_selection` if union ≠ all drafts (or if union is empty when drafts exist).
  - Strength: Matches north-star “close the loop”; blocks partial saves and ambiguous 0/0 success.
  - Tradeoff: Extra SELECT round-trip per save (negligible at expected draft counts).
  - Confidence: HIGH — same belt-and-braces style as discard endpoint.
  - Blind spot: None significant for happy-path UI.
- **Fix B**: Keep thin endpoint; in `DraftReviewList`, after 200 compare `saved + discarded` to `drafts.length` and block redirect with a banner if counts mismatch.
  - Strength: Smaller Phase 2 diff.
  - Tradeoff: Malicious/crafted API calls still leave orphans; curl tests won’t catch completeness.
  - Confidence: MEDIUM — fixes UX only.
  - Blind spot: API-only callers.
- **Decision**: PENDING

### F2 — Phase 1.7 assumes globally empty `cards` table

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Success Criteria 1.7 / Progress 1.7
- **Detail**: Step 1.7 requires `select count(*) from public.cards` as `service_role` = 0 after cleanup. F-01 used the same pattern when the remote DB had only fixtures. After Phase 4 dogfooding or real users, that assertion fails even when fixture cleanup succeeded — or encourages misreading “delete everything” as success.
- **Fix**: Scope the assertion to fixture users only, e.g. `select count(*) from public.cards where user_id in (<A>, <B>)` = 0, and drop the global table count from automated criteria (keep global check only in a comment: “run only on empty dev DB”).
- **Decision**: PENDING

### F3 — “≤10 per batch” understates real draft cardinality

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Performance Considerations; Phase 3 island props
- **Detail**: Performance says “Batches are ≤ 10 drafts (S-01's cap),” but S-01 caps each *generate* at 10 and *appends* new drafts. `generate.astro` loads all user drafts with no limit. A user who generates twice before saving can have >10 rows; the island receives them all. Not a correctness bug for atomicity, but the plan’s sizing assumption and manual “N to save” UX are wrong for that path.
- **Fix A ⭐ Recommended**: Document in Current State / Performance that the review surface covers all caller drafts (often ≤10, may be >10 after multiple generates); keep cap 100 on the endpoint.
  - Strength: Honest implementer expectations; no code change required now.
  - Tradeoff: Doesn’t prevent unbounded growth if users never save.
  - Confidence: HIGH — behavior is already live from S-01.
  - Blind spot: Product decision on blocking generate while drafts exist is still open (out of S-02 scope per plan).
- **Fix B**: In S-02, block Save until draft count ≤ 10 or split UI by `created_at` batch — larger scope.
  - Strength: Restores strict “batch” semantics.
  - Tradeoff: Scope creep beyond S-02; fights S-01 append behavior.
  - Confidence: LOW — not requested in roadmap.
  - Blind spot: PRD/US-01 wording on “batch” vs “all pending drafts”.
- **Decision**: PENDING

### F4 — First `supabase.rpc()` in the app

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Save endpoint
- **Detail**: No `.rpc(` usage exists under `src/` today. The SSR client + RLS pattern is proven (`generations.ts`, `discard.ts`); only the RPC call shape is greenfield. Planned `FinalizeResult` + `overrideTypes` matches `generate.astro:24`.
- **Fix**: During Phase 2, confirm PostgREST returns a single row for `returns table (...)` and that param names `p_accept_ids` / `p_reject_ids` match the migration — note the working curl example in Progress 2.4 once.
- **Decision**: PENDING

## What looks solid (no finding)

- **SECURITY INVOKER + RLS** — Correct centerpiece; policies exist in F-01 migration. Plan correctly forbids `service_role` on the finalize path.
- **Plpgsql SQL** — `RETURNS TABLE` + `GET DIAGNOSTICS` pattern is valid; pinned function body is implementable as written.
- **Progress contract** — Single `## Progress`, 4 phases, 32 checklist items aligned with phase Success Criteria.
- **Patterns** — Reuses `json()` helper, SSR `createClient`, island + `window.location.assign`, native discard form + redirect.
- **Open roadmap Q#3** — Resolved with DB transaction + `status='draft'` idempotency guard.
- **Lessons** — Keeps action on `/generate`; no silent `/dashboard` pile-on.
