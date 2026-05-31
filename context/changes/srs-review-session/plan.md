# SRS Review Session (S-04) Implementation Plan

## Overview

Implement roadmap **S-04**: a logged-in user opens a review session, sees due cards
(`status='saved'` AND `next_due_at <= now()`) one at a time, reveals the back, rates recall
**binary right/wrong** (FR-014), and the next-due date updates via a **Leitner box** scheduler and
persists across sessions. This closes the PRD Secondary Success Criterion (US-02, FR-013/014/015).

The scheduling model is **Leitner** (decided in `algorithm-decision.md`, ratified in planning):
the box index reuses the existing `repetition_count` column, so there is **no new column, no
`efactor`, no `supermemo` dependency, and no interval rounding**. Right → promote one box (capped);
wrong → reset to box 0. Fixed per-box intervals set the next due date.

## Current State Analysis

F-01 (`cards-schema-and-rls`) and S-02 (`atomic-save-to-deck`) are both **done**, so this slice is
unblocked. The `cards` table already reserves every field Leitner writes:

| Leitner write | `cards` column (F-01) | State |
| --- | --- | --- |
| box index | `repetition_count integer not null default 0` | ✅ present |
| `interval_days` | `interval_days integer not null default 0` | ✅ present |
| next due | `next_due_at timestamptz` (nullable) | ✅ present |
| last review | `last_reviewed_at timestamptz` (nullable) | ✅ present |

A freshly saved card is `repetition_count=0`, `next_due_at=now()`, `interval_days=0`,
`last_reviewed_at=NULL` (set by `finalize_drafts`, `20260529162956_finalize_drafts_fn.sql:21-23`) →
box 0, due immediately. The `interval_days=0` initial value is harmless: the due query keys on
`next_due_at`, not `interval_days`, and the first review overwrites it.

What is missing:

- **Partial due-index** — the only index is `cards_user_id_status_idx on (user_id, status)`
  (`20260527150510_cards_and_account_deletion.sql:30`). The due query wants
  `(user_id, next_due_at) where status='saved'` (F-01 deferred this to S-04).
- **`check (interval_days >= 0)`** — flagged by F-01's impl-review (obs. F3) as a "before S-04"
  item; trivially satisfied by Leitner (intervals always positive).
- **The review feature itself** — no scheduler, no `/api/reviews` endpoint, no `/review` route, no
  review island. `efactor` / `supermemo` / `SM-2` appear nowhere in the codebase (confirmed absent).

Integration patterns are fully proven by S-01/S-02 (see Key Discoveries). The single new wrinkle is
that the per-rating write is the **first single-row `.update()` in the repo** (existing direct
writes are INSERT/DELETE/SELECT; the only multi-row case uses an RPC) — and that `.update()` is
**not idempotent** the way `finalize_drafts` is.

## Desired End State

- A protected `/review` page is reachable from a `/dashboard` CTA.
- Opening `/review` server-queries the user's due cards (oldest-due-first) and hands the queue to a
  React island. With no due cards, a friendly "all caught up" state shows with a link back to
  `/dashboard`.
- For each card the user sees the front, reveals the back, and rates **Right** or **Wrong**. Each
  rating POSTs to `/api/reviews`; the box/interval/next-due are persisted; the island advances to
  the next card locally (no full-page reload). After the last card, a "session complete" state shows
  with a dashboard link.
- A double-tap / network retry / refresh of a rating does **not** double-promote a box (box-guarded
  write returns "already applied").
- Cross-user isolation holds via RLS (cookie-scoped client); a stale/draft id is a silent no-op.

**Verification:** `npm run lint` and `npm run build` pass; manual walkthrough of `/review` with due
cards, with no due cards, ratings persist across a reload, and a forced double-submit does not
double-advance the box.

### Key Discoveries:

- Endpoint scaffolding is identical across `generations.ts` / `save.ts` / `discard.ts`: local
  `json(body, status)` helper (`save.ts:14-19`), `if (!context.locals.user) return json(..., 401)`
  (`generations.ts:18-21`), `createClient(headers, cookies)` → `503 supabase_unconfigured`
  (`src/lib/supabase.ts:5-24`), `await request.json()` in try/catch → `400`, `{ error, message }`
  envelope. `/api/reviews` clones this.
- Single-row owner-scoped write pattern: `where id=? and status='saved'` so a stale/draft id is a
  silent no-op (mirrors `finalize_drafts`; RLS via cookie-scoped client gives isolation for free).
- Page recipe (`src/pages/generate.astro:7-31,60`): build a server
  `createClient(Astro.request.headers, Astro.cookies)`, query with `.overrideTypes<Row[]>(...)`, set
  a `loadError` flag, render a React island `client:load` inside `<Layout>` + cosmic shell
  (`bg-cosmic min-h-screen p-4` → `mx-auto max-w-3xl`).
- Client idiom (`DraftReviewList.tsx:54-84`): raw `fetch`, `useState` for domain state +
  `submitting` + `error: {code,message}|null`, per-file `FALLBACK_MESSAGES: Record<string,string>`,
  handlers wired `onClick={() => { void handleX(); }}`. The green/red accept/reject toggle styling
  (`:141-145`) models right/wrong buttons; `Eye` (lucide) for reveal.
- `PROTECTED_ROUTES = ["/dashboard", "/generate"]` (`src/middleware.ts:4`, prefix match). Add
  `"/review"`. **Caveat:** middleware only redirects unauth *page* loads — it does **not** 401 the
  API; `/api/reviews` must keep its own in-handler 401 guard.
- No generated Supabase types: rows cast with `.overrideTypes<Row[], { merge: false }>()` at the
  call site; no central `src/types.ts`. S-04 defines its types locally in the review feature folder.
- Edge-safe: `Date.now()` / `new Date().toISOString()` / arithmetic are V8 globals, no
  `nodejs_compat` dependency.

## What We're NOT Doing

- **No SM-2 / `efactor` column / `supermemo` dependency** — Leitner reuses `repetition_count`.
- **No FSRS / multi-grade rating** — PRD parks these as v2 levers; rating stays binary.
- **No RPC for the rating write** — a single guarded `.update()` suffices.
- **No re-surfacing of same-session "wrong" cards** — the queue is a point-in-time snapshot; a card
  rated wrong (due again today) reappears on the next session/reload, not within the current loop.
- **No "retired"/"suspended" card state** — cards at the top box repeat at the longest interval
  forever (matches "deliberately simple").
- **No zod / CSRF-Origin checks** — consistent with S-01/S-02; auth rests on the session cookie.
- **No generated-types step** — keep casting at the boundary.
- **No DST/calendar-aware intervals** — fixed 24h day (`interval * 86_400_000` ms), a conscious
  simplification for a UTC-timestamp MVP.

## Implementation Approach

A clean vertical slice in three phases, building bottom-up so each phase is independently
verifiable: (1) additive schema migration, (2) a pure scheduler plus the rating endpoint, (3) the
page and island that consume them. Every integration point clones an existing S-01/S-02 pattern; the
only genuinely new code is the ~15-line Leitner function, the box-guarded write, and the
reveal→rate→advance island loop.

## Critical Implementation Details

- **Non-idempotent box write.** Unlike `finalize_drafts` (replay-safe via its `status='draft'`
  guard), a Leitner write `update ... where id=? and status='saved'` leaves the row `status='saved'`
  afterward — so a double-POST of "right" promotes twice, and a stale "wrong" after a "right" resets
  to 0. The fix is to guard the WHERE on the expected current box (`and repetition_count =
  <expectedBox>`): the client sends the box it saw, a replay matches 0 rows, and the endpoint reports
  "already applied". This is the server-authoritative complement to the client button-disable.
- **Initial-state continuity.** Saved cards arrive at box 0 / due-now (`finalize_drafts`). First
  "right" → box 1 (2 days out); first "wrong" → stays box 0 (1 day out). No special-casing needed.
- **`order by next_due_at asc, last_reviewed_at asc nulls first` IS the Guardrails fallback**
  ("oldest due-card first") — there is no separate fallback code path; the primary query degrades to
  it by construction.

## Phase 1: Schema migration (due-index + interval check)

### Overview

One additive, non-breaking migration adding the partial due-query index and the
`check (interval_days >= 0)` constraint. No new column.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/<timestamp>_cards_due_index_and_interval_check.sql` (new)

**Intent**: Back the due-card query with a partial index and add the F-01-forward non-negative
interval constraint, so Phase 2's queries and writes are well-supported and self-validating.

**Contract**: Two DDL statements against `public.cards`:
- `create index cards_due_idx on public.cards (user_id, next_due_at) where status = 'saved';`
- `alter table public.cards add constraint cards_interval_days_nonneg check (interval_days >= 0);`

Follow the existing migration's naming/style (`20260527150510_cards_and_account_deletion.sql`). Pick
a timestamp later than `20260529162956`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against the remote Supabase project (per the project's remote-only
  workflow).
- Type-check / lint unaffected: `npm run lint`.
- Build passes: `npm run build`.

#### Manual Verification:

- Index `cards_due_idx` and constraint `cards_interval_days_nonneg` exist on `public.cards`.
- Existing saved cards (`interval_days=0`) still satisfy the new check (no rows rejected).

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation that the migration applied before proceeding to Phase 2.

---

## Phase 2: Leitner scheduler + `/api/reviews` endpoint

### Overview

A pure, edge-safe Leitner `schedule()` function and the POST endpoint that applies a rating to a
card via a single box-guarded `.update()`.

### Changes Required:

#### 1. Leitner scheduler (pure function)

**File**: `src/lib/leitner.ts` (new)

**Intent**: Encapsulate the entire scheduling algorithm as a pure function so it is trivially
testable and reusable, and export the shared review types the endpoint and island need.

**Contract**: Per `leitner-docs.md`:
- `const BOX_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30] as const;` and `MAX_BOX = length - 1`.
- `type ReviewRating = "right" | "wrong";`
- `function schedule(box: number, rating: ReviewRating, now?: number): { repetition_count: number;
  interval_days: number; next_due_at: string; last_reviewed_at: string }` — `right` → `min(box+1,
  MAX_BOX)`, `wrong` → `0`; `interval = BOX_INTERVALS_DAYS[nextBox]`; `next_due_at = new Date(now +
  interval*86_400_000).toISOString()`; `last_reviewed_at = new Date(now).toISOString()`.
- `now` defaults to `Date.now()` (edge-safe V8 global).

#### 2. Review endpoint

**File**: `src/pages/api/reviews.ts` (new)

**Intent**: Accept a `{ cardId, rating, currentBox }` rating, compute the new schedule, and persist
it with a single owner-scoped, box-guarded write; report whether the write applied or was a replay.

**Contract**: `export const POST: APIRoute`, cloning the `save.ts` scaffolding verbatim — local
`json()` helper, `locals.user` → 401, `createClient(headers, cookies)` → 503, `request.json()` in
try/catch → 400, `{ error, message }` envelope. Inline manual validation (no zod): `cardId` is a
non-empty string, `rating ∈ {"right","wrong"}`, `currentBox` is a non-negative integer.

The write is the contract's load-bearing part:

```ts
const next = schedule(currentBox, rating);
const { data, error } = await supabase
  .from("cards")
  .update({
    repetition_count: next.repetition_count,
    interval_days: next.interval_days,
    next_due_at: next.next_due_at,
    last_reviewed_at: next.last_reviewed_at,
  })
  .eq("id", cardId)
  .eq("status", "saved")
  .eq("repetition_count", currentBox) // box guard → replay matches 0 rows
  .select("id")
  .overrideTypes<{ id: string }[], { merge: false }>();
```

A DB `error` → 500 `db_error`. `data.length === 0` (no row matched: stale id, draft, or already
applied) → return 200 with a body that signals "no change" (e.g. `{ applied: false }`) rather than
an error — the client treats it as success and still advances. A matched row → `{ applied: true }`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`.
- Build passes: `npm run build`.

#### Manual Verification:

- POST a valid `{cardId, rating:"right", currentBox:0}` for an owned saved card → row moves to box
  1, `interval_days=2`, `next_due_at` ≈ now+2d.
- POST `rating:"wrong"` on a box-3 card → box 0, `interval_days=1`.
- Replay the same "right" POST (same `currentBox`) → second call reports `applied:false`, box
  unchanged (no double-promote).
- POST for another user's card id → no row matched (`applied:false`), nothing changes (RLS +
  ownership).
- Unauthenticated POST → 401; malformed body → 400.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: `/review` page + `ReviewSession` island + dashboard CTA

### Overview

The protected `/review` page server-queries the due-card queue and renders the React island that
runs the reveal→rate→advance loop, plus empty and session-complete states and a CTA from
`/dashboard`.

### Changes Required:

#### 1. Protect the route

**File**: `src/middleware.ts`

**Intent**: Gate `/review` for unauthenticated users (redirect to sign-in), consistent with other
protected pages.

**Contract**: Add `"/review"` to `PROTECTED_ROUTES` (`:4`). No other change.

#### 2. Review page (server query → island)

**File**: `src/pages/review.astro` (new)

**Intent**: On the server, query the current user's due cards oldest-first and hand the queue to the
island; surface a load-error flag; render inside the standard layout + cosmic shell.

**Contract**: Mirror `generate.astro:7-31,60`. Build `createClient(Astro.request.headers,
Astro.cookies)`; query:

```sql
select id, front, back, repetition_count
from cards
where status = 'saved' and next_due_at <= now()
order by next_due_at asc, last_reviewed_at asc nulls first
```

(expressed via the supabase-js query builder; `repetition_count` is needed as the island's
`currentBox`). Cast with `.overrideTypes<DueCard[], { merge: false }>()`. Set a `loadError` flag on
error. Render `<ReviewSession client:load dueCards={...} loadError={...} />` inside `<Layout>` + the
cosmic shell wrapper.

#### 3. Review island

**File**: `src/components/review/ReviewSession.tsx` (new)

**Intent**: Drive the per-card loop: show front → reveal back → rate right/wrong → POST → advance
local index; render empty, in-session, complete, and error states using the existing visual
language.

**Contract**: Props `{ dueCards: DueCard[]; loadError: boolean }`. Local state: `index` (current
card), `revealed: boolean` (reset per card), `submitting: boolean`, `error: {code,message}|null`.
Per-file `FALLBACK_MESSAGES: Record<string,string>`. A rating handler POSTs
`{ cardId, rating, currentBox: card.repetition_count }` to `/api/reviews`, and on success (including
`applied:false`) increments `index` and resets `revealed`; on network/HTTP error sets `error` and
keeps the card. Handlers wired `onClick={() => { void handleRate("right"); }}`.

States:
- `loadError` → error card (fallback message + dashboard link).
- `dueCards.length === 0` → "all caught up" done-state + `/dashboard` link.
- `index >= dueCards.length` → "session complete" done-state + `/dashboard` link.
- otherwise → front always visible; `Eye`-icon reveal button toggles the back; once revealed, show
  green **Right** / red **Wrong** buttons (model the `DraftReviewList.tsx:141-145` toggle styling),
  disabled while `submitting`.

Visual language: inline glassmorphism Tailwind (`rounded-2xl border border-white/10 bg-white/10
backdrop-blur-xl`), `cn` from `src/lib/utils.ts`, `lucide-react` icons. Define `DueCard` /
`ReviewRating` types locally (import `ReviewRating` from `src/lib/leitner.ts`).

#### 4. Dashboard CTA

**File**: the dashboard page/component (`src/pages/dashboard.astro` or its component)

**Intent**: Give users an entry point into the review session without crowding the dashboard with
the session itself.

**Contract**: Add a link/button to `/review` styled with the existing dashboard CTA pattern. No
session logic on the dashboard.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`.
- Build passes: `npm run build`.

#### Manual Verification:

- Unauthenticated visit to `/review` redirects to `/auth/signin`.
- With due cards: cards appear oldest-first, one at a time; reveal shows the back; Right/Wrong
  advances to the next card without a full reload.
- Ratings persist: after rating all cards and reloading, the rated cards are no longer due (their
  `next_due_at` moved out).
- With no due cards: the "all caught up" state shows with a working dashboard link.
- After the last card: "session complete" state shows with a working dashboard link.
- Forced double-submit (double-tap / devtools replay) does not double-advance the box.
- Dashboard CTA navigates to `/review`.

**Implementation Note**: After completing this phase and all automated verification passes, pause
for final manual confirmation.

---

## Testing Strategy

No test runner is configured (per AGENTS.md). Validation is `npm run lint`, `npm run build`, and
manual route checks. If colocated tests are added later, the highest-value unit target is
`src/lib/leitner.ts`:

### Unit Tests (if/when a runner exists):

- `schedule(0, "right")` → box 1, interval 2.
- `schedule(MAX_BOX, "right")` → stays `MAX_BOX` (graduation cap).
- `schedule(3, "wrong")` → box 0, interval 1.
- `next_due_at` ≈ `now + interval*86_400_000`.

### Manual Testing Steps:

1. Save fresh cards via the generate→save flow → they are due now.
2. Open `/review`; verify oldest-first order and one-at-a-time loop.
3. Rate a mix of right/wrong; reload and confirm due-state changed as expected.
4. Empty the due queue and confirm the "all caught up" state.
5. Replay a rating request (devtools) and confirm no double-promote.

## Performance Considerations

The due query is backed by the new partial index `cards_due_idx`; expected per-user card volumes
for an MVP are small. The session loads the full due queue once (point-in-time snapshot) — no
per-card round-trip on advance, only one POST per rating.

## Migration Notes

The Phase 1 migration is additive and non-breaking; existing rows (`interval_days=0`) satisfy the
new check. No data backfill needed — `finalize_drafts` already leaves saved cards at box 0 / due-now.

## References

- Internal research: `context/changes/srs-review-session/research.md`
- Leitner spec: `context/changes/srs-review-session/leitner-docs.md`
- Decision analysis (SM-2 vs Leitner): `context/changes/srs-review-session/algorithm-decision.md`
- Change identity: `context/changes/srs-review-session/change.md`
- Endpoint template: `src/pages/api/generations/save.ts:14-93`
- Page+island recipe: `src/pages/generate.astro:7-31,60`
- Client idiom + toggle styling: `src/components/generate/DraftReviewList.tsx:54-84,141-145`
- Atomic-write precedent + initial state: `supabase/migrations/20260529162956_finalize_drafts_fn.sql:14-32`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema migration (due-index + interval check)

#### Automated

- [x] 1.1 Migration applies cleanly against remote Supabase — 8d11ed8
- [x] 1.2 Lint passes: `npm run lint` (Phase 1 added no lint-scope files; repo-wide lint has pre-existing unrelated CRLF errors, accepted) — 8d11ed8
- [x] 1.3 Build passes: `npm run build` — 8d11ed8

#### Manual

- [x] 1.4 `cards_due_idx` and `cards_interval_days_nonneg` exist on `public.cards` — 8d11ed8
- [x] 1.5 Existing saved cards still satisfy the new check (no rows rejected) — 8d11ed8

### Phase 2: Leitner scheduler + `/api/reviews` endpoint

#### Automated

- [x] 2.1 Lint passes: `npm run lint` (new files leitner.ts + reviews.ts lint clean; repo-wide pre-existing unrelated CRLF errors remain)
- [x] 2.2 Build passes: `npm run build`

#### Manual

- [x] 2.3 Valid "right" on box-0 card → box 1, interval 2, next_due ≈ now+2d
- [x] 2.4 "wrong" on box-3 card → box 0, interval 1
- [x] 2.5 Replay same "right" (same currentBox) → applied:false, box unchanged
- [x] 2.6 POST for another user's card → no change (RLS + ownership)
- [x] 2.7 Unauthenticated → 401; malformed body → 400

### Phase 3: `/review` page + `ReviewSession` island + dashboard CTA

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Unauthenticated `/review` redirects to `/auth/signin`
- [ ] 3.4 Due cards appear oldest-first, one at a time; reveal + advance works without reload
- [ ] 3.5 Ratings persist across a reload (rated cards no longer due)
- [ ] 3.6 "All caught up" empty state shows with working dashboard link
- [ ] 3.7 "Session complete" state shows after last card with working dashboard link
- [ ] 3.8 Forced double-submit does not double-advance the box
- [ ] 3.9 Dashboard CTA navigates to `/review`
