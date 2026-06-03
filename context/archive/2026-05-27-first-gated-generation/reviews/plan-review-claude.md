<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-01 First Gated Generation — Drafts in DB

- **Plan**: `context/changes/first-gated-generation/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-28
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 0 critical · 2 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

9/9 existing paths ✓, 5/5 new files correctly absent ✓, 4/4 symbols ✓ (`PROTECTED_ROUTES`, `configStatuses`, `createClient`, `envField`), brief↔plan ✓. Progress↔Phase: 4/4 phases mapped; one count mismatch fixed in triage (F3). Verified via sub-agent: `.env` exists and already holds the OpenRouter vars; `.dev.vars` absent; prod Supabase secrets use `wrangler secret put` (matches plan); only live `/dashboard` coupling is `Topbar.astro:13` (survives the hub rewrite); nothing references `/generate` yet.

## Findings

### F1 — Phase 1 points local dev at the wrong env file (.dev.vars, not .env)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3 ("Local dev vars file") + manual checks 1.4 / 1.5
- **Detail**: The plan said put OpenRouter vars in `.dev.vars` "for `npm run dev`". But `npm run dev` = `astro dev` (package.json:6), and `astro:env/server` loads from `.env` (Vite convention), NOT `.dev.vars` (only `wrangler dev`/preview reads that). Evidence: `.dev.vars` does not exist; `.env` exists and already contains `OPENROUTER_API_KEY` + `OPENROUTER_MODEL`; deploy-plan.md:281 confirms Supabase works locally because its vars live in `.env`. A var placed only in `.dev.vars` is invisible to `astro dev`, so 1.4/1.5 would never behave as written.
- **Fix**: Rewrite Phase 1 §3 to target `.env` as the load-bearing local file (mention `.dev.vars` only as optional for `wrangler dev`/preview); update 1.4/1.5 and the Phase 1 impl note to `.env`; note the vars are already present.
- **Decision**: FIXED (Fix in plan)

### F2 — Default model may not support OpenRouter strict json_schema

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 (.env.example default), Critical Impl Details, Phase 2 §1
- **Detail**: The plan committed `anthropic/claude-haiku-4.5` as the default model alongside `response_format: { type: "json_schema", strict: true }`. On OpenRouter, strict json_schema structured output is canonically an OpenAI-model feature; Anthropic models route through tool-calling and may reject `response_format` with a 400. If the default doesn't support it, every generation 400s and the Phase 2 happy path never works until the model is swapped. The plan asserted claude-haiku-4.5 supports it "per their docs" without citation; OpenRouter's live support matrix isn't verifiable from inside the repo.
- **Fix A ⭐ Recommended**: Default to `openai/gpt-4o-mini` (known strict-json_schema supporter); add a plan note to verify structured-output support on OpenRouter's models page before locking any default.
  - Strength: OpenAI models are the reference implementation for strict json_schema on OpenRouter — happy path works first try; keeps the "JSON-mode, no plain-text fallback" decision intact.
  - Tradeoff: Moves the default off Anthropic; cost/quality profile differs.
  - Confidence: MED — strong prior, OpenRouter's live matrix unverified here.
  - Blind spot: Exact current per-model support not grepped (external).
- **Fix B**: Keep model-agnostic; add a fallback in `openrouter.ts` — on a json_schema-unsupported 400, retry once without `response_format` and fence-strip parse.
  - Strength: Works across any model.
  - Tradeoff: Contradicts the planning decision to skip plain-text parsing; more code + a second failure mode.
  - Confidence: MED.
  - Blind spot: Reliability of unconstrained output not measured.
- **Decision**: FIXED via Fix A (OpenAI default + verify note)

### F3 — Progress 3.4 merges two Phase-3 criteria (9 criteria → 8 items)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress §Phase 3 (item 3.4)
- **Detail**: Phase 3 had 9 Manual Verification bullets, but Progress collapsed "dashboard link" + "unauthenticated /generate redirect" into a single 3.4. The progress-format contract wants each criterion as its own `- [ ] N.M`.
- **Fix**: Split 3.4 into two items; renumber. Phase 3 Progress is now 3.4–3.12.
- **Decision**: FIXED (Fix in plan)

### F4 — OPENROUTER_MODEL declared as a secret though not sensitive

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §1 + §4
- **Detail**: The model id is non-secret config but declared `access: "secret"` and set via `wrangler secret put`. Consistent with the repo (no `vars` block in `wrangler.jsonc`), so it works — a plaintext Cloudflare `var` would just be easier to see/change.
- **Fix**: Optional — leave as-is, or declare as a non-secret server var.
- **Decision**: ACCEPTED (left as secret for repo consistency)

## Triage Summary

- **Fixed (3)**: F1 (`.env`), F2 (Fix A — `openai/gpt-4o-mini` default + verify note), F3 (split Progress 3.4 → 3.4–3.12)
- **Accepted (1)**: F4
- **Verdict after fixes**: REVISE → SOUND

## Edits applied to plan.md / plan-brief.md

- **plan.md Phase 1 §3** — retitled "Local env file"; now targets `.env` (load-bearing for `astro dev`), notes `.dev.vars` is optional for `wrangler dev`/preview and that `.env` already contains both vars.
- **plan.md Phase 1 §2** — `.env.example` default changed `anthropic/claude-haiku-4.5` → `openai/gpt-4o-mini`; added "verify structured-output support on OpenRouter's models page before locking" guidance.
- **plan.md manual checks 1.4 / 1.5 + Phase 1 impl note** — `.dev.vars` → `.env`.
- **plan.md Key Discoveries + Critical Implementation Details** — reworded to state strict json_schema is canonically an OpenAI-model feature; committed default is an OpenAI model; verify before changing.
- **plan.md Progress §Phase 3** — split 3.4 into 3.4 (dashboard link) + 3.5 (unauth redirect); renumbered through 3.12.
- **plan-brief.md Open Risks** — updated to reflect the OpenAI default and the verify-before-changing note.

## Follow-up for the implementer

- Confirm local `.env`'s `OPENROUTER_MODEL` is a json_schema-capable model (e.g. `openai/gpt-4o-mini`), not `anthropic/claude-haiku-4.5`, or the first generation call will 400.
