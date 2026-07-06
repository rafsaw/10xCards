# Promptfoo Evals for code-reviewer — Implementation Plan

## Overview

Introduce a **first Promptfoo eval** inside `packages/code-reviewer` that runs the
package's existing review agent (`reviewCode()`) against **one** deliberately-flawed
React 16→19 migration diff across **three OpenRouter models**, and grades each model's
review two independent ways:

1. **LLM-as-a-judge** (`llm-rubric`) — did the review identify the three planted flaws?
2. **Deterministic static assertion** — is the output schema-valid AND does
   `computeVerdict(criteria)` return `pass: false` on the bad diff?

This is a learning-lesson MVP (M5L3): the goal is a working, comparable, side-by-side
model matrix — not exhaustive eval coverage. The package was deliberately built
"eval-ready," so this change is a config drop, not a refactor.

## Current State Analysis

The reviewer package is standalone (no npm workspace) and already exposes every seam a
Promptfoo integration needs (see `context/changes/code-reviewer-evals/research.md`):

- `reviewCode(code, options?, config?)` (`src/agent.ts:64-66`) binds the model per-call
  via `config.model`; model resolution lives in `src/provider.ts:37-45`
  (`config.model ?? OPENROUTER_MODEL ?? FALLBACK_MODEL`, default
  `anthropic/claude-sonnet-4.5`, `src/provider.ts:21`).
- `computeVerdict(criteria)` (`src/verdict.ts:29-44`) is pure and returns
  `{ pass, overall }`; pass requires `overall >= 6` **and** `implementationCorrectness >= 6`
  **and** `securitySafety >= 6`.
- `reviewSchema` (`src/schemas.ts:56-60`) and the whole barrel (`src/index.ts`) are
  side-effect-free — importable from an eval without loading env or agent runtime.
- No eval scaffolding exists yet — greenfield (no `promptfooconfig.yaml`, no `evals/`).
- CI coupling: `.github/actions/code-review/action.yml` runs `npm ci` inside the package
  on every PR review, so a `promptfoo` devDependency will be installed there (accepted for
  MVP, documented).

**Constraints discovered:**

- ⚠️ Scores are a bare `z.number()` (not `.int()`/`.min`/`.max`) — an Anthropic
  structured-output workaround (`src/schemas.ts:20-30`). The 1–10 integer range is
  prompt-enforced only, **not** schema-enforced. Assertions must not assume bounded values.
- Promptfoo runs `.ts` providers directly (no pre-compile); run `promptfoo eval` from the
  package dir so its TS loader resolves `tsconfig.json`.
- Promptfoo's on-by-default disk cache keys off *its* view of the call; because the model
  round-trip happens **inside** our provider, Promptfoo may not auto-cache it — fine for a
  single test case.

## Desired End State

From `packages/code-reviewer`, `npm run eval` executes a Promptfoo matrix of
**3 models × 1 test case**, printing a side-by-side comparison where, for each model:

- the review's findings are graded by an LLM judge against the three known flaws, and
- a deterministic assertion confirms the output is schema-valid and the verdict is `fail`.

Re-running is cheap (judge cached / temp-0), and a cost/latency guardrail fails runaway
calls. The eval is documented in the package README. Nothing in the existing library,
CI review path, or `reviewCode` signature changes.

### Key Discoveries:

- `reviewCode(code, opts, { model })` makes model-swap a one-arg change — ideal per-provider `config.model` (`src/agent.ts:64`, `src/provider.ts:44`).
- Custom-provider `output` may be a structured object; JS assertions then receive it **already parsed** (research: promptfoo custom-api + javascript-assertion docs).
- `computeVerdict` + `reviewSchema` are the deterministic-assertion target; import them from `../src/index.js` (relative source import — no build required).
- `llm-rubric` interpolates test `vars` via `{{ }}`, so the `expected_flaws` var drives the judge; grading provider is set independently at `defaultTest.options.provider`.

## What We're NOT Doing

- **Not** wiring evals into CI / the PR-review workflow — evals run locally/manually.
- **Not** changing `reviewCode`, `reviewSchema`, `computeVerdict`, prompts, or the schema.
- **Not** modifying `.github/actions/code-review/action.yml` (we accept the devDep install cost rather than adding `--omit=dev`).
- **Not** adding more than one test case, or evaluating passing/clean diffs — single flawed-diff MVP.
- **Not** implementing provider-internal caching — relying on Promptfoo's default cache + temp-0 judge.
- **Not** building a golden-dataset / regression-threshold harness — this is a first comparison config.

## Implementation Approach

A custom Promptfoo **TS provider** wraps `reviewCode()` so the *real* agent, system prompt,
rubric, and structured-output schema are what's under test (not a re-declared raw-model
prompt). Three `providers:` entries point at the same provider file, differing only by
`config.model`. One test supplies the flawed diff (external `file://` var) and an
`expected_flaws` var; two assertions grade every model uniformly via `defaultTest`. The
judge is a cheap OpenRouter model at temperature 0, decoupled from the models under test.

All new eval assets live under `packages/code-reviewer/evals/` to keep them grouped and
out of `src/`. The provider imports the package by **relative source path**
(`../src/index.js`) so no build step is required before running the eval.

## Critical Implementation Details

- **Provider must return, not throw, on model failure** — a failed model should produce
  `{ error }` so one bad model doesn't abort the whole matrix.
- **Object output vs. rubric stringify** — the JS assertion receives the parsed object; the
  `llm-rubric` judge sees the review auto-stringified to JSON. If a rubric ever needs
  `{{output.field}}`, set `PROMPTFOO_DISABLE_OBJECT_STRINGIFY=true` (not needed for the
  current rubric, which grades the whole review text).
- **Model ids drift** — `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`, and
  `anthropic/claude-sonnet-4.5` must be verified against https://openrouter.ai/models at
  run time; keep them as three easily-editable `config.model` values.

---

## Phase 1: Eval harness scaffolding (provider + dependency + script)

### Overview

Stand up the reusable seam: the custom provider, the dependency, and the run script. After
this phase the provider type-checks and Promptfoo can load it, even before the fixture and
assertions exist.

### Changes Required:

#### 1. Package dependency + eval script

**File**: `packages/code-reviewer/package.json`

**Intent**: Add `promptfoo` as a devDependency and an `eval` script so the harness is
pinned/reproducible and runnable with one command. Accept that CI's in-package `npm ci`
will install it (documented in Phase 3).

**Contract**: New `devDependencies["promptfoo"]` (pin a current major, e.g. `^0.x`), and
`scripts.eval` = `promptfoo eval -c promptfooconfig.yaml` (optionally `scripts["eval:view"]`
= `promptfoo view`). Run from the package dir. No change to existing scripts.

#### 2. Custom review provider

**File**: `packages/code-reviewer/evals/reviewerProvider.ts`

**Intent**: Wrap `reviewCode()` so Promptfoo tests the real agent. Each provider instance
carries its own `config.model`; `callApi` runs the review on the incoming code/diff and
returns the structured review plus the derived verdict as `output`.

**Contract**: ESM module, `export default class` implementing Promptfoo's provider
contract — `id(): string` (e.g. `reviewer:<model>`) and
`async callApi(prompt, context?): Promise<ProviderResponse>`. Reads `this.config.model`
(and `apiKey ?? process.env.OPENROUTER_API_KEY`), calls
`reviewCode(prompt, { language: "typescript" }, { model })`, returns
`{ output: { ...review, verdict: computeVerdict(review.criteria) } }`; on failure returns
`{ error }` (never throws). Imports `reviewCode`/`computeVerdict` from `../src/index.js`
(relative source import). The `prompt` argument is the rendered diff (the config's prompt
template is just `{{diff}}`) and is passed directly as the reviewed code.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck` (in `packages/code-reviewer`)
- `promptfoo` is installed: `npm ls promptfoo` resolves
- Provider file exists and default-exports a class: `evals/reviewerProvider.ts`

#### Manual Verification:

- Provider imports resolve from source without a build (`../src/index.js` maps to `.ts` under Promptfoo's loader)
- `config.model` is threaded through to `reviewCode`'s third arg (confirmed by reading the file)

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Flawed React 16→19 migration fixture

### Overview

Author the single test input: a realistic unified diff migrating a React 16 class/legacy
component to React 19, containing exactly three impactful, judge-detectable flaws spread
across criteria — and a companion spec describing those flaws for the rubric.

### Changes Required:

#### 1. The migration diff fixture

**File**: `packages/code-reviewer/evals/cases/react19-migration.diff`

**Intent**: Provide one rather-complex, believable React 16→19 migration diff whose three
planted flaws are impactful enough that a competent review should catch them and fail the
change. Flaws are spread so the verdict fails via the correctness/security floors, not just
the mean.

**Contract**: A unified-diff text file (consumed as a `file://` var). Contains three
planted flaws, one per category:
- **Correctness** — e.g. a `useEffect` (or migrated lifecycle) that drops its cleanup,
  leaking a subscription/listener across renders.
- **React-19 API removal** — e.g. `ReactDOM.render` left in place of `createRoot`, or
  `defaultProps` on a function component (removed in React 19), or a removed string ref.
- **Security/safety** — e.g. `dangerouslySetInnerHTML` fed unvalidated/user-controlled
  input introduced during the migration.
The diff should also contain benign, correct migration changes so the flaws aren't trivially
the only edits. Keep it under the reviewer's practical size (well within token budget).

#### 2. Expected-flaws spec (rubric input)

**File**: Encoded as an `expected_flaws` var in the test case (authored in Phase 3's config, but its content is designed here).

**Intent**: A short, unambiguous enumeration of the three flaws the judge must confirm were
identified — phrased by symptom, not by exact wording, so it grades substance not phrasing.

**Contract**: Three numbered items matching the planted flaws (leak/missing cleanup;
React-19 removed API; unsafe HTML injection). Lives in `tests[].vars.expected_flaws`.

### Success Criteria:

#### Automated Verification:

- Fixture file exists: `evals/cases/react19-migration.diff`
- File is a well-formed unified diff (parses; non-empty hunks)

#### Manual Verification:

- Each of the three flaws is genuinely present in the diff and is impactful (not cosmetic)
- The three flaws map cleanly to correctness / React-19-API / security categories
- Benign migration changes are present so flaws aren't the only edits
- A human reviewer reading the diff would plausibly fail the change

**Implementation Note**: After automated verification passes, pause for manual confirmation that the fixture's three flaws are correct and impactful before Phase 3.

---

## Phase 3: Assertions, config wiring, docs & run

### Overview

Wire everything into `promptfooconfig.yaml`: the 3-model matrix, the judge rubric, the
deterministic static assertion, and cost/latency guardrails. Document the eval in the README
and run it end-to-end.

### Changes Required:

#### 1. Deterministic static assertion

**File**: `packages/code-reviewer/evals/assertions/verdictFail.mjs`

**Intent**: Reuse the package's own contract to prove the reviewer both returns a valid
`Review` and correctly **fails** the bad diff — applied uniformly to all three models.

**Contract**: ESM module, `export default function (output)` returning a Promptfoo
`GradingResult`. Runs `reviewSchema.safeParse(output)` (fail with reason if invalid), then
`computeVerdict(parsed.data.criteria)`; returns
`{ pass: verdict.pass === false, score: verdict.pass === false ? 1 : 0, reason }`. Imports
from `../../src/index.js`. (The provider attaches `verdict`, but this assertion recomputes
from `criteria` to also exercise the schema.)

#### 2. Promptfoo config (the matrix)

**File**: `packages/code-reviewer/promptfooconfig.yaml`

**Intent**: Define the 3-model matrix over the one flawed diff, set the independent judge,
and attach both assertions plus guardrails to every cell.

**Contract**: Top-level `description`, `prompts: ['{{diff}}']`, and `providers:` — three
entries all `id: file://./evals/reviewerProvider.ts`, each with a `label` and
`config.model` of `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`,
`anthropic/claude-sonnet-4.5` (verify ids at run time). `defaultTest.options.provider` = a
cheap OpenRouter judge (e.g. `openrouter:openai/gpt-5-mini`) at `temperature: 0`. One
`tests` entry with `vars.diff: file://./evals/cases/react19-migration.diff` and
`vars.expected_flaws`. `defaultTest.assert` (so all models graded identically): an
`llm-rubric` referencing `{{expected_flaws}}`, a `type: javascript` →
`file://./evals/assertions/verdictFail.mjs`, and `type: cost` + `type: latency` guardrails
with sane thresholds.

#### 3. README documentation

**File**: `packages/code-reviewer/README.md`

**Intent**: Add an "Evals" section: what the eval does, how to run it (`npm run eval`,
`npm run eval:view`), required env (`OPENROUTER_API_KEY`; judge model note), the three
planted flaws, and the known tradeoff that the `promptfoo` devDep is installed by CI's
in-package `npm ci`.

**Contract**: New README section; documents the `eval` script, the `evals/` layout, the two
grading mechanisms, and the CI-install caveat. Update the "Module layout" / scripts tables
to include the eval assets and script.

### Success Criteria:

#### Automated Verification:

- Assertion + config files exist and Promptfoo loads them without a config error
- `npm run eval` completes and produces a matrix result for all three models
- The `verdictFail` static assertion passes (verdict = fail, schema valid) for models that behave correctly
- Type checking still passes: `npm run typecheck`

#### Manual Verification:

- Side-by-side output shows each model's review + pass/fail per assertion
- The `llm-rubric` verdicts sensibly reflect whether each model caught the three flaws
- Cost/latency guardrails are set to values that would catch a runaway call but don't trip on a normal run
- `npm run eval:view` (or the printed table) renders the comparison
- README "Evals" section is accurate and runnable by following it verbatim

**Implementation Note**: The end-to-end run makes real, billable OpenRouter calls (one per model + judge). Confirm `OPENROUTER_API_KEY` is set and accept the cost before running.

---

## Testing Strategy

### Unit / deterministic:

- The `verdictFail.mjs` assertion is itself deterministic — its correctness is verifiable by
  running the eval and confirming it flags a schema-invalid or wrongly-passing output.
- Existing `src/verdict.test.ts` continues to pass under root `npm test` (unchanged).

### Integration (the eval itself):

- `npm run eval` — full matrix, real calls; the eval *is* the integration test.
- Re-run to confirm judge caching / temp-0 determinism keeps repeat runs cheap and stable.

### Manual Testing Steps:

1. `cd packages/code-reviewer && npm install` (pulls promptfoo).
2. Ensure `.env` has `OPENROUTER_API_KEY`.
3. `npm run eval` — confirm three model columns, both assertions per cell, guardrails green.
4. Inspect an intentionally weak model's `llm-rubric` reason to confirm the judge reasons about the three flaws.
5. `npm run eval:view` to browse the comparison UI.

## Performance Considerations

- One test case × three models + one judge call per cell — small, bounded cost.
- Judge at `temperature: 0` for determinism; `type: cost`/`type: latency` guardrails cap
  runaway calls.
- Promptfoo's default disk cache speeds re-runs of unchanged (prompt, provider) pairs; note
  in-provider model calls may not be auto-cached (acceptable at this scale).

## Migration Notes

None — additive change. No existing data, schema, or API is touched; `reviewCode`'s
signature and the review schema are preserved (a hard constraint from prior changes).

## References

- Related research: `context/changes/code-reviewer-evals/research.md`
- Eval-facing export: `packages/code-reviewer/src/agent.ts:64-66`
- Deterministic verdict: `packages/code-reviewer/src/verdict.ts:29-44`
- Schema (bounds caveat): `packages/code-reviewer/src/schemas.ts:20-60`
- CI install coupling: `.github/actions/code-review/action.yml`
- Prior eval-ready decisions: `context/archive/2026-06-26-tool-loop-agent/plan.md:47,54,78`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Eval harness scaffolding

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — 59c666b
- [x] 1.2 `promptfoo` is installed: `npm ls promptfoo` resolves — 59c666b
- [x] 1.3 Provider file exists and default-exports a class: `evals/reviewerProvider.ts` — 59c666b

#### Manual

- [x] 1.4 Provider imports resolve from source without a build — 59c666b
- [x] 1.5 `config.model` is threaded through to `reviewCode`'s third arg — 59c666b

### Phase 2: Flawed React 16→19 migration fixture

#### Automated

- [x] 2.1 Fixture file exists: `evals/cases/react19-migration.diff`
- [x] 2.2 File is a well-formed unified diff (parses; non-empty hunks)

#### Manual

- [x] 2.3 Each of the three flaws is genuinely present and impactful
- [x] 2.4 The three flaws map to correctness / React-19-API / security categories
- [x] 2.5 Benign migration changes present so flaws aren't the only edits
- [x] 2.6 A human reviewer would plausibly fail the change

### Phase 3: Assertions, config wiring, docs & run

#### Automated

- [ ] 3.1 Assertion + config files exist and Promptfoo loads them without error
- [ ] 3.2 `npm run eval` completes with a matrix result for all three models
- [ ] 3.3 The `verdictFail` static assertion passes (verdict = fail, schema valid)
- [ ] 3.4 Type checking still passes: `npm run typecheck`

#### Manual

- [ ] 3.5 Side-by-side output shows each model's review + pass/fail per assertion
- [ ] 3.6 `llm-rubric` verdicts sensibly reflect whether each model caught the three flaws
- [ ] 3.7 Cost/latency guardrails catch runaway calls but don't trip on normal runs
- [ ] 3.8 `npm run eval:view` renders the comparison
- [ ] 3.9 README "Evals" section is accurate and runnable verbatim
