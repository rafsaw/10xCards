<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-02 Atomic Save to Deck (north star)

- **Plan**: `context/changes/atomic-save-to-deck/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: REVISE
- **Findings**: 0 critical · 3 warnings · 1 observation
- **Reviewer**: Claude (Opus 4.8). Cross-checked against the prior Cursor review (`plan-review_cursor.md`); findings converge, with one impact downgrade on F1 (HIGH → MEDIUM).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

6/6 paths ✓. Symbols ✓ — `cards_update_own` / `cards_delete_own` confirmed with `USING` + `WITH CHECK (select auth.uid()) = user_id` (migration L46-53), `cards_user_id_status_idx` on `(user_id, status)` (L30), `status` check `in ('draft','saved')` (L21), `next_due_at` nullable (L22). No `.rpc(` anywhere under `src/` (greenfield call shape — expected). Brief↔plan consistent (phases, decisions, scope match). Progress contract clean: single `## Progress`, 4 phases mapped 1:1, 32/32 criteria items present, no stray checkboxes in phase bodies. Independently confirmed `generate.astro:19-24` fetches all `status='draft'` rows with **no `.limit()`** (strengthens F3) and `discard.ts:22` deletes via `user_id` + `status='draft'` (pattern F1 Fix A reuses).

## Findings

### F1 — Server doesn't enforce "resolve entire batch"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — Save endpoint; Desired End State
- **Detail**: The plan promises "Save resolves the entire current batch; zero drafts remain afterward." Phase 2 only validates array shape + a 100-id cap; `finalize_drafts` touches only the ids passed in. The union `accept ∪ reject` is never required to equal the caller's current `status='draft'` set, so a partial or hand-crafted body leaves orphan `draft` rows while the island redirects on `response.ok`. **Impact downgraded from Cursor's HIGH to MEDIUM**: the island initializes `decisions` with every draft id → `accept` (Phase 3), so the happy path always sends the full set. Realistic triggers are narrow — (a) a second tab/generate appends drafts after page-load, or (b) a crafted API call — and the failure mode is mild: leftover drafts simply reappear on the `/generate` reload (verified `generate.astro:19-24` re-fetches all drafts). No corruption, no half-saved state, no cross-user leak (RLS holds). This is a promise-accuracy/robustness gap, not architectural stakes.
- **Fix A ⭐ Recommended**: Server-side completeness guard in Phase 2 — before the rpc, SELECT the caller's draft ids; require accept/reject disjoint and their union == all current drafts, else `400 incomplete_selection`.
  - Strength: Makes the "zero drafts remain" promise true even for API-only callers; same belt-and-braces filter as `discard.ts:22`.
  - Tradeoff: One extra RLS-scoped SELECT; the endpoint stops being purely "thin."
  - Confidence: HIGH — mirrors the existing `user_id` + `status` filter pattern.
  - Blind spot: Append-after-load (tab B) now turns a save into a 400 the user must refresh past — UX needs a refresh hint.
- **Fix B**: Soften the promise + client-side guard only — drop "zero drafts remain" to "resolves the drafts shown"; in the island, after 200 compare `saved+discarded` to `drafts.length` and block redirect with a banner on mismatch.
  - Strength: Keeps Phase 2 thin; smaller diff.
  - Tradeoff: Crafted/API callers can still orphan drafts; curl tests won't catch completeness.
  - Confidence: MED — fixes UX, not the contract.
  - Blind spot: None significant beyond API-only callers.
- **Decision**: FIXED via Fix A — Phase 2 Contract now adds a completeness guard (fetch caller's draft ids; require accept/reject disjoint and union == all drafts, else `400 incomplete_selection`). Phase 2 verification + Progress 2.4/2.7/2.8 updated; Desired End State cross-user statement reframed as guard-then-RLS; Phase 3 island gains an `incomplete_selection` refresh-prompt banner.

### F2 — Phase 1.7 / 4 assert a globally empty `cards` table

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Success Criteria 1.7 / Progress 1.7 (`verify-finalize.sql`)
- **Detail**: Step 1.7 requires `select count(*) from public.cards` as `service_role` = 0 after fixture cleanup. That holds only on an empty DB. The remote project already ran S-01 and F-01 RLS fixtures, and Phase 4 dogfoods real saved cards on that same remote — after which a global count=0 either fails despite correct fixture cleanup or, worse, invites "delete everything" as a pass condition. The verify artifact is meant to be re-runnable; a global assertion isn't.
- **Fix**: Scope the assertion to the two fixture users — `... where user_id in (<A>,<B>)` = 0 — and demote the global count to a commented "only on an empty dev DB" note.
- **Decision**: FIXED — Phase 1 cleanup block, Manual criterion, and Progress 1.7 now scope the count to `user_id in (<A>, <B>)` and explicitly forbid a global `count(*) = 0`.

### F3 — "≤10 per batch" understates real draft cardinality

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Performance Considerations; Phase 3 island props
- **Detail**: Performance says "Batches are ≤ 10 drafts (S-01's cap)." Confirmed wrong: S-01 caps each *generate* at 10 and *appends* (`generations.ts` inserts without clearing), and `generate.astro:19-24` loads ALL `status='draft'` rows with **no `.limit()`**. So a user who generates twice before saving has >10 rows, all passed to the island. Not an atomicity bug — the 100-id endpoint cap absorbs it — but the sizing assumption and "N to save" framing are off, and nothing bounds draft growth if a user never saves.
- **Fix A ⭐ Recommended**: Correct the plan's framing — state in Current State / Performance that the review surface covers all of the caller's drafts (usually ≤10, can exceed it after repeated generates); keep the 100 endpoint cap. Doc-only.
  - Strength: Honest implementer expectations; no code churn; matches live S-01 behavior.
  - Tradeoff: Leaves unbounded-draft-growth as an open product item.
  - Confidence: HIGH — behavior verified in code, already live.
  - Blind spot: Whether product wants to bound it (out of S-02 scope).
- **Fix B**: Bound it now — block save >10, or batch the UI by `created_at`.
  - Strength: Restores literal "batch" semantics.
  - Tradeoff: Scope creep; fights S-01's append design.
  - Confidence: LOW — not in the roadmap for S-02.
  - Blind spot: PRD wording on "batch" vs "all pending drafts".
- **Decision**: FIXED via Fix A — Performance Considerations rewritten: batch size is not bounded at 10, the review surface covers all of the caller's drafts (can exceed 10 after repeated generates), the 100-id cap is sized for that, and bounding draft accumulation is called out as a separate out-of-scope product decision.

### F4 — First `supabase.rpc()` in the codebase

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Save endpoint
- **Detail**: Confirmed no `.rpc(` anywhere under `src/` — the SSR-client + RLS pattern is proven (`generations.ts`, `discard.ts`), but the RPC call shape and the `RETURNS TABLE` single-row read are greenfield. Planned `FinalizeResult` + `overrideTypes` matches `generate.astro:24`.
- **Fix**: During Phase 2, confirm PostgREST returns one row for the `RETURNS TABLE` shape and that param keys `p_accept_ids` / `p_reject_ids` exactly match the migration; pin the working curl in Progress 2.4.
- **Decision**: FIXED — Phase 2 Implementation Note now calls out the first-rpc confirmation (single-row `data?.[0]` read, exact param-key match, pin curl in Progress 2.4).

## What looks solid (no finding)

- **SECURITY INVOKER + RLS** — correct centerpiece; `cards_update_own` / `cards_delete_own` confirmed in F-01 migration. Plan correctly forbids `service_role` on the finalize path.
- **Atomicity & idempotency** — single-transaction function body; `status='draft'` guard on both UPDATE and DELETE handles double-submit / two-tab races without locks. Resolves Open Roadmap Q#3.
- **Plpgsql** — `RETURNS TABLE` + `GET DIAGNOSTICS` is valid; `set search_path=''` is safe (`now()` resolves via pg_catalog, refs are schema-qualified).
- **Progress contract** — single `## Progress`, 4 phases, 32 items aligned with phase success criteria.
- **Patterns** — reuses `json()` helper, SSR `createClient`, island + `window.location.assign`, native discard form + redirect; honors the "no silent /dashboard pile-on" lesson by keeping the action on `/generate`.
