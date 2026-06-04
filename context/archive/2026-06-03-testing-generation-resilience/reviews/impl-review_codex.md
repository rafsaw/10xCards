<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Runner Bootstrap + Generation Resilience (R1 + R5)

- **Plan**: `context/changes/testing-generation-resilience/plan.md`
- **Scope**: Phases 1-4 of 4
- **Date**: 2026-06-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 - Unplanned local Claude permission changes shipped with Phase 4

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `.claude/settings.local.json:137`
- **Detail**: Commit `77b5ff7` modified `.claude/settings.local.json`, adding local permission allow-list entries for `npm test`, env-key inspection, and cmd-wrapped lint/build commands. The plan's Phase 4 changed files were `context/foundation/test-plan.md` plus the change plan/progress metadata; local Claude settings were not in scope. This is benign in runtime behavior, but it is unrelated tool-state churn in a committed, tracked file.
- **Fix**: Remove the `.claude/settings.local.json` additions from this change, or document them as a separate tooling change if they are intentionally durable.
- **Decision**: PENDING

### F2 - Test env stubs are not reset with Vitest's env cleanup API

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `test/setup.ts:7`
- **Detail**: The setup file stubs `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SUPABASE_URL`, and `SUPABASE_KEY` once at module load, then only calls `vi.unstubAllGlobals()` and `vi.restoreAllMocks()` after each test. Vitest tracks `vi.stubEnv` separately from globals; its installed declaration documents `vi.unstubAllEnvs()`. As written, any future test that overrides these env vars with `vi.stubEnv(...)` can leak that env state into later tests, which contradicts the plan's intent for a single reset point for configured/unconfigured paths.
- **Fix**: Move the default env stubs into `beforeEach`, and call `vi.unstubAllEnvs()` in `afterEach` alongside `vi.unstubAllGlobals()` and `vi.restoreAllMocks()`.
- **Decision**: PENDING

### F3 - Non-gap integration tests depend on the known single-card validator gap

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/pages/api/generations.test.ts:184`
- **Detail**: Several endpoint tests outside the explicit R1 persistence-gap block stub OpenRouter with a single-card response. Examples include the trim-authority acceptance path, Supabase unconfigured/error paths, happy path, and R5 insert-payload tests. The plan says the single-card behavior is a known validator weakness that should be visible as gap characterization; when the validator is tightened to enforce the 3-card floor, these unrelated source/DB/R5 tests will fail for the wrong reason.
- **Fix**: Use a valid 3-card provider fixture for all endpoint tests that are not explicitly characterizing the R1 single-card/over-length gap. Keep the one-card or over-length response only in the `TODO(R1)` persistence-gap test block.
- **Decision**: PENDING

## Verification

| Command | Result | Notes |
|---------|--------|-------|
| `npm install` | PASS | Up to date; npm audit reported 11 vulnerabilities (9 moderate, 1 high, 1 critical). Not attributed to this review without a dependency-diff audit. |
| `npm test` | PASS | Vitest 3.2.6; 3 files passed, 35 tests passed. |
| `npm run lint` | PASS | ESLint passed; repeated `astro-eslint-parser` projectService compatibility warnings. |
| `npm run build` | PASS | Astro build passed; warnings for generated Tailwind arbitrary class CSS minification and missing `site` for sitemap. |
| `rg -n "TBD.*Phase 1|Phase 1.*TBD" context/foundation/test-plan.md` | PASS | No Phase-1 TBD markers remain. |

## Scope Evidence

Planned implementation files were present:

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `test/setup.ts`
- `test/smoke.test.ts`
- `src/lib/openrouter.test.ts`
- `src/pages/api/generations.test.ts`
- `context/foundation/test-plan.md`
- `context/changes/testing-generation-resilience/plan.md`
- `context/changes/testing-generation-resilience/change.md`

Unexpected implementation file:

- `.claude/settings.local.json` - modified in `77b5ff7`, not mentioned in the plan.

## Summary

The implemented test runner, R1 unit coverage, R1/R5 endpoint coverage, and cookbook updates are broadly aligned with the plan and all automated verification commands pass. The review is not approved yet because three low-impact issues should be cleaned up: remove or justify the unrelated local settings change, fix env-stub cleanup in the shared setup, and make non-gap endpoint tests use valid 3-card fixtures so future validator hardening does not break unrelated assertions.
