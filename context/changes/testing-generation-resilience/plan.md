# Runner Bootstrap + Generation Resilience (R1 + R5) Implementation Plan

## Overview

Stand up the project's first test runner (test base is `none` today) and write the first unit + integration tests covering the top two generation-slice risks from `context/foundation/test-plan.md`:

- **R1** — on malformed / partial / empty / timeout LLM output, the pasted source survives, the user gets a clean retry, and nothing invalid is persisted as a card.
- **R5** — the server rejects empty / oversized / ill-typed generation input and ignores client-supplied ownership/status fields, regardless of what the client sends.

This phase also **fixes the durable §6.2 mocking policy** and fills in the §4 stack table and §6.1/§6.2 cookbook recipes. It is a **pure testing phase**: the weak validator is *characterised* (pinned with tests + RED/skip markers for the gaps), not changed.

## Current State Analysis

- **Zero test tooling.** `package.json:5-15` has no test script; no vitest/jest/playwright/@testing-library in deps. Node `22.14.0` (`.nvmrc`). `vite` is pinned via `overrides` to `^7.3.2`; Astro 6 owns Vite through `astro.config.mjs` (no standalone `vite.config.ts`).
- **The R1 parse boundary is a pure function over global `fetch`.** `generateCandidateCards` (`src/lib/openrouter.ts:53`) takes `apiKey`/`model` as args and calls global `fetch` — unit-testable with `vi.stubGlobal('fetch', …)`, no `astro:env`, no module mocking.
- **The validator is weaker than the schema it requests.** `extractCards` (`src/lib/openrouter.ts:130-144`) only checks non-empty-after-trim: no count floor (1 card passes; prompt asks 3–10 / schema floor is `minItems:1`), front≤500/back≤2000 ceilings not re-enforced, bad items silently dropped. The endpoint inserts these as `status:"draft"` before any review (`generations.ts:75-82`).
- **The 7 hard-failure modes are handled** and mapped to clean HTTP codes (`generations.ts:55-65`): `openrouter_timeout`→504, `openrouter_parse_error`→502 `ai_parse_error`, other `OpenRouterError`→502 `ai_provider_error`; a non-`OpenRouterError` re-throws → bare framework 500; DB insert error → 500 `db_error`; missing config → 503; bad JSON body → 400; out-of-range source → 400.
- **R5 is well-defended.** `user_id: user.id` and `status: "draft"` are hardcoded server-side (`generations.ts:76,79`); body fields other than `source` are never read into the write. The anon RLS Supabase client is the only client (no service-role anywhere). Source bounds 200–8000 are enforced on the **trimmed** value (`generations.ts:39-40`).
- **Astro-native Vitest path confirmed (Context7, 2026-06-03):** `getViteConfig()` from `astro/config` merges the Astro config so `@/*`, `astro:env`, React plugin, and Tailwind resolve in tests. **Astro 6's `getViteConfig()` requires Vitest `v3.2` or `v4.1-beta.5`** — so 4.x is still beta-gated for the helper. Pin Vitest `^3.2.4` (current stable 3.2 line). Astro 6 upgrade guidance: use `environment: 'node'`.
- **No CI gate today.** `.github/workflows/ci.yml` triggers on `master` only while the branch is `main` (AGENTS.md tripwire). Wiring CI is **Phase 5**, out of scope here.

### Key Discoveries:

- `generateCandidateCards` signature is test-friendly: `(sourceText, { apiKey, model, signal })` over global `fetch` — `src/lib/openrouter.ts:53-56`.
- `extractCards` is the R1 core weakness — `src/lib/openrouter.ts:130-144`.
- Endpoint error→HTTP mapping is the R1 integration contract — `src/pages/api/generations.ts:55-68`.
- Write payload is server-authoritative — `src/pages/api/generations.ts:75-82` (`user_id`/`status` hardcoded).
- `createClient` returns `null` when unconfigured (`src/lib/supabase.ts:5-8`); the endpoint maps that to 503 `supabase_unconfigured` (`generations.ts:71-73`).
- `readOnlyGuard(locals)` returns a 403 `Response` when `locals.isReadOnly`, else `null` — `src/lib/account-retention.ts:5-19`. The hand-built Astro context must set `locals.isReadOnly`.

## Desired End State

`npm test` runs a green Vitest suite (with a small number of deliberately-skipped RED gap markers) that:

- locks every typed-error path of the R1 parse boundary at the unit layer;
- locks the endpoint's error→HTTP mapping and the server-authoritative write payload at the integration layer;
- pins R5 server authority for `POST /api/generations` (forged `user_id`/`status` ignored; source bounds enforced on the trimmed value; non-JSON / ill-typed rejected);
- documents the known R1 validator gaps as visible, regression-protected RED/skip markers rather than silent absences.

`context/foundation/test-plan.md` §4, §6.1, §6.2 are filled in (no longer "TBD"). Verify by running `npm test`, `npm run lint`, `npm run build`, and reading the updated cookbook.

## What We're NOT Doing

- **Not changing `extractCards` or any runtime behavior.** No count floor, no length-ceiling enforcement added. Gaps are characterised + RED-marked only (decision: characterise now, tighten later).
- **No React component / client tests.** No jsdom, no `@testing-library/react`. R1 client claims ("source survives", "clean retry") are covered-by-design (source never cleared on error — `PasteAndGenerateForm.tsx:78-83`) and noted, not asserted.
- **R5 scope limited to `POST /api/generations`.** `/api/cards` whitespace-reject and `/save` body-trust belong to their own phases.
- **No cross-user isolation tests** (Phase 2), **no atomic-save / review tests** (Phase 3), **no sweep-predicate tests** (Phase 4), **no CI wiring** (Phase 5).
- **No e2e, no MSW.** Global `fetch` stub + a mocked supabase factory are sufficient for this slice.
- **Not benchmarking models or testing candidate quality** (§7 negative space).

## Implementation Approach

Four sequential phases, each independently verifiable. Phase 1 proves the runner is green before any real test is written. Phases 2–3 add the unit then integration layers. Phase 4 captures the durable cookbook + stack entries so future phases inherit the conventions.

**Mocking policy fixed this phase (sets §6.2):**
- OpenRouter edge → `vi.stubGlobal('fetch', …)` at both unit and integration layers.
- Supabase write → `vi.mock('@/lib/supabase')` returning a fake client whose `.insert(...).select(...)` is observable. This is the **one sanctioned exception** to "never mock internal modules", scoped strictly to the DB-client factory, because emulating PostgREST responses through `fetch` would be brittle and low-signal. The fake lets us assert the exact insert payload — which is precisely the R5 server-authority claim.

**Oracle discipline (R1 anti-pattern):** assertions use independent, hand-authored fixtures with known-bad shapes; never values lifted from `extractCards` itself.

## Critical Implementation Details

- **Vitest version is load-bearing.** Astro 6's `getViteConfig()` requires Vitest `v3.2` (or `v4.1-beta.5`). Pin `^3.2.4`; do not jump to 4.x — the helper is not on the stable 4.x peer story yet.
- **`astro:env` values in tests.** The env schema marks every var `optional`, so imports do not throw when unset (`astro.config.mjs:17-24`). For the configured path, set the four vars (`OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`SUPABASE_URL`/`SUPABASE_KEY`) via `vi.stubEnv` / `process.env` in `test/setup.ts` or per-test; for the unconfigured-path assertions (503), leave them unset.
- **`AbortError` shape.** The timeout branch keys on `err instanceof DOMException && err.name === "AbortError"` (`openrouter.ts:78`). The unit test must reject `fetch` with a `DOMException("…","AbortError")` (Node 22 has `DOMException` global), not a plain `Error`, to hit `openrouter_timeout`.
- **Hand-built Astro context for the endpoint.** Import `POST` from the route and invoke with `{ request: new Request(url, { method:"POST", body, headers }), locals: { user: { id }, isReadOnly: false }, cookies }`. `locals.isReadOnly` must be present (read by `readOnlyGuard`).

## Phase 1: Runner Bootstrap

### Overview

Install Vitest, wire the Astro-native config and an env setup file, add run scripts, and prove the runner is green with one trivial smoke test — before any real test exists.

### Changes Required:

#### 1. Test dependencies

**File**: `package.json`

**Intent**: Add Vitest as the unit+integration runner, pinned to the line Astro 6's `getViteConfig()` supports.

**Contract**: Add `vitest` `^3.2.4` to `devDependencies`. Add scripts: `"test": "vitest run"` and `"test:watch": "vitest"`. No other test libs (no jsdom / RTL / MSW). Re-run `npm install` to update the lockfile.

#### 2. Vitest config

**File**: `vitest.config.ts` (new, repo root)

**Intent**: Merge the Astro config into Vitest so `@/*`, `astro:env`, and plugins resolve; run in the Node environment.

**Contract**: Default-export `getViteConfig({ test: { environment: 'node', setupFiles: ['./test/setup.ts'], globals: true } })` from `astro/config`, with the `/// <reference types="vitest/config" />` triple-slash directive at the top. (`globals: true` so `describe`/`it`/`expect`/`vi` need no per-file import; consistent with a fresh suite.)

#### 3. Test setup / env wiring

**File**: `test/setup.ts` (new)

**Intent**: Provide a single place to stub the four optional `astro:env` server vars to known test values for configured-path tests, and to reset stubs between tests.

**Contract**: Set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SUPABASE_URL`, `SUPABASE_KEY` to dummy values (via `vi.stubEnv`), and register an `afterEach(() => vi.unstubAllGlobals())` / `vi.restoreAllMocks()` reset. Tests that need the *unconfigured* path override locally.

#### 4. Smoke test

**File**: `test/smoke.test.ts` (new)

**Intent**: Prove the runner executes and resolves the `@/*` alias before real tests land.

**Contract**: A trivial `expect(true).toBe(true)` plus one assertion importing a pure helper via the `@/` alias (e.g. `import { OpenRouterError } from '@/lib/openrouter'`) to confirm alias resolution. Removed or kept as a sanity test at author's discretion; if kept, it stays trivial.

#### 5. Tooling ignores / lint

**File**: `eslint` config + `.prettierignore` (only if needed)

**Intent**: Ensure the new test files lint cleanly and coverage/output dirs (if any) are ignored.

**Contract**: Confirm `eslint .` includes `*.test.ts` without error (the strict type-checked config should accept them via tsconfig include). Add a Vitest globals type reference if the type-checked lint complains about `describe`/`vi`. No new ESLint plugin required for this phase.

### Success Criteria:

#### Automated Verification:

- [ ] Dependencies install cleanly: `npm install`
- [ ] Test runner executes and smoke test passes: `npm test`
- [ ] Linting passes on new files: `npm run lint`
- [ ] Build still passes: `npm run build`

#### Manual Verification:

- [ ] `npm run test:watch` starts watch mode and re-runs on file change
- [ ] `vitest.config.ts` resolves the `@/*` alias (smoke import works) and uses the `node` environment

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: R1 Unit — Parse/Validate Boundary

### Overview

Lock every typed-error path of `generateCandidateCards` and characterise the `extractCards` weaknesses, stubbing only global `fetch`.

### Changes Required:

#### 1. Provider parse-boundary unit tests

**File**: `src/lib/openrouter.test.ts` (new, colocated)

**Intent**: Assert the typed-error contract for each documented failure mode, and pin `extractCards` behavior (including its known gaps) using independent fixtures.

**Contract**: Call `generateCandidateCards(source, { apiKey, model, signal })` with `vi.stubGlobal('fetch', …)`. Assert `OpenRouterError.code` for:
- network throw → `openrouter_http_error`;
- abort (reject with `DOMException(…, "AbortError")`) → `openrouter_timeout`;
- non-200 response → `openrouter_http_error` (and `detail` truncated to ≤500 chars);
- HTTP body not JSON → `openrouter_parse_error`;
- missing `choices[0].message.content` string → `openrouter_parse_error`;
- model `content` not valid JSON → `openrouter_parse_error`;
- empty / all-invalid card list → `openrouter_parse_error`.

Happy path: a well-formed 3-card response returns 3 trimmed cards; an >10-card response is sliced to 10.

**Characterisation (green — pins current behavior):** one valid card passes (no floor); a list with some malformed items returns only the valid ones (silent drop); leading/trailing whitespace is trimmed.

**Gap markers (RED — `test.fails` or `it.skip` with a `TODO(R1):` comment, no behavior change):**
- a single-card response *should* be rejected against the 3-card prompt floor (currently passes);
- a front >500 / back >2000 response *should* be rejected against the requested schema ceiling (currently passes).
Each RED marker names the gap and links to "tighten later".

### Success Criteria:

#### Automated Verification:

- [ ] Unit tests pass (RED markers skipped/expected-fail, not erroring): `npm test`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:

- [ ] Each typed-error case maps to the code documented in research §"parse/validate boundary"
- [ ] Gap markers are clearly labelled `TODO(R1)` and visible in test output as skipped/expected-fail
- [ ] No assertion uses a value produced by `extractCards` itself (oracle discipline)

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: R1 + R5 Integration — POST /api/generations

### Overview

Drive the endpoint with a hand-built Astro context, stubbing OpenRouter via `fetch` and mocking the `@/lib/supabase` factory, to lock the error→HTTP mapping (R1) and server authority over the write payload and input (R5).

### Changes Required:

#### 1. Generation endpoint integration tests

**File**: `src/pages/api/generations.test.ts` (new, colocated)

**Intent**: Assert the full request→response→side-effect contract of `POST /api/generations` for the success path, every error path, and the R5 trust points.

**Contract**: `vi.mock('@/lib/supabase')` to return a fake client whose `from().insert().select()` resolves `{ data, error }` and records the insert payload; `vi.stubGlobal('fetch', …)` for the OpenRouter call. Import `POST` and invoke with `{ request: new Request('http://test/api/generations', { method:'POST', headers:{'Content-Type':'application/json'}, body }), locals: { user: { id: 'u1' }, isReadOnly: false }, cookies: fakeCookies }`.

Assert HTTP/error mapping:
- no `locals.user` → 401 `unauthorized`;
- `locals.isReadOnly` true → 403 `account_read_only`;
- env unconfigured (OpenRouter vars unset) → 503 `ai_unconfigured`;
- non-JSON body → 400 `bad_request`;
- source <200 or >8000 (on the **trimmed** value) → 400 `invalid_source`; assert a string that is >8000 untrimmed but ≤8000 trimmed, and one ≥200 untrimmed but <200 trimmed, to pin trim authority;
- provider timeout → 504 `ai_timeout`; provider parse error → 502 `ai_parse_error`; other `OpenRouterError` → 502 `ai_provider_error`;
- supabase factory returns `null` → 503 `supabase_unconfigured`;
- insert `{ error }` → 500 `db_error`;
- happy path → 200 `{ drafts }`.

Assert R5 server authority (the high-value locks):
- a body carrying forged `user_id`, `status`, `id`, `created_at` is accepted but the **recorded insert payload** uses `user_id: 'u1'` and `status: 'draft'` only — forged fields never reach the DB;
- the insert payload `front`/`back` are the trimmed candidate values from the (stubbed) provider.

**Characterisation note (R1 persistence gap):** a stubbed provider response of one valid card, or a typed-but-over-length card, results in a 200 with that draft inserted — documenting that invalid-but-typed candidates persist before review. Mark with a `TODO(R1)` comment tying it to the Phase 2 gap markers.

### Success Criteria:

#### Automated Verification:

- [ ] Integration tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Build passes: `npm run build`

#### Manual Verification:

- [ ] The recorded insert payload assertion fails if someone changes the endpoint to read `user_id`/`status` from the body (verified by a quick local tweak-and-revert)
- [ ] Trim-authority boundary cases (untrimmed vs trimmed length) behave as asserted
- [ ] The `@/lib/supabase` mock is the only internal module mocked; OpenRouter is mocked via global `fetch`

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Cookbook + Stack Wiring

### Overview

Capture the conventions established by Phases 1–3 in the durable test plan so future rollout phases inherit them.

### Changes Required:

#### 1. Stack table

**File**: `context/foundation/test-plan.md` (§4)

**Intent**: Replace the "TBD" Vitest/version and mocking rows with the resolved decisions.

**Contract**: §4 row "unit + integration" → Vitest, version `^3.2.4`, note "Astro-native via `getViteConfig()`, Node env; `getViteConfig()` requires Vitest ≥3.2 (Astro 6)". §4 row "API / provider mocking" → "global `fetch` stub for OpenRouter; `vi.mock('@/lib/supabase')` for the DB write (sanctioned internal exception, see §6.2)". Update the `> Last updated` header line and §8 freshness ledger date.

#### 2. Unit cookbook recipe

**File**: `context/foundation/test-plan.md` (§6.1)

**Intent**: Replace the placeholder with the concrete recipe.

**Contract**: §6.1 captures: location (colocate `*.test.ts` next to source), naming, reference test (`src/lib/openrouter.test.ts`), run command (`npm test` / `npm run test:watch`), and the `vi.stubGlobal('fetch', …)` pattern with oracle-discipline note.

#### 3. Integration cookbook recipe + mocking policy

**File**: `context/foundation/test-plan.md` (§6.2)

**Intent**: Fix the previously-"TBD" mocking policy and give the endpoint-test recipe.

**Contract**: §6.2 states the policy: mock only the external HTTP edge via global `fetch` (OpenRouter, and Supabase REST where feasible); the **one sanctioned internal exception** is `vi.mock('@/lib/supabase')` for the DB-client factory, scoped to asserting write payloads. Reference test: `src/pages/api/generations.test.ts`. Capture the hand-built Astro context pattern (`{ request, locals:{ user, isReadOnly }, cookies }`).

### Success Criteria:

#### Automated Verification:

- [ ] Test plan still well-formed (no remaining "TBD — see §3 Phase 1" in §4/§6.1/§6.2): grep returns no Phase-1 TBDs
- [ ] Full suite still green: `npm test`

#### Manual Verification:

- [ ] §4 / §6.1 / §6.2 read as actionable recipes a future contributor can follow without re-deriving the decisions
- [ ] §6.2 mocking exception is explicit and scoped (DB factory only)

**Implementation Note**: After this phase, re-run `/10x-test-plan` (no args) so the orchestrator marks §3 Phase 1 `complete` and presents the next handoff.

---

## Testing Strategy

### Unit Tests:

- The R1 parse/validate boundary in `src/lib/openrouter.ts`: all 7 typed-error modes, the slice-to-10 and trim behavior, and `extractCards` characterisation + gap markers.
- Edge cases: `AbortError` shape, non-200 with `detail` truncation, empty/all-invalid list.

### Integration Tests:

- `POST /api/generations` end-to-end with stubbed provider + mocked DB factory: auth/read-only/config gates, source validation (trimmed bounds), provider error mapping (504/502), DB error/unconfigured (500/503), happy 200, and the R5 server-authoritative insert payload.

### Manual Testing Steps:

1. `npm test` — full suite green (RED markers shown as skipped/expected-fail).
2. Locally tweak the endpoint to read `user_id` from the body, run the R5 test, confirm it fails; revert.
3. Read §6.1/§6.2 of the test plan and confirm a contributor could add a new test by following them.

## Performance Considerations

None — pure unit/integration suite over stubbed edges; sub-second per file.

## Migration Notes

First introduction of test tooling. No data migration. `npm install` updates the lockfile (re-stage if pre-commit reformats).

## References

- Research: `context/changes/testing-generation-resilience/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 R1/R5, §3 Phase 1, §4, §6.1/§6.2)
- R1 core: `src/lib/openrouter.ts:53-144`; endpoint: `src/pages/api/generations.ts:18-89`
- Supabase factory: `src/lib/supabase.ts:5-24`; read-only guard: `src/lib/account-retention.ts:5-19`
- Tooling (Context7, 2026-06-03): Astro 6 `getViteConfig()` requires Vitest ≥3.2; pin `^3.2.4`, `environment: 'node'`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner Bootstrap

#### Automated

- [x] 1.1 Dependencies install cleanly: `npm install`
- [x] 1.2 Test runner executes and smoke test passes: `npm test`
- [x] 1.3 Linting passes on new files: `npm run lint`
- [x] 1.4 Build still passes: `npm run build`

#### Manual

- [x] 1.5 `npm run test:watch` starts watch mode and re-runs on change
- [x] 1.6 `vitest.config.ts` resolves `@/*` and uses the `node` environment

### Phase 2: R1 Unit — Parse/Validate Boundary

#### Automated

- [ ] 2.1 Unit tests pass (RED markers skipped/expected-fail): `npm test`
- [ ] 2.2 Linting passes: `npm run lint`

#### Manual

- [ ] 2.3 Each typed-error case maps to the documented code
- [ ] 2.4 Gap markers labelled `TODO(R1)`, visible as skipped/expected-fail
- [ ] 2.5 No assertion uses a value produced by `extractCards` (oracle discipline)

### Phase 3: R1 + R5 Integration — POST /api/generations

#### Automated

- [ ] 3.1 Integration tests pass: `npm test`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Insert-payload assertion fails if endpoint reads `user_id`/`status` from body (tweak-and-revert)
- [ ] 3.5 Trim-authority boundary cases behave as asserted
- [ ] 3.6 `@/lib/supabase` is the only internal module mocked; OpenRouter via global `fetch`

### Phase 4: Cookbook + Stack Wiring

#### Automated

- [ ] 4.1 No remaining "TBD — see §3 Phase 1" in §4/§6.1/§6.2
- [ ] 4.2 Full suite still green: `npm test`

#### Manual

- [ ] 4.3 §4/§6.1/§6.2 read as actionable recipes
- [ ] 4.4 §6.2 mocking exception is explicit and scoped (DB factory only)
