# Code-Reviewer → Modular ToolLoopAgent — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`
> Research: `context/changes/tool-loop-agent/research.md`

## What & Why

Turn `packages/code-reviewer` from a single-file, one-shot `generateText` reviewer into a **modular, reusable `ToolLoopAgent`-based** agent. The motivation is twofold: a cleaner module layout (schemas and prompts as their own modules) and an exported agent that future promptfoo evals can import and drive — without restructuring then.

## Starting Point

Everything is in one 113-line file (`src/index.ts`): `reviewSchema`, prompts, provider/model wiring, `createReviewer`/`reviewCode`, `loadEnv`, and a demo. `src/check.ts` does a real billable OpenRouter call validated against the schema. It's a standalone package (own `node_modules`, `ai@^6`), and only `check.ts` consumes the exports — so the refactor is fully contained.

## Desired End State

Same public behavior and API (`createReviewer`, `reviewCode`, `reviewSchema`, `Review`, `loadEnv`), but the verdict is now produced by a `ToolLoopAgent` in `src/agent.ts`; provider resolution sits in `src/provider.ts`; schemas live in `src/schemas.ts`, prompts in `src/prompts.ts`; `src/index.ts` is a pure barrel; and a small `src/cli.ts` is the `npm start` entry. **`reviewCode` is the primary eval-facing export.**

## Key Decisions Made

| Decision                  | Choice                                                            | Why (1 sentence)                                                                                  | Source   |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| Agent mechanism           | `ToolLoopAgent` (v6), `instructions` + `output: Output.object`   | Maps 1:1 onto today's `generateText`; current non-experimental API (subagent-verified).           | Research |
| Tools                     | **None for now**                                                 | Build the agent tool-ready but keep it cheap/deterministic; tools (e.g. GitHub Issues) come later.| Plan     |
| Structured output         | `output: Output.object({ schema: reviewSchema })` → `result.output` | Keeps the exact same contract as today; cleanest for promptfoo assertions.                     | Plan     |
| Loop control              | Default `stopWhen: stepCountIs(20)`                              | With no tools the loop never iterates; default is a documented safety cap.                         | Plan     |
| Model provider            | **Own `src/provider.ts` factory** (`createModel`)               | Isolates OpenRouter/env wiring behind a factory the agent consumes (mirrors course author).        | Plan     |
| Module layout             | `agent` + `schemas` + `prompts` + `provider` + `index` (barrel) + `cli` | Clean peer-module split; `index.ts` is exports-only, demo moves to a CLI (mirrors author).  | Plan     |
| Eval-facing API           | **`reviewCode`** as the outermost entry (not schema-testing)    | The most external call a future promptfoo eval drives; `createReviewAgent` also exported.          | Plan     |
| Review input              | **`ReviewOptions { language?, context? }`** threaded to the prompt | Mirrors the author's final code (agent takes a `language` hint); back-compatible with `context`.| Transcript |
| Entry point / `npm start` | **Simple CLI** (`src/cli.ts`), `index.ts` = barrel              | Easy smoke-testing; public surface collected in one barrel (mirrors author).                       | Plan     |
| Public entry              | **`package.json` `exports` map** (+ keep `main`/`types`)        | Formalizes the barrel as the public entry point (author: "czemu nie").                              | Transcript |
| Verification              | **Typecheck + `npm start` smoke run** (Vitest/build/billable-check not gated) | Lightweight confidence the module compiles and answers (mirrors author).             | Plan     |
| Eval environment          | Out of scope                                                     | Only ensure the export shape; no promptfoo config/deps in this change.                             | Task     |

## Scope

**In scope:** `src/provider.ts` (factory) + `src/agent.ts` (`ToolLoopAgent`); extract `src/schemas.ts` + `src/prompts.ts`; `ReviewOptions`/`language` threaded to the prompt; `src/cli.ts` + `index.ts` as barrel; rewire `createReviewer`/`reviewCode`; repoint `npm start`/`dev` + add `package.json` `exports`; update README.

**Out of scope:** any review tools; promptfoo eval env; a unit-test runner; changes to the review contract, provider choice, model defaults, env strategy, or anything outside `packages/code-reviewer/`.

## Architecture / Approach

`src/provider.ts` exposes `createModel(config)` (apiKey + model id + `createOpenRouter` → `LanguageModel`) and `loadEnv`. `src/agent.ts` `createReviewAgent(config)` calls `createModel` and returns `new ToolLoopAgent({ model, instructions: reviewSystemPrompt, output: Output.object({ schema: reviewSchema }) })`, and owns the `ReviewOptions { language?, context? }` type. `createReviewer`/`reviewCode(code, options?)` call `agent.generate({ prompt: buildReviewPrompt(code, options) })` → `result.output`. `index.ts` re-exports everything (barrel); `src/cli.ts` prepares `{ code, language }` and owns the runnable smoke demo. v6 API watch-outs: `instructions` (not `system`), `output` on the constructor, validated object at `result.output`.

## Phases at a Glance

| Phase                              | What it delivers                                                       | Key risk                                                        |
| ---------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Extract schemas & prompts       | `src/schemas.ts` + `src/prompts.ts`, `index.ts` re-exports            | Accidental behavior change — mitigated by keeping `generateText` |
| 2. Provider + agent + CLI + barrel | `provider.ts`, `agent.ts` (+`ReviewOptions`), `cli.ts`, barrel `index.ts` + `exports`, reviewer rewired | v6 renamed-API slips (`system`→`instructions`, `.output`)      |

**Prerequisites:** `OPENROUTER_API_KEY` in `.env` for the `npm start` smoke run; nothing else.
**Estimated effort:** ~1 session, 2 small phases in a standalone package.

## Open Risks & Assumptions

- Mixing a forced `output` schema with the agent abstraction is the one spot to verify — subagent confirmed `Output.object` on the constructor is correct; `npm run typecheck` is the gate.
- Model memory tends to supply pre-v6 names (`system`, `maxSteps`, `experimental_output`); the plan calls these out explicitly.

## Success Criteria (Summary)

- `npm run typecheck` green; `index.ts` is a pure barrel exporting `reviewCode` / `createReviewer` / `createReviewAgent` / `ReviewOptions`; `package.json` has an `exports` map.
- `npm start` CLI smoke run makes one real OpenRouter call and prints a `reviewSchema`-valid review flagging the subtraction bug.
- `reviewCode(code, { language })` returns a typed `Review` via the agent path (language hint reaches the prompt); public API back-compatible.
