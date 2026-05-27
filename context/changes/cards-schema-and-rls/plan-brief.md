# F-01: Cards Schema + RLS + Account Soft-Delete — Plan Brief

> Full plan: `context/changes/cards-schema-and-rls/plan.md`

## What & Why

Build the data foundation every other roadmap slice depends on: a `cards` table (with `status` separating AI drafts from saved library), an `account_deletion_requests` table for S-05's later retention flow, and Row-Level Security policies that enforce cross-user isolation at the database. PRD §Guardrails names cross-user data leakage ship-blocking even if everything else works — sequencing this first means every later slice inherits the isolation guarantee without re-proving it.

## Starting Point

Auth is fully live (signup, signin, signout, email confirmation; production at `https://10x-cards.rafsaw.workers.dev`) and the Supabase server client at `src/lib/supabase.ts:5` reads the user's JWT from cookies, so RLS will evaluate `auth.uid()` correctly out of the box. There is no DB schema yet — no `supabase/migrations/`, no `supabase/schemas/`, no `cards` table; this slice creates the migration workflow itself. No local Supabase stack runs; everything in this slice targets the remote project directly.

## Desired End State

`cards` and `account_deletion_requests` exist in the remote Supabase project, with RLS enabled and four policies per table (`SELECT`/`INSERT`/`UPDATE`/`DELETE`, all keyed on `(select auth.uid()) = user_id`). A documented SQL verification script run via remote Studio proves a user cannot read, insert, update, or delete another user's rows. S-01 can immediately INSERT draft rows; S-02 can flip `status` from `draft` to `saved`; S-04 has the scheduling columns it'll need; S-05 has the table its eventual cron will read.

## Key Decisions Made

| Decision                                | Choice                                                                                          | Why (1 sentence)                                                                                       | Source |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
| Scheduling field scope                  | Minimal + bookkeeping: `next_due_at`, `interval_days`, `repetition_count`, `last_reviewed_at`   | Any "simple SR model" S-04's research picks (Leitner, fixed multipliers, simple Anki-like) fits without another migration | Plan   |
| `status` representation                 | TEXT + CHECK constraint (`status in ('draft','saved')`)                                          | Trivially evolvable; matches default Supabase patterns; no friction adding values later                | Plan   |
| Account soft-delete model               | Dedicated `account_deletion_requests` table (not a `profiles` flag)                              | Zero footprint until S-05 uses it; doesn't pre-commit to a profile shape we don't need yet              | Plan   |
| Migration workflow                      | Hand-written SQL files in `supabase/migrations/`                                                 | Smallest moving parts, every SQL change reviewable in PR diff, matches default Supabase doc flow       | Plan   |
| RLS verification approach               | Manual SQL checks via remote Studio, committed as `verify-rls.sql`                               | No new tooling, replayable before any future schema change, fits "no test runner yet" project state    | Plan   |
| Deploy scope                            | Remote-only — push directly to production, verify against the live DB (no local stack)            | Developer doesn't run local Supabase; remote is the only DB; safety net is forward-only `CREATE TABLE` | Plan   |
| `cards.user_id` FK behavior on `auth.users` delete | `ON DELETE CASCADE`                                                                          | Roadmap S-05 explicitly wants cascade hard-delete; one transaction, no app cleanup code                 | Plan   |

## Scope

**In scope:**
- New migration file under `supabase/migrations/` creating `cards` + `account_deletion_requests`.
- RLS enable + four policies per table (`SELECT`/`INSERT`/`UPDATE`/`DELETE`).
- One composite index on `cards (user_id, status)` (the partial index for S-04's due-card lookup is deferred to S-04 itself).
- `updated_at` trigger on `cards`.
- Two dedicated test users created in remote Authentication for RLS verification.
- One-shot SQL verification script in the change folder, runnable in remote Studio.
- Push migration directly to remote via `supabase db push`.

**Out of scope:**
- Any local Supabase stack work — no `supabase start`, no `supabase db reset`, no `supabase/seed.sql`.
- Any application code touching the new tables (S-01 onward owns that).
- Generated TypeScript types from Supabase (deferred to S-01).
- Cron / scheduled hard-delete logic (that's S-05).
- pgTAP, Vitest, or any new test framework.
- A `profiles` table or other user-metadata surface.
- Edits to `src/lib/supabase.ts`, middleware, or auth endpoints — they already work.

## Architecture / Approach

One SQL migration → `supabase db push` to remote → two test users created in remote Authentication → `verify-rls.sql` run in remote Studio with role/UID impersonation. Two phases map to those two steps, each with its own go/no-go gate. RLS lives in the database (not in app code) so every later slice inherits isolation without re-implementing it; the cross-user verification only happens once here.

```
[migration.sql] -> supabase db push -> create test users -> verify-rls.sql -> done
        Phase 1          Phase 1            Phase 2             Phase 2
```

## Phases at a Glance

| Phase                                   | What it delivers                                                                                          | Key risk                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Schema migration + remote push       | One SQL file creating both tables, indexes, RLS, and four policies per table, applied to production       | Forgetting `WITH CHECK` on INSERT/UPDATE policies → user can claim others' `user_id`; no local dry-run to catch it |
| 2. Manual RLS verification (on remote)  | Two test users + `verify-rls.sql` proving isolation against the live DB                                   | A policy that looks right but silently allows the wrong action — the exact bug PRD calls ship-blocking            |

**Prerequisites:**
- Supabase CLI authenticated (`supabase login`) and project linked (`supabase link --project-ref <ref>`).
- Access to the remote Supabase Studio with permission to create users and run SQL.

**Estimated effort:** ~1 evening session across the two phases (migration + push ~30 min, verification ~30 min).

## Open Risks & Assumptions

- **Assumption:** `service_role` JWTs never reach a user-input code path. They bypass RLS entirely, which is by design but would silently break isolation if leaked into an unsanitised endpoint. Worth a CLAUDE.md note when S-01 lands.
- **Risk:** No local dry-run means a policy bug surfaces only after the migration hits production. Mitigation: the migration is forward-only `CREATE TABLE` (nothing to clobber), and Phase 2's verification runs immediately after the push to catch any RLS misconfiguration before the slice is declared done.
- **Risk:** The two test users live in production `auth.users` indefinitely. Acceptable while the project is dogfood; flag them in `verify-rls.sql` as "DO NOT DELETE" and revisit when a separate test environment is introduced.
- **Open Roadmap Question #3** (S-02 atomicity choice) is not blocked by F-01: the schema supports both DB-transaction and idempotency-key approaches without changes.

## Success Criteria (Summary)

- Remote: `supabase db push` applies the migration; remote Studio shows both tables with RLS enabled and four policies each; the production dashboard still loads after the push.
- Verification: every block of `verify-rls.sql` produces its documented expected result when run against the live remote DB with role/UID impersonation — cross-user reads return 0, cross-user writes are rejected, anonymous SELECT returns 0.
- S-01 can be picked up next with no further schema work — the foundation is done.
