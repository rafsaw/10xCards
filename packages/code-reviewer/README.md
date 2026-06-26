# @10xcards/code-reviewer

AI-assisted code reviewer sub-app. A small, standalone entry-point wiring the
[AI SDK](https://ai-sdk.dev) (`ai`) to the [OpenRouter](https://openrouter.ai)
provider with [zod](https://zod.dev)-validated structured output — the seed for
further code-review features.

> Standalone package: it has its own `package.json` / `node_modules` and does
> **not** modify the monorepo root.

## Stack

| Package | Version | Why |
| --- | --- | --- |
| `ai` | `^6.0.212` | Newest line the **stable** OpenRouter provider peers on (`ai@^6`). `ai@7` only pairs with an alpha provider. |
| `@openrouter/ai-sdk-provider` | `^2.10.0` | Stable OpenRouter provider for the AI SDK. |
| `zod` | `^4.4.3` | Runtime schema + structured-output contract. |
| `tsx`, `typescript`, `@types/node` | dev | Run/typecheck TypeScript on Node directly. |

## Setup

```bash
cd packages/code-reviewer
npm install
cp .env.example .env   # then add your OPENROUTER_API_KEY
```

Environment (loaded from `.env` via Node's native `process.loadEnvFile()` — no
extra dependency; see `loadEnv()` in `src/index.ts`):

| Var | Required | Default |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | — |
| `OPENROUTER_MODEL` | no | `anthropic/claude-sonnet-4.5` |

## Scripts

| Command | Action |
| --- | --- |
| `npm start` | Run `src/index.ts` once (demo) via `tsx`. |
| `npm run dev` | Same, in watch mode. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run build` | Emit JS + `.d.ts` to `dist/`. |

## Usage

The demo reviews a buggy snippet:

```bash
npm start
```

As a library, for further integration:

```ts
import { createReviewer, reviewCode, reviewSchema, type Review } from "./src/index.ts";

// One-shot
const review = await reviewCode("export const x = 1", { apiKey: process.env.OPENROUTER_API_KEY });

// Reusable, model bound once
const reviewer = createReviewer({ model: "anthropic/claude-sonnet-4.5" });
const r: Review = await reviewer.reviewCode("function f(){}", "Optional context");
```

`reviewCode` returns a value validated against `reviewSchema`:

```ts
{ summary: string;
  verdict: "approve" | "comment" | "request_changes";
  findings: { severity: "info" | "minor" | "major" | "critical";
              title: string; detail: string; suggestion?: string }[] }
```

## Notes

- Uses `generateText({ output: Output.object({ schema }) })` — the current AI SDK
  v6 structured-output API (`generateObject` is deprecated in v6).
- Importing the module is side-effect-free; `.env` is only loaded when run as a
  CLI (`main()` calls `loadEnv()`), so consumers control env loading themselves.
