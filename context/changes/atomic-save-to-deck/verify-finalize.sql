-- ============================================================================
-- S-02 finalize_drafts verification — run against the remote DB.
--
-- Proves the atomic finalize is (a) correct on the happy path, (b) confined by
-- RLS to the caller's rows, and (c) idempotent under re-submission. Mirrors
-- F-01's verify-rls.sql impersonation pattern.
--
-- Test users (reused from F-01 — DO NOT DELETE from remote auth.users):
--   User A: rls-test-a@example.invalid  ->  4fb3fd61-82bd-4305-adc5-b7a81f00ab2d
--   User B: rls-test-b@example.invalid  ->  368469c6-1245-4e04-bbd3-141130cc9b95
--
-- How to run:
--   Studio (preferred): open SQL editor -> role dropdown at the top selects
--     postgres / service_role / authenticated / anon. When `authenticated`
--     is picked, a User UID field appears -- paste the UUID named in the block
--     header. Run each block separately.
--   psql fallback (if Studio's role dropdown is missing): use the direct
--     connection on port 5432 (NOT the pooler on 6543 -- transaction-mode
--     pgbouncer strips SET LOCAL). Wrap each block in a transaction:
--       begin;
--         set local role = 'authenticated';
--         set local request.jwt.claims = '{"sub":"PASTE-UUID-HERE","role":"authenticated"}';
--         (the block body);
--       rollback;   -- (use commit only where the block must persist state)
--
-- IMPORTANT: blocks 2-4 read the draft ids inserted by block 1 by their stable
-- (user_id, front) pair, so you do not have to copy ids by hand between blocks.
-- Run the blocks in order; each documents its expected result inline.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOCK 1 -- Setup fixtures (role: service_role)
-- Inserts 3 drafts for user-A and 2 drafts for user-B.
-- Expected: 5 rows inserted.
-- ----------------------------------------------------------------------------
insert into public.cards (user_id, front, back, status, next_due_at) values
  ('4fb3fd61-82bd-4305-adc5-b7a81f00ab2d', 'S02-A-draft1 front', 'S02-A-draft1 back', 'draft', null),
  ('4fb3fd61-82bd-4305-adc5-b7a81f00ab2d', 'S02-A-draft2 front', 'S02-A-draft2 back', 'draft', null),
  ('4fb3fd61-82bd-4305-adc5-b7a81f00ab2d', 'S02-A-draft3 front', 'S02-A-draft3 back', 'draft', null),
  ('368469c6-1245-4e04-bbd3-141130cc9b95', 'S02-B-draft1 front', 'S02-B-draft1 back', 'draft', null),
  ('368469c6-1245-4e04-bbd3-141130cc9b95', 'S02-B-draft2 front', 'S02-B-draft2 back', 'draft', null);


-- ----------------------------------------------------------------------------
-- BLOCK 2 -- Happy path as user-A (role: authenticated, user UID: 4fb3fd61-...)
-- Accept A-draft1, reject A-draft2; A-draft3 is left untouched.
-- Expected: saved_count = 1, discarded_count = 1.
-- ----------------------------------------------------------------------------
select * from public.finalize_drafts(
  array[(select id from public.cards
           where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d'
             and front = 'S02-A-draft1 front')]::uuid[],
  array[(select id from public.cards
           where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d'
             and front = 'S02-A-draft2 front')]::uuid[]
);

-- Post-state assertions (still as user-A). Expected: one row each.
--   A-draft1: status='saved', next_due_at NOT NULL  -> promoted + scheduled
select status, (next_due_at is not null) as has_due
from public.cards
where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d' and front = 'S02-A-draft1 front';
-- Expected: status = 'saved', has_due = true

--   A-draft2: gone  -> Expected: 0 rows
select count(*) as a_draft2_remaining
from public.cards
where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d' and front = 'S02-A-draft2 front';
-- Expected: 0

--   A-draft3: still a draft  -> Expected: status = 'draft'
select status
from public.cards
where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d' and front = 'S02-A-draft3 front';
-- Expected: 'draft'


-- ----------------------------------------------------------------------------
-- BLOCK 3 -- RLS confinement as user-A (role: authenticated, user UID: 4fb3fd61-...)
-- User-A tries to finalize user-B's drafts. The invoker-rights RLS predicate
-- filters B's rows out, so the UPDATE/DELETE touch nothing.
-- Expected: saved_count = 0, discarded_count = 0.
-- ----------------------------------------------------------------------------
select * from public.finalize_drafts(
  array[(select id from public.cards
           where user_id = '368469c6-1245-4e04-bbd3-141130cc9b95'
             and front = 'S02-B-draft1 front')]::uuid[],
  array[(select id from public.cards
           where user_id = '368469c6-1245-4e04-bbd3-141130cc9b95'
             and front = 'S02-B-draft2 front')]::uuid[]
);

-- Assert B's drafts are untouched. Run this block as service_role (user-A
-- cannot see B's rows under RLS). Expected: 2 rows, both status='draft'.
-- (role: service_role)
select front, status
from public.cards
where user_id = '368469c6-1245-4e04-bbd3-141130cc9b95'
  and front in ('S02-B-draft1 front', 'S02-B-draft2 front')
order by front;
-- Expected: both rows status = 'draft'


-- ----------------------------------------------------------------------------
-- BLOCK 4 -- Idempotency as user-A (role: authenticated, user UID: 4fb3fd61-...)
-- Re-run block 2's exact call. A-draft1 is already 'saved' (status='draft'
-- guard excludes it) and A-draft2 is already deleted (matches nothing).
-- Expected: saved_count = 0, discarded_count = 0.
-- NOTE: A-draft2's id no longer exists, so the reject array resolves to an
-- empty array here (the subquery returns no row); that is fine -- the point is
-- the call is a harmless no-op on re-submission.
-- ----------------------------------------------------------------------------
select * from public.finalize_drafts(
  array[(select id from public.cards
           where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d'
             and front = 'S02-A-draft1 front')]::uuid[],
  coalesce(
    array[(select id from public.cards
             where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d'
               and front = 'S02-A-draft2 front')]::uuid[],
    array[]::uuid[]
  )
);
-- Expected: saved_count = 0, discarded_count = 0


-- ----------------------------------------------------------------------------
-- BLOCK 5 -- Cleanup (role: service_role)
-- Delete only this script's fixtures for the two test users; leave the auth
-- users in place. Fixture-scoped -- never a global table wipe.
-- ----------------------------------------------------------------------------
delete from public.cards
where user_id in (
    '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d',
    '368469c6-1245-4e04-bbd3-141130cc9b95'
  )
  and front in (
    'S02-A-draft1 front', 'S02-A-draft2 front', 'S02-A-draft3 front',
    'S02-B-draft1 front', 'S02-B-draft2 front'
  );

-- Confirmation: no fixture residue for the two test users.
select count(*) as fixture_residue
from public.cards
where user_id in (
    '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d',
    '368469c6-1245-4e04-bbd3-141130cc9b95'
  )
  and front in (
    'S02-A-draft1 front', 'S02-A-draft2 front', 'S02-A-draft3 front',
    'S02-B-draft1 front', 'S02-B-draft2 front'
  );
-- Expected: 0
