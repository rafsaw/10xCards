# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-04 (§3 Phase 2 → complete; §6.3/§6.4 cookbook filled + §6.6 note)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data. The top risk in this
   plan (R1) comes straight from the Phase 2 interview, not the PRD.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is produced
   by `/10x-research` during each rollout phase. If the plan and research
   disagree about where the failure lives, research is the ground truth.

Hot-spot scope used for likelihood weighting: `src/` (excluding docs,
archive, build output). 122 commits in the last 30 days — sufficient signal.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                         | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | LLM provider returns an invalid / corrupted / partial response and the generation flow breaks — the user loses their pasted text, sees a hang or 500, or garbage candidates get rendered (or saved) as if valid | High   | High       | interview Q1 (top stated worry); PRD FR-008 + Guardrails ("source text preserved, retry without re-paste"); hot-spot dir `src/pages/api/generations/` (4 commits/30d)             |
| 2   | One data endpoint isn't scoped to the session user (admin client / missing filter), so user A reads or mutates user B's cards — cross-tenant leak                                                               | High   | Medium     | PRD Guardrails ("cross-user data leakage is ship-blocking"), Access Control, NFR; archive `cards-schema-and-rls/plan.md` (RLS); hot-spot dir `src/pages/api/` (6 commits/30d)     |
| 3   | Atomic accept/reject half-commits — some drafts saved, some left as draft, rejects not deleted — and the deck ends in an inconsistent state the user can't read                                                 | High   | Medium     | PRD FR-006/FR-007; archive `atomic-save-to-deck/plan.md`; interview Q3 (deck flow = "roulette"); hot-spot dir `src/pages/api/generations/` (4 commits/30d)                        |
| 4   | Account-lifecycle contract breaks: an account in 30-day retention can still mutate (a write route is unguarded), or the hard-delete sweep deletes a cancelled account / skips one that is due                   | High   | Medium     | PRD FR-017/FR-018; archive `account-deletion-with-retention/plan.md`; hot-spot route-protection/middleware surface in `src/` (6 commits/30d)                                      |
| 5   | The server trusts the client on untrusted input — empty front/back saved, client-supplied `user_id`/`status` honored, oversized paste accepted — a validation-parity gap                                        | Medium | Medium     | PRD NFR ("no path surfaces another user's data"), FR-009 (non-empty front/back); abuse lens (untrusted input); hot-spot dirs `src/pages/api/cards/`, `src/pages/api/generations/` |
| 6   | Review progress isn't persisted (next-due / rating lost across sessions), or the "oldest-due-first" fallback doesn't fire when selection fails — the secondary success criterion silently breaks                | Medium | Medium     | PRD US-02, FR-015, Guardrails (fallback); archive `srs-review-session/plan.md`; hot-spot dir `src/components/review/` (4 commits/30d)                                             |

5–7 rows. Every row cites at least one source.

**Abuse / security lens applied** (product has auth + per-user data + user
input): R2 (authorization / IDOR — ownership check, not just authentication),
R5 (untrusted input + server-side validation parity), R4 (resource /
lifecycle abuse — write access during a locked retention state). Covered.

High-impact × low-likelihood scenarios deliberately kept out of the map:
the Cloudflare/Supabase platform outage and the pg*cron mechanism failing to
fire — those belong to observability/alerting, not a test. R4 tests the
\_predicate* that selects accounts, not whether the scheduler runs.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                            | Must challenge                                                                       | Context `/10x-research` must ground                                                                                     | Likely cheapest layer                                                            | Anti-pattern to avoid                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| #1   | On malformed / partial / empty / timeout LLM output: the pasted text survives, the user gets a clean retry, and nothing invalid is persisted as a card | "Provider returned 200 ⇒ the body is valid candidates"                               | The parse/validate boundary between the provider response and the persisted draft; what counts as an "invalid" response | unit (response validator) + integration (generation endpoint, stubbed provider)  | Asserting expected values lifted from the parser itself (oracle problem); happy-path-only |
| #2   | An endpoint returns / mutates only rows owned by the session user; a second user's request for the same id is denied                                   | "Logged-in ⇒ authorized for this resource id" (authentication ≠ authorization)       | Whether each endpoint uses a user-scoped vs admin Supabase client; where RLS is, and is not, the last line of defense   | integration (two-user fixtures hitting each data endpoint)                       | Testing RLS in isolation while the endpoint quietly uses an admin client                  |
| #3   | A batch accept/reject either fully applies or fully rolls back; no partial state under mid-operation failure or concurrent tabs                        | "Final status 200 ⇒ all rows transitioned"; "no two tabs at once"                    | The transaction / atomicity boundary; idempotency on retry                                                              | integration (injected mid-batch failure)                                         | A per-card loop assertion that never exercises the failure path                           |
| #4   | A `pending_deletion` account is blocked on every write route; the sweep deletes exactly the accounts that are due-and-not-cancelled                    | "Guarded the obvious routes ⇒ all writes covered"; "cron fired ⇒ right rows deleted" | The full set of write routes; the sweep's row-selection predicate                                                       | integration (write-route guard) + unit (sweep predicate — not the cron plumbing) | E2E-ing the cron mechanism (infra — out of scope per §7) instead of testing the predicate |
| #5   | The server rejects empty / oversized / ill-typed input and ignores client-supplied ownership/status fields, regardless of what the client sends        | "Client validated ⇒ the server can trust it"                                         | Server-side validation location; whether ownership/status are derived server-side or read from the body                 | integration (create/edit/generate endpoints with hostile payloads)               | Mirroring client validation; trusting `user_id` from the request body                     |
| #6   | After rating, next-due updates and survives a session restart; when selection logic throws, oldest-due-first still yields a card                       | "Rating returned ⇒ it persisted"                                                     | Where next-due is computed and persisted; how the fallback is wired                                                     | integration (review/rate endpoint) + unit (fallback path)                        | A UI snapshot that never asserts persisted state                                          |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                                 | Goal (one line)                                                                                                   | Risks covered       | Test types         | Status      | Change folder                                             |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------ | ----------- | --------------------------------------------------------- |
| 1   | Runner bootstrap + generation resilience   | Stand up the test runner (test base is `none`) and prove bad LLM output never breaks the flow or persists garbage | #1, #5 (generation) | unit + integration | complete    | context/changes/testing-generation-resilience/            |
| 2   | Cross-user isolation + write authorization | Prove the ship-blocker: every data endpoint scopes to the session user, and the retention lock blocks all writes  | #2, #4 (lock), #5   | integration        | complete    | context/changes/cross-user-isolation-write-authorization/ |
| 3   | Deck & review integrity                    | Prove atomic save is all-or-nothing and review progress persists with the fallback firing                         | #3, #6              | integration        | not started | —                                                         |
| 4   | Account-sweep predicate                    | Prove the hard-delete predicate selects exactly the right accounts — predicate only, not cron plumbing            | #4 (sweep)          | unit / integration | not started | —                                                         |
| 5   | Quality-gates wiring                       | Lock the floor: lint + typecheck + unit/integration run as a gate on `main`                                       | cross-cutting       | gates              | not started | —                                                         |

**Status vocabulary** (fixed — parser literals): `not started` → `change
opened` → `researched` → `planned` → `implementing` → `complete`.

Order rationale: Phase 1 first because it is the top risk (High × High) and
it also bootstraps the runner. Phase 2 next — it is the PRD-named
ship-blocker. Phases 3–4 cover the integrity contracts. Phase 5 locks the
floor once there is a suite worth gating. Note: CI today triggers on
`master` only while the working branch is `main`, so there is no live gate
(AGENTS.md Agent Tripwires) — Phase 5 closes that gap.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer                  | Tool                                             | Version           | Notes                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration     | Vitest                                           | `^3.2.4`          | Astro-native via `getViteConfig()` (Node env). `getViteConfig()` requires Vitest ≥3.2 on Astro 6 — do not jump to 4.x (helper not on the stable 4.x peer story). Config: `vitest.config.ts`; env setup: `test/setup.ts`                         |
| API / provider mocking | global `fetch` stub; `vi.mock('@/lib/supabase')` | (Vitest built-in) | Mock only the external HTTP edge — `vi.stubGlobal('fetch', …)` for OpenRouter. The DB write is the **one sanctioned internal exception**: `vi.mock('@/lib/supabase')` for the client factory, scoped to asserting the insert payload (see §6.2) |
| e2e                    | none yet                                         | —                 | Deferred — no critical flow needs full-browser signal that integration won't give cheaply. Revisit if §3 changes                                                                                                                                |
| accessibility          | none                                             | —                 | Out of scope — UI look-and-feel is negative space (§7)                                                                                                                                                                                          |
| (optional) AI-native   | deferred — see §5                                | n/a               | When NOT to use: never put a model on R1's deterministic schema/JSON checks                                                                                                                                                                     |

**Stack grounding tools (current session):**

- Docs: Context7 — available; will ground Vitest / Supabase test-client setup at Phase 1; checked: 2026-06-03
- Search: Exa.ai — available; will verify current tool status/versions at Phase 1; checked: 2026-06-03
- Runtime/browser: Playwright MCP — not available in current session; e2e deferred regardless (checked: 2026-06-03)
- Provider/platform: Supabase / Cloudflare — not exposed as MCP; local config only (`supabase/`, `wrangler.jsonc`). GitHub/Linear available but not used as a gate (checked: 2026-06-03)

Use docs MCPs for current framework/library APIs and setup details. Use
search MCPs for discovery or current status only, then prefer official docs
as the evidence. Do not use MCP docs/search to infer code failure anchors;
those belong in per-phase `/10x-research`.

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                               | Where                | Required?                                           | Catches                                                                      |
| ---------------------------------- | -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| lint + typecheck                   | local + CI           | required                                            | syntactic / type drift                                                       |
| unit + integration                 | local + CI           | required after §3 Phase 1                           | logic regressions in generation, isolation, deck, review                     |
| e2e on critical flows              | CI on PR             | planned (deferred — see §4)                         | broken critical user paths                                                   |
| post-edit hook                     | local (agent loop)   | recommended (configured in a later Module 3 lesson) | regressions at edit time                                                     |
| CI gate runs on the working branch | CI                   | required after §3 Phase 5                           | the current gap: CI triggers on `master`, branch is `main`, so nothing gates |
| pre-prod smoke                     | between merge + prod | optional                                            | environment-specific failures on Cloudflare                                  |

Every row corresponds to a gate that either is wired or will be wired by a
named rollout phase. Lint + typecheck already run locally (`npm run lint`,
`npm run build`); they are not yet enforced in CI because CI does not run on
`main` — Phase 5 closes that.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location & naming**: colocate `*.test.ts` next to the source it covers (e.g. `src/lib/openrouter.test.ts` sits beside `src/lib/openrouter.ts`). Globals are on (`globals: true`), so `describe`/`it`/`expect`/`vi` need no import; import the unit under test via the `@/*` alias.
- **Reference test**: `src/lib/openrouter.test.ts` — the R1 parse/validate boundary.
- **Run**: `npm test` (single run, `vitest run`) or `npm run test:watch` (watch mode).
- **Mock only the external edge**: stub global `fetch` with `vi.stubGlobal('fetch', vi.fn().mockResolvedValue(…))` (or `.mockRejectedValue(…)`). Pure functions that take their dependencies as args (like `generateCandidateCards(source, { apiKey, model })`) need no module mocking. `test/setup.ts` already registers an `afterEach` that runs `vi.unstubAllGlobals()` + `vi.restoreAllMocks()`.
- **Edge-shape gotcha**: to hit a branch that keys on a specific error type, reject with that exact type — e.g. the timeout path keys on `DOMException(…, "AbortError")`, so a plain `Error` falls through. Match the real discriminant.
- **Oracle discipline (R1)**: every fixture is hand-authored with a known-good/known-bad shape. Never assert a value lifted from the function under test itself.
- **Characterisation + gap markers**: to pin current behavior while flagging a known weakness, write an `it.fails(…)` test asserting the _desired stricter_ behavior with a `TODO(R1):` label. It stays expected-fail (suite green, gap visible) and flips to a real failure the day the code is tightened — signalling "remove the marker." See the `extractCards gap markers` block in the reference test.

### 6.2 Adding an integration test

**Mocking policy (fixed at Phase 1 — durable):**

- **Default**: mock only the external HTTP edge. Stub global `fetch` (`vi.stubGlobal('fetch', …)`) for outbound provider calls (OpenRouter); prefer mocking Supabase REST at the `fetch` edge where feasible.
- **One sanctioned internal exception**: `vi.mock('@/lib/supabase')` for the DB-client _factory_, and only to assert the exact write payload. Emulating PostgREST responses through `fetch` would be brittle and low-signal; a fake client whose `.from().insert().select()` records its argument lets us pin the server-authoritative insert (the R5 claim) directly. Do not extend this exception to other internal modules.

**Recipe (reference test: `src/pages/api/generations.test.ts`):**

- **Drive the route directly**: import the exported `POST` and call it with a hand-built Astro context — `{ request: new Request('http://test/api/generations', { method:'POST', headers, body }), locals: { user: { id: 'u1' }, isReadOnly: false }, cookies: {} }` cast `as unknown as APIContext`. `locals.isReadOnly` must be present — `readOnlyGuard` reads it; `locals.user` null exercises the 401.
- **`astro:env/server` gotcha**: `getViteConfig()` inlines the real `.env` into `astro:env/server` at config-load time, so `vi.stubEnv` / `process.env` do **not** control values an endpoint reads from `astro:env/server`. Mock the virtual module instead — `vi.mock('astro:env/server', () => ({ get OPENROUTER_API_KEY() { return state.X } , … }))` with getters over a mutable `state` object — then flip a field per-test (e.g. empty `OPENROUTER_API_KEY` for the 503 unconfigured path). Reset the state in `beforeEach`.
- **Fresh module per test**: call `vi.resetModules()` then re-`import` the route and the mocked factory inside a `loadRoute()` helper, so the endpoint's top-level `astro:env/server` bindings reflect the current state and each test gets a clean `createClient` mock. `vi.mock(...)` registrations survive `resetModules`.
- **Assert request → response AND side-effect**: check the HTTP status + error code, and assert the recorded insert payload (forged `user_id`/`status`/`id` must never reach the write; `user_id` is `locals.user.id`, `status` is hardcoded `'draft'`). This side-effect assertion is the dominant high-value shape here.
- Two-user isolation fixtures (R2) land in §3 Phase 2 and will extend this recipe; the per-user resource-denial pattern is captured in §6.4 when that phase ships.

### 6.3 Adding a test for a new API endpoint

The dominant shape: assert request → response **and** side-effect (rows written, ownership scoping). Pick the layer by what gives real signal — do not default to real-DB.

- **Hermetic (default `npm test`)** — when the rule is guard wiring or payload authority (does the route call `readOnlyGuard`? does it build `user_id`/`status` server-side, ignoring the body?). Follow §6.2: drive the exported handler directly with a hand-built `APIContext`, `vi.mock('@/lib/supabase')` with a recording fake, assert status + recorded write payload. A fake client is the right tool here — you are pinning _what the route sends_, not what the DB does. References: `src/pages/api/cards.test.ts`, `src/pages/api/reviews.test.ts` (R5 forged-field).
- **Real-DB (opt-in `npm run test:integration`)** — when the rule depends on real RLS, constraints, or cascades that a fake would lie about (cross-user isolation, FK behavior). See §6.4. Name the file `*.integration.test.ts` so the default suite excludes it (`vitest.config.ts` adds `exclude: ['**/*.integration.test.ts']`) and only `vitest.integration.config.ts` runs it.
- **Naming**: colocate `route.integration.test.ts` beside the route for real-DB; `route.test.ts` for hermetic. Both import the handler via the `@/*` alias or a relative path.
- **Deny-contract gotcha**: each endpoint signals "denied" differently — `cards/[id]` PATCH/DELETE return **404 `not_found`** (0-rows branch), `reviews.ts` returns **200 `{ applied: false }`** (`reviews.ts:80`). Pin the endpoint's actual shape; the load-bearing assertion is the **owner's row unchanged**, not the status code.

### 6.4 Adding a cross-user isolation test

Cross-user isolation (R2) is the one rule a fake client cannot prove — a stub would lie about RLS. These tests run against the **real remote DB** (there is no local stack; the project is remote-only) and need the `SUPABASE_SERVICE_ROLE_KEY` to mint test users.

- **Run**: `npm run test:integration` (opt-in). Requires `.env` (git-ignored) with real `SUPABASE_URL` + anon `SUPABASE_KEY` + `SUPABASE_SERVICE_ROLE_KEY`. `test/setup.integration.ts` fails fast with a descriptive message if any is missing. **Never** runs in default `npm test`.
- **Two-user fixture** (`test/integration/two-user-fixture.ts`): `const fx = await setupTwoUsers()` in `beforeAll`, `await fx.teardown()` in `afterAll`. It creates users A & B via the `service_role` admin API (GoTrue blocks public test-domain signup on the anon key), seeds one `saved` card each with a **unique per-run email**, and exposes `fx.a` / `fx.b` as `{ id, email, seededCardId, scopedClient() }`. `scopedClient()` returns a real supabase-js client carrying a `Bearer` access token from `signInWithPassword`, so queries run under that `auth.uid()` and **real RLS applies**. `teardown()` deletes both users; their cards cascade via the `on delete cascade` FK — no residue.
- **Scoped factory mock** (`test/integration/scoped-supabase-mock.ts`): statically import it so its `vi.mock('@/lib/supabase')` registration runs (it must precede the route import), then call `setActingUser(fx.b.scopedClient())` before invoking the handler. The route's `createClient` now returns B's real scoped client — so the route runs end-to-end against real RLS as B. The handle resets `afterEach`. This reuses §6.2's sanctioned factory-mock exception, but the returned client is **real**, not a recording fake.
- **The load-bearing assertion is "owner's row unchanged."** Snapshot A's relevant columns _before_ (via `fx.a.scopedClient()`), drive the foreign write as B against `fx.a.seededCardId`, assert the deny-contract (404 for `cards/[id]`; `applied:false` for `reviews`), then re-read A's columns and `expect(after).toEqual(before)`. Re-reading through A's own client both times makes the equality a true "unchanged" check independent of serialization. The status code is secondary — RLS could deny while still leaking, so the row-equality check is what actually proves isolation.
- **Always pair with a positive control**: B acting on **B's own** card must succeed (`applied:true` / 200 + mutation). Otherwise a test that denies _everything_ (e.g. a broken client) would pass vacuously. Run positive controls last when they mutate/delete the actor's seeded card.
- **Signal check**: dropping or weakening a `cards_*_own` RLS policy on a scratch DB must make the matching deny assertion fail. If it stays green, the test has no signal (the route is bypassing RLS, or the assertion is wrong).
- **References**: `src/pages/api/reviews.integration.test.ts`, `src/pages/api/cards/[id].integration.test.ts`.

### 6.5 Adding a test for the account-deletion sweep predicate

- TBD — see §3 Phase 4 (R4). Will capture how to test the row-selection predicate (due-and-not-cancelled) without invoking the scheduler.

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2–3 line note
here capturing anything surprising the rollout phase taught.)

- **§3 Phase 2 (cross-user isolation + write authorization)**: the project is **remote-only** (no local Supabase stack), so R2 had to run against the live DB behind an opt-in `npm run test:integration` — the secret-free `npm test` stays hermetic and offline. The factory-mock exception (§6.2) was extended to **return a real scoped client** rather than a recording fake, which is what lets a directly-driven route exercise real RLS. Each endpoint denies differently (`cards/[id]` → 404, `reviews` → `applied:false`), so the durable assertion is "owner's row unchanged," not the status code.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **UI look-and-feel** (visual / snapshot tests of styling and layout) — brittle, catch nothing of value here. Re-evaluate only if a visual regression actually ships. (Source: Phase 2 interview Q5.)
- **Testing configuration itself** (config files, env wiring) — low signal, high churn. (Source: Phase 2 interview Q5.)
- **Infrastructure plumbing** (whether pg*cron fires, whether Cloudflare deploys) — we test the \_predicate* the sweep uses, not the mechanism. Re-evaluate if the deletion sweep moves to a different mechanism. (Source: Phase 2 interview Q5.)
- **Supabase Auth internals** (signup / login / logout flows) — library-provided and already working in production; testing them tests Supabase, not our code. (Source: roadmap Baseline; interview Q5.)
- **Candidate-quality evals** (is a generated card a _good_ flashcard) — the PRD explicitly disclaims candidate correctness ("the user is the authority on what gets memorized"). Deferred per §5. Re-evaluate only if a candidate-quality regression is observed. (Source: PRD Business Logic; interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-03
- Stack versions last verified: 2026-06-03 (Vitest `^3.2.4` pinned; Astro-native `getViteConfig()` path confirmed)
- AI-native tool references last verified: 2026-06-03

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
