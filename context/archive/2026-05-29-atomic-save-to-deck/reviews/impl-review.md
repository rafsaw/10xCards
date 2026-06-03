<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-02 Atomic Save to Deck

- **Plan**: context/changes/atomic-save-to-deck/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-05-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Notes:
- **Plan Adherence** — every Phase 1–3 contract matches the implementation at the intent level (largely verbatim). No DRIFT / MISSING / EXTRA.
- **Scope Discipline** — all nine "What We're NOT Doing" guardrails verified respected (no SR formula, no candidate editing, no three-state, no per-card actions, no undo, no library UI, no changes to /api/generations / paste form / env / config-status / middleware / dashboard, no generated Supabase types, no new deps).
- **Safety & Quality** — core security design verified: `finalize_drafts` is `SECURITY INVOKER`; endpoint routes through the RLS-scoped SSR `createClient` (anon key, no service-role anywhere); completeness guard correctly rejects partial / duplicate / overlapping / cross-user selections before the rpc; 100-id cap present; `status='draft'` guards make double-submit idempotent; hard-delete safely scoped by RLS + status guard.
- **Success Criteria** — Automated: `npm run lint` exit 0, `npm run build` exit 0 (re-run at review time). Manual: all Phase 1–4 Progress rows `[x]` with observed evidence (Phase 1 verify-finalize.sql on remote; Phase 2 endpoint harness 2.4–2.9 all PASS; Phase 3 UI walkthrough incl. forced-failure rollback; Phase 4 production two-user loop + Studio isolation/atomicity).

## Findings

### F1 — Completeness `select` relies on RLS only; sibling `discard.ts` also filters `user_id`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/generations/save.ts:62-66
- **Detail**: The draft-set query is `supabase.from("cards").select("id").eq("status","draft")` with no `.eq("user_id", user.id)`. This is *correct* because the SSR client is RLS-scoped to `auth.uid()` (verified: `src/lib/supabase.ts` uses the anon `SUPABASE_KEY`, not service role), so the result is already confined to the caller. However, the sibling `src/pages/api/generations/discard.ts:22` adds `.eq("user_id", user.id)` in addition to RLS as defense-in-depth. Adding it here would make the two endpoints consistent and remove any doubt for a future reader. Behavior is identical under RLS. The plan explicitly chose the RLS-only form ("no explicit user_id filter needed"), so this is a pattern nit, not a defect.
- **Fix**: Add `.eq("user_id", user.id)` to the draft-set select in save.ts to mirror discard.ts (one line, zero behavior change under RLS).
- **Decision**: SKIPPED — conscious choice; correct under RLS, plan deliberately chose the RLS-only form.

### O1 — `FALLBACK_MESSAGES[code]` fallback is effectively dead code (copied from sibling)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/generate/DraftReviewList.tsx:79
- **Detail**: `setError({ code, message: message || FALLBACK_MESSAGES[code] })` — because `message` already defaults to a non-empty generic string (line 67) and is only overwritten by a *truthy* server message (line 74), the `|| FALLBACK_MESSAGES[code]` branch never fires, so the `FALLBACK_MESSAGES` map (lines 15-22) is never actually consulted. This is faithfully copied from `PasteAndGenerateForm.tsx:78` (same pattern), so it is internally consistent with the codebase. Harmless; the map also documents expected error codes. Safe to leave.
- **Fix**: None required. (Optional: drop the unused map, or use it as the primary source keyed by `code` — but that would diverge from the sibling pattern.)
- **Decision**: SKIPPED — observation only; consistent with sibling pattern, harmless.
