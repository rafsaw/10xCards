# F-01: Cards Schema + RLS + Account Soft-Delete — Implementation Plan

## Overview

Deliver the data foundation every subsequent slice depends on: a `cards` table with `status` (draft / saved), front/back text, and minimal SR bookkeeping fields; an `account_deletion_requests` table that S-05 will use; and Row-Level Security policies that make cross-user data access fail at the database, not the application. **Remote-only workflow** — no local Supabase stack. Author the migration, push it to the production Supabase project, then verify isolation by hand against the live remote DB using two dedicated test users.

## Current State Analysis

- **Auth is live in production** (`https://10x-cards.rafsaw.workers.dev`). `src/lib/supabase.ts:5` creates a server-side `@supabase/ssr` client per request; the middleware at `src/middleware.ts:10–16` populates `context.locals.user` from the cookie session. RLS policies that key on `auth.uid()` will read the correct user from these requests with no app-side changes.
- **No DB schema exists yet.** `supabase/migrations/` and `supabase/schemas/` directories don't exist. `supabase/config.toml:53–55` has `[db.migrations] enabled = true` and `schema_paths = []`, so the imperative-migration workflow is ready out of the box. `supabase` CLI is in devDependencies (`package.json:53`).
- **Remote Supabase project is provisioned** — env vars `SUPABASE_URL` and `SUPABASE_KEY` are wired through `astro:env/server` (`src/env.d.ts:1–5`, `src/lib/supabase.ts:3`). Production already uses them for auth.
- **No local Supabase stack.** Developer doesn't run `supabase start`; there is no local Postgres, no Studio at `127.0.0.1:54323`. All verification happens against the remote DB via the hosted Studio's SQL editor.
- **No test runner exists** (per `AGENTS.md` Testing Guidelines). RLS isolation will be verified by hand-run SQL against the remote DB, with the exact commands captured in this plan so the same verification can be replayed before any future schema change.
- **No `lessons.md`, no `contract-surfaces.md`** — nothing to honor as prior rules.

## Desired End State

After this change lands:

- `cards` and `account_deletion_requests` exist in the `public` schema of the remote Supabase project.
- Every read and write path against these tables is gated by RLS policies keyed on `(select auth.uid()) = user_id`. Direct queries with a wrong user's JWT return zero rows on SELECT and fail on INSERT/UPDATE/DELETE. Verified manually against the remote DB using two dedicated test users.
- `cards.user_id` cascades on `auth.users` delete, so the eventual S-05 cron can hard-delete an `auth.users` row and have all cards disappear in the same transaction.
- The migration file (`supabase/migrations/<ts>_cards_and_account_deletion.sql`) is committed and replayable: the next developer running `supabase db push` against a fresh project gets the same schema deterministically.
- S-01 can immediately INSERT draft rows; S-02 can transition `status` from `draft` to `saved` (or DELETE); S-03 can INSERT directly with `status='saved'`; S-04 reads/updates scheduling columns; S-05 only needs to write the deletion-requests row + add app-level retention logic.

### Key Discoveries

- Auth flow already uses `@supabase/ssr` (`src/lib/supabase.ts:9`), so RLS will see `auth.uid()` correctly without code changes in this slice.
- `db.migrations.enabled = true` (`supabase/config.toml:53–55`) means `supabase db push` works against the linked remote project — no config edit needed.
- Supabase Studio (hosted, at the remote project URL) lets you create users through Authentication → Users → Add user, which is the cleanest way to spin up the two test accounts needed for RLS verification without writing raw INSERTs into `auth.users`.

## What We're NOT Doing

- No `profiles` table — soft-delete state lives in its own dedicated table per the decision; we are not pre-committing to a generic user-profile shape.
- No application code touching the new tables. S-01 onward writes the read/write surface; F-01 stops at schema + policies + verification.
- No Supabase generated TypeScript types in this slice. They'll be generated when S-01 starts (`supabase gen types`), once we know which tables the app actually touches.
- No local Supabase stack work (`supabase start`, `supabase db reset`, `supabase/seed.sql`) — explicitly excluded; everything happens against the remote project.
- No pgTAP or other DB test framework — manual SQL checks via the remote Studio editor instead.
- No cron / scheduled hard-delete logic — that's S-05's territory. F-01 only provides the table the cron will read.
- No edits to `src/lib/supabase.ts`, the middleware, or any auth endpoint. They already do the right thing.
- No Cloudflare / `wrangler` changes — no new secret, no new binding. `SUPABASE_URL` / `SUPABASE_KEY` already cover everything F-01 needs.

## Implementation Approach

One SQL migration file authored by hand under `supabase/migrations/`, pushed straight to the linked remote Supabase project via `supabase db push`, then verified by hand-run SQL in the remote Studio's editor using two dedicated test users created through Studio's Authentication panel. Two phases map to those two steps so each gate (schema applied → isolation verified) is a separate stop with its own automated + manual success criteria.

## Critical Implementation Details

- **Migration filename timestamp must follow Supabase's `YYYYMMDDHHMMSS_<name>.sql` convention.** The CLI orders migrations by filename; an out-of-format name will be silently skipped on `db push`. Use `Get-Date -Format "yyyyMMddHHmmss"` (PowerShell) for the prefix.
- **RLS policies must be created with `WITH CHECK` clauses on INSERT and UPDATE**, not just `USING`. `USING` controls visibility (SELECT/DELETE); `WITH CHECK` controls what a row is allowed to look like after the write. Forgetting `WITH CHECK` on INSERT lets a user insert a row claiming someone else's `user_id`. This is the exact failure mode PRD §Guardrails calls ship-blocking.
- **`auth.uid()` returns NULL for unauthenticated requests.** The policies as written (`(select auth.uid()) = user_id`) correctly reject anonymous reads (NULL = anything is false), but `service_role` JWTs bypass RLS entirely — keep the service-role key out of any code path that handles user input.
- **`ON DELETE CASCADE` from `cards.user_id` to `auth.users.id`** is what makes S-05's eventual hard-delete trivial; the cron only needs to delete the `auth.users` row and Postgres takes care of the cards in the same transaction.

## Phase 1: Schema migration + remote push

### Overview

Author the single migration that creates both tables, indexes, RLS-enable statements, and all policies. Link the CLI to the remote project (one-time, if not already linked), then push the migration to remote. Confirm via Studio that the schema and policies landed.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/<YYYYMMDDHHMMSS>_cards_and_account_deletion.sql`

**Intent**: Create the two foundation tables with their RLS posture set correctly from the very first statement. No follow-up "and then enable RLS" migration — it's all in one file so a future reader sees the full security model in one place.

**Contract**:
- Table `public.cards`:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `front text not null check (length(front) > 0)`
  - `back text not null check (length(back) > 0)`
  - `status text not null default 'draft' check (status in ('draft','saved'))`
  - `next_due_at timestamptz` (nullable; drafts have no schedule)
  - `interval_days integer not null default 0`
  - `repetition_count integer not null default 0`
  - `last_reviewed_at timestamptz`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Index `cards_user_id_status_idx` on `(user_id, status)` — supports both "list this user's drafts" (S-01/S-02) and "list this user's saved library" (S-03/S-04). This is the only index F-01 ships; the partial index for S-04's due-card lookup is deferred to S-04 itself (add then via `CREATE INDEX CONCURRENTLY`).
- Function `public.set_updated_at()`: `returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;`
- Trigger `cards_set_updated_at before update on public.cards for each row execute function public.set_updated_at();`
- Table `public.account_deletion_requests`:
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `requested_at timestamptz not null default now()`
  - `retention_until timestamptz not null` (caller computes `now() + interval '30 days'`)
- `alter table public.cards enable row level security;`
- `alter table public.account_deletion_requests enable row level security;`
- Four policies on `cards`, each one role-scoped to `authenticated`:
  - `cards_select_own`: `for select using ((select auth.uid()) = user_id)`
  - `cards_insert_own`: `for insert with check ((select auth.uid()) = user_id)`
  - `cards_update_own`: `for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)`
  - `cards_delete_own`: `for delete using ((select auth.uid()) = user_id)`
- Same four policies on `account_deletion_requests` (same shape, same `(select auth.uid()) = user_id` predicate).

#### 2. Link to remote project (one-time, if not already linked)

**File**: `.supabase/` (CLI-managed, gitignored)

**Intent**: Establish the local-to-remote link so `supabase db push` knows where to apply. Idempotent — skip if `supabase projects list` already shows the project as linked, or if `.supabase/` already exists in the working tree.

**Contract**: `supabase login` (if not yet authenticated), then `supabase link --project-ref <ref>` where `<ref>` is the project reference from the remote Supabase dashboard URL. The CLI stores the link locally and does not commit anything.

#### 3. Push migration to remote

**Intent**: Apply the migration to the production DB. The CLI compares the local `supabase/migrations/` directory against the remote `supabase_migrations.schema_migrations` table and applies anything new.

**Contract**: `supabase db push` from the project root, against the linked remote. The CLI lists the pending migration filename and prompts for confirmation before applying.

### Success Criteria:

#### Automated Verification:

- `supabase db push` returns exit 0 and prints the applied migration filename.
- `supabase migration list --linked` shows the migration as applied on remote.
- `npm run lint` and `npm run build` still pass (no incidental code edits broke either).

#### Manual Verification:

- Open the remote project's Supabase Studio → Table Editor — both tables visible, columns match the contract above, RLS shown as enabled, all four policies per table present.
- `cards.user_id` foreign-key inspector shows `ON DELETE CASCADE`.
- The deployed app at `https://10x-cards.rafsaw.workers.dev` still loads, signin works, `/dashboard` loads for an authenticated user (smoke check that the migration didn't break anything live).

**Implementation Note**: After Phase 1's verification passes, pause for manual confirmation that the schema in Studio matches the contract before proceeding to Phase 2.

---

## Phase 2: Manual RLS verification (on remote)

### Overview

Prove isolation by hand against the remote DB: create two dedicated test users via Studio's Authentication panel, insert a small fixture of cards for each as the `service_role` (which bypasses RLS — the only safe place to seed cross-user fixtures), then run a documented set of impersonation queries via Studio's SQL editor user-impersonation feature and assert that user A cannot SELECT, UPDATE, INSERT, or DELETE user B's rows. Capture the exact SQL in the change folder so future migrations to these tables can replay the same checks.

### Precondition: confirm impersonation surface

Before authoring `verify-rls.sql`, open the remote Studio's SQL editor and confirm the role/user selector is present at the top of the editor pane (role dropdown with `postgres` / `service_role` / `authenticated` / `anon`, and when `authenticated` is picked, a UID field appears). If it is, proceed with the Studio-based path described below.

**If the selector is missing or behaves differently**, fall back to direct psql against the remote DB: grab the connection string from Project Settings → Database → Connection string, **use the direct connection on port 5432, NOT the pooler on 6543** — Supabase's pooler runs pgbouncer in transaction mode, which strips `SET LOCAL` and breaks the impersonation pattern. The verify-rls.sql script format stays identical; just wrap each block with `SET LOCAL role = 'authenticated'; SET LOCAL request.jwt.claims = '{"sub":"<UUID>","role":"authenticated"}';` (in psql, prefix each block with `BEGIN; ... ; ROLLBACK;` so `SET LOCAL` actually scopes to the block).

### Changes Required:

#### 1. Two test users in remote auth

**Where**: Remote Supabase Studio → Authentication → Users → "Add user" (twice).

**Intent**: Get two real authenticated identities the verification queries can impersonate. Studio's "Add user" creates a proper `auth.users` row with the right hashed password, `aud='authenticated'`, and email confirmation marked complete (since `enable_confirmations = false` in `supabase/config.toml:209`, but remote may differ — use the "Auto Confirm User" toggle in the Add-user form to be safe).

**Contract**:
- User A: email `rls-test-a@example.invalid`. Password is irrelevant for SQL impersonation — let Studio auto-generate any random value and discard it; the password is never used by `verify-rls.sql` or by any other artifact this slice produces.
- User B: email `rls-test-b@example.invalid`. Same — discard the password.
- Record both users' UUIDs only (visible in the Users list after creation) — they go at the top of `verify-rls.sql` as `\set` variables so the script is self-documenting and re-runnable. Do NOT put passwords in the SQL file or any commit.

These accounts live in production-`auth.users`. They're cheap to leave around but should be flagged in the verification SQL header as "DO NOT DELETE — referenced by verify-rls.sql"; the change folder's `verify-rls.sql` is the only thing that depends on them. They can be removed once the project graduates past dogfood and a proper test environment exists.

#### 2. Verification SQL script

**File**: `context/changes/cards-schema-and-rls/verify-rls.sql`

**Intent**: A self-contained, copy-pasteable SQL script that runs the full isolation matrix against the remote DB. Lives in the change folder (not `supabase/`) because it's a one-time-per-change verification artifact, not part of the migration history. Future similar slices can copy this file as a template.

**Contract**: A header comment block records the two test-user UUIDs (replace placeholders before running). Body in sequenced blocks, each preceded by a SQL comment describing what's being tested. The script uses Supabase Studio's user-impersonation feature: in the SQL editor, the "Role" dropdown at the top of the editor lets you switch between `postgres` (full), `service_role` (bypass RLS), `authenticated` (impersonate a specific user — paste their UUID), and `anon`.

Sequence:
1. **Setup (as `service_role`)**: INSERT 3 cards for user-A (one `draft`, two `saved` with `next_due_at` in the past) and 2 cards for user-B (one `draft`, one `saved`). INSERT one `account_deletion_requests` row for user-B with `retention_until = now() + interval '30 days'`. This is the only block that needs the bypass role — fixture creation.
2. **Baseline as user-A** (switch role to `authenticated`, set User UID to A's UUID): `select count(*) from cards;` must return `3`.
3. **Cross-user SELECT (still as user-A)**: `select count(*) from cards where user_id = '<USER_B_UUID>';` must return `0`.
4. **Cross-user INSERT (as user-A)**: `insert into cards (user_id, front, back) values ('<USER_B_UUID>', 'x', 'y');` must fail with `new row violates row-level security policy`.
5. **Cross-user UPDATE (as user-A)**: `update cards set front = 'pwned' where user_id = '<USER_B_UUID>';` must affect `0` rows.
6. **Cross-user DELETE (as user-A)**: `delete from cards where user_id = '<USER_B_UUID>';` must affect `0` rows.
7. **Same matrix as user-B** (switch User UID in Studio): symmetric — `count(*) from cards` returns `2`, cross-user operations against user-A's data fail or affect 0 rows.
8. **`account_deletion_requests` cross-user check**: as user-A, `select count(*) from account_deletion_requests;` must return `0` (user-B has the row, user-A must not see it).
9. **Anonymous baseline** (switch role to `anon`): `select count(*) from cards;` must return `0`.
10. **Cleanup (as `service_role`)**: DELETE the fixture cards and the deletion-request row (leave the two test users in `auth.users` for re-runs).

Each block's expected result is documented inline as a SQL comment immediately preceding the statement so the runner doesn't have to cross-reference this plan.

### Success Criteria:

#### Automated Verification:

- `verify-rls.sql` is committed to `context/changes/cards-schema-and-rls/verify-rls.sql` with the actual user UUIDs filled in (placeholder check: `grep -c '<USER_._UUID>' verify-rls.sql` returns `0`).

#### Manual Verification:

- The two test users exist in the remote project's Authentication → Users list with the recorded UUIDs.
- Every block in `verify-rls.sql` produces its documented expected result when run in Studio's SQL editor with the correct role/UID for that block: cross-user reads return `0`, cross-user writes raise the RLS violation error or affect `0` rows, anonymous SELECT returns `0`, owner SELECT returns `3` and `2` respectively.
- After running the cleanup block at the end, `select count(*) from cards;` as `service_role` returns `0` (no fixture residue).

**Implementation Note**: This is the gate where PRD §Guardrails ("cross-user data leakage is ship-blocking") is actually proved. Do not move the change to `status: implemented` until every assertion in the script has been observed to hold against the remote DB. After this, F-01 is complete and S-01 (`/10x-plan first-gated-generation`) is unblocked.

---

## Testing Strategy

### Unit Tests

None added — there is no test runner configured (per `AGENTS.md` Testing Guidelines), and the per-file unit-testing surface for a SQL migration is poor anyway. The verification script in Phase 2 is the substitute.

### Integration Tests

The `verify-rls.sql` script in Phase 2 is the integration test: it exercises the full DB layer (schema + RLS policies + service-role-seeded fixtures) the way a future feature endpoint would, against the same DB that production reads from. Re-run it after any change to `cards` or `account_deletion_requests`.

### Manual Testing Steps

1. After Phase 1: open the remote Studio Table Editor, eyeball schema and policies; hit `https://10x-cards.rafsaw.workers.dev`, log in, confirm `/dashboard` still loads (smoke check).
2. After Phase 2: walk through each block in `verify-rls.sql` in the remote Studio SQL editor, switching role/UID as documented, and confirm every result matches its inline comment.

## Performance Considerations

The single composite index on `cards (user_id, status)` covers the read patterns of S-01 through S-03 (list a user's drafts; list a user's saved library). S-04's due-card lookup will need a partial index on `(user_id, next_due_at) where status='saved'` — deferred to S-04 itself, where the exact scheduling-column shape is settled by `/10x-research`. At PRD target scale (`users: small`, `qps: low`, `data_volume: small` per `prd.md:7–11`), no further indexing or partitioning is warranted.

## Migration Notes

This is a forward-only migration. There is no existing data, so no backfill is needed and rollback simply means dropping the two tables (which can be done in the remote Studio if disaster strikes before S-01 lands). Once S-01 starts inserting real drafts, rollback would have to preserve those — out of scope for this slice.

Because we are pushing directly to production with no local-stack dry-run, the safety net is (a) the migration is a forward-only `CREATE TABLE` — there is nothing to clobber — and (b) Phase 2's verification step runs against the just-applied schema before the change is considered done. If Phase 2 fails on a policy bug, fix forward with a follow-up migration in `supabase/migrations/`; do not edit the original file (CLI tracks applied filenames).

## References

- Roadmap source: `context/foundation/roadmap.md` (F-01, §Foundations)
- PRD: `context/foundation/prd.md` §Access Control, §Non-Functional Requirements, §Guardrails
- Supabase client: `src/lib/supabase.ts:5–24`
- Middleware (sets `context.locals.user` from session): `src/middleware.ts:6–25`
- Supabase config: `supabase/config.toml:53–65`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema migration + remote push

#### Automated

- [x] 1.1 `supabase db push` returns exit 0 and prints the applied migration filename — 9214f40
- [x] 1.2 `supabase migration list --linked` shows the migration as applied on remote — 9214f40
- [x] 1.3 `npm run lint` and `npm run build` still pass — 9214f40

#### Manual

- [x] 1.4 Remote Supabase Studio Table Editor shows both tables, columns match the contract, RLS enabled, all four policies per table present — 9214f40
- [x] 1.5 `cards.user_id` FK inspector shows `ON DELETE CASCADE` — 9214f40
- [x] 1.6 Deployed dashboard at `https://10x-cards.rafsaw.workers.dev` still loads, signin works, `/dashboard` loads for an authenticated user — 9214f40

### Phase 2: Manual RLS verification (on remote)

#### Automated

- [x] 2.1 `verify-rls.sql` is committed to the change folder with the actual user UUIDs filled in (no `<USER_._UUID>` placeholders remain)

#### Manual

- [x] 2.2 The two test users (`rls-test-a@example.invalid`, `rls-test-b@example.invalid`) exist in remote Authentication → Users with the recorded UUIDs
- [x] 2.3 Every block in `verify-rls.sql` produces its documented expected result when run in Studio with the correct role/UID for that block
- [x] 2.4 After the cleanup block, `select count(*) from cards;` as `service_role` returns 0 (no fixture residue)
