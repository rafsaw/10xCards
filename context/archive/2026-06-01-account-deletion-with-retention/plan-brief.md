# Account Deletion with 30-Day Retention — Plan Brief

> Full plan: `context/changes/account-deletion-with-retention/plan.md`

## What & Why

Give users a self-service exit (FR-016): request account deletion, get a 30-day read-only grace window to reconsider (FR-017), and cancel anytime by acting while logged in (FR-018). The retention window exists to make an irreversible action recoverable — a regretted click costs nothing for 30 days.

## Starting Point

F-01 already built the data layer: a `public.account_deletion_requests` table (`user_id` PK → `auth.users` ON DELETE CASCADE, `requested_at`, `retention_until`) with RLS, and `cards.user_id` cascading from `auth.users`. So hard-delete is just deleting the `auth.users` row. What's missing is everything above the schema: the scheduled deleter, the read-only enforcement, and the UI. There is no `/settings` page yet; seven mutating API routes guard only on auth.

## Desired End State

A user opens `/settings`, requests deletion, and stays logged in but read-only with a global banner showing the deletion date and a Cancel button. Cancel restores read-write instantly. Left alone, a daily Supabase pg_cron sweep hard-deletes the account (cards cascade) the day after the 30-day mark. No write path succeeds while pending.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Hard-delete mechanism | Supabase pg_cron + `SECURITY DEFINER` function, daily | Fewest moving parts; no service_role secret in the app; deletion is inherently a DB/admin op | Plan |
| Read-only enforcement | Middleware computes `locals.isReadOnly` + shared guard on all 7 write routes | Single source of truth, one place to audit coverage, mirrors existing `locals.user` pattern | Plan |
| Deletion action location | Dedicated `/settings` page (wired into `PROTECTED_ROUTES`) | Matches FR-016 "from settings"; keeps the destructive action off the dashboard hub | Plan + lessons.md |
| Cancellation | Explicit "Cancel" button on a global banner (authenticated) | Reconciles FR-017 (log in → read-only) with FR-018 (re-login proves ownership); deliberate, not accidental | Plan + Roadmap |
| Confirmation UX | `window.confirm()` | Matches the existing card-delete pattern; no new modal system | Plan |
| Post-request session | Stay logged in, read-only | User immediately sees read-only state + one-click recovery | Plan |
| Grace-gap behavior | Row exists = pending & cancellable (even past `retention_until`) | Simple invariant; a late sweep can't trap a cancelling user; deletion is real only when the row is gone | Plan |
| Banner scope | Global on all protected pages | Cancel affordance reachable wherever the user lands | Plan |
| Sweep validation | Backdated throwaway `@example.invalid` user | Exercises the real cascade end-to-end without waiting 30 days | Plan |

## Scope

**In scope:** pg_cron sweep function + daily schedule; middleware retention state; read-only guard across all 7 write routes; request + cancel endpoints; `/settings` page; global retention banner with Cancel; dashboard link; UI write-action gating.

**Out of scope:** data export before deletion; pre-delete email notice; magic-link cancellation; new modal/toast system; CSRF hardening; RLS rewrites; a `profiles` table.

## Architecture / Approach

Three layers over F-01's existing table. **DB:** a `SECURITY DEFINER` function deletes expired `auth.users` rows (cascade removes cards + request row); pg_cron runs it daily. **Middleware:** one indexed PK lookup sets `locals.isReadOnly` / `locals.retentionUntil`; a shared helper turns that into a 403 at the top of each mutating handler. **UI:** `/settings` requests deletion; a global banner (via `Layout.astro` + `Banner.astro`) surfaces the pending state and Cancel everywhere. Invariant threaded throughout: *request row exists ⇔ pending & cancellable*.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. pg_cron sweep | Daily hard-delete function + schedule, proven via backdated user | Irreversible deletion — wrong predicate deletes live accounts or never deletes |
| 2. Backend guard + endpoints | `isReadOnly` flag, 403 guard on 7 routes, request/cancel endpoints | A missed write route silently leaks write access |
| 3. Frontend | `/settings`, global banner + Cancel, dashboard link, UI gating | Banner/cancel must be reachable and reliably restore read-write |

**Prerequisites:** F-01 schema (done); pg_cron available on the Supabase project; service_role for test-user fixtures; remote-only Supabase.
**Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- pg_cron is enabled/available on the Supabase plan; if not, fall back to a service_role-invoked scheduled call.
- Direct `DELETE FROM auth.users` cascades cleanly through both `public` and `auth` child tables — verified in the Phase 1 test, not assumed.
- The read-only guard must be applied to **every** one of the 7 write routes; coverage is reviewed explicitly.
- Migration (function + cron job) is not reverted by `wrangler rollback`; a manual down-path is documented.

## Success Criteria (Summary)

- A user can request deletion, see a read-only account with a dated Cancel banner, and cancel to fully restore access.
- No write (card CRUD, AI generation, save/discard, review rating) succeeds while pending.
- An expired account and all its cards are hard-deleted by the daily sweep, with no collateral deletion.
