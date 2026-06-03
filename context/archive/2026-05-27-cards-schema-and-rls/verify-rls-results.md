# RLS Verification — Run Record (Phase 2)

- **Run date:** 2026-05-27
- **Target DB:** remote Supabase project `czpigaynwlnzzovxbrit`
- **Schema state:** migration `20260527150510_cards_and_account_deletion.sql` applied at commit `9214f40`
- **Companion script:** `verify-rls.sql` (committed alongside this file)

## Purpose

PRD §Guardrails names cross-user data leakage ship-blocking even if every other feature works. F-01 enables RLS on `public.cards` and `public.account_deletion_requests`, but RLS that *looks* correct can silently allow the wrong action. This phase proves the policies actually enforce isolation against the live remote DB before any application code reads or writes these tables.

## Test users

Two dedicated accounts in remote `auth.users`, created via Studio → Authentication → Users → Add user (with "Auto Confirm User" ticked). Passwords were left as throwaway random values and discarded — SQL impersonation needs only the UUID.

| Email                          | UUID                                   |
| ------------------------------ | -------------------------------------- |
| `rls-test-a@example.invalid`   | `4fb3fd61-82bd-4305-adc5-b7a81f00ab2d` |
| `rls-test-b@example.invalid`   | `368469c6-1245-4e04-bbd3-141130cc9b95` |

**DO NOT DELETE** these users from remote auth — `verify-rls.sql` references them by UUID. They can be removed once a separate test environment exists.

## How the run was done

The Studio SQL editor (https://supabase.com/dashboard/project/czpigaynwlnzzovxbrit) was used in role-impersonation mode. The editor's role dropdown exposes three roles on this project: `postgres`, `anon`, and `authenticated`. When `authenticated` is picked, a User UID field appears below the dropdown — pasting a UUID injects the matching JWT claims for the query.

`postgres` was used in place of the plan's nominal `service_role` for setup/cleanup. The migration deliberately does not use `FORCE ROW LEVEL SECURITY`, so Postgres's default behavior applies — RLS is bypassed for the table owner (`postgres`). Functionally identical to running as `service_role` for the seed/cleanup case.

Each block from `verify-rls.sql` was pasted into a fresh editor pane with the role/UID set per the block header, then executed individually. Blocks were run in order — Block 1 first (seed), Block 10 last (cleanup).

## Block-by-block results

| Block | Role           | User UID | What it tested                                | Expected                              | Observed                                                                 | ✓ |
| ----- | -------------- | -------- | --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ | - |
| 1     | postgres       | —        | Seed: 5 cards + 1 deletion request            | "Success. No rows returned"           | "Success. No rows returned"                                              | ✓ |
| 2     | authenticated  | User A   | Owner SELECT: how many cards does A own?      | `3`                                   | `3`                                                                      | ✓ |
| 3     | authenticated  | User A   | Cross-user SELECT against B's rows            | `0`                                   | `0`                                                                      | ✓ |
| 4     | authenticated  | User A   | Cross-user INSERT claiming B's user_id        | RLS violation (SQLSTATE 42501)        | `ERROR 42501: new row violates row-level security policy for table "cards"` | ✓ |
| 5     | authenticated  | User A   | Cross-user UPDATE against B's rows            | 0 rows affected                       | "Success. No rows returned"                                              | ✓ |
| 6     | authenticated  | User A   | Cross-user DELETE against B's rows            | 0 rows affected                       | "Success. No rows returned"                                              | ✓ |
| 7a    | authenticated  | User B   | Symmetric owner SELECT                        | `2`                                   | `2`                                                                      | ✓ |
| 7b    | authenticated  | User B   | Symmetric cross-user SELECT                   | `0`                                   | `0`                                                                      | ✓ |
| 7c    | authenticated  | User B   | Symmetric cross-user INSERT                   | RLS violation                         | `ERROR 42501: new row violates row-level security policy for table "cards"` | ✓ |
| 7d    | authenticated  | User B   | Symmetric cross-user UPDATE                   | 0 rows affected                       | "Success. No rows returned"                                              | ✓ |
| 7e    | authenticated  | User B   | Symmetric cross-user DELETE                   | 0 rows affected                       | "Success. No rows returned"                                              | ✓ |
| 8     | authenticated  | User A   | Cross-user check on `account_deletion_requests` | `0`                                 | `0`                                                                      | ✓ |
| 9     | anon           | —        | Anonymous baseline                            | `0`                                   | `0`                                                                      | ✓ |
| 10    | postgres       | —        | Cleanup + residue confirmation                | `residue_cards = 0`                   | `residue_cards = 0`                                                      | ✓ |

## Conclusion

All 14 assertions held. RLS isolates `cards` and `account_deletion_requests` in both directions and against anonymous access. The PRD §Guardrails ship-blocker is proved at the database layer. F-01 is complete; S-01 (`/10x-plan first-gated-generation`) is unblocked.

## Re-running this in the future

After any change to `cards` or `account_deletion_requests` (new columns, new policies, FORCE RLS added), re-run `verify-rls.sql` end-to-end and update this file with a new run record. Same script, same UUIDs, same expected outputs — divergence is a regression.
