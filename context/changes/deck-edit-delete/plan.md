# Saved Card Library (S-03) Implementation Plan

## Overview

Build the saved card library — roadmap slice **S-03** (PRD US-03, FR-009–012). Despite the change-id `deck-edit-delete`, there is **no "deck" entity** in this product; "deck" is loose shorthand for the saved card library. This plan delivers four user-facing capabilities on a dedicated `/library` page:

- **FR-009** — manually create a card (front/back) saved directly to the library.
- **FR-010** — browse a flat list of saved cards.
- **FR-011** — edit a saved card's front/back.
- **FR-012** — hard-delete a saved card (no soft-delete, no undo) behind a confirmation step.

No database schema work is required — the existing `cards` table and its RLS policies already support everything.

## Current State Analysis

- **Schema is complete.** `public.cards` (migration `supabase/migrations/20260527150510_cards_and_account_deletion.sql`) already has `id`, `user_id`, `front` (non-empty check), `back` (non-empty check), `status` ('draft' | 'saved'), `next_due_at`, `interval_days`, `repetition_count`, `last_reviewed_at`, `created_at`, `updated_at` (auto-bumped by the `cards_set_updated_at` trigger). Index `cards_user_id_status_idx` on `(user_id, status)` already supports the saved-library query.
- **RLS is the security boundary.** Four policies on `cards` — `cards_select_own`, `cards_insert_own`, `cards_update_own`, `cards_delete_own` — all scoped to `(select auth.uid()) = user_id` with both `USING` and `WITH CHECK`. The SSR Supabase client carries the user's JWT, so every query is confined to the caller automatically. App code must never use `service_role`.
- **No library surface exists yet.** `src/pages/dashboard.astro` is a greeting + two CTAs (`/generate`, `/review`). There is no manual-create form and no saved-card browse anywhere.
- **Established patterns to reuse:**
  - API endpoint shape — auth check (`context.locals.user`, 401 if absent) → `createClient(request.headers, cookies)` (503 if null) → JSON body parse (400 on failure) → user-scoped query → `{ error, message }` JSON. See `src/pages/api/generations/save.ts:32-94` and `src/pages/api/generations/discard.ts`.
  - Server-render + React island — `src/pages/generate.astro:19-31` server-fetches via SSR client and passes rows as props to a `client:load` island. The page declares a local row interface and uses `.overrideTypes<T[], { merge: false }>()` (no generated Supabase types in this repo).
  - Client mutation — `src/components/generate/PasteAndGenerateForm.tsx:39-84`: controlled inputs, `fetch` POST, parse `{error,message}`, `window.location.assign()` on success, inline error banner on failure.
  - Confirmation — `window.confirm()` is already used in `src/components/generate/DraftReviewList.tsx`.
  - Primitives — `src/components/ui/button.tsx` (CVA, has `variant="destructive"`); form field `src/components/auth/FormField.tsx`; error banner `src/components/auth/ServerError.tsx`; icons via `lucide-react`.
  - Route protection — `src/middleware.ts` `PROTECTED_ROUTES` array; middleware populates `context.locals.user`.

## Desired End State

A logged-in user clicks a "Card library" CTA on `/dashboard`, lands on `/library`, and can: type a front + back and save a card (it appears in the list); see all their saved cards newest-first; click Edit on a row to change front/back in place and save; click Delete, confirm, and have the card removed. An unauthenticated visit to `/library` redirects to `/auth/signin`. A manually-created card enters the spaced-repetition lifecycle identically to an AI-accepted card (`status='saved'`, `next_due_at=now()`, box 0). Editing front/back leaves the review schedule untouched. No user can ever see or mutate another user's cards (RLS).

Verify: `npm run lint` and `npm run build` pass; manual walkthrough of create / browse / edit / delete on `/library`; a second account sees none of the first account's cards.

### Key Discoveries:

- Manual create = `INSERT` with `status='saved'`, `next_due_at=now()`, leaving `interval_days`/`repetition_count` at their defaults (0) — same lifecycle entry point as the `finalize_drafts` RPC for AI-accepted cards (`supabase/migrations/20260529162956_finalize_drafts_fn.sql`).
- The codebase casts loosely-typed Supabase results via a local interface + `.overrideTypes<T[], { merge: false }>()` — follow this, do not introduce generated types (`generate.astro:25`, `save.ts:66`).
- Mutations in this app reload on success rather than updating client state in place (`PasteAndGenerateForm`, `discard.ts` redirect) — the chosen approach matches this convention.
- `lessons.md`: route placement is a deliberate decision — `/library` is a dedicated route (not piled onto `/dashboard`) and must be added to `PROTECTED_ROUTES`.

## What We're NOT Doing

- **No `decks` table or grouping entity.** Flat per-user card collection only.
- **No schema changes / migrations.** The `cards` table is sufficient.
- **No soft-delete, archive, or undo** for deletion (FR-012 is a hard delete).
- **No pagination, search, filtering, or sorting controls** beyond a fixed newest-first order (roadmap explicitly defers these).
- **No drafts in the library list** — drafts remain on `/generate`; the library shows `status='saved'` only.
- **No review-status/due-date columns** in rows — front + back only.
- **No editing of candidate (draft) cards** before save — PRD non-goal.
- **No custom modal/dialog or toast primitive** — inline edit + native `window.confirm()`.
- **No schedule reset on edit** — editing front/back preserves `next_due_at`, `repetition_count`, `interval_days`.

## Implementation Approach

Three incremental phases: backend first (the three mutation endpoints), then the page that delivers create + browse end-to-end, then the row-level edit/delete actions that wire into the Phase 1 endpoints. Each phase is independently verifiable. Every endpoint uses the SSR client so RLS confines access; no `user_id` filtering is added in app code beyond what aids clear error semantics (RLS is the guarantee). All mutations reload `/library` on success to keep the list consistent with the database without client-side state reconciliation.

## Critical Implementation Details

- **State sequencing on create lifecycle.** A manually-created card MUST be inserted with `status='saved'` AND `next_due_at=now()` together. Omitting `next_due_at` would leave it null, and the review query (`review.astro` / `reviews.ts`) only surfaces saved cards with a non-null `next_due_at <= now()`, so the card would silently never appear for review.
- **Edit must not touch schedule fields.** The `PATCH` endpoint updates only `front` and `back`. The `updated_at` trigger fires automatically; do not set it manually, and do not include `next_due_at`, `repetition_count`, `interval_days`, or `status` in the update payload.

## Phase 1: Card mutation API endpoints

### Overview

Add three JSON endpoints for create, edit, and delete, following the existing API conventions. These are fully testable independently of any UI.

### Changes Required:

#### 1. Create-card endpoint

**File**: `src/pages/api/cards.ts`

**Intent**: Accept a `{ front, back }` JSON body and insert one saved card for the authenticated user, entering the SR lifecycle immediately. Backs FR-009.

**Contract**: `export const POST: APIRoute`. Auth check (401 `unauthorized`), SSR client (503 `supabase_unconfigured`), JSON parse (400 `bad_request`). Validate `front` and `back` are non-empty strings after `trim()` (400 `invalid_card` otherwise). Insert `{ user_id: user.id, front, back, status: "saved", next_due_at: new Date().toISOString() }`; on DB error return 500 `db_error`. On success return the created `{ id, front, back }` (select it back) with 201, or 200 — match the `json()` helper shape used across endpoints. Reuse the local `json()` helper pattern from `save.ts`.

#### 2. Edit-card endpoint

**File**: `src/pages/api/cards/[id].ts`

**Intent**: Update only the `front`/`back` of one saved card the caller owns, preserving its review schedule. Backs FR-011.

**Contract**: `export const PATCH: APIRoute` (or `PUT`). Read `context.params.id`. Same auth/client/parse guards. Validate non-empty trimmed `front`/`back`. Run `supabase.from("cards").update({ front, back }).eq("id", id).eq("status", "saved").select("id")` — RLS confines to the owner; the `.eq("status","saved")` guard prevents editing drafts via this surface. If the update affects zero rows, return 404 `not_found`; DB error → 500 `db_error`; success → 200 with `{ id }`. Do NOT include schedule fields or `updated_at` in the payload (the trigger handles `updated_at`).

#### 3. Delete-card endpoint

**File**: `src/pages/api/cards/[id].ts` (same file, additional export)

**Intent**: Hard-delete one saved card the caller owns. Backs FR-012.

**Contract**: `export const DELETE: APIRoute`. Read `context.params.id`. Auth/client guards. Run `supabase.from("cards").delete().eq("id", id).eq("status", "saved").select("id")` — RLS confines to owner. Zero rows affected → 404 `not_found`; DB error → 500 `db_error`; success → 200 `{ ok: true }`. Confirmation is a UI concern (Phase 3), not enforced here.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- `POST /api/cards` with a valid `{front,back}` (authenticated) creates a card with `status='saved'` and a non-null `next_due_at` (verify in Supabase).
- `POST /api/cards` with empty front or back returns 400; unauthenticated returns 401.
- `PATCH /api/cards/[id]` changes only front/back; `next_due_at`/`repetition_count`/`interval_days` are unchanged and `updated_at` advances (verify in Supabase).
- `DELETE /api/cards/[id]` removes the row; a second request for the same id returns 404.
- A request from one account targeting another account's card id returns 404 (RLS), never another user's data.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: `/library` page — browse + create

### Overview

Add the protected `/library` route that server-renders the saved-card list and hosts the manual create-card form, plus the dashboard entry point. Delivers FR-009 (UI) and FR-010.

### Changes Required:

#### 1. Library page (route + server-rendered browse)

**File**: `src/pages/library.astro`

**Intent**: Server-fetch the user's saved cards via the SSR client and render them newest-first, with the create-card form above the list — mirroring `generate.astro`'s layout. Backs FR-010.

**Contract**: Declare a local `SavedCard` interface `{ id: string; front: string; back: string }`. Query `supabase.from("cards").select("id, front, back").eq("status", "saved").order("created_at", { ascending: false }).overrideTypes<SavedCard[], { merge: false }>()`. Handle the `!supabase` and `loadError` states with the same red-banner markup as `generate.astro`. Render `Layout`, a header with a "← Dashboard" link, the create-card form island, an empty-state message when the list is empty, and the card list island otherwise. Use the existing `bg-cosmic` / `max-w-3xl` page styling.

#### 2. Create-card form island

**File**: `src/components/library/CreateCardForm.tsx`

**Intent**: Controlled front/back inputs that POST to `/api/cards` and reload `/library` on success. Models `PasteAndGenerateForm`. Backs FR-009.

**Contract**: React component, `client:load`. Two controlled fields (front, back), client-side non-empty validation before submit. `fetch("/api/cards", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({front, back}) })`. On `response.ok` → `window.location.assign("/library")`. On failure parse `{error,message}` and show an inline error banner (reuse the `ServerError` component / banner markup); keep a submitting/pending state. Reuse `FormField` and the `Button`/`SubmitButton` patterns.

#### 3. Route protection

**File**: `src/middleware.ts`

**Intent**: Protect `/library` so unauthenticated visits redirect to sign-in.

**Contract**: Add `"/library"` to the `PROTECTED_ROUTES` array.

#### 4. Dashboard entry point

**File**: `src/pages/dashboard.astro`

**Intent**: Add a "Card library" CTA alongside the existing Generate/Review CTAs.

**Contract**: Add an `<a href="/library">` styled to match the existing CTA anchors (gradient border button).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Visiting `/library` while logged out redirects to `/auth/signin`.
- Logged in, `/library` shows the create form and the list of existing saved cards, newest first.
- Submitting the create form with valid front/back saves the card and the reloaded list shows it; empty fields are blocked with an inline message.
- Empty library shows the empty-state message rather than a broken list.
- The dashboard "Card library" CTA navigates to `/library`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Inline edit + delete actions

### Overview

Render the saved-card list as an interactive island where each row supports inline editing and confirmed deletion, wiring into the Phase 1 `PATCH`/`DELETE` endpoints. Delivers FR-011 and FR-012.

### Changes Required:

#### 1. Card list island

**File**: `src/components/library/CardList.tsx`

**Intent**: Receive the server-fetched saved cards as props and render one row per card with Edit and Delete actions. Container for row state.

**Contract**: React component, `client:load`, prop `cards: { id: string; front: string; back: string }[]`. Renders a list of `CardRow`. Wired into `library.astro` in place of (or as) the Phase 2 list rendering.

#### 2. Card row with inline edit + delete

**File**: `src/components/library/CardRow.tsx`

**Intent**: A row that toggles between a read view (front/back text + Edit/Delete buttons) and an edit view (front/back inputs + Save/Cancel), and deletes behind a confirm. Backs FR-011 + FR-012.

**Contract**: Local view/edit state. **Edit**: clicking Edit reveals controlled inputs seeded with current values; Save validates non-empty, `fetch("/api/cards/" + id, { method: "PATCH", ... body: {front, back} })`, then `window.location.assign("/library")` on success or inline error on failure; Cancel restores the read view. **Delete**: clicking Delete calls `window.confirm(...)`; if confirmed, `fetch("/api/cards/" + id, { method: "DELETE" })`, then reload `/library` on success or inline error on failure. Use `Button variant="destructive"` for Delete and `lucide-react` icons (`Pencil`/`Trash2`). Maintain a per-row pending state to disable buttons during the request.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Clicking Edit on a row shows editable front/back; Save persists changes and the reloaded list reflects them; Cancel discards changes.
- Saving an edit with an empty field is blocked with an inline message.
- After editing, the card's review schedule is unchanged (verify `next_due_at`/box in Supabase) and `updated_at` advanced.
- Clicking Delete prompts a confirmation; confirming removes the card from the reloaded list; dismissing leaves it.
- No regressions on `/generate` or `/review`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- None — no test runner is configured in this repo (per AGENTS.md). Validation is via lint, build, and manual checks.

### Integration Tests:

- N/A (no harness). Cross-user isolation is exercised manually with two accounts.

### Manual Testing Steps:

1. Log in; from `/dashboard` click "Card library" → lands on `/library`.
2. Create a card with valid front/back → it appears in the list, newest first.
3. Attempt to create with an empty field → blocked with an inline message.
4. Edit a card inline, Save → change persists after reload; verify in Supabase that `next_due_at`/box are unchanged and `updated_at` advanced.
5. Edit and Cancel → no change.
6. Delete a card → confirm prompt appears; confirm removes it; cancel keeps it.
7. Log out and visit `/library` → redirected to `/auth/signin`.
8. With a second account, confirm none of the first account's cards are visible, and that PATCH/DELETE against the first account's card ids return 404.
9. Confirm `/generate` and `/review` still work (no regressions).

## Performance Considerations

The saved-card query uses the existing `cards_user_id_status_idx` `(user_id, status)` index. No pagination for MVP; single-user libraries are small. Revisit if libraries grow large.

## Migration Notes

None — no schema changes.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-03)
- PRD: `context/foundation/prd.md` (US-03, FR-009–FR-012)
- Schema + RLS: `context/changes/cards-schema-and-rls/plan.md`; migration `supabase/migrations/20260527150510_cards_and_account_deletion.sql`
- API + island patterns: `src/pages/api/generations/save.ts`, `src/pages/api/generations/discard.ts`, `src/pages/generate.astro`, `src/components/generate/PasteAndGenerateForm.tsx`
- Route protection: `src/middleware.ts`
- Lessons: `context/foundation/lessons.md` (deliberate route placement)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Card mutation API endpoints

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 3b6c6bd
- [x] 1.2 Production build passes: `npm run build` — 3b6c6bd

#### Manual

- [x] 1.3 POST /api/cards creates a saved card with non-null next_due_at — 3b6c6bd
- [x] 1.4 POST /api/cards rejects empty front/back (400) and unauthenticated (401) — 3b6c6bd
- [x] 1.5 PATCH /api/cards/[id] updates only front/back; schedule unchanged, updated_at advances — 3b6c6bd
- [x] 1.6 DELETE /api/cards/[id] removes the row; repeat returns 404 — 3b6c6bd
- [x] 1.7 Cross-account request for another user's card id returns 404 (RLS) — 3b6c6bd

### Phase 2: `/library` page — browse + create

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Production build passes: `npm run build`

#### Manual

- [x] 2.3 Logged-out visit to /library redirects to /auth/signin
- [x] 2.4 /library shows create form and saved cards newest-first
- [x] 2.5 Create form saves a valid card (visible after reload); empty fields blocked
- [x] 2.6 Empty library shows empty-state message
- [x] 2.7 Dashboard "Card library" CTA navigates to /library

### Phase 3: Inline edit + delete actions

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Production build passes: `npm run build`

#### Manual

- [ ] 3.3 Inline Edit Save persists front/back; Cancel discards
- [ ] 3.4 Saving an edit with an empty field is blocked
- [ ] 3.5 After edit, review schedule unchanged and updated_at advanced
- [ ] 3.6 Delete prompts confirmation; confirm removes, dismiss keeps
- [ ] 3.7 No regressions on /generate or /review
