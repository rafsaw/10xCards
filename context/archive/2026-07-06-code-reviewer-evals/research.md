---
date: 2026-07-06T08:56:14-05:00
researcher: Rafal S
git_commit: 48bd9c44b7c94d9b3854f9d0e75e7d991f4f754b
branch: learning/m5l3-promptfoo
repository: rafsaw/10xCards
topic: "Evaluating packages/code-reviewer for eval (Promptfoo) introduction"
tags: [research, codebase, code-reviewer, evals, promptfoo, ai-sdk, llm-as-judge]
status: complete
last_updated: 2026-07-06
last_updated_by: Rafal S
---

# Research: Introducing evals (Promptfoo) to `packages/code-reviewer`

**Date**: 2026-07-06T08:56:14-05:00
**Researcher**: Rafal S
**Git Commit**: 48bd9c44b7c94d9b3854f9d0e75e7d991f4f754b
**Branch**: learning/m5l3-promptfoo
**Repository**: rafsaw/10xCards

## Research Question

Analyze the current state of `packages/code-reviewer` in the context of introducing
evaluation (evals). Focus on:
- prompt reusability
- agent importability/reusability
- overall compatibility with Promptfoo (the preferred toolkit)

If Promptfoo is not a good fit, research alternative OSS frameworks for evaluating
LLM prompts and agents.

## Summary

**Promptfoo is the right pick, and the package is already purpose-built for it.**
`packages/code-reviewer` was refactored across two prior changes with the explicit,
documented goal of being "eval-facing" — every seam a Promptfoo integration needs
already exists, and no restructuring is required. Adding evals is essentially a
*greenfield config drop* into a package that was pre-shaped to receive it.

The three focus areas resolve cleanly:

1. **Prompt reusability** — ✅ Prompts live in their own side-effect-free module
   (`prompts.ts`): `reviewSystemPrompt` (string) and `buildReviewPrompt(code, options)`
   are exported and importable without touching agent/provider code.
2. **Agent importability** — ✅ `reviewCode(code, options?, config?)` is the stable,
   documented "primary eval-facing export." Model selection is a per-call `config.model`
   argument, so running the *same* prompt across N models is a one-argument change —
   exactly the shape a Promptfoo custom provider wants.
3. **Promptfoo compatibility** — ✅ The intended integration (a custom TS provider that
   wraps `reviewCode()`) is Promptfoo's **directly supported** "Custom API Provider" path.
   The deterministic `computeVerdict()` and importable `reviewSchema` map onto Promptfoo's
   JavaScript assertions; LLM-as-a-judge maps onto `llm-rubric`. Promptfoo runs `.ts`
   providers **directly, no pre-compilation**, and its `providers:` list gives the
   3-model comparison matrix natively.

**Verdict:** proceed with Promptfoo. The strongest fallback (if "stay inside TS/Vitest,
zero adapter glue" ever outweighs "native model-grid UI") is **Evalite** — but that
tradeoff does not apply to the M5L3 goal, which centers on model comparison.

## Detailed Findings

### Prompt reusability — `prompts.ts` is eval-ready by design

`prompts.ts` was deliberately separated "so prompts can be iterated (and later eval'd)
independently of the provider/agent code" (`src/prompts.ts:3-6`).

- `reviewSystemPrompt` (`src/prompts.ts:14-35`) — the senior-reviewer persona + the
  six-criteria 1–10 rubric, as a plain string constant. Directly importable.
- `buildReviewPrompt(code, options?)` (`src/prompts.ts:42-53`) — pure function; prepends
  an optional `language` hint and `context`, wraps the code in a fenced block. No I/O.
- Both are re-exported from the barrel (`src/index.ts:17`).

Consequence for evals: a Promptfoo eval can either (a) let `reviewCode()` build the prompt
internally (recommended — keeps the real system prompt + rubric in play), or (b) import
`reviewSystemPrompt`/`buildReviewPrompt` to eval prompt wording in isolation. Both paths
are open with no code change.

### Agent importability — `reviewCode` is the stable eval seam

The agent layer (`src/agent.ts`) exposes three layered entry points, all re-exported via
`index.ts:22-23`:

- `createReviewAgent(config?)` (`src/agent.ts:33-42`) — builds a `ToolLoopAgent` bound to
  the resolved model, with `instructions: reviewSystemPrompt` and
  `output: Output.object({ schema: reviewSchema })`. Comment calls it "the seam to add
  review tools later."
- `createReviewer(config)` (`src/agent.ts:45-57`) — binds the model once, returns
  `{ reviewCode }`.
- `reviewCode(code, options?, config?)` (`src/agent.ts:64-66`) — the one-shot wrapper,
  documented as "the headline eval-facing call shape" (`src/agent.ts:59-63`) and "the
  primary eval-facing export a future promptfoo eval drives" (`src/agent.ts:22`).

Model/provider selection is isolated in `provider.ts`: `createModel(config)`
(`src/provider.ts:37-45`) resolves `config.model ?? OPENROUTER_MODEL ?? FALLBACK_MODEL`
(`src/provider.ts:44`), where `FALLBACK_MODEL = "anthropic/claude-sonnet-4.5"`
(`src/provider.ts:21`). **This is the key reusability property for model comparison:**
swapping models is `reviewCode(code, opts, { model: "..." })` — no prompt or agent change.

Import safety: the barrel is side-effect-free — `.env` is only loaded by the CLI/CI
entries via `loadEnv()` (`src/cli.ts:10`, `src/ci.ts:19`), never at import
(`src/provider.ts:28-34`, README `src/README.md` Notes). Consumers (and Promptfoo) control
env loading. This was an explicit design rule (see Historical Context).

### The output contract — deterministic verdict + importable schema

- `reviewSchema` (`src/schemas.ts:56-60`) — zod v4 object: `summary`, `criteria` (six
  keyed `{ score: number, rationale: string }`), optional `findings[]`. Lives in its own
  module explicitly "so both the agent and future promptfoo assertions can import it
  without pulling in agent/runtime code" (`src/schemas.ts:3-7`).
- `CRITERION_KEYS` (`src/schemas.ts:33-40`) — the six criterion keys as a stable tuple.
- `computeVerdict(criteria)` (`src/verdict.ts:29-44`) — **pure, no-I/O** pass/fail
  derivation returning `{ pass, overall }`. Pass requires `overall >= 6` AND
  `implementationCorrectness >= 6` AND `securitySafety >= 6` (`src/verdict.ts:14-18`,
  39-42). Already unit-tested (`src/verdict.test.ts`, 5 boundary cases).

This is the deterministic-assertion target: an eval can `import { computeVerdict, reviewSchema }`
and assert the flawed-diff review yields `pass === false`.

**⚠️ Schema constraint evals must respect:** scores are a bare `z.number()`, **not**
`.int()`/`.min()`/`.max()` — because "Anthropic's structured-output endpoint rejects
`minimum`/`maximum` on an integer property, and zod v4's `.int()` emits the JS safe-integer
bounds as exactly those" (`src/schemas.ts:20-30`). The 1–10 integer range lives in the
prompt rubric + `.describe()`, **not** in the schema. So the model *can* technically return
a non-integer or out-of-range score; an eval assertion cannot assume schema-enforced bounds.

### Promptfoo compatibility — the custom-provider path is directly supported

Verified against current promptfoo.dev docs (2025/2026) + Context7 (`/websites/promptfoo_dev`).

**Custom TS provider (the integration this package was built for).** Promptfoo's
["Custom API Provider"](https://www.promptfoo.dev/docs/providers/custom-api/) contract is a
module that default-exports a class implementing:
- `id(): string`
- `callApi(prompt, context?, options?): Promise<ProviderResponse>` where `ProviderResponse`
  is `{ output, error?, tokenUsage?, cost?, cached?, metadata? }`, and **`output` may be a
  structured object** (not just a string) — which fits our `Review` object directly.

Promptfoo **runs `.ts` providers directly via its Node loader — no pre-compilation** — and
ESM/`"type":"module"` packages (ours qualifies) use standard `import`/`export`. Run
`promptfoo eval` from the package dir so its `tsconfig.json` resolves. Per-provider `config`
is passed on each `providers:` entry and surfaces on the provider instance.

Sketch (full snippets from Agent A live below in Architecture Insights):
```ts
// reviewerProvider.ts
import { reviewCode, computeVerdict } from "@10xcards/code-reviewer";
export default class ReviewerProvider {
  constructor(opts) { this.config = opts.config; }         // { model, apiKey? }
  id() { return `reviewer:${this.config.model}`; }
  async callApi(diff) {
    const review = await reviewCode(diff, {}, { model: this.config.model });
    return { output: { ...review, verdict: computeVerdict(review.criteria) } };
  }
}
```

**3-model comparison matrix — native.** `providers:` is a list; Promptfoo runs the full
matrix of providers × prompts × tests and renders side-by-side. Three entries differ only by
`label` + `config.model`, all pointing at the same `file://./reviewerProvider.ts`.

**LLM-as-a-judge — `llm-rubric`.** Model-graded assertion; the grading provider is set
independently (`defaultTest.options.provider`, e.g. a cheap `openai:gpt-5-mini` or an
`openrouter:...` model at `temperature: 0`). Test `vars` interpolate into the rubric via
`{{ }}`, so the "expected flaws" description can be injected and the judge asked to confirm
all three are caught. Object outputs are auto-stringified to JSON for the judge.
([model-graded docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/))

**Deterministic assertion — `type: javascript`.** A `file://` JS/`.mjs` assertion can
`import` the package and reuse `computeVerdict`/`reviewSchema`. Because our provider returns
`output` as an **object**, it arrives at the JS assertion **already parsed** (no `JSON.parse`).
Signature `(output, context) => boolean | number | { pass, score, reason }`.
([javascript-assertion docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/))

**OpenRouter + env.** Promptfoo has a native `openrouter:<vendor>/<model>` provider that
reads `OPENROUTER_API_KEY` — but for this design that is only relevant for the *grading*
model. The system-under-test round-trips go through our custom provider so the real AI-SDK
agent/prompt runs. ([openrouter docs](https://www.promptfoo.dev/docs/providers/openrouter/))

### CI / monorepo constraints for placement

- **Fully standalone package, no workspaces.** Root `package.json` (`10x-astro-starter`)
  has **no `workspaces` field**; `packages/code-reviewer` has its own `package.json`,
  `package-lock.json`, `node_modules/`. The CI action installs it independently
  (`cd packages/code-reviewer && npm ci`). → **Promptfoo devDep + `promptfooconfig.yaml`
  belong inside the sub-package** (matches the isolation the authors maintained).
- **One coupling to note:** the PR-review composite action runs `npm ci` in the package on
  every PR, so **any devDependency added there is installed on every CI review run**
  (slower installs), even though the review step (`npm run ci`) never invokes Promptfoo.
  Evals are **not** wired into CI and are intended to run locally/manually.
  (`.github/workflows/ai-code-review.yml`, `.github/actions/code-review/action.yml`.)
- **Root Vitest already collects the package's unit test.** `vitest.config.ts` sets no
  custom `include` and doesn't exclude `packages/**`, so root `npm test` picks up
  `packages/code-reviewer/src/verdict.test.ts` (pure/hermetic). The package itself has no
  `test` script and no vitest dep. This matters if the fallback (Evalite/Vitest) is ever
  chosen — it would land in the package, run separately from the root suite.
- **No `dist/` committed** (`.gitignore`); everything runs via `tsx` from source.

### Existing eval scaffolding — greenfield

There is **no** `promptfooconfig.yaml` / `promptfoo.yaml` anywhere in the repo, no
`evals/`/`eval/` directory, no test-case fixtures, no `.yaml` under the package. The only
"promptfoo" occurrences in the package are **doc/comment references** describing the intended
design (`schemas.ts`, `agent.ts`, `index.ts`, `README.md`). What exists is *readiness*, not
scaffolding.

## Code References

- `packages/code-reviewer/src/prompts.ts:14-53` — `reviewSystemPrompt` + `buildReviewPrompt` (reusable, side-effect-free).
- `packages/code-reviewer/src/agent.ts:33-66` — `createReviewAgent` / `createReviewer` / `reviewCode` (the eval seam; model bound per call).
- `packages/code-reviewer/src/provider.ts:37-45` — `createModel`, model resolution (`config.model ?? OPENROUTER_MODEL ?? FALLBACK_MODEL`).
- `packages/code-reviewer/src/schemas.ts:20-60` — `reviewSchema`, `CRITERION_KEYS`, and the zod `.int()`/`min`/`max` avoidance rationale (Anthropic constraint).
- `packages/code-reviewer/src/verdict.ts:29-44` — `computeVerdict` (pure `{ pass, overall }`; deterministic-assertion target).
- `packages/code-reviewer/src/index.ts:7-27` — public barrel; everything an eval imports.
- `packages/code-reviewer/src/verdict.test.ts` — existing 5-case boundary unit test (Vitest).
- `packages/code-reviewer/src/ci.ts:18-42` — the CI entry the composite action drives (kept separate from `reviewCode`).
- `.github/actions/code-review/action.yml` — `npm ci` + `npm run ci` in the package (the devDep-install coupling).

## Architecture Insights

- **The whole design is a "reuse the agent, don't re-declare the prompt" pattern.** The
  correct Promptfoo shape here is a *custom provider wrapping `reviewCode()`*, not a
  Promptfoo `prompts:` block hitting a raw model. That keeps the real system prompt, rubric,
  structured-output schema, and verdict logic under test — the eval measures the actual
  product surface, not a reconstruction of it.
- **Two-layer grading matches the codebase's "model scores, code judges" philosophy**
  (`src/verdict.ts:3-11`): a deterministic JS assertion (`computeVerdict` → verdict must be
  `fail` on the flawed diff) *plus* an LLM-rubric judge (did the review name the specific
  flaws?). The package already split these two responsibilities, so the eval mirrors them.
- **Big inputs go in external files** — the React-migration diff should be a `file://` var
  (`diff: file://./cases/react19-migration.diff`) rather than inline YAML.
- **Cost control:** Promptfoo's disk cache is on by default, but since the model round-trip
  happens *inside* our provider, Promptfoo may not auto-cache it — rely on `--no-cache`
  discipline / OpenRouter-side behavior, keep the judge model small + `temperature: 0`, and
  optionally add `type: cost` / `type: latency` guardrail assertions.

### Ready-to-use Promptfoo snippets (from current docs)

Minimal `promptfooconfig.yaml` — one flawed diff, three models, judge + deterministic assert:
```yaml
description: code-reviewer — 3 models on one flawed React 16→19 diff
prompts:
  - '{{diff}}'                       # provider builds the real prompt internally
providers:
  - { id: file://./reviewerProvider.ts, label: model-a, config: { model: z-ai/glm-5.1 } }
  - { id: file://./reviewerProvider.ts, label: model-b, config: { model: deepseek/deepseek-v4-flash } }
  - { id: file://./reviewerProvider.ts, label: model-c, config: { model: anthropic/claude-sonnet-4.5 } }
defaultTest:
  options:
    provider: { id: openrouter:openai/gpt-5-mini, config: { temperature: 0 } }
tests:
  - vars:
      diff: file://./cases/react19-migration.diff
      expected_flaws: |
        1) <flaw 1>  2) <flaw 2>  3) <flaw 3>
    assert:
      - type: llm-rubric
        value: "The review's findings must identify ALL of: {{expected_flaws}}"
      - type: javascript
        value: file://./assertions/verdictFail.mjs
```

Deterministic assertion (`assertions/verdictFail.mjs`) — reuses the package:
```js
import { computeVerdict, reviewSchema } from "@10xcards/code-reviewer";
export default function (output) {
  const parsed = reviewSchema.safeParse(output);
  if (!parsed.success) return { pass: false, score: 0, reason: `schema invalid: ${parsed.error.message}` };
  const { pass } = computeVerdict(parsed.data.criteria);
  return { pass: pass === false, score: pass === false ? 1 : 0,
           reason: pass === false ? "verdict correctly = fail" : "verdict wrongly = pass" };
}
```

> Note: the lesson plan (`.claude/prompts/m5l3-promptfoo.md`) names `z-ai/glm-5.1` and
> `deepseek/deepseek-v4-flash` as two of the three models. Verify exact current OpenRouter
> ids at eval time (browse https://openrouter.ai/models) — the reviewer's default is
> `anthropic/claude-sonnet-4.5` (`src/provider.ts:21`), a natural third.

## Alternatives (fallback, if Promptfoo ever stops fitting)

Promptfoo remains the recommended primary — it wins on the headline requirement (3-model
comparison matrix + UI, essentially free from YAML) while still letting us call the real
`reviewCode()` via a custom provider. Fallbacks, decision-oriented:

| Tool | TS-native | Import agent fn directly | Model matrix | LLM judge | Vitest | Ceremony |
| --- | --- | --- | --- | --- | --- | --- |
| **Promptfoo** (primary) | Yes (TS providers/config) | Yes (custom provider glue) | **First-class + UI** | `llm-rubric` etc. | No (own runner) | Medium (YAML + provider file) |
| **Evalite** (strongest fallback) | Yes (TS-first, `.eval.ts`) | **Yes, zero glue** (`task: reviewCode`) | No native grid (loop models yourself) | via `autoevals` | **Built on Vitest** | Low |
| **Vitest + autoevals** | Yes (is the runner) | Yes | No (`test.each(models)`) | `autoevals` scorers | It *is* Vitest | Lowest (one dep) |
| **DeepEval** | Python-first; TS SDK new | Yes (wrap) | via metric runs | G-Eval etc. | Partial | High (language mismatch) |
| **Braintrust SDK** | JS SDK MIT | Yes | Matrix UI (**cloud/SaaS**) | `autoevals` | Separate | Low SDK, cloud coupling |

- **Evalite** is the single strongest alternative: `task` accepts any async fn so you
  `import { reviewCode }` with **zero adapter glue**, LLM-judge via **autoevals**, runs on
  Vitest (reuse existing config/mocks). Tradeoff: **no first-class N-model matrix** — you
  parametrize the 3 models yourself, and its UI compares runs over time, not models
  side-by-side. Switch to it only if "stay in TS/Vitest, import the agent directly"
  outweighs "give me the model grid" — which is not the M5L3 goal.
- **autoevals** (MIT, from Braintrust) is the portable LLM-judge engine that Evalite, a raw
  Vitest setup, and Braintrust all share — so grading logic is portable across all three.
- **DeepEval** is Python-rooted (TS SDK secondary/new) — not worth adopting for a pure
  TS/ESM package. **Braintrust**'s SDK + autoevals are OSS, but the comparison UI/dashboards
  are proprietary SaaS.

## Historical Context (from prior changes)

The package was engineered eval-ready across two archived changes:

- `context/archive/2026-06-26-tool-loop-agent/plan.md:47` — "**`reviewCode` is the primary
  eval-facing export** — the most external entry point a future promptfoo eval drives."
- `.../plan.md:54` — "**Not configuring a promptfoo eval environment** — no
  `promptfooconfig.yaml`, no eval deps, no provider adapter. We only ensure `reviewCode` is
  the clean eval-facing export." (Confirms today's greenfield state is intentional.)
- `.../plan.md:78` — "House the structured-output contract as its own module so both the
  agent and future promptfoo assertions can import it without pulling in agent/runtime
  code." (Realized in `schemas.ts:3-7`.)
- `.../plan.md:24` — "Import must stay side-effect-free — env is only loaded in CLI
  `main()`; consumers (and promptfoo) control env loading." (Realized.)
- `.../plan-brief.md:24` — structured output via `Output.object({ schema })` chosen because
  it is "cleanest for promptfoo assertions."
- `context/archive/2026-06-29-ci-cd-code-review/research.md:147` — the planned M5L3 promptfoo
  eval "constrains schema changes (keep `reviewCode` eval-stable)."
- `.../plan.md:289` — "the new six-criteria `reviewSchema` simply becomes the contract those
  future specs target. `reviewCode`'s signature is preserved."
- `.../research.md:128` / `plan.md:19` — "Workspace shape: `packages/code-reviewer` is a
  nested package but the root has **no npm/pnpm workspaces config** — the action must
  `cd packages/code-reviewer && npm ci` independently." (Confirms placement decision.)

## Related Research

- `context/archive/2026-06-26-tool-loop-agent/research.md` — original agent/refactor research.
- `context/archive/2026-06-29-ci-cd-code-review/research.md` — CI wiring research (schema-as-contract note).

## Open Questions

1. **Model ids.** Confirm the three exact OpenRouter model ids at eval time (the lesson plan
   names `z-ai/glm-5.1` and `deepseek/deepseek-v4-flash`; default third is
   `anthropic/claude-sonnet-4.5`). Ids drift — verify on https://openrouter.ai/models.
2. **Grading provider choice.** Which judge model + provider (OpenRouter vs OpenAI direct)
   and what key it needs — keep it cheap and `temperature: 0`.
3. **Caching of in-provider calls.** Decide whether to accept per-run token cost, add
   provider-internal caching (`promptfoo.cache`/`fetchWithCache`), or rely on `--no-cache`
   discipline. Add `type: cost`/`type: latency` guardrails?
4. **CI install cost.** Accept that a `promptfoo` devDep in the package slows every PR-review
   `npm ci`, or isolate the eval deps another way (separate install path)?
5. **Non-integer/out-of-range scores.** Since the range is prompt-enforced not schema-enforced
   (`schemas.ts:20-30`), should an eval assertion also sanity-check `1 ≤ score ≤ 10` integers,
   or is that out of scope for the model-comparison goal?
6. **Fixture design.** The single React 16→19 diff needs three genuinely impactful, judge-
   detectable flaws (per the plan) — designing that fixture is the next step's real work.
