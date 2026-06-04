# Runner Bootstrap + Generation Resilience (R1 + R5) — Plan Brief

> Full plan: `context/changes/testing-generation-resilience/plan.md`
> Research: `context/changes/testing-generation-resilience/research.md`

## What & Why

Stand up the project's first test runner (test base is `none`) and write the first unit + integration tests covering the top two generation-slice risks from the test plan: **R1** — bad LLM output (malformed / partial / empty / timeout) must never break the flow or persist garbage as a card; **R5** — the server must reject hostile generation input and ignore client-supplied ownership/status, whatever the client sends. This is Phase 1 of the test-plan rollout, and it also bootstraps the runner every later phase depends on.

## Starting Point

Zero test tooling exists. The R1 parse boundary (`src/lib/openrouter.ts`) is a pure function over global `fetch` — cheaply unit-testable — but its validator (`extractCards`) is weaker than the JSON schema it requests (no card-count floor, no length-ceiling re-check, silent drops), and the endpoint persists those candidates as drafts before review. R5 is already well-defended (server-derived `user_id`/`status`, anon RLS client, trimmed source bounds) — so its tests are regression locks, not bug hunts.

## Desired End State

`npm test` runs a green Vitest suite that locks the R1 typed-error contract (unit) and the endpoint's error→HTTP mapping + server-authoritative write payload (integration), pins R5 server authority for `POST /api/generations`, and surfaces the known validator gaps as visible RED/skip markers. The test plan's §4 stack table and §6.1/§6.2 cookbook are filled in.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Validator gaps (R1) | Characterise now, tighten later | Keep this a pure testing phase; mark gaps as regression-protected RED/skip TODOs rather than shipping a behavior change | Plan |
| Integration mock edge (§6.2) | Mock `@/lib/supabase` factory + stub `fetch` for OpenRouter | Cheap, stable, and lets us assert the exact insert payload (the R5 claim); PostgREST fixtures would be brittle | Plan |
| Client-layer R1 coverage | Server + unit only | Matches §2 Risk Response Guidance; avoids pulling jsdom/RTL into the bootstrap | Plan |
| Test layout & scripts | Colocate `*.test.ts`; shared `test/setup.ts`; `test`=`vitest run`, `test:watch`=`vitest` | Follows AGENTS.md colocation guidance; CI-friendly default | Plan |
| R5 scope | `POST /api/generations` only | True to the change's generation-slice scope; no overlap with Phase 2 (isolation) / Phase 3 (atomic save) | Plan |
| Vitest version | Pin `^3.2.4`, `environment: 'node'` | Astro 6's `getViteConfig()` requires Vitest ≥3.2; 4.x is still beta-gated for the helper | Research / Context7 |

## Scope

**In scope:** Vitest bootstrap (config, setup, scripts, smoke test); R1 unit tests for the parse/validate boundary; R1+R5 integration tests for `POST /api/generations`; test-plan §4/§6.1/§6.2 updates.

**Out of scope:** any `extractCards` behavior change; React/client component tests (jsdom, RTL); `/api/cards` and `/save` (Phases 2/3); cross-user isolation (Phase 2); CI wiring (Phase 5); e2e; MSW.

## Architecture / Approach

Vitest via Astro's `getViteConfig()` (Node env) so `@/*` and `astro:env` resolve. Two mocking styles, fixed as policy: OpenRouter is stubbed via `vi.stubGlobal('fetch', …)` at both layers; the Supabase write is mocked via `vi.mock('@/lib/supabase')` — the one sanctioned internal-module exception, scoped to asserting the insert payload. Endpoint tests import `POST` and invoke a hand-built Astro context (`{ request, locals:{ user, isReadOnly }, cookies }`). Oracle discipline: fixtures are hand-authored, never lifted from the validator.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Runner bootstrap | Green `npm test` with Vitest + Astro config + smoke test | `getViteConfig()`/Vitest peer mismatch (mitigated: pin 3.2.4) |
| 2. R1 unit | All typed-error paths + validator characterisation/gap markers | Oracle problem — asserting parser's own output |
| 3. R1+R5 integration | Endpoint error→HTTP mapping + server-authoritative insert payload | Mocked DB factory hiding real wiring drift |
| 4. Cookbook + stack | §4/§6.1/§6.2 filled in; mocking policy fixed | Recipes too vague to follow |

**Prerequisites:** none beyond the existing repo; `npm install` to add Vitest.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- The mocked supabase factory means integration tests don't exercise the real PostgREST wiring; acceptable because no service-role client exists and Phase 2 adds real two-user fixtures.
- RED/skip gap markers depend on a later phase actually tightening `extractCards`; until then the R1 persistence gap remains documented-but-live.
- Assumes Node 22's global `DOMException` is available for the `AbortError` unit case (it is on `.nvmrc`'s 22.14.0).

## Success Criteria (Summary)

- `npm test` is green (RED markers visible as skipped/expected-fail), `npm run lint` and `npm run build` pass.
- The R5 insert-payload test fails if the endpoint is changed to trust body `user_id`/`status`.
- A contributor can add a new unit or endpoint test by following §6.1/§6.2 without re-deriving the decisions.
