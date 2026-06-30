# CI/CD Code-Review Workflow — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Every PR to `main` should get an automatic, advisory code review from the existing M5L2 agent (`packages/code-reviewer/`), scored against the six 1–10 criteria in `requirements.md`. Today the repo has no working CI for this (the lone workflow targets `master` and never fires), and the agent isn't wired to PRs. This builds the missing pipeline.

## Starting Point

The agent is built and library-shaped — `reviewCode(code, options?, config?)` is the reusable export, run via `tsx`. But its output schema is a 3-way `verdict` enum with no per-criterion scores, its CLI is a one-arg smoke harness, and the workflow, composite action, and `OPENROUTER_API_KEY` GitHub secret don't exist yet. All CI mechanics have an in-repo reference to copy (`10x-impl-review-ci/references/workflow-template.yml`).

## Desired End State

Opening/updating a PR to `main` posts a comment with a six-criterion score table and applies an `ai-cr:passed` (green) or `ai-cr:failed` (red) label, derived from a score threshold. The review never blocks merge. Re-adding the `ai-cr:review` label re-runs it (then the label is auto-removed); fork PRs are skipped.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Schema fidelity | Six-criteria 1–10 schema, done in **Phase 1** | Core requirement; build action+workflow once against the final contract, never rewrite | Plan (revised) |
| Pass/fail rule | mean ≥ 6 **and** correctness ≥ 6 **and** security ≥ 6 | Simple advisory rule with a hard floor on the riskiest dimensions | Plan |
| PR description | Include, truncated ~2000 chars (null→`""`) | Adds stated-intent signal at bounded token cost; diff stays primary | Plan |
| Diff guardrails | Exclude lockfiles/`dist`/generated, cap ~12k chars, note truncation in comment | Cuts noise first, never silently drops scope | Plan |
| CI adapter | New `src/ci.ts` (+ `npm run ci`); `reviewCode`/`cli.ts` untouched | Keeps the library + eval surface stable | Plan |
| Comment dedup | None — new comment per run | MVP simplicity; dedup is a future enhancement | Plan |
| Trigger branch | `main`, not `master` | Resolves the `AGENTS.md` tripwire so CI actually runs | Research |

## Scope

**In scope:** six-criteria scored schema + rubric prompt + threshold; `src/ci.ts` adapter; composite action (`.github/actions/code-review/action.yml`); workflow (`.github/workflows/ai-code-review.yml`); `OPENROUTER_API_KEY` secret; PR comment + pass/fail label; retry-on-label; advisory-only; E2E proof + screenshots.

**Out of scope:** business-alignment & architecture-fit criteria; blocking/required check; comment dedup; promptfoo eval specs; `claude-code-action`/Anthropic path; inline line-level comments; changing `reviewCode`'s signature.

## Architecture / Approach

Inside-out. The **agent** owns judgment (six scores + rationale); a pure `computeVerdict` helper turns scores into pass/fail in code (deterministic, unit-tested). The **composite action** owns mechanics: install package, extract→filter→cap diff, run `npm run ci` with PR inputs in `env:` (injection-safe), format markdown, post comment, apply labels via `gh`. The **workflow** owns triggers/permissions/secret and control flow: fork guard, retry-on-label predicate (`github.event.label.name == 'ai-cr:review'`), advisory (never `exit 1`). We commit nothing, so the reference template's `[skip ci]`/recursion guard is dropped.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Agent contract | Six-criteria schema + rubric prompt + `computeVerdict` + `src/ci.ts` | Score calibration / prompt quality |
| 2. Composite action | `action.yml`: diff extraction, comment, labels | First composite action in repo; diff cap/exclude logic |
| 3. Workflow | `ai-code-review.yml` + secret; triggers, fork guard, retry, advisory | Retry-on-label predicate; secret setup |
| 4. E2E + screenshots | Live proof on a test PR; docs | Real OpenRouter cost/latency on a real diff |

**Prerequisites:** `OPENROUTER_API_KEY` available to add as a GitHub secret; ability to open a test PR against `main`.
**Estimated effort:** ~3–4 focused sessions across 4 phases.

## Open Risks & Assumptions

- Score calibration depends on prompt quality — the six-criteria rubric may need a tuning pass after the first real runs.
- Advisory verdict must stay non-blocking — do not wire it as a required status check.
- New-comment-per-run will accumulate comments on long-lived PRs (accepted MVP tradeoff; dedup deferred).
- OpenRouter cost/latency on large diffs is bounded by the cap but not eliminated.

## Success Criteria (Summary)

- A PR to `main` gets a comment with six 1–10 scores and a correct pass/fail label, without blocking merge.
- Re-adding `ai-cr:review` re-runs the review; fork PRs are skipped; oversized diffs show a truncation note.
- `computeVerdict` thresholds are covered by passing unit tests.
