# Promptfoo Evals for code-reviewer — Plan Brief

> Full plan: `context/changes/code-reviewer-evals/plan.md`
> Research: `context/changes/code-reviewer-evals/research.md`

## What & Why

Add the first Promptfoo eval to `packages/code-reviewer`: run the existing review agent
(`reviewCode()`) across **three OpenRouter models** on **one** deliberately-flawed React
16→19 migration diff, and grade each model's review with an **LLM-as-a-judge** rubric
(did it catch the three planted flaws?) and a **deterministic static assertion** (schema
valid + verdict = fail). The point is a comparable, side-by-side model matrix — the payoff
the package was pre-shaped for.

## Starting Point

The package is standalone (no npm workspace) and already "eval-ready": `reviewCode(code,
opts, { model })` swaps models via one arg (`src/agent.ts:64`, `src/provider.ts:44`), and
`computeVerdict` + `reviewSchema` are pure, importable exports. No eval scaffolding exists
yet — this is greenfield config.

## Desired End State

`npm run eval` (from the package) runs a 3-model × 1-case Promptfoo matrix, printing a
side-by-side comparison where each model's review is judged for flaw-detection and
deterministically checked for a schema-valid failing verdict. Re-runs are cheap; a
cost/latency guardrail caps runaway calls; the eval is documented in the README. No change
to the library, CI review path, or `reviewCode` signature.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Integration mechanism | Custom TS provider wrapping `reviewCode()` | Tests the real agent/prompt/schema, not a re-declared raw-model prompt | Research |
| Third model | `anthropic/claude-sonnet-4.5` | It's the package/CI default, keeping results comparable to production | Plan |
| Judge model | Cheap OpenRouter model, temp 0 | One API key, deterministic grading, low cost | Plan |
| Planted flaws | One correctness + one React-19 API-removal + one security | Exercises multiple criteria AND trips the correctness/security floors to force a fail | Plan |
| Static assertion | Schema-valid **and** `computeVerdict().pass === false` | Reuses package exports; proves valid output + correct failure, uniformly | Plan |
| CI install cost | Accept for MVP, document it | Standard devDep layout; review step never calls promptfoo, only install is slower | Plan |
| Cost control | Judge temp 0 + cost/latency guardrails + default cache | Cheap deterministic reruns with a runaway-cost guard | Plan |
| Package import in eval | Relative source `../src/index.js` | No build step required before running the eval | Plan |

## Scope

**In scope:** `promptfoo` devDep + `eval` script; custom provider; one flawed React diff
fixture; `verdictFail` static assertion; `llm-rubric` judge; `promptfooconfig.yaml` 3-model
matrix; cost/latency guardrails; README "Evals" section.

**Out of scope:** wiring evals into CI; changing `reviewCode`/schema/prompts; editing the CI
review action; multiple test cases or clean-diff evals; provider-internal caching; a
golden-dataset/regression-threshold harness.

## Architecture / Approach

Three `providers:` entries point at one `evals/reviewerProvider.ts`, differing only by
`config.model`. The provider calls `reviewCode(diff, { language }, { model })` and returns
`{ ...review, verdict }` as structured `output`. One `tests` entry supplies the diff
(`file://`) and an `expected_flaws` var; `defaultTest.assert` grades every model with the
same `llm-rubric` (judge = independent temp-0 OpenRouter model) + `javascript` verdict-fail
assertion + cost/latency guardrails. All eval assets live under `evals/`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scaffolding | promptfoo devDep + `eval` script + custom provider | TS provider resolution/import-from-source under promptfoo's loader |
| 2. Fixture | React 16→19 diff with 3 planted, categorized flaws | Flaws must be genuinely impactful + judge-detectable, not cosmetic |
| 3. Assertions + run | `verdictFail.mjs`, `promptfooconfig.yaml`, README, e2e run | Model ids must exist on OpenRouter; billable run; guardrail thresholds |

**Prerequisites:** `OPENROUTER_API_KEY` in `.env`; verify the three model ids on
https://openrouter.ai/models at run time.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- **Model ids drift** — `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`,
  `anthropic/claude-sonnet-4.5` must be confirmed on OpenRouter before running; kept as
  easily-editable config values.
- **Score bounds not schema-enforced** — 1–10 range is prompt-only (`schemas.ts:20-30`);
  assertions don't assume bounded values.
- **In-provider calls may not be auto-cached** by Promptfoo (calls happen inside the
  provider) — acceptable at one test case.
- **CI `npm ci` installs the promptfoo devDep** on every PR review — accepted, documented.

## Success Criteria (Summary)

- `npm run eval` returns a side-by-side 3-model comparison on the flawed diff.
- Each model is graded by the LLM judge (flaws caught?) and the deterministic verdict-fail
  assertion (schema valid + `pass === false`).
- The eval is cheap to re-run and documented in the README.
