# CI/CD Code-Review Workflow Implementation Plan

## Overview

Wire the existing M5L2 code-review agent (`packages/code-reviewer/`) into pull-request CI. On every PR to `main`, a GitHub Actions workflow invokes the agent through a local **composite action**, feeding it the PR title, (truncated) description, and a filtered/capped git diff. The agent scores the change against the **six 1–10 criteria** from `requirements.md` and emits structured output; CI derives a pass/fail verdict from a threshold, posts a PR comment with the per-criterion summary, and applies an `ai-cr:passed` / `ai-cr:failed` label. The review is **advisory only** — it never blocks merge.

Per the user's direction, the six-criteria structured output is **core**, not deferred: Phase 1 brings the agent contract to full fidelity so the action and workflow are built once against the final schema, never rewritten.

## Current State Analysis

- **The agent is built and library-shaped.** `reviewCode(code, options?, config?)` is the reusable export (`packages/code-reviewer/src/agent.ts:64-66`, re-exported via `src/index.ts`). It runs via `tsx` (no compiled artifact needed); `"type": "module"`, no `bin`, no `engines`.
- **The CLI is a smoke-test harness, not a PR reviewer.** `src/cli.ts:17-20` reads one positional arg and prints JSON; no flag/stdin/file/diff handling.
- **The current schema does not match requirements.** `reviewSchema` is `{ summary, verdict: "approve"|"comment"|"request_changes", findings[] }` (`src/schemas.ts:10-30`) — a 3-way enum with 4-level finding severity, **no per-criterion 1–10 scores**. The six criteria the requirements specify do not appear anywhere in the schema or prompt.
- **The prompt injects only `language` / `context`** around a fenced code block (`src/prompts.ts:18-29`).
- **Env & model:** `OPENROUTER_API_KEY` required (`src/provider.ts:38-41`), `OPENROUTER_MODEL` optional, default `anthropic/claude-sonnet-4.5` (`src/provider.ts:21`). `loadEnv()` tolerates a missing `.env`, so CI can inject vars directly.
- **CI mechanics exist only as a reference**, not in production: `.claude/skills/10x-impl-review-ci/references/workflow-template.yml` (triggers, `permissions:{}`, concurrency, fork guard, comment dedup marker) — built for `claude-code-action`; we copy its *mechanics*, not its brain.
- **The repo's only workflow** (`.github/workflows/ci.yml`) triggers on `master`; the working branch is `main`, so CI never fires (accepted `AGENTS.md` tripwire). Our workflow must target `main`.
- **Greenfield pieces that do not exist yet:** the workflow, any composite action (`action.yml` — this would be the repo's first), and the `OPENROUTER_API_KEY` **GitHub Actions secret** (only `SUPABASE_*` are wired into CI today).
- **Workspace shape:** `packages/code-reviewer` is a nested package but the root has no npm/pnpm workspaces config — the action must `cd packages/code-reviewer && npm ci` independently.

## Desired End State

Opening or updating a PR to `main` produces, within one CI run:

1. A **PR comment** containing the agent's summary and a per-criterion 1–10 score table, plus a truncation note if the diff was capped.
2. Exactly one of two labels — `ai-cr:passed` (green) or `ai-cr:failed` (red) — derived from the score threshold.
3. The check **never blocks merge** (advisory; not a required status).

Re-adding the `ai-cr:review` label re-runs the review; the workflow removes that label after running so it can be re-added to request another pass. Fork PRs (which cannot read the secret) are skipped cleanly.

Verify by opening a throwaway PR against `main`: confirm the comment, the label color/name, the truncation note on a large diff, the retry-on-label flow, and that a "failed" verdict does not block merge.

### Key Discoveries:

- `reviewCode(code, options?, config?)` is the stable entry — the CI adapter composes title + truncated description into `options.context` and passes the diff as `code`, so the **function signature stays unchanged**; only the return schema and prompt rubric evolve (`src/agent.ts:64-66`, `src/prompts.ts:18-29`).
- Pass/fail is **computed in code from the emitted scores**, not asked of the LLM — deterministic and unit-testable (threshold: overall mean ≥ 6 **and** implementation-correctness ≥ 6 **and** security ≥ 6).
- The reference template's `[skip ci]`/recursion guard exists only because it commits back to the branch; we commit nothing, so we **shed it entirely**. The only loop risk is self-triggered label events, handled by an `if:` predicate (`workflow-template.yml:80-102` — deliberately not copied).
- `github.event.label.name` is the single label that fired a `labeled` event — the correct predicate for retry-on-label, distinct from the template's `contains(labels.*.name, …)` which checks *current* labels (`workflow-template.yml:47`).
- Composite-action constraints: every `run` needs explicit `shell: bash`; secrets are **not** auto-available (pass as `inputs`); the workflow must `actions/checkout` first so `./.github/actions/...` is on disk.

## What We're NOT Doing

- **Business-alignment and architecture-fit criteria** — parked in `requirements.md:34-37` (require broader context). Six criteria only.
- **Blocking merge / required status check** — advisory only for now.
- **Comment deduplication** (single canonical comment via marker PATCH or `--edit-last`) — this MVP posts a **new comment per run**; dedup is a noted future enhancement.
- **promptfoo eval specs** (M5L3) — out of scope here; the new six-criteria schema becomes the contract those specs will later target.
- **The `claude-code-action` / Anthropic path** used by `10x-impl-review-ci` — we use the standalone Node agent + OpenRouter secret.
- **Inline / line-level review comments** — a single summary comment only.
- **Changing `reviewCode`'s signature or the `cli.ts` smoke harness** — both stay as-is; the CI entry is a new, separate file.

## Implementation Approach

Build inside-out: bring the **agent contract** to full fidelity first (schema + prompt + threshold + CI adapter), then layer the **composite action** (mechanics: install, diff extraction, run, format, comment, label) on top of a stable JSON contract, then the **workflow** (triggers, permissions, secret, retry/advisory control flow), and finally **end-to-end verification** on a real PR. Each phase has a runnable artifact: Phase 1 is testable locally with a `.env`; Phases 2–3 are exercisable via `act` or a draft PR; Phase 4 is the live proof.

## Critical Implementation Details

- **Shell-injection safety:** PR title/body are attacker-controlled. Pass them to the action/agent via `env:`, never via inline `${{ }}` interpolation inside a `run:` block. The diff is written to a file and read by path for the same reason.
- **Diff ordering:** exclude generated/noisy paths *before* applying the byte cap, so a large lockfile change can't consume the budget before real code is seen. If the cap truncates, the truncation note must reach the PR comment.
- **Threshold lives in code, not the prompt:** the LLM returns six scores + rationales; a pure helper computes pass/fail. This keeps the verdict deterministic and lets a unit test pin the boundary cases.

---

## Phase 1: Agent Contract (schema, prompt, threshold, CI adapter)

### Overview

Replace the 3-way `verdict` schema with the six-criteria 1–10 rubric, embed the rubric definitions in the prompt, add a deterministic pass/fail helper, and add a `src/ci.ts` entry that reads PR inputs and prints structured JSON. `reviewCode`'s signature and `cli.ts` stay untouched.

### Changes Required:

#### 1. Review schema

**File**: `packages/code-reviewer/src/schemas.ts`

**Intent**: Express the requirements' six criteria as structured output so the agent emits per-criterion scores instead of a single enum verdict.

**Contract**: New `reviewSchema` (zod) with `summary: string` and a `criteria` object whose six keys — `implementationCorrectness`, `idiomaticity`, `complexityMaintainability`, `testsRiskCoverage`, `documentation`, `securitySafety` — each hold `{ score: number (int 1–10), rationale: string }`. Retain an optional `findings[]` array (existing `{ severity, title, detail, suggestion? }`) for actionable detail in the comment, or drop it if it complicates the prompt — implementer's call. Pass/fail is **not** a schema field. Update `src/index.ts` exports if the type name changes.

#### 2. Prompt rubric

**File**: `packages/code-reviewer/src/prompts.ts`

**Intent**: Tell the model exactly what each criterion means and what 1 vs 10 looks like, so scores are calibrated to `requirements.md`.

**Contract**: Extend the system/user prompt to enumerate the six criteria with their 1/10 and 10/10 anchor descriptions (lifted from `requirements.md:13-32`) and instruct the model to return a 1–10 integer score + short rationale per criterion. Preserve the existing `Language:` / `Context:` injection points so the CI adapter can supply title+description as context.

#### 3. Pass/fail threshold helper

**File**: `packages/code-reviewer/src/verdict.ts` (new)

**Intent**: Deterministically map six scores to a pass/fail verdict, isolated for unit testing.

**Contract**: Export a pure function, e.g. `computeVerdict(criteria): { pass: boolean; overall: number }`, where `overall` is the mean of the six scores and `pass` is `overall >= 6 && implementationCorrectness.score >= 6 && securitySafety.score >= 6`. Thresholds as named constants. Export via `src/index.ts`.

#### 4. CI adapter entry

**File**: `packages/code-reviewer/src/ci.ts` (new)

**Intent**: A thin PR-reviewer entry distinct from the `cli.ts` smoke harness — reads PR inputs from the environment/filesystem, runs the agent, prints JSON for the action to consume.

**Contract**: Reads `PR_TITLE` (full) and `PR_BODY` (truncate to ~2000 chars; null/empty → `""`) from env, and the diff from a file path in `DIFF_FILE` env. Composes title + truncated body into the `options.context` string, calls `reviewCode(diff, { language: "typescript", context })`, runs `computeVerdict(...)`, and prints a single JSON object `{ summary, criteria, overall, pass }` (plus `findings` if retained) to stdout. Exit non-zero only on internal error (missing key, API/parse failure) — **not** on a "fail" verdict.

#### 5. Package script

**File**: `packages/code-reviewer/package.json`

**Intent**: Give the action a stable invocation.

**Contract**: Add `"ci": "tsx src/ci.ts"` to `scripts`.

#### 6. Tests

**File**: `packages/code-reviewer/src/verdict.test.ts` (new); update `src/check.ts` if it asserts the old schema shape.

**Intent**: Pin the threshold boundary behavior and keep the smoke test parsing against the new schema.

**Contract**: Unit tests for `computeVerdict` covering: all-6 → pass; mean ≥ 6 but security = 5 → fail; mean ≥ 6 but correctness = 5 → fail; all-high → pass. Update `check.ts` / any existing schema assertion to the new `reviewSchema`.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Unit tests pass (incl. new `verdict.test.ts`): `npm test`
- [ ] `cd packages/code-reviewer && DIFF_FILE=<sample> PR_TITLE="t" PR_BODY="" npm run ci` prints valid JSON with six scores + `pass`

#### Manual Verification:

- [ ] A hand-run against a small real diff produces sensible, calibrated per-criterion scores
- [ ] `reviewCode` signature and `cli.ts` behavior are unchanged (smoke test still runs)

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before starting Phase 2.

---

## Phase 2: Composite Action

### Overview

Create the repo's first composite action: it installs the package, extracts a filtered/capped diff, runs the CI adapter, formats a markdown comment from the JSON, posts a new PR comment, and applies the pass/fail label.

### Changes Required:

#### 1. Composite action definition

**File**: `.github/actions/code-review/action.yml` (new)

**Intent**: Own all CI *mechanics* so the workflow stays readable; the agent owns judgment.

**Contract**: `runs: using: "composite"` with `inputs` for `openrouter-api-key`, `pr-number`, `pr-title`, `pr-body`, `github-token` (and optionally `model`). Steps (each `shell: bash`): (a) `setup-node@v4` node 22; (b) `cd packages/code-reviewer && npm ci`; (c) extract diff via `gh pr diff "$PR" -- ':!package-lock.json' ':!**/dist/**' ':!**/*.generated.*'` into a file, then cap to ~12k bytes recording a `truncated` flag; (d) run `npm run ci` with `PR_TITLE` / `PR_BODY` / `DIFF_FILE` and `OPENROUTER_API_KEY` in `env:`, capturing JSON; (e) build `review.md` (summary + score table + truncation note if flagged); (f) `gh pr comment "$PR" --body-file review.md` (new comment each run); (g) ensure labels exist (`gh label create … --color … --force` for `ai-cr:passed` `1a7f37`, `ai-cr:failed` `d1242f`, `ai-cr:review` `ededed`) and apply the verdict label, removing the opposite one. `gh` steps need `GH_TOKEN` in env.

**Contract (diff cap, non-obvious)**: exclude pathspecs *before* truncation; emit the `truncated` boolean as a step output so the comment-formatting step can append the "review based on truncated diff" note.

### Success Criteria:

#### Automated Verification:

- [ ] `action.yml` parses (e.g. `actionlint` or a no-op workflow that references it) without schema errors
- [ ] Markdown formatting step produces a well-formed comment from a sample JSON fixture (local shell run)

#### Manual Verification:

- [ ] Run via `act` or a draft PR: comment renders the six-score table correctly
- [ ] Oversized diff triggers the truncation note; lockfile-only changes are excluded from the diff
- [ ] Correct label is applied and the opposite label removed; labels are created with the right colors

**Implementation Note**: Pause for human confirmation of the manual checks before Phase 3.

---

## Phase 3: GitHub Workflow

### Overview

Add the workflow that triggers on PR events to `main`, wires the secret, enforces fork/permission safety, implements retry-on-label, and stays advisory.

### Changes Required:

#### 1. Workflow definition

**File**: `.github/workflows/ai-code-review.yml` (new)

**Intent**: Trigger and orchestrate the composite action with correct permissions, concurrency, and control flow.

**Contract**:
- `on: pull_request: branches: [main], types: [opened, synchronize, reopened, labeled]`.
- Top-level `permissions: {}`; job re-grants `pull-requests: write` (comment) + `issues: write` (labels).
- `concurrency: group: ai-code-review-${{ github.event.pull_request.number }}`, `cancel-in-progress: true`.
- Job `if:` predicate combining the **fork guard** (`head.repo.full_name == github.repository`) with the **retry-on-label** rule (`github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review'`).
- Steps: `actions/checkout` (so the local action is on disk), then `uses: ./.github/actions/code-review` passing `openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}`, `github-token: ${{ secrets.GITHUB_TOKEN }}`, and PR title/body/number from the event context via `env:`/inputs (not inline interpolation).
- After the action, if the trigger was the `ai-cr:review` label, remove it (`gh pr edit "$PR" --remove-label ai-cr:review`) so it can be re-added.
- **Never `exit 1`** on a "fail" verdict.

#### 2. GitHub secret

**File**: n/a (repo configuration — manual step)

**Intent**: Supply the agent's OpenRouter key to CI.

**Contract**: Add repository secret `OPENROUTER_API_KEY` via `gh secret set OPENROUTER_API_KEY` or repo Settings → Secrets. Document the step in the change notes / PR description.

### Success Criteria:

#### Automated Verification:

- [ ] `actionlint .github/workflows/ai-code-review.yml` passes
- [ ] Workflow YAML parses and references the composite action by the correct relative path

#### Manual Verification:

- [ ] `gh secret list` shows `OPENROUTER_API_KEY`
- [ ] On a test PR the workflow triggers on `opened` and `synchronize`
- [ ] Adding `ai-cr:review` re-runs the review and the label is auto-removed afterward
- [ ] Adding an unrelated label does **not** trigger a run
- [ ] A fork PR is skipped (no secret exposure)

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: End-to-End Testing & Screenshots

### Overview

Prove the whole pipeline on a real PR against `main` and capture evidence; confirm advisory behavior and all side-effects.

### Changes Required:

#### 1. End-to-end verification run

**File**: n/a (a throwaway test PR + captured artifacts)

**Intent**: Demonstrate the requirements' expected side-effects and behavior end to end.

**Contract**: Open a test PR with a small intentional-quality change. Confirm: (a) comment with six-score table appears; (b) correct pass/fail label with correct color; (c) re-trigger via `ai-cr:review` and auto-removal; (d) a deliberately large/lockfile-heavy diff yields the truncation note and excludes generated files; (e) a "failed" verdict does **not** block merge. Capture screenshots of the comment and labels.

#### 2. Documentation note

**File**: `packages/code-reviewer/README.md` (and/or change notes)

**Intent**: Record how the CI integration works and the secret it needs.

**Contract**: Short section: the workflow/action names, required `OPENROUTER_API_KEY` secret, the six criteria + threshold, advisory-only status, and the known "new comment per run / no dedup" limitation.

### Success Criteria:

#### Automated Verification:

- [ ] CI run on the test PR completes green (workflow succeeds; advisory verdict does not fail the job)

#### Manual Verification:

- [ ] Screenshots captured of the PR comment (score table) and the applied label
- [ ] Truncation note verified on an oversized diff; generated files excluded
- [ ] Retry-on-label and label auto-removal verified live
- [ ] "Failed" verdict confirmed non-blocking on merge
- [ ] README/change notes updated

**Implementation Note**: Final phase — confirm all manual checks with the human before marking the change complete.

---

## Testing Strategy

### Unit Tests:

- `computeVerdict` boundary cases: exactly-6 pass; security=5 fail; correctness=5 fail; all-high pass.
- Schema parse of a representative agent response against the new `reviewSchema`.

### Integration Tests:

- `src/ci.ts` end-to-end against a sample diff file with a live (or mocked) OpenRouter call — asserts well-formed JSON with six scores + `pass`.
- Composite action exercised via `act` or a draft PR: comment rendering, label application, diff filtering/capping.

### Manual Testing Steps:

1. Open a test PR to `main`; confirm comment + label appear and merge is not blocked.
2. Add `ai-cr:review`; confirm a second run and that the label is removed afterward.
3. Push a commit with a large/lockfile-heavy diff; confirm exclusion + truncation note.
4. Open a fork PR; confirm it is skipped.

## Performance Considerations

Token/latency cost is dominated by diff size — bounded by the ~12k-byte cap and generated-file exclusion. PR body is capped at ~2000 chars. `concurrency` with `cancel-in-progress` ensures only one review per PR runs at a time, so rapid pushes don't stack API calls.

## Migration Notes

No data migration. The schema change is internal to `packages/code-reviewer`; because promptfoo eval specs are not yet implemented, the new six-criteria `reviewSchema` simply becomes the contract those future specs target. `reviewCode`'s signature is preserved, so any existing caller keeps working (only the return shape changes).

## References

- Research: `context/changes/ci-cd-code-review/research.md`
- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Agent entry: `packages/code-reviewer/src/agent.ts:64-66`
- Current schema: `packages/code-reviewer/src/schemas.ts:10-30`
- Prompt builder: `packages/code-reviewer/src/prompts.ts:18-29`
- CI mechanics reference: `.claude/skills/10x-impl-review-ci/references/workflow-template.yml:28-57,206`
- Existing workflow: `.github/workflows/ci.yml:3-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Agent Contract (schema, prompt, threshold, CI adapter)

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — dfd69c3
- [x] 1.2 Linting passes: `npm run lint` — dfd69c3
- [x] 1.3 Unit tests pass (incl. new `verdict.test.ts`): `npm test` — dfd69c3
- [x] 1.4 `npm run ci` prints valid JSON with six scores + `pass` — dfd69c3

#### Manual

- [x] 1.5 Hand-run against a small real diff produces calibrated per-criterion scores — dfd69c3
- [x] 1.6 `reviewCode` signature and `cli.ts` behavior unchanged — dfd69c3

### Phase 2: Composite Action

#### Automated

- [x] 2.1 `action.yml` parses without schema errors — f0c8484
- [x] 2.2 Markdown formatting produces a well-formed comment from a sample JSON fixture — f0c8484

#### Manual

- [ ] 2.3 Comment renders the six-score table correctly (via `act`/draft PR)
- [ ] 2.4 Oversized diff triggers truncation note; lockfile changes excluded
- [ ] 2.5 Correct label applied, opposite removed, colors correct

> Manual checks 2.3–2.5 deferred to Phase 4: they need a live PR run, but the triggering workflow (`.github/workflows/ai-code-review.yml`) does not exist until Phase 3. They will surface in the Phase 4 final-phase manual rollup and be verified against the throwaway test PR.

### Phase 3: GitHub Workflow

#### Automated

- [x] 3.1 `actionlint` passes on `ai-code-review.yml` — 0200831
- [x] 3.2 Workflow parses and references the composite action by correct relative path — 0200831

#### Manual

- [ ] 3.3 `gh secret list` shows `OPENROUTER_API_KEY`
- [ ] 3.4 Workflow triggers on `opened` and `synchronize`
- [ ] 3.5 `ai-cr:review` re-runs the review and is auto-removed
- [ ] 3.6 Unrelated label does not trigger a run
- [ ] 3.7 Fork PR is skipped

> Manual checks 3.3–3.7 deferred to Phase 4: they need a live PR run against `main`, and the user will set/confirm the `OPENROUTER_API_KEY` secret (3.3) before that live test. They will surface in the Phase 4 final-phase manual rollup and be verified against the throwaway test PR.

### Phase 4: End-to-End Testing & Screenshots

#### Automated

- [ ] 4.1 CI run on the test PR completes green (advisory verdict non-failing)

#### Manual

- [ ] 4.2 Screenshots of PR comment (score table) and applied label captured
- [ ] 4.3 Truncation note verified on oversized diff; generated files excluded
- [ ] 4.4 Retry-on-label and auto-removal verified live
- [ ] 4.5 "Failed" verdict confirmed non-blocking on merge
- [ ] 4.6 README/change notes updated
