---
date: 2026-07-06T16:38:38-05:00
researcher: Rafal S
git_commit: c68fe1797a625023b1de044bebbf510329f5bbf3
branch: learning/m5l3-agent-read-plan-tool
repository: 10xCards
topic: "Extend packages/code-reviewer with a read-only readPlan tool-loop capability (M5L3)"
tags: [research, codebase, code-reviewer, ai-sdk, tool-loop, readPlan]
status: complete
last_updated: 2026-07-06
last_updated_by: Rafal S
---

# Research: Add a read-only `readPlan` capability to `packages/code-reviewer`

**Date**: 2026-07-06T16:38:38-05:00
**Researcher**: Rafal S
**Git Commit**: c68fe1797a625023b1de044bebbf510329f5bbf3
**Branch**: learning/m5l3-agent-read-plan-tool
**Repository**: 10xCards

## Research Question

Extend the existing `packages/code-reviewer` from a "diff in → structured verdict out"
scorer toward a first tool-loop agent by adding one read-only capability, `readPlan`, that
reads `context/changes/<change-id>/plan.md` and lets the reviewer compare the diff against
the plan. Answer: entry points, execution paths, diff flow, prompt composition, schema
location, whether `ToolLoopAgent` is already used, available SDK/zod/provider versions,
tests/evals, whether input already carries a change-id/plan path, where `readPlan` should
live, the smallest safe integration point, and how to prove the reviewer actually used the
plan.

## Summary

**The package is already built on `ToolLoopAgent` with zero tools — it is explicitly "the
seam to add review tools later" (`src/agent.ts:18`, `:39`).** Adding `readPlan` is therefore
a *real* tool-loop integration, not a migration: attach one `tool({...})` to the existing
`ToolLoopAgent`, bound with a low `stopWhen: stepCountIs(n)`, and keep the current
`output: Output.object({ schema: reviewSchema })`. The structured `ReviewResult` contract is
preserved unchanged — `agent.generate()` still resolves `.output` as the typed `Review`
after the tool loop runs (verified against the installed `ai@6.0.212` types).

The reviewer currently receives **no** change-id or plan path — only `code` (the diff),
plus `language`/`context` hints. So Phase 1 must add one trusted input channel (a
`changeId`), threaded from `ci.ts` via a new env var and available to `reviewCode` via
`ReviewOptions`. The **model never supplies a file path**: `readPlan` takes at most a
validated kebab-case `changeId`, hardcodes the `plan.md` filename, and resolves inside a
fixed `context/changes/` root — which structurally blocks traversal, absolute paths,
`.env`, and arbitrary-file reads.

Proof that the plan was used is deterministic and free: `agent.generate()` returns a
`GenerateTextResult` exposing `.toolCalls` / `.steps` alongside `.output`, so we can assert
a `readPlan` tool call actually fired (plus a negative test where a missing plan yields a
"no plan found" review).

## Detailed Findings

### Reviewer entry point & module layout

Flat, single-file split under `src/` (README `packages/code-reviewer/README.md:12-25`):

- `src/agent.ts` — **the core**. `createReviewAgent(config)` builds the `ToolLoopAgent`;
  `createReviewer(config)` wraps it; `reviewCode(code, options?, config?)` is the primary
  eval-facing one-shot (`src/agent.ts:33-66`). A `reviewCodeVideoLessonCode` twin exists
  (`:71-81`).
- `src/schemas.ts` — `reviewSchema` + sub-schemas and `Review` type (the output contract).
- `src/prompts.ts` — `reviewSystemPrompt` (the six-criteria rubric) + `buildReviewPrompt`.
- `src/provider.ts` — `createModel(config)`, `loadEnv`, `FALLBACK_MODEL`.
- `src/verdict.ts` — pure `computeVerdict(criteria)` → `{ pass, overall }`.
- `src/index.ts` — barrel (re-exports only).
- `src/cli.ts` — `npm start` smoke run.
- `src/ci.ts` — `npm run ci` PR-reviewer entry (**the CI integration point**).
- `src/check.ts` — `npm run check` one real billable end-to-end call.

### How it is executed (local + CI)

- **Local**: `npm start` (`cli.ts`), `npm run check` (`check.ts`), `npm run dev` (watch).
  All run via `tsx` from the package dir (`package.json:14-24`). `cwd = packages/code-reviewer`.
- **CI**: `.github/workflows/ai-code-review.yml` fires on PRs to `main` and delegates to
  the composite action `.github/actions/code-review/action.yml`, which:
  1. `npm ci` in `packages/code-reviewer` (`action.yml:38-41`),
  2. **extracts the diff** with `git diff --no-ext-diff --unified=3 "$BASE_SHA" HEAD` minus
     lockfiles/`dist`/generated, then a **12 000-byte cap**, into `$RUNNER_TEMP/pr.diff`
     (`action.yml:43-80`),
  3. runs `npm run --silent ci` with `working-directory: packages/code-reviewer` and env
     `OPENROUTER_API_KEY` / `MODEL_INPUT` / `PR_TITLE` / `PR_BODY` / `DIFF_FILE`
     (`action.yml:82-104`),
  4. formats + posts one PR comment and applies an `ai-cr:passed`/`ai-cr:failed` label
     (`action.yml:106-152`). **Advisory only — never blocks merge.**

  **Key path fact:** the reviewer's `cwd` is always `packages/code-reviewer`, but
  `context/changes/<id>/plan.md` lives at **repo root** (two levels up). The `readPlan`
  context root must be resolved accordingly (see Guardrails).

### How the diff is collected and passed in

- `src/ci.ts:26-39` — reads `DIFF_FILE` path from env, `readFileSync(diffFile, "utf8")`,
  and calls `reviewCode(diff, { language: "typescript", context })` where `context` =
  `PR title: … / PR description: …` (`ci.ts:33-39`). PR title/body come from env (never the
  shell command line) to avoid injection; body is capped to `MAX_BODY_CHARS = 2000`.
- In evals, `evals/reviewerProvider.ts:75-83` reads `context.vars.diff` (a **path**),
  `readFile`s it, and calls the same `reviewCode(code, { language }, { model, apiKey })`.
- **The diff is the `code` argument** to `reviewCode` and is wrapped by `buildReviewPrompt`
  (`src/prompts.ts:42-53`) into a ```` ``` ````-fenced block with optional `Language:` and
  `Context:` lines.

### How prompts / instructions are composed

- **System**: `reviewSystemPrompt` (`src/prompts.ts:14-35`) — senior-reviewer persona +
  the six-criteria 1–10 rubric with per-criterion anchors. Passed as the agent's
  `instructions` (`src/agent.ts:37`).
- **User**: `buildReviewPrompt(code, options)` (`src/prompts.ts:42-53`) — deterministic;
  with no options it is byte-identical to the original context-only prompt.
- These are deliberately separated from wiring so prompts can be iterated/eval'd
  independently.

### Where the structured review schema lives (the output contract)

`src/schemas.ts` — `reviewSchema` (`:56-60`): `{ summary, criteria (six criterion scores),
findings? }`. `criterionScoreSchema` deliberately uses a plain `z.number()` (not
`.int()/.min/.max`) because Anthropic's structured-output endpoint rejects `minimum`/
`maximum` on integer props (`:20-30`). `Review = z.infer<typeof reviewSchema>`. Pass/fail is
**not** in the schema — `computeVerdict` derives it (`src/verdict.ts:29-44`;
`PASS_THRESHOLD=6`, `CORRECTNESS_FLOOR=6`, `SECURITY_FLOOR=6`). **This contract must be
preserved** — plan comparison output goes into `summary`/`findings`, not new schema fields.

### Does the package already use ToolLoopAgent / generateObject / Output.object?

**`ToolLoopAgent` + `Output.object`, with NO tools yet.** `src/agent.ts:35-41`:

```ts
new ToolLoopAgent<never, ToolSet, ReviewOutput>({
  model,
  instructions: reviewSystemPrompt,
  output: Output.object({ schema: reviewSchema }),
  // No tools yet → default stopWhen: stepCountIs(20) never trips → single generation.
});
```

`generateObject` is **not** used (it's deprecated in v6 per the bundled skill
`.claude/skills/ai-sdk/references/common-errors.md:72-109`). The agent is already generic
over `TOOLS extends ToolSet` and `OUTPUT`, so adding tools requires **no type migration** —
just populate `tools` and lower `stopWhen`.

### Versions / imports available (verified against installed types)

- `ai@6.0.212` (`node_modules/ai/package.json`), `@openrouter/ai-sdk-provider@^2.10.0`,
  `zod@^4.4.3` (`package.json:30-33`). Dev: `promptfoo@^0.121.17`, `tsx`, `typescript@^6`,
  `@types/node@^26`.
- **All needed symbols export from top-level `"ai"`** (verified in
  `node_modules/ai/dist/index.d.ts`):
  - `ToolLoopAgent`, `ToolLoopAgentSettings`, `ToolSet`, `Output` (as `output as Output`),
    `stepCountIs` — index line `:6489`.
  - `tool`, `Tool`, `ToolExecuteFunction`, `ToolExecutionOptions`, `zodSchema` — re-exported
    from `@ai-sdk/provider-utils` at `dist/index.d.ts:8`.
  - Single import works: `import { ToolLoopAgent, tool, stepCountIs, Output, ToolSet } from "ai";`
- **`tool({...})` shape** (`@ai-sdk/provider-utils/dist/index.d.ts:1257`, `Tool` at `:1114`):
  `{ description?: string; inputSchema: FlexibleSchema<INPUT> /* zod v4 OK, :309 */;
  execute: (input, options: ToolExecutionOptions) => OUTPUT | Promise<OUTPUT> }`.
  `ToolExecutionOptions` carries `{ toolCallId, messages, abortSignal?, experimental_context? }`.
- **`stepCountIs(n): StopCondition`** (`ai/dist/index.d.ts:1032`) — pass to `stopWhen`.
- **Coexistence confirmed**: `agent.generate(opts): Promise<GenerateTextResult<TOOLS,
  OUTPUT>>` (`:3585`); `.output` (`:1169`) resolves the typed object **after** the loop, and
  the same result exposes `.toolCalls` (`:1083`), `.staticToolCalls` (`:1087`), `.steps`
  (`:1158`). So tools and structured output compose, and tool calls are observable.
- **tsconfig** (`tsconfig.json`): `NodeNext`, `strict`, `verbatimModuleSyntax: true`,
  `noUncheckedIndexedAccess`, `rootDir: src`, `include: ["src"]`, `types: ["node"]`.
  → New source must live under `src/`, use `.js`-suffixed relative imports and
  `import type`, and may use `node:fs`/`node:path`. Tests (`**/*.test.ts`) are excluded from
  the build.

### Tests / fixtures / evals / promptfoo

- **Unit**: `src/verdict.test.ts` — Vitest, pure, no API calls (boundary + floor cases).
  Run via the **repo-root** `npm test` (Vitest). This is the model for pure guardrail tests.
- **Evals**: `promptfooconfig.yaml` — 3 OpenRouter models × 1 flawed React 16→19 diff
  (`evals/cases/react19-migration.diff`), graded by an `llm-rubric` judge + a deterministic
  `evals/assertions/verdictFail.mjs` (schema-valid `Review` that `computeVerdict` fails) +
  a `latency` guardrail. Custom provider `evals/reviewerProvider.ts` wraps the real
  `reviewCode()`. Run with `npm run eval` (billable). **These make real calls** — not for
  guardrail verification.
- **Integration check**: `npm run check` (`src/check.ts`) — one real call proving the whole
  pipeline + zod contract.

### Does the current input already carry change-id / plan path / PR metadata?

**No change-id or plan path anywhere.** A grep for `changeId|plan.md|readPlan|context/changes`
across the package hits only unrelated `.claude/hooks/*.mjs`. What flows today:

- `ReviewOptions` = `{ language?, context? }` (`src/agent.ts:25-30`).
- `ci.ts` env inputs = `DIFF_FILE`, `PR_TITLE`, `PR_BODY`, `OPENROUTER_MODEL` (via action).
- PR metadata is folded into the free-text `context` string only.

→ **Phase 1 must introduce a `changeId` input**: add `changeId?: string` to `ReviewOptions`;
in `ci.ts` read a new `CHANGE_ID` env var and pass it through. (CI wiring of `CHANGE_ID`
from the branch/PR is optional for this slice; the exercise's final verification sets it
directly for a local run.)

## Code References

- `packages/code-reviewer/src/agent.ts:33-42` — `createReviewAgent`: the `ToolLoopAgent` to
  attach `readPlan` to; comment `:39` marks the no-tools seam.
- `packages/code-reviewer/src/agent.ts:25-30,45-66` — `ReviewOptions`, `createReviewer`,
  `reviewCode` — where a `changeId` option threads in and where the plan-aware agent is built.
- `packages/code-reviewer/src/schemas.ts:56-60` — `reviewSchema` (preserve unchanged).
- `packages/code-reviewer/src/prompts.ts:14-35,42-53` — system rubric + user-prompt builder
  (plan-aware instructions go here, additively).
- `packages/code-reviewer/src/ci.ts:26-39` — diff read + `reviewCode` call (thread `CHANGE_ID`).
- `packages/code-reviewer/src/verdict.ts:29-44` — pure verdict (untouched).
- `packages/code-reviewer/src/verdict.test.ts` — the pattern for pure guardrail unit tests.
- `.github/actions/code-review/action.yml:43-104` — diff extraction + `npm run ci` env.
- `node_modules/ai/dist/index.d.ts:3366,3550,3585,1158,1169` — agent settings, `generate`,
  `.output`/`.steps`.

## Architecture Insights

- **The seam already exists.** `ToolLoopAgent<never, ToolSet, ReviewOutput>` was chosen
  precisely so tools could be added without restructuring (README `:5-7`, `:245-251`;
  `agent.ts:16-19`). This makes a *genuine* tool loop the low-risk path — no `generateObject`
  migration, no schema change.
- **"Model scores, code judges."** Derived state (pass/fail) is kept out of the model's
  output. The plan feature should honor this: the model reports plan alignment in
  `summary`/`findings`; any hard gating stays deterministic in code.
- **Injection-consciousness is a repo value.** `ci.ts` already keeps attacker-controlled PR
  text off the shell and caps body length; the action caps diff bytes. `readPlan` guardrails
  extend that posture to file access.
- **Tools are fixed at agent construction** (`ToolLoopAgentSettings.tools`). Since `changeId`
  is a *review-time* option, the plan-aware agent must be constructed **after** options are
  known (inside `reviewCode`/the reviewer method) — a small, contained restructure. Trade-off:
  a fresh agent per review call when a plan is requested; cheap, and `reviewCode`'s one-shot
  path already builds an agent per call.

## Recommended integration (smallest safe, real tool-loop)

**Where `readPlan` lives:** new flat module `src/readPlan.ts` (matches the "single files, no
barrels" convention), exporting a pure path resolver, a file reader, and a
`createReadPlanTool(ctx)` factory. Guardrail unit tests colocated as `src/readPlan.test.ts`.

**Phase 1 — input contract:** add `changeId?: string` to `ReviewOptions`; `ci.ts` reads
`CHANGE_ID` env and passes it. No behavior change when absent.

**Phase 2 — `readPlan` helper + guardrails:**
- Model-facing `inputSchema`: at most an optional `changeId` string (defaults to the bound
  one). The model **cannot** pass a path.
- Validate `changeId` against `^[a-z0-9]+(-[a-z0-9]+)*$` (kebab-case). This alone rejects
  `..`, `/`, `\`, leading dots, absolute paths, and `.env`.
- Hardcode the filename `plan.md`. Construct `path.join(contextRoot, "changes", changeId,
  "plan.md")`.
- **Defense in depth:** `resolve()` the result and assert `path.relative(allowedRoot,
  resolved)` neither starts with `..` nor is absolute (allowedRoot = `<contextRoot>/changes`).
- `contextRoot` is trusted config, not model input: default
  `resolve(process.cwd(), "../../context")` (correct from the package cwd in CI and locally),
  overridable via a `CONTEXT_ROOT` env / config field. No upward directory walking.
- On any validation failure or missing file, **return** a structured "not found / invalid"
  result the model can read (never throw into the loop, never leak absolute paths).

**Phase 3 — instructions + bounded loop:** when the plan tool is attached, extend the
system prompt additively: "call `readPlan` first; compare the diff to the plan; in `summary`
report implemented items, missing items, scope drift, and changes outside the plan; if no
plan is found, say so and review the diff only." Bound the loop with `stopWhen:
stepCountIs(3)` (one tool call + final generation, with headroom). Keep `output:
Output.object({ schema: reviewSchema })` — **contract unchanged**.

**Phase 4 — verification (see below).**

## What verification will prove the reviewer actually used plan.md

1. **Deterministic tool-call assertion (primary):** destructure `agent.generate()` for
   `toolCalls`/`steps` (in addition to `output`) and assert a `readPlan` call fired. Surface
   it (e.g. a debug flag / a small script / an added field in `ci.ts`'s log, not the JSON
   contract) so a run can be inspected. `GenerateTextResult` exposes this natively —
   `ai/dist/index.d.ts:1083,1158`.
2. **Guardrail unit tests (pure, no API):** `src/readPlan.test.ts` asserts the resolver
   **rejects** `../../.env`, absolute paths, `foo/bar`, `..`, `.env`, and empty/space ids,
   and **accepts** a valid kebab-case id → the expected `context/changes/<id>/plan.md`.
   Run via repo-root `npm test`.
3. **Negative behavior test:** a nonexistent `changeId` → tool returns "not found" → the
   review's `summary` states no plan was found and proceeds diff-only.
4. **Live self-review (final evidence):** run the updated reviewer over this branch's own
   diff with `CHANGE_ID=m5l3-agent-read-plan-tool`; show (a) a `readPlan` tool call in the
   trace, (b) the summary comparing diff↔plan with implemented/missing/scope-drift items,
   (c) no external side effects and no schema change.

**Verification commands:** `npm run lint` + `npm run build` (repo root, CI gate);
`packages/code-reviewer`: `npm run typecheck`; repo root `npm test` (guardrail unit tests);
optional live proof `CHANGE_ID=… npm run check`/`npm run ci`; `npm run eval` remains
available but is billable and out of scope for guardrail verification.

## Historical Context (from prior changes)

- `context/changes/code-reviewer-evals/plan.md` — the immediately prior slice that added the
  Promptfoo eval matrix and `reviewerProvider.ts`; establishes the "wrap the real
  `reviewCode()`" testing philosophy this change should keep.
- `context/changes/refactor-opportunities/plan.md` — general reviewer refactor notes.

## Related Research

- None prior for `readPlan`/tool-loop specifically; this is the first tool added to the
  reviewer.

## Open Questions

- **Does `changeId` come from the model or trusted config?** Recommendation: bind it from
  trusted config (`ReviewOptions.changeId`), and let the model optionally re-supply a
  *validated* `changeId` (demonstrates model-driven tool input while staying bounded). Final
  call deferred to `/10x-plan`.
- **CI provenance of `CHANGE_ID`** (branch/PR → change-id mapping) is out of scope for this
  slice; wire it manually for the final verification. Automatic derivation is a future
  enhancement.
- **Symlink hardening** (`fs.realpath` before the prefix check) is optional for an M5L3
  exercise; note it as defense-in-depth if the plan wants belt-and-suspenders.
