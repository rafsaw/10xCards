<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Observability Seam + Sentry

- **Plan**: context/changes/observability-sentry/plan.md
- **Scope**: Phases A–D (all) of 4
- **Date**: 2026-06-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS (1 observation) |
| Success Criteria | PASS (1 observation) |

Phases A–C are implemented faithfully: all 9 target files MATCH the plan, every
outer network-error catch is untouched, every per-component `FALLBACK_MESSAGES`
map is unchanged, and the swallow comment survives only in its consolidated home
(`parse-error.ts`). Tests 70/70 green. The change's own 9 files lint and
typecheck clean.

## Findings

### F1 — Phase D executed though the plan says it is deferred

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: plan.md:73-74, 86-87, 341-344, 385-387 vs. Progress 4.1-4.5
- **Detail**: The plan's prose repeatedly states Phase D is NOT executed in this change ("intentionally not executed" L73; "Not executing Phase D — no ... SDK install in this change" L86; "No code lands in this change" L344; "This phase is deferred. Do not execute until a Sentry DSN is provisioned" L385). Yet Phase D was fully implemented: @sentry SDK installed (package.json), sentry.client.config.ts, sentry.server.config.ts, astro.config.mjs integration, .env.example + README docs — and Progress 4.1-4.5 are all [x] (commit 403ce62), incl. manual 4.4 "with a real DSN, a forced error reaches the Sentry project." The implementation conforms to Phase D's contract (DSN from env/secret, never hardcoded; errors-only; no-op when unconfigured). The problem: the plan document is now internally self-contradictory — its "What We're NOT Doing" guardrail was deliberately crossed without the prose being reconciled.
- **Fix A ⭐ Recommended**: Reconcile the plan prose to reflect Phase D as executed in this change.
  - Strength: Work is done, committed, and verified (tests + manual DSN check); change.md is already status: implemented. Updating the four prose blocks makes the source of truth consistent with the already-[x] Progress.
  - Tradeoff: None material — a doc edit; the executed work stays.
  - Confidence: HIGH — Progress, change.md, and commit 403ce62 all agree Phase D shipped; only the prose lags.
  - Blind spot: Assumes executing Phase D now was intended (the real-DSN manual check strongly implies it was).
- **Fix B**: Treat Phase D as out-of-this-change; split it into its own change/PR and revert it here.
  - Strength: Restores strict adherence to the original scope guardrail.
  - Tradeoff: Destructive — reverts committed, verified, working code across 6+ files; high churn for no behavioral gain.
  - Confidence: MED — only worth it if Phase D was committed by mistake.
  - Blind spot: Whether anything downstream already assumes Sentry is wired.
- **Decision**: FIXED via Fix A — reconciled plan.md prose (Desired End State, What We're NOT Doing, Phase 4 heading + Overview + Changes Required + Implementation Note) to reflect Phase D as executed in commit 403ce62.

### F2 — reportError can throw back into the path it reports from

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observability.ts:27
- **Detail**: The seam exists to replace silent swallows, but the production branch calls `Sentry.captureException(err, { extra: context })` unguarded. If the SDK throws synchronously (circular/malformed context serialized into `extra`, or SDK-internal error), the throw escapes reportError — which is invoked from inside the catch block of parseErrorBody (parse-error.ts:28). The exception then propagates out of parseErrorBody and is re-swallowed by each component's outer network catch as a generic "network_error" — exactly the invisible-failure class this change was built to eliminate.
- **Fix**: Wrap the production branch so the reporter can never throw into the path it reports from: `try { Sentry.captureException(err, { extra: context }); } catch { /* never let the reporter throw */ }`. The dev console.error branch is already throw-free.
- **Decision**: FIXED — wrapped `Sentry.captureException` in try/catch at src/lib/observability.ts:27. eslint clean, tests 70/70 green.

### F3 — Outer network-error catches remain silent (by design)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: CardRow:71, CreateCardForm:50, DraftReviewList:88, PasteAndGenerateForm:69, ReviewSession:133, DeleteAccountButton:45
- **Detail**: The change fixed the inner parse swallow but the outer `catch { setError(network_error) }` blocks still discard their error without reportError. This is correctly excluded by "What We're NOT Doing" (plan.md:78-84), so it is NOT drift — but the "no silent swallow" goal is only half-met, and the seam now exists to close it.
- **Fix**: Out of scope for this change. Candidate follow-up — thread reportError(err, { where: ... }) into the outer catches.
- **Decision**: PENDING

### F4 — Stale `.js` filename in pointer comments

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/observability.ts:8, astro.config.mjs:13
- **Detail**: Two comments point at `sentry.client.config.js`; the actual file is `.ts`. Everywhere else (astro.config.mjs:28, .env.example:9, README:177) correctly says `.ts`. One is a load-bearing pointer in the seam's docstring.
- **Fix**: Change both comment references `.js` → `.ts`.
- **Decision**: FIXED — corrected `.js`→`.ts` in src/lib/observability.ts:8 and astro.config.mjs:13 (comment-only).

### F5 — Repo-wide lint/typecheck gate is red (unrelated files)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: stryker.config.mjs (8 prettier errors); tests/e2e/review-persistence.spec.ts:61 (ts2345)
- **Detail**: Plan criteria "npm run lint" and "npm run typecheck" are checked [x], but running them repo-wide now FAILS — on two files committed OUTSIDE this change's diff (mutation-testing config + an M3L4 E2E spec). This change's own 9 files lint and typecheck clean, and npm test is 70/70 green, so the change satisfies its criteria. But the repo's only gate (local lint/build/test, per AGENTS.md) is currently not green. (Note: npm run build was not re-run in this review.)
- **Fix**: Out of scope here. Flag the two unrelated failures for their own fix so the local gate goes green again.
- **Decision**: PENDING
