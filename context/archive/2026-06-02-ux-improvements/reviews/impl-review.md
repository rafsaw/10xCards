<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX Improvements (S-06)

- **Plan**: context/changes/ux-improvements/plan.md
- **Scope**: All 6 phases
- **Date**: 2026-06-02
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated success criteria re-verified: `npm run lint` exit 0, `npm run build` exit 0. All manual Progress items `[x]` with observable evidence in the diff.

## Findings

### F1 — Unplanned eslint.config.js relaxation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:68-71
- **Detail**: A change not described in any phase: `@typescript-eslint/no-misused-promises` is turned `off` inside the Astro config block, to accommodate the Phase 1 top-level `return Astro.redirect(...)` in frontmatter. The relaxation is correctly scoped to `**/*.astro` only (base rule stays on for .ts/.tsx), the justifying comment is accurate, and the changed .astro files use `await`/`return` correctly — so no real bug is masked. Flagged only because it's an undocumented config change to a shared file.
- **Fix**: Note this config change in the plan as an addendum (benign, correctly scoped — no code change needed).
- **Decision**: PENDING

### F2 — Duplicate Topbar ownership (Layout + Welcome)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/Welcome.astro:28, src/layouts/Layout.astro:40-46
- **Detail**: Layout now renders `<Topbar/>` whenever `user` is truthy; Welcome.astro still renders its own `<Topbar/>` unconditionally. No double-render today — index.astro redirects authed users away, so Welcome only shows for signed-out users and Layout's Topbar is `user`-gated. But it's a latent double-banner if Welcome is ever reused on an authed page. The plan's Phase 2 contract explicitly anticipated this ("if it shows twice, remove the local include"); it doesn't show twice, so the include was left — but Layout is now the natural single source of truth.
- **Fix**: Remove the local `<Topbar/>` from Welcome.astro so Layout solely owns the banner. Welcome renders inside Layout, which shows the signed-out Topbar variant for null users — verify the signed-out banner still appears once before committing.
- **Decision**: PENDING

### F3 — Library search treats %/_/\ as wildcards, not literals

- **Severity**: ⓘ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (correctness)
- **Location**: src/pages/library.astro:21
- **Detail**: `safeQ` strips `, ( ) "` — exactly the set needed to prevent PostgREST `.or()` structural injection (confirmed not exploitable; RLS + middleware also scope authz). But ilike-special chars `%`, `_`, `\` pass through, so searching `50%` or `a_b` behaves as a wildcard rather than a literal match, and a trailing `\` could escape the closing `%`. UX/correctness nit, not a vulnerability.
- **Fix**: Optionally escape ilike metachars for literal matching, e.g. `safeQ.replace(/([\\%_])/g, "\\$1")` — or accept wildcard-style search.
- **Decision**: PENDING

### F4 — Save button label drift ("Save changes" vs plan's "Save to deck")

- **Severity**: ⓘ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/generate/DraftReviewList.tsx:198
- **Detail**: Cosmetic wording only — spinner + disable behavior matches Phase 3 intent exactly. The plan's prose said "Save to deck"; the button reads "Save changes". Functionally identical; noting for awareness.
- **Fix**: Leave as-is unless the "Save to deck" wording is preferred for UX copy consistency.
- **Decision**: PENDING
