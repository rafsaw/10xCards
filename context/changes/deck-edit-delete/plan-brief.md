# Saved Card Library (S-03) — Plan Brief

> Full plan: `context/changes/deck-edit-delete/plan.md`

## What & Why

Build the saved card library (roadmap S-03; PRD US-03, FR-009–012): a place where users manually create cards, browse their saved cards, edit front/back, and hard-delete. Despite the change-id `deck-edit-delete`, there is **no "deck" entity** — "deck" is loose shorthand for the saved library. Editing is the only post-save refinement path (candidate-edit was dropped), and a browse surface is the prerequisite that hosts edit and delete.

## Starting Point

The `cards` table, its RLS policies, and the SR lifecycle already exist (delivered by F-01 and used by `/generate` and `/review`). There is currently **no manual-create form and no browse surface** — `/dashboard` is just a greeting plus Generate/Review CTAs.

## Desired End State

A logged-in user opens `/library` from a dashboard CTA, types a front/back to save a card, sees all saved cards newest-first, edits any card's text inline, and hard-deletes a card behind a confirmation prompt. Manually-created cards enter the SR lifecycle exactly like AI-accepted ones; editing text never disturbs a card's review schedule; RLS guarantees no cross-user access.

## Key Decisions Made

| Decision                | Choice                                  | Why (1 sentence)                                                              | Source |
| ----------------------- | --------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Scope = decks or cards? | Card library (no deck entity)           | No decks exist in PRD/schema; S-03 is the saved-card library.                | Plan   |
| Schema changes          | None                                    | `cards` table + RLS already cover create/browse/edit/delete.                 | Research |
| Library location        | Dedicated `/library` route              | Keeps `/dashboard` from becoming a catch-all (lessons.md).                   | Plan   |
| Create form placement   | On the library page (above the list)    | Matches `generate.astro`'s form-above-list pattern; create→see-it in one screen. | Plan |
| Edit UX                 | Inline edit in the row                  | No modal primitive needed; edit-in-context suits a flat list.               | Plan   |
| Delete confirm          | Native `window.confirm()`               | Satisfies the required confirm step with zero new UI; already used elsewhere. | Plan |
| Edit & SR schedule      | Preserve schedule                       | FR-011 is refinement/typo fixing, not relearning.                           | Plan   |
| Post-mutation refresh   | Full reload of `/library`               | Matches every existing mutation in the app; always DB-consistent.           | Plan   |
| List scope              | Saved only, newest-first, no pagination | Roadmap mandates a plain flat list; MVP volumes are small.                   | Plan   |

## Scope

**In scope:** `/library` route (protected); manual create (`POST /api/cards`); browse saved cards; inline edit (`PATCH /api/cards/[id]`); hard-delete with confirm (`DELETE /api/cards/[id]`); dashboard CTA.

**Out of scope:** any deck/grouping entity; schema changes; soft-delete/undo; pagination/search/sort/filter; drafts in the list; review-status columns; custom modal/toast primitives; schedule reset on edit.

## Architecture / Approach

Three thin endpoints under `src/pages/api/cards*` follow the existing auth → SSR client → user-scoped query → `{error,message}` JSON pattern; RLS is the security boundary (no `service_role`). `/library.astro` server-renders the saved list (like `generate.astro`) and hosts React islands: a create form (modeled on `PasteAndGenerateForm`) and a card list whose rows toggle to inline edit and delete behind `window.confirm()`. All mutations reload `/library` on success.

## Phases at a Glance

| Phase                         | What it delivers                                  | Key risk                                            |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| 1. Mutation API endpoints     | create / edit / delete endpoints (RLS-scoped)     | Create must set `next_due_at=now()` or card never reviews |
| 2. `/library` browse + create | Protected page, server-rendered list, create form, dashboard CTA | Forgetting `PROTECTED_ROUTES` leaks the page |
| 3. Inline edit + delete       | In-row edit + confirmed delete wired to Phase 1   | Edit accidentally touching schedule fields          |

**Prerequisites:** F-01 (cards schema + RLS) — done.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Hard delete is irreversible — confirmation is the only guard (accepted per FR-012).
- No pagination — a very large library renders all rows; acceptable for single-user MVP.
- Edit preserves maturity even for heavily-rewritten cards (accepted per FR-011 intent).

## Success Criteria (Summary)

- A user can create, browse, edit, and delete saved cards entirely from `/library`.
- Manually-created cards become due for review like AI-accepted cards; edits leave the schedule intact.
- No user can see or mutate another user's cards (verified with a second account).
