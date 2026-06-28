<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Code-Reviewer → Modular ToolLoopAgent

- **Plan**: context/changes/tool-loop-agent/plan.md
- **Scope**: Phases 1–2 of 2 (full plan)
- **Date**: 2026-06-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS (1 observation) |
| Pattern Consistency | PASS (3 observations) |
| Success Criteria | PASS |

## Notes

- Automated criteria re-run independently: `npm run typecheck` green; `index.ts` is barrel-only (no inline schema/prompt, no `generateText`/`main()`/`system:`/`Output.object`); all required exports present; `provider.ts` + `cli.ts` exist; `package.json` `start`→`src/cli.ts` with an `exports` map.
- Manual items (1.3, 2.5, 2.6) carry observable evidence (smoke output, fail-fast run, deterministic `buildReviewPrompt` probe) — not rubber-stamped.
- Intentional divergence: one-shot signature `reviewCode(code, options?, config?)` vs plan's loosely-worded `(code, config?, options?)` — pre-authorized by the plan, better ergonomic order, consistent across code/docstrings/README.
- Plan-drift sub-agent: all 7 Phase-1/Phase-2 items MATCH, no missing pieces, no scope creep; `check.ts` untouched and still valid via public exports.
- Safety sub-agent: no CRITICAL/WARNING. `loadEnv` ENOENT handling correct; `createModel` fails fast on missing key (no hardcoded/logged secrets); CLI catches the billable call and uses `process.exitCode`; the prompts↔agent import cycle is type-only (erased under `verbatimModuleSyntax`), runtime graph acyclic; `index.ts` side-effect-free; the `ReviewOutput = ReturnType<typeof Output.object<Review>>` alias is the idiomatic dodge for the TS4058 nameability concern.

## Findings

### F1 — ReviewOptions placement forces a type-only back-reference

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/agent.ts:25-30 / src/prompts.ts:1
- **Detail**: `ReviewOptions` is defined in `agent.ts` but its only consumer is `buildReviewPrompt` in `prompts.ts`, so `prompts.ts` reaches back with `import type { ReviewOptions } from "./agent.js"`. The cycle is type-only (erased under `verbatimModuleSyntax`) and runtime-safe, but the dependency direction is slightly inverted.
- **Fix**: Move `ReviewOptions` into `prompts.ts` and re-export it from `agent.ts` + the barrel. Removes the back-reference; public surface unchanged.
- **Decision**: SKIPPED (save report only)

### F2 — README usage example uses a non-resolving import path

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: README.md (Usage code block)
- **Detail**: Example imports `from "./src/index.ts"` (`.ts` extension + `./src` path), which predates this change but contradicts the package's own NodeNext/`exports` convention now documented alongside it — consumers use `@10xcards/code-reviewer` → `dist/index.js`, and `.ts` won't resolve under plain NodeNext.
- **Fix**: Change the example import to `@10xcards/code-reviewer`.
- **Decision**: SKIPPED (save report only)

### F3 — Stale "generateText" comment in check.ts now inaccurate

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/check.ts:5
- **Detail**: `check.ts` was intentionally not changed, but its header comment still says the pipeline is "...-> generateText -> ...". The actual path is now `ToolLoopAgent.generate`. Code still works (drives the public `reviewCode`); only the comment is stale.
- **Fix**: Update the comment to "...-> ToolLoopAgent.generate -> ...".
- **Decision**: SKIPPED (save report only)

### F4 — cli.ts entrypoint diverges from check.ts conventions

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/cli.ts:1-2, 24
- **Detail**: Two small inconsistencies between the package's two runnable entries: (a) `cli.ts` deep-imports from `./agent.js` + `./provider.js` while `check.ts` imports through the barrel `./index.js`; (b) `cli.ts` prints the raw error (full stack) where `check.ts` prints `error.message` only. Both defensible — the deep import dodges any barrel/cycle question and a CLI smoke run arguably wants the stack — but they're avoidable divergences.
- **Fix**: Optional — align `cli.ts` to import via `./index.js`; leave the error-print as-is.
- **Decision**: SKIPPED (save report only)
