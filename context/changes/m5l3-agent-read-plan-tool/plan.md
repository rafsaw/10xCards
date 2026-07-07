# readPlan Tool-Loop Capability for the Code Reviewer — Implementation Plan

## Overview

Extend `packages/code-reviewer` from a tool-less "diff in → structured verdict out" scorer
into a first **tool-loop agent** by adding one read-only capability: `readPlan`. The reviewer
gains the ability to call a bounded tool that reads `context/changes/<change-id>/plan.md` and
compares the git diff against the implementation plan — reporting implemented items, missing
items, scope drift, and out-of-plan changes — while preserving the existing `reviewSchema`
output contract and adding zero external side effects.

## Current State Analysis

Grounded in `context/changes/m5l3-agent-read-plan-tool/research.md`:

- The agent is **already** a `ToolLoopAgent<never, ToolSet, ReviewOutput>` (ai@6.0.212) with
  `output: Output.object({ schema: reviewSchema })` and **no tools** — explicitly "the seam
  to add review tools later" (`src/agent.ts:16-19,35-41`). So this is a real tool-loop
  integration, **not** a migration: attach a `tool({...})`, lower `stopWhen`, done.
- Verified against installed types: `tool`, `ToolLoopAgent`, `stepCountIs`, `Output`,
  `ToolSet` all import from `"ai"`; `ToolLoopAgentSettings` accepts `tools` + `output` +
  `stopWhen` together; `tool.execute(input, { abortSignal, ... })`; `inputSchema` accepts a
  zod v4 schema. `agent.generate()` returns `GenerateTextResult` exposing `.output` (typed
  `Review`) **and** `.toolCalls` / `.steps` — the deterministic proof-hook.
- The reviewer receives **no change-id or plan path** today — only `code` (the diff) plus
  `ReviewOptions = { language?, context? }` (`src/agent.ts:25-30`). `ci.ts` reads
  `DIFF_FILE`/`PR_TITLE`/`PR_BODY` from env (`src/ci.ts:26-39`); the composite action
  extracts the diff and runs `npm run ci` (`.github/actions/code-review/action.yml:43-104`).
- **Path fact:** the reviewer's `cwd` is always `packages/code-reviewer`, but
  `plan.md` lives at repo-root `context/changes/<id>/plan.md` — two levels up. Context root
  resolves to `<cwd>/../../context`.
- `reviewSchema` (`src/schemas.ts:56-60`) is the runtime contract and must not change;
  `findings[]` is already an optional array we can reuse for structured plan gaps.
- Pure-unit-test pattern exists (`src/verdict.test.ts`, Vitest, no API), run from repo root
  via `npm test`. tsconfig is `NodeNext` + `strict` + `verbatimModuleSyntax` (`.js` imports,
  `import type`), `rootDir: src` (new code lives in `src/`).

## Desired End State

When a `changeId` is available, the reviewer calls `readPlan` **before** producing its
verdict, reads `context/changes/<changeId>/plan.md`, and its `summary` + `findings` compare
the diff to the plan (implemented / missing / scope-drift / out-of-plan). When no plan is
found (or no `changeId` is supplied), it states that plainly and reviews the diff only —
identical to today's behavior. The tool can **only** read `plan.md` under
`context/changes/<validated-kebab-id>/`; every traversal / absolute-path / `.env` / arbitrary
-file attempt is rejected deterministically. `reviewCode`'s signature and `reviewSchema`
output are unchanged. Proof that the plan was used is a `readPlan` entry in the generation's
`.toolCalls`, plus passing guardrail unit tests.

### Key Discoveries:

- `src/agent.ts:39` — the "no tools yet" seam; tools + `output` coexist on the same agent.
- `ai/dist/index.d.ts:3366` (`ToolLoopAgentSettings`), `:3585` (`generate` → `.output`),
  `:1083`/`:1158` (`.toolCalls`/`.steps`); `tool` re-exported at `:8`; `stepCountIs` at `:1032`.
- `src/ci.ts:26-39` and `.github/actions/code-review/action.yml:82-104` — where `CHANGE_ID`
  threads in.
- Tools are fixed at agent construction → the plan-aware agent must be built **after**
  `changeId` is known (inside the reviewer method), keeping the tool-less path for no-plan runs.

## What We're NOT Doing

- **No write-tools** and **no external side effects** — no GitHub comments/labels beyond the
  existing advisory flow, no Jira/Linear/Slack, no network calls other than the model.
- **No schema change** — `reviewSchema` / `Review` / `computeVerdict` untouched; no new
  output fields. `reviewCode`'s public signature is preserved.
- **No arbitrary file access** — the tool reads only `plan.md`; the model never supplies a
  path, only an optional validated kebab-case `changeId`.
- **No new runtime dependencies** — uses `ai`'s `tool`/`stepCountIs` and `node:fs`/`node:path`.
- **No eval/promptfoo changes** required to ship (evals remain billable and out of the
  verification path); an optional eval note only.
- **No branch→change-id database** — CI derives the id from the branch's last path segment;
  a miss degrades to diff-only.

## Implementation Approach

Four additive phases. Phase 1 opens a trusted `changeId` input (library + `ci.ts` + CI
action). Phase 2 builds `src/readPlan.ts` — a pure, guarded resolver/reader plus a `tool`
factory. Phase 3 wires the tool into the agent behind the presence of `changeId`, bounds the
loop with `stepCountIs(3)`, and extends the system prompt additively so the base (tool-less)
behavior is byte-for-byte preserved. Phase 4 verifies: pure guardrail unit tests, a
tool-call-trace assertion, and a live self-review of this branch against its own `plan.md`.

Each phase is independently revertible (see Rollback notes). Nothing in Phases 1–2 changes
runtime behavior until Phase 3 attaches the tool.

## Critical Implementation Details

- **Guardrail is structural, not just regex.** The model-facing input is at most a
  `changeId` string validated against `^[a-z0-9]+(-[a-z0-9]+)*$`; the filename `plan.md` is
  hardcoded; the path is `resolve(<contextRoot>/changes/<changeId>/plan.md)` and must satisfy
  `path.relative(allowedRoot, resolved)` being neither `..`-prefixed nor absolute. Two
  independent layers (charset regex + resolved-prefix check) must both pass.
- **Never leak the filesystem to the model.** The tool result returns only the repo-relative
  path `context/changes/<id>/plan.md` (never an absolute path) and, on failure, a terse
  reason — no `errno`/absolute paths. `execute` must not throw into the loop; it returns a
  `{ found: false, reason }` object the model can read.
- **Agent lifetime.** Tools are fixed at construction, so build the plan-aware agent inside
  the reviewer method once `changeId` is known; when `changeId` is absent, reuse the existing
  tool-less agent so the current single-generation path is untouched.
- **Loop bound.** `stopWhen: stepCountIs(3)` — enough for one `readPlan` call plus the final
  structured generation (with a little headroom), never an unbounded loop.
- **Tool must actually fire (F1).** With a bound `Output.object` and `toolChoice: 'auto'`, a
  model can jump straight to the verdict without calling `readPlan`. Mitigation: the
  `planReviewInstructions` prompt states emphatically that the model **MUST** call `readPlan`
  before scoring, and the Phase 4 verifier **asserts** a `readPlan` tool call occurred
  (exit non-zero otherwise) — so a skip is caught, not silently passed. We deliberately do
  **not** force it via `prepareStep`/`toolChoice: 'required'` (fiddly interplay with bound
  structured output, over-engineered for this slice).

---

## Phase 1: Integration Point / Input Contract

### Overview

Introduce a trusted `changeId` (and optional `contextRoot`) input that flows library →
`ci.ts` → CI action, with **no behavior change** when absent. This is the seam the tool binds
to in Phase 3.

### Changes Required:

#### 1. Review-time options

**File**: `packages/code-reviewer/src/agent.ts`

**Intent**: Add the trusted input channel the plan tool will bind to, without touching the
existing generation path yet.

**Contract**: Extend `ReviewOptions` with `changeId?: string` and `contextRoot?: string`
(both optional; review-time, not provider config). `buildReviewPrompt` is unaffected (it
ignores these). No wiring into the agent in this phase.

#### 2. CI entry reads CHANGE_ID

**File**: `packages/code-reviewer/src/ci.ts`

**Intent**: Let the PR-reviewer entry pass a change-id to the reviewer so CI can become
plan-aware in Phase 3.

**Contract**: Read `process.env.CHANGE_ID` (optional) and pass it as `options.changeId` to the
existing `reviewCode(diff, { language, context, changeId })` call. When unset, behavior is
identical to today. stdout stays the single JSON object; no new stdout fields.

#### 3. CI action derives and forwards the change-id

**File**: `.github/actions/code-review/action.yml` and `.github/workflows/ai-code-review.yml`

**Intent**: Derive a change-id from the PR branch and hand it to `npm run ci`, so PR reviews
read the branch's plan when one exists.

**Contract**: Add an optional `head-ref` input to the composite action (fed from
`github.event.pull_request.head.ref` in the workflow). In the "Run review agent" step, compute
`CHANGE_ID="${HEAD_REF##*/}"` (last path segment) and export it in that step's `env`. A branch
without a matching plan yields a graceful diff-only review (the tool returns "not found").
No new permissions, comments, or labels.

#### 4. Exclude planning docs from the reviewed diff (F3)

**File**: `.github/actions/code-review/action.yml`

**Intent**: Keep the reviewed diff focused on code so the ~12 KB byte cap isn't consumed by
large planning markdown (`context/changes/**` plan/research/brief docs) before real code is
seen — otherwise the plan-aware self-review compares the plan against the plan docs, not the
code.

**Contract**: Add `':(exclude)context/**'` to the `git diff` pathspec list in the "Extract PR
diff" step (`action.yml:60-69`), alongside the existing lockfile/`dist`/generated excludes.
The Phase 4 verifier independently scopes its diff to `packages/code-reviewer/` for the same
reason.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `cd packages/code-reviewer && npm run typecheck`
- Lint passes: `npm run lint` (repo root)
- Build passes: `npm run build` (repo root)
- Existing unit tests still pass: `npm test` (repo root)
- Action YAML remains valid (no schema/lint error in `.github/actions/code-review/action.yml`)

#### Manual Verification:

- `CHANGE_ID` unset → `npm run ci` output is byte-identical in shape to before (diff-only).
- Reading `action.yml`, `HEAD_REF##*/` correctly yields `m5l3-agent-read-plan-tool` for
  branch `learning/m5l3-agent-read-plan-tool`.
- `action.yml`'s diff pathspec now includes `':(exclude)context/**'` (F3).

**Implementation Note**: After automated verification passes, pause for human confirmation of
the manual checks before Phase 2.

---

## Phase 2: `readPlan` Helper + Path Guardrails

### Overview

Add `src/readPlan.ts`: a pure, unit-testable path resolver and file reader with hard
guardrails, plus a `tool()` factory. No agent wiring yet — this phase is fully covered by
pure unit tests with **no** API calls.

### Changes Required:

#### 1. Guarded resolver + reader + tool factory

**File**: `packages/code-reviewer/src/readPlan.ts` (new)

**Intent**: Provide the read-only plan-access primitive and its bounded `ai` tool, such that
the model can only ever read `plan.md` under a validated `context/changes/<id>/` directory.

**Contract**: Exports —
- `CHANGE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/` and `defaultContextRoot()` →
  `resolve(process.cwd(), "../../context")`.
- `resolvePlanPath({ changeId, contextRoot })`: pure. Validates `changeId` against
  `CHANGE_ID_PATTERN`; builds `join(contextRoot, "changes", changeId, "plan.md")`; resolves
  it; asserts `path.relative(resolve(contextRoot, "changes"), resolved)` is neither
  `..`-prefixed nor absolute. Returns `{ absolutePath, relativePath }` where `relativePath` is
  always `context/changes/<changeId>/plan.md`. Throws a typed `PlanAccessError` on any
  violation (invalid id, traversal, absolute).
- `readPlan({ changeId, contextRoot })`: async. On invalid id / guardrail failure returns
  `{ found: false, reason }` (no throw, no absolute path in `reason`). Resolves, then
  **`fs.realpath` the resolved path and re-assert it is still within `allowedRoot`** before
  reading (F4 — defends against a symlinked `plan.md` escaping the root); on escape →
  `{ found: false, reason }`. Then `fs.readFile`; `ENOENT` (incl. realpath of a missing file)
  → `{ found: false, reason: "No plan.md at <relativePath>" }`; success →
  `{ found: true, path: relativePath, content }`.
- `createReadPlanTool({ changeId: boundChangeId, contextRoot })`: returns `tool({ description,
  inputSchema, execute })`. `inputSchema` = `z.object({ changeId: z.string().optional()
  .describe("kebab-case change id; defaults to the change under review") })`. `execute`
  uses `input.changeId ?? boundChangeId`, calls `readPlan`, and returns the `readPlan` result
  object. `description` tells the model this reads the implementation plan for the change.

Guardrail note (counterintuitive, keep as snippet):

```ts
// Two independent layers must both pass. The regex alone rejects "..", "/", "\", leading
// dots and ".env"; the resolved-prefix check is defense-in-depth against any future path
// construction change. Never surface an absolute path back to the model.
const rel = path.relative(allowedRoot, resolved);
if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) throw new PlanAccessError(...);
```

#### 2. Barrel export

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Re-export the public `readPlan` surface for tests and reuse, matching the
barrel-only convention.

**Contract**: `export { readPlan, resolvePlanPath, createReadPlanTool, CHANGE_ID_PATTERN }` and
`export type { ... }` from `./readPlan.js`.

#### 3. Guardrail unit tests (F5 — authored here, alongside the module)

**File**: `packages/code-reviewer/src/readPlan.test.ts` (new)

**Intent**: Lock the path guardrails and no-plan behavior with pure, fast tests, created in
the same phase as the module so the guarantees ship together.

**Contract**: Vitest suite over `resolvePlanPath`/`readPlan` covering the reject/accept +
no-absolute-path-leak + missing-plan + symlink-escape matrix (see Phase 4 Testing Strategy).
No API calls.

### Success Criteria:

#### Automated Verification:

- Guardrail unit tests pass: `npm test` (repo root) — new `src/readPlan.test.ts` green
- Typecheck passes: `cd packages/code-reviewer && npm run typecheck`
- Lint passes: `npm run lint` (repo root)
- Build passes: `npm run build` (repo root)

#### Manual Verification:

- Reading the tests confirms rejection of: `../../.env`, `../secrets`, an absolute path,
  `foo/bar`, `..`, `.env`, empty string, and uppercase/space ids; and acceptance of
  `m5l3-agent-read-plan-tool` → `context/changes/m5l3-agent-read-plan-tool/plan.md`.
- No absolute paths appear in any `readPlan` failure `reason`.
- A symlinked `plan.md` pointing outside `allowedRoot` is rejected by the `realpath` re-check (F4).

**Implementation Note**: Pause for human confirmation after automated verification before
Phase 3.

---

## Phase 3: Agent Wiring — Bounded Tool Loop + Plan-Aware Instructions

### Overview

Attach `readPlan` to the agent **only when a `changeId` is present**, bound the loop with
`stepCountIs(3)`, and extend the system prompt additively so the tool-less path stays
byte-for-byte identical. Expose the tool-call trace for verification without changing the
public `reviewCode` contract.

### Changes Required:

#### 1. Plan-aware agent construction

**File**: `packages/code-reviewer/src/agent.ts`

**Intent**: Build a tool-loop agent that can read the plan when a change is under review,
while preserving the existing tool-less single-generation agent for no-plan runs.

**Contract**: `createReviewAgent(config, planContext?)` where
`planContext = { changeId, contextRoot }`. When `planContext` is provided, construct the
`ToolLoopAgent` with `tools: { readPlan: createReadPlanTool(planContext) }`,
`stopWhen: stepCountIs(3)`, and `instructions: reviewSystemPrompt + planReviewInstructions`.
When absent, the current construction is unchanged. `createReviewer`/`reviewCode` build the
plan-aware agent inside the review call when `options.changeId` is set (resolving
`contextRoot = options.contextRoot ?? defaultContextRoot()`), else reuse the tool-less agent.
Public `reviewCode(code, options?, config?): Promise<Review>` signature and return type
unchanged.

#### 2. Observability without a new public method (F2)

**File**: `packages/code-reviewer/src/agent.ts` (export the agent builder) and
`packages/code-reviewer/src/ci.ts`

**Intent**: Let `ci.ts` and the Phase 4 verifier observe whether `readPlan` fired, without
adding a public `reviewCodeWithTrace` to the reviewer's API — the eval-facing `reviewCode`
stays the single public entry.

**Contract**: Keep `reviewCode`/`createReviewer` returning `Review` unchanged. Ensure
`createReviewAgent(config, planContext?)` (change #1) is exported from the barrel so callers
that want the trace can build the agent and read `.output` + `.toolCalls` off
`agent.generate(...)` directly. `ci.ts` builds the plan-aware agent itself when `CHANGE_ID`
is set, prints the same review JSON to **stdout**, and logs `plan tool calls: N (readPlan)`
to **stderr** only (stdout contract unchanged). The Phase 4 verifier uses the same
build-agent-directly path.

#### 3. Plan-aware instructions

**File**: `packages/code-reviewer/src/prompts.ts`

**Intent**: Steer the model to consult the plan and report alignment, only when the tool is
attached — leaving the base rubric prompt untouched.

**Contract**: Add exported `planReviewInstructions` string: instruct the model to call
`readPlan` first; if `found`, compare the diff to the plan and put implemented / missing /
scope-drift / out-of-plan observations in `summary`, **and** emit `findings[]` entries
(severity per impact) for missing plan items and out-of-plan changes; if not `found`, state
"no plan found" in `summary` and review the diff only. Emphasize the six-criteria scoring is
unchanged. `reviewSystemPrompt` and `buildReviewPrompt` are not modified.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `cd packages/code-reviewer && npm run typecheck`
- Lint passes: `npm run lint` (repo root)
- Build passes: `npm run build` (repo root)
- Existing unit tests still pass: `npm test` (repo root)

#### Manual Verification:

- With `changeId` unset, a `reviewCode` run is behaviorally unchanged (tool-less, single
  generation) — confirmed via `npm run check` (one billable call) or a no-changeId `npm run ci`.
- With `CHANGE_ID=m5l3-agent-read-plan-tool`, `npm run ci` stderr shows `plan tool calls: 1`
  (or more) and the review `summary` references plan items.

**Implementation Note**: Pause for human confirmation after automated verification before
Phase 4.

---

## Phase 4: Verification / Self-Review Against This Plan

### Overview

Prove — deterministically and live — that the reviewer reads the plan, compares the diff to
it, stays read-only, and adds no side effects.

### Changes Required:

#### 1. Guardrail unit tests (authored in Phase 2, asserted here as a suite)

**File**: `packages/code-reviewer/src/readPlan.test.ts` (new; created in Phase 2)

**Intent**: Lock the path guardrails against regression with pure, fast tests.

**Contract**: Vitest suite over `resolvePlanPath`/`readPlan` covering the reject/accept matrix
from Phase 2's manual criteria; asserts no absolute path leaks in failure reasons. No API calls.

#### 2. Live plan-usage verifier

**File**: `packages/code-reviewer/src/verify-plan-usage.ts` (new)

**Intent**: Provide the final evidence artifact: a one-shot, read-only script that runs the
plan-aware reviewer over this branch's own diff and asserts a `readPlan` tool call fired.

**Contract**: `loadEnv()`; capture the diff scoped to code —
`git diff <base> HEAD -- packages/code-reviewer` (excludes the planning docs, per F3) — to a
temp file, or read `DIFF_FILE`. Build the plan-aware agent directly via
`createReviewAgent(config, { changeId: "m5l3-agent-read-plan-tool", contextRoot })` and call
`agent.generate({ prompt: buildReviewPrompt(diff, { language: "typescript" }) })` (no new
public method — F2). Assert `result.toolCalls.some(c => c.toolName === "readPlan")`; print the
tool-call count, `result.output.summary`, and any plan-gap `findings`; exit non-zero if no
`readPlan` call occurred. Add an npm script `verify:plan` → `tsx src/verify-plan-usage.ts`.
Read-only: no comments, labels, writes, or network beyond the model call.

#### 3. Negative-path check

**File**: `packages/code-reviewer/src/readPlan.test.ts` (extend)

**Intent**: Prove graceful degradation when no plan exists.

**Contract**: Assert `readPlan({ changeId: "no-such-change-xyz", contextRoot })` returns
`{ found: false }` with a repo-relative reason; document that the reviewer then states
"no plan found" (covered behaviorally by the live verifier with a bogus id, optional).

#### 4. Docs

**File**: `packages/code-reviewer/README.md`

**Intent**: Record the new capability, the guardrail model, and the verification command.

**Contract**: Add a short "readPlan (plan-aware review)" subsection: what it reads, the
kebab-id guardrail, `CHANGE_ID`/`changeId` inputs, the `stepCountIs(3)` bound, and
`npm run verify:plan`. Note read-only / no-side-effects.

### Success Criteria:

#### Automated Verification:

- All unit tests pass incl. guardrails + negative path: `npm test` (repo root)
- Typecheck passes: `cd packages/code-reviewer && npm run typecheck`
- Lint passes: `npm run lint` (repo root)
- Build passes: `npm run build` (repo root)

#### Manual Verification:

- `npm run verify:plan` (with this branch's diff + `CHANGE_ID=m5l3-agent-read-plan-tool`)
  prints ≥1 `readPlan` tool call and a `summary` that lists implemented / missing /
  scope-drift items against `plan.md`; exits 0.
- The same run with a bogus `changeId` produces a "no plan found" summary and still exits 0
  (diff-only), proving graceful degradation.
- Manual audit confirms no new external side effects (no GitHub/Jira/Linear/Slack/network
  writes) and `reviewSchema` output shape is unchanged.

**Implementation Note**: This is the terminal phase; on success, capture the verifier output
as the change's final evidence.

---

## Testing Strategy

### Unit Tests:

- `src/readPlan.test.ts` — the reject/accept guardrail matrix (`../../.env`, absolute paths,
  `foo/bar`, `..`, `.env`, empty/uppercase/space ids; valid kebab id → expected relative path),
  no-absolute-path-in-reason, the missing-plan `{ found: false }` path, and a symlink-escape
  rejection (F4). Pure, no API.
- `src/verdict.test.ts` — unchanged, must stay green.

### Integration Tests:

- `npm run check` — existing one-call end-to-end check (tool-less path unchanged).
- `src/verify-plan-usage.ts` (`npm run verify:plan`) — live tool-loop proof: `readPlan`
  called, diff↔plan comparison present, exit code reflects tool usage.

### Manual Testing Steps:

1. `CHANGE_ID` unset → `npm run ci` shape unchanged (diff-only).
2. `CHANGE_ID=m5l3-agent-read-plan-tool` → `npm run ci` stderr shows `plan tool calls: N`.
3. `npm run verify:plan` → ≥1 `readPlan` call + plan-comparison summary/findings, exit 0.
4. Bogus `changeId` → "no plan found", exit 0.
5. Confirm no PR comments/labels/network writes were produced by any of the above.

## Performance Considerations

Negligible: one extra local file read (`plan.md`, small) and at most one extra model step per
review. `stepCountIs(3)` caps the loop. No added network round-trips beyond the single tool
step the model may take.

## Migration Notes

Purely additive; no data or schema migration. Backward compatible — with no `changeId`,
every path (`reviewCode`, `ci.ts`, evals, `check`) behaves exactly as before.

**Rollback:**
- Phase 1 — revert `ReviewOptions`/`ci.ts`/`action.yml`/workflow edits; inputs become inert.
- Phase 2 — delete `src/readPlan.ts` + its barrel export; nothing consumes it yet.
- Phase 3 — revert `agent.ts`/`prompts.ts`; the tool-less agent remains. `readPlan.ts` can stay
  dormant.
- Phase 4 — delete `verify-plan-usage.ts`, the `verify:plan` script, and README subsection;
  tests can stay.

## References

- Research: `context/changes/m5l3-agent-read-plan-tool/research.md`
- Seam / agent: `packages/code-reviewer/src/agent.ts:33-42`
- Output contract: `packages/code-reviewer/src/schemas.ts:56-60`
- CI entry: `packages/code-reviewer/src/ci.ts:26-39`;
  action: `.github/actions/code-review/action.yml:82-104`
- SDK types: `packages/code-reviewer/node_modules/ai/dist/index.d.ts:3366,3585,1083,1158,1032`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Integration Point / Input Contract

#### Automated

- [x] 1.1 Typecheck passes: `cd packages/code-reviewer && npm run typecheck` — a4fc30d
- [x] 1.2 Lint passes: `npm run lint` (repo root) — a4fc30d
- [x] 1.3 Build passes: `npm run build` (repo root) — a4fc30d
- [x] 1.4 Existing unit tests still pass: `npm test` (repo root) — a4fc30d
- [x] 1.5 Action YAML remains valid — a4fc30d

#### Manual

- [x] 1.6 `CHANGE_ID` unset → `npm run ci` output shape unchanged (diff-only) — a4fc30d
- [x] 1.7 `HEAD_REF##*/` yields `m5l3-agent-read-plan-tool` for the branch — a4fc30d
- [x] 1.8 `action.yml` diff pathspec includes `':(exclude)context/**'` (F3) — a4fc30d

### Phase 2: readPlan Helper + Path Guardrails

#### Automated

- [x] 2.1 Guardrail unit tests pass: `npm test` (repo root) — 1471575
- [x] 2.2 Typecheck passes: `cd packages/code-reviewer && npm run typecheck` — 1471575
- [x] 2.3 Lint passes: `npm run lint` (repo root) — 1471575
- [x] 2.4 Build passes: `npm run build` (repo root) — 1471575

#### Manual

- [x] 2.5 Reject/accept matrix confirmed by reading the tests — 1471575
- [x] 2.6 No absolute paths appear in any `readPlan` failure reason — 1471575
- [x] 2.7 Symlinked `plan.md` escaping `allowedRoot` is rejected (F4 realpath re-check) — 1471575

### Phase 3: Agent Wiring — Bounded Tool Loop + Plan-Aware Instructions

#### Automated

- [x] 3.1 Typecheck passes: `cd packages/code-reviewer && npm run typecheck`
- [x] 3.2 Lint passes: `npm run lint` (repo root)
- [x] 3.3 Build passes: `npm run build` (repo root)
- [x] 3.4 Existing unit tests still pass: `npm test` (repo root)

#### Manual

- [x] 3.5 `changeId` unset → behavior unchanged (`npm run check` / no-changeId `npm run ci`)
- [x] 3.6 `CHANGE_ID=m5l3-agent-read-plan-tool` → stderr shows `plan tool calls: ≥1` and summary references the plan

### Phase 4: Verification / Self-Review Against This Plan

#### Automated

- [ ] 4.1 All unit tests pass incl. guardrails + negative path: `npm test` (repo root)
- [ ] 4.2 Typecheck passes: `cd packages/code-reviewer && npm run typecheck`
- [ ] 4.3 Lint passes: `npm run lint` (repo root)
- [ ] 4.4 Build passes: `npm run build` (repo root)

#### Manual

- [ ] 4.5 `npm run verify:plan` prints ≥1 `readPlan` call + diff↔plan comparison, exit 0
- [ ] 4.6 Bogus `changeId` → "no plan found", exit 0 (graceful degradation)
- [ ] 4.7 Audit: no new external side effects; `reviewSchema` output shape unchanged
