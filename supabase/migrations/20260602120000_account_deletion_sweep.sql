-- Account deletion with 30-day retention (FR-017): daily hard-delete sweep.
-- Deletes auth.users whose retention window has elapsed; the existing
-- on-delete-cascade chain (public.cards, public.account_deletion_requests, and
-- the auth schema's own child tables) removes everything else in one transaction.
-- See context/changes/account-deletion-with-retention/plan.md (Phase 1).

-- ---------- pg_cron ----------
-- Supabase installs pg_cron objects into the `cron` schema. Idempotent if already enabled.
create extension if not exists pg_cron;

-- ---------- public.sweep_expired_account_deletions() ----------
-- SECURITY DEFINER so it runs with the owner's (postgres) rights and can reach
-- auth.users, which `authenticated`/the user-scoped client cannot touch.
-- search_path pinned to '' (empty) to defeat search-path hijacking — every object
-- is therefore schema-qualified. Returns the number of users deleted.
create or replace function public.sweep_expired_account_deletions()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from auth.users
    where id in (
      select user_id
      from public.account_deletion_requests
      where retention_until < now()
    )
    returning id
  )
  select count(*)::integer from deleted;
$$;

-- Only cron / service_role (and the owner) may run the sweep. CREATE grants EXECUTE
-- to PUBLIC by default — revoke it so no app-facing role can trigger a mass delete.
revoke execute on function public.sweep_expired_account_deletions() from public;
revoke execute on function public.sweep_expired_account_deletions() from anon;
revoke execute on function public.sweep_expired_account_deletions() from authenticated;

-- The daily cron job runs as the function owner (postgres), so it needs no grant.
-- Re-grant execute to service_role only: revoking from PUBLIC above also stripped
-- service_role (it is not a superuser and held execute only via the PUBLIC grant).
-- service_role is a server-only admin key that can already delete any user via the
-- Admin API, so this is no privilege escalation — it just restores the plan's
-- "cron/service_role may call it" contract and enables admin/maintenance runs.
grant execute on function public.sweep_expired_account_deletions() to service_role;

-- ---------- daily schedule ----------
-- Runs at 03:00 UTC every day. The <=24h lag is harmless: a request row existing
-- means pending & cancellable, so a user can still cancel right up until the sweep runs.
select cron.schedule(
  'account-deletion-sweep',
  '0 3 * * *',
  $$ select public.sweep_expired_account_deletions(); $$
);
