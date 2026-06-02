# Account Deletion with 30-Day Retention — Implementation Plan

## Overview

Implement user-initiated account deletion (FR-016), a 30-day read-only retention window (FR-017), and re-login cancellation (FR-018). A user requests deletion from a new `/settings` page; their account enters a `pending_deletion` state where they stay logged in but every write surface is locked read-only; a persistent banner offers a Cancel button that restores read-write; and after 30 days a daily Supabase **pg_cron** sweep hard-deletes the account, cascading away all cards.

The destructive piece is built and proven first, in isolation, because a bug there is the highest-stakes failure: either data is never deleted (broken promise) or deleted before the user can cancel (irreversible loss).

## Current State Analysis

F-01 (`cards-schema-and-rls`) already laid the data foundation — **no new tables are needed**:

- `public.account_deletion_requests` exists: `user_id uuid PRIMARY KEY references auth.users(id) on delete cascade`, `requested_at timestamptz not null default now()`, `retention_until timestamptz not null`. Full RLS (select/insert/update/delete scoped to `auth.uid() = user_id`). — `supabase/migrations/20260527150510_cards_and_account_deletion.sql:55-80`
- `public.cards.user_id` also references `auth.users(id) on delete cascade`. — same migration `:18`
- Therefore **hard-delete = delete the `auth.users` row**; cards and the request row cascade away in one transaction. No app-side multi-table cleanup.
- Migrations are enabled (`supabase/config.toml:53-58`); applied to **remote** Supabase only (no local stack).

Application surfaces today:

- `src/middleware.ts` populates `context.locals.user` per request and guards `PROTECTED_ROUTES = ["/dashboard","/generate","/review","/library"]`. — `src/middleware.ts:4,18-22`
- Seven mutating API routes, each guarding only on `context.locals.user`: `api/cards.ts` (POST), `api/cards/[id].ts` (PATCH, DELETE), `api/generations.ts` (POST), `api/generations/save.ts` (POST), `api/generations/discard.ts` (POST), `api/reviews.ts` (POST).
- User-scoped Supabase client via `createClient(headers, cookies)` from `src/lib/supabase.ts`.
- No `/settings` route exists. Dashboard is a set of gradient action links + a sign-out form (`src/pages/dashboard.astro`).
- Shared `src/layouts/Layout.astro` renders a top `Banner.astro` (variants `info`/`warning`/`error`). An **unused `src/components/Topbar.astro`** exists. No modal, no toast — destructive actions use `window.confirm()`; errors render inline as `<p>`.

## Desired End State

A logged-in user can open `/settings`, click "Delete account", confirm, and land back in the app still logged in but **read-only**, with a global banner stating the deletion date and a Cancel button. Clicking Cancel restores full read-write immediately. If they do nothing, a daily DB sweep removes their account and all cards on the day after `retention_until`. No write path (cards, AI generation, review) succeeds while pending. Verification: backdated throwaway user is fully cascade-deleted by the sweep; every mutating endpoint returns 403 while pending; cancel returns the account to read-write.

### Key Discoveries:

- `account_deletion_requests` and the cascade chain already exist — Phase 1 only adds a function + schedule. — `supabase/migrations/20260527150510_cards_and_account_deletion.sql:55-80`
- Read-only enforcement is cross-cutting across exactly 7 write routes; a single `locals.isReadOnly` flag computed in middleware + a one-line guard per route is the auditable pattern, mirroring the existing `locals.user` check at `src/pages/api/cards.ts:27-30`.
- Deleting `auth.users` requires elevated privilege the user-scoped client lacks → a `SECURITY DEFINER` function is the mechanism; pg_cron invokes it.
- The invariant that keeps the flow forgiving: **a request row existing = pending & cancellable**, even past `retention_until`. Deletion is real only when the row is gone (cascade). This makes the ≤24h sweep lag harmless.

## What We're NOT Doing

- **No data export before deletion** — parked in roadmap §Parked; separate FR + slice.
- **No pre-delete email notification** — parked; depends on custom SMTP (Open Roadmap Question #1).
- **No magic-link cancellation** — cancellation is an authenticated in-app action (FR-018 re-login intent satisfied by the logged-in session). **Confirmed interpretation (PRD owner, 2026-06-02):** FR-018's "cancel by logging back in" is satisfied by an *explicit Cancel button* shown to the (still or re-) authenticated user, not by re-authentication auto-cancelling. Re-login alone keeps the account read-only (FR-017); cancellation is always a deliberate click. This resolves the FR-017/FR-018 tension in favor of a deliberate action.
- **No new modal/toast system** — reuse `window.confirm()` and inline `<p>` errors, matching the codebase.
- **No CSRF/Origin hardening** — the codebase doesn't do it on existing write routes; not introduced here.
- **No changes to RLS policies on `cards`** — read-only is enforced in the app layer, not by rewriting card policies.
- **No `profiles` table** — soft-delete state stays in `account_deletion_requests`.

## Implementation Approach

Three phases, sequenced destructive-first → enforcement → UI:

1. **pg_cron sweep** (DB migration, proven against a backdated throwaway user before any UI exists).
2. **Backend**: middleware computes `locals.isReadOnly`; a shared guard rejects writes on all 7 routes; request + cancel endpoints manage the row.
3. **Frontend**: `/settings` request flow, global retention banner with Cancel, dashboard link, and UI write-action gating.

## Critical Implementation Details

- **Privilege & schema ownership (Phase 1).** The sweep must delete from `auth.users`, which the `authenticated` role and the user-scoped client cannot touch. The function is `SECURITY DEFINER` owned by a role with delete rights on `auth.users`. Direct `DELETE FROM auth.users WHERE id = ...` cascades through both `public` (cards, request row) and the `auth` schema's own child tables (sessions, identities, refresh tokens all reference `auth.users` with cascade). Verify the cascade empties `public.cards` for the deleted user during the Phase 1 test — do not assume.
  - **Privilege is unverified — gate it first.** On managed Supabase `auth.users` is owned by `supabase_auth_admin`, and the migration role `postgres` is *not* a superuser; you also cannot own the function as `supabase_auth_admin` (can't grant that role membership). Whether a `postgres`-owned definer function may delete from `auth.users` is therefore unproven — it works in the SQL Editor (which also runs as `postgres`), so it likely does, but confirm before building on it. The Phase 1 cascade test (success criterion below) doubles as this gate: if the `auth.users` row does **not** disappear, `postgres` lacks the privilege — stop and switch to the fallback in **Migration Notes** (Edge Function + `auth.admin.deleteUser`) rather than fighting the privilege.
- **Guard must be live the instant the request lands (Phase 2).** Because the user stays logged in read-only immediately after requesting (chosen flow), the request endpoint itself must not depend on read-only being off, and the very next navigation must already compute `isReadOnly = true`. Compute it in middleware from the same per-request Supabase read so there's no stale window.
- **Read-only covers all 7 write routes (Phase 2).** A single missed route silently leaks write access — the same discipline F-01 applied to RLS. The guard is one shared helper called at the top of each mutating handler, right after the existing `user` null-check.
- **`App.Locals` type extension (Phase 2).** `locals.isReadOnly` (and `locals.retentionUntil` for the banner) must be added to the `App.Locals` interface (in `src/env.d.ts` or equivalent) or TypeScript/ESLint will reject the access.

## Phase 1: Scheduled Hard-Delete (pg_cron)

### Overview

Add a `SECURITY DEFINER` sweep function and a daily pg_cron schedule that hard-deletes accounts whose retention window has elapsed. No app code in this phase. Prove the cascade with a backdated throwaway user.

### Changes Required:

#### 1. Sweep function + schedule migration

**File**: `supabase/migrations/<timestamp>_account_deletion_sweep.sql` (new)

**Intent**: Create a function that deletes every `auth.users` row whose `account_deletion_requests.retention_until < now()`, relying on the existing cascade to remove that user's cards and request row; then schedule it daily via pg_cron. This is the mechanism that fulfills FR-017's "after the window elapses … hard-deleted".

**Contract**:
- `create extension if not exists pg_cron;` (Supabase: extension lives in the `cron` schema; enable if not already present).
- `public.sweep_expired_account_deletions()` — `returns integer` (count deleted), `language sql` or `plpgsql`, **`security definer`**, **`set search_path = ''`** (pin against search-path hijacking — Supabase DB linter flags an unpinned definer; with an empty path every object must be schema-qualified), owned by a role permitted to delete from `auth.users`. Body deletes `from auth.users where id in (select user_id from public.account_deletion_requests where retention_until < now())` (note both names are fully qualified). `revoke execute ... from public, anon, authenticated;` — only cron/service_role may call it.
- `select cron.schedule('account-deletion-sweep', '0 3 * * *', $$ select public.sweep_expired_account_deletions(); $$);` (daily 03:00 UTC).

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against remote: `npx supabase db push` (or the project's migration command) succeeds.
- `pg_cron` job is registered: `select jobname from cron.job;` includes `account-deletion-sweep`.
- Backdated-user cascade test passes (**privilege gate** — run this first): create a throwaway `sweep-test@example.invalid` user (service_role), insert `account_deletion_requests` with `retention_until = now() - interval '1 day'` + a card; run `select public.sweep_expired_account_deletions();`; assert the `auth.users` row itself is gone (proves `postgres` has delete rights — if it survives, switch to the Migration Notes fallback), and that their card and the request row are gone and a control user (different id, future `retention_until`) is untouched.
- `npm run lint` and `npm run build` pass (no app changes, but confirm repo stays green).

#### Manual Verification:

- The sweep function is not callable by `authenticated` (attempt via SQL as an anon/auth role errors on permission).
- Reviewer confirms the cascade emptied `public.cards` for the test user (no orphan rows) and that only the expired user was deleted.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before Phase 2. The throwaway test MUST be scoped strictly to `@example.invalid` ids — verify no real user was affected.

---

## Phase 2: Backend — Request/Cancel Endpoints + Read-Only Guard

### Overview

Make the app aware of retention state and enforce it. Middleware computes `locals.isReadOnly`; a shared guard rejects writes on all 7 mutating routes; two endpoints create and clear the request row.

### Changes Required:

#### 1. Retention state in middleware

**File**: `src/middleware.ts`

**Intent**: After resolving `context.locals.user`, look up the user's `account_deletion_requests` row and expose retention state to all routes and pages.

**Contract**: When `user` is non-null and `supabase` exists, `select retention_until from account_deletion_requests where user_id = <user.id>` (PK lookup). On a successful read, set `context.locals.isReadOnly = !!row` and `context.locals.retentionUntil = row?.retention_until ?? null`. Default both to `false`/`null` when there is no user. Per the invariant, presence of the row alone sets read-only (do not also require `retention_until > now()`). **Fail-closed on query error:** distinguish a Supabase `error` from a successful empty result — if the lookup returns an `error` (not just zero rows), set `isReadOnly = true` (and leave `retentionUntil = null`) rather than defaulting to writable. A transient DB blip must not hand a pending-deletion user a write window; the cost is that an authenticated user is briefly read-only during a DB outage, which is acceptable.

#### 2. `App.Locals` type extension

**File**: `src/env.d.ts` (the file declaring `namespace App { interface Locals }`)

**Intent**: Add the new locals so TypeScript/ESLint accept them.

**Contract**: Add `isReadOnly: boolean;` and `retentionUntil: string | null;` to `App.Locals`.

#### 3. Shared read-only guard helper

**File**: `src/lib/account-retention.ts` (new)

**Intent**: One place that turns retention state into a 403 response, so every write route enforces it identically.

**Contract**: Export a function taking the API context (or `locals`) and returning a `Response` (403, `{ error: "account_read_only", message: "Your account is pending deletion and is read-only. Cancel the deletion to make changes." }`) when `locals.isReadOnly`, else `null`. Reuses the existing `json(body, status)` response shape.

#### 4. Apply guard to all 7 mutating routes

**Files**: `src/pages/api/cards.ts` (POST), `src/pages/api/cards/[id].ts` (PATCH + DELETE), `src/pages/api/generations.ts` (POST), `src/pages/api/generations/save.ts` (POST), `src/pages/api/generations/discard.ts` (POST), `src/pages/api/reviews.ts` (POST)

**Intent**: Block every write while pending deletion. FR-017: the user "cannot create, edit, delete, generate, or review".

**Contract**: Immediately after the existing `if (!user) return 401` check in each handler, call the guard helper and return its response if non-null. Seven handlers total across 6 files (POST + PATCH + DELETE + POST×4; two handlers in `cards/[id].ts`). No other logic changes.

#### 5. Request-deletion endpoint

**File**: `src/pages/api/account/delete.ts` (new)

**Intent**: Place the account into the 30-day retention state (FR-016).

**Contract**: `POST`. Standard 401/503 guards. **Does not** call the read-only guard (a pending user re-requesting is a no-op). Upsert into `account_deletion_requests` `{ user_id: user.id, requested_at: now(), retention_until: now() + 30 days }` on the user-scoped client (RLS allows own-row insert). On conflict (already pending) keep the existing row — do not reset the window. Returns `{ ok: true, retention_until }` (200/201).

#### 6. Cancel-deletion endpoint

**File**: `src/pages/api/account/cancel.ts` (new)

**Intent**: Cancel a pending deletion and restore read-write (FR-018).

**Contract**: `POST`. Standard 401/503 guards. **Does not** call the read-only guard (cancel must work while read-only). `delete from account_deletion_requests where user_id = <user.id>` (RLS-scoped). Idempotent — deleting zero rows still returns `{ ok: true }` (200). Next request recomputes `isReadOnly = false`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (new locals typed, guard imported where used).
- `npm run build` passes.
- `npx astro sync` regenerates types without error.
- With a request row present, each of the 7 mutating routes returns 403 `account_read_only` (scripted curl/fetch against a dev session); with no row, they behave as before.
- `POST /api/account/delete` creates exactly one row with `retention_until ≈ now()+30d`; a second call does not move `retention_until`.
- `POST /api/account/cancel` removes the row and is idempotent on a second call.

#### Manual Verification:

- After requesting deletion in a real session, attempting a card create/edit/delete, a generation, a save, and a review each fail with the read-only message.
- After cancelling, all of the above succeed again.
- No write route was missed (reviewer cross-checks the 7 files against the guard).

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Frontend — /settings Page, Global Banner, UI Gating

### Overview

Give the flow a surface: a `/settings` page to request deletion, a global banner to surface the pending state + Cancel anywhere, a dashboard link, and write-action gating in the UI.

### Changes Required:

#### 1. Protect the new route

**File**: `src/middleware.ts`

**Intent**: `/settings` is authenticated-only.

**Contract**: Add `"/settings"` to `PROTECTED_ROUTES` (per `lessons.md`: wire every new protected page into middleware).

#### 2. Settings page

**File**: `src/pages/settings.astro` (new)

**Intent**: Host the account-deletion action (FR-016 "from settings").

**Contract**: Protected Astro page using `Layout.astro`. Reads `Astro.locals.isReadOnly` / `retentionUntil`. Renders a "Danger zone" section with a React island for the delete action. When already pending, shows pending state + a Cancel control instead of the delete button.

#### 3. Delete-account React component

**File**: `src/components/settings/DeleteAccountButton.tsx` (new)

**Intent**: Trigger the request with a confirmation, matching codebase patterns.

**Contract**: `destructive` Button variant. On click, `window.confirm("Delete your account? You'll have 30 days to cancel by logging in, after which all your cards are permanently deleted.")`; on confirm, `fetch("/api/account/delete", { method: "POST" })`; on success `window.location.assign("/dashboard")` (lands read-only with banner). Inline `<p>` error on failure, with the `FALLBACK_MESSAGES` lookup pattern from `CreateCardForm.tsx`. Loading/disabled state while in flight.

#### 4. Global retention banner

**Files**: `src/layouts/Layout.astro` and `src/components/RetentionBanner.astro` (new; may absorb/replace the unused `Topbar.astro`)

**Intent**: Show the pending-deletion state + Cancel button on every protected page (chosen: global).

**Contract**: When `Astro.locals.isReadOnly`, render a `warning` banner (reusing `Banner.astro` styling) reading "Your account is scheduled for deletion on `<retention_until date>`. Until then it's read-only." with a Cancel button (React island or inline-script form) that `POST`s `/api/account/cancel` then reloads. Rendered in `Layout.astro` so it appears across dashboard/generate/review/library/settings.

#### 5. Cancel control

**File**: `src/components/settings/CancelDeletionButton.tsx` (new; shared by banner + settings page)

**Intent**: Cancel and restore read-write from anywhere the banner shows.

**Contract**: On click, `fetch("/api/account/cancel", { method: "POST" })`; on success reload the current page (`window.location.reload()`), recomputing `isReadOnly = false`. Inline error handling on failure.

#### 6. Dashboard link to settings

**File**: `src/pages/dashboard.astro`

**Intent**: Make `/settings` discoverable.

**Contract**: Add a "Settings" action link matching the existing gradient-link pattern.

#### 7. Gate write actions in UI when read-only

**Files**: `src/pages/generate.astro`, `src/pages/library.astro`, `src/pages/review.astro` (and/or their child components)

**Intent**: Don't present write affordances that the backend will 403 — avoid dead buttons. FR-017 read-only experience.

**Contract**: When `Astro.locals.isReadOnly`, hide or disable the create/generate/save/review-rating affordances and show a short "read-only while pending deletion" note. Backend guard remains the source of truth; this is UX polish so users aren't surprised.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes.
- `npm run build` passes.
- `/settings` exists and redirects to `/auth/signin` when unauthenticated (middleware protection).

#### Manual Verification:

- Logged-in user opens `/settings`, clicks Delete, confirms `window.confirm`, lands on dashboard read-only with the banner showing the correct deletion date.
- The banner + Cancel button appear on dashboard, generate, review, library, and settings.
- Clicking Cancel (from the banner and from settings) restores read-write; banner disappears; create/generate/review work again.
- While pending, write affordances are hidden/disabled across generate/library/review and the inline read-only note shows.
- No regressions to the existing card/generation/review flows when not pending.

**Implementation Note**: After this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit / Function Tests:

- pg_cron sweep: backdated throwaway `@example.invalid` user is deleted with full cascade; control user untouched; function not executable by `authenticated`.
- Request endpoint: creates one row, idempotent on re-request (window not reset).
- Cancel endpoint: removes the row, idempotent.

### Integration Tests:

- Full lifecycle on a throwaway user: request → all 7 writes 403 → cancel → writes succeed → request again → backdate `retention_until` (service_role) → run sweep → user gone.

### Manual Testing Steps:

1. Sign in; go to `/settings`; request deletion; confirm; verify redirect to dashboard with read-only banner and correct date.
2. Attempt: create card, edit card, delete card, AI generate, save drafts, discard drafts, rate a review — each blocked with the read-only message.
3. Click Cancel on the banner; verify read-write restored everywhere.
4. Re-request; confirm a second request doesn't change `retention_until`.
5. (Service-role) backdate `retention_until` to the past for a throwaway user; run the sweep; confirm hard-delete + cascade; confirm a real account is untouched.

## Performance Considerations

The middleware retention lookup is a single indexed PK (`account_deletion_requests.user_id`) read added to every protected request — negligible. The sweep runs once daily over a tiny table.

## Migration Notes

- One new migration (Phase 1). pg_cron must be enabled on the Supabase project; if the extension isn't available, fall back to a service_role-invoked scheduled call (revisit — not expected for Supabase).
- **Fallback if `postgres` cannot delete `auth.users`** (Phase 1 privilege gate fails): replace the in-DB `DELETE FROM auth.users` with Supabase's supported deletion path — keep the daily pg_cron schedule but have it call an Edge Function via `pg_net` (`net.http_post`), and have the Edge Function delete each expired user with `auth.admin.deleteUser(id)` using the `service_role` key. The expired-user query (`select user_id from account_deletion_requests where retention_until < now()`) and the existing cascade are unchanged; only the delete call moves out of SQL. Tradeoff: reintroduces a `service_role` secret (stored in Edge Function env / Supabase secrets, never in the Worker app), accepted only if the in-DB delete is rejected.
- `wrangler rollback` reverts Worker code only; the migration (function + cron job) is not auto-reverted. Down-path: `cron.unschedule('account-deletion-sweep')` + `drop function public.sweep_expired_account_deletions()`.

## References

- PRD: `context/foundation/prd.md` — FR-016/017/018, §Account lifecycle, §Access Control (retention state).
- Roadmap slice S-05: `context/foundation/roadmap.md:142-158`.
- Existing schema: `supabase/migrations/20260527150510_cards_and_account_deletion.sql:55-80` (`account_deletion_requests`), `:16-28` (`cards`).
- Middleware pattern: `src/middleware.ts:4,18-22`.
- Write-route pattern: `src/pages/api/cards.ts:26-67`.
- UI form/error pattern: `src/components/library/CreateCardForm.tsx`; delete-confirm pattern: `src/components/library/CardRow.tsx:88-106`.
- Route-placement rule: `context/foundation/lessons.md`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scheduled Hard-Delete (pg_cron)

#### Automated

- [ ] 1.1 Migration applies cleanly against remote
- [ ] 1.2 pg_cron job `account-deletion-sweep` is registered
- [ ] 1.3 Backdated-user cascade test passes (user + cards + request row gone; control untouched)
- [ ] 1.4 `npm run lint` and `npm run build` pass

#### Manual

- [ ] 1.5 Sweep function not callable by `authenticated`
- [ ] 1.6 Reviewer confirms cascade emptied `public.cards` for test user; only expired user deleted

### Phase 2: Backend — Request/Cancel Endpoints + Read-Only Guard

#### Automated

- [ ] 2.1 `npm run lint` passes
- [ ] 2.2 `npm run build` passes
- [ ] 2.3 `npx astro sync` regenerates types without error
- [ ] 2.4 All 7 mutating routes return 403 `account_read_only` when pending; behave normally when not
- [ ] 2.5 `POST /api/account/delete` creates one row at ~now+30d; re-request does not move `retention_until`
- [ ] 2.6 `POST /api/account/cancel` removes the row and is idempotent

#### Manual

- [ ] 2.7 In a real session, all write actions fail with the read-only message while pending
- [ ] 2.8 After cancel, all write actions succeed again
- [ ] 2.9 Reviewer cross-checks all 7 write files carry the guard

### Phase 3: Frontend — /settings Page, Global Banner, UI Gating

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run build` passes
- [ ] 3.3 `/settings` redirects to `/auth/signin` when unauthenticated

#### Manual

- [ ] 3.4 Request deletion from `/settings` → redirect to dashboard read-only with correct date banner
- [ ] 3.5 Banner + Cancel appear on dashboard, generate, review, library, settings
- [ ] 3.6 Cancel (from banner and settings) restores read-write; banner clears; writes work
- [ ] 3.7 Write affordances hidden/disabled across generate/library/review while pending
- [ ] 3.8 No regressions to existing flows when not pending
