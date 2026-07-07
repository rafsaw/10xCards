<!-- PLAN-REVIEW-REPORT -->
# Plan Review: readPlan Tool-Loop Capability for the Code Reviewer

- **Plan**: context/changes/m5l3-agent-read-plan-tool/plan.md
- **Mode**: Deep
- **Date**: 2026-07-06
- **Verdict**: REVISE → SOUND (all findings fixed)
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding
8/8 paths ✓, symbols ✓ (`reviewCode`/`createReviewer`/`createReviewAgent`/`ReviewOptions`), new files correctly absent, brief↔plan ✓. No `docs/reference/contract-surfaces.md` (check skipped). Riskiest SDK claims (tools+`Output.object` coexistence, `.toolCalls`, `stepCountIs`) pre-verified against installed `ai@6.0.212` types during research.

## Findings

### F1 — Model may skip readPlan when structured output is bound

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Agent Wiring
- **Detail**: With a bound `Output.object` and `toolChoice: 'auto'`, a model can produce the verdict without calling readPlan. Phase 4 asserts the call but nothing ensured it.
- **Fix A ⭐ Recommended**: Strengthen the prompt (MUST call readPlan first) + keep the Phase 4 assertion as the gate. Deliberately avoid prepareStep/toolChoice forcing (fiddly with bound structured output).
- **Decision**: FIXED via Fix A (added Critical Implementation Details bullet "Tool must actually fire (F1)")

### F2 — `reviewCodeWithTrace` public method may be unnecessary

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 — change #2
- **Detail**: The verifier and ci.ts can build the plan-aware agent via `createReviewAgent(config, planContext)` and read `.toolCalls`/`.output` off `agent.generate()` directly — no new public surface needed.
- **Fix**: Drop `reviewCodeWithTrace`; keep `reviewCode` as the single public entry.
- **Decision**: FIXED (Phase 3 #2 rewritten; Phase 4 verifier updated; brief updated)

### F3 — 12 KB diff cap + context/** not excluded crowds out real code

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 #3 / Phase 4 live self-review
- **Detail**: Planning markdown (~1000 lines) lands in the diff and can consume the byte cap before code is seen, so the self-review would grade the plan against the plan docs.
- **Fix A ⭐ Recommended**: Add `':(exclude)context/**'` to action.yml diff extraction; scope the verify script's diff to `packages/code-reviewer/`.
- **Decision**: FIXED via Fix A (Phase 1 change #4 added; Phase 4 verifier scopes diff; criteria 1.8 added)

### F4 — Symlink can bypass the resolved-prefix guardrail

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots (guardrails)
- **Location**: Phase 2 — resolvePlanPath / readPlan
- **Detail**: The prefix check passes on path shape, but a symlinked `plan.md` → `/etc/passwd` or `../../.env` is followed by `fs.readFile`. Low threat (needs repo-write) but the brief asks whether guardrails are strong enough.
- **Fix**: `fs.realpath` the resolved path and re-assert it's within `allowedRoot` before reading.
- **Decision**: FIXED (readPlan contract updated; criterion 2.7 + Testing Strategy updated)

### F5 — Which phase creates readPlan.test.ts is muddled

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 criteria vs Phase 4 #1
- **Detail**: Phase 2 criteria reference the test but no Phase 2 change entry creates it.
- **Fix**: Add an explicit "create src/readPlan.test.ts" change entry to Phase 2.
- **Decision**: FIXED (Phase 2 change #3 added)
