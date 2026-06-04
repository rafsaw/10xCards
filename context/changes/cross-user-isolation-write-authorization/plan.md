# Cross-User Isolation + Write Authorization (Test Rollout Phase 2) Implementation Plan

## Overview

Phase 2 of the frozen test rollout (`context/foundation/test-plan.md` §3) ships the
regression tests that protect the PRD-named ship-blocker — cross-user data isolation (R2) —
plus the retention write-lock (R4) and the untrusted-input validation parity (R5) nets.

The plan is **behavior-driven, not file-driven**: each phase names the behavior it proves and
the regression it would catch. It stands up one genuinely new test layer — a **real two-user
remote-DB integration harness** — and reuses the Phase-1 hermetic recipe for everything that
does not need real RLS.

## Current State Analysis

- **All code under test already exists and is correct.** Research (`research.md`) found zero
  isolation defects: RLS is proven at the DB layer (`context/archive/2026-05-27-cards-schema-and-rls/verify-rls-results.md`,
  14 assertions), all 7 write routes call `readOnlyGuard` (R4), and every write endpoint builds
  its insert/update payload server-side (R5). **These are regression/characterization tests for
  working code, not test-first development.**
- **One Supabase client, RLS-enforcing.** `src/lib/supabase.ts:5-24` is the sole factory
  (`createServerClient` with the anon `SUPABASE_KEY` + cookie JWT). **No service_role/admin
  client exists in `src/`** — so RLS is the single isolation layer, and four mutation paths
  (`reviews.ts`, `cards/[id]` PATCH & DELETE, `generations/save.ts`) carry **no application-level
  ownership filter** — RLS is their sole barrier.
- **Phase-1 test infra is hermetic.** `vitest.config.ts` uses `getViteConfig()` (Node env,
  `globals: true`, `setupFiles: ['./test/setup.ts']`). `test/setup.ts:7-10` stubs
  `SUPABASE_URL`/`SUPABASE_KEY` to **dummy** values and restores mocks `afterEach`. Phase-1
  integration tests (`src/pages/api/generations.test.ts`) drive routes directly with faked
  `locals` and `vi.mock('@/lib/supabase')` returning a recording fake — **no RLS runs**.
- **Supabase is remote-only — there is no local Docker stack** (memory `verification-and-deploy-workflow`;
  `supabase/` has only `config.toml` + `migrations`, no compose). Real-DB tests must hit the live
  project, need the **service_role key** to create the two test users (GoTrue blocks public
  test-domain signup via the anon key), and therefore cannot live in the secret-free default
  `npm test`.
- **`reviews.ts:26`** builds its client via `createClient(context.request.headers, context.cookies)`
  and reads the user from `locals.user` — confirming the harness attach point: mock the factory to
  return a **real** user-scoped client.

## Desired End State

- `npm run test:integration` runs a real two-user, remote-DB suite proving cross-user isolation
  on the highest-signal mutation paths; `npm test` stays **hermetic, fast, and secret-free**.
- Hermetic suites prove: every write route is locked during retention (R4), the server cannot be
  tricked into honoring client-supplied ownership/status (R5), and no app module can introduce a
  service_role RLS bypass.
- `context/foundation/test-plan.md` §6.3/§6.4 document the new real-DB integration pattern; §3
  Phase 2 status is `complete`.

**Verify:** `npm test` passes offline with no secrets. With `.env` holding real
`SUPABASE_URL` + anon key + `SUPABASE_SERVICE_ROLE_KEY`, `npm run test:integration` passes and
its two-user assertions fail if any RLS policy is dropped.

### Key Discoveries

- `src/lib/supabase.ts:5-24` — sole RLS-enforcing factory; no service_role client anywhere in `src/`.
- `src/pages/api/reviews.ts:39,43,60-72` — top R2 target: `cardId` from request body, RLS-only scoping, returns `{applied: data.length > 0}` (foreign id → `applied:false`, **not** 404).
- `src/pages/api/cards/[id].ts:62-68,102-108` — PATCH/DELETE scoped by `id`+`status` only; foreign id → 404 via the "0 rows" branch.
- `src/lib/account-retention.ts:5-19` — `readOnlyGuard(locals)` returns 403 `account_read_only` when `locals.isReadOnly`; pure function of locals (no DB).
- `src/pages/api/generations.test.ts:250-291` — the R5 forged-field reference assertion to replicate.
- `test/setup.ts:7-10` — global dummy env stubs; the integration suite must override these with real values via its own setup file.
- Memory `verification-and-deploy-workflow` — service_role admin API (`admin.auth.admin.createUser({ email, password, email_confirm: true })` / `deleteUser`) is the only way to mint test users; GoTrue blocks test domains on public signup.

## What We're NOT Doing

- **Not** testing the account-deletion **sweep predicate** (due-and-not-cancelled row selection) — that is test-plan §3 Phase 4. R4 here covers only the **write-lock**.
- **Not** testing RLS policies in raw SQL isolation — that was proven once in the archive; here we prove it **from the endpoint surface** (the §2 R2 anti-pattern is testing RLS while the endpoint quietly bypasses it; here we prove the endpoint path honors it).
- **Not** isolation-testing `generations/save.ts` (it has an app-level exact-cover guard on top of RLS; out of the R2 fixture scope per the scoping decision).
- **Not** exhaustively re-asserting R5 on every endpoint — only `cards.ts` POST + `reviews.ts` (the realistic injection targets); the rest are read-confirmed correct.
- **Not** adding e2e, a local Supabase stack, CI secret wiring, or a Phase-5 CI gate (later rollout phases).
- **Not** chasing max-length validation on `cards.ts`/`[id].ts` — no PRD oracle exists for a ceiling (research §R5).

## Implementation Approach

Two test layers, kept strictly separate:

- **Hermetic layer (default `npm test`)** — Phases 3, 4, 5. Drive routes directly, `vi.mock('@/lib/supabase')` with a recording/blocking fake, fake `locals`. No network, no secrets. Proves guard wiring and payload authority — things that do not depend on real RLS.
- **Real-DB layer (opt-in `npm run test:integration`)** — Phases 1, 2. A separate Vitest project/config with its own setup that loads **real** `SUPABASE_URL` + anon key + service_role key. Creates two real users, seeds a card each, and drives endpoints with `vi.mock('@/lib/supabase')` returning a **real** supabase-js client authenticated as the test user (Bearer token from `signInWithPassword`). Real RLS runs; cross-user assertions have genuine signal. A stubbed client would lie about RLS, so this layer is mandatory for R2.

TDD vs implement: **all phases are `/10x-implement`** — the code exists and works, so there is no
red-first opportunity (`/10x-tdd` is for not-yet-existing code). The single conditional: if a
Phase-2 "should-deny" assertion reveals a real isolation gap (a foreign write actually mutates),
**stop** and treat the fix as a red-first `/10x-tdd` task.

## Critical Implementation Details

- **`getViteConfig()` inlines `.env` into `astro:env/server` at config-load time** (test-plan §6.2). The integration suite must therefore supply real Supabase values via a config whose `.env`/setup resolves them at load — not via `vi.stubEnv` at runtime. Use a dedicated `vitest.integration.config.ts` + `test/setup.integration.ts` rather than overriding the global `test/setup.ts` stubs mid-test.
- **The factory mock must return a real client, scoped per test user.** Because `vi.mock` is hoisted and module-level, build the real user-scoped supabase-js client inside the mock via a mutable handle the test sets per fixture (mirror the `state`-object getter pattern from test-plan §6.2). Reset between tests.
- **`reviews.ts` denies via `applied:false`, not 404** (`reviews.ts:80`) — the R2 oracle (deny + no mutation) is met, but the assertion shape differs from `cards/[id]` (404). Pin each endpoint's exact deny-contract; the load-bearing assertion is **A's row is byte-for-byte unchanged**, not the status code.
- **Test-user lifecycle must be hermetic to the suite**: create A & B in a `beforeAll`, delete in `afterAll` (`admin.auth.admin.deleteUser` cascades cards via the FK). Use unique emails per run to avoid collisions; never reuse the F-01 fixed UUIDs from the memory note (those are for manual Studio work).
- **Service_role key must never reach app code** — it lives only in the integration **test** process (loaded from `.env`, git-ignored). The app reads only the anon `SUPABASE_KEY`. Phase 5 guards this invariant statically.

---

## Phase 1: Real-DB integration harness (infra)

### Overview

Stand up the opt-in `test:integration` layer and prove its wiring with one smoke isolation
assertion before any per-endpoint test is written. **Behavior proven: a real two-user RLS setup
works end-to-end — user B genuinely cannot read user A's seeded row through the real client.**

### Changes Required

#### 1. Integration Vitest config

**File**: `vitest.integration.config.ts` (new)

**Intent**: A separate Vitest config so real-DB tests run only on demand and never pollute the
default suite. Mirrors `vitest.config.ts` (`getViteConfig()`, Node env, globals) but points
`setupFiles` at an integration setup and includes only `*.integration.test.ts`.

**Contract**: Exports `getViteConfig({ test: { include: ['**/*.integration.test.ts'], setupFiles: ['./test/setup.integration.ts'], globals: true, environment: 'node' } })`. Default `vitest.config.ts` adds `exclude: ['**/*.integration.test.ts']` so `npm test` skips them.

#### 2. Integration setup + env contract

**File**: `test/setup.integration.ts` (new)

**Intent**: Provide the real Supabase env to the integration suite (not the dummy stubs from
`test/setup.ts`) and fail fast with a clear message if the required secrets are absent, so a
contributor without `.env` gets "set SUPABASE_SERVICE_ROLE_KEY to run integration tests", not a
cryptic auth error.

**Contract**: Reads `SUPABASE_URL`, `SUPABASE_KEY` (anon), `SUPABASE_SERVICE_ROLE_KEY` from the environment; throws a descriptive error in `beforeAll` if any is missing. Registers the same `afterEach` cleanup as `test/setup.ts`. Documents that `.env` (git-ignored) is the source.

#### 3. Two-user fixture helper

**File**: `test/integration/two-user-fixture.ts` (new)

**Intent**: One reusable helper that creates users A & B via the service_role admin API, seeds
one `saved` card per user, exposes each user's id + a function returning a **real user-scoped**
supabase-js client (Bearer access token from `signInWithPassword`), and tears everything down.
This is the harness every R2 test builds on.

**Contract**: Exports `setupTwoUsers()` → `{ a, b, teardown }` where each user is `{ id, email, seededCardId, scopedClient() }`. `scopedClient()` returns a `@supabase/supabase-js` client created with the anon key and `global.headers.Authorization = 'Bearer <access_token>'` so queries run as that `auth.uid()`. Admin client uses `SUPABASE_SERVICE_ROLE_KEY`; users created with `email_confirm: true` and unique per-run emails; `teardown()` calls `admin.auth.admin.deleteUser` for both (cards cascade via FK).

#### 4. Factory-mock returning a real client

**File**: `test/integration/scoped-supabase-mock.ts` (new)

**Intent**: A helper to make `createClient` (from `@/lib/supabase`) return a chosen test user's
real scoped client, so a directly-driven route runs against real RLS as that user. Reuses §6.2's
sanctioned factory-mock exception, but the returned client is real.

**Contract**: Exports a `vi.mock('@/lib/supabase', …)` registration plus a `setActingUser(client)` handle the test flips per fixture (mutable module-level ref read by the mock's `createClient`). Returns `null` is never used here — always a real client. Resets in `afterEach`.

#### 5. Smoke wiring test + npm script

**File**: `test/integration/harness.integration.test.ts` (new); `package.json`

**Intent**: Prove the harness before building on it: with A and B seeded, B's scoped client
querying A's `seededCardId` returns **zero rows**, and A's own client returns the row. If this
fails, the harness (auth, RLS, client wiring) is broken — fix before Phase 2.

**Contract**: `package.json` adds `"test:integration": "vitest run --config vitest.integration.config.ts"`. The smoke test asserts `b.scopedClient().from('cards').select().eq('id', a.seededCardId)` → `data.length === 0` and `a.scopedClient()...` → `data.length === 1`.

### Success Criteria

#### Automated Verification

- `npm test` still passes and does **not** execute any `*.integration.test.ts`: `npm test`
- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- With real `.env`, the harness smoke test passes: `npm run test:integration`
- With a required secret unset, the integration suite fails fast with the descriptive message (not an opaque auth error)

#### Manual Verification

- Confirm the two test users are created and then removed from the remote project (no orphan users/cards after a run)
- Confirm `npm test` runs with no network access (offline) and no secrets present

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation (test-user lifecycle leaves no residue; offline `npm test` is green) before Phase 2.

---

## Phase 2: R2 cross-user isolation tests

### Overview

**Behavior proven: an authenticated user's write against another user's resource id neither
mutates nor reveals that resource; the owner's row is left byte-for-byte unchanged.** Covers the
three highest-signal RLS-only mutation paths.

### Changes Required

#### 1. reviews.ts isolation (top target)

**File**: `src/pages/api/reviews.integration.test.ts` (new)

**Intent**: Prove user B cannot reschedule user A's card by passing A's `cardId` in the body.
Drive `POST` directly with `setActingUser(b.scopedClient())` and `locals.user = { id: b.id, … }`,
body `{ cardId: a.seededCardId, rating, currentBox }`. Assert the deny-contract and, decisively,
that A's card SR columns are unchanged (re-read via A's client).

**Contract**: Asserts response `{ applied: false }` (the foreign-id branch, `reviews.ts:80`) and that A's card `repetition_count`/`next_due_at`/`interval_days`/`last_reviewed_at` equal their seeded values. A positive control (B reviewing **B's own** card → `applied:true`) confirms the path works when ownership matches.

#### 2. cards/[id] PATCH & DELETE isolation

**File**: `src/pages/api/cards/[id].integration.test.ts` (new)

**Intent**: Prove user B cannot edit or delete user A's card via a foreign id in the route param.
Drive PATCH and DELETE with B acting and `params.id = a.seededCardId`.

**Contract**: PATCH(foreign id) → 404 `not_found`, A's `front`/`back` unchanged. DELETE(foreign id) → 404 `not_found`, A's row still present. Positive control: B on B's own card → 200 + mutation/deletion applied.

### Success Criteria

#### Automated Verification

- Isolation suite passes against real RLS: `npm run test:integration`
- Default suite unaffected: `npm test`
- Type/lint pass: `npm run build` / `npm run lint`

#### Manual Verification

- Temporarily drop or weaken one `cards_*_own` RLS policy on a scratch/branch DB and confirm the relevant assertion **fails** (proves the test has real signal, not a false green)
- Confirm the positive controls pass (the path works for the legitimate owner)

**Conditional (TDD handoff)**: If any "should-deny" assertion shows a real mutation of A's row, **stop** — that is a genuine isolation gap. Hand the fix to `/10x-tdd` (red test = the foreign write must not mutate), then resume.

**Implementation Note**: Pause for manual confirmation (signal check via policy-drop) before Phase 3.

---

## Phase 3: R4 retention write-lock (hermetic)

### Overview

**Behavior proven: every mutating route refuses writes (403) and performs no mutation while the
account is in retention; the two lifecycle routes (`cancel`, `delete`) remain usable.** No real
DB — the lock is a pure function of `locals.isReadOnly`.

### Changes Required

#### 1. Per-route lock coverage

**File**: `src/pages/api/retention-write-lock.test.ts` (new)

**Intent**: Parameterized hermetic test over all 7 write routes. With `locals.isReadOnly = true`,
each route returns 403 `account_read_only` and never calls the mocked client's mutating methods.
With `isReadOnly = false`, the route proceeds past the guard (positive control). Separately assert
`account/cancel` and `account/delete` are **not** blocked when `isReadOnly = true`.

**Contract**: An `it.each` table of `{ route, importPath, buildContext }` for `cards POST`, `cards/[id] PATCH`, `cards/[id] DELETE`, `generations POST`, `generations/save POST`, `generations/discard POST`, `reviews POST`. Each locked case asserts status 403, body `error: 'account_read_only'`, and that the `vi.mock('@/lib/supabase')` fake's `insert`/`update`/`delete`/`rpc` were never invoked. The two lifecycle routes assert status ≠ 403 under `isReadOnly = true`.

### Success Criteria

#### Automated Verification

- All 9 cases (7 locked + 2 exempt) pass: `npm test`
- Type/lint pass: `npm run build` / `npm run lint`

#### Manual Verification

- Confirm the table actually imports each real route handler (not a stand-in) so adding a future un-guarded write route would surface here

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: R5 validation parity (hermetic)

### Overview

**Behavior proven: the server derives ownership and status itself and ignores client-supplied
`user_id`/`status`/`id` from the body; empty/invalid input is rejected.** Hermetic, mirrors the
Phase-1 `generations.test.ts` forged-field pattern.

### Changes Required

#### 1. cards.ts POST forged-field + validation

**File**: `src/pages/api/cards.test.ts` (new)

**Intent**: Prove manual card create is server-authoritative. Forge `user_id`, `status`, `id`,
`created_at` in the body; assert the recorded insert uses `user_id = locals.user.id` and the
hardcoded `status: 'saved'`, with no client-supplied id/created_at. Assert empty `front`/`back`
→ 400 (FR-009).

**Contract**: Recorded insert payload keys are exactly the server-built set with `user_id === locals.user.id` and `status === 'saved'`; forged values absent. Empty/whitespace front or back → 400. Uses the §6.2 factory-mock recording fake.

#### 2. reviews.ts forged-field + validation

**File**: `src/pages/api/reviews.test.ts` (new)

**Intent**: Prove the review write ignores any body-supplied ownership/status and validates
inputs. Forge `user_id`/`status` in the body; assert the update payload is computed purely from
`schedule()` and the query is owner/box-scoped. Assert invalid `rating`/`currentBox`/missing
`cardId` → 400.

**Contract**: Update payload contains only `repetition_count`/`interval_days`/`next_due_at`/`last_reviewed_at` (no `user_id`/`status`); invalid inputs → 400 `invalid_rating`. Hermetic recording fake; no real DB.

### Success Criteria

#### Automated Verification

- Forged-field + validation cases pass: `npm test`
- Type/lint pass: `npm run build` / `npm run lint`

#### Manual Verification

- Confirm each test asserts against an oracle value (server rule), not a value lifted from the endpoint (no mirror tests)

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Service-role static guardrail (hermetic)

### Overview

**Behavior proven: no application module can introduce a service_role client that would silently
bypass RLS** — the one regression that would void every R2 guarantee across all routes at once.

### Changes Required

#### 1. Static scan test

**File**: `test/no-service-role-in-src.test.ts` (new)

**Intent**: Scan `src/**` for references to a service_role key (case-insensitive
`service_role` / `SERVICE_ROLE`) and fail if any app module references it. A cross-route backstop
the two-user tests (which cover only 3 routes) cannot provide.

**Contract**: Reads `src/` files (via `import.meta.glob` or `fs` over the resolved src dir), asserts no match for `/service[_-]?role/i` outside an explicit allowlist (empty today). Failure message names the offending file. No DB, no network.

### Success Criteria

#### Automated Verification

- Scan passes (no service_role references in `src/`): `npm test`
- Type/lint pass: `npm run build` / `npm run lint`

#### Manual Verification

- Temporarily add a `service_role` reference to a scratch file under `src/` and confirm the test fails (signal check), then remove it

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: Cookbook + plan sync

### Overview

**Behavior proven (documentation): a future contributor can find and correctly apply the new
real-DB integration pattern, and the rollout state reflects what shipped.**

### Changes Required

#### 1. Cookbook §6.3 / §6.4

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the "TBD — see §3 Phase 2" placeholders in §6.3 (test for a new API endpoint)
and §6.4 (cross-user isolation test) with the two-user real-DB recipe: the `test:integration`
command, the two-user fixture + scoped-client mock, the deny-contract-per-endpoint gotcha
(`applied:false` vs 404), and the load-bearing "owner row unchanged" assertion. Note when to use
real-DB (RLS signal) vs hermetic (guard/payload).

**Contract**: §6.3 and §6.4 filled; §6.6 gains a 2–3 line note on anything the rollout taught (e.g. remote-only harness, factory-mock-returns-real-client).

#### 2. Rollout + change status

**File**: `context/foundation/test-plan.md`; `context/changes/cross-user-isolation-write-authorization/change.md`

**Intent**: Flip §3 Phase 2 Status `not started` → `complete` and set its Change folder to this
change. Update the test-plan header "Last updated" line. (`change.md` status is advanced by the
implement/commit ritual.)

**Contract**: §3 Phase 2 row Status = `complete`, Change folder = `context/changes/cross-user-isolation-write-authorization/`. Roadmap/status mirrors kept consistent (memory `roadmap-status-sync`).

### Success Criteria

#### Automated Verification

- Lint of touched markdown passes (prettier): `npm run lint`

#### Manual Verification

- §6.3/§6.4 read as actionable recipes (a contributor could write a new isolation test from them alone)
- §3 Phase 2 status and change-folder link are correct

---

## Testing Strategy

### Unit / hermetic (default `npm test`)

- R4: all 7 write routes return 403 + no mutation under `isReadOnly=true`; `cancel`/`delete` exempt.
- R5: `cards.ts` POST and `reviews.ts` ignore forged `user_id`/`status`/`id`; invalid input → 400.
- Guardrail: no `service_role` reference in `src/`.

### Integration / real-DB (`npm run test:integration`)

- Harness smoke: B cannot SELECT A's seeded card; A can.
- R2: `reviews.ts` (foreign cardId → `applied:false`, A unchanged); `cards/[id]` PATCH/DELETE (foreign id → 404, A unchanged). Positive controls for each.

### Manual Testing Steps

1. Run `npm test` offline with no secrets → green, no integration tests executed.
2. Populate `.env` with real `SUPABASE_URL` + anon + `SUPABASE_SERVICE_ROLE_KEY`; run `npm run test:integration` → green; confirm no residual test users/cards remain.
3. Signal check: drop one `cards_*_own` RLS policy on a scratch DB → the matching R2 assertion fails; restore it.

## Performance Considerations

The real-DB suite makes live network calls (user create/sign-in/seed/teardown). Keep it to the
three target endpoints + smoke to bound latency; it is an **ad-hoc gate** (test-plan §4), not run
on every commit. The default `npm test` stays in-process and fast.

## Migration Notes

No data or schema migration. New files only; `vitest.config.ts` gains an `exclude` for
`*.integration.test.ts` and `package.json` gains `test:integration`. The integration suite
requires `SUPABASE_SERVICE_ROLE_KEY` in the git-ignored `.env`.

## References

- Research: `context/changes/cross-user-isolation-write-authorization/research.md`
- Test strategy: `context/foundation/test-plan.md` (§2 R2/R4/R5, §4 mocking policy, §6.2 recipe, §6.3/§6.4 slots)
- Phase-1 reference test: `src/pages/api/generations.test.ts:250-291`
- RLS proof: `context/archive/2026-05-27-cards-schema-and-rls/verify-rls-results.md`
- Retention lock contract: `context/archive/2026-06-01-account-deletion-with-retention/plan.md`
- Harness mechanics (test-user creation, remote-only): memory `verification-and-deploy-workflow`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Real-DB integration harness (infra)

#### Automated

- [x] 1.1 `npm test` still passes and does not execute any `*.integration.test.ts` — bd2d449
- [x] 1.2 Type checking passes: `npm run build` — bd2d449
- [x] 1.3 Linting passes: `npm run lint` — bd2d449
- [x] 1.4 With real `.env`, the harness smoke test passes: `npm run test:integration` — bd2d449
- [x] 1.5 With a required secret unset, the integration suite fails fast with the descriptive message — bd2d449

#### Manual

- [x] 1.6 Test users created then removed from the remote project (no orphan users/cards) — bd2d449
- [x] 1.7 `npm test` runs offline with no secrets — bd2d449

### Phase 2: R2 cross-user isolation tests

#### Automated

- [x] 2.1 Isolation suite passes against real RLS: `npm run test:integration` — 2480d45
- [x] 2.2 Default suite unaffected: `npm test` — 2480d45
- [x] 2.3 Type/lint pass: `npm run build` / `npm run lint` — 2480d45

#### Manual

- [x] 2.4 Dropping/weakening a `cards_*_own` policy makes the matching assertion fail (signal check) — 2480d45
- [x] 2.5 Positive controls pass (path works for the legitimate owner) — 2480d45

### Phase 3: R4 retention write-lock (hermetic)

#### Automated

- [x] 3.1 All 9 cases (7 locked + 2 exempt) pass: `npm test`
- [x] 3.2 Type/lint pass: `npm run build` / `npm run lint`

#### Manual

- [x] 3.3 Table imports each real route handler (a future un-guarded write route would surface here)

### Phase 4: R5 validation parity (hermetic)

#### Automated

- [ ] 4.1 Forged-field + validation cases pass: `npm test`
- [ ] 4.2 Type/lint pass: `npm run build` / `npm run lint`

#### Manual

- [ ] 4.3 Each test asserts against an oracle value, not a value lifted from the endpoint (no mirror tests)

### Phase 5: Service-role static guardrail (hermetic)

#### Automated

- [ ] 5.1 Scan passes (no service_role references in `src/`): `npm test`
- [ ] 5.2 Type/lint pass: `npm run build` / `npm run lint`

#### Manual

- [ ] 5.3 Adding a `service_role` reference under `src/` makes the test fail (signal check)

### Phase 6: Cookbook + plan sync

#### Automated

- [ ] 6.1 Lint of touched markdown passes: `npm run lint`

#### Manual

- [ ] 6.2 §6.3/§6.4 read as actionable recipes
- [ ] 6.3 §3 Phase 2 status `complete` and change-folder link correct
