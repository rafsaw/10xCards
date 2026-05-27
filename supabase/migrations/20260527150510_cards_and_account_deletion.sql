-- F-01: cards + account_deletion_requests with RLS.
-- See context/changes/cards-schema-and-rls/plan.md for the full contract.

-- ---------- public.set_updated_at() ----------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- public.cards ----------
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

create index cards_user_id_status_idx on public.cards (user_id, status);

create trigger cards_set_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

alter table public.cards enable row level security;

create policy cards_select_own on public.cards
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy cards_insert_own on public.cards
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy cards_update_own on public.cards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy cards_delete_own on public.cards
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------- public.account_deletion_requests ----------
create table public.account_deletion_requests (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  requested_at     timestamptz not null default now(),
  retention_until  timestamptz not null
);

alter table public.account_deletion_requests enable row level security;

create policy account_deletion_requests_select_own on public.account_deletion_requests
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy account_deletion_requests_insert_own on public.account_deletion_requests
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy account_deletion_requests_update_own on public.account_deletion_requests
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy account_deletion_requests_delete_own on public.account_deletion_requests
  for delete to authenticated
  using ((select auth.uid()) = user_id);
