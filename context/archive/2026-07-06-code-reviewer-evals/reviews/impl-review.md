<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Promptfoo Evals for code-reviewer

- **Plan**: context/changes/code-reviewer-evals/plan.md
- **Scope**: All 3 phases (complete)
- **Date**: 2026-07-06
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

**Notes:** The three plan deviations (raw-diff loading via a path var, latency-only
guardrail, gpt-4o-mini judge) were all pre-approved during implementation, documented
in code + README, and are internally consistent. All frozen files (`reviewCode`,
`reviewSchema`, `computeVerdict`, `index` barrel) verified UNCHANGED. No scope creep.
All three planted flaws confirmed present in the fixture. Two "verify" items raised by
the safety agent (Promptfoo passing the parsed object to the `.mjs` assertion; the
`.mjs` → `../../src/index.js` TS-source import resolving under Promptfoo's loader) are
already empirically confirmed by the live `eval-8Ie` run, where `verdictFail` loaded and
returned PASS on claude & deepseek — so neither is an open finding.

## Findings

### F1 — Model call has no timeout; a hung model blocks the matrix

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: packages/code-reviewer/evals/reviewerProvider.ts:79-83
- **Detail**: `reviewCode()` is awaited with no `AbortSignal`/timeout, and the `latency`
  guardrail (threshold 120000) is evaluated post-hoc — it flags a slow cell only after the
  call returns, so it cannot cancel the observed ~382s glm-5.1 hang; Promptfoo blocks on
  that provider for the full duration. Real but low-stakes: manual, dev-only eval.
- **Fix**: Document a Promptfoo wall-clock cap in the README (e.g. `PROMPTFOO_EVAL_TIMEOUT_MS`),
  or thread `AbortSignal.timeout(...)` into the provider's `reviewCode` call.
- **Decision**: PENDING

### F2 — Fixture reviewed with language hint "typescript" but it's .jsx

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: packages/code-reviewer/evals/reviewerProvider.ts:81
- **Detail**: The provider passes `{ language: "typescript" }` while the fixture is JSX. It's
  only a model hint, matches what the plan literally specified, and didn't affect flaw
  detection (all models found the flaws). Purely cosmetic accuracy.
- **Fix**: Change the hint to "jsx" (or "tsx"), or leave as-is — no behavioral impact.
- **Decision**: PENDING
