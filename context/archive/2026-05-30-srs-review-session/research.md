---
date: 2026-05-30
researcher: Rafal S
git_commit: c49ea4e507ac462f974d6e4492c779c92f5f441c
branch: dev
repository: 10xCards
topic: "Internal codebase research for S-04 (SRS review session): schema delta for SM-2, API/UI integration points"
tags: [research, codebase, srs, cards, sm-2, supermemo, s-04]
status: complete
last_updated: 2026-05-30
last_updated_by: Rafal S
last_updated_note: "Added follow-up: live-code verification that leitner-docs.md is compatible. Verdict: compatible; one substantive caveat (non-idempotent box update)."
---

# Research: S-04 SRS review session — what the codebase already provides

**Date**: 2026-05-30
**Researcher**: Rafal S
**Git Commit**: c49ea4e507ac462f974d6e4492c779c92f5f441c
**Branch**: dev
**Repository**: 10xCards

## Research Question

Implement roadmap **S-04** (`srs-review-session`) backed by the SM-2 choice in
`context/changes/srs-review-session/supermemo-docs.md`. The named open item from external
research: **cross-check the three SM-2 columns (`interval`, `repetition`, `efactor`) against
F-01's reserved schedule fields on the `cards` table**, and map the integration points the
review session must plug into (API conventions, types, UI/routing, prior decisions).

## Summary

The codebase is **ready for SM-2 with a one-column schema delta.** F-01 reserved the exact
bookkeeping SM-2 needs except the easiness factor:

| SM-2 field (`supermemo-docs.md`) | `cards` column (F-01) | Status |
| --- | --- | --- |
| `interval` (days) | `interval_days integer default 0` | ✅ present |
| `repetition` (continuous correct) | `repetition_count integer default 0` | ✅ present |
| `efactor` (easiness, init 2.5) | — | ❌ **missing — the delta** |
| next due date | `next_due_at timestamptz` | ✅ present |
| (bonus) last review | `last_reviewed_at timestamptz` | ✅ present, supports the fallback |

So the only schema change S-04 requires is a migration adding **`efactor`** (e.g.
`numeric not null default 2.5`). Prior plans deliberately deferred — did **not** forbid — this
field, so there is no contradiction. Two secondary schema items surfaced: a `check
(interval_days >= 0)` constraint flagged for "before S-04" by F-01's impl-review, and a partial
index `(user_id, next_due_at) where status='saved'` for the due-card query (noted deferred in
F-01's plan).

Every integration point follows a clean, repeatable pattern already proven by S-01/S-02:
user-scoped Supabase client per request, `APIRoute` POST handlers with a `json()` helper and
`{ error, message }` envelopes, atomic multi-row writes via a `SECURITY INVOKER` Postgres RPC,
and React islands using raw `fetch` + `useState` + a `FALLBACK_MESSAGES` map. The review screen
diverges in exactly one place: it should **advance client state per card** rather than reload on
success (the S-01/S-02 `window.location.assign` idiom).

## Detailed Findings

### 1. Schema delta — SM-2 vs F-01 reserved fields (the core question)

The `cards` table (`supabase/migrations/20260527150510_cards_and_account_deletion.sql:16-28`):

```sql
create table public.cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  front             text not null check (length(front) > 0),
  back              text not null check (length(back) > 0),
  status            text not null default 'draft' check (status in ('draft', 'saved')),
  next_due_at       timestamptz,
  interval_days     integer not null default 0,
  repetition_count  integer not null default 0,
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

- **`interval_days` ↔ SM-2 `interval`** and **`repetition_count` ↔ SM-2 `repetition`** match
  one-to-one (both default `0`, the SM-2 fresh-card initial values).
- **`efactor` is absent.** SM-2 initializes it to `2.5` and only uses it from repetition 3+
  (the first two intervals are fixed at 1 and 6 days), so it materially affects long-term
  scheduling and cannot just be hard-coded away — it must be persisted per card. → **add one
  column.**
- **`next_due_at`** is nullable (drafts carry no schedule); S-02 sets it to `now()` on save so
  saved cards are immediately due (see §4).
- **`last_reviewed_at`** has no SM-2 counterpart but is the natural tiebreaker for the
  Guardrails fallback "oldest due-card first."

**Type note:** `interval_days` is `integer`, but `supermemo()` returns `interval` as a `number`
that becomes fractional after `interval * efactor`. S-04 must `Math.round()` the interval before
writing `interval_days` (or the migration could make the column `numeric` — decide in `/10x-plan`).

**Constraint gap:** F-01's impl-review flagged adding `check (interval_days >= 0)` "before S-04
writes these columns" (`context/changes/cards-schema-and-rls/reviews/impl-review.md`, obs. F3).
Fold this into the same migration as `efactor`.

**Index gap:** the only index is `cards_user_id_status_idx on (user_id, status)`
(migration `:30`). The due query `status='saved' AND next_due_at <= now()` wants a partial index
`(user_id, next_due_at) where status='saved'` — F-01's plan explicitly deferred this to S-04.

### 2. API & data-access conventions (match these for the review endpoints)

Reference endpoints: `src/pages/api/generations.ts`, `src/pages/api/generations/save.ts`.

- **Handler shape:** `export const POST: APIRoute = async (context) => {...}`, with a local
  `json(body, status)` helper (`save.ts:14-19`) returning `Response` with
  `Content-Type: application/json`. (Helper is duplicated per file, not shared.)
- **Auth guard first:** `if (!context.locals.user) return json({ error: "unauthorized", ... }, 401)`
  (`generations.ts:18-21`). `context.locals.user` is populated by middleware (§4) and typed in
  `src/env.d.ts:1-5`.
- **User-scoped client:** `const supabase = createClient(context.request.headers, context.cookies)`
  → `503 supabase_unconfigured` if null (`src/lib/supabase.ts:5-24`). `createServerClient`
  (`@supabase/ssr`) binds the session cookie, so all queries run under the caller's `auth.uid()`
  and RLS holds automatically.
- **Body parse:** `await context.request.json()` in try/catch → `400 bad_request`.
- **Error envelope:** `{ error: "<code>", message: "<text>" }`; status codes in use: 200/400/401/500/502/503/504.
- **Atomic multi-row write via RPC:** `supabase.rpc("finalize_drafts", { p_accept_ids, p_reject_ids })`
  cast to a hand-written interface (`save.ts:83-86`). The function is `SECURITY INVOKER` +
  `set search_path = ''`, guards each statement on `status` for idempotency, and reports affected
  counts via `GET DIAGNOSTICS` (`20260529162956_finalize_drafts_fn.sql:14-32`). **This is the
  template for an atomic "rate card" write** if more than one row/statement is involved; a single
  `update cards set ... where id = ... and status='saved'` may not even need an RPC.
- **No zod / no CSRF-Origin checks** on JSON endpoints — validation is inline manual type guards
  (e.g. `asStringArray`, `save.ts:21-30`).

### 3. Types / DTO layer

- **No generated Supabase types.** Rows are cast with `.overrideTypes<Row[], { merge: false }>()`
  at the call site (`generate.astro:25`, `save.ts:66`); RPC results cast to a local interface
  (`FinalizeResult`, `save.ts:7-10`).
- **No central `src/types.ts`** — types are per-feature and inline. The only exported shared type
  is `CandidateCard { front, back }` from `src/lib/openrouter.ts:15-18`.
- **`efactor` / `supermemo` / `SM-2` / `easiness` appear nowhere** in the type layer (confirmed
  absent). S-04 introduces the first scheduling types — e.g. a `ReviewRating = "right" | "wrong"`
  and a due-card row type — defined locally in the review feature folder, consistent with
  convention.

### 4. Frontend / routing patterns

- **Protected route:** `PROTECTED_ROUTES = ["/dashboard", "/generate"]` in `src/middleware.ts:4`
  (prefix match; unauth → redirect `/auth/signin`). **Add `"/review"` here** — middleware is the
  only gate. (Matches the standing lesson in `lessons.md`: route placement is a deliberate choice
  and new protected pages must be wired into `PROTECTED_ROUTES`.)
- **Page recipe (mirror `src/pages/generate.astro:7-31,60`):** in frontmatter build a server
  `createClient(Astro.request.headers, Astro.cookies)`, query due cards with
  `.overrideTypes<...>()`, set a `loadError` flag, then render a React island with `client:load`
  inside `<Layout>` + the cosmic shell (`bg-cosmic min-h-screen p-4` → `mx-auto max-w-3xl ...`).
- **Client→API idiom (`DraftReviewList.tsx:54-84`):** raw `fetch` (no wrapper), local `useState`
  for domain state + `submitting: boolean` + `error: { code, message } | null`, a per-file
  `FALLBACK_MESSAGES: Record<string,string>` keyed by API error code, async handlers wired via
  `onClick={() => { void handleX(); }}`, `window.confirm(...)` for destructive actions.
- **The one deliberate divergence:** S-01/S-02 do `window.location.assign(...)` on success (full
  reload). A card-at-a-time review loop should instead POST each rating and **advance local state
  to the next card** (current-index + `revealed` boolean reset per card). The front→reveal-back
  interaction has no existing precedent — build with `useState`.
- **UI primitives:** `src/components/ui/` has only `button.tsx` (shadcn/CVA, **unused** by this
  feature area) and `LibBadge.astro`. The real visual language is inline glassmorphism Tailwind 4
  (`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl`), `cn` from
  `src/lib/utils.ts:4`, and `lucide-react` icons. The accept/reject green/red toggle styling
  (`DraftReviewList.tsx:141-145`) is the model for right/wrong buttons; `Eye` icon for reveal.

### 5. Prior decisions (why the fields exist; no contradiction with adding `efactor`)

- **F-01 plan** (`context/changes/cards-schema-and-rls/plan.md:69-80`): the schedule fields are
  "minimal SR bookkeeping … does not pre-commit to a specific SR algorithm; these are the only
  fields needed for the simplest models (Leitner or SM-2). S-04 will decide the scheduling formula
  via `/10x-research`." → `efactor` was **deferred, not rejected**.
- **S-02 plan** (`context/changes/atomic-save-to-deck/plan.md:34`): `next_due_at = now()` on
  promote is "the minimal correct initial state … S-04 owns the actual interval math," and
  explicitly feeds the S-04 query `status='saved' AND next_due_at <= now()`. Cards saved today are
  due immediately in the first review session.
- **PRD** (`context/foundation/prd.md`): US-02 + FR-013/014/015 require due cards one-at-a-time,
  binary right/wrong rating, and persisted next-due dates. FR-014's Socratic note: binary
  "stands … sophistication is a v2 lever." §Non-Goals: "Avoid: advanced spaced-repetition
  algorithm engineering." §Guardrails: review always offers something to study; "Fallback:
  oldest-due card first."
- **External research** (`external-research.md`): primary pick `supermemo` (SM-2), with hand-rolled
  Leitner as the simpler fallback; FSRS family explicitly avoided for v1 (multi-grade conflicts
  with binary FR-014, and it is the v2 "sophistication" the PRD parks).

## Code References

- `supabase/migrations/20260527150510_cards_and_account_deletion.sql:16-30` — `cards` table + RLS + the only index
- `supabase/migrations/20260529162956_finalize_drafts_fn.sql:14-32` — atomic RPC template; sets `next_due_at = now()` on save
- `src/lib/supabase.ts:5-24` — `createClient(headers, cookies)` user-scoped SSR client
- `src/middleware.ts:4-22` — `PROTECTED_ROUTES`, session population, redirect
- `src/env.d.ts:1-5` — `App.Locals.user`
- `src/pages/api/generations.ts:10-21,28-38,66-76` — endpoint template (json helper, auth/parse guards, draft insert defaults)
- `src/pages/api/generations/save.ts:7-10,21-30,83-93` — RPC call + cast, inline validation, response shape
- `src/pages/generate.astro:7-31,60` — protected-page recipe (server query → island via `client:load`)
- `src/components/generate/DraftReviewList.tsx:15-22,27-45,54-84,141-145` — fetch/state/error idiom, decision buffer, toggle styling
- `src/lib/openrouter.ts:15-18` — only exported shared DTO (`CandidateCard`)
- `src/lib/utils.ts:4` — `cn` class-merge util

## Architecture Insights

- **RLS-at-the-DB is the isolation guarantee.** Because every endpoint uses the cookie-scoped
  client, the review endpoints inherit cross-user isolation for free — no app-layer ownership
  checks needed beyond using `createClient(...)`. A "rate card" write should still be `where id = ?
  and status = 'saved'` so a stale/draft id is a silent no-op, mirroring `finalize_drafts`.
- **Atomicity pattern is RPC-shaped.** If S-04's write touches one row with one statement, a plain
  `.update()` suffices; reach for a `SECURITY INVOKER` RPC only if the rating needs multiple
  guarded statements (unlikely for SM-2).
- **No-generated-types convention** means S-04 keeps casting at the boundary; don't introduce a
  type-generation step as a side quest.
- **Deliberately simple is the contract.** Both the PRD and the external research push away from
  FSRS/multi-grade. SM-2 via the `supermemo` lib + a binary→grade collapse (`right→4`, `wrong→2`)
  is the sanctioned "simple model"; the only judgment call is that grade mapping.

## Historical Context (from prior changes)

- `context/changes/cards-schema-and-rls/plan.md:69-80` — fields are minimal SR bookkeeping, algorithm deferred to S-04
- `context/changes/cards-schema-and-rls/reviews/impl-review.md` (obs. F3) — add `check (interval_days >= 0)` before S-04 writes
- `context/changes/atomic-save-to-deck/plan.md:34` — `next_due_at = now()` on save feeds the S-04 due query

## Related Research

- `context/changes/srs-review-session/external-research.md` — exa.ai library survey; recommends `supermemo` (SM-2)
- `context/changes/srs-review-session/supermemo-docs.md` — Context7 SM-2 API, binary mapping, persistence pattern

## Open Questions

1. **SM-2 vs Leitner — final pick.** SM-2 needs the new `efactor` column; Leitner needs no
   migration (could reuse `repetition_count` as the box). External research calls both defensible.
   Recommendation: SM-2 (named in F-01, exact field mapping, real library), accepting the
   one-column migration. **Decide in `/10x-plan`.**
2. **`interval_days` type:** keep `integer` and `Math.round()` the SM-2 interval, or widen to
   `numeric`? Round-to-integer keeps the schema unchanged on that column.
3. **Initial vs subsequent due dates:** S-02 left saved cards at `next_due_at = now()`,
   `interval_days = 0`, `repetition_count = 0`, `last_reviewed_at = NULL` — confirm SM-2's first
   "right" produces the expected 1-day interval from that initial state.
4. **Dependency vs hand-roll:** add `supermemo` (12.5KB, MIT, zero-dep) to `package.json`, or
   inline the ~15-line SM-2 function to avoid a new dep on the Workers edge runtime? Both are
   edge-safe; weigh in `/10x-plan`.
5. **Route placement:** dedicated `/review` page (recommended per `lessons.md`) vs a dashboard
   CTA — confirm during planning and wire into `PROTECTED_ROUTES` either way.

## Follow-up Research 2026-05-30 — Is `leitner-docs.md` compatible with the codebase?

Fresh live-code verification (two parallel sub-agents + direct re-read of
`src/pages/api/generations/save.ts` and `src/lib/supabase.ts`), checking each claim in
[[leitner-docs.md]] against the schema and app layer at commit `c49ea4e`.

### Verdict: **COMPATIBLE.** Leitner is a cleaner fit than SM-2.

Every database claim passes; the only DB work is **two additive, non-breaking migrations** (a
partial index, and the already-planned `check (interval_days >= 0)`). Notably, Leitner needs **no
new column** and — because `BOX_INTERVALS_DAYS` are integers — **no interval rounding** (the
SM-2 fractional-`interval` concern in Open Question #2 simply does not arise). That makes Leitner
strictly less risky against this schema than SM-2.

### Schema claims — all PASS (live evidence)

| # | Claim | Verdict | Evidence |
| - | --- | --- | --- |
| 1 | `repetition_count` int default 0 → box index | ✅ PASS | `20260527150510_cards_and_account_deletion.sql:24` |
| 2 | `interval_days` int d.0, `next_due_at`/`last_reviewed_at` nullable timestamptz | ✅ PASS | same migration `:22-25` |
| 3 | no `efactor` column (spec drops it) | ✅ PASS | full table `:16-28` — absent |
| 4 | no `check (interval_days >= 0)` yet (F-01 forward item) | ✅ PASS (absent) | `:23` |
| 5 | only `(user_id, status)` index; partial due-index missing | ✅ PASS (absent) | `:30` |
| 6 | `cards_set_updated_at` BEFORE UPDATE trigger auto-bumps `updated_at` | ✅ PASS | `:32-34` |
| 7 | `status` check allows only `('draft','saved')` — Leitner adds none | ✅ PASS | `:21` |
| 8 | `cards_update_own` RLS (USING + WITH CHECK on `auth.uid()=user_id`) | ✅ PASS | `:46-49` |
| 9 | `finalize_drafts` sets `status='saved'`, `next_due_at=now()`; leaves `interval_days`/`repetition_count`/`last_reviewed_at` at 0/0/NULL | ✅ PASS | `20260529162956_finalize_drafts_fn.sql:21-23` |

The `interval_days=0` initial value vs. box-0→1-day mapping is **harmless**: the due query keys on
`next_due_at` (`now()` on save → immediately due), not `interval_days`; the column is informational
until the first review writes it.

### App-layer claims — PASS with caveats

- **Single-row `.update()` fits conventions** — but would be the *first* `.update()` in the repo.
  Existing direct writes are INSERT (`generations.ts:78`) / DELETE (`generations/discard.ts:22`) /
  SELECT; the multi-row transactional case (`finalize_drafts`) is the only RPC. A single-row review
  write going direct (not RPC) is the right call and matches the `discard.ts`/`generations.ts`
  precedent. Endpoint scaffolding (`json()` helper, `locals.user` 401 guard, `createClient` 503
  guard, JSON-parse 400, `{ error, message }` envelope) is identical across all three generation
  endpoints — `/api/reviews` clones it (`save.ts:14-48,89`).
- **No generated-types blocker** — `.overrideTypes<...>()` / manual cast convention confirmed
  (`save.ts:4-6,62-66`); a typed `.update({...})` payload is consistent.
- **Page + island + fetch recipe holds** — `generate.astro:7,20-25,60` → React island via
  `client:load`, raw `fetch` + `useState`. A `/review.astro` + `ReviewSession` island clones it.
- **`PROTECTED_ROUTES`** (`middleware.ts:4`, prefix match `:18-22`) — add `"/review"` for the
  page. **Caveat:** middleware only *redirects* unauth page loads; it does **not** 401 the API.
  `/api/reviews` must keep its own in-handler `if (!user) return 401` guard (every endpoint already
  does). Don't read "add to PROTECTED_ROUTES" as protecting the endpoint.
- **Edge-runtime safe** — `Date.now()` / `toISOString()` / arithmetic are V8 globals, no
  `nodejs_compat` dependency (`wrangler.jsonc` compat date 2026-05-08). Islands already use
  `Date.now()`.

### The one substantive caveat: the box update is NOT idempotent

`finalize_drafts` is replay-safe via its `status='draft'` guard + completeness check
(`save.ts:58-79`): a second submit fails closed. A Leitner write
`update cards set ... where id=? and status='saved'` has **no such guard** — the row is still
`status='saved'` after the write, so a double-POST of "right" promotes the box twice, and a stale
"wrong" after a "right" resets to 0. A review session is rapid repeated single-card writes — the
exact shape where a double-tap / retry / refresh double-promotes. The current repo mitigation is
client-side button-disable only (`DraftReviewList.tsx:169`), which a network retry defeats.

**Recommended fix (cheap, fits the existing fail-closed pattern):** guard the WHERE on the expected
current box — `update ... where id=? and status='saved' and repetition_count = <expectedBox>`. A
replay then matches 0 rows (the endpoint reports "already applied"). Decide in `/10x-plan`;
alternatives are an optimistic check on `last_reviewed_at` or an idempotency key (heavier).

### Minor notes for `/10x-plan`

- **Fixed 24h day** (`interval * 86_400_000` ms) ignores DST/calendar; acceptable for a
  "deliberately simple" UTC-timestamp model — make it a conscious one-line note, not a latent
  surprise.
- **No CSRF/Origin check** on JSON endpoints (consistent with S-01/S-02) — `/api/reviews` follows
  suit; auth rests on the session cookie.

### Net effect on the earlier Open Questions

- #1 (SM-2 vs Leitner): verification **reinforces Leitner** — no column, no rounding, less risk.
- #2 (`interval_days` integer vs numeric): **moot under Leitner** — intervals are integers by
  construction.
- #3 (initial state): **confirmed** — `finalize_drafts` leaves box 0 / due-now, exactly what
  Leitner expects.
- #4 (dependency): **moot** — Leitner is hand-rolled, no dep (see [[leitner-docs.md]]).
- **New:** add the non-idempotent-write guard to the plan's contract.
