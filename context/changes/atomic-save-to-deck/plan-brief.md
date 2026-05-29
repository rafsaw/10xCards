# S-02: Atomic Save to Deck (north star) — Plan Brief

> Full plan: `context/changes/atomic-save-to-deck/plan.md`

## What & Why

Close the AI capture loop. The user reviews the persisted draft batch from S-01, marks accept/reject per candidate, and confirms once; accepted drafts become saved library cards (entering the SR lifecycle), rejected ones are hard-deleted — **atomically**, never a half-saved state. This is the validation milestone for the PRD Primary Success Criterion and satisfies FR-006 (accept → library) and FR-007 (reject → discard, no save).

## Starting Point

S-01 already persists AI candidates as `status='draft'` rows and renders them read-only on `/generate` (`generate.astro:59-87`), with only a bulk "Discard all" action. F-01's `cards` schema and per-user RLS are live on remote Supabase. There is no per-card accept/reject and no save path yet.

## Desired End State

`/generate`'s draft list becomes an interactive React island: each candidate has a Keep/Discard toggle (default Keep) and a live "N to save · M to discard" summary. A confirmed "Save to deck" atomically promotes the kept drafts to `status='saved'` with `next_due_at = now()` and deletes the discarded ones, then returns the user to an empty `/generate` ready for the next passage.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Interaction model | Batch-atomic confirm | Roadmap S-02 specifies one all-or-nothing confirm, not per-card actions | Roadmap / Plan |
| Atomicity mechanism | Postgres RPC (`SECURITY INVOKER`) in one transaction | Genuine all-or-nothing with RLS still applied inside; answers Open Roadmap Q#3 | Plan |
| Draft-review rendering | React island (`DraftReviewList`) | Rich curation UX (the product wedge) + natural home for batch state | Plan |
| Default per-card decision | Default accept, resolve the whole batch | AI candidates are usually good; curation = removing a few; cleanly closes the loop | Plan |
| Initial `next_due_at` | `now()` (due immediately) | Card is reviewable at once; null would hide it from S-04's `next_due_at <= now()` query | Plan |
| Post-save landing | Stay on `/generate` (now empty) | Matches PRD "or can paste a new passage"; keeps the loop flowing | Plan |
| Confirm step | Summary confirm dialog before save | Rejected cards are hard-deleted (FR-007, irreversible); guards an irreversible step | Plan |

## Scope

**In scope:** finalize DB function + migration; `POST /api/generations/save`; `DraftReviewList` island; wiring into `/generate`; remote + production verification.

**Out of scope:** SR scheduling formula (S-04); candidate editing (PRD non-goal); library/browse + review UI (S-03/S-04); three-state "skip"; per-card immediate actions; undo of discards; any env/middleware/dashboard change; new dependencies.

## Architecture / Approach

`DraftReviewList` (client island) holds per-card decisions → on confirmed Save, POSTs `{ accept[], reject[] }` to `/api/generations/save` → the endpoint calls `supabase.rpc('finalize_drafts', …)` through the **SSR client** (carrying the user's JWT). The function, invoker-rights so RLS applies, runs `UPDATE … status='saved', next_due_at=now() WHERE id=any(accept) AND status='draft'` then `DELETE … WHERE id=any(reject) AND status='draft'` in one transaction, returning affected counts. The `status='draft'` guard makes it idempotent under double-submit / two tabs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Finalize DB function + migration | Atomic, RLS-confined `finalize_drafts(uuid[],uuid[])` on remote | `SECURITY DEFINER` by mistake would bypass RLS (ship-blocking) |
| 2. Save endpoint | `POST /api/generations/save` calling the RPC | Untyped `rpc` result tripping lint; cross-user id handling |
| 3. Draft-review island + wire-in | Interactive Keep/Discard UI + confirmed save on `/generate` | State/UX correctness; preserving the no-JS discard path |
| 4. Production verification | Closed loop + two-user RLS observed live | Confirming no partial-state residue after a save |

**Prerequisites:** F-01 (live) and S-01 (live, implemented). Remote Supabase link for `db push`; the two F-01 test users for RLS verification.
**Estimated effort:** ~2 sessions across 4 phases (1 DB + verify, 1 endpoint + UI + prod).

## Open Risks & Assumptions

- Assumes a PostgREST `rpc()` to an invoker-rights function evaluates `auth.uid()` as the caller so RLS confines its writes — verified explicitly in Phase 1 (`verify-finalize.sql`).
- Assumes the two F-01 test users still exist on remote with the UUIDs recorded in `cards-schema-and-rls/verify-rls.sql`.
- No library UI yet, so post-save success is verified in Supabase Studio (intentional — browse is S-03).

## Success Criteria (Summary)

- A user resolves a draft batch in one confirmed action; accepted cards become `saved` (due now), rejected cards vanish, nothing is left half-resolved.
- Failures roll back cleanly — drafts stay intact and the user can retry.
- No user's save/discard ever touches another user's rows (RLS confinement proven on remote and production).
