# Cross-User Isolation + Write Authorization (Test Phase 2) — Plan Brief

> Full plan: `context/changes/cross-user-isolation-write-authorization/plan.md`
> Research: `context/changes/cross-user-isolation-write-authorization/research.md`

## What & Why

Phase 2 of the frozen test rollout ships regression tests for the PRD-named **ship-blocker** —
cross-user data isolation (R2) — plus the retention write-lock (R4) and untrusted-input
validation parity (R5). The code is already correct; these tests pin that correctness so a future
change can't silently break it.

## Starting Point

One RLS-enforcing Supabase client (`src/lib/supabase.ts`), no service_role client anywhere in
`src/`. Four mutation paths (`reviews.ts`, `cards/[id]` PATCH & DELETE, `generations/save`) rely
on **RLS as their sole owner check**. Phase-1 test infra is hermetic (mocked client, faked
`locals`, no RLS). Supabase is **remote-only — no local stack**.

## Desired End State

`npm run test:integration` runs a real two-user, remote-DB suite proving isolation on the
highest-signal paths; `npm test` stays hermetic, fast, and secret-free. Hermetic suites prove
every write route is locked during retention, the server can't be tricked into honoring
client-supplied ownership/status, and no app module can introduce a service_role RLS bypass.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Isolation test layer | Real two-user remote DB | A stub lies about RLS; only real RLS gives R2 signal | Research + User |
| Harness mechanism | Factory-mock returns a **real** user-scoped client | Reuses §6.2 mock, no dev server/cookie gymnastics, real RLS runs | Plan |
| Where real-DB tests run | Separate opt-in `test:integration` | Remote-only + service_role secret; keep `npm test` fast/secret-free (§4 ad-hoc gate) | Plan |
| R2 endpoint coverage | `reviews.ts` + `cards/[id]` PATCH & DELETE | Highest-signal IDOR paths; foreign id trivially injectable | Plan |
| R4 lock coverage | Exhaustive per-route 403 (all 7) + exemptions | "A single missed route silently leaks write access" | Plan |
| R5 coverage | `cards.ts` POST + `reviews.ts` | The realistic injection targets; rest read-confirmed correct | Plan |
| Service-role guardrail | Tiny static `src/` scan | Cross-route backstop for the one silent isolation-breaker | Research + User |
| TDD vs implement | All `/10x-implement` | Code already exists/works → no red-first opportunity (conditional `/10x-tdd` only if a real gap surfaces) | Plan |

## Scope

**In scope:** real-DB harness; R2 isolation on 3 paths; R4 lock on all 7 routes + 2 exemptions;
R5 forged-field on 2 endpoints; service_role static guardrail; cookbook §6.3/§6.4 + status sync.

**Out of scope:** the account-deletion **sweep predicate** (Phase 4); raw-SQL RLS tests; e2e;
local Supabase stack; CI secret wiring / Phase-5 gate; max-length validation (no PRD oracle);
`generations/save` isolation (has app-level guard).

## Architecture / Approach

Two strictly separated layers. **Hermetic** (default `npm test`): drive routes directly, mock the
client, fake `locals` — proves guard wiring (R4) and payload authority (R5) with no network/secrets.
**Real-DB** (`npm run test:integration`): own config + setup loading real `SUPABASE_URL`/anon/
service_role; create two users, seed a card each, and mock the factory to return a **real**
supabase-js client authed as the test user (Bearer token) so real RLS runs and cross-user
assertions have genuine signal.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Harness | `test:integration` + two-user fixture + scoped-client mock + smoke proof | Cookie/auth wiring; test-user residue |
| 2. R2 isolation | reviews + cards/[id] PATCH/DELETE foreign-id denial, owner row unchanged | False green if RLS not actually exercised |
| 3. R4 lock | All 7 write routes → 403 + no mutation under retention; cancel/delete exempt | Missing a route in the it.each table |
| 4. R5 parity | cards POST + reviews ignore forged user_id/status; bad input → 400 | Mirror-testing the implementation |
| 5. Guardrail | Static scan: no service_role in `src/` | Over-broad string match needing allowlist |
| 6. Cookbook | §6.3/§6.4 recipe + §3 Phase 2 → complete | Docs drifting from shipped pattern |

**Prerequisites:** real `.env` with `SUPABASE_URL` + anon `SUPABASE_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (git-ignored) for Phases 1–2; Phases 3–5 need nothing extra.
**Estimated effort:** ~2–3 sessions; Phase 1 (harness) is the bulk, Phases 3–5 are quick hermetic adds.

## Open Risks & Assumptions

- Real-DB tests hit the **live** project — they create/delete throwaway users each run; a crashed run could leave residue (teardown in `afterAll` + unique emails mitigate).
- `service_role` key must reach only the **test** process, never app code (Phase 5 guards this statically).
- Phases 3–5 are hermetic and independent of the harness; only Phase 2 depends on Phase 1.
- Conditional: if a Phase-2 "should-deny" assertion reveals a real mutation, stop and fix red-first via `/10x-tdd`.

## Success Criteria (Summary)

- `npm test` green offline with no secrets; no integration tests executed.
- `npm run test:integration` green with real `.env`; its assertions fail if any `cards_*_own` RLS policy is dropped.
- A future un-guarded write route, a forged-ownership regression, or a service_role client added to `src/` each turns a test red.
