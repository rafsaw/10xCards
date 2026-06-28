# Code-Reviewer → Modular ToolLoopAgent Implementation Plan

## Overview

Convert `packages/code-reviewer` from a single-file, one-shot `generateText` reviewer into a **modular, reusable `ToolLoopAgent`-based** code-review agent. Schemas and prompts move into their own modules; the agent lives in a dedicated `src/agent.ts` and is exported so future promptfoo evals can consume it. No review tools are added in this change, and **no eval environment is configured** — the agent is built tool-ready so tools can be added later without restructuring.

## Current State Analysis

Everything lives in one file, `packages/code-reviewer/src/index.ts` (113 lines):

- `reviewSchema` (zod) — `summary`, `verdict: approve|comment|request_changes`, `findings[]` with `severity/title/detail/suggestion?` (`src/index.ts:15-32`). This is both the model-output contract and the runtime validation.
- `ReviewerConfig` + `FALLBACK_MODEL = "anthropic/claude-sonnet-4.5"` (`src/index.ts:34-45`).
- `loadEnv()` — native `process.loadEnvFile()`, ENOENT-tolerant (`src/index.ts:52-58`).
- `createReviewer()` — builds the OpenRouter provider, binds a model, returns `{ reviewCode }` that calls `generateText({ model, output: Output.object({ schema: reviewSchema }), system, prompt })` (`src/index.ts:61-86`).
- `reviewCode()` one-shot convenience wrapper (`src/index.ts:89-91`).
- A `main()` demo gated behind a direct-run check (`src/index.ts:94-113`).
- `src/check.ts` — end-to-end billable check: `createReviewer().reviewCode(...)` then `reviewSchema.parse(...)` (`src/check.ts:9-41`).

Key constraints discovered:

- **Standalone package**: own `package.json`/`node_modules`, `type: module`, `ai@^6.0.212`, `@openrouter/ai-sdk-provider@^2.10.0`, `zod@^4.4.3`. Does not touch the monorepo root.
- **Only `check.ts` imports the package exports** (grep across repo, excluding node_modules). No monorepo-root consumers — the refactor is contained. `check.ts` imports from `./index.js`.
- **TS config is strict**: `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `NodeNext`, `declaration: true`, `rootDir: src`. Type-only imports must use `import type`; relative imports must carry the `.js` extension.
- **Import must stay side-effect-free** — env is only loaded in CLI `main()`; consumers (and promptfoo) control env loading.

### Key Discoveries:

- `ToolLoopAgent` maps almost 1:1 onto today's `generateText` call (subagent-verified against `node_modules/ai/`):
  - `system` → **`instructions`** constructor option (there is **no `system` key**) — `node_modules/ai/src/agent/tool-loop-agent-settings.ts:49`.
  - `output: Output.object({ schema })` → **same `Output.object` helper**, set on the **constructor** `output` option — `tool-loop-agent-settings.ts:100`; `node_modules/ai/docs/03-agents/02-building-agents.mdx:162-181`.
  - `model: LanguageModel` → unchanged; a provider instance like `openrouter(modelId)` works exactly as with `generateText` — `tool-loop-agent-settings.ts:64`.
  - Call shape: `await agent.generate({ prompt })` (a bare string is **not** accepted — must be `{ prompt }`) — `node_modules/ai/src/agent/agent.ts:13-64`.
  - Validated object is read from **`result.output`** (not `result.experimental_output`, which is the deprecated alias) — `node_modules/ai/src/generate-text/generate-text-result.ts:171`.
- `tools` is optional; with **no tools**, the default `stopWhen: stepCountIs(20)` never trips (no tool calls), so the agent performs a single structured generation but is structured as an agent — the seam to add tools later — `tool-loop-agent-settings.ts:82`.
- `ToolLoopAgent` is the current, non-experimental class name (import from `'ai'`); `Output` is exported from `'ai'` as a namespace.
- Research doc (`context/changes/tool-loop-agent/research.md`) already mapped the codebase and confirmed the v6 renamed-API risk: `maxSteps`→`stopWhen: stepCountIs(n)`, `parameters`→`inputSchema`, `generateObject`→`generateText`/`Output.object`.

## Desired End State

`packages/code-reviewer` exposes the same public behavior as today (`createReviewer`, `reviewCode`, `reviewSchema`, `loadEnv`, `Review`) but internally:

- The review verdict is produced by a `ToolLoopAgent` created in `src/agent.ts` via `createReviewAgent(config)`.
- Model/provider resolution lives in its own `src/provider.ts` (a factory: `createModel(config)`), consumed by the agent.
- Schemas live in `src/schemas.ts`; prompts live in `src/prompts.ts` (single files, no barrels).
- `src/index.ts` is a **pure barrel module** — only re-exports the public surface (`reviewCode`, `createReviewer`, `createReviewAgent`, `reviewSchema`, `Review`, `loadEnv`, …). No demo/`main()` lives here anymore.
- A small **CLI** in `src/cli.ts` is the runnable entry point (`npm start`) for smoke-testing the module.
- **`reviewCode` is the primary eval-facing export** — the most external entry point a future promptfoo eval drives. `createReviewAgent` is also exported for lower-level access.

Verification (smoke-only): `npm run typecheck` passes and `npm start` (CLI smoke run) returns a `reviewSchema`-valid review. No billable check or build is gated.

## What We're NOT Doing

- **Not adding any review tools** (`readFile`/`searchCode`/`listFiles`/lint/typecheck) — `tools` stays empty/omitted. The agent is built tool-ready for a later change.
- **Not configuring a promptfoo eval environment** — no `promptfooconfig.yaml`, no eval deps, no provider adapter. We only ensure `reviewCode` is the clean eval-facing export.
- **Not adding a unit-test runner** (Vitest etc.) — verification is typecheck + a `npm start` smoke run, by design.
- **Not changing** the review contract (`reviewSchema` fields), the OpenRouter provider, the model defaults, or the env-loading strategy.
- **Not switching** the output mechanism to the "done-tool + staticToolCalls" pattern — final verdict stays `output: Output.object({ schema: reviewSchema })`.
- **Not touching** the monorepo root or any file outside `packages/code-reviewer/`.

## Implementation Approach

Two phases, each independently green (typecheck + smoke). Phase 1 is a pure mechanical extraction (move schema + prompt strings into modules, re-export from `index.ts`) with **no behavior change** — so any failure is isolated to module wiring. Phase 2 introduces the provider factory + the agent (`ToolLoopAgent`), rewires `createReviewer`/`reviewCode` onto it, and replaces the inline `main()` demo with a small CLI while turning `index.ts` into a pure barrel.

Module layout mirrors the course author's flat split — **`agent.ts`, `schemas.ts`, `prompts.ts`, `provider.ts`, `index.ts`** (+ `cli.ts`), single files, no barrels. The model/provider resolution (apiKey + model id + `createOpenRouter`) lives in `src/provider.ts` as a `createModel(config)` factory, which `src/agent.ts` consumes to build the `ToolLoopAgent`. `index.ts` becomes a barrel of re-exports only; the runnable demo moves to `src/cli.ts`.

## Phase 1: Extract schemas & prompts into modules

### Overview

Move `reviewSchema` (and its sub-types) into `src/schemas.ts`, and the system/user prompt text into `src/prompts.ts`. `src/index.ts` imports from the new modules and re-exports them so the public surface is unchanged. No agent yet; still `generateText`. This phase must be behavior-neutral.

### Changes Required:

#### 1. Review schema module

**File**: `packages/code-reviewer/src/schemas.ts` (new)

**Intent**: House the structured-output contract as its own module so both the agent and future promptfoo assertions can import it without pulling in agent/runtime code.

**Contract**: Export `reviewSchema` (unchanged shape from `src/index.ts:15-32`) and `export type Review = z.infer<typeof reviewSchema>`. Additionally export the reusable sub-pieces as named exports for eval ergonomics: `severitySchema` (`info|minor|major|critical`), `verdictSchema` (`approve|comment|request_changes`), and `findingSchema`. Compose `reviewSchema` from them. Keep the `.describe(...)` annotations verbatim (they steer the model).

#### 2. Prompts module

**File**: `packages/code-reviewer/src/prompts.ts` (new)

**Intent**: Separate prompt wording from wiring so prompts can be iterated (and later eval'd) independently.

**Contract**: Export `reviewSystemPrompt: string` (the two-sentence senior-reviewer instruction currently inline at `src/index.ts:76-78`) and `buildReviewPrompt(code: string, context?: string): string` (the array-join prompt builder currently at `src/index.ts:79-81`). Behavior must be identical to today's string.

#### 3. Rewire entry point (no behavior change)

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Consume the extracted modules instead of inline definitions, and re-export them so existing importers (`check.ts`, future consumers) keep working unchanged.

**Contract**: Remove the inline `reviewSchema`/`Review` and the inline prompt strings; `import` them from `./schemas.js` and `./prompts.js`. Re-export `reviewSchema`, `Review` (via `export type`), and optionally the prompt helpers. `createReviewer().reviewCode` now passes `system: reviewSystemPrompt` and `prompt: buildReviewPrompt(code, context)` into the still-present `generateText` call. `import type` for `Review` to satisfy `verbatimModuleSyntax`; relative imports keep `.js` extensions.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck` (in `packages/code-reviewer`)
- [ ] No remaining inline `reviewSchema`/prompt definitions in `index.ts` (grep)

#### Manual Verification:

- [ ] `npm start` smoke run still prints a review object identical in shape to before (subtraction-bug snippet) — confirms behavior-neutral extraction

**Implementation Note**: After Phase 1 typecheck passes, pause for the human to confirm the smoke output is unchanged before starting Phase 2.

---

## Phase 2: Provider factory, ToolLoopAgent, CLI, and barrel rewire

### Overview

Add `src/provider.ts` (a `createModel(config)` factory) and `src/agent.ts` (`createReviewAgent(config)` building a `ToolLoopAgent` with no tools, `instructions: reviewSystemPrompt`, `output: Output.object({ schema: reviewSchema })`). Introduce a `ReviewOptions` type carrying a `language` hint, threaded through `reviewCode` → `buildReviewPrompt` → the agent. Refactor `createReviewer`/`reviewCode` to drive the agent via `agent.generate({ prompt })` → `result.output`. Replace the inline `main()` demo with a small `src/cli.ts`; make `src/index.ts` a pure barrel. Update `package.json` (scripts + `exports` field) and the README. Public API stays back-compatible, with **`reviewCode` as the primary eval-facing export**.

### Changes Required:

#### 1. Provider factory module

**File**: `packages/code-reviewer/src/provider.ts` (new)

**Intent**: Isolate model/provider resolution behind a factory so the agent (and future evals/tools) get a model without knowing about OpenRouter wiring or env.

**Contract**: Move `ReviewerConfig`, `FALLBACK_MODEL`, and the apiKey/model/`createOpenRouter` resolution here (from `src/index.ts:34-68`). Also move `loadEnv()` here (env concerns sit with provider). Export:
- `createModel(config?: ReviewerConfig): LanguageModel` — resolves apiKey (throws the existing "Missing OpenRouter API key" error if absent), builds `createOpenRouter({ apiKey })`, returns `openrouter(config.model ?? process.env.OPENROUTER_MODEL ?? FALLBACK_MODEL)`.
- `ReviewerConfig`, `loadEnv`, `FALLBACK_MODEL`.

`LanguageModel` type imported from `"ai"`. Keep `loadEnv` ENOENT-tolerant exactly as today.

#### 2. Agent module

**File**: `packages/code-reviewer/src/agent.ts` (new)

**Intent**: The reusable core. Builds and returns a `ToolLoopAgent` bound to the resolved model, with the review contract as its structured output.

**Contract**: Export `createReviewAgent(config?: ReviewerConfig): ToolLoopAgent<…>` — calls `createModel(config)` from `./provider.js`, returns `new ToolLoopAgent({ model, instructions: reviewSystemPrompt, output: Output.object({ schema: reviewSchema }) })`. No `tools`; no explicit `stopWhen` (default `stepCountIs(20)`, noted in a comment — never trips without tools). Also export the review-time options type `ReviewOptions { language?: string; context?: string }` (the input shape `reviewCode` accepts — `language` is the reviewed code's language hint, `context` preserves today's optional context string). Import `ToolLoopAgent` + `Output` from `"ai"`, `reviewSystemPrompt` from `./prompts.js`, `reviewSchema` from `./schemas.js`. v6 names: `instructions` (not `system`), `output` on the constructor, result read from `.output`.

#### 3. Extend the prompt builder for `language`

**File**: `packages/code-reviewer/src/prompts.ts`

**Intent**: Thread the new `language` hint into the user prompt so the model knows the code's language; keep `context` working.

**Contract**: Change `buildReviewPrompt(code, context?)` → `buildReviewPrompt(code: string, options?: ReviewOptions)`. When `options.language` is set, prepend a language line (e.g. `Language: <language>`); when `options.context` is set, keep today's `Context:\n<context>` line. With no options, the prompt is byte-identical to Phase 1's. Import `ReviewOptions` (type-only) from `./agent.js` (or co-locate the type — implementer's call, but it must be barrel-exported once).

#### 4. Rewire reviewer + one-shot onto the agent

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Make `index.ts` a **pure barrel** — public surface only, no runtime demo — while `createReviewer`/`reviewCode` delegate to the agent. `reviewCode` is the headline eval-facing export.

**Contract**: Move the `createReviewer`/`reviewCode` definitions into `src/agent.ts` (next to `createReviewAgent`), or keep them here importing from `./agent.js` — implementer's call, but `index.ts` must end up containing **only `export … from` lines**. `createReviewer(config)` returns `{ reviewCode(code, options?: ReviewOptions) }` where `reviewCode` calls `createReviewAgent(config).generate({ prompt: buildReviewPrompt(code, options) })` and returns `result.output` (typed `Review`). Build the agent once per `createReviewer` call (model bound once). One-shot `reviewCode(code, config?, options?)` — keep `config` (provider) distinct from `options` (review-time); a single combined signature is acceptable if cleaner, but `language` must reach the prompt. Barrel re-exports: `reviewCode`, `createReviewer`, `createReviewAgent`, `reviewSchema`, `Review` (type), `ReviewOptions` (type), `ReviewerConfig` (type), `loadEnv`, `createModel`, and the prompt helpers. Remove the old inline provider/config/prompt/`main()` code.

#### 5. CLI entry point

**File**: `packages/code-reviewer/src/cli.ts` (new)

**Intent**: A small runnable entry for `npm start` smoke-testing — replaces the hardcoded `main()` demo with something that prepares review input.

**Contract**: `loadEnv()`, then assemble `{ code, language }` — read code from a CLI arg or stdin; fall back to the existing buggy sample (`a - b`) with `language: "typescript"` when no input is given so `npm start` works out of the box. Call `reviewCode(code, { language })` and `console.log(JSON.stringify(review, null, 2))`. Print the existing "Set OPENROUTER_API_KEY…" guidance + exit non-zero when the key is missing. This file owns the only side effects; it is the direct-run entry (no `import.meta.url` guard needed since it isn't imported by the library).

#### 6. package.json scripts + exports field

**File**: `packages/code-reviewer/package.json`

**Intent**: Point the runnable scripts at the CLI and formalize the public entry point.

**Contract**: `start` → `tsx src/cli.ts`; `dev` → `tsx watch src/cli.ts`. Leave `typecheck`, `build` as-is. Add an `exports` map formalizing the barrel as the public entry: `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }` (keep `main`/`types` for back-compat). The `check` script may remain (still valid via the public `reviewCode` path) but is no longer part of this change's success criteria.

#### 7. README

**File**: `packages/code-reviewer/README.md`

**Intent**: Reflect the new module layout, the agent, the CLI, and `reviewCode` as the eval entry.

**Contract**: Update "Usage", "Scripts", and "Notes" — describe the flat `agent.ts / schemas.ts / prompts.ts / provider.ts / index.ts (barrel) / cli.ts` layout; `ToolLoopAgent` (instructions/output/`result.output`); `reviewCode(code, options?: ReviewOptions)` with the `language` hint; `npm start` as a CLI smoke run; the `package.json` `exports` entry; and that **`reviewCode` is the export a future promptfoo eval drives** (eval env not configured here). Replace the Notes line describing `generateText({ output: Output.object(...) })`. Prose only.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] `reviewCode`, `createReviewer`, `createReviewAgent`, and the `ReviewOptions` type are exported from `index.ts` (grep)
- [ ] `index.ts` contains only re-exports — no `generateText`, no `main()`, no inline `system:`/`Output.object` (grep)
- [ ] `src/provider.ts` and `src/cli.ts` exist; `package.json` `start` points at `src/cli.ts` and has an `exports` map (grep)

#### Manual Verification:

- [ ] `npm start` smoke run prints a `reviewSchema`-valid review flagging the subtraction bug (and fails fast with guidance when `OPENROUTER_API_KEY` is unset)
- [ ] `reviewCode(code, { language })` returns a typed `Review` via the agent path, and the `language` hint reaches the prompt (eval-readiness — the export a promptfoo eval would call)

**Implementation Note**: After Phase 2 typecheck passes, pause for the human to run the `npm start` smoke run (one real OpenRouter call) and confirm the review before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- None added in this change — a unit-test runner (Vitest) is explicitly out of scope. Verification is typecheck + a `npm start` smoke run. The zod schema is its own runtime contract.

### Integration Tests:

- The existing `src/check.ts` (billable `npm run check`) remains valid via the public `reviewCode` path but is **not** a gate for this change. The `npm start` CLI smoke run is the chosen verification.

### Manual Testing Steps:

1. `cd packages/code-reviewer && npm run typecheck` — green.
2. `npm start` — CLI prints a structured review flagging the `a - b` subtraction bug (one real OpenRouter call). With no key set, it fails fast with the guidance message + exit code 1.
3. Confirm `reviewCode("…")` returns a typed `Review` via the agent path (the eval-facing export).

## Performance Considerations

No new performance surface. With no tools, the agent issues a single model generation (same cost profile as today's `generateText`). The default `stopWhen: stepCountIs(20)` is a safety cap that is never reached without tools.

## Migration Notes

Public API is preserved (`createReviewer`, `reviewCode`, `reviewSchema`, `Review`, `loadEnv`), so `check.ts` and any future importer keep working. `reviewCode`'s optional argument grows from a bare `context?` string into `ReviewOptions { language?, context? }` — back-compatible if `context` stays supported. Additive exports: `createReviewAgent`, `createModel`, `ReviewOptions` (`ReviewerConfig`/`loadEnv`/`FALLBACK_MODEL` now owned by `provider.ts`). The runnable demo moves from `index.ts`'s `main()` to `src/cli.ts`; `npm start`/`dev` scripts repoint and a `package.json` `exports` map formalizes the entry. No data migration.

## References

- Research: `context/changes/tool-loop-agent/research.md`
- AI SDK skill: `packages/code-reviewer/.claude/skills/ai-sdk/SKILL.md`
- `ToolLoopAgent` API (subagent-verified): `node_modules/ai/src/agent/tool-loop-agent-settings.ts:49,64,82,100`; `node_modules/ai/src/agent/agent.ts:13-64`; `node_modules/ai/src/generate-text/generate-text-result.ts:171`
- Building-agents guide (structured output): `node_modules/ai/docs/03-agents/02-building-agents.mdx:162-181`
- Current implementation: `packages/code-reviewer/src/index.ts:15-113`, `src/check.ts:9-41`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract schemas & prompts into modules

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — ac2e692
- [x] 1.2 No remaining inline `reviewSchema`/prompt definitions in `index.ts` (grep) — ac2e692

#### Manual

- [x] 1.3 `npm start` smoke run prints a shape-identical review (behavior-neutral extraction) — ac2e692

### Phase 2: Provider factory, ToolLoopAgent, CLI, and barrel rewire

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck`
- [x] 2.2 `reviewCode`, `createReviewer`, `createReviewAgent`, `ReviewOptions` exported from `index.ts` (grep)
- [x] 2.3 `index.ts` contains only re-exports — no `generateText`/`main()`/inline `system:`/`Output.object` (grep)
- [x] 2.4 `src/provider.ts` + `src/cli.ts` exist; `package.json` `start` points at `src/cli.ts` and has an `exports` map (grep)

#### Manual

- [x] 2.5 `npm start` smoke run prints a `reviewSchema`-valid review flagging the subtraction bug (fails fast without the key)
- [x] 2.6 `reviewCode(code, { language })` returns a typed `Review`; the `language` hint reaches the prompt (eval-readiness)
