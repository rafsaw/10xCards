---
date: 2026-06-29T19:35:53-05:00
researcher: Rafal S
git_commit: 892a18d5201eee4ef3c9bc89bad721226ef4ab26
branch: learning/m5
repository: 10xCards
topic: "CI/CD code-review workflow driven by the M5L2 code-reviewer agent"
tags: [research, codebase, ci-cd, github-actions, code-reviewer, composite-action, openrouter]
status: complete
last_updated: 2026-06-29
last_updated_by: Rafal S
---

# Research: CI/CD code-review workflow driven by the M5L2 code-reviewer agent

**Date**: 2026-06-29T19:35:53-05:00
**Researcher**: Rafal S
**Git Commit**: 892a18d5201eee4ef3c9bc89bad721226ef4ab26
**Branch**: learning/m5
**Repository**: 10xCards

## Research Question

Build a GitHub Actions workflow for pull requests that runs the existing **M5L2 code-review agent** (`packages/code-reviewer/`) as a **composite action**, feeding it the PR title, description, and git diff; scoring the change against six review criteria; and producing two side-effects — a PR comment with the review summary and a pass/fail label (`ai-cr:passed` / `ai-cr:failed`). Behavior: first review on a new PR, re-run when the `ai-cr:review` label is added, advisory only (does not block merge). Source: `context/changes/ci-cd-code-review/requirements.md`.

**Scoping decisions confirmed with the user before research:**
- **Invocation:** standalone Node agent (`packages/code-reviewer`) invoked from a **local composite action**, OpenRouter key as a GitHub secret — *not* the `claude-code-action` / Anthropic path used by `10x-impl-review-ci`.
- **Trigger branch:** `main` (the actual working branch), not `master` as written in `requirements.md` — resolving the known repo tripwire (`AGENTS.md` Agent Tripwires).

## Summary

The agent is **built and production-ready** as a library (`reviewCode()` is the reusable export), and all the CI plumbing patterns we need already exist as a reference in the repo. The workflow itself, the composite action, and the GitHub secret do **not** exist yet — this is greenfield wiring.

**The single most important finding is a contract mismatch (drift):** the requirements describe a review scored on **six named criteria, each 1–10**, with pass/fail derived from those scores. The existing agent emits a *different* shape — `{ summary, verdict, findings[] }`, where `verdict` is a 3-way enum (`approve` / `comment` / `request_changes`) and findings carry a 4-level `severity` — and accepts only **a single positional code string** (no title / description / diff structure, no scoring, no threshold). The plan must choose between (A) shipping the workflow against the agent's *current* `verdict` shape with minimal change, or (B) extending the agent's schema/prompt to the six-criteria rubric the requirements specify. This is the key decision to resolve in `/10x-plan`.

Everything else (triggers, labels, comments, concurrency, fork safety, advisory gating, diff extraction) is well-understood and has a concrete in-repo precedent to copy.

## Detailed Findings

### Area 1 — The code-reviewer agent (the reusable component)

A standalone TypeScript package using ai-sdk's `ToolLoopAgent` over OpenRouter. No compiled artifact is needed at runtime — it runs via `tsx`.

**Invocation & runtime**
- `npm start` → `tsx src/cli.ts` (`packages/code-reviewer/package.json:17`); `npm run check` → `tsx src/check.ts` (`:18`); `npm run build` → `tsc` to `dist/` (`:19`).
- `"type": "module"` (`package.json:5`); **no `bin`, no `engines`** field. Deps: `@openrouter/ai-sdk-provider`, `ai`, `zod` (`package.json:22-26`).

**Inputs — the CLI is a smoke-test harness, not a PR reviewer**
- The CLI reads exactly one positional arg: `const code = process.argv[2] ?? <sample>` then `reviewCode(code, { language: "typescript" })` (`packages/code-reviewer/src/cli.ts:17-19`).
- **No flag parsing, no stdin, no file reading, no PR title / description / diff handling.** The library function `reviewCode(code, options?, config?)` only accepts `options.language` and `options.context` (`src/agent.ts:64-66`), injected as `Language:` / `Context:` lines around a fenced code block (`src/prompts.ts:18-29`).
- To feed a diff *today* you would cram the entire diff into the single `code` string and lose title/description structure.

**Structured output — the schema**
- `reviewSchema = { summary: string, verdict: "approve"|"comment"|"request_changes", findings: { severity: "info"|"minor"|"major"|"critical", title, detail, suggestion? }[] }` (`packages/code-reviewer/src/schemas.ts:10-30`).
- **No per-criterion scoring exists.** None of the six required criteria appear; there are no numeric 1–10 score fields. Output is JSON only — `JSON.stringify(review, null, 2)` (`src/cli.ts:20`, `src/check.ts:35`). Nothing renders markdown for a PR comment; the `summary` prose string is the only directly reusable text.

**Pass/fail — there is none**
- `check.ts` despite its name is an end-to-end integration test, not a gate (`src/check.ts:3-8`). It only "fails" (exit 1) when `OPENROUTER_API_KEY` is missing or the API call / `reviewSchema.parse()` throws (`src/check.ts:11-17,30,36-40`). **No numeric threshold maps scores to a verdict.**

**Env & model**
- Required: `OPENROUTER_API_KEY` (`src/provider.ts:38-41`). Optional: `OPENROUTER_MODEL` (`:44`). Default model `anthropic/claude-sonnet-4.5` (`src/provider.ts:21`, also hardcoded `src/check.ts:19`). `loadEnv()` tolerates a missing `.env` (`src/provider.ts:28-34`), so CI can inject the vars directly into the environment.

**Reusable surface**: `reviewCode(code, options?, config?)` is the library entry (`src/agent.ts:64-66`, exported via `src/index.ts:7-16`); README documents it as the "eval-facing export" for future promptfoo work (`packages/code-reviewer/README.md:90-126`).

### Area 2 — CI mechanics, composite action, labels & comments

**Existing CI** (`.github/workflows/ci.yml`) — the repo's only workflow:
- Triggers on `push`/`pull_request` to **`master`** (`ci.yml:3-7`); working branch is `main`, so **CI never fires** (accepted tripwire, `AGENTS.md`). Our workflow must target `main`.
- `ubuntu-latest`, `setup-node@v4` node 22 + npm cache (`ci.yml:11-17`); steps `npm ci → npx astro sync → npm run lint → npm run build` (`:18-21`). Only secrets in use repo-wide are `SUPABASE_URL` / `SUPABASE_KEY` (`:23-24`). No `permissions:`, `concurrency:`, or labels.

**Reference harness to mirror** — `.claude/skills/10x-impl-review-ci/references/workflow-template.yml` (built for `claude-code-action`; we reuse its *mechanics*, not its brain):
- `permissions: {}` at top, minimal job-level re-grant (`:36,52-57`). For our design: `pull-requests: write` (comment) + `issues: write` (labels are issues). Drop `contents: write` (we commit nothing). Add `statuses: write` only if posting an advisory commit status.
- `concurrency: group: ...-${{ pr.number }}` + `cancel-in-progress: true` (`:48-50`) — one in-flight review per PR.
- Trigger types `[opened, synchronize, reopened, labeled, unlabeled]` (`:28-34`).
- Fork-PR guard `head.repo.full_name == github.repository` (`:47`) — fork PRs can't read our `OPENROUTER_API_KEY` secret; keep it.
- The template's `[skip ci]` / bot-recursion guard (`:80-102`) exists **only because it commits back to the branch**. **We do not need it** — posting a comment + labels commits nothing, so a push loop is structurally impossible. *But* adding/removing a label fires `labeled`/`unlabeled` events, so we must avoid reacting to our **own** label writes (see Area 3).
- Comment dedup via a hidden HTML-comment marker on the first line (`:206`) so re-runs update one canonical comment instead of spamming.

**Composite action** — **none exists** in the repo (no `action.yml` anywhere); this would be the first. Structure: `runs: using: "composite"`, every `run` step needs an explicit `shell: bash`, secrets are **not** auto-available — pass them as `inputs`, and the workflow must `actions/checkout` first so `./.github/actions/...` is on disk. Reference via `uses: ./.github/actions/<name>`.

**Labels & comments via `gh`** (needs `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in step env):
- Comment: `gh pr comment "$PR" --body-file review.md`; dedup with `--edit-last --create-if-none`, or marker-based PATCH via `gh api .../issues/comments/$CID`.
- Labels: `gh pr edit "$PR" --add-label / --remove-label`; idempotent create with color via `gh label create "ai-cr:passed" --color 1a7f37 --force` (green) / `d1242f` (red) / `ededed` (gray for `ai-cr:review`).

**Extracting PR inputs in the workflow:**
- Title/body from context: `github.event.pull_request.title` / `.body` (body may be null — guard). Pass via `env:` not inline `run:` interpolation to avoid shell injection from attacker-controlled PR text.
- Diff: `gh pr diff "$PR"` (simplest, merge-base aware) or `git diff origin/main...HEAD` (needs `fetch-depth: 0`). **Cost/size concern:** large diffs blow up tokens/latency and can exceed context — consider capping size and excluding lockfiles/generated files (`:!package-lock.json`, `:!**/dist/**`). This is the same concern flagged as `?? cost tradeoff` against the PR description in `requirements.md:10`.

**Secret status:** `OPENROUTER_API_KEY` is the canonical var name (`.env.example:3`, `packages/code-reviewer/.env.example:4`) but **does not exist as a GitHub Actions secret** — only `SUPABASE_*` are wired into CI. Existing `OPENROUTER_API_KEY` references are for Cloudflare Worker secrets / local `.env` (`context/foundation/infrastructure.md:109`, `context/deployment/deploy-plan.md:463`). **Must be added** via `gh secret set OPENROUTER_API_KEY` (or repo settings).

### Area 3 — Requirements, behavior, and the retry-on-label flow

The six criteria (each with a 1–10 rubric) are fully specified in `context/changes/ci-cd-code-review/requirements.md:13-32`: implementation correctness, idiomaticity, complexity/maintainability, tests & risk coverage, documentation, security & safety. Parked: business alignment, architecture fit (`:34-37`). Side-effects: PR comment + `ai-cr:failed`/`ai-cr:passed` label (`:39-42`). Behavior: first review on new PR, retry on `ai-cr:review` label, **advisory only** (`:44-48`).

**Mapping verdict → label (current schema):** with the agent's existing 3-way `verdict`, the natural mapping is `approve → ai-cr:passed`, `comment | request_changes → ai-cr:failed`. With a six-criteria rewrite, pass/fail would instead come from a score threshold (e.g. all criteria ≥ N, or mean ≥ N).

**Retry-on-label** is the one non-obvious control-flow detail. `ai-cr:review` is not a special GitHub trigger — it's an ordinary label, surfaced through the `pull_request` `labeled` event. The clean predicate (avoiding reacting to our own `ai-cr:passed`/`ai-cr:failed` writes):

```yaml
if: >
  github.event.pull_request.head.repo.full_name == github.repository &&
  ( github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review' )
```

`github.event.label.name` is the single label that fired a `labeled` event. After running, the workflow should remove `ai-cr:review` so it can be re-added to request another pass. Note the template's `contains(labels.*.name, ...)` predicate (`workflow-template.yml:47`) checks *current* labels (true on every event while present) — different semantics from "the label that just triggered this event"; we want the latter.

**Advisory only:** never `exit 1` to fail the check, and do not make this a required status in branch protection. Labels + comment are purely informational.

## Code References

- `packages/code-reviewer/src/cli.ts:17-20` — single positional-arg input; JSON-only output
- `packages/code-reviewer/src/agent.ts:64-66` — `reviewCode(code, options?, config?)` reusable export
- `packages/code-reviewer/src/schemas.ts:10-30` — `reviewSchema` (`summary` + 3-way `verdict` + `findings[]`); **no 1–10 criteria scores**
- `packages/code-reviewer/src/prompts.ts:18-29` — prompt builder injecting `language`/`context` only
- `packages/code-reviewer/src/provider.ts:21,38-44` — `OPENROUTER_API_KEY` required, `OPENROUTER_MODEL` optional, default `anthropic/claude-sonnet-4.5`
- `packages/code-reviewer/src/check.ts:11-40` — integration smoke test; no score threshold / gate
- `packages/code-reviewer/package.json:15-26` — scripts (`tsx`-based) and deps; no `bin`
- `.github/workflows/ci.yml:3-24` — sole existing workflow; triggers on `master` (never runs)
- `.claude/skills/10x-impl-review-ci/references/workflow-template.yml:28-57,80-102,206` — trigger types, permissions, concurrency, fork guard, recursion guard, dedup marker
- `context/changes/ci-cd-code-review/requirements.md:13-48` — six criteria, side-effects, behavior
- `.env.example:3` / `packages/code-reviewer/.env.example:4` — `OPENROUTER_API_KEY` canonical name

## Architecture Insights

- **The agent is library-shaped, not CLI-shaped, for this job.** The cleanest integration is a thin **CI adapter** (a small new entry script, e.g. `src/ci.ts`, or extending `cli.ts`) that reads PR title/description/diff from env or args, calls `reviewCode(...)`, and prints the result — rather than abusing the single positional arg. This keeps the reusable `reviewCode` export untouched and eval-friendly.
- **Separation of concerns mirrors the reference harness:** the composite action owns *mechanics* (checkout, install, run agent, format markdown, post comment, set labels); the agent owns *judgment*. This is exactly how `10x-impl-review-ci` splits workflow-mechanics from skill-judgment.
- **Advisory-by-construction is simpler here than in the reference.** Because we never commit back, we shed the entire `[skip ci]`/recursion-guard apparatus; the only loop risk is self-triggered label events, handled by the `if:` predicate.
- **Workspace shape:** `packages/code-reviewer` is a nested package but the root has **no npm/pnpm workspaces config** — the composite action must `cd packages/code-reviewer && npm ci` (or `npm ci` there) independently of the root install.

## The central decision for `/10x-plan`: schema fidelity

| | **Path A — ship against current schema** | **Path B — extend to six-criteria rubric** |
|---|---|---|
| Agent change | none (or a thin CI adapter only) | rewrite `schemas.ts` (6 scored criteria + overall), update `prompts.ts`, add threshold logic |
| Pass/fail | `verdict` enum → label | scores → threshold → label |
| Fidelity to `requirements.md` | partial (no 1–10 scores in output) | full |
| Effort | low — workflow + action only | medium — agent + workflow + action |
| Eval impact | `reviewCode` contract unchanged | promptfoo specs (M5L3 prep) must track new schema |

**Recommendation:** since the requirements deliberately authored a six-criteria 1–10 rubric (and the m5l3 notes expect the agent to consume those definitions for structured output), **Path B is the faithful choice** — but it can be **phased**: Phase 1 ships the workflow + composite action against the current `verdict` shape to prove the pipeline end-to-end (matches the m5l3 note's "Phase 1–4 first, promptfoo later"), then a follow-up phase swaps in the six-criteria schema + threshold. Confirm the phasing in planning.

## Historical Context (from prior changes)

- `_rafal_notes/m5/m5l3.md:43-78` — the original loose requirements (this exact MVP), plus the intended flow: requirements → criteria-extension prompt → research → plan → phased implement (`:122-194`). Names the workflow `ai-code-review.yml`, the OpenRouter key as a GitHub secret, and a local composite action.
- `_rafal_notes/m5/STATUS.md:13-36` — explicit: **M5L3 practical task NOT done**; recent `m5l3` commits are *prep only* (plan/research/brief + package refactor), not the completed lesson.
- `.claude/prompts/m5l2-agent.md:4-9` — the M5L2 task that produced `packages/code-reviewer` (convert `index.ts` into a modular ToolLoopAgent; keep `reviewCode` reusable for promptfoo).
- `.claude/prompts/m5l3-promptfoo.md` — *planned* multi-model eval (promptfoo) over the reviewer; not implemented. Out of scope for the workflow itself but constrains schema changes (keep `reviewCode` eval-stable).
- `10x-impl-review-ci` skill + `workflow-template.yml` — a parallel, more elaborate CI reviewer (plan-drift, Anthropic API, commit-back, inline comments, blocking gate). **Deliberately not our path** — but the richest source of GitHub-Actions mechanics to copy.

## Related Research

- None prior under `context/changes/**/research.md` for this topic — this is the first research artifact for `ci-cd-code-review`.

## Open Questions

1. **Schema fidelity (the big one):** Path A vs Path B above — ship against current `verdict`, or extend the agent to the six-criteria 1–10 rubric? (Recommend phased Path B.)
2. **Include the PR description?** `requirements.md:10` flags a `?? cost tradeoff`. Title + diff are clearly worth it; the description adds tokens for sometimes-marginal signal. Decide whether to pass it, truncate it, or drop it.
3. **Pass/fail threshold (if Path B):** all criteria ≥ N? mean ≥ N? a hard floor on security/correctness? Define before implementing.
4. **Diff size/cost guardrails:** cap diff bytes, exclude lockfiles/generated/`dist`? What happens on an over-large diff — skip, truncate-with-notice, or chunk?
5. **Workflow + action file names/paths:** `.github/workflows/ai-code-review.yml` and `.github/actions/code-review/action.yml` (m5l3 notes suggest `ai-code-review.yml`).
6. **CI adapter location:** new `packages/code-reviewer/src/ci.ts` vs extending `cli.ts` to accept structured inputs — keep `reviewCode` and the eval surface untouched.
7. **Comment dedup strategy:** marker-based PATCH vs `gh pr comment --edit-last --create-if-none`.
