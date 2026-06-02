# UX Improvements (S-06) — Plan Brief

> Full plan: `context/changes/ux-improvements/plan.md`

## What & Why

Six independent UX friction-points observed while building S-01…S-04 get polished on surfaces that are already `done`: post-login redirect, a persistent nav banner, missing loading spinners, review-session reset, bulk draft accept/reject, and library pagination + keyword search. Each ships standalone — no half-implemented state.

## Starting Point

The app is server-render-first (Astro pages fetch data, pass it to small React islands). Today a logged-in user lands on the marketing home; navigation lives only as an inline box on the dashboard; two action buttons lack spinners; the library fetches *all* saved cards with no paging or search; and the draft-review and review-session contracts (atomic accept/reject, schedule durability) are intentionally rigid.

## Desired End State

Signing in lands on `/dashboard`. A top banner on every authed screen jumps between Generate / Review / Library. Every action shows an in-flight spinner. A review session can be restarted in place. A whole draft batch can be accepted/rejected in one click. The library pages through results and keyword-searches across the full set.

## Key Decisions Made

| Decision               | Choice                                              | Why (1 sentence)                                                              | Source |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| Post-login redirect    | Redirect at the page (`index.astro`)                | One-line change; keeps middleware focused on protection, `/` valid for guests | Plan   |
| Pagination             | Server-side offset, `?page` param                   | Matches server-render pattern; offset fine at MVP scale (roadmap-confirmed)   | Plan   |
| Search                 | Server-side `.ilike`, searches full set             | Finds cards on any page; composes with offset pagination                      | Plan   |
| Nav banner             | Extend `Topbar.astro`, render in `Layout` for authed| Reuses existing component; appears on every authed screen automatically       | Plan   |
| Bulk draft actions     | Accept-all / Reject-all + keep per-card toggles     | Biggest ergonomics win; honors `save.ts` completeness guard, no API change    | Plan   |
| Reset session          | Restart over the same fetched cards                 | Pure client state; can't corrupt the persisted schedule                       | Plan   |
| Loading states         | Fill button-spinner gaps only                       | Consistent with existing inline `Loader2` convention; low risk                | Plan   |
| Priority order         | Quick wins first                                    | Front-loads high-value/low-risk; FR-010-extending paging/search lands last    | Plan   |

## Scope

**In scope:** post-login redirect, nav banner, two loading-spinner gaps, review-session reset, bulk draft accept/reject, library pagination + keyword search.

**Out of scope:** cursor pagination, a client-side cards list API, skeleton loaders, a shared Spinner primitive, checkbox multi-select on drafts, any change to `/api/reviews` / `/api/generations/save` / scheduler contracts, refetching due cards on reset.

## Architecture / Approach

All changes are page/component-level on existing Astro pages and React islands. Server-side query changes (`library.astro`) for paging/search; client-state-only changes (`ReviewSession`, `DraftReviewList`) for reset and bulk; a one-line redirect (`index.astro`); and a shared nav via `Topbar.astro` + `Layout.astro`. No schema, migration, or API-contract changes.

## Phases at a Glance

| Phase                          | What it delivers                          | Key risk                                            |
| ------------------------------ | ----------------------------------------- | --------------------------------------------------- |
| 1. Post-login redirect         | Authed `/` → `/dashboard`                 | Redirect loop if guard mis-gated                    |
| 2. Navigation banner           | Top nav on every authed screen            | Duplicate nav / showing on auth pages               |
| 3. Loading-state gaps          | Spinners on draft-save + rate buttons     | Breaking the re-entrancy lock                       |
| 4. Reset review session        | In-place "Restart session"                | Accidentally refetching / corrupting schedule       |
| 5. Bulk draft actions          | Accept-all / Reject-all                   | Tripping the `save.ts` completeness guard           |
| 6. Library pagination + search | `?page` + `?q` server-side                | Extends FR-010 — confirm MVP-worthy or park         |

**Prerequisites:** F-01 (done). All target surfaces (S-01…S-04) are `done`, so no contention with active slices.
**Estimated effort:** ~1–2 sessions across 6 small, independent phases.

## Open Risks & Assumptions

- Pagination + search extend FR-010 beyond its letter (a deliberate S-03 scope-guard) — Phase 6 needs a conscious "MVP-worthy or park" call before merge.
- `.ilike` search is unindexed; fine at MVP scale, revisit with FTS/trigram only if the library grows large.
- Bulk actions and reset touch the atomic-finalize (S-02) and scheduler (S-04) surfaces — verified to need no contract change, but manual checks confirm atomicity/durability hold.

## Success Criteria (Summary)

- A signed-in user lands on the dashboard and navigates between all screens via the banner without backtracking.
- Every action shows clear in-flight feedback; sessions can be restarted and whole draft batches handled in one click.
- The library pages and searches across the full card set, with no regression to edit/create/delete.
