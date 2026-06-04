---
date: 2026-06-03T21:22:23-0500
researcher: Rafal S
git_commit: e52f97a187c7eabaed020d1a120f8b3b09a46c80
branch: dev
repository: 10xCards
topic: "Cross-user isolation + write authorization (test-plan §3 Phase 2)"
tags: [research, codebase, rls, authorization, isolation, retention-lock, validation-parity, R2, R4, R5]
status: complete
last_updated: 2026-06-03
last_updated_by: Rafal S
---

# Research: Cross-user isolation + write authorization (Phase 2)

**Date**: 2026-06-03T21:22:23-0500
**Researcher**: Rafal S
**Git Commit**: e52f97a187c7eabaed020d1a120f8b3b09a46c80
**Branch**: dev
**Repository**: 10xCards

## Research Question

Phase 2 of the frozen test rollout (`context/foundation/test-plan.md` §3): prove the
PRD-named ship-blocker. Produce the oracle and the code map for three risks, weighted
**R2-first**:

- **R2** (cross-tenant leak) — does every data endpoint scope to the session user, with
  every Supabase client call traced (user-scoped/RLS-enforcing vs admin/service-role)?
- **R4-lock** (retention write-block) — does the 30-day read-only lock block all write
  routes (lighter coverage; the sweep predicate is Phase 4, out of scope)?
- **R5** (untrusted-input parity) — does the server reject bad input and ignore
  client-supplied `user_id`/`status` (lighter coverage)?

Scope decisions (user-confirmed): R2-first depth; **trace every Supabase client call** as
the decisive R2 oracle.

## Summary

**The isolation model is single-client, RLS-as-last-line, with no application-level
bypass — and the test must reflect that.**

1. **There is exactly one Supabase client factory** (`src/lib/supabase.ts:5-24`):
   `createClient(headers, cookies)` built on `@supabase/ssr` with the **anon key
   (`SUPABASE_KEY`) + the user's session cookies**. Every query runs as `auth.uid()` and is
   **RLS-enforced**. **No service-role / admin client exists anywhere in `src/`** —
   repo-wide grep for `service_role` finds only docs. So **no endpoint bypasses RLS**, and
   R2's "Category B" (admin-client bypass where an explicit filter is the only defense) is
   **empty by construction**.

2. **Four mutation paths rely on RLS as the SOLE owner check** (no explicit
   `.eq('user_id', …)` in code): `cards/[id].ts` PATCH and DELETE, `reviews.ts` POST (takes
   `cardId` from the request body), and `generations/save.ts`. These are the **highest-signal
   R2 targets** — a real two-user integration test against the live DB is the only thing that
   gives genuine signal here (a stubbed client would lie about RLS).

3. **The retention write-lock (R4) is complete and correct.** All **7 mutating routes** call
   `readOnlyGuard(locals)` (→ 403 `account_read_only`) immediately after the 401 check; the
   2 account-lifecycle routes (`cancel`, `delete`) deliberately skip it (cancel must lift the
   lock). The flag `locals.isReadOnly` is computed **per request** in middleware from the
   *presence of a row* in `account_deletion_requests` (`!!row`), and **fails closed** on DB
   error. No gaps found — the test proves the contract holds, it is not chasing a known bug.

4. **R5 validation parity is correct in code, but untested beyond Phase 1.** Every write
   endpoint uses the **construct-don't-spread** pattern (payload built field-by-field from
   server-derived values; `user_id = locals.user.id`, `status` a hardcoded literal). The
   forged-`user_id`/`status` assertion that exists for `generations.ts` is **not replicated**
   for any other write endpoint — that absence is the real R5 coverage gap, not a code defect.

**Oracle baseline already on record:** the RLS isolation guarantee was proven at the DB layer
with 14 passing assertions in
`context/archive/2026-05-27-cards-schema-and-rls/verify-rls-results.md`. Any Phase-2 test must
continue to uphold that, now from the *endpoint* surface rather than raw SQL.

## Detailed Findings

### R2 — Cross-user isolation (primary)

#### The single, RLS-enforcing client

- `src/lib/supabase.ts:5-24` — sole factory `createClient(requestHeaders, cookies)`;
  `createServerClient(SUPABASE_URL, SUPABASE_KEY, {…cookies…})` (line 9). `SUPABASE_KEY` is the
  **anon/publishable** key (`astro.config.mjs:20`; confirmed by deploy notes — service_role is
  explicitly kept out of code). Cookies carry the user JWT → every query is `auth.uid()`-scoped.
- `src/middleware.ts:6-49` constructs its own client **only** to resolve `locals.user` and the
  retention flag. It does **not** attach `locals.supabase`; `App.Locals` (`src/env.d.ts:1-7`)
  exposes only `user`, `isReadOnly`, `retentionUntil`. So **every endpoint builds its own
  identical anon client** and takes the user id from `locals.user` (never the body).
- **No `service_role` client in `src/`** — grep finds it only in `notes/` and
  `context/deployment/`. R2 Category B (RLS-bypass paths) is **empty**.

#### Per-endpoint client + ownership map

| Endpoint | Client | RLS? | Explicit `user_id` filter | Last line of defense |
|---|---|---|---|---|
| `api/cards.ts` POST (`:59-64`) | anon (`:36`) | ✓ | INSERT sets `user_id: user.id` (`:61`) | RLS + insert sets owner |
| `api/cards/[id].ts` PATCH (`:62-68`) | anon (`:33`) | ✓ | **None** — `.eq("id").eq("status","saved")` only | **RLS only** |
| `api/cards/[id].ts` DELETE (`:102-108`) | anon (`:89`) | ✓ | **None** — `.eq("id").eq("status","saved")` only | **RLS only** |
| `api/generations.ts` POST (`:82`) | anon (`:70`) | ✓ | INSERT sets `user_id: user.id` (`:76`) | RLS + insert sets owner |
| `api/generations/save.ts` POST | anon (`:42`) | ✓ | **None** on draft SELECT (`:66-70`); RPC `finalize_drafts` scoped server-side | **RLS only** |
| `api/generations/discard.ts` POST (`:26`) | anon (`:21`) | ✓ | **Yes** — `.eq("user_id", user.id).eq("status","draft")` | RLS **and** filter |
| `api/reviews.ts` POST (`:60-72`) | anon (`:26`) | ✓ | **None** — `cardId` from **body** (`:39,43`); `.eq("id").eq("status").eq("repetition_count")` | **RLS only** |
| `api/account/cancel.ts` POST (`:27`) | anon (`:21`) | ✓ | **Yes** — `.delete().eq("user_id", user.id)` | RLS **and** filter |
| `api/account/delete.ts` POST (`:33-49`) | anon (`:23`) | ✓ | **Yes** — INSERT/select `.eq("user_id", user.id)` | RLS **and** filter |

#### Flagged R2 risk paths (where RLS is the SOLE barrier)

1. **`api/reviews.ts` POST** — *highest attention*: `cardId` comes from the **request body**
   (`src/pages/api/reviews.ts:39,43`); the write is gated only by `id` + `status` +
   `repetition_count` (`:60-72`). The comment (`:57-58`) names `cards_update_own` RLS as the
   scoping. If RLS regressed, user A could reschedule user B's card by passing B's id.
2. **`api/cards/[id].ts` PATCH** (`:62-68`) and **DELETE** (`:102-108`) — operate by `id` +
   `status` only; comments (`:61`, `:99`) explicitly say "RLS confines to the owner." A foreign
   id matches zero rows → translated to `404 not_found`.
3. **`api/generations/save.ts`** (`:66-70` SELECT, `:87-90` RPC) — the completeness/exact-cover
   guard works *only because* RLS scopes the draft SELECT to the caller. `finalize_drafts` is
   `security invoker` (see RLS section), so the caller's policies still apply.

#### RLS policy SQL (the actual DB enforcement — the oracle floor)

All policy SQL: `supabase/migrations/20260527150510_cards_and_account_deletion.sql`. RLS
enabled on both app tables; 4 policies each, all keyed on `(select auth.uid()) = user_id`,
scoped to role `authenticated`.

- **`public.cards`** (`:36-53`): `cards_select_own` (USING), `cards_insert_own` (WITH CHECK),
  `cards_update_own` (USING + WITH CHECK), `cards_delete_own` (USING). Owner col `user_id`
  `references auth.users(id) on delete cascade` (`:18`).
- **`public.account_deletion_requests`** (`:62-79`): same 4-policy shape; owner col `user_id`
  is the PK (`:57`).
- **Only two app tables exist.** Drafts and review progress are **states/columns of `cards`**
  (`status='draft'|'saved'`; SR columns `next_due_at`, `interval_days`, `repetition_count`,
  `last_reviewed_at`). No `profiles`, `generations`, `drafts`, or `reviews` table.
- `finalize_drafts(...)` — `20260529162956_finalize_drafts_fn.sql:17` is **`security invoker`**
  → runs under caller's `auth.uid()`, existing policies apply; header note: "passing another
  user's id is a silent no-op, not a leak."
- `sweep_expired_account_deletions()` — `20260602120000_account_deletion_sweep.sql:19` is
  **`security definer`** (intentional RLS bypass to reach `auth.users`), but **EXECUTE is
  revoked from `public`/`anon`/`authenticated`** (`:36-38`) and granted only to `service_role`
  (`:46`). Unreachable from any user-facing role. *(This is the Phase-4 sweep, out of scope here.)*

#### Isolation properties (from the policy predicates)

- Anonymous access returns nothing (`auth.uid()` is NULL for `anon`; policies are
  `authenticated`-only).
- Cross-user SELECT → 0 rows; cross-user DELETE → 0 rows affected (can't see them).
- Cross-user INSERT/UPDATE claiming another `user_id` → `ERROR 42501` via `WITH CHECK`. The
  archive plan flags omitting `WITH CHECK` as "the exact failure mode PRD §Guardrails calls
  ship-blocking" (`…cards-schema-and-rls/plan.md:50`).

### R4-lock — Retention write-block (lighter)

#### Oracle

- **PRD FR-017** (`context/foundation/prd.md:136`): during the 30-day retention state "the
  account is **locked to read-only** (the user may log in and view their cards but cannot
  create, edit, delete, generate, or review)."
- **PRD FR-018** (`prd.md:139`): user can cancel during the window, "which restores full
  (read-write) access." Clarified (`change.md` / plan-review F3): cancellation is an **explicit
  Cancel button**; re-login alone stays read-only.
- Archive intent (`context/archive/2026-06-01-account-deletion-with-retention/plan.md:21,134,138`):
  exactly **7 write handlers** must be locked; a shared guard returns **403
  `account_read_only`**; `cancel`/`delete` must **not** be guarded.

#### Coverage (complete — no gaps)

Guard `readOnlyGuard(locals)` — `src/lib/account-retention.ts:5-19` — pure function of
`locals.isReadOnly`, returns `null` (proceed) or a 403 `Response`. Called identically
(`const ro = readOnlyGuard(context.locals); if (ro) return ro;`) right after the 401 check in:

| Route | Locked? | Where |
|---|---|---|
| `api/cards.ts` POST | ✓ | `src/pages/api/cards.ts:33-34` |
| `api/cards/[id].ts` PATCH | ✓ | `src/pages/api/cards/[id].ts:30-31` |
| `api/cards/[id].ts` DELETE | ✓ | `src/pages/api/cards/[id].ts:86-87` |
| `api/generations.ts` POST | ✓ | `src/pages/api/generations.ts:24-25` |
| `api/generations/save.ts` POST | ✓ | `src/pages/api/generations/save.ts:39-40` |
| `api/generations/discard.ts` POST | ✓ | `src/pages/api/generations/discard.ts:18-19` |
| `api/reviews.ts` POST | ✓ | `src/pages/api/reviews.ts:23-24` |
| `api/account/delete.ts` POST | **skip (by design)** | comment at `:13-16` |
| `api/account/cancel.ts` POST | **skip (by design — lifts lock)** | comment at `:11-14` |

#### How the flag is computed

`src/middleware.ts:18-40`, **every request**: PK lookup on `account_deletion_requests` by
`user_id`; `locals.isReadOnly = !!row` (row present ⇒ read-only, independent of whether
`retention_until` is past). **Fails closed**: on DB error sets `isReadOnly = true` (`:31`).
Cancel (`account/cancel.ts:27`) deletes the row → next request's `!!row` is `false` → read-write
restored (this is *why* cancel must not be guarded — guarding it would deadlock the lock).
`isReadOnly` also drives read-only UI (banner, disabled affordances) as defense-in-depth, but
the backend guard is the source of truth.

### R5 — Untrusted-input / validation parity (lighter)

#### Oracle

- **FR-009 / US-03** (`context/foundation/prd.md:82,84,110`): create-card front and back are
  **required, non-empty**; "validation prevents saving a card with an empty front or back."
- **Isolation NFR** (`prd.md:145,165`): the "ignore client-supplied ownership" half.
- **No PRD length ceiling.** The 200–8000 source bound and front≤500/back≤2000 candidate bounds
  are **implementation constants** (`openrouter.ts`, `generations.ts`), not PRD requirements —
  so a max-length test on `cards.ts`/`[id].ts` would have **no oracle** and should be deferred
  (stop-and-ask rule).

#### Established server-authoritative pattern (the reference)

`src/pages/api/generations.ts:75-80` builds the insert **field-by-field**, never spreads the
body: `user_id: user.id` (from `locals`, `:19`), `status: "draft"` (hardcoded), `front`/`back`
from the validated provider output; `id`/`created_at` never written. Pinned by
`src/pages/api/generations.test.ts:250-291` (forges `user_id`/`status`/`id`/`created_at`,
asserts recorded insert is exactly `{back, front, status:"draft", user_id:"u1"}`).

#### Per-endpoint parity (code correct; tests absent)

| Endpoint | Input validation | Payload | Injectable ownership/status? | Gap |
|---|---|---|---|---|
| `cards.ts` POST | `asNonEmptyString` front/back (`:48-54`) | literal `{user_id:user.id, front, back, status:"saved", next_due_at:now()}` (`:61`) | **No** | No test |
| `cards/[id].ts` PATCH | `asNonEmptyString` (`:50-56`); `id` from route param | literal `{front, back}` (`:65`) + `.eq("status","saved")` | **No** | No test |
| `cards/[id].ts` DELETE | `id` from route param; no body | scoped delete (`:105-106`) | **No** | No test |
| `generations/save.ts` POST | `asStringArray`, ≤100; **exact-cover** guard (`:66-83`) | only validated id arrays → RPC | **No** | No test |
| `generations/discard.ts` POST | none (no body) | scoped delete `.eq("user_id").eq("status","draft")` | **No** | No test |
| `reviews.ts` POST | `cardId` non-empty (`:43`), `rating` enum (`:44`), `currentBox` int (`:45`) | computed from `schedule()`; scoped `.eq` + RLS | **No** | No test |

- **No shared validation module, no zod in any endpoint.** Per-endpoint manual helpers:
  `asNonEmptyString` (duplicated in `cards.ts:21-25` and `cards/[id].ts:18-22`), `asStringArray`
  (`save.ts:22-31`), `isReviewRating` (`reviews.ts:13-15`). The only `zod` in `src/` is
  `openrouter.ts` — the **JSON schema sent to the model**, not request validation.
- **Characterised non-gap (not R5):** `extractCards` does not re-enforce the 500/2000 ceilings,
  so over-length AI candidates persist (`generations.test.ts:293-312`). Already a `TODO(R1)`.

## Code References

- `src/lib/supabase.ts:5-24` — sole anon+cookie (RLS-enforcing) client factory; no service-role.
- `src/middleware.ts:6-49` — resolves `locals.user` + `locals.isReadOnly`/`retentionUntil`; no `locals.supabase`.
- `src/env.d.ts:1-7` — `App.Locals` shape (`user`, `isReadOnly`, `retentionUntil`).
- `src/lib/account-retention.ts:5-19` — `readOnlyGuard` (403 `account_read_only`); `:24-29` `formatRetentionDate`.
- `src/pages/api/reviews.ts:39,43,60-72` — **R2 top target**: `cardId` from body, RLS-only owner scoping.
- `src/pages/api/cards/[id].ts:62-68,102-108` — PATCH/DELETE, RLS-only owner scoping.
- `src/pages/api/generations/save.ts:66-90` — RLS-scoped draft select + `finalize_drafts` RPC.
- `src/pages/api/cards.ts:48-64`, `generations.ts:75-80` — construct-don't-spread insert pattern.
- `src/pages/api/generations.test.ts:250-291` — Phase-1 forged-field assertion (R5 reference).
- `supabase/migrations/20260527150510_cards_and_account_deletion.sql:36-79` — RLS enable + 8 policies.
- `supabase/migrations/20260529162956_finalize_drafts_fn.sql:17` — `security invoker`.
- `supabase/migrations/20260602120000_account_deletion_sweep.sql:19,36-46` — `security definer`, EXECUTE revoked from user roles.

## Architecture Insights

- **RLS is the deliberate, single isolation layer.** Per `…cards-schema-and-rls/plan-brief.md:7,51`:
  RLS lives "in the database (not in app code) so every later slice inherits isolation without
  re-implementing it." Four endpoints intentionally carry no app-level `user_id` filter — the
  test must therefore exercise **real RLS against a real DB with two real users**; a stub client
  would lie about it. This matches test-plan §2 R2 guidance: "Testing RLS in isolation while the
  endpoint quietly uses an admin client" is the anti-pattern — here there *is* no admin client,
  so the integration two-user fixture is exactly right.
- **`service_role` is the one thing that would break this silently.** Sources repeatedly warn to
  keep it out of any user-input path (`plan.md:51`, `deploy-plan.md:92-94`). Current code is
  clean. A guard-rail test idea: assert no endpoint imports a service-role key (cheap regression
  net), though the primary signal is the two-user DB test.
- **Retention lock = middleware-derived boolean + per-route guard.** Centralized flag, explicit
  per-route call. The fail-closed default and the deliberate cancel/delete exemptions are the two
  behaviors worth pinning.
- **Validation is manual and duplicated** (no zod at the request edge). Tests should assert
  *behavior* (forged fields ignored; empty rejected), not the helper internals.

## Historical Context (from prior changes)

- `context/archive/2026-05-27-cards-schema-and-rls/` — RLS design + the **14-assertion
  isolation proof** (`verify-rls-results.md:50`: "All 14 assertions held… ship-blocker is proved
  at the database layer"). `plan.md:50` ties `WITH CHECK` omission to the ship-blocking failure.
  `impl-review.md` notes no isolation defects + 4 forward hardenings.
- `context/archive/2026-06-01-account-deletion-with-retention/` — the read-only lock contract:
  7 routes guarded, 403 `account_read_only`, row-presence invariant, cancel/delete exemptions,
  and the sweep predicate (Phase-4 scope, captured for context only).
- `context/archive/2026-05-29-atomic-save-to-deck/` — `finalize_drafts` RPC origin (Phase-3 deck
  integrity territory; relevant only because `save.ts` is an R2 RLS-only path).

## Related Research

- `context/foundation/test-plan.md` §2 (R2/R4/R5 risk response) and §6.3/§6.4 (cookbook slots
  this phase fills: "test for a new API endpoint" and "cross-user isolation test").
- `context/changes/testing-generation-resilience/` — Phase-1 research/plan; established the
  integration recipe (`§6.2`) and the construct-don't-spread R5 assertion this phase extends.

## Open Questions

1. **Two-user integration fixtures against the real DB.** Test-plan §4 mocks Supabase via
   `vi.mock('@/lib/supabase')` for *payload* assertions, but R2's RLS signal **requires a real
   DB** (a stub can't enforce `auth.uid()`). The plan must decide: spin up two real users
   (service_role-seeded, per the memory note on test-user creation) hitting each endpoint with
   the *other* user's resource id, asserting 404/0-rows. This is the §6.4 pattern to capture.
   → Decide in `/10x-plan`: real-DB integration harness vs. accept RLS-proven-once (`verify-rls-results.md`)
   and only test the *endpoint translation* (foreign id → 404) with a thin RLS-emulating stub. The
   former is higher-signal; the latter is cheaper but risks the "stub lies about RLS" trap.
2. **`finalize_drafts` cross-user behavior** — confirmed `security invoker` (so RLS applies), but
   no test asserts that passing another user's draft ids is a silent no-op. Worth one assertion.
3. **`reviews.ts` foreign-`cardId`** is the single best R2 integration test (body-supplied id +
   RLS-only). Confirm the expected response for a foreign id: code returns `applied:false`
   (`:80`) rather than 404 — the oracle (deny, no mutation) is met either way, but the assertion
   shape differs from `cards/[id].ts` (404). Pin the exact contract per endpoint.
4. **Guard-rail test for service-role absence** — optional cheap regression: assert no `src/`
   module reads a service-role key. Low cost, catches the one silent isolation-breaker.
