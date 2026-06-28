# @10xcards/code-reviewer

AI-assisted code reviewer sub-app. A small, standalone module wiring the
[AI SDK](https://ai-sdk.dev) (`ai`) `ToolLoopAgent` to the
[OpenRouter](https://openrouter.ai) provider with
[zod](https://zod.dev)-validated structured output — built tool-ready so review
tools can be added later without restructuring.

> Standalone package: it has its own `package.json` / `node_modules` and does
> **not** modify the monorepo root.

## Module layout

Flat split, single files, no barrels except `index.ts`:

| Module          | Responsibility                                                              |
| --------------- | -------------------------------------------------------------------------- |
| `schemas.ts`    | `reviewSchema` (+ `severity`/`verdict`/`finding` sub-schemas) and `Review`. |
| `prompts.ts`    | `reviewSystemPrompt` + `buildReviewPrompt(code, options?)`.                  |
| `provider.ts`   | `createModel(config)` factory, `loadEnv`, `FALLBACK_MODEL`.                  |
| `agent.ts`      | `createReviewAgent` (`ToolLoopAgent`), `createReviewer`, `reviewCode`.       |
| `index.ts`      | Pure barrel — public re-exports only.                                        |
| `cli.ts`        | `npm start` smoke-run entry (the only side effects).                         |

## Stack


| Package                            | Version    | Why                                                                                                          |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `ai`                               | `^6.0.212` | Newest line the **stable** OpenRouter provider peers on (`ai@^6`). `ai@7` only pairs with an alpha provider. |
| `@openrouter/ai-sdk-provider`      | `^2.10.0`  | Stable OpenRouter provider for the AI SDK.                                                                   |
| `zod`                              | `^4.4.3`   | Runtime schema + structured-output contract.                                                                 |
| `tsx`, `typescript`, `@types/node` | dev        | Run/typecheck TypeScript on Node directly.                                                                   |




## Setup

```bash
cd packages/code-reviewer
npm install
cp .env.example .env   # then add your OPENROUTER_API_KEY
```

Environment (loaded from `.env` via Node's native `process.loadEnvFile()` — no
extra dependency; see `loadEnv()` in `src/provider.ts`):


| Var                  | Required | Default                       |
| -------------------- | -------- | ----------------------------- |
| `OPENROUTER_API_KEY` | yes      | —                             |
| `OPENROUTER_MODEL`   | no       | `anthropic/claude-sonnet-4.5` |




## Scripts


| Command             | Action                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm start`         | Run the CLI (`src/cli.ts`) once — a smoke test via `tsx`.                                                                |
| `npm run dev`       | Same, in watch mode.                                                                                                     |
| `npm run check`     | End-to-end integration check: one **real** OpenRouter call, validated against the zod schema. Exits non-zero on failure. |
| `npm run typecheck` | `tsc --noEmit`.                                                                                                          |
| `npm run build`     | Emit JS + `.d.ts` to `dist/`.                                                                                            |




## Verifying the integration

`npm run check` confirms the whole pipeline end-to-end — env → OpenRouter
provider → model → `ToolLoopAgent` → zod-validated output — with a single
minimal (billable) request:

```bash
npm run check
# • API key present
# • Model: anthropic/claude-sonnet-4.5
# • Sending a minimal review request to OpenRouter...
# ✓ Integration OK in 1234ms
#   verdict: approve, findings: 0
```

Without a key it fails fast (`✗ OPENROUTER_API_KEY is not set`, exit code 1).

## Usage

The CLI smoke-run reviews a buggy snippet (or a code string passed as the first
arg):

```bash
npm start
```

As a library, for further integration — **`reviewCode` is the eval-facing
export** a future [promptfoo](https://promptfoo.dev) eval would drive (the eval
environment is not configured here):

```ts
import { createReviewer, reviewCode, reviewSchema, type Review } from "./src/index.ts";

// One-shot. Second arg is review-time options (`language`, `context`);
// an optional third arg selects the provider/model.
const review = await reviewCode("export const x = 1", { language: "typescript" });

// Reusable, model bound once.
const reviewer = createReviewer({ model: "anthropic/claude-sonnet-4.5" });
const r: Review = await reviewer.reviewCode("function f(){}", { context: "Optional context" });
```

Under the hood `createReviewer` builds a `ToolLoopAgent` (via
`createReviewAgent`) with `instructions: reviewSystemPrompt` and
`output: Output.object({ schema: reviewSchema })`; the validated review is read
from `result.output` of `agent.generate({ prompt })`.

`reviewCode` returns a value validated against `reviewSchema`:

```ts
{ summary: string;
  verdict: "approve" | "comment" | "request_changes";
  findings: { severity: "info" | "minor" | "major" | "critical";
              title: string; detail: string; suggestion?: string }[] }
```



## Notes

- The review verdict comes from a `ToolLoopAgent` (`ai` v6) with
`output: Output.object({ schema })` — the current structured-output API
(`generateObject` is deprecated in v6). With no tools the default
`stopWhen: stepCountIs(20)` never trips, so it issues a single generation today;
the agent is the seam for adding review tools later.
- Importing the barrel (`index.ts`) is side-effect-free; `.env` is only loaded by
the CLI (`src/cli.ts` calls `loadEnv()`), so consumers control env loading
themselves. The `package.json` `exports` map formalizes the barrel as the entry.

