# SRS Review Session (S-04) — Plan Brief

> Full plan: `context/changes/srs-review-session/plan.md`
> Research: `context/changes/srs-review-session/research.md`
> Decision analysis: `context/changes/srs-review-session/algorithm-decision.md`

## What & Why

Implement roadmap S-04: a logged-in user reviews due flashcards one at a time, reveals the back,
rates recall right/wrong (FR-014), and the next-review date updates and persists. This closes the
PRD Secondary Success Criterion (US-02, FR-013/014/015) — the spaced-repetition payoff of building a
deck.

## Starting Point

F-01 and S-02 are done. The `cards` table already reserves every scheduling field (`repetition_count`,
`interval_days`, `next_due_at`, `last_reviewed_at`), and saved cards arrive at box 0 / due-now via
`finalize_drafts`. What's missing is the partial due-index, an `interval_days >= 0` check, and the
entire review feature (scheduler, endpoint, page, island). No `efactor`/SM-2 anything exists.

## Desired End State

A protected `/review` page (reached from a dashboard CTA) loads the user's due cards oldest-first and
runs a reveal→rate→advance loop. Each rating persists a Leitner box update; the screen advances
without a reload. Empty and session-complete states guide the user back to the dashboard. Double-taps
and retries can't double-promote a box.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| SR algorithm | Leitner boxes (box = `repetition_count`) | Zero schema delta, no dependency, and binary right/wrong IS the native model — adaptivity SM-2 adds is inert under binary input | Research / Plan |
| Route placement | Dedicated `/review` + dashboard CTA | `lessons.md` mandates not piling surfaces onto `/dashboard`; a focused full-screen loop fits the UX | Plan |
| Session feed | Server-loaded batch queue, client advances index | Mirrors the proven `generate.astro` recipe; instant advance, no per-card round-trip; order-by IS the Guardrails fallback | Research / Plan |
| Idempotency | Box-guarded WHERE (`and repetition_count=<expectedBox>`) | Cheap, server-authoritative, fits the `finalize_drafts` fail-closed pattern; replay matches 0 rows | Research / Plan |
| Box intervals | `[1, 2, 4, 7, 15, 30]` days | The spec default — sane MVP curve, no divergence to reason about | Plan |
| Empty/complete UX | Friendly done-state + dashboard link | Honors the PRD Guardrail that review always resolves gracefully; reuses the cosmic shell | Plan |

## Scope

**In scope:** partial due-index + interval check migration; `src/lib/leitner.ts` scheduler;
`/api/reviews` endpoint with box-guarded write; `/review` page + `ReviewSession` island; dashboard CTA.

**Out of scope:** SM-2/`efactor`/`supermemo`; FSRS/multi-grade; RPC for the write; same-session
re-surfacing of "wrong" cards; retired/suspended state; zod/CSRF; generated types; DST-aware intervals.

## Architecture / Approach

Bottom-up vertical slice. `leitner.ts` is a pure edge-safe function (`schedule(box, rating)`).
`/api/reviews` clones the S-01/S-02 endpoint scaffolding and does a single owner-scoped, box-guarded
`supabase.update()` (RLS gives cross-user isolation for free; a 0-row match means "already
applied"/stale id → reported as success-no-change). `review.astro` server-queries the due queue and
renders `ReviewSession` (`client:load`), which runs the reveal→rate→advance loop with `useState` and
raw `fetch`, plus empty/complete/error states in the existing glassmorphism language.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema migration | Partial due-index + `interval_days >= 0` check | None — additive, non-breaking |
| 2. Scheduler + endpoint | `leitner.ts` + `/api/reviews` box-guarded write | First single-row `.update()` in repo; idempotency correctness |
| 3. Page + island + CTA | `/review` route, review loop, empty/complete states, dashboard CTA | Reveal→rate→advance state loop has no existing precedent |

**Prerequisites:** F-01 and S-02 (both done). Remote Supabase access to apply the migration.
**Estimated effort:** ~1–2 sessions across 3 phases; mostly pattern-cloning, one new function + one island.

## Open Risks & Assumptions

- The queue is a point-in-time snapshot — cards rated "wrong" (due again today) won't reappear until
  the next session/reload. Accepted as an MVP simplification.
- The box-guarded write requires the client to send the box it saw; a legitimate concurrent change
  would be treated as a no-op (fine for single-user sessions).
- No test runner exists; correctness of `schedule()` rests on manual verification.

## Success Criteria (Summary)

- A user can complete a review session end-to-end and ratings persist across reloads.
- Review always resolves gracefully — something to study, or a clear "all caught up" state.
- Ratings are replay-safe: no double-promotion from double-tap/retry/refresh.
