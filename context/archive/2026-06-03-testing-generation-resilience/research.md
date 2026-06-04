---
date: 2026-06-03T00:00:00Z
researcher: Rafal S
git_commit: 1f8e7b53b544683890fef3dd11b78130c46f2230
branch: dev
repository: 10xCards
topic: "Test-plan Phase 1 — runner bootstrap + generation resilience (R1 + R5)"
tags: [research, codebase, testing, vitest, generation, openrouter, validation]
status: complete
last_updated: 2026-06-03
last_updated_by: Rafal S
---

# Research: Test-plan Phase 1 — runner bootstrap + generation resilience (R1 + R5)

**Date**: 2026-06-03
**Researcher**: Rafal S
**Git Commit**: 1f8e7b53b544683890fef3dd11b78130c46f2230
**Branch**: dev
**Repository**: 10xCards

## Research Question

For test-plan Phase 1 (`testing-generation-resilience`), ground the live codebase so `/10x-plan` can author tests that:

- **R1** — prove that on malformed / partial / empty / timeout LLM output the pasted source text survives, the user gets a clean retry, and nothing invalid is persisted as a card.
- **R5** — prove the server rejects empty / oversized / ill-typed generation input and ignores client-supplied ownership/status fields, regardless of what the client sends.

Scope (locked with user): **tight to R1 + R5**, plus a **current Vitest + Astro tooling recommendation** since this phase also bootstraps the runner (test base is `none`).

## Summary

The generation slice is **three server endpoints** reached from paste → generate → accept:
`POST /api/generations` (generate), `POST /api/generations/save` (accept/reject), `POST /api/cards` (manual create). All write through the **RLS-respecting anon Supabase client** — there is **no service-role/admin client anywhere in the repo**.

**R1 — the central finding (ground-truth correction):** The provider response is validated by a **hand-rolled type-narrowing function** (`extractCards`, `src/lib/openrouter.ts:130`), not a schema library. That validation is **weaker than the `response_format` JSON schema the request asks for** (`openrouter.ts:20-44`). Concretely:
- No count floor — **one** valid card passes (the prompt asks for 3–10).
- `front`/`back` **length ceilings (500/2000) are NOT re-enforced**; only non-empty-after-trim is checked.
- Bad items are **silently dropped**, so a partial/truncated-but-syntactically-valid list is accepted as success.
- Well-typed-but-garbage candidates are written as drafts **at generation time, before any human review** (`generations.ts:75-82`); the DB has no length ceiling, only `length > 0`.

Hard failure modes (network, timeout, non-200, malformed JSON envelope, missing content, empty list) **are** handled and mapped to clean HTTP codes (504/502); a non-`OpenRouterError` exception falls through to a bare framework 500. Source text **is preserved on failure** (client React state, never cleared on error). There is **no retry and no client-side timeout/abort** anywhere — the only timeout is a single 60 s server-side `AbortController`.

**R5 — well-defended, with one real asymmetry:** `user_id` and `status` are **always server-derived** (`user_id: user.id`, `status: "draft"`/`"saved"` hardcoded), never read from the request body; RLS `with check (auth.uid() = user_id)` is a live second guard. The one genuine parity gap: the **server** bounds the *trimmed* source length 200–8000 (`generations.ts:39-40`), while the **client** enforces max only via `<textarea maxLength>` on the *untrimmed* value (`PasteAndGenerateForm.tsx:111`) — behaviors diverge at the boundary. Tests should assert the **server is authoritative**.

**Runner bootstrap:** zero test deps today. The Astro-native path is `getViteConfig()` from `astro/config` in `vitest.config.ts` (confirmed current via Context7). The R1 parse boundary is a **pure unit** (`generateCandidateCards` takes `apiKey`/`model` via args and uses global `fetch`) — fully testable with `vi.stubGlobal('fetch', …)`, no `astro:env` needed. The endpoints need a hand-built Astro context and a decision on **where to mock** (see Open Questions — this phase *sets* the §6.2 mocking policy, currently "TBD").

## Detailed Findings

### R1 — Generation flow & the parse/validate boundary

**Endpoints / flow**
- `src/pages/api/generations.ts:18` — `POST`. Auth-gate (`:20`) → read-only-account guard (`:24`) → config check (`:27`) → parse JSON body (`:33`) → validate `source` length (`:40`) → call LLM (`:50`) → insert returned cards as `status:"draft"` (`:75-82`) → return `{ drafts }` 200 (`:88`).
- `src/pages/generate.astro:21-31` — SSR page; loads existing drafts and renders `PasteAndGenerateForm` + `DraftReviewList`.
- `src/pages/api/generations/save.ts:33` and `discard.ts:12` are the accept/reject and bulk-discard paths — **not** on the LLM call path (relevant to R3, later phase).

**Provider call** — `src/lib/openrouter.ts:53` `generateCandidateCards`:
- Raw `fetch` (no SDK) to OpenRouter `https://openrouter.ai/api/v1/chat/completions` (`:59`), Bearer auth (`:63`), `signal` from caller (`:55,61`).
- Request body (`:68-75`): `{ model, response_format: { type:"json_schema", json_schema: RESPONSE_SCHEMA }, messages:[system,user] }`. `RESPONSE_SCHEMA` (`:20-44`) declares `cards` 1–10 items, each `{front: 1–500, back: 1–2000}`, `strict:true`.
- Response expected as OpenAI/OpenRouter chat completion; `choices[0].message.content` is a **JSON string** that the code then `JSON.parse`s.

**The parse/validate boundary** (two-stage, hand-rolled — no zod/valibot):

| Failure mode | Handling | Anchor |
|---|---|---|
| fetch throws (network) | `OpenRouterError("openrouter_http_error")` | `openrouter.ts:77-82` |
| Abort / timeout | `AbortError` → `openrouter_timeout` | `openrouter.ts:78-80` |
| Provider non-200 | body truncated 500 chars → `openrouter_http_error` | `openrouter.ts:84-91` |
| HTTP envelope not JSON | `openrouter_parse_error` | `openrouter.ts:94-98` |
| No `choices[0].message.content` string | `openrouter_parse_error` | `openrouter.ts:100-103,120-128` |
| Model `content` not valid JSON | `JSON.parse` throws → `openrouter_parse_error` | `openrouter.ts:105-110` |
| Empty / all-invalid card list | `cards.length === 0` → `openrouter_parse_error` | `openrouter.ts:112-115` |

Endpoint maps these to HTTP (`generations.ts:55-65`): `openrouter_timeout` → **504** `ai_timeout`; `openrouter_parse_error` → **502** `ai_parse_error`; else → **502** `ai_provider_error`. A **non-`OpenRouterError`** is re-thrown (`:65`) → unhandled → **bare 500**. DB insert failure → **500** `db_error` (`:84-85`).

**Unhandled gaps the tests must lock down:**
1. **Semantically partial/truncated lists accepted.** No count floor; one valid card passes; bad items silently dropped — `openrouter.ts:112-117,134-143`.
2. **App validation weaker than the requested schema.** `front`/`back` length ceilings not re-checked; only non-empty-after-trim — `openrouter.ts:130-144`. If the model ignores `strict`, over-length/garbage-but-typed cards pass.
3. **Invalid/garbage candidates persist as drafts before review**; DB CHECK is only `length(front/back) > 0`, no ceiling — `generations.ts:75-82`, migration `20260527150510_cards_and_account_deletion.sql:19-20`.
4. **No retry; no client-side timeout/abort.** Single 60 s server `AbortController` (`generations.ts:9,44-47`); client `fetch` has none (`PasteAndGenerateForm.tsx:54-58`). Elapsed counter (`:86,125-129`) is cosmetic.
5. **Bare-500 path + missing client fallback.** Non-`OpenRouterError` → framework 500 possibly without JSON body; `db_error` absent from client `FALLBACK_MESSAGES` (`PasteAndGenerateForm.tsx:12-20`) — surfaces via server `message`, but a bodyless 500 degrades to generic `"Generation failed."` (`:66,75-78`).

**Source-text preservation (works):** `source` lives in React state (`PasteAndGenerateForm.tsx:23`); every error path sets the error and `setSubmitting(false)` **without clearing `source`** (`:78-82`); textarea only disabled while submitting (`:109`). No server-side echo. Success does `window.location.assign("/generate")` (`:61`).

### R5 — Server-side validation parity (generation slice)

**Verdict: well-defended.** `user_id`/`status` server-derived, anon RLS client, DB CHECK + RLS as second line. One real asymmetry (min/max trim handling), plus trust points worth pinning.

1. **Input validation (generate):** body parsed `generations.ts:31-36` (try/catch → 400 `bad_request`). **No schema library** — hand-rolled. Only `source` validated (`:38-42`): narrows to string (defaults `""`), trims, then length window. Other body fields ignored — never read into a DB write.
2. **Oversized/empty paste — PARITY ASYMMETRY:** server enforces both bounds on the **trimmed** string, `MIN=200`/`MAX=8000` (`generations.ts:7-8,39-40`) → 400 `invalid_source`. Client (`PasteAndGenerateForm.tsx:4-5`) mirrors MIN via `source.trim().length` (`:41,87`) but enforces MAX only through `<textarea maxLength={MAX}>` on **untrimmed** length (`:111`) — no JS max guard in `handleSubmit`. Tests should assert the **server** is authoritative for both bounds on the trimmed value.
3. **`user_id` provenance — server-derived:** from `context.locals.user` set in middleware via `supabase.auth.getUser()` (`src/middleware.ts:10-16`); endpoints 401 if absent (`generations.ts:19-22`, `save.ts:34-37`, `cards.ts:28-31`). Writes set `user_id: user.id` only (`generations.ts:76`, `cards.ts:61`). Body `user_id` never consulted; RLS `cards_insert_own with check (auth.uid()=user_id)` (`20260527150510…sql:42-44`) rejects a mismatch anyway.
4. **`status`/ownership — server-derived:** hardcoded `status:"draft"` (`generations.ts:79`) / `status:"saved"` (`cards.ts:61`); DB CHECK `status in ('draft','saved')` (`…150510…sql:21`) rejects arbitrary values defensively.
5. **Empty front/back:** accept flow sends only **id arrays**, validated by `asStringArray` (`save.ts:22-31,54-60`); promotion happens in `finalize_drafts` RPC which only flips `status` on existing rows (`20260529…162956…sql:21-23`) — no new text written. Manual create enforces non-empty via `asNonEmptyString` (`cards.ts:21-25,50-53` → 400 `invalid_card`). DB CHECK `length > 0` backstops all paths.
6. **Supabase client — anon, RLS-respecting:** `createClient(headers, cookies)` → `createServerClient(SUPABASE_URL, SUPABASE_KEY, …)` (`src/lib/supabase.ts:5-23`), constructed per request (`generations.ts:70`, `save.ts:42`, `cards.ts:36`, `middleware.ts:7`). `SUPABASE_KEY` is the **anon** key (README.md:123). **No service-role client exists in `src/`.** RLS is therefore a live second guard, not bypassed.

**Trust points tests should lock:** (a) trimmed-vs-untrimmed max-length parity; (b) direct-POST with forged `user_id`/`status` body fields are ignored; (c) `/api/cards` rejects whitespace-only front/back with a server 400 (not a DB error); (d) cross-user/stale draft ids in `/save` hit the exact-cover guard (`save.ts:62-83`) → 400 `incomplete_selection`, RPC is a no-op on foreign ids (`security invoker`).

### Runner bootstrap — the reality a Vitest suite must fit

- **`package.json`** (`:5-15` scripts, `:16-57` deps): **no test script, no vitest/jest/playwright/@testing-library**. Node `22.14.0` (`.nvmrc`). `vite` override pinned `^7.3.2` but **no `vite.config.ts`** (Astro owns Vite via `astro.config.mjs`).
- **`astro.config.mjs:1-25`**: integrations `[react(), sitemap()]`, adapter `cloudflare()`, `vite.plugins:[tailwindcss()]`, and an `env.schema` (`:17-24`) declaring `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` — all `context:"server", access:"secret", optional:true`. **Optional means a missing var does not throw at import**; `createClient` returns `null` instead (`supabase.ts:5`).
- **`tsconfig.json:9-11`**: path alias `@/* → ./src/*`. The test runner must honor it.
- **External edges to stub:** (a) OpenRouter via **global `fetch`** in `openrouter.ts:59`; (b) Supabase via `@supabase/ssr` `createServerClient` in `supabase.ts:5-23` (which itself uses `fetch` to PostgREST). Env names: `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, `SUPABASE_URL`/`SUPABASE_KEY`.
- **No existing tests anywhere.** Pure functions that are cheap unit targets: `src/lib/openrouter.ts` (R1 parse boundary), `src/lib/leitner.ts`, `src/lib/account-retention.ts`. Endpoint integration targets live under `src/pages/api/**`.
- **CI** (`.github/workflows/ci.yml:20-21`) runs `lint` + `build` only, and **only on `master`** while the branch is `main` — no live gate (test-plan §3/§5; Phase 5 closes it).

### Tooling recommendation (Context7-grounded, 2026-06-03)

- **Vitest config — use Astro's helper.** `getViteConfig()` from `astro/config` is the documented Astro path; it merges the Astro config into Vitest so the `astro:env` virtual module, the React plugin, Tailwind, and resolution all work in tests. As of Astro 4.8 it takes a second `inlineAstroConfig` arg to customise the test-time Astro config. (Astro docs: *Guides → Testing → Vitest*; `getViteConfig()` reference.)
  ```ts
  // vitest.config.ts
  /// <reference types="vitest/config" />
  import { getViteConfig } from 'astro/config';
  export default getViteConfig({
    test: { environment: 'node', setupFiles: ['./test/setup.ts'] },
  });
  ```
  This also inherits the `@/*` alias via the loaded Astro/Vite config (no separate `test.alias` needed for app code).
- **Versions (confirm exact pin at plan):** Vitest current stable line is **3.2.x**, with **4.0.x/4.1.x** also released. Recommend pinning to the latest 3.x that `getViteConfig()` is exercised against for Astro 6, and verifying the 4.x peer story before jumping. (Context7: `/vitest-dev/vitest` versions `v3_2_4`, `v4.0.7`, `v4.1.6`.)
- **Mock the OpenRouter edge with `vi.stubGlobal('fetch', …)`** — `openrouter.ts` uses global `fetch`, so the R1 boundary is unit-testable with no module mocking and no `astro:env`. `generateCandidateCards` receives `apiKey`/`model` as args, so a unit test calls it directly and asserts the typed-error `.code` for each failure mode. **MSW is not required** for R1's unit layer.
- **For endpoint integration**, import the route's `POST` and invoke it with a hand-built Astro context (`{ request, locals: { user }, cookies }`). The cross-cutting decision is *where* to mock — see Open Questions.
- **`astro:env` values in tests:** the schema marks every var `optional`, so imports won't throw when unset. Where an integration test needs a configured path, set `process.env` before import or `vi.stubEnv`; where it needs the unconfigured path, leave unset and assert the `null`-client / `config_unavailable` branch.

## Code References

- `src/pages/api/generations.ts:18-89` — generate endpoint: auth/guard/config/validation/insert/error-mapping (R1 + R5 focal point)
- `src/lib/openrouter.ts:20-44` — requested `RESPONSE_SCHEMA` (1–10 cards, front 1–500 / back 1–2000, strict)
- `src/lib/openrouter.ts:53-118` — `generateCandidateCards`: fetch + typed-error mapping (pure unit target)
- `src/lib/openrouter.ts:130-144` — `extractCards`: the hand-rolled validation (weaker than the schema — R1 core)
- `src/components/generate/PasteAndGenerateForm.tsx:4-5,41,87,111` — client min/max checks (max via textarea only — parity gap)
- `src/components/generate/PasteAndGenerateForm.tsx:23,54-58,78-83,12-20` — source state, no client timeout, error path preserves source, fallback messages
- `src/pages/api/generations/save.ts:22-31,54-60,62-83,87-90` — accept/reject validation, exact-cover guard, RPC call
- `src/pages/api/cards.ts:21-25,28-31,50-53,61` — manual create: non-empty + server-derived user_id/status
- `src/lib/supabase.ts:5-23` — anon SSR client factory (no service-role anywhere)
- `src/middleware.ts:7,10-16` — session-derived `locals.user`
- `supabase/migrations/20260527150510_cards_and_account_deletion.sql:19-21,42-53` — DB CHECKs + RLS policies
- `supabase/migrations/20260529…162956…sql:17,21-23` — `finalize_drafts` (security invoker)
- `astro.config.mjs:17-24` — env schema (all optional secrets); `tsconfig.json:9-11` — `@/*` alias
- `package.json:5-57` — no test tooling; `.github/workflows/ci.yml:20-21` — lint+build only, on `master`

## Architecture Insights

- **The R1 boundary is a pure function.** The expensive part of the top risk is unit-testable at the cheapest layer — `extractCards`/`generateCandidateCards` over a stubbed `fetch`. This is exactly the cost×signal win test-plan §1 wants; e2e is not needed for R1.
- **The schema is requested, not enforced.** The app sends `strict` JSON schema to the provider but re-validates more weakly. Tests must treat the provider as adversarial (returns over-length, padded, truncated, garbage-but-typed) rather than trusting the `response_format` contract. Beware the **oracle problem** (test-plan §2 anti-pattern): don't assert expected card values lifted from `extractCards` itself.
- **R5 is mostly already-correct contracts; the tests are regression locks, not bug hunts.** The value is pinning server authority (ignore body `user_id`/`status`, enforce trimmed bounds) so a future refactor can't silently start trusting the client. The one live asymmetry (trim handling) is worth an explicit boundary test.
- **RLS is a real second guard here** because every write uses the anon client. A test that exercises only RLS while the endpoint quietly used an admin client would be a trap — but there is no admin client, so endpoint-level integration tests genuinely cover the write path. (Cross-user RLS proof itself is Phase 2.)
- **`getViteConfig()` neutralises the "`astro:env` isn't injectable in tests" worry** flagged during bootstrap mapping — loading the Astro config makes the virtual module resolve; only the *values* need test-time wiring.

## Historical Context (from prior changes)

- `context/archive/2026-05-27-first-gated-generation/plan.md` — S-01 designed the generate endpoint: 200–8000 source validation, `user_id` from `locals.user`, hardcoded `status:'draft'`, SSR (not service-role) client "so even a buggy `user_id` is blocked by RLS", typed `OpenRouterError` codes, **no automatic retry** (explicit user re-click only, cost discipline), and "clamp past 10 / reject empty array" as defense-in-depth. **Reconciliation:** live `extractCards` rejects empty and slices to 10, but does **not** re-enforce per-field length or a count floor — the live boundary is weaker than the plan's prose implied. Live code is ground truth.
- `context/archive/2026-05-29-atomic-save-to-deck/plan.md` — S-02 added `/save` completeness guard (fetch current drafts; `accept`/`reject` must be disjoint and exactly cover; 400 `incomplete_selection` before any RPC) and the idempotent `finalize_drafts` RPC. Relevant to R5's "ignore crafted bodies"; the atomicity itself is R3 (Phase 3).
- `context/archive/2026-05-27-cards-schema-and-rls/plan.md` — F-01 schema + RLS: `front/back length > 0`, `status in ('draft','saved')`, `cards_insert_own with check (auth.uid()=user_id)`, and the explicit note that **service-role JWTs bypass RLS — keep them out of user-input paths** (honored: none exist).

## Related Research

- `context/foundation/test-plan.md` §2 (R1/R5 risk rows + Risk Response Guidance), §4 (stack — Vitest TBD, "mock only the external HTTP edge"), §6.2 (mocking policy "TBD — fixed at Phase 1").
- No prior `research.md` exists for this change; this is the first.

## Open Questions

1. **Mocking boundary — this phase *sets* test-plan §6.2 (currently "TBD").** §6.2 says *mock only the external HTTP edge (LLM provider, Supabase REST), never internal modules.* Honoring that literally for endpoint integration means stubbing **global `fetch`** for both OpenRouter and Supabase/PostgREST — clean for OpenRouter, but emulating PostgREST responses for the Supabase write is more involved/brittle. The pragmatic alternative is `vi.mock('@/lib/supabase')` to return a fake client and assert the insert payload — but that mocks an internal module, against the stated policy. **Decision for `/10x-plan`:** stub `fetch` end-to-end (policy-pure, higher fixture cost) vs. mock the `supabase.ts` factory (cheaper, a documented exception). R1's unit layer is unaffected either way (it only needs `fetch`).
2. **R1 "invalid candidate" definition for assertions.** Tests need an oracle independent of `extractCards`. Should the plan treat the *requested* `RESPONSE_SCHEMA` (front ≤500, back ≤2000, ≥… items) as the spec the validator *ought* to meet — turning gaps #1/#2 into either (a) failing tests that document desired behavior, or (b) tests that pin current behavior with a `TODO`? This is a product call: does Phase 1 also *tighten* `extractCards`, or only *characterise* it?
3. **Vitest 3.x vs 4.x pin** against Astro 6's `getViteConfig()` — confirm the peer/compat story at plan time before pinning `package.json`.
4. **`test` script + colocation vs `test/` dir.** AGENTS.md says colocate `*.test.ts` and add the command to `package.json`; confirm the run command (`"test": "vitest"`/`"vitest run"`) and whether a `test/setup.ts` is introduced for env/global stubs.
