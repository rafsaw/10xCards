# readPlan Tool-Loop Capability for the Code Reviewer — Plan Brief

> Full plan: `context/changes/m5l3-agent-read-plan-tool/plan.md`
> Research: `context/changes/m5l3-agent-read-plan-tool/research.md`

## What & Why

Add one read-only capability — `readPlan` — to the existing `packages/code-reviewer` agent so
it can read `context/changes/<change-id>/plan.md` and compare a git diff against the
implementation plan. This turns a tool-less "diff in → verdict out" scorer into a first
**tool-loop agent** (the M5L3 lesson): the model decides to call a tool, receives the result,
and continues the review.

## Starting Point

The reviewer is **already** built on `ai@6`'s `ToolLoopAgent` with `Output.object` and **zero
tools** — `src/agent.ts:39` explicitly calls it "the seam to add review tools later." It
receives only the diff plus `{ language?, context? }`; no change-id or plan path flows through
today. CI extracts the diff and runs `npm run ci`.

## Desired End State

When a `changeId` is available, the reviewer calls `readPlan` before scoring, and its `summary`
+ `findings` report implemented / missing / scope-drift / out-of-plan items. With no plan (or
no change-id) it says so and reviews the diff only — exactly like today. The tool can read
**only** `plan.md` under a validated `context/changes/<kebab-id>/`. The `reviewSchema` output
and `reviewCode` signature are unchanged.

## Key Decisions Made

| Decision                         | Choice                                             | Why (1 sentence)                                                                 | Source   |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Real tool loop vs pre-read prompt | Attach a real `tool()` to the existing agent       | The tool-less `ToolLoopAgent` seam already exists — a genuine loop is low-risk.  | Research |
| change-id source                 | Model-supplied, hard-validated, trusted default    | Demonstrates model-driven tool input while the regex + fixed root keep it safe.  | Plan     |
| Path guardrail                   | Kebab-id charset regex **+** resolved-prefix check  | Two independent layers block traversal, absolute paths, `.env`, arbitrary reads. | Research |
| CI wiring                        | Wire `CHANGE_ID` into the composite action now      | End-to-end plan-aware PR review; a branch with no plan degrades to diff-only.    | Plan     |
| Output shape                     | `summary` prose **+** `findings[]` for plan gaps    | Reuses the existing optional array for structured gaps; schema unchanged.        | Plan     |
| Loop bound                       | `stopWhen: stepCountIs(3)`                          | One tool call + final generation with headroom; never unbounded.                 | Plan     |
| Proof of use                     | Inspect `.toolCalls` for a `readPlan` entry         | `generate()` returns `.toolCalls`/`.steps` natively — deterministic evidence.    | Research |

## Scope

**In scope:** `changeId`/`contextRoot` input (library + `ci.ts` + CI action); guarded
`src/readPlan.ts` (resolver + reader + `tool` factory); agent wiring behind change-id presence
with a bounded loop; additive plan-aware prompt; guardrail unit tests + a live `verify:plan`
script; README note.

**Out of scope:** write-tools; any external side effects (GitHub/Jira/Linear/Slack/network
writes) beyond the existing advisory flow; schema changes; new runtime deps; required
eval/promptfoo changes; a branch→change-id database (CI uses the branch's last segment).

## Architecture / Approach

`readPlan.ts` exposes a pure `resolvePlanPath` (kebab-id regex → `context/changes/<id>/plan.md`
→ resolve → prefix-check), an async `readPlan` returning `{ found, path, content } | { found:
false, reason }` (never throws into the loop, never leaks absolute paths), and a
`createReadPlanTool` factory. `createReviewAgent(config, planContext?)` attaches the tool with
`stepCountIs(3)` **only when** a change-id is present; otherwise the current tool-less
single-generation agent is reused. Callers needing proof-of-use (the `verify:plan` script,
ci.ts stderr logging) build the agent directly and read `.toolCalls` off `agent.generate()` —
no new public method; the eval-facing `reviewCode` stays the single public entry.

## Phases at a Glance

| Phase                              | What it delivers                                             | Key risk                                                        |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Input contract                  | `changeId`/`contextRoot` through lib + `ci.ts` + CI action  | Branch→change-id derivation edge cases (mitigated: diff-only). |
| 2. readPlan + guardrails           | Guarded resolver/reader + `tool` factory, pure unit-tested  | A guardrail gap; mitigated by two independent layers + tests.  |
| 3. Agent wiring + instructions     | Bounded tool loop; additive plan-aware prompt               | Regressing the tool-less path; mitigated by presence-gating.   |
| 4. Verification / self-review      | Unit tests + live `verify:plan` proof against this plan     | Model not calling the tool; asserted via `.toolCalls`.         |

**Prerequisites:** `OPENROUTER_API_KEY` in `packages/code-reviewer/.env` for live checks
(Phases 3–4). Phases 1–2 need no key.
**Estimated effort:** ~1–2 sessions across 4 small phases.

## Open Risks & Assumptions

- CI derives the change-id from the branch's last segment; a mismatch simply yields a diff-only
  review (safe, but auto-provenance is coarse — a future enhancement).
- The model may choose not to call `readPlan`; the prompt instructs it to, and Phase 4 asserts
  the call actually fired.
- `contextRoot` defaults to `<cwd>/../../context`, correct from the package cwd locally and in
  CI; overridable via `contextRoot`/`CONTEXT_ROOT`.

## Success Criteria (Summary)

- With a change-id, the reviewer demonstrably calls `readPlan` and compares the diff to the
  plan (implemented/missing/scope-drift in `summary` + `findings`).
- Guardrails reject traversal / absolute / `.env` / arbitrary paths (pure tests, no API).
- No plan → graceful diff-only review; no schema change; no external side effects.
