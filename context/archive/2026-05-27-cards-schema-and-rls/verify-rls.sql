-- ============================================================================
-- F-01 RLS verification — run against the remote DB.
--
-- Test users (DO NOT DELETE from remote auth.users — referenced below):
--   User A: rls-test-a@example.invalid  →  4fb3fd61-82bd-4305-adc5-b7a81f00ab2d
--   User B: rls-test-b@example.invalid  →  368469c6-1245-4e04-bbd3-141130cc9b95
--
-- How to run:
--   Studio (preferred): open SQL editor → role dropdown at the top selects
--     postgres / service_role / authenticated / anon. When `authenticated`
--     is picked, a User UID field appears — paste the UUID from the block
--     header. Run each block separately.
--   psql fallback (if Studio's role dropdown is missing): use the direct
--     connection on port 5432 (NOT the pooler on 6543 — transaction-mode
--     pgbouncer strips SET LOCAL). Wrap each block in a transaction:
--       begin;
--         set local role = 'authenticated';
--         set local request.jwt.claims = '{"sub":"<UUID>","role":"authenticated"}';
--         <block body>;
--       rollback;
--
-- Expected results are documented inline. Every assertion must hold.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOCK 1 — Setup fixtures (role: service_role)
-- Expected: 5 rows inserted into cards, 1 into account_deletion_requests.
-- ----------------------------------------------------------------------------
insert into public.cards (user_id, front, back, status, next_due_at) values
  ('4fb3fd61-82bd-4305-adc5-b7a81f00ab2d', 'A-draft front', 'A-draft back', 'draft', null),
  ('4fb3fd61-82bd-4305-adc5-b7a81f00ab2d', 'A-saved-1 front', 'A-saved-1 back', 'saved', now() - interval '1 day'),
  ('4fb3fd61-82bd-4305-adc5-b7a81f00ab2d', 'A-saved-2 front', 'A-saved-2 back', 'saved', now() - interval '2 days'),
  ('368469c6-1245-4e04-bbd3-141130cc9b95', 'B-draft front', 'B-draft back', 'draft', null),
  ('368469c6-1245-4e04-bbd3-141130cc9b95', 'B-saved front', 'B-saved back', 'saved', now() - interval '1 day');

insert into public.account_deletion_requests (user_id, retention_until) values
  ('368469c6-1245-4e04-bbd3-141130cc9b95', now() + interval '30 days');


-- ----------------------------------------------------------------------------
-- BLOCK 2 — Baseline as user-A (role: authenticated, user UID: 4fb3fd61-…)
-- Expected: 3
-- ----------------------------------------------------------------------------
select count(*) as a_owns_n_cards from public.cards;


-- ----------------------------------------------------------------------------
-- BLOCK 3 — Cross-user SELECT (role: authenticated, user UID: 4fb3fd61-…)
-- Expected: 0  (user-A must not see user-B's rows)
-- ----------------------------------------------------------------------------
select count(*) as a_sees_b_cards from public.cards
where user_id = '368469c6-1245-4e04-bbd3-141130cc9b95';


-- ----------------------------------------------------------------------------
-- BLOCK 4 — Cross-user INSERT (role: authenticated, user UID: 4fb3fd61-…)
-- Expected: ERROR "new row violates row-level security policy for table cards"
-- ----------------------------------------------------------------------------
insert into public.cards (user_id, front, back)
values ('368469c6-1245-4e04-bbd3-141130cc9b95', 'pwned-front', 'pwned-back');


-- ----------------------------------------------------------------------------
-- BLOCK 5 — Cross-user UPDATE (role: authenticated, user UID: 4fb3fd61-…)
-- Expected: 0 rows affected (UPDATE returns silently with no rows)
-- ----------------------------------------------------------------------------
update public.cards set front = 'pwned-update'
where user_id = '368469c6-1245-4e04-bbd3-141130cc9b95';


-- ----------------------------------------------------------------------------
-- BLOCK 6 — Cross-user DELETE (role: authenticated, user UID: 4fb3fd61-…)
-- Expected: 0 rows affected
-- ----------------------------------------------------------------------------
delete from public.cards
where user_id = '368469c6-1245-4e04-bbd3-141130cc9b95';


-- ----------------------------------------------------------------------------
-- BLOCK 7 — Symmetric checks as user-B (role: authenticated, user UID: 368469c6-…)
-- Expected results, in order:
--   7a count = 2          (user-B owns 2 cards)
--   7b count = 0          (user-B cannot see user-A's cards)
--   7c ERROR row-level security violation
--   7d 0 rows affected
--   7e 0 rows affected
-- ----------------------------------------------------------------------------
-- 7a
select count(*) as b_owns_n_cards from public.cards;

-- 7b
select count(*) as b_sees_a_cards from public.cards
where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d';

-- 7c
insert into public.cards (user_id, front, back)
values ('4fb3fd61-82bd-4305-adc5-b7a81f00ab2d', 'pwned-by-b', 'pwned-by-b');

-- 7d
update public.cards set front = 'pwned-update-by-b'
where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d';

-- 7e
delete from public.cards
where user_id = '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d';


-- ----------------------------------------------------------------------------
-- BLOCK 8 — account_deletion_requests cross-user (role: authenticated, user UID: 4fb3fd61-…)
-- Expected: 0  (user-B has a deletion-request row; user-A must not see it)
-- ----------------------------------------------------------------------------
select count(*) as a_sees_deletion_requests from public.account_deletion_requests;


-- ----------------------------------------------------------------------------
-- BLOCK 9 — Anonymous baseline (role: anon)
-- Expected: 0  (anonymous cannot read any cards)
-- ----------------------------------------------------------------------------
select count(*) as anon_sees_cards from public.cards;


-- ----------------------------------------------------------------------------
-- BLOCK 10 — Cleanup (role: service_role)
-- Expected: all fixtures deleted; subsequent count = 0.
-- ----------------------------------------------------------------------------
delete from public.cards
where user_id in (
  '4fb3fd61-82bd-4305-adc5-b7a81f00ab2d',
  '368469c6-1245-4e04-bbd3-141130cc9b95'
);

delete from public.account_deletion_requests
where user_id = '368469c6-1245-4e04-bbd3-141130cc9b95';

-- Confirmation:
select count(*) as residue_cards from public.cards;
-- Expected: 0
