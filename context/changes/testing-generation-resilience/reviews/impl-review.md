<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Runner Bootstrap + Generation Resilience (R1 + R5)

- **Plan**: `context/changes/testing-generation-resilience/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-06-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification

| Command | Result | Notes |
|---------|--------|-------|
| `npm test` | PASS | vitest 3.2.6; 3 files, 35 tests passed; 2 `it.fails` RED gap markers xfail as designed. |
| `npm run lint` | PASS | Only benign `astro-eslint-parser does not support projectService` warnings; no errors. |
| `npm run build` | PASS | Astro/Cloudflare build complete; warning for missing `site` (sitemap) — pre-existing, unrelated. |
| `grep TBD…Phase 1` | PASS | No Phase-1 TBD markers remain in §4/§6.1/§6.2. |

## Scope Evidence

All 7 planned implementation files verified MATCH (no production/runtime code changed; validator characterised, not altered). Planned files present: `package.json`, `package-lock.json`, `vitest.config.ts`, `test/setup.ts`, `test/smoke.test.ts`, `src/lib/openrouter.test.ts`, `src/pages/api/generations.test.ts`, `context/foundation/test-plan.md`, plus change `plan.md`/`change.md`.

Unexpected file: `.claude/settings.local.json` — modified in `77b5ff7`, not in plan (see F3).

Note: this review independently converges with the prior `impl-review_codex.md` on the same three findings.

## Findings

### F1 — Non-gap integration tests stub a single card, coupling them to the absent 3-card floor

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (test reliability)
- **Location**: src/pages/api/generations.test.ts:186 (and the happy/R5/db/trim-accept paths)
- **Detail**: Every non-gap endpoint test stubs the provider with one card via `cardsEnvelope([{ front: "Q1", back: "A1" }])` — trim-authority accept (186), supabase_unconfigured (~222), db_error (~231), happy-200 (~241), R5 insert-payload (~252). `extractCards` has no 3-card floor today (openrouter.ts:130-144 accepts ≥1), so they pass. The plan designates single-card behavior as a *gap to be made visible*, isolated to the `TODO(R1)` markers. When the floor the prompt already implies ("3 to 10") is later enforced, these six unrelated tests will return 502 `ai_parse_error` and fail for a reason unrelated to what they assert.
- **Fix**: Add a 3-card happy-path fixture (e.g. `validCards()` → 3 items) and use it for every non-gap endpoint test; adjust the `toHaveLength(1)` payload assertions to 3 / first-element shape. Keep single-card and over-length payloads ONLY in the dedicated `TODO(R1)` gap-marker tests.
  - Strength: Decouples persistence/server-authority/trim signal from the count rule, so future validator hardening flips only the gap markers — the quarantine the plan intended.
  - Tradeoff: Touches ~6 tests + length assertions; purely mechanical.
  - Confidence: HIGH — coupling is concrete; floor is foreseeable (prompt says 3–10).
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — Env stubs are never reset; setup comment invites a latent cross-test leak

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (test isolation)
- **Location**: test/setup.ts:7-15
- **Detail**: The four env vars are stubbed once at module load; `afterEach` calls `vi.unstubAllGlobals()` + `vi.restoreAllMocks()`, neither of which resets `vi.stubEnv` (Vitest tracks env on a separate stack — needs `vi.unstubAllEnvs()`). Safe today only because no test re-stubs env. But the comment at line 6 explicitly instructs future authors to override "locally with `vi.stubEnv(..., "")`" — the first test that follows that leaks the empty value into later tests in file order. (generations.test.ts already sidesteps `stubEnv` with a closure-backed mock because `astro:env/server` ignores `stubEnv`, so the comment is also misleading.)
- **Fix**: Add `vi.unstubAllEnvs()` to the `afterEach` and move the four default stubs into a `beforeEach`; drop/soften the "override locally with vi.stubEnv" suggestion in the comment.
- **Decision**: PENDING

### F3 — Local Claude permission settings committed alongside Phase 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .claude/settings.local.json (committed in 77b5ff7)
- **Detail**: Phase 4's commit added allow-list entries (`npm test`, env-key inspection, cmd-wrapped lint/build) to `.claude/settings.local.json`. The plan's Phase 4 scope was test-plan.md §4/§6.1/§6.2 plus change metadata; local Claude tool state was not in scope. Benign at runtime, but unrelated tool-state churn in a tracked file.
- **Fix**: Revert the `.claude/settings.local.json` hunk from this change, or split it into a separate tooling commit if the allowances are intentionally durable.
- **Decision**: PENDING
