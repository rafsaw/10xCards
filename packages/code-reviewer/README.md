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

| Module        | Responsibility                                                                |
| ------------- | ----------------------------------------------------------------------------- |
| `schemas.ts`  | `reviewSchema` (+ `criterion`/`criteria`/`finding` sub-schemas) and `Review`. |
| `prompts.ts`  | `reviewSystemPrompt` + `buildReviewPrompt(code, options?)`.                   |
| `provider.ts` | `createModel(config)` factory, `loadEnv`, `FALLBACK_MODEL`.                   |
| `verdict.ts`  | `computeVerdict(criteria)` — pure pass/fail from the six scores + thresholds. |
| `agent.ts`    | `createReviewAgent` (`ToolLoopAgent`), `createReviewer`, `reviewCode`.        |
| `index.ts`    | Pure barrel — public re-exports only.                                         |
| `cli.ts`      | `npm start` smoke-run entry (a side-effecting smoke harness).                 |
| `ci.ts`       | `npm run ci` PR-reviewer entry — reads PR inputs, prints verdict JSON.        |

Eval assets live outside `src/` (they are not part of the shipped library):

| Path                                   | Responsibility                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `promptfooconfig.yaml`                 | The Promptfoo matrix: 3 models × 1 flawed diff, the LLM judge, and both assertions.   |
| `evals/reviewerProvider.ts`            | Custom provider wrapping `reviewCode()` — one instance per model under test.           |
| `evals/cases/react19-migration.diff`   | The single flawed React 16→19 migration fixture (three planted flaws).                 |
| `evals/assertions/verdictFail.mjs`     | Deterministic assertion: schema-valid `Review` that `computeVerdict()` **fails**.      |

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

| Command             | Action                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`         | Run the CLI (`src/cli.ts`) once — a smoke test via `tsx`.                                                                                                                               |
| `npm run dev`       | Same, in watch mode.                                                                                                                                                                    |
| `npm run check`     | End-to-end integration check: one **real** OpenRouter call, validated against the zod schema. Exits non-zero on failure.                                                                |
| `npm run verify:plan` | Live plan-usage proof: reviews this branch's own `packages/code-reviewer` diff with the plan-aware agent and asserts a `readPlan` tool call fired. One **real** call; exits non-zero if the plan wasn't consulted. See "readPlan (plan-aware review)". |
| `npm run ci`        | PR-reviewer entry (`src/ci.ts`): reads `PR_TITLE`/`PR_BODY`/`DIFF_FILE`, runs the agent, prints `{ summary, criteria, findings?, overall, pass }` JSON. Drives the CI composite action. |
| `npm run typecheck` | `tsc --noEmit`.                                                                                                                                                                         |
| `npm run build`     | Emit JS + `.d.ts` to `dist/`.                                                                                                                                                           |
| `npm run eval`      | Run the Promptfoo model-comparison matrix. **Makes real, billable OpenRouter calls** (one per model + one judge call per cell). See "Evals".                                            |
| `npm run eval:view` | Open Promptfoo's UI to browse the last run's side-by-side comparison.                                                                                                                   |

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
#   overall: 7.5, pass: true, findings: 0
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

`reviewCode` returns a value validated against `reviewSchema` — six per-criterion
1–10 scores plus optional findings:

```ts
{ summary: string;
  criteria: {
    implementationCorrectness: { score: number; rationale: string };
    idiomaticity:              { score: number; rationale: string };
    complexityMaintainability: { score: number; rationale: string };
    testsRiskCoverage:         { score: number; rationale: string };
    documentation:             { score: number; rationale: string };
    securitySafety:            { score: number; rationale: string };
  };
  findings?: { severity: "info" | "minor" | "major" | "critical";
               title: string; detail: string; suggestion?: string }[];
  // Present only on the plan-aware path (readPlan); an explicit diff↔plan comparison.
  planAlignment?: { planFound: boolean;
                    implemented: string[]; missing: string[];
                    scopeDrift: string[]; outOfPlan: string[] } }
```

Pass/fail is **not** part of the schema — the model scores, code judges.
`computeVerdict(review.criteria)` derives `{ pass, overall }` deterministically:
`overall` is the mean of the six scores, and `pass` requires `overall >= 6` **and**
`implementationCorrectness.score >= 6` **and** `securitySafety.score >= 6` (named
constants `PASS_THRESHOLD` / `CORRECTNESS_FLOOR` / `SECURITY_FLOOR` in `verdict.ts`).

## Evals (Promptfoo model comparison)

A [Promptfoo](https://promptfoo.dev) eval compares **three OpenRouter models** on
**one** deliberately-flawed React 16→19 migration diff, so you can see side-by-side
which model catches the planted bugs. It drives the **real** `reviewCode()` agent
(via a custom provider), so the system prompt, rubric, and structured-output schema
are exactly what's under test — not a re-declared raw-model prompt.

**What it grades.** Each model's review is scored two independent ways, applied
uniformly to all three models:

1. **LLM-as-a-judge** (`llm-rubric`, an independent cheap judge at `temperature: 0`)
   — did the review identify all three planted flaws?
2. **Deterministic** (`evals/assertions/verdictFail.mjs`) — is the output a
   schema-valid `Review` **and** does `computeVerdict(criteria)` correctly return
   `pass: false` on the bad diff? This reuses the package's own contract, so it
   fails a model that hallucinates a passing verdict on obviously-broken code.

A `latency` guardrail (120 s) catches a hung/runaway call. There is **no** cost
guardrail: the eval measures the frozen `reviewCode()`, which returns only the
`Review` (no token usage), so the provider has no per-call cost to assert on —
asserting cost would require changing `reviewCode`'s signature, which is out of scope.

**The three planted flaws** in `evals/cases/react19-migration.diff`, one per category:

1. **Correctness** — the migrated `useEffect` that subscribes to `notificationBus`
   drops its cleanup (no returned unsubscribe), leaking a listener on every channel
   change and on unmount.
2. **React-19 API removal** — `ReactDOM.render` is left in place after switching to
   `react-dom/client`; `render()` was removed in React 19 (must be
   `createRoot(container).render(...)`).
3. **Security/safety** — the notification body is rendered with
   `dangerouslySetInnerHTML` from unvalidated, user-controlled `bodyHtml` (an XSS
   vector introduced during the migration).

The diff also contains genuine, correct migration changes (class → hooks,
`react-dom/client` import, string-ref → `useRef`, a controlled `<select>`) so the
flaws aren't the only edits.

**How to run:**

```bash
cd packages/code-reviewer
npm install                 # pulls promptfoo (a devDependency)
# ensure .env has OPENROUTER_API_KEY (the judge uses it too)
npm run eval                # runs the 3-model matrix — REAL, billable calls
npm run eval:view           # browse the side-by-side comparison UI
```

Required env: `OPENROUTER_API_KEY` (used by both the models under test and the
`openrouter:openai/gpt-4o-mini` judge). Model ids in `promptfooconfig.yaml` are
verified against <https://openrouter.ai/models> — edit the three `config.model`
values there if they drift.

> **Judge reliability matters too.** The judge is a plain (non-reasoning)
> `gpt-4o-mini` on purpose: an earlier `gpt-5-mini` judge intermittently returned
> the grader's JSON *schema placeholder* (`reason: "string"`) instead of grading,
> false-failing a review that actually caught all three flaws. Treat the grader as
> part of the system under test — if a verdict looks wrong, inspect the judge, not
> just the model.

> **Known tradeoff (accepted for this MVP).** `promptfoo` is a `devDependency`, and
> the CI review action (`.github/actions/code-review/action.yml`) runs `npm ci`
> inside this package on every PR — so it installs `promptfoo` even though CI never
> runs the eval. We accept that install cost rather than complicating the action.

## readPlan (plan-aware review)

The reviewer is a **tool-loop agent**: when a change is under review it can call one
read-only tool, `readPlan`, to fetch that change's implementation plan and compare the
diff against it (implemented / missing / scope-drift / out-of-plan). The comparison is
emitted in a dedicated structured `planAlignment` field (`planFound` + the four lists,
each empty when it has no items) as well as recapped in `summary` and mirrored as
`findings[]`. The CI comment renders `planAlignment` as its own **Plan alignment**
section so the diff↔plan check is always visible, never buried in prose. With no change
under review the reviewer is tool-less, `planAlignment` is omitted, and behavior is
exactly as before.

- **What it reads.** Only `context/changes/<changeId>/plan.md` — nothing else. The model
  never supplies a filesystem path, only an optional `changeId`; the filename `plan.md`
  is hardcoded.
- **Guardrail.** `changeId` must match kebab-case `^[a-z0-9]+(-[a-z0-9]+)*$`, and the
  resolved path must stay within `context/changes/` (a `realpath` re-check also rejects a
  symlinked `plan.md` escaping the root). Traversal (`../../.env`), absolute paths,
  dotfiles, and arbitrary files are rejected deterministically; failures return a terse,
  repo-relative reason and never leak an absolute path. Covered by `src/readPlan.test.ts`
  (pure, no API).
- **Inputs.** `reviewCode(code, { changeId })` (library) or `CHANGE_ID` env (CI, derived
  from the PR branch's last path segment). Absent/unmatched → a graceful diff-only review.
- **Loop bound.** The plan-aware agent is bounded by `stopWhen: stepCountIs(3)` — one
  `readPlan` call plus the final structured generation, never an unbounded loop.
- **Read-only / no side effects.** No writes, no PR comments or labels, no network beyond
  the single model call.

**Verify it end-to-end:**

```bash
cd packages/code-reviewer
# ensure .env has OPENROUTER_API_KEY
npm run verify:plan          # reviews this branch's diff; asserts readPlan fired (real call)
```

It prints the `readPlan` tool-call count, the review `summary`, and any plan-gap findings,
then exits non-zero if `readPlan` was not called. Override the target with
`CHANGE_ID=<id>` and the diff base with `BASE_REF=<ref>` (default `main`), or feed a
prepared diff via `DIFF_FILE=<path>`.

## CI integration (advisory PR review)

This agent runs automatically on every pull request to `main`:

- **Workflow:** `.github/workflows/ai-code-review.yml` — triggers on `pull_request`
  (`opened`, `synchronize`, `reopened`, `labeled`) to `main`. Top-level
  `permissions: {}`; the job re-grants `pull-requests: write` + `issues: write`.
  Fork PRs are skipped (they can't read the secret), and `labeled` events only run
  when the label is `ai-cr:review`.
- **Composite action:** `.github/actions/code-review/action.yml` owns the mechanics
  — `npm ci`, extract the PR diff (excluding `package-lock.json`, `**/dist/**`,
  `**/*.generated.*` **before** a ~12 KB byte cap), run `npm run ci`, format the
  comment (`format-comment.sh`), post it, and apply the verdict label.
- **Required secret:** repository secret `OPENROUTER_API_KEY` (set via
  `gh secret set OPENROUTER_API_KEY` or repo Settings → Secrets). The optional
  `model` action input overrides `OPENROUTER_MODEL`.

**Criteria & threshold.** The agent scores six 1–10 criteria —
implementation-correctness, idiomaticity, complexity/maintainability,
tests/risk-coverage, documentation, and security/safety. CI then computes the
verdict in code (`computeVerdict`): **pass** = overall mean ≥ 6 **and**
correctness ≥ 6 **and** security ≥ 6.

**Side-effects.** One PR comment with the summary + six-score table (plus a
truncation note when the diff is capped), and exactly one of two labels —
`ai-cr:passed` (green) or `ai-cr:failed` (red). Re-add the `ai-cr:review` label to
request another pass; the workflow removes it after running.

**Advisory only.** The review **never blocks merge** — the job does not `exit 1` on
a "failed" verdict; it's not a required status check.

**Known limitation.** This MVP posts a **new comment per run** — there is no comment
deduplication, so repeated runs accumulate comments on the PR. Single-canonical-comment
dedup is a noted future enhancement.

## Notes

- The review verdict comes from a `ToolLoopAgent` (`ai` v6) with
  `output: Output.object({ schema })` — the current structured-output API
  (`generateObject` is deprecated in v6). With no tools the default
  `stopWhen: stepCountIs(20)` never trips, so it issues a single generation today;
  the agent is the seam for adding review tools later.
- Importing the barrel (`index.ts`) is side-effect-free; `.env` is only loaded by
  the CLI (`src/cli.ts` calls `loadEnv()`), so consumers control env loading
  themselves. The `package.json` `exports` map formalizes the barrel as the entry.
