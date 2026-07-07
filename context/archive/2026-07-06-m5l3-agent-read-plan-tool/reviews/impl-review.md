<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: readPlan Tool-Loop Capability

- **Plan**: context/changes/m5l3-agent-read-plan-tool/plan.md
- **Scope**: All 4 phases (complete)
- **Date**: 2026-07-06
- **Verdict**: APPROVED (one recommended hardening fix)
- **Findings**: 0 critical, 1 warning, 2 observations

Two independent sub-agents reviewed the branch diff (plan-drift detection +
safety/quality/pattern compliance). Plan adherence is tight — every phase
contract implemented as intended, no MISSING or DRIFT, no scope creep. The
security guardrails (kebab-case regex + resolved-prefix containment + realpath
symlink re-check) were adversarially attacked and found to have **no bypass**
for the stated threat model.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — readPlan re-throws (and can leak an absolute path) on non-ENOENT fs errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/readPlan.ts:110, :125
- **Detail**: Both fs try/catch blocks only special-case `ENOENT` and `throw error`
  for every other errno. Reachable edge cases: a symlink loop at `plan.md` →
  `realpath` throws `ELOOP`; `changes/<id>` existing as a file → `ENOTDIR`; an
  unreadable file → `EACCES`. Any of these makes `readPlan` reject, and `execute`
  (line 144) returns `readPlan()` directly, so the rejection propagates into the
  ToolLoopAgent — breaking the documented "never throws … returns `{ found:false }`"
  contract (lines 78–83) and the graceful-degradation guarantee (a bad `plan.md`
  would crash the whole review instead of degrading to diff-only). Additionally, a
  Node `ErrnoException` message embeds the absolute path (e.g. `EACCES: permission
  denied, realpath '/abs/.../plan.md'`); if the SDK surfaces the tool-error to the
  model, that leaks an absolute path — the one thing the module promises never to do.
  Not readily model-triggerable (the model only supplies a `changeId`), but it
  violates the module's own core contract.
- **Fix**: Broaden both catches to treat any fs error as a graceful miss — return
  `{ found: false, reason: \`Could not read plan.md at ${resolved.relativePath}\` }`
  for non-ENOENT instead of re-throwing. Upholds both the no-throw and
  no-absolute-path contracts; ~4 lines.
  - Strength: Restores the documented contract and graceful degradation; static/relative reason string, no absolute-path leak.
  - Tradeoff: Slightly less diagnostic detail on genuinely unexpected fs errors (mitigate by keeping the errno in a stderr log if desired).
  - Confidence: HIGH — mirrors the existing ENOENT handling one line up.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — Filename camelCase diverges from lowercase package convention

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: packages/code-reviewer/src/readPlan.ts (+ readPlan.test.ts)
- **Detail**: Every sibling module is lowercase (`provider.ts`, `verdict.ts`,
  `schemas.ts`, `agent.ts`, `prompts.ts`, `ci.ts`); AGENTS.md says utilities should
  be lowercase or kebab-case. `readPlan.ts` is the only camelCase source file. The
  plan itself specified `src/readPlan.ts`, so this traces to the plan, not an
  implementation slip; it also matches the exported symbol `readPlan`.
- **Fix**: Optionally rename to `read-plan.ts` / `read-plan.test.ts` (updates two
  import specifiers in `agent.ts` + `index.ts`). Low value vs. churn.
- **Decision**: PENDING

### F3 — Model may read any change's plan.md, not only the bound one

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/readPlan.ts:144
- **Detail**: The optional model-supplied `changeId` override lets the model fetch
  any other kebab-valid change's `plan.md`, not just the one under review. By design
  (documented fallback), low-risk — access stays confined to
  `context/changes/<kebab>/plan.md` and planning docs aren't sensitive — and the
  prompt already discourages passing a `changeId`. No action needed unless plan
  files ever become confidential.
- **Decision**: PENDING

## Notes

- Agent 1 raised a SHA-traceability observation (Phase 4 rows stamped `— ff97651`
  not appearing in the log); verified as a stale git view — commits `ff97651` and
  `9c810c0` exist and the working tree is clean. Void, not a finding.
- Success criteria re-verified during review: `npm test` (package: 12 passed, 1
  Windows-symlink skip), typecheck, lint (0 errors), build — all green.
