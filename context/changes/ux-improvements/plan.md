# UX Improvements (S-06) Implementation Plan

## Overview

Six **independent** UX polish items observed while building S-01…S-04, applied to surfaces that are already `done`. Each ships on its own with no half-implemented state. Sequenced low-risk/high-value first (per the chosen priority order), so the FR-010-extending pagination/search lands last where it can be parked if time runs short.

## Current State Analysis

The app is server-render-first (Astro): pages fetch data in the `.astro` frontmatter and pass it to small React islands for interactivity. Key facts that shape this plan:

- **Post-login** — `src/pages/api/auth/signin.ts:19` redirects to `/`; `src/pages/index.astro:6-8` *always* renders `<Welcome/>`. A logged-in user lands on the marketing home. Middleware (`src/middleware.ts:4,18-22`) only *protects* routes; it does not bounce authed users off public pages.
- **Navigation** — the three primary actions live inline in `src/pages/dashboard.astro:16-35`. `src/components/Topbar.astro` already exists (user email + Dashboard + Sign out / signed-out links) but is used only by `Welcome.astro`. `src/layouts/Layout.astro:38` is a bare `<slot/>` with config banners above it.
- **Loading states** — convention is local `pending`/`submitting` state + disabled buttons + a `Loader2` spinner (`src/components/auth/SubmitButton.tsx`, `src/components/library/CardRow.tsx:158,187`). Two gaps: `DraftReviewList` save button shows only "Saving…" text (no spinner, `:173`), and `ReviewSession` rate buttons disable but show no spinner (`:171,185`).
- **Review session** — `src/components/review/ReviewSession.tsx:44-51` holds all session state client-side (`index`, `revealed`, `submitting`, `error`, `lockRef`). Due cards are fetched once server-side in `review.astro` and passed as a prop. Ratings POST to `/api/reviews` immediately and persist.
- **Draft review** — `src/components/generate/DraftReviewList.tsx:27` holds per-draft decisions (`accept`/`reject`, default `accept`). `src/pages/api/generations/save.ts:62-79` has a **fail-closed completeness guard**: the submitted accept+reject IDs must exactly cover the caller's draft set, or it rejects with `incomplete_selection`.
- **Library** — `src/pages/library.astro:19-24` fetches **all** saved cards (`select("id, front, back").eq("status","saved").order("created_at",desc)`), no limit/offset, no search. Index `cards_user_id_status_idx` on `(user_id, status)` exists. Card mutations (`CardRow`, `CreateCardForm`) already trigger full-page reloads, so full-page pagination nav is consistent.

## Desired End State

A logged-in user lands on `/dashboard`, sees a persistent top nav letting them jump between Generate / Review / Library without returning to the dashboard, gets consistent in-flight spinners on every action, can restart a review session in place, can accept/reject an entire draft batch in one click, and can page through + keyword-search their card library.

Verify: sign in → land on `/dashboard`; nav visible on every authed screen; spinners appear on draft-save and rate clicks; "Restart session" re-walks the same cards; "Accept all"/"Reject all" set every decision; `/library?page=2&q=foo` returns the second page of cards whose front/back match `foo`.

### Key Discoveries:

- The completeness guard at `save.ts:62-79` means bulk actions need **no API change** — they just set every entry in the `decisions` record; the existing `handleSave` already sends complete arrays.
- Reset session is a pure client-state change (`setIndex(0)` etc.) — ratings already POSTed stay persisted, so the schedule cannot be corrupted.
- Library lists are server-rendered, so pagination/search are server-side query changes in `library.astro` + a small form; no new API endpoint or client state machine needed.
- `Topbar.astro` already reads `Astro.locals.user` and renders signed-in/out variants — extending it is cheaper than a new component.

## What We're NOT Doing

- No cursor-based pagination (offset is sufficient at MVP scale — roadmap-confirmed).
- No client-side `/api/cards` list endpoint or load-more; library stays server-rendered.
- No skeleton loaders for list loads (lists are server-rendered — there is no client wait to fill).
- No shared Spinner/Skeleton primitive; we reuse the existing inline `Loader2` pattern.
- No checkbox multi-select bulk bar on drafts (per-card toggles already cover granular decisions); bulk = all-accept / all-reject only.
- No change to the `/api/reviews`, `/api/generations/save`, or scheduler contracts (atomicity + schedule durability preserved).
- No refetch of due cards on session reset (won't pull cards that became due mid-session — acceptable, rare).

## Implementation Approach

Each phase is one self-contained, independently shippable item. Touch the smallest surface that delivers the improvement, reuse existing patterns (server-render queries, inline `Loader2`, `Astro.locals.user`), and never break the contracts the roadmap flagged as risk-sensitive (atomic accept/reject, schedule durability).

## Critical Implementation Details

- **Banner must not render on auth pages.** `Topbar.astro` reads `Astro.locals.user`; rendering it in `Layout.astro` means it appears everywhere the layout is used, including `/auth/*` and the marketing home. Gate the nav-links variant on `user` being present (signed-out users still see the existing sign-in/up variant, which is correct for the marketing home). Confirm no redirect loop or duplicate nav on `/auth/signin`.
- **Post-login redirect target must itself be protected.** Redirecting `/`→`/dashboard` for authed users is safe because `/dashboard` is in `PROTECTED_ROUTES`; an unauthenticated user can never reach the redirect branch. Keep the redirect in the page (`index.astro`), not middleware, to avoid entangling "protect" and "bounce" logic.

---

## Phase 1: Post-login redirect to dashboard

### Overview

A logged-in user hitting `/` is redirected server-side to `/dashboard` instead of seeing the marketing welcome screen.

### Changes Required:

#### 1. Home page

**File**: `src/pages/index.astro`

**Intent**: When `Astro.locals.user` is present, redirect to `/dashboard` before rendering; otherwise render `<Welcome/>` as today. This keeps `/` a valid marketing URL for logged-out users and leaves middleware focused on protection.

**Contract**: Add a frontmatter guard returning `Astro.redirect("/dashboard")` when `Astro.locals.user` is truthy. No change to the signed-out render path.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Signing in lands on `/dashboard` (not `/` with Welcome visible).
- Visiting `/` while logged in redirects to `/dashboard`.
- Visiting `/` while logged out still shows the Welcome screen (no redirect loop).

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Navigation banner

### Overview

Lift the three primary actions (Generate / Review / Library) into a persistent top banner shown on every authenticated screen, so users jump between screens without returning to the dashboard.

### Changes Required:

#### 1. Top navigation component

**File**: `src/components/Topbar.astro`

**Intent**: Add Generate / Review / Library nav links to the signed-in variant (alongside the existing email + Dashboard + Sign out). The signed-out variant is unchanged. Optionally highlight the active route via `Astro.url.pathname`.

**Contract**: Signed-in branch renders nav links to `/generate`, `/review`, `/library`, plus the existing `/dashboard` link and sign-out form. Existing class/style idiom preserved.

#### 2. Layout

**File**: `src/layouts/Layout.astro`

**Intent**: Render `Topbar` for authenticated users on every page using the layout, below the config banners and above the `<slot/>`. Must not introduce a duplicate nav where `Topbar` is already used.

**Contract**: Import `Topbar`; render it when `Astro.locals.user` is present. Verify `Welcome.astro` (which already includes `Topbar`) does not now show it twice — if it does, remove the local include from `Welcome.astro`.

#### 3. Dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Remove the now-redundant inline three-action box (`:16-35`); keep the welcome heading and sign-out (sign-out also lives in the banner, so the page sign-out may be removed for cleanliness).

**Contract**: Delete the inline action links; dashboard becomes a lightweight landing surface with the nav banner providing navigation.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Banner with Generate / Review / Library appears on `/dashboard`, `/generate`, `/review`, `/library`.
- Clicking a banner link navigates directly without going through the dashboard.
- Banner does NOT appear (or appears as the signed-out variant) on `/auth/signin`, `/auth/signup`, and the logged-out home.
- No duplicated nav on the Welcome page.
- Mobile width: banner links wrap/remain usable (NFR mobile-baseline).

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Loading-state gaps

### Overview

Fill the two missing in-flight spinners so every action matches the existing `Loader2` convention.

### Changes Required:

#### 1. Draft review save button

**File**: `src/components/generate/DraftReviewList.tsx`

**Intent**: Show a spinning `Loader2` in the "Save to deck" button while `submitting` (currently only swaps text to "Saving…", `:172-173`). Match the icon usage in `CardRow.tsx:158`.

**Contract**: While `submitting`, render `<Loader2 className="size-4 animate-spin" />` in place of (or alongside) the static `Save` icon. Button already disables on `submitting`.

#### 2. Review rate buttons

**File**: `src/components/review/ReviewSession.tsx`

**Intent**: Indicate in-flight state on the Wrong/Right buttons while `submitting` (currently disable only, `:171,185`). Add a spinner on the button being submitted.

**Contract**: Render `Loader2 animate-spin` in the active rate button while `submitting`. Preserve the `lockRef` re-entrancy guard and existing disabled styling.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Clicking "Save to deck" shows a spinner until navigation.
- Clicking Right/Wrong shows a spinner on the pressed button until the next card appears.
- No double-submit regression (lock guard still holds).

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Reset review session

### Overview

Add a "Restart session" control that re-walks the cards already fetched this session, without a page reload, without touching persisted ratings/schedule.

### Changes Required:

#### 1. Review session component

**File**: `src/components/review/ReviewSession.tsx`

**Intent**: Add a "Restart session" action that resets client state (`index → 0`, `revealed → false`, `error → null`) over the same `dueCards` prop. Ratings already POSTed remain persisted; only the local walk restarts. Surface the control where it's discoverable — e.g. on the "Session complete" `DoneCard` and/or a subtle control during the session.

**Contract**: A handler setting `index` to 0 and `revealed`/`error` to their initial values. Reuse `DoneCard` or add a button; no new props, no fetch, scheduler untouched.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- "Restart session" returns to card 1 of N over the same set, answer hidden.
- A card rated before reset keeps its new schedule (re-rating it is replay-safe via the existing idempotency guard).
- Reset works mid-session and from the "Session complete" state.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 5: Bulk draft actions

### Overview

Add Accept-all / Reject-all controls to the draft review screen while keeping per-card toggles. No API change — the existing completeness guard is honored because every decision is set.

### Changes Required:

#### 1. Draft review component

**File**: `src/components/generate/DraftReviewList.tsx`

**Intent**: Add two header controls that set every entry in `decisions` to `accept` (Accept all) or `reject` (Reject all). Per-card toggles remain. Submit path is unchanged — `handleSave` already builds complete accept/reject arrays from `decisions`, so the `save.ts` completeness guard passes.

**Contract**: Two buttons calling `setDecisions` to map all draft ids to a single decision. "Reject all" must trigger a confirm (the existing `handleSave` already confirms the accept/discard counts at `:42-47`; ensure a destructive bulk reject is not silently one-click). The live `acceptCount`/`rejectCount` summary (`:35-36,92-94`) reflects the bulk change.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- "Accept all" marks every draft Keep; "Reject all" marks every draft Discard; counts update live.
- After a bulk action, per-card toggles still flip individual cards.
- Saving after a bulk action persists correctly (no `incomplete_selection` error).
- The save confirm dialog reflects the bulk counts; rejecting the confirm leaves state unchanged.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 6: Library pagination + keyword search

### Overview

Add server-side offset pagination and a server-side keyword search to the card library, combined so search filters the full set and paginates the filtered result.

### Changes Required:

#### 1. Library page query + UI

**File**: `src/pages/library.astro`

**Intent**: Read `?page` (1-based, default 1) and `?q` (trimmed keyword, optional) from `Astro.url.searchParams`. Build the saved-cards query with the existing status filter, an optional `.ilike` OR-match on `front`/`back` when `q` is present, ordering preserved, and `.range(offset, offset + PAGE_SIZE - 1)`. Request the total count to compute page bounds. Render a search form (GET, input named `q`) and prev/next links that preserve `q`, plus a "page X of Y" indicator and a sensible empty/no-results message.

**Contract**: `PAGE_SIZE` constant (e.g. 20). Query: `.eq("status","saved")` + optional `.or("front.ilike.%q%,back.ilike.%q%")` + `.order("created_at",{ascending:false})` + `.range(...)`, using `{ count: "exact" }` to drive Y. Search form is a GET to `/library` (resets to page 1 on new search). Prev/next are anchor links with `page` and `q` query params; disable/hide prev on page 1 and next on the last page. Header count (`:65`) reflects total matches, not just the current page. Escape/encode `q` in links. Preserves the existing `!supabase` and `loadError` branches.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- `/library` shows the first page; prev/next navigate pages and disable at bounds.
- Searching a keyword returns matches from across the whole library (not just the current page), paginated.
- Search + pagination compose: `?q=foo&page=2` shows page 2 of the filtered set; clearing search returns to the full list.
- Empty library and no-search-results render their messages; count reflects total matches.
- Editing/deleting/creating a card (full reload) returns to a valid library view.

**Implementation Note**: After automated verification passes, pause for manual confirmation. This phase extends FR-010 beyond its letter — confirm it's MVP-worthy before merge (otherwise park it).

---

## Testing Strategy

No test runner is configured (see AGENTS.md). Validation is `npm run lint` + `npm run build` + manual route checks.

### Manual Testing Steps:

1. **Auth/redirect** — sign in (land on `/dashboard`), visit `/` logged in (redirect), sign out and visit `/` (Welcome).
2. **Nav** — confirm banner on all authed screens, absent/signed-out variant on `/auth/*` and logged-out home, no duplicate on Welcome, mobile wrap.
3. **Loading** — observe spinners on draft save and rate buttons.
4. **Reset** — restart a session mid-way and from complete; confirm persisted ratings survive.
5. **Bulk** — accept-all / reject-all, then save; verify no `incomplete_selection`.
6. **Library** — page through, search across pages, combine `q`+`page`, edit a card and confirm the list still renders.

## Performance Considerations

Pagination reduces the library payload from "all saved cards" to one page (`PAGE_SIZE`), backed by the existing `(user_id, status)` index. `.ilike` keyword search is unindexed but acceptable at MVP scale; revisit with a trigram/FTS index only if the library grows large.

## Migration Notes

No schema or data migration. All changes are page/component-level; the `cards` table and existing API contracts are untouched.

## References

- Change identity: `context/changes/ux-improvements/change.md`
- Roadmap slice: `context/foundation/roadmap.md` → "S-06: Usprawnienia UX" (`:161-174`)
- Completeness guard: `src/pages/api/generations/save.ts:62-79`
- Idempotency guard: `src/pages/api/reviews.ts:66`
- Loading convention: `src/components/library/CardRow.tsx:156-189`, `src/components/auth/SubmitButton.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Post-login redirect to dashboard

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — ced27c8
- [x] 1.2 Build succeeds: `npm run build` — ced27c8

#### Manual

- [x] 1.3 Signing in lands on `/dashboard` — ced27c8
- [x] 1.4 Visiting `/` while logged in redirects to `/dashboard` — ced27c8
- [x] 1.5 Visiting `/` while logged out still shows Welcome (no loop) — ced27c8

### Phase 2: Navigation banner

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — 1c3a3e2
- [x] 2.2 Build succeeds: `npm run build` — 1c3a3e2

#### Manual

- [x] 2.3 Banner appears on dashboard/generate/review/library — 1c3a3e2
- [x] 2.4 Banner links navigate directly without the dashboard — 1c3a3e2
- [x] 2.5 Banner absent/signed-out on auth pages and logged-out home — 1c3a3e2
- [x] 2.6 No duplicated nav on the Welcome page — 1c3a3e2
- [x] 2.7 Mobile width: banner links remain usable — 1c3a3e2

### Phase 3: Loading-state gaps

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — 49ee7c8
- [x] 3.2 Build succeeds: `npm run build` — 49ee7c8

#### Manual

- [x] 3.3 "Save to deck" shows a spinner until navigation — 49ee7c8
- [x] 3.4 Right/Wrong show a spinner on the pressed button — 49ee7c8
- [x] 3.5 No double-submit regression — 49ee7c8

### Phase 4: Reset review session

#### Automated

- [x] 4.1 Linting passes: `npm run lint` — 095be1c
- [x] 4.2 Build succeeds: `npm run build` — 095be1c

#### Manual

- [x] 4.3 "Restart session" returns to card 1 of N, answer hidden — 095be1c
- [x] 4.4 Pre-reset rating keeps its new schedule (replay-safe) — 095be1c
- [x] 4.5 Reset works mid-session and from "Session complete" — 095be1c

### Phase 5: Bulk draft actions

#### Automated

- [x] 5.1 Linting passes: `npm run lint` — d5f2cc9
- [x] 5.2 Build succeeds: `npm run build` — d5f2cc9

#### Manual

- [x] 5.3 Accept-all / Reject-all set every decision; counts update — d5f2cc9
- [x] 5.4 Per-card toggles still work after a bulk action — d5f2cc9
- [x] 5.5 Saving after bulk persists (no `incomplete_selection`) — d5f2cc9
- [x] 5.6 Save confirm reflects bulk counts; cancel leaves state unchanged — d5f2cc9

### Phase 6: Library pagination + keyword search

#### Automated

- [x] 6.1 Linting passes: `npm run lint`
- [x] 6.2 Build succeeds: `npm run build`

#### Manual

- [x] 6.3 Prev/next navigate pages and disable at bounds
- [x] 6.4 Search returns matches across the whole library, paginated
- [x] 6.5 `q` + `page` compose; clearing search restores full list
- [x] 6.6 Empty library and no-results messages render; count reflects total
- [x] 6.7 Edit/delete/create reload returns to a valid library view
